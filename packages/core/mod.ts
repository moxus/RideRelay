import { DatabaseSync } from "node:sqlite";
import { basename, join, resolve } from "node:path";
import { Decoder, Stream } from "@garmin/fitsdk";
import type {
  Activity,
  GarminAdapter,
  Settings,
  SyncService,
} from "../contracts/mod.ts";

export function defaultDataDir(): string {
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? ".";
  return Deno.build.os === "darwin"
    ? join(home, "Library/Application Support/RideRelay")
    : Deno.build.os === "windows"
    ? join(Deno.env.get("LOCALAPPDATA") ?? home, "RideRelay")
    : join(
      Deno.env.get("XDG_DATA_HOME") ?? join(home, ".local/share"),
      "riderelay",
    );
}
export function defaultSettings(dataDir = defaultDataDir()): Settings {
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? ".";
  return {
    sourceDir: Deno.build.os === "darwin"
      ? join(
        home,
        "Library/Containers/com.whoosh.whooshgame/Data/Library/Application Support/Epic/MyWhoosh/Content/Data",
      )
      : join(Deno.env.get("LOCALAPPDATA") ?? home, "MyWhoosh/Saved"),
    backupDir: join(dataDir, "backups"),
    autoSync: false,
    notifySuccess: true,
    notifyFailure: true,
  };
}
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const digest = async (bytes: Uint8Array) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
async function exists(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isDirectory;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}
function summary(bytes: Uint8Array, fallback: string) {
  const decoder = new Decoder(Stream.fromByteArray(bytes));
  if (!decoder.isFIT() || !decoder.checkIntegrity()) {
    throw new Error("FIT-Datei ist beschädigt oder unvollständig.");
  }
  const { messages, errors } = decoder.read({
    applyScaleAndOffset: true,
    convertTypesToStrings: true,
  });
  if (errors.length) {
    throw new Error("FIT-Datei konnte nicht vollständig gelesen werden.");
  }
  const sessions = messages.sessionMesgs as
    | Record<string, unknown>[]
    | undefined;
  if (!sessions?.length) throw new Error("FIT-Datei enthält keine Aktivität.");
  const s = sessions[0];
  const number = (key: string): number | null =>
    typeof s[key] === "number" && Number.isFinite(s[key])
      ? s[key] as number
      : null;
  const rawStart = s.startTime;
  const startedAt = rawStart instanceof Date
    ? rawStart.toISOString()
    : fallback;
  return {
    startedAt,
    duration: number("totalTimerTime") ?? number("totalElapsedTime") ?? 0,
    distance: number("totalDistance") ?? 0,
    avgPower: number("avgPower"),
    avgHeartRate: number("avgHeartRate"),
    avgCadence: number("avgCadence"),
    identity: rawStart instanceof Date
      ? `${startedAt}:${s.sport ?? "unknown"}:${
        number("totalTimerTime") ?? 0
      }:${number("totalDistance") ?? 0}`
      : null,
  };
}

