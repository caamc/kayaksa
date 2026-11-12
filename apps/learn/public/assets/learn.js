import { $, $$, api, esc, html, ico, wordmark, toast, dialog, setBusy, initTheme, toggleTheme, confirmDialog } from "/_shared/js/ui.js";
import { renderLearn } from "/_shared/js/learn-ui.js";

initTheme();
let STATE = { signedIn: false, user: null, mail: false };
let CAT_PRICING = null;
const main = $("#main");

$("#logo").innerHTML = `<img src="/_shared/logos/KayakLearn_Logo_FullColour.svg" alt="Kayak Learn" class="kl-logo kl-light"><img src="/_shared/logos/KayakLearn_Logo_Reversed.svg" alt="" aria-hidden="true" class="kl-logo kl-dark">`;

async function refreshState() {
  STATE = await api("/api/auth/state", { authRedirect: false }).catch(() => STATE);
  const a = $("#acts");
  a.innerHTML = `<button class="btn btn-quiet btn-sm" id="theme" aria-label="Switch light or dark">${ico("moon")}</button>` +
    (STATE.signedIn
      ? `<a class="btn btn-ghost btn-sm" href="#/purchases">${ico("briefcase")} <span>My learning</span></a><a class="btn btn-ghost btn-sm" href="#/certificates">${ico("award")} <span>Certificates</span></a><a class="btn btn-quiet btn-sm" href="#/account" aria-label="My account">${ico("settings")}</a>`
      : `<button class="btn btn-ghost btn-sm" data-auth="in">Sign in</button><button class="btn btn-primary btn-sm" data-auth="up">Create account</button>`);
  $("#theme").onclick = () => { const t = toggleTheme(); $("#theme").innerHTML = String(ico(t === "dark" ? "sun" : "moon")); };
  $$("[data-auth]", a).forEach((b) => (b.onclick = () => authDialog(b.dataset.auth)));
}

const field = (id, label, type = "text", extra = "") => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" name="${id}" type="${type}" ${extra}></div>`;

