import { $, $$, api, esc, html, ico, toast, dialog, confirmDialog } from "/_shared/js/ui.js";

const STATUS = { live: ["Live", "ok"], beta: ["Beta", "accent"], "coming-soon": ["Coming soon", "warn"], internal: ["Internal", ""] };

export async function render(main, ctx) {
  const { me } = ctx;
  const { tools } = await api("/api/tools");
  const cats = [...new Set(tools.map((t) => t.category))];
  main.innerHTML = String(html`<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Kayak Tools</span><h1>Our platforms and studio tools</h1><p class="lead">Client platforms built by Kayak Technology Solutions, and the internal tools we use every day.</p></div>
      ${me.can.edit ? html`<button class="btn btn-primary" id="add">${ico("plus")} Add a tool</button>` : ""}</div>
    <section class="panel2" style="border-top:6px solid #0E2F3C"><div class="row between wrap-row"><div class="stack-sm"><span class="eyebrow">Office add-in</span><h2 style="font-size:1.35rem">KSA Office Toolbar</h2><p class="muted">The Kayak brand inside Word, Excel, PowerPoint, Outlook and Teams: 2,405 logos, icons, patterns, templates and chart styles, Apply KSA style, and the KSA Assistant.</p></div>
      <div class="row wrap-row"><a class="btn btn-primary btn-sm" href="https://toolbar.kayaksa.com/src/preview.html" target="_blank" rel="noopener">${ico("external")} Try it in the browser</a><a class="btn btn-ghost btn-sm" href="https://toolbar.kayaksa.com/manifest/manifest.xml" download>${ico("download")} Word, Excel, PowerPoint manifest</a><a class="btn btn-ghost btn-sm" href="https://toolbar.kayaksa.com/manifest/manifest-outlook.xml" download>${ico("download")} Outlook manifest</a><button class="btn btn-ghost btn-sm" id="tbtok">${ico("key")} Assistant access</button></div></div>
      <ol class="small muted" style="margin:0;padding-left:18px"><li>Firm-wide: a Microsoft 365 admin uploads the manifests under Settings › Integrated apps › Upload custom apps, for a pilot group first.</li><li>Just you: in Office, Insert › Get Add-ins › My Add-ins › Upload My Add-in, and choose the manifest.</li><li>For the Assistant, open the pane's Settings and paste the access token. The address is already filled in.</li></ol></section>
    <div class="grid wide" id="grid"></div>
  </div>`);
  $("#grid").innerHTML = tools.map((t) => {
    const [label, kind] = STATUS[t.status] || [t.status, ""];
    const ext = /^https?:/.test(t.url);
    return `<article class="card flat stack" style="border-top:6px solid ${esc(t.color)}">
      <div class="row between"><span class="eyebrow" style="color:${esc(t.color)}">${esc(t.category)}</span><span class="badge ${kind}">${esc(label)}</span></div>
      <h3 style="font-size:1.4rem">${esc(t.name)}</h3><p class="muted">${esc(t.summary)}</p>
      ${t.owner ? `<p class="small faint">Owner: ${esc(t.owner)}</p>` : ""}
      <div class="row" style="margin-top:auto">${t.url ? `<a class="btn btn-primary btn-sm" href="${esc(t.url)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${ext ? "Open" : "Launch"} ${ico(ext ? "external" : "arrow")}</a>` : `<span class="small muted">Link to follow</span>`}
      ${me.can.edit ? `<button class="btn btn-quiet btn-sm" data-edit="${esc(t.id)}">${ico("edit")} Edit</button>` : ""}${me.can.admin ? `<button class="btn btn-quiet btn-sm" data-del="${esc(t.id)}" aria-label="Delete ${esc(t.name)}">${ico("trash")}</button>` : ""}</div></article>`;
  }).join("");

  const edit = (t = {}) =>
    dialog({
      title: t.id ? `Edit ${t.name}` : "Add a tool",
      body: `<form class="form-grid" id="tf">
        <div class="field"><label>Name</label><input class="input" name="name" value="${esc(t.name || "")}" required></div>
        <div class="field"><label>Category</label><input class="input" name="category" list="tcl" value="${esc(t.category || "")}"><datalist id="tcl">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div>
        <div class="field" style="grid-column:1/-1"><label>Summary</label><textarea class="textarea" name="summary" maxlength="400">${esc(t.summary || "")}</textarea></div>
        <div class="field"><label>Link</label><input class="input" name="url" value="${esc(t.url || "")}" placeholder="https://… or /app#/…"></div>
        <div class="field"><label>Status</label><select class="select" name="status">${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}"${t.status === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field"><label>Owner</label><input class="input" name="owner" value="${esc(t.owner || "")}"></div>
        <div class="field"><label>Colour</label><input class="input" type="color" name="color" value="${esc(t.color || "#17807E")}"></div>
        <div class="field"><label>Order</label><input class="input" type="number" name="sort" value="${esc(t.sort ?? 100)}"></div></form>`,
      actions: [{ id: "c", label: "Cancel" }, { id: "s", label: "Save", kind: "primary", handler: async (d) => {
        const v = Object.fromEntries(new FormData(d.querySelector("#tf")));
        await api("/api/tools", { body: { ...v, id: t.id } });
        toast("Saved.");
        render(main, ctx);
      } }],
    });
  $("#add")?.addEventListener("click", () => edit());
  $("#tbtok")?.addEventListener("click", async () => {
    const t = await api("/api/workspace/toolbar");
    dialog({ title: "KSA Assistant access", body: t.token ? `<p class="small">Paste these into the KSA Toolbar's Settings. Keep the token inside Kayak; do not share it with clients.</p><div class="field"><label>Assistant address</label><input class="input" readonly value="${esc(t.assistantUrl)}"></div><div class="field"><label>Access token</label><input class="input" readonly id="tk" value="${esc(t.token)}"></div><button class="btn btn-ghost btn-sm" id="cp">${ico("copy")} Copy token</button>` : `<p>The toolbar has not been published yet, so there is no token. It is created on the first deployment of toolbar.kayaksa.com.</p>`, actions: [{ id: "ok", label: "Done", kind: "primary" }], onOpen: (d) => d.querySelector("#cp")?.addEventListener("click", () => { navigator.clipboard.writeText(t.token); toast("Copied."); }) });
  });
  $$("[data-edit]", main).forEach((b) => (b.onclick = () => edit(tools.find((t) => t.id === b.dataset.edit))));
  $$("[data-del]", main).forEach((b) => (b.onclick = async () => {
    if (!(await confirmDialog("Delete this tool?", "It will disappear from Kayak Tools for everyone.", "Delete", true))) return;
    await api(`/api/tools/${encodeURIComponent(b.dataset.del)}`, { method: "DELETE" });
    render(main, ctx);
  }));
}
