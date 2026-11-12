// Meet by Kayak - desktop app for Windows and macOS.
// A hardened shell around meet.kayaksa.com that adds what a browser tab cannot: a tray / menu-bar
// presence, global mute and camera shortcuts, a native screen-share picker, a floating mini window
// that stays out of what you share, taskbar meeting controls on Windows, unread badges, deep links
// (kayakmeet://), start at login, proxy and performance settings, IT policy, and signed auto-updates
// from Kayak's own server.
//
// Security model: the remote site runs sandboxed with context isolation and no Node.js; it reaches
// the app only through the small, typed bridge in preload.js, and only from Kayak's own origin.
// Every other link opens in the person's browser. Camera, microphone and screen access are granted
// to Kayak's origin only.
const { app, BrowserWindow, Menu, Tray, ipcMain, shell, session, nativeTheme, nativeImage, globalShortcut,
  desktopCapturer, systemPreferences, powerSaveBlocker, dialog, screen, Notification } = require("electron");
const path = require("path");
const { Store } = require("./store");

const store = new Store();
const ORIGIN = String(store.policy.server || process.env.KAYAK_MEET_URL || "https://meet.kayaksa.com").replace(/\/+$/, "");
const SSO_ORIGINS = ["https://internal.kayaksa.com"]; // employees sign in through Kayak Internal's two-factor login
const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";
const asset = (f) => path.join(__dirname, f);

if (!store.get("hardwareAcceleration")) app.disableHardwareAcceleration();
app.setAppUserModelId("com.kayaksa.meet"); // Windows notifications and taskbar grouping
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.setAsDefaultProtocolClient("kayakmeet");

let win = null, tray = null, quitting = false, normalBounds = null, blocker = null;
const meeting = { inMeeting: false, muted: false, camera: true, sharing: false, hand: false, title: "" };
let pendingUrl = null;

// ----------------------------------------------------------------------------- URLs and deep links
function originOf(u) { try { return new URL(u).origin; } catch { return ""; } }
const isKayak = (u) => originOf(u) === originOf(ORIGIN);
const inApp = (u) => isKayak(u) || SSO_ORIGINS.includes(originOf(u));
function openExternal(u) {
  try { const p = new URL(u).protocol; if (p === "https:" || p === "http:" || p === "mailto:") shell.openExternal(u); } catch {}
}
/** kayakmeet://join/abc-defg-hij?t=…  ·  kayakmeet://app  ·  https://meet.kayaksa.com/… */
function routeFor(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol === "kayakmeet:") {
      const parts = (u.host + u.pathname).split("/").filter(Boolean);
      if (parts[0] === "join" && /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/.test(parts[1] || "")) return `${ORIGIN}/${parts[1]}${u.search}`;
      if (parts[0] === "new") return `${ORIGIN}/app#new`;
      return `${ORIGIN}/app`;
    }
    if (isKayak(raw)) return raw;
  } catch {}
  return null;
}
function openRoute(raw) {
  const target = routeFor(raw);
  if (!target) return;
  if (!win) { pendingUrl = target; return; }
  win.loadURL(target);
  showWindow();
}
app.on("open-url", (e, url) => { e.preventDefault(); openRoute(url); }); // macOS
app.on("second-instance", (_e, argv) => { const u = argv.find((a) => a.startsWith("kayakmeet:") || a.startsWith(ORIGIN)); if (u) openRoute(u); else showWindow(); });

