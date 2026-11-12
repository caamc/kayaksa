import { $, $$, api, esc, html, raw, ico, toast, setBusy, confirmDialog, fmtDate } from "/_shared/js/ui.js";

// Card artwork is drawn at 336 x 192 units = 3.5 x 2 in (88.9 x 50.8 mm) at 96 units per inch
// (portrait designs at 192 x 336). Everything is vector, including the LinkedIn QR code, so the
// print PDF stays sharp at any size.
const W = 336, H = 192, UNIT_MM = 25.4 / 96;
const COMPANY = {
  ksa: { label: "Kayak Strategic Advisors", legal: "Kayak Strategic Advisors Private Limited", form: "Private Limited", descriptor: "STRATEGIC ADVISORS", under: "stem" },
  innovations: { label: "Kayak Innovations", legal: "Kayak Innovations (OPC) Private Limited", form: "(OPC) Private Limited", descriptor: "INNOVATIONS", under: "spark" },
  // A partnership firm: never "Private Limited".
  technology: { label: "Kayak Technology Solutions", legal: "Kayak Technology Solutions", form: "A partnership firm", footer: "Kayak Technology Solutions · A partnership firm", descriptor: "TECHNOLOGY SOLUTIONS", under: "build" },
  group: { label: "Kayak Group (all three)", legal: "Kayak Group", form: "", descriptor: "GROUP", under: "stem" },
};
// Eight designs. o: l = landscape, p = portrait. Every shape comes from the Kayak identifier
// (two blades and a stem), the pattern library and the navigator's marks in the brand manual.
// Ten designs in the manner of Tier 1 law and advisory firms: cotton and ivory stock, a serif name,
// tracked small capitals, hairline rules, one foil at most, and a great deal of quiet space.
// Every mark is the Kayak identifier or wordmark. o: l = landscape, p = portrait.
const DESIGNS = {
  chambers: { label: "Chambers", o: "l", note: "Ivory cotton, the wordmark alone; the back engraved and centred" },
  counsel: { label: "Counsel", o: "l", note: "White, your name on the front; a Deep Current back with the wordmark" },
  ink: { label: "Ink", o: "l", note: "Deep Current, a tone-on-tone identifier and a gold-foil hairline" },
  bar: { label: "Bar", o: "l", note: "White, one saffron rule down the margin, Swiss and exact" },
  letterhead: { label: "Letterhead", o: "l", note: "Ivory, the firm's full name across the head, like its letter" },
  partner: { label: "Partner", o: "l", note: "White, two columns, the wordmark low in the corner" },
  gilt: { label: "Gilt", o: "l", note: "White duplex, the identifier in gold foil, a Deep Current back" },
  harbour: { label: "Harbour", o: "l", note: "Ivory front; a Deep Current back with blind 62-degree wake lines" },
  monolith: { label: "Monolith", o: "p", note: "Portrait. Deep Current, the identifier small and centred" },
  folio: { label: "Folio", o: "p", note: "Portrait. Ivory, set like the title page of an opinion" },
};
const IVORY = "#F7F3EA", WHITE = "#FFFFFF", DEEP = "#0E2F3C", DEEPER = "#0B2733", GOLD = "#B08D57", HAIR = "#C9A25A", MUTED = "#55666E";
const FINISH = {
  stock: { cotton: "Cotton 700 gsm, letterpress", duplex: "Duplex 1000 gsm (two 500 gsm sheets, Deep Current core)", soft: "700 gsm board, soft-touch laminate with spot UV on the blades" },
  foil: { gold: "Gold hot-foil on the frame, rules and gold lettering", none: "No foil (print the gold as Pantone 7563 C)" },
  edge: { saffron: "Edge-painted Saffron (Pantone 7409 C)", teal: "Edge-painted Open Water (Pantone 7716 C)", none: "No edge painting" },
};
const DEFAULTS = {
  name: "", title: "Founder & Director", department: "", phones: ["", ""], whatsapp: "", linkedin: "", email: "", website: "www.kayaksa.com",
  address: "A/2, 314, Shah & Nahar Industrial Estate, Delisle Road, Mumbai 400013", locations: "Mumbai · Thane", company: "ksa", design: "chambers",
  stock: "cotton", foil: "gold", edge: "none",
};
const dims = (d) => (DESIGNS[d.design]?.o === "p" ? [H, W] : [W, H]);

// ---- Kayak geometry (master artwork) ----
const K = "M0 0 H28 V38.7 L52 0 H82 L50.1 51.5 L84 100 H54 L36 74.2 L28 87.1 V100 H0 Z";
const A = "M0 100 L31 0 L59 0 L90 100 L61 100 L45 44 L29 100 Z";
const BL = "M0 0 L30 0 L44 26.25 L44 59.3 Z", BR = "M92 0 L62 0 L48 26.25 L48 59.3 Z";
const UNDER = {
  stem: (c) => `<path fill="${c}" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/>`,
  spark: (c) => `<path fill="${c}" d="M46 67 L61 82 L46 97 L31 82 Z"/>`,
  build: (c, accent) => `<path fill="${accent}" d="M42 63 H50 V71 H42 Z"/><path fill="${c}" d="M32 74 H60 V100 H32 Z"/>`,
};
function wordmark(ink, left, under = "stem", accent = "#CDE8E3") {
  return `<g fill="${ink}"><path d="${K}"/><path transform="translate(92 0)" d="${A}"/><path transform="translate(232 0)" d="${A}"/><path transform="translate(332 0)" d="${K}"/></g>
    <g transform="translate(161 0)"><path fill="${left}" d="${BL}"/><path fill="#EE9B1E" d="${BR}"/>${UNDER[under](ink, accent)}</g>`;
}
function identifier(ink, left, under = "stem", right = "#EE9B1E") {
  return `<path fill="${left}" d="${BL}"/><path fill="${right}" d="${BR}"/>${UNDER[under](ink, "#17807E")}`;
}
const E = (s) => esc(s ?? "");
const T = (x, y, text, o = {}) =>
  text ? `<text x="${x}" y="${y}" font-family="${o.serif ? "'Source Serif 4', Georgia, serif" : "Archivo"}" font-size="${o.size || 8}" font-weight="${o.weight || 400}"${o.stretch ? ` font-stretch="${o.stretch}"` : ""} fill="${o.fill || "#0E2F3C"}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.ls ? ` letter-spacing="${o.ls}"` : ""}>${E(text)}</text>` : "";

