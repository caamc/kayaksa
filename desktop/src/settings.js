// Settings screen. Every control saves as soon as it changes; settings fixed by the organisation's
// policy file are shown but cannot be changed.
const $ = (s, el = document) => el.querySelector(s);
const ui = window.kayakUi || mockUi();
const isMac = ui.platform === "darwin";
let S = null;

const ICON = {
  general: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  meetings: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/>',
  notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  shortcuts: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  network: '<path d="M5 12.6a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0M12 20h.01"/>',
  privacy: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  updates: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  about: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
};

const SECTIONS = [
  { id: "general", title: "General", lede: "How Meet by Kayak starts and looks.", groups: [
    { title: "Start-up", rows: [
      ["openAtLogin", "switch", "Open when I sign in to my computer", "Be reachable for calls as soon as your day starts."],
      ["startInBackground", "switch", "Start in the background", isMac ? "Opens to the menu bar without showing a window." : "Opens to the system tray without showing a window."],
      ["closeToTray", "switch", isMac ? "Keep running in the menu bar when I close the window" : "Keep running in the system tray when I close the window", "You still get messages and meeting reminders."],
    ] },
    { title: "Appearance", rows: [
      ["theme", "seg", "Theme", null, [["system", "Match system"], ["light", "Light"], ["dark", "Dark"]]],
      ["spellcheck", "switch", "Check spelling as I type", null],
    ] },
  ] },
  { id: "meetings", title: "Meetings", lede: "Defaults for every meeting you join. You can still change them on the join screen.", groups: [
    { title: "Joining", rows: [
      ["joinMuted", "switch", "Join with my microphone muted", null],
      ["joinCameraOff", "switch", "Join with my camera off", null],
      ["confirmLeave", "switch", "Ask before closing the window during a meeting", null],
    ] },
    { title: "While sharing", rows: [
      ["miniOnShare", "switch", "Shrink to a mini window when I share my screen", "The mini window floats in a corner with your controls and is hidden from what you share."],
      ["alwaysOnTopInMeeting", "switch", "Keep the mini window above other apps", null],
    ] },
  ] },
  { id: "notifications", title: "Notifications", lede: "What reaches you, and when.", groups: [
    { title: "Alerts", rows: [
      ["notifications", "switch", "Show notifications for messages and mentions", null],
      ["notificationSound", "switch", "Play a sound", null],
      ["quietDuringMeetings", "switch", "Hold chat notifications while I am in a meeting", "Meeting invitations and the host's messages still come through."],
      ["meetingReminderMinutes", "select", "Remind me before meetings", null, [[0, "Off"], [1, "1 minute before"], [5, "5 minutes before"], [10, "10 minutes before"], [15, "15 minutes before"]]],
    ] },
  ] },
  { id: "shortcuts", title: "Shortcuts", lede: "Keyboard shortcuts for meetings. Global shortcuts work even when Meet by Kayak is in the background.", groups: [
    { title: "Global", rows: [["globalShortcuts", "switch", "Turn on global shortcuts", "Mute yourself from any app."]] },
    { title: "Meeting controls", rows: [
      ["shortcuts.toggleMute", "keys", "Mute and unmute"],
      ["shortcuts.toggleCamera", "keys", "Camera on and off"],
      ["shortcuts.raiseHand", "keys", "Raise and lower hand"],
      ["shortcuts.shareScreen", "keys", "Share screen"],
      ["shortcuts.showApp", "keys", "Bring Meet by Kayak to the front"],
    ] },
  ] },
  { id: "network", title: "Network and performance", lede: "For office networks, slow connections and older computers.", groups: [
    { title: "Connection", rows: [
      ["proxy", "seg", "Proxy", "Most people should keep the system setting.", [["system", "System"], ["direct", "No proxy"], ["manual", "Manual"]]],
      ["proxyRules", "text", "Proxy server", "For example proxy.example.com:8080. Used when Proxy is Manual.", "host:port"],
      ["dataSaver", "switch", "Data saver", "Sends and receives lower-resolution video. Audio stays clear."],
    ] },
    { title: "Graphics", rows: [["hardwareAcceleration", "switch", "Use hardware acceleration", "Turn off if video flickers or the app is slow. Needs a restart."]] },
  ] },
  { id: "privacy", title: "Privacy and data", lede: "Meet by Kayak keeps very little on this computer: your settings, your sign-in, and a cache of recent messages and files.", custom: privacyPanel },
  { id: "updates", title: "Updates", lede: "Updates come from Kayak's own server, are signed by Kayak, and never install during a meeting.", groups: [
    { title: "Automatic updates", rows: [
      ["autoUpdate", "switch", "Download and install updates automatically", null],
      ["updateChannel", "seg", "Channel", "Beta gets new features about two weeks early.", [["latest", "Stable"], ["beta", "Beta"]]],
    ] },
  ], after: () => `<div class="group"><div class="actions"><button class="btn primary" id="chk">Check for updates now</button></div></div>` },
  { id: "about", title: "About", lede: "", custom: aboutPanel },
];

