import { $, $$, api, esc, html, ico, toast, dialog, copyText, fmtDateTime } from "/_shared/js/ui.js";

// Confluence studio, part of Kayak AI. Kayak AI drafts each issue on its own after the 25th;
// people review and edit; only the SuperAdmin can release it to www.kayaksa.com.
const ST = { drafting: ["Kayak AI is drafting", "warn"], draft: ["Draft, ready for review", "accent"], submitted: ["Waiting for approval", "warn"], released: ["Released", "ok"], withdrawn: ["Withdrawn", ""] };
const STEP = (s) => s.replace("research:", "Research · ").replace("write:", "Write · ").replace("spotlight", "Spotlight on a Kayak solution").replace("assemble", "Cover, editor's note and agenda");

export async function render(main, ctx) {
  if (ctx.rest[0]) return detail(main, ctx.rest[0]);
  main.innerHTML = String(html`<div class="page"><div class="row muted"><span class="spinner"></span> Loading…</div></div>`);
  const r = await api("/api/confluence");
  const dueExists = r.editions.some((e) => e.id === r.due);
  main.innerHTML = `<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Kayak AI · Studio</span><h1>Confluence</h1>
      <p class="lead">Kayak AI drafts each monthly issue on its own after the 25th: research with sources, Kayak's perspectives on fictional scenarios, and a spotlight on one Kayak solution. Nothing reaches www.kayaksa.com until the SuperAdmin releases it.</p></div>
      ${dueExists ? "" : `<button class="btn ${r.early ? "btn-ghost" : "btn-primary"}" id="draft" ${r.ai ? "" : "disabled"}>${ico("spark")} Draft ${esc(r.duePeriod.month)} now</button>`}</div>
    <div class="note">Next issue: <b>${esc(r.duePeriod.month)}</b>, covering ${esc(r.duePeriod.period)}. ${dueExists ? "" : r.early ? `Kayak AI starts drafting it automatically on 26 ${esc(r.duePeriod.period.split("– ")[1].split(" ").slice(1, 2)[0])}, once the period has closed.` : "Kayak AI has not started it yet; it starts on the next daily run, or you can start it now."} Spotlight rotation: ${r.rotation.map(esc).join(" → ")}.${r.ai ? "" : " <b>Claude is not configured, so drafting cannot run.</b>"}</div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Issue</th><th>Status</th><th>Spotlight</th><th>Updated</th><th></th></tr></thead><tbody>
    ${r.editions.map((e) => `<tr><td><b>${esc(e.id)}</b></td><td><span class="badge ${ST[e.status]?.[1] || ""}">${esc(ST[e.status]?.[0] || e.status)}</span>${e.released_at ? `<br><span class="small faint">${fmtDateTime(e.released_at)}${e.approved_by ? " · " + esc(e.approved_by) : ""}</span>` : ""}</td><td>${esc(e.spotlight_tool || "—")}</td><td class="small">${e.updated_at ? fmtDateTime(e.updated_at) : ""}</td>
      <td class="nowrap">${e.builtIn || e.status === "released" ? `<a class="btn btn-ghost btn-sm" href="https://www.kayaksa.com/confluence/${esc(e.id)}" target="_blank" rel="noopener">${ico("external")} Open</a>` : ""}${e.builtIn ? "" : ` <a class="btn btn-ghost btn-sm" href="#/confluence/${esc(e.id)}">Manage</a>`}</td></tr>`).join("")}
    </tbody></table></div></div>`;
  $("#draft")?.addEventListener("click", async (e) => {
    if (r.early && !(await dialog({ title: "Draft early?", body: `<p>The period for ${esc(r.duePeriod.month)} runs to ${esc(r.duePeriod.period.split("– ")[1])}. Drafting now will miss anything that happens after today. You can redraft later.</p>`, actions: [{ id: "c", label: "Cancel" }, { id: "go", label: "Draft anyway", kind: "primary" }] }) === "go")) return;
    e.target.disabled = true;
    try { const x = await api("/api/confluence", { body: { id: r.due } }); location.hash = `#/confluence/${x.id}`; } catch (x) { toast(x.message, "err"); e.target.disabled = false; }
  });
}

