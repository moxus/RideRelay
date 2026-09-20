const $ = (selector) => document.querySelector(selector);
const content = $("#content");
const details = $("#details");
const login = $("#login");
let state = null;
let page = "activities";
let selectedId = null;
let pending = false;
let authTimer = null;
let noticeTimer = null;
let lastRender = "";
let returnFocus = null;
let lastDetails = "";
const number = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 2 });
const statuses = {
  ready: "Bereit",
  syncing: "Wird übertragen",
  synced: "Synchronisiert",
  duplicate: "Bereits bei Garmin",
  failed: "Übertragung fehlgeschlagen",
  uncertain: "Status prüfen",
};
const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]),
  );
const icon = (name, cls = "") =>
  `<img src="/icons/${name}.svg" alt="" class="${cls}">`;
const date = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Zeitpunkt unbekannt"
    : new Intl.DateTimeFormat("de-AT", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
};
const duration = (seconds) => {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 3600)}:${
    String(Math.floor(s % 3600 / 60)).padStart(2, "0")
  }:${String(s % 60).padStart(2, "0")}`;
};
$("#today").textContent = new Intl.DateTimeFormat("de-AT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());
$("#today").dateTime = new Date().toISOString().slice(0, 10);
async function api(action, params = {}) {
  const response = await fetch(`/api/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-RideRelay": "1" },
    body: JSON.stringify(params),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(
      result.error || "Die Anfrage konnte nicht abgeschlossen werden.",
    );
  }
  return result.data;
}
function notice(message, error = false) {
  clearTimeout(noticeTimer);
  $("#notice").textContent = message;
  $("#notice").classList.toggle("error", error);
  $("#notice").hidden = false;
  if (!error) {
    noticeTimer = setTimeout(() => {
      $("#notice").hidden = true;
    }, 7000);
  }
}
async function refresh() {
  const response = await fetch("/api/state", {
    headers: { "X-RideRelay": "1" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      "RideRelay ist gerade nicht erreichbar. Bitte prüfe, ob die App läuft.",
    );
  }
  state = await response.json();
  $("#autoSync").checked = state.settings.autoSync;
  $("#autoSync").disabled = pending;
  $("#demo").hidden = !state.demo;
  const signature = JSON.stringify([page, state, pending]);
  if (signature !== lastRender) {
    // Do not replace path fields while the user is editing a setting.
    if (
      !(page === "settings" && content.contains(document.activeElement) &&
        document.activeElement.matches('input[type="text"]'))
    ) {
      lastRender = signature;
      render();
    }
  }
  if (details.open && selectedId) renderDetails();
}
async function run(action, params = {}, success = "") {
  if (pending) return;
  pending = true;
  render();
  try {
    const result = await api(action, params);
    if (success) notice(success);
    return result;
  } catch (error) {
    notice(error.message, true);
  } finally {
    pending = false;
    try {
      await refresh();
    } catch (error) {
      notice(error.message, true);
      render();
    }
  }
}
function status(activity) {
  const name = activity.status;
  return `<span class="status ${escape(name)}">${
    icon(
      ["synced", "duplicate"].includes(name)
        ? "check"
        : ["failed", "uncertain"].includes(name)
        ? "alert-circle"
        : "refresh",
    )
  }<span>${escape(statuses[name] || name)}</span></span>`;
}
function metrics(a) {
  return `<div class="metrics">${
    [
      [duration(a.duration), "Dauer"],
      [`${number.format(a.distance / 1000)} km`, "Distanz"],
      [a.avgPower == null ? "—" : `${Math.round(a.avgPower)} W`, "Ø Leistung"],
      [
        a.avgHeartRate == null ? "—" : `${Math.round(a.avgHeartRate)} bpm`,
        "Ø Puls",
      ],
    ].map(([value, label]) =>
      `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`
    ).join("")
  }</div>`;
}
function connection() {
  return `<div class="connection-strip"><div class="platform"><div class="platform-name mywhoosh">MyWhoosh</div><p><span class="dot ${
    state.sourceExists ? "good" : ""
  }"></span>${
    state.sourceExists ? "Ordner gefunden" : "Ordner einrichten"
  }</p></div><div class="bridge">${
    icon("link")
  }</div><div class="platform"><div class="platform-name">GARMIN<small>Connect</small></div><p><span class="dot ${
    state.connected ? "good" : ""
  }"></span>${
    state.connected ? "Verbunden" : "Nicht verbunden"
  }</p></div></div>`;
}
function renderActivities() {
  const activities = [...state.activities].sort((a, b) =>
    new Date(b.startedAt) - new Date(a.startedAt)
  );
  const ready = activities.filter((a) => a.status === "ready");
  const syncing = activities.find((a) => a.status === "syncing");
  const featured = syncing || ready[0];
  const issues =
    activities.filter((a) => ["failed", "uncertain"].includes(a.status)).length;
  const subtitle = ready.length
    ? `${ready.length} ${
      ready.length === 1 ? "Fahrt bereit" : "Fahrten bereit"
    } zum Übertragen`
    : syncing
    ? "Deine Fahrt wird übertragen"
    : !activities.length
    ? "Deine Fahrten. Einfach verbunden."
    : issues
    ? `${issues} ${
      issues === 1 ? "Fahrt benötigt" : "Fahrten benötigen"
    } deine Aufmerksamkeit`
    : "Alles synchronisiert";
  let html =
    `<h1>Aktivitäten</h1><p class="subtitle">${subtitle}</p>${connection()}`;
  if (featured) {
    html += `<section class="featured" aria-label="Aktuelle Fahrt">${
      icon("bike", "ride-icon")
    }<div><h2>${
      syncing ? "Wird mit Garmin synchronisiert" : "Bereit zum Synchronisieren"
    }</h2><h3>${escape(featured.name)}</h3><p>${
      date(featured.startedAt)
    } · Virtuelles Radfahren</p>${
      metrics(featured)
    }<div class="actions"><button class="primary" data-action="sync" data-id="${
      escape(featured.id)
    }" ${pending || !state.connected || syncing ? "disabled" : ""}>${
      syncing ? "Wird übertragen …" : "Jetzt synchronisieren"
    }</button><button class="text-button" data-details="${
      escape(featured.id)
    }">Details ansehen ${icon("arrow-right")}</button>${
      !state.connected
        ? '<button class="text-button" data-login>Garmin verbinden</button>'
        : ""
    }</div></div></section>`;
  } else if (!activities.length) {
    html += `<section class="empty">${
      icon("bike")
    }<h2>Noch keine Fahrten</h2><p>${
      state.sourceExists
        ? "Nach deiner nächsten MyWhoosh-Fahrt erscheint die FIT-Datei hier. Du kannst den Ordner auch jetzt durchsuchen."
        : "Wähle in den Einstellungen deinen MyWhoosh-Ordner. RideRelay findet dort deine FIT-Dateien."
    }</p><button class="${state.sourceExists ? "outline" : "primary"}" ${
      state.sourceExists ? 'data-action="scan"' : 'data-page="settings"'
    } ${pending ? "disabled" : ""}>${
      state.sourceExists ? "Nach Fahrten suchen" : "Ordner einrichten"
    }</button></section>`;
  }
  const history = activities.filter((a) => a.id !== featured?.id);
  html += `<div class="history-heading"><h2>Verlauf${
    history.length ? ` <span class="muted">(${history.length})</span>` : ""
  }</h2><button data-action="scan" ${
    pending || state.scanning ? "disabled" : ""
  } aria-label="Nach neuen Fahrten suchen">${icon("refresh")}${
    state.scanning ? "Suche …" : "Aktualisieren"
  }</button></div><div class="history">`;
  html += history.length
    ? history.map((a) =>
      `<button class="activity-row" data-details="${escape(a.id)}"><span>${
        icon("bike")
      }</span><span class="activity-label"><strong>${
        escape(a.name)
      }</strong><small>${date(a.startedAt)} · ${
        Math.round(a.duration / 60)
      } min</small></span>${status(a)}${icon("chevron-right")}</button>`
    ).join("")
    : '<p class="muted">Übertragene Fahrten und ihr Status erscheinen hier.</p>';
  return html + "</div>";
}
function folder(kind, title, description) {
  const source = kind === "sourceDir";
  return `<section class="settings-section">${
    icon("folder", "section-icon")
  }<div><h2>${title}</h2><p>${description}</p><form data-folder-form="${kind}" class="folder-control"><label class="folder-path" for="${kind}">${
    icon("folder")
  }<input type="text" id="${kind}" name="path" value="${
    escape(state.settings[kind])
  }" placeholder="Ordnerpfad eingeben" aria-label="${title}" required></label><button class="secondary" type="button" data-folder="${kind}" ${
    pending ? "disabled" : ""
  }>Auswählen</button><button class="outline save-path" type="submit" ${
    pending ? "disabled" : ""
  }>Speichern</button></form>${
    source
      ? `<div class="folder-state">${
        icon(state.sourceExists ? "check" : "alert-circle")
      }${
        state.sourceExists
          ? `Ordner gefunden · ${state.activities.length} FIT-${
            state.activities.length === 1 ? "Datei" : "Dateien"
          } erkannt`
          : "Ordner noch nicht gefunden"
      }</div>`
      : ""
  }</div></section>`;
}
function renderSettings() {
  return `<h1>Einstellungen</h1><p class="subtitle">Verbindungen und Speicherorte verwalten.</p><section class="settings-section"><div class="platform-name account-brand">GARMIN<small>Connect</small></div><div class="account"><div class="account-info"><h2>Garmin Connect</h2><div class="connection-state"><span class="dot ${
    state.connected ? "good" : ""
  }"></span>${state.connected ? "Verbunden" : "Nicht verbunden"}</div><p>${
    state.connected
      ? "Dein Garmin-Konto ist bereit."
      : "Verbinde dein Konto, um Fahrten zu übertragen."
  }</p></div>${
    state.connected
      ? `<button class="outline" data-action="checkConnection" ${
        pending ? "disabled" : ""
      }>Verbindung prüfen</button><button data-action="logout" ${
        pending ? "disabled" : ""
      }>Abmelden</button>`
      : '<button class="primary" data-login>Anmelden</button>'
  }</div></section>${
    folder(
      "sourceDir",
      "MyWhoosh-Ordner",
      "Hier sucht RideRelay nach neuen Aktivitäten.",
    )
  }${
    folder(
      "backupDir",
      "Sicherungskopien",
      "Originaldateien werden vor dem Übertragen gesichert.",
    )
  }<section class="settings-section">${
    icon("bell", "section-icon")
  }<div class="notifications"><h2>Benachrichtigungen</h2>${
    [["notifySuccess", "Bei erfolgreichem Sync informieren"], [
      "notifyFailure",
      "Bei Problemen informieren",
    ], ["autoSync", "Automatischer Sync, während RideRelay läuft"]].map((
      [key, label],
    ) =>
      `<label class="toggle-row" for="setting-${key}"><span>${label}</span><input type="checkbox" role="switch" id="setting-${key}" data-setting="${key}" ${
        state.settings[key] ? "checked" : ""
      } ${pending ? "disabled" : ""}></label>`
    ).join("")
  }</div></section>`;
}
function render() {
  if (!state) return;
  content.innerHTML = page === "activities"
    ? renderActivities()
    : renderSettings();
  $("#footnote").textContent = page === "activities"
    ? "Originaldateien bleiben erhalten."
    : "Schalter werden automatisch gespeichert.";
  document.querySelectorAll("nav [data-page]").forEach((button) => {
    if (button.dataset.page === page) {
      button.setAttribute("aria-current", "page");
    } else button.removeAttribute("aria-current");
  });
  $("#autoSync").disabled = pending;
}
function renderDetails() {
  const a = state.activities.find((a) => a.id === selectedId);
  if (!a) {
    details.close();
    return;
  }
  const html =
    `<button class="icon-button close" data-close="details" aria-label="Details schließen">${
      icon("x")
    }</button>${icon("bike", "ride-icon")}<h2 id="detail-title">${
      escape(a.name)
    }</h2><p class="muted">${date(a.startedAt)} · Virtuelles Radfahren</p>${
      status(a)
    }${metrics(a)}${
      a.error ? `<p class="detail-error">${escape(a.error)}</p>` : ""
    }${
      a.status === "uncertain"
        ? '<p class="detail-error">Garmin hat die Übertragung nicht eindeutig bestätigt. Prüfe dein Garmin-Konto, bevor du diese Fahrt erneut überträgst. RideRelay startet keinen automatischen Wiederholungsversuch.</p>'
        : ""
    }<dl class="detail-list"><dt>Ø Kadenz</dt><dd>${
      a.avgCadence == null
        ? "Nicht vorhanden"
        : `${Math.round(a.avgCadence)} rpm`
    }</dd><dt>Originaldatei</dt><dd>${
      escape(a.sourcePath)
    }</dd><dt>Sicherungsdatei</dt><dd>${
      escape(a.backupPath || "Wird vor dem Übertragen erstellt")
    }</dd><dt>Übertragungsversuche</dt><dd>${a.attempts}</dd>${
      a.syncedAt ? `<dt>Synchronisiert</dt><dd>${date(a.syncedAt)}</dd>` : ""
    }${
      a.garminId
        ? `<dt>Garmin-Aktivitäts-ID</dt><dd>${escape(a.garminId)}</dd>`
        : ""
    }</dl><div class="actions">${
      ["ready", "failed"].includes(a.status)
        ? `<button class="primary" data-action="sync" data-id="${
          escape(a.id)
        }" ${pending || !state.connected ? "disabled" : ""}>${
          a.status === "failed" ? "Erneut versuchen" : "Jetzt synchronisieren"
        }</button>`
        : ""
    }${
      a.backupPath
        ? `<button class="outline" data-action="openBackup" data-id="${
          escape(a.id)
        }">Sicherung öffnen</button>`
        : ""
    }${
      a.garminId
        ? `<button class="outline" data-action="openGarmin" data-id="${
          escape(a.id)
        }">In Garmin öffnen ${icon("arrow-right")}</button>`
        : ""
    }</div>`;
  if (lastDetails !== html) {
    details.innerHTML = html;
    lastDetails = html;
  }
}
function openDialog(dialog) {
  returnFocus = document.activeElement;
  dialog.showModal();
}
function openLogin() {
  $("#login-form").hidden = false;
  $("#mfa-form").hidden = true;
  $("#login-status").textContent = "";
  $("#login-form button").disabled = false;
  $("#password").value = "";
  $("#mfa-code").value = "";
  openDialog(login);
}
document.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.page) {
    page = button.dataset.page;
    lastRender = "";
    render();
    $("#main").focus();
  } else if (button.hasAttribute("data-login")) openLogin();
  else if (button.dataset.details) {
    selectedId = button.dataset.details;
    renderDetails();
    openDialog(details);
  } else if (button.dataset.close) $("#" + button.dataset.close).close();
  else if (button.dataset.folder) {
    const kind = button.dataset.folder;
    const result = await run("pickFolder", { kind });
    if (result?.path) {
      await run(
        "settings",
        { settings: { [kind]: result.path } },
        "Ordner gespeichert.",
      );
    }
  } else if (button.dataset.action) {
    const action = button.dataset.action;
    const message = action === "checkConnection"
      ? "Die Verbindung zu Garmin funktioniert."
      : action === "logout"
      ? "Von Garmin abgemeldet."
      : action === "scan"
      ? "Ordner durchsucht."
      : "";
    await run(
      action,
      button.dataset.id ? { id: button.dataset.id } : {},
      message,
    );
  }
});
document.addEventListener("change", async (event) => {
  const key = event.target.id === "autoSync"
    ? "autoSync"
    : event.target.dataset.setting;
  if (key) {
    await run(
      "settings",
      { settings: { [key]: event.target.checked } },
      "Einstellung gespeichert.",
    );
  }
});
document.addEventListener("submit", async (event) => {
  if (!event.target.dataset.folderForm) return;
  event.preventDefault();
  const kind = event.target.dataset.folderForm;
  const path = new FormData(event.target).get("path").trim();
  if (path) {
    await run(
      "settings",
      { settings: { [kind]: path } },
      "Ordner gespeichert.",
    );
  }
});
for (const dialog of [details, login]) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left || event.clientX > r.right ||
        event.clientY < r.top || event.clientY > r.bottom
      ) dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    if (dialog === login) {
      clearTimeout(authTimer);
      $("#password").value = "";
      $("#mfa-code").value = "";
    }
    returnFocus?.focus();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const items = [
      ...dialog.querySelectorAll(
        "button:not(:disabled),input:not(:disabled),a[href]",
      ),
    ].filter((e) => e.getClientRects().length);
    if (!items.length) return;
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
async function pollAuth() {
  if (!login.open) return;
  try {
    const result = await api("authStatus");
    if (result.status === "passed") {
      login.close();
      notice("Mit Garmin verbunden.");
      await refresh();
      return;
    }
    if (result.status === "failed") {
      throw new Error(result.error || "Anmeldung fehlgeschlagen.");
    }
    if (result.status === "mfa") {
      const newlyVisible = $("#mfa-form").hidden;
      $("#login-form").hidden = true;
      $("#mfa-form").hidden = false;
      $("#mfa-form button").disabled = false;
      $("#login-status").textContent = "Bestätigung durch Garmin erforderlich.";
      if (newlyVisible) $("#mfa-code").focus();
    }
    authTimer = setTimeout(pollAuth, 1000);
  } catch (error) {
    $("#login-status").textContent = error.message;
    $("#login-form").hidden = false;
    $("#mfa-form").hidden = true;
    $("#login-form button").disabled = false;
  }
}
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearTimeout(authTimer);
  $("#login-form button").disabled = true;
  $("#login-status").textContent = "Anmeldung läuft …";
  const email = $("#email").value.trim(), password = $("#password").value;
  $("#password").value = "";
  try {
    await api("login", { email, password });
    await pollAuth();
  } catch (error) {
    $("#login-status").textContent = error.message;
    $("#login-form button").disabled = false;
  }
});
$("#mfa-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearTimeout(authTimer);
  $("#mfa-form button").disabled = true;
  $("#login-status").textContent = "Code wird geprüft …";
  const code = $("#mfa-code").value.trim();
  $("#mfa-code").value = "";
  try {
    await api("mfa", { code });
    await pollAuth();
  } catch (error) {
    $("#login-status").textContent = error.message;
    $("#mfa-form button").disabled = false;
  }
});
await refresh().catch((error) => notice(error.message, true));
setInterval(
  () => refresh().catch((error) => notice(error.message, true)),
  3000,
);
