import { GarminClient, GarminError, MemoryTokenStore } from "./mod.ts";
import type { SessionTokens } from "../contracts/mod.ts";

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
const stored: SessionTokens = {
  accessToken: "synthetic-access",
  refreshToken: "synthetic-refresh",
  clientId: "synthetic-client",
  expiresAt: 3_600_000,
};
const tokenResponse = {
  access_token: "new-access",
  refresh_token: "new-refresh",
  expires_in: 3600,
};
function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers });
}
function mock(
  handlers: Array<
    (url: string, init: RequestInit) => Response | Promise<Response>
  >,
) {
  let count = 0;
  return {
    fetch: ((input, init) => {
      const next = handlers[count++];
      if (!next) throw new Error("Unexpected request");
      return Promise.resolve(next(String(input), init ?? {}));
    }) as typeof fetch,
    done: () => assert(count === handlers.length, "Unexpected request count"),
  };
}
async function rejects(operation: () => Promise<unknown>, code: string) {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof GarminError);
    assert(error.code === code, `Expected ${code}, got ${error.code}`);
    assert(!error.message.includes("synthetic-secret"));
    return error;
  }
  throw new Error("Expected rejection");
}

Deno.test("login exchanges service ticket and persists session without password", async () => {
  const store = new MemoryTokenStore();
  const http = mock([
    (url, init) => {
      assert(url.startsWith("https://sso.garmin.com/mobile/api/login?"));
      assert(
        new URL(url).searchParams.get("service") ===
          "https://mobile.integration.garmin.com/gcm/ios",
      );
      const body = JSON.parse(String(init.body));
      assert(
        body.username === "test@example.invalid" &&
          body.password === "synthetic-secret",
      );
      assert(init.redirect === "error" && init.signal instanceof AbortSignal);
      return json({ serviceTicketId: "synthetic-ticket" });
    },
    (url, init) => {
      assert(url.startsWith("https://diauth.garmin.com/"));
      const form = init.body as URLSearchParams;
      assert(form.get("service_ticket") === "synthetic-ticket");
      assert(
        new Headers(init.headers).get("authorization")?.startsWith("Basic "),
      );
      return json(tokenResponse);
    },
  ]);
  await new GarminClient(store, { fetch: http.fetch, now: () => 0 }).login(
    "test@example.invalid",
    "synthetic-secret",
    () => {
      throw new Error("MFA not expected");
    },
  );
  assert((await store.load())?.expiresAt === 3_600_000);
  assert(!JSON.stringify(await store.load()).includes("synthetic-secret"));
  http.done();
});

Deno.test("MFA carries session cookie and selected method only to SSO", async () => {
  let prompted = 0;
  const http = mock([
    () =>
      json(
        {
          responseStatus: { type: "MFA_REQUIRED" },
          customerMfaInfo: { mfaLastMethodUsed: "sms" },
        },
        200,
        { "set-cookie": "session=synthetic-cookie; HttpOnly; Secure" },
      ),
    (url, init) => {
      assert(url.includes("/mfa/verifyCode?"));
      assert(
        new Headers(init.headers).get("cookie") === "session=synthetic-cookie",
      );
      const data = JSON.parse(String(init.body));
      assert(data.mfaVerificationCode === "123456" && data.mfaMethod === "sms");
      return json({ ticket: "verified-ticket" });
    },
    (_, init) => {
      assert(!new Headers(init.headers).has("cookie"));
      return json(tokenResponse);
    },
  ]);
  await new GarminClient(new MemoryTokenStore(), { fetch: http.fetch }).login(
    "a",
    "b",
    () => {
      prompted++;
      return Promise.resolve("123456");
    },
  );
  assert(prompted === 1);
  http.done();
});

Deno.test("MFA rejection and invalid login errors are sanitized", async () => {
  for (const mfa of [false, true]) {
    const handlers = mfa
      ? [
        () => json({ mfaRequired: true }),
        () => json({ error: "synthetic-secret" }, 400),
      ]
      : [() => json({ error: "synthetic-secret" }, 403)];
    const http = mock(handlers);
    await rejects(
      () =>
        new GarminClient(new MemoryTokenStore(), { fetch: http.fetch }).login(
          "a",
          "b",
          () => Promise.resolve("123"),
        ),
      mfa ? "MFA" : "AUTH",
    );
    http.done();
  }
});

Deno.test("expired session refreshes once for concurrent profiles, persisted for new client", async () => {
  const store = new MemoryTokenStore();
  await store.save({ ...stored, expiresAt: 0 });
  let refreshed = 0, profiles = 0;
  const transport = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("oauth/token")) {
      refreshed++;
      assert(
        (init?.body as URLSearchParams).get("refresh_token") ===
          stored.refreshToken,
      );
      return Promise.resolve(json(tokenResponse));
    }
    profiles++;
    assert(
      new Headers(init?.headers).get("authorization") === "Bearer new-access",
    );
    return Promise.resolve(json({ displayName: "Rider" }));
  }) as typeof fetch;
  const client = new GarminClient(store, { fetch: transport, now: () => 0 });
  await Promise.all([client.profile(), client.profile()]);
  assert(
    (await new GarminClient(store, { fetch: transport, now: () => 0 })
      .profile()).displayName === "Rider",
  );
  assert(refreshed === 1 && profiles === 3);
});

