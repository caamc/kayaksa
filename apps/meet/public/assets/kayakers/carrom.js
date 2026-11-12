// Carrom for Kayakers: two players (or one against Kayak AI) on a real-physics board. Drag the
// striker sideways along your baseline to place it, pull it back like a slingshot and let go to
// shoot. The shooter's browser works out where everything ends up and saves that as the
// authoritative state, so every screen agrees.
//
// Rules (simplified, shown in the side panel): Player 1 pockets ivory coins, Player 2 deep-teal.
// Pocket your own coin: +1 and shoot again. The Kayak queen (saffron): +3 and shoot again.
// Pocket the striker: foul, -1 and your turn ends. Pocket your opponent's coin: it counts for them.
// The game ends when one colour is cleared; the higher score wins.
const S = 1000, IN0 = 70, IN1 = 930, POCKET = [[IN0 + 28, IN0 + 28], [IN1 - 28, IN0 + 28], [IN0 + 28, IN1 - 28], [IN1 - 28, IN1 - 28]], PR = 27;
const RC = 17, RS = 24, BASE = { p1: 815, p2: 185 }, XMIN = 270, XMAX = 730, DECEL = 360, REST_W = 0.72, REST_C = 0.93;
const COL = { w: "p1", b: "p2" }, OWN = { p1: "w", p2: "b" };

export function initial() {
  const coins = [{ id: "q", c: "q", x: 500, y: 500 }];
  let n = 0;
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; coins.push({ id: "i" + i, c: i % 2 ? "b" : "w", x: 500 + Math.cos(a) * (RC * 2 + 1), y: 500 + Math.sin(a) * (RC * 2 + 1) }); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const r = i % 2 ? (RC * 2 + 1) * Math.sqrt(3) : (RC * 2 + 1) * 2; coins.push({ id: "o" + i, c: i % 2 ? "w" : "b", x: 500 + Math.cos(a) * r, y: 500 + Math.sin(a) * r }); n++; }
  return { coins, scores: { p1: 0, p2: 0 }, turn: "p1", shotNo: 0, last: "", over: null };
}

// Deterministic simulation of one shot. Returns the final coins and what was pocketed, plus frames for animation.
export function simulate(state, shot, keepFrames = true) {
  const dt = 1 / 120;
  const bodies = state.coins.map((c) => ({ ...c, vx: 0, vy: 0, r: RC, m: 1, in: false }));
  const st = { id: "s", c: "s", x: shot.x, y: BASE[state.turn], vx: Math.cos(shot.a) * (300 + shot.p * 1900), vy: Math.sin(shot.a) * (300 + shot.p * 1900), r: RS, m: 2.1, in: false };
  bodies.push(st);
  const frames = [], pocketed = [];
  for (let step = 0; step < 120 * 12; step++) {
    let moving = false;
    for (const b of bodies) {
      if (b.in) continue;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) { const ns = Math.max(0, sp - DECEL * dt); b.vx *= ns / sp; b.vy *= ns / sp; }
      if (sp > 1) moving = true; else { b.vx = 0; b.vy = 0; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x - b.r < IN0) { b.x = IN0 + b.r; b.vx = Math.abs(b.vx) * REST_W; }
      if (b.x + b.r > IN1) { b.x = IN1 - b.r; b.vx = -Math.abs(b.vx) * REST_W; }
      if (b.y - b.r < IN0) { b.y = IN0 + b.r; b.vy = Math.abs(b.vy) * REST_W; }
      if (b.y + b.r > IN1) { b.y = IN1 - b.r; b.vy = -Math.abs(b.vy) * REST_W; }
      for (const [px, py] of POCKET) if (Math.hypot(b.x - px, b.y - py) < PR - 3) { b.in = true; b.vx = b.vy = 0; pocketed.push(b.c === "s" ? "s" : b.id); break; }
    }
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]; if (a.in) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]; if (b.in) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
        if (d >= min || d === 0) continue;
        const nx = dx / d, ny = dy / d, over = (min - d) / 2;
        a.x -= nx * over; a.y -= ny * over; b.x += nx * over; b.y += ny * over;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel <= 0) continue;
        const k = ((1 + REST_C) * rel) / (1 / a.m + 1 / b.m);
        a.vx -= (k / a.m) * nx; a.vy -= (k / a.m) * ny; b.vx += (k / b.m) * nx; b.vy += (k / b.m) * ny;
      }
    }
    if (keepFrames && step % 2 === 0) frames.push(bodies.map((b) => [b.id, Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10, b.in ? 1 : 0]));
    if (!moving) break;
  }
  return { coins: bodies.filter((b) => b.c !== "s" && !b.in).map(({ id, c, x, y }) => ({ id, c, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })), pocketed, frames };
}

