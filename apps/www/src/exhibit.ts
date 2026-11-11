// KSA exhibits for Confluence, drawn to the Design & Visual Guidelines (06 · Data visualisation):
// an exhibit number in Open Water, an insight-first headline, a subtitle with unit and period,
// Fog gridlines, direct labels, one saffron beacon, a source line and the Confluence Y identifier.
import type { Exhibit } from "../content/editions/2026-11";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const T = "#17807E", S = "#EE9B1E", FOG = "#D4DEE2", RIVER = "#8B9A9C", DEEP = "#0E2F3C", SLATE = "#3E5563";
const Y = `<svg class="ex-y" viewBox="-4 -4 100 108" aria-hidden="true"><path fill="${T}" d="M0 0 L30 0 L44 26.25 L44 59.3 Z"/><path fill="${S}" d="M92 0 L62 0 L48 26.25 L48 59.3 Z"/><path fill="${DEEP}" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/></svg>`;

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
const fmt = (v: number) => (Math.abs(v) >= 1000 ? v.toLocaleString("en-IN") : String(+v.toFixed(2)));

function column(x: Exhibit) {
  const d = x.data || [], max = niceMax(Math.max(...d.map((r) => r[1]))), W = 400, H = 210, l = 34, r = 392, t = 16, b = 176;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * max);
  const y = (v: number) => b - (v / max) * (b - t), bw = Math.min(70, ((r - l) / d.length) * 0.56), step = (r - l) / d.length;
  return `<svg class="ex-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(x.title)}">${ticks.map((v) => `<line x1="${l}" x2="${r}" y1="${y(v)}" y2="${y(v)}" stroke="${v ? FOG : RIVER}" stroke-width="1"/><text x="${l - 6}" y="${y(v) + 3.5}" text-anchor="end" class="ex-tk">${fmt(v)}</text>`).join("")}
${d.map(([lab, v, show], i) => { const cx = l + step * i + step / 2, hi = i === x.beacon; return `<rect x="${cx - bw / 2}" y="${y(v)}" width="${bw}" height="${b - y(v)}" fill="${hi ? S : T}"/><text x="${cx}" y="${y(v) - 6}" text-anchor="middle" class="ex-v${hi ? " hi" : ""}">${esc(show ?? fmt(v))}</text><text x="${cx}" y="${b + 16}" text-anchor="middle" class="ex-lb${hi ? " hi" : ""}">${esc(lab)}</text>`; }).join("")}</svg>`;
}

function bar(x: Exhibit) {
  const d = x.data || [], max = niceMax(Math.max(...d.map((r) => r[1]))), W = 400, row = 34, H = d.length * row + 8, l = 150, r = 360;
  return `<svg class="ex-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(x.title)}"><line x1="${l}" x2="${l}" y1="0" y2="${H}" stroke="${RIVER}"/>
${d.map(([lab, v, show], i) => { const yy = 6 + i * row, w = (v / max) * (r - l), hi = i === x.beacon; return `<text x="${l - 8}" y="${yy + 15}" text-anchor="end" class="ex-lb${hi ? " hi" : ""}">${esc(lab)}</text><rect x="${l}" y="${yy + 3}" width="${w}" height="18" fill="${hi ? S : T}"/><text x="${l + w + 6}" y="${yy + 16.5}" class="ex-v${hi ? " hi" : ""}">${esc(show ?? fmt(v))}</text>`; }).join("")}</svg>`;
}

function waffle(x: Exhibit) {
  const n = Math.round(x.data?.[0]?.[1] || 0), s = 15, g = 3;
  const cells = Array.from({ length: 100 }, (_, i) => { const c = i % 10, r = 9 - Math.floor(i / 10); return `<rect x="${c * (s + g)}" y="${r * (s + g)}" width="${s}" height="${s}" fill="${i < n ? S : FOG}"/>`; }).join("");
  return `<div class="ex-row"><svg class="ex-svg sq" viewBox="0 0 ${10 * (s + g) - g} ${10 * (s + g) - g}" role="img" aria-label="${esc(x.title)}">${cells}</svg><div class="ex-big"><b>${esc(x.data?.[0]?.[2] ?? n + "%")}</b><span>${esc(x.data?.[0]?.[0] || "")}</span><i>Each square is 1% of revenue</i></div></div>`;
}

