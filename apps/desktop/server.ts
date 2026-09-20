import type {
  GarminAdapter,
  SyncService,
} from "../../packages/contracts/mod.ts";
import { openExternal, pickFolder } from "../shared/native.ts";

export function createHandler(
  service: SyncService,
  garmin: GarminAdapter,
  opts: {
    publicDir?: URL;
    pickFolder?: () => Promise<string | null>;
    openExternal?: typeof openExternal;
  } = {},
) {
  const publicDir = opts.publicDir ?? new URL("./public/", import.meta.url);
  let auth: { status: string; error?: string } = { status: "idle" };
  let mfaResolve: ((value: string) => void) | undefined;
  let mfaReject: ((reason: Error) => void) | undefined;
  let authGeneration = 0;
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  };
  const json = (data: unknown, status = 200) =>
    Response.json(data, { status, headers });
  function fail(error: unknown) {
    // Adapter and service expose user-safe errors. Do not return stack/cause/body.
    const raw = error instanceof Error
      ? error.message
      : "Vorgang fehlgeschlagen.";
    return json({ ok: false, error: raw.slice(0, 300) }, 400);
  }
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    if (
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      req.headers.get("host") && req.headers.get("host") !== url.host
    ) return json({ ok: false, error: "Unzulässiger Host." }, 403);
    if (url.pathname.startsWith("/api/")) {
      const origin = req.headers.get("origin");
      if (
        req.headers.get("X-RideRelay") !== "1" ||
        origin && origin !== url.origin
      ) return json({ ok: false, error: "Unzulässiger Zugriff." }, 403);
      try {
        if (req.method === "GET" && url.pathname === "/api/state") {
          return json(await service.snapshot());
        }
        if (req.method !== "POST") {
          return json({ ok: false, error: "Methode nicht erlaubt." }, 405);
        }
        if (!req.headers.get("content-type")?.startsWith("application/json")) {
          return json({ ok: false, error: "JSON erforderlich." }, 415);
        }
        const reader = req.body?.getReader();
        let size = 0;
        const chunks: Uint8Array[] = [];
        if (reader) {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > 16384) {
              await reader.cancel();
              return json({ ok: false, error: "Anfrage zu groß." }, 413);
            }
            chunks.push(value);
          }
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const part of chunks) {
          bytes.set(part, offset);
          offset += part.length;
        }
        const body = JSON.parse(new TextDecoder().decode(bytes) || "{}");
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          throw new Error("Ungültige Anfrage.");
        }
        let data: unknown;
        switch (url.pathname) {
          case "/api/scan":
            await service.scan();
            data = await service.reconcile();
            break;
          case "/api/sync":
            if (body.id !== undefined && typeof body.id !== "string") {
              throw new Error("Ungültige Aktivität.");
            }
            data = await service.sync(body.id);
            break;
          case "/api/settings":
            data = await service.saveSettings(body.settings);
            break;
          case "/api/checkConnection":
            data = await garmin.profile();
            break;
          case "/api/logout":
            if (auth.status === "running" || auth.status === "mfa") {
              throw new Error(
                "Bitte die laufende Anmeldung zuerst abschließen.",
              );
            }
            await garmin.logout();
            auth = { status: "idle" };
            data = {};
            break;
          case "/api/login": {
            if (auth.status === "running" || auth.status === "mfa") {
              throw new Error("Eine Anmeldung läuft bereits.");
            }
            if (
              typeof body.email !== "string" ||
              typeof body.password !== "string" || !body.email.trim() ||
              !body.password
            ) throw new Error("E-Mail und Passwort sind erforderlich.");
            const generation = ++authGeneration;
            auth = { status: "running" };
            void garmin.login(body.email.trim(), body.password, () => {
              auth = { status: "mfa" };
              return new Promise<string>((resolve, reject) => {
                const timer = setTimeout(() => {
                  mfaResolve = undefined;
                  mfaReject = undefined;
                  reject(
                    new Error("MFA-Eingabe abgelaufen. Bitte erneut anmelden."),
                  );
                }, 180_000);
                mfaResolve = (value) => {
                  clearTimeout(timer);
                  mfaResolve = undefined;
                  mfaReject = undefined;
                  auth = { status: "running" };
                  resolve(value);
                };
                mfaReject = (error) => {
                  clearTimeout(timer);
                  reject(error);
                };
              });
            }).then(() => {
              if (generation === authGeneration) auth = { status: "passed" };
            }).catch((e) => {
              if (generation === authGeneration) {
                auth = {
                  status: "failed",
                  error: e instanceof Error
                    ? e.message.slice(0, 300)
                    : "Anmeldung fehlgeschlagen.",
                };
              }
            });
            data = { mfaRequired: false };
            break;
          }
          case "/api/mfa":
            if (
              !mfaResolve || typeof body.code !== "string" ||
              !/^\d{4,10}$/.test(body.code.trim())
            ) throw new Error("Bitte den aktuellen MFA-Code eingeben.");
            mfaResolve(body.code.trim());
            data = {};
            break;
          case "/api/cancelLogin":
            if (auth.status !== "mfa") {
              throw new Error(
                "Anmeldung kann momentan nicht abgebrochen werden.",
              );
            }
            authGeneration++;
            mfaReject?.(new Error("Anmeldung abgebrochen."));
            mfaResolve = undefined;
            mfaReject = undefined;
            auth = { status: "idle" };
            data = {};
            break;
          case "/api/authStatus":
            data = auth;
            break;
          case "/api/pickFolder":
            data = { path: await (opts.pickFolder ?? pickFolder)() };
            break;
          case "/api/openBackup":
          case "/api/openGarmin": {
            const activity = (await service.snapshot()).activities.find((
              item,
            ) => item.id === body.id);
            if (!activity) throw new Error("Aktivität nicht gefunden.");
            if (url.pathname === "/api/openBackup") {
              if (!activity.backupPath) {
                throw new Error("Noch keine Sicherung vorhanden.");
              }
              await (opts.openExternal ?? openExternal)(
                activity.backupPath,
                "file",
              );
            } else {
              if (!activity.garminId || !/^\d+$/.test(activity.garminId)) {
                throw new Error("Kein Garmin-Link verfügbar.");
              }
              await (opts.openExternal ?? openExternal)(
                `https://connect.garmin.com/modern/activity/${activity.garminId}`,
                "garmin",
              );
            }
            data = {};
            break;
          }
          default:
            return json({ ok: false, error: "Nicht gefunden." }, 404);
        }
        return json({ ok: true, data });
      } catch (error) {
        return fail(error);
      }
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response(null, { status: 405, headers });
    }
    const path = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.split("/").includes("..")) {
      return new Response(null, { status: 404, headers });
    }
    try {
      const file = await Deno.readFile(new URL(path, publicDir));
      const ext = path.split(".").pop();
      const types: Record<string, string> = {
        html: "text/html; charset=utf-8",
        css: "text/css",
        js: "text/javascript",
        svg: "image/svg+xml",
        png: "image/png",
        woff2: "font/woff2",
      };
      return new Response(req.method === "HEAD" ? null : file, {
        headers: {
          ...headers,
          "Content-Type": types[ext ?? ""] ?? "application/octet-stream",
        },
      });
    } catch {
      return new Response("Nicht gefunden", { status: 404, headers });
    }
  };
}
