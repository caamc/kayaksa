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
const DESIGNS = {
  heritage: { label: "Heritage", o: "l", note: "Deep Current with a double gold-foil frame" },
  signature: { label: "Signature", o: "p", note: "Portrait. The two blades cropped large, gold-foil wordmark" },
  confluence: { label: "Confluence", o: "l", note: "Half Confluence pattern, half cotton paper" },
  navigator: { label: "Navigator", o: "l", note: "Cotton white, navigator's marks, saffron painted edge" },
  monogram: { label: "Monogram", o: "p", note: "Portrait. Blind-embossed identifier on cotton white" },
  contour: { label: "Contour", o: "l", note: "Deep Current with chart-contour lines" },
  openwater: { label: "Open Water", o: "l", note: "Light, with a band of Kayak blades" },
  minimal: { label: "Minimal", o: "l", note: "White, the wordmark and one saffron rule" },
};
const FINISH = {
  stock: { cotton: "Cotton 700 gsm, letterpress", duplex: "Duplex 1000 gsm (two 500 gsm sheets, Deep Current core)", soft: "700 gsm board, soft-touch laminate with spot UV on the blades" },
  foil: { gold: "Gold hot-foil on the frame, rules and gold lettering", none: "No foil (print the gold as Pantone 7563 C)" },
  edge: { saffron: "Edge-painted Saffron (Pantone 7409 C)", teal: "Edge-painted Open Water (Pantone 7716 C)", none: "No edge painting" },
};
const DEFAULTS = {
  name: "", title: "Founder & Director", department: "", phones: ["", ""], whatsapp: "", linkedin: "", email: "", website: "www.kayaksa.com",
  address: "A/2, 314, Shah & Nahar Industrial Estate, Delisle Road, Mumbai 400013", locations: "Mumbai · Thane", company: "ksa", design: "heritage",
  stock: "cotton", foil: "gold", edge: "saffron",
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
  text ? `<text x="${x}" y="${y}" font-family="Archivo" font-size="${o.size || 8}" font-weight="${o.weight || 400}"${o.stretch ? ` font-stretch="${o.stretch}"` : ""} fill="${o.fill || "#0E2F3C"}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.ls ? ` letter-spacing="${o.ls}"` : ""}>${E(text)}</text>` : "";

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
function lightLogo(d, co, x, y, s, desc = "#17807E") {
  return `<g transform="translate(${x} ${y}) scale(${s})">${wordmark("#0E2F3C", "#17807E", co.under, "#17807E")}</g><text x="${x}" y="${y + 134 * s}" font-family="Archivo" font-size="${13.2 * s}" font-weight="600" fill="${desc}" textLength="${416 * s}" lengthAdjust="spacing">${E(co.descriptor)}</text>`;
}
function darkLogo(d, co, x, y, s) {
  if (d.company === "ksa") return `<g transform="translate(${x} ${y}) scale(${s})">${MASTER_REVERSED}</g>`;
  return `<g transform="translate(${x} ${y}) scale(${s})">${wordmark("#FFFFFF", "#3FB0A9", co.under)}</g>` + (d.company === "group" ? T(x + 1, y + 134 * s, "G R O U P", { size: 22 * s, weight: 600, fill: "#E2C07A", ls: 8 * s }) : `<text x="${x}" y="${y + 134 * s}" font-family="Archivo" font-size="${13.2 * s}" font-weight="600" fill="#CDE8E3" textLength="${416 * s}" lengthAdjust="spacing">${E(co.descriptor)}</text>`);
}

function front(d, B) {
  const co = COMPANY[d.company] || COMPANY.ksa;
  const web = (d.website || "www.kayaksa.com").toUpperCase();
  const loc = (d.locations || "").toUpperCase();
  switch (d.design) {
    case "openwater": return svg(B, d, `${bg(W, H, B, "#FBFAF5")}${lightLogo(d, co, 64, 44, 0.5)}${bladeBand(150, 48 + B, B)}${T(W - 22, 30, loc, { size: 5.6, weight: 600, fill: "#9C630E", anchor: "end", ls: 1.6 })}${T(22, 132, web, { size: 6.6, weight: 600, fill: "#0E2F3C", ls: 2.2 })}`);
    case "minimal": return svg(B, d, `${bg(W, H, B, "#FFFFFF")}${lightLogo(d, co, 76, 58, 0.44)}<rect x="76" y="132" width="40" height="1.6" fill="#EE9B1E"/>${T(76, 150, web, { size: 6.4, weight: 600, fill: "#3E5563", ls: 2 })}`);
    case "contour": return svg(B, d, `${bg(W, H, B, "#0E2F3C")}${contours(B)}<rect x="22" y="40" width="${416 * 0.44 + 28}" height="76" fill="#0E2F3C"/>${darkLogo(d, co, 36, 50, 0.44)}${T(W - 22, H - 22, web, { size: 6.4, weight: 600, fill: "#F5C46D", anchor: "end", ls: 2 })}`);
    case "confluence": {
      const half = W * 0.42;
      return svg(B, d, `${bg(W, H, B, "#FBFAF5")}<clipPath id="cfl"><rect x="${-B}" y="${-B}" width="${half + B}" height="${H + 2 * B}"/></clipPath><g clip-path="url(#cfl)">${bg(half, H, B, "#0E2F3C")}${confluenceRepeat(-B, -B, half + B, H + 2 * B, 0.5)}</g>
        <rect x="${half}" y="${-B}" width="1.2" height="${H + 2 * B}" fill="#C9A25A"/>${lightLogo(d, co, half + 24, 66, 0.3)}
        <rect x="${half + 24}" y="${118}" width="28" height="1.4" fill="#EE9B1E"/>${T(half + 24, 134, web, { size: 6, weight: 600, fill: "#0E2F3C", ls: 2 })}${T(half + 24, 146, loc, { size: 5.2, weight: 600, fill: "#9C630E", ls: 1.4 })}`);
    }
    case "navigator": return svg(B, d, `${bg(W, H, B, "#FBFAF5")}${navMarks(W, H, 16, 12, "#9C630E")}${lightLogo(d, co, (W - 416 * 0.42) / 2, 60, 0.42)}
      <g transform="translate(${W / 2} 134)"><line x1="-36" y1="0" x2="-7" y2="0" stroke="#17807E" stroke-width="0.6"/><rect x="-2" y="-2" width="4" height="4" fill="#EE9B1E" transform="rotate(45)"/><line x1="7" y1="0" x2="36" y2="0" stroke="#17807E" stroke-width="0.6"/></g>
      ${T(W / 2, 152, web, { size: 6.2, weight: 600, fill: "#0E2F3C", anchor: "middle", ls: 2.2 })}${T(W / 2, 30, loc, { size: 5, weight: 600, fill: "#9C630E", anchor: "middle", ls: 1.6 })}`);
    case "signature": {
      const [w, h] = [H, W];
      return svg(B, d, `${bg(w, h, B, "#0B2733")}<g transform="translate(${w / 2 - 92 * 1.45} ${-26}) scale(2.9)" opacity="0.98">${identifier("#0B2733", "#17807E", "stem")}</g>
        <rect x="10" y="10" width="${w - 20}" height="${h - 20}" fill="none" stroke="#C9A25A" stroke-width="0.6"/>
        ${darkLogo(d, co, (w - 416 * 0.34) / 2, 214, 0.34)}
        <g transform="translate(${w / 2} 278)"><line x1="-30" y1="0" x2="-6" y2="0" stroke="#C9A25A" stroke-width="0.5"/><rect x="-2" y="-2" width="4" height="4" fill="#F5C46D" transform="rotate(45)"/><line x1="6" y1="0" x2="30" y2="0" stroke="#C9A25A" stroke-width="0.5"/></g>
        ${T(w / 2, 296, web, { size: 6, weight: 600, fill: "#F5C46D", anchor: "middle", ls: 2 })}${T(w / 2, 308, loc, { size: 4.8, weight: 600, fill: "#A9C0C6", anchor: "middle", ls: 1.4 })}`);
    }
    case "monogram": {
      const [w, h] = [H, W];
      return svg(B, d, `${bg(w, h, B, "#FBFAF5")}<g transform="translate(${w / 2 - 92 * 0.85} 52) scale(1.7)">${identifier("#E6ECEA", "#E1E9E7", "stem", "#ECE7DA")}</g>
        ${lightLogo(d, co, (w - 416 * 0.34) / 2, 238, 0.34)}<rect x="${w / 2 - 14}" y="${276}" width="28" height="1.4" fill="#EE9B1E"/>
        ${T(w / 2, 294, web, { size: 6, weight: 600, fill: "#0E2F3C", anchor: "middle", ls: 2 })}${T(w / 2, 306, loc, { size: 4.8, weight: 600, fill: "#9C630E", anchor: "middle", ls: 1.4 })}`);
    }
  }
  // heritage
  let logo = darkLogo(d, co, d.company === "group" ? 30 : 76, d.company === "group" ? 36 : d.company === "ksa" ? 50 : 54, d.company === "group" ? 0.395 : 0.44);
  let foot = "";
  if (d.company === "group") {
    const ents = [["stem", "STRATEGIC ADVISORS"], ["spark", "INNOVATIONS"], ["build", "TECHNOLOGY SOLUTIONS"]];
    foot = `<line x1="30" y1="148" x2="${W - 30}" y2="148" stroke="#C9A25A" stroke-width="0.5"/>` +
      ents.map(([u, n], i) => `<g transform="translate(${30 + i * 96} 156) scale(0.11)">${identifier("#FFFFFF", "#3FB0A9", u)}</g>${T(43 + i * 96, 165, n, { size: 5.2, weight: 600, fill: "#FFFFFF", ls: 0.9 })}`).join("");
  } else {
    foot = `<g transform="translate(${W / 2} 150)"><line x1="-44" y1="0" x2="-8" y2="0" stroke="#C9A25A" stroke-width="0.5"/><rect x="-2.2" y="-2.2" width="4.4" height="4.4" fill="#F5C46D" transform="rotate(45)"/><line x1="8" y1="0" x2="44" y2="0" stroke="#C9A25A" stroke-width="0.5"/></g>` +
      T(W / 2, 168, web, { size: 6.6, weight: 600, fill: "#F5C46D", anchor: "middle", ls: 2.2 });
  }
  const wm = d.company === "group" ? `<g transform="translate(${W - 150} -20) scale(2.4)" opacity="0.55">${identifier("#123A49", "#123A49", "stem", "#123A49")}</g>` : "";
  return svg(B, d, `${frame(B)}${wm}${logo}${loc ? T(W - 24, 26, loc, { size: 5.6, weight: 600, fill: "#E2C07A", anchor: "end", ls: 1.6 }) : ""}${foot}`);
}

// Contact rows: an icon for each channel, so a WhatsApp number is never mistaken for a call line.
function rows(d) {
  const r = [];
  const phones = (d.phones || []).filter(Boolean);
  if (phones.length) r.push(["phone", phones.join("   ·   ")]);
  if (d.whatsapp) r.push(["whatsapp", d.whatsapp]);
  if (d.email) r.push(["mail", d.email]);
  if (d.website) r.push(["web", d.website]);
  return r;
}
function contactBlock(d, x0, y, maxChars, ink = "#0E2F3C", ic = "#17807E", sub = "#3E5563") {
  let out = "";
  for (const [k, v] of rows(d)) { out += icon(k, x0, y - 6.3, 7.2, k === "whatsapp" ? ink : ic) + T(x0 + 12, y, v, { size: 7.4, fill: ink }); y += 12; }
  if (d.address) {
    const parts = splitAddress(d.address, maxChars);
    out += icon("pin", x0, y - 6.3, 7.2, ic);
    parts.forEach((p, i) => (out += T(x0 + 12, y + i * 8.4, p, { size: 6.2, fill: sub })));
    y += parts.length * 8.4 + 4;
  }
  return { out, y };
}
function nameBlock(d, x0, y, ink = "#0E2F3C", accent = "#9C630E", size, maxW = 230) {
  // Archivo Expanded Bold runs about 0.78 em per character: shrink long names to fit the width.
  const nameSize = Math.min(size || 12.5, maxW / (Math.max(8, (d.name || "Your Name").length) * 0.78));
  const dept = [d.title, d.department].filter(Boolean).join(" · ").toUpperCase();
  return T(x0, y, d.name || "Your Name", { size: nameSize, weight: 700, stretch: "125%", fill: ink }) +
    `<rect x="${x0}" y="${y + 9.8}" width="3.4" height="3.4" fill="#EE9B1E" transform="rotate(45 ${x0 + 1.7} ${y + 11.5})"/>` + T(x0 + 9, y + 13, dept, { size: 6.2, weight: 600, fill: accent, ls: 1.3 });
}

function back(d, B) {
  const co = COMPANY[d.company] || COMPANY.ksa;
  const hasQr = !!cleanLinkedIn(d.linkedin);
  if (DESIGNS[d.design]?.o === "p") {
    const [w, h] = [H, W], dark = d.design === "signature";
    const ink = dark ? "#FFFFFF" : "#0E2F3C", ic = dark ? "#F5C46D" : "#17807E", sub = dark ? "#CDE0DD" : "#3E5563";
    let s = bg(w, h, B, dark ? "#0B2733" : "#FBFAF5");
    s += `<g transform="translate(18 20) scale(0.26)">${identifier(dark ? "#FFFFFF" : "#0E2F3C", dark ? "#3FB0A9" : "#17807E", co.under)}</g>`;
    s += nameBlock(d, 18, 62, ink, dark ? "#E2C07A" : "#9C630E", 11.5, w - 36);
    s += `<line x1="18" y1="86" x2="${w - 18}" y2="86" stroke="#C9A25A" stroke-width="0.5"/>`;
    const c = contactBlock(d, 18, 104, 34, ink, ic, sub); s += c.out;
    if (hasQr) s += qrBlock(d, (w - 62) / 2, Math.max(c.y + 8, 196), 62, dark);
    s += T(18, h - 22, (co.footer || co.legal).toUpperCase(), { size: 4.6, weight: 600, fill: ink, ls: 0.8 });
    s += `<rect x="${-B}" y="${h - 6}" width="${w + 2 * B}" height="${6 + B}" fill="${dark ? "#C9A25A" : "#0E2F3C"}"/><rect x="${w - 46}" y="${h - 6}" width="${46 + B}" height="${6 + B}" fill="#EE9B1E"/>`;
    return svg(B, d, s);
  }
  let x0 = 22, panel = "";
  const right = W - 20, qr = hasQr ? (d.company === "group" ? 46 : 52) : 0;
  if (d.company === "group") {
    x0 = 130;
    const ents = [["stem", "Kayak Strategic Advisors", COMPANY.ksa.form], ["spark", "Kayak Innovations", COMPANY.innovations.form], ["build", "Kayak Technology Solutions", COMPANY.technology.form]];
    panel = `<rect x="${-B}" y="${-B}" width="${112 + B}" height="${H + 2 * B}" fill="#0B2733"/><rect x="112" y="${-B}" width="1" height="${H + 2 * B}" fill="#C9A25A"/>
      <g transform="translate(15 18) scale(0.17)">${wordmark("#FFFFFF", "#3FB0A9")}</g>${T(15.5, 41, "G R O U P", { size: 4.2, weight: 600, fill: "#E2C07A", ls: 1.6 })}
      ${d.locations ? T(15, 96, d.locations.toUpperCase(), { size: 5, weight: 600, fill: "#E2C07A", ls: 1.4 }) : ""}
      ${ents.map(([u, a, b], i) => `<g transform="translate(15 ${108 + i * 24}) scale(0.1)">${identifier("#FFFFFF", "#3FB0A9", u)}</g>${T(27, 114 + i * 24, a, { size: 5.7, weight: 600, fill: "#FFFFFF" })}${T(27, 121 + i * 24, b, { size: 4.8, fill: "#A9C6C4" })}`).join("")}`;
  }
  let body = nameBlock(d, x0, 30, "#0E2F3C", "#9C630E", 12.5, (d.company !== "group" ? right - 44 : right) - x0);
  if (d.company !== "group") body += `<g transform="translate(${right - 34} 17) scale(0.37)">${identifier("#0E2F3C", "#17807E", co.under)}</g>`;
  body += `<line x1="${x0}" y1="57" x2="${right}" y2="57" stroke="#C9A25A" stroke-width="0.5"/>`;
  const maxChars = Math.floor(((qr ? right - qr - 12 : right) - x0 - 12) / 3.3);
  const c = contactBlock(d, x0, 72, maxChars);
  body += c.out;
  if (qr) body += qrBlock(d, right - qr, 66, qr);
  let footer = "";
  if (d.company !== "group") {
    footer = T(x0, H - 20, (co.footer || co.legal).toUpperCase(), { size: 5.2, weight: 600, fill: "#0E2F3C", ls: 0.9 }) + (d.locations && !qr ? T(right, H - 20, d.locations.toUpperCase(), { size: 5.2, weight: 600, fill: "#9C630E", anchor: "end", ls: 1.2 }) : "");
    footer += `<rect x="${-B}" y="${H - 5}" width="${W + 2 * B}" height="${5 + B}" fill="#0E2F3C"/><rect x="${W - 64}" y="${H - 5}" width="${64 + B}" height="${5 + B}" fill="#EE9B1E"/>`;
  }
  const accent = d.company === "group" ? "" : d.design === "openwater" ? `<rect x="${-B}" y="${-B}" width="${W + 2 * B}" height="${4 + B}" fill="#17807E"/>` : d.design === "contour" ? `<g opacity="0.14">${contours(B)}</g>` : d.design === "navigator" ? navMarks(W, H, 8, 8, "#C9A25A") : d.design === "confluence" ? `<g opacity="0.08">${confluenceRepeat(-B, -B, W + 2 * B, H + 2 * B, 0.35)}</g>` : "";
  return svg(B, d, `${bg(W, H, B, d.design === "minimal" ? "#FFFFFF" : "#FBFAF5")}${accent}${panel}${body}${footer}`);
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
  const b = await (await fetch("/_shared/fonts/Archivo.woff2")).arrayBuffer();
  let s = ""; const u = new Uint8Array(b); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  fontCss = `@font-face{font-family:"Archivo";src:url(data:font/woff2;base64,${btoa(s)}) format("woff2");font-weight:100 900;font-stretch:62% 125%}`;
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
const FONT_FILES = { "Arch-R": "Archivo-Regular.ttf", "Arch-SB": "Archivo-SemiBold.ttf", "Arch-B": "Archivo-Bold.ttf", "ArchX-SB": "ArchivoExpanded-SemiBold.ttf", "ArchX-B": "ArchivoExpanded-Bold.ttf" };
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
    $$("[data-open]", main).forEach((b) => (b.onclick = () => { const c = list.find((x) => x.id === b.dataset.open); d = { ...DEFAULTS, ...JSON.parse(c.data) }; if (!DESIGNS[d.design]) d.design = "heritage"; savedId = c.id; fill(); draw(); }));
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
        const spec = bleed ? [["Name", d.name], ["Company", COMPANY[d.company].footer || COMPANY[d.company].legal], ["Design", `${DESIGNS[d.design].label}: ${DESIGNS[d.design].note}`], ["Trim size", `${(w * UNIT_MM).toFixed(1)} × ${(h * UNIT_MM).toFixed(1)} mm, with 3 mm bleed on every side`], ["Paper", FINISH.stock[d.stock]], ["Foil", FINISH.foil[d.foil]], ["Edge", FINISH.edge[d.edge]], ["Colours", "Deep Current #0E2F3C (Pantone 7546 C), Open Water #17807E (Pantone 7716 C), Saffron #EE9B1E (Pantone 7409 C)"], ["QR code", cleanLinkedIn(d.linkedin) ? `Opens ${cleanLinkedIn(d.linkedin)}. Print at 100%, never smaller than 16 mm, and test-scan the proof.` : "None"], ["Proof", "Send a printed proof for approval before the run."]] : null;
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
