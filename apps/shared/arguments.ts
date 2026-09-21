import { resolveLanguage, translate } from "./i18n.js";
export function parseArguments(args: string[]) {
  const t = (message: string, name: string) =>
    translate(resolveLanguage(), message, { name });
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};
  const flags = new Set(["demo", "json", "help", "dry-run"]);
  const values = new Set([
    "data-dir",
    "source",
    "backup",
    "port",
    "id",
    "language",
  ]);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const [name, inline] = arg.slice(2).split(/=(.*)/s);
    if (flags.has(name)) {
      if (inline !== undefined) {
        throw new Error(t("--{name} akzeptiert keinen Wert.", name));
      }
      options[name] = true;
    } else if (values.has(name)) {
      const value = inline ?? args[++i];
      if (!value || value.startsWith("--")) {
        throw new Error(t("Wert für --{name} fehlt.", name));
      }
      options[name] = value;
    } else throw new Error(t("Unbekannte Option: --{name}", name));
  }
  return { positional, options };
}
