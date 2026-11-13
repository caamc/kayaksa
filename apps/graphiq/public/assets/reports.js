// Report exports: PDF (drawn with jsPDF, charts placed as vector graphics with svg2pdf), XLSX,
// CSV, JSON and self-contained HTML. Every format carries the human-verification statement.
import * as E from "/vendor/graphiq-engine.mjs";
import { run } from "/assets/engine.js";
import { download } from "/assets/chartkit.js";
import { caseEvent } from "/assets/case.js";

export const REPORT_FORMATS = ["pdf", "xlsx", "csv", "json", "html"];
const CHARTS = {
  summary: ["Daily volume", "Activity heat map", "Call types by month"], frequency: ["Top contacts", "Contact quadrant", "Incoming and outgoing"], common: ["Who talks to whom", "Call flow"],
  imei: ["Device usage periods", "Top IMEIs"], tower: ["Top cells", "Cells by time band"], timeline: ["Case chronology", "Subscriber activity spans"], meeting: ["Case chronology", "Contact prioritisation"],
};

export async function exportReport(kind, fmt, C) {
  const ctx = { caseTitle: C.k.title, caseRef: `${C.k.refNo} (${C.k.legalBasisLabel})`, tz: C.k.tz };
  const report = await run("report", { kind, ctx });
  const base = `GraphIQ-${kind}-${C.k.title.replace(/[^\w-]+/g, "_").slice(0, 40)}`;
  const charts = async () => {
    const ex = await run("exhibits", { ctx: { tz: C.k.tz, theme: "light", width: 760, watchlist: C.watch } });
    return (CHARTS[kind] || []).map((name) => ex.find((x) => !x.html && x.eyebrow.includes(name))).filter(Boolean).map((x) => ({ title: x.title, svg: x.svg }));
  };
  if (fmt === "json") download(new Blob([E.reportToJson(report)], { type: "application/json" }), base + ".json");
  else if (fmt === "csv") download(new Blob([E.reportToCsv(report)], { type: "text/csv" }), base + ".csv");
  else if (fmt === "html") download(new Blob([E.reportToHtml(report, await charts())], { type: "text/html" }), base + ".html");
  else if (fmt === "xlsx") {
    const used = new Set();
    const sheets = [{ name: "About", rows: [[report.title], [report.subtitle || ""], [`Generated ${report.generatedAt}`], ["Requires human verification"], [report.disclaimer]] }];
    for (const s of report.sections) { let n = s.heading.replace(/[\\/?*[\]:]/g, " ").slice(0, 28); while (used.has(n)) n = n.slice(0, 26) + used.size; used.add(n); sheets.push({ name: n, rows: [s.columns, ...s.rows] }); }
    download(new Blob([await run("xlsx", { sheets })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), base + ".xlsx");
  } else download(await pdf(report, await charts()), base + ".pdf");
  caseEvent("report.exported", { report: kind, format: fmt, sections: report.sections.length });
}

async function pdf(report, charts) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 36;
  const ink = [14, 47, 60], muted = [78, 100, 112], teal = [23, 128, 126], saff = [238, 155, 30];
  let y = 0;
  const header = () => { doc.setFillColor(...ink); doc.rect(0, 0, W, 34, "F"); doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Kayak GraphIQ", M, 22); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`${report.title} - ${report.subtitle || ""}`.slice(0, 120), W - M, 22, { align: "right" }); doc.setFillColor(...saff); doc.rect(M, 34, 44, 3, "F"); y = 58; };
  const need = (h) => { if (y + h > H - 40) { doc.addPage(); header(); } };
  header();
  doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text(report.title, M, y + 8); y += 26;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...muted); doc.text(`${report.subtitle || ""} - generated ${new Date(report.generatedAt).toLocaleString("en-IN")}`, M, y); y += 16;
  const disc = doc.splitTextToSize(`Requires human verification. ${report.disclaimer}`, W - 2 * M - 20);
  doc.setFillColor(251, 235, 205); doc.rect(M, y, W - 2 * M, disc.length * 12 + 12, "F"); doc.setFillColor(...saff); doc.rect(M, y, 3, disc.length * 12 + 12, "F");
  doc.setTextColor(...ink); doc.setFontSize(9); doc.text(disc, M + 12, y + 15); y += disc.length * 12 + 24;
  const table = (sec) => {
    need(60);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...ink); doc.text(sec.heading, M, y); doc.setDrawColor(...saff); doc.setLineWidth(1.5); doc.line(M, y + 4, M + 40, y + 4); y += 16;
    if (sec.note) { doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...muted); doc.text(doc.splitTextToSize(sec.note, W - 2 * M), M, y); y += 14; }
    const cols = sec.columns.length, avail = W - 2 * M;
    const len = sec.columns.map((c, i) => Math.min(40, Math.max(String(c).length, ...sec.rows.slice(0, 60).map((r) => String(r[i] ?? "").length)) + 2));
    const tot = len.reduce((a, b) => a + b, 0), cw = len.map((l) => (l / tot) * avail);
    const row = (cells, head) => {
      doc.setFont("helvetica", head ? "bold" : "normal"); doc.setFontSize(head ? 7.5 : 7.5);
      const lines = cells.map((c, i) => doc.splitTextToSize(String(c ?? ""), cw[i] - 6).slice(0, 4));
      const h = Math.max(...lines.map((l) => l.length)) * 9 + 6;
      need(h + (head ? 0 : 0));
      if (head) { doc.setFillColor(...ink); doc.rect(M, y, avail, h, "F"); doc.setTextColor(255); }
      else doc.setTextColor(...ink);
      let x = M; lines.forEach((l, i) => { doc.text(l, x + 3, y + 10); x += cw[i]; });
      if (!head) { doc.setDrawColor(212, 222, 226); doc.setLineWidth(0.5); doc.line(M, y + h, M + avail, y + h); }
      y += h;
    };
    row(sec.columns, true);
    if (!sec.rows.length) row(["None found.", ...Array(cols - 1).fill("")]);
    for (const r of sec.rows.slice(0, 1500)) { const before = doc.getNumberOfPages(); row(r); if (doc.getNumberOfPages() !== before) { y -= 0; } }
    if (sec.rows.length > 1500) { doc.setFontSize(8); doc.setTextColor(...muted); doc.text(`First 1,500 of ${sec.rows.length} rows; export XLSX for all.`, M, y + 10); y += 14; }
    y += 14;
  };
  table(report.sections[0]);
  // Charts as vector graphics
  for (const ch of charts) {
    const host = document.createElement("div"); host.style.cssText = "position:fixed;left:-10000px;top:0"; host.innerHTML = ch.svg; document.body.append(host);
    const svg = host.querySelector("svg"); const vb = svg.viewBox.baseVal; const w = Math.min(W - 2 * M, 620), h = (w * vb.height) / vb.width;
    need(h + 10);
    try { if (doc.svg) await doc.svg(svg, { x: M, y, width: w, height: h }); else await window.svg2pdf.svg2pdf(svg, doc, { x: M, y, width: w, height: h }); y += h + 14; } catch { /* a chart that cannot be drawn is skipped; the tables still carry the data */ }
    host.remove();
  }
  for (const s of report.sections.slice(1)) table(s);
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...muted); doc.text("Kayak GraphIQ - designed and developed by Kayak Strategic Advisors. Analytical output - requires human verification before use.", M, H - 18); doc.text(`Page ${i} of ${n}`, W - M, H - 18, { align: "right" }); }
  void teal;
  return doc.output("blob");
}
