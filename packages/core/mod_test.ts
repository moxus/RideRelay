import { createSyncService } from "./mod.ts";
import { syntheticFit } from "./fixtures.ts";
import type { GarminAdapter } from "../contracts/mod.ts";
import { join } from "node:path";
function equal(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}
function mock(upload: GarminAdapter["upload"]): GarminAdapter {
  return {
    connected: () => Promise.resolve(true),
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    profile: () => Promise.resolve({ displayName: "Test" }),
    upload,
  };
}
Deno.test("FIT backup, persistence, hash dedup and atomic concurrent upload", async () => {
  const dir = await Deno.makeTempDir();
  let uploads = 0;
  const garmin = mock(async (bytes) => {
    equal(Array.from(bytes), Array.from(syntheticFit()));
    uploads++;
    await new Promise((r) => setTimeout(r, 30));
    return { duplicate: false, activityId: "42" };
  });
  const s = await createSyncService({ dataDir: dir, garmin });
  let other: Awaited<ReturnType<typeof createSyncService>> | undefined;
  try {
    const source = join(dir, "source");
    await Deno.mkdir(source);
    await s.saveSettings({ sourceDir: source });
    const bytes = syntheticFit();
    await Deno.writeFile(join(source, "ride.fit"), bytes);
    other = await createSyncService({ dataDir: dir, garmin });
    const [[a]] = await Promise.all([s.scan(), other.scan()]);
    equal(a.status, "ready");
    equal(a.avgPower, 185);
    equal(a.startedAt, "2026-09-20T08:00:00.000Z");
    equal(Array.from(await Deno.readFile(a.backupPath!)), Array.from(bytes));
    await Deno.writeFile(join(source, "copy.fit"), bytes);
    equal((await s.scan()).length, 1);
    equal((await other.snapshot()).settings.sourceDir, source);
    await Promise.all([s.sync(), other.sync()]);
    equal(uploads, 1);
    equal((await s.snapshot()).activities[0].status, "synced");
    equal(
      Array.from(await Deno.readFile(join(source, "ride.fit"))),
      Array.from(bytes),
    );
    other.close();
    other = await createSyncService({ dataDir: dir, garmin });
    equal((await other.snapshot()).activities[0].garminId, "42");
  } finally {
    s.close();
    other?.close();
    await Deno.remove(dir, { recursive: true });
  }
});
Deno.test("corrupt FIT retained but never uploaded; ambiguous uploads never replayed", async () => {
  const dir = await Deno.makeTempDir();
  let uploads = 0;
  const s = await createSyncService({
    dataDir: dir,
    garmin: mock(() => {
      uploads++;
      throw new Error("socket closed");
    }),
  });
  try {
    const source = join(dir, "source");
    await Deno.mkdir(source);
    await s.saveSettings({ sourceDir: source });
    await Deno.writeFile(join(source, "broken.fit"), new Uint8Array([1, 2, 3]));
    await Deno.writeFile(join(source, "ride.fit"), syntheticFit());
    const rows = await s.scan();
    equal(rows.length, 2);
    equal(rows.filter((a) => a.status === "failed").length, 1);
    await s.sync();
    equal(uploads, 1);
    equal(
      (await s.snapshot()).activities.filter((a) => a.status === "uncertain")
        .length,
      1,
    );
    await s.sync();
    await s.sync(rows.find((a) => a.status === "ready")!.id);
    equal(uploads, 1);
  } finally {
    s.close();
    await Deno.remove(dir, { recursive: true });
  }
});
Deno.test("definite upload failure supports explicit retry", async () => {
  const dir = await Deno.makeTempDir();
  let uploads = 0;
  const s = await createSyncService({
    dataDir: dir,
    garmin: mock(() => {
      if (++uploads === 1) {
        throw Object.assign(new Error("rejected"), { definite: true });
      }
      return Promise.resolve({ duplicate: false, activityId: "43" });
    }),
  });
  try {
    const source = join(dir, "source");
    await Deno.mkdir(source);
    await s.saveSettings({ sourceDir: source });
    await Deno.writeFile(join(source, "ride.fit"), syntheticFit());
    const [a] = await s.scan();
    await s.sync();
    equal((await s.snapshot()).activities[0].status, "failed");
    await s.sync();
    equal(uploads, 1);
    await s.sync(a.id);
    equal(uploads, 2);
    equal((await s.snapshot()).activities[0].status, "synced");
  } finally {
    s.close();
    await Deno.remove(dir, { recursive: true });
  }
});
Deno.test("same activity identity, changed content and watch autoSync setting", async () => {
  const dir = await Deno.makeTempDir();
  let uploads = 0;
  const s = await createSyncService({
    dataDir: dir,
    garmin: mock(() => {
      uploads++;
      return Promise.resolve({ duplicate: false, activityId: "44" });
    }),
  });
  try {
    const source = join(dir, "source");
    await Deno.mkdir(source);
    await s.saveSettings({ sourceDir: source });
    await Deno.writeFile(join(source, "ride.fit"), syntheticFit());
    const controller = new AbortController();
    const watching = s.watch(controller.signal);
    for (let i = 0; i < 100 && !(await s.snapshot()).activities.length; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    controller.abort();
    await watching;
    equal(uploads, 0);
    equal((await s.snapshot()).activities.length, 1);
    await Deno.writeFile(
      join(source, "variant.fit"),
      syntheticFit(new Date("2026-09-20T08:00:00Z"), 200),
    );
    const duplicates = await s.scan();
    equal(duplicates.length, 2);
    equal(duplicates.filter((a) => a.status === "duplicate").length, 1);
    await s.saveSettings({ autoSync: true });
    const next = new AbortController();
    const loop = s.watch(next.signal);
    for (let i = 0; i < 100 && !uploads; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    next.abort();
    await loop;
    equal(uploads, 1);
  } finally {
    s.close();
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("ambiguous upload is reconciled read-only after restart, never sent twice", async () => {
  const dir = await Deno.makeTempDir();
  let uploads = 0;
  let available = false;
  const garmin = mock(() => {
    uploads++;
    return Promise.reject(new Error("lost response"));
  });
  garmin.findActivity = () => Promise.resolve(available ? "123" : null);
  let service = await createSyncService({ dataDir: dir, garmin });
  try {
    const source = join(dir, "source");
    await Deno.mkdir(source);
    await service.saveSettings({ sourceDir: source });
    await Deno.writeFile(join(source, "ride.fit"), syntheticFit());
    await service.scan();
    equal((await service.sync())[0].status, "uncertain");
    await service.sync();
    equal(uploads, 1);
    garmin.findActivity = () => Promise.reject(new Error("offline"));
    equal((await service.reconcile())[0].status, "uncertain");
    service.close();
    service = await createSyncService({ dataDir: dir, garmin });
    available = true;
    garmin.findActivity = () => Promise.resolve(available ? "123" : null);
    const [a] = await service.reconcile();
    equal(a.status, "synced");
    equal(a.garminId, "123");
    equal(a.error, null);
    equal(a.attempts, 1);
    await service.sync();
    equal(uploads, 1);
    service.close();
    service = await createSyncService({ dataDir: dir, garmin });
    equal((await service.snapshot()).activities[0].status, "synced");
  } finally {
    service.close();
    await Deno.remove(dir, { recursive: true });
  }
});
