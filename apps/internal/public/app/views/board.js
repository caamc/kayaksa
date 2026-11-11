import { api, esc, ico, toast, dialog, confirmDialog, fmtDateTime } from "/_shared/js/ui.js";

// Kayak Whiteboard: a digital canvas for ideas. Pen and highlighter, shapes, connectors, sticky notes,
// text, the KSA icon library, images, multi-select, undo and redo, zoom and pan, brand colours,
// templates, autosave, sharing, and PNG or SVG export.
const PAL = ["#0E2F3C", "#17807E", "#EE9B1E", "#2D6A9F", "#5E4B78", "#4B7A4E", "#9C630E", "#B4472F", "#8B9A9C", "#FFFFFF"];
const STICKY = ["#FBEBCD", "#E3F1EF", "#E6EEF7", "#EFEAF5", "#EDF4EC", "#FBEDE9"];
const ICONS = "analytics brand-protection briefcase calendar chat compliance contract cybersecurity data due-diligence esg finance globe governance growth human-resources intellectual-property investigations location mail mobile navigation network partnership presentation regulatory report risk search strategy target tax technology timeline transactions user website".split(" ");
const TOOLS = [["select", "V", "Select and move"], ["pan", "H", "Pan"], ["pen", "P", "Pen"], ["hl", "M", "Highlighter"], ["rect", "R", "Rectangle"], ["ellipse", "O", "Ellipse"], ["diamond", "D", "Diamond"], ["line", "L", "Line"], ["arrow", "A", "Arrow"], ["sticky", "N", "Sticky note"], ["text", "T", "Text"], ["icon", "I", "KSA icon"], ["image", "U", "Image"], ["eraser", "E", "Eraser"]];
const TICO = { select: "M5 3l14 8-6 2-2 6z", pan: "M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3", pen: "M4 20l4-1 11-11-3-3L5 16z", hl: "M6 16l8-8 4 4-8 8H6z M4 21h16", rect: "M4 6h16v12H4z", ellipse: "M12 5c5 0 9 3 9 7s-4 7-9 7-9-3-9-7 4-7 9-7z", diamond: "M12 3l9 9-9 9-9-9z", line: "M4 20L20 4", arrow: "M4 20L20 4M20 4h-7M20 4v7", sticky: "M4 4h16v11l-5 5H4z M15 20v-5h5", text: "M5 5h14M12 5v14", icon: "M12 3l2.5 6h6.5l-5 4 2 7-6-4-6 4 2-7-5-4h6.5z", image: "M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4", eraser: "M7 20h10M4 14l8-8 6 6-6 6H8z" };

