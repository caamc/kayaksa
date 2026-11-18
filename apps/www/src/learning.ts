// Kay's learning loop.
// - Hourly: approved answers are embedded (Workers AI) and placed in the Vectorize answer memory;
//   rejected ones are removed.
// - Weekly: the week's anonymised questions that needed a paid model are grouped into the most
//   common intents, and Claude drafts a vetted-quality answer for each. Drafts wait for a Kayak
//   admin to approve them in internal.kayaksa.com before Kay ever uses them.
// - Daily: questions older than 90 days are deleted.
import { completeJson, pickProvider } from "../../../packages/core/src/ai";
import { kayKnowledge } from "./kay";
import type { Env } from "./env";

const EMBED = "@cf/baai/bge-m3";

async function embed(env: Env, texts: string[]): Promise<number[][]> {
  const r: any = await env.AI!.run(EMBED as any, { text: texts } as any);
  return r?.data || [];
}

export async function syncMemory(env: Env) {
  if (!env.AI || !env.VEC) return;
  const todo = await env.DB.prepare("SELECT id, question FROM kay_memory WHERE status = 'approved' AND indexed = 0 LIMIT 50").all<any>();
  if (todo.results.length) {
    const vecs = await embed(env, todo.results.map((r) => r.question));
    await env.VEC.upsert(todo.results.map((r, i) => ({ id: r.id, values: vecs[i] })));
    await env.DB.batch(todo.results.map((r) => env.DB.prepare("UPDATE kay_memory SET indexed = 1 WHERE id = ?").bind(r.id)));
  }
  const gone = await env.DB.prepare("SELECT id FROM kay_memory WHERE status != 'approved' AND indexed = 1 LIMIT 100").all<any>();
  if (gone.results.length) {
    await env.VEC.deleteByIds(gone.results.map((r) => r.id));
    await env.DB.batch(gone.results.map((r) => env.DB.prepare("UPDATE kay_memory SET indexed = 0 WHERE id = ?").bind(r.id)));
  }
}

