import { $, $$, api, esc, html, ico, toast, dialog, confirmDialog, copyText, fmtDateTime } from "/_shared/js/ui.js";

const ROLES = { superadmin: "SuperAdmin", admin: "Administrator", editor: "Editor", employee: "Employee" };
const ROLE_HELP = "Employees use every module. Editors also manage the brand library, tools and network. Administrators also manage people. SuperAdmins also manage administrators.";

export async function render(main, ctx) {
  if (ctx.view === "audit") return audit(main);
  const me = ctx.me;
  const { users } = await api("/api/admin/users");
  main.innerHTML = String(html`<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Administration</span><h1>People and access</h1><p class="lead">Invite colleagues, set what they can do, and reset access. Everyone signs in with a password and an authenticator app.</p></div>
      <button class="btn btn-primary" id="inv">${ico("plus")} Invite someone</button></div>
    ${me.mail ? "" : html`<div class="note">Email sending is not set up, so invitation and reset links are shown here for you to send yourself (for example by email or Teams). Add RESEND_API_KEY to send them automatically.</div>`}
    <div class="table-wrap"><table class="table"><thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Two-factor</th><th>Last sign-in</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>
    <p class="small muted">${ROLE_HELP}</p></div>`);

  $("#rows").innerHTML = users.map((u) => `<tr><td><b>${esc(u.name || "—")}</b><br><span class="small muted">${esc(u.email)}</span>${u.title ? `<br><span class="small faint">${esc(u.title)}</span>` : ""}</td>
    <td>${esc(ROLES[u.role])}${u.protected ? ' <span class="badge accent">Founder</span>' : ""}</td>
    <td><span class="badge ${u.status === "active" ? "ok" : u.status === "invited" ? "warn" : "danger"}">${esc(u.status)}</span>${u.locked_until && Date.parse(u.locked_until) > Date.now() ? '<br><span class="small" style="color:var(--danger)">Locked</span>' : ""}</td>
    <td>${u.totp_enabled ? `<span class="badge ok">${ico("shield")} On</span>` : '<span class="badge">Not set up</span>'}</td>
    <td class="small">${esc(fmtDateTime(u.last_login))}</td>
    <td>${u.id === me.id ? '<span class="small faint">You</span>' : `<button class="btn btn-ghost btn-sm" data-u="${esc(u.id)}">Manage</button>`}</td></tr>`).join("");

  const linkBox = (link, emailed) =>
    `${emailed ? `<div class="note ok">We emailed the link. You can also share it directly:</div>` : `<div class="note warn">Send this link to the person. It works once.</div>`}
     <div class="row" style="flex-wrap:nowrap"><input class="input" readonly value="${esc(link)}" id="lk" style="font:500 .82rem var(--mono)"><button class="btn btn-ghost" id="cp">${ico("copy")}</button></div>`;
  const showLink = (title, r) => dialog({ title, body: linkBox(r.link, r.emailed), onOpen: (d) => (d.querySelector("#cp").onclick = () => copyText(r.link)) });

  $("#inv").onclick = () => dialog({
    title: "Invite someone",
    body: `<form class="stack" id="if"><div class="field"><label>Work email</label><input class="input" type="email" name="email" required></div>
      <div class="form-grid"><div class="field"><label>Full name</label><input class="input" name="name"></div><div class="field"><label>Designation</label><input class="input" name="title"></div></div>
      <div class="field"><label>Role</label><select class="select" name="role">${Object.entries(ROLES).filter(([k]) => me.isSuperadmin || !["admin", "superadmin"].includes(k)).map(([k, v]) => `<option value="${k}"${k === "employee" ? " selected" : ""}>${v}</option>`).join("")}</select><span class="hint">${esc(ROLE_HELP)}</span></div></form>`,
    actions: [{ id: "c", label: "Cancel" }, { id: "s", label: "Create invitation", kind: "primary", handler: async (d) => {
      const v = Object.fromEntries(new FormData(d.querySelector("#if")));
      const r = await api("/api/admin/users", { body: v });
      setTimeout(() => showLink("Invitation ready", r).then(() => render(main, ctx)));
    } }],
  });

  $$("[data-u]", main).forEach((b) => (b.onclick = () => {
    const u = users.find((x) => x.id === b.dataset.u);
    const canAdmin = me.isSuperadmin || !["admin", "superadmin"].includes(u.role);
    dialog({
      title: u.name || u.email, wide: true,
      body: `<form class="form-grid" id="uf"><div class="field"><label>Full name</label><input class="input" name="name" value="${esc(u.name)}"></div><div class="field"><label>Designation</label><input class="input" name="title" value="${esc(u.title)}"></div>
        <div class="field"><label>Role</label><select class="select" name="role" ${canAdmin && !u.protected ? "" : "disabled"}>${Object.entries(ROLES).filter(([k]) => me.isSuperadmin || !["admin", "superadmin"].includes(k) || k === u.role).map(([k, v]) => `<option value="${k}"${u.role === k ? " selected" : ""}>${v}</option>`).join("")}</select></div>
        <div class="field"><label>Status</label><select class="select" name="status" ${canAdmin && !u.protected ? "" : "disabled"}>${(u.status === "invited" ? ["invited", "disabled"] : ["active", "disabled"]).map((s) => `<option${u.status === s ? " selected" : ""}>${s}</option>`).join("")}</select></div></form>
        <div class="stack-sm"><span class="label">Access</span><div class="row">
          ${u.status === "invited" ? `<button class="btn btn-ghost btn-sm" data-act="invite">${ico("mail")} New invitation link</button>` : `<button class="btn btn-ghost btn-sm" data-act="reset">${ico("key")} Password reset link</button>`}
          ${u.totp_enabled ? `<button class="btn btn-ghost btn-sm" data-act="2fa">${ico("shield")} Reset two-factor</button>` : ""}</div>
          <p class="small muted">Reset two-factor when someone loses their phone and recovery codes; they set it up again at their next sign-in.</p></div>`,
      onOpen: (d) => d.querySelectorAll("[data-act]").forEach((x) => (x.onclick = async () => {
        try {
          if (x.dataset.act === "2fa") {
            if (!(await confirmDialog("Reset two-factor?", `${u.email} will be signed out everywhere and must set up their authenticator again.`, "Reset", true))) return;
            await api(`/api/admin/users/${u.id}/reset-2fa`, { body: {} }); toast("Two-factor reset."); d.close(); d.remove(); render(main, ctx);
          } else {
            const r = await api(`/api/admin/users/${u.id}/link`, { body: { kind: x.dataset.act === "invite" ? "invite" : "reset" } });
            d.close(); d.remove(); showLink(x.dataset.act === "invite" ? "New invitation link" : "Password reset link", r);
          }
        } catch (e) { toast(e.message, "err"); }
      })),
      actions: [{ id: "c", label: "Close" }, ...(canAdmin ? [{ id: "s", label: "Save changes", kind: "primary", handler: async (d) => {
        const v = Object.fromEntries(new FormData(d.querySelector("#uf")));
        await api(`/api/admin/users/${u.id}`, { body: v }); toast("Saved."); render(main, ctx);
      } }] : [])],
    });
  }));
}

async function audit(main) {
  const { entries } = await api("/api/admin/audit?limit=300");
  main.innerHTML = String(html`<div class="page"><div class="stack-sm"><span class="eyebrow">Administration</span><h1>Audit log</h1><p class="lead">Sign-ins, failed attempts, changes to people and access, and changes to shared content. The latest 300 entries.</p></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th><th>IP</th></tr></thead><tbody>${entries.map((e) => html`<tr><td class="small" style="white-space:nowrap">${fmtDateTime(e.at)}</td><td class="small">${e.email || "—"}</td><td><code class="small">${e.action}</code></td><td class="small muted" style="max-width:360px;word-break:break-word">${e.detail || ""}</td><td class="small faint">${e.ip || ""}</td></tr>`)}</tbody></table></div></div>`);
}
