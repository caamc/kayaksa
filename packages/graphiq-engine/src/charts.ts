// Kayak exhibit charts: a library of consulting-style charts drawn as plain SVG strings, in Kayak's
// own exhibit style (deep teal ground, slate panels, teal/blue/olive/mint series, one saffron
// highlight, coral for negatives, action titles, a Source line and a verification note).
// Pure functions with no DOM: the same SVG is shown in the app, placed in HTML and PDF reports
// and tested in Node. Interactive marks carry data-tip (tooltip), data-drill (JSON filter for
// click-to-drill) and tabindex, which the browser binder (public/assets/chartkit.js) wires up.
// Original Kayak code; no third-party chart library.

export type ThemeName = "dark" | "light";
export interface Theme { name: ThemeName; bg: string; panel: string; text: string; muted: string; grid: string; axis: string; series: string[]; accent: string; onAccent: string; neg: string; ok: string; warn: string; eyebrow: string }

export const THEMES: Record<ThemeName, Theme> = {
  dark: { name: "dark", bg: "#0E2F3C", panel: "#3E5563", text: "#FFFFFF", muted: "#A9C0C6", grid: "rgba(255,255,255,0.12)", axis: "rgba(255,255,255,0.35)", series: ["#3FB0A9", "#6E9FD3", "#9AAE5C", "#CFE8E3"], accent: "#EE9B1E", onAccent: "#0E2F3C", neg: "#E2735F", ok: "#9AAE5C", warn: "#EE9B1E", eyebrow: "#CFE8E3" },
  light: { name: "light", bg: "#FFFFFF", panel: "#EEF4F1", text: "#0E2F3C", muted: "#4E6470", grid: "#E1E9EC", axis: "#B9C9CF", series: ["#17807E", "#2D6A9F", "#6E8A3A", "#8FC9C1"], accent: "#EE9B1E", onAccent: "#0E2F3C", neg: "#B4472F", ok: "#4B7A4E", warn: "#9C630E", eyebrow: "#17807E" },
};
export const theme = (t?: ThemeName | Theme): Theme => (typeof t === "object" ? t : THEMES[t || "dark"]);

export const VERIFY_NOTE = "Analytical output - requires human verification.";
const FONT = "Archivo, 'Arial Narrow', Arial, Helvetica, sans-serif";

export interface Frame { eyebrow?: string; title?: string; source?: string; width?: number; height?: number; theme?: ThemeName | Theme; desc?: string; id?: string }

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const fmt = (n: number, d = 0) => (Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: 0 }) : "");
const pct = (n: number, d = 0) => `${fmt(n * 100, d)}%`;
const r1 = (n: number) => Math.round(n * 10) / 10;
const charW = (size: number) => size * 0.55;
export function clip(s: string, maxPx: number, size = 12) { const max = Math.max(3, Math.floor(maxPx / charW(size))); return s.length > max ? s.slice(0, max - 1) + "…" : s; }
function wrap(text: string, maxPx: number, size: number): string[] {
  const max = Math.max(8, Math.floor(maxPx / charW(size)));
  const out: string[] = []; let line = "";
  for (const w of text.split(/\s+/)) { if ((line + " " + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + " " + w).trim(); }
  if (line) out.push(line);
  return out.slice(0, 3);
}

/** Interactive mark attributes. */
function mk(tip: string, drill?: unknown, extra = "") {
  return ` class="gq-mark${extra ? " " + extra : ""}" tabindex="0" role="graphics-symbol" aria-label="${esc(tip)}" data-tip="${esc(tip)}"${drill !== undefined ? ` data-drill="${esc(JSON.stringify(drill))}"` : ""}`;
}
const txt = (x: number, y: number, s: string, o: { size?: number; fill: string; anchor?: string; weight?: number; ls?: number; base?: string } ) =>
  `<text x="${r1(x)}" y="${r1(y)}" font-size="${o.size || 12}" fill="${o.fill}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.weight ? ` font-weight="${o.weight}"` : ""}${o.ls ? ` letter-spacing="${o.ls}"` : ""}${o.base ? ` dominant-baseline="${o.base}"` : ""}>${esc(s)}</text>`;

export interface Box { x: number; y: number; w: number; h: number; t: Theme }

/** The exhibit frame: eyebrow, action title, plot area and footer (source and verification note). */
export function frame(f: Frame, draw: (b: Box) => string): string {
  const t = theme(f.theme);
  const W = f.width || 720, H = f.height || 420, pad = 24;
  let y = pad + 4;
  let head = "";
  if (f.eyebrow) { head += txt(pad, y + 8, f.eyebrow.toUpperCase(), { size: 11, fill: t.eyebrow, weight: 700, ls: 1.8 }); y += 22; }
  if (f.title) { for (const l of wrap(f.title, W - pad * 2, 19)) { head += txt(pad, y + 16, l, { size: 19, fill: t.text, weight: 700 }); y += 25; } y += 8; }
  const footH = 34;
  const box: Box = { x: pad, y, w: W - pad * 2, h: Math.max(60, H - y - footH - 8), t };
  const foot = `<line x1="${pad}" x2="${W - pad}" y1="${H - footH}" y2="${H - footH}" stroke="${t.grid}"/>` +
    txt(pad, H - footH + 15, `Source: ${f.source || "Kayak GraphIQ analysis of case records"}`, { size: 10.5, fill: t.muted }) +
    txt(pad, H - footH + 28, VERIFY_NOTE, { size: 10.5, fill: t.muted });
  const label = [f.eyebrow, f.title].filter(Boolean).join(": ") || "Chart";
  return `<svg xmlns="http://www.w3.org/2000/svg" class="gq-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}" font-family="${esc(FONT)}"${f.id ? ` id="${esc(f.id)}"` : ""} data-theme="${t.name}">` +
    `<title>${esc(label)}</title>${f.desc ? `<desc>${esc(f.desc)}</desc>` : ""}<rect width="${W}" height="${H}" fill="${t.bg}"/>${head}<g class="gq-plot">${draw(box)}</g>${foot}</svg>`;
}

function niceMax(v: number) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p; return 10 * p; }
function yAxis(b: Box, max: number, left: number, opts: { ticks?: number; fmt?: (n: number) => string; min?: number } = {}) {
  const n = opts.ticks || 4, min = opts.min || 0; let s = "";
  for (let i = 0; i <= n; i++) {
    const v = min + ((max - min) * i) / n, y = b.y + b.h - ((v - min) / (max - min)) * b.h;
    s += `<line x1="${left}" x2="${b.x + b.w}" y1="${r1(y)}" y2="${r1(y)}" stroke="${b.t.grid}"/>` + txt(left - 6, y + 4, (opts.fmt || fmt)(v), { size: 10.5, fill: b.t.muted, anchor: "end" });
  }
  return s;
}
const legend = (b: Box, names: string[], colors: string[], y = b.y - 4) => names.map((nm, i) => { const x = b.x + b.w - (names.length - i) * 120; return `<rect x="${x}" y="${y - 9}" width="10" height="10" fill="${colors[i]}"/>` + txt(x + 15, y, clip(nm, 100, 11), { size: 11, fill: b.t.muted }); }).join("");

// ------------------------------------------------------------------ 1. Blade bars

export interface Item { label: string; value: number; drill?: unknown; tip?: string }

/** Horizontal bars with an angled end; one item highlighted in saffron. */
export function bladeBars(items: Item[], f: Frame & { highlight?: number; valueFmt?: (n: number) => string; max?: number } = {}) {
  const rows = items.slice(0, 15);
  return frame({ height: Math.max(220, 120 + rows.length * 30), ...f }, (b) => {
    const labelW = Math.min(190, b.w * 0.32), max = f.max || Math.max(1, ...rows.map((r) => r.value));
    const rowH = b.h / Math.max(1, rows.length), bh = Math.min(20, rowH * 0.66), cut = Math.min(10, bh * 0.6);
    const hi = f.highlight ?? 0;
    return rows.map((r, i) => {
      const y = b.y + i * rowH + (rowH - bh) / 2, w = Math.max(cut + 2, ((b.w - labelW - 70) * r.value) / max);
      const c = i === hi ? b.t.accent : b.t.series[0];
      const x0 = b.x + labelW;
      return txt(x0 - 10, y + bh / 2 + 4, clip(r.label, labelW - 12), { size: 12, fill: b.t.text, anchor: "end" }) +
        `<path d="M${x0} ${r1(y)}H${r1(x0 + w)}L${r1(x0 + w - cut)} ${r1(y + bh)}H${x0}Z" fill="${c}"${mk(r.tip || `${r.label}: ${(f.valueFmt || fmt)(r.value)}`, r.drill)}/>` +
        txt(x0 + w + 8, y + bh / 2 + 4, (f.valueFmt || fmt)(r.value), { size: 12, fill: i === hi ? b.t.accent : b.t.text, weight: 700 });
    }).join("");
  });
}

// ------------------------------------------------------------------ 2. Columns with reference line and callout