const TEMPLATES = {
  blank: { name: "Blank board", items: [] },
  swot: { name: "SWOT analysis", items: [["Strengths", 0, 0, "#E3F1EF"], ["Weaknesses", 1, 0, "#FBEDE9"], ["Opportunities", 0, 1, "#E6EEF7"], ["Threats", 1, 1, "#FBEBCD"]].flatMap(([t, c, r, f]) => [{ t: "rect", x: 80 + c * 520, y: 80 + r * 380, w: 500, h: 360, stroke: "#0E2F3C", fill: f, sw: 2 }, { t: "text", x: 104 + c * 520, y: 100 + r * 380, w: 440, h: 40, text: t, fs: 28, stroke: "#0E2F3C", bold: 1 }]) },
  matrix: { name: "2×2 priority matrix", items: [{ t: "arrow", pts: [[120, 860], [120, 80]], stroke: "#0E2F3C", sw: 3 }, { t: "arrow", pts: [[120, 860], [1120, 860]], stroke: "#0E2F3C", sw: 3 }, { t: "line", pts: [[620, 100], [620, 840]], stroke: "#8B9A9C", sw: 2 }, { t: "line", pts: [[140, 470], [1100, 470]], stroke: "#8B9A9C", sw: 2 }, { t: "text", x: 140, y: 40, w: 400, h: 36, text: "Impact", fs: 24, stroke: "#17807E", bold: 1 }, { t: "text", x: 980, y: 880, w: 300, h: 36, text: "Effort", fs: 24, stroke: "#17807E", bold: 1 }, { t: "text", x: 160, y: 110, w: 400, h: 36, text: "Quick wins", fs: 22, stroke: "#EE9B1E", bold: 1 }, { t: "text", x: 660, y: 110, w: 400, h: 36, text: "Big bets", fs: 22, stroke: "#0E2F3C", bold: 1 }, { t: "text", x: 160, y: 490, w: 400, h: 36, text: "Fill-ins", fs: 22, stroke: "#8B9A9C", bold: 1 }, { t: "text", x: 660, y: 490, w: 400, h: 36, text: "Money pits", fs: 22, stroke: "#B4472F", bold: 1 }] },
  journey: { name: "Client journey", items: ["Aware", "Consider", "Engage", "Deliver", "Renew"].flatMap((t, i) => [{ t: "rect", x: 80 + i * 260, y: 120, w: 220, h: 90, stroke: "#17807E", fill: "#E3F1EF", sw: 2, text: t, fs: 22 }, ...(i < 4 ? [{ t: "arrow", pts: [[305 + i * 260, 165], [335 + i * 260, 165]], stroke: "#0E2F3C", sw: 2 }] : []), { t: "sticky", x: 90 + i * 260, y: 250, w: 200, h: 150, fill: STICKY[i % 6], text: "What the client does, thinks and feels", fs: 16 }]) },
  retro: { name: "Retrospective", items: [["What went well", "#E3F1EF"], ["What to improve", "#FBEBCD"], ["Actions", "#E6EEF7"]].flatMap(([t, f], i) => [{ t: "rect", x: 80 + i * 420, y: 80, w: 400, h: 720, stroke: "#0E2F3C", fill: f, sw: 2 }, { t: "text", x: 104 + i * 420, y: 100, w: 360, h: 40, text: t, fs: 26, stroke: "#0E2F3C", bold: 1 }]) },
  mindmap: { name: "Mind map", items: [{ t: "ellipse", x: 520, y: 360, w: 260, h: 120, stroke: "#0E2F3C", fill: "#0E2F3C", sw: 2, text: "Central idea", fs: 24, color: "#FFFFFF" }, ...[[160, 140], [940, 140], [160, 640], [940, 640]].flatMap(([x, y], i) => [{ t: "line", pts: [[650, 420], [x + 100, y + 40]], stroke: PAL[i + 1], sw: 3 }, { t: "rect", x, y, w: 200, h: 80, stroke: PAL[i + 1], fill: "#FFFFFF", sw: 3, text: `Theme ${i + 1}`, fs: 20 }])] },
};

let S = null; // editor state
const uidl = () => Math.random().toString(36).slice(2, 10);

export async function render(main, { rest }) {
  if (S?.cleanup) S.cleanup();
  if (rest[0]) return editor(main, rest[0]);
  const { boards } = await api("/api/workspace/boards");
  main.innerHTML = `<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Studio</span><h1>Whiteboard</h1><p class="lead">Sketch, map and plan on an open canvas, in Kayak's colours, with the KSA icon library to hand. Boards save themselves; share one to work on it together.</p></div></div>
    <section class="stack-sm"><h2 style="font-size:1.05rem">Start from</h2><div class="tiles">${Object.entries(TEMPLATES).map(([k, t]) => `<button class="tile" style="min-height:0;text-align:left;font:inherit" data-new="${k}"><span class="tile-ico">${ico(k === "blank" ? "plus" : "grid")}</span><h3>${esc(t.name)}</h3></button>`).join("")}</div></section>
    <section class="stack-sm"><h2 style="font-size:1.05rem">Your boards and shared boards</h2>
      ${boards.length ? `<div class="tiles">${boards.map((b) => `<a class="tile" style="padding:0;overflow:hidden" href="#/board/${esc(b.id)}"><div style="height:140px;background:var(--surface-2) center/cover no-repeat${b.thumb ? `;background-image:url('${b.thumb}')` : ""}"></div><div style="padding:12px 14px"><h3 style="font-size:1rem">${esc(b.title)}</h3><p class="small">${b.shared ? "Shared · " : ""}${esc(b.owner_name || "")} · ${fmtDateTime(b.updated_at)}</p></div></a>`).join("")}</div>` : `<p class="muted">No boards yet. Pick a template above.</p>`}</section></div>`;
  main.querySelectorAll("[data-new]").forEach((b) => b.addEventListener("click", async () => {
    const t = TEMPLATES[b.dataset.new];
    const r = await api("/api/workspace/boards", { body: { title: t.name === "Blank board" ? "Untitled board" : t.name, data: { items: JSON.parse(JSON.stringify(t.items)).map((x) => ({ id: uidl(), ...x })) } } });
    location.hash = `#/board/${r.id}`;
  }));
}

