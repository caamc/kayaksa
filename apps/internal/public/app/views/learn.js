import { renderLearn } from "/_shared/js/learn-ui.js";

export async function render(main, ctx) {
  await renderLearn(main, ctx.rest, {
    base: "#/learn",
    apiBase: "/api/learn",
    internal: true,
    signIn: null,
    hero: `<section class="hero"><div class="stack" style="max-width:700px;position:relative;z-index:1"><span class="eyebrow" style="color:#F5C46D">Kayak Learn</span><h1>Learn the Kayak way</h1><p class="serif" style="font-size:1.1rem">Staff induction plus every public course on ethics, compliance, risk, governance and AI. Finish a course and pass its assessment to earn a certificate of participation.</p></div></section>`,
  });
}
