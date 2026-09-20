import type {
  GarminAdapter,
  SessionTokens,
  TokenStore,
} from "../contracts/mod.ts";
import { GarminError } from "./errors.ts";

const SSO = "https://sso.garmin.com";
const API = "https://connectapi.garmin.com";
const TOKEN = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
const SERVICE = "https://mobile.integration.garmin.com/gcm/ios";
const CLIENT = "GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2";
const MOBILE_HEADERS = {
  "user-agent": "GCM-Android-5.23",
  "x-garmin-user-agent":
    "com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0",
  "x-garmin-paired-app-version": "10861",
  "x-garmin-client-platform": "Android",
  "x-app-ver": "10861",
  "x-lang": "en",
  "x-gcexperience": "GC5",
  "accept-language": "en-US,en;q=0.9",
};
type ObjectData = Record<string, unknown>;
function object(value: unknown): ObjectData {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as ObjectData
    : {};
}
function ticket(data: ObjectData): string | undefined {
  for (const key of ["serviceTicketId", "ticket", "serviceTicket"]) {
    if (typeof data[key] === "string" && data[key]) return data[key] as string;
  }
}
function authError(): GarminError {
  return new GarminError(
    "AUTH",
    "Garmin-Anmeldung erforderlich. Bitte erneut anmelden.",
  );
}
function uncertain(): GarminError {
  return new GarminError(
    "UNCERTAIN",
    "Garmin hat den Upload nicht eindeutig bestätigt. Bitte vor einem erneuten Versuch in Garmin prüfen.",
  );
}

