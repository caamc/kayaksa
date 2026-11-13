// Kayak GraphIQ analysis engine: shared types.
// Pure TypeScript with no platform dependencies, so the same code runs in a Cloudflare Worker,
// a browser Web Worker or Node (for on-premise use).

/** Normalised call type. MO = outgoing call, MT = incoming call. */
export type CallType = "MO" | "MT" | "SMS-MO" | "SMS-MT" | "MISSED" | "DATA" | "OTHER";
export const CALL_TYPES: CallType[] = ["MO", "MT", "SMS-MO", "SMS-MT", "MISSED", "DATA", "OTHER"];

/**
 * One normalised call detail record. `a` is always the subscriber whose records these are (the
 * target), `b` the other party, whatever order the operator's file used.
 */
export interface CdrRecord {
  id?: number;
  a: string;
  b: string;
  /** Start time, UTC epoch milliseconds. */
  ts: number;
  /** Duration in seconds. */
  dur: number;
  type: CallType;
  imei?: string;
  imsi?: string;
  /** First cell (cell ID or CGI) as given by the operator. */
  cell?: string;
  lastCell?: string;
  lac?: string;
  lat?: number | null;
  lon?: number | null;
  /** Roaming network or circle, when the operator gives one. */
  roam?: string;
  op?: string;
  /** Source file name and row (1-based) for traceability back to the original. */
  src?: string;
  row?: number;
}

/** The fields a column can be mapped to. */
export type Field =
  | "a" | "b" | "target" | "calling" | "called" | "date" | "time" | "datetime" | "endtime" | "dur" | "type"
  | "imei" | "imsi" | "cell" | "lastCell" | "lac" | "lat" | "lon" | "roam" | "op" | "cellAddr" | "ignore";

export interface Mapping {
  /** Column index for each field (only fields that are present). */
  cols: Partial<Record<Field, number>>;
  /** Index of the header row in the raw table. */
  headerRow: number;
  /** "target-other": A party is the target. "calling-called": calling/called columns; swapped for incoming. */
  parties: "target-other" | "calling-called";
  /** Date order for ambiguous dates like 03/04/2026. */
  dateOrder: "dmy" | "mdy" | "ymd";
  /** IANA time zone the operator's times are in (India: Asia/Kolkata). */
  tz: string;
  /** Default country calling code for national numbers. */
  cc: string;
}

export interface Detection {
  mapping: Mapping;
  /** Layout the headers resemble, e.g. "Airtel-style". Indicative only. */
  layout: string;
  /** 0..1, share of required fields found. */
  confidence: number;
  headers: string[];
  unmapped: string[];
  missing: Field[];
}

export interface Issue { row: number; kind: string; detail: string }

export interface Validation {
  rows: number;
  imported: number;
  rejected: number;
  duplicates: number;
  warnings: Record<string, number>;
  errors: Record<string, number>;
  /** First few issues of each kind, for the report. */
  samples: Issue[];
  from: number | null;
  to: number | null;
  targets: string[];
  distinctNumbers: number;
}

/** Search filter, shared by the browser, the Worker (SQL) and the AI assistant. */
export interface Filter {
  numbers?: string[];
  /** Match numbers in either party (default) or only A or only B. */
  side?: "any" | "a" | "b";
  from?: number;
  to?: number;
  /** Local time of day window, "HH:MM". Wraps past midnight when timeFrom > timeTo. */
  timeFrom?: string;
  timeTo?: string;
  durMin?: number;
  durMax?: number;
  types?: CallType[];
  imei?: string;
  imsi?: string;
  cell?: string;
  weekdays?: number[];
}

export interface TableSection {
  heading: string;
  note?: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface Report {
  kind: string;
  title: string;
  subtitle?: string;
  generatedAt: string;
  sections: TableSection[];
  disclaimer: string;
}

export interface Tower {
  cell: string;
  lat: number;
  lon: number;
  address?: string;
  azimuth?: number | null;
}
