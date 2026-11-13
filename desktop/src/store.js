// Settings for Meet by Kayak. A person's choices live in settings.json in the app's own data folder.
// IT teams can fix any setting for everyone on a machine with a policy file; a policy value always
// wins and shows as "Set by your organisation" in Settings.
//   Windows: %ProgramData%\Kayak\Meet\policy.json
//   macOS:   /Library/Application Support/Kayak/Meet/policy.json
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const DEFAULTS = {
  // General
  openAtLogin: false,
  startInBackground: false,
  closeToTray: true,
  theme: "system",                 // system | light | dark
  language: "system",
  // Meetings
  joinMuted: false,
  joinCameraOff: false,
  alwaysOnTopInMeeting: true,      // the mini window floats above other apps while you share
  miniOnShare: true,               // shrink to the mini window when you share your screen
  confirmLeave: true,
  // Notifications
  notifications: true,
  notificationSound: true,
  quietDuringMeetings: true,       // no chat pop-ups while you are in a meeting
  meetingReminderMinutes: 5,
  // Shortcuts (Electron accelerators). Global ones work even when the app is in the background.
  shortcuts: {
    toggleMute: "CommandOrControl+Shift+M",
    toggleCamera: "CommandOrControl+Shift+O",
    raiseHand: "CommandOrControl+Shift+K",
    shareScreen: "CommandOrControl+Shift+E",
    showApp: "CommandOrControl+Shift+J",
  },
  globalShortcuts: true,
  // Network and performance
  proxy: "system",                 // system | direct | manual
  proxyRules: "",
  hardwareAcceleration: true,
  dataSaver: false,                // lower video quality on slow or metered connections
  // Updates
  autoUpdate: true,
  updateChannel: "latest",         // latest | beta
  // Privacy
  spellcheck: true,
  // Downloads
  askDownload: false,
  // Accounts: extra Meet accounts, each in its own separate storage on this computer
  accounts: [],
  activeAccount: "main",
  mainLabel: "Main account",
};

const POLICY_KEYS = new Set(Object.keys(DEFAULTS).concat(["server", "allowSignOut", "disableUpdates"]));

function policyPath() {
  if (process.platform === "win32") return path.join(process.env.ProgramData || "C:\\ProgramData", "Kayak", "Meet", "policy.json");
  if (process.platform === "darwin") return "/Library/Application Support/Kayak/Meet/policy.json";
  return "/etc/kayak/meet/policy.json";
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; }
}

class Store {
  constructor() {
    this.file = path.join(app.getPath("userData"), "settings.json");
    const raw = readJson(policyPath());
    this.policy = {};
    for (const [k, v] of Object.entries(raw)) if (POLICY_KEYS.has(k)) this.policy[k] = v;
    this.user = readJson(this.file);
    this.listeners = new Set();
  }
  get all() {
    const merged = { ...DEFAULTS, ...this.user, ...this.policy };
    merged.shortcuts = { ...DEFAULTS.shortcuts, ...(this.user.shortcuts || {}), ...(this.policy.shortcuts || {}) };
    return merged;
  }
  get(key) { return this.all[key]; }
  locked() { return Object.keys(this.policy); }
  set(patch) {
    const clean = {};
    for (const [k, v] of Object.entries(patch || {})) {
      if (!(k in DEFAULTS) || k in this.policy) continue;     // unknown or locked by policy
      if (typeof v !== typeof DEFAULTS[k]) continue;           // keep types honest
      clean[k] = k === "shortcuts" ? { ...this.all.shortcuts, ...pickStrings(v) } : v;
    }
    this.user = { ...this.user, ...clean };
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file + ".tmp", JSON.stringify(this.user, null, 2));
      fs.renameSync(this.file + ".tmp", this.file);
    } catch (e) { console.error("Could not save settings", e); }
    for (const fn of this.listeners) fn(this.all, clean);
    return this.all;
  }
  reset() { this.user = {}; return this.set({}); }
  onChange(fn) { this.listeners.add(fn); }
}

function pickStrings(o) {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) if (k in DEFAULTS.shortcuts && typeof v === "string" && v.length < 60) out[k] = v;
  return out;
}

module.exports = { Store, DEFAULTS };
