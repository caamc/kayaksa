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
  });
  // Let the page style itself for the desktop frame (drag region, space for the window buttons).
  window.addEventListener("DOMContentLoaded", () => { document.documentElement.dataset.desktop = process.platform; });
}
