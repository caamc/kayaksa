// Turns uploaded files into a plain table (rows of strings). Formats: CSV, TSV and other delimited
// text (TXT), JSON, XML, HTML tables and positioned text from PDF pages. XLSX lives in xlsx.ts.
// Everything works on strings, so it runs the same in a browser, a Worker or Node.

export type Table = string[][];

export type SourceFormat = "csv" | "txt" | "json" | "xml" | "html" | "xlsx" | "xls" | "pdf" | "gqcase" | "unknown";

export function sniffFormat(name: string, head: Uint8Array | string): SourceFormat {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const text = typeof head === "string" ? head.slice(0, 2048) : "";
  const b = typeof head === "string" ? null : head;
  if (b && b[0] === 0x50 && b[1] === 0x4b) return ext === "gqcase" ? "gqcase" : "xlsx";
  if (b && b[0] === 0xd0 && b[1] === 0xcf) return "xls"; // legacy Excel (OLE2)
  if (b && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  if (ext === "gqcase") return "gqcase";
  if (["csv", "txt", "tsv", "json", "xml", "html", "htm", "xlsx", "xls", "pdf"].includes(ext)) return (ext === "tsv" ? "txt" : ext === "htm" ? "html" : ext) as SourceFormat;
  const t = text.trimStart();
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  if (/^<\?xml|^<[a-z_][\w.-]*[\s>]/i.test(t) && !/<html|<table/i.test(t)) return "xml";
  if (/<table/i.test(t)) return "html";
  return "csv";
}

/** Picks the delimiter that splits the sample lines most consistently. */
export function sniffDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 40);
  let best = ",", bestScore = -1;
  for (const d of [",", "\t", "|", ";", "~"]) {
    const counts = lines.map((l) => splitLine(l, d).length).filter((n) => n > 1);
    if (!counts.length) continue;
    const freq = new Map<number, number>();
    for (const c of counts) freq.set(c, (freq.get(c) || 0) + 1);
    const [mode, n] = [...freq.entries()].sort((x, y) => y[1] - x[1] || y[0] - x[0])[0];
    const score = n * Math.min(mode, 40);
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

function splitLine(line: string, d: string): string[] {
  return parseDelimited(line, d)[0] || [];
}

/** RFC 4180 style parser: quoted fields, doubled quotes, embedded newlines. */
export function parseDelimited(text: string, delim?: string): Table {
  const d = delim || sniffDelimiter(text);
  const out: Table = [];
  let row: string[] = [], field = "", q = false, i = 0;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const n = s.length;
  while (i < n) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === '"' && field.trim() === "") { q = true; field = ""; i++; continue; }
    if (ch === d) { row.push(field.trim()); field = ""; i++; continue; }
    if (ch === "\n" || ch === "\r") {
      row.push(field.trim()); field = "";
      if (row.some((c) => c !== "")) out.push(row);
      row = [];
      if (ch === "\r" && s[i + 1] === "\n") i++;
      i++; continue;
    }
    field += ch; i++;
  }
  row.push(field.trim());
  if (row.some((c) => c !== "")) out.push(row);
  return out;
}

/** Fixed-width or whitespace-aligned text reports: split on runs of 2+ spaces. */
export function parseAligned(text: string): Table {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\s{2,}/).map((c) => c.trim()));
}

/** Plain text: delimited if a delimiter is consistent, otherwise aligned columns. */
export function parseText(text: string): Table {
  const d = sniffDelimiter(text);
  const t = parseDelimited(text, d);
  const wide = t.filter((r) => r.length > 2).length;
  if (wide >= Math.min(3, t.length)) return t;
  return parseAligned(text);
}

/** JSON: an array of objects or arrays, or an object holding such an array (records, data, rows, cdr…). */
export function parseJson(text: string): Table {
  const v = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  const arr = findArray(v);
  if (!arr) throw new Error("No list of records found in the JSON file.");
  if (arr.every((x) => Array.isArray(x))) return arr.map((r: unknown[]) => r.map(cell));
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const o of arr.slice(0, 500)) for (const k of Object.keys(flat(o))) if (!seen.has(k)) { seen.add(k); keys.push(k); }
  return [keys, ...arr.map((o) => { const f = flat(o); return keys.map((k) => cell(f[k])); })];
}

