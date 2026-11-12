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

// Notes.AI demo: cycle a few languages being "auto-detected" in the mock transcript.
(() => {
  const el = document.getElementById("naiLang");
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const langs = ["Hindi", "English", "Marathi", "Tamil", "Arabic", "Gujarati", "Bengali", "Telugu", "Kannada", "French"];
  let i = 0;
  setInterval(() => { i = (i + 1) % langs.length; el.textContent = langs[i]; }, 1600);
})();
