import { api, esc, ico, toast, dialog, fmtDateTime } from "/_shared/js/ui.js";

// Kayakers Store: branded merchandise for each Kayak company and solution, shown on mock-ups in the
// brand's colours and patterns. Colleagues request items; administrators approve and order through a
// print-on-demand partner with no minimum order and no commitment.
const BR = {
  ksa: ["Kayak Strategic Advisors", "/app/logos/kayak-logo.svg", "#0E2F3C", "09-current-brand-dark"],
  group: ["Kayak Group", "/app/logos/kayak-group-reversed.svg", "#0E2F3C", "04-monogram-canvas-brand-dark", 1],
  innovations: ["Kayak Innovations", "/app/logos/kayak-innovations.svg", "#EE9B1E", "01-confluence-brand-dark"],
  technology: ["Kayak Technology Solutions", "/app/logos/kayak-technology-solutions.svg", "#2D6A9F", "11-chart-contours-brand-dark"],
  nexapair: ["NexaPair", "/app/logos/nexapair-horizontal.svg", "#0BA3AA", "02-paddle-rhythm-brand-dark"],
  sayusnow: ["SayUsNow", "/app/logos/sayusnow-horizontal.svg", "#5E4B78", "10-soundings-brand-dark"],
  docuvow: ["DocuVow", "/app/logos/docuvow-horizontal.svg", "#9C630E", "03-delta-brand-dark"],
};
const ITEMS = [
  ["tee", "Crew T-shirt", "Cotton, 180 GSM, logo on chest, pattern panel on the back", ["S", "M", "L", "XL", "XXL"]],
  ["polo", "Polo shirt", "Piqué cotton, embroidered logo", ["S", "M", "L", "XL", "XXL"]],
  ["hoodie", "Hoodie", "Fleece, logo on chest, pattern sleeve", ["S", "M", "L", "XL", "XXL"]],
  ["cap", "Cap", "Embroidered front logo", ["One size"]],
  ["mug", "Mug", "Ceramic, 330 ml, wrap print", ["330 ml"]],
  ["bottle", "Steel bottle", "750 ml, laser-etched logo", ["750 ml"]],
  ["tote", "Tote bag", "Canvas, full-bleed pattern with logo plate", ["Standard"]],
  ["notebook", "Notebook", "A5, pattern cover, logo plate", ["A5"]],
];
const PARTNERS = [
  { name: "Qikink", url: "https://qikink.com/print-on-demand-india/", why: "Recommended. No minimum order (one unit is fine), free sign-up with no deposit, your own neck labels, hang tags, inserts and packaging with no Qikink branding, 350+ products including caps, bags and bottles, dispatch in 2 to 3 days and delivery across 29,000+ Indian pincodes. Integrates with Shopify, WooCommerce and an open API." },
  { name: "Vendorboat", url: "https://avada.io/blog/print-on-demand-websites-in-india/", why: "Strong on presentation: neck and sleeve labels, hang tags, thank-you cards and stickers, with worldwide shipping in 6 to 15 days. Good for client gifting abroad." },
  { name: "Blinkstore", url: "https://avada.io/blog/print-on-demand-websites-in-india/", why: "India-focused logistics with cash on delivery and 50+ products; integrates with Shopify and Instagram." },
  { name: "Printful", url: "https://www.printful.com/print-on-demand/a/dodropshipping", why: "Global option with no minimum order and custom labels and packaging; fulfils from the US and Europe and ships to India, so best for the International Desk." },
];

function mock(item, bk) {
  const [name, logo, col, pat, darkLogo] = BR[bk];
  const P = `/app/patterns/${pat}.svg`;
  const logoPlate = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${darkLogo ? "#0E2F3C" : "#FFFFFF"}"/><image href="${logo}" x="${x + 4}" y="${y + 3}" width="${w - 8}" height="${h - 6}" preserveAspectRatio="xMidYMid meet"/>`;
  const defs = `<defs><pattern id="p-${item}-${bk}" width="60" height="60" patternUnits="userSpaceOnUse"><image href="${P}" width="60" height="60" preserveAspectRatio="xMidYMid slice"/></pattern></defs>`;
  const fillP = `url(#p-${item}-${bk})`;
  const shirt = (body) => `<path d="M60 30l30-14c6 10 34 10 40 0l30 14 22 36-26 14-8-10v118H72V70l-8 10-26-14z" fill="${body}" stroke="rgba(0,0,0,.12)"/>`;
  const S = {
    tee: `${shirt(col === "#EE9B1E" ? "#0E2F3C" : "#FFFFFF")}${logoPlate(92, 64, 56, 18)}<rect x="72" y="176" width="96" height="12" fill="${fillP}"/>`,
    polo: `${shirt(col)}<path d="M100 18l20 22 20-22" fill="none" stroke="#fff" stroke-width="3"/>${logoPlate(128, 62, 38, 13)}`,
    hoodie: `${shirt("#0E2F3C")}<path d="M90 16c0 24 60 24 60 0" fill="#0E2F3C" stroke="rgba(255,255,255,.2)"/><rect x="38" y="44" width="30" height="40" transform="rotate(-30 52 64)" fill="${fillP}"/>${logoPlate(96, 70, 48, 16)}`,
    cap: `<path d="M50 120c0-50 30-74 70-74s70 24 70 74z" fill="${col}"/><path d="M40 120h170c0 12-30 20-90 20s-80-8-80-20z" fill="#0E2F3C"/>${logoPlate(92, 84, 56, 18)}`,
    mug: `<rect x="60" y="50" width="100" height="120" rx="6" fill="#fff" stroke="rgba(0,0,0,.15)"/><rect x="60" y="50" width="100" height="44" fill="${fillP}"/><path d="M160 80h16c14 0 14 50 0 50h-16" fill="none" stroke="#ccd" stroke-width="10"/>${logoPlate(74, 112, 72, 22)}`,
    bottle: `<rect x="96" y="20" width="48" height="22" rx="4" fill="#0E2F3C"/><rect x="86" y="40" width="68" height="150" rx="18" fill="${col}"/>${logoPlate(92, 100, 56, 18)}`,
    tote: `<path d="M90 40c0-24 60-24 60 0" fill="none" stroke="#D9CBA8" stroke-width="7"/><rect x="50" y="40" width="140" height="150" fill="${fillP}"/>${logoPlate(72, 150, 96, 26)}`,
    notebook: `<rect x="64" y="24" width="120" height="164" rx="4" fill="${fillP}"/><rect x="64" y="24" width="10" height="164" fill="rgba(0,0,0,.25)"/>${logoPlate(88, 140, 84, 24)}`,
  }[item];
  return `<svg viewBox="0 0 240 210" role="img" aria-label="${esc(name)} ${item} mock-up">${defs}${S}</svg>`;
}