function findArray(v: any, depth = 0): any[] | null {
  if (Array.isArray(v)) return v.length && typeof v[0] === "object" ? v : null;
  if (!v || typeof v !== "object" || depth > 3) return null;
  let best: any[] | null = null;
  for (const k of Object.keys(v)) {
    const a = findArray(v[k], depth + 1);
    if (a && (!best || a.length > best.length)) best = a;
  }
  return best;
}
function flat(o: any, pre = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (!o || typeof o !== "object") { out[pre || "value"] = o; return out; }
  for (const [k, v] of Object.entries(o)) {
    const key = pre ? `${pre}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flat(v, key, out);
    else out[key] = Array.isArray(v) ? v.join("; ") : v;
  }
  return out;
}
const cell = (v: unknown) => (v == null ? "" : String(v).trim());

// ------------------------------------------------------------------ XML

export interface XNode { name: string; attrs: Record<string, string>; children: XNode[]; text: string }

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, e: string) => {
    const l = e.toLowerCase();
    if (l[0] === "#") return String.fromCodePoint(l[1] === "x" ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as Record<string, string>)[l] ?? _;
  });
}

/** A small, tolerant XML parser (no DTDs, no external entities: safe for untrusted files). */
export function parseXml(text: string): XNode {
  const root: XNode = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: XNode[] = [root];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/\s*([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2]) { while (stack.length > 1 && stack[stack.length - 1].name !== m[2]) stack.pop(); if (stack.length > 1) stack.pop(); }
    else if (m[3]) {
      const attrs: Record<string, string> = {};
      const ar = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let a: RegExpExecArray | null;
      while ((a = ar.exec(m[4] || ""))) attrs[a[1]] = decodeEntities(a[2] ?? a[3] ?? "");
      const node: XNode = { name: m[3], attrs, children: [], text: "" };
      top.children.push(node);
      if (!m[5]) stack.push(node);
    } else if (m[6] !== undefined) top.text += decodeEntities(m[6]);
  }
  return root;
}

/** XML to table: finds the most repeated element that holds fields (child elements or attributes). */
export function xmlToTable(text: string): Table {
  const root = parseXml(text);
  const groups = new Map<string, XNode[]>();
  const walk = (n: XNode, path: string) => {
    for (const c of n.children) {
      const p = path + "/" + c.name;
      if (c.children.length || Object.keys(c.attrs).length > 1) { if (!groups.has(p)) groups.set(p, []); groups.get(p)!.push(c); }
      walk(c, p);
    }
  };
  walk(root, "");
  let best: XNode[] = [];
  for (const g of groups.values()) if (g.length > best.length) best = g;
  if (!best.length) throw new Error("No repeated records found in the XML file.");
  const keys: string[] = [];
  const seen = new Set<string>();
  const fields = (n: XNode) => {
    const f: Record<string, string> = {};
    for (const [k, v] of Object.entries(n.attrs)) f["@" + k] = v;
    for (const c of n.children) f[c.name] = (c.text || Object.values(c.attrs)[0] || "").trim();
    return f;
  };
  const rows = best.map(fields);
  for (const r of rows.slice(0, 500)) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); keys.push(k); }
  return [keys.map((k) => k.replace(/^@/, "")), ...rows.map((r) => keys.map((k) => r[k] ?? ""))];
}

// ------------------------------------------------------------------ HTML

/** HTML tables (as exported by many operator portals). Returns the largest table. */
export function htmlToTable(text: string): Table {
  const tables = [...text.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]);
  if (!tables.length) throw new Error("No table found in the HTML file.");
  let best: Table = [];
  for (const t of tables) {
    const rows: Table = [];
    for (const tr of t.matchAll(/<tr[\s\S]*?(?:<\/tr>|(?=<tr)|$)/gi)) {
      const cells = [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)(?=<\/t[dh]>|<t[dh][\s>]|<\/tr>|$)/gi)].map((c) =>
        decodeEntities(c[1].replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim());
      if (cells.some(Boolean)) rows.push(cells);
    }
    if (rows.length > best.length) best = rows;
  }
  return best;
}

// ------------------------------------------------------------------ PDF (positioned text)

export interface PdfItem { str: string; x: number; y: number; w: number; page: number }

/**
 * Rebuilds table rows from text positioned on PDF pages (pdf.js getTextContent output). Items on
 * the same baseline form a line; a gap wider than about two characters starts a new cell. Works
 * for text-based PDFs with simple tables; scanned PDFs need OCR, which is not built.
 */
export function pdfItemsToTable(items: PdfItem[]): Table {
  const lines = new Map<string, PdfItem[]>();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const key = it.page + ":" + Math.round(it.y / 3);
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key)!.push(it);
  }
  const sorted = [...lines.entries()].sort((a, b) => {
    const [pa, ya] = a[0].split(":").map(Number), [pb, yb] = b[0].split(":").map(Number);
    return pa - pb || yb - ya;
  });
  const out: Table = [];
  for (const [, its] of sorted) {
    its.sort((a, b) => a.x - b.x);
    const row: string[] = [];
    let cur = "", end = -Infinity;
    for (const it of its) {
      const charW = it.w / Math.max(1, it.str.length);
      if (cur && it.x - end > Math.max(4, charW * 1.8)) { row.push(cur.trim()); cur = ""; }
      cur += (cur && it.x - end > charW * 0.3 ? " " : "") + it.str;
      end = it.x + it.w;
    }
    if (cur.trim()) row.push(cur.trim());
    out.push(row);
  }
  return out;
}
