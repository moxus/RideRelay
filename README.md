# MyWhoosh → Garmin: Deno compatibility spike

Two independent checks, without uploading or modifying activities.

## Requirements

Deno 2.9 or newer. Validated locally with Homebrew Deno 2.9.7 on macOS arm64.

## Read MyWhoosh FIT files

```sh
deno task fit:inspect
# Or inspect an explicit file:
deno task fit:inspect '/absolute/path/activity.fit'
```

The default is the macOS MyWhoosh data directory. The script validates the FIT
signature and CRC, decodes messages, reports session summaries and sensor
coverage, and verifies that the source file remains unchanged. Sample means are
simple means of valid samples, not time-weighted activity statistics. Nothing is
uploaded.

## Test Garmin authentication

```sh
deno task garmin:login
```

On macOS, double-click `Garmin-Login.command` to launch the same task in
Terminal. Email, password and any requested MFA code are entered locally without
echo. The test logs in, reads the profile, and restores the in-memory session in
a second client. Credentials and tokens are not written to disk. Only a
sanitized result is saved in `.local/garmin-result.json`. An MFA-required
account is needed to validate MFA; success without a challenge does not prove
MFA support. This test does not verify token refresh after expiration or session
persistence across process exits.

The candidate `garmin-connect-sdk@1.1.0` uses native fetch and an MFA callback.
Its current license is PolyForm Noncommercial; this is a private evaluation, not
a final dependency decision for distribution. FIT activity upload is not exposed
by this SDK's documented API and requires separate evaluation. The original
`garmin-connect` package's MFA implementation remains incomplete.

## Checks

```sh
deno task check
deno task lint
deno fmt --check scripts deno.json README.md
```

Packages are pinned in `deno.json` and `deno.lock`. No npm CLI is required.

## Verified on 2026-09-20

- Homebrew Deno 2.9.7, macOS arm64.
- `@garmin/fitsdk@21.214.0`: the local `MyNewActivity-6.1.0.fit` (96,594 bytes)
  passed signature and CRC checks and decoded with zero errors: 3,810 records,
  18 laps, one session. Source SHA-256 was unchanged after reading.
- This sample already contains average power, heart rate and cadence; no record
  temperatures are present. The original Python repairs are unnecessary for this
  particular sample. This does not establish behavior for every MyWhoosh file.
- `garmin-connect-sdk@1.1.0`: live login, authenticated profile read and reuse
  of the in-memory session in a second client all passed. The result does not
  record whether Garmin requested MFA, so MFA is not independently marked as
  verified.
- Type checking, linting and formatting checks passed.
- Not tested: FIT rewriting, activity upload, token expiry/refresh, persistent
  session storage, Windows or Deno Desktop packaging.
