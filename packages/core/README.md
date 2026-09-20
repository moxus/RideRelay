# RideRelay sync core

`await createSyncService({ dataDir?, garmin, demo? })` creates the shared CLI
and desktop service. It never scans automatically at construction. Configure
folders with `saveSettings`, then `scan`, `snapshot`, `sync(id?)` or
`watch(signal)`. `close()` releases SQLite after background work has stopped.

Settings are JSON; history is SQLite with WAL and atomic upload claims. The
macOS default points to MyWhoosh's app container. Windows uses a best-effort
AppData location and should be configured to the actual installation directory.

Discovery waits for stable file size/modification time and backs up original
bytes by SHA-256 before decoding. Atomic hard-link publication prevents two
processes from observing a partial backup or overwriting an existing backup. The
backup folder must support hard links (ordinary local macOS/Windows filesystems
do). FIT signature, CRC and decoder errors are checked. No FIT fields are
rewritten, so unknown and developer fields remain intact. Missing summary
metrics stay null.

Exact hashes and session identity (start, sport, duration, distance) prevent
repeated uploads. Unknown network outcomes become `uncertain` and are never
replayed. Interrupted claims become uncertain after ten minutes. An adapter may
mark a rejected request `{ definite: true, retryable: true }` for at most three
automatic attempts with exponential delay. Definite errors can be retried by ID;
invalid discovered files cannot. Watch polls every two seconds, picks up
settings changes, always scans and uploads only when `autoSync` is enabled. Demo
mode never uploads. Notifications are settings for the UI host to act upon.

Tests use generated FIT files and temporary databases with no Garmin network:

```sh
deno test --allow-read --allow-write --allow-env packages/core
```
