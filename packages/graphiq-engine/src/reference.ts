// Offline reference data: international (ISD) codes, major Indian STD codes, Indian MCC/MNC codes
// and a sample of long-standing Indian mobile number series. Nothing here is looked up online.
//
// Accuracy notes, shown in the app next to every lookup:
//  - Mobile number portability (MNP, since 2011) means the operator that first held a number
//    series may not be the operator serving the number today. The series tells you only the
//    original allocation.
//  - The bundled series table is a sample. Agencies should load the current DoT/TRAI numbering
//    plan as reference data (planned import) before relying on operator or circle lookups.
//  - MCC/MNC codes are indicative and should be checked against the current ITU-T E.212 list.

export const REFERENCE_NOTE =
  "Offline reference data. Number series show the operator that was originally allocated the series; with mobile number portability the current operator may differ. The bundled series table is a sample, not the full numbering plan.";

/** International calling codes (ITU-T E.164). Longest prefix wins. */
export const ISD: Record<string, string> = {
  "1": "United States / Canada", "7": "Russia / Kazakhstan", "20": "Egypt", "27": "South Africa", "30": "Greece", "31": "Netherlands",
  "32": "Belgium", "33": "France", "34": "Spain", "36": "Hungary", "39": "Italy", "40": "Romania", "41": "Switzerland", "43": "Austria",
  "44": "United Kingdom", "45": "Denmark", "46": "Sweden", "47": "Norway", "48": "Poland", "49": "Germany", "51": "Peru", "52": "Mexico",
  "53": "Cuba", "54": "Argentina", "55": "Brazil", "56": "Chile", "57": "Colombia", "58": "Venezuela", "60": "Malaysia", "61": "Australia",
  "62": "Indonesia", "63": "Philippines", "64": "New Zealand", "65": "Singapore", "66": "Thailand", "81": "Japan", "82": "South Korea",
  "84": "Vietnam", "86": "China", "90": "Turkey", "91": "India", "92": "Pakistan", "93": "Afghanistan", "94": "Sri Lanka", "95": "Myanmar",
  "98": "Iran", "211": "South Sudan", "212": "Morocco", "213": "Algeria", "216": "Tunisia", "218": "Libya", "220": "Gambia", "221": "Senegal",
  "233": "Ghana", "234": "Nigeria", "237": "Cameroon", "244": "Angola", "249": "Sudan", "250": "Rwanda", "251": "Ethiopia", "252": "Somalia",
  "253": "Djibouti", "254": "Kenya", "255": "Tanzania", "256": "Uganda", "260": "Zambia", "263": "Zimbabwe", "264": "Namibia", "265": "Malawi",
  "230": "Mauritius", "248": "Seychelles", "258": "Mozambique", "261": "Madagascar", "351": "Portugal", "352": "Luxembourg", "353": "Ireland",
  "354": "Iceland", "356": "Malta", "357": "Cyprus", "358": "Finland", "359": "Bulgaria", "370": "Lithuania", "371": "Latvia", "372": "Estonia",
  "373": "Moldova", "374": "Armenia", "375": "Belarus", "380": "Ukraine", "381": "Serbia", "385": "Croatia", "386": "Slovenia", "420": "Czechia",
  "421": "Slovakia", "852": "Hong Kong", "853": "Macau", "855": "Cambodia", "856": "Laos", "880": "Bangladesh", "886": "Taiwan", "960": "Maldives",
  "961": "Lebanon", "962": "Jordan", "963": "Syria", "964": "Iraq", "965": "Kuwait", "966": "Saudi Arabia", "967": "Yemen", "968": "Oman",
  "970": "Palestine", "971": "United Arab Emirates", "972": "Israel", "973": "Bahrain", "974": "Qatar", "975": "Bhutan", "976": "Mongolia",
  "977": "Nepal", "992": "Tajikistan", "993": "Turkmenistan", "994": "Azerbaijan", "995": "Georgia", "996": "Kyrgyzstan", "998": "Uzbekistan",
  "870": "Inmarsat (satellite)", "881": "Global Mobile Satellite System", "882": "International Networks",
};

