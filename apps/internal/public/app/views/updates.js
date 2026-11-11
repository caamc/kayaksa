import { api, esc, ico, toast, dialog, confirmDialog, fmtDateTime } from "/_shared/js/ui.js";

// Kayakers Update: the internal news feed. Announcements, wins, launches, people news and learning,
// posted by editors, plus automatic posts when a launch goes live or a certification is achieved.
const KIND = { announcement: ["Announcement", "#0E2F3C"], win: ["Win", "#4B7A4E"], launch: ["Launch", "#EE9B1E"], people: ["People", "#5E4B78"], learning: ["Learning", "#2D6A9F"], milestone: ["Milestone", "#17807E"] };
const R = { clap: "👏", party: "🎉", idea: "💡", heart: "❤️", rocket: "🚀" };

export async function render(main, { me }) {
  let filter = "";
  const draw = async () => {
    const { updates } = await api("/api/workspace/updates");
    const list = updates.filter((u) => !filter || u.kind === filter);
    main.innerHTML = `<div class="page">
      <div class="page-head"><div class="stack-sm"><span class="eyebrow">Kayakers Update</span><h1>What is happening at Kayak</h1><p class="lead">News from across the firm, in one place. Launches and certifications post themselves when they happen.</p></div>
        ${me.can.edit ? `<button class="btn btn-primary" id="post">${ico("plus")} Post an update</button>` : ""}</div>
      <div class="filters row wrap-row"><button class="btn btn-sm ${filter ? "btn-ghost" : "btn-primary"}" data-f="">All</button>${Object.entries(KIND).map(([k, v]) => `<button class="btn btn-sm ${filter === k ? "btn-primary" : "btn-ghost"}" data-f="${k}">${v[0]}</button>`).join("")}</div>
      <div class="feed">${list.length ? list.map((u) => `<article class="upd" style="--k:${KIND[u.kind]?.[1] || "#0E2F3C"}">
        <div class="row between"><span class="upk">${u.pinned ? "📌 " : ""}${esc(KIND[u.kind]?.[0] || u.kind)}</span><span class="small muted">${esc(u.author || u.by_user || "Kayak Internal")} · ${fmtDateTime(u.created_at)}</span></div>
        <h3>${esc(u.title)}</h3>${u.body ? `<p>${esc(u.body).replace(/\n/g, "<br>")}</p>` : ""}
        <div class="row wrap-row reacts">${Object.entries(R).map(([k, e]) => { const r = u.reactions.find((x) => x.emoji === k); return `<button class="react ${r?.mine ? "on" : ""}" data-r="${u.id}" data-e="${k}" aria-label="React ${k}">${e}${r ? ` <b>${r.n}</b>` : ""}</button>`; }).join("")}${me.can.admin ? `<button class="btn btn-quiet btn-sm" data-del="${u.id}" aria-label="Delete">${ico("trash")}</button>` : ""}</div></article>`).join("") : `<p class="muted">Nothing posted yet.</p>`}</div></div>`;
    main.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { filter = b.dataset.f; draw(); }));
    main.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", async () => { await api(`/api/workspace/updates/${b.dataset.r}/react`, { body: { emoji: b.dataset.e } }); draw(); }));
    main.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => { if (await confirmDialog("Delete this update?", "It is removed for everyone.", "Delete", true)) { await api(`/api/workspace/updates/${b.dataset.del}/delete`, { body: {} }); draw(); } }));
    main.querySelector("#post")?.addEventListener("click", () => dialog({ title: "Post an update", body: `<div class="stack-sm"><div class="field"><label>Type</label><select class="input" id="k">${Object.entries(KIND).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("")}</select></div><div class="field"><label>Headline</label><input class="input" id="t" maxlength="160"></div><div class="field"><label>Details</label><textarea class="input" id="b" rows="5"></textarea></div><label class="row small"><input type="checkbox" id="p"> Pin to the top</label></div>`,
      actions: [{ id: "c", label: "Cancel" }, { id: "s", label: "Post", kind: "primary", handler: async (dl) => { await api("/api/workspace/updates", { body: { kind: dl.querySelector("#k").value, title: dl.querySelector("#t").value, body: dl.querySelector("#b").value, pinned: dl.querySelector("#p").checked } }); toast("Posted."); draw(); } }] }));
  };
  await draw();
}
