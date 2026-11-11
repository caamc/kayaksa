// Confluence, Issue 01, November 2026. Covers 25 September to 25 October 2026.
// Facts come only from the public sources listed with each story, as at 25 October 2026.
// Kayak's perspectives use fictional people and companies (the Relativity Index) so that no real
// person or company is characterised. Nothing here is legal, tax or investment advice.

export interface Story {
  id: string;
  section: "Regulatory" | "Financial" | "Deals" | "Business" | "Technology";
  kicker: string;
  title: string;
  dek: string;
  image?: string;
  facts: { date: string; text: string }[];
  numbers?: [string, string][];
  matters: string[];
  cast: [string, string][]; // Relativity Index: who is in this scenario
  scenario: string[];
  perspective: string[];
  questions: string[];
  postscript?: string;
  sources: [string, string][];
  /** How the spread is composed; when absent, layouts rotate so no two spreads in a row look alike. */
  layout?: "photo" | "pattern" | "exhibit" | "quote";
  /** A line lifted from the perspective for pull-quote marks. Never a new claim. */
  pull?: string;
  /** One exhibit, built only from figures in this story's sources. */
  exhibit?: Exhibit;
}

/** A KSA exhibit (Design & Visual Guidelines, 06): insight-first title, one saffron beacon, a source line. */
export interface Exhibit {
  kind: "column" | "bar" | "waffle" | "gauge" | "route" | "cards";
  title: string; // the insight, as a sentence
  unit: string; // measure, unit and period
  data?: [string, number, string?][]; // label, value, display value
  beacon?: number; // index of the one saffron mark
  total?: number; // gauge: the whole
  cards?: { tag: string; value: string; delta?: string; tone?: "good" | "bad"; vs?: string; bar?: number }[];
  source: string;
  note?: string;
}

export interface Edition {
  id: string; issue: string; month: string; period: string; periodShort: string; published: string;
  editorsTitle: string; coverTitle: string; coverDek: string; coverLines: string[]; coverImage?: string;
  editorsNote: string[]; numbers: Fact[]; cast: [string, string][];
  stories: Story[]; spotlight?: Spotlight; agenda: string[];
}

/** A fact for "The month in numbers": value, label, a KSA icon name, and a comparison taken from the same source. */
export type Fact = [string, string, string?, Compare?];
export interface Compare { was?: string; note: string; dir?: "up" | "down" }
export const ICONS = ["strategy", "transactions", "risk", "investigations", "brand-protection", "intellectual-property", "technology", "data", "human-resources", "compliance", "tax", "finance", "due-diligence", "governance", "regulatory", "cybersecurity", "esg", "analytics", "growth", "target", "navigation", "partnership", "network", "globe", "report", "contract", "calendar", "timeline", "mail", "mobile", "location", "website", "chat", "user", "presentation", "briefcase"];

export interface Spotlight {
  tool: string;
  url: string;
  image?: string; // a panoramic photograph in /assets/hero, shown across both pages
  logo?: string; // the tool's full-colour horizontal logo in /assets/logos; found from the tool name when absent
  kicker: string;
  title: string;
  dek: string;
  why: string[];
  regulation: { date: string; text: string }[];
  modules: [string, string, string][]; // name, status as published, what it does
  helps: [string, string][]; // team, how it helps
  numbers: [string, string][];
  cast: [string, string][];
  scenario: string[];
  howItHelps: string[];
  disclosure: string;
  cta: string;
  sources: [string, string][];
}