/** Major Indian STD (trunk) codes, without the leading 0. */
export const STD: Record<string, string> = {
  "11": "Delhi", "22": "Mumbai", "33": "Kolkata", "44": "Chennai", "80": "Bengaluru", "40": "Hyderabad", "20": "Pune", "79": "Ahmedabad",
  "141": "Jaipur", "522": "Lucknow", "172": "Chandigarh", "484": "Kochi", "471": "Thiruvananthapuram", "422": "Coimbatore", "261": "Surat",
  "265": "Vadodara", "712": "Nagpur", "731": "Indore", "755": "Bhopal", "612": "Patna", "674": "Bhubaneswar", "361": "Guwahati", "135": "Dehradun",
  "191": "Jammu", "194": "Srinagar", "177": "Shimla", "183": "Amritsar", "161": "Ludhiana", "512": "Kanpur", "542": "Varanasi", "532": "Prayagraj",
  "562": "Agra", "120": "Ghaziabad / Noida", "124": "Gurugram", "129": "Faridabad", "832": "Panaji (Goa)", "824": "Mangaluru", "821": "Mysuru",
  "891": "Visakhapatnam", "866": "Vijayawada", "452": "Madurai", "413": "Puducherry", "651": "Ranchi", "657": "Jamshedpur", "771": "Raipur",
  "253": "Nashik", "240": "Chhatrapati Sambhajinagar", "231": "Kolhapur", "281": "Rajkot", "291": "Jodhpur", "294": "Udaipur", "145": "Ajmer",
  "121": "Meerut", "571": "Aligarh", "581": "Bareilly", "551": "Gorakhpur", "631": "Gaya", "621": "Muzaffarpur", "353": "Siliguri", "343": "Durgapur",
  "364": "Shillong", "385": "Imphal", "381": "Agartala", "389": "Aizawl", "370": "Kohima", "360": "Itanagar", "3192": "Port Blair", "1882": "Hoshiarpur",
};

