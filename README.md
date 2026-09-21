# RideRelay

MyWhoosh-Fahrten lokal sichern und zu Garmin Connect übertragen. Gemeinsamer
Deno-Kern für CLI und native Desktop-App, mit Aktivitäten, Verlauf und
Einstellungen.

## Start

Voraussetzung: Deno 2.9.7 oder kompatibel. Auf macOS: `brew install deno`.

```sh
deno task preview          # isolierte Beispieldaten auf http://127.0.0.1:4187
deno task desktop          # echte lokale Daten im Browser
deno task cli --help
deno task cli login        # Passwort und MFA verdeckt im Terminal
deno task cli reconcile    # unklare Uploads bei Garmin nachprüfen, kein Upload
deno task cli scan         # lesen und unverändert sichern, kein Upload
deno task cli sync --dry-run
deno task cli sync         # alle bereiten Fahrten tatsächlich übertragen
deno task cli watch        # neue Fahrten synchronisieren, bis Strg+C
```

Alternativ startet `Garmin-Login.command` den interaktiven Login. Passwörter
gehören nicht in Kommandozeilenargumente, Dateien oder Chat. Desktop-Anmeldung
befindet sich unter Einstellungen. Die Demo sendet keine Fahrten an Garmin.

```sh
deno task cli settings --source /absoluter/MyWhoosh/Ordner --backup /absoluter/Sicherungsordner
deno task build:cli        # dist/riderelay
deno task build:desktop    # dist/RideRelay.app auf macOS
```

Das native App-Paket enthält Runtime und Oberfläche und braucht zum Start kein
separates Deno. `deno desktop` ist experimentell. macOS-Builds sind lokal ad hoc
signiert, nicht für öffentliche Verteilung notarisiert. Die Browser-Ausführung
verwendet denselben lokalen Server, jedoch ohne native
Desktop-Benachrichtigungen. Der automatische Desktop-Sync läuft nur, solange die
App läuft. CLI `watch` synchronisiert ausdrücklich unabhängig vom
Desktop-Schalter.

## Daten und Abhängigkeiten

- Einzige externe Runtime-Bibliothek: offizielles `@garmin/fitsdk@21.214.0`.
- Keine Garmin-Client-Bibliothek: eigener HTTP-Adapter für Login, MFA, Refresh,
  Profil und Multipart-Upload. Die inoffiziellen Garmin-Endpunkte können sich
  ändern.
- Deno übernimmt Tasks, Tests, Formatierung, Paketauflösung und ausführbare
  Builds.
- SQLite über Deno `node:sqlite`; keine zusätzliche Datenbankinstallation.
- Einstellungen: `~/Library/Application Support/RideRelay/settings.json`
  (macOS).
- Verlauf: `sync.sqlite` im selben Verzeichnis; Windows nutzt
  `%LOCALAPPDATA%/RideRelay`.
- Tokens: macOS Keychain bzw. Windows Credential Manager; kein gespeichertes
  Passwort. Windows-Tresor ist implementiert, aber auf dieser Plattform nicht
  laufzeitgeprüft. Linux hat derzeit keinen produktiven Token-Tresor.
- FIT-Originale werden vor dem Upload unverändert unter ihrem SHA-256-Hash
  gesichert. Der Sicherungsordner benötigt ein Dateisystem mit
  Hardlink-Unterstützung.
- `--data-dir` isoliert Einstellungen und Verlauf. Die produktive Garmin-Sitzung
  ist appweit geteilt; `--demo` verwendet ausschließlich einen internen
  Testadapter.

Dateihash und Aktivitätsidentität verhindern doppelte Erkennung; atomare SQLite-
Claims verhindern parallele Uploads derselben Fahrt durch CLI und Desktop.
Eindeutig vorübergehende Fehler werden begrenzt erneut versucht. Ein
abgebrochener oder nicht eindeutig bestätigter Upload bleibt **unklar**, bis
Garmin geprüft wurde; es gibt dafür absichtlich keinen automatischen erneuten
Upload. Nach Prozessabbruch wird eine offene Übertragung spätestens nach zehn
Minuten so markiert.

Die App repariert FIT-Dateien nicht automatisch. Beschädigte Dateien bleiben im
Verlauf sichtbar und werden nicht hochgeladen. Vorhandene Backups werden nicht
überschrieben. Quellen und Sicherungen werden niemals automatisch gelöscht.

## Entwicklung und Prüfung

```sh
deno task check
deno task lint
deno task test
deno task fmt --check
```

Workspace: `packages/core`, `packages/garmin`, `packages/contracts`,
`apps/shared`, `apps/cli`, `apps/desktop`. API nur auf Loopback, mit
Origin-/Host-Prüfung und benutzerdefiniertem Header gegen fremde Webseiten.
FFI-Zugriff wird für den nativen Betriebssystem-Tresor benötigt; Desktop nutzt
Prozesse nur für Ordnerwahl und Öffnen.

18 automatisierte Tests prüfen FIT/Backup/Persistenz/Deduplizierung,
konkurrierende Uploads, Garmin-Protokoll/MFA/Refresh/Fehler und lokale
API-Abschirmung. Der Schlüsselbund wurde mit wegwerfbaren Testdaten geprüft.
Echte Garmin-Uploads sind kein Teil automatisierter Tests. Siehe `MILESTONES.md`
und `design-qa.md` für die Abnahme und verbleibende Live-Prüfungen.

## macOS-Paket

`deno task package:mac` erzeugt `dist/RideRelay.dmg` für die Architektur des
Build-Macs (hier Apple Silicon). DMG öffnen und RideRelay nach Programme ziehen.
Deno muss auf dem Zielgerät nicht installiert sein. Einstellungen, Verlauf und
Schlüsselbund bleiben außerhalb des App-Pakets erhalten.

Das Paket ist lokal ad hoc signiert und nicht notarisiert. Für öffentliche
Downloads ohne die üblichen macOS-Vertrauenswarnungen sind Apple Developer ID
und Notarisierung separat erforderlich. Es wird nichts automatisch
veröffentlicht.

## Windows-Paket (Testversion)

`deno task package:windows` erzeugt `dist/RideRelay-windows-x64.msi`, auch vom
Mac aus. Das MSI installiert die x64-App; Deno ist im Paket enthalten. Die
Oberfläche verwendet Microsoft WebView2, das auf dem Zielgerät verfügbar sein
muss. Das Paket ist nicht mit einem Windows-Herausgeberzertifikat signiert.

Build und x64-Dateiformate wurden auf macOS geprüft, die Installation und
Ausführung unter Windows noch nicht. Vor einer regulären Freigabe müssen Start,
Ordnerwahl, Login/MFA, Credential Manager (einschließlich Token-Größenlimit),
Sitzungswiederherstellung und Sync auf einem Windows-Rechner geprüft werden. Den
tatsächlichen MyWhoosh-Datenordner bei Bedarf in Einstellungen auswählen.
