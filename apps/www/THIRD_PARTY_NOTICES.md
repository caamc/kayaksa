# Third-party models used by Kay (www.kayaksa.com)

Kay calls these models as services; no model weights are shipped in this repository. Each licence allows commercial use.

| Model | Used for | Where it runs | Licence | Credit |
| --- | --- | --- | --- | --- |
| Whisper large-v3-turbo and large-v3 | speech to text | Workers AI; the optional language engine | MIT | OpenAI, "Robust Speech Recognition via Large-Scale Weak Supervision" (Radford et al., 2022) |
| IndicTrans2 (en-indic 1B, indic-en 1B) | translation to and from Indian languages | Workers AI; the language engine | MIT | AI4Bharat, IIT Madras: Gala et al., "IndicTrans2", TMLR 2023 |
| M2M-100 1.2B | translation between 100 languages | Workers AI | MIT | Meta AI: Fan et al., "Beyond English-Centric Multilingual Machine Translation", 2020 |
| MADLAD-400 3B | translation, other language pairs | the language engine | Apache-2.0 | Google: Kudugunta et al., "MADLAD-400", 2023 |
| Indic Parler-TTS | spoken replies in 21 Indian languages | the language engine | Apache-2.0 | AI4Bharat and Hugging Face |
| MeloTTS | spoken replies (6 languages) | Workers AI | MIT | MyShell.ai |
| Llama 3.3 70B Instruct | Kayak AI answers | Workers AI | Llama 3.3 Community Licence | "Built with Llama". Meta Platforms, Inc. |
| BGE-M3 | Kay's answer memory | Workers AI | MIT | BAAI |

Not used, because their licences forbid commercial use: Meta Seamless (CC BY-NC 4.0), MMS-TTS (CC BY-NC 4.0), Coqui XTTS (Coqui Public Model Licence) and the non-commercial Piper voices.

Kay's transliteration rules (`public/assets/kay-xlit.js`) are Kayak's own work.
