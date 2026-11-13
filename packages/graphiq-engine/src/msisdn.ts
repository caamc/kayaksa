// Phone number normalisation. Indian operators write the same number many ways: 9800000101,
// 09800000101, 919800000101, +91 98000 00101, 0091-98000-00101. Everything becomes E.164
// (+919800000101). Short codes (121, 1909) and alphanumeric SMS senders (VM-HDFCBK) are kept as-is.

export interface MsisdnResult { value: string; valid: boolean; kind: "e164" | "short" | "alpha" | "empty" | "invalid" }

export function normaliseMsisdn(raw: unknown, cc = "91"): MsisdnResult {
  let s = String(raw ?? "").trim();
  if (!s || /^(null|nil|na|n\/a|-|0)$/i.test(s)) return { value: "", valid: false, kind: "empty" };
  // Numbers stored by spreadsheets as 9.8E+09 or 919800000101.0
  if (/^\d+(\.0+)?$/.test(s)) s = s.replace(/\.0+$/, "");
  else if (/^\d(\.\d+)?e\+?\d+$/i.test(s)) s = BigInt(Math.round(Number(s))).toString();
  // Alphanumeric SMS headers: letters present and few digits.
  if (/[a-z]/i.test(s) && (s.match(/\d/g) || []).length < 6) {
    const v = s.toUpperCase().replace(/\s+/g, "").slice(0, 20);
    return { value: v, valid: true, kind: "alpha" };
  }
  const plus = s.startsWith("+");
  let d = s.replace(/\D/g, "");
  if (!d) return { value: "", valid: false, kind: "invalid" };
  if (!plus && d.length <= 6) return { value: d, valid: true, kind: "short" };
  if (plus) return check(d);
  if (d.startsWith("00")) return check(d.slice(2));
  if (cc === "91") {
    if (d.length === 10 && /^[6-9]/.test(d)) return check("91" + d);
    if (d.length === 11 && d.startsWith("0")) return check("91" + d.slice(1));
    if (d.length === 12 && d.startsWith("91")) return check(d);
    if (d.length === 13 && d.startsWith("091")) return check(d.slice(1));
    // Landline written without the trunk 0 (e.g. 1123456789) is ambiguous with mobile; 10 digits not
    // starting 6-9 is treated as a national landline number.
    if (d.length === 10) return check("91" + d);
    if (d.length > 12) return check(d); // already international without +
    return { value: d, valid: false, kind: "invalid" };
  }
  if (d.startsWith("0")) return check(cc + d.replace(/^0+/, ""));
  if (d.length >= 11) return check(d);
  return check(cc + d);
}

function check(d: string): MsisdnResult {
  const v = "+" + d;
  if (d.length < 8 || d.length > 15) return { value: v, valid: false, kind: "invalid" };
  if (d.startsWith("91") && d.length !== 12) return { value: v, valid: false, kind: "invalid" };
  return { value: v, valid: true, kind: "e164" };
}

/** Readable form: +91 98000 00101. */
export function displayMsisdn(v: string): string {
  if (!v || !v.startsWith("+")) return v || "";
  if (v.startsWith("+91") && v.length === 13) return `+91 ${v.slice(3, 8)} ${v.slice(8)}`;
  return v;
}

/** IMEI: 15 digits with a Luhn check digit (14 + check). IMEISV (16) has no check digit. */
export function cleanImei(raw: unknown): { value: string; valid: boolean } {
  let d = String(raw ?? "").replace(/\.0+$/, "").replace(/\D/g, "");
  if (!d) return { value: "", valid: false };
  if (d.length === 14) d = d + luhnDigit(d); // operators often drop the check digit
  if (d.length === 16) return { value: d, valid: true };
  return { value: d, valid: d.length === 15 && luhnDigit(d.slice(0, 14)) === d[14] };
}

export function luhnDigit(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    let n = Number(body[body.length - 1 - i]);
    if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return String((10 - (sum % 10)) % 10);
}

/** Type Allocation Code: the first 8 digits of an IMEI identify the device model (lookup needs the GSMA database). */
export const tacOf = (imei: string) => (imei && imei.length >= 8 ? imei.slice(0, 8) : "");