// ---- Contact icons (24-unit grid, filled, so they print as clean vector) ----
const ICON = {
  phone: `<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/>`,
  // WhatsApp glyph, single colour and unaltered in form, as WhatsApp's brand guidelines allow.
  whatsapp: `<path fill-rule="evenodd" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.2 15.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8z"/><path d="M8.6 7.3c-.2-.5-.4-.5-.6-.5h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c2.3.9 2.7.7 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.5-.3l-1.8-.9c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.4-1.7c-.1-.3 0-.4.1-.5l.4-.5.3-.4a.5.5 0 0 0 0-.5z"/>`,
  mail: `<path fill-rule="evenodd" d="M2 5h20v14H2zm2.4 2L12 12.4 19.6 7zM3.8 8.6v8.6h16.4V8.6L12 14.6z"/>`,
  web: `<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 1.9a8.1 8.1 0 0 0-6.9 7.2h3.8c.1-2.7.9-5.2 2.1-7.1zm2 0c1.3 1.9 2 4.4 2.1 7.1h3.8a8.1 8.1 0 0 0-5.9-7.1zm-1 .9c-1.1 1.7-1.8 3.9-1.9 6.3h3.8c-.1-2.4-.8-4.6-1.9-6.3zM4.1 12.9a8.1 8.1 0 0 0 6.9 7.2c-1.2-1.9-2-4.4-2.1-7.2zm5.8 0c.1 2.5.8 4.7 2.1 6.4 1.2-1.7 2-3.9 2.1-6.4zm6.2 0c-.1 2.8-.9 5.3-2.1 7.2a8.1 8.1 0 0 0 6-7.2z"/>`,
  pin: `<path fill-rule="evenodd" d="M12 2a7.5 7.5 0 0 1 7.5 7.5C19.5 15.2 12 22 12 22S4.5 15.2 4.5 9.5A7.5 7.5 0 0 1 12 2zm0 4.6a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8z"/>`,
  linkedin: `<path fill-rule="evenodd" d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2.2 7.6V18h2.6V9.6zm1.3-4.1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm3 4.1V18h2.6v-4.3c0-1.1.2-2.2 1.6-2.2s1.4 1.3 1.4 2.3V18h2.6v-4.7c0-2.3-.5-4-3.2-4-1.3 0-2.2.7-2.5 1.4V9.6z"/>`,
};
const icon = (k, x, y, s, fill) => `<g transform="translate(${x} ${y}) scale(${s / 24})" fill="${fill}">${ICON[k]}</g>`;

