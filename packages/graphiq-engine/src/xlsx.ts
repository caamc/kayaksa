// Minimal XLSX (Office Open XML spreadsheet) reader and writer, written for GraphIQ.
// Reading: unzips with the platform's DecompressionStream("deflate-raw"), then reads the shared
// strings, styles (to spot date cells) and each worksheet. Writing: a deflated ZIP with inline
// strings and a bold header row. No third-party code; works in browsers, Workers and Node 18+.
// Legacy .xls (BIFF) files are not supported: save them as XLSX or CSV first.
import { decodeEntities } from "./parse";
import { excelSerial } from "./time";

export interface Sheet { name: string; rows: string[][] }

// ------------------------------------------------------------------ ZIP

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function pump(data: Uint8Array, stream: TransformStream<Uint8Array, Uint8Array>): Promise<Uint8Array> {
  const out = new Blob([data as any]).stream().pipeThrough(stream as any);
  return new Uint8Array(await new Response(out as any).arrayBuffer());
}

/** Reads every entry of a ZIP archive. Refuses archives that would expand beyond `maxBytes`. */
export async function unzip(buf: Uint8Array, maxBytes = 600 * 1024 * 1024): Promise<Map<string, Uint8Array>> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (u32(buf, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("This file is not a valid XLSX (ZIP) file.");
  const count = u16(buf, eocd + 10);
  let p = u32(buf, eocd + 16);
  const files = new Map<string, Uint8Array>();
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (u32(buf, p) !== 0x02014b50) throw new Error("The XLSX file's directory is damaged.");
    const method = u16(buf, p + 10), csize = u32(buf, p + 20), usize = u32(buf, p + 24);
    const nlen = u16(buf, p + 28), xlen = u16(buf, p + 30), clen = u16(buf, p + 32), off = u32(buf, p + 42);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    total += usize;
    if (total > maxBytes) throw new Error("The XLSX file expands to more data than GraphIQ accepts in one file.");
    const lstart = off + 30 + u16(buf, off + 26) + u16(buf, off + 28);
    const raw = buf.subarray(lstart, lstart + csize);
    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, await pump(raw, new DecompressionStream("deflate-raw" as any) as any));
    else throw new Error(`Unsupported compression in the XLSX file (method ${method}).`);
  }
  return files;
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(b: Uint8Array): number { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/** Writes a ZIP archive (deflated when the platform supports it). */
export async function zip(entries: { name: string; data: Uint8Array }[]): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const enc = new TextEncoder();
  for (const e of entries) {
    const name = enc.encode(e.name);
    let data = e.data, method = 0;
    try { const d = await pump(e.data, new CompressionStream("deflate-raw" as any) as any); if (d.length < e.data.length) { data = d; method = 8; } } catch { /* stored */ }
    const crc = crc32(e.data);
    const h = new Uint8Array(30 + name.length);
    const v = new DataView(h.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, method, true);
    v.setUint16(10, 0, true); v.setUint16(12, 0x21, true); v.setUint32(14, crc, true); v.setUint32(18, data.length, true);
    v.setUint32(22, e.data.length, true); v.setUint16(26, name.length, true); h.set(name, 30);
    const c = new Uint8Array(46 + name.length);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, method, true);
    cv.setUint16(14, 0x21, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); c.set(name, 46);
    parts.push(h, data); central.push(c);
    offset += h.length + data.length;
  }
  const csize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, csize, true); ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}

// ------------------------------------------------------------------ XLSX read

const td = new TextDecoder();
const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) { const c = ch.charCodeAt(0); if (c < 65 || c > 90) break; n = n * 26 + (c - 64); }
  return n - 1;
}