/** Settings and SQLite history are shared by CLI and desktop; original FIT bytes are never rewritten. */
export async function createSyncService(
  options: { dataDir?: string; garmin: GarminAdapter; demo?: boolean },
): Promise<SyncService> {
  const dataDir = resolve(options.dataDir ?? defaultDataDir());
  await Deno.mkdir(dataDir, { recursive: true, mode: 0o700 });
  const configPath = join(dataDir, "settings.json");
  const readSettings = async (): Promise<Settings> => {
    try {
      return {
        ...defaultSettings(dataDir),
        ...JSON.parse(await Deno.readTextFile(configPath)),
      };
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) return defaultSettings(dataDir);
      throw e;
    }
  };
  const db = new DatabaseSync(join(dataDir, "sync.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, hash TEXT UNIQUE NOT NULL,
    identity TEXT, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
    lease INTEGER NOT NULL DEFAULT 0, next_retry INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS activity_identity ON activities(identity);`);
  let scanning = false;
  let closed = false;
  function list(): Activity[] {
    // A crashed or timed-out upload cannot safely be replayed automatically.
    for (
      const row of db.prepare(
        "SELECT id,payload,attempts FROM activities WHERE status='syncing' AND lease < ?",
      ).all(Date.now())
    ) {
      const a = JSON.parse(row.payload as string) as Activity;
      a.status = "uncertain";
      a.attempts = Number(row.attempts);
      a.error =
        "Übertragung wurde unterbrochen. Bitte zuerst Garmin Connect prüfen.";
      db.prepare(
        "UPDATE activities SET status='uncertain',payload=? WHERE id=? AND status='syncing' AND lease < ?",
      ).run(JSON.stringify(a), a.id, Date.now());
    }
    return db.prepare(
      "SELECT payload,status,attempts FROM activities ORDER BY json_extract(payload,'$.startedAt') DESC",
    ).all().map((row) => ({
      ...JSON.parse(row.payload as string),
      status: row.status,
      attempts: Number(row.attempts),
    }));
  }
  const service: SyncService = {
    async snapshot() {
      const settings = await readSettings();
      return {
        settings,
        activities: list(),
        connected: await options.garmin.connected(),
        sourceExists: await exists(settings.sourceDir),
        scanning,
        demo: options.demo ?? false,
      };
    },
    async saveSettings(update) {
      const allowed = [
        "sourceDir",
        "backupDir",
        "autoSync",
        "notifySuccess",
        "notifyFailure",
      ];
      for (const [key, value] of Object.entries(update)) {
        if (
          !allowed.includes(key) ||
          typeof value !== (key.endsWith("Dir") ? "string" : "boolean")
        ) throw new Error("Ungültige Einstellung.");
        if (typeof value === "string" && !value.trim()) {
          throw new Error("Bitte einen Ordner angeben.");
        }
      }
      const settings = { ...await readSettings(), ...update };
      settings.sourceDir = resolve(settings.sourceDir);
      settings.backupDir = resolve(settings.backupDir);
      const temp = `${configPath}.${crypto.randomUUID()}.tmp`;
      await Deno.writeTextFile(temp, JSON.stringify(settings, null, 2), {
        mode: 0o600,
      });
      await Deno.rename(temp, configPath);
      return settings;
    },
    async scan() {
      if (scanning) return list();
      scanning = true;
      try {
        const settings = await readSettings();
        if (!await exists(settings.sourceDir)) return list();
        for await (const entry of Deno.readDir(settings.sourceDir)) {
          if (!entry.isFile || !entry.name.toLowerCase().endsWith(".fit")) {
            continue;
          }
          const path = join(settings.sourceDir, entry.name);
          let bytes: Uint8Array;
          let modified: string;
          try {
            const first = await Deno.stat(path);
            await pause(150);
            bytes = await Deno.readFile(path);
            const second = await Deno.stat(path);
            if (
              first.size !== second.size ||
              first.mtime?.getTime() !== second.mtime?.getTime() ||
              bytes.length !== second.size
            ) continue;
            modified = second.mtime?.toISOString() ?? new Date().toISOString();
          } catch (e) {
            if (e instanceof Deno.errors.NotFound) continue;
            throw e;
          }
          const hash = await digest(bytes);
          if (db.prepare("SELECT id FROM activities WHERE hash=?").get(hash)) {
            continue;
          }
          const a: Activity = {
            id: hash,
            hash,
            name: basename(path, entry.name.slice(-4)),
            sourcePath: path,
            backupPath: null,
            startedAt: modified,
            duration: 0,
            distance: 0,
            avgPower: null,
            avgHeartRate: null,
            avgCadence: null,
            status: "ready",
            attempts: 0,
            error: null,
            garminId: null,
            syncedAt: null,
          };
          let identity: string | null = null;
          try {
            await Deno.mkdir(settings.backupDir, {
              recursive: true,
              mode: 0o700,
            });
            const backup = join(settings.backupDir, `${hash}.fit`);
            const staging = join(
              settings.backupDir,
              `.${hash}.${crypto.randomUUID()}.tmp`,
            );
            try {
              await Deno.writeFile(staging, bytes, {
                createNew: true,
                mode: 0o400,
              });
              // Publish complete bytes without replacing an existing immutable backup.
              try {
                await Deno.link(staging, backup);
              } catch (e) {
                if (!(e instanceof Deno.errors.AlreadyExists)) throw e;
              }
            } finally {
              await Deno.remove(staging).catch((e) => {
                if (!(e instanceof Deno.errors.NotFound)) throw e;
              });
            }
            if (await digest(await Deno.readFile(backup)) !== hash) {
              throw new Error(
                "Sicherung stimmt nicht mit der Quelldatei überein.",
              );
            }
            a.backupPath = backup;
            const decoded = summary(bytes, modified);
            identity = decoded.identity;
            Object.assign(a, { ...decoded });
            delete (a as Activity & { identity?: string }).identity;
          } catch (e) {
            a.status = "failed";
            a.error = e instanceof Error
              ? e.message
              : "Datei konnte nicht gesichert oder gelesen werden.";
          }
          db.exec("BEGIN IMMEDIATE");
          try {
            if (
              identity &&
              db.prepare("SELECT id FROM activities WHERE identity=?").get(
                identity,
              )
            ) {
              a.status = "duplicate";
              a.error = "Diese Aktivität wurde bereits erkannt.";
            }
            db.prepare(
              "INSERT OR IGNORE INTO activities(id,hash,identity,status,next_retry,payload) VALUES(?,?,?,?,?,?)",
            ).run(
              a.id,
              hash,
              identity,
              a.status,
              a.status === "failed" ? Number.MAX_SAFE_INTEGER : 0,
              JSON.stringify(a),
            );
            db.exec("COMMIT");
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
        }
        return list();
      } finally {
        scanning = false;
      }
    },
    async sync(id) {
      if (options.demo) {
        throw new Error("Die Demo überträgt keine Aktivitäten.");
      }
      if (!await options.garmin.connected()) {
        throw new Error("Bitte zuerst bei Garmin anmelden.");
      }
      for (const a of list().filter((a) => !id || a.id === id)) {
        // Explicit retry is allowed only for definite failures, never uncertain outcomes.
        const result = db.prepare(
          "UPDATE activities SET status='syncing',attempts=attempts+1,lease=? WHERE id=? AND (status='ready' OR (status='failed' AND next_retry < ?))",
        ).run(
          Date.now() + 600_000,
          a.id,
          id ? Number.MAX_SAFE_INTEGER : Date.now(),
        );
        if (!result.changes) continue;
        a.attempts++;
        a.status = "syncing";
        let nextRetry = 0;
        let uploadStarted = false;
        try {
          if (!a.backupPath) {
            throw new Error("Keine gesicherte FIT-Datei vorhanden.");
          }
          const bytes = await Deno.readFile(a.backupPath);
          if (await digest(bytes) !== a.hash) {
            throw new Error("Die Sicherungsdatei wurde verändert.");
          }
          summary(bytes, a.startedAt);
          uploadStarted = true;
          const result = await options.garmin.upload(bytes, `${a.name}.fit`);
          a.status = result.duplicate ? "duplicate" : "synced";
          a.garminId = result.activityId;
          a.syncedAt = new Date().toISOString();
          a.error = null;
        } catch (e) {
          const failure = e as {
            definite?: boolean;
            uncertain?: boolean;
            retryable?: boolean;
            message?: string;
          };
          const definite = !uploadStarted || failure.definite === true;
          a.status = definite ? "failed" : "uncertain";
          a.error = definite
            ? "Übertragung fehlgeschlagen. Verbindung und Datei prüfen, dann erneut versuchen."
            : "Ergebnis unklar. Bitte Garmin Connect prüfen; keine automatische Wiederholung.";
          // Corrupt inputs and exhausted/non-retryable failures require explicit attention.
          nextRetry = definite && uploadStarted && failure.retryable === true &&
              a.attempts < 3
            ? Date.now() + 30_000 * 2 ** (a.attempts - 1)
            : Number.MAX_SAFE_INTEGER - 1;
        }
        db.prepare(
          "UPDATE activities SET status=?,next_retry=?,payload=? WHERE id=? AND status='syncing'",
        ).run(a.status, nextRetry, JSON.stringify(a), a.id);
      }
      return list();
    },
    async watch(signal) {
      while (!signal.aborted && !closed) {
        await service.scan();
        if (
          (await readSettings()).autoSync && await options.garmin.connected()
        ) await service.sync();
        await new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(timer);
            signal.removeEventListener("abort", done);
            resolve();
          };
          const timer = setTimeout(done, 2000);
          signal.addEventListener("abort", done, { once: true });
          if (signal.aborted) done();
        });
      }
    },
    close() {
      closed = true;
      db.close();
    },
  };
  return service;
}
