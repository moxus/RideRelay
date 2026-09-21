import { main } from "./main.ts";
Deno.test("CLI language override, persisted preference and machine-readable output", async () => {
  const dir = await Deno.makeTempDir();
  const log = console.log;
  let lines: string[] = [];
  console.log = (...values: unknown[]) => lines.push(values.join(" "));
  const invoke = async (...args: string[]) => {
    lines = [];
    await main([...args, "--demo", "--data-dir", dir]);
    return lines.join("\n");
  };
  try {
    const help = await invoke("--help", "--language", "en");
    if (!help.includes("Back up MyWhoosh")) {
      throw new Error("English help missing");
    }
    await invoke("settings", "--language", "en");
    const status = await invoke("status");
    if (!status.includes("Source:") || !status.includes("Ready")) {
      throw new Error("CLI did not use persisted English preference");
    }
    const german = await invoke("status", "--language", "de");
    if (!german.includes("Quelle:") || !german.includes("Bereit")) {
      throw new Error("German override was not applied");
    }
    const de = JSON.parse(await invoke("status", "--json", "--language", "de"));
    const en = JSON.parse(await invoke("status", "--json", "--language", "en"));
    if (
      JSON.stringify(de) !== JSON.stringify(en) || de.settings.language !== "en"
    ) {
      throw new Error(
        "Language override changed JSON data or saved preference",
      );
    }
  } finally {
    console.log = log;
    await Deno.remove(dir, { recursive: true });
  }
});