// ---- LinkedIn link and QR ----
export function cleanLinkedIn(v) {
  let u = String(v || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u.replace(/^\/+/, "");
  try {
    const x = new URL(u);
    if (!/(^|\.)linkedin\.com$/i.test(x.hostname) || !/^\/(in|company|school|showcase)\/[^/]+/i.test(x.pathname)) return null;
    return `https://www.linkedin.com${x.pathname.replace(/\/+$/, "")}`;
  } catch { return null; }
}
let QR_READY = null;
const qrLib = () => (QR_READY ||= window.qrcode ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/vendor/qrcode.js"; s.onload = res; s.onerror = () => rej(new Error("QR library missing")); document.head.append(s); }));
const QR_CACHE = new Map();
function qrSvg(url, x, y, size, ink = "#0E2F3C") {
  if (!url || !window.qrcode) return "";
  let m = QR_CACHE.get(url);
  if (!m) { const q = window.qrcode(0, "M"); q.addData(url, "Byte"); q.make(); const n = q.getModuleCount(); let d = ""; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`; m = { n, d }; QR_CACHE.set(url, m); }
  const q = m.n + 4, s = size / q; // 2-module quiet zone on every side
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#FFFFFF"/><g transform="translate(${x + 2 * s} ${y + 2 * s}) scale(${s})"><path fill="${ink}" d="${m.d}"/></g>`;
}
function qrBlock(d, x, y, size, onDark = false) {
  const url = cleanLinkedIn(d.linkedin);
  if (!url) return "";
  const lab = onDark ? "#F5C46D" : "#0E2F3C";
  return `${onDark ? `<rect x="${x - 3}" y="${y - 3}" width="${size + 6}" height="${size + 6}" fill="#FFFFFF"/>` : `<rect x="${x - 3}" y="${y - 3}" width="${size + 6}" height="${size + 6}" fill="none" stroke="#C9A25A" stroke-width="0.5"/>`}${qrSvg(url, x, y, size)}
    ${icon("linkedin", x, y + size + 6, 6.2, onDark ? "#FFFFFF" : "#0A66C2")}${T(x + 9, y + size + 11.3, "SCAN TO CONNECT", { size: 4.3, weight: 600, fill: lab, ls: 0.9 })}`;
}

let MASTER_REVERSED = "";
async function loadMaster() {
  if (MASTER_REVERSED) return;
  const s = await (await fetch("/_shared/logos/KSA_Logo_Full_Reversed.svg")).text();
  MASTER_REVERSED = s.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>[\s\S]*?<\/title>/, "");
}

const bg = (w, h, B, fill) => `<rect x="${-B}" y="${-B}" width="${w + 2 * B}" height="${h + 2 * B}" fill="${fill}"/>`;
function frame(B, w = W, h = H) {
  return `${bg(w, h, B, "#0B2733")}<rect x="9" y="9" width="${w - 18}" height="${h - 18}" fill="none" stroke="#C9A25A" stroke-width="0.75"/>
  <rect x="12" y="12" width="${w - 24}" height="${h - 24}" fill="none" stroke="#C9A25A" stroke-opacity="0.45" stroke-width="0.5"/>`;
}
function bladeBand(y, h, B) {
  let g = "";
  for (let x = -B, i = 0; x < W + B; x += 22, i++) g += `<g transform="translate(${x} ${y + (i % 2 ? 4 : 0)}) scale(0.16)"><path fill="${i % 3 ? "#17807E" : "#EE9B1E"}" d="${BL}"/><path fill="${i % 3 ? "#EE9B1E" : "#17807E"}" d="${BR}"/></g>`;
  return `<rect x="${-B}" y="${y - 6}" width="${W + 2 * B}" height="${h}" fill="#0E2F3C"/>${g}`;
}
function contours(B, w = W) {
  let g = "";
  for (let i = 0; i < 9; i++) { const y0 = 20 + i * 22; g += `<path d="M${-B} ${y0} C ${w * 0.25} ${y0 - 26 + i * 3}, ${w * 0.55} ${y0 + 30 - i * 2}, ${w + B} ${y0 - 8}" fill="none" stroke="${i === 4 ? "#EE9B1E" : "#17807E"}" stroke-opacity="${i === 4 ? 0.9 : 0.45}" stroke-width="${i === 4 ? 0.9 : 0.6}"/>`; }
  return g;
}
// The Confluence repeat from the pattern library (01): blade pairs on a 120 x 84 tile, half-drop.
function confluenceRepeat(x0, y0, w, h, s = 0.5) {
  let g = "";
  for (let ty = -84; ty < h + 84; ty += 84 * s * 2) for (let tx = -120; tx < w + 120; tx += 120 * s * 2)
    for (const [ox, oy] of [[14, 12], [74, 54]]) g += `<g transform="translate(${x0 + tx + ox * s * 2} ${y0 + ty + oy * s * 2}) scale(${s})"><path fill="#17807E" d="${BL}"/><path fill="#EE9B1E" d="${BR}"/></g>`;
  return g;
}
// Navigator's marks (brand manual p.30): corner ticks that frame the content like a chart.
function navMarks(w, h, m, len, col) {
  const c = (x, y, dx, dy) => `<path d="M${x} ${y + dy * len} V${y} H${x + dx * len}" fill="none" stroke="${col}" stroke-width="0.8"/>`;
  return c(m, m, 1, 1) + c(w - m, m, -1, 1) + c(m, h - m, 1, -1) + c(w - m, h - m, -1, -1);
}
function lightLogo(d, co, x, y, s, desc = "#17807E", ink = DEEP) {
  return `<g transform="translate(${x} ${y}) scale(${s})">${wordmark(ink, "#17807E", co.under, "#17807E")}</g><text x="${x}" y="${y + 134 * s}" font-family="Archivo" font-size="${13.2 * s}" font-weight="600" fill="${desc}" textLength="${416 * s}" lengthAdjust="spacing">${E(d.company === "group" ? "GROUP" : co.descriptor)}</text>`;
}
function darkLogo(d, co, x, y, s) {
  if (d.company === "ksa") return `<g transform="translate(${x} ${y}) scale(${s})">${MASTER_REVERSED}</g>`;
  return `<g transform="translate(${x} ${y}) scale(${s})">${wordmark("#FFFFFF", "#3FB0A9", co.under)}</g><text x="${x}" y="${y + 134 * s}" font-family="Archivo" font-size="${13.2 * s}" font-weight="600" fill="#CDE8E3" textLength="${416 * s}" lengthAdjust="spacing">${E(d.company === "group" ? "GROUP" : co.descriptor)}</text>`;
}
const LOGO_W = 416;
const centredLogo = (d, co, w, y, s, dark) => (dark ? darkLogo(d, co, (w - LOGO_W * s) / 2, y, s) : lightLogo(d, co, (w - LOGO_W * s) / 2, y, s));
const legalLine = (d) => (d.company === "group" ? "Kayak Strategic Advisors · Kayak Innovations · Kayak Technology Solutions" : (COMPANY[d.company] || COMPANY.ksa).footer || (COMPANY[d.company] || COMPANY.ksa).legal);
const caps = (x, y, t, fill, o = {}) => T(x, y, (t || "").toUpperCase(), { size: o.size || 4.8, weight: 600, fill, ls: o.ls ?? 1.5, anchor: o.anchor });
const hair = (x1, y1, x2, y2, c = HAIR, w = 0.45) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"/>`;

function front(d, B) {
  const co = COMPANY[d.company] || COMPANY.ksa;
  const web = (d.website || "www.kayaksa.com").replace(/^https?:\/\//, "");
  const loc = d.locations || "";
  switch (d.design) {
    case "counsel": // the personal side faces front; the brand is the back
      return personal(d, B, { bg: WHITE, ink: DEEP, accent: GOLD, sub: MUTED, mark: true });
    case "ink": return svg(B, d, `${bg(W, H, B, DEEP)}<g transform="translate(${W - 150} -34) scale(2.7)">${identifier("#12394A", "#12394A", "stem", "#12394A")}</g>
      ${darkLogo(d, co, 30, 70, 0.27)}${hair(30, 116, 30 + 34, 116, HAIR, 0.6)}${caps(30, 132, web, "#E2C07A", { size: 4.6, ls: 1.8 })}${caps(30, H - 26, loc, "#9FB4BA", { size: 4.2, ls: 1.6 })}`);
    case "bar": return svg(B, d, `${bg(W, H, B, WHITE)}<rect x="26" y="26" width="1.3" height="${H - 52}" fill="#EE9B1E"/>${lightLogo(d, co, 38, 30, 0.2)}
      ${T(38, H - 50, d.name || "Your Name", { serif: true, size: fitSerif(d.name, 12, 250), weight: 600, fill: DEEP })}${caps(38, H - 38, [d.title, d.department].filter(Boolean).join(" · "), GOLD, { size: 4.6 })}${caps(W - 26, H - 26, loc, MUTED, { size: 4.2, anchor: "end" })}`);
    case "letterhead": return svg(B, d, `${bg(W, H, B, IVORY)}${caps(W / 2, 30, legalLine(d), DEEP, { size: 4.4, ls: 1.6, anchor: "middle" })}${hair(28, 37, W - 28, 37)}
      ${centredLogo(d, co, W, 70, 0.27)}${hair(28, H - 36, W - 28, H - 36)}${caps(W / 2, H - 24, [web, loc].filter(Boolean).join("   ·   "), MUTED, { size: 4.4, ls: 1.6, anchor: "middle" })}`);
    case "partner": return svg(B, d, `${bg(W, H, B, WHITE)}${lightLogo(d, co, 30, H - 60, 0.2)}${caps(W - 30, H - 32, loc, MUTED, { size: 4.2, anchor: "end" })}${caps(W - 30, H - 42, web, DEEP, { size: 4.2, anchor: "end" })}`);
    case "gilt": return svg(B, d, `${bg(W, H, B, WHITE)}<g transform="translate(${W / 2 - 92 * 0.42} 54) scale(0.42)">${identifier(GOLD, GOLD, co.under, GOLD)}</g>
      ${caps(W / 2, 118, d.company === "group" ? "Kayak Group" : co.label, GOLD, { size: 6, ls: 3.2, anchor: "middle" })}${caps(W / 2, 132, co.form || "", "#9A8A6E", { size: 4, ls: 1.8, anchor: "middle" })}`);
    case "harbour": return svg(B, d, `${bg(W, H, B, IVORY)}${lightLogo(d, co, 30, 68, 0.27)}${hair(30, 114, 64, 114)}${caps(30, 128, web, DEEP, { size: 4.6, ls: 1.8 })}${caps(W - 30, H - 26, loc, MUTED, { size: 4.2, anchor: "end" })}`);
    case "monolith": { const [w, h] = [H, W];
      return svg(B, d, `${bg(w, h, B, DEEP)}<g transform="translate(${w / 2 - 92 * 0.36} 92) scale(0.36)">${identifier("#FFFFFF", "#3FB0A9", co.under)}</g>${hair(w / 2 - 14, 150, w / 2 + 14, 150, HAIR, 0.6)}
        ${centredLogo(d, co, w, 236, 0.28, true)}${caps(w / 2, h - 30, web, "#E2C07A", { size: 4.4, ls: 1.8, anchor: "middle" })}`); }
    case "folio": { const [w, h] = [H, W];
      return svg(B, d, `${bg(w, h, B, IVORY)}${centredLogo(d, co, w, 140, 0.3)}${hair(w / 2 - 14, 196, w / 2 + 14, 196)}${caps(w / 2, h - 30, loc, MUTED, { size: 4.2, anchor: "middle" })}`); }
  }
  // chambers
  return svg(B, d, `${bg(W, H, B, IVORY)}${centredLogo(d, co, W, 62, 0.3)}${caps(W / 2, H - 26, loc, GOLD, { size: 4.4, ls: 2, anchor: "middle" })}`);
}

function back(d, B) {
  const co = COMPANY[d.company] || COMPANY.ksa;
  switch (d.design) {
    case "counsel": return svg(B, d, `${bg(W, H, B, DEEP)}${centredLogo(d, co, W, 70, 0.3, true)}`);
    case "ink": return personal(d, B, { bg: IVORY, ink: DEEP, accent: GOLD, sub: MUTED });
    case "bar": return personal(d, B, { bg: WHITE, ink: DEEP, accent: GOLD, sub: MUTED, rule: true });
    case "letterhead": return centred(d, B, { bg: IVORY, ink: DEEP, accent: GOLD, sub: MUTED, head: true });
    case "partner": return twoCol(d, B);
    case "gilt": return personal(d, B, { bg: DEEP, ink: WHITE, accent: "#E2C07A", sub: "#B9CBCF", dark: true });
    case "harbour": return personal(d, B, { bg: DEEP, ink: WHITE, accent: "#E2C07A", sub: "#B9CBCF", dark: true, wake: true });
    case "monolith": return portraitBack(d, B, { bg: IVORY, ink: DEEP, accent: GOLD, sub: MUTED });
    case "folio": return portraitBack(d, B, { bg: IVORY, ink: DEEP, accent: GOLD, sub: MUTED, head: true });
  }
  return centred(d, B, { bg: IVORY, ink: DEEP, accent: GOLD, sub: MUTED });
}

// Archivo Expanded-like widths for caps aside, a serif name runs about 0.5 em a character.
function fitSerif(name, max, width) { return Math.min(max, width / (Math.max(8, (name || "Your Name").length) * 0.56)); }
function contactLines(d, x, y, o) {
  let out = "";
  const lh = o.lh || 10.5, size = o.size || 6.6;
  for (const [k, v] of rows(d)) {
    if (o.anchor === "middle") out += T(x, y, v, { size, fill: o.ink, anchor: "middle" }) + icon(k, x - v.length * size * 0.27 - 9, y - size * 0.82, size * 0.95, k === "whatsapp" ? o.ink : o.accent);
    else out += icon(k, x, y - size * 0.82, size * 0.95, k === "whatsapp" ? o.ink : o.accent) + T(x + size * 1.55, y, v, { size, fill: o.ink });
    y += lh;
  }
  return { out, y };
}
function address(d, x, y, o, max) {
  if (!d.address) return { out: "", y };
  const parts = splitAddress(d.address, max);
  let out = o.anchor === "middle" ? "" : icon("pin", x, y - 5, 5.6, o.accent);
  parts.forEach((p, i) => (out += T(o.anchor === "middle" ? x : x + 10, y + i * 8, p, { size: 5.6, fill: o.sub, anchor: o.anchor })));
  return { out, y: y + parts.length * 8 };
}
function qrSmall(d, x, y, size, o) {
  const url = cleanLinkedIn(d.linkedin);
  if (!url) return "";
  return `${o.dark ? `<rect x="${x - 2.5}" y="${y - 2.5}" width="${size + 5}" height="${size + 5}" fill="#FFFFFF"/>` : ""}${qrSvg(url, x, y, size, DEEP)}${caps(x + size / 2, y + size + 9, "LinkedIn", o.sub, { size: 3.8, ls: 1.4, anchor: "middle" })}`;
}
// The personal side, left-aligned: serif name, small-caps title, hairline, contacts; QR low right.
function personal(d, B, o) {
  const x0 = o.rule ? 38 : 30, qr = cleanLinkedIn(d.linkedin) ? 44 : 0;
  let s = bg(W, H, B, o.bg);
  if (o.wake) for (let i = -12; i < 30; i++) s += `<line x1="${i * 18}" y1="${H + B}" x2="${i * 18 + (H + 2 * B) / Math.tan(62 * Math.PI / 180)}" y2="${-B}" stroke="#12394A" stroke-width="0.6"/>`;
  if (o.rule) s += `<rect x="26" y="26" width="1.3" height="${H - 52}" fill="#EE9B1E"/>`;
  if (o.mark) s += `<g transform="translate(${W - 30 - 92 * 0.16} 26) scale(0.16)">${identifier(DEEP, "#17807E", (COMPANY[d.company] || COMPANY.ksa).under)}</g>`;
  s += T(x0, 44, d.name || "Your Name", { serif: true, size: fitSerif(d.name, 13.5, W - x0 - 60), weight: 600, fill: o.ink });
  s += caps(x0, 56, [d.title, d.department].filter(Boolean).join(" · "), o.accent, { size: 4.8 });
  s += hair(x0, 66, x0 + 30, 66, o.dark ? HAIR : HAIR, 0.5);
  const c = contactLines(d, x0, 84, { ink: o.ink, accent: o.accent, lh: 10.5, size: 6.4 });
  s += c.out;
  s += address(d, x0, c.y + 1, { accent: o.accent, sub: o.sub }, qr ? 46 : 60).out;
  if (qr) s += qrSmall(d, W - 30 - qr, H - 30 - qr - 6, qr, o);
  s += caps(x0, H - 22, legalLine(d), o.sub, { size: 3.9, ls: 1.2 });
  return svg(B, d, s);
}
// Centred, engraved: the classic law-firm back.
function centred(d, B, o) {
  const qr = cleanLinkedIn(d.linkedin) ? 42 : 0;
  let s = bg(W, H, B, o.bg);
  let y = 40;
  if (o.head) { s += caps(W / 2, 26, legalLine(d), o.ink, { size: 4.2, ls: 1.6, anchor: "middle" }) + hair(28, 33, W - 28, 33); y = 54; }
  s += T(W / 2, y, d.name || "Your Name", { serif: true, size: fitSerif(d.name, 14, 260), weight: 600, fill: o.ink, anchor: "middle" });
  s += caps(W / 2, y + 12, [d.title, d.department].filter(Boolean).join(" · "), o.accent, { size: 4.8, anchor: "middle" });
  s += hair(W / 2 - 14, y + 21, W / 2 + 14, y + 21);
  const c = contactLines(d, W / 2, y + 37, { ink: o.ink, accent: o.accent, lh: 9.6, size: 6.2, anchor: "middle" });
  s += c.out;
  s += address(d, W / 2, c.y + 1, { accent: o.accent, sub: o.sub, anchor: "middle" }, 72).out;
  if (qr) s += qrSmall(d, W - 24 - qr, H - 24 - qr - 6, qr, o);
  if (!o.head) s += caps(W / 2, H - 16, legalLine(d), o.sub, { size: 3.8, ls: 1.2, anchor: "middle" });
  return svg(B, d, s);
}
function twoCol(d, B) {
  const qr = cleanLinkedIn(d.linkedin) ? 42 : 0;
  let s = bg(W, H, B, WHITE);
  s += T(30, 50, d.name || "Your Name", { serif: true, size: fitSerif(d.name, 13, 150), weight: 600, fill: DEEP });
  s += caps(30, 62, d.title, GOLD, { size: 4.6 }) + caps(30, 71, d.department, MUTED, { size: 4.2 });
  s += hair(176, 36, 176, H - 40);
  const c = contactLines(d, 188, 46, { ink: DEEP, accent: GOLD, lh: 10.5, size: 6.2 });
  s += c.out + address(d, 188, c.y + 1, { accent: GOLD, sub: MUTED }, 30).out;
  if (qr) s += qrSmall(d, 30, H - 30 - qr - 6, qr, {});
  s += caps(qr ? 74 : 30, H - 26, legalLine(d), MUTED, { size: 3.8, ls: 1.2 });
  return svg(B, d, s);
}
function portraitBack(d, B, o) {
  const [w, h] = [H, W], qr = cleanLinkedIn(d.linkedin) ? 50 : 0;
  let s = bg(w, h, B, o.bg), y = 64;
  if (o.head) { s += caps(w / 2, 28, d.company === "group" ? "Kayak Group" : (COMPANY[d.company] || COMPANY.ksa).label, o.ink, { size: 4.2, ls: 1.6, anchor: "middle" }) + hair(24, 35, w - 24, 35); y = 70; }
  else s += `<g transform="translate(${w / 2 - 92 * 0.16} 24) scale(0.16)">${identifier(DEEP, "#17807E", (COMPANY[d.company] || COMPANY.ksa).under)}</g>`;
  s += T(w / 2, y, d.name || "Your Name", { serif: true, size: fitSerif(d.name, 13, w - 36), weight: 600, fill: o.ink, anchor: "middle" });
  s += caps(w / 2, y + 12, d.title, o.accent, { size: 4.6, anchor: "middle" }) + caps(w / 2, y + 21, d.department, o.sub, { size: 4.2, anchor: "middle" });
  s += hair(w / 2 - 14, y + 30, w / 2 + 14, y + 30);
  const c = contactLines(d, w / 2, y + 48, { ink: o.ink, accent: o.accent, lh: 10, size: 6.2, anchor: "middle" });
  s += c.out + address(d, w / 2, c.y + 2, { accent: o.accent, sub: o.sub, anchor: "middle" }, 38).out;
  if (qr) s += qrSmall(d, (w - qr) / 2, h - 40 - qr - 8, qr, o);
  s += caps(w / 2, h - 22, legalLine(d), o.sub, { size: 3.4, ls: 1, anchor: "middle" });
  return svg(B, d, s);
}

function rows(d) {
  const r = [];
  const phones = (d.phones || []).filter(Boolean);
  if (phones.length) r.push(["phone", phones.join("   ·   ")]);
  if (d.whatsapp) r.push(["whatsapp", d.whatsapp]);
  if (d.email) r.push(["mail", d.email]);
  if (d.website) r.push(["web", d.website]);
  return r;
}

function splitAddress(a, max) {
  const words = a.split(/\s+/), out = [];
  let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) out.push(cur);
  return out.slice(0, 3);
}

function svg(B, d, inner) {
  const [w, h] = dims(d);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-B} ${-B} ${w + 2 * B} ${h + 2 * B}" width="${w + 2 * B}" height="${h + 2 * B}">${inner}</svg>`;
}

// vCard 3.0, so the card's details go straight into a phone's contacts.
function vcard(d) {
  const co = COMPANY[d.company] || COMPANY.ksa;
  const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1");
  const [first, ...rest] = (d.name || "").trim().split(/\s+/);
  const L = ["BEGIN:VCARD", "VERSION:3.0", `N:${esc(rest.join(" "))};${esc(first)};;;`, `FN:${esc(d.name)}`, `ORG:${esc(co.legal)}${d.department ? ";" + esc(d.department) : ""}`, `TITLE:${esc(d.title)}`];
  (d.phones || []).filter(Boolean).forEach((p) => L.push(`TEL;TYPE=CELL,VOICE:${p}`));
  if (d.whatsapp) L.push(`item1.TEL;TYPE=CELL:${d.whatsapp}`, "item1.X-ABLabel:WhatsApp");
  if (d.email) L.push(`EMAIL;TYPE=WORK,INTERNET:${d.email}`);
  if (d.website) L.push(`URL:${/^https?:/.test(d.website) ? d.website : "https://" + d.website}`);
  const li = cleanLinkedIn(d.linkedin); if (li) L.push(`item2.URL:${li}`, "item2.X-ABLabel:LinkedIn", `X-SOCIALPROFILE;TYPE=linkedin:${li}`);
  if (d.address) L.push(`ADR;TYPE=WORK:;;${esc(d.address)};;;;India`);
  L.push("END:VCARD");
  return L.join("\r\n");
}

// ---- Export helpers ----
let fontCss = "";
async function fontFaceCss() {
  if (fontCss) return fontCss;
  const b64 = async (u) => { const u8 = new Uint8Array(await (await fetch(u)).arrayBuffer()); let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  fontCss = `@font-face{font-family:"Archivo";src:url(data:font/woff2;base64,${await b64("/_shared/fonts/Archivo.woff2")}) format("woff2");font-weight:100 900;font-stretch:62% 125%}@font-face{font-family:"Source Serif 4";src:url(data:font/woff2;base64,${await b64("/_shared/fonts/SourceSerif4.woff2")}) format("woff2");font-weight:200 900}`;
  return fontCss;
}
async function withFonts(svgText) {
  return svgText.replace(/(<svg[^>]*>)/, `$1<style>${await fontFaceCss()}</style>`);
}
function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

async function raster(svgText, type, dpi) {
  const t = await withFonts(svgText);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([t], { type: "image/svg+xml" }));
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("Could not draw the card.")); img.src = url; });
  const vb = svgText.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
  const scale = dpi / 96;
  const c = document.createElement("canvas");
  c.width = Math.round(vb[2] * scale); c.height = Math.round(vb[3] * scale);
  const g = c.getContext("2d");
  if (type === "image/jpeg") { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
  await document.fonts?.ready;
  g.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return new Promise((r) => c.toBlob(r, type, 0.95));
}

