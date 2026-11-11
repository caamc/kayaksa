import { $, $$, api, esc, html, raw, ico, toast, setBusy, confirmDialog, fmtDate } from "/_shared/js/ui.js";

// Card artwork is drawn at 336 x 192 units = 3.5 x 2 in (88.9 x 50.8 mm) at 96 units per inch.
const W = 336, H = 192, UNIT_MM = 25.4 / 96;
const COMPANY = {
  ksa: { label: "Kayak Strategic Advisors", legal: "Kayak Strategic Advisors Private Limited", descriptor: "STRATEGIC ADVISORS", under: "stem" },
  innovations: { label: "Kayak Innovations", legal: "Kayak Innovations (OPC) Private Limited", descriptor: "INNOVATIONS", under: "spark" },
  technology: { label: "Kayak Technology Solutions", legal: "Kayak Technology Solutions Private Limited", descriptor: "TECHNOLOGY SOLUTIONS", under: "build" },
  group: { label: "Kayak Group (all three companies)", legal: "Kayak Group", descriptor: "GROUP", under: "stem" },
};
const DEFAULTS = {
  name: "", title: "Founder & Director", department: "", phones: ["", ""], email: "", website: "www.kayaksa.com",
  address: "A/2, 314, Shah & Nahar Industrial Estate, Delisle Road, Mumbai 400013", locations: "Mumbai · Thane", company: "ksa",
};

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
function identifier(ink, left, under = "stem") {
  return `<path fill="${left}" d="${BL}"/><path fill="#EE9B1E" d="${BR}"/>${UNDER[under](ink, "#17807E")}`;
}
const E = (s) => esc(s ?? "");
const T = (x, y, text, o = {}) =>
  text ? `<text x="${x}" y="${y}" font-family="Archivo" font-size="${o.size || 8}" font-weight="${o.weight || 400}"${o.stretch ? ` font-stretch="${o.stretch}"` : ""} fill="${o.fill || "#0E2F3C"}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.ls ? ` letter-spacing="${o.ls}"` : ""}>${E(text)}</text>` : "";

let MASTER_REVERSED = "";
async function loadMaster() {
  if (MASTER_REVERSED) return;
  const s = await (await fetch("/_shared/logos/KSA_Logo_Full_Reversed.svg")).text();
  MASTER_REVERSED = s.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>[\s\S]*?<\/title>/, "");
}

function frame(B) {
  return `<rect x="${-B}" y="${-B}" width="${W + 2 * B}" height="${H + 2 * B}" fill="#0B2733"/>
  <rect x="9" y="9" width="${W - 18}" height="${H - 18}" fill="none" stroke="#C9A25A" stroke-width="0.75"/>
  <rect x="12" y="12" width="${W - 24}" height="${H - 24}" fill="none" stroke="#C9A25A" stroke-opacity="0.45" stroke-width="0.5"/>`;
}

function front(d, B) {
  const co = COMPANY[d.company] || COMPANY.ksa;
  let logo;
  if (d.company === "ksa") logo = `<g transform="translate(76 50) scale(0.44)">${MASTER_REVERSED}</g>`;
  else {
    logo = `<g transform="translate(${d.company === "group" ? 30 : 76} ${d.company === "group" ? 36 : 54}) scale(${d.company === "group" ? 0.395 : 0.44})">${wordmark("#FFFFFF", "#3FB0A9", co.under)}</g>`;
    if (d.company === "group") logo += T(31, 92, "G R O U P", { size: 8.6, weight: 600, fill: "#E2C07A", ls: 3.2 });
    else logo += `<text x="${76}" y="${54 + 134 * 0.44}" font-family="Archivo" font-size="${13.2 * 0.44}" font-weight="600" fill="#CDE8E3" textLength="${416 * 0.44}" lengthAdjust="spacing">${E(co.descriptor)}</text>`;
  }
  const loc = d.locations ? T(W - 24, 26, d.locations.toUpperCase(), { size: 5.6, weight: 600, fill: "#E2C07A", anchor: "end", ls: 1.6 }) : "";
  let foot = "";
  if (d.company === "group") {
    const ents = [["stem", "STRATEGIC ADVISORS"], ["spark", "INNOVATIONS"], ["build", "TECHNOLOGY SOLUTIONS"]];
    foot = `<line x1="30" y1="148" x2="${W - 30}" y2="148" stroke="#C9A25A" stroke-width="0.5"/>` +
      ents.map(([u, n], i) => `<g transform="translate(${30 + i * 96} 156) scale(0.11)">${identifier("#FFFFFF", "#3FB0A9", u)}</g>${T(43 + i * 96, 165, n, { size: 5.2, weight: 600, fill: "#FFFFFF", ls: 0.9 })}`).join("");
  } else {
    foot = `<g transform="translate(${W / 2} 150)"><line x1="-44" y1="0" x2="-8" y2="0" stroke="#C9A25A" stroke-width="0.5"/><rect x="-2.2" y="-2.2" width="4.4" height="4.4" fill="#F5C46D" transform="rotate(45)"/><line x1="8" y1="0" x2="44" y2="0" stroke="#C9A25A" stroke-width="0.5"/></g>` +
      T(W / 2, 168, (d.website || "www.kayaksa.com").toUpperCase(), { size: 6.6, weight: 600, fill: "#F5C46D", anchor: "middle", ls: 2.2 });
  }
  const wm = d.company === "group" ? `<g transform="translate(${W - 150} -20) scale(2.4)" opacity="0.55">${identifier("#123A49", "#123A49")}</g>` : "";
  return svg(B, `${frame(B)}${wm}${logo}${loc}${foot}`);
}

