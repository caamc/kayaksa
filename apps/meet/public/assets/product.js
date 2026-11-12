// Product page interactions for meet.kayaksa.com. Served locally (the Meet CSP allows scripts from
// 'self' only). Progressive enhancement: the page is fully readable with this script blocked.

// Announcement bar: dismiss and remember.
(() => {
  const bar = document.getElementById("announce");
  if (!bar) return;
  try { if (localStorage.getItem("km:announce") === bar.dataset.v) bar.hidden = true; } catch {}
  bar.querySelector("[data-x]")?.addEventListener("click", () => { bar.hidden = true; try { localStorage.setItem("km:announce", bar.dataset.v); } catch {} });
})();

// Mobile navigation.
(() => {
  const btn = document.getElementById("navToggle"), nav = document.getElementById("navLinks");
  if (!btn || !nav) return;
  btn.addEventListener("click", () => { const open = nav.classList.toggle("open"); btn.setAttribute("aria-expanded", open); });
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); } });
})();

// Use-case tabs.
(() => {
  const tabs = document.querySelectorAll("[data-tab]");
  if (!tabs.length) return;
  const panels = document.querySelectorAll("[data-panel]");
  const show = (id) => {
    tabs.forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === id));
    panels.forEach((p) => (p.hidden = p.dataset.panel !== id));
  };
  tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.tab)));
  tabs.forEach((t, i) => t.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    tabs[n].focus(); show(tabs[n].dataset.tab);
  }));
})();

// Scroll-reveal: fade sections in as they enter the viewport (respects reduced motion).
(() => {
  const els = document.querySelectorAll(".reveal");
  if (!els.length || !("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    els.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  els.forEach((el) => io.observe(el));
})();

// Count-up for the stat band.
(() => {
  const nums = document.querySelectorAll("[data-count]");
  if (!nums.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const run = (el) => {
    const target = parseFloat(el.dataset.count), suffix = el.dataset.suffix || "", dur = 900, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), v = Math.round(target * (1 - Math.pow(1 - k, 3)));
      el.textContent = v + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!("IntersectionObserver" in window)) { nums.forEach(run); return; }
  const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }, { threshold: 0.6 });
  nums.forEach((n) => io.observe(n));
})();

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Mega menus: click on any device, hover on desktop pointers; Escape or an outside click closes.
(() => {
  const menus = [...document.querySelectorAll(".mm")];
  if (!menus.length) return;
  const hover = matchMedia("(hover: hover) and (min-width: 901px)");
  const close = (except) => menus.forEach((m) => { if (m === except) return; m.querySelector(".mm-btn").setAttribute("aria-expanded", "false"); m.querySelector(".mm-panel").hidden = true; m.classList.remove("open"); });
  const open = (m) => { close(m); m.querySelector(".mm-btn").setAttribute("aria-expanded", "true"); m.querySelector(".mm-panel").hidden = false; m.classList.add("open"); };
  menus.forEach((m) => {
    const btn = m.querySelector(".mm-btn");
    btn.addEventListener("click", (e) => { e.stopPropagation(); m.classList.contains("open") ? close() : open(m); });
    let t;
    m.addEventListener("mouseenter", () => { if (!hover.matches) return; clearTimeout(t); open(m); });
    m.addEventListener("mouseleave", () => { if (!hover.matches) return; t = setTimeout(() => close(), 160); });
    m.querySelector(".mm-panel").addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".mm")) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
})();

// A set of videos shown one at a time, each played to its end and then the next, with a progress bar
// per step (hero and the "better conversations" switcher). Pauses when off screen.
function rotator(root, { onShow } = {}) {
  if (!root) return;
  const vids = [...root.querySelectorAll("video[data-k]")];
  const steps = [...root.querySelectorAll("[data-go]")];
  let i = 0, visible = false, raf = 0;
  const bar = (k, f) => { const b = steps.find((s) => s.dataset.go === k)?.querySelector("i b, .sw-bar b"); if (b) b.style[b.parentElement.classList.contains("sw-bar") ? "height" : "width"] = (f * 100).toFixed(1) + "%"; };
  const show = (n, play = true) => {
    i = (n + vids.length) % vids.length;
    vids.forEach((v, j) => { v.classList.toggle("on", j === i); if (j !== i) { v.pause(); try { v.currentTime = 0; } catch {} } });
    steps.forEach((s) => { const on = s.dataset.go === vids[i].dataset.k; s.setAttribute("aria-selected", on); s.classList.toggle("on", on); if (!on) bar(s.dataset.go, 0); });
    onShow?.(vids[i].dataset.k);
    const v = vids[i];
    if (v.preload === "none") v.preload = "auto";
    // Warm the next one up so the switch is instant.
    const nx = vids[(i + 1) % vids.length]; if (nx.preload === "none") nx.preload = "metadata";
    if (play && visible && !REDUCED) v.play().catch(() => {});
  };
  vids.forEach((v, j) => v.addEventListener("ended", () => { if (j === i) show(i + 1); }));
  steps.forEach((s) => s.addEventListener("click", () => show(vids.findIndex((v) => v.dataset.k === s.dataset.go))));
  const tick = () => { const v = vids[i]; if (v && v.duration) bar(v.dataset.k, REDUCED ? 1 : v.currentTime / v.duration); raf = requestAnimationFrame(tick); };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) { if (!REDUCED) vids[i].play().catch(() => {}); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
    else { vids[i].pause(); cancelAnimationFrame(raf); }
  }, { threshold: 0.25 });
  io.observe(root);
  show(0, false);
}
// Hero: the headline word changes with the video.
rotator(document.querySelector(".hero-stage"), {
  onShow: (k) => document.querySelectorAll(".rot-w").forEach((w) => w.classList.toggle("on", w.dataset.for === k)),
});
rotator(document.getElementById("switcher"));

// Single looping videos elsewhere: load and play only while on screen.
(() => {
  const vids = document.querySelectorAll("video[data-lazy]");
  if (!vids.length || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) { if (v.preload === "none") v.preload = "auto"; if (!REDUCED) v.play().catch(() => {}); }
      else v.pause();
    }
  }, { threshold: 0.2 });
  vids.forEach((v) => { v.removeAttribute("autoplay"); io.observe(v); });
})();