let pdfReady = null;
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src)); document.head.append(s); }); }
const FONT_FILES = { "SS4-R": "SourceSerif4-Regular.ttf", "SS4-SB": "SourceSerif4-SemiBold.ttf", "Arch-R": "Archivo-Regular.ttf", "Arch-SB": "Archivo-SemiBold.ttf", "Arch-B": "Archivo-Bold.ttf", "ArchX-SB": "ArchivoExpanded-SemiBold.ttf", "ArchX-B": "ArchivoExpanded-Bold.ttf" };
async function pdfLibs() {
  if (!pdfReady) pdfReady = (async () => {
    await loadScript("/vendor/jspdf.umd.min.js");
    await loadScript("/vendor/svg2pdf.umd.min.js");
    const fonts = {};
    for (const [n, f] of Object.entries(FONT_FILES)) {
      const b = new Uint8Array(await (await fetch("/vendor/fonts-ttf/" + f)).arrayBuffer());
      let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      fonts[n] = btoa(s);
    }
    return fonts;
  })();
  return pdfReady;
}
function pdfFamily(el) {
  if ((el.getAttribute("font-family") || "").includes("Serif")) return Number(el.getAttribute("font-weight") || 400) >= 600 ? "SS4-SB" : "SS4-R";
  const w = Number(el.getAttribute("font-weight") || 400), x = (el.getAttribute("font-stretch") || "") === "125%";
  if (x) return w >= 700 ? "ArchX-B" : "ArchX-SB";
  return w >= 700 ? "Arch-B" : w >= 600 ? "Arch-SB" : "Arch-R";
}
async function toPdf(faces, name, bleed, spec) {
  const fonts = await pdfLibs();
  const { jsPDF } = window.jspdf;
  const vb = faces[0].match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
  const wmm = vb[2] * UNIT_MM, hmm = vb[3] * UNIT_MM, orient = wmm >= hmm ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation: orient, unit: "mm", format: [wmm, hmm], compress: true });
  for (const [n] of Object.entries(FONT_FILES)) { doc.addFileToVFS(n + ".ttf", fonts[n]); doc.addFont(n + ".ttf", n, "normal"); }
  doc.setProperties({ title: name, creator: "Kayak Internal · Business Cards", author: "Kayak Strategic Advisors" });
  for (let i = 0; i < faces.length; i++) {
    if (i) doc.addPage([wmm, hmm], orient);
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0";
    host.innerHTML = faces[i];
    document.body.append(host);
    const el = host.querySelector("svg");
    el.querySelectorAll("text").forEach((t) => { t.setAttribute("font-family", pdfFamily(t)); t.setAttribute("font-weight", "normal"); t.removeAttribute("font-stretch"); });
    await doc.svg(el, { x: 0, y: 0, width: wmm, height: hmm });
    host.remove();
  }
  if (spec) { // a print instruction sheet for the printer, as the last page
    doc.addPage([210, 297], "portrait"); doc.setFont("Arch-B", "normal"); doc.setFontSize(16); doc.setTextColor("#0E2F3C"); doc.text("Print specification", 20, 28);
    doc.setFont("Arch-R", "normal"); doc.setFontSize(10.5); let y = 42;
    for (const [k, v] of spec) { doc.setFont("Arch-SB", "normal"); doc.text(k, 20, y); doc.setFont("Arch-R", "normal"); doc.text(doc.splitTextToSize(v, 120), 70, y); y += 7 * Math.max(1, doc.splitTextToSize(v, 120).length); }
  }
  return doc.output("blob");
}

