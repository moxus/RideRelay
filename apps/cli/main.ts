import { createApplication } from "../shared/application.ts";
import { parseArguments } from "../shared/arguments.ts";
import { createPrompt } from "../shared/prompt.ts";
import type { Activity } from "../../packages/contracts/mod.ts";

const help =
  `RideRelay — MyWhoosh-Aktivitäten lokal sichern und zu Garmin übertragen.

riderelay status | scan | sync [--id ID] [--dry-run] | watch
riderelay login | logout | settings [--source ORDNER] [--backup ORDNER]

--json             Maschinenlesbare Ausgabe
--data-dir ORDNER  Separater Ordner für Einstellungen und Verlauf
--demo             Isolierte Beispieldaten, keine Garmin-Uploads

sync überträgt alle bereiten Aktivitäten. --dry-run liest und sichert nur.
watch synchronisiert neue Fahrten während der Prozess läuft (Strg+C beendet).
Passwort und MFA werden ausschließlich interaktiv abgefragt.`;
export async function main(args: string[]) {
  const { positional, options } = parseArguments(args);
  const command = positional[0] ?? "status";
  if (options.help || command === "help") {
    console.log(help);
    return;
  }
  if (
    positional.length > 1 ||
    !["status", "scan", "sync", "watch", "login", "logout", "settings"]
      .includes(command)
  ) throw new Error("Unbekannter Befehl. Hilfe: riderelay --help");
  const { garmin, service } = await createApplication({
    demo: options.demo === true,
    dataDir: options["data-dir"] as string | undefined,
  });
  const print = (value: unknown) =>
    console.log(
      options.json
        ? JSON.stringify(value)
        : typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2),
    );
  const rides = (items: Activity[]) => {
    if (options.json) return print(items);
    if (!items.length) return print("Keine Aktivitäten gefunden.");
    for (const item of items) {
      console.log(
        `${item.status.padEnd(10)} ${item.name} · ${
          (item.distance / 1000).toFixed(1)
        } km · ${Math.round(item.duration / 60)} min\n           ${item.id}${
          item.error ? `\n           ${item.error}` : ""
        }`,
      );
    }
  };
  try {
    switch (command) {
      case "login": {
        if (options.json) {
          throw new Error(
            "login benötigt ein interaktives Terminal ohne --json.",
          );
        }
        const terminal = createPrompt();
        try {
          const email = await terminal.ask("Garmin E-Mail: ");
          const password = await terminal.ask("Passwort: ", true);
          await garmin.login(
            email,
            password,
            () => terminal.ask("MFA-Code: ", true),
          );
          print(
            "Bei Garmin angemeldet. Sitzung im Betriebssystem-Tresor gespeichert.",
          );
        } finally {
          terminal.close();
        }
        break;
      }
      case "logout":
        await garmin.logout();
        print("Garmin-Sitzung entfernt.");
        break;
      case "settings":
        print(
          await service.saveSettings({
            ...(options.source ? { sourceDir: String(options.source) } : {}),
            ...(options.backup ? { backupDir: String(options.backup) } : {}),
          }),
        );
        break;
      case "scan":
        rides(await service.scan());
        break;
      case "sync": {
        await service.scan();
        const result = options["dry-run"]
          ? (await service.snapshot()).activities
          : await service.sync(options.id as string | undefined);
        rides(result);
        if (
          !options["dry-run"] &&
          result.some((a) =>
            (!options.id || a.id === options.id) &&
            ["failed", "uncertain"].includes(a.status)
          )
        ) Deno.exitCode = 1;
        break;
      }
      case "watch": {
        if (options.demo) {
          throw new Error("Die Demo überträgt keine Aktivitäten.");
        }
        const controller = new AbortController();
        const stop = () => controller.abort();
        Deno.addSignalListener("SIGINT", stop);
        print("RideRelay beobachtet den Quellordner. Strg+C beendet.");
        try {
          while (!controller.signal.aborted) {
            await service.scan();
            if (await garmin.connected()) await service.sync();
            await new Promise<void>((resolve) => {
              const done = () => {
                clearTimeout(timer);
                controller.signal.removeEventListener("abort", done);
                resolve();
              };
              const timer = setTimeout(done, 2000);
              controller.signal.addEventListener("abort", done, { once: true });
              if (controller.signal.aborted) done();
            });
          }
        } finally {
          Deno.removeSignalListener("SIGINT", stop);
        }
        break;
      }
      default: {
        const state = await service.snapshot();
        if (options.json) print(state);
        else {
          print(
            `RideRelay${state.demo ? " · Demo" : ""}\nGarmin: ${
              state.connected ? "angemeldet" : "nicht angemeldet"
            }\nQuelle: ${state.settings.sourceDir}${
              state.sourceExists ? "" : " (nicht gefunden)"
            }\nSicherung: ${state.settings.backupDir}`,
          );
          rides(state.activities);
        }
      }
    }
  } finally {
    service.close();
  }
}
if (import.meta.main) {
  await main(Deno.args).catch((e) => {
    console.error(
      e instanceof Error
        ? e.message
        : "RideRelay konnte den Vorgang nicht abschließen.",
    );
    Deno.exitCode = 1;
  });
}
