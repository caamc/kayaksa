// Confluence reader: turns the server-rendered pages into a book. Two-page spreads with turning
// leaves on larger screens; one page at a time on phones (or by choice). Keyboard, swipe, contents
// and deep links (#p7) all work.
(() => {
  document.documentElement.classList.add("js");
  const book = document.getElementById("book");
  const pages = [...book.querySelectorAll(".pg")];
  const N = pages.length;
  const nav = document.querySelector(".mz-nav");
  const pos = nav.querySelector(".pos");
  const seek = nav.querySelector(".seek");
  const modeBtn = document.querySelector('[data-act="mode"]');
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let pref = null;
  try { pref = localStorage.getItem("confluence:mode"); } catch {}
  let single = false, leaves = [], cur = 0, stage = null;

  const isPhone = () => innerWidth <= 820;

  function build() {
    const page = currentPage() || startPage(); // read the deep link (#p7) before anything rewrites the address
    single = isPhone() || pref === "single";
    document.body.classList.toggle("single", single);
    modeBtn.setAttribute("aria-pressed", String(single));
    modeBtn.hidden = isPhone();
    stage?.remove();
    stage = document.createElement("div");
    stage.className = "stage";
    leaves = [];
    const per = single ? 1 : 2;
    for (let i = 0; i < N; i += per) {
      const leaf = document.createElement("div");
      leaf.className = "leaf";
      const f = document.createElement("div"); f.className = "face front"; f.append(pages[i]);
      leaf.append(f);
      if (!single && pages[i + 1]) { const b = document.createElement("div"); b.className = "face back"; b.append(pages[i + 1]); leaf.append(b); }
      // Turn by clicking the outer edge of a page.
      const edge = (side) => { const e = document.createElement("button"); e.type = "button"; e.className = "edge " + side; e.tabIndex = -1; e.setAttribute("aria-hidden", "true"); return e; };
      f.append(edge("next"));
      if (single) f.append(edge("prev"));
      leaf.querySelector(".back")?.append(edge("prev"));
      leaves.push(leaf);
      stage.append(leaf);
    }
    book.append(stage);
    nav.hidden = false;
    layout();
    goPage(page, true);
  }

  function layout() {
    const r = book.getBoundingClientRect();
    const W = r.width, H = r.height;
    let pw, ph;
    if (single && isPhone()) { pw = Math.min(W - 16, 620); ph = H - 8; }
    else if (single) { ph = Math.min(H - 16, (W - 32) * 1.414); pw = ph / 1.414; }
    else { pw = Math.min((W - 48) / 2, (H - 16) / 1.414); ph = pw * 1.414; }
    stage.style.setProperty("--pw", `${Math.floor(pw)}px`);
    stage.style.setProperty("--ph", `${Math.floor(ph)}px`);
    fit();
    render();
  }

  // Like a magazine layout desk: if a page's text runs long, set it slightly smaller (to 80%) so
  // it fits; anything still longer scrolls within the page, with a soft fade as a cue.
  function fit() {
    for (const pg of pages) {
      const pi = pg.querySelector(".pi");
      pg.style.removeProperty("--u");
      pi.classList.remove("more");
      let k = single && isPhone() ? 0 : 1; // phones keep comfortable type and scroll within the page
      while (pi.scrollHeight > pi.clientHeight + 2 && k > 0.8) { k -= 0.02; pg.style.setProperty("--u", `${k.toFixed(2)}cqw`); }
      pi.classList.toggle("more", pi.scrollHeight > pi.clientHeight + 2);
      pi.onscroll = () => pi.classList.toggle("more", pi.scrollTop + pi.clientHeight < pi.scrollHeight - 4);
    }
  }

  function render() {
    const L = leaves.length;
    leaves.forEach((lf, i) => {
      const flipped = i < cur;
      lf.classList.toggle("flipped", flipped);
      lf.style.zIndex = flipped ? String(i + 1) : String(2 * L - i);
      // Separate the leaves slightly in depth so stacked pages never fight over which is on top.
      lf.style.transform = single ? (flipped ? "rotateY(-110deg)" : `translateZ(${(L - i) * 0.3}px)`) : flipped ? `rotateY(-180deg) translateZ(${-(i + 1) * 0.3}px)` : `translateZ(${(L - i) * 0.3}px)`;
      const front = lf.querySelector(".front"), back = lf.querySelector(".back");
      const showFront = i === cur, showBack = !single && i === cur - 1;
      front.inert = !showFront; front.setAttribute("aria-hidden", String(!showFront));
      if (back) { back.inert = !showBack; back.setAttribute("aria-hidden", String(!showBack)); }
    });
    if (!single) {
      const pw = parseFloat(stage.style.getPropertyValue("--pw"));
      stage.style.setProperty("--shift", cur === 0 ? `${-pw / 2}px` : cur === L ? `${pw / 2}px` : "0px");
      stage.style.setProperty("--sl", cur === 0 ? "50%" : "0");
      stage.style.setProperty("--sr", cur === L ? "50%" : "0");
    }
    const [a, b] = visible();
    const label = (n) => (n === 1 ? "Cover" : n === N ? "Back cover" : `Page ${n}`);
    pos.textContent = b && b !== a ? `Pages ${a}–${b} of ${N}` : `${label(a)} of ${N}`;
    seek.value = String(a);
    nav.querySelector(".prev").disabled = cur === 0;
    nav.querySelector(".next").disabled = cur === L - (single ? 1 : 0);
    const h = `#p${a}`;
    if (location.hash !== h) history.replaceState(null, "", a === 1 ? location.pathname : h);
    document.title = document.title.replace(/^(\(.+?\) )?/, "");
  }

  // Which pages are on screen now.
  function visible() {
    if (single) return [cur + 1];
    if (cur === 0) return [1];
    const left = cur * 2, right = left + 1;
    return right <= N ? [left, right] : [left];
  }
  const currentPage = () => (leaves.length ? visible()[0] : 0);
  function startPage() { const m = location.hash.match(/^#p(\d+)$/); return m ? Math.min(N, Math.max(1, +m[1])) : 1; }

  function goPage(n, instant) {
    const target = single ? n - 1 : Math.floor(n / 2);
    const L = leaves.length;
    const t = Math.max(0, Math.min(single ? L - 1 : L, target));
    if (instant || reduce) { leaves.forEach((l) => (l.style.transitionDuration = "0s")); cur = t; render(); requestAnimationFrame(() => leaves.forEach((l) => (l.style.transitionDuration = ""))); return; }
    // Riffle through the pages in between.
    const step = t > cur ? 1 : -1;
    const tick = () => { if (cur === t) return; turn(step); setTimeout(tick, 90); };
    tick();
  }

  function turn(step) {
    const L = leaves.length;
    const max = single ? L - 1 : L;
    const next = cur + step;
    if (next < 0 || next > max) return;
    const lf = leaves[step > 0 ? cur : cur - 1];
    lf.classList.add("turning");
    setTimeout(() => lf.classList.remove("turning"), 900);
    cur = next;
    render();
    // Bring the page being read back to its top.
    for (const n of visible()) pages[n - 1].querySelector(".pi").scrollTop = 0;
  }
  const next = () => turn(1), prev = () => turn(-1);

  // ---------------------------------------------------------------- interaction
  book.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); goPage(+go.dataset.go); return; }
    if (e.target.closest(".edge.next")) return next();
    if (e.target.closest(".edge.prev")) return prev();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input,textarea,select") || document.querySelector(".contents-dlg")) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
    else if (e.key === "Home") goPage(1);
    else if (e.key === "End") goPage(N);
  });
  let x0 = null, y0 = null;
  book.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  book.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) (dx < 0 ? next : prev)();
    x0 = null;
  }, { passive: true });
  nav.addEventListener("click", (e) => { const a = e.target.closest("[data-act]")?.dataset.act; if (a === "next") next(); if (a === "prev") prev(); });
  seek.addEventListener("change", () => goPage(+seek.value));
  modeBtn.addEventListener("click", () => { pref = single ? "double" : "single"; try { localStorage.setItem("confluence:mode", pref); } catch {} build(); });
  document.querySelector('[data-act="contents"]').addEventListener("click", contents);
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => (isPhone() !== single && pref !== "single" ? build() : layout()), 150); });
  addEventListener("hashchange", () => { const p = startPage(); if (!visible().includes(p)) goPage(p); });

  function contents() {
    const d = document.createElement("div");
    d.className = "contents-dlg";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-modal", "true");
    d.setAttribute("aria-label", "Contents");
    const seen = new Set();
    const items = pages.filter((p) => { const l = p.dataset.label.split(":")[0]; if (seen.has(l)) return false; seen.add(l); return true; });
    d.innerHTML = `<div class="panel"><button class="close" type="button">Close</button><h2>Contents</h2><ol>${items.map((p) => `<li><button class="row" type="button" data-n="${p.dataset.n}"><span>${p.dataset.label.split(":")[0].replace(/[<>&]/g, "")}</span><span>${p.dataset.n}</span></button></li>`).join("")}</ol></div>`;
    document.body.append(d);
    const close = () => { d.remove(); document.querySelector('[data-act="contents"]').focus(); };
    d.addEventListener("click", (e) => { const b = e.target.closest("[data-n]"); if (b) { close(); goPage(+b.dataset.n); } else if (e.target === d || e.target.closest(".close")) close(); });
    d.addEventListener("keydown", (e) => e.key === "Escape" && close());
    d.querySelector("[data-n]").focus();
  }

  build();
  // Webfonts change line lengths; fit again once they have loaded.
  document.fonts?.ready.then(() => { fit(); render(); });
})();
