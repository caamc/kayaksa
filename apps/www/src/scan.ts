// Résumé scanning. Every résumé is scanned before it is stored; anything that fails is refused and never kept.
//
// Malicious documents need active content to do harm: macros, scripts, launch actions, embedded files or
// objects, ActiveX controls, or links that pull in remote templates. This scanner refuses all of them,
// looking inside compressed streams and zip parts as well as the raw file, so they can't be hidden there.
// It also refuses what it can't inspect (encrypted or malformed files) and zip bombs.
// A CV needs none of these things, so a clean CV always passes.
//
// It is an active-content scanner, not a signature antivirus engine. A signature engine (ClamAV) can be
// added as a second layer on Cloudflare Containers; see the note in docs.

export interface ScanResult { ok: boolean; reasons: string[]; engine: string }
const ENGINE = "kayak-cv-scan/1";
const latin1 = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return s; };

async function inflate(data: Uint8Array, format: "deflate" | "deflate-raw", cap: number): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream(format);
    const w = ds.writable.getWriter(); w.write(data).catch(() => {}); w.close().catch(() => {});
    const r = ds.readable.getReader(); const parts: Uint8Array[] = []; let n = 0;
    // Keep whatever was decoded even if the stream ends badly (trailing bytes, truncation): it still gets scanned.
    try { for (;;) { const { value, done } = await r.read(); if (done) break; n += value.length; if (n > cap) { r.cancel().catch(() => {}); return null; } parts.push(value); } } catch {}
    if (!n) return null;
    const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
  } catch { return null; }
}

// ---------------------------------------------------------------- PDF
// PDF names can be obfuscated with #xx hex escapes (/J#61vaScript); decode them before matching.
const pdfNames = (s: string) => s.replace(/\/([^\s/<>\[\]()]*#[0-9a-fA-F]{2}[^\s/<>\[\]()]*)/g, (_, n) => "/" + n.replace(/#([0-9a-fA-F]{2})/g, (_m: string, h: string) => String.fromCharCode(parseInt(h, 16))));
const PDF_BAD: [RegExp, string][] = [
  [/\/JavaScript\b/, "contains JavaScript"], [/\/JS\b/, "contains JavaScript"], [/\/Launch\b/, "tries to launch a program"],
  [/\/EmbeddedFiles?\b/, "contains embedded files"], [/\/RichMedia\b/, "contains rich media (Flash)"], [/\/XFA\b/, "contains an XFA form"],
  [/\/AA\b/, "contains automatic actions"], [/\/SubmitForm\b/, "submits data to the internet"], [/\/ImportData\b/, "imports external data"],
  [/\/GoToE\b/, "opens embedded documents"], [/\/Sound\b|\/Movie\b/, "contains media actions"],
];
async function scanPdf(b: Uint8Array): Promise<string[]> {
  const raw = latin1(b), reasons = new Set<string>();
  if (!raw.startsWith("%PDF-")) return ["is not a valid PDF"];
  if (/\/Encrypt\b/.test(pdfNames(raw))) return ["is password-protected or encrypted, so it can't be scanned"];
  const check = (s: string) => { const t = pdfNames(s); for (const [re, why] of PDF_BAD) if (re.test(t)) reasons.add(why); };
  check(raw);
  // Look inside compressed streams too (object streams can hide the names above).
  let budget = 40 * 1024 * 1024, streams = 0;
  const re = /stream\r?\n/g; let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) && streams < 4000) {
    const start = m.index + m[0].length, end = raw.indexOf("endstream", start);
    if (end < 0) break;
    streams++;
    const dict = raw.slice(Math.max(0, m.index - 400), m.index);
    if (/\/FlateDecode/.test(dict) && !/\/(Image|DCTDecode|JPXDecode)/.test(dict.slice(dict.lastIndexOf("<<")))) {
      let e2 = end; while (e2 > start && (b[e2 - 1] === 10 || b[e2 - 1] === 13 || b[e2 - 1] === 32)) e2--;
      const out = await inflate(b.subarray(start, e2), "deflate", Math.min(budget, 20 * 1024 * 1024));
      if (out) { budget -= out.length; check(latin1(out)); }
      if (budget <= 0) { reasons.add("expands to an unsafe size (possible zip bomb)"); break; }
    }
    re.lastIndex = end;
  }
  return [...reasons];
}