function get(key) { return key.split(".").reduce((o, k) => (o ? o[k] : undefined), S.values); }
function locked(key) { return S.locked.includes(key.split(".")[0]); }
async function set(key, value) {
  const [k, sub] = key.split(".");
  const patch = sub ? { [k]: { [sub]: value } } : { [k]: value };
  S.values = await ui.settings.set(patch) || S.values;
  toast("Saved");
}

function control(row) {
  const [key, type, label, help, opts] = row;
  const v = get(key), dis = locked(key) ? "disabled" : "";
  const lock = locked(key) ? `<span class="lock">Set by your organisation</span>` : "";
  const id = "c-" + key.replace(/\W/g, "-");
  let ctl = "";
  if (type === "switch") ctl = `<span class="switch"><input type="checkbox" role="switch" id="${id}" data-k="${key}" ${v ? "checked" : ""} ${dis} aria-label="${esc(label)}"></span>`;
  else if (type === "seg") ctl = `<span class="seg" role="group" aria-label="${esc(label)}">${opts.map(([val, t]) => `<button data-k="${key}" data-v="${val}" aria-pressed="${v === val}" ${dis}>${t}</button>`).join("")}</span>`;
  else if (type === "select") ctl = `<select id="${id}" data-k="${key}" ${dis}>${opts.map(([val, t]) => `<option value="${val}" ${v === val ? "selected" : ""}>${t}</option>`).join("")}</select>`;
  else if (type === "text") ctl = `<input type="text" id="${id}" data-k="${key}" value="${esc(v || "")}" placeholder="${esc(opts || "")}" ${dis} spellcheck="false">`;
  else if (type === "keys") ctl = `<span class="keys" data-keys="${key}">${keycaps(v)}<button class="btn" data-rec="${key}" ${dis}>Change</button><button class="btn" data-clear="${key}" ${dis} aria-label="Remove shortcut">✕</button></span>`;
  return `<div class="row"><label for="${id}"><b>${label}</b>${help ? `<small>${help}</small>` : ""}${lock}</label>${ctl}</div>`;
}
function keycaps(acc) {
  if (!acc) return `<small style="color:var(--muted)">None</small>`;
  const map = { CommandOrControl: isMac ? "⌘" : "Ctrl", Command: "⌘", Control: isMac ? "⌃" : "Ctrl", Shift: isMac ? "⇧" : "Shift", Alt: isMac ? "⌥" : "Alt", Option: "⌥", Super: "Win" };
  return acc.split("+").map((k) => `<kbd>${map[k] || k}</kbd>`).join("");
}

