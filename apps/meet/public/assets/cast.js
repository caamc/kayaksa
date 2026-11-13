// Cast receiver: shows a code, waits until someone signed in sends a meeting, then joins it as a screen.
const $ = (id) => document.getElementById(id);
let cur = null, timer = null;
async function fresh() {
  clearInterval(timer);
  try {
    const r = await fetch("/api/cast/new", { method: "POST" }); const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Try again in a moment.");
    cur = j; $("code").textContent = j.code.replace(/(\d{3})(\d{3})/, "$1 $2");
    const until = Date.now() + (j.expiresIn - 30) * 1000;
    timer = setInterval(async () => {
      if (Date.now() > until) return fresh();
      const w = await fetch("/api/cast/wait", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: cur.code, secret: cur.secret }) }).then((x) => x.json()).catch(() => null);
      if (w?.link) { clearInterval(timer); $("h").textContent = w.title || "Joining…"; $("p").textContent = "Joining the meeting…"; location.href = w.link; }
      else if (w?.error === "expired") fresh();
    }, 2500);
  } catch (e) { $("code").textContent = "------"; $("p").textContent = e.message; setTimeout(fresh, 15000); }
}
fresh();
