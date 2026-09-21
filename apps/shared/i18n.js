/** German source messages are stable translation IDs (gettext-style).
 * No DOM or runtime dependency: shared by the browser, CLI and notifications.
 */
export const english = {
  "Vorgang fehlgeschlagen.": "Operation failed.",
  "Anmeldung kann momentan nicht abgebrochen werden.":
    "Sign-in cannot be cancelled right now.",
  "Garmin-Anmeldung erforderlich. Bitte erneut anmelden.":
    "Garmin sign-in required. Please sign in again.",
  "Garmin konnte die FIT-Datei nicht importieren.":
    "Garmin could not import the FIT file.",
  "Übertragung wurde unterbrochen. Bitte zuerst Garmin Connect prüfen.":
    "The upload was interrupted. Please check Garmin Connect first.",
  "Sicherung stimmt nicht mit der Quelldatei überein.":
    "The backup does not match the source file.",
  "Datei konnte nicht gesichert oder gelesen werden.":
    "The file could not be backed up or read.",
  "Diese Aktivität wurde bereits erkannt.":
    "This activity has already been detected.",
  "Ergebnis unklar. Bitte Garmin Connect prüfen; keine automatische Wiederholung.":
    "Result unclear. Please check Garmin Connect; no automatic retry.",
  "Unzulässiger Host.": "Host not allowed.",
  "Unzulässiger Zugriff.": "Access not allowed.",
  "Methode nicht erlaubt.": "Method not allowed.",
  "JSON erforderlich.": "JSON required.",
  "Anfrage zu groß.": "Request too large.",
  "Ungültige Anfrage.": "Invalid request.",
  "Ungültige Aktivität.": "Invalid activity.",
  "Nicht gefunden.": "Not found.",
  "--{name} akzeptiert keinen Wert.": "--{name} does not accept a value.",
  "Wert für --{name} fehlt.": "Missing value for --{name}.",
  "Unbekannte Option: --{name}": "Unknown option: --{name}",
  "RideRelay — MyWhoosh-Aktivitäten lokal sichern und zu Garmin übertragen.\n\nriderelay status | scan | reconcile | sync [--id ID] [--dry-run] | watch\nriderelay login | logout | settings [--source ORDNER] [--backup ORDNER]\n\n--language SPRACHE  auto, de oder en (settings speichert die Auswahl)\n--json             Maschinenlesbare Ausgabe\n--data-dir ORDNER  Separater Ordner für Einstellungen und Verlauf\n--demo             Isolierte Beispieldaten, keine Garmin-Uploads\n\nsync überträgt alle bereiten Aktivitäten. --dry-run liest und sichert nur.\nwatch synchronisiert neue Fahrten während der Prozess läuft (Strg+C beendet).\nPasswort und MFA werden ausschließlich interaktiv abgefragt.":
    "RideRelay — Back up MyWhoosh activities locally and sync them to Garmin.\n\nriderelay status | scan | reconcile | sync [--id ID] [--dry-run] | watch\nriderelay login | logout | settings [--source FOLDER] [--backup FOLDER]\n\n--language LANGUAGE  auto, de or en (settings saves the preference)\n--json               Machine-readable output\n--data-dir FOLDER    Separate folder for settings and history\n--demo               Isolated sample data, no Garmin uploads\n\nsync uploads all ready activities. --dry-run only reads and backs up files.\nwatch syncs new rides while running (Ctrl+C to stop).\nPassword and MFA are only requested interactively.",

  "Bereit": "Ready",
  "Wird übertragen": "Syncing",
  "Synchronisiert": "Synced",
  "Bereits bei Garmin": "Already on Garmin",
  "Übertragung fehlgeschlagen": "Sync failed",
  "Status prüfen": "Check status",
  "Zeitpunkt unbekannt": "Unknown date",
  "Die Anfrage konnte nicht abgeschlossen werden.":
    "The request could not be completed.",
  "RideRelay ist gerade nicht erreichbar. Bitte prüfe, ob die App läuft.":
    "RideRelay is currently unavailable. Please check that the app is running.",
  "Dauer": "Duration",
  "Distanz": "Distance",
  "Ø Leistung": "Avg. power",
  "Ø Puls": "Avg. heart rate",
  "Ordner gefunden": "Folder found",
  "Ordner einrichten": "Choose a folder",
  "Verbunden": "Connected",
  "Nicht verbunden": "Not connected",
  "Deine Fahrt wird übertragen": "Your ride is syncing",
  "Deine Fahrten. Einfach verbunden.": "Your rides. Simply connected.",
  "Alles synchronisiert": "Everything is synced",
  "Aktivitäten": "Activities",
  "Aktuelle Fahrt": "Current ride",
  "Wird mit Garmin synchronisiert": "Syncing with Garmin",
  "Bereit zum Synchronisieren": "Ready to sync",
  "Virtuelles Radfahren": "Virtual cycling",
  "Wird übertragen …": "Syncing …",
  "Jetzt synchronisieren": "Sync now",
  "Details ansehen": "View details",
  "Garmin verbinden": "Connect Garmin",
  "Noch keine Fahrten": "No rides yet",
  "Nach deiner nächsten MyWhoosh-Fahrt erscheint die FIT-Datei hier. Du kannst den Ordner auch jetzt durchsuchen.":
    "Your next MyWhoosh ride will appear here. You can also scan the folder now.",
  "Wähle in den Einstellungen deinen MyWhoosh-Ordner. RideRelay findet dort deine FIT-Dateien.":
    "Choose your MyWhoosh folder in Settings. RideRelay will find your FIT files there.",
  "Nach Fahrten suchen": "Find rides",
  "Verlauf": "History",
  "Nach neuen Fahrten suchen": "Scan for new rides",
  "Suche …": "Scanning …",
  "Aktualisieren": "Refresh",
  "Übertragene Fahrten und ihr Status erscheinen hier.":
    "Synced rides and their status will appear here.",
  "Ordnerpfad eingeben": "Enter folder path",
  "Auswählen": "Choose",
  "Speichern": "Save",
  "Ordner noch nicht gefunden": "Folder not found yet",
  "Einstellungen": "Settings",
  "Verbindungen und Speicherorte verwalten.": "Manage connections and folders.",
  "Dein Garmin-Konto ist bereit.": "Your Garmin account is ready.",
  "Verbinde dein Konto, um Fahrten zu übertragen.":
    "Connect your account to sync rides.",
  "Verbindung prüfen": "Check connection",
  "Abmelden": "Sign out",
  "Anmelden": "Sign in",
  "MyWhoosh-Ordner": "MyWhoosh folder",
  "Hier sucht RideRelay nach neuen Aktivitäten.":
    "RideRelay looks for new activities here.",
  "Sicherungskopien": "Backups",
  "Originaldateien werden vor dem Übertragen gesichert.":
    "Original files are backed up before syncing.",
  "Benachrichtigungen": "Notifications",
  "Bei erfolgreichem Sync informieren": "Notify me after a successful sync",
  "Bei Problemen informieren": "Notify me about problems",
  "Automatischer Sync, während RideRelay läuft":
    "Sync automatically while RideRelay is running",
  "Originaldateien bleiben erhalten.": "Original files are preserved.",
  "Schalter werden automatisch gespeichert.":
    "Changes are saved automatically.",
  "Details schließen": "Close details",
  "Garmin hat die Übertragung nicht eindeutig bestätigt. Prüfe dein Garmin-Konto, bevor du diese Fahrt erneut überträgst. RideRelay startet keinen automatischen Wiederholungsversuch.":
    "Garmin did not clearly confirm the upload. Check your Garmin account before syncing this ride again. RideRelay will not retry automatically.",
  "Ø Kadenz": "Avg. cadence",
  "Nicht vorhanden": "Not available",
  "Originaldatei": "Original file",
  "Sicherungsdatei": "Backup file",
  "Wird vor dem Übertragen erstellt": "Created before syncing",
  "Übertragungsversuche": "Sync attempts",
  "Garmin-Aktivitäts-ID": "Garmin activity ID",
  "Erneut versuchen": "Try again",
  "Sicherung öffnen": "Open backup",
  "In Garmin öffnen": "Open in Garmin",
  "Anmeldestatus wird geprüft …": "Checking sign-in status …",
  "Ordner gespeichert.": "Folder saved.",
  "Die Verbindung zu Garmin funktioniert.":
    "The connection to Garmin is working.",
  "Von Garmin abgemeldet.": "Signed out of Garmin.",
  "Ordner durchsucht.": "Folder scanned.",
  "Einstellung gespeichert.": "Setting saved.",
  "Mit Garmin verbunden.": "Connected to Garmin.",
  "Anmeldung läuft …": "Signing in …",
  "Anmeldung fehlgeschlagen.": "Sign-in failed.",
  "Bestätigung durch Garmin erforderlich.": "Garmin verification is required.",
  "Code wird geprüft …": "Checking code …",
  "Zum Inhalt": "Skip to content",
  "Hauptnavigation": "Main navigation",
  "Automatischer Sync": "Automatic sync",
  "Während RideRelay läuft": "While RideRelay is running",
  "Demo · Beispieldaten": "Demo · Sample data",
  "RideRelay wird geladen …": "Loading RideRelay …",
  "Anmeldung schließen": "Close sign-in",
  "Mit Garmin verbinden": "Connect to Garmin",
  "Dein Passwort wird nur für die Anmeldung verwendet. Die Sitzung wird sicher im System gespeichert.":
    "Your password is only used to sign in. Your session is stored securely on this device.",
  "E-Mail-Adresse": "Email address",
  "Passwort": "Password",
  "Gib den Bestätigungscode von Garmin ein.":
    "Enter the verification code from Garmin.",
  "Bestätigungscode": "Verification code",
  "Code bestätigen": "Verify code",
  "Sprache": "Language",
  "Systemsprache": "System language",
  "Die Sprache gilt für Oberfläche und CLI.":
    "The language applies to the app and CLI.",
  "{count} Fahrt bereit zum Übertragen": "{count} ride ready to sync",
  "{count} Fahrten bereit zum Übertragen": "{count} rides ready to sync",
  "{count} Fahrt benötigt deine Aufmerksamkeit":
    "{count} ride needs your attention",
  "{count} Fahrten benötigen deine Aufmerksamkeit":
    "{count} rides need your attention",
  "Ordner gefunden · {count} FIT-Datei erkannt":
    "Folder found · {count} FIT file detected",
  "Ordner gefunden · {count} FIT-Dateien erkannt":
    "Folder found · {count} FIT files detected",
  "Keine Aktivitäten gefunden.": "No activities found.",
  "Unbekannter Befehl. Hilfe: riderelay --help":
    "Unknown command. Help: riderelay --help",
  "login benötigt ein interaktives Terminal ohne --json.":
    "login requires an interactive terminal without --json.",
  "Garmin E-Mail: ": "Garmin email: ",
  "Passwort: ": "Password: ",
  "MFA-Code: ": "MFA code: ",
  "Bei Garmin angemeldet. Sitzung im Betriebssystem-Tresor gespeichert.":
    "Signed in to Garmin. Session saved in the system credential store.",
  "Garmin-Sitzung entfernt.": "Garmin session removed.",
  "Die Demo überträgt keine Aktivitäten.":
    "The demo does not upload activities.",
  "RideRelay beobachtet den Quellordner. Strg+C beendet.":
    "RideRelay is watching the source folder. Press Ctrl+C to stop.",
  "angemeldet": "signed in",
  "nicht angemeldet": "not signed in",
  "Quelle": "Source",
  "Sicherung": "Backup",
  " (nicht gefunden)": " (not found)",
  "RideRelay konnte den Vorgang nicht abschließen.":
    "RideRelay could not complete the operation.",
  "Die Anmeldung braucht ein interaktives Terminal.":
    "Sign-in requires an interactive terminal.",
  "Ungültige Einstellung.": "Invalid setting.",
  "Bitte einen Ordner angeben.": "Please specify a folder.",
  "Bitte zuerst bei Garmin anmelden.": "Please sign in to Garmin first.",
  "Keine gesicherte FIT-Datei vorhanden.": "No backed-up FIT file available.",
  "Die Sicherungsdatei wurde verändert.": "The backup file has changed.",
  "FIT-Datei ist beschädigt oder unvollständig.":
    "The FIT file is damaged or incomplete.",
  "FIT-Datei konnte nicht vollständig gelesen werden.":
    "The FIT file could not be fully read.",
  "FIT-Datei enthält keine Aktivität.": "The FIT file contains no activity.",
  "Der sichere Anmeldespeicher ist nicht verfügbar oder gesperrt.":
    "The secure credential store is unavailable or locked.",
  "Der sichere Anmeldespeicher wird derzeit nur unter macOS und Windows unterstützt.":
    "The secure credential store is currently supported only on macOS and Windows.",
  "Garmin hat den Upload nicht eindeutig bestätigt. Bitte vor einem erneuten Versuch in Garmin prüfen.":
    "Garmin did not clearly confirm the upload. Please check Garmin before trying again.",
  "Garmin ist momentan nicht erreichbar. Bitte später erneut versuchen.":
    "Garmin cannot be reached right now. Please try again later.",
  "Garmin begrenzt die Anfragen. Bitte später erneut versuchen.":
    "Garmin is limiting requests. Please try again later.",
  "Garmin ist momentan nicht verfügbar.": "Garmin is currently unavailable.",
  "Garmin hat den Bestätigungscode nicht akzeptiert.":
    "Garmin did not accept the verification code.",
  "Die Anmeldung wurde ohne Bestätigungscode abgebrochen.":
    "Sign-in was cancelled without a verification code.",
  "Garmin hat die Bestätigung nicht abgeschlossen.":
    "Garmin did not complete verification.",
  "Garmin hat kein lesbares Profil zurückgegeben.":
    "Garmin did not return a readable profile.",
  "Garmin begrenzt die Uploads. Bitte später erneut versuchen.":
    "Garmin is limiting uploads. Please try again later.",
  "Garmin hat die FIT-Datei abgelehnt.": "Garmin rejected the FIT file.",
  "Bitte die laufende Anmeldung zuerst abschließen.":
    "Please finish the current sign-in first.",
  "Eine Anmeldung läuft bereits.": "Sign-in is already in progress.",
  "E-Mail und Passwort sind erforderlich.": "Email and password are required.",
  "MFA-Eingabe abgelaufen. Bitte erneut anmelden.":
    "Verification timed out. Please sign in again.",
  "Bitte den aktuellen MFA-Code eingeben.":
    "Please enter the current verification code.",
  "Anmeldung abgebrochen.": "Sign-in cancelled.",
  "Aktivität nicht gefunden.": "Activity not found.",
  "Noch keine Sicherung vorhanden.": "No backup available yet.",
  "Kein Garmin-Link verfügbar.": "No Garmin link available.",
  "Bitte den vollständigen Ordnerpfad direkt eingeben.":
    "Please enter the full folder path directly.",
  "Ordnerauswahl konnte nicht geöffnet werden.":
    "The folder picker could not be opened.",
  "Ungültiger Garmin-Link.": "Invalid Garmin link.",
  "Ungültiger Dateipfad.": "Invalid file path.",
  "Öffnen fehlgeschlagen.": "Could not open.",
  "{ride} wurde übertragen.": "{ride} was synced.",
  "{ride}: Bitte den Status prüfen.": "{ride}: Please check the status.",
  "Ungültige Sprache. Erlaubt: auto, de, en.":
    "Invalid language. Choose auto, de or en.",
};
export function resolveLanguage(
  preference = "auto",
  system = Intl.DateTimeFormat().resolvedOptions().locale,
) {
  if (preference === "de" || preference === "en") return preference;
  return /^de(?:[-_]|$)/i.test(system) ? "de" : "en";
}
export function translate(language, message, values = {}) {
  if (!message) return "";
  const template = language === "en" ? (english[message] ?? message) : message;
  return template.replace(
    /\{(\w+)\}/g,
    (match, key) => String(values[key] ?? match),
  );
}
export function localeFor(language) {
  return language === "de" ? "de-AT" : "en-GB";
}
