export function parseArguments(args: string[]) {
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};
  const flags = new Set(["demo", "json", "help", "dry-run"]);
  const values = new Set(["data-dir", "source", "backup", "port", "id"]);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const [name, inline] = arg.slice(2).split(/=(.*)/s);
    if (flags.has(name)) {
      if (inline !== undefined) {
        throw new Error(`--${name} akzeptiert keinen Wert.`);
      }
      options[name] = true;
    } else if (values.has(name)) {
      const value = inline ?? args[++i];
      if (!value || value.startsWith("--")) {
        throw new Error(`Wert für --${name} fehlt.`);
      }
      options[name] = value;
    } else throw new Error(`Unbekannte Option: --${name}`);
  }
  return { positional, options };
}
