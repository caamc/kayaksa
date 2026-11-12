// Sign-in and client invitation for Meet by Kayak.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const card = $("#card");
const INTERNAL = location.hostname.endsWith("kayaksa.com") ? "https://internal.kayaksa.com" : "http://localhost:8702";
const api = async (path, body) => {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "Something went wrong. Try again."), j);
  return j;
};
const ERRORS = {
  sso: "That sign-in link didn't work or was already used. Try again.",
  disabled: "Your access to Meet by Kayak has been turned off. Contact your Kayak administrator.",
};

// Keep the one-time token out of the address bar, history and screenshots; survive a reload in this tab.
const m = location.pathname.match(/^\/join\/([A-Za-z0-9_-]{20,})$/);
let invite = m ? m[1] : null;
if (m) { try { sessionStorage.setItem("km:inv", invite); } catch {} history.replaceState(null, "", "/join"); }
else if (location.pathname === "/join") { try { invite = sessionStorage.getItem("km:inv"); } catch {} }
invite ? startInvite(invite) : signIn();

// ------------------------------------------------------------------ sign in
function signIn() {
  const q = new URLSearchParams(location.search);
  const next = q.get("next") && /^\/[a-z0-9#/_-]*$/i.test(q.get("next")) ? q.get("next") : "";
  let tab = (() => { try { return localStorage.getItem("km:who") || "team"; } catch { return "team"; } })();
  const draw = (error = ERRORS[q.get("e")] || "") => {
    card.innerHTML = `
      <h2>Sign in to Meet by Kayak</h2>
      <div class="au-tabs" role="tablist" aria-label="Who are you?">
        <button role="tab" data-t="team" aria-selected="${tab === "team"}">Kayak team</button>
        <button role="tab" data-t="client" aria-selected="${tab === "client"}">Client</button>
      </div>
      ${error ? `<div class="au-err" role="alert">${esc(error)}</div>` : ""}
      ${tab === "team" ? `
        <p>Use your Kayak Internal account. Your password and two-factor check happen there, then you come straight back.</p>
        <a class="au-sso" href="${INTERNAL}/sso/meet${next ? `?next=${encodeURIComponent(next)}` : ""}"><img src="/_shared/logos/KSA_Identifier_Reversed.svg" alt="">Continue with Kayak Internal</a>
        <p class="au-note">Joining as a guest for a single meeting? Just open the invitation link you were sent. No account is needed.</p>`
      : `
        <p>Enter your email and the 6-digit code from the authenticator app you set up when you accepted your invitation.</p>
        <form id="f" class="au-card" style="gap:14px" novalidate>
          <div class="au-field"><label for="em">Email</label><input id="em" type="email" autocomplete="username" required value="${esc((() => { try { return localStorage.getItem("km:email") || ""; } catch { return ""; } })())}"></div>
          <div class="au-field"><label for="cd">Authenticator code</label><input id="cd" class="au-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="••••••"></div>
          <button class="mk-btn t au-full" id="go">Sign in</button>
        </form>
        <p class="au-note">New here? Your Kayak contact sends you an invitation. Lost your phone or authenticator? Ask your Kayak contact to reset your access; they'll send you a fresh link.</p>`}`;
    card.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { tab = b.dataset.t; try { localStorage.setItem("km:who", tab); } catch {} draw(""); }));
    const f = $("#f");
    if (f) {
      ($("#em").value ? $("#cd") : $("#em")).focus();
      $("#cd").oninput = (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); if (e.target.value.length === 6 && $("#em").value) f.requestSubmit(); };
      f.onsubmit = async (e) => {
        e.preventDefault();
        const email = $("#em").value.trim(), code = $("#cd").value.trim();
        if (!email || code.length !== 6) return draw("Enter your email and the 6-digit code.");
        $("#go").disabled = true; $("#go").textContent = "Signing in…";
        try {
          const r = await api("/api/auth/login", { email, code });
          try { localStorage.setItem("km:email", email); } catch {}
          location.href = next || r.next;
        } catch (err) {
          if (err.sso) { tab = "team"; return draw(err.message); }
          draw(err.message);
        }
      };
    }
  };
  draw();
}