export async function render(main, { me }) {
  let brand = sessionStorage.getItem("ksa-store-brand") || "ksa";
  const draw = async () => {
    const { requests, admin } = await api("/api/workspace/store");
    main.innerHTML = `<div class="page">
      <section class="dash-hero"><div class="stack-sm"><span class="eyebrow" style="color:#F5C46D">Kayakers Store</span><h1>Wear the work you are proud of</h1><p>Branded kit for every Kayak company and solution, made to the brand manual. Choose an item, request it, and an administrator orders it through our print-on-demand partner.</p></div>
        <div class="stack-sm"><label class="small" style="color:#C9DAD8" for="brand">Brand</label><select class="input" id="brand">${Object.entries(BR).map(([k, b]) => `<option value="${k}" ${k === brand ? "selected" : ""}>${esc(b[0])}</option>`).join("")}</select></div></section>
      <section class="store">${ITEMS.map(([id, n, d, sizes]) => `<article class="sitem"><div class="smock">${mock(id, brand)}</div><div class="stack-sm" style="padding:14px"><h3>${esc(n)}</h3><p class="small muted">${esc(d)}</p><button class="btn btn-primary btn-sm" data-req="${id}">${ico("plus")} Request</button></div></article>`).join("")}</section>
      <section class="dgrid">
        <div class="panel2 s6"><h3>${admin ? "All requests" : "Your requests"}</h3>${requests.length ? `<div class="tlist">${requests.map((r) => `<div><span class="rag ${r.status === "delivered" ? "green" : r.status === "declined" ? "red" : "amber"}">${esc(r.status)}</span><span><b>${esc(r.qty)} × ${esc(ITEMS.find((i) => i[0] === r.item)?.[1] || r.item)}</b> · ${esc(BR[r.brand]?.[0] || r.brand || "")} ${r.size ? `· ${esc(r.size)}` : ""}<br><span class="small muted">${esc(r.requester || "")} · ${fmtDateTime(r.created_at)}${r.note ? ` · ${esc(r.note)}` : ""}</span></span>${admin ? `<select class="input input-sm" data-st="${r.id}">${["requested", "approved", "ordered", "delivered", "declined"].map((s) => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}</select>` : "<span></span>"}</div>`).join("")}</div>` : `<p class="small muted">No requests yet.</p>`}</div>
        <div class="panel2 s6"><h3>Fulfilment partners <small>no minimum order, no commitment</small></h3><div class="tlist">${PARTNERS.map((p, i) => `<div><span class="rag ${i ? "done" : "green"}">${i ? "Option" : "Pick"}</span><span><b>${esc(p.name)}</b><br><span class="small muted">${esc(p.why)}</span></span><a class="small" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Source</a></div>`).join("")}</div>
          <p class="small muted">To start without commitment: sign up with Qikink, upload the logo and pattern files from the Brand Portal, order one sample of each item, and only then switch on the store. Signing up and paying are done by you, not by Kayak AI. Notebooks are not in Qikink's list; order them from a corporate printer.</p></div>
      </section></div>`;
    main.querySelector("#brand").onchange = (e) => { brand = e.target.value; sessionStorage.setItem("ksa-store-brand", brand); draw(); };
    main.querySelectorAll("[data-st]").forEach((s) => s.addEventListener("change", async () => { await api(`/api/workspace/store/${s.dataset.st}`, { body: { status: s.value } }); toast("Updated."); }));
    main.querySelectorAll("[data-req]").forEach((b) => b.addEventListener("click", () => {
      const it = ITEMS.find((i) => i[0] === b.dataset.req);
      dialog({ title: `Request: ${it[1]}`, body: `<div class="stack-sm"><div class="smock" style="max-width:240px;margin:0 auto">${mock(it[0], brand)}</div><p class="small">${esc(BR[brand][0])}</p>
        <div class="row"><div class="field"><label>Size</label><select class="input" id="sz">${it[3].map((s) => `<option>${s}</option>`).join("")}</select></div><div class="field"><label>Quantity</label><input class="input" type="number" id="q" value="1" min="1" max="50"></div></div>
        <div class="field"><label>Note (optional)</label><input class="input" id="n" placeholder="For example: for the client workshop on 2 December"></div></div>`,
        actions: [{ id: "c", label: "Cancel" }, { id: "s", label: "Send request", kind: "primary", handler: async (dl) => { await api("/api/workspace/store", { body: { item: it[0], brand, size: dl.querySelector("#sz").value, qty: dl.querySelector("#q").value, note: dl.querySelector("#n").value } }); toast("Request sent."); draw(); } }] });
    }));
  };
  await draw();
}