export const EDITION: Edition = {
  id: "2026-11",
  issue: "Issue 01",
  month: "November 2026",
  period: "25 September – 25 October 2026",
  periodShort: "25 Sep – 25 Oct 2026",
  published: "2026-11-11",
  editorsTitle: "Two currents, one month",
  coverTitle: "Calibrated",
  coverDek: "The month money got dearer and the rulebook got kinder. What it means for boards, promoters and family offices.",
  coverLines: ["GST's lighter hand", "Settling with SEBI before the notice", "A record IPO month", "AI rules are on their way"],
  editorsNote: [
    "Between 25 September and 25 October, two currents ran in opposite directions. The cost of money rose: the Reserve Bank of India raised the repo rate and tightened the rules around rupee hedging. At the same time, the rulebook became gentler in places: the GST Council recommended withdrawing arrest powers and raising the threshold for prosecution, and SEBI notified a settlement framework that lets a company settle before a show-cause notice is issued.",
    "Capital markets had one of their busiest months on record, deal tracking showed a broadening of mid-sized transactions, and the conversation on artificial intelligence moved from strategy decks to procurement and regulation.",
    "This issue sets out what happened, plainly and with sources, and then offers Kayak's perspective. Our perspectives are built around scenarios with fictional people, Ram, Shyam, Sita, Geeta, John, Johnny and Janardan, and fictional companies A, B, C, P, Q and R. We call this the Relativity Index: a way to see an idea at work in a situation you can relate to, without pretending that one situation fits all.",
  ],
  numbers: [
    ["5.50%", "RBI repo rate, raised on 7 October", "governance", { was: "5.25%", note: "+25 bps; stance now calibrated tightening", dir: "up" }],
    ["₹5 crore", "Proposed GST prosecution threshold", "tax", { was: "₹1 crore", note: "Five times higher, on the GST Council's recommendation", dir: "up" }],
    ["₹30,213 cr", "Jio Platforms IPO, open 21–23 October", "growth", { note: "India's largest public offer", dir: "up" }],
    ["255", "M&A deals in July–September 2026", "transactions", { note: "Highest volume of 2026; value down 53% on April–June", dir: "up" }],
    ["60", "IPOs in July–September, raising $9 billion", "finance", { note: "A record amount for any quarter", dir: "up" }],
    ["$3 bn+", "TCS's annualised AI revenue, reported 8 October", "technology", { note: "More than a tenth of TCS's revenue" }],
    ["10,000", "AI compute units sought for the IndiaAI Mission", "data", { note: "A first tender for 5,000" }],
    ["13 Nov", "Consent Manager registration opens, DPDP Rules", "calendar", { note: "Core duties follow on 13 May 2027" }],
  ],
  cast: [
    ["Ram", "Promoter and managing director of A Ltd, a listed mid-sized manufacturer that imports raw material"],
    ["Shyam", "Chief financial officer, the person who signs the numbers"],
    ["Sita", "Independent director and audit committee chair"],
    ["Geeta", "Founder of Q Pvt Ltd, a fast-growing technology company"],
    ["John", "Partner at P Capital, an overseas private equity fund"],
    ["Johnny", "Runs R Services, an exporter of engineering services"],
    ["Janardan", "Head of a family office that owns stakes in B and C"],
  ],
  stories: [
    {
      id: "gst-lighter-hand",
      section: "Regulatory",
      kicker: "Indirect tax",
      title: "GST's lighter hand",
      dek: "The 57th GST Council meeting recommended withdrawing arrest powers, raising the prosecution threshold and automating refunds. Compliance does not get easier; the cost of a mistake may get smaller.",
      image: "boardroom",
      facts: [
        { date: "8 Oct", text: "The 57th meeting of the GST Council was held in New Delhi, chaired by the Union Finance Minister." },
        { date: "8 Oct", text: "It recommended withdrawing arrest powers by omitting section 69 of the CGST Act, and raising the threshold for prosecution from ₹1 crore to ₹5 crore." },
        { date: "8 Oct", text: "The maximum general penalty would fall from ₹25,000 to ₹10,000. In non-fraud cases, the penalty would fall to 5% if tax and interest are paid within 30 or 60 days of the order. No show-cause notice would issue where the tax involved is under ₹10,000." },
        { date: "8 Oct", text: "Refunds are to be automated in phases, with 90% sanctioned provisionally for zero-rated supplies and inverted duty claims on system risk assessment. Accumulated credit on input services becomes refundable in inverted duty cases for credit availed from 1 November 2026." },
        { date: "8 Oct", text: "Interception of goods would need specific intelligence and authorisation by an officer of at least Joint Commissioner rank. E-invoicing would extend to reverse-charge supplies and imports of services for taxpayers with turnover of ₹5 crore or more." },
        { date: "Note", text: "The Council's recommendations take legal effect only through notifications, circulars or amendments to the law." },
      ],
      numbers: [["₹1 cr → ₹5 cr", "Prosecution threshold"], ["₹25,000 → ₹10,000", "Maximum general penalty"], ["90%", "Provisional refund for exporters"]],
      layout: "photo",
      exhibit: { kind: "cards", title: "The recommendations lower the cost of a mistake, not the duty to get it right", unit: "GST Council recommendations, 57th meeting, 8 October 2026", cards: [{ tag: "Prosecution threshold", value: "₹5 cr", delta: "▲ 5×", tone: "good", vs: "vs ₹1 crore today" }, { tag: "Maximum general penalty", value: "₹10,000", delta: "▼ 60%", tone: "good", vs: "vs ₹25,000 today" }, { tag: "Provisional refund", value: "90%", bar: 90, vs: "for zero-rated supplies and inverted duty, on risk assessment" }], source: "GST Council press release, 57th meeting; KSA analysis", note: "Recommendations take effect only once notified." },
      matters: [
        "The recommendations shift GST administration towards systems and speed. Lower penalties for prompt payment reward companies that can reconcile and respond quickly.",
        "Exporters and businesses with inverted duty structures stand to see working capital released sooner, once the changes are notified.",
      ],
      cast: [["Johnny", "Runs R Services, an exporter of engineering services"], ["Shyam", "CFO of R Services"]],
      scenario: [
        "Johnny's company, R Services, exports design services to clients in Europe. Every quarter, its refunds of input tax credit take months to arrive, and Shyam funds the gap with a working capital line that now costs more after the rate increase.",
        "A tax officer has also raised a query on credit claimed two years ago. Shyam believes the claim is correct, but the documents sit across three systems.",
      ],
      perspective: [
        "In this scenario, our perspective is that R Services gains most by preparing for speed rather than by relying on leniency. If refunds become largely automatic, the companies with clean, matched data are paid first. Shyam's priority would be to reconcile invoices, proof of export of services and foreign currency receipts every month, not at year-end.",
        "The proposed 5% penalty for paying within 30 or 60 days changes the arithmetic of disputes. Where R Services agrees an amount is due, paying fast may cost less than contesting it. Where it disagrees, a well-documented reply within the timeline matters more than ever.",
        "Lower prosecution risk is not lower compliance risk. Interest, penalties and blocked credit still bite, and reputational damage from a dispute does not depend on whether anyone was arrested.",
      ],
      questions: ["Could we reconcile our GST data within 30 days of an order if we had to?", "How much working capital is tied up in refunds today, and how much would a 90% provisional refund release?", "Are our reverse-charge and import-of-service invoices ready for e-invoicing?"],
      sources: [["GST Council press release, 57th meeting", "https://www.gstcouncil.gov.in/sites/default/files/2026-10/press_release.pdf"]],
    },
    {
      id: "settle-before-the-notice",
      section: "Regulatory",
      kicker: "Securities law",
      title: "Settling with SEBI before the notice",
      dek: "New settlement regulations, notified on 6 October, let a company settle before a show-cause notice, with a formula that rewards early, candid engagement.",
      image: "mumbai",
      facts: [
        { date: "24 Sep", text: "SEBI's board approved new Settlement Regulations, new Portfolio Managers Regulations, a common advertisement code for intermediaries and changes to the accredited investor framework, among other decisions. (This meeting took place a day before the period this issue covers; the notifications followed within it.)" },
        { date: "6 Oct", text: "SEBI notified the Settlement of Administrative and Civil Proceedings Regulations, 2026, replacing the 2018 regulations. The Gazette issue is dated 7 October, and the regulations take effect on 7 November 2026." },
        { date: "6 Oct", text: "An applicant may apply at any stage. The settlement amount follows a formula; the stage factor is lower before a show-cause notice (0.40) than after one (0.60). Minimum settlement amounts are ₹3 lakh for first-time applicants and ₹7 lakh for others." },
        { date: "6 Oct", text: "Fast-track routes cover certain violations, such as delayed disclosures, and amounts up to ₹10 lakh. Matters with market-wide impact, large investor losses or market-integrity concerns face restrictions." },
        { date: "13 Oct", text: "The Portfolio Managers Regulations, 2026 were reported as notified, with effect from 1 April 2027." },
      ],
      numbers: [["0.40 vs 0.60", "Stage factor before vs after a show-cause notice"], ["7 Nov 2026", "New settlement regulations take effect"], ["₹10 lakh", "Fast-track monetary threshold"]],
      layout: "quote",
      pull: "Good minutes protect directors more than a good outcome does.",
      exhibit: { kind: "bar", title: "Settling before a show-cause notice carries a stage factor a third lower", unit: "Stage factor in SEBI's settlement formula", data: [["Before a show-cause notice", 0.4, "0.40"], ["After a show-cause notice", 0.6, "0.60"]], beacon: 0, source: "SEBI Settlement Regulations, 2026, as reported; KSA analysis" },
      matters: [
        "Settlement becomes more predictable and potentially cheaper the earlier it is pursued. That changes how listed companies and their officers respond to the first letter from the regulator.",
        "A settlement brings proceedings to a close without findings, but it is a public order and carries consequences that boards should weigh carefully.",
      ],
      cast: [["Sita", "Independent director and audit committee chair at B Ltd, a listed company"], ["Shyam", "CFO of B Ltd"], ["Ram", "Promoter of B Ltd"]],
      scenario: [
        "B Ltd disclosed a material contract to the stock exchanges eleven days late. SEBI has written to the company seeking an explanation, but no show-cause notice has been issued.",
        "Shyam suggests applying for settlement immediately to benefit from the lower pre-notice factor. Ram would rather wait and argue that the delay caused no harm. Sita, as audit committee chair, must guide the board.",
      ],
      perspective: [
        "In this scenario, our perspective is that the decision should not be made on cost alone. An early settlement may be cheaper, but the board should first establish the facts: why the disclosure was late, whether it happened before, and what the control failure was. Settling without fixing the cause invites the next letter.",
        "Sita could ask for a short, independent fact-finding note before the board decides, with the company secretary's records and email trail. If the facts show a one-off lapse with a clear fix, early settlement may be a sensible, proportionate path. If they show a pattern, the board needs specialist legal advice first.",
        "Whatever the choice, the board's minutes should show that it considered the options, the advice it received and the reasons for its decision. Good minutes protect directors more than a good outcome does.",
      ],
      questions: ["Do we know every disclosure we filed late in the last three years?", "Who decides, and how quickly, when a regulator writes to us?", "Have we taken advice from securities counsel before choosing to settle or contest?"],
      sources: [["Corporate Law Updates: SEBI Settlement Regulations, 2026", "https://www.corplawupdates.in/updates/sebi-settlement-regulations-2026"], ["Corporate Law Updates: SEBI board meeting, 24 September 2026", "https://www.corplawupdates.in/updates/sebi-board-meeting-september-2026-key-decisions"]],
    },
    {
      id: "dearer-money",
      section: "Financial",
      kicker: "Rates and the rupee",
      title: "Dearer money, tighter hedges",
      dek: "The RBI raised the repo rate to 5.50% and moved to 'calibrated tightening'. Days later, it tightened the rules on rupee derivatives as the currency traded near its record low.",
      image: "kayak",
      facts: [
        { date: "7 Oct", text: "The Monetary Policy Committee raised the repo rate by 25 basis points to 5.50%, unanimously, and changed its stance from neutral to calibrated tightening. The Standing Deposit Facility rate moved to 5.25% and the Marginal Standing Facility rate to 5.75%." },
        { date: "7 Oct", text: "The RBI projected GDP growth of 7.1% for 2026-27 and CPI inflation of 5.2%, citing broadening food and fuel prices, crude oil volatility, monsoon and weather risks, and tighter global financial conditions. CPI inflation was 4.8% in August." },
        { date: "10–11 Oct", text: "To curb speculation, the RBI required dealers to hold a 20% Foreign Exchange Risk Reserve on certain rupee derivatives used to hedge current account exposure, barred the rebooking of cancelled contracts, and cut the limit for derivative transactions without underlying exposure from $100 million to $5 million." },
        { date: "12 Oct", text: "A special window opened through designated banks to meet the daily dollar needs of three state-run oil marketing companies." },
        { date: "Context", text: "Foreign exchange reserves fell by about $51.1 billion in the four weeks to 2 October, after a record of about $785.7 billion in early September, according to reports of the RBI's data." },
        { date: "21 Oct", text: "The minutes of the October meeting were published. The next meeting is scheduled for 2–4 December 2026." },
      ],
      numbers: [["5.50%", "Repo rate"], ["5.2%", "CPI projection for 2026-27"], ["$100m → $5m", "Limit without underlying exposure"]],
      layout: "pattern",
      exhibit: { kind: "column", title: "Reserves gave back about $51 billion in four weeks from their record", unit: "Foreign exchange reserves, $ billion, 2026", data: [["Early Sep (record)", 785.7, "~785.7"], ["2 Oct", 734.6, "~734.6"]], beacon: 1, source: "Reports of RBI data; KSA analysis", note: "The 2 October figure is the reported record less the reported fall." },
      matters: [
        "Borrowers with floating-rate loans will see costs rise, and the RBI has signalled that further action could be a pause or another increase.",
        "Hedging rupee exposure may become costlier and more documentation-heavy, especially for companies that hedged dynamically or without a clearly matched exposure.",
      ],
      cast: [["Ram", "Promoter of A Ltd, which imports 60% of its raw material in dollars"], ["Shyam", "CFO of A Ltd"], ["Sita", "Audit committee chair at A Ltd"]],
      scenario: [
        "A Ltd has ₹400 crore of floating-rate borrowings and dollar payables of about $30 million a quarter. Shyam used to hedge actively, cancelling and rebooking forwards when the rupee moved.",
        "After the October measures, the bank's treasury desk tells Shyam that rebooking is no longer allowed and that some of his hedges will cost more. Ram asks whether A Ltd should simply stop hedging.",
      ],
      perspective: [
        "In this scenario, our perspective is that stopping hedging would turn a cost problem into a risk problem. A Ltd's margins depend on a currency it does not control. The better question is what the hedge is for: protecting the budgeted rupee cost of raw material, not earning a trading gain.",
        "Shyam could rewrite A Ltd's hedging policy around matched, documented exposures, with clear limits and a calendar that does not rely on rebooking. Sita's audit committee could review it, together with a simple stress test: what happens to margins if the rupee weakens by 5% and rates rise by another 50 basis points?",
        "On the borrowing side, Ram and Shyam could look at the mix of fixed and floating debt and the timing of refinancing. The point is not to forecast the next policy decision, which no one can do reliably, but to make sure A Ltd is comfortable with any of the outcomes.",
      ],
      questions: ["Is every hedge we hold matched to a real, documented exposure?", "What do our margins look like if rates rise by another 50 bps and the rupee weakens by 5%?", "Does our board approve the hedging policy, or just the hedging results?"],
      sources: [["SCC Online: RBI raises repo rate to 5.50%", "https://www.scconline.com/blog/post/2026/10/09/rbi-hikes-repo-rate-to-5-50-percent-october-2026/"], ["TradingView (Moody's): RBI tightens forex rules", "https://www.tradingview.com/news/moodys:651aa9788e99f:0-rbi-tightens-forex-rules-as-rupee-trades-near-record-low/"]],
    },
    {
      id: "deals-broaden",
      section: "Deals",
      kicker: "M&A and private equity",
      title: "More deals, smaller cheques",
      dek: "Deal tracking for July to September showed the highest M&A volume of 2026, an eight-year high in inbound deal counts and a record quarter for IPOs, even as headline values fell.",
      image: "confluence",
      facts: [
        { date: "8 Oct", text: "Grant Thornton Bharat's Dealtracker for July–September 2026, as reported, counted 255 M&A deals worth $13.2 billion, the highest volume of the year. Values fell 53% from the previous quarter, which included one very large pharmaceutical acquisition." },
        { date: "8 Oct", text: "Domestic M&A rose to 188 deals, nearly three-quarters of the total. Inbound M&A reached $4.2 billion, 2.6 times the previous quarter, with volumes at an eight-year high." },
        { date: "8 Oct", text: "Private equity reached $9.9 billion across 353 deals, a 2026 high. Sixty IPOs raised $9 billion, a record for any quarter, and 28 QIPs raised $4.8 billion." },
        { date: "8 Oct", text: "Among the larger transactions reported: Bank of America's $1.92 billion investment for a 50% stake in Jio Credit, Aditya Birla Renewables' $1.79 billion acquisition of Solenergi Power, and KKR's $1.4 billion acquisition of Medicover Hospitals India." },
      ],
      numbers: [["255", "M&A deals, July–September"], ["$4.2 bn", "Inbound M&A, 2.6× the previous quarter"], ["$9 bn", "Raised by 60 IPOs"]],
      layout: "exhibit",
      exhibit: { kind: "bar", title: "IPOs raised a record $9 billion, close behind private equity", unit: "Capital by route, $ billion, July–September 2026", data: [["M&A (255 deals)", 13.2, "13.2"], ["Private equity (353 deals)", 9.9, "9.9"], ["IPOs (60)", 9, "9.0"], ["QIPs (28)", 4.8, "4.8"]], beacon: 2, source: "Grant Thornton Bharat Dealtracker, as reported by Business Standard" },
      matters: [
        "The market is broadening: more mid-sized and domestic deals, more foreign buyers, and public markets competing with private capital as a source of funding.",
        "For owners, that means more options and more scrutiny. Buyers and investors with choices diligence harder.",
      ],
      cast: [["Janardan", "Head of a family office that owns 70% of C Ltd, a profitable specialty chemicals business"], ["John", "Partner at P Capital, an overseas private equity fund"], ["Sita", "Independent director at C Ltd"]],
      scenario: [
        "John's fund has approached Janardan with an offer to buy a 26% stake in C Ltd, with board seats and a list of consent rights. In parallel, a domestic strategic buyer has expressed interest in the whole company, and a banker has suggested that an IPO in 2027 might value C Ltd higher than either.",
        "Janardan wants to know which path is right, and how to run three conversations without losing control of any of them.",
      ],
      perspective: [
        "In this scenario, our perspective is that the first decision is about the family's goals, not the price. Liquidity now, control for the next generation, and the long-term value of C Ltd point in different directions. A short written statement of those goals, agreed within the family, is the most useful document Janardan can have before any term sheet.",
        "Next comes readiness. Whichever path is chosen, investors will examine C Ltd's related-party transactions, environmental approvals, tax positions and the quality of its numbers. A vendor due diligence review, done early, lets Janardan fix issues on his own timetable rather than negotiate them under pressure.",
        "Finally, consent rights deserve as much attention as valuation. A 26% investor with wide vetoes can shape C Ltd's future more than the price suggests. Sita's independent view on governance rights could help the board and the family stay aligned.",
      ],
      questions: ["Have we written down what the family wants from a transaction?", "Would C Ltd's records survive a buyer's due diligence next month?", "Which consent rights could we live with for ten years?"],
      sources: [["Business Standard: India's dealmaking broadens, Q3 2026", "https://www.business-standard.com/industry/news/india-s-dealmaking-broadens-255-m-as-worth-13-2-bn-in-q3-of-2026-126100800628_1.html"]],
    },
    {
      id: "record-ipo",
      section: "Deals",
      kicker: "Capital markets",
      title: "A record issue, and what founders can learn from it",
      dek: "Jio Platforms opened India's largest public offer on 21 October: a fresh issue of up to ₹30,213 crore, with the proceeds earmarked to reduce borrowings.",
      image: "mumbai",
      facts: [
        { date: "21–23 Oct", text: "The Jio Platforms IPO was open for subscription, with a price band of ₹1,065 to ₹1,119 per share and an issue size of up to ₹30,213 crore." },
        { date: "21 Oct", text: "The issue was entirely a fresh issue of up to 27 crore shares, with no offer for sale. The stated use of proceeds was prepaying borrowings of its material subsidiary, Reliance Jio Infocomm Limited, and general corporate purposes." },
        { date: "Timeline", text: "Allotment was expected on 26 October and listing on NSE and BSE on 28 October, both tentative at the time of the offer." },
      ],
      numbers: [["₹30,213 cr", "Issue size"], ["100%", "Fresh issue, no offer for sale"], ["12", "Shares per lot"]],
      layout: "photo",
      exhibit: { kind: "route", title: "From the first bid to listing in about a week", unit: "Jio Platforms IPO timetable, October 2026", data: [["21 Oct", 0, "Issue opens"], ["23 Oct", 0, "Issue closes"], ["26 Oct", 0, "Allotment (tentative)"], ["28 Oct", 0, "Listing on NSE and BSE (tentative)"]], beacon: 3, source: "Groww: Jio Platforms IPO dates, price band and details" },
      matters: [
        "A fresh issue used to reduce debt is a clear and simple story for investors. Clarity about the use of proceeds is one of the things public market investors examine most closely.",
        "Large issues also test market depth. The preceding quarter, July to September, had already seen a record $9 billion raised through sixty IPOs.",
      ],
      cast: [["Geeta", "Founder of Q Pvt Ltd, a technology company planning to list in about two years"], ["Shyam", "Q Pvt Ltd's new CFO"], ["John", "An early investor in Q Pvt Ltd"]],
      scenario: [
        "Geeta has watched the IPO market with interest. Q Pvt Ltd is growing quickly, but it has three classes of preference shares, an employee stock option plan that has been amended four times, and revenue recognition policies that its new auditor has questioned.",
        "John, an early investor, would like to sell part of his stake in an IPO. Geeta would rather raise fresh money to repay venture debt and fund expansion.",
      ],
      perspective: [
        "In this scenario, our perspective is that Q Pvt Ltd's listing date will be set less by the market than by its own readiness. Capital structure clean-up, a stable ESOP scheme, audited numbers that need no restatement and a board with genuinely independent directors typically take 12 to 24 months to put in place.",
        "The mix of fresh issue and offer for sale is a strategic choice as well as a financial one. Investors tend to ask why existing shareholders are selling and what the company will do with new money. Geeta and John can settle that conversation privately, early, and in writing.",
        "Shyam could start a simple readiness tracker now: what a prospectus will need to disclose, which approvals are pending, and which policies need board adoption. This is not an assessment of any listed company or a view on any security; it is how we would think about Q Pvt Ltd's journey in this scenario.",
      ],
      questions: ["Could we explain our use of proceeds in one sentence?", "Would our last three years of numbers need any restatement?", "Have our existing investors agreed, in writing, how an exit through the IPO would work?"],
      postscript: "After the period this issue covers, the shares listed on 28 October. Kayak does not comment on the merits of any security.",
      sources: [["Groww: Jio Platforms IPO dates, price band and details", "https://groww.in/blog/jio-platforms-ipo-to-open-on-october-21-2026"], ["Al Jazeera, 31 October 2026", "https://www.aljazeera.com/news/2026/10/31/how-ambanis-jio-became-indias-second-largest-company"]],
    },
    {
      id: "ai-services",
      section: "Business",
      kicker: "Technology services",
      title: "When AI becomes a line of revenue",
      dek: "TCS reported that its annualised AI revenue crossed $3 billion, more than a tenth of the total, alongside a global capability centre transition and a consulting acquisition.",
      image: "boardroom",
      facts: [
        { date: "8 Oct", text: "TCS reported results for the quarter to 30 September 2026: revenue of ₹73,188 crore, up about 11.2% from a year earlier, and net profit of ₹13,884 crore. Operating margin was 24%." },
        { date: "8 Oct", text: "The company said annualised AI revenue had crossed $3 billion, more than 10% of revenue. Total contract value for the quarter was $9.6 billion, and headcount stood at 598,056." },
        { date: "8 Oct", text: "Announced deals included a strategic partnership with Porsche AG with an agreement to acquire Porsche's MHP consulting subsidiary, subject to approvals, and the transition of Best Buy's India global capability centre to TCS as an AI capability centre." },
      ],
      numbers: [["$3 bn+", "Annualised AI revenue"], ["$9.6 bn", "Total contract value in the quarter"], ["24%", "Operating margin"]],
      layout: "pattern",
      exhibit: { kind: "waffle", title: "AI now earns more than one dollar in ten at TCS", unit: "Annualised AI revenue as a share of revenue, as reported, 100 squares", data: [["AI revenue", 10, "10%+"]], source: "TCS results for the quarter to 30 September 2026, as reported", note: "\"More than 10%\" as stated; the exact share was not disclosed." },
      matters: [
        "AI is being bought as a service line with measurable revenue, not only as a pilot. That changes what clients buy, how contracts are written and how suppliers are measured.",
        "Global capability centres are evolving too. Some are being handed to service providers to run and scale, particularly where AI skills are the bottleneck.",
      ],
      cast: [["Ram", "Managing director of A Ltd, which outsources much of its IT"], ["Sita", "Independent director at A Ltd with a technology background"], ["John", "Heads the India capability centre of R Inc, an overseas parent"]],
      scenario: [
        "Ram is about to sign a three-year contract under which a supplier will use AI to run A Ltd's customer service and invoice processing. The supplier promises a 30% cost reduction.",
        "Separately, John is weighing whether R Inc's India centre should stay in-house or be transferred to a service provider that can scale its AI teams faster.",
      ],
      perspective: [
        "In this scenario, our perspective is that the contract matters as much as the technology. Ram's agreement should set out who owns the data and the models trained on it, how errors made by AI are caught and corrected, which service levels apply, and what happens to the work, and the know-how, if the contract ends.",
        "Sita could ask for a short AI risk note to go to the board with the contract: what decisions the AI will make, what human checks remain, how customer data is protected, and how savings will be measured rather than assumed.",
        "For John, a transfer can bring speed and talent, but the parent should decide in advance what must stay in-house: intellectual property, sensitive data, and the people who understand the business best. A build-operate-transfer structure is one of several options; the right one depends on what R Inc wants the centre to be in five years.",
      ],
      questions: ["Who owns the data and the models in our AI contracts?", "How will we know the promised savings are real?", "What must never leave our own hands, even if the rest is outsourced?"],
      sources: [["Outlook Business: TCS Q2 results", "https://www.outlookbusiness.com/corporate/tcs-q2-results-profit-revenue-dividend-ai-workforce-deals-margins-share-price"]],
    },
    {
      id: "ai-rules-coming",
      section: "Technology",
      kicker: "AI policy",
      title: "AI rules are on their way",
      dek: "The Union Minister for Electronics and IT said a consultation paper on AI regulation would follow within a month, as the IndiaAI Mission sought up to 10,000 AI compute units hosted in India.",
      image: "kayak",
      facts: [
        { date: "~7 Oct", text: "C-DAC, the implementing agency for the IndiaAI Mission's compute infrastructure, issued a Request for Empanelment for AI service providers to supply up to 10,000 AI compute units, with all infrastructure, data, logs and backups in India." },
        { date: "8 Oct", text: "Union Minister Ashwini Vaishnaw said the time had come for AI regulation and asked for a consultation paper within a month. He described a techno-legal approach, emphasised safety and the harms of deepfakes, and said industry should take primary responsibility for cybersecurity, safety and user harm." },
        { date: "8 Oct", text: "He also said government AI use may follow an empanelment process, with a demand estimate of 10,000 GPUs and a first tender for 5,000." },
      ],
      numbers: [["10,000", "AI compute units sought"], ["512", "Minimum units per data-centre cluster"], ["1 month", "Promised timeline for a consultation paper"]],
      layout: "exhibit",
      exhibit: { kind: "gauge", title: "The first tender covers half of the compute the government expects to need", unit: "AI compute units (GPUs): first tender against demand estimate", data: [["First tender", 5000, "5,000"]], total: 10000, source: "MediaNama: 10,000 GPUs for the IndiaAI Mission" },
      matters: [
        "The direction is towards accountability on the part of those who build and deploy AI, with particular attention to safety and synthetic media.",
        "Government demand for in-country AI compute, with strict data residency, will shape where and how AI workloads for public projects are hosted.",
      ],
      cast: [["Geeta", "Founder of Q Pvt Ltd, which builds AI tools for banks and government departments"], ["Sita", "Independent director at Q Pvt Ltd"]],
      scenario: [
        "Q Pvt Ltd's products generate customer letters and summarise documents for banks, and it is bidding for a state government project. Its models run on overseas cloud infrastructure.",
        "Geeta wonders whether to wait for the consultation paper before investing in governance, or to start now.",
      ],
      perspective: [
        "In this scenario, our perspective is that Q Pvt Ltd can prepare without waiting. The themes are already visible: safety, accountability, protection against deepfakes and synthetic media, and data residency for government work. An inventory of every model Q uses, what data it sees and where it runs is useful under any rulebook.",
        "Geeta could put in place simple controls now: human review for outputs that affect customers, labelling of AI-generated content, logs that show what the system did and why, and a clear route for complaints. These are good practice regardless of what the final rules say.",
        "For the government bid, the hosting question may be decisive. Sita could ask the board to weigh the cost of in-country hosting against the size of the public-sector opportunity. Once the consultation paper is published, Q can respond to it with evidence from its own experience.",
      ],
      questions: ["Do we have a list of every AI model we use, and where it runs?", "Which of our AI outputs reach customers without a human check?", "Could we host our public-sector work in India if a contract required it?"],
      sources: [["MediaNama: MeitY to release AI regulation consultation paper", "https://www.medianama.com/2026/10/223-meity-consultation-paper-ai-regulation/"], ["MediaNama: 10,000 GPUs for the IndiaAI Mission", "https://www.medianama.com/2026/10/223-meity-ai-compute-providers-gpus-indiaai-mission/"]],
    },
    {
      id: "dpdp-countdown",
      section: "Technology",
      kicker: "Data protection",
      title: "Six months to the main event",
      dek: "Consent Manager registration opens on 13 November 2026. The duties that apply to most businesses under the DPDP Rules begin on 13 May 2027.",
      image: "confluence",
      facts: [
        { date: "13 Nov 2026", text: "Rule 4 of the DPDP Rules, on the registration of Consent Managers, comes into force, together with the related provisions of the Act." },
        { date: "13 May 2027", text: "The core duties begin: notice and consent (Rule 3), security safeguards (Rule 6), breach reporting (Rule 7), erasure (Rule 8), children's data and verifiable parental consent (Rules 10–12), duties of Significant Data Fiduciaries (Rule 13) and data principal rights (Rule 14), along with the penalty provisions." },
        { date: "Context", text: "Reports during the year indicated that the Data Protection Board's Chairperson and Members had not yet been appointed as of August 2026, and that a shorter timeline had been proposed but not notified." },
      ],
      numbers: [["13 Nov 2026", "Consent Manager registration"], ["13 May 2027", "Core duties begin"], ["Rule 7", "Breach reporting"]],
      layout: "quote",
      pull: "Discovering gaps in a rehearsal is far cheaper than discovering them in a real incident.",
      exhibit: { kind: "route", title: "Six months separate the first switch from the main event", unit: "DPDP Rules, dates in force", data: [["13 Nov 2026", 0, "Consent Manager registration (Rule 4)"], ["13 May 2027", 0, "Core duties begin (Rules 3, 6–8, 10–14)"]], beacon: 1, source: "DPDP Rules, 2025, as notified" },
      matters: [
        "Six months is a short time to map personal data, rewrite notices, build consent and rights processes, and prepare for breach reporting.",
        "Most businesses do not need to register as Consent Managers, but many will need to work with them.",
      ],
      cast: [["Sita", "Audit committee chair at B Ltd, a consumer lending company"], ["Shyam", "B Ltd's CFO, who also oversees technology"]],
      scenario: [
        "B Ltd holds personal data on two million borrowers across its app, its branches and three partner platforms. Its privacy notice was last updated in 2023, and nobody is sure which vendors still hold customer data.",
        "Shyam proposes to start work in March 2027. Sita is not convinced that leaves enough time.",
      ],
      perspective: [
        "In this scenario, our perspective is that B Ltd would benefit from starting now. A data map comes first: what personal data B holds, why, where it sits, who it is shared with and when it is deleted. Everything else, from notices to breach response, depends on it.",
        "Sita could ask for a phased plan with owners and dates, reviewed by the audit committee every month until May 2027. Vendors and partner platforms deserve early attention, because contracts take time to renegotiate.",
        "B Ltd might also test its breach response with a tabletop exercise before the rules require it. Discovering gaps in a rehearsal is far cheaper than discovering them in a real incident.",
      ],
      questions: ["Do we have a current map of the personal data we hold?", "Which vendors hold our customers' data today?", "Who would decide, within hours, whether a breach must be reported?"],
      sources: [["The Privacy Labs: DPDP, 13 November 2026, what starts", "https://theprivacylabs.com/blogs/dpdp-13-november-2026-what-starts"]],
    },
  ],
  spotlight: {
    tool: "NexaPair UAE",
    url: "https://www.nexapair.ae",
    image: "spot-nexapair-uae-1536.webp",
    kicker: "Kayak Solutions spotlight",
    title: "NexaPair UAE: third-party risk, built around UAE regulation",
    dek: "Every vendor is a door into the organisation. In the UAE, the Central Bank's new operational risk rules, in force since 14 September 2026, expect regulated firms to know exactly who is behind each one.",
    why: [
      "Banks, insurers and payment firms rely on hundreds of outside providers: cloud platforms, payment processors, call centres and consultants. Each one can carry fraud, sanctions, cyber or continuity risk into the business, and regulators increasingly hold the firm accountable for all of it.",
      "Most organisations still manage vendors across spreadsheets, email and separate tools for screening, cyber ratings and contracts. Findings are scattered, links between suppliers and staff go unnoticed, and preparing for an inspection takes weeks. NexaPair UAE brings these checks onto one vendor record, with a single explainable risk score.",
    ],
    regulation: [
      { date: "3 Feb 2026", text: "The Central Bank of the UAE issued the Operational Risk Management Regulation (Circular No. 1/2026), replacing the 2018 regulation and standards." },
      { date: "14 Sep 2026", text: "The regulation took effect. It requires risk assessment and due diligence before any third-party arrangement, mapping of third-party dependencies for each Critical Operation, and the CBUAE's no-objection, with 30 days' notice, before material changes to Critical Operations." },
      { date: "Clock", text: "Material events affecting Critical Operations must be notified to the CBUAE within 4 hours, followed by a summary report within 24 hours, and within 72 hours for high-risk incidents. The Master System of Record must be kept in the UAE." },
    ],
    modules: [
      ["NexaVerify", "Live", "Know who you are paying before anyone signs: identity, bank account and registration checks at onboarding."],
      ["NexaGraph", "Live", "Find the links nobody declared: shared addresses, accounts and people between vendors and your own staff."],
      ["NexaSentinel", "Live", "Hear about it first: sanctions re-screening every hour and incident clocks that run per regulator."],
      ["NexaCybe", "Live", "An outside-in cyber grade for every vendor."],
      ["NexaVatVeri", "Coming soon", "Protect input VAT under the FTA's supplier checks."],
      ["NexaComply", "Coming soon", "Compliance management for any country's laws, with the UAE pre-loaded."],
    ],
    helps: [
      ["Finance", "Pay the right party: bank and account checks before release, with a reason for every hold."],
      ["Procurement", "Onboard vendors by risk tier, with the right checks for each tier."],
      ["Compliance", "A requirement map across seven regimes, each line tied to its legal reference."],
      ["Risk", "One explainable score with factor weights, fourth-party mapping and concentration checks."],
      ["Board", "A board pack and a readiness view for each regulator."],
    ],
    numbers: [["7", "Regulatory regimes mapped"], ["192", "Requirements from 48 instruments"], ["Hourly", "Sanctions re-screening"], ["~6 wks", "Typical plan to go live"]],
    cast: [["Geeta", "Chief risk officer of P Bank, a mid-sized bank in Dubai"], ["Johnny", "Runs Q Pay, a cloud payments provider P Bank wants to onboard"]],
    scenario: [
      "P Bank wants to move card payments to Johnny's company, Q Pay, a Dubai cloud payments provider. Payments are a Critical Operation, so the change needs the Central Bank's no-objection, an external expert's report and evidence of due diligence.",
      "Geeta has six weeks. Her team must verify Q Pay and its subcontractors, check for links to P Bank staff, assess cyber posture, confirm where data will sit, and brief the board.",
    ],
    howItHelps: [
      "In this scenario, a platform like NexaPair would let Geeta's team run verification, link analysis, sanctions screening and a cyber grade on one record, map Q Pay's own subcontractors, and see each finding in a risk score that can be explained to the board and the regulator.",
      "The requirement map would show which CBUAE articles each step answers, and the incident clocks would be set up before go-live, not after the first outage. The decision, as always, stays with P Bank and its advisers.",
    ],
    disclosure: "Disclosure: NexaPair is a Kayak solution, developed and marketed by Kayak Technology Solutions, with its intellectual property held by Kayak Innovations (OPC) Private Limited. Kayak therefore has a commercial interest in it. Feature status (Live, Preview, Coming soon) is as published on nexapair.ae in November 2026. Regulatory summaries are not legal advice.",
    cta: "See it with your own vendors: a 30-minute demo in English or Arabic at www.nexapair.ae, or write to advisory@kayaksa.com.",
    sources: [["NexaPair UAE", "https://www.nexapair.ae"], ["Trowers & Hamlins: UAE Central Bank raises the bar on operational risk", "https://www.trowers.com/insights/2026/september/uae-central-bank-raises-the-bar-on-operational-risk"]],
  },
  agenda: [
    "Review the hedging policy and stress-test margins for higher rates and a weaker rupee.",
    "Ask how quickly the company could respond to a GST order or a SEBI letter, and who decides.",
    "Check the record of late disclosures and the controls that prevent them.",
    "Commission a data map and a phased DPDP plan, with monthly reporting to the audit committee.",
    "List every AI system in use, what it decides and where it runs.",
    "If a transaction or listing is possible in the next two years, start readiness work now.",
  ],
};

