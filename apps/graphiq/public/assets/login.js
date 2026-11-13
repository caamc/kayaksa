import { initTheme } from "/_shared/js/ui.js";
initTheme();
const p = new URLSearchParams(location.search);
const INTERNAL = location.hostname.endsWith("kayaksa.com") ? "https://internal.kayaksa.com" : "http://localhost:8702";
const next = /^\/app[A-Za-z0-9#/_-]*$/.test(p.get("next") || "") ? p.get("next") : "/app";
document.getElementById("sso").href = `${INTERNAL}/sso/graphiq?next=${encodeURIComponent(next)}`;
const msg = { sso: "That sign-in link has expired or was already used. Sign in again.", disabled: "Your GraphIQ access has been turned off. Ask a GraphIQ administrator." }[p.get("e")];
if (msg) { const e = document.getElementById("err"); e.textContent = msg; e.hidden = false; }