function back(d, B) {
  const co = COMPANY[d.company] || COMPANY.ksa;
  const phones = (d.phones || []).filter(Boolean);
  const rows = [];
  if (phones.length) rows.push(["MOB", phones.join("   |   ")]);
  if (d.email) rows.push(["EMAIL", d.email]);
  if (d.website) rows.push(["WEB", d.website]);
  const nameSize = d.name.length > 24 ? 11 : 12.5;
  let x0 = 22, panel = "";
  if (d.company === "group") {
    x0 = 130;
    const ents = [["stem", "Kayak Strategic Advisors", "Private Limited"], ["spark", "Kayak Innovations", "(OPC) Private Limited"], ["build", "Kayak Technology Solutions", "Private Limited"]];
    panel = `<rect x="${-B}" y="${-B}" width="${112 + B}" height="${H + 2 * B}" fill="#0B2733"/><rect x="112" y="${-B}" width="1" height="${H + 2 * B}" fill="#C9A25A"/>
      <g transform="translate(15 18) scale(0.17)">${wordmark("#FFFFFF", "#3FB0A9")}</g>${T(15.5, 41, "G R O U P", { size: 4.2, weight: 600, fill: "#E2C07A", ls: 1.6 })}
      ${d.locations ? T(15, 96, d.locations.toUpperCase(), { size: 5, weight: 600, fill: "#E2C07A", ls: 1.4 }) : ""}
      ${ents.map(([u, a, b], i) => `<g transform="translate(15 ${108 + i * 24}) scale(0.1)">${identifier("#FFFFFF", "#3FB0A9", u)}</g>${T(27, 114 + i * 24, a, { size: 5.7, weight: 600, fill: "#FFFFFF" })}${T(27, 121 + i * 24, b, { size: 4.8, fill: "#A9C6C4" })}`).join("")}`;
  }
  const right = W - 20;
  const dept = [d.title, d.department].filter(Boolean).join(" · ").toUpperCase();
  let y = 30;
  let body = T(x0, y, d.name || "Your Name", { size: nameSize, weight: 700, stretch: "125%", fill: "#0E2F3C" });
  y += 13;
  body += `<rect x="${x0}" y="${y - 3.2}" width="3.4" height="3.4" fill="#EE9B1E" transform="rotate(45 ${x0 + 1.7} ${y - 1.5})"/>` + T(x0 + 9, y, dept, { size: 6.2, weight: 600, fill: "#9C630E", ls: 1.3 });
  if (d.company !== "group") body += `<g transform="translate(${right - 34} 17) scale(0.37)">${identifier("#0E2F3C", "#17807E", co.under)}</g>`;
  y += 14;
  body += `<line x1="${x0}" y1="${y}" x2="${right}" y2="${y}" stroke="#C9A25A" stroke-width="0.5"/>`;
  y += 13;
  for (const [k, v] of rows) {
    body += T(x0, y, k, { size: 5.2, weight: 600, fill: "#17807E", ls: 1.1 }) + T(x0 + 30, y, v, { size: 7.6, fill: "#0E2F3C" });
    y += 12;
  }
  if (d.address) {
    const parts = splitAddress(d.address, d.company === "group" ? 44 : 62);
    body += T(x0, y, "ADDR", { size: 5.2, weight: 600, fill: "#17807E", ls: 1.1 });
    parts.forEach((p, i) => (body += T(x0 + 30, y + i * 8.4, p, { size: 6.2, fill: "#3E5563" })));
    y += parts.length * 8.4 + 4;
  }
  let footer = "";
  if (d.company !== "group") {
    footer = T(x0, H - 20, co.legal.toUpperCase(), { size: 5.4, weight: 600, fill: "#0E2F3C", ls: 1 }) + (d.locations ? T(right, H - 20, d.locations.toUpperCase(), { size: 5.2, weight: 600, fill: "#9C630E", anchor: "end", ls: 1.2 }) : "");
    footer += `<rect x="${-B}" y="${H - 5}" width="${W + 2 * B}" height="${5 + B}" fill="#0E2F3C"/><rect x="${W - 64}" y="${H - 5}" width="${64 + B}" height="${5 + B}" fill="#EE9B1E"/>`;
  }
  return svg(B, `<rect x="${-B}" y="${-B}" width="${W + 2 * B}" height="${H + 2 * B}" fill="#FBFAF5"/>${panel}${body}${footer}`);
}