Deno.test("rejected refresh clears stale session; network failure retains it", async () => {
  for (const status of [400, 503]) {
    const store = new MemoryTokenStore();
    await store.save({ ...stored, expiresAt: 0 });
    const http = mock([() => json({ error: "synthetic-secret" }, status)]);
    await rejects(
      () => new GarminClient(store, { fetch: http.fetch }).profile(),
      status === 400 ? "AUTH" : "NETWORK",
    );
    assert((await store.load() === null) === (status === 400));
    http.done();
  }
});

Deno.test("read-only profile can recover from unauthorized once", async () => {
  const store = new MemoryTokenStore();
  await store.save(stored);
  const http = mock([
    () => json({}, 401),
    () => json(tokenResponse),
    () => json({ displayName: "Rider" }),
  ]);
  assert(
    (await new GarminClient(store, { fetch: http.fetch, now: () => 0 })
      .profile()).displayName === "Rider",
  );
  http.done();
});

Deno.test("upload sends FIT multipart and returns confirmed Garmin id", async () => {
  const store = new MemoryTokenStore();
  await store.save(stored);
  const http = mock([async (url, init) => {
    assert(
      url === "https://connectapi.garmin.com/upload-service/upload" &&
        init.method === "POST",
    );
    assert(!new Headers(init.headers).has("content-type"));
    const file = (init.body as FormData).get("file");
    assert(file instanceof File);
    assert(
      file.name === "ride.fit" &&
        new Uint8Array(await file.arrayBuffer())[0] === 42,
    );
    return json({
      detailedImportResult: { successes: [{ internalId: 123 }], failures: [] },
    });
  }]);
  const result = await new GarminClient(store, {
    fetch: http.fetch,
    now: () => 0,
  }).upload(new Uint8Array([42]), "/private/ride.fit");
  assert(!result.duplicate && result.activityId === "123");
  http.done();
});

Deno.test("upload duplicate, rejection, and ambiguity are distinguished without retries", async () => {
  const cases: Array<[() => Response, string]> = [
    [() => json({}, 409), "duplicate"],
    [
      () =>
        json({
          detailedImportResult: {
            failures: [{ messages: [{ content: "Duplicate Activity" }] }],
            successes: [],
          },
        }),
      "duplicate",
    ],
    [() => json({}, 401), "AUTH"],
    [() => json({}, 429), "RATE_LIMIT"],
    [() => json({}, 400), "REJECTED"],
    [
      () =>
        json({
          detailedImportResult: { failures: [{ messages: [] }], successes: [] },
        }),
      "REJECTED",
    ],
    [() => json({}, 503), "UNCERTAIN"],
    [() => json({}), "UNCERTAIN"],
    [() => new Response("synthetic-secret"), "UNCERTAIN"],
    [() => {
      throw new Error("synthetic-secret");
    }, "UNCERTAIN"],
  ];
  for (const [response, expected] of cases) {
    const store = new MemoryTokenStore();
    await store.save(stored);
    const http = mock([response]);
    const client = new GarminClient(store, { fetch: http.fetch, now: () => 0 });
    if (expected === "duplicate") {
      assert((await client.upload(new Uint8Array([1]), "a.fit")).duplicate);
    } else {
      const error = await rejects(
        () => client.upload(new Uint8Array([1]), "a.fit"),
        expected,
      );
      assert(error.uncertain === (expected === "UNCERTAIN"));
    }
    http.done();
  }
});

Deno.test("logout removes session and prevents network upload", async () => {
  const store = new MemoryTokenStore();
  await store.save(stored);
  const http = mock([]),
    client = new GarminClient(store, { fetch: http.fetch });
  assert(await client.connected());
  await client.logout();
  assert(!await client.connected());
  await rejects(() => client.upload(new Uint8Array([1]), "a.fit"), "AUTH");
  http.done();
});

Deno.test("memory store does not expose mutable token reference", async () => {
  const store = new MemoryTokenStore(), input = { ...stored };
  await store.save(input);
  input.accessToken = "changed";
  const loaded = await store.load();
  assert(loaded);
  loaded.refreshToken = "changed";
  assert(
    (await store.load())?.accessToken === stored.accessToken &&
      (await store.load())?.refreshToken === stored.refreshToken,
  );
});

Deno.test("readback uniquely matches UTC time, cycling type, duration and rounded distance", async () => {
  const activity = {
    startedAt: "2026-09-17T16:18:34.000Z",
    duration: 3810,
    distance: 23655.35,
  };
  const match = {
    activityId: 123,
    startTimeGMT: "2026-09-17 16:18:34",
    duration: 3810,
    distance: 23655.349609375,
    activityType: { typeKey: "virtual_ride" },
  };
  for (
    const [entries, expected] of [
      [[match], "123"],
      [[match, { ...match, activityId: 124 }], null],
      [[{ ...match, startTimeGMT: "2026-09-17 18:18:34" }], null],
      [[{ ...match, duration: 4000 }], null],
      [[{ ...match, distance: 24000 }], null],
      [[{ ...match, activityType: { typeKey: "running" } }], null],
      [[{ ...match, activityId: "" }], null],
      [Array.from({ length: 100 }, () => match), null],
      [[], null],
    ] as Array<[unknown[], string | null]>
  ) {
    const store = new MemoryTokenStore();
    await store.save(stored);
    const http = mock([(url, init) => {
      assert(
        url.includes("/activitylist-service/activities/search/activities?"),
      );
      assert(!init.method || init.method === "GET");
      assert(!init.body);
      return json(entries);
    }]);
    const client = new GarminClient(store, { fetch: http.fetch, now: () => 0 });
    assert(await client.findActivity(activity) === expected);
    http.done();
  }
});
