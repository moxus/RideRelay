import { createApplication } from "../shared/application.ts";
import { parseArguments } from "../shared/arguments.ts";
import { notify } from "../shared/native.ts";
import type { ActivityStatus } from "../../packages/contracts/mod.ts";
import { createHandler } from "./server.ts";

const { options } = parseArguments(Deno.args);
const port = Number(options.port ?? 4187);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("Port muss zwischen 1024 und 65535 liegen.");
}
const { garmin, service } = await createApplication({
  demo: options.demo === true,
  dataDir: options["data-dir"] as string | undefined,
});
const controller = new AbortController();
const server = Deno.serve({
  hostname: "127.0.0.1",
  port,
  signal: controller.signal,
}, createHandler(service, garmin));
const watching = service.watch(controller.signal).catch((e) =>
  console.error(
    e instanceof Error ? e.message : "Ordnerüberwachung fehlgeschlagen.",
  )
);
let seen: Map<string, ActivityStatus> | undefined;
let notifying = false;
const notifications = setInterval(async () => {
  if (notifying) return;
  notifying = true;
  try {
    const state = await service.snapshot();
    for (const activity of state.activities) {
      if (!seen || seen.get(activity.id) === activity.status) continue;
      if (activity.status === "synced" && state.settings.notifySuccess) {
        notify("RideRelay", `${activity.name} wurde übertragen.`);
      }
      if (
        ["failed", "uncertain"].includes(activity.status) &&
        state.settings.notifyFailure
      ) notify("RideRelay", `${activity.name}: Bitte den Status prüfen.`);
    }
    seen = new Map(state.activities.map((a) => [a.id, a.status]));
  } catch {
    /* Shutdown may close the database. */
  } finally {
    notifying = false;
  }
}, 3000);
const stop = () => controller.abort();
Deno.addSignalListener("SIGINT", stop);
try {
  await server.finished;
} finally {
  controller.abort();
  clearInterval(notifications);
  await watching;
  service.close();
  Deno.removeSignalListener("SIGINT", stop);
}