// ----------------------------------------------------------------------------- main window
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(1360, width), height: Math.min(860, height), minWidth: 380, minHeight: 300,
    title: "Meet by Kayak", backgroundColor: "#0E2F3C", show: false, icon: asset("../build/icon.png"),
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    trafficLightPosition: { x: 14, y: 14 },
    titleBarOverlay: isMac ? false : { color: "#0E2F3C", symbolColor: "#FFFFFF", height: 36 },
    webPreferences: {
      preload: asset("preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false,
      webSecurity: true, spellcheck: store.get("spellcheck"), partition: "persist:kayakmeet", backgroundThrottling: false,
    },
  });
  const wc = win.webContents;
  wc.setUserAgent(`${wc.getUserAgent().replace(/Electron\/\S+\s?/, "")} KayakMeetDesktop/${app.getVersion()}`);
  wc.setWindowOpenHandler(({ url }) => { if (inApp(url)) { win.loadURL(url); } else openExternal(url); return { action: "deny" }; });
  wc.on("will-navigate", (e, url) => { if (!inApp(url) && !url.startsWith("file://")) { e.preventDefault(); openExternal(url); } });
  wc.on("will-redirect", (e, url) => { if (!inApp(url)) { e.preventDefault(); openExternal(url); } });
  wc.on("did-fail-load", (_e, code, _desc, url, isMain) => { if (isMain && code !== -3 && !url.startsWith("file://")) win.loadFile(asset("offline.html"), { query: { back: url } }); });
  wc.on("render-process-gone", () => win.loadFile(asset("offline.html"), { query: { back: `${ORIGIN}/app`, crashed: "1" } }));
  win.once("ready-to-show", () => { if (!(store.get("startInBackground") && process.argv.includes("--hidden"))) win.show(); });
  win.on("close", (e) => {
    if (quitting) return;
    if (meeting.inMeeting && store.get("confirmLeave")) {
      const r = dialog.showMessageBoxSync(win, { type: "question", buttons: ["Leave meeting", "Stay"], defaultId: 1, cancelId: 1, message: "You are in a meeting.", detail: "Closing the window will take you out of the meeting." });
      if (r === 1) { e.preventDefault(); return; }
    }
    if (store.get("closeToTray") && tray && !meeting.inMeeting) { e.preventDefault(); win.hide(); if (isMac) app.dock?.hide?.(); }
  });
  win.on("focus", () => setBadge(null));
  win.loadURL(pendingUrl || routeFor(process.argv.find((a) => a.startsWith("kayakmeet:"))) || `${ORIGIN}/app`);
  pendingUrl = null;
}
function showWindow() {
  if (!win) return createWindow();
  if (isMac) app.dock?.show?.();
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}

// ----------------------------------------------------------------------------- permissions
function hardenSession() {
  const s = session.fromPartition("persist:kayakmeet");
  const ok = new Set(["media", "display-capture", "notifications", "fullscreen", "clipboard-sanitized-write", "speaker-selection"]);
  s.setPermissionRequestHandler(async (wc, permission, cb, details) => {
    const from = details.requestingUrl || wc.getURL();
    if (!isKayak(from) || !ok.has(permission)) return cb(false);
    if (permission === "media" && isMac) {
      const types = details.mediaTypes || [];
      if (types.includes("video") && !(await systemPreferences.askForMediaAccess("camera"))) return cb(false);
      if (types.includes("audio") && !(await systemPreferences.askForMediaAccess("microphone"))) return cb(false);
    }
    cb(true);
  });
  s.setPermissionCheckHandler((_wc, permission, origin) => isKayak(origin) && ok.has(permission));
  s.setDevicePermissionHandler(() => false); // no USB, serial or HID access for web content
  // Screen sharing: the operating system's own picker on macOS 15+, Kayak's picker everywhere else.
  s.setDisplayMediaRequestHandler((req, cb) => {
    if (!isKayak(req.securityOrigin || req.frame?.url || "")) return cb({});
    pickSource().then((choice) => {
      if (!choice) return cb({});
      desktopCapturer.getSources({ types: ["screen", "window"] }).then((list) => {
        const src = list.find((s) => s.id === choice.id);
        if (!src) return cb({});
        cb({ video: src, audio: choice.audio && isWin ? "loopback" : undefined });
        if (store.get("miniOnShare")) setMini(true);
      });
    });
  }, { useSystemPicker: true });
  applyProxy(s);
  s.setSpellCheckerEnabled(store.get("spellcheck"));
  // Kayak's servers only: refuse bad certificates outright.
  app.on("certificate-error", (e, _wc, _url, _err, _cert, cb) => { e.preventDefault(); cb(false); });
}
function applyProxy(s = session.fromPartition("persist:kayakmeet")) {
  const mode = store.get("proxy");
  if (mode === "manual" && store.get("proxyRules")) s.setProxy({ mode: "fixed_servers", proxyRules: store.get("proxyRules") });
  else s.setProxy({ mode: mode === "direct" ? "direct" : "system" });
}

