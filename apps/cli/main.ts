import { localeFor, resolveLanguage, translate } from "../shared/i18n.js";
import { defaultDataDir } from "../../packages/core/mod.ts";
import { join } from "node:path";
import type { Language } from "../../packages/contracts/mod.ts";
import { createApplication } from "../shared/application.ts";
import { parseArguments } from "../shared/arguments.ts";
import { createPrompt } from "../shared/prompt.ts";
import type { Activity } from "../../packages/contracts/mod.ts";

let language = resolveLanguage();
const t = (message: string) => translate(language, message);

const help =
  `RideRelay — MyWhoosh-Aktivitäten lokal sichern und zu Garmin übertragen.

riderelay status | scan | reconcile | sync [--id ID] [--dry-run] | watch
riderelay login | logout | settings [--source ORDNER] [--backup ORDNER]

--language SPRACHE  auto, de oder en (settings speichert die Auswahl)
--json             Maschinenlesbare Ausgabe
--data-dir ORDNER  Separater Ordner für Einstellungen und Verlauf
--demo             Isolierte Beispieldaten, keine Garmin-Uploads

sync überträgt alle bereiten Aktivitäten. --dry-run liest und sichert nur.
watch synchronisiert neue Fahrten während der Prozess läuft (Strg+C beendet).
Passwort und MFA werden ausschließlich interaktiv abgefragt.`;
export async function main(args: string[]) {
  const { positional, options } = parseArguments(args);
  const command = positional[0] ?? "status";
  if (
    options.language && !["auto", "de", "en"].includes(String(options.language))
  ) {
    throw new Error(t("Ungültige Sprache. Erlaubt: auto, de, en."));
  }
  let preference = "auto";
  try {
    const dir = String(
      options["data-dir"] ??
        (options.demo ? ".local/demo" : defaultDataDir()),
    );
    preference = JSON.parse(await Deno.readTextFile(join(dir, "settings.json")))
      .language ?? "auto";
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  language = resolveLanguage(String(options.language ?? preference));
  if (options.help || command === "help") {
    console.log(t(help));
    return;
  }
  if (
    positional.length > 1 ||
    ![
      "status",
      "scan",
      "reconcile",
      "sync",
      "watch",
      "login",
      "logout",
      "settings",
    ]
      .includes(command)
  ) throw new Error(t("Unbekannter Befehl. Hilfe: riderelay --help"));
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
    if (!items.length) return print(t("Keine Aktivitäten gefunden."));
    for (const item of items) {
      console.log(
        `${
          t(
            ({
              ready: "Bereit",
              syncing: "Wird übertragen",
              synced: "Synchronisiert",
              duplicate: "Bereits bei Garmin",
              failed: "Übertragung fehlgeschlagen",
              uncertain: "Status prüfen",
            })[item.status],
          ).padEnd(16)
        } ${item.name} · ${
          new Intl.NumberFormat(localeFor(language), {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(item.distance / 1000)
        } km · ${Math.round(item.duration / 60)} min\n           ${item.id}${
          item.error ? `\n           ${t(item.error)}` : ""
        }`,
      );
    }
  };
  try {
    switch (command) {
      case "login": {
        if (options.json) {
          throw new Error(
            t("login benötigt ein interaktives Terminal ohne --json."),
          );
        }
        const terminal = createPrompt();
        try {
          const email = await terminal.ask(t("Garmin E-Mail: "));
          const password = await terminal.ask(t("Passwort: "), true);
          await garmin.login(
            email,
            password,
            () => terminal.ask(t("MFA-Code: "), true),
          );
          print(
            t("Bei Garmin angemeldet. Sitzung im Betriebssystem-Tresor gespeichert."),
          );
        } finally {
          terminal.close();
        }
        break;
      }
      case "logout":
        await garmin.logout();
        print(t("Garmin-Sitzung entfernt."));
        break;
      case "settings":
        print(
          await service.saveSettings({
            ...(options.language
              ? { language: String(options.language) as Language }
              : {}),
            ...(options.source ? { sourceDir: String(options.source) } : {}),
            ...(options.backup ? { backupDir: String(options.backup) } : {}),
          }),
        );
        break;
      case "reconcile":
        rides(await service.reconcile(options.id as string | undefined));
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
          throw new Error(t("Die Demo überträgt keine Aktivitäten."));
        }
        const controller = new AbortController();
        const stop = () => controller.abort();
        Deno.addSignalListener("SIGINT", stop);
        print(t("RideRelay beobachtet den Quellordner. Strg+C beendet."));
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
              state.connected ? t("angemeldet") : t("nicht angemeldet")
            }\n${t("Quelle")}: ${state.settings.sourceDir}${
              state.sourceExists ? "" : t(" (nicht gefunden)")
            }\n${t("Sicherung")}: ${state.settings.backupDir}`,
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
        ? t(e.message)
        : t("RideRelay konnte den Vorgang nicht abschließen."),
    );
    Deno.exitCode = 1;
  });
}