function authDialog(mode = "in") {
  const body = mode === "up"
    ? `<form id="af" class="stack-sm auth-dlg" novalidate>
        <p class="muted">Your account holds your enrolments, progress, invoices and certificates.</p>
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
       <p class="small muted"><a href="#" data-sw="forgot">Forgotten your password?</a> · New here? <a href="#" data-sw="up">Create an account</a></p>`;
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
  const P = CAT_PRICING;
  return `<section class="lhero kl-intro"><div class="kl-stage" aria-hidden="true"><div class="kl-ring"></div><div class="kl-anim"></div><button class="kl-replay" type="button" aria-label="Replay the introduction">${ico("refresh")} Replay</button></div>
    <div class="stack" style="position:relative;z-index:1">
    <span class="eyebrow" style="color:#F5C46D">Kayak Learn · professional programmes</span>
    <h1>Judgement you can carry into every decision.</h1>
    <p class="serif" style="font-size:1.15rem">Rigorous courses on ethics, compliance, risk, corporate governance and responsible AI, written by advisers who do this work every day. Grounded in Indian law, aware of global standards, assessed, and certified.</p>
    ${P ? `<div class="offer"><span class="eyebrow" style="color:#F5C46D">Launch offer</span><span><s>₹${(P.listPaise / 100).toLocaleString("en-IN")}</s> <b>₹${(P.offerPaise / 100).toLocaleString("en-IN")}</b> per course <em>${Math.round((1 - P.offerPaise / P.listPaise) * 100)}% off</em></span><small>+ GST · ${P.accessMonths} months' access · certificate included</small></div>` : ""}
    <div class="row">${STATE.signedIn ? `<a class="btn btn-accent" href="#/purchases">${ico("briefcase")} My learning</a>` : `<a class="btn btn-accent" href="#/path/compliance-india">Explore Compliance Essentials</a><button class="btn btn-ghost" style="color:#fff;border-color:rgba(255,255,255,.4)" data-auth="up">Create account</button>`}</div>
    <div class="stats"><div><b>5</b><span>Learning paths</span></div><div><b>15</b><span>Courses</span></div><div><b>14</b><span>Awareness bytes</span></div><div><b>100%</b><span>Verifiable certificates</span></div></div></div></section>`;
};

function privacyPage() {
  main.innerHTML = `<div class="page"><article class="prose stack-sm"><span class="eyebrow">Privacy notice</span><h1>How Kayak Learn uses your data</h1>
  <p>This notice is given under the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025. The data fiduciary is <b>Kayak Strategic Advisors Private Limited</b>, Mumbai.</p>
  <h2>What we collect</h2><p>Your name, email address, optional organisation, a protected (hashed) password, the lessons you complete, your assessment scores and the certificates issued to you. We record sign-in times and the network address used, to keep accounts secure. We use no advertising or tracking cookies; a single sign-in cookie keeps you signed in.</p>
  <h2>Why</h2><p>To provide Kayak Learn, save your progress, issue certificates in your name and let others verify them, keep the service secure, and reply to you. We do not sell your data or use it for advertising.</p>
  <h2>Payments</h2><p>When you enrol, we keep the billing details you give us (name, organisation, GSTIN, address and state) and the order, and issue a GST invoice. Payments are processed by Razorpay Software Private Limited, a payment aggregator authorised by the Reserve Bank of India; card, UPI and bank details go directly to Razorpay and never reach Kayak. Invoices and order records are kept for eight years, as GST and tax law require.</p>
  <h2>Who can see it</h2><p>Kayak staff who run the service. Anyone who has a certificate ID can see the holder's name, the course title and the date, which is how verification works. Our infrastructure provider (Cloudflare) and, if email is switched on, our email provider process data on our behalf under contract.</p>
  <h2>How long we keep it</h2><p>For as long as you keep your account (orders and invoices: eight years, as tax law requires). If you delete your account we erase your profile, progress and certificates straight away, except security logs, which are kept for up to one year.</p>
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


// ---------------------------------------------------------------- enrolment and checkout
const inr = (p) => "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
let RZP = null;
const loadRzp = () => RZP || (RZP = new Promise((ok, no) => { const x = document.createElement("script"); x.src = "https://checkout.razorpay.com/v1/checkout.js"; x.onload = ok; x.onerror = () => { RZP = null; no(new Error("The payment window could not load. Check your connection and try again.")); }; document.head.append(x); }));

async function enrol(kind, id) {
  if (!STATE.signedIn) { toast("Create an account or sign in first. It takes a minute.", "ok", 5000); return authDialog("up"); }
  const p = CAT_PRICING?.items[`${kind}:${id}`];
  if (!p) return toast("This is not on sale.", "err");
  const states = CAT_PRICING.states;
  const gst = CAT_PRICING.gstRate;
  const sum = (state) => { const g = Math.round(p.offer * gst); const intra = state === "Maharashtra";
    return `<table class="table sum"><tbody><tr><td>${esc(p.title)}</td><td class="num"><s class="faint">${inr(p.list)}</s> ${inr(p.offer)}</td></tr>
      ${intra ? `<tr><td>CGST 9%</td><td class="num">${inr(Math.round(g / 2))}</td></tr><tr><td>SGST 9%</td><td class="num">${inr(g - Math.round(g / 2))}</td></tr>` : `<tr><td>IGST 18%</td><td class="num">${inr(g)}</td></tr>`}
      <tr class="tot"><td>Total</td><td class="num">${inr(p.offer + g)}</td></tr></tbody></table><p class="small ok-text">You save ${inr(p.saving)} (${p.discountPct}%) with the launch offer.</p>`; };
  dialog({
    title: `Enrol: ${p.title}`,
    body: `<form id="ef" class="stack-sm" novalidate>
      <div id="sum">${sum("Maharashtra")}</div>
      ${field("bn", "Name for the invoice", "text", `autocomplete="name" required maxlength="100" value="${esc(STATE.user?.name || "")}"`)}
      <div class="field"><label for="bs">State (place of supply)</label><select class="input" id="bs" required>${states.map((x) => `<option${x === "Maharashtra" ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
      <details><summary class="small">Billing a company? Add GSTIN for input tax credit</summary><div class="stack-sm" style="margin-top:10px">
        ${field("bo", "Registered business name", "text", 'autocomplete="organization" maxlength="160"')}
        ${field("bg", "GSTIN", "text", 'maxlength="15" style="text-transform:uppercase" placeholder="27ABCDE1234F1Z5"')}
        ${field("ba", "Billing address", "text", 'autocomplete="street-address" maxlength="300"')}</div></details>
      <label class="row small" style="align-items:flex-start;flex-wrap:nowrap"><input type="checkbox" id="bt" style="margin-top:3px"> <span>I accept the <a href="#/terms" target="_blank" rel="noopener">terms of sale and refund policy</a>.</span></label>
      <p class="error" id="ee" role="alert" hidden></p></form>
      <p class="small faint">${ico("lock")} Payment is handled by Razorpay. Kayak never sees your card, UPI or bank details.</p>`,
    actions: [{ id: "c", label: "Cancel" }, { id: "go", label: "Continue to payment", kind: "primary", handler: async (d) => {
      const err = $("#ee", d); err.hidden = true;
      try {
        const r = await api("/api/pay/order", { body: { kind, id, name: $("#bn", d).value.trim(), state: $("#bs", d).value, org: $("#bo", d).value.trim(), gstin: $("#bg", d).value.trim(), address: $("#ba", d).value.trim(), terms: $("#bt", d).checked } });
        if (r.mode === "request") { toast("Order received. We will email you a secure payment link within one working day.", "ok", 9000); location.hash = "#/purchases"; return; }
        await loadRzp();
        const rz = new window.Razorpay({
          key: r.keyId, order_id: r.gatewayOrderId, amount: r.amount, currency: "INR", name: "Kayak Learn", description: r.title,
          image: location.origin + "/_shared/logos/KayakLearn_Icon.svg", prefill: { name: r.name, email: r.email }, theme: { color: "#0E2F3C" },
          handler: async (res) => {
            try { const v = await api("/api/pay/verify", { body: res }); toast(`You're enrolled. Invoice ${v.invoice}.`, "ok", 8000); location.hash = `#/${v.kind}/${v.ref}`; route(); }
            catch (x) { toast(x.message, "err", 12000); }
          },
          modal: { ondismiss: () => toast("Payment not completed. You can try again at any time.") },
        });
        rz.on("payment.failed", (e) => toast(e?.error?.description || "The payment did not go through.", "err", 8000));
        rz.open();
      } catch (e) { err.textContent = e.message; err.hidden = false; return false; }
    } }],
    onOpen: (d) => { $("#bs", d).onchange = (e) => ($("#sum", d).innerHTML = sum(e.target.value)); $("#ef", d).addEventListener("submit", (e) => { e.preventDefault(); $("[data-a=go]", d).click(); }); },
  });
}
document.addEventListener("click", (e) => { const b = e.target.closest?.("[data-enrol]"); if (!b) return; e.preventDefault(); const [k, i] = b.dataset.enrol.split(":"); enrol(k, i); });