// ----------------------------------------------------------------------------- screen-share picker
let picker = null;
function pickSource() {
  return new Promise((resolve) => {
    if (picker) { picker.focus(); return resolve(null); }
    picker = new BrowserWindow({
      parent: win, modal: true, width: 760, height: 560, resizable: false, minimizable: false, maximizable: false, show: false,
      title: "Share your screen", backgroundColor: "#0B2530", titleBarStyle: isMac ? "hiddenInset" : "default", autoHideMenuBar: true,
      webPreferences: { preload: asset("ui-preload.js"), contextIsolation: true, sandbox: true },
    });
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(v); picker?.close(); };
    ipcMain.handleOnce("km:pick", (_e, v) => { finish(v && typeof v.id === "string" ? { id: v.id, audio: !!v.audio } : null); return true; });
    picker.on("closed", () => { ipcMain.removeHandler("km:pick"); picker = null; finish(null); });
    picker.loadFile(asset("picker.html"));
    picker.once("ready-to-show", () => picker.show());
  });
}
ipcMain.handle("km:sources", async (e) => {
  if (!fromLocal(e)) return [];
  const list = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 320, height: 200 }, fetchWindowIcons: true });
  return list
    .filter((s) => !s.name.startsWith("Meet by Kayak"))
    .map((s) => ({ id: s.id, name: s.name, kind: s.id.startsWith("screen") ? "screen" : "window", thumb: s.thumbnail.toDataURL(), icon: s.appIcon ? s.appIcon.toDataURL() : null }));
});
ipcMain.handle("km:platform", () => ({ platform: process.platform, version: app.getVersion() }));

// ----------------------------------------------------------------------------- mini window
function setMini(on) {
  if (!win) return;
  if (on && !normalBounds) {
    normalBounds = win.getBounds();
    const wa = screen.getDisplayMatching(normalBounds).workArea;
    win.setMinimumSize(300, 190);
    win.setBounds({ x: wa.x + wa.width - 380, y: wa.y + wa.height - 260, width: 360, height: 230 }, true);
    win.setAlwaysOnTop(true, "floating");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setContentProtection(true); // the mini window never appears in what you share
  } else if (!on && normalBounds) {
    win.setAlwaysOnTop(false);
    win.setVisibleOnAllWorkspaces(false);
    win.setContentProtection(false);
    win.setMinimumSize(380, 300);
    win.setBounds(normalBounds, true);
    normalBounds = null;
  }
  send("mini", !!normalBounds);
  buildMenus();
}

// ----------------------------------------------------------------------------- commands to the page
function send(cmd, arg) { win?.webContents.send("km:command", { cmd, arg }); }
const COMMANDS = {
  toggleMute: () => send("toggleMute"),
  toggleCamera: () => send("toggleCamera"),
  raiseHand: () => send("raiseHand"),
  shareScreen: () => send("shareScreen"),
  showApp: () => showWindow(),
};
function registerShortcuts() {
  globalShortcut.unregisterAll();
  if (!store.get("globalShortcuts")) return;
  const failed = [];
  for (const [name, acc] of Object.entries(store.get("shortcuts"))) {
    if (!acc || !COMMANDS[name]) continue;
    try { if (!globalShortcut.register(acc, COMMANDS[name])) failed.push(acc); } catch { failed.push(acc); }
  }
  if (failed.length) send("toast", `These shortcuts are used by another app and were not set: ${failed.join(", ")}. Change them in Settings.`);
}

