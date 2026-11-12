// Joint Visuals: a collaborative whiteboard. Everyone in the space draws on the same infinite canvas;
// strokes appear live as they are drawn, and finished items are saved by the space's Durable Object.
const I = {
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8a8 8 0 0 0 16 0v-4a2 2 0 0 0-4 0"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  hl: '<path d="M9 11l-6 6v3h9l3-3"/><path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  erase: '<path d="M20 20H7L3 16a2 2 0 0 1 0-2.8L13.2 3a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L12 20"/>',
  rect: '<rect x="3" y="5" width="18" height="14" rx="2"/>',
  ell: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
  arrow: '<path d="M5 19L19 5M10 5h9v9"/>',
  note: '<path d="M15 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/><path d="M15 21v-6h6"/>',
  text: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  clear: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
};
const svg = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
const COLORS = ["#0E2F3C", "#17807E", "#EE9B1E", "#B4472F", "#2D6A9F", "#5E4B78", "#4B7A4E"];
const NOTE = ["#FBEBCD", "#CDE8E3", "#F7D9D2", "#E2DCEE"];
const WIDTHS = [2, 5, 10];
const uid = () => Math.random().toString(36).slice(2, 10);

export function mount(api) {
  const { root, conn, toast, space, me } = api;
  root.innerHTML = `<div class="wb" id="wb"><canvas id="wbc"></canvas>
    <div class="wb-tools" role="toolbar" aria-label="Whiteboard tools">
      ${[["hand", "Move around (H)"], ["pen", "Pen (P)"], ["hl", "Highlighter"], ["erase", "Eraser (E)"], ["rect", "Rectangle (R)"], ["ell", "Ellipse (O)"], ["arrow", "Arrow (A)"], ["note", "Sticky note (N)"], ["text", "Text (T)"]].map(([k, l]) => `<button data-tool="${k}" title="${l}" aria-label="${l}">${svg(k)}</button>`).join("")}
      <span class="sep"></span>${COLORS.map((c) => `<button data-color="${c}" title="Colour" aria-label="Colour ${c}"><span class="sw" style="background:${c}"></span></button>`).join("")}
      <span class="sep"></span>${WIDTHS.map((w) => `<button data-width="${w}" title="Thickness" aria-label="Thickness ${w}"><span class="wd" style="width:${4 + w * 1.4}px;height:${4 + w * 1.4}px"></span></button>`).join("")}
      <span class="sep"></span><button data-act="undo" title="Undo (Ctrl+Z)" aria-label="Undo">${svg("undo")}</button><button data-act="redo" title="Redo (Ctrl+Shift+Z)" aria-label="Redo">${svg("redo")}</button>
      <button data-act="png" title="Download as PNG" aria-label="Download as PNG">${svg("dl")}</button><button data-act="clear" title="Clear the board" aria-label="Clear the board">${svg("clear")}</button>
    </div>
    <div class="wb-zoom"><button class="glass" data-z="-">−</button><button class="glass" data-z="fit" id="zl">100%</button><button class="glass" data-z="+">+</button></div>
    <div class="wb-hint">Drag to draw · Space or the hand to move · Ctrl + scroll to zoom</div></div>`;
  const wrap = root.querySelector("#wb"), cv = root.querySelector("#wbc"), ctx = cv.getContext("2d");
  const items = new Map(); // id -> item (saved)
  window.__kxBoardCount = () => items.size; // used by the end-to-end test
  const drafts = new Map(); // peer -> item being drawn (live)
  const cursors = new Map(); // peer -> {x,y,name,color,at}
  const mine = [], redo = []; // ids I added, for undo; items for redo
  let tool = "pen", color = COLORS[0], width = WIDTHS[1], view = { x: 0, y: 0, z: 1 }, dirty = true, cur = null, panning = null, spaceDown = false;

  // ---------------- state from the server
  const apply = (op) => {
    if (op.type === "add" && op.item?.id) items.set(op.item.id, op.item);
    else if (op.type === "del" && Array.isArray(op.ids)) for (const id of op.ids) items.delete(id);
    else if (op.type === "move" && op.id && items.has(op.id)) Object.assign(items.get(op.id), op.patch || {});
    dirty = true;
  };
  api.on("hello", (m) => { items.clear(); m.ops.forEach(apply); fit(true); });
  api.on("op", (m) => { apply(m.op); if (m.op.type === "add") drafts.delete(m.op.byDraft); });
  api.on("reset", (m) => { items.clear(); mine.length = 0; redo.length = 0; dirty = true; toast(`${m.by} cleared the board.`); });
  api.on("live", (m) => {
    const d = m.data || {};
    if (d.k === "cur") cursors.set(m.from, { x: d.x, y: d.y, name: m.name, color: m.color, at: Date.now() });
    else if (d.k === "draft") { if (d.item) drafts.set(m.from, { ...d.item, _color: m.color }); else drafts.delete(m.from); }
    dirty = true;
  });
  api.on("people", (m) => { const ids = new Set(m.people.map((p) => p.id)); for (const k of [...cursors.keys()]) if (!ids.has(k)) { cursors.delete(k); drafts.delete(k); } dirty = true; });

  // ---------------- toolbar
  const setTool = (t) => { tool = t; root.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === t)); wrap.classList.toggle("pan", t === "hand"); };
  const setColor = (c) => { color = c; root.querySelectorAll("[data-color]").forEach((b) => b.classList.toggle("on", b.dataset.color === c)); };
  const setWidth = (w) => { width = w; root.querySelectorAll("[data-width]").forEach((b) => b.classList.toggle("on", +b.dataset.width === w)); };
  setTool("pen"); setColor(color); setWidth(width);
  root.querySelector(".wb-tools").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.tool) setTool(b.dataset.tool);
    if (b.dataset.color) setColor(b.dataset.color);
    if (b.dataset.width) setWidth(+b.dataset.width);
    if (b.dataset.act === "undo") undo();
    if (b.dataset.act === "redo") doRedo();
    if (b.dataset.act === "png") exportPng();
    if (b.dataset.act === "clear") { if (confirm("Clear the whole board for everyone?")) conn.reset(); }
  };
  root.querySelector(".wb-zoom").onclick = (e) => { const z = e.target.closest("[data-z]")?.dataset.z; if (!z) return; if (z === "fit") fit(); else zoomAt(cv.clientWidth / 2, cv.clientHeight / 2, z === "+" ? 1.2 : 1 / 1.2); };

  // ---------------- geometry
  const toWorld = (sx, sy) => ({ x: (sx - view.x) / view.z, y: (sy - view.y) / view.z });
  const zoomAt = (sx, sy, f) => { const w = toWorld(sx, sy); view.z = Math.min(6, Math.max(0.15, view.z * f)); view.x = sx - w.x * view.z; view.y = sy - w.y * view.z; dirty = true; };
  const bounds = (it) => {
    if (it.pts) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (let i = 0; i < it.pts.length; i += 2) { a = Math.min(a, it.pts[i]); b = Math.min(b, it.pts[i + 1]); c = Math.max(c, it.pts[i]); d = Math.max(d, it.pts[i + 1]); } return { x: a, y: b, w: c - a, h: d - b }; }
    return { x: Math.min(it.x, it.x + it.w), y: Math.min(it.y, it.y + it.h), w: Math.abs(it.w), h: Math.abs(it.h) };
  };
  function fit(initial = false) {
    if (!items.size) { view = { x: cv.clientWidth / 2, y: cv.clientHeight / 2, z: 1 }; dirty = true; return; }
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const it of items.values()) { const r = bounds(it); a = Math.min(a, r.x); b = Math.min(b, r.y); c = Math.max(c, r.x + r.w); d = Math.max(d, r.y + r.h); }
    const W = cv.clientWidth, H = cv.clientHeight, pad = 80;
    const z = Math.min(2, Math.max(0.2, Math.min((W - pad * 2) / Math.max(1, c - a), (H - pad * 2) / Math.max(1, d - b))));
    view = { z: initial ? Math.min(1, z) : z, x: 0, y: 0 };
    view.x = W / 2 - ((a + c) / 2) * view.z; view.y = H / 2 - ((b + d) / 2) * view.z; dirty = true;
  }
  const near = (it, p, r) => {
    const bb = bounds(it);
    if (p.x < bb.x - r || p.y < bb.y - r || p.x > bb.x + bb.w + r || p.y > bb.y + bb.h + r) return false;
    if (!it.pts) return true;
    for (let i = 0; i < it.pts.length; i += 2) if (Math.hypot(it.pts[i] - p.x, it.pts[i + 1] - p.y) < r + (it.w || 2)) return true;
    return false;
  };

  // ---------------- drawing
  function wrapText(c, text, maxW) { const out = []; for (const para of String(text).split("\n")) { let line = ""; for (const w of para.split(" ")) { const t = line ? line + " " + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } out.push(line); } return out; }
  function drawItem(c, it, ghost = false) {
    c.save();
    c.globalAlpha = ghost ? 0.55 : it.k === "hl" ? 0.35 : 1;
    c.strokeStyle = it.c; c.fillStyle = it.c; c.lineCap = "round"; c.lineJoin = "round";
    // pens keep their thickness in w; shapes keep their size in w/h and their thickness in sw
    c.lineWidth = it.k === "hl" ? (it.w || 5) * 3.2 : it.k === "pen" ? it.w || 3 : it.sw || 3;
    if (it.k === "pen" || it.k === "hl") {
      const p = it.pts; if (!p || p.length < 2) { c.restore(); return; }
      c.beginPath(); c.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length - 2; i += 2) { const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2; c.quadraticCurveTo(p[i], p[i + 1], mx, my); }
      if (p.length >= 4) c.lineTo(p[p.length - 2], p[p.length - 1]);
      c.stroke();
    } else if (it.k === "rect") { const b = bounds(it); c.beginPath(); c.roundRect(b.x, b.y, b.w, b.h, 8); c.stroke(); }
    else if (it.k === "ell") { c.beginPath(); c.ellipse(it.x + it.w / 2, it.y + it.h / 2, Math.abs(it.w / 2), Math.abs(it.h / 2), 0, 0, Math.PI * 2); c.stroke(); }
    else if (it.k === "arrow") {
      const x2 = it.x + it.w, y2 = it.y + it.h, a = Math.atan2(it.h, it.w), L = 10 + (it.sw || 3) * 3;
      c.beginPath(); c.moveTo(it.x, it.y); c.lineTo(x2, y2); c.stroke();
      c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - L * Math.cos(a - 0.45), y2 - L * Math.sin(a - 0.45)); c.lineTo(x2 - L * Math.cos(a + 0.45), y2 - L * Math.sin(a + 0.45)); c.closePath(); c.fill();
    } else if (it.k === "note") {
      c.shadowColor = "#0E2F3C33"; c.shadowBlur = 16; c.shadowOffsetY = 6;
      c.fillStyle = it.bg || NOTE[0]; c.beginPath(); c.roundRect(it.x, it.y, it.w, it.h, 10); c.fill();
      c.shadowColor = "transparent"; c.fillStyle = "#0E2F3C"; c.font = "500 17px Archivo, Arial";
      wrapText(c, it.text, it.w - 24).slice(0, 12).forEach((l, i) => c.fillText(l, it.x + 12, it.y + 28 + i * 22));
      if (it.byName) { c.font = "600 11px Archivo, Arial"; c.fillStyle = "#4E6470"; c.fillText(it.byName, it.x + 12, it.y + it.h - 10); }
    } else if (it.k === "text") { c.font = `600 ${it.size || 24}px Archivo, Arial`; wrapText(c, it.text, 900).forEach((l, i) => c.fillText(l, it.x, it.y + (it.size || 24) * (i + 1))); }
    c.restore();
  }
  function render() {
    const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    // dotted grid
    const g = 32 * view.z; if (g > 8) { ctx.fillStyle = "#0E2F3C1f"; const ox = ((view.x % g) + g) % g, oy = ((view.y % g) + g) % g; for (let x = ox; x < W; x += g) for (let y = oy; y < H; y += g) ctx.fillRect(x, y, 1.6, 1.6); }
    ctx.setTransform(dpr * view.z, 0, 0, dpr * view.z, dpr * view.x, dpr * view.y);
    for (const it of items.values()) drawItem(ctx, it);
    for (const d of drafts.values()) drawItem(ctx, d, true);
    if (cur) drawItem(ctx, cur, true);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const now = Date.now();
    for (const [k, c] of cursors) {
      if (now - c.at > 15000) { cursors.delete(k); continue; }
      const sx = c.x * view.z + view.x, sy = c.y * view.z + view.y;
      ctx.fillStyle = c.color; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 4, sy + 16); ctx.lineTo(sx + 9, sy + 10); ctx.lineTo(sx + 16, sy + 8); ctx.closePath(); ctx.fill();
      ctx.font = "700 12px Archivo, Arial"; const tw = ctx.measureText(c.name).width;
      ctx.beginPath(); ctx.roundRect(sx + 14, sy + 14, tw + 14, 20, 10); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillText(c.name, sx + 21, sy + 28);
    }
    root.querySelector("#zl").textContent = Math.round(view.z * 100) + "%";
  }
  (function loop() { if (dirty) { dirty = false; render(); } requestAnimationFrame(loop); })();
  addEventListener("resize", () => (dirty = true));
  setInterval(() => (dirty = true), 1000); // let stale cursors fade

  // ---------------- input
  let lastLive = 0, lastCur = 0;
  const sendDraft = (force) => { const n = Date.now(); if (!force && n - lastLive < 45) return; lastLive = n; conn.live({ k: "draft", item: cur ? { ...cur, pts: cur.pts ? cur.pts.slice(-600) : undefined } : null }); };
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId);
    const p = toWorld(e.offsetX, e.offsetY);
    if (tool === "hand" || spaceDown || e.button === 1) { panning = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; return; }
    if (tool === "note" || tool === "text") return editText(p, e);
    if (tool === "erase") { cur = { k: "erase", pts: [p.x, p.y] }; eraseAt(p); return; }
    if (tool === "pen" || tool === "hl") cur = { id: uid(), k: tool, c: color, w: width, pts: [Math.round(p.x), Math.round(p.y)] };
    else cur = { id: uid(), k: tool, c: color, x: Math.round(p.x), y: Math.round(p.y), w: 0, h: 0, sw: width };
    dirty = true;
  });
  cv.addEventListener("pointermove", (e) => {
    const p = toWorld(e.offsetX, e.offsetY);
    const n = Date.now(); if (n - lastCur > 60) { lastCur = n; conn.live({ k: "cur", x: Math.round(p.x), y: Math.round(p.y) }); }
    if (panning) { view.x = panning.vx + e.clientX - panning.sx; view.y = panning.vy + e.clientY - panning.sy; dirty = true; return; }
    if (!cur) return;
    if (cur.k === "erase") { eraseAt(p); return; }
    if (cur.pts) { const L = cur.pts.length; if (Math.hypot(cur.pts[L - 2] - p.x, cur.pts[L - 1] - p.y) > 1.5 / view.z) cur.pts.push(Math.round(p.x), Math.round(p.y)); }
    else { cur.w = Math.round(p.x - cur.x); cur.h = Math.round(p.y - cur.y); }
    dirty = true; sendDraft();
  });
  const end = () => {
    if (panning) { panning = null; return; }
    if (!cur) return;
    const it = cur; cur = null; dirty = true;
    if (it.k === "erase") return;
    if (it.pts && it.pts.length < 4) it.pts.push(it.pts[0] + 0.5, it.pts[1] + 0.5);
    if (!it.pts && Math.hypot(it.w, it.h) < 6) { sendDraft(true); return; }
    const item = { ...it };
    items.set(item.id, item); mine.push(item.id); redo.length = 0;
    conn.op({ type: "add", item });
    sendDraft(true);
  };
  cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  cv.addEventListener("wheel", (e) => { e.preventDefault(); if (e.ctrlKey || e.metaKey) zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0022)); else { view.x -= e.deltaX; view.y -= e.deltaY; dirty = true; } }, { passive: false });
  const erased = new Set();
  function eraseAt(p) {
    const hit = [...items.values()].filter((it) => !erased.has(it.id) && near(it, p, 10 / view.z)).map((it) => it.id);
    if (!hit.length) return;
    hit.forEach((id) => { erased.add(id); items.delete(id); });
    conn.op({ type: "del", ids: hit }); dirty = true;
    setTimeout(() => hit.forEach((id) => erased.delete(id)), 2000);
  }
  function editText(p, e) {
    const ta = document.createElement("textarea");
    ta.className = "wb-note"; const isNote = tool === "note";
    ta.style.left = e.offsetX + "px"; ta.style.top = e.offsetY + "px";
    ta.style.background = isNote ? NOTE[COLORS.indexOf(color) % NOTE.length] : "#fff";
    ta.placeholder = isNote ? "Type your note…" : "Type text…";
    wrap.append(ta); setTimeout(() => ta.focus(), 0);
    const done = () => {
      const text = ta.value.trim(); ta.remove();
      if (!text) return;
      const item = isNote ? { id: uid(), k: "note", x: p.x, y: p.y, w: Math.max(200, ta.offsetWidth / view.z || 220), h: Math.max(140, Math.min(320, 60 + text.split("\n").length * 24 + text.length * 0.5)), bg: NOTE[COLORS.indexOf(color) % NOTE.length], text }
        : { id: uid(), k: "text", x: p.x, y: p.y, c: color, size: 14 + width * 3, text };
      items.set(item.id, { ...item, byName: me.name }); mine.push(item.id); redo.length = 0;
      conn.op({ type: "add", item }); dirty = true;
    };
    ta.addEventListener("blur", done, { once: true });
    ta.addEventListener("keydown", (k) => { if (k.key === "Escape") { ta.value = ""; ta.blur(); } if (k.key === "Enter" && (k.metaKey || k.ctrlKey)) ta.blur(); });
  }
  function undo() { const id = mine.pop(); if (!id) return; const it = items.get(id); if (it) { redo.push(it); items.delete(id); conn.op({ type: "del", ids: [id] }); dirty = true; } }
  function doRedo() { const it = redo.pop(); if (!it) return; items.set(it.id, it); mine.push(it.id); conn.op({ type: "add", item: it }); dirty = true; }
  async function exportPng() {
    if (!items.size) return toast("The board is empty.");
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const it of items.values()) { const r = bounds(it); a = Math.min(a, r.x); b = Math.min(b, r.y); c = Math.max(c, r.x + r.w); d = Math.max(d, r.y + r.h); }
    const pad = 40, scale = 2, W = Math.min(8000, (c - a + pad * 2) * scale), H = Math.min(8000, (d - b + pad * 2) * scale);
    const off = document.createElement("canvas"); off.width = W; off.height = H;
    const o = off.getContext("2d"); o.fillStyle = "#fff"; o.fillRect(0, 0, W, H);
    o.setTransform(scale, 0, 0, scale, (pad - a) * scale, (pad - b) * scale);
    for (const it of items.values()) drawItem(o, it);
    o.setTransform(1, 0, 0, 1, 0, 0); o.font = "600 22px Archivo, Arial"; o.fillStyle = "#4E6470"; o.fillText(`${space.title} · Kayakers · Meet by Kayak`, 24, H - 24);
    off.toBlob((blob) => { const a2 = document.createElement("a"); a2.href = URL.createObjectURL(blob); a2.download = `${space.title.replace(/[^\w -]+/g, "")}.png`; a2.click(); setTimeout(() => URL.revokeObjectURL(a2.href), 5000); });
  }
  addEventListener("keydown", (e) => {
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
    if (e.code === "Space") { spaceDown = true; wrap.classList.add("pan"); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? doRedo() : undo(); }
    const k = { h: "hand", p: "pen", e: "erase", r: "rect", o: "ell", a: "arrow", n: "note", t: "text" }[e.key.toLowerCase()];
    if (k && !e.ctrlKey && !e.metaKey) setTool(k);
  });
  addEventListener("keyup", (e) => { if (e.code === "Space") { spaceDown = false; wrap.classList.toggle("pan", tool === "hand"); } });
}
