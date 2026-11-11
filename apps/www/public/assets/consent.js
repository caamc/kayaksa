// Kay's behaviour-based consent. Instead of a banner on arrival, Kay asks for one purpose at a time,
// at the moment it becomes useful, in plain words (DPDP Act, 2023: consent that is free, specific,
// informed, unconditional and unambiguous, by a clear affirmative action, and as easy to withdraw).
//
// - At most one question per visit; a "No" is respected for 90 days for that purpose.
// - Browsers that send Global Privacy Control or Do Not Track are never asked about
//   personalisation or emails.
// - Every decision is recorded against a random id kept in this browser (no name, email or IP).
// - "Privacy choices" on /legal shows every purpose with its current state and a switch.

const NOTICE = "KSA-PN-2026-11";
const DAY = 86400_000;
const L = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const S = {
  get(k, d = null) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const PURPOSES = {
  personalise: { title: "Remember my topics", what: "Kay remembers which topics you read, in this browser only, to suggest relevant insights next time. Nothing about you is sent to Kayak." },
  updates: { title: "Confluence by email", what: "Kayak sends you Confluence, the monthly magazine, by email. You confirm by email first and can unsubscribe from any issue." },
  followup: { title: "A follow-up from the team", what: "You share your name and email so a senior member of the team can reply to your question. Used only for that reply." },
};
const privacySignal = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";

function vid() {
  let v = L.get("ksa-vid");
  if (!v) { v = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36); L.set("ksa-vid", v); }
  return v;
}
export function choice(p) { return L.get(`ksa-consent-${p}`); }
export async function decide(p, granted, trigger) {
  L.set(`ksa-consent-${p}`, { granted: !!granted, at: Date.now(), notice: NOTICE });
  if (p === "personalise" && !granted) L.del("ksa-topics");
  fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vid: vid(), purpose: p, granted: !!granted, trigger, page: location.pathname }) }).catch(() => {});
}
const askable = (p) => {
  const c = choice(p);
  if (c && (c.granted || Date.now() - c.at < 90 * DAY)) return false;
  if ((p === "personalise" || p === "updates") && privacySignal()) return false;
  return !S.get("ksa-asked");
};

