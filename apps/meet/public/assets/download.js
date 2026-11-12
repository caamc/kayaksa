// Puts the right installer first and shows the current version. Falls back gracefully before the first release.
const $ = (s) => document.querySelector(s);
const ua = navigator.userAgent;
const mac = /Mac OS X|Macintosh/.test(ua) && !/iPhone|iPad/.test(ua);
const win = /Windows/.test(ua);
if (mac) {
  $("#osname").textContent = "Mac";
  $("#primary").href = "/download/latest/mac"; $("#primary").textContent = "Download for Mac";
  $("#secondary").href = "/download/latest/win"; $("#secondary").textContent = "Download for Windows";
} else if (win) $("#osname").textContent = "Windows";
fetch("/download/release.json").then((r) => r.json()).then((r) => {
  if (!r.version) {
    $("#cta").innerHTML = `<a class="mk-btn p" href="/login">Use Meet by Kayak on the web</a>`;
    $("#ver").textContent = "The desktop app is being prepared for release. Until then, Meet by Kayak works fully in Chrome, Edge, Safari and Firefox.";
    return;
  }
  $("#ver").innerHTML = `Version ${String(r.version).replace(/[^\w.-]/g, "")} · released ${new Date(r.at).toLocaleDateString(undefined, { dateStyle: "medium" })}. Or <a href="/login" style="color:#fff">use it in your browser</a>.`;
}).catch(() => {});