// Apply the rules to a finished shot.
export function resolve(state, result) {
  const me = state.turn, other = me === "p1" ? "p2" : "p1", scores = { ...state.scores };
  const byId = Object.fromEntries(state.coins.map((c) => [c.id, c]));
  let again = false, notes = [];
  if (result.pocketed.includes("s")) { scores[me] = Math.max(0, scores[me] - 1); notes.push("Foul: striker pocketed (−1)"); }
  for (const id of result.pocketed) {
    if (id === "s") continue; const c = byId[id]; if (!c) continue;
    if (c.c === "q") { scores[me] += 3; again = true; notes.push("Queen! +3"); }
    else if (c.c === OWN[me]) { scores[me] += 1; again = true; }
    else { scores[other] += 1; notes.push("Pocketed the opponent's coin"); }
  }
  if (result.pocketed.includes("s")) again = false;
  const left = { w: result.coins.filter((c) => c.c === "w").length, b: result.coins.filter((c) => c.c === "b").length };
  let over = null;
  if (!left.w || !left.b) over = scores.p1 === scores.p2 ? "draw" : scores.p1 > scores.p2 ? "p1" : "p2";
  const own = result.pocketed.filter((id) => byId[id] && byId[id].c === OWN[me]).length;
  if (own) notes.unshift(`${own} coin${own > 1 ? "s" : ""} pocketed (+${own})`);
  return { coins: result.coins, scores, turn: over ? me : again ? me : other, shotNo: state.shotNo + 1, last: notes.join(" · ") || "No coins pocketed", over };
}

// Kayak AI: try many shots (simulated, not drawn) and pick the one that scores best.
export function aiShot(state) {
  const me = state.turn, y = BASE[me], fwd = me === "p1" ? -1 : 1;
  const targets = state.coins.filter((c) => c.c === OWN[me] || c.c === "q");
  const cands = [];
  for (const x of [XMIN, 380, 500, 620, XMAX]) {
    for (const t of targets) for (const [px, py] of POCKET) {
      const dx = t.x - px, dy = t.y - py, d = Math.hypot(dx, dy);
      const gx = t.x + (dx / d) * (RC + RS), gy = t.y + (dy / d) * (RC + RS); // aim at the "ghost" position behind the coin
      if ((gy - y) * fwd <= 5) continue;
      const a = Math.atan2(gy - y, gx - x);
      for (const p of [0.42, 0.62, 0.82]) cands.push({ x, a, p });
    }
    for (const a of [-1.2, -1.0, -0.8, -0.6]) cands.push({ x, a: me === "p1" ? a * Math.PI / 2 * 0.9 - 0.2 : -(a * Math.PI / 2 * 0.9 - 0.2), p: 0.7 }); // break shots
  }
  let best = cands[0] || { x: 500, a: fwd * Math.PI / 2, p: 0.7 }, bestScore = -Infinity;
  for (const c of cands.slice(0, 450)) {
    const r = simulate(state, c, false);
    let s = 0; const ids = new Set(r.pocketed);
    for (const co of state.coins) if (ids.has(co.id)) s += co.c === "q" ? 30 : co.c === OWN[me] ? 12 : -9;
    if (ids.has("s")) s -= 25;
    s += Math.random() * 0.5; // vary equal choices
    if (s > bestScore) { bestScore = s; best = c; }
  }
  // a steady hand, not a perfect one
  return { ...best, a: best.a + (Math.random() - 0.5) * 0.02, p: Math.min(1, best.p * (0.97 + Math.random() * 0.06)) };
}