// ------------------------------------------------------------ behaviour
const topicOf = (path, data) => {
  const id = path.replace(/^\//, "").split(/[/?#]/)[0];
  const c = data.clusters.find((x) => x.id === id || path.includes(x.id));
  if (c) return c.short || c.name;
  const a = data.articles.find((x) => path.includes(x.id));
  if (a && a.cluster) return data.clusters.find((x) => x.id === a.cluster)?.short;
  return null;
};

export function mountConsent({ data }) {
  const visit = S.get("ksa-visit", { pages: 0, reads: [], since: Date.now() });
  const visits = L.get("ksa-visits", 0) + (S.get("ksa-counted") ? 0 : 1);
  if (!S.get("ksa-counted")) { L.set("ksa-visits", visits); S.set("ksa-counted", 1); }
  let timer = null;

  const onRoute = () => {
    clearTimeout(timer);
    const path = location.pathname;
    visit.pages++;
    const t = topicOf(path, data);
    if (t) visit.reads.push(t);
    S.set("ksa-visit", visit);
    if (t && choice("personalise")?.granted) {
      const topics = L.get("ksa-topics", {}); topics[t] = (topics[t] || 0) + 1; L.set("ksa-topics", topics);
    }
    // Someone reading several pieces on the same subject: offer to remember topics.
    const counts = visit.reads.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2 && visit.pages >= 3 && askable("personalise")) return later(8000, () => ask("personalise", "reading-pattern", `You've been reading about <b>${esc(top[0])}</b>. Shall I remember your topics, in this browser only, so I can point you to what's new on them next time?`));
    // A returning reader of Confluence: offer the monthly email.
    if (/^\/confluence|^\/insights/.test(path) && (visits >= 2 || visit.pages >= 4) && askable("updates")) return later(45000, () => ask("updates", visits >= 2 ? "returning-reader" : "long-read", "Would you like Confluence in your inbox on the first Tuesday of each month? One email a month, and you can stop at any time."));
    // Long time on a service page, or a visit to Contact without writing: offer a follow-up.
    if (/^\/(services|solutions|industries|contact)/.test(path) && askable("followup")) return later(/contact/.test(path) ? 40000 : 90000, () => ask("followup", /contact/.test(path) ? "contact-page" : "service-dwell", "Is there a question I can pass to the team? If you share your name and email, a senior member of the team will reply within one working day."));
  };
  const later = (ms, fn) => { timer = setTimeout(() => { if (document.visibilityState === "visible" && !document.querySelector("#kay.open, .kay-hand, dialog[open]")) fn(); }, ms); };

  function ask(p, trigger, text) {
    if (!askable(p)) return;
    S.set("ksa-asked", 1);
    const nudge = document.querySelector(".kay-nudge"); if (nudge) nudge.hidden = true; // one voice at a time
    const box = document.createElement("div");
    box.className = "kay-ask"; box.setAttribute("role", "dialog"); box.setAttribute("aria-live", "polite"); box.setAttribute("aria-label", "Kay asks");
    box.innerHTML = `<span class="kay-ask-av" aria-hidden="true"><img src="/assets/kay-120.webp" alt="" width="40" height="40"></span>
      <div><span class="kay-ask-h">Kay asks</span><p>${text}</p><p class="kay-ask-fine">${esc(PURPOSES[p].what)} <a href="/legal#choices">Privacy choices</a></p>
      <div class="kay-ask-row"><button type="button" class="kay-chip strong" data-yes>${p === "followup" ? "Yes, write to the team" : p === "updates" ? "Yes, send it" : "Yes, remember"}</button><button type="button" class="kay-chip" data-no>No, thanks</button></div></div>`;
    document.body.append(box);
    const done = () => { box.classList.add("out"); setTimeout(() => box.remove(), 300); };
    box.querySelector("[data-no]").onclick = () => { decide(p, false, trigger); done(); };
    box.querySelector("[data-yes]").onclick = async () => {
      if (p === "personalise") { decide(p, true, trigger); const topics = {}; for (const t of visit.reads) topics[t] = (topics[t] || 0) + 1; L.set("ksa-topics", topics); box.querySelector("div").innerHTML = "<b>Done.</b><p>I'll keep your topics in this browser. You can switch this off in Privacy choices at any time.</p>"; setTimeout(done, 3500); return; }
      if (p === "followup") { decide(p, true, trigger); done(); document.dispatchEvent(new CustomEvent("kay:handoff")); return; }
      // updates: collect the email here, with its own confirmation by email (double opt-in).
      box.querySelector(".kay-ask-row").outerHTML = `<form class="kay-ask-form"><label class="sr" for="kay-ask-email">Your email</label><input id="kay-ask-email" type="email" required autocomplete="email" placeholder="you@company.com"><button class="kay-chip strong">Subscribe</button></form><p class="kay-ask-err" role="alert" hidden></p>`;
      const f = box.querySelector("form"); f.querySelector("input").focus();
      f.onsubmit = async (e) => {
        e.preventDefault();
        const r = await fetch("/api/forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "subscribe", source: "kay", t: Date.now() - 10000, fields: { email: f.querySelector("input").value, consent: true } }) }).catch(() => null);
        const d = await r?.json().catch(() => ({}));
        if (!r?.ok) { const er = box.querySelector(".kay-ask-err"); er.textContent = d?.error || "That did not go through. Try again."; er.hidden = false; return; }
        decide(p, true, trigger);
        box.querySelector("div").innerHTML = `<b>Thank you.</b><p>${esc(d.message || "You're on the list.")}</p>`; setTimeout(done, 5000);
      };
    };
  }

  addEventListener("kayak:route", onRoute);
  onRoute();
}

/** The switches on /legal#choices. */
export function renderChoices(el) {
  if (!el) return;
  const draw = () => {
    el.innerHTML = Object.entries(PURPOSES).map(([k, p]) => {
      const c = choice(k);
      return `<div class="pc-row"><div><b>${esc(p.title)}</b><p>${esc(p.what)}</p><p class="pc-state">${c ? `${c.granted ? "On" : "Off"} since ${new Date(c.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "Not asked yet"}</p></div>
        <label class="pc-switch"><input type="checkbox" data-p="${k}" ${c?.granted ? "checked" : ""} ${k === "followup" || k === "updates" ? (c?.granted ? "" : "disabled") : ""}><span class="sr">${esc(p.title)}</span><i aria-hidden="true"></i></label></div>`;
    }).join("") + `<p class="pc-fine">Turning "Confluence by email" off here stops Kay asking again; to stop the emails themselves, use the unsubscribe link in any issue. Notice version ${NOTICE}.</p>`;
    el.querySelectorAll("[data-p]").forEach((i) => (i.onchange = () => { decide(i.dataset.p, i.checked, "privacy-choices"); draw(); }));
  };
  draw();
}
