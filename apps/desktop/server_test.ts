import { createHandler } from "./server.ts";
import type {
  GarminAdapter,
  SyncService,
} from "../../packages/contracts/mod.ts";
const assert = (ok: unknown) => {
  if (!ok) throw new Error("Assertion failed");
};
Deno.test("local API blocks foreign origins and validates requests before mutations", async () => {
  let calls = 0;
  const service = {
    scan: () => {
      calls++;
      return Promise.resolve([]);
    },
    snapshot: () => Promise.resolve({ demo: true }),
    reconcile: () => Promise.resolve([]),
  } as unknown as SyncService;
  const handler = createHandler(service, {} as GarminAdapter);
  const req = (
    headers: Record<string, string>,
    url = "http://127.0.0.1:4187/api/scan",
    body = "{}",
  ) => new Request(url, { method: "POST", headers, body });
  assert(
    (await handler(req({ "content-type": "application/json" }))).status === 403,
  );
  assert(
    (await handler(
      req({
        "X-RideRelay": "1",
        "content-type": "application/json",
        origin: "https://evil.example",
      }),
    )).status === 403,
  );
  assert(
    (await handler(
      req(
        { "X-RideRelay": "1", "content-type": "application/json" },
        "http://evil.example/api/scan",
      ),
    )).status === 403,
  );
  assert(calls === 0);
  assert(
    (await handler(
      req({ "X-RideRelay": "1", "content-type": "application/json" }),
    )).status === 200,
  );
  assert(calls === 1);
  assert(
    (await handler(
      req(
        { "X-RideRelay": "1", "content-type": "application/json" },
        undefined,
        "x".repeat(17000),
      ),
    )).status === 413,
  );
});
Deno.test("login exposes only status and accepts MFA via separate request", async () => {
  let code = "";
  const garmin = {
    login: async (_e: string, _p: string, mfa: () => Promise<string>) => {
      code = await mfa();
    },
  } as unknown as GarminAdapter;
  const handler = createHandler({} as SyncService, garmin);
  const post = async (action: string, body: unknown = {}) =>
    (await handler(
      new Request(`http://127.0.0.1:4187/api/${action}`, {
        method: "POST",
        headers: { "X-RideRelay": "1", "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    )).json();
  assert(
    (await post("login", { email: "test@example.com", password: "synthetic" }))
      .ok,
  );
  assert((await post("authStatus")).data.status === "mfa");
  assert(
    !(await post("login", { email: "test@example.com", password: "synthetic" }))
      .ok,
  );
  assert((await post("mfa", { code: "123456" })).ok);
  assert(code === "123456");
  assert((await post("authStatus")).data.status === "passed");
});

Deno.test("browser receives the shared catalog as JavaScript", async () => {
  const handler = createHandler({} as SyncService, {} as GarminAdapter);
  const response = await handler(new Request("http://127.0.0.1:4187/i18n.js"));
  assert(response.status === 200);
  assert(response.headers.get("content-type") === "text/javascript");
  assert((await response.text()).includes("export function resolveLanguage"));
});