async function editor(main, id) {
  const b = await api(`/api/workspace/boards/${id}`);
  S = { id, title: b.title, shared: !!b.shared, mine: b.mine, items: b.data.items || [], undo: [], redo: [], sel: new Set(), tool: "select", stroke: "#0E2F3C", fill: "none", sw: 3, fs: 20, view: { x: 0, y: 0, k: 1 }, grid: true, dirty: false };
  main.innerHTML = `<div class="wb">
    <header class="wb-top"><a class="btn btn-quiet btn-sm" href="#/board">${ico("chevron")} Boards</a><input class="input wb-title" id="title" value="${esc(S.title)}" aria-label="Board name">
      <span class="small muted" id="savest">Saved</span><span class="wb-sp"></span>
      <button class="btn btn-quiet btn-sm" id="undo" title="Undo (Ctrl+Z)">↶</button><button class="btn btn-quiet btn-sm" id="redo" title="Redo (Ctrl+Y)">↷</button>
      <button class="btn btn-quiet btn-sm" id="zoomout" title="Zoom out">−</button><span class="small" id="zoom">100%</span><button class="btn btn-quiet btn-sm" id="zoomin" title="Zoom in">+</button><button class="btn btn-quiet btn-sm" id="fit" title="Fit to content">Fit</button>
      <label class="small row" style="gap:6px"><input type="checkbox" id="grid" checked> Grid</label>
      ${S.mine ? `<label class="small row" style="gap:6px"><input type="checkbox" id="share" ${S.shared ? "checked" : ""}> Share with colleagues</label>` : ""}
      <button class="btn btn-ghost btn-sm" id="png">${ico("download")} PNG</button><button class="btn btn-ghost btn-sm" id="svgx">${ico("download")} SVG</button>${S.mine ? `<button class="btn btn-quiet btn-sm" id="del" title="Delete board">${ico("trash")}</button>` : ""}</header>
    <div class="wb-body">
      <nav class="wb-tools" aria-label="Tools">${TOOLS.map(([t, k, n]) => `<button data-tool="${t}" title="${n} (${k})" aria-label="${n}" aria-pressed="${t === "select"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="${TICO[t]}"/></svg></button>`).join("")}</nav>
      <div class="wb-stage" id="stage"><svg id="svg" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="gridp" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1.2" fill="#B9C9CF"/></pattern><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs><rect id="gridr" x="-50000" y="-50000" width="100000" height="100000" fill="url(#gridp)"/><g id="scene"></g><g id="overlay"></g></svg></div>
      <aside class="wb-props"><span class="label">Colour</span><div class="wb-pal" id="stroke">${PAL.map((c) => `<button style="background:${c}" data-c="${c}" aria-label="Colour ${c}"></button>`).join("")}</div>
        <span class="label">Fill</span><div class="wb-pal" id="fill"><button data-c="none" class="none" aria-label="No fill">∅</button>${[...STICKY, ...PAL.slice(0, 4)].map((c) => `<button style="background:${c}" data-c="${c}" aria-label="Fill ${c}"></button>`).join("")}</div>
        <span class="label">Line</span><input type="range" id="sw" min="1" max="16" value="3">
        <span class="label">Text size</span><input type="range" id="fs" min="12" max="72" value="20">
        <div class="stack-sm" id="selops" hidden><span class="label">Selection</span><div class="row wrap-row"><button class="btn btn-ghost btn-sm" id="dup">Duplicate</button><button class="btn btn-ghost btn-sm" id="front">Front</button><button class="btn btn-ghost btn-sm" id="back">Back</button><button class="btn btn-ghost btn-sm" id="rm">${ico("trash")}</button></div></div>
        <p class="small muted">Double-click a shape or note to write in it. Hold Space to pan, Ctrl and scroll to zoom.</p></aside>
    </div><input type="file" id="imgf" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></div>`;
  const svg = main.querySelector("#svg"), scene = main.querySelector("#scene"), overlay = main.querySelector("#overlay"), stage = main.querySelector("#stage");
  const $ = (s) => main.querySelector(s);

  // ---------- rendering
  const wrap = (text, w, fs) => { const out = []; const max = Math.max(4, Math.floor(w / (fs * 0.52))); for (const para of String(text || "").split("\n")) { let line = ""; for (const word of para.split(" ")) { if ((line + " " + word).trim().length > max) { if (line) out.push(line); line = word; } else line = (line + " " + word).trim(); } out.push(line); } return out; };
  const textEl = (it, cx, cy, w, anchor = "middle") => { const fs = it.fs || 18; const lines = wrap(it.text, w, fs); const y0 = cy - ((lines.length - 1) * fs * 1.25) / 2; return `<text x="${cx}" y="${y0}" font-family="Archivo, Arial, sans-serif" font-size="${fs}" ${it.bold ? 'font-weight="700"' : ""} fill="${it.color || (it.t === "text" ? it.stroke : "#0E2F3C")}" text-anchor="${anchor}" dominant-baseline="middle">${lines.map((l, i) => `<tspan x="${cx}" dy="${i ? fs * 1.25 : 0}">${esc(l)}</tspan>`).join("")}</text>`; };
  const pathD = (pts) => pts.length < 2 ? `M${pts[0][0]} ${pts[0][1]}l0.1 0` : pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
  const el = (it) => {
    const common = `data-id="${it.id}" stroke="${it.stroke || "#0E2F3C"}" stroke-width="${it.sw || 2}"`;
    if (it.t === "path") return `<path ${common} d="${pathD(it.pts)}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${it.hl ? 'stroke-opacity=".35"' : ""}/>`;
    if (it.t === "line" || it.t === "arrow") return `<path ${common} d="${pathD(it.pts)}" fill="none" stroke-linecap="round" ${it.t === "arrow" ? 'marker-end="url(#ah)"' : ""}/><path data-id="${it.id}" d="${pathD(it.pts)}" stroke="transparent" stroke-width="14" fill="none"/>`;
    const fill = it.t === "sticky" ? it.fill || STICKY[0] : it.fill || "none";
    let shape = "";
    if (it.t === "rect") shape = `<rect ${common} x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" rx="4" fill="${fill}"/>`;
    if (it.t === "ellipse") shape = `<ellipse ${common} cx="${it.x + it.w / 2}" cy="${it.y + it.h / 2}" rx="${it.w / 2}" ry="${it.h / 2}" fill="${fill}"/>`;
    if (it.t === "diamond") shape = `<path ${common} d="M${it.x + it.w / 2} ${it.y}L${it.x + it.w} ${it.y + it.h / 2}L${it.x + it.w / 2} ${it.y + it.h}L${it.x} ${it.y + it.h / 2}Z" fill="${fill}"/>`;
    if (it.t === "sticky") shape = `<g data-id="${it.id}"><rect x="${it.x + 3}" y="${it.y + 5}" width="${it.w}" height="${it.h}" fill="rgba(14,47,60,.12)"/><rect data-id="${it.id}" x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" fill="${fill}" stroke="rgba(14,47,60,.15)"/></g>`;
    if (it.t === "image" || it.t === "icon") return `<image data-id="${it.id}" href="${esc(it.src)}" x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" preserveAspectRatio="xMidYMid meet"/>`;
    if (it.t === "text") return `<g data-id="${it.id}"><rect data-id="${it.id}" x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" fill="transparent"/>${textEl(it, it.x, it.y + it.h / 2, it.w, "start")}</g>`;
    return `<g data-id="${it.id}">${shape}${it.text ? `<g pointer-events="none">${textEl(it, it.x + it.w / 2, it.y + it.h / 2, it.w - 16)}</g>` : ""}</g>`;
  };
  const bbox = (it) => { if (it.pts) { const xs = it.pts.map((p) => p[0]), ys = it.pts.map((p) => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; } return { x: it.x, y: it.y, w: it.w, h: it.h }; };
  const draw = () => {
    scene.innerHTML = S.items.map(el).join("");
    overlay.innerHTML = [...S.sel].map((id) => { const it = S.items.find((x) => x.id === id); if (!it) return ""; const b = bbox(it); return `<rect x="${b.x - 6}" y="${b.y - 6}" width="${b.w + 12}" height="${b.h + 12}" fill="none" stroke="#EE9B1E" stroke-width="${1.5 / S.view.k}" stroke-dasharray="${6 / S.view.k} ${4 / S.view.k}"/>${S.sel.size === 1 && !it.pts ? `<rect data-handle="${id}" x="${b.x + b.w - 2}" y="${b.y + b.h - 2}" width="${12 / S.view.k}" height="${12 / S.view.k}" fill="#EE9B1E"/>` : ""}`; }).join("") + (S.marq ? `<rect x="${Math.min(S.marq[0], S.marq[2])}" y="${Math.min(S.marq[1], S.marq[3])}" width="${Math.abs(S.marq[2] - S.marq[0])}" height="${Math.abs(S.marq[3] - S.marq[1])}" fill="rgba(23,128,126,.08)" stroke="#17807E" stroke-width="${1 / S.view.k}"/>` : "");
    $("#selops").hidden = !S.sel.size;
    $("#gridr").style.display = S.grid ? "" : "none";
  };
  const applyView = () => { const r = stage.getBoundingClientRect(); svg.setAttribute("viewBox", `${S.view.x} ${S.view.y} ${r.width / S.view.k} ${r.height / S.view.k}`); $("#zoom").textContent = `${Math.round(S.view.k * 100)}%`; };
  const toWorld = (e) => { const r = stage.getBoundingClientRect(); return [S.view.x + (e.clientX - r.left) / S.view.k, S.view.y + (e.clientY - r.top) / S.view.k]; };
  const snapshot = () => { S.undo.push(JSON.stringify(S.items)); if (S.undo.length > 100) S.undo.shift(); S.redo = []; };
  const changed = () => { S.dirty = true; $("#savest").textContent = "Unsaved changes"; draw(); };

  // ---------- saving
  const thumb = async () => { try { const png = await exportPng(0.25); return png; } catch { return null; } };
  const save = async (withThumb = false) => {
    if (!S.dirty && !withThumb) return;
    S.dirty = false; $("#savest").textContent = "Saving…";
    try { await api("/api/workspace/boards", { body: { id: S.id, title: $("#title").value, shared: $("#share")?.checked ?? S.shared, data: { items: S.items }, thumb: withThumb ? await thumb() : undefined } }); $("#savest").textContent = "Saved"; }
    catch (e) { S.dirty = true; $("#savest").textContent = "Not saved"; toast(e.message, "err"); }
  };
  const iv = setInterval(() => save(false), 4000);
  const tv = setInterval(() => save(true), 60_000);

  // ---------- export
  const sceneSvg = (pad = 40) => {
    const bs = S.items.map(bbox); if (!bs.length) return null;
    const x0 = Math.min(...bs.map((b) => b.x)) - pad, y0 = Math.min(...bs.map((b) => b.y)) - pad, x1 = Math.max(...bs.map((b) => b.x + b.w)) + pad, y1 = Math.max(...bs.map((b) => b.y + b.h)) + pad;
    return { w: x1 - x0, h: y1 - y0, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" width="${x1 - x0}" height="${y1 - y0}">${svg.querySelector("defs").outerHTML.replace(/<pattern[\s\S]*?<\/pattern>/, "")}<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#FFFFFF"/>${scene.innerHTML}</svg>` };
  };
  const inlineImages = async (s) => {
    const urls = [...new Set([...s.matchAll(/href="(\/app\/icons\/[^"]+)"/g)].map((m) => m[1]))];
    for (const u of urls) { const t = await (await fetch(u)).text(); s = s.split(`href="${u}"`).join(`href="data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(t)))}"`); }
    return s;
  };
  const exportPng = async (scale = 2) => {
    const sc = sceneSvg(); if (!sc) throw new Error("The board is empty.");
    const src = await inlineImages(sc.svg);
    const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src);
    await img.decode();
    const cv = document.createElement("canvas"); cv.width = Math.min(8000, sc.w * scale); cv.height = Math.min(8000, sc.h * scale);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/png");
  };
  const dl = (href, name) => { const a = document.createElement("a"); a.href = href; a.download = name; a.click(); };
  $("#png").onclick = async () => { try { dl(await exportPng(2), `${$("#title").value || "board"}.png`); } catch (e) { toast(e.message, "err"); } };
  $("#svgx").onclick = async () => { const sc = sceneSvg(); if (!sc) return toast("The board is empty.", "err"); dl(URL.createObjectURL(new Blob([await inlineImages(sc.svg)], { type: "image/svg+xml" })), `${$("#title").value || "board"}.svg`); };

  // ---------- interaction
  let drag = null, spaceDown = false;
  const setTool = (t) => { S.tool = t; main.querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === t))); stage.dataset.tool = t; if (t === "icon") pickIcon(); if (t === "image") $("#imgf").click(); };
  main.querySelectorAll("[data-tool]").forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
  const hit = (e) => e.target.closest("[data-id]")?.dataset.id;
  const add = (it) => { snapshot(); it.id = uidl(); S.items.push(it); S.sel = new Set([it.id]); changed(); return it; };

  stage.addEventListener("pointerdown", (e) => {
    if (e.button === 1 || spaceDown || S.tool === "pan") { drag = { pan: true, sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y }; stage.setPointerCapture(e.pointerId); return; }
    const [x, y] = toWorld(e);
    const id = hit(e), handle = e.target.dataset?.handle;
    stage.setPointerCapture(e.pointerId);
    if (S.tool === "eraser") { snapshot(); drag = { erase: true }; if (id) { S.items = S.items.filter((i) => i.id !== id); changed(); } return; }
    if (S.tool === "select") {
      if (handle) { snapshot(); drag = { resize: handle, x, y, orig: JSON.parse(JSON.stringify(S.items.find((i) => i.id === handle))) }; return; }
      if (id) { if (e.shiftKey) S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); else if (!S.sel.has(id)) S.sel = new Set([id]); snapshot(); drag = { move: true, x, y, orig: new Map([...S.sel].map((sid) => [sid, JSON.parse(JSON.stringify(S.items.find((i) => i.id === sid)))])) }; draw(); return; }
      S.sel.clear(); S.marq = [x, y, x, y]; drag = { marq: true }; draw(); return;
    }
    if (S.tool === "pen" || S.tool === "hl") { const it = add({ t: "path", pts: [[x, y]], stroke: S.tool === "hl" ? "#EE9B1E" : S.stroke, sw: S.tool === "hl" ? 18 : S.sw, hl: S.tool === "hl" ? 1 : 0 }); drag = { draw: it }; return; }
    if (S.tool === "line" || S.tool === "arrow") { const it = add({ t: S.tool, pts: [[x, y], [x, y]], stroke: S.stroke, sw: S.sw }); drag = { line: it }; return; }
    if (["rect", "ellipse", "diamond"].includes(S.tool)) { const it = add({ t: S.tool, x, y, w: 1, h: 1, stroke: S.stroke, fill: S.fill, sw: S.sw, fs: S.fs }); drag = { box: it, x, y }; return; }
    if (S.tool === "sticky") { const it = add({ t: "sticky", x: x - 100, y: y - 80, w: 200, h: 160, fill: S.fill !== "none" && STICKY.includes(S.fill) ? S.fill : STICKY[0], text: "", fs: 18 }); setTool("select"); editText(it); return; }
    if (S.tool === "text") { const it = add({ t: "text", x, y: y - 20, w: 360, h: 40, text: "", fs: S.fs, stroke: S.stroke }); setTool("select"); editText(it); return; }
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (drag.pan) { S.view.x = drag.vx - (e.clientX - drag.sx) / S.view.k; S.view.y = drag.vy - (e.clientY - drag.sy) / S.view.k; applyView(); return; }
    const [x, y] = toWorld(e);
    if (drag.erase) { const id = hit(e); if (id) { S.items = S.items.filter((i) => i.id !== id); changed(); } return; }
    if (drag.draw) { drag.draw.pts.push([x, y]); draw(); return; }
    if (drag.line) { drag.line.pts[1] = e.shiftKey ? (Math.abs(x - drag.line.pts[0][0]) > Math.abs(y - drag.line.pts[0][1]) ? [x, drag.line.pts[0][1]] : [drag.line.pts[0][0], y]) : [x, y]; draw(); return; }
    if (drag.box) { const it = drag.box; it.x = Math.min(x, drag.x); it.y = Math.min(y, drag.y); it.w = Math.abs(x - drag.x); it.h = e.shiftKey ? it.w : Math.abs(y - drag.y); draw(); return; }
    if (drag.marq) { S.marq[2] = x; S.marq[3] = y; draw(); return; }
    if (drag.move) { const dx = x - drag.x, dy = y - drag.y; for (const [sid, o] of drag.orig) { const it = S.items.find((i) => i.id === sid); if (o.pts) it.pts = o.pts.map((p) => [p[0] + dx, p[1] + dy]); else { it.x = o.x + dx; it.y = o.y + dy; } } changed(); return; }
    if (drag.resize) { const it = S.items.find((i) => i.id === drag.resize); it.w = Math.max(20, drag.orig.w + (x - drag.x)); it.h = Math.max(20, drag.orig.h + (y - drag.y)); changed(); }
  });
  stage.addEventListener("pointerup", () => {
    if (drag?.marq) { const [a, b, c, d] = S.marq; const r = { x: Math.min(a, c), y: Math.min(b, d), w: Math.abs(c - a), h: Math.abs(d - b) }; S.sel = new Set(S.items.filter((it) => { const q = bbox(it); return q.x >= r.x && q.y >= r.y && q.x + q.w <= r.x + r.w && q.y + q.h <= r.y + r.h; }).map((i) => i.id)); S.marq = null; draw(); }
    if (drag?.box && drag.box.w < 8 && drag.box.h < 8) { drag.box.w = 180; drag.box.h = 110; changed(); }
    if (drag && !drag.pan && !drag.marq) changed();
    drag = null;
  });
  stage.addEventListener("dblclick", (e) => { const id = hit(e); const it = S.items.find((i) => i.id === id); if (it && ["rect", "ellipse", "diamond", "sticky", "text"].includes(it.t)) editText(it); });
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { const [wx, wy] = toWorld(e); const k = Math.min(4, Math.max(0.15, S.view.k * (e.deltaY < 0 ? 1.1 : 0.9))); const r = stage.getBoundingClientRect(); S.view.k = k; S.view.x = wx - (e.clientX - r.left) / k; S.view.y = wy - (e.clientY - r.top) / k; }
    else { S.view.x += e.deltaX / S.view.k; S.view.y += e.deltaY / S.view.k; }
    applyView();
  }, { passive: false });

  function editText(it) {
    const r = stage.getBoundingClientRect(), b = bbox(it);
    const ta = document.createElement("textarea");
    ta.className = "wb-edit"; ta.value = it.text || "";
    Object.assign(ta.style, { left: `${(b.x - S.view.x) * S.view.k}px`, top: `${(b.y - S.view.y) * S.view.k}px`, width: `${Math.max(120, b.w * S.view.k)}px`, height: `${Math.max(40, b.h * S.view.k)}px`, fontSize: `${(it.fs || 18) * S.view.k}px`, textAlign: it.t === "text" ? "left" : "center" });
    stage.append(ta); ta.focus();
    const done = () => { snapshot(); it.text = ta.value; if (it.t === "text") { it.h = Math.max(40, wrap(it.text, it.w, it.fs).length * it.fs * 1.3); if (!it.text.trim()) S.items = S.items.filter((x) => x !== it); } ta.remove(); changed(); };
    ta.addEventListener("blur", done, { once: true });
    ta.addEventListener("keydown", (e) => { if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) ta.blur(); e.stopPropagation(); });
  }
  function pickIcon() {
    dialog({ title: "KSA icon library", wide: true, body: `<div class="wb-icons">${ICONS.map((n) => `<button data-ic="${n}" title="${n}"><img src="/app/icons/ksa-icon-${n}.svg" alt=""><span>${n.replace(/-/g, " ")}</span></button>`).join("")}</div>`, actions: [{ id: "c", label: "Close" }],
      onOpen: (d) => d.querySelectorAll("[data-ic]").forEach((b) => b.addEventListener("click", () => { const r = stage.getBoundingClientRect(); add({ t: "icon", src: `/app/icons/ksa-icon-${b.dataset.ic}.svg`, x: S.view.x + r.width / S.view.k / 2 - 48, y: S.view.y + r.height / S.view.k / 2 - 48, w: 96, h: 96 }); d.querySelector("[data-x]").click(); setTool("select"); })) });
  }
  $("#imgf").onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ""; setTool("select");
    if (!f) return; if (f.size > 1_500_000) return toast("Images up to 1.5 MB, please.", "err");
    const src = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
    const img = new Image(); img.src = src; await img.decode().catch(() => {});
    const w = Math.min(600, img.naturalWidth || 400), h = w * ((img.naturalHeight || 300) / (img.naturalWidth || 400));
    const r = stage.getBoundingClientRect(); add({ t: "image", src, x: S.view.x + r.width / S.view.k / 2 - w / 2, y: S.view.y + r.height / S.view.k / 2 - h / 2, w, h });
  };

  // ---------- properties and commands
  const setOnSel = (k, v) => { if (!S.sel.size) return; snapshot(); S.items.forEach((it) => { if (S.sel.has(it.id)) it[k] = v; }); changed(); };
  main.querySelectorAll("#stroke [data-c]").forEach((b) => (b.onclick = () => { S.stroke = b.dataset.c; setOnSel("stroke", S.stroke); }));
  main.querySelectorAll("#fill [data-c]").forEach((b) => (b.onclick = () => { S.fill = b.dataset.c; setOnSel("fill", S.fill); }));
  $("#sw").oninput = (e) => { S.sw = Number(e.target.value); setOnSel("sw", S.sw); };
  $("#fs").oninput = (e) => { S.fs = Number(e.target.value); setOnSel("fs", S.fs); };
  const undo = () => { if (!S.undo.length) return; S.redo.push(JSON.stringify(S.items)); S.items = JSON.parse(S.undo.pop()); S.sel.clear(); changed(); };
  const redo = () => { if (!S.redo.length) return; S.undo.push(JSON.stringify(S.items)); S.items = JSON.parse(S.redo.pop()); S.sel.clear(); changed(); };
  const del = () => { if (!S.sel.size) return; snapshot(); S.items = S.items.filter((i) => !S.sel.has(i.id)); S.sel.clear(); changed(); };
  const dup = () => { if (!S.sel.size) return; snapshot(); const copies = S.items.filter((i) => S.sel.has(i.id)).map((i) => { const c = JSON.parse(JSON.stringify(i)); c.id = uidl(); if (c.pts) c.pts = c.pts.map((p) => [p[0] + 24, p[1] + 24]); else { c.x += 24; c.y += 24; } return c; }); S.items.push(...copies); S.sel = new Set(copies.map((c) => c.id)); changed(); };
  const order = (front) => { snapshot(); const sel = S.items.filter((i) => S.sel.has(i.id)), rest = S.items.filter((i) => !S.sel.has(i.id)); S.items = front ? [...rest, ...sel] : [...sel, ...rest]; changed(); };
  $("#undo").onclick = undo; $("#redo").onclick = redo; $("#rm").onclick = del; $("#dup").onclick = dup; $("#front").onclick = () => order(true); $("#back").onclick = () => order(false);
  const zoomBy = (f) => { const r = stage.getBoundingClientRect(); const cx = S.view.x + r.width / S.view.k / 2, cy = S.view.y + r.height / S.view.k / 2; S.view.k = Math.min(4, Math.max(0.15, S.view.k * f)); S.view.x = cx - r.width / S.view.k / 2; S.view.y = cy - r.height / S.view.k / 2; applyView(); };
  $("#zoomin").onclick = () => zoomBy(1.2); $("#zoomout").onclick = () => zoomBy(1 / 1.2);
  const fit = () => { const bs = S.items.map(bbox); const r = stage.getBoundingClientRect(); if (!bs.length) { S.view = { x: 0, y: 0, k: 1 }; return applyView(); } const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y)), x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h)); S.view.k = Math.min(2, Math.max(0.15, Math.min(r.width / (x1 - x0 + 120), r.height / (y1 - y0 + 120)))); S.view.x = x0 - (r.width / S.view.k - (x1 - x0)) / 2; S.view.y = y0 - (r.height / S.view.k - (y1 - y0)) / 2; applyView(); };
  $("#fit").onclick = fit;
  $("#grid").onchange = (e) => { S.grid = e.target.checked; draw(); };
  $("#title").onchange = () => { S.dirty = true; save(); };
  $("#share")?.addEventListener("change", () => { S.dirty = true; save(); toast($("#share").checked ? "Colleagues can now open and edit this board." : "Only you can see this board now."); });
  $("#del")?.addEventListener("click", async () => { if (await confirmDialog("Delete this board?", "This cannot be undone.", "Delete", true)) { clearInterval(iv); clearInterval(tv); await api(`/api/workspace/boards/${S.id}/delete`, { body: {} }); location.hash = "#/board"; } });
  const keys = (e) => {
    if (e.target.closest("input,textarea,select")) return;
    const k = e.key.toLowerCase();
    if (e.key === " ") { spaceDown = true; stage.dataset.tool = "pan"; e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === "d") { e.preventDefault(); dup(); return; }
    if ((e.ctrlKey || e.metaKey) && k === "s") { e.preventDefault(); S.dirty = true; save(true); return; }
    if (k === "delete" || k === "backspace") { del(); return; }
    if (k === "escape") { S.sel.clear(); draw(); return; }
    const t = TOOLS.find((x) => x[1].toLowerCase() === k); if (t && !e.ctrlKey && !e.metaKey) setTool(t[0]);
  };
  const keyup = (e) => { if (e.key === " ") { spaceDown = false; stage.dataset.tool = S.tool; } };
  document.addEventListener("keydown", keys); document.addEventListener("keyup", keyup);
  const ro = new ResizeObserver(applyView); ro.observe(stage);
  const beforeUnload = (e) => { if (S.dirty) { save(); e.preventDefault(); } };
  window.addEventListener("beforeunload", beforeUnload);
  S.cleanup = () => { clearInterval(iv); clearInterval(tv); document.removeEventListener("keydown", keys); document.removeEventListener("keyup", keyup); ro.disconnect(); window.removeEventListener("beforeunload", beforeUnload); if (S.dirty) save(); };
  window.addEventListener("hashchange", () => S?.cleanup?.(), { once: true });
  draw(); fit();
}
