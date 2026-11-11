import { $, api, esc, html, ico, toast, dialog, confirmDialog, copyText } from "/_shared/js/ui.js";

const ROLES = { superadmin: "SuperAdmin", admin: "Administrator", editor: "Editor", employee: "Employee" };

export async function render(main, ctx) {
  const me = ctx.me;
  main.innerHTML = String(html`<div class="page" style="max-width:820px">
    <div class="stack-sm"><span class="eyebrow">My account</span><h1>${me.name || me.email}</h1><p class="muted">${me.email} · ${ROLES[me.role]}</p></div>
    <form class="card stack" id="pf"><h3>Profile</h3><div class="form-grid">
      <div class="field"><label>Full name</label><input class="input" name="name" value="${me.name}"></div>
      <div class="field"><label>Designation</label><input class="input" name="title" value="${me.title}"></div>
      <div class="field"><label>Mobile</label><input class="input" name="phone" value="${me.phone}"></div></div>
      <div class="row"><button class="btn btn-primary">Save profile</button><span class="small muted">Business Cards uses these details as a starting point.</span></div></form>
    <form class="card stack" id="pw"><h3>Change password</h3><div class="form-grid">
      <div class="field"><label>Current password</label><input class="input" type="password" name="current" autocomplete="current-password" required></div>
      <div class="field"><label>New password</label><input class="input" type="password" name="next" autocomplete="new-password" minlength="12" required></div></div>
      <div class="row"><button class="btn btn-primary">Change password</button></div></form>
    <div class="card stack"><h3>${ico("shield")} Two-factor authentication</h3><p class="muted">On. If you replace your phone, ask an administrator to reset two-factor and set it up again at your next sign-in.</p>
      <div class="row"><button class="btn btn-ghost" id="rc">${ico("key")} New recovery codes</button><button class="btn btn-danger" id="all">${ico("logout")} Sign out on every device</button></div></div>
  </div>`);
  $("#pf").onsubmit = async (e) => { e.preventDefault(); await api("/api/me", { body: Object.fromEntries(new FormData(e.target)) }); toast("Profile saved."); };
  $("#pw").onsubmit = async (e) => { e.preventDefault(); try { await api("/api/me/password", { body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast("Password changed."); } catch (err) { toast(err.message, "err"); } };
  $("#rc").onclick = () => dialog({
    title: "New recovery codes",
    body: `<p class="muted">Your old codes stop working. Enter the current code from your authenticator app.</p><input class="input code" id="code" inputmode="numeric" maxlength="6" placeholder="000000">`,
    actions: [{ id: "c", label: "Cancel" }, { id: "go", label: "Create codes", kind: "primary", handler: async (d) => {
      const r = await api("/api/me/recovery-codes", { body: { code: d.querySelector("#code").value } });
      setTimeout(() => dialog({ title: "Save these codes", body: `<div class="codes">${r.recoveryCodes.map((c) => `<span>${esc(c)}</span>`).join("")}</div><button class="btn btn-ghost btn-sm" id="cp">${ico("copy")} Copy</button>`, onOpen: (x) => (x.querySelector("#cp").onclick = () => copyText(r.recoveryCodes.join("\n"))) }));
    } }],
  });
  $("#all").onclick = async () => {
    if (!(await confirmDialog("Sign out everywhere?", "Every session, including this one, will end.", "Sign out everywhere", true))) return;
    await api("/api/me/sign-out-everywhere", { body: {} }); location.href = "/login";
  };
}
