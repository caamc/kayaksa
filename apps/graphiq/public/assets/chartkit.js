// Browser side of the Kayak exhibit charts: hover and focus tooltips, click or Enter to drill down
// (each mark carries a JSON filter in data-drill), and export to SVG and PNG.
import { esc } from "/_shared/js/ui.js";

let tip;
function tipEl() { if (!tip) { tip = document.createElement("div"); tip.className = "gq-tip"; tip.hidden = true; tip.setAttribute("role", "tooltip"); document.body.append(tip); } return tip; }
function show(text, x, y) { const t = tipEl(); t.textContent = text; t.hidden = false; const r = t.getBoundingClientRect(); t.style.left = Math.min(innerWidth - r.width - 8, x + 14) + "px"; t.style.top = Math.max(8, y - r.height - 10) + "px"; }
const hide = () => tip && (tip.hidden = true);

/** Wires tooltips and drill-down on every .gq-mark inside `root`. */
export function bind(root, onDrill) {
  root.addEventListener("mousemove", (e) => { const m = e.target.closest?.(".gq-mark"); if (m?.dataset.tip) show(m.dataset.tip, e.clientX, e.clientY); else hide(); });
  root.addEventListener("mouseleave", hide);
  root.addEventListener("focusin", (e) => { const m = e.target.closest?.(".gq-mark"); if (m?.dataset.tip) { const r = m.getBoundingClientRect(); show(m.dataset.tip, r.left + r.width / 2, r.top); } });
  root.addEventListener("focusout", hide);
  const go = (m) => { if (!m?.dataset.drill || !onDrill) return; try { hide(); onDrill(JSON.parse(m.dataset.drill), m.dataset.tip); } catch {} };
  root.addEventListener("click", (e) => go(e.target.closest?.(".gq-mark")));
  root.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { const m = e.target.closest?.(".gq-mark"); if (m?.dataset.drill) { e.preventDefault(); go(m); } } });
}

export function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
const safe = (s) => String(s || "exhibit").replace(/[^\w.-]+/g, "_").slice(0, 60);

export function svgBlob(svg) { return new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + svg], { type: "image/svg+xml" }); }

/** Rasterises an SVG string to a PNG blob at `scale` times its size. */
export function pngBlob(svg, scale = 2) {
  return new Promise((resolve, reject) => {
    const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    const w = m ? +m[1] : 720, h = m ? +m[2] : 420;
    const img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = w * scale; c.height = h * scale; const g = c.getContext("2d"); g.scale(scale, scale); g.drawImage(img, 0, 0, w, h); c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the chart."))), "image/png"); };
    img.onerror = () => reject(new Error("Could not draw the chart."));
    img.src = URL.createObjectURL(svgBlob(svg));
  });
}

/** Renders one exhibit card with its export buttons. `onExport(kind)` is told about exports (for the audit log). */
export function exhibitCard(ex, { onDrill, onExport } = {}) {
  const el = document.createElement("figure");
  el.className = "exhibit" + (ex.html ? " html" : "");
  el.style.margin = "0";
  el.dataset.id = ex.id;
  el.innerHTML = `<div class="ex-tools"><span class="ex-name">${esc(ex.eyebrow)}</span>${ex.html ? "" : `<button class="btn btn-quiet btn-sm" data-x="svg" aria-label="Download ${esc(ex.title)} as SVG">SVG</button><button class="btn btn-quiet btn-sm" data-x="png" aria-label="Download ${esc(ex.title)} as PNG">PNG</button>`}</div>${ex.html ? `<h3 style="padding:12px 14px 0;font-size:1rem">${esc(ex.title)}</h3>` : ""}<div class="ex-body">${ex.svg}</div>${ex.html ? `<p class="verify-note" style="margin:0 14px 14px">Analytical output - requires human verification.</p>` : ""}`;
  bind(el, onDrill);
  el.querySelector(".ex-tools").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-x]"); if (!b) return;
    const name = safe(ex.eyebrow);
    if (b.dataset.x === "svg") download(svgBlob(ex.svg), name + ".svg");
    else download(await pngBlob(ex.svg), name + ".png");
    onExport?.(b.dataset.x, ex);
  });
  return el;
}
