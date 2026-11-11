import { $, $$, api, esc, html, raw, ico, toast, setBusy, confirmDialog, fmtDate } from "/_shared/js/ui.js";
import { CLUSTERS, SECTORS, SECTOR_GROUPS } from "/app/views/data.js";

const AUDIENCES = ["Board of directors", "Audit committee", "Promoters and CXOs", "General counsel and compliance", "CFO and finance", "Procurement and operations", "Investors", "Regulator or government"];
const PURPOSES = ["Capability pitch", "Proposal for a defined scope", "Board briefing", "Workshop or training", "Findings and recommendations", "Thought leadership"];

// ---- Outline without AI: built from the service line and services chosen ----
function outline(i) {
  const c = CLUSTERS.find((x) => x.id === i.cluster) || CLUSTERS[0];
  const svcs = c.services.filter((s) => i.services.includes(s.name));
  const grp = SECTOR_GROUPS.find((g) => g.members.includes(i.sector));
  const slides = [
    { type: "bullets", kicker: "AGENDA", title: "What we will cover", bullets: ["Your context and the questions that matter", "How Kayak would help", ...svcs.slice(0, 2).map((s) => s.name), "Approach, team and next steps"] },
    { type: "bullets", kicker: "YOUR CONTEXT", title: `${i.sector}: the questions on the table`, bullets: grp ? grp.questions : ["[Add the client's three most pressing questions]"] , note: "Replace with what you heard from the client." },
    { type: "section", kicker: c.short.toUpperCase(), title: c.name },
    { type: "bullets", kicker: "HOW WE HELP", title: c.line, bullets: svcs.map((s) => s.name) },
    ...svcs.map((s) => ({ type: "two-column", kicker: c.short.toUpperCase(), title: s.name, left: { heading: "What it covers", bullets: [s.text] }, right: { heading: `For ${i.client || "[CLIENT]"}`, bullets: ["[Scope point tailored to the client]", "[Deliverable]", "[Timeline]"] } })),
    { type: "process", kicker: "APPROACH", title: "How the engagement runs", steps: [{ title: "Understand", text: "Scope, stakeholders, data and constraints." }, { title: "Assess", text: "Evidence-led work against agreed criteria." }, { title: "Advise", text: "Clear findings, options and recommendations." }, { title: "Support", text: "Implementation help and follow-through." }] },
    { type: "bullets", kicker: "WHY KAYAK", title: "Why Kayak Strategic Advisors", bullets: ["One lead partner from start to finish", "Senior, multidisciplinary team", "Evidence-led, plain-English advice", "Our own platforms: NexaPair, SayUsNow, SeeCounter and DocuVow"] },
    { type: "closing", title: "Next steps", bullets: ["Confirm scope and priorities", "Agree team, timeline and fees", "Kick-off meeting"] },
  ];
  return { title: i.title || `${c.short} for ${i.client || i.sector}`, subtitle: [i.client, i.sector, c.name].filter(Boolean).join(" · "), slides: slides.slice(0, Math.max(6, Number(i.slides) || 12)) };
}

