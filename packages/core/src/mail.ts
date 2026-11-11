// Transactional email through Resend (https://resend.com). Optional: without RESEND_API_KEY the
// sites still work, and admins copy invite and reset links by hand.

export interface MailEnv {
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
}

export function mailEnabled(env: MailEnv): boolean {
  return !!env.RESEND_API_KEY;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Branded, table-based HTML email that renders in Outlook, Gmail and Apple Mail. */
export function mailHtml(opts: { title: string; intro: string; action?: { label: string; url: string }; outro?: string; site: string }): string {
  const btn = opts.action
    ? `<tr><td style="padding:8px 0 24px"><a href="${esc(opts.action.url)}" style="display:inline-block;background:#17807E;color:#ffffff;font:600 15px Arial,sans-serif;text-decoration:none;padding:13px 22px">${esc(opts.action.label)}</a></td></tr>
       <tr><td style="font:13px/1.5 Arial,sans-serif;color:#4E6470;padding-bottom:18px">If the button does not work, paste this link into your browser:<br><span style="color:#0B5654;word-break:break-all">${esc(opts.action.url)}</span></td></tr>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#EEF4F1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF4F1"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff">
<tr><td style="background:#0E2F3C;padding:22px 28px;font:800 20px Arial,sans-serif;letter-spacing:2px;color:#ffffff">KAYAK<span style="font:600 10px Arial,sans-serif;letter-spacing:3px;color:#A9C0C6;padding-left:12px">${esc(opts.site)}</span></td></tr>
<tr><td style="height:4px;background:#EE9B1E;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font:700 22px/1.25 Arial,sans-serif;color:#0E2F3C;padding-bottom:14px">${esc(opts.title)}</td></tr>
<tr><td style="font:15px/1.6 Arial,sans-serif;color:#22343D;padding-bottom:20px">${opts.intro}</td></tr>
${btn}
${opts.outro ? `<tr><td style="font:13px/1.6 Arial,sans-serif;color:#4E6470;padding-bottom:24px">${opts.outro}</td></tr>` : ""}
</table></td></tr>
<tr><td style="background:#0E2F3C;padding:16px 28px;font:12px/1.6 Arial,sans-serif;color:#A9C0C6">Kayak Strategic Advisors Private Limited · A/2, 314, Shah &amp; Nahar Industrial Estate, Delisle Road, Mumbai 400013 · www.kayaksa.com</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendMail(env: MailEnv, to: string, subject: string, html: string): Promise<{ sent: boolean; error?: string }> {
  if (!env.RESEND_API_KEY) return { sent: false, error: "Email is not configured." };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM || "Kayak Strategic Advisors <no-reply@kayaksa.com>", to: [to], subject, html }),
  });
  if (!r.ok) return { sent: false, error: `Email provider answered ${r.status}.` };
  return { sent: true };
}