function render(id) {
  const sec = SECTIONS.find((s) => s.id === id) || SECTIONS[0];
  $("#nav").querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", b.dataset.s === sec.id ? "page" : "false"));
  const banner = S.locked.length ? `<div class="hint">Some settings are managed by your organisation and cannot be changed here.</div>` : "";
  $("#main").innerHTML = `<h1>${sec.title}</h1><p class="lede">${sec.lede}</p>${sec.id === "general" ? banner : ""}` +
    (sec.custom ? sec.custom() : sec.groups.map((g) => `<section class="group"><h2>${g.title}</h2>${g.rows.map(control).join("")}</section>`).join("")) +
    (sec.after ? sec.after() : "");
  wire(sec);
  try { localStorage.setItem("km:settings:last", sec.id); } catch {}
}
function wire(sec) {
  const m = $("#main");
  m.querySelectorAll("input[type=checkbox][data-k]").forEach((el) => (el.onchange = () => set(el.dataset.k, el.checked)));
  m.querySelectorAll(".seg button[data-k]").forEach((el) => (el.onclick = async () => { await set(el.dataset.k, el.dataset.v); render(sec.id); }));
  m.querySelectorAll("select[data-k]").forEach((el) => (el.onchange = () => set(el.dataset.k, Number(el.value))));
  m.querySelectorAll("input[type=text][data-k]").forEach((el) => (el.onchange = () => set(el.dataset.k, el.value.trim())));
  m.querySelectorAll("[data-clear]").forEach((el) => (el.onclick = async () => { await set(el.dataset.clear, ""); render(sec.id); }));
  m.querySelectorAll("[data-rec]").forEach((el) => (el.onclick = () => record(el.dataset.rec, el.closest(".keys"), sec.id)));
  $("#chk") && ($("#chk").onclick = () => ui.checkUpdates());
  $("#clear") && ($("#clear").onclick = async () => { await ui.settings.clearCache(); toast("Cache cleared"); });
  $("#signout") && ($("#signout").onclick = () => ui.settings.signOut());
  $("#reset") && ($("#reset").onclick = async () => { S.values = await ui.settings.reset(); toast("Settings reset"); render(sec.id); });
  m.querySelectorAll("[data-href]").forEach((el) => (el.onclick = (e) => { e.preventDefault(); ui.open(el.dataset.href); }));
}
function record(key, box, sec) {
  box.classList.add("rec");
  box.innerHTML = `<small style="color:var(--saf);font-weight:700">Press the keys…</small><button class="btn" id="cancel">Cancel</button>`;
  const stop = () => { window.removeEventListener("keydown", onKey, true); render(sec); };
  const onKey = async (e) => {
    e.preventDefault();
    if (e.key === "Escape") return stop();
    if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
    const mods = [];
    if (e.metaKey || e.ctrlKey) mods.push("CommandOrControl");
    if (e.altKey) mods.push("Alt");
    if (e.shiftKey) mods.push("Shift");
    if (!mods.length) return toast("Use at least one of " + (isMac ? "⌘, ⌥ or ⌃" : "Ctrl or Alt"));
    const k = e.code.startsWith("Key") ? e.code.slice(3) : e.code.startsWith("Digit") ? e.code.slice(5) : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    const acc = [...mods, k].join("+");
    const clash = Object.entries(S.values.shortcuts).find(([n, a]) => a === acc && `shortcuts.${n}` !== key);
    if (clash) return toast("That shortcut is already used here.");
    window.removeEventListener("keydown", onKey, true);
    await set(key, acc);
    render(sec);
  };
  window.addEventListener("keydown", onKey, true);
  $("#cancel").onclick = stop;
}
function privacyPanel() {
  return `<section class="group"><h2>On this computer</h2>
    <div class="row"><div><b>Clear cached files and images</b><small>Messages and files reload from Kayak's servers next time you open them.</small></div><button class="btn" id="clear">Clear cache</button></div>
    <div class="row"><div><b>Sign out and remove everything</b><small>Signs you out and deletes your cached data from this computer. Your settings stay.</small></div><button class="btn danger" id="signout" ${S.values.allowSignOut === false ? "disabled" : ""}>Sign out</button></div>
    <div class="row"><div><b>Reset settings</b><small>Puts every setting back to how it was when you installed the app.</small></div><button class="btn" id="reset">Reset</button></div></section>
    <section class="group"><h2>What the app does not do</h2>
    <div class="row"><div><b>No tracking, no advertising, no crash uploads</b><small>The desktop app sends nothing to anyone except Kayak's own server, and only what you do in Meet by Kayak. Camera, microphone and screen access are used only in meetings you join, and only for Kayak's own site.</small></div><span></span></div>
    <div class="row"><div><b>Your rights</b><small>You can ask Kayak for a copy of your data, to correct it, or to erase it, under India's Digital Personal Data Protection Act, 2023 and, where it applies, the GDPR.</small></div><a class="btn" href="#" data-href="https://www.kayaksa.com/legal#privacy">Privacy notice</a></div></section>`;
}
function aboutPanel() {
  return `<section class="group"><div class="about"><img src="MeetByKayak_Mark_Reversed.svg" alt="" style="background:var(--deep);border-radius:18px;padding:10px"><div><b style="font-size:18px">Meet by Kayak</b><small style="display:block;color:var(--muted)">Version ${esc(S.version)} · ${isMac ? "macOS" : ui.platform === "win32" ? "Windows" : ui.platform}</small><small style="display:block;color:var(--muted)">Server: ${esc(S.server)}</small></div></div>
    <div class="actions"><button class="btn" data-href="https://meet.kayaksa.com">Website</button><button class="btn" data-href="https://www.kayaksa.com/legal">Terms and privacy</button><button class="btn" data-href="https://meet.kayaksa.com/#help">Get help</button></div></section>
    <p class="lede" style="font-size:12px">© Kayak Strategic Advisors Private Limited. Built on Electron and Chromium (open-source software; licences are included with the app). Archivo typeface under the SIL Open Font Licence.</p>`;
}