/** Indian mobile network codes (MCC 404/405). Indicative; check against the current ITU-T E.212 list. */
export const MCC_MNC: Record<string, { operator: string; circle: string }> = {
  "404-02": { operator: "Airtel", circle: "Punjab" }, "404-03": { operator: "Airtel", circle: "Himachal Pradesh" }, "404-10": { operator: "Airtel", circle: "Delhi" },
  "404-16": { operator: "Airtel", circle: "North East" }, "404-31": { operator: "Airtel", circle: "Kolkata" }, "404-40": { operator: "Airtel", circle: "Chennai" },
  "404-45": { operator: "Airtel", circle: "Karnataka" }, "404-49": { operator: "Airtel", circle: "Andhra Pradesh" }, "404-70": { operator: "Airtel", circle: "Rajasthan" },
  "404-90": { operator: "Airtel", circle: "Maharashtra" }, "404-92": { operator: "Airtel", circle: "Mumbai" }, "404-93": { operator: "Airtel", circle: "Madhya Pradesh" },
  "404-94": { operator: "Airtel", circle: "Tamil Nadu" }, "404-95": { operator: "Airtel", circle: "Kerala" }, "404-96": { operator: "Airtel", circle: "Haryana" },
  "404-97": { operator: "Airtel", circle: "UP West" }, "404-98": { operator: "Airtel", circle: "Gujarat" },
  "404-11": { operator: "Vodafone Idea", circle: "Delhi" }, "404-20": { operator: "Vodafone Idea", circle: "Mumbai" }, "404-05": { operator: "Vodafone Idea", circle: "Gujarat" },
  "404-27": { operator: "Vodafone Idea", circle: "Maharashtra" }, "404-30": { operator: "Vodafone Idea", circle: "Kolkata" }, "404-43": { operator: "Vodafone Idea", circle: "Tamil Nadu" },
  "404-84": { operator: "Vodafone Idea", circle: "Chennai" }, "404-86": { operator: "Vodafone Idea", circle: "Karnataka" }, "404-88": { operator: "Vodafone Idea", circle: "Punjab" },
  "404-04": { operator: "Vodafone Idea", circle: "Delhi" }, "404-07": { operator: "Vodafone Idea", circle: "Andhra Pradesh" }, "404-12": { operator: "Vodafone Idea", circle: "Haryana" },
  "404-22": { operator: "Vodafone Idea", circle: "Maharashtra" }, "404-24": { operator: "Vodafone Idea", circle: "Gujarat" }, "404-44": { operator: "Vodafone Idea", circle: "Karnataka" },
  "404-34": { operator: "BSNL", circle: "Haryana" }, "404-38": { operator: "BSNL", circle: "Assam" }, "404-51": { operator: "BSNL", circle: "Himachal Pradesh" },
  "404-53": { operator: "BSNL", circle: "Punjab" }, "404-54": { operator: "BSNL", circle: "UP West" }, "404-55": { operator: "BSNL", circle: "UP East" },
  "404-57": { operator: "BSNL", circle: "Gujarat" }, "404-58": { operator: "BSNL", circle: "Madhya Pradesh" }, "404-59": { operator: "BSNL", circle: "Rajasthan" },
  "404-62": { operator: "BSNL", circle: "Jammu & Kashmir" }, "404-64": { operator: "BSNL", circle: "Chennai" }, "404-66": { operator: "BSNL", circle: "Maharashtra" },
  "404-71": { operator: "BSNL", circle: "Karnataka" }, "404-72": { operator: "BSNL", circle: "Kerala" }, "404-73": { operator: "BSNL", circle: "Andhra Pradesh" },
  "404-74": { operator: "BSNL", circle: "West Bengal" }, "404-75": { operator: "BSNL", circle: "Bihar" }, "404-76": { operator: "BSNL", circle: "Odisha" },
  "404-77": { operator: "BSNL", circle: "North East" }, "404-80": { operator: "BSNL", circle: "Tamil Nadu" }, "404-81": { operator: "BSNL", circle: "Kolkata" },
  "404-68": { operator: "MTNL", circle: "Delhi" }, "404-69": { operator: "MTNL", circle: "Mumbai" },
  "405-51": { operator: "Airtel", circle: "West Bengal" }, "405-52": { operator: "Airtel", circle: "Bihar" }, "405-53": { operator: "Airtel", circle: "Odisha" },
  "405-54": { operator: "Airtel", circle: "UP East" }, "405-55": { operator: "Airtel", circle: "Jammu & Kashmir" }, "405-56": { operator: "Airtel", circle: "Assam" },
  "405-840": { operator: "Jio", circle: "West Bengal" }, "405-854": { operator: "Jio", circle: "Andhra Pradesh" }, "405-855": { operator: "Jio", circle: "Assam" },
  "405-856": { operator: "Jio", circle: "Bihar" }, "405-857": { operator: "Jio", circle: "Gujarat" }, "405-858": { operator: "Jio", circle: "Haryana" },
  "405-859": { operator: "Jio", circle: "Himachal Pradesh" }, "405-860": { operator: "Jio", circle: "Jammu & Kashmir" }, "405-861": { operator: "Jio", circle: "Karnataka" },
  "405-862": { operator: "Jio", circle: "Kerala" }, "405-863": { operator: "Jio", circle: "Madhya Pradesh" }, "405-864": { operator: "Jio", circle: "Maharashtra" },
  "405-865": { operator: "Jio", circle: "North East" }, "405-866": { operator: "Jio", circle: "Odisha" }, "405-867": { operator: "Jio", circle: "Punjab" },
  "405-868": { operator: "Jio", circle: "Rajasthan" }, "405-869": { operator: "Jio", circle: "Tamil Nadu" }, "405-870": { operator: "Jio", circle: "UP West" },
  "405-871": { operator: "Jio", circle: "UP East" }, "405-872": { operator: "Jio", circle: "Delhi" }, "405-873": { operator: "Jio", circle: "Kolkata" },
  "405-874": { operator: "Jio", circle: "Mumbai" },
};

/**
 * A sample of long-standing Indian mobile series (first four digits of the 10-digit number) and the
 * operator and licence area they were originally allocated to. Not the full numbering plan.
 */
