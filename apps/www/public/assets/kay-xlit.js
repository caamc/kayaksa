// Kay's transliteration, in the browser: Roman letters to 17 Indian languages' scripts, and back.
// Rule-based and offline (nothing is sent anywhere). Written by Kayak; no third-party code.
//
// Typing scheme: phone-style Roman spelling, with a few capitals for sounds Roman letters lack:
//   aa/A  ii/I/ee  uu/U/oo  e  ai  o  au   R or Ri (ऋ)   M (ं)  H (ः)  ~ (ँ)
//   k kh g gh  ch/c chh  j jh  T Th D Dh N (ट ठ ड ढ ण)  t th d dh n  p ph f b bh m  y r l v/w
//   sh (श)  Sh/shh (ष)  s h  L (ळ)  x/ksh (क्ष)  gy (ज्ञ)  z (ज़)  q (क़)
// "namaste" -> नमस्ते, "aap kaise hain" -> आप कैसे हैं. Devanagari is built first and shifted into the
// other scripts, whose Unicode blocks follow the same layout (ISCII order).

const BASE = { deva: 0x0900, beng: 0x0980, guru: 0x0a00, gujr: 0x0a80, orya: 0x0b00, taml: 0x0b80, telu: 0x0c00, knda: 0x0c80, mlym: 0x0d00 };
const SCRIPT = {
  hi: "deva", mr: "deva", ne: "deva", sa: "deva", mai: "deva", gom: "deva", doi: "deva", brx: "deva",
  bn: "beng", as: "beng", gu: "gujr", pa: "guru", or: "orya", ta: "taml", te: "telu", kn: "knda", ml: "mlym",
};
const SCRIPT_RE = { deva: /\p{Script=Devanagari}/u, beng: /\p{Script=Bengali}/u, guru: /\p{Script=Gurmukhi}/u, gujr: /\p{Script=Gujarati}/u, orya: /\p{Script=Oriya}/u, taml: /\p{Script=Tamil}/u, telu: /\p{Script=Telugu}/u, knda: /\p{Script=Kannada}/u, mlym: /\p{Script=Malayalam}/u };

export const LANGS = Object.keys(SCRIPT);
export const supports = (lang) => !!SCRIPT[lang];

const VIRAMA = "्", NUKTA = "़";
// [roman, independent vowel, vowel sign]
const VOWELS = [
  ["aa", "आ", "ा"], ["A", "आ", "ा"], ["ai", "ऐ", "ै"], ["au", "औ", "ौ"], ["ou", "औ", "ौ"], ["ii", "ई", "ी"], ["ee", "ई", "ी"], ["I", "ई", "ी"],
  ["uu", "ऊ", "ू"], ["oo", "ऊ", "ू"], ["U", "ऊ", "ू"], ["Ri", "ऋ", "ृ"], ["R", "ऋ", "ृ"],
  ["a", "अ", ""], ["i", "इ", "ि"], ["u", "उ", "ु"], ["e", "ए", "े"], ["o", "ओ", "ो"],
];
const CONS = [
  ["ksh", "क्ष"], ["kSh", "क्ष"], ["chh", "छ"], ["shh", "ष"], ["Ch", "छ"], ["kh", "ख"], ["gh", "घ"], ["ch", "च"], ["jh", "झ"],
  ["Th", "ठ"], ["Dh", "ढ"], ["th", "थ"], ["dh", "ध"], ["ph", "फ"], ["bh", "भ"], ["sh", "श"], ["Sh", "ष"], ["gy", "ज्ञ"], ["GY", "ज्ञ"],
  ["~N", "ङ"], ["~n", "ञ"], ["x", "क्ष"], ["k", "क"], ["g", "ग"], ["c", "च"], ["j", "ज"], ["T", "ट"], ["D", "ड"], ["N", "ण"],
  ["t", "त"], ["d", "द"], ["n", "न"], ["p", "प"], ["f", "फ" + NUKTA], ["b", "ब"], ["m", "म"], ["y", "य"], ["r", "र"], ["l", "ल"],
  ["v", "व"], ["w", "व"], ["s", "स"], ["h", "ह"], ["L", "ळ"], ["z", "ज" + NUKTA], ["q", "क" + NUKTA],
];
const MARKS = [["M", "ं"], ["H", "ः"], ["~", "ँ"]];
const byLen = (a) => [...a].sort((x, y) => y[0].length - x[0].length);
const V = byLen(VOWELS), C = byLen(CONS);
// Spelling habits per language, for the end of a word:
//   finalAa   phone-style Hindi: "kya", "tha", "karna" end in आ, not the silent inherent a
//   virama    Sanskrit and Tamil keep a dead final consonant (धन्यवाद्, வணக்கம்)
//   anusvaraM Telugu, Kannada and Malayalam write a final "m" as the anusvara (నమస్కారం)
//   nasalN    Hindi-family "hain", "mein", "hoon" end in the anusvara (हैं, में, हूं)
const HINDI_LIKE = ["hi", "mr", "ne", "mai", "gom", "doi", "brx", "pa", "gu"];
const rules = (lang) => ({
  finalAa: HINDI_LIKE.includes(lang), virama: lang === "sa" || lang === "ta",
  anusvaraM: ["te", "kn", "ml"].includes(lang), nasalN: HINDI_LIKE.includes(lang),
});
const LONG_BEFORE_N = /(ai|ee|ii|ei|oo|uu|o|u|e|I|U)n$/;