// ----------------------------------------------------------------------------- badge, tray, taskbar
let unread = 0;
function setBadge(n) {
  if (n !== null) unread = Math.max(0, Math.min(999, n | 0));
  if (n === null && win?.isFocused()) {/* keep count; the page clears it when read */}
  app.setBadgeCount?.(unread);
  if (isWin && win) win.setOverlayIcon(unread ? badgeIcon(unread) : null, unread ? `${unread} unread` : "");
  tray?.setToolTip(unread ? `Meet by Kayak · ${unread} unread` : "Meet by Kayak");
}
function badgeIcon(n) {
  // A saffron dot with the count, drawn as an SVG data URL and rasterised by Chromium.
  const t = n > 9 ? "9+" : String(n);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="15" fill="#EE9B1E"/><text x="16" y="21.5" font-family="Segoe UI,Arial" font-weight="700" font-size="${t.length > 1 ? 14 : 17}" text-anchor="middle" fill="#0E2F3C">${t}</text></svg>`;
  return nativeImage.createFromDataURL("data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"));
}
function thumbar() {
  if (!isWin || !win) return;
  if (!meeting.inMeeting) return win.setThumbarButtons([]);
  const i = (f) => nativeImage.createFromPath(asset(`icons/${f}.png`));
  win.setThumbarButtons([
    { tooltip: meeting.muted ? "Unmute" : "Mute", icon: i(meeting.muted ? "mic-off" : "mic"), click: COMMANDS.toggleMute },
    { tooltip: meeting.camera ? "Turn camera off" : "Turn camera on", icon: i(meeting.camera ? "cam" : "cam-off"), click: COMMANDS.toggleCamera },
    { tooltip: meeting.sharing ? "Stop sharing" : "Share screen", icon: i("share"), click: COMMANDS.shareScreen },
    { tooltip: "Leave meeting", icon: i("leave"), click: () => send("leave") },
  ]);
}
function createTray() {
  const img = isMac ? nativeImage.createFromPath(asset("trayTemplate.png")) : nativeImage.createFromPath(asset("tray-16.png"));
  if (isMac) img.setTemplateImage(true);
  tray = new Tray(img);
  tray.setToolTip("Meet by Kayak");
  tray.on("click", () => (isMac ? tray.popUpContextMenu() : showWindow()));
}

// ----------------------------------------------------------------------------- menus
function buildMenus() {
  const m = meeting.inMeeting;
  const sc = store.get("shortcuts");
  const meetingItems = [
    { label: meeting.muted ? "Unmute" : "Mute", accelerator: sc.toggleMute, enabled: m, click: COMMANDS.toggleMute },
    { label: meeting.camera ? "Turn camera off" : "Turn camera on", accelerator: sc.toggleCamera, enabled: m, click: COMMANDS.toggleCamera },
    { label: meeting.hand ? "Lower hand" : "Raise hand", accelerator: sc.raiseHand, enabled: m, click: COMMANDS.raiseHand },
    { label: meeting.sharing ? "Stop sharing" : "Share screen…", accelerator: sc.shareScreen, enabled: m, click: COMMANDS.shareScreen },
    { label: normalBounds ? "Leave mini window" : "Mini window", enabled: m, click: () => setMini(!normalBounds) },
    { type: "separator" },
    { label: "Leave meeting", enabled: m, click: () => send("leave") },
  ];
  const template = [
    ...(isMac ? [{ role: "appMenu", submenu: [{ role: "about" }, { label: "Check for updates…", click: () => checkUpdates(true) }, { type: "separator" }, { label: "Settings…", accelerator: "Cmd+,", click: openSettings }, { type: "separator" }, { role: "services" }, { type: "separator" }, { role: "hide" }, { role: "hideOthers" }, { role: "unhide" }, { type: "separator" }, { role: "quit" }] }] : []),
    { label: "File", submenu: [
      { label: "New meeting", accelerator: "CmdOrCtrl+Shift+N", click: () => { showWindow(); win.loadURL(`${ORIGIN}/app#new`); } },
      { label: "Join with a code…", accelerator: "CmdOrCtrl+Shift+J", click: () => { showWindow(); win.loadURL(`${ORIGIN}/app#join`); } },
      { label: "Workspace", accelerator: "CmdOrCtrl+1", click: () => { showWindow(); win.loadURL(`${ORIGIN}/app`); } },
      { type: "separator" },
      ...(isMac ? [] : [{ label: "Settings", accelerator: "Ctrl+,", click: openSettings }, { type: "separator" }]),
      { label: "Sign out", enabled: store.get("allowSignOut") !== false, click: signOut },
      ...(isMac ? [{ role: "close" }] : [{ role: "quit", label: "Quit Meet by Kayak" }]),
    ] },
    { role: "editMenu" },
    { label: "View", submenu: [{ role: "reload" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }] },
    { label: "Meeting", submenu: meetingItems },
    { role: "windowMenu" },
    { role: "help", submenu: [
      { label: "Meet by Kayak website", click: () => openExternal(ORIGIN) },
      { label: "Privacy notice", click: () => openExternal("https://www.kayaksa.com/legal#privacy") },
      { label: "Get help", click: () => openExternal(`${ORIGIN}/#help`) },
      ...(isMac ? [] : [{ type: "separator" }, { label: "Check for updates…", click: () => checkUpdates(true) }, { label: `About (version ${app.getVersion()})`, click: about }]),
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Meet by Kayak", click: showWindow },
    { label: "New meeting", click: () => { showWindow(); win.loadURL(`${ORIGIN}/app#new`); } },
    { label: "Join with a code…", click: () => { showWindow(); win.loadURL(`${ORIGIN}/app#join`); } },
    ...(m ? [{ type: "separator" }, { label: meeting.title ? `In: ${meeting.title}` : "In a meeting", enabled: false }, ...meetingItems] : []),
    { type: "separator" },
    { label: "Settings…", click: openSettings },
    { label: "Quit", click: () => { quitting = true; app.quit(); } },
  ]));
  thumbar();
}
function about() {
  dialog.showMessageBox(win, { type: "info", icon: nativeImage.createFromPath(asset("../build/icon.png")), title: "About Meet by Kayak", message: `Meet by Kayak ${app.getVersion()}`, detail: `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}\n© Kayak Strategic Advisors Private Limited\nServer: ${ORIGIN}` });
}
async function signOut() {
  const r = await dialog.showMessageBox(win, { type: "question", buttons: ["Sign out", "Cancel"], defaultId: 0, cancelId: 1, message: "Sign out of Meet by Kayak on this computer?", detail: "This also clears cached messages and files from this computer." });
  if (r.response) return;
  const s = session.fromPartition("persist:kayakmeet");
  await s.clearStorageData(); await s.clearCache();
  win.loadURL(`${ORIGIN}/login`);
}

