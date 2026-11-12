// Document Drive: identity, address, bank, KYC, KYB and KYV documents, filed by People Master,
// read by OCR and approved by a second administrator before anything reaches a master.
import { $, $$, api, esc, html, raw, ico, toast, dialog, confirmDialog, fmtDateTime } from "/_shared/js/ui.js";

const RES = { pass: ["Pass", "ok"], warn: ["Check", "warn"], fail: ["Fail", "danger"] };
const ST = { qc: ["Awaiting QC", "warn"], approved: ["Approved", "ok"], rejected: ["Rejected", "danger"], erased: ["Erased", ""] };

export async function render(main, ctx) {
  if (!ctx.me.can.admin) { main.innerHTML = String(html`<div class="page"><div class="note">The Document Drive holds sensitive personal data, so only administrators can open it.</div></div>`); return; }
  const meta = await api("/api/vault/meta");
  let sel = ctx.query.get("m") || (ctx.rest[0] === "qc" ? "qc" : "");
  main.innerHTML = String(html`<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">HR and administration</span><h1>Document Drive</h1><p class="lead">Identity, address, bank, KYC, KYB and KYV documents, filed against each People Master. OCR reads every upload, automatic checks test it, and a second administrator approves it before anything reaches a master.</p></div>
      <button class="btn btn-primary" id="up">${ico("upload")} Upload documents</button></div>
    ${meta.ready ? "" : html`<div class="note warn">Encrypted storage and the personal-data key are created on the next deploy. Uploads are disabled until then.</div>`}
    ${meta.ocr ? "" : html`<div class="note warn">Kayak AI is not connected, so OCR is off. Documents can still be filed and their details entered by hand at QC.</div>`}
    <div class="drive"><nav class="drive-tree card" id="tree"></nav><section class="drive-main" id="pane"></section></div>
    <p class="small muted">${ico("lock")} Files are encrypted before storage. Opening one needs a reason and is logged. Aadhaar is kept only as a masked copy; card images are never kept, only the network, issuer, last four digits and expiry. The uploader cannot approve their own document.</p></div>`);

  async function tree() {
    const t = await api("/api/vault/tree");
    $("#tree").innerHTML = `<button class="drv-node${sel === "qc" ? " on" : ""}" data-m="qc">${ico("check")}<span>QC queue</span>${t.qcTotal ? `<b class="badge warn">${t.qcTotal}</b>` : ""}</button>
      <button class="drv-node${sel === "" ? " on" : ""}" data-m="">${ico("folder")}<span>Unfiled</span>${t.unfiled ? `<b class="badge">${t.unfiled}</b>` : ""}</button>
      ${t.folders.map((f) => `<details open><summary>${ico("folder")} ${esc(f.label)} <span class="faint">${f.masters.length}</span></summary>${f.masters.map((m) => `<button class="drv-node sub${sel === m.id ? " on" : ""}" data-m="${esc(m.id)}">${ico("file")}<span>${esc(m.name)}</span>${m.qc ? `<b class="badge warn">${m.qc}</b>` : m.docs ? `<b class="badge">${m.docs}</b>` : ""}</button>`).join("") || `<p class="small faint" style="margin:4px 0 8px 26px">None yet</p>`}</details>`).join("")}`;
    $$("[data-m]", main).forEach((b) => (b.onclick = () => { sel = b.dataset.m; tree(); pane(); }));
    return t;
  }

  async function pane() {
    const q = sel === "qc" ? "status=qc" : sel ? `master=${encodeURIComponent(sel)}` : "";
    const { docs } = await api(`/api/vault/docs?${q}`);
    $("#pane").innerHTML = docs.length ? `<div class="stack">${docs.map((d) => { const [sl, sk] = ST[d.status] || [d.status, ""]; const fails = d.qc.filter((x) => x.result === "fail").length, warns = d.qc.filter((x) => x.result === "warn").length; return `<article class="card stack-sm drv-doc">
      <div class="row between"><div><b>${esc(meta.types[d.doc_type]?.label || d.doc_type)}</b>${d.master_name ? ` · ${esc(d.master_name)}` : ""} <span class="badge ${sk}">${sl}</span> ${d.stored ? `<span class="badge">${ico("lock")} Encrypted file</span>` : `<span class="badge">No file kept</span>`}</div><span class="small muted">${fmtDateTime(d.created_at)} · ${esc(d.uploader || "")}</span></div>
      ${d.note ? `<p class="small" style="margin:0">${esc(d.note)}</p>` : ""}
      <div class="row small">${fails ? `<span class="badge danger">${fails} failed</span>` : ""}${warns ? `<span class="badge warn">${warns} to check</span>` : ""}${!fails && !warns && d.qc.length ? `<span class="badge ok">All checks passed</span>` : ""}${d.approver ? `<span class="muted">Approved by ${esc(d.approver)} ${fmtDateTime(d.approved_at)}</span>` : ""}</div>
      <div class="row">${d.status === "qc" ? `<button class="btn btn-primary btn-sm" data-qc="${esc(d.id)}">${ico("check")} Review and approve</button>` : ""}${d.stored ? `<button class="btn btn-ghost btn-sm" data-open="${esc(d.id)}">${ico("eye")} Open</button>` : ""}<button class="btn btn-quiet btn-sm" data-log="${esc(d.id)}">Access log</button>${ctx.me.role === "superadmin" && d.status !== "erased" ? `<button class="btn btn-quiet btn-sm" data-erase="${esc(d.id)}">${ico("trash")} Erase</button>` : ""}</div></article>`; }).join("")}</div>`
      : `<div class="empty">${sel === "qc" ? "Nothing is waiting for QC." : "No documents here yet."}</div>`;
    $$("[data-qc]", main).forEach((b) => (b.onclick = () => review(b.dataset.qc)));
    $$("[data-open]", main).forEach((b) => (b.onclick = () => open(b.dataset.open)));
    $$("[data-log]", main).forEach((b) => (b.onclick = async () => { const { log } = await api(`/api/vault/docs/${b.dataset.log}/log`); dialog({ title: "Access log", body: log.length ? `<table class="table"><tbody>${log.map((l) => `<tr><td>${fmtDateTime(l.at)}</td><td>${esc(l.name || "")}</td><td>${esc(l.action)}</td><td>${esc(l.reason)}</td></tr>`).join("")}</tbody></table>` : "<p class='muted'>Nobody has opened this document.</p>" }); }));
    $$("[data-erase]", main).forEach((b) => (b.onclick = async () => { const reason = await ask("Why is this document being erased? (for example, retention ended or an erasure request)"); if (!reason) return; if (!(await confirmDialog("Erase this document?", "The encrypted file and the extracted details are deleted for good. The record that it existed stays in the audit log.", "Erase", true))) return; await api(`/api/vault/docs/${b.dataset.erase}/delete`, { body: { reason } }); toast("Erased."); tree(); pane(); }));
  }

  function ask(q) {
    return new Promise((res) => dialog({ title: "Reason", body: `<div class="field"><label for="rsn">${esc(q)}</label><input class="input" id="rsn" maxlength="200"></div>`, actions: [{ id: "c", label: "Cancel", handler: () => res(null) }, { id: "s", label: "Continue", kind: "primary", handler: (d) => { const v = d.querySelector("#rsn").value.trim(); if (v.length < 8) { toast("Give a short reason (at least 8 characters).", "err"); return false; } res(v); } }] }));
  }

  async function open(id) {
    const reason = await ask("Why do you need to open this document?");
    if (!reason) return;
    const r = await fetch(`/api/vault/docs/${id}/open`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    if (!r.ok) { toast((await r.json().catch(() => ({}))).error || "Could not open it.", "err"); return; }
    const blob = await r.blob(), url = URL.createObjectURL(blob);
    dialog({ title: "Document", wide: true, body: blob.type === "application/pdf" ? `<iframe src="${url}" title="Document" style="width:100%;height:70vh;border:0"></iframe>` : `<img src="${url}" alt="The document" style="max-width:100%;display:block;margin:auto">`, actions: [{ id: "ok", label: "Close", kind: "primary", handler: () => { URL.revokeObjectURL(url); } }] });
  }

  async function review(id) {
    const r = await api(`/api/vault/docs/${id}/review`);
    const t = await api("/api/vault/tree");
    const opts = t.folders.map((f) => `<optgroup label="${esc(f.label)}">${f.masters.map((m) => `<option value="${esc(m.id)}"${r.doc.master_id === m.id ? " selected" : ""}>${esc(m.name)}</option>`).join("")}</optgroup>`).join("");
    dialog({
      title: `QC: ${r.type.label}`, wide: true,
      body: `<div class="stack-sm">
        ${r.mine ? `<div class="note warn">You uploaded this document, so another administrator must approve it (maker-checker).</div>` : ""}
        <table class="table"><thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead><tbody>${r.doc.qc.map((x) => `<tr><td>${esc(x.check)}</td><td><span class="badge ${RES[x.result][1]}">${RES[x.result][0]}</span></td><td class="small">${esc(x.detail)}</td></tr>`).join("") || "<tr><td colspan=3 class='muted'>No automatic checks for this type.</td></tr>"}</tbody></table>
        <form class="form-grid" id="qf">${r.type.fields.map((f) => { const c = r.confidence?.[f.k]; return `<div class="field"><label>${esc(f.l)}${f.to ? ` <span class="faint small">→ master</span>` : ""}${c != null && c < 0.8 ? ` <span class="badge warn">check</span>` : ""}</label><input class="input" name="${f.k}" value="${esc(r.fields[f.k] || "")}" autocomplete="off"></div>`; }).join("")}
          <div class="field" style="grid-column:1/-1"><label>File against</label><select class="select" name="master_id"><option value="">Create a new master record…</option>${opts}</select></div>
          <div class="field" id="nk" style="grid-column:1/-1"><label>New record in</label><select class="select" name="new_kind">${Object.entries(meta.registers).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></div></form>
        <p class="small muted">Correct anything OCR misread before approving. Fields marked "→ master" are written into the master; sensitive ones are sealed.</p></div>`,
      onOpen: (d) => { const s = d.querySelector('[name="master_id"]'), nk = d.querySelector("#nk"); const f = () => (nk.hidden = !!s.value); s.onchange = f; f(); },
      actions: [{ id: "rej", label: "Reject", kind: "danger", handler: async () => { const reason = await ask("Why is it rejected? (for example, unclear scan or wrong person)"); if (!reason) return false; await api(`/api/vault/docs/${id}/reject`, { body: { reason } }); toast("Rejected."); tree(); pane(); } },
        { id: "c", label: "Close" },
        { id: "ok", label: "Approve and update the master", kind: "primary", handler: async (d) => { const v = Object.fromEntries(new FormData(d.querySelector("#qf"))); const { master_id, new_kind, ...fields } = v; const res = await api(`/api/vault/docs/${id}/approve`, { body: { fields, master_id, new_kind } }); toast(res.applied.length ? `Approved. Updated: ${res.applied.join(", ")}.` : "Approved and filed."); sel = res.master_id; tree(); pane(); } }],
    });
  }

  $("#up").onclick = async () => {
    const t = await api("/api/vault/tree");
    const groups = {};
    for (const [k, v] of Object.entries(meta.types)) (groups[v.group] ||= []).push([k, v]);
    dialog({
      title: "Upload documents", wide: true,
      body: `<form class="stack-sm" id="uf"><div class="form-grid">
        <div class="field"><label>Document type</label><select class="select" name="doc_type">${Object.entries(groups).map(([g, list]) => `<optgroup label="${esc(g)}">${list.map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("")}</optgroup>`).join("")}</select></div>
        <div class="field"><label>File against (optional)</label><select class="select" name="master_id"><option value="">Decide at QC</option>${t.folders.map((f) => `<optgroup label="${esc(f.label)}">${f.masters.map((m) => `<option value="${esc(m.id)}"${sel === m.id ? " selected" : ""}>${esc(m.name)}</option>`).join("")}</optgroup>`).join("")}</select></div></div>
        <div class="field"><label>Files (JPG, PNG, WebP or PDF, up to 8 MB each)</label><input class="input" type="file" name="files" multiple accept="image/jpeg,image/png,image/webp,application/pdf"></div>
        <p class="small muted" id="hint"></p><div id="res" class="stack-sm small"></div></form>`,
      onOpen: (d) => { const s = d.querySelector('[name="doc_type"]'), h = d.querySelector("#hint"); const f = () => (h.textContent = s.value === "aadhaar" ? "Upload the masked Aadhaar (first eight digits hidden) from myAadhaar. A copy showing the full number is not kept." : s.value === "payment_card" ? "The card image is never stored. OCR keeps only the network, issuer, last four digits, expiry and name. Do not upload the back of the card." : "The file is encrypted before storage. OCR reads it and the checks run straight away."); s.onchange = f; f(); },
      actions: [{ id: "c", label: "Close" }, { id: "s", label: "Upload and read", kind: "primary", handler: async (d) => {
        const form = d.querySelector("#uf"), files = [...form.files.files], out = d.querySelector("#res");
        if (!files.length) { toast("Choose a file.", "err"); return false; }
        for (const f of files) {
          const fd = new FormData(); fd.append("file", f); fd.append("doc_type", form.doc_type.value); fd.append("master_id", form.master_id.value);
          out.insertAdjacentHTML("beforeend", `<div>${esc(f.name)}: reading…</div>`); const line = out.lastElementChild;
          const r = await fetch("/api/vault/docs", { method: "POST", body: fd }); const j = await r.json().catch(() => ({}));
          line.textContent = r.ok ? `${f.name}: read. ${j.qc.filter((x) => x.result === "fail").length} failed, ${j.qc.filter((x) => x.result === "warn").length} to check.${j.note ? " " + j.note : ""}` : `${f.name}: ${j.error || "failed"}`;
        }
        sel = "qc"; tree(); pane(); return false;
      } }],
    });
  };

  await tree(); await pane();
}