export async function weeklyDrafts(env: Env, siteData: any) {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const rows = await env.DB.prepare("SELECT question FROM kay_questions WHERE at > ? AND answered_by IN ('claude','lite','anthropic','google','openai','xai') AND turn <= 2 ORDER BY id DESC LIMIT 600").bind(since).all<any>();
  if (rows.results.length < 5) return;
  const provider = pickProvider(env, "anthropic");
  if (!provider) return;
  const existing = await env.DB.prepare("SELECT question FROM kay_memory WHERE status IN ('approved','pending')").all<any>();
  const drafts = await completeJson<{ intents: { question: string; asked: number; answer: string; voice: string }[] }>(env, provider, {
    system: `You help Kay, the website assistant of Kayak Strategic Advisors, learn. You receive anonymised visitor questions from the past week. Group them by intent and pick the up to 12 most frequently asked intents that a single, stable, vetted answer can serve well (skip greetings, personal chit-chat, news, and anything that depends on the visitor's own facts). For each, write:
- question: the clearest canonical phrasing of the intent;
- asked: how many of the questions belong to it;
- answer: Kay's reply for text chat, 2 to 5 short sentences, warm and precise, using ONLY the knowledge below. Never invent facts, fees, clients or people. Where helpful end with one page chip like [[go:/services/tax-legal-regulatory|Tax, Legal & Regulatory]] using only paths that appear in the knowledge, or [[handoff]] when the visitor should talk to the team;
- voice: the same answer as 1 to 2 natural spoken sentences, no markdown, no links.
Do not repeat intents already covered by these existing questions: ${existing.results.map((r) => r.question).join(" | ").slice(0, 4000)}
Return JSON only: {"intents":[...]}.

KNOWLEDGE
${kayKnowledge(siteData)}`,
    messages: [{ role: "user", content: rows.results.map((r) => `- ${r.question}`).join("\n").slice(0, 60000) }],
    maxTokens: 6000,
    temperature: 0.2,
  });
  const now = new Date().toISOString();
  const stmts = (drafts.intents || []).filter((d) => d.question && d.answer).slice(0, 12).map((d) =>
    env.DB.prepare("INSERT INTO kay_memory (id, question, answer, voice_answer, source, asked, status, created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), d.question.slice(0, 300), d.answer.slice(0, 2000), (d.voice || "").slice(0, 600), "weekly", Number(d.asked) || 0, "pending", now));
  if (stmts.length) await env.DB.batch(stmts);
}

export async function dailyCleanup(env: Env) {
  await env.DB.prepare("DELETE FROM kay_questions WHERE at < ?").bind(new Date(Date.now() - 90 * 86400_000).toISOString()).run();
  await env.DB.prepare("DELETE FROM kay_feedback WHERE at < ?").bind(new Date(Date.now() - 90 * 86400_000).toISOString()).run();
}

/** Starter answers drawn from the website itself. They are added as drafts for a Kayak admin to approve. */
export const SEED = [
  ["What does Kayak Strategic Advisors do?", "Kayak is an independent, senior-led advisory firm in Mumbai and Thane. We help boards, promoters and investors with six kinds of work: strategy and deals, tax and regulation, crisis and resilience, technology and AI, managed services, and cross-border work through our International Desk. One partner leads each engagement from start to finish. [[go:/services|Our services]]", "Kayak is an independent, senior-led advisory firm in Mumbai and Thane. We help boards, promoters and investors with strategy and deals, tax and regulation, crisis and resilience, technology and AI, managed services and cross-border work."],
  ["How do I start working with Kayak?", "It starts with a confidential conversation: you tell us the question, and we listen. We then send a two-page scoping note with the approach, team and timeline, and agree scope, deliverables and fee in a clear proposal before any work begins. A senior member of the team replies within one working day. [[handoff]]", "It starts with a confidential conversation. We then send a short scoping note and a clear proposal, with the fee agreed before any work begins. Shall I pass your details to the team?"],
  ["Where is Kayak located?", "We work from Mumbai and Thane in Maharashtra, and travel to clients across India; the International Desk handles overseas work. Our registered office is at A/2, 314, Shah & Nahar Industrial Estate, Delisle Road, Mumbai 400013. [[go:/contact|Contact us]]", "We're based in Mumbai and Thane, and we travel to clients across India. Our International Desk handles work overseas."],
  ["How can I contact Kayak?", "Write to enquiries@kayaksa.com or use the form on our contact page, and a senior member of the team will reply within one working day. If it's urgent, put URGENT in the subject line, or I can pass your message on right now. [[handoff]]", "You can email enquiries at kayaksa dot com, and a senior member of the team will reply within one working day. I can also pass your message on right now."],
  ["What is SayUsNow?", "SayUsNow is Kayak's ethics and compliance platform: cases, conflicts of interest, a gifts register, learning, due diligence and culture surveys in one place. [[go:/solutions/sayusnow|SayUsNow]]", "SayUsNow is our ethics and compliance platform, bringing cases, conflicts, gifts, learning and culture surveys into one place."],
  ["What is NexaPair?", "NexaPair is Kayak's third-party risk management platform, covering the vendor lifecycle from onboarding and risk tiering to due diligence, monitoring and exit. It is live at www.nexapair.ae, and nexapair.in is coming soon. [[go:/solutions/nexapair|NexaPair]]", "NexaPair is our third-party risk management platform, covering vendors from onboarding to exit. It's live at nexapair dot ae, with the Indian site coming soon."],
  ["What is SeeCounter?", "SeeCounter is a searchable repository of past and ongoing counterfeiting cases: court orders, raids, seizures, takedowns and regulatory actions. You can filter by brand, product, place and type of action, and subscribe to alerts by email. [[go:/solutions/seecounter|SeeCounter]]", "SeeCounter is a searchable record of counterfeiting cases, from court orders to raids and takedowns, with email alerts for the brands and products you follow."],
  ["What is DocuVow?", "DocuVow is Kayak's e-signature and signing platform for sending, signing and tracking documents. [[go:/solutions/docuvow|DocuVow]]", "DocuVow is our e-signature platform for sending, signing and tracking documents."],
  ["Are you hiring? How do I apply to Kayak?", "Yes. Eleven roles are open across the Kayak Group — all on the kayaksa.com careers page, each listed with the actual employer. Advisory roles: Senior Manager in Tax, Legal & Regulatory Services (CS + LLB, 11+ years); Manager in Crisis, Risk & Resilience Services (CA or MBA with LLB, 7+ years PQE). Kayak Technology Solutions technology and interns: Senior Full Stack Developer for SaaS, AI & Business Applications (6-9 years, CTC ₹14-18 lakh); three paid analyst internships in Mumbai (AI & Business Applications, OSINT, Legal & Research); Junior Executive in SEO, AEO & Organic Growth (0-2 years, Mumbai). Kayak Technology Solutions commercial: Marketing & Sales Solutions Lead for NexaPair & DocuVow in the UAE (Dubai/Abu Dhabi) and in India (Delhi NCR); and two Junior Executive roles in Business Development in Mumbai (1-3 years), one general and one focused on targeted outreach. The careers form asks for a CV (PDF or Word; PDF auto-fills your name, email and LinkedIn for you to review), and requires Professional associations and references — the memberships you hold (ICAI, ICSI, Bar Council, IBBI, ISACA, PMI, NASSCOM, ACFE, etc. with membership numbers) and two referees we may contact. General notes for the founding team are also welcome. [[go:/careers|Careers]]", "Yes, eleven roles are open across the Kayak Group — advisory, technology, paid internships and commercial. Apply from the careers page, upload your CV (PDF auto-fills your details for review) and list your professional associations and two referees."],
  ["Is there a fee to apply for a job at Kayak?", "No. Kayak never charges a candidate a fee, deposit, training charge, security amount, laptop fee or anything else, at any stage, for any role with Kayak Strategic Advisors, Kayak Technology Solutions, Kayak Innovations or any of our products (SayUsNow, DocuVow, NexaPair, SeeCounter, Qriocity). If anyone asks you to pay, the message is fraudulent. Every genuine role is listed on kayaksa.com/careers and on our verified LinkedIn page, and our recruiters write only from @kayaksa.com. If you have been approached, or paid, in Kayak's name, please write to report-fraud@kayaksa.com, and report it on the National Cyber Crime Reporting Portal at cybercrime.gov.in or on helpline 1930. [[go:/careers|Careers]]", "No. Kayak never charges a candidate a fee at any stage, ever. If anyone asks you to pay, the message is a fraud. Write to report-fraud at kayaksa dot com, and file a complaint at cybercrime dot gov dot in or on helpline nineteen thirty."],
  ["What is life at Kayak like?", "Six clusters, two cities, one craft. We are small and senior: partners and directors stay on an engagement from scoping to result, with few layers between you and the problem. We work from Mumbai and Thane, hybrid where the role allows, and the week is scheduled so the people on an engagement can meet in person when the work needs it. The six clusters — Strategy, Investigations, Risk, Governance, Transactions, Technology — are one bench; you will move across them when the question needs it, and build on the firm's own products through Kayak Technology Solutions. A short film, with six moments from a working week, sits on the careers page. [[go:/careers#life|Life at Kayak Group]]", "Small, senior teams. Two offices in Mumbai and Thane, six clusters you can move across, and craft built on our own technology. There's a short film on the careers page."],
  ["What is Confluence?", "Confluence is Kayak's monthly magazine on strategy, risk and the decisions between them, published on the first Tuesday of each month. You can read it on the site and subscribe for free. [[go:/insights|Confluence]]", "Confluence is our monthly magazine on strategy, risk and the decisions between them, out on the first Tuesday of every month."],
  ["Does Kayak offer courses or training?", "Yes. Kayak Learn at learn.kayaksa.com offers assessed courses and learning paths on ethics, compliance, risk, corporate governance and responsible AI, each with a verifiable certificate of participation. Courses are listed at ₹15,000 and are ₹10,000 plus GST under the current launch offer, with 12 months' access. For tailored training for your team, ask me to connect you with Kayak."],
  ["Is my conversation with Kay confidential?", "I'm an AI, and I don't keep who you are. Kayak keeps the questions people ask me, with names, emails and numbers removed, for up to 90 days to improve my answers. Please don't share confidential details here; for a confidential matter, the team will agree a non-disclosure agreement first. [[go:/legal|Privacy]]", "I don't keep who you are. Questions are kept without personal details for up to ninety days to improve my answers. For anything confidential, the team will agree an NDA first."],
];

export async function seedMemory(env: Env) {
  const n = await env.DB.prepare("SELECT COUNT(*) n FROM kay_memory").first<any>();
  if ((n?.n || 0) > 0) return;
  const now = new Date().toISOString();
  await env.DB.batch(SEED.map(([q, a, v]) => env.DB.prepare("INSERT INTO kay_memory (id, question, answer, voice_answer, source, status, created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), q, a, v, "seed", "pending", now)));
}
