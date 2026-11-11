import { $, $$, api, esc, html, raw, ico, toast, dialog, confirmDialog, copyText, fmtBytes, setBusy } from "/_shared/js/ui.js";

const PRIMARY = [
  ["Deep Current", "#0E2F3C", "Primary · text and deep bands"], ["Open Water", "#17807E", "Primary · actions and links"], ["Beacon Saffron", "#EE9B1E", "Accent · one highlight per view"],
  ["Sea Mist", "#EEF4F1", "Surface"], ["Storm Slate", "#3E5563", "Secondary text"],
];
const SECONDARY = [
  ["Deep Lagoon", "#0B5654"], ["Shallows", "#5DB2AB"], ["Spray", "#CDE8E3"], ["Burnished Gold", "#9C630E"], ["Dawn", "#F5C46D"], ["Haze", "#FBEBCD"],
  ["Undertow", "#1F4B5F"], ["Fog", "#D4DEE2"], ["Tidewater Blue", "#2D6A9F"], ["Kelp Green", "#4B7A4E"], ["Dusk Plum", "#5E4B78"], ["Red Clay", "#B4472F"],
];
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(", ");
const fileUrl = (key, view) => "/files/brand/" + key.split("/").map(encodeURIComponent).join("/") + (view ? "?view=1" : "");
const isImg = (m) => /^image\/(svg\+xml|png|jpeg|webp)$/.test(m);
const kindIcon = (m) => (m.startsWith("image/") ? "image" : m === "application/pdf" ? "file" : m.includes("zip") ? "folder" : m.startsWith("video") ? "play" : m.startsWith("font") ? "type" : "file");

