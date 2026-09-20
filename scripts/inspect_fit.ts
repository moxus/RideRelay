import { Decoder, Stream } from "@garmin/fitsdk";

const defaultDir = `${
  Deno.env.get("HOME")
}/Library/Containers/com.whoosh.whooshgame/Data/Library/Application Support/Epic/MyWhoosh/Content/Data`;
let files = Deno.args;
if (files.length === 0) {
  files = [];
  for await (const entry of Deno.readDir(defaultDir)) {
    if (entry.isFile && entry.name.endsWith(".fit")) {
      files.push(`${defaultDir}/${entry.name}`);
    }
  }
}
if (!files.length) throw new Error("Keine FIT-Dateien gefunden.");

for (const path of files) {
  const bytes = await Deno.readFile(path);
  const originalHash = await crypto.subtle.digest("SHA-256", bytes);
  const decoder = new Decoder(Stream.fromByteArray(bytes));
  const isFit = decoder.isFIT();
  const integrity = isFit && decoder.checkIntegrity();
  if (!integrity) {
    throw new Error("FIT-Erkennung oder Integritätsprüfung fehlgeschlagen.");
  }
  const { messages, errors } = decoder.read({
    applyScaleAndOffset: true,
    convertTypesToStrings: true,
  });
  if (errors.length) {
    throw new Error(`FIT-Decoder meldet ${errors.length} Fehler.`);
  }
  const records = (messages.recordMesgs ?? []) as Record<string, unknown>[];
  const sessions = (messages.sessionMesgs ?? []) as Record<string, unknown>[];
  const fields = ["power", "heartRate", "cadence", "temperature"];
  const samples = Object.fromEntries(fields.map((field) => {
    const values = records.map((record) => record[field]).filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
    return [field, {
      present: values.length,
      missing: records.length - values.length,
      sampleMean: values.length
        ? Math.round(
          values.reduce((sum, v) => sum + v, 0) / values.length * 100,
        ) / 100
        : null,
    }];
  }));
  const afterHash = await crypto.subtle.digest(
    "SHA-256",
    await Deno.readFile(path),
  );
  const unchanged = new Uint8Array(originalHash).every((v, i) =>
    v === new Uint8Array(afterHash)[i]
  );
  console.log(JSON.stringify(
    {
      file: path.split("/").pop(),
      bytes: bytes.length,
      isFit,
      integrity,
      decoderErrors: errors.length,
      unchanged,
      messageCounts: Object.fromEntries(
        Object.entries(messages).map((
          [key, value],
        ) => [key, (value as unknown[]).length]),
      ),
      sessions: sessions.map((session) =>
        Object.fromEntries([
          "sport",
          "subSport",
          "totalTimerTime",
          "totalElapsedTime",
          "totalDistance",
          "avgPower",
          "avgHeartRate",
          "avgCadence",
        ].map((field) => [field, session[field] ?? null]))
      ),
      samples,
    },
    null,
    2,
  ));
  if (!unchanged) {
    throw new Error("Quelldatei wurde während der Prüfung geändert.");
  }
}
