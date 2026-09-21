import { isAbsolute } from "node:path";

export async function pickFolder(language = "de"): Promise<string | null> {
  let cmd: Deno.Command;
  if (Deno.build.os === "darwin") {
    cmd = new Deno.Command("/usr/bin/osascript", {
      args: [
        "-e",
        `activate\ntry\nreturn POSIX path of (choose folder with prompt "${
          language === "en"
            ? "Choose a folder for RideRelay"
            : "Ordner für RideRelay wählen"
        }")\non error number -128\nreturn ""\nend try`,
      ],
      stdout: "piped",
      stderr: "null",
    });
  } else if (Deno.build.os === "windows") {
    cmd = new Deno.Command("powershell.exe", {
      args: [
        "-NoProfile",
        "-STA",
        "-Command",
        'Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = "RideRelay"; if ($d.ShowDialog() -eq "OK") { [Console]::Write($d.SelectedPath) }',
      ],
      stdout: "piped",
      stderr: "null",
    });
  } else throw new Error("Bitte den vollständigen Ordnerpfad direkt eingeben.");
  const result = await cmd.output();
  if (!result.success) {
    throw new Error("Ordnerauswahl konnte nicht geöffnet werden.");
  }
  return new TextDecoder().decode(result.stdout).trim() || null;
}

export async function openExternal(value: string, kind: "file" | "garmin") {
  if (
    kind === "garmin" &&
    !/^https:\/\/connect\.garmin\.com\/modern\/activity\/\d+$/.test(value)
  ) throw new Error("Ungültiger Garmin-Link.");
  if (kind === "file" && !isAbsolute(value)) {
    throw new Error("Ungültiger Dateipfad.");
  }
  let cmd: Deno.Command;
  if (Deno.build.os === "darwin") {
    cmd = new Deno.Command("/usr/bin/open", {
      args: kind === "file" ? ["-R", value] : [value],
      stdout: "null",
      stderr: "null",
    });
  } else if (Deno.build.os === "windows") {
    // Data is passed over stdin; never interpolated into PowerShell source.
    cmd = new Deno.Command("powershell.exe", {
      args: [
        "-NoProfile",
        "-Command",
        "$p = [Console]::In.ReadToEnd(); Start-Process -FilePath $p",
      ],
      stdin: "piped",
      stdout: "null",
      stderr: "null",
    });
    const child = cmd.spawn();
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(value));
    await writer.close();
    if (!(await child.status).success) {
      throw new Error("Öffnen fehlgeschlagen.");
    }
    return;
  } else {cmd = new Deno.Command("xdg-open", {
      args: [value],
      stdout: "null",
      stderr: "null",
    });}
  if (!(await cmd.output()).success) throw new Error("Öffnen fehlgeschlagen.");
}

export function notify(title: string, body: string) {
  const DesktopNotification = (globalThis as unknown as {
    Notification?: new (title: string, options: { body: string }) => unknown;
  }).Notification;
  if (DesktopNotification) {
    try {
      new DesktopNotification(title, { body });
    } catch { /* App still reports status in its UI. */ }
  }
}
