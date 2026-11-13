// Kayak GraphIQ analysis worker: parses, normalises and analyses records off the main thread, so
// large files and cases do not freeze the page. Uses the same engine as the server and Node.
import * as E from "/vendor/graphiq-engine.mjs";

const tables = new Map(); // fileKey -> table
const parsed = new Map(); // fileKey -> records
let seen = new Set();
let caseRecords = [];

const ops = {
  async read({ key, name, bytes }) {
    const { format, table, sheets } = await E.readTable(name, new Uint8Array(bytes));
    tables.set(key, table);
    return { format, sheets, rows: table.length, sample: table.slice(0, 40), detection: E.detectMapping(table, {}) };
  },
  async pdfTable({ key, items }) {
    const table = E.pdfItemsToTable(items);
    tables.set(key, table);
    return { format: "pdf", rows: table.length, sample: table.slice(0, 40), detection: E.detectMapping(table, {}) };
  },
  async redetect({ key, tz, cc }) { return E.detectMapping(tables.get(key) || [], { tz, cc }); },
  async resetSeen({ keys }) { seen = new Set(keys || []); for (const r of caseRecords) seen.add(E.dedupeKey(r)); parsed.clear(); return seen.size; },
  async normalise({ key, mapping, src }) {
    const t = tables.get(key);
    if (!t) throw new Error("Open the file again.");
    const { records, validation } = E.normaliseTable(t, mapping, { src, seen });
    parsed.set(key, records);
    return { validation, preview: records.slice(0, 8) };
  },
  async takeRecords({ key }) { return parsed.get(key) || []; },
  async forget({ key }) { tables.delete(key); parsed.delete(key); return true; },
  async load({ records }) { caseRecords = records; return records.length; },
  async analyse({ opts, watchlist }) { return E.analyseAll(caseRecords, { ...opts, watchlist }); },
  async exhibits({ ctx, target }) { return E.buildExhibits(target ? caseRecords.filter((r) => r.a === target || r.b === target) : caseRecords, ctx); },
  async graph({ opts }) { return E.buildGraph(caseRecords, opts); },
  async ego({ graph, id, hops }) { return E.egoNetwork(graph, id, hops); },
  async report({ kind, ctx, filter }) { const rs = filter ? E.applyFilter(caseRecords, filter, ctx.tz) : caseRecords; return E.buildReport(kind, rs, { ...ctx, filterText: filter ? E.describeFilter(filter, ctx.tz) : undefined }); },
  async reportHtml({ report, charts }) { return E.reportToHtml(report, charts); },
  async reportCsv({ report }) { return E.reportToCsv(report); },
  async xlsx({ sheets }) { return E.writeXlsx(sheets); },
  async coLocation({ opts, towers }) { return E.coLocation(caseRecords, { ...opts, keyOf: towers?.length ? E.siteKey(towers) : undefined }); },
  async filter({ filter, tz }) { return E.applyFilter(caseRecords, filter, tz); },
  async encrypt({ payload, pass }) { return E.encryptBundle(payload, pass); },
  async decrypt({ bytes, pass }) { return E.decryptBundle(new Uint8Array(bytes), pass); },
  async sha256({ bytes }) { return E.sha256Hex(new Uint8Array(bytes)); },
};

self.onmessage = async (ev) => {
  const { id, op, args } = ev.data;
  try {
    const result = await ops[op](args || {});
    self.postMessage({ id, ok: true, result });
  } catch (e) {
    self.postMessage({ id, ok: false, error: e?.message || String(e) });
  }
};