let tt;
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(tt); tt = setTimeout(() => (el.hidden = true), 1400); }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

(async () => {
  S = await ui.settings.get();
  $("#ver").textContent = `Version ${S.version}`;
  $("#nav").innerHTML = SECTIONS.map((s) => `<button data-s="${s.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[s.id]}</svg>${s.title}</button>`).join("");
  $("#nav").onclick = (e) => { const b = e.target.closest("button"); if (b) { render(b.dataset.s); $("#main").focus(); } };
  let last = "general"; try { last = localStorage.getItem("km:settings:last") || last; } catch {}
  render(last);
})();

// For previewing the screen in a normal browser while designing it.
function mockUi() {
  let values = { openAtLogin: false, startInBackground: false, closeToTray: true, theme: "system", spellcheck: true, joinMuted: true, joinCameraOff: false, confirmLeave: true, miniOnShare: true, alwaysOnTopInMeeting: true, notifications: true, notificationSound: true, quietDuringMeetings: true, meetingReminderMinutes: 5, globalShortcuts: true, shortcuts: { toggleMute: "CommandOrControl+Shift+M", toggleCamera: "CommandOrControl+Shift+O", raiseHand: "CommandOrControl+Shift+K", shareScreen: "CommandOrControl+Shift+E", showApp: "CommandOrControl+Shift+J" }, proxy: "system", proxyRules: "", dataSaver: false, hardwareAcceleration: true, autoUpdate: true, updateChannel: "latest" };
  return { platform: new URLSearchParams(location.search).get("p") || "win32", settings: { get: async () => ({ values, locked: ["updateChannel"], version: "1.0.0", server: "https://meet.kayaksa.com" }), set: async (p) => (values = { ...values, ...p, shortcuts: { ...values.shortcuts, ...(p.shortcuts || {}) } }), reset: async () => values, clearCache: async () => true, signOut: async () => {} }, checkUpdates: async () => {}, open: () => {} };
}
