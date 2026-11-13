// The only bridge between meet.kayaksa.com and the desktop app. Small, typed and one-way where it can be:
// the page tells the app about unread counts and meeting state; the app sends back commands such as
// "toggle mute" from global shortcuts, the tray or the Windows taskbar. Nothing else of Node.js or
// Electron is reachable from the page.
const { contextBridge, ipcRenderer } = require("electron");

const KAYAK = /^https:\/\/meet\.kayaksa\.com$|^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
if (KAYAK.test(location.origin)) {
  const handlers = new Set();
  ipcRenderer.on("km:command", (_e, m) => { for (const fn of handlers) try { fn(m.cmd, m.arg); } catch {} });
  contextBridge.exposeInMainWorld("kayakDesktop", {
    platform: process.platform,
    prefs: () => ipcRenderer.invoke("km:prefs"),
    setBadge: (n) => ipcRenderer.send("km:badge", Number(n) || 0),
    attention: () => ipcRenderer.send("km:attention"),
    notify: (n) => ipcRenderer.send("km:notify", { title: String(n?.title || ""), body: String(n?.body || ""), path: String(n?.path || ""), kind: String(n?.kind || "") }),
    meeting: (s) => ipcRenderer.send("km:meeting", {
      inMeeting: !!s?.inMeeting, muted: !!s?.muted, camera: !!s?.camera, sharing: !!s?.sharing, hand: !!s?.hand, title: String(s?.title || ""),
    }),
    mini: (on) => ipcRenderer.send("km:mini", !!on),
    onCommand: (fn) => { if (typeof fn === "function") handlers.add(fn); return () => handlers.delete(fn); },
    // Meet's in-app Settings: Updates, Downloads, Accounts, Zoom and presenting on another display.
    app: {
      info: () => ipcRenderer.invoke("km:app:info"),
      set: (patch) => ipcRenderer.invoke("km:app:set", patch),
      zoom: (dir) => ipcRenderer.invoke("km:app:zoom", String(dir)),
      update: {
        check: () => ipcRenderer.invoke("km:app:update", "check"),
        install: () => ipcRenderer.invoke("km:app:update", "install"),
        onStatus: (fn) => { const h = (_e, s) => fn(s); ipcRenderer.on("km:update", h); return () => ipcRenderer.removeListener("km:update", h); },
      },
      downloads: {
        list: () => ipcRenderer.invoke("km:app:downloads", "list"),
        open: (id) => ipcRenderer.invoke("km:app:downloads", "open", String(id)),
        show: (id) => ipcRenderer.invoke("km:app:downloads", "show", String(id)),
        cancel: (id) => ipcRenderer.invoke("km:app:downloads", "cancel", String(id)),
        clear: () => ipcRenderer.invoke("km:app:downloads", "clear"),
        onChange: (fn) => { const h = () => fn(); ipcRenderer.on("km:downloads", h); return () => ipcRenderer.removeListener("km:downloads", h); },
      },
      accounts: {
        list: () => ipcRenderer.invoke("km:app:accounts", "list"),
        add: (label) => ipcRenderer.invoke("km:app:accounts", "add", String(label || "")),
        switch: (id) => ipcRenderer.invoke("km:app:accounts", "switch", String(id)),
        rename: (id, label) => ipcRenderer.invoke("km:app:accounts", "rename", String(id), String(label || "")),
        remove: (id) => ipcRenderer.invoke("km:app:accounts", "remove", String(id)),
      },
      displays: () => ipcRenderer.invoke("km:app:displays"),
      present: (displayId, room) => ipcRenderer.invoke("km:app:present", displayId == null ? null : Number(displayId), String(room || "")),
      openDesktopSettings: () => ipcRenderer.invoke("km:app:openSettings"),
    },
  });
  // Let the page style itself for the desktop frame (drag region, space for the window buttons).
  window.addEventListener("DOMContentLoaded", () => { document.documentElement.dataset.desktop = process.platform; });
}

// The app's own local screens shown in the main window (splash, offline): retry and open Settings only.
if (location.protocol === "file:") {
  contextBridge.exposeInMainWorld("kayakUi", {
    platform: process.platform,
    retry: (back) => ipcRenderer.invoke("km:retry", back),
    openSettings: () => ipcRenderer.invoke("km:openSettings"),
  });
}
