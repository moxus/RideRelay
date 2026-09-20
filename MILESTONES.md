# Implementation ledger

Scope: Deno workspace, FIT SDK only external runtime package, own Garmin
adapter, OS token vault, settings JSON, SQLite history, shared CLI and native
desktop UI. Reference: design/activities.png and design/settings.png. No remote
publication.

| Milestone       | Acceptance                                                                                         | Gate                                      | State   |
| --------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------- |
| M0 Foundation   | Shared contracts and isolated worktrees                                                            | Typecheck/format                          | Active  |
| M1 Core         | FIT discovery, immutable backup, persisted history, duplicate/concurrency protection               | Unit/integration, typecheck, lint         | Pending |
| M2 Garmin       | Native HTTP login/MFA/refresh/upload and OS token storage, sanitized errors                        | Mock protocol tests and local vault smoke | Pending |
| M3 Applications | CLI + faithful activities/settings/detail UI + desktop packaging                                   | CLI tests, browser flows, builds          | Pending |
| M4 Acceptance   | Isolated synthetic end-to-end sync, persistence/restart, visual QA; live login when user available | Full gate, runtime readback, screenshots  | Pending |

Real account uploads require a concrete final user approval and are never part
of automated testing. Test fixtures and runtime state are isolated from personal
data. macOS is the local acceptance platform; Windows adapters may be
implemented but must be marked unverified without Windows execution.

Baseline: 1f18c44 preserves existing spike and selected mockups.