export const NOTICE = {
  short: "This is Kayak's perspective on the scenario described. Your perspective can be different, and may well be. It fits the scenario we picked and should not be applied universally to all scenarios. It is always advisable to consult rather than take your own call; our experts work on these questions every day. For more details, write to advisory@kayaksa.com.",
  full: [
    "Confluence is published by Kayak Strategic Advisors Private Limited for general information. The facts reported are drawn from the public sources cited, as available on 25 October 2026, and may have changed since. Recommendations of councils and boards take effect only when notified.",
    "Kayak's perspectives are opinions offered in good faith on fictional scenarios. All people and companies in the scenarios (Ram, Shyam, Sita, Geeta, John, Johnny, Janardan, and A, B, C, P, Q, R) are fictional; any resemblance to real persons or entities is coincidental. Where real companies are named, it is only to report public facts, not to comment on them.",
    "Our perspective is ours, and yours can be different, or may be different. A perspective that fits one scenario should not be applied universally to all scenarios. Nothing in Confluence is legal, tax, accounting or investment advice, and it does not create an adviser relationship. Kayak is not a law firm and does not practise law, and it is not a SEBI-registered investment adviser or research analyst; nothing here is a recommendation to buy, sell or hold any security.",
    "Kayak takes no political position. Confluence reports government and regulatory decisions as facts and does not comment on their political merits.",
    "It is always advisable to consult rather than to take your own call. For more details, or to discuss your situation with our experts, write to advisory@kayaksa.com.",
  ],
};