export async function render(main, { me, query }) {
  const { items } = await api("/api/brand/assets");
  const cats = [...new Set(items.map((i) => i.category))];
  let cat = query.get("c") || "All";
  let q = "";
  const manual = items.find((i) => /Brand Manual$/i.test(i.title) && i.mime === "application/pdf");
  const guide = items.find((i) => /Design and Visual Guidelines/i.test(i.title));
  const logoFull = items.find((i) => i.file_name === "KSA_Logo_Full_FullColour.svg");
  const logoRev = items.find((i) => i.file_name === "KSA_Logo_Full_Reversed.svg");
  const pack = items.filter((i) => /01_Logos\//.test(i.file_key));

  main.innerHTML = String(html`<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Brand Portal</span><h1>The Kayak brand</h1><p class="lead">Every official brand element in one place. Use these files as they are: never redraw, recolour or rearrange the logo.</p></div>
      <div class="row">${manual ? html`<a class="btn btn-primary" href="${fileUrl(manual.file_key, true)}" target="_blank" rel="noopener">${ico("book")} Brand manual</a>` : ""}${guide ? html`<a class="btn btn-ghost" href="${fileUrl(guide.file_key, true)}" target="_blank" rel="noopener">${ico("file")} Design guidelines</a>` : ""}${me.can.edit ? html`<button class="btn btn-ghost" id="up">${ico("upload")} Add a file</button>` : ""}</div></div>

    <section class="grid wide">
      <div class="card stack"><span class="eyebrow">Logo</span>
        <div class="row" style="gap:12px">
          <div style="flex:1 1 200px;background:#fff;border:1px solid var(--line);padding:22px;display:grid;place-items:center">${logoFull ? html`<img src="${fileUrl(logoFull.file_key, true)}" alt="Kayak Strategic Advisors logo, full colour" style="max-height:62px">` : ""}</div>
          <div style="flex:1 1 200px;background:#0E2F3C;padding:22px;display:grid;place-items:center">${logoRev ? html`<img src="${fileUrl(logoRev.file_key, true)}" alt="Kayak Strategic Advisors logo, reversed" style="max-height:62px">` : ""}</div>
        </div>
        <ul class="small muted" style="margin:0;padding-left:18px"><li>Clear space: the height of the K on every side.</li><li>Minimum width 30 mm in print, 160 px on screen; below that use the identifier.</li><li>Full colour on white or Sea Mist; reversed on Deep Current or photography.</li></ul>
        <div class="row"><button class="btn btn-ghost btn-sm" data-c="Logos">${ico("download")} All logo files (${pack.length})</button></div>
      </div>
      <div class="card stack"><span class="eyebrow">Typography</span>
        <div><div style="font:800 2rem/1.1 var(--display);font-stretch:112%">Archivo</div><p class="muted small">Headings, interface and data. Expanded for display, semibold for labels with 0.16em tracking.</p></div>
        <div><div style="font:400 1.8rem/1.1 var(--serif)">Source Serif 4</div><p class="muted small">Long-form reading, quotations and lead paragraphs.</p></div>
        <p class="small">Both are free under the SIL Open Font License. Office fallback: Arial and Georgia.</p>
        <div class="row"><button class="btn btn-ghost btn-sm" data-c="Fonts">${ico("download")} Font files</button></div>
      </div>
    </section>

    <section class="stack"><div class="row between"><h2>Colour</h2><span class="small muted">Click a colour to copy its HEX.</span></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,180px),1fr))">${PRIMARY.map(([n, h, r]) => html`<button class="swatch" data-hex="${h}"><i style="background:${h}"></i><span><b>${n}</b><br><code>${h}</code> · RGB ${rgb(h)}<br><span class="muted">${r}</span></span></button>`)}</div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,130px),1fr))">${SECONDARY.map(([n, h]) => html`<button class="swatch" data-hex="${h}"><i style="background:${h};height:48px"></i><span><b>${n}</b><br><code>${h}</code></span></button>`)}</div>
    </section>

    <section class="stack" id="lib"><h2>Brand library</h2>
      <div class="toolbar"><label class="search"><span class="sr-only">Search the library</span>${ico("search")}<input class="input" id="q" placeholder="Search logos, templates, icons…" autocomplete="off"></label></div>
      <div class="chips" id="cats"></div>
      <div id="grid" class="grid"></div>
    </section>
  </div>`);

  $$("[data-hex]", main).forEach((b) => (b.onclick = () => copyText(b.dataset.hex)));
  $$("[data-c]", main).forEach((b) => (b.onclick = () => { cat = cats.find((c) => c.toLowerCase().includes(b.dataset.c.toLowerCase())) || "All"; draw(); $("#lib").scrollIntoView({ behavior: "smooth" }); }));
  $("#q").oninput = (e) => { q = e.target.value.toLowerCase(); draw(); };

  function draw() {
    $("#cats").innerHTML = ["All", ...cats].map((c) => `<button class="chip${c === cat ? " on" : ""}" data-cat="${esc(c)}">${esc(c)} <span class="faint">${c === "All" ? items.length : items.filter((i) => i.category === c).length}</span></button>`).join("");
    $$("#cats [data-cat]").forEach((b) => (b.onclick = () => { cat = b.dataset.cat; draw(); }));
    const list = items.filter((i) => (cat === "All" || i.category === cat) && (!q || `${i.title} ${i.description} ${i.file_name}`.toLowerCase().includes(q)));
    $("#grid").innerHTML = list.length
      ? list.slice(0, 300).map((i) => {
          const dark = /Reversed|Mono-White|White\b/i.test(i.file_name);
          const thumb = isImg(i.mime) ? `<img loading="lazy" src="${fileUrl(i.file_key, true)}" alt="">` : `<span class="tile-ico">${ico(kindIcon(i.mime))}</span>`;
          const viewable = isImg(i.mime) || i.mime === "application/pdf" || i.mime === "video/mp4";
          return `<article class="asset"><div class="thumb${dark ? " dark" : ""}">${thumb}</div><div class="body"><b>${esc(i.title)}</b><span class="small muted">${esc(i.description || i.category)}</span><span class="small faint">${esc(i.file_name.split(".").pop().toUpperCase())} · ${fmtBytes(i.size)}${i.source === "upload" ? " · uploaded" : ""}</span></div>
            <div class="acts"><a class="btn btn-ghost btn-sm" href="${fileUrl(i.file_key)}" download>${ico("download")} Download</a>${viewable ? `<a class="btn btn-quiet btn-sm" href="${fileUrl(i.file_key, true)}" target="_blank" rel="noopener">${ico("eye")} View</a>` : ""}${i.source === "upload" && me.can.edit ? `<button class="btn btn-quiet btn-sm" data-del="${esc(i.id)}" aria-label="Remove ${esc(i.title)}">${ico("trash")}</button>` : ""}</div></article>`;
        }).join("") + (list.length > 300 ? `<p class="muted">Showing 300 of ${list.length}. Narrow the search to see more.</p>` : "")
      : `<div class="empty">Nothing matches. Try another word or category.</div>`;
    $$("[data-del]", main).forEach((b) => (b.onclick = async () => {
      if (!(await confirmDialog("Remove this file?", "It will be deleted from the brand library for everyone.", "Remove", true))) return;
      await api(`/api/brand/assets/${encodeURIComponent(b.dataset.del)}`, { method: "DELETE" });
      toast("File removed.");
      render(main, { me, query });
    }));
  }
  draw();

  $("#up")?.addEventListener("click", () =>
    dialog({
      title: "Add a file to the brand library",
      body: `<form class="stack" id="upf"><div class="field"><label for="uf">File (up to 95 MB)</label><input class="input" type="file" id="uf" name="file" required></div>
        <div class="field"><label for="ut">Title</label><input class="input" id="ut" name="title" placeholder="Shown in the library"></div>
        <div class="field"><label for="uc">Category</label><input class="input" id="uc" name="category" list="ucl" value="Uploads"><datalist id="ucl">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div>
        <div class="field"><label for="ud">Description</label><input class="input" id="ud" name="description"></div></form>`,
      actions: [{ id: "c", label: "Cancel" }, { id: "go", label: "Upload", kind: "primary", handler: async (d) => {
        const f = d.querySelector("#upf");
        if (!f.file.files.length) throw new Error("Choose a file.");
        await api("/api/brand/upload", { body: new FormData(f) });
        toast("Added to the brand library.");
        render(main, { me, query });
      } }],
    }),
  );
}