/** One word of Roman letters to Devanagari. */
function wordToDeva(w, rule) {
  // Sentence case ("Namaste") is not a retroflex N: lower a leading capital followed by lower case.
  if (/^[A-Z][a-z]/.test(w)) w = w[0].toLowerCase() + w.slice(1);
  let out = "", i = 0, pending = false; // pending: a consonant waiting for its vowel
  const finalAnusvara = w.length > 2 && ((rule.nasalN && LONG_BEFORE_N.test(w)) || (rule.anusvaraM && /[aeiou]m$/.test(w)));
  let end = finalAnusvara ? w.length - 1 : w.length;
  // A final short "a" after a consonant: आ in Hindi-family spelling ("kya" -> क्या).
  if (rule.finalAa && !finalAnusvara && /[^aeiouAEIOU~]a$/.test(w) && w.length > 1) { w = w + "a"; end = w.length; }
  while (i < end) {
    const rest = w.slice(i, end);
    const v = V.find(([r]) => rest.startsWith(r));
    if (v) { out += pending ? v[2] : v[1]; pending = false; i += v[0].length; continue; }
    const m = MARKS.find(([r]) => rest.startsWith(r));
    if (m) { if (pending) { pending = false; } out += m[1]; i += m[0].length; continue; }
    const c = C.find(([r]) => rest.startsWith(r));
    if (c) { if (pending) out += VIRAMA; out += c[1]; pending = true; i += c[0].length; continue; }
    if (pending) { out += VIRAMA; pending = false; }
    out += rest[0]; i += 1;
  }
  if (pending && rule.virama) out += VIRAMA; // a dead final consonant; elsewhere the final "a" sound is silent
  if (finalAnusvara) out += "ं";
  return out;
}

// Sounds a script lacks, written with its nearest letter (Tamil has no aspirated or voiced stops).
const TAMIL = { "ख": "क", "ग": "क", "घ": "क", "छ": "च", "झ": "ஜ", "ठ": "ट", "ड": "ट", "ढ": "ट", "थ": "त", "द": "त", "ध": "त", "फ": "प", "ब": "प", "भ": "प", "श": "ஷ", "ः": "", "ँ": "ं", "ऋ": "रु", "ृ": "्रु" };

