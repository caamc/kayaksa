const q = new URLSearchParams(location.search);
const back = q.get("back") || "";
if (q.get("crashed")) { document.getElementById("h").textContent = "Something went wrong"; document.getElementById("p").textContent = "The page stopped unexpectedly. Reload to continue where you were."; }
const go = () => window.kayakUi.retry(back);
document.getElementById("retry").onclick = go;
window.addEventListener("online", go);
let n = 15;
setInterval(() => { n -= 1; document.getElementById("s").textContent = navigator.onLine ? `Retrying in ${n}s` : "Waiting for a connection…"; if (n <= 0) { n = 15; if (navigator.onLine) go(); } }, 1000);