export const MOBILE_SERIES: Record<string, { operator: string; circle: string }> = {
  "9412": { operator: "BSNL", circle: "UP West" }, "9414": { operator: "BSNL", circle: "Rajasthan" }, "9415": { operator: "BSNL", circle: "UP East" },
  "9416": { operator: "BSNL", circle: "Haryana" }, "9417": { operator: "BSNL", circle: "Punjab" }, "9418": { operator: "BSNL", circle: "Himachal Pradesh" },
  "9419": { operator: "BSNL", circle: "Jammu & Kashmir" }, "9422": { operator: "BSNL", circle: "Maharashtra" }, "9423": { operator: "BSNL", circle: "Maharashtra" },
  "9425": { operator: "BSNL", circle: "Madhya Pradesh" }, "9426": { operator: "BSNL", circle: "Gujarat" }, "9427": { operator: "BSNL", circle: "Gujarat" },
  "9431": { operator: "BSNL", circle: "Bihar" }, "9434": { operator: "BSNL", circle: "West Bengal" }, "9435": { operator: "BSNL", circle: "Assam" },
  "9436": { operator: "BSNL", circle: "North East" }, "9437": { operator: "BSNL", circle: "Odisha" }, "9440": { operator: "BSNL", circle: "Andhra Pradesh" },
  "9443": { operator: "BSNL", circle: "Tamil Nadu" }, "9444": { operator: "BSNL", circle: "Chennai" }, "9446": { operator: "BSNL", circle: "Kerala" },
  "9447": { operator: "BSNL", circle: "Kerala" }, "9448": { operator: "BSNL", circle: "Karnataka" }, "9449": { operator: "BSNL", circle: "Karnataka" },
  "9810": { operator: "Airtel", circle: "Delhi" }, "9818": { operator: "Airtel", circle: "Delhi" }, "9811": { operator: "Vodafone Idea", circle: "Delhi" },
  "9868": { operator: "MTNL", circle: "Delhi" }, "9869": { operator: "MTNL", circle: "Mumbai" }, "9820": { operator: "Vodafone Idea", circle: "Mumbai" },
  "9830": { operator: "Vodafone Idea", circle: "Kolkata" }, "9831": { operator: "Airtel", circle: "Kolkata" }, "9840": { operator: "Airtel", circle: "Chennai" },
  "9845": { operator: "Airtel", circle: "Karnataka" }, "9884": { operator: "Vodafone Idea", circle: "Chennai" },
};

export interface NumberInfo {
  number: string;
  kind: "mobile" | "landline" | "international" | "short code" | "alphanumeric" | "unknown";
  country?: string;
  isd?: string;
  operator?: string;
  circle?: string;
  city?: string;
  note: string;
}

export function isdOf(e164: string): { code: string; country: string } | null {
  const d = e164.replace(/^\+/, "");
  for (let n = 4; n >= 1; n--) {
    const p = d.slice(0, n);
    if (ISD[p]) return { code: p, country: ISD[p] };
  }
  return null;
}

/** Offline lookup for a normalised number (see normaliseMsisdn). */
export function lookupNumber(num: string, extraSeries: Record<string, { operator: string; circle: string }> = {}): NumberInfo {
  if (!num) return { number: num, kind: "unknown", note: "" };
  if (/[A-Z]/i.test(num)) return { number: num, kind: "alphanumeric", note: "Alphanumeric SMS sender (business or bulk SMS header)." };
  if (!num.startsWith("+")) return { number: num, kind: "short code", note: "Short code or service number; not a subscriber number." };
  const isd = isdOf(num);
  if (!isd) return { number: num, kind: "unknown", note: "Country code not recognised." };
  if (isd.code !== "91") return { number: num, kind: "international", country: isd.country, isd: isd.code, note: `International number (${isd.country}).` };
  const n = num.slice(3);
  if (/^[6-9]\d{9}$/.test(n)) {
    const s = extraSeries[n.slice(0, 5)] || extraSeries[n.slice(0, 4)] || MOBILE_SERIES[n.slice(0, 4)];
    return { number: num, kind: "mobile", country: "India", isd: "91", operator: s?.operator, circle: s?.circle,
      note: s ? "Original series allocation; the number may have been ported (MNP)." : "Mobile series not in the bundled sample table." };
  }
  for (let k = 4; k >= 2; k--) {
    const std = STD[n.slice(0, k)];
    if (std) return { number: num, kind: "landline", country: "India", isd: "91", city: std, note: `Landline, STD code 0${n.slice(0, k)}.` };
  }
  return { number: num, kind: "landline", country: "India", isd: "91", note: "Indian number; STD code not in the bundled table." };
}

/** MCC/MNC from an IMSI (first 5 or 6 digits). */
export function imsiNetwork(imsi: string): { mcc: string; mnc: string; operator?: string; circle?: string } | null {
  const d = (imsi || "").replace(/\D/g, "");
  if (d.length < 6) return null;
  const mcc = d.slice(0, 3);
  const three = MCC_MNC[`${mcc}-${d.slice(3, 6)}`];
  if (three) return { mcc, mnc: d.slice(3, 6), ...three };
  const two = MCC_MNC[`${mcc}-${d.slice(3, 5)}`];
  return { mcc, mnc: d.slice(3, 5), ...(two || {}) };
}
