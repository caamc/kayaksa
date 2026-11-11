// Colour guidance for the Brand Portal: how much of each colour to use, approved pairings with
// their contrast, signature gradients, and a mixer that checks contrast and how "royal" a pairing reads.
import { $, $$, esc, copyText } from "/_shared/js/ui.js";

export const ALL = {
  "Deep Current": "#0E2F3C", "Open Water": "#17807E", "Beacon Saffron": "#EE9B1E", "Sea Mist": "#EEF4F1", "Storm Slate": "#3E5563",
  "Deep Lagoon": "#0B5654", "Shallows": "#5DB2AB", "Spray": "#CDE8E3", "Burnished Gold": "#9C630E", "Dawn": "#F5C46D", "Haze": "#FBEBCD",
  "Undertow": "#1F4B5F", "Fog": "#D4DEE2", "Tidewater Blue": "#2D6A9F", "Kelp Green": "#4B7A4E", "Dusk Plum": "#5E4B78", "Red Clay": "#B4472F", "White": "#FFFFFF",
};
const nameOf = (h) => Object.keys(ALL).find((k) => ALL[k].toLowerCase() === h.toLowerCase());

// How a Kayak page or slide is balanced.
const SHARE = [["Sea Mist / White", "#EEF4F1", 60, "Ground: pages, slides, documents"], ["Deep Current", "#0E2F3C", 25, "Text, headers, deep bands, covers"], ["Open Water", "#17807E", 10, "Actions, links, charts"], ["Secondary palette", "#5DB2AB", 4, "Charts and diagrams only"], ["Beacon Saffron", "#EE9B1E", 1, "One highlight per view"]];

const USE = [
  ["Deep Current", "Body text on light grounds; covers, footers and section bands; the reversed logo sits on it.", "Never as a large block behind small grey text."],
  ["Open Water", "Buttons, links, active states, the first series in a chart.", "Not for body text below 16 px on Sea Mist."],
  ["Beacon Saffron", "A single highlight: one key number, the active tab, a rule under a heading.", "Never for text on white (fails contrast) and never more than once per view."],
  ["Sea Mist", "The default ground for slides, documents and portal pages.", "Not as text colour."],
  ["Storm Slate", "Secondary text, captions, table headers.", "Not for anything a reader must not miss."],
  ["Secondary palette", "Charts, maps and diagrams, in the order shown, so series stay recognisable.", "Not for logos, headings or backgrounds of whole pages."],
];

export const GRADIENTS = [
  ["Deep Current to Open Water", "linear-gradient(135deg, #0E2F3C 0%, #17807E 100%)", "Covers, hero bands, title slides"],
  ["Night Tide", "linear-gradient(160deg, #0B1F28 0%, #0E2F3C 45%, #1F4B5F 100%)", "Premium backgrounds behind white text"],
  ["Royal Current", "linear-gradient(135deg, #0E2F3C 0%, #1F4B5F 55%, #5E4B78 100%)", "Leadership, Confluence and board material"],
  ["Gilded Edge", "linear-gradient(120deg, #0E2F3C 0%, #0E2F3C 62%, #9C630E 88%, #F5C46D 100%)", "Certificates, invitations, awards"],
  ["Lagoon", "linear-gradient(135deg, #0B5654 0%, #5DB2AB 100%)", "Technology & AI and Managed Services"],
  ["Dawn Light", "linear-gradient(135deg, #FBEBCD 0%, #F5C46D 100%)", "Soft call-outs on light pages (dark text only)"],
  ["Sea Mist Wash", "linear-gradient(180deg, #FFFFFF 0%, #EEF4F1 100%)", "Document and portal backgrounds"],
];

