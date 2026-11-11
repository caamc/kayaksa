import { $, $$, api, esc, html, ico, wordmark, toast, dialog, setBusy, initTheme, toggleTheme, confirmDialog } from "/_shared/js/ui.js";
import { renderLearn } from "/_shared/js/learn-ui.js";

initTheme();
let STATE = { signedIn: false, user: null, mail: false };
const main = $("#main");

$("#logo").innerHTML = `${wordmark(22)}<span class="sub">Learn</span>`;

async function refreshState() {
  STATE = await api("/api/auth/state", { authRedirect: false }).catch(() => STATE);
  const a = $("#acts");
  a.innerHTML = `<button class="btn btn-quiet btn-sm" id="theme" aria-label="Switch light or dark">${ico("moon")}</button>` +
    (STATE.signedIn
      ? `<a class="btn btn-ghost btn-sm" href="#/certificates">${ico("award")} <span>My certificates</span></a><a class="btn btn-quiet btn-sm" href="#/account" aria-label="My account">${ico("settings")}</a>`
      : `<button class="btn btn-ghost btn-sm" data-auth="in">Sign in</button><button class="btn btn-primary btn-sm" data-auth="up">Join free</button>`);
  $("#theme").onclick = () => { const t = toggleTheme(); $("#theme").innerHTML = String(ico(t === "dark" ? "sun" : "moon")); };
  $$("[data-auth]", a).forEach((b) => (b.onclick = () => authDialog(b.dataset.auth)));
}

const field = (id, label, type = "text", extra = "") => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" name="${id}" type="${type}" ${extra}></div>`;

function authDialog(mode = "in") {
  const body = mode === "up"
    ? `<form id="af" class="stack-sm auth-dlg" novalidate>
        <p class="muted">Free, and always will be. Your account saves progress and puts your name on certificates.</p>
        ${field("name", "Full name, as it should appear on certificates", "text", 'autocomplete="name" required maxlength="80"')}
        ${field("email", "Email", "email", 'autocomplete="email" required')}
        ${field("organisation", "Organisation (optional)", "text", 'autocomplete="organization" maxlength="120"')}
        ${field("password", "Password (12 characters or more)", "password", 'autocomplete="new-password" required minlength="12"')}
        <label class="row small" style="align-items:flex-start;flex-wrap:nowrap"><input type="checkbox" id="consent" style="margin-top:3px"> <span>I have read the <a href="#/privacy" target="_blank" rel="noopener">privacy notice</a> and agree that Kayak may process my name, email and learning records to provide Kayak Learn and issue certificates.</span></label>
        <p class="error" id="ae" role="alert" hidden></p></form>
       <p class="small muted">Already have an account? <a href="#" data-sw="in">Sign in</a></p>`
    : mode === "forgot"
    ? `<form id="af" class="stack-sm auth-dlg" novalidate><p class="muted">Enter your email address. If it has an account, we will send a link to choose a new password.</p>${field("email", "Email", "email", 'autocomplete="email" required')}<p class="error" id="ae" role="alert" hidden></p></form>`
    : `<form id="af" class="stack-sm auth-dlg" novalidate>
        ${field("email", "Email", "email", 'autocomplete="username" required')}
        ${field("password", "Password", "password", 'autocomplete="current-password" required')}
        <p class="error" id="ae" role="alert" hidden></p></form>
       <p class="small muted"><a href="#" data-sw="forgot">Forgotten your password?</a> · New here? <a href="#" data-sw="up">Join free</a></p>`;
  const title = mode === "up" ? "Join Kayak Learn" : mode === "forgot" ? "Reset your password" : "Sign in to Kayak Learn";
  const label = mode === "up" ? "Create my account" : mode === "forgot" ? "Send the link" : "Sign in";
  dialog({
    title, body,
    actions: [{ id: "go", label, kind: "primary", handler: async (d) => {
      const f = $("#af", d), err = $("#ae", d);
      const v = Object.fromEntries(new FormData(f));
      err.hidden = true;
      try {
        if (mode === "up") {
          const r = await api("/api/auth/signup", { body: { ...v, consent: $("#consent", d).checked }, authRedirect: false });
          toast(r.verified ? "Welcome to Kayak Learn." : "Welcome. We have emailed you a link to confirm your address.", "ok", 7000);
        } else if (mode === "forgot") {
          await api("/api/auth/forgot", { body: v, authRedirect: false });
          toast("If that email has an account, a reset link is on its way.", "ok", 7000);
          return;
        } else {
          await api("/api/auth/login", { body: v, authRedirect: false });
          toast("Signed in.");
        }
        await refreshState();
        route();
      } catch (e) { err.textContent = e.message; err.hidden = false; return false; }
    } }],
    onOpen: (d) => {
      $("input", d)?.focus();
      $$("[data-sw]", d).forEach((a) => (a.onclick = (e) => { e.preventDefault(); d.close(); d.remove(); authDialog(a.dataset.sw); }));
      $("#af", d).addEventListener("submit", (e) => { e.preventDefault(); $("[data-a=go]", d).click(); });
    },
  });
}