function shift(deva, script, lang) {
  if (script === "deva") return deva;
  const base = BASE[script];
  let s = deva;
  if (script === "taml") s = [...s].map((ch) => TAMIL[ch] ?? ch).join("");
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp < 0x0900 || cp > 0x097f) { out += ch; continue; }
    // Bengali script has no "va": Bengali uses ব; Assamese has its own ৰ (ra) and ৱ (wa).
    if (script === "beng" && ch === "व") { out += lang === "as" ? "ৱ" : "ব"; continue; }
    if (script === "beng" && ch === "र" && lang === "as") { out += "ৰ"; continue; }
    if (script === "beng" && ch === "य") { out += "য"; continue; }
    const t = String.fromCodePoint(cp - 0x0900 + base);
    if (SCRIPT_RE[script].test(t)) out += t;
    else if (ch === NUKTA) continue; // scripts without a nukta just drop it
    else out += ch === "ळ" ? String.fromCodePoint(0x0932 - 0x0900 + base) : t; // ळ -> ल where missing
  }
  return out;
}

/** Roman letters to the script of `lang`. Words in other scripts, numbers and punctuation pass through. */
export function toNative(text, lang) {
  const script = SCRIPT[lang];
  if (!script) return text;
  const rule = rules(lang);
  const deva = String(text).replace(/[A-Za-z~]+/g, (w) => wordToDeva(w, rule));
  return shift(deva, script, lang);
}

// ------------------------------------------------------------------ back to Roman letters
const R_VOW = { "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऑ": "o", "ऍ": "e" };
const R_SIGN = { "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e" };
const R_CONS = { "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny", "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n", "ऩ": "n", "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ऱ": "r", "ल": "l", "ळ": "l", "ऴ": "zh", "व": "v", "श": "sh", "ष": "sh", "स": "s", "ह": "h" };
const R_MARK = { "ं": "n", "ः": "h", "ँ": "n", "ऽ": "" };
const DIGITS = "०१२३४५६७८९";

/** Any of the 9 Brahmic scripts above to Roman letters, the way an Indian reader would type it. */
const NUKTA_FORM = { "क": "q", "ख": "kh", "ग": "g", "ज": "z", "ड": "r", "ढ": "rh", "फ": "f", "य": "y" };
export function toRoman(text, lang) {
  // Hindi-family readers drop a word's final inherent "a" (नमस्ते -> namaste, आप -> aap); Dravidian and
  // eastern languages, and Sanskrit, keep it (ನಮಸ್ಕಾರ -> namaskaara).
  const schwa = HINDI_LIKE.includes(lang) || lang === "bn" || lang === "as" || lang === "or";
  // Shift every supported script back to Devanagari positions first.
  let deva = "";
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    let mapped = ch;
    if (ch === "ৰ") mapped = "र"; else if (ch === "ৱ") mapped = "व"; else if (ch === "য") mapped = "य";
    else for (const base of Object.values(BASE)) if (base !== 0x0900 && cp >= base && cp < base + 0x80) { mapped = String.fromCodePoint(cp - base + 0x0900); break; }
    deva += mapped;
  }
  let out = "";
  const chars = [...deva.replace(/ज्ञ/g, "\uE000")];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i], next = chars[i + 1];
    if (ch === NUKTA) continue;
    if (R_CONS[ch] || ch === "\uE000") {
      out += ch === "\uE000" ? "gy" : next === NUKTA ? NUKTA_FORM[ch] || R_CONS[ch] : R_CONS[ch];
      const after = next === NUKTA ? chars[i + 2] : next;
      if (after === VIRAMA) continue;
      if (after && (R_SIGN[after] || after === VIRAMA)) continue;
      const atEnd = !after || !/\p{L}|\p{M}/u.test(after);
      if (!(schwa && atEnd && out.length > 1)) out += "a";
      continue;
    }
    if (ch === VIRAMA) continue;
    if (R_SIGN[ch]) { out += R_SIGN[ch]; continue; }
    if (R_VOW[ch]) { out += R_VOW[ch]; continue; }
    if (ch === "ं" && ["te", "kn", "ml"].includes(lang) && (!next || !/\p{L}|\p{M}/u.test(next))) { out += "m"; continue; }
    if (R_MARK[ch] !== undefined) { out += R_MARK[ch]; continue; }
    const d = DIGITS.indexOf(ch);
    out += d >= 0 ? String(d) : ch === "।" ? "." : ch;
  }
  return out;
}