async function purchasesPage() {
  if (!STATE.signedIn) { main.innerHTML = `<div class="page"><div class="empty stack" style="align-items:center"><p>Sign in to see your courses and invoices.</p><button class="btn btn-primary" data-auth="in">Sign in</button></div></div>`; $$("[data-auth]", main).forEach((b) => (b.onclick = () => authDialog(b.dataset.auth))); return; }
  const [{ orders, enrolments }, cat] = await Promise.all([api("/api/pay/orders"), api("/api/learn/catalog")]);
  const ST = { paid: ["Paid", "ok"], requested: ["Awaiting payment", "warn"], failed: ["Payment failed", "danger"], refunded: ["Refunded", ""], cancelled: ["Cancelled", ""] };
  main.innerHTML = `<div class="page"><div class="stack-sm"><span class="eyebrow">My learning</span><h1>Your courses and invoices</h1></div>
    ${enrolments.length ? `<div class="grid wide">${enrolments.map((e) => { const c = cat.courses.find((x) => x.id === e.course_id); return c ? `<a class="course-card" href="#/course/${esc(c.id)}"><span class="band-top" style="background:${esc((cat.topics.find((t) => t.id === c.topic) || {}).color || "#17807E")}"></span><div class="body"><h3>${esc(c.title)}</h3><p class="small muted">${esc(c.summary)}</p><span class="small faint" style="margin-top:auto">Access until ${new Date(e.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div></a>` : ""; }).join("")}</div>`
      : `<div class="empty stack" style="align-items:center"><p>You are not enrolled in a course yet.</p><a class="btn btn-accent" href="#/">Browse the courses</a></div>`}
    <section class="stack"><h2>Orders and invoices</h2>${orders.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Item</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>${orders.map((o) => `<tr><td>${new Date(o.created_at).toLocaleDateString("en-IN")}</td><td><b>${esc(o.title)}</b><br><span class="small faint">${esc(o.id)}</span></td><td class="num">${inr(o.total_paise)}</td><td><span class="badge ${ST[o.status]?.[1] || ""}">${ST[o.status]?.[0] || esc(o.status)}</span></td><td><a class="btn btn-ghost btn-sm" href="/invoice/${esc(o.id)}" target="_blank" rel="noopener">${ico("file")} ${o.status === "paid" ? "Invoice" : "Pro forma"}</a></td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No orders yet.</p>`}
    <p class="small muted">Questions about a payment or invoice? Write to learn@kayaksa.com with your order number.</p></section></div>`;
}