async function detail(main, id) {
  const r = await api(`/api/confluence/${id}`);
  const E = r.data;
  const pipe = r.pipeline;
  const left = pipe ? pipe.steps.filter((s) => !pipe.done.includes(s)) : [];
  main.innerHTML = `<div class="page">
    <a class="small" href="#/confluence">${ico("chevron")} Confluence</a>
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">${esc(r.period.month)} · covering ${esc(r.period.period)}</span><h1>${esc(E?.coverTitle || "Drafting…")}</h1>
      <span class="badge ${ST[r.status]?.[1] || ""}" style="justify-self:start">${esc(ST[r.status]?.[0] || r.status)}</span></div>
      <div class="row wrap-row">${E ? `<a class="btn btn-ghost" href="${esc(r.previewUrl)}" target="_blank" rel="noopener">${ico("eye")} Preview the magazine</a>` : ""}</div></div>

    ${r.status === "drafting" ? `<div class="card stack-sm"><h3>Kayak AI is drafting</h3>
      <p class="small muted">Each step researches or writes one part of the issue, with sources. The schedule continues on its own every day; you can also run the remaining steps now and watch.</p>
      <ol class="steps-plain">${pipe.steps.map((s) => `<li>${pipe.done.includes(s) ? "✓" : s === left[0] ? "▶" : "·"} ${esc(STEP(s))}</li>`).join("")}</ol>
      ${pipe.error ? `<div class="note danger">Last attempt stopped: ${esc(pipe.error)}</div>` : ""}
      <div class="row"><button class="btn btn-primary" id="run">${ico("play")} Run the remaining ${left.length} steps now</button><span class="small muted" id="runst" aria-live="polite"></span></div></div>` : ""}

    ${E ? `<div class="card stack-sm"><h3>Editorial checks</h3>${r.checks.length ? `<ul>${r.checks.map((c) => `<li class="small">${esc(c)}</li>`).join("")}</ul>` : `<p class="small">${ico("check")} Sources on every story, scenarios use the Relativity Index cast, spotlight disclosure present, no investment-advice or counterfeiting language.</p>`}
      <p class="small muted">Checks catch common problems; they do not replace a careful read. Verify every fact against its source before release.</p></div>

    <div class="card stack-sm"><h3>Contents</h3><ol class="steps-plain">${E.stories.map((s) => `<li><b>${esc(s.section)}</b> · ${esc(s.title)} <span class="small faint">(${(s.sources || []).length} sources)</span></li>`).join("")}${E.spotlight ? `<li><b>Spotlight</b> · ${esc(E.spotlight.tool)}</li>` : ""}</ol></div>

    <div class="card stack-sm"><h3>Edit</h3>
      <div class="field"><label for="ct">Cover title</label><input class="input" id="ct" value="${esc(E.coverTitle)}" maxlength="40"></div>
      <div class="field"><label for="cd">Cover line</label><input class="input" id="cd" value="${esc(E.coverDek)}" maxlength="200"></div>
      <details><summary class="small">Edit the whole issue (JSON)</summary><textarea class="input" id="js" rows="18" spellcheck="false" style="font-family:var(--mono);font-size:.8rem;width:100%;margin-top:8px">${esc(JSON.stringify(E, null, 2))}</textarea></details>
      <div class="row"><button class="btn btn-primary" id="save" ${r.status === "released" ? "disabled" : ""}>Save changes</button></div></div>` : ""}

    <div class="card stack-sm"><h3>Approval and release</h3>
      <p class="small muted">Release publishes the issue on www.kayaksa.com, makes it the home-page Confluence slide, and can email Confluence subscribers from advisory@kayaksa.com. Only the SuperAdmin can release.</p>
      <div class="row wrap-row">
        ${r.status === "draft" ? `<button class="btn btn-ghost" id="submit">${ico("send")} Send to the SuperAdmin for approval</button>` : ""}
        ${r.canRelease && ["draft", "submitted"].includes(r.status) ? `<button class="btn btn-primary" id="release">${ico("check")} Approve and release</button>` : ""}
        ${r.canRelease && r.status === "released" ? `<button class="btn btn-ghost" id="withdraw">Withdraw from the website</button>` : ""}
        ${r.status !== "released" ? `<button class="btn btn-quiet" id="redraft">Redraft from scratch</button>` : ""}
        <button class="btn btn-quiet" id="newlink">New preview link</button></div>
      ${!r.canRelease && r.status !== "released" ? `<p class="small">Waiting for the SuperAdmin to approve. You'll see the status change here.</p>` : ""}</div>

    <div class="card stack-sm"><h3>History</h3>${r.history.map((h) => `<p class="small">${fmtDateTime(h.at)} · ${esc(h.by)} · ${esc(h.action)}${h.note ? ` · <span class="muted">${esc(h.note)}</span>` : ""}</p>`).join("")}</div>
  </div>`;

  $("#run")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    for (;;) {
      $("#runst").textContent = "Working… this takes a minute or two per step.";
      let x;
      try { x = await api(`/api/confluence/${id}/step`, { method: "POST" }); } catch (err) { toast(err.message, "err"); break; }
      if (x.pipe?.error) { toast(x.pipe.error, "err"); break; }
      if (x.status !== "drafting") { toast("The draft is ready for review."); break; }
      $("#runst").textContent = `${x.pipe.done.length} of ${x.pipe.steps.length} steps done.`;
    }
    detail(main, id);
  });
  $("#save")?.addEventListener("click", async () => {
    let data;
    try { data = JSON.parse($("#js").value); } catch { return toast("The JSON has a syntax error. Fix it, or close the JSON editor and edit the cover fields.", "err"); }
    data.coverTitle = $("#ct").value.trim(); data.coverDek = $("#cd").value.trim();
    try { const x = await api(`/api/confluence/${id}`, { method: "PUT", body: { data } }); toast(x.checks.length ? `Saved. ${x.checks.length} check(s) to look at.` : "Saved. All checks pass."); detail(main, id); } catch (err) { toast(err.message, "err"); }
  });
  $("#submit")?.addEventListener("click", async () => { await api(`/api/confluence/${id}/submit`, { method: "POST" }); toast("Sent to the SuperAdmin for approval."); detail(main, id); });
  $("#release")?.addEventListener("click", () => dialog({
    title: `Release Confluence, ${r.period.month}?`,
    body: `<p>This publishes the issue on www.kayaksa.com and makes it the Confluence slide on the home page.</p>
      ${r.checks.length ? `<div class="note warn small">${r.checks.length} editorial check(s) are still open.</div>` : ""}
      <label class="row small"><input type="checkbox" id="em"> Also email Confluence subscribers from advisory@kayaksa.com</label>
      <div class="field"><label for="cf">Type RELEASE to confirm</label><input class="input" id="cf" autocomplete="off"></div>`,
    actions: [{ id: "c", label: "Cancel" }, { id: "go", label: "Release", kind: "primary", handler: async (d) => {
      const x = await api(`/api/confluence/${id}/release`, { body: { confirm: $("#cf", d).value.trim(), email: $("#em", d).checked } });
      toast(`Released.${x.emailed ? ` Emailed ${x.emailed} subscribers.` : ""}`); detail(main, id);
    } }],
  }));
  $("#withdraw")?.addEventListener("click", async () => { await api(`/api/confluence/${id}/withdraw`, { method: "POST" }); toast("Withdrawn. It is no longer on the website."); detail(main, id); });
  $("#redraft")?.addEventListener("click", async () => { await api(`/api/confluence/${id}/restart`, { method: "POST" }); detail(main, id); });
  $("#newlink")?.addEventListener("click", async () => { const x = await api(`/api/confluence/${id}/preview-link`, { method: "POST" }); copyText(x.previewUrl); toast("New preview link copied. The old one no longer works."); });
}