const hero = () => {
  return `<section class="lhero"><div class="stack" style="position:relative;z-index:1">
    <span class="eyebrow" style="color:#F5C46D">Kayak Learn · free for everyone</span>
    <h1>Judgement you can carry into every decision.</h1>
    <p class="serif" style="font-size:1.15rem">Practical courses on ethics, compliance, risk, corporate governance and responsible AI, written by advisers who do this work every day. Grounded in Indian law, aware of global standards.</p>
    <div class="row">${STATE.signedIn ? `<a class="btn btn-accent" href="#/certificates">${ico("award")} My certificates</a>` : `<button class="btn btn-accent" data-auth="up">Join free</button><a class="btn btn-ghost" style="color:#fff;border-color:rgba(255,255,255,.4)" href="#/path/compliance-india">Start with Compliance Essentials</a>`}</div>
    <div class="stats"><div><b>5</b><span>Learning paths</span></div><div><b>15</b><span>Courses</span></div><div><b>Free</b><span>Certificates</span></div></div></div>
    <svg class="mark" viewBox="0 0 92 100" aria-hidden="true"><path fill="#5DB2AB" d="M0 0 L30 0 L44 26.25 L44 59.3 Z"/><path fill="#EE9B1E" d="M92 0 L62 0 L48 26.25 L48 59.3 Z"/><path fill="#FFFFFF" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/></svg></section>`;
};

function privacyPage() {
  main.innerHTML = `<div class="page"><article class="prose stack-sm"><span class="eyebrow">Privacy notice</span><h1>How Kayak Learn uses your data</h1>
  <p>This notice is given under the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025. The data fiduciary is <b>Kayak Strategic Advisors Private Limited</b>, Mumbai.</p>
  <h2>What we collect</h2><p>Your name, email address, optional organisation, a protected (hashed) password, the lessons you complete, your assessment scores and the certificates issued to you. We record sign-in times and the network address used, to keep accounts secure. We use no advertising or tracking cookies; a single sign-in cookie keeps you signed in.</p>
  <h2>Why</h2><p>To provide Kayak Learn, save your progress, issue certificates in your name and let others verify them, keep the service secure, and reply to you. We do not sell your data or use it for advertising.</p>
  <h2>Who can see it</h2><p>Kayak staff who run the service. Anyone who has a certificate ID can see the holder's name, the course title and the date, which is how verification works. Our infrastructure provider (Cloudflare) and, if email is switched on, our email provider process data on our behalf under contract.</p>
  <h2>How long we keep it</h2><p>For as long as you keep your account. If you delete your account we erase your profile, progress and certificates straight away, except security logs, which are kept for up to one year.</p>
  <h2>Your rights</h2><p>You can see, correct and download your data, and delete your account, from <a href="#/account">My account</a> at any time. You can withdraw consent by deleting your account. For anything else, including a grievance, write to <b>learn@kayaksa.com</b>; we respond within 30 days. If you are not satisfied, you may complain to the Data Protection Board of India.</p>
  <h2>Children</h2><p>Kayak Learn is meant for adults. If you are under 18, please do not create an account.</p>
  <p class="small muted">Last updated November 2026.</p></article></div>`;
}

async function accountPage() {
  if (!STATE.signedIn) { main.innerHTML = `<div class="page"><div class="empty stack" style="align-items:center"><p>Sign in to see your account.</p><button class="btn btn-primary" data-auth="in">Sign in</button></div></div>`; $$("[data-auth]", main).forEach((b) => (b.onclick = () => authDialog(b.dataset.auth))); return; }
  const { user: u } = await api("/api/account");
  main.innerHTML = String(html`<div class="page" style="max-width:760px"><div class="stack-sm"><span class="eyebrow">My account</span><h1>${u.name}</h1><p class="muted">${u.email} · joined ${new Date(u.created_at).toLocaleDateString("en-IN")}</p></div>
    ${u.verified ? "" : html`<div class="note warn row between"><span>Confirm your email address to receive certificates.</span><button class="btn btn-ghost btn-sm" id="rs">Send the link again</button></div>`}
    <form class="card stack-sm" id="pf"><h3>Profile</h3>
      <div class="field"><label for="n">Full name (used on new certificates)</label><input class="input" id="n" name="name" value="${u.name}" maxlength="80" required></div>
      <div class="field"><label for="o">Organisation</label><input class="input" id="o" name="organisation" value="${u.organisation}" maxlength="120"></div>
      <details><summary class="small">Change password</summary><div class="stack-sm" style="margin-top:10px">
        <div class="field"><label for="cp">Current password</label><input class="input" id="cp" name="current" type="password" autocomplete="current-password"></div>
        <div class="field"><label for="np">New password</label><input class="input" id="np" name="password" type="password" autocomplete="new-password" minlength="12"></div></div></details>
      <div class="row"><button class="btn btn-primary" type="submit">Save</button></div></form>
    <div class="card stack-sm"><h3>Your data</h3><p class="small muted">Download everything Kayak Learn holds about you, or delete your account. Deleting erases your progress and certificates permanently; existing certificate IDs will no longer verify.</p>
      <div class="row"><a class="btn btn-ghost" href="/api/account/export">${ico("download")} Download my data</a><button class="btn btn-ghost" id="out">${ico("logout")} Sign out</button><button class="btn btn-danger" id="del">${ico("trash")} Delete my account</button></div></div></div>`);
  $("#rs")?.addEventListener("click", async () => { try { await api("/api/auth/resend", { body: {} }); toast("Sent. Check your inbox and spam folder."); } catch (e) { toast(e.message, "err"); } });
  $("#pf").onsubmit = async (e) => {
    e.preventDefault(); const b = e.submitter; setBusy(b, true);
    try { await api("/api/account", { body: Object.fromEntries(new FormData(e.target)) }); toast("Saved."); await refreshState(); }
    catch (err) { toast(err.message, "err"); } finally { setBusy(b, false); }
  };
  $("#out").onclick = async () => { await api("/api/auth/logout", { body: {} }); await refreshState(); location.hash = "#/"; };
  $("#del").onclick = () => dialog({
    title: "Delete my account", body: `<p>This permanently erases your profile, progress and certificates. It cannot be undone.</p><div class="field"><label for="dp">Enter your password to confirm</label><input class="input" id="dp" type="password" autocomplete="current-password"></div>`,
    actions: [{ id: "no", label: "Keep my account" }, { id: "yes", label: "Delete permanently", kind: "danger", handler: async (d) => {
      await api("/api/account/delete", { body: { password: $("#dp", d).value } });
      toast("Your account has been deleted."); await refreshState(); location.hash = "#/";
    } }],
  });
}

