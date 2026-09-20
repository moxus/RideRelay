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
