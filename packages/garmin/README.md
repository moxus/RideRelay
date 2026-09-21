# Garmin adapter

`GarminClient` implements the shared `GarminAdapter` with native HTTP APIs,
without a Garmin SDK, OAuth package, shell invocation or HTTP dependency. Inject
`fetch` and `now` for deterministic tests. `connected()` reports local session
presence; `profile()` checks the connection remotely.

The mobile SSO login sends credentials directly to Garmin over HTTPS, supports
MFA with an in-memory SSO cookie, then exchanges the service ticket at DI OAuth.
Only access/refresh tokens, expiry and the public client identifier are
persisted. Password, MFA and SSO cookies are not persisted. Refresh is
serialized per client; read-only profile requests may retry once following
a 401. Uploads never retry after dispatch: network interruption, invalid
confirmation and server errors are reported as uncertain, requiring
reconciliation with Garmin before another try.

`OsTokenStore(account = "garmin", service = "RideRelay")` uses the macOS
Keychain or Windows Credential Manager via Deno FFI. It requires `--allow-ffi`
(Deno's unsafe pointer APIs require the unscoped permission). There is no
plaintext fallback. `MemoryTokenStore` is explicitly for ephemeral sessions and
tests. Both native vaults are tested with disposable synthetic credentials;
Windows is covered by GitHub Actions. The Windows credential blob limit is 2560
bytes. Linux is explicitly unsupported for persistent credentials.

Run:

```sh
deno test packages/garmin
deno run --allow-ffi packages/garmin/vault_smoke.ts
```

The vault smoke test uses a random account namespace, verifies
create/read/update, and deletes the synthetic credential in a `finally` block.
It never touches the real Garmin session. Unit tests cover protocol requests and
error classification with synthetic responses. They do not replace real-account
acceptance of login, MFA, refresh and upload. A live upload creates an activity
and is not part of automated tests.

Protocol references (facts and wire formats, independently implemented):

- [Mobile auth protocol reference](https://github.com/marcel-tuinstra/garmin-connect-sdk/blob/main/src/auth/AuthService.ts)
- [Garth multipart upload](https://github.com/matin/garth/blob/main/src/garth/http.py)
- [Apple Security framework](https://developer.apple.com/documentation/security/keychain-services)
- [Windows CREDENTIALW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw)

Garmin's internal mobile endpoints and public client identifiers can change. No
implementation code from the noncommercial SDK is included.
