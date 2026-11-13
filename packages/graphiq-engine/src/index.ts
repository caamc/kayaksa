// Kayak GraphIQ analysis engine. Pure TypeScript, no platform dependencies: the same code runs in
// the GraphIQ Worker, in a browser Web Worker and in Node (for on-premise deployments).
export * from "./types";
export * from "./msisdn";
export * from "./time";
export * from "./reference";
export * from "./parse";
export * from "./xlsx";
export * from "./headers";
export * from "./normalise";
export * from "./analytics";
export * from "./graph";
export * from "./filter";
export * from "./nlq";
export * from "./report";
export * from "./bundle";
export * as charts from "./charts";
export * from "./story";

export const ENGINE_VERSION = "1.0.0";

import type { Table } from "./parse";
import { htmlToTable, parseJson, parseText, sniffFormat, xmlToTable } from "./parse";
import { readXlsx } from "./xlsx";

/** Reads any supported file into a table (the largest sheet for workbooks). PDF is handled by the caller with pdf.js. */
export async function readTable(name: string, bytes: Uint8Array): Promise<{ format: string; table: Table; sheets?: string[] }> {
  const fmt = sniffFormat(name, bytes);
  if (fmt === "xls") throw new Error("Legacy Excel (.xls) files are not supported yet. Open the file in Excel and save it as .xlsx or .csv.");
  if (fmt === "pdf") throw new Error("PDF files are read in the browser with pdf.js.");
  if (fmt === "xlsx") {
    const sheets = await readXlsx(bytes);
    if (!sheets.length) throw new Error("The workbook has no sheets with data.");
    const best = [...sheets].sort((a, b) => b.rows.length - a.rows.length)[0];
    return { format: "xlsx", table: best.rows, sheets: sheets.map((s) => `${s.name} (${s.rows.length} rows)`) };
  }
  const text = new TextDecoder("utf-8").decode(bytes);
  const f = sniffFormat(name, text);
  if (f === "json") return { format: "json", table: parseJson(text) };
  if (f === "xml") return { format: "xml", table: xmlToTable(text) };
  if (f === "html") return { format: "html", table: htmlToTable(text) };
  return { format: f === "txt" ? "txt" : "csv", table: parseText(text) };
}