function splitAddress(a, max) {
  const words = a.split(/\s+/), out = [];
  let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) out.push(cur);
  return out.slice(0, 3);
}

function svg(B, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-B} ${-B} ${W + 2 * B} ${H + 2 * B}" width="${W + 2 * B}" height="${H + 2 * B}">${inner}</svg>`;
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
async function toPdf(faces, name, bleed) {
  const fonts = await pdfLibs();
  const { jsPDF } = window.jspdf;
  const B = bleed ? 3 / UNIT_MM : 0;
  const wmm = (W + 2 * B) * UNIT_MM, hmm = (H + 2 * B) * UNIT_MM;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [wmm, hmm], compress: true });
  for (const [n] of Object.entries(FONT_FILES)) { doc.addFileToVFS(n + ".ttf", fonts[n]); doc.addFont(n + ".ttf", n, "normal"); }
  doc.setProperties({ title: name, creator: "Kayak Internal · Business Cards", author: "Kayak Strategic Advisors" });
  for (let i = 0; i < faces.length; i++) {
    if (i) doc.addPage([wmm, hmm], "landscape");
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0";
    host.innerHTML = faces[i];
    document.body.append(host);
    const el = host.querySelector("svg");
    el.querySelectorAll("text").forEach((t) => { t.setAttribute("font-family", pdfFamily(t)); t.setAttribute("font-weight", "normal"); t.removeAttribute("font-stretch"); });
    await doc.svg(el, { x: 0, y: 0, width: wmm, height: hmm });
    host.remove();
  }
  return doc.output("blob");
}

