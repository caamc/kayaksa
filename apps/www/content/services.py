# Service pages for www.kayaksa.com: one page per service, grouped by cluster.
# Run: python3 apps/www/content/services.py  -> apps/www/public/assets/services.json
import json, os, re

def slug(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")

S = []
def svc(cluster, name, summary, overview, when, what, approach, deliverables, outcomes, s=None, note=None):
    x = {"cluster": cluster, "slug": s or slug(name), "name": name, "summary": summary, "overview": overview,
         "when": when, "what": what, "approach": approach, "deliverables": deliverables, "outcomes": outcomes}
    if note: x["note"] = note
    S.append(x)

STD_APPROACH = None

# ---------------------------------------------------------------- Strategy, Deal & Transactions
C = "strategy-deals"
svc(C, "Growth and market-entry strategy",
  "Where to compete, how to win, and in what order: a growth plan your board can commit capital to.",
  ["Growth decisions are rarely short of ideas. They are short of evidence, sequence and the discipline to say no. We help leadership teams choose where to play, test whether the opportunity is as large and as reachable as it looks, and turn the choice into a plan with owners, milestones and capital attached.",
   "Because our strategy work sits beside our risk, regulatory and transactions practices, each option is judged on what it could earn and on what it could cost if it goes wrong, in one conversation rather than three."],
  ["You are deciding whether to enter a new state, segment, channel or country", "Growth has stalled and the board wants an independent view of why", "Several expansion options compete for the same capital", "An investor or lender wants a defensible business plan"],
  ["Market sizing and segmentation built from primary and secondary evidence", "Customer, channel and competitor research, including expert interviews", "Option appraisal: economics, capabilities, regulatory hurdles and risks", "Build, partner or buy analysis for each route to market", "Phased roadmap with investment case, milestones and leading indicators"],
  [["Read the water", "Clarify the ambition, constraints and the decision the board must take."], ["Test the options", "Gather evidence on markets, customers and competitors; size each option honestly."], ["Set the heading", "Recommend one route, with the reasons, the risks and what would change our mind."], ["Paddle together", "Translate the choice into a plan your team owns, and help launch it."]],
  ["Board-ready strategy paper with a clear recommendation", "Market model and option appraisal you can update", "Ninety-day launch plan with owners", "Risk and regulatory map for the chosen route"],
  ["A growth choice the board can defend", "Capital directed to the few moves that matter", "A plan that survives contact with execution"])

svc(C, "M&A advisory, buy side and sell side",
  "Senior support from first approach to closing, so the deal you sign is the deal you intended.",
  ["A transaction compresses years of strategy into weeks of negotiation. We act for buyers and sellers to frame the rationale, identify and approach counterparties, shape the structure and keep the process moving, with the same senior people at the table throughout.",
   "Our advice is independent of who finances or completes the deal. We are as willing to tell you to walk away as to sign."],
  ["You are considering an acquisition, merger, joint venture or divestment", "A counterparty has approached you and you need to respond well", "A promoter is planning succession or a partial exit", "A process has stalled and needs a fresh, senior hand"],
  ["Deal rationale, target screening and counterparty mapping", "Approach strategy, teasers, information memoranda and data-room readiness", "Negotiation support on price, structure and key terms", "Coordination of diligence, legal, tax and regulatory workstreams", "Signing-to-closing management and conditions precedent tracking"],
  [["Frame", "Agree why the deal makes sense, what it is worth to you and where your walk-away lies."], ["Find and approach", "Identify and engage the right counterparties, discreetly."], ["Negotiate", "Shape terms and structure with evidence, not adjectives."], ["Close", "Run the path from signing to completion so value is not lost at the finish."]],
  ["Deal thesis and valuation range", "Target or buyer long list and short list", "Negotiation playbook and term-sheet comments", "Closing checklist and integration hand-over"],
  ["A transaction that matches your strategy", "Fewer surprises between signing and closing", "One senior team accountable from start to finish"])

svc(C, "Commercial, financial and integrity due diligence",
  "What the numbers, the market and the people behind a deal are really telling you, before you commit.",
  ["Due diligence is no longer a box to tick before signing; increasingly it is the decision itself. We examine the business you are buying or backing from three angles at once: whether its market and customers support the plan, whether its earnings and cash are what they appear to be, and whether its promoters, partners and practices can be trusted.",
   "Findings are sourced, graded for reliability and written for decision-makers, with the price, structure and protection implications spelt out."],
  ["You are about to invest in, lend to or acquire a business", "A seller's numbers or growth story feel too good", "A target has related parties, complex ownership or a history you cannot see", "Your board or investment committee needs an independent view quickly"],
  ["Commercial diligence: market, customers, competition and plan credibility", "Financial diligence: quality of earnings, net debt, working capital and cash conversion", "Integrity diligence: promoters, ownership, related parties, litigation and reputation", "Red-flag reviews on short timelines", "Price, structure and warranty implications for each finding"],
  [["Scope", "Agree the questions that would change your decision, and focus there."], ["Gather", "Data room, management sessions, public records, interviews and site visits."], ["Test", "Challenge every claim against independent evidence."], ["Report", "Clear findings, how sure we are, and what to do about each."]],
  ["Red-flag or full diligence report", "Adjusted earnings and net debt bridge", "Integrity profile of promoters and key parties", "Deal implications: price, conditions, warranties and indemnities"],
  ["A decision made on evidence", "Leverage in negotiation", "Fewer post-deal surprises"])

svc(C, "Valuation support and deal structuring",
  "A defensible view of value, and a structure that shares risk and reward the way you intend.",
  ["Value is a range, not a number, and structure decides who carries the risk inside that range. We build valuation views that stand up to a board, an investor or a counterparty, and design structures, from earn-outs to staged investments, that align incentives after the deal.",
   "Where a registered valuer's report is required by law, we work alongside your valuer and advisers rather than replace them."],
  ["You need an independent view of value before negotiating", "Parties disagree on price and need a structure to bridge the gap", "You are raising capital or issuing instruments to investors", "A board must understand the assumptions behind a valuation"],
  ["Valuation analysis using income, market and asset approaches", "Scenario and sensitivity models showing what drives value", "Deal structures: earn-outs, deferred consideration, staged investment and options", "Term-sheet economics and investor return analysis", "Support for board and investment committee papers"],
  [["Understand", "The business, its drivers and the purpose of the valuation."], ["Model", "Build transparent models with assumptions you can see and challenge."], ["Structure", "Design terms that bridge gaps and align incentives."], ["Explain", "Present value and structure so decision-makers can own them."]],
  ["Valuation range with key assumptions", "Scenario model you can update", "Structuring options with pros and cons", "Board paper on value and terms"],
  ["Confidence in the price you pay or accept", "Incentives that hold after closing", "Clear, documented reasoning"])

svc(C, "Post-deal integration and fundraising readiness",
  "Capturing the value a deal promised, and preparing a business so investors see it at its best.",
  ["Most deal value is won or lost in the first hundred days after closing. We help acquirers set up integration governance, protect people and customers through the transition and track the synergies the deal was built on.",
   "For companies preparing to raise capital, we do the same work in reverse: putting the governance, reporting, compliance and story in order before investors look, so diligence is faster and valuation stronger."],
  ["A deal has just closed and integration must start now", "Expected synergies are slipping", "You plan to raise equity or debt in the next 6 to 18 months", "Investors have flagged governance or reporting gaps"],
  ["Day-one readiness and hundred-day integration plans", "Integration management office and synergy tracking", "Culture, people and customer retention planning", "Fundraising readiness review: governance, reporting, compliance and data room", "Investor story, business plan and diligence preparation"],
  [["Assess", "Where value sits and what could put it at risk."], ["Plan", "Priorities, owners and milestones for the first hundred days or the raise."], ["Run", "Weekly governance, issue resolution and tracking."], ["Hand over", "Leave the capability in your team."]],
  ["Integration or readiness plan", "Synergy or readiness tracker", "Governance and reporting fixes", "Investor-ready data room checklist"],
  ["Deal value realised, not just announced", "A smoother, faster raise", "A stronger organisation afterwards"])

# ---------------------------------------------------------------- Tax, Legal & Regulatory
C = "tax-legal-regulatory"
svc(C, "Direct tax, GST and transfer-pricing support",
  "Tax positions that are defensible, documented and aligned with how your business actually runs.",
  ["Tax is where strategy meets scrutiny. We help businesses take clear, well-documented positions on direct tax, GST and transfer pricing, review existing positions for exposure, and prepare for assessments and audits before they arrive.",
   "We work with your chartered accountants and tax counsel, bringing a business and risk lens so tax decisions fit the commercial reality and the evidence behind them is ready."],
  ["You are restructuring, entering a new business or changing supply chains", "GST credits, classifications or reconciliations are causing friction", "Related-party pricing needs to be supported for transfer-pricing purposes", "A notice, audit or assessment is likely or under way"],
  ["Tax health checks across direct tax and GST", "Transaction and restructuring tax impact analysis, with your advisers", "Transfer-pricing policy, benchmarking support and documentation readiness", "GST process reviews: classification, input credit and reconciliations", "Audit and assessment preparation, including evidence packs"],
  [["Map", "Your transactions, entities and flows, and where tax touches them."], ["Assess", "Exposure, opportunity and the strength of current positions."], ["Fix", "Processes, documentation and controls."], ["Defend", "Evidence and narrative ready for scrutiny."]],
  ["Tax risk map with priorities", "Position papers and documentation", "Process and control fixes", "Assessment-ready evidence packs"],
  ["Fewer disputes and surprises", "Positions you can explain", "Cleaner audits"])

svc(C, "SEBI, RBI, FEMA and Companies Act compliance",
  "Regulatory obligations understood, organised and met, without drowning the business in paperwork.",
  ["Indian companies answer to several regulators at once, and the rules change often. We help boards and management understand what applies to them under SEBI regulations, RBI directions, FEMA and the Companies Act, build compliance frameworks proportionate to their size and risk, and test whether those frameworks actually work.",
   "Our role is to organise and assure compliance; where a legal opinion is needed, we work alongside your counsel."],
  ["You are listing, raising foreign capital or entering a regulated activity", "A regulator has raised observations or issued a notice", "Compliance sits in spreadsheets and individual memory", "The board wants assurance that obligations are being met"],
  ["Applicability assessments and obligation registers", "Compliance frameworks, policies and calendars", "Board, committee and related-party process reviews", "Compliance testing and remediation tracking", "Support for responses to regulatory observations, with counsel"],
  [["Identify", "Every obligation that applies, and who owns it."], ["Design", "Processes and controls proportionate to risk."], ["Test", "Whether the controls work in practice."], ["Report", "Clear assurance to management and the board."]],
  ["Obligation register and compliance calendar", "Policy and process set", "Testing report with remediation plan", "Board compliance dashboard"],
  ["Obligations met on time", "Fewer regulatory findings", "Board confidence"])

svc(C, "Data protection readiness under the DPDP Act",
  "Ready for the Digital Personal Data Protection Act, 2023 and its Rules: practical, proportionate and provable.",
  ["The DPDP Act and the DPDP Rules, 2025 make personal data a board-level responsibility, with penalties of up to ₹250 crore for failing to protect it. We help organisations understand what personal data they hold and why, put consent, notice and rights processes in place, secure data and their processors, and prepare to respond to a breach within the required timelines.",
   "We focus on what matters for your business and your data, not on generic checklists, and we leave you with evidence that you comply."],
  ["You collect personal data from customers, employees or partners in India", "You use processors, cloud services or AI tools that touch personal data", "You may be notified as a Significant Data Fiduciary", "You have had, or fear, a personal data breach"],
  ["Data discovery and mapping of personal data flows", "Gap assessment against the DPDP Act and Rules", "Consent, notice, rights-request and grievance processes", "Processor contracts, security safeguards and retention schedules", "Breach-response playbooks and simulations"],
  [["Discover", "What personal data you hold, where and why."], ["Assess", "Gaps against the Act and Rules, ranked by risk."], ["Implement", "Processes, notices, contracts and controls."], ["Prove", "Evidence, training and a tested breach response."]],
  ["Personal data inventory and flow map", "DPDP gap assessment and roadmap", "Notices, consent and rights processes", "Breach-response playbook"],
  ["Lower regulatory and reputational risk", "Customer trust", "Evidence of compliance when asked"])

svc(C, "ESG and BRSR reporting",
  "Sustainability disclosures that are credible, consistent and connected to how the business is run.",
  ["SEBI's Business Responsibility and Sustainability Report has turned ESG from a narrative into data that investors, lenders and customers compare. We help companies scope their obligations, build the data processes behind each indicator, prepare disclosures, and get ready for the assurance now expected on core metrics.",
   "We also help boards see which ESG topics are genuinely material to their business, so effort goes where it creates value."],
  ["You must file a BRSR, or your customers and lenders ask for ESG data", "BRSR Core assurance is approaching", "ESG data is scattered across sites and spreadsheets", "The board wants to understand material ESG risks and opportunities"],
  ["Materiality assessment and stakeholder engagement", "BRSR and BRSR Core gap assessment", "Data collection processes, controls and ownership", "Drafting and review of disclosures", "Readiness for reasonable assurance"],
  [["Scope", "What you must report and what is material."], ["Build", "Data processes and controls for each indicator."], ["Report", "Clear, consistent disclosures."], ["Assure", "Evidence ready for the assurance provider."]],
  ["Materiality matrix", "BRSR gap report and data model", "Draft disclosures", "Assurance-readiness pack"],
  ["Credible disclosures", "Smoother assurance", "ESG linked to strategy"])

svc(C, "Regulatory change monitoring and board briefings",
  "The regulatory changes that matter to you, explained in plain English, before they bite.",
  ["New rules arrive weekly from regulators, ministries and courts. We track the changes relevant to your sector and business, explain what each means in practice, and brief boards and leadership on what to do and by when.",
   "Briefings are short, sourced and specific to you: no newsletters to file away, just decisions and deadlines."],
  ["Your business is regulated by more than one authority", "The board wants a periodic, independent regulatory briefing", "Compliance teams are stretched by the pace of change", "You need to understand the impact of a major new law"],
  ["Regulatory horizon scanning for your sector", "Impact assessments of new laws, rules and circulars", "Monthly or quarterly board briefings", "Implementation trackers for new obligations", "Workshops for leadership and compliance teams"],
  [["Track", "The sources and changes relevant to you."], ["Interpret", "What each change means for your business."], ["Brief", "Concise board and management updates."], ["Track action", "Owners and deadlines until implemented."]],
  ["Regulatory horizon report", "Impact notes on significant changes", "Board briefing papers", "Implementation tracker"],
  ["No surprises from new rules", "Faster, cheaper implementation", "A better-informed board"])


# ---- Legal support services. Kayak is not a law firm: under the Advocates Act, 1961 only enrolled
# advocates may practise law in India. These services are research, evidence, drafting-support,
# negotiation and process work done alongside the client's advocates or independent law firms.
LEGAL_NOTE = ("Kayak Strategic Advisors is not a law firm and does not practise law. Legal advice, legal opinions, "
  "the settling and signing of pleadings and legal documents, and appearances before courts, tribunals and authorities "
  "are provided by your advocates or by independent law firms that we work alongside. Our work supports theirs.")

svc(C, "Paralegal and research services",
  "Careful legal research, document work and matter support that gives lawyers back their time for judgement.",
  ["Every legal matter rests on work that is painstaking rather than glamorous: finding the right judgment, checking that a provision is still in force, reading thousands of pages for the one that matters, and keeping a chronology that never slips. We take on that work for law firms, in-house legal teams and family offices, to a standard their advocates can rely on.",
   "Our researchers combine legal training with Kayak's investigation and data skills, so research is thorough, sourced and fast. Every output is prepared for review by the instructing advocate, who keeps control of the advice."],
  ["Your legal team is stretched across too many matters at once", "A dispute, arbitration or regulatory proceeding involves large volumes of documents", "You need research across statutes, rules, circulars and case law, quickly and with sources", "A family office or promoter group wants its legal papers organised and tracked"],
  ["Statutory, regulatory and case-law research with full citations, including the Bharatiya Nyaya Sanhita, Bharatiya Nagarik Suraksha Sanhita and Bharatiya Sakshya Adhiniyam, which replaced the colonial-era codes in 2024",
   "Research memos for the advocate's review, separating settled positions from open questions",
   "Document review, indexing and coding for disputes, arbitrations and due diligence",
   "Case chronologies, lists of dates and dramatis personae",
   "Matter, hearing and limitation tracking, with cause-list monitoring",
   "Translation support for documents in Indian languages, with certified translation arranged where required"],
  [["Brief", "Agree the question, the sources, the format and the deadline with the instructing advocate."], ["Research", "Search, read and verify, recording every source."], ["Review", "Senior quality checks before anything leaves us."], ["Hand over", "Clear, sourced work product for the advocate's use."]],
  ["Sourced research memos", "Document indices and review logs", "Chronologies and lists of dates", "Matter and limitation trackers"],
  ["More advocate time spent on judgement", "Fewer missed authorities and dates", "Lower cost per matter"],
  note=LEGAL_NOTE)

svc(C, "Evidence-backed response drafting support for law firms and family offices",
  "Replies to notices, allegations and regulators built on verified facts and organised evidence, ready for counsel to settle.",
  ["A strong response to a legal notice, a show-cause notice, a tax or regulatory query, or a public allegation is won or lost on facts. We gather the facts, test them, assemble the evidence and prepare a first draft of the factual response, so that the advocate settling it starts from a complete and accurate record rather than an empty page.",
   "For family offices and promoter families, we bring the same discipline to sensitive matters: allegations against the family or its businesses, disputes between members or with former employees, and questions from banks or regulators, handled discreetly and with a clear chain of evidence."],
  ["You have received a legal notice, show-cause notice or regulatory query with a tight deadline", "Allegations against a company, promoter or family member need a fact-based answer", "Your law firm needs a factual record and evidence bundle before drafting", "Records are scattered across entities, people and years"],
  ["Fact-finding from documents, records, interviews and lawful open sources",
   "Evidence bundles indexed to each allegation or query, with documents traced to their source",
   "Electronic-record handling with chain-of-custody notes, and support for the certificates required under section 63 of the Bharatiya Sakshya Adhiniyam, 2023",
   "Chronologies, reconciliations and analysis that answer the points raised",
   "First drafts of factual responses and annexures, for the advocate to settle and sign",
   "Response trackers for deadlines, follow-ups and hearings"],
  [["Understand", "What is alleged or asked, by when, and what must be proved."], ["Establish", "Collect and verify the facts and the evidence for each point."], ["Draft", "A factual response and annexures, organised point by point."], ["Hand over", "To your advocate to settle, sign and file; we support follow-ups."]],
  ["Point-by-point fact matrix", "Indexed evidence bundle", "Draft factual response and annexures", "Deadline and follow-up tracker"],
  ["Responses that rest on evidence, not assertion", "Deadlines met without panic", "Stronger positions for counsel"],
  s="evidence-backed-response-drafting-support", note=LEGAL_NOTE)

svc(C, "Deal negotiation, agreement and closure services",
  "From term sheet to signing to closing: negotiation strategy, clean documents and a closing that actually happens.",
  ["Deals rarely fail on headline price. They fail on conditions nobody tracked, positions conceded too early and documents that do not say what the parties agreed. We sit on your side of the table to prepare the negotiation, keep commercial positions consistent from term sheet to definitive agreements, and run the process to a clean closing.",
   "We work hand in hand with your deal counsel, who drafts and settles the transaction documents. We bring the commercial, financial and risk view, the issues list and the discipline that gets every condition precedent ticked off."],
  ["You are buying, selling, investing in or partnering with a business", "A term sheet is on the table and the negotiation strategy is not yet clear", "Definitive agreements are drifting from what was agreed commercially", "Closing keeps slipping because conditions and approvals are not tracked"],
  ["Negotiation preparation: objectives, walk-away points, trade-offs and counterparty analysis",
   "Term sheet and heads of terms support, aligned with valuation and diligence findings",
   "Issues lists and mark-up reviews from a commercial and risk perspective, alongside counsel",
   "Disclosure, warranty and indemnity support linked to diligence findings",
   "Conditions-precedent, approvals and closing checklists, including regulatory and FEMA filings coordinated with your advisers",
   "Closing coordination, funds-flow memos and post-closing integration plans"],
  [["Prepare", "Objectives, limits and the negotiation plan."], ["Negotiate", "Consistent positions from term sheet to final documents."], ["Document", "With your counsel, documents that match the deal."], ["Close", "Every condition, approval and signature, on time."]],
  ["Negotiation playbook", "Issues list and position tracker", "Closing checklist and CP tracker", "Funds-flow memo and post-closing plan"],
  ["Better terms, held to the end", "Fewer surprises after signing", "Deals that close"],
  note=LEGAL_NOTE)

svc(C, "Contract drafting and management services",
  "Contracts that say what you mean, and a contract book you can actually see, search and manage.",
  ["Most organisations sign more contracts than they can track. Renewal dates pass, obligations go unmet and risky clauses hide in old templates. We help businesses prepare first drafts and playbooks for routine commercial contracts, and put in place contract management that shows what has been signed, what it commits you to and what is due next.",
   "Routine agreements are drafted from templates and playbooks approved by your legal team or counsel; anything non-standard, high-value or contentious goes to your advocates to settle. Execution can be digital, through DocuVow, Kayak's e-signature solution, with stamp duty under the applicable state law handled correctly."],
  ["Contracts sit in inboxes and shared drives, and nobody knows what is due", "Your team spends too long on routine agreements", "Templates are old, inconsistent or one-sided in the wrong direction", "An audit, dispute or transaction requires a quick view of all contracts"],
  ["Template libraries and negotiation playbooks for routine contracts: NDAs, service, supply, distribution, consultancy and licence agreements, settled with your counsel",
   "First drafts and mark-ups of routine contracts within agreed playbooks, escalating anything outside them",
   "Contract repository set-up, with key terms, dates and obligations extracted and searchable",
   "Obligation, renewal and expiry tracking with alerts to owners",
   "Stamp duty and execution checklists, and digital signing through DocuVow where the law permits",
   "Contract audits that flag risky, missing or outdated clauses"],
  [["Gather", "Every contract, wherever it sits."], ["Organise", "A searchable repository with key terms extracted."], ["Standardise", "Templates and playbooks agreed with your counsel."], ["Manage", "Alerts, renewals and reports, month after month."]],
  ["Contract repository and key-terms register", "Template library and playbooks", "Obligation and renewal calendar", "Contract audit report"],
  ["No missed renewals or obligations", "Faster routine contracting", "Less risk hidden in old paper"],
  note=LEGAL_NOTE)

svc(C, "Compliance and legal housekeeping services",
  "Registers, filings, licences and records kept in order, so the company is always ready for an audit, a diligence or a deal.",
  ["Legal housekeeping is invisible when it is done well and very expensive when it is not. Missing registers, lapsed licences, unfiled forms and minutes that cannot be found surface at the worst moments: in a due diligence, a fundraise, an inspection or a dispute. We keep the house in order, on a schedule, and show you its state at any time.",
   "We work with your company secretary, chartered accountants and counsel. Filings and certifications that the law reserves for a practising company secretary, chartered accountant or advocate are signed by them; we prepare, track and organise everything around those filings."],
  ["You are preparing for a fundraise, a sale, an IPO or a lender's diligence", "Registers, minutes and filings are incomplete or scattered", "Licences and registrations across states are hard to keep track of", "Group entities have grown faster than their paperwork"],
  ["Corporate housekeeping health checks across group entities: statutory registers, minutes, resolutions and MCA filings",
   "Compliance calendars for corporate, labour, tax, environmental and sector-specific obligations, including the four labour codes",
   "Licence, registration and renewal trackers across states and sites",
   "Board, committee and shareholder meeting support: agendas, notes and action tracking, alongside the company secretary",
   "Virtual data-room build and maintenance, ready for diligence",
   "Remediation of gaps found, with owners, dates and evidence"],
  [["Inventory", "Entities, obligations, records and owners."], ["Fix", "Close the gaps, oldest and riskiest first."], ["Run", "Calendars, trackers and reminders that keep it clean."], ["Prove", "A data room and a status report that answers diligence questions."]],
  ["Housekeeping health-check report", "Compliance calendar and licence tracker", "Organised registers and records", "Diligence-ready data room"],
  ["Always ready for diligence and audits", "No lapsed licences or late filings", "Lower compliance cost"],
  note=LEGAL_NOTE)

# ---------------------------------------------------------------- Crisis & Resilience
C = "crisis-resilience"
svc(C, "Enterprise and third-party risk",
  "Seeing what could go wrong across the enterprise and its partners, early enough to act.",
  ["Risk management earns its keep when it changes decisions. We build enterprise risk frameworks aligned with COSO and ISO 31000 that leadership actually uses, with risk appetite, owners and indicators that warn before a risk becomes a loss.",
   "Because so much risk now sits with suppliers, agents, distributors and technology providers, we extend the same discipline to third parties: tiering them by risk, carrying out proportionate due diligence and monitoring them through the relationship."],
  ["Your risk register is updated once a year and read by no one", "A Risk Management Committee or board wants a sharper view", "You depend on critical suppliers or intermediaries", "A third-party failure or scandal has exposed you"],
  ["Enterprise risk frameworks, appetite statements and registers", "Key risk indicators and board risk reporting", "Third-party risk programmes: tiering, due diligence and monitoring", "Risk workshops and scenario analysis", "Integration with NexaPair for ongoing third-party monitoring"],
  [["Identify", "Risks across strategy, operations, compliance and partners."], ["Assess", "Likelihood, impact and the controls that really work."], ["Respond", "Owners, actions and indicators."], ["Monitor", "Reporting that keeps the board ahead."]],
  ["Risk framework and appetite statement", "Risk register with owners and indicators", "Third-party risk tiering and due diligence", "Board risk dashboard"],
  ["Earlier warning", "Fewer partner-driven surprises", "Risk-informed decisions"])

svc(C, "Malfeasance, defalcation and conduct forensics",
  "Privileged, evidentiary-grade inquiries, conducted under a forensically sound chain of custody.",
  ["When an allegation surfaces, through a protected disclosure, an auditor or a regulator, the first days decide whether the facts can be established and the institution protected. We conduct discreet, independent inquiries into defalcation, malfeasance, undisclosed conflicts and conduct breaches, ordinarily structured through your counsel so that privilege is preserved.",
   "Evidence is gathered lawfully and preserved under a forensically sound chain of custody, so findings stand up before a board, a regulator, an arbitral tribunal or a court."],
  ["A whistleblower complaint or audit finding needs independent inquiry", "Indications of defalcation, illicit gratification or misstatement have emerged", "Senior people are implicated and independence matters", "Regulators, auditors or lenders expect a credible investigation"],
  ["Rapid triage and investigation planning in the first 48 hours", "Forensic accounting and transaction analysis", "Digital evidence preservation and review", "Interviews conducted fairly and documented properly", "Root-cause analysis and control remediation"],
  [["Contain", "Preserve evidence and protect people in the first hours."], ["Investigate", "Documents, data and interviews, in a planned order."], ["Conclude", "Findings based on evidence, with how sure we are."], ["Remediate", "Fix the controls that allowed it."]],
  ["Investigation plan and evidence log", "Findings report for the board or counsel", "Quantification of loss", "Control remediation plan"],
  ["The facts, established properly", "Protection for the organisation and its people", "Credibility with regulators and auditors"])

svc(C, "Proprietary-mark sanctity and spurious-goods interdiction",
  "Preserving the sanctity of your proprietary marks against spurious, passing-off and parallel-import goods, across digital and physical channels.",
  ["Counterfeits now move at the speed of a marketplace listing. We help brand owners understand where spurious, passing-off and parallel-import goods are coming from, how they reach customers, and how to stop them, across e-commerce platforms, social media and physical markets.",
   "Our work turns scattered complaints into an intelligence picture, and the picture into action: takedowns, supply-chain disruption and, with your counsel, enforcement."],
  ["Customers or distributors report fake or diverted products", "Your sales in a region or channel are falling without explanation", "Look-alike listings are multiplying online", "You need evidence before taking enforcement action"],
  ["Market and online surveillance for counterfeit and infringing goods", "Source and supply-chain tracing", "Marketplace and social-media takedown programmes", "Evidence collection to support enforcement with counsel", "Brand-protection strategy and metrics, connected to SeeCounter"],
  [["Detect", "Where fakes and diversion appear, and how much."], ["Trace", "Who supplies them and how they move."], ["Interdict", "Takedowns, disruption and, with counsel, enforcement."], ["Sustain", "Monitoring that keeps pressure on."]],
  ["Counterfeit landscape assessment", "Source and network map", "Takedown and enforcement log", "Brand-protection dashboard"],
  ["Less revenue lost to fakes", "Safer customers", "A brand that is harder to copy"])

svc(C, "IP enforcement support with your counsel",
  "The market evidence your lawyers need to act on trademark, copyright and design infringement.",
  ["Legal action on intellectual property is only as strong as the evidence behind it. We support brand owners and their counsel with lawful market surveys, test purchases, documentation of infringing activity and profiles of infringers, gathered and preserved so it can be relied on in proceedings and raids.",
   "We work under your counsel's direction and within the law at every step."],
  ["Your counsel is preparing a suit, raid or complaint", "You need proof of infringement in specific markets or online", "Infringers are using front companies or changing names", "Previous actions failed for lack of evidence"],
  ["Market surveys and test purchases", "Documentation of online and offline infringement", "Infringer identification and profiling", "Support for raids and seizures alongside counsel and authorities", "Evidence packs with a documented chain of custody"],
  [["Brief", "Agree objectives and evidence standards with counsel."], ["Gather", "Lawful surveys, purchases and documentation."], ["Profile", "Who is behind the infringement."], ["Support", "Evidence and people for the action."]],
  ["Market survey report", "Test-purchase records and samples", "Infringer profiles", "Evidence pack for counsel"],
  ["Stronger cases", "Faster action", "Infringers who cannot hide"])

svc(C, "Expert Witness & Arbitration",
  "Independent expert opinion and forensic evidence before courts, arbitral tribunals and regulators.",
  ["Complex disputes turn on numbers, causation and specialist evidence. We provide independent expert opinions on quantum, damages, accounting, valuation and causation, and support counsel through disclosure, expert reports, joint expert meetings and cross-examination.",
   "Our duty as experts is to the tribunal: opinions are independent, reasoned and transparent about their assumptions, which is precisely what makes them persuasive."],
  ["You are in, or anticipate, a commercial dispute or arbitration", "Damages or loss must be quantified credibly", "A tribunal needs specialist accounting, forensic or valuation evidence", "Counsel needs help testing the other side's expert"],
  ["Quantum and damages assessment", "Causation and forensic accounting analysis", "Independent expert reports and testimony", "Shadow expert support and review of opposing reports", "Support with disclosure, document review and joint statements"],
  [["Understand", "The issues in dispute and the evidence available."], ["Analyse", "Independent, transparent analysis."], ["Report", "Clear expert reports that meet procedural rules."], ["Testify", "Measured, well-prepared testimony."]],
  ["Expert report", "Quantum model and supporting schedules", "Critique of opposing expert evidence", "Testimony and hearing support"],
  ["Credible evidence before the tribunal", "Stronger negotiating position", "Decisions grounded in sound analysis"], s="expert-witness-arbitration")

svc(C, "Crisis management and business continuity",
  "Prepared before the storm, steady during it, and quicker to recover afterwards.",
  ["Crises rarely announce themselves. We help organisations prepare with clear crisis governance, playbooks for their most likely scenarios and realistic simulations, so leaders know their roles before they need them.",
   "When a crisis breaks, a fraud, a data breach, an allegation, a product issue or an operational failure, senior Kayak advisers can mobilise to support decision-making, stakeholder communication and the investigation, and then help you recover and learn."],
  ["You have no tested crisis plan", "A crisis has broken and you need senior support now", "Regulators or customers expect business continuity assurance", "The board wants to rehearse its response to severe scenarios"],
  ["Crisis governance, roles and escalation", "Scenario playbooks and business continuity plans", "Tabletop exercises and simulations for leadership and boards", "On-the-day crisis support and decision logs", "Post-crisis reviews and resilience improvements"],
  [["Prepare", "Governance, playbooks and continuity plans."], ["Rehearse", "Realistic simulations for the people who will lead."], ["Respond", "Senior support when it happens."], ["Recover", "Lessons learned and resilience built in."]],
  ["Crisis management framework", "Scenario playbooks and continuity plans", "Simulation reports", "Post-incident review"],
  ["Faster, calmer decisions under pressure", "Less damage to trust and operations", "A more resilient organisation"])

# ---------------------------------------------------------------- Technology & AI
C = "technology-ai"
svc(C, "Digital and data strategy",
  "Technology and data choices that serve the business strategy, not the other way round.",
  ["Every business now runs on software and data, but few have a clear view of which investments create value. We help leadership teams set a digital and data strategy tied to business outcomes, prioritise initiatives, and choose and govern the platforms and partners that deliver them.",
   "We are independent of technology vendors, so our advice follows your interests."],
  ["Digital spending is rising without clear returns", "You are choosing a major platform or technology partner", "Data sits in silos and leaders do not trust the numbers", "The board wants a technology roadmap it understands"],
  ["Digital maturity and capability assessment", "Data strategy, governance and operating model", "Initiative prioritisation and business cases", "Vendor-neutral platform and partner selection", "Technology roadmap and governance for the board"],
  [["Understand", "Business goals and current technology."], ["Prioritise", "Initiatives by value, effort and risk."], ["Decide", "Platforms, partners and operating model."], ["Govern", "Roadmap and measures the board can follow."]],
  ["Digital and data maturity report", "Prioritised initiative portfolio", "Platform selection recommendation", "Technology roadmap"],
  ["Spending aligned to value", "Trusted data", "Clear ownership"])

svc(C, "AI adoption, use cases and governance",
  "Using AI where it creates real value, safely, lawfully and with people in control.",
  ["AI can transform how work is done, but only where the use case, the data and the controls are right. We help organisations find and prioritise AI use cases, run disciplined pilots, and put governance in place aligned with the NIST AI Risk Management Framework, ISO/IEC 42001 and, where relevant, the EU AI Act and Indian guidance.",
   "The aim is AI that the business trusts, regulators accept and customers would be comfortable with."],
  ["Teams are experimenting with AI without a policy", "You want to know where AI would genuinely pay back", "AI will influence decisions about customers or employees", "The board asks how AI risk is governed"],
  ["Use-case discovery and value assessment", "Pilot design, evaluation and scale-up decisions", "AI policies, inventories and risk assessments", "Data protection, security and vendor reviews for AI tools", "AI literacy for boards and staff"],
  [["Discover", "Where AI could add value, and the risks."], ["Pilot", "Small, measured experiments with clear success criteria."], ["Govern", "Policy, inventory, oversight and controls."], ["Scale", "What works, rolled out responsibly."]],
  ["AI opportunity map", "Pilot evaluation reports", "AI governance framework and policy", "Training for leaders and staff"],
  ["AI value, not AI theatre", "Managed risk", "Regulator-ready governance"])

svc(C, "Analytics, dashboards and data quality",
  "Numbers leaders trust, presented so the next decision is obvious.",
  ["Leaders make better decisions with fewer, better numbers. We design the metrics that matter, fix the data quality issues that undermine trust, and build dashboards and analyses that show what is happening and why.",
   "We also apply analytics to risk: detecting anomalies in payments, procurement and sales that may signal error or fraud."],
  ["Different reports give different answers", "Dashboards exist but nobody uses them", "You want to monitor risk and controls with data", "Management information takes too long to produce"],
  ["KPI and metric design", "Data quality assessment and remediation", "Dashboard and reporting design", "Advanced analytics and forecasting", "Risk and fraud analytics on transactions"],
  [["Define", "The decisions and the metrics that inform them."], ["Clean", "Data sources, definitions and quality."], ["Build", "Dashboards and analyses people use."], ["Embed", "Ownership and routines around the numbers."]],
  ["Metric dictionary", "Data quality report and fixes", "Dashboards and reports", "Analytics findings"],
  ["One version of the truth", "Faster decisions", "Earlier detection of anomalies"])

svc(C, "Cyber-risk assessment",
  "An honest view of your cyber exposure, in business terms, with priorities you can fund.",
  ["Cyber risk is a business risk: to revenue, reputation and regulatory standing. We assess your exposure against recognised frameworks, review your most critical systems, data and third parties, and present the results to leadership in business language, with a prioritised roadmap.",
   "We coordinate specialist technical testing through qualified partners where it is needed and focus our own work on governance, risk and readiness."],
  ["The board asks how exposed the company is to a cyber attack", "Regulators, customers or insurers want assurance", "You hold sensitive data or run critical operations online", "You have had an incident or a near miss"],
  ["Cyber-risk and maturity assessment against recognised frameworks", "Critical asset, data and third-party exposure review", "Incident response readiness and tabletop exercises", "Policy, governance and board reporting", "Coordination of technical testing with qualified partners"],
  [["Scope", "Critical assets, data and threats."], ["Assess", "Controls and maturity against frameworks."], ["Prioritise", "Risks by business impact."], ["Prepare", "Roadmap and incident readiness."]],
  ["Cyber-risk assessment report", "Prioritised improvement roadmap", "Incident response playbook", "Board cyber briefing"],
  ["Clear priorities for investment", "Readiness for an incident", "Board-level understanding"])

svc(C, "Technology due diligence for deals",
  "What you are really buying when you buy a business's technology.",
  ["In many deals the technology is the business. We assess the architecture, code and product, data and security posture, team and processes, and the cost of scaling or integrating what you are buying, then translate the findings into value, risk and integration implications.",
   "Findings are written for investors and boards, not just engineers."],
  ["You are investing in or acquiring a technology-led business", "The target's product claims need independent testing", "Integration costs could change the price", "Data protection or security risks could follow the deal"],
  ["Architecture, scalability and technical debt review", "Product and roadmap assessment", "Data protection and security posture review", "Team, processes and key-person risk", "Integration and investment requirements"],
  [["Scope", "The technology questions that affect value."], ["Review", "Documents, demonstrations and interviews."], ["Assess", "Risks, costs and opportunities."], ["Advise", "Implications for price, terms and integration."]],
  ["Technology diligence report", "Risk and remediation cost estimate", "Integration considerations", "Deal implications summary"],
  ["No hidden technical debt", "Realistic integration plans", "A better-informed price"])

svc(C, "Bespoke platforms and Kayak solutions",
  "Solutions built from our advisory work, thought, designed and developed in India for the world.",
  ["Some problems are best solved by software that encodes good practice. Our Technology & AI team, with Kayak Technology Solutions, builds and runs platforms that grew directly out of client work: SayUsNow for ethics and compliance, SeeCounter for counterfeiting case intelligence, NexaPair for third-party risk and DocuVow for e-signatures.",
   "We also design bespoke tools for clients whose processes deserve more than spreadsheets, and support them in production."],
  ["Your compliance or risk process runs on email and spreadsheets", "You want a proven platform with advisers behind it", "You need a bespoke tool built to your process", "You want to digitise a manual control"],
  ["Deployment of SayUsNow, SeeCounter, NexaPair and DocuVow", "Configuration to your policies and workflows", "Bespoke tool design and development", "Integration with your existing systems", "Hosting, support and continuous improvement"],
  [["Understand", "Your process and the outcome you need."], ["Configure or build", "Platform set-up or bespoke development."], ["Launch", "Training, data migration and go-live."], ["Support", "Ongoing improvement with our advisers."]],
  ["Configured platform or bespoke tool", "User training and guides", "Integration and data migration", "Support and improvement plan"],
  ["Faster, more consistent processes", "Better evidence and audit trails", "Technology backed by advisory experience"], s="kayak-solutions")

# ---------------------------------------------------------------- Managed Services
C = "managed-services"
svc(C, "Outsourced compliance calendars and filings support",
  "Every statutory deadline tracked, prepared and evidenced, so nothing slips.",
  ["Missed filings create penalties, notices and avoidable board anxiety. We run compliance calendars for companies and groups, tracking obligations across company law, tax, labour and sector regulation, preparing the information required, coordinating with your advisers, and evidencing completion.",
   "You get a single, current view of what is due, what is done and what needs attention."],
  ["Deadlines are tracked in personal calendars or not at all", "Your group has many entities and states", "Your team is too small to keep up with the volume", "You have paid penalties for late filings"],
  ["Entity-wise obligation mapping and calendars", "Preparation and coordination of filings with your advisers", "Monthly compliance status reporting", "Evidence repository for completed obligations", "Escalation of risks and changes"],
  [["Map", "Every obligation across entities."], ["Run", "Monthly preparation and coordination."], ["Evidence", "Proof of every completed obligation."], ["Report", "Clear status to management and the board."]],
  ["Compliance calendar", "Monthly status report", "Evidence repository", "Exception and escalation log"],
  ["No missed deadlines", "Lower penalty risk", "Time back for your team"])

svc(C, "Virtual CFO and finance operations",
  "Senior finance leadership and reliable finance operations, without a full-time hire.",
  ["Growing companies often need a seasoned finance leader before they can justify one full time. Our virtual CFO service provides senior oversight of budgeting, cash, reporting, controls, banking and investor relations, while our team runs or strengthens day-to-day finance operations.",
   "The result is the finance function a larger company would have, scaled to your stage."],
  ["You are growing faster than your finance team", "Investors or lenders want better reporting and controls", "Cash visibility is poor", "You are preparing for an audit, raise or sale"],
  ["Budgeting, forecasting and cash management", "Monthly management reporting and board packs", "Financial controls and process improvement", "Banking, lender and investor relations support", "Audit preparation and finance team coaching"],
  [["Diagnose", "Finance processes, controls and reporting."], ["Stabilise", "Cash, closing and reporting basics."], ["Strengthen", "Controls, planning and insight."], ["Scale", "A finance function ready for the next stage."]],
  ["Monthly management accounts and board pack", "Budget and cash forecast", "Controls and process improvements", "Audit-ready files"],
  ["Clarity on cash and performance", "Investor and lender confidence", "A finance function that scales"])

svc(C, "HR and payroll compliance",
  "Labour and payroll obligations met correctly, across every state you operate in.",
  ["Employment law in India spans central labour codes, state rules, social security and tax withholding, and errors affect people directly. We review and run HR and payroll compliance, from registrations and returns to statutory contributions, workplace policies and the POSH Act, so employers stay compliant and employees are treated fairly.",
   "Personal data is handled under the DPDP Act throughout."],
  ["You employ people across several states", "Payroll is outsourced and you are not sure it is right", "You need POSH Act compliance and an Internal Committee in place", "Inspections or notices have raised issues"],
  ["Labour law applicability and registrations", "Payroll compliance reviews and statutory returns", "PF, ESI, professional tax and TDS on salaries", "Workplace policies including POSH", "Inspection readiness and remediation"],
  [["Review", "Obligations across states and workforce types."], ["Correct", "Gaps in registrations, returns and payroll."], ["Run", "Ongoing compliance with evidence."], ["Report", "Status and risks to management."]],
  ["HR compliance review", "Compliance calendar for labour obligations", "Policy set including POSH", "Inspection-ready evidence"],
  ["Lower legal exposure", "Fair treatment of employees", "Smoother inspections"])

svc(C, "Always-on brand and marketplace monitoring",
  "Continuous watch over the marketplaces and channels where your brand is sold and copied.",
  ["Counterfeits and unauthorised sellers reappear as fast as they are removed. Our managed monitoring service watches e-commerce marketplaces, social media and other channels for infringing and suspicious listings, prioritises them by risk and handles takedowns, with regular reporting on trends.",
   "Monitoring connects to SeeCounter, so each action becomes part of a growing intelligence record."],
  ["Takedowns are ad hoc and listings keep returning", "You sell through many online channels", "Unauthorised sellers undercut your pricing", "You want brand-protection metrics for management"],
  ["Continuous marketplace and social-media monitoring", "Risk-based prioritisation of listings and sellers", "Takedown requests and follow-up", "Repeat-infringer tracking", "Monthly reporting and trend analysis"],
  [["Configure", "Brands, products, channels and rules."], ["Monitor", "Continuous detection and triage."], ["Act", "Takedowns and escalations."], ["Report", "Trends and impact every month."]],
  ["Monitoring set-up", "Takedown log", "Repeat-infringer register", "Monthly brand-protection report"],
  ["Fewer fakes in front of customers", "Pressure that does not let up", "Measurable brand protection"])

svc(C, "Third-party due diligence as a service",
  "Risk-based checks on suppliers, distributors and partners, delivered at the pace of your business.",
  ["Procurement and sales teams cannot wait weeks for every check. We run third-party due diligence as an ongoing service: screening, integrity checks and deeper reviews scaled to each party's risk tier, with clear turnaround times and findings your teams can act on.",
   "Results can flow into NexaPair so that each third party's profile, risks and approvals are held in one place."],
  ["You onboard many suppliers, distributors or agents", "Anti-bribery, sanctions or ESG rules require checks", "Due diligence is inconsistent across teams", "You need an audit trail of decisions"],
  ["Risk-tiered screening and integrity checks", "Ownership and beneficial ownership verification", "Sanctions, litigation and adverse media reviews", "Enhanced due diligence for high-risk parties", "Periodic re-screening and monitoring"],
  [["Tier", "Classify each third party by risk."], ["Check", "Proportionate due diligence."], ["Decide", "Clear findings and recommendations."], ["Monitor", "Re-screening and change alerts."]],
  ["Due diligence reports by tier", "Risk ratings and recommendations", "Audit trail of checks and decisions", "Portfolio risk reporting"],
  ["Consistent, defensible decisions", "Faster onboarding", "Lower third-party risk"])

# ---------------------------------------------------------------- International Desk
C = "international-desk"
svc(C, "India entry for overseas companies",
  "Entering India with the right structure, partners and plan from day one.",
  ["India rewards companies that enter with patience and preparation. We help overseas businesses size the opportunity, choose an entry model, from a liaison office or subsidiary to a joint venture or acquisition, navigate FDI rules and approvals, and find and vet local partners.",
   "Once you are here, we can stay on as your local advisers for compliance, finance and risk."],
  ["You are assessing India as a market or manufacturing base", "You need to choose between entry structures", "You are looking for a distributor, partner or acquisition target", "You want local support after set-up"],
  ["Market assessment and entry strategy", "Entry structure options and FDI considerations", "Partner and target search with integrity due diligence", "Set-up coordination with legal and tax advisers", "Post-entry compliance, finance and risk support"],
  [["Assess", "The opportunity and the best route in."], ["Structure", "Entity, approvals and tax with your advisers."], ["Partner", "Find and vet the right local partners."], ["Establish", "Set up and stay compliant."]],
  ["India market entry report", "Entry structure recommendation", "Partner due diligence reports", "Set-up and compliance plan"],
  ["A confident, well-structured entry", "Trusted local partners", "Compliance from the start"])

svc(C, "Outbound expansion for Indian businesses",
  "Taking Indian businesses to new markets, with the strategy, structure and partners to succeed.",
  ["Indian companies are expanding abroad faster than ever, through exports, overseas subsidiaries and acquisitions. We help them choose markets, plan entry, structure overseas investments under ODI rules, and assess partners and targets abroad.",
   "Our International Desk coordinates with advisers in the destination market so that strategy, structure and compliance fit together."],
  ["You are choosing your next international market", "You plan an overseas subsidiary or acquisition", "Overseas investment rules and reporting need careful handling", "You need to vet a foreign partner or target"],
  ["Market prioritisation and entry strategy", "Overseas structure and ODI considerations", "Partner and acquisition target search", "International integrity due diligence", "Coordination with destination-market advisers"],
  [["Prioritise", "Markets by opportunity and fit."], ["Plan", "Entry route and structure."], ["Partner", "Find and vet overseas partners or targets."], ["Execute", "Set-up and ongoing compliance."]],
  ["Market prioritisation report", "Entry and structuring plan", "Overseas partner due diligence", "Implementation roadmap"],
  ["Focused international growth", "Structures that comply", "Trusted partners abroad"])

svc(C, "Cross-border deals and structuring",
  "Transactions across borders, structured so value is preserved on both sides.",
  ["Cross-border deals add currency, tax, regulatory and cultural complexity to every step. We support inbound and outbound acquisitions, investments and joint ventures, coordinating diligence, structuring and negotiation across jurisdictions with your legal and tax advisers.",
   "We bring the same senior-led, evidence-first approach as our domestic deal work, with the reach of our International Desk."],
  ["You are buying or investing in a business abroad, or a foreign party is investing in you", "A joint venture spans more than one jurisdiction", "Regulatory approvals in more than one country are required", "Deal economics depend on structure and tax"],
  ["Cross-border deal strategy and counterparty search", "Multi-jurisdiction diligence coordination", "Structuring with legal and tax advisers", "Regulatory approvals planning", "Integration planning across borders"],
  [["Frame", "Rationale, value and structure options."], ["Diligence", "Coordinated reviews across jurisdictions."], ["Structure", "Terms and structure that preserve value."], ["Close", "Approvals and integration."]],
  ["Deal strategy and counterparty list", "Coordinated diligence findings", "Structuring options paper", "Approvals and closing plan"],
  ["Value preserved across borders", "Fewer regulatory delays", "One coordinating team"])

svc(C, "FDI, ODI and FEMA support",
  "Foreign investment in and out of India, done right under FEMA.",
  ["Foreign investment into India and Indian investment abroad are governed by FEMA and detailed rules on sectors, pricing, reporting and approvals. We help companies and investors understand what applies, plan transactions accordingly, and keep reporting and records in order.",
   "We work with your authorised dealer bank and legal advisers; where a legal opinion is required, your counsel provides it."],
  ["You are receiving foreign investment or issuing shares to non-residents", "You plan an overseas investment or acquisition", "FEMA reporting has been delayed or missed", "Your sector has caps, conditions or approval routes"],
  ["FDI and ODI applicability and route analysis", "Pricing and reporting requirements planning", "Coordination of filings with your bank and advisers", "FEMA compliance reviews and remediation", "Support for compounding preparation, with counsel"],
  [["Assess", "Rules, routes and conditions that apply."], ["Plan", "Transactions to fit the rules."], ["File", "Reporting coordinated and on time."], ["Review", "Ongoing compliance."]],
  ["FEMA applicability note", "Transaction compliance checklist", "Reporting tracker", "Compliance review report"],
  ["Investments that comply", "On-time reporting", "Fewer regulatory complications"])

svc(C, "International due diligence and background checks",
  "Knowing who you are dealing with, wherever in the world they are.",
  ["Partners, targets and executives abroad can be hard to assess from India. We carry out international due diligence and background checks using public records, corporate registries, litigation and regulatory sources, media and lawful enquiries, through our network across jurisdictions.",
   "Findings are sourced, graded for reliability and written so decision-makers can act."],
  ["You are entering a partnership or deal with a foreign party", "You are appointing a senior executive with an international history", "A counterparty's ownership or reputation is unclear", "Sanctions or anti-bribery rules require checks"],
  ["Corporate and beneficial ownership research", "Litigation, regulatory and sanctions checks", "Adverse media and reputation reviews", "Executive and promoter background checks", "Discreet lawful enquiries where permitted"],
  [["Scope", "The questions that matter for your decision."], ["Research", "Records, registries and sources across jurisdictions."], ["Verify", "Corroborate and grade findings."], ["Report", "Clear findings and implications."]],
  ["Due diligence report", "Ownership and network map", "Sanctions and litigation summary", "Risk rating and recommendations"],
  ["Confidence in counterparties", "Compliance with screening obligations", "Decisions grounded in evidence"])

def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "assets", "services.json")
    seen = set()
    for s in S:
        assert s["slug"] not in seen, s["slug"]; seen.add(s["slug"])
    json.dump(S, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(S), "services")
main()
