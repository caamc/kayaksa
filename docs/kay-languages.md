# Kay in many languages

Kay, the assistant at the bottom right of every page of www.kayaksa.com, can now listen, reply, translate, read aloud and transliterate in more than 100 languages. The visitor picks a language with the globe button (or Kay mirrors the language they write in) and picks an engine:

- **Kayak AI**: Kayak's own open models on Kayak's Cloudflare account (Workers AI). No outside AI company sees the conversation.
- **Kayak AI+**: Claude for answers, Gemini voices, and, when it is connected, Kayak's self-hosted language engine with Whisper large-v3 and AI4Bharat voices.

Code: `apps/www/src/kay-languages.ts` (rules, no network), `apps/www/src/kay-voice.ts` (routes and engines), `apps/www/src/kay.ts` (chat), `apps/www/public/assets/kay.js` and `kay-xlit.js` (panel), `apps/internal/src/website.ts` (staff review). Tests: `tests/unit/kay-languages.test.mjs`.

## What each feature uses

| Feature | Kayak AI | Kayak AI+ | Languages |
| --- | --- | --- | --- |
| Speech to text | Whisper large-v3-turbo on Workers AI | Whisper large-v3 on the language engine, then Workers AI, then Gemini or OpenAI | 99 (100 with the engine) |
| Answers | Llama 3.3 70B on Workers AI. It writes directly in English, Hindi, German, French, Italian, Portuguese, Spanish and Thai; other languages are written in English and translated, and marked as machine translation with "Show English" | Claude (small talk on Gemini Flash Lite), writing directly in the chosen language | any |
| Translation | AI4Bharat IndicTrans2 (English to 29 Indian languages) and Meta M2M-100 (100 languages), with English as the bridge | the language engine (IndicTrans2 both ways, MADLAD-400), then as Kayak AI, then Claude for anything left | 130 in the picker |
| Spoken replies and read aloud | MeloTTS (6 languages) or the language engine's AI4Bharat voices, else the device's own voice | AI4Bharat Indic Parler-TTS for Indian languages (engine), Gemini (24 languages, Kay's own English voice "Iapetus"), OpenAI, else the device's voice | 21 AI4Bharat + 24 Gemini, and whatever the device has |
| Transliteration (type in Roman letters) | in the browser, Kayak's own rules, no network; the server (Llama) for other scripts and for Roman output | engine, then Claude | 17 Indian languages in the browser, any script on the server |

Left out on purpose, because their licences forbid commercial use: Meta Seamless and MMS-TTS, Coqui XTTS, and the non-commercial Piper voices.

## Client packs

`KAY_PACK` (a Worker variable in `apps/www/wrangler.jsonc`) decides what a site offers:

- `all` (default, used on kayaksa.com and the demo): everything.
- A list, for example `kayak_ai,languages,translate`: only those.
- `all,-recordings,-kayak_ai_plus`: everything except those.

Features: `kayak_ai`, `kayak_ai_plus`, `languages`, `voice_in`, `voice_out`, `translate`, `transliterate`, `read_aloud`, `recordings`. At least one engine always stays on. A feature that is off is hidden in the panel and refused by the API with `KAY_FEATURE_NOT_IN_PACK`.

## What Kay hears (the guardrail)

Before Kay first listens, the panel shows a notice (`KAY-VOICE-2026-11-20`) and the visitor must accept it. It says that what Kay hears is saved, encrypted, used only to check Kay's answers and to train and improve Kayak's AI, not shared with Kayak's investigators or any client's investigators unless the law or a court order requires it, kept 365 days, deletable by the visitor at any time, and that only people aged 18 or over should speak. The privacy notice (`/legal#kay-voice`) says the same.

- **Anonymous visitors.** Nobody logs in, so the acceptance is recorded in `consents` (purpose `kay_voice`, notice version) against the random id the site already keeps in the browser (`ksa-vid`). No name, email or IP address. The server refuses to listen (`428 KAY_VOICE_CONSENT_REQUIRED`) until the current version is accepted; a new notice version asks again.
- **Storage.** Audio in the private R2 bucket `kayaksa-kay-voice` (created in the APAC location by the deploy workflow), sealed with AES-256-GCM using `KAY_VOICE_KEY`; the transcript sealed in D1 table `kay_recordings`. Without the key or the bucket, nothing is kept and the notice says so.
- **Retention.** 365 days (`KAY_VOICE_RETENTION_DAYS`), deleted by the daily cron, except under a legal hold.
- **Visitor deletion.** "Delete my voice recordings" in the panel deletes everything recorded in that browser (not anything under a legal hold).
- **Review.** Kayak Internal, Website, Voice recordings: administrators listen, correct the transcript and mark it validated, for training or rejected. Every listen is audited.
- **Release.** Only a super administrator, only on a law or a court order, with its reference and recipient; the recording is then held. Placing and lifting a legal hold is also super administrator only. All audited.
- **Abuse limits.** Per network: 40 recordings in 10 minutes and 200 a day; per site: 3,000 a day (`KAY_VOICE_DAILY_CAP`); at most about a minute or 5 MB per recording. The salted per-day hash of the network address is kept only for abuse checks.

## Running cost

Workers AI (prices from Cloudflare's pricing page, November 2026): 10,000 neurons a day free, then USD 0.011 per 1,000 neurons. Whisper large-v3-turbo USD 0.0005 per audio minute; IndicTrans2 and M2M-100 USD 0.342 per million tokens; MeloTTS USD 0.0002 per audio minute; Llama 3.3 70B USD 0.293 in and USD 2.253 out per million tokens. As a guide, 1,000 Kayak AI chats a month with ten-second voice questions costs a few US dollars, most of it Llama reading Kay's knowledge. R2 storage of a year of recordings stays within the free 10 GB at demo volumes. Kayak AI+ costs what Claude and Gemini cost today.

The language engine (Whisper large-v3, IndicTrans2 both ways, MADLAD-400, Indic Parler-TTS) needs a GPU server; it is the same service as NexaPair's `ml/nexamind-language`, so one server can serve both. It is off until `KAY_LANGUAGE_ENGINE_URL` is set, and costs whatever that server costs (a single always-on T4 or L4 class GPU is roughly USD 300 to 500 a month on the large clouds; price it for the host chosen).

## Switching it on

Nothing changes in production until the www and internal Workers are deployed (Actions, Deploy). The deploy creates the bucket, the D1 table (migration `0007_kay_languages.sql`) and `KAY_VOICE_KEY` (shared with the internal portal). For the language engine, set the repository variable `KAY_LANGUAGE_ENGINE_URL` and the secret `KAY_LANGUAGE_ENGINE_TOKEN`, then deploy www. To remove it again, delete the Worker secret `KAY_LANGUAGE_ENGINE_URL`.

## Where data goes

- Kayak AI: Cloudflare (Workers AI runs on Cloudflare's GPUs; Cloudflare does not promise an Indian location for inference). D1 and R2 are created with the APAC location hint.
- Kayak AI+: also Anthropic and Google (United States), as Kay already does today.
- The language engine: wherever its server is placed (India or the UAE).