async function tokenPage(kind, token) {
  if (kind === "confirm") {
    try { await api("/api/auth/confirm", { body: { token }, authRedirect: false }); }
    catch (e) { main.innerHTML = String(html`<div class="page"><div class="note danger">${e.message}</div></div>`); return; }
    await refreshState();
    let issued = [];
    if (STATE.signedIn) issued = (await api("/api/learn/claim", { body: {} }).catch(() => ({ issued: [] }))).issued;
    main.innerHTML = `<div class="page"><div class="note ok stack-sm"><h2>Email confirmed</h2><p>${issued.length ? `We have issued ${issued.length} certificate${issued.length === 1 ? "" : "s"} you had already earned.` : "Certificates you earn will now carry your name."}</p><div class="row"><a class="btn btn-primary" href="#/${issued.length ? "certificates" : ""}">Continue</a></div></div></div>`;
    return;
  }
  main.innerHTML = `<div class="page" style="max-width:520px"><form class="card stack-sm" id="rf"><h2>Choose a new password</h2>${field("password", "New password (12 characters or more)", "password", 'autocomplete="new-password" required minlength="12"')}<button class="btn btn-primary" type="submit">Save and sign in</button></form></div>`;
  $("#rf").onsubmit = async (e) => {
    e.preventDefault(); const b = e.submitter; setBusy(b, true);
    try { await api("/api/auth/reset", { body: { token, password: e.target.password.value }, authRedirect: false }); toast("Password changed. You are signed in."); await refreshState(); location.hash = "#/"; }
    catch (err) { toast(err.message, "err"); setBusy(b, false); }
  };
}

let tok = 0;
async function route() {
  const t = ++tok;
  const h = location.hash.replace(/^#\/?/, "");
  const [p, q = ""] = h.split("?");
  const parts = p.split("/").filter(Boolean);
  $$(".lnav a").forEach((a) => a.removeAttribute("aria-current"));
  try {
    if (parts[0] === "privacy") { privacyPage(); document.title = "Privacy notice · Kayak Learn"; }
    else if (parts[0] === "account") { await accountPage(); document.title = "My account · Kayak Learn"; }
    else if (parts[0] === "confirm" || parts[0] === "reset") await tokenPage(parts[0], new URLSearchParams(q).get("t") || "");
    else {
      await renderLearn(main, parts, { base: "#", apiBase: "/api/learn", internal: false, signIn: () => authDialog("in"), hero: parts.length ? "" : hero() });
      if (t !== tok) return;
      $$("[data-auth]", main).forEach((b) => (b.onclick = () => authDialog(b.dataset.auth)));
      const h1 = $("h1", main)?.textContent?.trim();
      document.title = parts.length && h1 ? `${h1} · Kayak Learn` : "Kayak Learn · Free courses on ethics, compliance, risk, governance and AI";
      $(`.lnav a[href="#/${parts[0] === "bytes" || parts[0] === "byte" ? "bytes" : ""}"]`)?.setAttribute("aria-current", "page");
    }
    main.focus({ preventScroll: true }); window.scrollTo(0, 0);
  } catch (e) {
    main.innerHTML = String(html`<div class="page"><div class="note danger">${e.message || "This page could not load."}</div></div>`);
  }
}

window.addEventListener("hashchange", route);
await refreshState();
route();