// ------------------------------------------------------------------ accept an invitation (clients)
async function startInvite(token) {
  let info;
  try { info = await api("/api/auth/invite/check", { token }); }
  catch (e) {
    card.innerHTML = `<h2>This invitation can't be used</h2><div class="au-err" role="alert">${esc(e.message)}</div><a class="mk-btn o" href="/login">Go to sign-in</a>`;
    return;
  }
  // Step 1: who you are and the privacy notice.
  card.innerHTML = `
    <div class="au-steps"><b>1 · Privacy</b><span>2 · Secure sign-in</span></div>
    <h2>Welcome${info.org ? `, ${esc(info.org)}` : ""}</h2>
    <p>Kayak Strategic Advisors has invited <b>${esc(info.email)}</b> to Meet by Kayak, a private workspace for your engagement with Kayak.</p>
    <div class="au-field"><label for="nm">Your name, as colleagues should see it</label><input id="nm" autocomplete="name" maxlength="80" value="${esc(info.name)}"></div>
    <div class="au-notice" tabindex="0" aria-label="Privacy notice">
      <h3>What we collect</h3><p>Your name, email and organisation; what you post (messages, files, tasks); meeting attendance; and security logs (time, IP address, browser) of sign-ins and actions.</p>
      <h3>Why</h3><p>To run this workspace for your engagement with Kayak, keep it secure, and meet our legal duties. We do not sell your data, advertise to you, or use your content to train AI models.</p>
      <h3>Kayak AI</h3><p>Summaries, captions and translations are produced on Kayak's own cloud platform (Cloudflare Workers AI) only when someone asks for them. Meetings are recorded or transcribed only with a notice on everyone's screen.</p>
      <h3>Who can see it</h3><p>Only the people in each conversation. Other clients never see you or your conversations. Our service providers (Cloudflare, for hosting) process data for us under contract.</p>
      <h3>How long</h3><p>For the engagement and as long afterwards as the law requires Kayak to keep its records. Security logs are kept for one year.</p>
      <h3>Your rights</h3><p>You can download a copy of your data at any time from your profile, ask us to correct or erase it, and withdraw consent by closing your account (Profile → Close my account). Write to enquiries@kayaksa.com with "Privacy" in the subject; we reply within 30 days. You may also complain to the Data Protection Board of India. Under India's Digital Personal Data Protection Act, 2023 and, where it applies, the GDPR and the UAE Personal Data Protection Law.</p>
      <p><a href="https://www.kayaksa.com/legal#privacy" target="_blank" rel="noopener">Full privacy notice</a> · Notice version ${esc(info.notice)}</p>
    </div>
    <label class="au-check"><input type="checkbox" id="ok"> I have read the privacy notice and agree to Kayak using my personal data as described, for my engagement with Kayak.</label>
    <button class="mk-btn t au-full" id="next">Continue</button>`;
  $("#next").onclick = () => {
    if (!$("#ok").checked) { $("#ok").focus(); return; }
    step2(token, info, $("#nm").value.trim() || info.name);
  };
}

function step2(token, info, name, error = "") {
  const qr = (() => { try { const q = qrcode(0, "M"); q.addData(info.uri); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch { return ""; } })();
  card.innerHTML = `
    <div class="au-steps"><span>1 · Privacy</span><b>2 · Secure sign-in</b></div>
    <h2>Set up your authenticator</h2>
    <p>Every sign-in needs a code from an authenticator app on your phone: Microsoft Authenticator, Google Authenticator, 1Password or similar.</p>
    <div class="au-qr">${qr}<div style="display:grid;gap:8px"><b>Scan this code</b><span class="mk-small">Or type this key into the app:</span><span class="au-secret">${esc(info.secret.replace(/(.{4})/g, "$1 ").trim())}</span></div></div>
    ${error ? `<div class="au-err" role="alert">${esc(error)}</div>` : ""}
    <form id="f" class="au-card" style="gap:14px">
      <div class="au-field"><label for="cd">Enter the 6-digit code the app shows</label><input id="cd" class="au-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" required></div>
      <button class="mk-btn t au-full" id="go">Finish and open Meet by Kayak</button>
    </form>`;
  $("#cd").focus();
  $("#cd").oninput = (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); };
  $("#f").onsubmit = async (e) => {
    e.preventDefault();
    $("#go").disabled = true; $("#go").textContent = "Checking…";
    try {
      const r = await api("/api/auth/invite/accept", { token, code: $("#cd").value, name, accept: true });
      try { localStorage.setItem("km:email", info.email); localStorage.setItem("km:who", "client"); } catch {}
      location.href = r.next;
    } catch (err) { step2(token, info, name, err.message); }
  };
}
