// Unit tests for Kay's languages: client-pack switches, engine routing, the voice notice, the browser
// transliteration rules and the recording seal. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { tmpdir } from "node:os";
import { join } from "node:path";

const bundle = (src, name) => {
  const out = join(tmpdir(), `${name}-${process.pid}.mjs`);
  buildSync({ entryPoints: [new URL(src, import.meta.url).pathname], bundle: true, format: "esm", platform: "neutral", outfile: out, logLevel: "error" });
  return import(out);
};
const K = await bundle("../../apps/www/src/kay-languages.ts", "kay-languages");
const S = await bundle("../../packages/core/src/voiceseal.ts", "voiceseal");
const X = await import(new URL("../../apps/www/public/assets/kay-xlit.js", import.meta.url).href);

test("pack: empty or 'all' switches everything on", () => {
  for (const raw of [undefined, "", "all", " ALL "]) assert.deepEqual([...K.parsePack(raw)].sort(), [...K.FEATURES].sort());
});
test("pack: a list switches on only those features, and 'all,-x' removes one", () => {
  assert.deepEqual([...K.parsePack("kayak_ai,voice_in,unknown")].sort(), ["kayak_ai", "voice_in"]);
  const p = K.parsePack("all,-recordings,-kayak_ai_plus");
  assert.ok(!p.has("recordings") && !p.has("kayak_ai_plus") && p.has("kayak_ai") && p.has("translate"));
});
test("pack: at least one engine always stays on", () => {
  assert.ok(K.parsePack("translate").has("kayak_ai_plus"));
  assert.ok(K.parsePack("all,-kayak_ai,-kayak_ai_plus").has("kayak_ai_plus"));
});
test("mode: the visitor's choice when the pack and keys allow it, otherwise the other engine", () => {
  const all = K.parsePack("all");
  assert.equal(K.pickMode("kayak_ai", all, true, true), "kayak_ai");
  assert.equal(K.pickMode("kayak_ai_plus", all, true, true), "kayak_ai_plus");
  assert.equal(K.pickMode("kayak_ai_plus", all, false, true), "kayak_ai");
  assert.equal(K.pickMode("kayak_ai", K.parsePack("kayak_ai_plus"), true, true), "kayak_ai_plus");
  assert.equal(K.pickMode(undefined, all, false, false), null);
});
test("languages: Whisper's 100, the 22 scheduled languages, and 100+ in the picker", () => {
  assert.equal(K.WHISPER.length, 100);
  assert.equal(new Set(K.WHISPER).size, 100);
  assert.equal(K.SCHEDULED.length, 22);
  assert.equal(K.M2M100.length, 100);
  for (const c of K.SCHEDULED) assert.ok(K.ALL.includes(c), c);
  assert.ok(K.ALL.length >= 120);
  assert.equal(K.norm("hi-IN"), "hi"); assert.equal(K.norm("jw"), "jv"); assert.equal(K.norm("kok"), "gom");
});
test("translate: IndicTrans2 from English, M2M-100 between others, English as the bridge", () => {
  assert.deepEqual(K.translatePlan("en", "hi", { engine: false, llm: false }), [{ engine: "indictrans2", from: "en", to: "hi" }]);
  assert.deepEqual(K.translatePlan("fr", "de", { engine: false, llm: false }), [{ engine: "m2m100", from: "fr", to: "de" }]);
  assert.deepEqual(K.translatePlan("hi", "en", { engine: false, llm: false }), [{ engine: "m2m100", from: "hi", to: "en" }]);
  // Santali is not in M2M-100: French -> English (M2M-100) -> Santali (IndicTrans2)
  assert.deepEqual(K.translatePlan("fr", "sat", { engine: false, llm: false }).map((s) => s.engine), ["m2m100", "indictrans2"]);
  assert.deepEqual(K.translatePlan("hi", "hi", { engine: false, llm: false }), []);
  assert.deepEqual(K.translatePlan("en", "hi", { engine: true, llm: false }), [{ engine: "engine", from: "en", to: "hi" }]);
  assert.equal(K.translatePlan("sat", "fr", { engine: false, llm: false }), null);
  assert.deepEqual(K.translatePlan("sat", "fr", { engine: false, llm: true }), [{ engine: "llm", from: "sat", to: "fr" }]);
});
test("voices: AI4Bharat first for Indian languages on Kayak AI+, the device voice always last", () => {
  const o = { engine: true, gemini: true, openai: true, melo: true };
  assert.deepEqual(K.voicePlan("ta", "kayak_ai_plus", o), ["engine", "gemini", "openai", "device"]);
  assert.deepEqual(K.voicePlan("en", "kayak_ai_plus", o), ["gemini", "engine", "openai", "device"]);
  assert.deepEqual(K.voicePlan("fr", "kayak_ai", o), ["melo", "device"]);
  assert.deepEqual(K.voicePlan("sw", "kayak_ai", { ...o, engine: false }), ["device"]);
});
test("listening: Kayak AI never falls back to an outside company", () => {
  assert.deepEqual(K.listenPlan("kayak_ai", { engine: true, workers: true, gemini: true, openai: true }), ["workers", "engine"]);
  assert.deepEqual(K.listenPlan("kayak_ai_plus", { engine: true, workers: true, gemini: true, openai: false }), ["engine", "workers", "gemini"]);
});
test("chunks: long text goes to the translators in sentence groups, keeping line breaks", () => {
  const t = "First sentence. Second one!\n\n- a bullet\n" + "Long sentence ".repeat(40) + "end.";
  const parts = K.chunks(t, 120);
  assert.ok(parts.every((p) => p.text.length <= 120), "no piece over the limit");
  assert.equal(parts.map((p) => p.text + p.sep).join("").replace(/\s+/g, " ").trim(), t.replace(/\s+/g, " ").trim());
  assert.ok(parts.some((p) => p.sep === "\n\n"));
  assert.deepEqual(K.chunks("नमस्ते। आप कैसे हैं?", 300), [{ text: "नमस्ते। आप कैसे हैं?", sep: "" }]);
});
test("guessLanguage reads the script", () => {
  assert.equal(K.guessLanguage("नमस्ते"), "hi"); assert.equal(K.guessLanguage("வணக்கம்"), "ta"); assert.equal(K.guessLanguage("آپ کیسے ہیں"), "ur");
  assert.equal(K.guessLanguage("مرحبا"), "ar"); assert.equal(K.guessLanguage("Hello"), "en");
});
test("voice notice: says what is kept, why, who never gets it, and for how long", () => {
  const n = K.voiceNotice(true, 365);
  const t = n.points.join(" ");
  assert.equal(n.version, K.VOICE_NOTICE_VERSION);
  for (const w of ["saved", "train and improve", "not shared", "investigators", "law or an order of a court", "365 days", "delete your recordings", "18"]) assert.ok(t.includes(w), w);
  assert.ok(!K.voiceNotice(false, 365).points.join(" ").includes("saved on Kayak"));
});
test("transliteration: Roman letters to Indian scripts", () => {
  const cases = [["namaste", "hi", "नमस्ते"], ["aap kaise hain", "hi", "आप कैसे हैं"], ["kya haal hai", "hi", "क्या हाल है"], ["main theek hoon", "hi", "मैं थीक हूं"],
    ["dhanyavaad", "sa", "धन्यवाद्"], ["kem chho", "gu", "કેમ છો"], ["sat sri akal", "pa", "ਸਤ ਸ੍ਰਿ ਅਕਲ"], ["namaskaaram", "ml", "നമസ്കാരം"], ["namaskaram", "te", "నమస్కరం"],
    ["vanakkam", "ta", "வநக்கம்"], ["namaskar", "bn", "নমস্কর"], ["Kayak 2026!", "hi", "कयक 2026!"], ["zara", "hi", "ज़रा"]];
  for (const [r, l, want] of cases) assert.equal(X.toNative(r, l), want, `${l}: ${r}`);
  assert.equal(X.toNative("hello", "fr"), "hello");
  assert.equal(X.supports("ta"), true); assert.equal(X.supports("ar"), false);
});
test("transliteration: back to Roman letters", () => {
  assert.equal(X.toRoman("नमस्ते", "hi"), "namaste");
  assert.equal(X.toRoman("आप कैसे हैं", "hi"), "aap kaise hain");
  assert.equal(X.toRoman("ज्ञान", "hi"), "gyaan");
  assert.equal(X.toRoman("ज़रा", "hi"), "zaraa");
  assert.equal(X.toRoman("నమస్కారం", "te"), "namaskaaram");
  assert.equal(X.toRoman("নমস্কার", "bn"), "namaskaar");
});
test("recording seal: round trip, a fresh IV each time, and a wrong key fails", async () => {
  const key = "k".repeat(40);
  const a = await S.sealText(key, "नमस्ते Kay"), b = await S.sealText(key, "नमस्ते Kay");
  assert.notEqual(a, b);
  assert.equal(await S.unsealText(key, a), "नमस्ते Kay");
  await assert.rejects(S.unsealText("x".repeat(40), a));
  await assert.rejects(S.sealText("short", "x"));
  const bytes = new Uint8Array([1, 2, 3, 250]);
  assert.deepEqual([...(await S.unsealBytes(key, await S.sealBytes(key, bytes)))], [...bytes]);
});
