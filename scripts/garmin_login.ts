import { GarminConnectSDK, MemoryTokenStorage } from "garmin-connect-sdk";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import process from "node:process";

// Only a sanitized test result is persisted. Password, MFA and tokens remain in memory.
const resultPath = new URL("../.local/garmin-result.json", import.meta.url);
await Deno.mkdir(new URL("../.local/", import.meta.url), {
  recursive: true,
  mode: 0o700,
});
async function report(result: Record<string, unknown>) {
  await Deno.writeTextFile(
    resultPath,
    JSON.stringify({ at: new Date().toISOString(), ...result }, null, 2),
    { mode: 0o600 },
  );
}
if (!Deno.stdin.isTerminal()) {
  throw new Error("Bitte in einem interaktiven Terminal starten.");
}
let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const terminal = createInterface({
  input: process.stdin,
  output,
  terminal: true,
});
async function ask(label: string): Promise<string> {
  process.stdout.write(label);
  muted = true;
  try {
    const value = await terminal.question("");
    process.stdout.write("\n");
    if (!value.length) throw new Error("Leere Eingabe.");
    return value;
  } finally {
    muted = false;
  }
}

let stage = "input";
try {
  await report({ status: "waiting_for_input" });
  console.log(
    "Garmin-Login-Test: Eingaben sind unsichtbar. Kein Aktivitäts-Upload.",
  );
  const storage = new MemoryTokenStorage();
  const garmin = new GarminConnectSDK({
    storage,
    maxRetries: 0,
    timeoutMs: 30_000,
  });
  const email = (await ask("Garmin-E-Mail: ")).trim();
  const password = await ask("Garmin-Passwort: ");
  stage = "login";
  await report({ status: "running", stage });
  await garmin.login({
    email,
    password,
    mfaCode: async () => {
      await report({ status: "waiting_for_mfa" });
      return (await ask("Garmin-MFA-Code: ")).trim();
    },
  });
  stage = "profile";
  await garmin.user.getProfile();
  stage = "session_restore";
  const secondClient = new GarminConnectSDK({
    storage,
    maxRetries: 0,
    timeoutMs: 30_000,
  });
  const restored = await secondClient.restoreSession();
  if (!restored) throw new Error("Sitzung nicht wiederherstellbar.");
  await report({
    status: "passed",
    login: true,
    profileRead: true,
    sessionRestoreInMemory: true,
    uploadAttempted: false,
    tokensSavedToDisk: false,
  });
  console.log(
    "ERFOLG: Login, Profilabruf und Sitzungswiederverwendung funktionieren unter Deno.",
  );
  await storage.clear();
} catch (error) {
  const statusCode =
    error && typeof error === "object" && "statusCode" in error &&
      typeof error.statusCode === "number"
      ? error.statusCode
      : null;
  const errorType = error instanceof Error
    ? error.name.replace(/[^A-Za-z0-9_]/g, "").slice(0, 80)
    : "UnknownError";
  await report({ status: "failed", stage, errorType, statusCode });
  console.error(
    `Test fehlgeschlagen: ${stage}, ${errorType}, HTTP ${
      statusCode ?? "unbekannt"
    }.`,
  );
  Deno.exitCode = 1;
} finally {
  terminal.close();
}