function termsPage() {
  const P = CAT_PRICING;
  main.innerHTML = `<div class="page"><article class="prose stack-sm"><span class="eyebrow">Terms of sale</span><h1>Kayak Learn terms of sale and refund policy</h1>
  <p>Kayak Learn is offered by <b>Kayak Strategic Advisors Private Limited</b>, A/2, 314, Shah &amp; Nahar Industrial Estate, Delisle Road, Mumbai 400013, Maharashtra, India ("Kayak"). These terms apply when you buy a course or learning path.</p>
  <h2>Prices</h2><p>Each course has a list price of ${P ? inr(P.listPaise) : "₹15,000"}. During the launch offer it costs ${P ? inr(P.offerPaise) : "₹10,000"} (${P ? Math.round((1 - P.offerPaise / P.listPaise) * 100) : 33}% off). A learning path costs the sum of its courses. GST at 18% is added and shown before you pay: CGST and SGST for Maharashtra, IGST elsewhere. The total you see at checkout is the total you pay; there are no other charges.</p>
  <h2>Honest pricing</h2><p>We follow the Consumer Protection Act, 2019, the Consumer Protection (E-Commerce) Rules, 2020, the Central Consumer Protection Authority's Guidelines for Prevention of Misleading Advertisements, 2022 and its Guidelines for Prevention and Regulation of Dark Patterns, 2023. In practice:</p>
  <ul><li><b>A genuine reference price.</b> ${P ? inr(P.listPaise) : "₹15,000"} is the standard price at which Kayak Learn offers each course. The crossed-out figure is that price, not an invented one, and the ${P ? Math.round((1 - P.offerPaise / P.listPaise) * 100) : 33}% saving is measured from it.</li>
  <li><b>No hidden or added charges.</b> The full amount, with GST shown separately, appears before you pay. Nothing is added at a later step.</li>
  <li><b>No pressure tactics.</b> No countdown timers, fake scarcity or claims that "only a few seats are left".</li>
  <li><b>Nothing pre-selected.</b> You buy only what you choose. There are no pre-ticked extras or automatic renewals.</li>
  <li><b>Easy to leave.</b> Cancelling or asking for a refund is a single email, and deleting your account is a button in My account.</li>
  <li><b>Changes are announced.</b> If the launch offer ends or prices change, the new price applies only to purchases made after the change is published on this page.</li></ul>
  <h2>What you get</h2><p>Online access to every lesson, the assessment and the awareness-bytes library for ${P ? P.accessMonths : 12} months from payment, and a certificate of participation, which stays verifiable after access ends, when you complete every lesson and pass the assessment. A certificate of participation is not a professional qualification.</p>
  <h2>Delivery</h2><p>Courses are delivered online. Access starts as soon as payment is confirmed, usually within a minute, under My learning, and we email you a confirmation. Nothing is shipped. If access has not started within 24 hours of a successful payment, write to learn@kayaksa.com and we will fix it or refund you in full.</p>
  <h2>Payment</h2><p>Payments are processed securely by Razorpay (card, UPI, net banking and wallets). Kayak never sees your payment details. Your GST invoice is available under My learning as soon as payment is confirmed. Businesses can add a GSTIN at checkout to claim input tax credit.</p>
  <h2>Cancellation and refunds</h2><p>You may cancel within <b>7 days</b> of payment for a full refund if you have completed no more than one lesson and no certificate has been issued. Write to learn@kayaksa.com with your order number. Approved refunds go back to the original payment method within 7 working days. After 7 days, or once more of the course has been used, fees are not refundable, except where the law requires otherwise or Kayak cannot provide the course.</p>
  <h2>Fair use</h2><p>Accounts are personal. Do not share sign-ins, copy or republish course material, or use automated tools to download it. Kayak may suspend access for misuse after telling you why.</p>
  <h2>Grievances</h2><p>If something goes wrong, write to our Grievance Officer at <b>learn@kayaksa.com</b> with "Grievance" in the subject. We acknowledge within 48 hours and resolve within one month, as the Consumer Protection (E-Commerce) Rules, 2020 require. You may also approach the National Consumer Helpline (1915).</p>
  <h2>General</h2><p>Courses are for professional awareness and are not legal advice. These terms are governed by the laws of India, and the courts at Mumbai have jurisdiction, without affecting your rights as a consumer.</p>
  <p class="small muted">Last updated November 2026.</p></article></div>`;
}

