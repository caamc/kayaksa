# Meet by Kayak — desktop app (Windows and macOS)

A hardened Electron shell around meet.kayaksa.com that adds what a browser tab cannot:

| Feature | Windows | macOS |
|---|---|---|
| Global shortcuts (mute, camera, hand, share, show app), all changeable | ✓ | ✓ |
| Screen-share picker (screen or window); computer sound | ✓ (with sound) | ✓ (system picker on macOS 15+) |
| Mini window while sharing, always on top, hidden from the share | ✓ | ✓ |
| Meeting controls in the taskbar preview (mute, camera, share, leave) | ✓ | menu bar |
| Unread badge | taskbar overlay | dock badge |
| Tray / menu-bar app, start at login, start in background | ✓ | ✓ |
| `kayakmeet://join/<room>` deep links | ✓ | ✓ |
| Proxy (system, direct, manual), data saver, hardware acceleration switch | ✓ | ✓ |
| IT policy file that locks settings | `%ProgramData%\Kayak\Meet\policy.json` | `/Library/Application Support/Kayak/Meet/policy.json` |
| Auto-update from meet.kayaksa.com/download, never during a meeting | ✓ | ✓ (needs signing) |
| MSI for Intune / Group Policy | ✓ | — |

## Security
The site runs with `contextIsolation`, `sandbox` and no Node.js. It reaches the app only through
`preload.js` (`window.kayakDesktop`), and only from Kayak's origin. Camera, microphone, screen and
notification permissions are granted to Kayak's origin only; every other link opens in the browser;
bad TLS certificates are refused; `<webview>` is blocked. No telemetry.

## Policy file example
```json
{ "autoUpdate": true, "updateChannel": "latest", "proxy": "manual", "proxyRules": "proxy.client.com:8080", "allowSignOut": true }
```

## Building
GitHub Actions → **Desktop app** → Run workflow (or push a tag `desktop-vX.Y.Z`). The workflow builds on
GitHub's macOS and Windows machines and uploads to `meet.kayaksa.com/download`.
Signing secrets are listed at the top of `.github/workflows/desktop.yml`.

Local run: `cd desktop && npm install && KAYAK_MEET_URL=http://localhost:8704 npm start`.
