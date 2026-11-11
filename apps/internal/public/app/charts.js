// Kayak charts: small, dependency-free SVG charts drawn to the KSA data-visualisation rules
// (Fog gridlines, direct labels, one saffron beacon, Open Water for data, Deep Current for ink).
// Every chart works in light and dark themes through CSS variables and has a text alternative.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const PAL = ["#17807E", "#EE9B1E", "#2D6A9F", "#5E4B78", "#4B7A4E", "#9C630E", "#3E5563", "#B4472F"];
export const fmt = (n, d = 0) => (n == null || Number.isNaN(n) ? "–" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: d }));
export const compact = (n) => (n == null ? "–" : n >= 1e7 ? `${(n / 1e7).toFixed(1)} cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)} L` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : fmt(n));
function nice(v) { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p; return 10 * p; }
const smooth = (pts) => pts.map((p, i) => {
  if (!i) return `M${p[0]},${p[1]}`;
  const a = pts[i - 1], cx = (a[0] + p[0]) / 2;
  return `C${cx},${a[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
}).join("");

/** Multi-series area/line chart with a hover crosshair. labels: x labels; series: [{name, values, color}] */
export function area(labels, series, { h = 220, yFmt = compact, title = "" } = {}) {
  const W = 640, H = h, l = 40, r = 12, t = 14, b = 26;
  const max = nice(Math.max(4, ...series.flatMap((s) => s.values)));
  const x = (i) => l + (labels.length < 2 ? (W - l - r) / 2 : (i * (W - l - r)) / (labels.length - 1));
  const y = (v) => t + (1 - v / max) * (H - t - b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * max);
  const step = Math.max(1, Math.ceil(labels.length / 7));
  const id = "g" + Math.random().toString(36).slice(2, 8);
  const body = series.map((s, si) => {
    const c = s.color || PAL[si % PAL.length];
    const pts = s.values.map((v, i) => [x(i), y(v || 0)]);
    if (!pts.length) return "";
    const line = smooth(pts);
    return `<defs><linearGradient id="${id}${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".28"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>
      <path d="${line} L${pts.at(-1)[0]},${y(0)} L${pts[0][0]},${y(0)} Z" fill="url(#${id}${si})"/><path d="${line}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="3.5" fill="${c}"/>`;
  }).join("");
  const data = esc(JSON.stringify({ labels, series: series.map((s, i) => ({ n: s.name, v: s.values, c: s.color || PAL[i % PAL.length] })), l, r, W }));
  return `<figure class="kc kc-area" data-chart="${data}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title || series.map((s) => s.name).join(", "))}" preserveAspectRatio="none">
    ${ticks.map((v) => `<line x1="${l}" x2="${W - r}" y1="${y(v)}" y2="${y(v)}" class="kc-grid${v ? "" : " base"}"/><text x="${l - 6}" y="${y(v) + 3.5}" text-anchor="end" class="kc-tk">${esc(yFmt(v))}</text>`).join("")}
    ${labels.map((lb, i) => (i % step === 0 || i === labels.length - 1 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="kc-tk">${esc(lb)}</text>` : "")).join("")}
    ${body}<line class="kc-x" x1="0" x2="0" y1="${t}" y2="${H - b}" visibility="hidden"/></svg><div class="kc-tip" hidden></div>
    ${series.length > 1 ? `<figcaption class="kc-legend">${series.map((s, i) => `<span><i style="background:${s.color || PAL[i % PAL.length]}"></i>${esc(s.name)}</span>`).join("")}</figcaption>` : ""}</figure>`;
}

/** Horizontal bars with direct labels; the first row (or `beacon`) in saffron. rows: [[label, value]] */
export function bars(rows, { beacon = 0, fmtV = fmt, color = "#17807E", max } = {}) {
  if (!rows.length) return `<p class="muted small">No data yet.</p>`;
  const m = max || Math.max(...rows.map((r) => r[1])) || 1;
  return `<ul class="kc-bars">${rows.map(([lb, v], i) => `<li><span class="lb" title="${esc(lb)}">${esc(lb)}</span><span class="tr"><i style="width:${Math.max(1.5, (v / m) * 100)}%;background:${i === beacon ? "#EE9B1E" : color}"></i></span><b>${esc(fmtV(v))}</b></li>`).join("")}</ul>`;
}

/** Donut with legend. rows: [[label, value]] */
export function donut(rows, { size = 150, center = "" } = {}) {
  const tot = rows.reduce((s, r) => s + r[1], 0) || 1, R = 52, C = 2 * Math.PI * R;
  let off = 0;
  const arcs = rows.map(([lb, v], i) => { const len = (v / tot) * C; const s = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${PAL[i % PAL.length]}" stroke-width="18" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${esc(lb)}: ${fmt(v)}</title></circle>`; off += len; return s; }).join("");
  return `<div class="kc-donut"><svg viewBox="0 0 140 140" width="${size}" height="${size}" role="img" aria-label="${esc(rows.map((r) => `${r[0]} ${r[1]}`).join(", "))}"><circle r="${R}" cx="70" cy="70" fill="none" class="kc-ring" stroke-width="18"/>${arcs}<text x="70" y="68" text-anchor="middle" class="kc-dc">${esc(center || compact(tot))}</text><text x="70" y="84" text-anchor="middle" class="kc-tk">total</text></svg>
    <ul>${rows.map(([lb, v], i) => `<li><i style="background:${PAL[i % PAL.length]}"></i><span>${esc(lb)}</span><b>${Math.round((v / tot) * 100)}%</b></li>`).join("")}</ul></div>`;
}