function gauge(x: Exhibit) {
  const v = x.data?.[0]?.[1] || 0, tot = x.total || 1, k = Math.max(0, Math.min(1, v / tot)), R = 80, cx = 100, cy = 96;
  const pt = (a: number) => `${cx - R * Math.cos(a * Math.PI)} ${cy - R * Math.sin(a * Math.PI)}`;
  return `<div class="ex-row"><svg class="ex-svg gauge" viewBox="0 0 200 112" role="img" aria-label="${esc(x.title)}"><path d="M${pt(0)} A${R} ${R} 0 0 1 ${pt(1)}" fill="none" stroke="${FOG}" stroke-width="24"/><path d="M${pt(0)} A${R} ${R} 0 0 1 ${pt(k)}" fill="none" stroke="${S}" stroke-width="24"/><text x="${cx}" y="${cy - 8}" text-anchor="middle" class="ex-gv">${Math.round(k * 100)}%</text><text x="${cx - R}" y="${cy + 14}" text-anchor="middle" class="ex-tk">0</text><text x="${cx + R}" y="${cy + 14}" text-anchor="middle" class="ex-tk">${fmt(tot)}</text></svg>
<div class="ex-big"><b>${esc(x.data?.[0]?.[2] ?? fmt(v))}</b><span>${esc(x.data?.[0]?.[0] || "")}</span><i>of ${fmt(tot)} in the demand estimate</i></div></div>`;
}

// Route line and waypoints (Navigator's marks 01 and 03): dashed course, diamond waypoints, saffron on arrival.
function route(x: Exhibit) {
  const d = x.data || [];
  return `<ol class="ex-route" style="--n:${d.length}">${d.map(([date, , text], i) => `<li class="${i === x.beacon ? "arrive" : ""}"><time>${esc(date)}</time><i aria-hidden="true"></i><span>${esc(text)}</span></li>`).join("")}</ol>`;
}

// Metric cards (06 · Metric cards & KPIs): context tag, value, delta pill, comparison.
function cards(x: Exhibit) {
  return `<div class="ex-cards">${(x.cards || []).map((c) => `<div class="mc"><span class="mc-tag">${esc(c.tag)}</span><b>${esc(c.value)}</b>${c.delta ? `<em class="pill ${c.tone || ""}">${esc(c.delta)}</em>` : ""}${c.bar != null ? `<span class="mc-bar"><i style="width:${Math.max(0, Math.min(100, c.bar))}%"></i></span>` : ""}${c.vs ? `<span class="mc-vs">${esc(c.vs)}</span>` : ""}</div>`).join("")}</div>`;
}

export function exhibitHtml(x: Exhibit, n: number, opts: { wide?: boolean } = {}) {
  const body = x.kind === "column" ? column(x) : x.kind === "bar" ? bar(x) : x.kind === "waffle" ? waffle(x) : x.kind === "gauge" ? gauge(x) : x.kind === "route" ? route(x) : cards(x);
  return `<figure class="ex ex--${x.kind}${opts.wide ? " wide" : ""}"><span class="ex-n">Exhibit ${n}</span><h4 class="ex-h">${esc(x.title)}</h4><p class="ex-u">${esc(x.unit)}</p>${body}
<figcaption><span>Source: ${esc(x.source)}${/KSA analysis/.test(x.source) ? "" : "; KSA analysis"}.${x.note ? ` Note: ${esc(x.note)}` : ""}</span>${Y}</figcaption></figure>`;
}

/** Validates an exhibit drafted by Kayak AI; anything malformed is dropped rather than drawn wrongly. */
export function cleanExhibit(x: any): Exhibit | undefined {
  if (!x || typeof x !== "object" || !["column", "bar", "waffle", "gauge", "route", "cards"].includes(x.kind) || !x.title || !x.source) return undefined;
  const data = Array.isArray(x.data) ? x.data.filter((r: any) => Array.isArray(r) && typeof r[0] === "string" && Number.isFinite(+r[1])).slice(0, 8).map((r: any) => [String(r[0]).slice(0, 60), +r[1], r[2] != null ? String(r[2]).slice(0, 40) : undefined]) : undefined;
  if (x.kind !== "cards" && !data?.length) return undefined;
  return { kind: x.kind, title: String(x.title).slice(0, 140), unit: String(x.unit || "").slice(0, 120), data, beacon: Number.isInteger(x.beacon) ? x.beacon : undefined, total: Number.isFinite(+x.total) ? +x.total : undefined, cards: Array.isArray(x.cards) ? x.cards.slice(0, 3) : undefined, source: String(x.source).slice(0, 200), note: x.note ? String(x.note).slice(0, 200) : undefined } as Exhibit;
}