export function columnsRef(items: Item[], f: Frame & { ref?: number; refLabel?: string; callout?: number; calloutText?: string; labelEvery?: number } = {}) {
  return frame(f, (b) => {
    const max = niceMax(Math.max(1, ...items.map((i) => i.value), f.ref || 0) * 1.15), left = b.x + 40, pw = b.x + b.w - left;
    const bw = pw / Math.max(1, items.length), gap = Math.min(6, bw * 0.25), ph = b.h - 22;
    const Y = (v: number) => b.y + ph - (v / max) * ph;
    let s = yAxis({ ...b, h: ph }, max, left);
    const every = f.labelEvery || Math.ceil(items.length / 12);
    items.forEach((it, i) => {
      const x = left + i * bw + gap / 2, y = Y(it.value), hi = i === f.callout;
      s += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(bw - gap)}" height="${r1(b.y + ph - y)}" fill="${hi ? b.t.accent : b.t.series[0]}"${mk(it.tip || `${it.label}: ${fmt(it.value)}`, it.drill)}/>`;
      if (items.length <= 16) s += txt(x + (bw - gap) / 2, y - 5, fmt(it.value), { size: 10.5, fill: b.t.text, anchor: "middle" });
      if (i % every === 0) s += txt(x + (bw - gap) / 2, b.y + ph + 15, clip(it.label, bw * every), { size: 10.5, fill: b.t.muted, anchor: "middle" });
    });
    if (f.ref !== undefined) { const y = Y(f.ref); s += `<line x1="${left}" x2="${b.x + b.w}" y1="${r1(y)}" y2="${r1(y)}" stroke="${b.t.text}" stroke-dasharray="5 4" stroke-width="1.5"/>` + txt(b.x + b.w, y - 6, f.refLabel || `Average ${fmt(f.ref, 1)}`, { size: 11, fill: b.t.text, anchor: "end", weight: 600 }); }
    if (f.callout !== undefined && items[f.callout]) {
      const it = items[f.callout], cx = left + f.callout * bw + bw / 2, cy = Y(it.value);
      const text = f.calloutText || `${it.label}: ${fmt(it.value)}`, tw = Math.min(260, text.length * charW(11.5) + 20);
      const bx = Math.min(Math.max(left, cx - tw / 2), b.x + b.w - tw), by = Math.max(b.y, cy - 52);
      s += `<line x1="${r1(cx)}" x2="${r1(cx)}" y1="${r1(by + 24)}" y2="${r1(cy - 3)}" stroke="${b.t.accent}"/><rect x="${r1(bx)}" y="${r1(by)}" width="${r1(tw)}" height="24" fill="${b.t.accent}"/>` + txt(bx + tw / 2, by + 16, text, { size: 11.5, fill: b.t.onAccent, anchor: "middle", weight: 700 });
    }
    return s;
  });
}

// ------------------------------------------------------------------ 3. Combo bar + line

export function combo(items: { label: string; bar: number; line: number; drill?: unknown }[], f: Frame & { barName?: string; lineName?: string; lineFmt?: (n: number) => string } = {}) {
  return frame(f, (b) => {
    const bb = { ...b, y: b.y + 14, h: b.h - 14 };
    const maxB = niceMax(Math.max(1, ...items.map((i) => i.bar)) * 1.1), maxL = niceMax(Math.max(1, ...items.map((i) => i.line)) * 1.1);
    const left = b.x + 40, right = b.x + b.w - 44, ph = bb.h - 22, bw = (right - left) / Math.max(1, items.length);
    let s = legend(b, [f.barName || "Records", f.lineName || "Average"], [b.t.series[0], b.t.accent], b.y + 4) + yAxis({ ...bb, h: ph, w: right - b.x }, maxB, left);
    for (let i = 0; i <= 4; i++) s += txt(right + 6, bb.y + ph - (ph * i) / 4 + 4, (f.lineFmt || fmt)((maxL * i) / 4), { size: 10.5, fill: b.t.accent });
    const pts: string[] = [];
    const every = Math.ceil(items.length / 12);
    items.forEach((it, i) => {
      const x = left + i * bw, h = (it.bar / maxB) * ph;
      s += `<rect x="${r1(x + bw * 0.15)}" y="${r1(bb.y + ph - h)}" width="${r1(bw * 0.7)}" height="${r1(h)}" fill="${b.t.series[0]}"${mk(`${it.label}: ${fmt(it.bar)} ${f.barName || "records"}, ${(f.lineFmt || fmt)(it.line)} ${f.lineName || "average"}`, it.drill)}/>`;
      pts.push(`${r1(x + bw / 2)},${r1(bb.y + ph - (it.line / maxL) * ph)}`);
      if (i % every === 0) s += txt(x + bw / 2, bb.y + ph + 15, clip(it.label, bw * every), { size: 10.5, fill: b.t.muted, anchor: "middle" });
    });
    s += `<polyline points="${pts.join(" ")}" fill="none" stroke="${b.t.accent}" stroke-width="2.5"/>` + pts.map((p) => `<circle cx="${p.split(",")[0]}" cy="${p.split(",")[1]}" r="3.5" fill="${b.t.accent}"/>`).join("");
    return s;
  });
}

// ------------------------------------------------------------------ 4/5. Grouped, stacked and 100% stacked bars

export interface Group { label: string; values: number[]; drill?: unknown }

export function groupedBars(groups: Group[], series: string[], f: Frame = {}) {
  return frame(f, (b) => {
    const bb = { ...b, y: b.y + 14, h: b.h - 14 };
    const max = niceMax(Math.max(1, ...groups.flatMap((g) => g.values)) * 1.12), left = b.x + 40, ph = bb.h - 22;
    const gw = (b.x + b.w - left) / Math.max(1, groups.length), bw = (gw * 0.76) / series.length;
    let s = legend(b, series, b.t.series, b.y + 4) + yAxis({ ...bb, h: ph }, max, left);
    groups.forEach((g, gi) => {
      g.values.forEach((v, si) => {
        const x = left + gi * gw + gw * 0.12 + si * bw, h = (v / max) * ph;
        s += `<rect x="${r1(x)}" y="${r1(bb.y + ph - h)}" width="${r1(bw - 2)}" height="${r1(h)}" fill="${b.t.series[si % 4]}"${mk(`${g.label} - ${series[si]}: ${fmt(v)}`, g.drill)}/>`;
        if (groups.length * series.length <= 24 && v) s += txt(x + bw / 2 - 1, bb.y + ph - h - 4, fmt(v), { size: 10, fill: b.t.text, anchor: "middle" });
      });
      s += txt(left + gi * gw + gw / 2, bb.y + ph + 15, clip(g.label, gw), { size: 10.5, fill: b.t.muted, anchor: "middle" });
    });
    return s;
  });
}

export function stackedBars(groups: Group[], series: string[], f: Frame & { percent?: boolean } = {}) {
  return frame(f, (b) => {
    const bb = { ...b, y: b.y + 14, h: b.h - 14 };
    const totals = groups.map((g) => g.values.reduce((a, c) => a + c, 0));
    const max = f.percent ? 1 : niceMax(Math.max(1, ...totals) * 1.1), left = b.x + 44, ph = bb.h - 22;
    const gw = (b.x + b.w - left) / Math.max(1, groups.length), bw = Math.min(64, gw * 0.62);
    let s = legend(b, series, b.t.series, b.y + 4) + yAxis({ ...bb, h: ph }, max, left, { fmt: f.percent ? (n) => pct(n) : fmt });
    groups.forEach((g, gi) => {
      let acc = 0;
      const x = left + gi * gw + (gw - bw) / 2;
      g.values.forEach((v, si) => {
        const val = f.percent ? (totals[gi] ? v / totals[gi] : 0) : v;
        const h = (val / max) * ph, y = bb.y + ph - ((acc + val) / max) * ph;
        acc += val;
        s += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(bw)}" height="${r1(Math.max(0, h))}" fill="${b.t.series[si % 4]}" stroke="${b.t.bg}" stroke-width="1"${mk(`${g.label} - ${series[si]}: ${fmt(v)}${f.percent ? ` (${pct(val)})` : ""}`, g.drill)}/>`;
        if (h > 14) s += txt(x + bw / 2, y + h / 2 + 4, f.percent ? pct(val) : fmt(v), { size: 10, fill: si === 3 ? "#0E2F3C" : "#FFFFFF", anchor: "middle", weight: 600 });
      });
      if (!f.percent) s += txt(x + bw / 2, bb.y + ph - (totals[gi] / max) * ph - 5, fmt(totals[gi]), { size: 10.5, fill: b.t.text, anchor: "middle", weight: 700 });
      s += txt(x + bw / 2, bb.y + ph + 15, clip(g.label, gw), { size: 10.5, fill: b.t.muted, anchor: "middle" });
    });
    return s;
  });
}

// ------------------------------------------------------------------ 6. Diverging stacked bars

export function diverging(items: { label: string; left: number; right: number; drill?: unknown }[], f: Frame & { leftName?: string; rightName?: string } = {}) {
  const rows = items.slice(0, 14);
  return frame({ height: Math.max(240, 140 + rows.length * 28), ...f }, (b) => {
    const labelW = Math.min(170, b.w * 0.28), cx = b.x + labelW + (b.w - labelW) / 2, half = (b.w - labelW) / 2 - 40;
    const max = Math.max(1, ...rows.flatMap((r) => [r.left, r.right]));
    const rowH = (b.h - 20) / Math.max(1, rows.length), bh = Math.min(18, rowH * 0.66);
    let s = txt(cx - 8, b.y + 10, f.leftName || "Incoming", { size: 11, fill: b.t.series[1], anchor: "end", weight: 700 }) + txt(cx + 8, b.y + 10, f.rightName || "Outgoing", { size: 11, fill: b.t.series[0], weight: 700 });
    s += `<line x1="${cx}" x2="${cx}" y1="${b.y + 16}" y2="${b.y + b.h}" stroke="${b.t.axis}"/>`;
    rows.forEach((r, i) => {
      const y = b.y + 20 + i * rowH + (rowH - bh) / 2, wl = (r.left / max) * half, wr = (r.right / max) * half;
      s += txt(b.x + labelW - 8, y + bh / 2 + 4, clip(r.label, labelW - 10), { size: 11.5, fill: b.t.text, anchor: "end" });
      s += `<rect x="${r1(cx - wl)}" y="${r1(y)}" width="${r1(wl)}" height="${r1(bh)}" fill="${b.t.series[1]}"${mk(`${r.label} - ${f.leftName || "incoming"}: ${fmt(r.left)}`, r.drill)}/>`;
      s += `<rect x="${cx}" y="${r1(y)}" width="${r1(wr)}" height="${r1(bh)}" fill="${b.t.series[0]}"${mk(`${r.label} - ${f.rightName || "outgoing"}: ${fmt(r.right)}`, r.drill)}/>`;
      s += txt(cx - wl - 5, y + bh / 2 + 4, fmt(r.left), { size: 10.5, fill: b.t.muted, anchor: "end" }) + txt(cx + wr + 5, y + bh / 2 + 4, fmt(r.right), { size: 10.5, fill: b.t.muted });
    });
    return s;
  });
}

// ------------------------------------------------------------------ 7. Waterfall / bridge