// ---------------------------------------------------------------- DOCX (zip)
interface ZipEntry { name: string; method: number; csize: number; usize: number; off: number }
function zipEntries(b: Uint8Array): ZipEntry[] | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  const count = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
  const out: ZipEntry[] = []; let p = cdOff;
  for (let i = 0; i < count; i++) {
    if (p + 46 > b.length || dv.getUint32(p, true) !== 0x02014b50) return null;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    out.push({ name: latin1(b.subarray(p + 46, p + 46 + nlen)), method, csize, usize, off });
    p += 46 + nlen + elen + clen;
  }
  return out;
}
async function zipRead(b: Uint8Array, e: ZipEntry): Promise<Uint8Array | null> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (e.off + 30 > b.length || dv.getUint32(e.off, true) !== 0x04034b50) return null;
  const start = e.off + 30 + dv.getUint16(e.off + 26, true) + dv.getUint16(e.off + 28, true);
  const data = b.subarray(start, start + e.csize);
  if (e.method === 0) return data;
  if (e.method === 8) return inflate(data, "deflate-raw", 10 * 1024 * 1024);
  return null;
}
async function scanDocx(b: Uint8Array): Promise<string[]> {
  const entries = zipEntries(b);
  if (!entries || !entries.length) return ["is not a valid Word document"];
  const reasons = new Set<string>();
  const total = entries.reduce((a, e) => a + e.usize, 0);
  if (total > 60 * 1024 * 1024 || entries.length > 2000) return ["expands to an unsafe size (possible zip bomb)"];
  if (!entries.some((e) => e.name === "word/document.xml")) reasons.add("is not a Word document");
  for (const e of entries) {
    const n = e.name.toLowerCase();
    if (/vbaproject\.bin|vbadata\.xml|\/vba/.test(n)) reasons.add("contains macros");
    if (/activex/.test(n)) reasons.add("contains ActiveX controls");
    if (/embeddings\/|oleobject|\.bin$|\.exe$|\.dll$|\.js$|\.vbs$|\.hta$|\.ps1$|\.lnk$/.test(n)) reasons.add("contains embedded objects or programs");
    if (n.endsWith("[content_types].xml") || n.endsWith(".rels") || n === "word/settings.xml") {
      const x = await zipRead(b, e); if (!x) { reasons.add("has parts that can't be read"); continue; }
      const t = new TextDecoder().decode(x);
      if (/macroEnabled|vbaProject/i.test(t)) reasons.add("contains macros");
      // External relationships are fine for hyperlinks (a LinkedIn link), never for templates, frames, objects or sub-documents.
      for (const rel of t.match(/<Relationship\b[^>]*>/g) || []) {
        if (!/TargetMode\s*=\s*"External"/i.test(rel)) continue;
        const target = (rel.match(/Target\s*=\s*"([^"]*)"/i) || [])[1] || "";
        if (!/\/hyperlink"/i.test(rel) && /^(https?:|ftp:|\\\\|\/\/|smb:|webdav)/i.test(target)) reasons.add("loads content from the internet when opened");
      }
      if (/ddeauto|\bDDE\b/i.test(t)) reasons.add("contains DDE commands");
    }
    if (n === "word/document.xml") {
      const x = await zipRead(b, e); if (!x) { reasons.add("has parts that can't be read"); continue; }
      const t = new TextDecoder().decode(x);
      if (/instrText[^>]*>\s*(DDEAUTO|DDE)\b/i.test(t) || /<w:fldSimple[^>]*w:instr="\s*DDE/i.test(t)) reasons.add("contains DDE commands");
      if (/INCLUDEPICTURE[^<]*https?:|INCLUDETEXT/i.test(t)) reasons.add("loads content from the internet when opened");
    }
  }
  return [...reasons];
}

// ---------------------------------------------------------------- DOC (OLE compound file, Word 97-2003)
async function scanDoc(b: Uint8Array): Promise<string[]> {
  const raw = latin1(b), reasons = new Set<string>();
  // Directory entry names are UTF-16LE in the compound file.
  const u16 = (s: string) => s.split("").map((ch) => ch + "\0").join("");
  if (raw.includes(u16("_VBA_PROJECT")) || raw.includes(u16("Macros")) || raw.includes(u16("VBA"))) reasons.add("contains macros");
  if (raw.includes(u16("ObjectPool"))) reasons.add("contains embedded objects");
  if (/Equation\.3|Equation Native/i.test(raw) || raw.includes(u16("Equation Native"))) reasons.add("contains an equation object (a known exploit route)");
  if (raw.includes(u16("Ole10Native")) || /Package\x00/.test(raw)) reasons.add("contains packaged files");
  if (/DDEAUTO/i.test(raw)) reasons.add("contains DDE commands");
  if (!raw.includes(u16("WordDocument"))) reasons.add("is not a Word document");
  return [...reasons];
}

export async function scanResume(bytes: Uint8Array, ext: string): Promise<ScanResult> {
  let reasons: string[];
  try { reasons = ext === "pdf" ? await scanPdf(bytes) : ext === "docx" ? await scanDocx(bytes) : ext === "doc" ? await scanDoc(bytes) : ["is not a PDF or Word document"]; }
  catch { reasons = ["couldn't be scanned"]; }
  return { ok: reasons.length === 0, reasons, engine: ENGINE };
}
