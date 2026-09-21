import { english, localeFor, resolveLanguage, translate } from "./i18n.js";
function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`${actual} !== ${expected}`);
}
Deno.test("language selection handles system variants, explicit overrides and fallback", () => {
  equal(resolveLanguage("auto", "de-AT"), "de");
  equal(resolveLanguage("auto", "de_DE.UTF-8"), "de");
  equal(resolveLanguage("auto", "fr-FR"), "en");
  equal(resolveLanguage("en", "de-DE"), "en");
  equal(resolveLanguage("de", "en-US"), "de");
  equal(new Intl.NumberFormat(localeFor("de")).format(12.5), "12,5");
  equal(new Intl.NumberFormat(localeFor("en")).format(12.5), "12.5");
});
Deno.test("translations preserve unknown diagnostics and interpolate values only once", () => {
  equal(
    translate("en", "{count} Fahrt bereit zum Übertragen", { count: 1 }),
    "1 ride ready to sync",
  );
  equal(
    translate("en", "{count} Fahrten bereit zum Übertragen", { count: 2 }),
    "2 rides ready to sync",
  );
  equal(
    translate("de", "{count} Fahrten bereit zum Übertragen", { count: 2 }),
    "2 Fahrten bereit zum Übertragen",
  );
  equal(
    translate("en", "{ride} wurde übertragen.", { ride: "{count}" }),
    "{count} was synced.",
  );
  equal(translate("en", "ENOENT: sample.fit"), "ENOENT: sample.fit");
});
Deno.test("all static UI and CLI message IDs have English translations", async () => {
  const sources = [
    new URL("../desktop/public/app.js", import.meta.url),
    new URL("../desktop/public/index.html", import.meta.url),
    new URL("../cli/main.ts", import.meta.url),
  ];
  for (const source of sources) {
    const text = await Deno.readTextFile(source);
    const messages = [
      ...text.matchAll(/\bt\(\s*"([^"\n]+)"/g),
      ...text.matchAll(/data-i18n(?:-label)?="([^"]+)"/g),
    ];
    for (const [, message] of messages) {
      if (!(message in english)) {
        throw new Error(`Missing English translation: ${message}`);
      }
    }
  }
});