export function waterfall(steps: { label: string; value: number; kind: "start" | "delta" | "total" }[], f: Frame = {}) {
  return frame(f, (b) => {
    let run = 0; const bars: { label: string; y0: number; y1: number; v: number; kind: string }[] = [];
    for (const st of steps) {
      if (st.kind === "delta") { bars.push({ label: st.label, y0: run, y1: run + st.value, v: st.value, kind: st.value < 0 ? "neg" : "pos" }); run += st.value; }
      else { if (st.kind === "start") run = st.value; bars.push({ label: st.label, y0: 0, y1: st.kind === "total" ? run : st.value, v: st.kind === "total" ? run : st.value, kind: "total" }); }
    }
    const max = niceMax(Math.max(1, ...bars.map((x) => Math.max(x.y0, x.y1))) * 1.12), left = b.x + 40, ph = b.h - 22;
    const bw = (b.x + b.w - left) / Math.max(1, bars.length), Y = (v: number) => b.y + ph - (v / max) * ph;
    let s = yAxis({ ...b, h: ph }, max, left);
    bars.forEach((x, i) => {
      const xx = left + i * bw + bw * 0.18, w = bw * 0.64, top = Y(Math.max(x.y0, x.y1)), h = Math.abs(Y(x.y0) - Y(x.y1));
      const c = x.kind === "total" ? b.t.series[1] : x.kind === "neg" ? b.t.neg : b.t.series[0];
      s += `<rect x="${r1(xx)}" y="${r1(top)}" width="${r1(w)}" height="${r1(Math.max(1, h))}" fill="${c}"${mk(`${x.label}: ${x.kind === "total" ? fmt(x.v) : (x.v > 0 ? "+" : "") + fmt(x.v)}`)}/>`;
      s += txt(xx + w / 2, top - 5, x.kind === "total" ? fmt(x.v) : x.v < 0 ? `(${fmt(-x.v)})` : `+${fmt(x.v)}`, { size: 11, fill: x.kind === "neg" ? b.t.neg : b.t.text, anchor: "middle", weight: 700 });
      if (i < bars.length - 1) { const yE = Y(x.kind === "total" ? x.y1 : x.y1); s += `<line x1="${r1(xx + w)}" x2="${r1(xx + bw)}" y1="${r1(yE)}" y2="${r1(yE)}" stroke="${b.t.axis}" stroke-dasharray="3 3"/>`; }
      s += txt(xx + w / 2, b.y + ph + 15, clip(x.label, bw), { size: 10.5, fill: b.t.muted, anchor: "middle" });
    });
    return s;
  });
}

// ------------------------------------------------------------------ 8. Marimekko

export function marimekko(cols: { label: string; parts: { label: string; value: number }[]; drill?: unknown }[], f: Frame = {}) {
  return frame(f, (b) => {
    const total = cols.reduce((s, c) => s + c.parts.reduce((a, p) => a + p.value, 0), 0) || 1;
    const names = [...new Set(cols.flatMap((c) => c.parts.map((p) => p.label)))];
    const bb = { ...b, y: b.y + 16, h: b.h - 36 };
    let s = legend(b, names.slice(0, 4), b.t.series, b.y + 4), x = b.x;
    for (const c of cols) {
      const ct = c.parts.reduce((a, p) => a + p.value, 0), w = (ct / total) * b.w;
      let y = bb.y;
      for (const p of c.parts) {
        const h = ct ? (p.value / ct) * bb.h : 0, si = names.indexOf(p.label);
        s += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(Math.max(0, w - 2))}" height="${r1(Math.max(0, h - 2))}" fill="${b.t.series[si % 4]}"${mk(`${c.label} - ${p.label}: ${fmt(p.value)} (${pct(ct ? p.value / ct : 0)} of column)`, c.drill)}/>`;
        if (h > 16 && w > 34) s += txt(x + w / 2, y + h / 2 + 4, pct(ct ? p.value / ct : 0), { size: 10.5, fill: si % 4 === 3 ? "#0E2F3C" : "#FFFFFF", anchor: "middle", weight: 600 });
        y += h;
      }
      s += txt(x + w / 2, bb.y + bb.h + 15, clip(`${c.label} (${pct(ct / total)})`, w), { size: 10.5, fill: b.t.muted, anchor: "middle" });
      x += w;
    }
    return s;
  });
}

// ------------------------------------------------------------------ 9. Treemap (squarified)

export function treemap(items: Item[], f: Frame & { highlight?: number } = {}) {
  return frame(f, (b) => {
    const data = items.filter((i) => i.value > 0).sort((a, c) => c.value - a.value).slice(0, 30);
    const total = data.reduce((s, i) => s + i.value, 0) || 1;
    const rects: { i: number; x: number; y: number; w: number; h: number }[] = [];
    const scale = (b.w * b.h) / total;
    let rx = b.x, ry = b.y, rw = b.w, rh = b.h, idx = 0;
    const worst = (row: number[], side: number) => { const s = row.reduce((a, c) => a + c, 0); const mx = Math.max(...row), mn = Math.min(...row); return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn)); };
    while (idx < data.length) {
      const side = Math.min(rw, rh); const row: number[] = [];
      let j = idx;
      while (j < data.length) { const next = [...row, data[j].value * scale]; if (row.length && worst(next, side) > worst(row, side)) break; row.push(data[j].value * scale); j++; }
      const sum = row.reduce((a, c) => a + c, 0);
      if (rw >= rh) { const w = sum / rh; let y = ry; row.forEach((a, k) => { const h = a / w; rects.push({ i: idx + k, x: rx, y, w, h }); y += h; }); rx += w; rw -= w; }
      else { const h = sum / rw; let x = rx; row.forEach((a, k) => { const w = a / h; rects.push({ i: idx + k, x, y: ry, w, h }); x += w; }); ry += h; rh -= h; }
      idx = j;
    }
    return rects.map((r) => {
      const it = data[r.i], c = r.i === (f.highlight ?? -1) ? b.t.accent : b.t.series[r.i % 3];
      const lbl = r.w > 60 && r.h > 34 ? txt(r.x + 8, r.y + 18, clip(it.label, r.w - 14), { size: 12, fill: r.i === f.highlight ? b.t.onAccent : "#FFFFFF", weight: 700 }) + txt(r.x + 8, r.y + 33, `${fmt(it.value)} (${pct(it.value / total)})`, { size: 10.5, fill: r.i === f.highlight ? b.t.onAccent : "#FFFFFF" }) : "";
      return `<rect x="${r1(r.x)}" y="${r1(r.y)}" width="${r1(Math.max(0, r.w - 2))}" height="${r1(Math.max(0, r.h - 2))}" fill="${c}"${mk(`${it.label}: ${fmt(it.value)} (${pct(it.value / total, 1)})`, it.drill)}/>` + lbl;
    }).join("");
  });
}

// ------------------------------------------------------------------ 10. Funnel

export function funnel(stages: Item[], f: Frame & { highlight?: number } = {}) {
  return frame({ height: Math.max(260, 130 + stages.length * 46), ...f }, (b) => {
    const max = Math.max(1, ...stages.map((s) => s.value)), sh = b.h / Math.max(1, stages.length), cx = b.x + b.w * 0.36, half = b.w * 0.32;
    return stages.map((st, i) => {
      const w0 = (st.value / max) * half, w1 = ((stages[i + 1]?.value ?? st.value * 0.85) / max) * half, y = b.y + i * sh, h = sh - 6;
      const c = i === f.highlight ? b.t.accent : b.t.series[Math.min(3, i % 4)];
      const prev = i ? stages[i - 1].value : 0;
      return `<path d="M${r1(cx - w0)} ${r1(y)}H${r1(cx + w0)}L${r1(cx + Math.max(w1, 6))} ${r1(y + h)}H${r1(cx - Math.max(w1, 6))}Z" fill="${c}"${mk(`${st.label}: ${fmt(st.value)}${i ? ` (${pct(prev ? st.value / prev : 0)} of previous step)` : ""}`, st.drill)}/>` +
        txt(cx, y + h / 2 + 5, fmt(st.value), { size: 13, fill: i === f.highlight || c === b.t.series[3] ? "#0E2F3C" : "#FFFFFF", anchor: "middle", weight: 700 }) +
        txt(cx + half + 16, y + h / 2 - 2, st.label, { size: 12, fill: b.t.text, weight: 600 }) +
        (i ? txt(cx + half + 16, y + h / 2 + 13, `${pct(prev ? st.value / prev : 0)} of previous`, { size: 10.5, fill: b.t.muted }) : "");
    }).join("");
  });
}

// ------------------------------------------------------------------ 11. Dumbbell and 12. Slopegraph

export function dumbbell(items: { label: string; a: number; b: number; drill?: unknown }[], f: Frame & { aName?: string; bName?: string } = {}) {
  const rows = items.slice(0, 14);
  return frame({ height: Math.max(240, 140 + rows.length * 28), ...f }, (b) => {
    const labelW = Math.min(170, b.w * 0.28), left = b.x + labelW, right = b.x + b.w - 40;
    const max = niceMax(Math.max(1, ...rows.flatMap((r) => [r.a, r.b])) * 1.05), X = (v: number) => left + (v / max) * (right - left);
    const rowH = (b.h - 20) / Math.max(1, rows.length);
    let s = legend(b, [f.aName || "Before", f.bName || "After"], [b.t.series[1], b.t.accent], b.y + 4);
    rows.forEach((r, i) => {
      const y = b.y + 26 + i * rowH + rowH / 2;
      s += `<line x1="${left}" x2="${right}" y1="${r1(y)}" y2="${r1(y)}" stroke="${b.t.grid}"/>` + txt(left - 8, y + 4, clip(r.label, labelW - 10), { size: 11.5, fill: b.t.text, anchor: "end" });
      s += `<line x1="${r1(X(r.a))}" x2="${r1(X(r.b))}" y1="${r1(y)}" y2="${r1(y)}" stroke="${r.b < r.a ? b.t.neg : b.t.series[0]}" stroke-width="3"/>`;
      s += `<circle cx="${r1(X(r.a))}" cy="${r1(y)}" r="6" fill="${b.t.series[1]}"${mk(`${r.label} - ${f.aName || "before"}: ${fmt(r.a)}`, r.drill)}/><circle cx="${r1(X(r.b))}" cy="${r1(y)}" r="6" fill="${b.t.accent}"${mk(`${r.label} - ${f.bName || "after"}: ${fmt(r.b)}`, r.drill)}/>`;
      s += txt(Math.max(X(r.a), X(r.b)) + 10, y + 4, `${r.b - r.a >= 0 ? "+" : ""}${fmt(r.b - r.a)}`, { size: 10.5, fill: r.b < r.a ? b.t.neg : b.t.muted });
    });
    return s;
  });
}