export class GarminClient implements GarminAdapter {
  #fetch: typeof fetch;
  #now: () => number;
  #queue: Promise<unknown> = Promise.resolve();
  constructor(
    private store: TokenStore,
    options: { fetch?: typeof fetch; now?: () => number } = {},
  ) {
    this.#fetch = options.fetch ?? fetch;
    this.#now = options.now ?? Date.now;
  }
  #exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#queue.then(operation);
    this.#queue = result.catch(() => {});
    return result;
  }
  async #request(url: string, init: RequestInit, upload = false) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      upload ? 120_000 : 30_000,
    );
    try {
      const response = await this.#fetch(url, {
        ...init,
        redirect: "error",
        signal: controller.signal,
      });
      let data: unknown = null;
      // Consume inside the deadline, including slow or interrupted response bodies.
      const body = await response.text();
      try {
        data = JSON.parse(body);
      } catch { /* Handled by schema checks below. */ }
      return {
        status: response.status,
        headers: response.headers,
        data: object(data),
      };
    } catch {
      throw upload ? uncertain() : new GarminError(
        "NETWORK",
        "Garmin ist momentan nicht erreichbar. Bitte später erneut versuchen.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
  #requireOk(status: number, mfa = false) {
    if (status >= 200 && status < 300) return;
    if (status === 429) {
      throw new GarminError(
        "RATE_LIMIT",
        "Garmin begrenzt die Anfragen. Bitte später erneut versuchen.",
      );
    }
    if (status >= 500) {
      throw new GarminError("NETWORK", "Garmin ist momentan nicht verfügbar.");
    }
    throw mfa
      ? new GarminError(
        "MFA",
        "Garmin hat den Bestätigungscode nicht akzeptiert.",
      )
      : authError();
  }
  async #exchange(
    fields: Record<string, string>,
    clientId: string,
    previousRefresh?: string,
  ) {
    const response = await this.#request(TOKEN, {
      method: "POST",
      headers: {
        ...MOBILE_HEADERS,
        authorization: `Basic ${btoa(`${clientId}:`)}`,
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
        "cache-control": "no-cache",
      },
      body: new URLSearchParams({ ...fields, client_id: clientId }),
    });
    this.#requireOk(response.status);
    const {
      access_token: access,
      refresh_token: refresh,
      expires_in: expires,
    } = response.data;
    const refreshToken = typeof refresh === "string" && refresh
      ? refresh
      : previousRefresh;
    const seconds = typeof expires === "number" ? expires : Number(expires);
    if (
      typeof access !== "string" || !access || !refreshToken ||
      !Number.isFinite(seconds) || seconds <= 0
    ) throw authError();
    const tokens: SessionTokens = {
      accessToken: access,
      refreshToken,
      expiresAt: this.#now() + seconds * 1000,
      clientId,
    };
    await this.store.save(tokens);
    return tokens;
  }
  login(
    email: string,
    password: string,
    mfa: () => Promise<string>,
  ): Promise<void> {
    return this.#exclusive(async () => {
      if (!email.trim() || !password) throw authError();
      const query = new URLSearchParams({
        clientId: "GCM_IOS_DARK",
        locale: "en-US",
        service: SERVICE,
      });
      const headers = {
        "content-type": "application/json",
        accept: "application/json, text/plain, */*",
        origin: SSO,
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
      };
      const response = await this.#request(`${SSO}/mobile/api/login?${query}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          username: email.trim(),
          password,
          rememberMe: true,
          captchaToken: "",
        }),
      });
      this.#requireOk(response.status);
      let serviceTicket = ticket(response.data);
      if (!serviceTicket) {
        const status = object(response.data.responseStatus).type ??
          response.data.status;
        const needsMfa = response.data.mfaRequired === true ||
          response.data.mfa_required === true || status === "MFA_REQUIRED" ||
          status === "MFA";
        if (!needsMfa) throw authError();
        const code = (await mfa()).trim();
        if (!code) {
          throw new GarminError(
            "MFA",
            "Die Anmeldung wurde ohne Bestätigungscode abgebrochen.",
          );
        }
        const cookies = response.headers.getSetCookie().map((cookie) =>
          cookie.split(";", 1)[0]
        ).join("; ");
        const method = object(response.data.customerMfaInfo).mfaLastMethodUsed;
        const verified = await this.#request(
          `${SSO}/mobile/api/mfa/verifyCode?${query}`,
          {
            method: "POST",
            headers: { ...headers, ...(cookies ? { cookie: cookies } : {}) },
            body: JSON.stringify({
              mfaMethod: typeof method === "string" ? method : "email",
              mfaVerificationCode: code,
              rememberMyBrowser: true,
              reconsentList: [],
              mfaSetup: false,
            }),
          },
        );
        this.#requireOk(verified.status, true);
        serviceTicket = ticket(verified.data);
        if (!serviceTicket) {
          throw new GarminError(
            "MFA",
            "Garmin hat die Bestätigung nicht abgeschlossen.",
          );
        }
      }
      await this.#exchange({
        grant_type: `${API}/di-oauth2-service/oauth/grant/service_ticket`,
        service_ticket: serviceTicket,
        service_url: SERVICE,
      }, CLIENT);
    });
  }
  #tokens(force = false): Promise<SessionTokens> {
    return this.#exclusive(async () => {
      const saved = await this.store.load();
      if (!saved) throw authError();
      if (!force && saved.expiresAt > this.#now() + 60_000) return saved;
      try {
        return await this.#exchange(
          { grant_type: "refresh_token", refresh_token: saved.refreshToken },
          saved.clientId,
          saved.refreshToken,
        );
      } catch (error) {
        if (error instanceof GarminError && error.code === "AUTH") {
          await this.store.clear();
        }
        throw error;
      }
    });
  }
  /** Local session availability; profile() explicitly checks the remote connection. */
  async connected(): Promise<boolean> {
    return (await this.store.load()) !== null;
  }
  logout(): Promise<void> {
    return this.#exclusive(() => this.store.clear());
  }
  async profile(): Promise<{ displayName: string }> {
    let tokens = await this.#tokens();
    let response = await this.#request(
      `${API}/userprofile-service/socialProfile`,
      {
        headers: {
          ...MOBILE_HEADERS,
          authorization: `Bearer ${tokens.accessToken}`,
        },
      },
    );
    if (response.status === 401) {
      tokens = await this.#tokens(true);
      response = await this.#request(
        `${API}/userprofile-service/socialProfile`,
        {
          headers: {
            ...MOBILE_HEADERS,
            authorization: `Bearer ${tokens.accessToken}`,
          },
        },
      );
    }
    this.#requireOk(response.status);
    const name = response.data.displayName ?? response.data.fullName ??
      response.data.userName;
    if (typeof name !== "string" || !name) {
      throw new GarminError(
        "REJECTED",
        "Garmin hat kein lesbares Profil zurückgegeben.",
      );
    }
    return { displayName: name };
  }
  async upload(
    bytes: Uint8Array,
    filename: string,
  ): Promise<{ duplicate: boolean; activityId: string | null }> {
    const tokens = await this.#tokens();
    const body = new FormData();
    body.set(
      "file",
      new File(
        [new Uint8Array(bytes)],
        filename.split(/[\\/]/).pop() || "activity.fit",
        { type: "application/octet-stream" },
      ),
    );
    const response = await this.#request(`${API}/upload-service/upload`, {
      method: "POST",
      headers: {
        ...MOBILE_HEADERS,
        authorization: `Bearer ${tokens.accessToken}`,
      },
      body,
    }, true);
    if (response.status === 409) return { duplicate: true, activityId: null };
    // A server error may follow a committed upload. Never blindly repeat a write.
    if (response.status >= 500 || response.status === 408) throw uncertain();
    if (response.status === 401 || response.status === 403) throw authError();
    if (response.status === 429) {
      throw new GarminError(
        "RATE_LIMIT",
        "Garmin begrenzt die Uploads. Bitte später erneut versuchen.",
      );
    }
    if (response.status < 200 || response.status >= 300) {
      throw new GarminError("REJECTED", "Garmin hat die FIT-Datei abgelehnt.");
    }
    const result = object(response.data.detailedImportResult);
    const successes = result.successes;
    if (Array.isArray(successes) && successes.length === 1) {
      const id = object(successes[0]).internalId;
      if (
        (typeof id === "number" && Number.isSafeInteger(id) && id > 0) ||
        (typeof id === "string" && /^\d+$/.test(id))
      ) return { duplicate: false, activityId: String(id) };
    }
    const failures = result.failures;
    if (
      Array.isArray(failures) && failures.length &&
      (!Array.isArray(successes) || !successes.length)
    ) {
      const messages = failures.flatMap((failure) => {
        const list = object(failure).messages;
        return Array.isArray(list) ? list : [];
      });
      if (
        messages.some((message) =>
          /duplicate|already exists/i.test(
            String(object(message).content ?? ""),
          )
        )
      ) return { duplicate: true, activityId: null };
      throw new GarminError(
        "REJECTED",
        "Garmin konnte die FIT-Datei nicht importieren.",
      );
    }
    throw uncertain();
  }
}
