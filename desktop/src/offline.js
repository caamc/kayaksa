const q = new URLSearchParams(location.search);
const back = q.get("back") || "";
const $ = (id) => document.getElementById(id);
if (q.get("crashed")) {
  document.body.classList.add("crashed");
  $("h").textContent = "Something went wrong";
  $("p").textContent = "The page stopped unexpectedly. Reload to carry on where you were. Your meetings and messages are safe on Kayak's servers.";
  $("retry").textContent = "Reload";
}
const go = () => window.kayakUi.retry(back);
$("retry").onclick = go;
$("settings").onclick = () => window.kayakUi.openSettings?.();
addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
addEventListener("online", go);
let n = 15;
setInterval(() => {
  n -= 1;
  const on = navigator.onLine;
  $("s").classList.toggle("on", on);
  $("s").textContent = on ? `Connected. Retrying in ${Math.max(n, 0)}s` : "Waiting for a connection…";
  if (n <= 0) { n = 15; if (on) go(); }
}, 1000);