export function slopegraph(items: { label: string; a: number; b: number; drill?: unknown }[], f: Frame & { aName?: string; bName?: string; rank?: boolean; highlight?: string } = {}) {
  return frame(f, (b) => {
    const rows = items.slice(0, 12);
    const xa = b.x + b.w * 0.3, xb = b.x + b.w * 0.7;
    const vals = rows.flatMap((r) => [r.a, r.b]), lo = Math.min(...vals), hi = Math.max(...vals);
    const Y = (v: number) => (f.rank ? b.y + 24 + ((v - 1) / Math.max(1, hi - 1)) * (b.h - 40) : b.y + 24 + (1 - (v - lo) / Math.max(1, hi - lo)) * (b.h - 40));
    let s = txt(xa, b.y + 8, f.aName || "Period A", { size: 11, fill: b.t.muted, anchor: "middle", weight: 700, ls: 1 }) + txt(xb, b.y + 8, f.bName || "Period B", { size: 11, fill: b.t.muted, anchor: "middle", weight: 700, ls: 1 });
    s += `<line x1="${xa}" x2="${xa}" y1="${b.y + 16}" y2="${b.y + b.h}" stroke="${b.t.axis}"/><line x1="${xb}" x2="${xb}" y1="${b.y + 16}" y2="${b.y + b.h}" stroke="${b.t.axis}"/>`;
    for (const r of rows) {
      const hl = r.label === f.highlight, c = hl ? b.t.accent : (f.rank ? r.b > r.a : r.b < r.a) ? b.t.neg : b.t.series[0];
      const show = (v: number) => (f.rank ? `#${v}` : fmt(v));
      s += `<line x1="${xa}" x2="${xb}" y1="${r1(Y(r.a))}" y2="${r1(Y(r.b))}" stroke="${c}" stroke-width="${hl ? 3 : 2}"${mk(`${r.label}: ${show(r.a)} to ${show(r.b)}`, r.drill)}/>`;
      s += `<circle cx="${xa}" cy="${r1(Y(r.a))}" r="4" fill="${c}"/><circle cx="${xb}" cy="${r1(Y(r.b))}" r="4" fill="${c}"/>`;
      s += txt(xa - 10, Y(r.a) + 4, `${clip(r.label, b.w * 0.24 - 40, 11)} ${show(r.a)}`, { size: 11, fill: hl ? b.t.accent : b.t.text, anchor: "end" });
      s += txt(xb + 10, Y(r.b) + 4, `${show(r.b)} ${clip(r.label, b.w * 0.24 - 40, 11)}`, { size: 11, fill: hl ? b.t.accent : b.t.text });
    }
    return s;
  });
}

// ------------------------------------------------------------------ 13. Bullet charts and progress bars

export function bullets(items: { label: string; value: number; target: number; ranges?: number[]; unit?: string }[], f: Frame = {}) {
  return frame({ height: Math.max(200, 120 + items.length * 46), ...f }, (b) => {
    const labelW = Math.min(180, b.w * 0.3), left = b.x + labelW, w = b.w - labelW - 60, rowH = b.h / Math.max(1, items.length);
    return items.map((it, i) => {
      const max = Math.max(it.value, it.target, ...(it.ranges || [])) * 1.1 || 1, y = b.y + i * rowH + rowH / 2 - 10, X = (v: number) => left + (v / max) * w;
      const rg = (it.ranges || [max * 0.5, max * 0.8, max]).map((v, k) => `<rect x="${left}" y="${r1(y)}" width="${r1(X(v) - left)}" height="20" fill="${b.t.panel}" opacity="${[0.55, 0.8, 1][k] ?? 1}"/>`).reverse().join("");
      const over = it.value > it.target;
      return txt(left - 10, y + 14, clip(it.label, labelW - 12), { size: 12, fill: b.t.text, anchor: "end" }) + rg +
        `<rect x="${left}" y="${r1(y + 6)}" width="${r1(X(it.value) - left)}" height="8" fill="${over ? b.t.accent : b.t.series[0]}"${mk(`${it.label}: ${fmt(it.value, 1)}${it.unit || ""} against ${fmt(it.target, 1)}${it.unit || ""}`)}/>` +
        `<rect x="${r1(X(it.target) - 1.5)}" y="${r1(y - 3)}" width="3" height="26" fill="${b.t.text}"/>` + txt(X(Math.max(it.value, it.target)) + 10, y + 14, `${fmt(it.value, 1)}${it.unit || ""}`, { size: 12, fill: over ? b.t.accent : b.t.text, weight: 700 });
    }).join("");
  });
}

export function progressBars(items: { label: string; value: number; max: number }[], f: Frame = {}) {
  return frame({ height: Math.max(180, 110 + items.length * 40), ...f }, (b) => {
    const rowH = b.h / Math.max(1, items.length);
    return items.map((it, i) => {
      const y = b.y + i * rowH + 4, p = it.max ? Math.min(1, it.value / it.max) : 0;
      return txt(b.x, y + 10, it.label, { size: 12, fill: b.t.text }) + txt(b.x + b.w, y + 10, pct(p), { size: 12, fill: b.t.text, anchor: "end", weight: 700 }) +
        `<rect x="${b.x}" y="${r1(y + 18)}" width="${b.w}" height="8" fill="${b.t.panel}"/><rect x="${b.x}" y="${r1(y + 18)}" width="${r1(b.w * p)}" height="8" fill="${p >= 1 ? b.t.ok : b.t.series[0]}"${mk(`${it.label}: ${fmt(it.value)} of ${fmt(it.max)}`)}/>`;
    }).join("");
  });
}

// ------------------------------------------------------------------ 14. Waffle 10x10

export function waffle(share: number, f: Frame & { label?: string; restLabel?: string } = {}) {
  return frame({ height: 400, ...f }, (b) => {
    const n = Math.round(Math.max(0, Math.min(1, share)) * 100), cell = Math.min((b.h - 8) / 10, (b.w * 0.5) / 10), g = 3;
    let s = "";
    for (let i = 0; i < 100; i++) {
      const col = i % 10, row = 9 - Math.floor(i / 10);
      s += `<rect x="${r1(b.x + col * cell)}" y="${r1(b.y + row * cell)}" width="${r1(cell - g)}" height="${r1(cell - g)}" fill="${i < n ? b.t.accent : b.t.panel}"/>`;
    }
    const tx = b.x + cell * 10 + 28;
    s += `<g${mk(`${f.label || "Share"}: ${n}%`)}><text x="${r1(tx)}" y="${r1(b.y + 60)}" font-size="56" font-weight="800" fill="${b.t.accent}">${n}%</text></g>` + txt(tx, b.y + 88, f.label || "of records", { size: 14, fill: b.t.text, weight: 600 }) +
      `<rect x="${r1(tx)}" y="${r1(b.y + 112)}" width="12" height="12" fill="${b.t.panel}"/>` + txt(tx + 18, b.y + 122, `${100 - n}% ${f.restLabel || "other"}`, { size: 12, fill: b.t.muted });
    return s;
  });
}

// ------------------------------------------------------------------ 15. Bubble / quadrant scatter

export function quadrant(points: { label: string; x: number; y: number; r?: number; drill?: unknown }[], f: Frame & { xLabel?: string; yLabel?: string; xSplit?: number; ySplit?: number; names?: [string, string, string, string]; highlight?: string; log?: boolean } = {}) {
  return frame({ height: 460, ...f }, (b) => {
    const tf = (v: number) => (f.log ? Math.log10(Math.max(1, v)) : v);
    const xs = points.map((p) => tf(p.x)), ys = points.map((p) => tf(p.y));
    const xmax = Math.max(1, ...xs) * 1.08, ymax = Math.max(1, ...ys) * 1.08, rmax = Math.max(1, ...points.map((p) => p.r || 1));
    const left = b.x + 44, bottom = b.y + b.h - 24, X = (v: number) => left + (tf(v) / xmax) * (b.x + b.w - left), Y = (v: number) => bottom - (tf(v) / ymax) * (bottom - b.y);
    const xs0 = X(f.xSplit ?? median(points.map((p) => p.x))), ys0 = Y(f.ySplit ?? median(points.map((p) => p.y)));
    const names = f.names || ["Frequent but short", "Frequent and long - key contacts", "Occasional and short", "Occasional but long"];
    let s = `<rect x="${r1(xs0)}" y="${b.y}" width="${r1(b.x + b.w - xs0)}" height="${r1(ys0 - b.y)}" fill="${b.t.accent}" opacity="0.08"/>`;
    s += `<line x1="${r1(xs0)}" x2="${r1(xs0)}" y1="${b.y}" y2="${bottom}" stroke="${b.t.axis}" stroke-dasharray="4 4"/><line x1="${left}" x2="${b.x + b.w}" y1="${r1(ys0)}" y2="${r1(ys0)}" stroke="${b.t.axis}" stroke-dasharray="4 4"/>`;
    s += `<line x1="${left}" x2="${b.x + b.w}" y1="${bottom}" y2="${bottom}" stroke="${b.t.axis}"/><line x1="${left}" x2="${left}" y1="${b.y}" y2="${bottom}" stroke="${b.t.axis}"/>`;
    // Quadrant names: top-left = high y low x, top-right = high both, bottom-left = low both, bottom-right = high x low y
    s += txt(left + 8, b.y + 14, names[3], { size: 10.5, fill: b.t.muted, weight: 700, ls: 0.6 });
    s += txt(b.x + b.w - 8, b.y + 14, names[1], { size: 10.5, fill: b.t.accent, anchor: "end", weight: 700, ls: 0.6 });
    s += txt(left + 8, bottom - 8, names[2], { size: 10.5, fill: b.t.muted, weight: 700, ls: 0.6 });
    s += txt(b.x + b.w - 8, bottom - 8, names[0], { size: 10.5, fill: b.t.muted, anchor: "end", weight: 700, ls: 0.6 });
    s += txt((left + b.x + b.w) / 2, bottom + 18, f.xLabel || "Records", { size: 11, fill: b.t.muted, anchor: "middle" });
    s += `<text transform="translate(${b.x + 10} ${(b.y + bottom) / 2}) rotate(-90)" font-size="11" fill="${b.t.muted}" text-anchor="middle">${esc(f.yLabel || "Talk time")}</text>`;
    const sorted = [...points].sort((p, q) => (q.r || 1) - (p.r || 1));
    for (const p of sorted) {
      const rr = 4 + 16 * Math.sqrt((p.r || 1) / rmax), hl = p.label === f.highlight, key = p.x >= (f.xSplit ?? 0) && X(p.x) >= xs0 && Y(p.y) <= ys0;
      s += `<circle cx="${r1(X(p.x))}" cy="${r1(Y(p.y))}" r="${r1(rr)}" fill="${hl ? b.t.accent : key ? b.t.series[0] : b.t.series[1]}" fill-opacity="0.78" stroke="${b.t.bg}"${mk(`${p.label}: ${fmt(p.x)} ${f.xLabel || "records"}, ${fmt(p.y)} ${f.yLabel || "talk time"}${p.r ? `, ${fmt(p.r)} days` : ""}`, p.drill)}/>`;
      if (hl || (key && rr > 9)) s += txt(X(p.x) + rr + 4, Y(p.y) + 4, clip(p.label, 120, 10.5), { size: 10.5, fill: hl ? b.t.accent : b.t.text });
    }
    return s;
  });
}
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// ------------------------------------------------------------------ 16. Heat map grid and risk matrix

