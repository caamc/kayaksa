// Bridge for the app's own local screens (Settings, the screen-share picker, the offline page).
const { contextBridge, ipcRenderer } = require("electron");
if (location.protocol === "file:") {
  contextBridge.exposeInMainWorld("kayakUi", {
    platform: process.platform,
    settings: { get: () => ipcRenderer.invoke("km:settings:get"), set: (p) => ipcRenderer.invoke("km:settings:set", p), reset: () => ipcRenderer.invoke("km:settings:reset"), clearCache: () => ipcRenderer.invoke("km:settings:clear"), signOut: () => ipcRenderer.invoke("km:settings:signout") },
    checkUpdates: () => ipcRenderer.invoke("km:update:check"),
    sources: () => ipcRenderer.invoke("km:sources"),
    pick: (choice) => ipcRenderer.invoke("km:pick", choice),
    retry: (back) => ipcRenderer.invoke("km:retry", back),
    open: (url) => ipcRenderer.invoke("km:openExternal", url),
  });
}
