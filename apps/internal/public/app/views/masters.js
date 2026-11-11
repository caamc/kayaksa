// People Masters: five registers of personal and business data, built for the DPDP Act, 2023.
import { $, $$, api, esc, html, raw, ico, toast, dialog, confirmDialog, fmtDate, fmtDateTime } from "/_shared/js/ui.js";

const ORDER = ["employee", "partner", "director", "client", "distributor"];

export async function render(main, ctx) {
  const meta = await api("/api/people/meta");
  const kind = ORDER.includes(ctx.rest[0]) ? ctx.rest[0] : "employee";
  const R = meta.registers[kind];
  const canEdit = ctx.me.can.admin;
  main.innerHTML = String(html`<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">HR and administration</span><h1>People Masters</h1><p class="lead">Five registers of the people and organisations Kayak works with. Sensitive personal data is sealed, masked everywhere, and revealed only to administrators with a recorded reason.</p></div>
      ${canEdit ? html`<button class="btn btn-primary" id="add">${ico("plus")} Add ${R.one === "employee" ? "an" : "a"} ${R.one}</button>` : ""}</div>
    <nav class="chips" aria-label="Registers">${ORDER.map((k) => raw(`<a class="chip${k === kind ? " on" : ""}" href="#/masters/${k}">${esc(meta.registers[k].label)}</a>`))}</nav>
    ${meta.keyReady ? "" : html`<div class="note warn">The personal-data key is created on the next deploy. Until then, records with sealed fields cannot be saved.</div>`}
    <section class="card flat stack-sm dpdp"><div class="row between"><b>${R.label}: data-protection summary</b><span class="badge">${meta.notice}</span></div>
      <div class="form-grid small"><div><div class="label">Purpose</div><div class="muted">${R.purpose}</div></div><div><div class="label">Lawful basis</div><div class="muted">${R.basis}</div></div><div><div class="label">Retention</div><div class="muted">${R.retain}</div></div><div><div class="label">Sealed fields</div><div class="muted">${R.fields.filter((f) => f.s).map((f) => f.l).join(", ") || "None"}</div></div></div></section>
    <div class="toolbar"><label class="search"><span class="sr-only">Search</span>${ico("search")}<input class="input" id="q" placeholder="Search by name, entity or detail"></label></div>
    <div id="list"><div class="row muted"><span class="spinner"></span> Loading…</div></div></div>`);

  let rows = [];
  try { rows = (await api(`/api/people/masters/${kind}`)).rows; }
  catch (e) { $("#list").innerHTML = String(html`<div class="note danger">${e.message}</div>`); return; }
  const cols = R.fields.filter((f) => !f.s && f.t !== "textarea").slice(0, 4);
  const draw = (q = "") => {
    const L = rows.filter((r) => !q || [r.name, r.entity, ...Object.values(r.data)].join(" ").toLowerCase().includes(q.toLowerCase()));
    $("#list").innerHTML = L.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Entity</th>${cols.map((f) => `<th>${esc(f.l)}</th>`).join("")}<th>Status</th><th></th></tr></thead><tbody>${L.map((r) => `<tr>
      <td><b>${esc(r.name)}</b>${r.has_sealed ? ` <span class="badge" title="Has sealed personal data">${ico("lock")}</span>` : ""}</td><td>${esc(r.entity)}</td>
      ${cols.map((f) => `<td class="small">${esc(f.t === "date" ? fmtDate(r.data[f.k]) : r.data[f.k] || "—")}</td>`).join("")}
      <td><span class="badge ${r.status === "active" ? "ok" : ""}">${esc(r.status)}</span></td>
      <td>${ctx.me.can.edit ? `<button class="btn btn-quiet btn-sm" data-open="${esc(r.id)}" aria-label="Open ${esc(r.name)}">${ico("eye")}</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty">${rows.length ? "Nothing matches." : `No ${R.label.toLowerCase()} yet.${canEdit ? " Add the first one." : ""}`}</div>`;
    $$("[data-open]").forEach((b) => (b.onclick = () => open(b.dataset.open)));
  };
  $("#q").oninput = (e) => draw(e.target.value);
  $("#add")?.addEventListener("click", () => edit({ data: {}, masked: {} }));
  draw();

  async function open(id) {
    const r = await api(`/api/people/masters/${kind}/${id}`);
    const val = (f) => (f.s ? (r.masked[f.k] ? `<span class="mono">${esc(r.masked[f.k])}</span>${ctx.me.can.admin ? ` <button class="btn btn-quiet btn-sm" data-reveal="${f.k}">Reveal</button>` : ""}` : "—") : esc(f.t === "date" ? fmtDate(r.data[f.k]) : r.data[f.k] || "—"));
    dialog({
      title: r.name, wide: true,
      body: `<div class="form-grid">${[["Entity", r.entity], ["Status", r.status]].map(([k, v]) => `<div><div class="label">${k}</div><div class="muted">${esc(v)}</div></div>`).join("")}
        ${R.fields.map((f) => `<div${f.t === "textarea" ? ' style="grid-column:1/-1"' : ""}><div class="label">${esc(f.l)}${f.s ? ` ${ico("lock")}` : ""}</div><div class="muted" data-f="${f.k}" style="word-break:break-word;white-space:pre-wrap">${val(f)}</div></div>`).join("")}</div>
        <p class="small faint">Lawful basis: ${esc(r.lawful_basis)} · Notice ${esc(r.notice_version || "—")}${r.consent_at ? ` given ${fmtDate(r.consent_at)}` : ""} · Retain until ${esc(r.retention_until ? fmtDate(r.retention_until) : R.retain)} · Updated ${fmtDateTime(r.updated_at)}</p>`,
      onOpen: (d) => $$("[data-reveal]", d).forEach((b) => (b.onclick = async () => {
        const reason = await askReason("Why do you need to see this?");
        if (!reason) return;
        try { const { fields } = await api(`/api/people/masters/${kind}/${id}/reveal`, { body: { field: b.dataset.reveal, reason } }); $(`[data-f="${b.dataset.reveal}"]`, d).textContent = fields[b.dataset.reveal] || "—"; toast("Shown. This view is recorded in the audit log."); }
        catch (e) { toast(e.message, "err"); }
      })),
      actions: [...(ctx.me.role === "superadmin" ? [{ id: "del", label: "Erase", kind: "danger", handler: async () => {
        const reason = await askReason("Why is this record being erased? (for example: retention period ended, or an erasure request)");
        if (!reason) return false;
        if (!(await confirmDialog("Erase this record?", `${r.name} and all sealed data will be permanently deleted. This cannot be undone.`, "Erase", true))) return false;
        await api(`/api/people/masters/${kind}/${id}/delete`, { body: { reason } }); toast("Erased."); render(main, ctx);
      } }] : []), ...(canEdit ? [{ id: "e", label: "Edit", handler: () => { setTimeout(() => edit(r)); } }] : []), { id: "ok", label: "Close", kind: "primary" }],
    });
  }

  function askReason(q) {
    return new Promise((res) => dialog({ title: "Reason", body: `<div class="field"><label for="rsn">${esc(q)}</label><input class="input" id="rsn" minlength="8" maxlength="200"></div>`, actions: [{ id: "c", label: "Cancel", handler: () => res(null) }, { id: "s", label: "Continue", kind: "primary", handler: (d) => { const v = d.querySelector("#rsn").value.trim(); if (v.length < 8) { toast("Give a short reason (at least 8 characters).", "err"); return false; } res(v); } }] }));
  }

  function edit(r) {
    const input = (f) => {
      const v = f.s ? "" : r.data[f.k] || "";
      const ph = f.s && r.masked?.[f.k] ? `Saved (${r.masked[f.k]}). Leave blank to keep.` : f.hint || "";
      const a = `name="${f.k}" ${f.req ? "required" : ""} placeholder="${esc(ph)}" ${f.s ? 'autocomplete="off"' : ""}`;
      if (f.t === "select") return `<select class="select" ${a}><option value="">—</option>${f.o.map((o) => `<option${v === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
      if (f.t === "textarea") return `<textarea class="textarea" ${a}>${esc(v)}</textarea>`;
      return `<input class="input" type="${f.t || "text"}" ${a} value="${esc(v)}">`;
    };
    dialog({
      title: r.id ? `Edit ${r.name}` : `Add ${R.one === "employee" ? "an" : "a"} ${R.one}`, wide: true,
      body: `<form class="form-grid" id="mf" autocomplete="off">
        <div class="field" style="grid-column:1/-1"><label>Full legal name</label><input class="input" name="__name" required value="${esc(r.name || "")}"></div>
        <div class="field"><label>Entity</label><select class="select" name="__entity">${meta.entities.map((e) => `<option${(r.entity || "KSA") === e ? " selected" : ""}>${esc(e)}</option>`).join("")}</select></div>
        <div class="field"><label>Status</label><select class="select" name="__status">${["active", "inactive", "exited"].map((s) => `<option${(r.status || "active") === s ? " selected" : ""}>${s}</option>`).join("")}</select></div>
        ${R.fields.map((f) => `<div class="field"${f.t === "textarea" ? ' style="grid-column:1/-1"' : ""}><label>${esc(f.l)}${f.s ? ` ${ico("lock")}` : ""}${f.req ? " *" : ""}</label>${input(f)}${f.hint && !f.s ? `<span class="small faint">${esc(f.hint)}</span>` : ""}</div>`).join("")}
        <div class="field"><label>Retain until</label><input class="input" type="date" name="__retention" value="${esc(r.retention_until || "")}"></div>
        ${kind === "employee" ? `<label class="check"><input type="checkbox" name="__wishes"${r.wishes === 0 ? "" : " checked"}> Send birthday and work-anniversary wishes</label>` : ""}
        <label class="check" style="grid-column:1/-1"><input type="checkbox" name="__notice"${r.consent_at ? " checked disabled" : ""}> The privacy notice (${meta.notice}) has been given to this person${R.basis.startsWith("Contract") || R.basis.includes("consent") ? ", and they have agreed" : ""}.</label>
        <p class="small muted" style="grid-column:1/-1">${ico("lock")} ${esc(meta.piiNote)} Keep only the last four digits of an Aadhaar number. Collect only what the purpose above needs.</p></form>`,
      actions: [{ id: "c", label: "Cancel" }, { id: "s", label: "Save", kind: "primary", handler: async (d) => {
        const fd = Object.fromEntries(new FormData(d.querySelector("#mf")));
        const data = {};
        for (const f of R.fields) { const v = fd[f.k] ?? ""; data[f.k] = f.s && !v && r.masked?.[f.k] ? "__keep__" : v; }
        await api(`/api/people/masters/${kind}`, { body: { id: r.id, name: fd.__name, entity: fd.__entity, status: fd.__status, retention_until: fd.__retention, wishes: kind === "employee" ? !!fd.__wishes : true, notice_given: !!fd.__notice, data } });
        toast("Saved."); render(main, ctx);
      } }],
    });
  }
}