export function heatGrid(rows: string[], cols: string[], m: number[][], f: Frame & { drill?: (r: number, c: number) => unknown; colLabelEvery?: number } = {}) {
  return frame({ height: Math.max(260, 140 + rows.length * 30), ...f }, (b) => {
    const lw = 46, cw = (b.w - lw) / Math.max(1, cols.length), rh = (b.h - 20) / Math.max(1, rows.length);
    const max = Math.max(1, ...m.flat());
    let s = "";
    const every = f.colLabelEvery || (cols.length > 12 ? 2 : 1);
    cols.forEach((c, j) => { if (j % every === 0) s += txt(b.x + lw + j * cw + cw / 2, b.y + 10, c, { size: 10, fill: b.t.muted, anchor: "middle" }); });
    rows.forEach((r, i) => {
      s += txt(b.x + lw - 8, b.y + 20 + i * rh + rh / 2 + 4, r, { size: 11, fill: b.t.text, anchor: "end" });
      cols.forEach((c, j) => {
        const v = m[i]?.[j] || 0, a = v ? 0.15 + 0.85 * (v / max) : 0;
        s += `<rect x="${r1(b.x + lw + j * cw)}" y="${r1(b.y + 20 + i * rh)}" width="${r1(cw - 2)}" height="${r1(rh - 2)}" fill="${v === max ? b.t.accent : b.t.series[0]}" fill-opacity="${v === max ? 1 : r1(a * 100) / 100 || 0.04}"${mk(`${r} ${c}: ${fmt(v)}`, f.drill?.(i, j))}/>`;
        if (cw > 26 && v) s += txt(b.x + lw + j * cw + cw / 2 - 1, b.y + 20 + i * rh + rh / 2 + 3, fmt(v), { size: 9.5, fill: a > 0.55 || v === max ? "#FFFFFF" : b.t.muted, anchor: "middle" });
      });
    });
    return s;
  });
}