// ----------------------------------------------------------------------------- settings window
let settingsWin = null;
function openSettings() {
  if (settingsWin) return settingsWin.focus();
  settingsWin = new BrowserWindow({
    width: 820, height: 620, minWidth: 640, minHeight: 480, title: "Settings", show: false, backgroundColor: "#F4F7F6",
    titleBarStyle: isMac ? "hiddenInset" : "default", autoHideMenuBar: true, parent: isMac ? undefined : win,
    webPreferences: { preload: asset("ui-preload.js"), contextIsolation: true, sandbox: true },
  });
  settingsWin.loadFile(asset("settings.html"));
  settingsWin.once("ready-to-show", () => settingsWin.show());
  settingsWin.on("closed", () => (settingsWin = null));
}
const fromLocal = (e) => (e.senderFrame?.url || "").startsWith("file://");
const fromKayak = (e) => isKayak(e.senderFrame?.url || "");
ipcMain.handle("km:settings:get", (e) => (fromLocal(e) ? { values: store.all, locked: store.locked(), platform: process.platform, version: app.getVersion(), server: ORIGIN } : null));
ipcMain.handle("km:settings:set", (e, patch) => (fromLocal(e) ? store.set(patch) : null));
ipcMain.handle("km:settings:reset", (e) => (fromLocal(e) ? store.reset() : null));
ipcMain.handle("km:settings:clear", async (e) => { if (!fromLocal(e)) return false; const s = session.fromPartition("persist:kayakmeet"); await s.clearCache(); return true; });
ipcMain.handle("km:settings:signout", (e) => (fromLocal(e) ? signOut() : null));
ipcMain.handle("km:update:check", (e) => (fromLocal(e) ? checkUpdates(true) : null));
ipcMain.handle("km:retry", (e, back) => { if (fromLocal(e)) win.loadURL(back && inApp(back) ? back : `${ORIGIN}/app`); });
ipcMain.handle("km:openExternal", (e, url) => { if (fromLocal(e)) openExternal(url); });

store.onChange((all, changed) => {
  if ("theme" in changed) nativeTheme.themeSource = all.theme;
  if ("shortcuts" in changed || "globalShortcuts" in changed) { registerShortcuts(); buildMenus(); }
  if ("openAtLogin" in changed || "startInBackground" in changed) loginItem();
  if ("proxy" in changed || "proxyRules" in changed) applyProxy();
  if ("spellcheck" in changed) session.fromPartition("persist:kayakmeet").setSpellCheckerEnabled(all.spellcheck);
  if ("hardwareAcceleration" in changed) dialog.showMessageBox(settingsWin || win, { message: "Restart Meet by Kayak to apply the graphics setting." });
  send("settings", pagePrefs());
});
function loginItem() {
  app.setLoginItemSettings({ openAtLogin: store.get("openAtLogin"), openAsHidden: store.get("startInBackground"), args: store.get("startInBackground") ? ["--hidden"] : [] });
}
const pagePrefs = () => { const a = store.all; return { joinMuted: a.joinMuted, joinCameraOff: a.joinCameraOff, dataSaver: a.dataSaver, notifications: a.notifications, notificationSound: a.notificationSound, quietDuringMeetings: a.quietDuringMeetings, meetingReminderMinutes: a.meetingReminderMinutes, confirmLeave: a.confirmLeave }; };

