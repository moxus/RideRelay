import { join, resolve } from "node:path";
import type {
  GarminAdapter,
  SyncService,
} from "../../packages/contracts/mod.ts";
import { createSyncService } from "../../packages/core/mod.ts";
import { syntheticFit } from "../../packages/core/fixtures.ts";
import { GarminClient, OsTokenStore } from "../../packages/garmin/mod.ts";

class DemoGarmin implements GarminAdapter {
  private active = true;
  connected() {
    return Promise.resolve(this.active);
  }
  login() {
    this.active = true;
    return Promise.resolve();
  }
  logout() {
    this.active = false;
    return Promise.resolve();
  }
  profile() {
    return Promise.resolve({ displayName: "Demo" });
  }
  upload() {
    return Promise.resolve({ duplicate: false, activityId: null });
  }
}
export async function createApplication(
  options: { demo?: boolean; dataDir?: string },
): Promise<{ garmin: GarminAdapter; service: SyncService }> {
  const garmin: GarminAdapter = options.demo
    ? new DemoGarmin()
    : new GarminClient(new OsTokenStore());
  if (!options.demo) {
    return {
      garmin,
      service: await createSyncService({ garmin, dataDir: options.dataDir }),
    };
  }
  const dataDir = resolve(options.dataDir ?? ".local/demo");
  const sourceDir = join(dataDir, "sample-rides");
  const backupDir = join(dataDir, "backups");
  await Deno.mkdir(sourceDir, { recursive: true });
  const seed = await createSyncService({ garmin, dataDir });
  try {
    await seed.saveSettings({ sourceDir, backupDir, autoSync: false });
    if (!(await seed.snapshot()).activities.length) {
      const names = [
        "Evening Endurance",
        "Tempo Builder",
        "Morning Ride",
        "Watopia Recovery",
      ];
      for (let i = 0; i < names.length; i++) {
        await Deno.writeFile(
          join(sourceDir, `${names[i]}.fit`),
          syntheticFit(new Date(Date.now() - (4 - i) * 86400000), 145 + i * 15),
        );
        await seed.scan();
        if (i < 3) await seed.sync();
      }
    }
  } finally {
    seed.close();
  }
  return {
    garmin,
    service: await createSyncService({ garmin, dataDir, demo: true }),
  };
}