export function riskMatrix(items: { label: string; likelihood: number; impact: number; drill?: unknown }[], f: Frame = {}) {
  return frame({ height: 460, ...f }, (b) => {
    const size = Math.min(b.h - 30, b.w - 160), cell = size / 5, x0 = b.x + 40, y0 = b.y;
    let s = "";
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const score = (j + 1) * (5 - i), c = score >= 15 ? b.t.neg : score >= 8 ? b.t.accent : b.t.series[0];
      s += `<rect x="${r1(x0 + j * cell)}" y="${r1(y0 + i * cell)}" width="${r1(cell - 3)}" height="${r1(cell - 3)}" fill="${c}" fill-opacity="0.28"/>`;
    }
    s += txt(x0 + size / 2, y0 + size + 18, "Likelihood", { size: 11, fill: b.t.muted, anchor: "middle" }) + `<text transform="translate(${b.x + 12} ${y0 + size / 2}) rotate(-90)" font-size="11" fill="${b.t.muted}" text-anchor="middle">Impact</text>`;
    const placed = new Map<string, number>();
    for (const it of items) {
      const L = Math.max(1, Math.min(5, Math.round(it.likelihood))), I = Math.max(1, Math.min(5, Math.round(it.impact))), k = `${L}|${I}`, n = placed.get(k) || 0; placed.set(k, n + 1);
      const cx = x0 + (L - 1) * cell + cell / 2 + ((n % 3) - 1) * 14, cy = y0 + (5 - I) * cell + cell / 2 + Math.floor(n / 3) * 14;
      s += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="6" fill="${b.t.text}"${mk(`${it.label}: likelihood ${L}, impact ${I}`, it.drill)}/>`;
    }
    const lx = x0 + size + 20;
    items.slice(0, 10).forEach((it, i) => (s += txt(lx, y0 + 14 + i * 18, `${clip(it.label, b.x + b.w - lx - 40, 11)}  L${Math.round(it.likelihood)} I${Math.round(it.impact)}`, { size: 11, fill: b.t.text })));
    return s;
  });
}

// ------------------------------------------------------------------ 17. Gantt and 18. milestone timeline

export interface GanttRow { label: string; spans: { from: number; to: number; label?: string; highlight?: boolean; drill?: unknown }[]; milestones?: { at: number; label: string }[] }

const dayLabel = (ms: number) => new Date(ms + 330 * 60000).toISOString().slice(0, 10);

export function gantt(rows: GanttRow[], f: Frame & { today?: number; todayLabel?: string; fmtTime?: (ms: number) => string } = {}) {
  const R = rows.slice(0, 16);
  return frame({ height: Math.max(220, 140 + R.length * 30), ...f }, (b) => {
    const all = R.flatMap((r) => [...r.spans.flatMap((s) => [s.from, s.to]), ...(r.milestones || []).map((m) => m.at)]).concat(f.today ? [f.today] : []);
    const lo = Math.min(...all), hi = Math.max(...all, lo + 86_400_000), labelW = Math.min(170, b.w * 0.26), left = b.x + labelW, right = b.x + b.w - 10;
    const X = (t: number) => left + ((t - lo) / (hi - lo)) * (right - left), rowH = (b.h - 24) / Math.max(1, R.length), F = f.fmtTime || dayLabel;
    let s = "";
    for (let i = 0; i <= 4; i++) { const t = lo + ((hi - lo) * i) / 4, x = X(t); s += `<line x1="${r1(x)}" x2="${r1(x)}" y1="${b.y + 16}" y2="${b.y + b.h}" stroke="${b.t.grid}"/>` + txt(x, b.y + 10, F(t), { size: 10, fill: b.t.muted, anchor: i === 0 ? "start" : i === 4 ? "end" : "middle" }); }
    R.forEach((r, i) => {
      const y = b.y + 24 + i * rowH, bh = Math.min(16, rowH * 0.6);
      s += txt(left - 8, y + rowH / 2 + 4, clip(r.label, labelW - 10), { size: 11.5, fill: b.t.text, anchor: "end" });
      r.spans.forEach((sp, k) => {
        const x0 = X(sp.from), w = Math.max(3, X(sp.to) - x0);
        s += `<rect x="${r1(x0)}" y="${r1(y + (rowH - bh) / 2)}" width="${r1(w)}" height="${r1(bh)}" fill="${sp.highlight ? b.t.accent : b.t.series[k % 3]}"${mk(`${r.label}${sp.label ? ` - ${sp.label}` : ""}: ${F(sp.from)} to ${F(sp.to)}`, sp.drill)}/>`;
        if (sp.label && w > sp.label.length * 6 + 8) s += txt(x0 + 5, y + rowH / 2 + 4, sp.label, { size: 10, fill: "#FFFFFF" });
      });
      for (const m of r.milestones || []) { const x = X(m.at), cy = y + rowH / 2; s += `<path d="M${r1(x)} ${r1(cy - 7)}L${r1(x + 7)} ${r1(cy)}L${r1(x)} ${r1(cy + 7)}L${r1(x - 7)} ${r1(cy)}Z" fill="${b.t.accent}" stroke="${b.t.bg}"${mk(`${r.label} - ${m.label}: ${F(m.at)}`)}/>`; }
    });
    if (f.today) { const x = X(f.today); s += `<line x1="${r1(x)}" x2="${r1(x)}" y1="${b.y + 16}" y2="${b.y + b.h}" stroke="${b.t.neg}" stroke-width="2"/>` + txt(x + 4, b.y + b.h - 4, f.todayLabel || "Today", { size: 10.5, fill: b.t.neg, weight: 700 }); }
    return s;
  });
}

export function milestones(events: { at: number; label: string; detail?: string; highlight?: boolean; drill?: unknown }[], f: Frame & { fmtTime?: (ms: number) => string } = {}) {
  const ev = [...events].sort((a, c) => a.at - c.at).slice(0, 10);
  return frame({ height: 400, ...f }, (b) => {
    const mid = b.y + b.h / 2, F = f.fmtTime || dayLabel;
    const lo = ev[0]?.at ?? 0, hi = ev[ev.length - 1]?.at ?? 1, X = (i: number) => b.x + 40 + (i / Math.max(1, ev.length - 1)) * (b.w - 80);
    let s = `<line x1="${b.x}" x2="${b.x + b.w}" y1="${r1(mid)}" y2="${r1(mid)}" stroke="${b.t.axis}" stroke-width="2"/>`;
    const cw = Math.min(150, (b.w / Math.max(1, ev.length)) * 1.8);
    ev.forEach((e, i) => {
      const x = X(i), up = i % 2 === 0, cy = up ? mid - 96 : mid + 22, c = e.highlight ? b.t.accent : b.t.series[0];
      s += `<line x1="${r1(x)}" x2="${r1(x)}" y1="${r1(mid)}" y2="${r1(up ? cy + 74 : cy)}" stroke="${c}"/>`;
      s += `<circle cx="${r1(x)}" cy="${r1(mid)}" r="7" fill="${c}" stroke="${b.t.bg}" stroke-width="2"${mk(`${F(e.at)}: ${e.label}${e.detail ? ` - ${e.detail}` : ""}`, e.drill)}/>`;
      const bx = Math.max(b.x, Math.min(x - cw / 2, b.x + b.w - cw));
      s += `<rect x="${r1(bx)}" y="${r1(cy)}" width="${r1(cw)}" height="74" fill="${b.t.panel}"/><rect x="${r1(bx)}" y="${r1(cy)}" width="3" height="74" fill="${c}"/>`;
      s += txt(bx + 10, cy + 16, F(e.at), { size: 10, fill: b.t.eyebrow, weight: 700, ls: 0.8 });
      wrap(e.label, cw - 16, 11.5).slice(0, 2).forEach((l, k) => (s += txt(bx + 10, cy + 33 + k * 14, l, { size: 11.5, fill: b.t.text, weight: 600 })));
      if (e.detail) s += txt(bx + 10, cy + 66, clip(e.detail, cw - 16, 10), { size: 10, fill: b.t.muted });
    });
    void lo; void hi;
    return s;
  });
}

// ------------------------------------------------------------------ 19. Chevron process bar, 20. cycle and chain wheel, 21. pyramid

export function chevrons(stages: { label: string; done: number; detail?: string; drill?: unknown }[], f: Frame = {}) {
  return frame({ height: 220, ...f }, (b) => {
    const n = stages.length, w = b.w / n, h = 54, y = b.y + 10, tip = 16;
    const overall = stages.reduce((s, x) => s + Math.min(1, x.done), 0) / Math.max(1, n);
    let s = "";
    stages.forEach((st, i) => {
      const x = b.x + i * w, c = st.done >= 1 ? b.t.series[0] : st.done > 0 ? b.t.accent : b.t.panel, fg = st.done > 0 && st.done < 1 ? b.t.onAccent : st.done <= 0 ? b.t.muted : "#FFFFFF";
      s += `<path d="M${r1(x)} ${y}H${r1(x + w - tip)}L${r1(x + w)} ${y + h / 2}L${r1(x + w - tip)} ${y + h}H${r1(x)}L${r1(x + (i ? tip : 0))} ${y + h / 2}Z" fill="${c}" stroke="${b.t.bg}" stroke-width="3"${mk(`${st.label}: ${pct(Math.min(1, st.done))} complete${st.detail ? ` - ${st.detail}` : ""}`, st.drill)}/>`;
      s += txt(x + w / 2 + (i ? tip / 3 : 0), y + h / 2 - 2, clip(st.label, w - tip * 2, 12.5), { size: 12.5, fill: fg, anchor: "middle", weight: 700 }) + txt(x + w / 2 + (i ? tip / 3 : 0), y + h / 2 + 14, pct(Math.min(1, st.done)), { size: 11, fill: fg, anchor: "middle" });
      if (st.detail) s += txt(x + 6, y + h + 20, clip(st.detail, w - 8, 10.5), { size: 10.5, fill: b.t.muted });
    });
    s += `<rect x="${b.x}" y="${y + h + 34}" width="${b.w}" height="6" fill="${b.t.panel}"/><rect x="${b.x}" y="${y + h + 34}" width="${r1(b.w * overall)}" height="6" fill="${b.t.accent}"/>` + txt(b.x + b.w, y + h + 56, `${pct(overall)} of the workflow complete`, { size: 11.5, fill: b.t.text, anchor: "end", weight: 700 });
    return s;
  });
}

export function cycle(steps: string[], f: Frame & { active?: number; wheel?: boolean } = {}) {
  return frame({ height: 420, ...f }, (b) => {
    const n = Math.max(2, Math.min(6, steps.length)), cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.min(b.w, b.h) / 2 - 40;
    let s = "";
    if (f.wheel) {
      // Chain wheel: ring segments with a hub
      const r0 = R * 0.5;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2 - Math.PI / 2 + 0.03, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2 - 0.03;
        const p = (a: number, r: number) => `${r1(cx + Math.cos(a) * r)} ${r1(cy + Math.sin(a) * r)}`;
        const c = i === f.active ? b.t.accent : b.t.series[i % 3];
        s += `<path d="M${p(a0, r0)}L${p(a0, R)}A${R} ${R} 0 0 1 ${p(a1, R)}L${p(a1, r0)}A${r0} ${r0} 0 0 0 ${p(a0, r0)}Z" fill="${c}"${mk(`Step ${i + 1}: ${steps[i]}`)}/>`;
        const am = (a0 + a1) / 2, tr = (R + r0) / 2;
        wrap(steps[i], R * 0.55, 11).slice(0, 2).forEach((l, k) => (s += txt(cx + Math.cos(am) * tr, cy + Math.sin(am) * tr - 4 + k * 13, l, { size: 11, fill: i === f.active ? b.t.onAccent : "#FFFFFF", anchor: "middle", weight: 700 })));
      }
      s += `<circle cx="${cx}" cy="${cy}" r="${r1(r0 - 8)}" fill="${b.t.panel}"/>` + txt(cx, cy + 5, "Case", { size: 15, fill: b.t.text, anchor: "middle", weight: 800 });
      return s;
    }
    s += `<circle cx="${cx}" cy="${cy}" r="${r1(R)}" fill="none" stroke="${b.t.axis}" stroke-width="2" stroke-dasharray="2 6"/>`;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, c = i === f.active ? b.t.accent : b.t.series[0];
      const an = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2, ax = cx + Math.cos(an) * R, ay = cy + Math.sin(an) * R, rot = (an * 180) / Math.PI + 90;
      s += `<path d="M-6 -6L6 0L-6 6Z" transform="translate(${r1(ax)} ${r1(ay)}) rotate(${r1(rot - 90)})" fill="${b.t.axis}"/>`;
      s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="34" fill="${c}"${mk(`Step ${i + 1}: ${steps[i]}`)}/>` + txt(x, y + 6, String(i + 1), { size: 18, fill: i === f.active ? b.t.onAccent : "#FFFFFF", anchor: "middle", weight: 800 });
      const lx = cx + Math.cos(a) * (R + 50), ly = cy + Math.sin(a) * (R + 46);
      s += txt(lx, ly + 4, clip(steps[i], 130, 11.5), { size: 11.5, fill: b.t.text, anchor: Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle", weight: 600 });
    }
    return s;
  });
}

export function pyramid(layers: { label: string; detail?: string; highlight?: boolean }[], f: Frame = {}) {
  return frame({ height: Math.max(280, 140 + layers.length * 52), ...f }, (b) => {
    const n = layers.length, h = b.h / Math.max(1, n), cx = b.x + b.w * 0.32, half = b.w * 0.3;
    return layers.map((l, i) => {
      const y = b.y + i * h, w0 = half * (i / n), w1 = half * ((i + 1) / n), c = l.highlight ? b.t.accent : b.t.series[Math.min(3, i)];
      return `<path d="M${r1(cx - w0)} ${r1(y)}H${r1(cx + w0)}L${r1(cx + w1)} ${r1(y + h - 4)}H${r1(cx - w1)}Z" fill="${c}"${mk(`${l.label}${l.detail ? ` - ${l.detail}` : ""}`)}/>` +
        `<line x1="${r1(cx + w1 * 0.5 + w0 * 0.5 + 6)}" x2="${r1(cx + half + 16)}" y1="${r1(y + h / 2)}" y2="${r1(y + h / 2)}" stroke="${b.t.axis}"/>` +
        txt(cx + half + 24, y + h / 2 - 2, l.label, { size: 12.5, fill: b.t.text, weight: 700 }) + (l.detail ? txt(cx + half + 24, y + h / 2 + 14, clip(l.detail, b.w * 0.36, 10.5), { size: 10.5, fill: b.t.muted }) : "");
    }).join("");
  });
}

// ------------------------------------------------------------------ 22. Harvey-ball matrix

export function harvey(rows: string[], cols: string[], v: number[][], f: Frame & { notes?: string } = {}) {
  return frame({ height: Math.max(240, 150 + rows.length * 36), ...f }, (b) => {
    const lw = Math.min(180, b.w * 0.3), cw = (b.w - lw) / Math.max(1, cols.length), rh = (b.h - 46) / Math.max(1, rows.length), r = Math.min(11, rh / 2 - 3);
    let s = cols.map((c, j) => txt(b.x + lw + j * cw + cw / 2, b.y + 10, c, { size: 11, fill: b.t.muted, anchor: "middle", weight: 700, ls: 0.6 })).join("");
    rows.forEach((row, i) => {
      const y = b.y + 26 + i * rh + rh / 2;
      s += `<line x1="${b.x}" x2="${b.x + b.w}" y1="${r1(y + rh / 2)}" y2="${r1(y + rh / 2)}" stroke="${b.t.grid}"/>` + txt(b.x, y + 4, clip(row, lw - 8), { size: 11.5, fill: b.t.text });
      cols.forEach((c, j) => {
        const q = Math.max(0, Math.min(4, Math.round(v[i]?.[j] || 0))), x = b.x + lw + j * cw + cw / 2;
        let ball = `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="none" stroke="${b.t.series[0]}" stroke-width="1.5"/>`;
        if (q === 4) ball += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${b.t.series[0]}"/>`;
        else if (q > 0) { const a = (q / 4) * Math.PI * 2 - Math.PI / 2; ball += `<path d="M${r1(x)} ${r1(y)}V${r1(y - r)}A${r1(r)} ${r1(r)} 0 ${q > 2 ? 1 : 0} 1 ${r1(x + Math.cos(a) * r)} ${r1(y + Math.sin(a) * r)}Z" fill="${b.t.series[0]}"/>`; }
        s += `<g${mk(`${row} - ${c}: ${["none", "a quarter", "half", "three quarters", "full"][q]}`)}>${ball}</g>`;
      });
    });
    s += txt(b.x, b.y + b.h - 4, f.notes || "Coverage: empty = none, full = complete", { size: 10.5, fill: b.t.muted });
    return s;
  });
}

// ------------------------------------------------------------------ 23. Metric cards (eight variants)

export type CardKind = "value" | "delta" | "sparkline" | "progress" | "benchmark" | "minibar" | "alert" | "dark";
export interface CardData { kind: CardKind; label: string; value: string | number; unit?: string; delta?: number; deltaLabel?: string; series?: number[]; target?: number; benchmark?: number; benchmarkLabel?: string; alert?: string; note?: string; drill?: unknown }

/** A KPI card as SVG (260 x 150), so cards export with the charts. */
export function metricCard(d: CardData, themeName?: ThemeName | Theme): string {
  const t0 = theme(themeName), t = d.kind === "dark" ? THEMES.dark : t0, W = 260, H = 150;
  const bg = d.kind === "dark" ? "#12303C" : t0.name === "dark" ? t0.panel : "#FFFFFF";
  const stroke = d.kind === "alert" ? t.neg : t0.name === "dark" ? "none" : "#D4DEE2";
  const val = typeof d.value === "number" ? fmt(d.value, 1) : d.value;
  let body = "";
  const ser = d.series || [];
  const spark = (x: number, y: number, w: number, h: number) => { if (ser.length < 2) return ""; const mx = Math.max(...ser), mn = Math.min(...ser); const pts = ser.map((v, i) => `${r1(x + (i / (ser.length - 1)) * w)},${r1(y + h - ((v - mn) / (mx - mn || 1)) * h)}`); return `<polyline points="${pts.join(" ")}" fill="none" stroke="${t.series[0]}" stroke-width="2"/><circle cx="${pts[pts.length - 1].split(",")[0]}" cy="${pts[pts.length - 1].split(",")[1]}" r="3.5" fill="${t.accent}"/>`; };
  switch (d.kind) {
    case "delta": { const up = (d.delta || 0) >= 0; body = txt(18, 118, `${up ? "▲" : "▼"} ${up ? "+" : ""}${fmt(d.delta || 0, 1)}${d.deltaLabel || ""}`, { size: 13, fill: up ? t.ok : t.neg, weight: 700 }); break; }
    case "sparkline": body = spark(18, 100, W - 36, 30); break;
    case "progress": { const p = d.target ? Math.min(1, Number(d.value) / d.target) : 0; body = `<rect x="18" y="108" width="${W - 36}" height="8" fill="${t0.name === "dark" ? t.bg : "#EEF4F1"}"/><rect x="18" y="108" width="${r1((W - 36) * p)}" height="8" fill="${t.series[0]}"/>` + txt(18, 134, `${pct(p)} of ${fmt(d.target || 0)}`, { size: 11, fill: t.muted }); break; }
    case "benchmark": { const diff = d.benchmark ? Math.round((Number(d.value) / d.benchmark - 1) * 100) / 100 || 0 : 0; body = txt(18, 118, `${diff >= 0 ? "+" : ""}${pct(diff)} vs ${d.benchmarkLabel || "benchmark"} (${fmt(d.benchmark || 0, 1)})`, { size: 12, fill: diff > 0.25 ? t.accent : t.muted, weight: 600 }); break; }
    case "minibar": { const mx = Math.max(1, ...ser), bw = (W - 36) / Math.max(1, ser.length); body = ser.map((v, i) => `<rect x="${r1(18 + i * bw)}" y="${r1(134 - (v / mx) * 32)}" width="${r1(bw - 2)}" height="${r1((v / mx) * 32)}" fill="${i === ser.length - 1 ? t.accent : t.series[0]}"/>`).join(""); break; }
    case "alert": { const tag = (d.alert || "ALERT").toUpperCase(), tw = Math.min(W - 36, tag.length * 7.3 + 16); body = `<rect x="18" y="104" width="${r1(tw)}" height="20" fill="none" stroke="${t.neg}" stroke-width="1.5"/>` + txt(26, 118, tag, { size: 10, fill: t.neg, weight: 700, ls: 0.8 }); break; }
    case "dark": body = ser.length ? spark(18, 100, W - 36, 30) : txt(18, 120, d.note || "", { size: 11, fill: t.muted }); break;
    default: body = d.note ? txt(18, 120, clip(d.note, W - 36, 11), { size: 11, fill: t.muted }) : "";
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="gq-card" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${esc(FONT)}" role="img" aria-label="${esc(`${d.label}: ${val}${d.unit || ""}`)}">` +
    `<g${mk(`${d.label}: ${val}${d.unit || ""}${d.note ? ` - ${d.note}` : ""}`, d.drill)}><rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="${bg}" stroke="${stroke}" stroke-width="${d.kind === "alert" ? 2 : 1}"/></g>` +
    (d.kind === "alert" ? `<rect x="1" y="1" width="4" height="${H - 2}" fill="${t.neg}"/>` : `<rect x="1" y="1" width="4" height="${H - 2}" fill="${d.kind === "dark" ? t.accent : t.series[0]}"/>`) +
    txt(18, 30, d.label.toUpperCase(), { size: 10.5, fill: d.kind === "dark" ? t.eyebrow : t0.name === "dark" ? t0.eyebrow : t0.muted, weight: 700, ls: 1.2 }) +
    `<text x="18" y="78" font-size="34" font-weight="800" fill="${d.kind === "alert" ? t.neg : d.kind === "dark" ? "#FFFFFF" : t0.text}">${esc(val)}<tspan font-size="15" font-weight="600" dx="4">${esc(d.unit || "")}</tspan></text>` + body + `</svg>`;
}

// ------------------------------------------------------------------ 24. Scorecard and 25. financial-style table (HTML)

export type Status = "on" | "risk" | "off";
export function scorecardTable(rows: { label: string; cells: (string | number)[]; status: Status; trend?: "up" | "down" | "flat"; drill?: unknown }[], columns: string[], f: { caption?: string } = {}) {
  const dot = (s: Status) => `<span class="gq-dot gq-dot-${s}" aria-hidden="true"></span><span class="gq-sr">${s === "on" ? "On track" : s === "risk" ? "At risk" : "Off track"}</span>`;
  const arrow = (t?: string) => (t === "up" ? '<span class="gq-up" aria-label="rising">▲</span>' : t === "down" ? '<span class="gq-down" aria-label="falling">▼</span>' : '<span class="gq-flat" aria-label="steady">▶</span>');
  return `<table class="gq-table gq-score">${f.caption ? `<caption>${esc(f.caption)}</caption>` : ""}<thead><tr><th>Status</th>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}<th>Trend</th></tr></thead><tbody>${rows.map((r) => `<tr tabindex="0" class="gq-mark" data-tip="${esc(r.label)}"${r.drill !== undefined ? ` data-drill="${esc(JSON.stringify(r.drill))}"` : ""}><td>${dot(r.status)}</td><td><b>${esc(r.label)}</b></td>${r.cells.map((c) => `<td>${esc(typeof c === "number" ? fmt(c, 1) : c)}</td>`).join("")}<td>${arrow(r.trend)}</td></tr>`).join("")}</tbody></table>`;
}

/** Financial-style table: right-aligned numbers, bracketed negatives, one highlighted row, totals. */
export function financialTable(columns: string[], rows: (string | number)[][], f: { highlight?: number; totals?: boolean; caption?: string; drill?: (i: number) => unknown } = {}) {
  const cell = (v: string | number) => (typeof v === "number" ? `<td class="num${v < 0 ? " neg" : ""}">${v < 0 ? `(${fmt(-v, 1)})` : fmt(v, 1)}</td>` : `<td>${esc(v)}</td>`);
  let tot = "";
  if (f.totals && rows.length) {
    const sums = columns.map((_, j) => (rows.every((r) => typeof r[j] === "number") ? rows.reduce((s, r) => s + (r[j] as number), 0) : j === 0 ? "Total" : ""));
    tot = `<tfoot><tr>${sums.map(cell).join("")}</tr></tfoot>`;
  }
  return `<table class="gq-table gq-fin">${f.caption ? `<caption>${esc(f.caption)}</caption>` : ""}<thead><tr>${columns.map((c, j) => `<th${j ? ' class="num"' : ""}>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr class="gq-mark${i === f.highlight ? " hl" : ""}" tabindex="0" data-tip="${esc(String(r[0]))}"${f.drill ? ` data-drill="${esc(JSON.stringify(f.drill(i)))}"` : ""}>${r.map(cell).join("")}</tr>`).join("")}</tbody>${tot}</table>`;
}

// ------------------------------------------------------------------ 26. Sankey call flow and chord diagram

export function sankey(flow: { target: string; incoming: { id: string; value: number }[]; outgoing: { id: string; value: number }[] }, f: Frame & { label?: (id: string) => string; drill?: (id: string) => unknown } = {}) {
  const L = f.label || ((s: string) => s);
  return frame({ height: 440, ...f }, (b) => {
    const inT = flow.incoming.reduce((s, x) => s + x.value, 0), outT = flow.outgoing.reduce((s, x) => s + x.value, 0), tot = Math.max(1, inT, outT);
    const colW = 14, gap = 6, avail = b.h - 20, k = (avail - gap * Math.max(flow.incoming.length, flow.outgoing.length, 1)) / tot;
    const xL = b.x + 150, xM = b.x + b.w / 2 - colW / 2, xR = b.x + b.w - 150 - colW;
    const midH = (inT + outT) * k * 0.5 + 10, midY = b.y + 10 + (avail - midH) / 2;
    let s = `<rect x="${r1(xM)}" y="${r1(midY)}" width="${colW}" height="${r1(midH)}" fill="${b.t.accent}"${mk(`${L(flow.target)}: ${fmt(inT)} in, ${fmt(outT)} out`)}/>` + txt(xM + colW / 2, midY - 8, L(flow.target), { size: 12, fill: b.t.accent, anchor: "middle", weight: 700 });
    const side = (list: { id: string; value: number }[], x: number, left: boolean) => {
      const h = list.reduce((s, it) => s + it.value * k, 0) + gap * (list.length - 1);
      let y = b.y + 10 + (avail - h) / 2, my = midY + (left ? 0 : midH / 2);
      const sideT = list.reduce((s, it) => s + it.value, 0) || 1;
      for (const it of list) {
        const hh = Math.max(2, it.value * k), mh = Math.max(1, (it.value / sideT) * (midH / 2));
        const x0 = left ? x + colW : xM + colW, x1 = left ? xM : x, ya0 = left ? y : my, ya1 = left ? my : y, h0 = left ? hh : mh, h1 = left ? mh : hh, cxm = (x0 + x1) / 2;
        s += `<path d="M${r1(x0)} ${r1(ya0)}C${r1(cxm)} ${r1(ya0)} ${r1(cxm)} ${r1(ya1)} ${r1(x1)} ${r1(ya1)}V${r1(ya1 + h1)}C${r1(cxm)} ${r1(ya1 + h1)} ${r1(cxm)} ${r1(ya0 + h0)} ${r1(x0)} ${r1(ya0 + h0)}Z" fill="${left ? b.t.series[1] : b.t.series[0]}" fill-opacity="0.45"${mk(`${left ? `${L(it.id)} to ${L(flow.target)}` : `${L(flow.target)} to ${L(it.id)}`}: ${fmt(it.value)}`, f.drill?.(it.id))}/>`;
        s += `<rect x="${r1(x)}" y="${r1(y)}" width="${colW}" height="${r1(hh)}" fill="${left ? b.t.series[1] : b.t.series[0]}"/>`;
        s += txt(left ? x - 8 : x + colW + 8, y + hh / 2 + 4, `${clip(L(it.id), 120, 11)} (${fmt(it.value)})`, { size: 11, fill: b.t.text, anchor: left ? "end" : "start" });
        y += hh + gap; my += mh;
      }
    };
    side(flow.incoming, xL, true); side(flow.outgoing, xR, false);
    s += txt(xL, b.y + b.h, "Calls and SMS into the target", { size: 10.5, fill: b.t.muted, anchor: "middle" }) + txt(xR + colW, b.y + b.h, "From the target", { size: 10.5, fill: b.t.muted, anchor: "middle" });
    return s;
  });
}

export function chord(names: string[], m: number[][], f: Frame & { label?: (id: string) => string; highlight?: number } = {}) {
  const L = f.label || ((s: string) => s);
  return frame({ height: 500, ...f }, (b) => {
    const n = names.length, cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.min(b.w, b.h) / 2 - 70, totals = names.map((_, i) => (m[i] || []).reduce((s, v, j) => s + v + (m[j]?.[i] || 0), 0) / 2 || 0.0001);
    const all = totals.reduce((s, v) => s + v, 0), pad = 0.04, span = Math.PI * 2 - pad * n;
    const start: number[] = []; let a = -Math.PI / 2;
    for (let i = 0; i < n; i++) { start.push(a); a += (totals[i] / all) * span + pad; }
    const P = (ang: number, r = R) => `${r1(cx + Math.cos(ang) * r)} ${r1(cy + Math.sin(ang) * r)}`;
    let s = "";
    const cursor = [...start];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const v = (m[i]?.[j] || 0) + (m[j]?.[i] || 0); if (!v) continue;
      const wi = (v / 2 / all) * span, wj = (v / 2 / all) * span;
      const a0 = cursor[i], a1 = a0 + wi, b0 = cursor[j], b1 = b0 + wj; cursor[i] = a1; cursor[j] = b1;
      const hl = i === f.highlight || j === f.highlight;
      s += `<path d="M${P(a0)}A${R} ${R} 0 0 1 ${P(a1)}Q${cx} ${cy} ${P(b0)}A${R} ${R} 0 0 1 ${P(b1)}Q${cx} ${cy} ${P(a0)}Z" fill="${hl ? b.t.accent : b.t.series[i % 4]}" fill-opacity="${hl ? 0.7 : 0.38}"${mk(`${L(names[i])} and ${L(names[j])}: ${fmt(v)}`)}/>`;
    }
    for (let i = 0; i < n; i++) {
      const a0 = start[i], a1 = a0 + (totals[i] / all) * span, R2 = R + 12, large = a1 - a0 > Math.PI ? 1 : 0;
      s += `<path d="M${P(a0, R + 2)}A${R + 2} ${R + 2} 0 ${large} 1 ${P(a1, R + 2)}L${P(a1, R2)}A${R2} ${R2} 0 ${large} 0 ${P(a0, R2)}Z" fill="${i === f.highlight ? b.t.accent : b.t.series[i % 4]}"${mk(`${L(names[i])}: ${fmt(totals[i])}`)}/>`;
      const am = (a0 + a1) / 2, lx = cx + Math.cos(am) * (R + 22), ly = cy + Math.sin(am) * (R + 22);
      s += txt(lx, ly + 4, clip(L(names[i]), 110, 10.5), { size: 10.5, fill: b.t.text, anchor: Math.cos(am) > 0.1 ? "start" : Math.cos(am) < -0.1 ? "end" : "middle" });
    }
    return s;
  });
}

/** Simple line chart (used for trends and sparklines in reports). */
export function lineChart(series: { name: string; values: number[] }[], labels: string[], f: Frame & { highlight?: number } = {}) {
  return frame(f, (b) => {
    const bb = { ...b, y: b.y + 14, h: b.h - 14 };
    const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)) * 1.1), left = b.x + 40, ph = bb.h - 22, n = Math.max(1, labels.length - 1);
    const X = (i: number) => left + (i / n) * (b.x + b.w - left - 10), Y = (v: number) => bb.y + ph - (v / max) * ph;
    let s = legend(b, series.map((x) => x.name), series.map((_, i) => (i === f.highlight ? b.t.accent : b.t.series[i % 4])), b.y + 4) + yAxis({ ...bb, h: ph }, max, left);
    const every = Math.ceil(labels.length / 10);
    labels.forEach((l, i) => { if (i % every === 0) s += txt(X(i), bb.y + ph + 15, clip(l, 80, 10.5), { size: 10.5, fill: b.t.muted, anchor: "middle" }); });
    series.forEach((se, k) => {
      const c = k === f.highlight ? b.t.accent : b.t.series[k % 4];
      s += `<polyline points="${se.values.map((v, i) => `${r1(X(i))},${r1(Y(v))}`).join(" ")}" fill="none" stroke="${c}" stroke-width="2.5"/>`;
      se.values.forEach((v, i) => (s += `<circle cx="${r1(X(i))}" cy="${r1(Y(v))}" r="3" fill="${c}"${mk(`${se.name}, ${labels[i]}: ${fmt(v)}`)}/>`));
      const lv = se.values[se.values.length - 1]; if (lv !== undefined) s += txt(X(se.values.length - 1) - 4, Y(lv) - 8, fmt(lv), { size: 10.5, fill: c, anchor: "end", weight: 700 });
    });
    return s;
  });
}