/** Tiny trend line for KPI cards. */
export function spark(values, { color = "#17807E", w = 120, h = 34 } = {}) {
  if (!values?.length) return "";
  const m = Math.max(...values, 1);
  const pts = values.map((v, i) => [values.length < 2 ? w / 2 : (i * w) / (values.length - 1), h - 3 - (v / m) * (h - 6)]);
  return `<svg class="kc-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${smooth(pts)}" fill="none" stroke="${color}" stroke-width="1.8"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="2.6" fill="#EE9B1E"/></svg>`;
}

/** Half-donut gauge with a threshold scale: good, needs work, poor. */
export function gauge(value, { max = 100, label = "", unit = "", good, poor, lowerBetter = true } = {}) {
  const v = value == null ? 0 : Math.min(max, value), k = v / max, R = 46;
  const pt = (a) => `${60 - R * Math.cos(a * Math.PI)} ${58 - R * Math.sin(a * Math.PI)}`;
  const tone = value == null ? "var(--fog,#D4DEE2)" : lowerBetter ? (value <= good ? "#17807E" : value <= poor ? "#EE9B1E" : "#B4472F") : (value >= good ? "#17807E" : value >= poor ? "#EE9B1E" : "#B4472F");
  return `<div class="kc-gauge"><svg viewBox="0 0 120 66" role="img" aria-label="${esc(label)} ${value == null ? "no data" : value + unit}"><path d="M${pt(0)} A${R} ${R} 0 0 1 ${pt(1)}" fill="none" class="kc-ring" stroke-width="10" stroke-linecap="round"/>${value == null ? "" : `<path d="M${pt(0)} A${R} ${R} 0 0 1 ${pt(Math.max(0.01, k))}" fill="none" stroke="${tone}" stroke-width="10" stroke-linecap="round"/>`}<text x="60" y="54" text-anchor="middle" class="kc-gv">${value == null ? "–" : esc(fmt(value, unit === "" ? 2 : 0))}${esc(unit)}</text></svg><span>${esc(label)}</span></div>`;
}

/** 24-hour activity strip (IST). */
export function hours(arr) {
  const m = Math.max(1, ...arr);
  return `<div class="kc-hours" role="img" aria-label="Views by hour of day">${arr.map((v, i) => `<i style="--k:${(v / m).toFixed(3)}" title="${String(i).padStart(2, "0")}:00 IST · ${fmt(v)} views"></i>`).join("")}</div><div class="kc-hours-ax"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>`;
}

/** Gantt-style timeline. items: [{label, start, end, progress, color, sub}] */
export function gantt(items, { from, to } = {}) {
  if (!items.length) return "";
  const a = Date.parse(from || items.map((i) => i.start).sort()[0]), z = Date.parse(to || items.map((i) => i.end).sort().at(-1)) + 86400_000;
  const span = Math.max(1, z - a), pct = (d) => Math.max(0, Math.min(100, ((Date.parse(d) - a) / span) * 100));
  const todayP = pct(new Date().toISOString().slice(0, 10));
  const months = []; const d = new Date(a); d.setUTCDate(1);
  while (d.getTime() < z) { if (d.getTime() >= a) months.push([pct(d.toISOString().slice(0, 10)), d.toLocaleString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })]); d.setUTCMonth(d.getUTCMonth() + 1); }
  return `<div class="kc-gantt"><div class="gh">${months.map(([p, m]) => `<span style="left:${p}%">${esc(m)}</span>`).join("")}</div>
    ${items.map((it) => `<div class="gr"><span class="gl" title="${esc(it.label)}">${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</span><span class="gt"><i style="left:${pct(it.start)}%;width:${Math.max(1, pct(it.end) - pct(it.start))}%;--c:${it.color || "#17807E"}"><b style="width:${it.progress || 0}%"></b></i></span></div>`).join("")}
    <span class="gtoday" style="left:calc(var(--gl) + (100% - var(--gl)) * ${todayP / 100})"><em>Today</em></span></div>`;
}

/** Hover tooltips for area charts in a container. */
export function bindCharts(root) {
  root.querySelectorAll(".kc-area").forEach((f) => {
    const d = JSON.parse(f.dataset.chart), svg = f.querySelector("svg"), tip = f.querySelector(".kc-tip"), ln = f.querySelector(".kc-x");
    const move = (e) => {
      const r = svg.getBoundingClientRect(), xs = ((e.clientX - r.left) / r.width) * d.W;
      const n = d.labels.length; if (!n) return;
      const i = Math.max(0, Math.min(n - 1, Math.round(((xs - d.l) / (d.W - d.l - d.r)) * (n - 1))));
      const px = d.l + (n < 2 ? 0 : (i * (d.W - d.l - d.r)) / (n - 1));
      ln.setAttribute("x1", px); ln.setAttribute("x2", px); ln.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.innerHTML = `<b>${esc(d.labels[i])}</b>${d.series.map((s) => `<span><i style="background:${s.c}"></i>${esc(s.n)}: ${fmt(s.v[i])}</span>`).join("")}`;
      const lx = (px / d.W) * r.width;
      tip.style.left = `${Math.min(r.width - 150, Math.max(0, lx + 10))}px`;
    };
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerleave", () => { tip.hidden = true; ln.setAttribute("visibility", "hidden"); });
  });
}
