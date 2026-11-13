import { $, api, esc, html, raw, ico, wordmark, toast, setBusy, initTheme, copyText } from "/_shared/js/ui.js";

initTheme();
const card = $("#card");
const params = new URLSearchParams(location.search);
const next = (() => {
  const n = params.get("next") || "";
  // Only Kayak Internal's own app, or the hand-backs to Meet by Kayak and Kayak GraphIQ (single sign-on), are allowed.
  if (/^\/sso\/meet(\?next=%2F[A-Za-z0-9%#/_-]*)?$/.test(n)) return n;
  if (/^\/sso\/graphiq(\?next=%2Fapp[A-Za-z0-9%#/_-]*)?$/.test(n)) return n;
  return n.startsWith("/app") && !n.startsWith("//") ? n : "/app";
})();

// The "Why Kayak" film plays once, muted, and holds on the logo. People who prefer reduced motion
// see the still; anyone can pause it (WCAG 2.2.2).
(() => {
  const fig = document.getElementById("film"), v = fig?.querySelector("video"), btn = document.getElementById("filmBtn");
  if (!v || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  fig.hidden = false; fig.closest(".auth-art").classList.add("film-on");
  v.play().catch(() => {});
  btn.onclick = () => { if (v.paused) { if (v.ended) v.currentTime = 0; v.play(); } else v.pause(); };
  v.onplay = () => { btn.textContent = "Pause"; btn.setAttribute("aria-label", "Pause the film"); };
  v.onpause = v.onended = () => { btn.textContent = "Play"; btn.setAttribute("aria-label", "Play the film"); };
  v.onerror = () => { fig.hidden = true; fig.closest(".auth-art").classList.remove("film-on"); };
  fig.querySelector("source:last-of-type").onerror = v.onerror;
})();
$("#art-logo").innerHTML = `<div style="color:#fff">${wordmark(30).html.replace(/var\(--logo-ink\)/g, "#FFFFFF").replace(/var\(--logo-left\)/g, "#5DB2AB")}</div>`;

const head = (step, total, title, sub) => html`
  <div class="stack-sm">
    <a class="ksa-logo" href="/login" aria-label="Kayak Internal">${wordmark(24)}<span class="sub">Internal</span></a>
  </div>
  ${total ? raw(`<div class="steps" aria-label="Step ${step} of ${total}">${Array.from({ length: total }, (_, i) => `<i class="${i < step ? "on" : ""}"></i>`).join("")}</div>`) : ""}
  <div class="stack-sm"><h2>${title}</h2>${sub ? html`<p class="muted">${sub}</p>` : ""}</div>`;

function render(h) { card.innerHTML = String(h); const f = card.querySelector("input"); f?.focus(); }

function errBox(msg) { return `<p class="error" role="alert">${esc(msg)}</p>`; }

async function submitWith(form, fn) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    form.querySelector(".error")?.remove();
    setBusy(btn, true);
    try { await fn(Object.fromEntries(new FormData(form))); }
    catch (err) { btn.insertAdjacentHTML("beforebegin", errBox(err.message)); }
    finally { setBusy(btn, false); }
  });
}

function loginView() {
  render(html`${head(0, 0, "Sign in", "Use your Kayak email and password. You will then confirm with your authenticator app.")}
  <form class="stack" id="f" novalidate>
    <div class="field"><label for="email">Work email</label><input class="input" id="email" name="email" type="email" autocomplete="username" required></div>
    <div class="field"><label for="password">Password</label><input class="input" id="password" name="password" type="password" autocomplete="current-password" required></div>
    <button class="btn btn-primary" type="submit">Continue ${ico("arrow")}</button>
  </form>
  <p class="small"><a href="/login?forgot=1" id="forgot">Forgot your password?</a></p>
  <p class="small muted">Lost your phone? Sign in with one of your recovery codes, or ask a Kayak administrator.</p>`);
  $("#forgot").onclick = (e) => { e.preventDefault(); forgotView($("#email").value); };
  submitWith($("#f"), async (v) => {
    const r = await api("/api/auth/login", { body: { email: v.email, password: v.password }, authRedirect: false });
    route(r.next);
  });
}

function forgotView(prefill = "") {
  render(html`${head(0, 0, "Reset your password", "Enter your work email. If it belongs to an active Kayak account, we will email a link to choose a new password. You will still confirm with your authenticator app.")}
  <form class="stack" id="f" novalidate>
    <div class="field"><label for="email">Work email</label><input class="input" id="email" name="email" type="email" autocomplete="username" required value="${prefill}"></div>
    <button class="btn btn-primary" type="submit">Email me a reset link</button>
  </form>
  <a class="small" href="/login">Back to sign in</a>`);
  submitWith($("#f"), async (v) => {
    const r = await api("/api/auth/forgot", { body: { email: v.email }, authRedirect: false });
    render(html`${head(0, 0, "Check your email", r.message)}
      ${r.mail ? "" : raw(`<p class="note warn small">Email sending is not switched on yet, so no link can be sent. Ask a Kayak administrator to create a reset link for you from People &amp; access.</p>`)}
      <p class="small muted">The link expires in 30 minutes. Nothing arrived? Check spam, or try again in a few minutes.</p>
      <a class="btn btn-ghost" href="/login">Back to sign in</a>`);
  });
}

function totpView(email) {
  render(html`${head(2, 2, "Enter your code", `Open your authenticator app and enter the 6-digit code for Kayak Internal${email ? ` (${email})` : ""}.`)}
  <form class="stack" id="f" novalidate>
    <div class="field"><label for="code">Authentication code</label><input class="input code" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="9" placeholder="000000" required></div>
    <button class="btn btn-primary" type="submit">Verify and sign in</button>
  </form>
  <details class="small"><summary>Use a recovery code instead</summary><p class="muted" style="margin-top:8px">Type one of the recovery codes you saved when you set up two-factor authentication (for example <code>abcd-efgh</code>) into the box above. Each code works once.</p></details>
  <button class="btn btn-quiet btn-sm" id="restart">Start again</button>`);
  submitWith($("#f"), async (v) => {
    const r = await api("/api/auth/totp", { body: { code: v.code }, authRedirect: false });
    if (r.recoveryLeft != null && r.recoveryLeft < 4) sessionStorage.setItem("ksa-recovery-warning", String(r.recoveryLeft));
    location.href = next;
  });
  $("#restart").onclick = restart;
}

async function enrolView() {
  render(html`${head(1, 2, "Set up two-factor authentication", "Every Kayak account is protected with an authenticator app. This takes about a minute.")}<div class="row"><span class="spinner"></span></div>`);
  let data;
  try { data = await api("/api/auth/enrol", { authRedirect: false }); }
  catch (e) { render(html`${head(1, 2, "Set up two-factor authentication", "")}${raw(errBox(e.message))}<button class="btn btn-ghost" id="restart">Start again</button>`); $("#restart").onclick = restart; return; }
  const qr = window.qrcode ? (() => { const q = window.qrcode(0, "M"); q.addData(data.uri); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); })() : "";
  const pretty = data.secret.match(/.{1,4}/g).join(" ");
  render(html`${head(1, 2, "Set up two-factor authentication", "")}
  <ol class="stack-sm" style="padding-left:18px;margin:0">
    <li>Install Microsoft Authenticator, Google Authenticator, 1Password or any TOTP app.</li>
    <li>Scan this code, or enter the key by hand.</li>
    <li>Type the 6-digit code the app shows.</li>
  </ol>
  <div class="row" style="align-items:flex-start;gap:18px">
    <div class="qr" style="width:176px">${raw(qr)}</div>
    <div class="stack-sm" style="min-width:0;flex:1">
      <span class="label">Set-up key</span>
      <code style="font:600 .95rem/1.5 var(--mono);word-break:break-all">${pretty}</code>
      <button class="btn btn-ghost btn-sm" id="copykey" type="button">${ico("copy")} Copy key</button>
    </div>
  </div>
  <form class="stack" id="f" novalidate>
    <div class="field"><label for="code">Code from your app</label><input class="input code" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required></div>
    <button class="btn btn-primary" type="submit">Confirm and continue</button>
  </form>`);
  $("#copykey").onclick = () => copyText(data.secret);
  submitWith($("#f"), async (v) => {
    const r = await api("/api/auth/enrol", { body: { code: v.code }, authRedirect: false });
    recoveryView(r.recoveryCodes);
  });
}

function recoveryView(codes) {
  render(html`${head(2, 2, "Save your recovery codes", "If you lose your phone, each of these codes lets you sign in once. Keep them somewhere safe, such as a password manager. You will not see them again.")}
  <div class="codes">${codes.map((c) => raw(`<span>${esc(c)}</span>`))}</div>
  <div class="row"><button class="btn btn-ghost btn-sm" id="copy">${ico("copy")} Copy codes</button><button class="btn btn-ghost btn-sm" id="dl">${ico("download")} Download</button></div>
  <label class="check"><input type="checkbox" id="saved"> I have saved my recovery codes</label>
  <button class="btn btn-primary" id="go" disabled>Go to Kayak Internal ${ico("arrow")}</button>`);
  const text = "Kayak Internal recovery codes\n\n" + codes.join("\n") + "\n\nEach code works once.";
  $("#copy").onclick = () => copyText(text);
  $("#dl").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = "kayak-recovery-codes.txt"; a.click(); };
  $("#saved").onchange = (e) => ($("#go").disabled = !e.target.checked);
  $("#go").onclick = () => (location.href = next);
}

function setupView() {
  render(html`${head(0, 2, "First-run set-up", "For the founding SuperAdmin accounts only. You need the set-up code from the GitHub deployment.")}
  <form class="stack" id="f" novalidate>
    <div class="field"><label for="email">SuperAdmin email</label><input class="input" id="email" name="email" type="email" autocomplete="username" required></div>
    <div class="field"><label for="name">Your full name</label><input class="input" id="name" name="name" autocomplete="name" required></div>
    <div class="field"><label for="token">Set-up code</label><input class="input" id="token" name="token" type="password" autocomplete="off" required></div>
    <div class="field"><label for="password">Choose a password</label><input class="input" id="password" name="password" type="password" autocomplete="new-password" minlength="12" required><span class="hint">At least 12 characters, mixing letters with numbers or symbols. A passphrase works well.</span></div>
    <button class="btn btn-primary" type="submit">Create my account</button>
  </form>
  <a class="small" href="/login">Back to sign in</a>`);
  submitWith($("#f"), async (v) => {
    const r = await api("/api/auth/setup", { body: v, authRedirect: false });
    route(r.next);
  });
}

async function welcomeView() {
  const t = params.get("t") || "";
  let info;
  try { info = await api(`/api/auth/token?t=${encodeURIComponent(t)}`, { authRedirect: false }); }
  catch (e) { render(html`${head(0, 0, "This link cannot be used", e.message)}<a class="btn btn-ghost" href="/login">Go to sign in</a>`); return; }
  const invite = info.kind === "invite";
  render(html`${head(0, 2, invite ? "Welcome to Kayak Internal" : "Choose a new password", invite ? `Set up your account for ${info.email}.` : `For ${info.email}. Your two-factor authentication stays as it is.`)}
  <form class="stack" id="f" novalidate>
    ${invite ? html`<div class="field"><label for="name">Your full name</label><input class="input" id="name" name="name" autocomplete="name" value="${info.name || ""}" required></div>` : ""}
    <div class="field"><label for="password">${invite ? "Choose a password" : "New password"}</label><input class="input" id="password" name="password" type="password" autocomplete="new-password" minlength="12" required><span class="hint">At least 12 characters, mixing letters with numbers or symbols.</span></div>
    <div class="field"><label for="password2">Type it again</label><input class="input" id="password2" name="password2" type="password" autocomplete="new-password" required></div>
    <button class="btn btn-primary" type="submit">${invite ? "Continue" : "Save password"}</button>
  </form>`);
  submitWith($("#f"), async (v) => {
    if (v.password !== v.password2) throw new Error("The two passwords do not match.");
    const r = await api("/api/auth/redeem", { body: { token: t, name: v.name, password: v.password }, authRedirect: false });
    history.replaceState(null, "", "/login");
    route(r.next);
  });
}

async function restart() { await api("/api/auth/logout", { body: {}, authRedirect: false }).catch(() => {}); loginView(); }

function route(nextStep, email) {
  if (nextStep === "totp") return totpView(email);
  if (nextStep === "enrol") return enrolView();
  location.href = next;
}

(async () => {
  const qr = document.createElement("script"); qr.src = "/vendor/qrcode.js"; document.head.append(qr);
  if (location.pathname === "/welcome") return welcomeView();
  let st = { mode: "none" };
  try { st = await api("/api/auth/state", { authRedirect: false }); } catch (e) { toast(e.message, "err"); }
  if (st.mode === "full") return (location.href = next);
  if (location.pathname === "/setup") return setupView();
  if (st.mode === "pre") return route(st.next, st.email);
  if (params.get("forgot")) return forgotView();
  loginView();
  if (st.setup) card.insertAdjacentHTML("beforeend", `<p class="small faint">Setting up Kayak Internal for the first time? <a href="/setup">First-run set-up</a></p>`);
})();