/** Reads every worksheet into rows of strings. Date cells become "YYYY-MM-DD HH:MM:SS". */
export async function readXlsx(buf: Uint8Array): Promise<Sheet[]> {
  const files = await unzip(buf);
  const get = (n: string) => { const f = files.get(n); return f ? td.decode(f) : ""; };
  const wb = get("xl/workbook.xml");
  if (!wb) throw new Error("This ZIP file is not an Excel workbook.");
  const rels = get("xl/_rels/workbook.xml.rels");
  const relMap = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1], target = /Target="([^"]+)"/.exec(m[0])?.[1];
    if (id && target) relMap.set(id, target.replace(/^\/?(xl\/)?/, "xl/"));
  }
  const shared: string[] = [];
  for (const si of get("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    shared.push(decodeEntities([...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  }
  // Styles: which cell formats are dates
  const styles = get("xl/styles.xml");
  const custom = new Map<number, string>();
  for (const m of styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) custom.set(+m[1], decodeEntities(m[2]));
  const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] || "";
  const dateStyle: boolean[] = [...xfs.matchAll(/<xf\b[^>]*?(?:\/>|>)/g)].map((x) => {
    const id = +(/numFmtId="(\d+)"/.exec(x[0])?.[1] || 0);
    if (BUILTIN_DATE.has(id)) return true;
    const code = custom.get(id);
    return !!code && /[dmyhs]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]/g, "")) && !/^[#0.,%]+$/.test(code);
  });
  const sheets: Sheet[] = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = decodeEntities(/name="([^"]*)"/.exec(m[0])?.[1] || "Sheet");
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1] || "";
    const path = relMap.get(rid);
    const xml = path ? get(path) : "";
    if (!xml) continue;
    const rows: string[][] = [];
    for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rn = +(/\br="(\d+)"/.exec(r[0])?.[1] || rows.length + 1) - 1;
      const row: string[] = [];
      let auto = 0;
      for (const c of (r[1] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
        const ci = ref ? colIndex(ref) : auto;
        auto = ci + 1;
        const t = /\bt="(\w+)"/.exec(attrs)?.[1] || "n";
        const s = +(/\bs="(\d+)"/.exec(attrs)?.[1] || 0);
        const body = c[2] || "";
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let val = "";
        if (t === "s") val = shared[+(v || 0)] ?? "";
        else if (t === "inlineStr") val = decodeEntities([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
        else if (t === "str" || t === "e") val = decodeEntities(v || "");
        else if (t === "b") val = v === "1" ? "TRUE" : "FALSE";
        else if (v !== undefined) {
          const n = Number(v);
          if (dateStyle[s] && Number.isFinite(n)) {
            if (n < 1) { const sec = Math.round(n * 86400); val = `${p2(Math.floor(sec / 3600))}:${p2(Math.floor(sec / 60) % 60)}:${p2(sec % 60)}`; }
            else { const x = excelSerial(n); val = `${x.date.y}-${p2(x.date.mo)}-${p2(x.date.d)}` + (n % 1 ? ` ${p2(x.time.h)}:${p2(x.time.mi)}:${p2(x.time.s)}` : ""); }
          } else val = v;
        }
        while (row.length < ci) row.push("");
        row[ci] = val.trim();
      }
      while (rows.length < rn) rows.push([]);
      rows[rn] = row;
    }
    sheets.push({ name, rows: rows.filter((r) => r && r.some((x) => x !== "")) });
  }
  return sheets;
}
const p2 = (n: number) => String(n).padStart(2, "0");

// ------------------------------------------------------------------ XLSX write

const xesc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const colName = (i: number) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

/** Builds an XLSX workbook. The first row of each sheet is styled as a header. */
export async function writeXlsx(sheets: { name: string; rows: (string | number)[][] }[]): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const names = sheets.map((s, i) => (s.name || `Sheet${i + 1}`).replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  const sheetXml = (rows: (string | number)[][]) => {
    const widths = new Array(Math.max(0, ...rows.map((r) => r.length))).fill(8);
    for (const r of rows.slice(0, 200)) r.forEach((v, i) => (widths[i] = Math.min(60, Math.max(widths[i], String(v ?? "").length + 2))));
    const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
    const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      const ref = colName(ci) + (ri + 1);
      const st = ri === 0 ? ' s="1"' : "";
      if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xesc(String(v ?? ""))}</t></is></c>`;
    }).join("")}</row>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${body}</sheetData></worksheet>`;
  };
  const files = [
    { name: "[Content_Types].xml", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`) },
    { name: "_rels/.rels", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${xesc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: "xl/styles.xml", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0E2F3C"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`) },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(sheetXml(s.rows)) })),
  ];
  return zip(files);
}