// ---- View ----
export async function render(main, ctx) {
  await loadMaster();
  const me = ctx.me;
  let d = { ...DEFAULTS, name: me.name || "", email: me.email || "", title: me.title || DEFAULTS.title, phones: [me.phone || "", ""] };
  let savedId = null;
  const providers = (await api("/api/ai/providers")).providers;
  const { items } = await api("/api/cards");

  main.innerHTML = String(html`<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Business Cards</span><h1>Kayak business cards</h1><p class="lead">Describe the card or fill in the details. The design is locked to the Kayak brand; only the details change. Export print-ready PDF with bleed, or SVG, PNG and JPG.</p></div></div>
    <div class="split">
      <div class="stack">
        <form class="card stack" id="ai">
          <div class="field"><label for="prompt">${ico("spark")} Describe the card</label>
          <textarea class="textarea" id="prompt" style="min-height:84px" placeholder="e.g. Group card for Priya Shah, Associate Director – Forensic Services, +91 98200 12345, priya@kayaksa.com"></textarea></div>
          <div class="row"><button class="btn btn-primary" id="aibtn" ${providers.length ? "" : "disabled"}>${ico("spark")} Fill in from my description</button>${providers.length ? "" : html`<span class="small muted">Connect an AI key to use this; the form below always works.</span>`}</div>
        </form>
        <form class="card form-grid" id="f">
          <div class="field" style="grid-column:1/-1"><label for="company">Company</label><select class="select" id="company" name="company">${Object.entries(COMPANY).map(([k, v]) => html`<option value="${k}">${v.label}</option>`)}</select></div>
          <div class="field"><label for="name">Name</label><input class="input" id="name" name="name" maxlength="40"></div>
          <div class="field"><label for="title">Designation</label><input class="input" id="title" name="title" maxlength="48"></div>
          <div class="field"><label for="department">Practice or department</label><input class="input" id="department" name="department" maxlength="40"></div>
          <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" maxlength="48"></div>
          <div class="field"><label for="p0">Mobile</label><input class="input" id="p0" name="p0" maxlength="20"></div>
          <div class="field"><label for="p1">Second number</label><input class="input" id="p1" name="p1" maxlength="20"></div>
          <div class="field"><label for="website">Website</label><input class="input" id="website" name="website" maxlength="40"></div>
          <div class="field"><label for="locations">Locations</label><input class="input" id="locations" name="locations" maxlength="40"></div>
          <div class="field" style="grid-column:1/-1"><label for="address">Address</label><input class="input" id="address" name="address" maxlength="140"></div>
        </form>
        <div class="card stack-sm"><h3>Saved cards</h3><div id="saved"></div></div>
      </div>
      <div class="stack sticky">
        <div class="cardstage"><span class="lbl">Front</span><div class="face" id="front"></div><span class="lbl">Back</span><div class="face" id="back"></div></div>
        <div class="card stack-sm"><h3>Export</h3>
          <div class="row">
            <button class="btn btn-primary" data-x="pdf-print">${ico("download")} Print PDF (3 mm bleed)</button>
            <button class="btn btn-ghost" data-x="pdf">${ico("download")} PDF</button>
            <button class="btn btn-ghost" data-x="svg">SVG</button>
            <button class="btn btn-ghost" data-x="png">PNG 600 dpi</button>
            <button class="btn btn-ghost" data-x="jpg">JPG 300 dpi</button>
          </div>
          <p class="small muted">For printing: 3.5 × 2 in (88.9 × 50.8 mm), 600–700 gsm board. Gold elements are designed for gold hot-foil; ask the printer to apply foil to the gold frame, rules and gold lettering.</p>
          <div class="row"><button class="btn btn-ghost btn-sm" id="save">${ico("check")} Save this card</button><button class="btn btn-quiet btn-sm" id="reset">Start again</button></div>
        </div>
      </div>
    </div></div>`);

  const form = $("#f");
  const fill = () => {
    form.company.value = d.company; form.name.value = d.name; form.title.value = d.title; form.department.value = d.department; form.email.value = d.email;
    form.p0.value = d.phones[0] || ""; form.p1.value = d.phones[1] || ""; form.website.value = d.website; form.locations.value = d.locations; form.address.value = d.address;
  };
  const read = () => { const v = Object.fromEntries(new FormData(form)); d = { ...d, ...v, phones: [v.p0, v.p1] }; delete d.p0; delete d.p1; };
  const draw = () => { $("#front").innerHTML = front(d, 0); $("#back").innerHTML = back(d, 0); };
  form.oninput = () => { read(); draw(); };
  fill(); draw();

  const drawSaved = (list) => {
    $("#saved").innerHTML = list.length ? list.map((c) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:6px 0"><button class="btn btn-quiet btn-sm" data-open="${esc(c.id)}">${esc(c.label)}</button><span class="small faint">${esc(fmtDate(c.updated_at))}</span><button class="btn btn-quiet btn-sm" data-rm="${esc(c.id)}" aria-label="Delete">${ico("trash")}</button></div>`).join("") : `<p class="small muted">Cards you save appear here.</p>`;
    $$("[data-open]", main).forEach((b) => (b.onclick = () => { const c = list.find((x) => x.id === b.dataset.open); d = { ...DEFAULTS, ...JSON.parse(c.data) }; savedId = c.id; fill(); draw(); }));
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

  const slug = () => (d.name || "card").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") + "_" + d.company;
  $$("[data-x]", main).forEach((b) => (b.onclick = async () => {
    read();
    const k = b.dataset.x;
    setBusy(b, true, "Preparing…");
    try {
      if (k === "svg") {
        download(new Blob([await withFonts(front(d, 0))], { type: "image/svg+xml" }), `${slug()}_front.svg`);
        download(new Blob([await withFonts(back(d, 0))], { type: "image/svg+xml" }), `${slug()}_back.svg`);
      } else if (k === "png" || k === "jpg") {
        const type = k === "png" ? "image/png" : "image/jpeg", dpi = k === "png" ? 600 : 300;
        download(await raster(front(d, 0), type, dpi), `${slug()}_front.${k}`);
        download(await raster(back(d, 0), type, dpi), `${slug()}_back.${k}`);
      } else {
        const bleed = k === "pdf-print";
        const B = bleed ? 3 / UNIT_MM : 0;
        download(await toPdf([front(d, B), back(d, B)], `Kayak card — ${d.name}`, bleed), `${slug()}${bleed ? "_print-bleed" : ""}.pdf`);
      }
    } catch (err) { toast(err.message || "Export failed.", "err"); }
    finally { setBusy(b, false); }
  }));
  $("#save").onclick = async () => {
    read();
    const r = await api("/api/cards", { body: { id: savedId, label: `${d.name || "Card"} · ${COMPANY[d.company].label}`, template: d.company, data: d } });
    savedId = r.id; toast("Card saved."); drawSaved((await api("/api/cards")).items);
  };
  $("#reset").onclick = () => { d = { ...DEFAULTS }; savedId = null; fill(); draw(); };
}

export const _test = { front, back, COMPANY };