// ----------------------------------------------------------------------------- bridge from the page
ipcMain.handle("km:prefs", (e) => (fromKayak(e) ? pagePrefs() : null));
ipcMain.on("km:badge", (e, n) => { if (fromKayak(e) && Number.isFinite(n)) setBadge(n); });
ipcMain.on("km:attention", (e) => { if (fromKayak(e) && win && !win.isFocused()) { win.flashFrame(true); if (isMac) app.dock?.bounce?.("informational"); } });
ipcMain.on("km:notify", (e, n) => {
  if (!fromKayak(e) || !store.get("notifications") || !Notification.isSupported()) return;
  if (meeting.inMeeting && store.get("quietDuringMeetings") && n?.kind !== "meeting") return;
  const note = new Notification({ title: String(n?.title || "Meet by Kayak").slice(0, 120), body: String(n?.body || "").slice(0, 300), silent: !store.get("notificationSound") });
  note.on("click", () => { showWindow(); if (n?.path && typeof n.path === "string" && n.path.startsWith("/")) win.loadURL(ORIGIN + n.path); });
  note.show();
});
ipcMain.on("km:meeting", (e, s) => {
  if (!fromKayak(e) || !s || typeof s !== "object") return;
  const was = meeting.inMeeting, wasSharing = meeting.sharing;
  for (const k of ["inMeeting", "muted", "camera", "sharing", "hand"]) if (typeof s[k] === "boolean") meeting[k] = s[k];
  if (typeof s.title === "string") meeting.title = s.title.slice(0, 80);
  if (meeting.inMeeting && !was) blocker = powerSaveBlocker.start("prevent-display-sleep");
  if (!meeting.inMeeting && was) { if (blocker !== null) powerSaveBlocker.stop(blocker); blocker = null; setMini(false); }
  if (wasSharing && !meeting.sharing && normalBounds) setMini(false);
  win?.setTitle(meeting.inMeeting ? `${meeting.title || "Meeting"} · Meet by Kayak` : "Meet by Kayak");
  buildMenus();
});
ipcMain.on("km:mini", (e, on) => { if (fromKayak(e)) setMini(!!on); });

// ----------------------------------------------------------------------------- updates
let updater = null;
function checkUpdates(manual = false) {
  if (store.get("disableUpdates") || (!manual && !store.get("autoUpdate"))) return;
  if (!app.isPackaged) { if (manual) dialog.showMessageBox({ message: "Updates are checked in the installed app only." }); return; }
  try {
    if (!updater) {
      updater = require("electron-updater").autoUpdater;
      updater.channel = store.get("updateChannel") === "beta" ? "beta" : "latest";
      updater.allowPrerelease = updater.channel === "beta";
      updater.autoInstallOnAppQuit = true;
      updater.on("update-downloaded", async (info) => {
        if (meeting.inMeeting) return; // never interrupt a meeting; installs on quit
        const r = await dialog.showMessageBox(win, { type: "info", buttons: ["Restart now", "Later"], defaultId: 0, cancelId: 1, message: `Meet by Kayak ${info.version} is ready.`, detail: "Restart to finish updating. It takes a few seconds." });
        if (r.response === 0) { quitting = true; updater.quitAndInstall(); }
      });
      if (manual) updater.once("update-not-available", () => dialog.showMessageBox(settingsWin || win, { message: "You have the latest version of Meet by Kayak." }));
      updater.on("error", (err) => { if (manual) dialog.showMessageBox(settingsWin || win, { type: "warning", message: "Could not check for updates.", detail: String(err?.message || err).slice(0, 300) }); });
    }
    updater.checkForUpdates();
  } catch (err) { console.error(err); }
}

// ----------------------------------------------------------------------------- lifecycle
app.on("web-contents-created", (_e, wc) => {
  wc.on("will-attach-webview", (e) => e.preventDefault());
});
app.whenReady().then(() => {
  nativeTheme.themeSource = store.get("theme");
  hardenSession();
  createTray();
  createWindow();
  buildMenus();
  registerShortcuts();
  loginItem();
  setTimeout(() => checkUpdates(false), 15_000);
  setInterval(() => checkUpdates(false), 4 * 3_600_000);
});
app.on("activate", showWindow);
app.on("before-quit", () => { quitting = true; });
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => { if (!isMac) app.quit(); });
