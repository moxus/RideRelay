# RideRelay implementation ledger

Scope: Deno workspace, FIT SDK only external runtime dependency, own Garmin HTTP
adapter, OS token vault, JSON settings, SQLite history, shared CLI/native
desktop. User approved local Git initialization. No remote publication.

| Milestone       | Evidence                                                                                                                                                 | State                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| M0 Foundation   | `1f18c44`, `4359012`: preserved spike/design and shared contracts                                                                                        | Passed                            |
| M1 Core         | `d76f064`: 4 integration tests, FIT integrity, immutable backup, concurrent claims, dedup, watch                                                         | Passed                            |
| M2 Garmin       | `8d0f0d9`: 10 mock protocol tests; disposable macOS Keychain create/read/update/delete verified                                                          | Passed locally; live auth pending |
| M3 Applications | `8d30c01`, `b927733` plus integration commit: 2 API tests, CLI executable, native macOS bundle and browser UI                                            | Passed locally                    |
| M4 Acceptance   | 16 tests; typecheck/lint/format; CLI demo/restart; real FIT scan; native demo launch; browser navigation/details/settings persistence/mobile/error state | Live account acceptance pending   |

## Acceptance evidence

- Deno 2.9.7 on macOS arm64; only npm dependency @garmin/fitsdk@21.214.0.
- `deno task check`, `deno task lint`, `deno task test`: passed.
- `deno task build:cli`: dist/riderelay; isolated demo status ran successfully.
- `deno task build:desktop`: dist/RideRelay.app; native WebView booted and
  served isolated demo, title RideRelay, 4 activities, 1 ready, 3 seeded
  successes.
- Real local MyWhoosh sample scanned through new CLI into isolated .local
  history; ready, 3810 seconds and 23655.35 metres. No upload or FIT rewriting.
- Browser checked activities, details, settings, mock connection, preference
  persistence through reload, demo upload refusal, 390px mobile layout; no
  console errors/warnings. Screenshots under design/qa.
- Polling-related DOM replacement found and fixed before final verification.
- Native folder selection launches a platform dialog; manual absolute-path entry
  remains available. Automated dialog selection was not completed.

## Remaining external acceptance

User must enter credentials locally via Garmin-Login.command to validate own
adapter against live Garmin. The earlier SDK spike login is not proof of this
implementation. MFA and refresh currently have synthetic protocol evidence. A
real upload requires concrete final approval for the selected FIT and
destination; none has been performed. Windows Credential Manager is type-checked
but not run.

App bundles are ad hoc signed local builds, not notarized releases. Deno Desktop
is experimental. Backups require hardlink support. Ambiguous uploads remain
uncertain and are never automatically replayed. No persistent service is
installed.

## M5 — Recover a confirmed upload after an ambiguous response

Reported: Garmin contained the ride but RideRelay retained `uncertain`. The
original response was not retained, so its exact failure shape is unknown.
Implemented read-only Garmin activity lookup with a unique cycling match on UTC
start time (1 second), duration (1 second) and distance (1 metre rounding).
Missing, ambiguous, malformed or truncated results leave the status uncertain.

Reconciliation runs after sync, during desktop monitoring at most once per
minute, and on desktop refresh; CLI `reconcile [--id ID]` is an explicit
read-only check. No upload retry is introduced. Confirmed records gain the
Garmin link and retain the original attempt count. Mock regression tests cover
rounded distances, wrong metrics/type/time, multiple matches, network failure
and persisted restart recovery.

Acceptance: 18 tests, check/lint/format and rebuilt desktop/CLI. Live read-only
lookup found exactly one matching ride; CLI reconcile changed the local record
from uncertain to synced, error null, attempts still 1. User has now confirmed
successful live login and upload; no second upload was sent during diagnosis.

### M5 follow-up — Native restart with an existing vault entry

The rebuilt native app stalled before opening its server. A process sample
located the wait in synchronous SecKeychainFindGenericPassword. macOS Keychain
FFI calls now run nonblocking and the loopback server starts before
session-dependent reads. Native vault save/read/update/delete smoke passed again
with disposable data. The native app was relaunched and its accessibility state
confirmed: `Alles synchronisiert`, `Verlauf (1)`, existing ride
`Synchronisiert`, Garmin `Verbunden`. This also proves persisted status and
session recovery after restart.

## M6 — RideRelay app icon

Generated a petrol rounded-square app icon with white interlocking chain links
using the built-in Imagegen tool. Original transparent PNG and multiresolution
macOS ICNS are tracked under apps/desktop/assets. Prompt and provenance are
recorded there. Root desktop configuration references the icon. Native desktop
build passed; bundle icon metadata and embedded asset verified; 128px rendering
inspected.

## M7 — Installierbares macOS-Paket

Deno Desktop unterstützt DMG direkt über die Ausgabeendung. `package:mac` baut
RideRelay.dmg für den Host (Apple Silicon), ohne zusätzliche
Installer-Abhängigkeit. Lokale ad-hoc-Signatur; keine Developer-ID-Notarisierung
oder Veröffentlichung. Akzeptanz: erfolgreicher Deno-Paketbuild, hdiutil-Prüfung
und lesendes Einhängen zur Kontrolle der App samt Programme-Verknüpfung und
Codesign-Prüfung.

## M8 — Windows x64 MSI (packaging complete, runtime acceptance pending)

Added Windows ICO and package:windows with explicit x86_64-pc-windows-msvc and
MSI output. Initial cross-build failed during automatic icon selection; explicit
Windows --icon resolved the image-decoding failure. Successful MSI build, x64 PE
headers for launcher/runtime and MSI compound-file header checked. No additional
runtime dependency was added; backend uses Windows WebView2. Windows
installation, vault round-trip, MFA/login and sync remain unverified because
this workstation runs macOS. MSI is unsigned and intended for testing.

## M9 — GitHub build and distribution

- Scope: public RideRelay repository, pinned GitHub Actions and Deno 2.9.7,
  native macOS arm64 / Windows x64 checks and installers, SHA-256 checksums.
- Version tags publish pre-releases only after both build jobs succeed.
- Gate: formatting, typecheck, lint, full tests, local release asset
  preparation.
- Acceptance: successful GitHub run and downloadable first tagged pre-release;
  pending until remote execution is verified. Native GUI installation on Windows
  remains a manual acceptance boundary; installers are unsigned.