/** Donut with the share of each part labelled; the largest part (or `highlight`) in saffron. */
export function donut(items: Item[], f: Frame & { highlight?: number; centre?: string } = {}) {
  return frame({ height: 380, ...f }, (b) => {
    const total = items.reduce((s, i) => s + i.value, 0) || 1, cx = b.x + b.h / 2 + 10, cy = b.y + b.h / 2, R = b.h / 2 - 6, r = R * 0.6;
    let a = -Math.PI / 2, s = "";
    const hi = f.highlight ?? 0;
    items.forEach((it, i) => {
      const a1 = a + (it.value / total) * Math.PI * 2 - 0.0001, large = a1 - a > Math.PI ? 1 : 0, c = i === hi ? b.t.accent : b.t.series[i % 4];
      const P = (ang: number, rr: number) => `${r1(cx + Math.cos(ang) * rr)} ${r1(cy + Math.sin(ang) * rr)}`;
      if (it.value > 0) s += `<path d="M${P(a, R)}A${R} ${R} 0 ${large} 1 ${P(a1, R)}L${P(a1, r)}A${r} ${r} 0 ${large} 0 ${P(a, r)}Z" fill="${c}" stroke="${b.t.bg}" stroke-width="2"${mk(`${it.label}: ${fmt(it.value)} (${pct(it.value / total, 1)})`, it.drill)}/>`;
      const ly = b.y + 10 + i * 24, lx = cx + R + 40;
      s += `<rect x="${r1(lx)}" y="${r1(ly)}" width="12" height="12" fill="${c}"/>` + txt(lx + 20, ly + 11, `${clip(it.label, b.x + b.w - lx - 100, 12)}`, { size: 12, fill: b.t.text }) + txt(b.x + b.w, ly + 11, `${fmt(it.value)}  ${pct(it.value / total)}`, { size: 12, fill: b.t.text, anchor: "end", weight: 700 });
      a = a1 + 0.0001;
    });
    s += txt(cx, cy + 6, f.centre ?? fmt(total), { size: 22, fill: b.t.text, anchor: "middle", weight: 800 });
    return s;
  });
}

/** Catalogue for the gallery page and the tests. */
export const CATALOGUE = [
  "bladeBars", "columnsRef", "combo", "groupedBars", "stackedBars", "stackedBars100", "diverging", "waterfall", "marimekko", "treemap", "funnel", "dumbbell", "slopegraph",
  "bullets", "progressBars", "waffle", "quadrant", "heatGrid", "riskMatrix", "gantt", "milestones", "chevrons", "cycle", "chainWheel", "pyramid", "harvey",
  "metricCard x8", "scorecardTable", "financialTable", "sankey", "chord", "lineChart", "donut",
];