export function mount(api) {
  const { root, conn, me, space, toast, esc } = api;
  const ai = space.mode === "ai", owner = space.created_by === me.id;
  root.innerHTML = `<div class="gm"><div class="gm-stage"><canvas id="cr" aria-label="Carrom board"></canvas></div>
    <aside class="gm-side"><h3>Carrom</h3><div class="gm-status" id="cst">Connecting…</div><div class="gm-seats" id="cseats"></div>
      <div class="gm-status" id="clast" style="font-weight:500;font-size:.9rem"></div>
      <div class="gm-actions"><button class="glass" id="cnew">New game</button></div>
      <p class="gm-note"><b>How to play:</b> drag the striker sideways along your line to place it, then pull it back and let go to shoot. Ivory coins are Player 1's, deep-teal coins Player 2's. Your coin +1 and shoot again; the saffron Kayak queen +3; pocketing the striker is a foul (−1). Clear your colour to end the game; the higher score wins.</p></aside></div>
    <style>#cr{width:min(calc(100vh - 110px),calc(100vw - 380px),860px);aspect-ratio:1;border-radius:22px;box-shadow:0 40px 90px #000a;touch-action:none;cursor:grab}@media (max-width:900px){#cr{width:min(calc(100vw - 32px),640px)}}</style>`;
  const cv = root.querySelector("#cr"), ctx = cv.getContext("2d");
  let state = initial(), seats = {}, anim = null, striker = 500, aim = null, busy = false;
  const myTurn = () => !state.over && !anim && (ai ? owner && state.turn === "p1" : seats[state.turn]?.id === me.id);
  const label = (k) => (ai && k === "p2" ? "Kayak AI" : ai && k === "p1" ? space.created_by_name || "Player" : seats[k]?.name || null);
  const scale = () => cv.width / S;
  const toBoard = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * S, y: ((e.clientY - r.top) / r.height) * S }; };

  function drawBoard() {
    const dpr = devicePixelRatio || 1, W = Math.round(cv.clientWidth * dpr);
    if (cv.width !== W) { cv.width = W; cv.height = W; }
    const k = scale(); ctx.setTransform(k, 0, 0, k, 0, 0);
    const wood = ctx.createLinearGradient(0, 0, S, S); wood.addColorStop(0, "#6B3F22"); wood.addColorStop(1, "#3E2213");
    ctx.fillStyle = wood; ctx.beginPath(); ctx.roundRect(0, 0, S, S, 40); ctx.fill();
    const face = ctx.createRadialGradient(500, 420, 80, 500, 500, 640); face.addColorStop(0, "#F6E3BC"); face.addColorStop(1, "#E3C48C");
    ctx.fillStyle = face; ctx.fillRect(IN0, IN0, IN1 - IN0, IN1 - IN0);
    ctx.strokeStyle = "#7A4A2A"; ctx.lineWidth = 3; ctx.strokeRect(IN0, IN0, IN1 - IN0, IN1 - IN0);
    for (const [px, py] of POCKET) { const g = ctx.createRadialGradient(px, py, 4, px, py, PR + 6); g.addColorStop(0, "#000"); g.addColorStop(1, "#2A170C"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, PR + 4, 0, Math.PI * 2); ctx.fill(); }
    // baselines
    ctx.strokeStyle = "#5A341C"; ctx.lineWidth = 2;
    for (const y of [BASE.p1, BASE.p2]) for (const off of [-RS, RS]) { ctx.beginPath(); ctx.moveTo(XMIN, y + off); ctx.lineTo(XMAX, y + off); ctx.stroke(); }
    for (const x of [BASE.p2, BASE.p1]) for (const off of [-RS, RS]) { ctx.beginPath(); ctx.moveTo(x + off, XMIN); ctx.lineTo(x + off, XMAX); ctx.stroke(); }
    for (const [cx, cy] of [[XMIN, BASE.p1], [XMAX, BASE.p1], [XMIN, BASE.p2], [XMAX, BASE.p2], [BASE.p2, XMIN], [BASE.p2, XMAX], [BASE.p1, XMIN], [BASE.p1, XMAX]]) { ctx.fillStyle = "#B4472F"; ctx.beginPath(); ctx.arc(cx, cy, RS - 2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#5A341C"; ctx.stroke(); }
    // centre rings with the Kayak blade motif
    ctx.strokeStyle = "#8C5A33"; ctx.lineWidth = 2; for (const r of [24, 120]) { ctx.beginPath(); ctx.arc(500, 500, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.save(); ctx.translate(500, 500); ctx.globalAlpha = 0.18; ctx.fillStyle = "#17807E";
    for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(10, -112); ctx.lineTo(-10, -112); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // corner arrows
    ctx.strokeStyle = "#5A341C"; ctx.lineWidth = 2;
    for (const [x1, y1, x2, y2] of [[230, 230, 140, 140], [770, 230, 860, 140], [230, 770, 140, 860], [770, 770, 860, 860]]) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  }
  function disc(x, y, r, kind) {
    ctx.save(); ctx.shadowColor = "#0006"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    if (kind === "w") { g.addColorStop(0, "#FFFDF6"); g.addColorStop(1, "#D9CDB2"); }
    else if (kind === "b") { g.addColorStop(0, "#2C6A78"); g.addColorStop(1, "#0B2530"); }
    else if (kind === "q") { g.addColorStop(0, "#FFD27A"); g.addColorStop(1, "#C77D10"); }
    else { g.addColorStop(0, "#5FD3CF"); g.addColorStop(1, "#0F6E6C"); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = kind === "w" ? "#B9A986" : "#ffffff55"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.stroke();
    if (kind === "s") { ctx.fillStyle = "#ffffffcc"; ctx.font = "800 14px Archivo, Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("K", x, y + 1); }
  }
  function draw(frame) {
    drawBoard();
    if (frame) { for (const [id, x, y, inn] of frame) if (!inn) disc(x, y, id === "s" ? RS : RC, id === "s" ? "s" : state.coins.find((c) => c.id === id)?.c || "w"); }
    else {
      for (const c of state.coins) disc(c.x, c.y, RC, c.c);
      if (!state.over) {
        const y = BASE[state.turn];
        if (aim) {
          const len = Math.min(1, aim.p); const dx = Math.cos(aim.a), dy = Math.sin(aim.a);
          ctx.save(); ctx.setLineDash([10, 10]); ctx.strokeStyle = "#0E2F3Caa"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(striker, y); ctx.lineTo(striker + dx * (140 + len * 420), y + dy * (140 + len * 420)); ctx.stroke(); ctx.restore();
          ctx.fillStyle = `hsl(${120 - len * 120},70%,45%)`; ctx.fillRect(striker - 40, y + (state.turn === "p1" ? 40 : -52), 80 * len, 10);
        }
        disc(striker, y, RS, "s");
      }
    }
  }
  function ui() {
    const s = root.querySelector("#cst");
    s.classList.toggle("win", !!state.over);
    s.textContent = state.over ? (state.over === "draw" ? "It's a draw!" : `${label(state.over) || (state.over === "p1" ? "Player 1" : "Player 2")} wins!`) : anim ? "…" : `${label(state.turn) || (state.turn === "p1" ? "Player 1" : "Player 2")} to shoot${myTurn() ? " · your turn" : ""}`;
    root.querySelector("#cseats").innerHTML = [["p1", "Player 1 · ivory", "w"], ["p2", "Player 2 · deep teal", "b"]].map(([k, l, c]) => {
      const who = label(k);
      return `<div class="gm-seat${state.turn === k && !state.over ? " turn" : ""}"><span class="chip" style="background:${c === "w" ? "#F2E8D2" : "#1B5566"}"></span><b>${who ? esc(who) : `<small>${l} - free</small>`}<br><small>${l.split(" · ")[1]} · ${state.scores[k]} pts</small></b>${!ai ? (seats[k]?.id === me.id ? `<button class="glass" data-leave>Leave</button>` : !seats[k] ? `<button class="glass p" data-seat="${k}">Play</button>` : "") : ""}</div>`;
    }).join("");
    root.querySelector("#clast").textContent = state.last ? `Last shot: ${state.last}` : "Break the pack to start.";
  }
  function playShot(shot, from, after) {
    const r = simulate(from, shot, true);
    anim = { frames: r.frames, i: 0 }; ui();
    const step = () => {
      if (!anim) return;
      draw(anim.frames[Math.min(anim.i, anim.frames.length - 1)]);
      anim.i += 1;
      if (anim.i < anim.frames.length) requestAnimationFrame(step);
      else { anim = null; after(resolve(from, r)); }
    };
    requestAnimationFrame(step);
  }
  function shoot(shot) {
    if (busy) return; busy = true;
    const from = state;
    conn.op({ type: "shot", ...shot, shotNo: from.shotNo, turn: from.turn, ai: !!shot.ai });
    playShot(shot, from, (next) => { state = next; striker = 500; busy = false; conn.op({ type: "state", state: next }); ui(); draw(); maybeAi(); });
  }
  function maybeAi() {
    if (!ai || !owner || state.over || state.turn !== "p2" || anim || busy) return;
    root.querySelector("#cst").textContent = "Kayak AI is lining up a shot…";
    setTimeout(() => { const s = aiShot(state); striker = s.x; draw(); setTimeout(() => shoot({ ...s, ai: true }), 500); }, 400);
  }
  // input: drag sideways to place, pull back to aim and shoot
  let dragging = null;
  cv.addEventListener("pointerdown", (e) => {
    if (!myTurn()) return toast(state.over ? "Start a new game." : ai ? "Wait for Kayak AI." : seats[state.turn] ? `It's ${label(state.turn)}'s turn.` : "Take a seat to play.");
    const p = toBoard(e), y = BASE[state.turn];
    if (Math.hypot(p.x - striker, p.y - y) > RS * 2.4) return;
    cv.setPointerCapture(e.pointerId); dragging = { mode: "place" }; cv.style.cursor = "grabbing";
  });
  cv.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const p = toBoard(e), y = BASE[state.turn], back = state.turn === "p1" ? p.y - y : y - p.y;
    if (back > 34) { // pulled back: aim the opposite way
      dragging.mode = "aim";
      const a = Math.atan2(y - p.y, striker - p.x), pull = Math.min(1, Math.hypot(p.x - striker, p.y - y) / 300);
      aim = { a, p: pull };
    } else { dragging.mode = "place"; aim = null; striker = Math.max(XMIN, Math.min(XMAX, p.x)); }
    draw();
  });
  const release = () => {
    if (!dragging) return; cv.style.cursor = "grab";
    const d = dragging; dragging = null;
    if (d.mode === "aim" && aim && aim.p > 0.06) { const fwd = Math.sin(aim.a) * (state.turn === "p1" ? -1 : 1); if (fwd < 0.05) { toast("Shoot towards the board, not backwards."); aim = null; draw(); return; } const shot = { x: striker, a: aim.a, p: aim.p }; aim = null; shoot(shot); }
    else { aim = null; draw(); }
  };
  cv.addEventListener("pointerup", release); cv.addEventListener("pointercancel", release);
  root.addEventListener("click", (e) => { const s = e.target.closest("[data-seat]"); if (s) conn.seat(s.dataset.seat); if (e.target.closest("[data-leave]")) conn.leaveSeat(); });
  root.querySelector("#cnew").onclick = () => { if (confirm("Start a new game for everyone?")) conn.reset(); };
  addEventListener("resize", () => draw());
  api.on("hello", (m) => { seats = m.seats || {}; const last = [...m.ops].reverse().find((o) => o.type === "state"); state = last ? last.state : initial(); ui(); draw(); maybeAi(); });
  api.on("op", (m) => {
    const op = m.op;
    if (op.by === me.id && !op.ai) return; // my own shots are already on screen
    if (op.ai && owner) return;            // the AI runs in the owner's browser
    if (op.type === "shot" && op.shotNo === state.shotNo && !anim) { striker = op.x; playShot(op, state, () => { draw(); }); }
    if (op.type === "state") { const go = () => { state = op.state; striker = 500; ui(); draw(); }; if (anim) { const wait = setInterval(() => { if (!anim) { clearInterval(wait); go(); } }, 50); } else go(); }
  });
  api.on("seats", (m) => { seats = m.seats; ui(); });
  api.on("reset", (m) => { state = initial(); striker = 500; anim = null; busy = false; ui(); draw(); toast(`${m.by} started a new game.`); });
  ui(); draw();
}