let LOGO_SVG = null;
async function armIntro() {
  const st = $(".kl-intro");
  if (!st) return;
  try { LOGO_SVG ||= await (await fetch("/_shared/logos/KayakLearn_Logo_Reversed.svg")).text(); $(".kl-anim", st).innerHTML = LOGO_SVG.replace(/<title>.*?<\/title>/, ""); } catch {}
  const play = () => { st.classList.remove("play"); void st.offsetWidth; st.classList.add("play"); };
  $(".kl-replay", st)?.addEventListener("click", play);
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) play(); else st.classList.add("still");
}

let tok = 0;
async function route() {
  const t = ++tok;
  const h = location.hash.replace(/^#\/?/, "");
  const [p, q = ""] = h.split("?");
  const parts = p.split("/").filter(Boolean);
  $$(".lnav a").forEach((a) => a.removeAttribute("aria-current"));
  try {
    if (!CAT_PRICING) CAT_PRICING = (await api("/api/learn/catalog").catch(() => ({}))).pricing || null;
    if (parts[0] === "privacy") { privacyPage(); document.title = "Privacy notice · Kayak Learn"; }
    else if (parts[0] === "terms") { termsPage(); document.title = "Terms of sale and refunds · Kayak Learn"; }
    else if (parts[0] === "purchases") { await purchasesPage(); document.title = "My learning · Kayak Learn"; }
    else if (parts[0] === "account") { await accountPage(); document.title = "My account · Kayak Learn"; }
    else if (parts[0] === "confirm" || parts[0] === "reset") await tokenPage(parts[0], new URLSearchParams(q).get("t") || "");
    else {
      await renderLearn(main, parts, { base: "#", apiBase: "/api/learn", internal: false, signIn: () => authDialog("in"), hero: parts.length ? "" : hero() });
      if (t !== tok) return;
      $$("[data-auth]", main).forEach((b) => (b.onclick = () => authDialog(b.dataset.auth)));
      if (!parts.length) armIntro();
      const h1 = $("h1", main)?.textContent?.trim();
      document.title = parts.length && h1 ? `${h1} · Kayak Learn` : "Kayak Learn · Professional courses on ethics, compliance, risk, governance and AI";
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

// Cookieless page statistics: one count per page view, no cookies or identifiers.
{
  let last = "";
  const send = (b) => { try { navigator.sendBeacon("/api/a", JSON.stringify(b)); } catch {} };
  const view = () => {
    const p = "/" + (location.hash.replace(/^#\/?/, "").split("?")[0] || "");
    if (p === last) return; last = p;
    send({ t: "pv", p, r: document.referrer && !document.referrer.startsWith(location.origin) ? new URL(document.referrer).hostname : "", w: innerWidth });
  };
  view(); window.addEventListener("hashchange", view);
  try {
    new PerformanceObserver((l) => { const e = l.getEntries().at(-1); if (e) send({ t: "cwv", p: last, lcp: Math.round(e.startTime) }); }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {}
}