// ---- View ----
export async function render(main, ctx) {
  await Promise.all([loadMaster(), qrLib().catch(() => {})]);
  const me = ctx.me;
  let d = { ...DEFAULTS, name: me.name || "", email: me.email || "", title: me.title || DEFAULTS.title, phones: [me.phone || "", ""] };
  let savedId = null, flipped = false;
  const providers = (await api("/api/ai/providers")).providers;
  const { items } = await api("/api/cards");
  const opt = (o, v) => Object.entries(o).map(([k, l]) => `<option value="${k}"${k === v ? " selected" : ""}>${esc(typeof l === "string" ? l : l.label)}</option>`).join("");

  main.innerHTML = String(html`<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Business Cards</span><h1>Kayak business cards</h1><p class="lead">Eight designs in landscape and portrait, all drawn from the Kayak identifier, the pattern library and the navigator's marks. Add a LinkedIn link for a scannable QR code and a WhatsApp number with its own icon. Turn the card in 3D, choose the paper, foil and painted edge, and export print-ready files or a contact card.</p></div></div>
    <div class="split">
      <div class="stack">
        <form class="card stack" id="ai">
          <div class="field"><label for="prompt">${ico("spark")} Describe the card</label>
          <textarea class="textarea" id="prompt" style="min-height:84px" placeholder="e.g. Group card for Priya Shah, Associate Director – Forensic Services, +91 98200 12345, WhatsApp +91 98200 12345, linkedin.com/in/priyashah"></textarea></div>
          <div class="row"><button class="btn btn-primary" id="aibtn" ${providers.length ? "" : "disabled"}>${ico("spark")} Fill in from my description</button>${providers.length ? "" : html`<span class="small muted">Connect an AI key to use this; the form below always works.</span>`}</div>
        </form>
        <section class="card stack-sm"><h3>Choose a design</h3><div class="cd-gallery" id="gallery"></div></section>
        <form class="card form-grid" id="f">
          <div class="field"><label for="company">Company</label><select class="select" id="company" name="company">${raw(opt(Object.fromEntries(Object.entries(COMPANY).map(([k, v]) => [k, v.label])), d.company))}</select></div>
          <div class="field"><label for="design">Design</label><select class="select" id="design" name="design">${raw(opt(DESIGNS, d.design))}</select></div>
          <div class="field"><label for="name">Name</label><input class="input" id="name" name="name" maxlength="40"></div>
          <div class="field"><label for="title">Designation</label><input class="input" id="title" name="title" maxlength="48"></div>
          <div class="field"><label for="department">Practice or department</label><input class="input" id="department" name="department" maxlength="40"></div>
          <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" maxlength="48"></div>
          <div class="field"><label for="p0">${ico("phone")} Mobile</label><input class="input" id="p0" name="p0" maxlength="20"></div>
          <div class="field"><label for="p1">Second number</label><input class="input" id="p1" name="p1" maxlength="20"></div>
          <div class="field"><label for="whatsapp"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${raw(ICON.whatsapp)}</svg> WhatsApp number</label><input class="input" id="whatsapp" name="whatsapp" maxlength="20" placeholder="Shown beside the WhatsApp icon"></div>
          <div class="field"><label for="linkedin"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${raw(ICON.linkedin)}</svg> LinkedIn link</label><input class="input" id="linkedin" name="linkedin" maxlength="160" placeholder="linkedin.com/in/your-name"><span class="small" id="lihint"></span></div>
          <div class="field"><label for="website">Website</label><input class="input" id="website" name="website" maxlength="40"></div>
          <div class="field"><label for="locations">Locations</label><input class="input" id="locations" name="locations" maxlength="40"></div>
          <div class="field" style="grid-column:1/-1"><label for="address">Address</label><input class="input" id="address" name="address" maxlength="140"></div>
          <div class="field"><label for="stock">Paper</label><select class="select" id="stock" name="stock">${raw(opt(FINISH.stock, d.stock))}</select></div>
          <div class="field"><label for="foil">Foil</label><select class="select" id="foil" name="foil">${raw(opt(FINISH.foil, d.foil))}</select></div>
          <div class="field"><label for="edge">Painted edge</label><select class="select" id="edge" name="edge">${raw(opt(FINISH.edge, d.edge))}</select></div>
        </form>
        <div class="card stack-sm"><h3>Saved cards</h3><div id="saved"></div></div>
      </div>
      <div class="stack sticky">
        <div class="cd-stage" id="stage"><div class="cd-card" id="card3d" tabindex="0" role="button" aria-label="Business card preview. Press to turn it over."><div class="cd-face cd-front" id="front"></div><div class="cd-face cd-back" id="back"></div><i class="cd-sheen" aria-hidden="true"></i></div>
          <div class="row" style="justify-content:center"><button class="btn btn-ghost btn-sm" id="flip" type="button">Turn over</button><span class="small muted" id="spec"></span></div></div>
        <div class="cardstage cd-flat"><span class="lbl">Front</span><div class="face" id="ffront"></div><span class="lbl">Back</span><div class="face" id="fback"></div></div>
        <div class="card stack-sm"><h3>Export</h3>
          <div class="row">
            <button class="btn btn-primary" data-x="pdf-print">${ico("download")} Print PDF (3 mm bleed + spec)</button>
            <button class="btn btn-ghost" data-x="pdf">${ico("download")} PDF</button>
            <button class="btn btn-ghost" data-x="svg">SVG</button>
            <button class="btn btn-ghost" data-x="png">PNG 600 dpi</button>
            <button class="btn btn-ghost" data-x="jpg">JPG 300 dpi</button>
            <button class="btn btn-ghost" data-x="vcf">${ico("users")} Contact card (.vcf)</button>
          </div>
          <p class="small muted">Size 3.5 × 2 in (88.9 × 50.8 mm), or 2 × 3.5 in for portrait designs. The print PDF ends with a specification page for the printer: paper, foil and painted edge. Test-scan the QR code from the printed proof before the full run.</p>
          <div class="row"><button class="btn btn-ghost btn-sm" id="save">${ico("check")} Save this card</button><button class="btn btn-quiet btn-sm" id="reset">Start again</button></div>
        </div>
      </div>
    </div></div>`);

  const form = $("#f");
  const fill = () => {
    for (const k of ["company", "design", "name", "title", "department", "email", "whatsapp", "linkedin", "website", "locations", "address", "stock", "foil", "edge"]) form[k].value = d[k] ?? "";
    form.p0.value = d.phones[0] || ""; form.p1.value = d.phones[1] || "";
  };
  const read = () => { const v = Object.fromEntries(new FormData(form)); d = { ...d, ...v, phones: [v.p0, v.p1] }; delete d.p0; delete d.p1; };
  const gallery = () => {
    $("#gallery").innerHTML = Object.entries(DESIGNS).map(([k, v]) => `<button type="button" class="cd-thumb${k === d.design ? " on" : ""}${v.o === "p" ? " p" : ""}" data-design="${k}" aria-pressed="${k === d.design}"><span class="cd-mini">${front({ ...d, design: k }, 0)}</span><b>${esc(v.label)}</b><span>${esc(v.note)}</span></button>`).join("");
    $$("[data-design]", main).forEach((b) => (b.onclick = () => { d.design = b.dataset.design; form.design.value = d.design; draw(); }));
  };
  const draw = () => {
    const f = front(d, 0), b = back(d, 0), p = DESIGNS[d.design].o === "p";
    $("#front").innerHTML = f; $("#back").innerHTML = b; $("#ffront").innerHTML = f; $("#fback").innerHTML = b;
    const c = $("#card3d"); c.classList.toggle("portrait", p); c.dataset.edge = d.edge; c.dataset.foil = d.foil; c.dataset.stock = d.stock;
    $("#spec").textContent = `${FINISH.stock[d.stock].split(",")[0]} · ${d.foil === "gold" ? "gold foil" : "no foil"} · ${d.edge === "none" ? "plain edge" : d.edge + " edge"}`;
    const li = cleanLinkedIn(d.linkedin);
    $("#lihint").textContent = !d.linkedin ? "Adds a QR code on the back that opens this LinkedIn page." : li ? `QR opens ${li}` : "That does not look like a LinkedIn profile or company link.";
    $("#lihint").style.color = d.linkedin && !li ? "var(--danger)" : "";
    gallery();
  };
  form.oninput = () => { read(); draw(); };
  fill(); draw();
  document.fonts?.load('600 12px "Source Serif 4"').then(() => draw()).catch(() => {});

  // 3D: click or Enter turns the card; the sheen follows the pointer like light on foil.
  const card = $("#card3d"), stage = $("#stage");
  const turn = () => { flipped = !flipped; card.classList.toggle("flipped", flipped); };
  card.onclick = turn; $("#flip").onclick = turn;
  card.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); turn(); } };
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    stage.onpointermove = (e) => { const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; card.style.setProperty("--rx", `${-y * 14}deg`); card.style.setProperty("--ry", `${x * 18}deg`); card.style.setProperty("--sx", `${(x + 0.5) * 100}%`); card.style.setProperty("--sy", `${(y + 0.5) * 100}%`); };
    stage.onpointerleave = () => { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); };
  }

  const drawSaved = (list) => {
    $("#saved").innerHTML = list.length ? list.map((c) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:6px 0"><button class="btn btn-quiet btn-sm" data-open="${esc(c.id)}">${esc(c.label)}</button><span class="small faint">${esc(fmtDate(c.updated_at))}</span><button class="btn btn-quiet btn-sm" data-rm="${esc(c.id)}" aria-label="Delete">${ico("trash")}</button></div>`).join("") : `<p class="small muted">Cards you save appear here.</p>`;
    $$("[data-open]", main).forEach((b) => (b.onclick = () => { const c = list.find((x) => x.id === b.dataset.open); d = { ...DEFAULTS, ...JSON.parse(c.data) }; if (!DESIGNS[d.design]) d.design = "chambers"; savedId = c.id; fill(); draw(); }));
    $$("[data-rm]", main).forEach((b) => (b.onclick = async () => { if (!(await confirmDialog("Delete this saved card?", "This only removes the saved details.", "Delete", true))) return; await api(`/api/cards/${b.dataset.rm}`, { method: "DELETE" }); drawSaved((await api("/api/cards")).items); }));
  };
  drawSaved(items);

  $("#ai").onsubmit = async (e) => {
    e.preventDefault();
    const btn = $("#aibtn");
    const prompt = $("#prompt").value.trim();
    if (!prompt) return toast("Describe the card first.", "err");
    setBusy(btn, true, "Reading…");
    try {
      const { fields: f } = await api("/api/ai/card-fields", { body: { prompt } });
      d = { ...d, ...Object.fromEntries(Object.entries(f).filter(([k, v]) => v && k !== "note" && k !== "phones")), phones: f.phones?.length ? [f.phones[0] || "", f.phones[1] || ""] : d.phones };
      if (!COMPANY[d.company]) d.company = "ksa";
      if (d.company === "group" && !d.address) d.address = DEFAULTS.address;
      fill(); draw();
      toast(f.note ? `Filled in. Note: ${f.note}` : "Filled in. Check every detail before printing.");
    } catch (err) { toast(err.message, "err"); }
    finally { setBusy(btn, false); }
  };

  const slug = () => (d.name || "card").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") + "_" + d.company + "_" + d.design;
  $$("[data-x]", main).forEach((b) => (b.onclick = async () => {
    read();
    const k = b.dataset.x;
    if (d.linkedin && !cleanLinkedIn(d.linkedin)) return toast("Fix the LinkedIn link first, or clear it.", "err");
    setBusy(b, true, "Preparing…");
    try {
      if (k === "vcf") download(new Blob([vcard(d)], { type: "text/vcard" }), `${(d.name || "contact").replace(/[^\w]+/g, "-")}.vcf`);
      else if (k === "svg") {
        download(new Blob([await withFonts(front(d, 0))], { type: "image/svg+xml" }), `${slug()}_front.svg`);
        download(new Blob([await withFonts(back(d, 0))], { type: "image/svg+xml" }), `${slug()}_back.svg`);
      } else if (k === "png" || k === "jpg") {
        const type = k === "png" ? "image/png" : "image/jpeg", dpi = k === "png" ? 600 : 300;
        download(await raster(front(d, 0), type, dpi), `${slug()}_front.${k}`);
        download(await raster(back(d, 0), type, dpi), `${slug()}_back.${k}`);
      } else {
        const bleed = k === "pdf-print";
        const B = bleed ? 3 / UNIT_MM : 0;
        const [w, h] = dims(d);
        const spec = bleed ? [["Name", d.name], ["Company", COMPANY[d.company].footer || COMPANY[d.company].legal], ["Design", `${DESIGNS[d.design].label}: ${DESIGNS[d.design].note}`], ["Trim size", `${(w * UNIT_MM).toFixed(1)} × ${(h * UNIT_MM).toFixed(1)} mm, with 3 mm bleed on every side`], ["Paper", FINISH.stock[d.stock]], ["Foil", FINISH.foil[d.foil]], ["Edge", FINISH.edge[d.edge]], ["Colours", "Deep Current #0E2F3C (Pantone 7546 C), Open Water #17807E (Pantone 7716 C), Saffron #EE9B1E (Pantone 7409 C)"], ["QR code", cleanLinkedIn(d.linkedin) ? `Opens ${cleanLinkedIn(d.linkedin)}. Print at 100%, never smaller than 11 mm across, and test-scan the proof.` : "None"], ["Proof", "Send a printed proof for approval before the run."]] : null;
        download(await toPdf([front(d, B), back(d, B)], `Kayak card — ${d.name}`, bleed, spec), `${slug()}${bleed ? "_print-bleed" : ""}.pdf`);
      }
    } catch (err) { toast(err.message || "Export failed.", "err"); }
    finally { setBusy(b, false); }
  }));
  $("#save").onclick = async () => {
    read();
    const r = await api("/api/cards", { body: { id: savedId, label: `${d.name || "Card"} · ${COMPANY[d.company].label} · ${DESIGNS[d.design].label}`, template: d.company, data: d } });
    savedId = r.id; toast("Card saved."); drawSaved((await api("/api/cards")).items);
  };
  $("#reset").onclick = () => { d = { ...DEFAULTS }; savedId = null; fill(); draw(); };
}

export const _test = { front, back, COMPANY, DESIGNS, vcard, cleanLinkedIn };