// ---- colour maths
const hex6 = (h) => { h = String(h).trim().replace(/^#?/, "#"); if (/^#[0-9a-f]{3}$/i.test(h)) h = "#" + [...h.slice(1)].map((x) => x + x).join(""); return /^#[0-9a-f]{6}$/i.test(h) ? h.toUpperCase() : null; };
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => { const [r, g, b] = rgbOf(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const hsl = (h) => {
  const [r, g, b] = rgbOf(h).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  const hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(hh * 60 + 360) % 360, s * 100, l * 100];
};
const wcag = (r) => (r >= 7 ? ["AAA", "ok", "Passes for all text"] : r >= 4.5 ? ["AA", "ok", "Passes for body text"] : r >= 3 ? ["AA large", "warn", "Headings 24 px+ or bold 19 px+ only"] : ["Fails", "danger", "Not readable enough for any text"]);

/**
 * How "royal" a pairing reads, from 0 to 100. A heuristic built from Kayak's own guidance, not a
 * universal rule: royal pairings rest on a deep, quiet base (navy, teal-black, plum), add one warm
 * metallic or ivory note, keep strong contrast, and avoid loud, fully saturated mid-tones.
 */
export function royal(fg, bg) {
  const reasons = [];
  let score = 50;
  const [h1, s1, l1] = hsl(fg), [h2, s2, l2] = hsl(bg);
  const deep = [[h1, s1, l1], [h2, s2, l2]].find(([, s, l]) => l <= 26);
  const light = [[h1, s1, l1], [h2, s2, l2]].find(([, , l]) => l >= 85);
  const metal = [[h1, s1, l1], [h2, s2, l2]].find(([h, s, l]) => h >= 30 && h <= 50 && s >= 45 && l >= 30 && l <= 75);
  const r = contrast(fg, bg);
  if (deep) { score += 18; reasons.push("a deep, quiet base"); } else { score -= 12; reasons.push("no deep base colour"); }
  if (deep && (deep[0] >= 185 && deep[0] <= 290)) { score += 6; reasons.push("a navy, teal-black or plum depth"); }
  if (metal) { score += 16; reasons.push("a gold or saffron note"); }
  else if (light && deep) { score += 10; reasons.push("an ivory or mist contrast"); }
  if (r >= 7) { score += 10; reasons.push("strong contrast"); } else if (r < 4.5) { score -= 18; reasons.push("weak contrast"); }
  const loud = [[s1, l1], [s2, l2]].filter(([s, l]) => s >= 80 && l >= 40 && l <= 62).length;
  if (loud === 2) { score -= 25; reasons.push("two loud colours fighting"); } else if (loud === 1 && !metal) { score -= 10; reasons.push("a loud, saturated colour"); }
  const dh = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
  if (s1 > 50 && s2 > 50 && dh > 100 && dh < 160) { score -= 14; reasons.push("clashing hues"); }
  const brand = [fg, bg].filter((h) => nameOf(h)).length;
  if (brand === 2) { score += 6; reasons.push("both from the Kayak palette"); } else if (brand === 0) { score -= 6; reasons.push("outside the Kayak palette"); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const verdict = score >= 80 ? ["Royal", "ok"] : score >= 62 ? ["Refined", "accent"] : score >= 45 ? ["Acceptable", "warn"] : ["Avoid", "danger"];
  return { score, verdict, reasons };
}

const PAIRS = [["#0E2F3C", "#FFFFFF"], ["#FFFFFF", "#0E2F3C"], ["#0E2F3C", "#EEF4F1"], ["#F5C46D", "#0E2F3C"], ["#EE9B1E", "#0E2F3C"], ["#FFFFFF", "#17807E"], ["#17807E", "#FFFFFF"], ["#3E5563", "#EEF4F1"], ["#FBEBCD", "#5E4B78"], ["#EE9B1E", "#FFFFFF"]];

export function colourGuide() {
  const swatchOpts = (sel) => Object.entries(ALL).map(([n, h]) => `<option value="${h}"${h === sel ? " selected" : ""}>${esc(n)} · ${h}</option>`).join("");
  return `
  <section class="stack"><h2>Using colour</h2>
    <div class="card stack-sm"><h3>The balance of a Kayak page</h3>
      <div class="share" role="img" aria-label="${SHARE.map((s) => `${s[0]} ${s[2]}%`).join(", ")}">${SHARE.map(([n, h, p]) => `<span style="flex:${p};background:${h}" title="${esc(n)} ${p}%"></span>`).join("")}</div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,190px),1fr));gap:10px">${SHARE.map(([n, h, p, w]) => `<div class="row" style="gap:10px;align-items:flex-start"><i class="dot" style="background:${h}"></i><span class="small"><b>${p}% · ${esc(n)}</b><br><span class="muted">${esc(w)}</span></span></div>`).join("")}</div></div>
    <div class="card"><table class="table"><thead><tr><th>Colour</th><th>Use it for</th><th>Avoid</th></tr></thead><tbody>${USE.map(([n, d, a]) => `<tr><td class="nowrap"><i class="dot" style="background:${ALL[n] || "#5DB2AB"}"></i> <b>${esc(n)}</b></td><td>${esc(d)}</td><td class="muted">${esc(a)}</td></tr>`).join("")}</tbody></table></div>
    <div class="card stack-sm"><h3>Approved text pairings</h3><div class="pairs">${PAIRS.map(([f, b]) => { const r = contrast(f, b), w = wcag(r), ry = royal(f, b); return `<div class="pair" style="background:${b};color:${f}"><b>Aa</b><span>${esc(nameOf(f))} on ${esc(nameOf(b))}</span><small>${r.toFixed(1)} : 1 · ${w[0]} · ${ry.verdict[0]}</small></div>`; }).join("")}</div></div>
  </section>

  <section class="stack"><div class="row between"><h2>Signature gradients</h2><span class="small muted">Click to copy the CSS.</span></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr))">${GRADIENTS.map(([n, g, w]) => `<button class="grad" data-css="${esc(g)}"><i style="background:${g}"></i><span><b>${esc(n)}</b><br><span class="muted small">${esc(w)}</span></span></button>`).join("")}</div>
  </section>

  <section class="stack"><h2>Colour mixer</h2>
    <div class="card mixer">
      <div class="stack-sm">
        <div class="field"><label for="mx-fg">Text colour</label><div class="row"><select class="input" id="mx-fg">${swatchOpts("#F5C46D")}</select><input class="input" id="mx-fgx" value="#F5C46D" aria-label="Text colour HEX" style="max-width:110px"><input type="color" id="mx-fgp" value="#f5c46d" aria-label="Pick text colour"></div></div>
        <div class="field"><label for="mx-bg">Background</label><div class="row"><select class="input" id="mx-bg">${swatchOpts("#0E2F3C")}</select><input class="input" id="mx-bgx" value="#0E2F3C" aria-label="Background HEX" style="max-width:110px"><input type="color" id="mx-bgp" value="#0e2f3c" aria-label="Pick background colour"></div></div>
        <div class="field"><label for="mx-gr">Or test on a gradient</label><select class="input" id="mx-gr"><option value="">Flat background</option>${GRADIENTS.map(([n, g]) => `<option value="${esc(g)}">${esc(n)}</option>`).join("")}</select></div>
        <button class="btn btn-ghost btn-sm" id="mx-swap" type="button">Swap colours</button>
      </div>
      <div class="stack-sm">
        <div id="mx-prev" class="mx-prev"><span class="eyebrow" style="color:inherit;opacity:.8">Confluence · November</span><b>The board's next question</b><p>Advice that holds up when it is tested. Thought, designed and developed in India for the world.</p></div>
        <div id="mx-out" class="stack-sm" aria-live="polite"></div>
      </div>
    </div>
  </section>`;
}

export function wireColourGuide(root) {
  $$(".grad", root).forEach((b) => (b.onclick = () => copyText(`background: ${b.dataset.css};`)));
  const st = { fg: "#F5C46D", bg: "#0E2F3C", gr: "" };
  const set = (k, v) => { const h = hex6(v); if (!h) return; st[k] = h; draw(); };
  const draw = () => {
    for (const k of ["fg", "bg"]) {
      $(`#mx-${k}x`, root).value = st[k]; $(`#mx-${k}p`, root).value = st[k].toLowerCase();
      const sel = $(`#mx-${k}`, root); sel.value = nameOf(st[k]) ? ALL[nameOf(st[k])] : ""; if (!nameOf(st[k])) sel.selectedIndex = -1;
    }
    const p = $("#mx-prev", root); p.style.color = st.fg; p.style.background = st.gr || st.bg;
    const r = contrast(st.fg, st.bg), w = wcag(r), ry = royal(st.fg, st.bg);
    $("#mx-out", root).innerHTML = `
      <div class="row wrap-row"><span class="badge ${w[1]}">${r.toFixed(2)} : 1 · ${w[0]}</span><span class="small muted">${w[2]}</span></div>
      <div class="row wrap-row"><span class="badge ${ry.verdict[1]}">${ry.verdict[0]} · ${ry.score}/100</span><span class="small muted">${esc(ry.reasons.join(", "))}.</span></div>
      <div class="royal-meter" aria-hidden="true"><span style="width:${ry.score}%"></span></div>
      ${st.gr ? `<p class="small muted">On a gradient, contrast is measured against the background colour chosen above. Check the lightest part of the gradient by eye.</p>` : ""}
      ${!nameOf(st.fg) || !nameOf(st.bg) ? `<p class="small">${esc([st.fg, st.bg].filter((h) => !nameOf(h)).join(" and "))} ${[st.fg, st.bg].filter((h) => !nameOf(h)).length > 1 ? "are" : "is"} not in the Kayak palette. Use palette colours in anything that carries the Kayak name.</p>` : ""}`;
  };
  for (const k of ["fg", "bg"]) {
    $(`#mx-${k}`, root).onchange = (e) => set(k, e.target.value);
    $(`#mx-${k}x`, root).onchange = (e) => set(k, e.target.value);
    $(`#mx-${k}p`, root).oninput = (e) => set(k, e.target.value);
  }
  $("#mx-gr", root).onchange = (e) => { st.gr = e.target.value; draw(); };
  $("#mx-swap", root).onclick = () => { [st.fg, st.bg] = [st.bg, st.fg]; draw(); };
  draw();
}
