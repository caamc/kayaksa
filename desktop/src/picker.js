const $ = (s) => document.querySelector(s);
const ui = window.kayakUi;
let all = [], tab = "screen", chosen = null;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Computer sound can be shared on Windows; macOS does not allow it for apps outside the App Store sandbox APIs.
if (ui.platform !== "win32") $("#audwrap").hidden = true;
function draw() {
  const list = all.filter((s) => s.kind === tab);
  $("#grid").innerHTML = list.length ? list.map((s, i) => `<button class="src" role="option" data-id="${esc(s.id)}" aria-selected="${chosen === s.id}"><img class="t" src="${s.thumb}" alt=""><span>${s.icon ? `<img src="${s.icon}" alt="">` : ""}${esc(s.kind === "screen" && list.length > 1 ? `Screen ${i + 1}` : s.name)}</span></button>`).join("") : `<p class="empty">${tab === "window" ? "No windows to share. Open the app you want to show first." : "No screens found."}</p>`;
  $("#share").disabled = !chosen;
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-t]"); if (t) { tab = t.dataset.t; document.querySelectorAll("[data-t]").forEach((b) => b.setAttribute("aria-selected", b === t)); chosen = null; draw(); }
  const s = e.target.closest(".src"); if (s) { chosen = s.dataset.id; draw(); }
});
document.addEventListener("dblclick", (e) => { const s = e.target.closest(".src"); if (s) ui.pick({ id: s.dataset.id, audio: $("#aud").checked }); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") ui.pick(null); if (e.key === "Enter" && chosen) ui.pick({ id: chosen, audio: $("#aud").checked }); });
$("#cancel").onclick = () => ui.pick(null);
$("#share").onclick = () => ui.pick({ id: chosen, audio: $("#aud").checked });
(async () => { all = await ui.sources(); if (all.filter((s) => s.kind === "screen").length === 1) chosen = all.find((s) => s.kind === "screen").id; draw(); })();
setInterval(async () => { all = await ui.sources(); draw(); }, 4000); // keep thumbnails fresh
