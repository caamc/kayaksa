// Kayak Learn prices. Every course has a list price of INR 15,000 and an offer price of INR 10,000
// (33% off). A learning path is priced as the sum of its courses. GST at 18% is added at checkout
// (SAC 999293, commercial training and coaching): CGST + SGST for buyers in Maharashtra, IGST otherwise.
// Amounts are kept in paise to avoid rounding errors.
import { course, path, getCatalog } from "./catalog";

export const PRICING = {
  currency: "INR",
  listPaise: 15_000_00,
  offerPaise: 10_000_00,
  gstRate: 0.18,
  sac: "999293",
  accessMonths: 12,
  supplierState: "Maharashtra",
} as const;

export const STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Outside India",
];

export type ItemKind = "course" | "path";

export function item(kind: ItemKind, id: string) {
  if (kind === "course") {
    const c = course(id);
    return c && c.audience === "public" ? { kind, id, title: c.title, courses: [c.id] } : null;
  }
  const p = path(id);
  return p && p.audience === "public" ? { kind, id, title: p.title, courses: p.courses.filter((x) => course(x)?.audience === "public") } : null;
}

export function priceOf(kind: ItemKind, id: string) {
  const it = item(kind, id);
  if (!it) return null;
  const n = it.courses.length;
  const list = PRICING.listPaise * n, offer = PRICING.offerPaise * n;
  return { ...it, list, offer, saving: list - offer, discountPct: Math.round(((list - offer) / list) * 100) };
}

export function tax(offerPaise: number, buyerState: string) {
  const gst = Math.round(offerPaise * PRICING.gstRate);
  const intra = buyerState === PRICING.supplierState;
  return { taxable: offerPaise, cgst: intra ? Math.round(gst / 2) : 0, sgst: intra ? gst - Math.round(gst / 2) : 0, igst: intra ? 0 : gst, gst, total: offerPaise + gst, intra };
}

/** Prices for the browser: every public course and path. */
export function priceList() {
  const C = getCatalog();
  const out: Record<string, any> = {};
  for (const c of C.courses) if (c.audience === "public") out[`course:${c.id}`] = priceOf("course", c.id);
  for (const p of C.paths) if (p.audience === "public") out[`path:${p.id}`] = priceOf("path", p.id);
  return { ...PRICING, items: out, states: STATES };
}

export const rupees = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 });