// ---- HTML preview ----
function slideHtml(s, n, spec) {
  const k = s.kicker ? `<span class="k">${esc(s.kicker)}</span>` : "";
  let body = "";
  switch (s.type) {
    case "title": return `<div class="slide dark"><div class="slide-in" style="justify-content:flex-end"><span class="k">KAYAK STRATEGIC ADVISORS</span><h4 style="font-size:5.4cqw">${esc(spec.title)}</h4><p style="font-size:2.6cqw;color:#CDE8E3;margin:0">${esc(spec.subtitle || "")}</p></div><div class="bar"></div></div>`;
    case "section": return `<div class="slide dark"><div class="slide-in" style="justify-content:center">${k}<h4 style="font-size:5cqw">${esc(s.title)}</h4></div><div class="bar" style="width:18%"></div><span class="n">${n}</span></div>`;
    case "quote": return `<div class="slide"><div class="slide-in" style="justify-content:center"><p style="font:italic 3.6cqw/1.35 var(--serif);margin:0">“${esc(s.quote)}”</p><span class="k">${esc(s.by || "")}</span></div><span class="n">${n}</span></div>`;
    case "two-column": body = `<div class="cols">${[s.left, s.right].map((c) => `<div><b>${esc(c?.heading || "")}</b><ul>${(c?.bullets || []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div>`).join("")}</div>`; break;
    case "stats": body = `<div class="stats">${(s.stats || []).map((x) => `<div><b>${esc(x.value)}</b><span>${esc(x.label)}</span></div>`).join("")}</div>${s.source ? `<span style="font-size:1.8cqw;color:#7A8F98">Source: ${esc(s.source)}</span>` : ""}`; break;
    case "process": body = `<div class="stats">${(s.steps || []).map((x, i) => `<div><b style="font-size:3.4cqw">${i + 1}</b><span><b style="display:inline;font:700 2.3cqw var(--sans);color:#0E2F3C">${esc(x.title)}</b><br>${esc(x.text)}</span></div>`).join("")}</div>`; break;
    case "table": body = `<table style="font-size:2cqw;border-collapse:collapse;width:100%"><tr>${(s.columns || []).map((c) => `<th style="text-align:left;border-bottom:1px solid #D4DEE2;padding:.6cqw">${esc(c)}</th>`).join("")}</tr>${(s.rows || []).map((r) => `<tr>${r.map((c) => `<td style="border-bottom:1px solid #EEF4F1;padding:.6cqw">${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`; break;
    default: body = `<ul>${(s.bullets || []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
  }
  const dark = s.type === "closing";
  return `<div class="slide${dark ? " dark" : ""}"><div class="slide-in">${k}<h4>${esc(s.title || "")}</h4>${body}</div>${dark ? '<div class="bar"></div>' : ""}<span class="n">${n}</span></div>`;
}

// ---- PowerPoint export (PptxGenJS, 13.33 x 7.5 in) ----
async function logoPng(file, w = 1600) {
  const svg = await (await fetch(file)).text();
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
  const c = document.createElement("canvas"); c.width = w; c.height = Math.round((w * img.height) / img.width);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return { data: c.toDataURL("image/png"), ratio: c.height / c.width };
}

async function exportPptx(spec) {
  if (!window.PptxGenJS) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/vendor/pptxgen.bundle.js"; s.onload = res; s.onerror = () => rej(new Error("Could not load the PowerPoint library.")); document.head.append(s); });
  const [rev, col] = await Promise.all([logoPng("/_shared/logos/KSA_Logo_Full_Reversed.svg"), logoPng("/_shared/logos/KSA_Logo_Full_FullColour.svg")]);
  const p = new window.PptxGenJS();
  p.layout = "LAYOUT_WIDE";
  p.author = "Kayak Strategic Advisors"; p.company = "Kayak Strategic Advisors Private Limited"; p.title = spec.title;
  const F = "Archivo", S = "Source Serif 4", INK = "0E2F3C", WATER = "17807E", SAFF = "EE9B1E", SLATE = "3E5563";
  p.defineSlideMaster({ title: "KSA_CONTENT", background: { color: "FFFFFF" }, objects: [
    { image: { x: 11.35, y: 6.88, w: 1.5, h: 1.5 * col.ratio, data: col.data } },
    { line: { x: 0.6, y: 6.8, w: 12.13, h: 0, line: { color: "D4DEE2", width: 0.75 } } },
    { text: { text: "Kayak Strategic Advisors · Confidential", options: { x: 0.6, y: 6.88, w: 6, h: 0.3, fontFace: F, fontSize: 9, color: "7A8F98" } } },
  ], slideNumber: { x: 10.6, y: 6.88, w: 0.6, h: 0.3, fontFace: F, fontSize: 9, color: "7A8F98", align: "right" } });
  p.defineSlideMaster({ title: "KSA_DARK", background: { color: INK }, objects: [{ rect: { x: 0, y: 7.38, w: 13.33, h: 0.12, fill: { color: SAFF } } }, { image: { x: 0.6, y: 0.5, w: 2.4, h: 2.4 * rev.ratio, data: rev.data } }] });
  const kick = (sl, t, y = 0.55, dark = false) => t && sl.addText(t.toUpperCase(), { x: 0.6, y, w: 11, h: 0.3, fontFace: F, fontSize: 11, bold: true, color: dark ? "F5C46D" : WATER, charSpacing: 3 });
  const title = (sl, t, dark = false, y = 0.9) => sl.addText(t || "", { x: 0.6, y, w: 12, h: 1.0, fontFace: F, fontSize: 30, bold: true, color: dark ? "FFFFFF" : INK, valign: "top", fit: "shrink" });
  const bullets = (sl, items, x = 0.6, y = 2.1, w = 12, fs = 18) => sl.addText((items || []).map((b) => ({ text: b, options: { bullet: { code: "25A0" }, paraSpaceAfter: 8 } })), { x, y, w, h: 4.4, fontFace: F, fontSize: fs, color: INK, valign: "top", fit: "shrink" });

  const t0 = p.addSlide({ masterName: "KSA_DARK" });
  t0.addText(spec.title, { x: 0.6, y: 3.4, w: 11.5, h: 1.6, fontFace: F, fontSize: 40, bold: true, color: "FFFFFF", valign: "bottom", fit: "shrink" });
  t0.addText(spec.subtitle || "", { x: 0.6, y: 5.1, w: 11.5, h: 0.6, fontFace: S, fontSize: 18, color: "CDE8E3" });
  t0.addText(new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }), { x: 0.6, y: 6.6, w: 6, h: 0.4, fontFace: F, fontSize: 12, color: "A9C0C6" });

  for (const s of spec.slides) {
    const dark = s.type === "section" || s.type === "closing";
    const sl = p.addSlide({ masterName: dark ? "KSA_DARK" : "KSA_CONTENT" });
    if (s.note) sl.addNotes(s.note);
    if (s.type === "section") { kick(sl, s.kicker, 3.2, true); title(sl, s.title, true, 3.6); continue; }
    if (s.type === "quote") { sl.addText(`“${s.quote}”`, { x: 1.2, y: 1.8, w: 10.9, h: 3, fontFace: S, fontSize: 28, italic: true, color: INK, valign: "middle", fit: "shrink" }); sl.addText(s.by || "", { x: 1.2, y: 5, w: 10, h: 0.5, fontFace: F, fontSize: 13, bold: true, color: WATER }); continue; }
    kick(sl, s.kicker || (s.type === "closing" ? "NEXT STEPS" : ""), dark ? 3.0 : 0.55, dark);
    title(sl, s.title, dark, dark ? 3.4 : 0.9);
    if (s.type === "closing") { bullets(sl, s.bullets, 0.6, 4.5, 12, 18); sl.addText("anuj@kayaksa.com · www.kayaksa.com", { x: 0.6, y: 6.7, w: 8, h: 0.4, fontFace: F, fontSize: 12, color: "F5C46D" }); continue; }
    if (s.type === "two-column") {
      [s.left, s.right].forEach((c, i) => {
        const x = 0.6 + i * 6.2;
        sl.addShape(p.ShapeType.rect, { x, y: 2.05, w: 0.06, h: 4.3, fill: { color: i ? SAFF : WATER } });
        sl.addText(c?.heading || "", { x: x + 0.25, y: 2.0, w: 5.6, h: 0.5, fontFace: F, fontSize: 18, bold: true, color: INK });
        bullets(sl, c?.bullets, x + 0.25, 2.6, 5.6, 15);
      });
    } else if (s.type === "stats") {
      const n = Math.max(1, (s.stats || []).length);
      (s.stats || []).forEach((x, i) => {
        const w = 12 / n;
        sl.addText(x.value, { x: 0.6 + i * w, y: 2.4, w: w - 0.3, h: 1.4, fontFace: F, fontSize: 44, bold: true, color: WATER });
        sl.addText(x.label, { x: 0.6 + i * w, y: 3.8, w: w - 0.3, h: 1.2, fontFace: F, fontSize: 14, color: SLATE, valign: "top" });
      });
      if (s.source) sl.addText(`Source: ${s.source}`, { x: 0.6, y: 6.3, w: 11, h: 0.3, fontFace: F, fontSize: 9, color: "7A8F98" });
    } else if (s.type === "process") {
      const n = Math.max(1, (s.steps || []).length), w = 12 / n;
      (s.steps || []).forEach((x, i) => {
        sl.addShape(p.ShapeType.rect, { x: 0.6 + i * w, y: 2.3, w: w - 0.25, h: 0.08, fill: { color: i === 0 ? SAFF : WATER } });
        sl.addText(String(i + 1).padStart(2, "0"), { x: 0.6 + i * w, y: 2.5, w: 1, h: 0.6, fontFace: F, fontSize: 22, bold: true, color: WATER });
        sl.addText(x.title, { x: 0.6 + i * w, y: 3.1, w: w - 0.3, h: 0.6, fontFace: F, fontSize: 16, bold: true, color: INK });
        sl.addText(x.text, { x: 0.6 + i * w, y: 3.7, w: w - 0.3, h: 2.2, fontFace: F, fontSize: 13, color: SLATE, valign: "top", fit: "shrink" });
      });
    } else if (s.type === "table") {
      const rows = [(s.columns || []).map((c) => ({ text: c, options: { bold: true, color: "FFFFFF", fill: { color: INK } } })), ...(s.rows || []).map((r) => r.map((c) => ({ text: String(c) })))];
      sl.addTable(rows, { x: 0.6, y: 2.1, w: 12.1, fontFace: F, fontSize: 12, color: INK, border: { type: "solid", color: "D4DEE2", pt: 0.75 }, autoPage: false });
    } else bullets(sl, s.bullets);
  }
  await p.writeFile({ fileName: `${spec.title.replace(/[^\w]+/g, "_").slice(0, 60)}.pptx` });
}

// ---- View ----
export async function render(main, ctx) {
  const providers = (await api("/api/ai/providers")).providers;
  let spec = null, deckId = null;
  const { items } = await api("/api/decks");

  main.innerHTML = String(html`<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Presentations</span><h1>Kayak presentations</h1><p class="lead">Choose the sector, service line and services; Kayak AI plans the deck in the Kayak master, and you download it as PowerPoint to finish.</p></div></div>
    <div class="split">
      <form class="card stack" id="f">
        <div class="field"><label for="title">Working title</label><input class="input" id="title" name="title" placeholder="e.g. Third-party risk for a listed NBFC"></div>
        <div class="form-grid">
          <div class="field"><label for="client">Client or prospect</label><input class="input" id="client" name="client" placeholder="[CLIENT NAME]"></div>
          <div class="field"><label for="sector">Sector</label><select class="select" id="sector" name="sector">${SECTOR_GROUPS.map((g) => html`<optgroup label="${g.name}">${g.members.map((m) => html`<option>${m}</option>`)}</optgroup>`)}</select></div>
          <div class="field"><label for="cluster">Service line</label><select class="select" id="cluster" name="cluster">${CLUSTERS.map((c) => html`<option value="${c.id}">${c.name}</option>`)}</select></div>
          <div class="field"><label for="audience">Audience</label><select class="select" id="audience" name="audience">${AUDIENCES.map((a) => html`<option>${a}</option>`)}</select></div>
          <div class="field"><label for="purpose">Purpose</label><select class="select" id="purpose" name="purpose">${PURPOSES.map((a) => html`<option>${a}</option>`)}</select></div>
          <div class="field"><label for="slides">Slides</label><input class="input" id="slides" name="slides" type="number" min="6" max="24" value="12"></div>
        </div>
        <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="label">Services to feature</legend><div class="stack-sm" id="svcs"></div></fieldset>
        <div class="field"><label for="notes">Anything else Kayak AI should know</label><textarea class="textarea" id="notes" name="notes" placeholder="Context from the meeting, tone, must-include points…"></textarea></div>
        <div class="row"><button class="btn btn-primary" id="gen" ${providers.length ? "" : "disabled"}>${ico("spark")} Plan with Kayak AI</button><button class="btn btn-ghost" type="button" id="tpl">Start from the service outline</button></div>
        ${providers.length ? "" : html`<p class="small muted">No AI key is connected yet, so use the service outline; it is built from the services you pick.</p>`}
      </form>
      <div class="stack">
        <div class="card stack-sm" id="out"><div class="empty">Your slides will appear here.</div></div>
        <div class="card stack-sm"><h3>Saved presentations</h3><div id="saved"></div></div>
      </div>
    </div></div>`);

  const f = $("#f");
  const drawSvcs = () => {
    const c = CLUSTERS.find((x) => x.id === f.cluster.value);
    $("#svcs").innerHTML = c.services.map((s, i) => `<label class="check"><input type="checkbox" name="svc" value="${esc(s.name)}"${i < 3 ? " checked" : ""}><span><b>${esc(s.name)}</b><br><span class="small muted">${esc(s.text)}</span></span></label>`).join("");
  };
  f.cluster.onchange = drawSvcs; drawSvcs();
  const inputs = () => ({ title: f.title.value, client: f.client.value, sector: f.sector.value, cluster: f.cluster.value, audience: f.audience.value, purpose: f.purpose.value, slides: f.slides.value, notes: f.notes.value, services: $$("[name=svc]:checked", f).map((x) => x.value) });

  const show = () => {
    const all = [{ type: "title" }, ...spec.slides];
    $("#out").innerHTML = `<div class="row between"><h3>${esc(spec.title)}</h3><div class="row"><button class="btn btn-primary btn-sm" id="pptx">${ico("download")} PowerPoint</button><button class="btn btn-ghost btn-sm" id="save">${ico("check")} Save</button></div></div>
      <p class="small muted">${all.length} slides. Edit the text in PowerPoint; the Kayak master, fonts and colours are already applied (install Archivo and Source Serif 4 from the Brand Portal for exact type).</p>
      <div class="slide-thumbs">${all.map((s, i) => slideHtml(s, i + 1, spec)).join("")}</div>`;
    $("#pptx").onclick = async (e) => { setBusy(e.currentTarget, true, "Building…"); try { await exportPptx(spec); } catch (err) { toast(err.message, "err"); } finally { setBusy(e.currentTarget, false); } };
    $("#save").onclick = async () => { const r = await api("/api/decks", { body: { id: deckId, title: spec.title, inputs: inputs(), spec } }); deckId = r.id; toast("Saved."); drawSaved((await api("/api/decks")).items); };
  };

  f.onsubmit = async (e) => {
    e.preventDefault();
    const i = inputs();
    if (!i.services.length) return toast("Pick at least one service.", "err");
    const b = $("#gen");
    setBusy(b, true, "Planning the deck…");
    $("#out").innerHTML = `<div class="row muted"><span class="spinner"></span> Kayak AI is planning ${esc(i.slides)} slides for ${esc(i.sector)}. This takes 20–60 seconds.</div>`;
    try { const r = await api("/api/ai/deck-plan", { body: { inputs: i } }); spec = r.spec; spec.title ||= i.title || "Presentation"; deckId = null; show(); }
    catch (err) { $("#out").innerHTML = `<div class="note danger">${esc(err.message)}</div>`; }
    finally { setBusy(b, false); }
  };
  $("#tpl").onclick = () => { const i = inputs(); if (!i.services.length) return toast("Pick at least one service.", "err"); spec = outline(i); deckId = null; show(); };

  const drawSaved = (list) => {
    $("#saved").innerHTML = list.length ? list.map((d) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:6px 0"><button class="btn btn-quiet btn-sm" data-open="${esc(d.id)}">${esc(d.title)}</button><span class="small faint">${esc(fmtDate(d.updated_at))}</span><button class="btn btn-quiet btn-sm" data-rm="${esc(d.id)}" aria-label="Delete">${ico("trash")}</button></div>`).join("") : `<p class="small muted">Presentations you save appear here.</p>`;
    $$("[data-open]", main).forEach((b) => (b.onclick = async () => { const { item } = await api(`/api/decks/${b.dataset.open}`); spec = JSON.parse(item.spec); deckId = item.id; show(); }));
    $$("[data-rm]", main).forEach((b) => (b.onclick = async () => { if (!(await confirmDialog("Delete this presentation?", "The saved plan will be removed.", "Delete", true))) return; await api(`/api/decks/${b.dataset.rm}`, { method: "DELETE" }); drawSaved((await api("/api/decks")).items); }));
  };
  drawSaved(items);
}
