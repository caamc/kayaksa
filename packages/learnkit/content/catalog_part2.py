# Kayak Learn catalogue, part 2: Risk and Governance courses.
from catalog_part1 import C, COURSES

# ---------------------------------------------------------------- RISK
COURSES.append(C("erm-basics", "Enterprise Risk Management Essentials", "risk", "Foundation",
  "What enterprise risk management is, the COSO and ISO 31000 frameworks, and how to identify, assess and respond to risk.",
  ["Explain the purpose of ERM and the two leading frameworks", "Identify and assess risks using likelihood and impact", "Choose a risk response and set key risk indicators"],
  [
   ("What ERM is for", 6, """
Every organisation takes risks to create value: entering a market, launching a product, hiring, borrowing. **Enterprise risk management (ERM)** is the discipline of understanding those risks across the whole organisation, so that leaders take the right risks deliberately and avoid the wrong ones.

ERM is not about eliminating risk. It is about **risk-informed decisions** and **no surprises** for the board.

### The two leading frameworks

- **COSO ERM: Integrating with Strategy and Performance (2017)** links risk to strategy and performance through five components: governance and culture; strategy and objective-setting; performance; review and revision; information, communication and reporting.
- **ISO 31000:2018 Risk management – Guidelines** sets out principles, a framework and a process: establish scope and context, identify, analyse and evaluate risk, treat it, and monitor, review, record and report, with communication and consultation throughout.

In India, the **Companies Act, 2013** requires the board's report to include a statement on the development and implementation of a risk management policy (section 134(3)(n)), and **SEBI LODR regulation 21** requires the top 1,000 listed entities by market capitalisation to have a **Risk Management Committee**.
"""),
   ("Identify and assess", 7, """
### Identify

Good risk identification is structured, not a brainstorm alone. Use several lenses:

- **Objectives:** for each strategic objective, what could stop us achieving it?
- **Categories:** strategic, operational, financial, compliance, technology and cyber, people, reputation, ESG.
- **Sources:** incidents, near misses, audit findings, regulatory changes, industry events.

Write each risk as **cause → event → consequence**: "Because we rely on one supplier (cause), a disruption at its plant (event) could halt production for weeks (consequence)." This makes the risk testable and the controls obvious.

### Assess

Rate each risk on **likelihood** and **impact**, usually on a 1–5 scale with clear descriptions, and plot it on a heat map.

- **Inherent risk:** before considering controls.
- **Residual risk:** after the controls that actually operate.

Compare residual risk with the **risk appetite** the board has set: the amount and type of risk the organisation is willing to accept in pursuit of its objectives.
"""),
   ("Respond and monitor", 7, """
### Four responses

1. **Avoid:** stop the activity that creates the risk.
2. **Reduce:** add or strengthen controls to lower likelihood or impact.
3. **Share or transfer:** insurance, contracts, joint ventures, outsourcing (the accountability usually stays with you).
4. **Accept:** consciously retain the risk because it is within appetite or too costly to treat.

Every significant risk needs a named **risk owner**, a senior person accountable for managing it.

### Key risk indicators

A **key risk indicator (KRI)** is a metric that signals rising risk before it materialises, for example staff attrition in a critical team, days of inventory cover, overdue vendor reviews or system patch backlog. Set thresholds (green, amber, red) and escalate when they are breached.

### Keep it alive

Review the risk register at least quarterly, report the top risks to the board with trends, and re-assess after major events. A risk register that is updated once a year for the annual report is a compliance artefact, not risk management.
"""),
  ],
  [
   ("The main purpose of ERM is to:", ["Eliminate all risk", "Enable risk-informed decisions across the organisation", "Satisfy auditors", "Buy insurance"], 1, "ERM helps leaders take the right risks deliberately, not remove risk altogether."),
   ("Which standard provides risk management guidelines with principles, a framework and a process?", ["ISO 9001", "ISO 31000", "ISO 14001", "ISO 22301"], 1, "ISO 31000:2018 is the international risk management guideline."),
   ("Residual risk is risk:", ["Before any controls", "After the controls that actually operate", "That has been transferred", "That has been avoided"], 1, "Residual risk takes account of the controls in place and working."),
   ("Buying insurance is an example of which response?", ["Avoid", "Reduce", "Share or transfer", "Accept"], 2, "Insurance shares the financial impact with another party."),
   ("Under SEBI LODR, a Risk Management Committee is required for:", ["All companies", "The top 1,000 listed entities by market capitalisation", "Only banks", "Only unlisted companies"], 1, "Regulation 21 applies to the top 1,000 listed entities by market capitalisation."),
  ]))

COURSES.append(C("third-party-risk", "Third-Party Risk and Due Diligence", "risk", "Intermediate",
  "Managing the risks that come with suppliers, agents, distributors and partners, from onboarding to exit.",
  ["Explain why third parties are a leading source of risk", "Apply risk-based due diligence and contract protections", "Monitor third parties and act on red flags"],
  [
   ("Why third parties matter", 6, """
Organisations increasingly rely on others to do their work: suppliers, outsourcers, IT and cloud providers, agents, distributors, consultants and joint-venture partners. Each relationship extends what you can do, and each brings risk you are still accountable for.

- **Bribery and corruption:** most major enforcement cases involve an intermediary.
- **Data and cyber:** a vendor with access to your systems or data can become your breach. Under the DPDP Act the data fiduciary remains responsible for its processors.
- **Operational resilience:** a single critical supplier failing can stop you.
- **Sanctions and trade:** dealing with a sanctioned party, even indirectly, is a serious breach.
- **Labour, human rights and ESG:** forced labour or unsafe conditions in the supply chain damage your reputation and may breach law in export markets.
- **Reputation:** customers rarely distinguish between you and the company acting in your name.
"""),
   ("Risk-based due diligence", 8, """
Due diligence should be **proportionate**: a stationery supplier does not need the scrutiny of a customs agent dealing with officials.

### Tier first

Classify each third party by inherent risk using simple factors: the country, the service, interaction with government, access to data or systems, the value of the contract and how critical the service is.

### Then check

- **Identity and ownership:** registration, directors and **ultimate beneficial owners** (in India, MCA records, and significant beneficial ownership filings).
- **Sanctions, watchlists and politically exposed persons.**
- **Adverse media and litigation:** court records, regulatory actions, credible news.
- **Financial health:** filings, credit reports, payment behaviour.
- **Capability and references:** can it actually deliver what it promises?
- **Compliance programme:** for higher tiers, its own anti-bribery, data protection and information security controls.

### Protect in the contract

Anti-bribery and compliance warranties, data protection and security clauses, **audit rights**, subcontracting controls, and the right to terminate for breach.
"""),
   ("Monitor and exit", 6, """
Due diligence at onboarding is a snapshot; risk changes. Good programmes:

- **Re-screen** periodically, more often for high-risk tiers, and continuously for sanctions.
- **Review performance and invoices:** unusual payments, new bank accounts, vague line items.
- **Refresh** due diligence on triggers: change of ownership, adverse news, expansion of scope.
- **Record** decisions and the reasons for accepting any residual risk.

### Red flags during the relationship

- Requests to change bank details by email (a common fraud tactic, always verify by phone using known numbers)
- Requests for upfront or cash payments
- Refusal to provide information or to allow audits
- Sudden spikes in volume, discounts or rebates

### Exit well

Plan exit at the start: return or deletion of data, transfer of services, final payments and access removal.
"""),
  ],
  [
   ("Under the DPDP Act, when a vendor processes personal data on your behalf:", ["The vendor alone is responsible", "You remain responsible as data fiduciary", "No one is responsible", "Only the Board is responsible"], 1, "The data fiduciary remains accountable for processing by its processors."),
   ("Third-party due diligence should be:", ["The same for every supplier", "Proportionate to the risk the third party presents", "Done only after a problem", "Left to procurement alone"], 1, "Risk-based tiering focuses effort where the risk is."),
   ("Which contract term lets you verify a third party's compliance?", ["Price escalation", "Audit rights", "Exclusivity", "Force majeure"], 1, "Audit rights let you inspect records and controls."),
   ("A supplier emails asking to change its bank account. You should:", ["Update it at once", "Verify by phone using a known number before changing", "Reply to the email to confirm", "Ignore it"], 1, "Bank-detail change requests are a common fraud tactic and must be verified independently."),
   ("Ultimate beneficial owners are:", ["The directors listed on the website", "The natural persons who ultimately own or control the entity", "The company's bankers", "The auditors"], 1, "UBOs are the individuals who ultimately own or control a company."),
  ]))

COURSES.append(C("fraud-risk", "Understanding and Preventing Fraud", "risk", "Intermediate",
  "How occupational fraud happens, the fraud triangle, common schemes and how organisations prevent and detect them.",
  ["Explain the fraud triangle and why it matters for prevention", "Recognise common fraud schemes and behavioural red flags", "Describe preventive and detective anti-fraud controls"],
  [
   ("Why fraud happens", 6, """
**Occupational fraud** is fraud committed by people against the organisation they work for. Global studies by fraud examiners estimate that organisations lose around **five per cent of revenue** to it each year, and that a typical scheme runs for over a year before it is caught.

### The fraud triangle

Criminologist Donald Cressey observed three conditions that are usually present:

1. **Pressure:** a financial or personal need, or pressure to hit targets.
2. **Opportunity:** weak controls, too much trust in one person, or lack of oversight.
3. **Rationalisation:** a story that makes it feel acceptable ("I'm only borrowing it", "they underpay me").

An organisation cannot control people's pressures, and can only influence rationalisation through culture. It **can** control **opportunity**. That is where most prevention effort should go.
"""),
   ("Common schemes and red flags", 8, """
Fraud examiners group occupational fraud into three families:

- **Asset misappropriation:** the most common. Examples: fake vendors, inflated or duplicate invoices, payroll ghosts, expense padding, inventory theft, skimming cash.
- **Corruption:** bribery, kickbacks, undisclosed conflicts of interest and bid rigging.
- **Financial statement fraud:** the least common but most costly. Examples: fictitious revenue, hidden liabilities, improper timing of revenue, manipulated provisions.

### Behavioural red flags

The most commonly observed warning signs are:

- living beyond one's means
- financial difficulties
- an unusually close relationship with a vendor or customer
- control issues and unwillingness to share duties
- reluctance to take leave
- irritability, suspicion or defensiveness

One red flag proves nothing; patterns are what matter.

### In India

Section 447 of the **Companies Act, 2013** makes fraud an offence with imprisonment of six months to ten years, and auditors must report suspected fraud above prescribed thresholds to the Central Government under section 143(12).
"""),
   ("Prevent and detect", 7, """
### Preventive controls

- **Segregation of duties:** no single person should create a vendor, approve its invoice and release payment.
- **Authorisation limits** and dual approval for payments.
- **Vendor master controls:** independent verification of new vendors and bank details.
- **Mandatory leave and job rotation** in sensitive roles.
- **Tone from the top** and a clear code of conduct.

### Detective controls

- **Tips and speak-up channels:** the most common way fraud is detected.
- **Data analytics:** duplicate payments, vendor-employee address matches, round-sum invoices, payments just below approval limits, weekend postings.
- **Surprise audits and reconciliations.**
- **Management review** of unusual trends.

### If you suspect fraud

Do not investigate on your own or confront the person. Preserve what you have, note what you saw and when, and report it through the speak-up channel or to compliance. Evidence handled badly can ruin an investigation.
"""),
  ],
  [
   ("Which element of the fraud triangle can an organisation most directly control?", ["Pressure", "Opportunity", "Rationalisation", "None of them"], 1, "Controls remove or reduce the opportunity to commit fraud."),
   ("Which is the most common category of occupational fraud?", ["Financial statement fraud", "Asset misappropriation", "Cyber extortion", "Insider trading"], 1, "Asset misappropriation is by far the most frequent, though usually less costly per case."),
   ("Segregation of duties means:", ["Everyone does every task", "No single person controls all stages of a transaction", "Managers do all approvals", "Duties are outsourced"], 1, "Splitting duties stops one person from both committing and concealing fraud."),
   ("A data test for payments just below approval limits helps detect:", ["Splitting to avoid approval", "Late payments", "Exchange losses", "Tax errors"], 0, "Clusters just below a limit can indicate transactions split to avoid higher approval."),
   ("If you suspect a colleague of fraud, you should first:", ["Confront them", "Investigate their emails yourself", "Preserve what you have and report it through the proper channel", "Tell the team"], 2, "Untrained investigation or confrontation can destroy evidence and harm innocent people."),
  ]))

# ---------------------------------------------------------------- GOVERNANCE
COURSES.append(C("board-essentials", "Directors' Duties and Board Effectiveness", "governance", "Intermediate",
  "The legal duties of directors under the Companies Act, 2013, the role of independent directors and what makes a board effective.",
  ["Explain the duties of directors under section 166", "Describe the role and safeguards for independent directors", "Recognise the practices of an effective board"],
  [
   ("The duties of a director", 7, """
**Section 166 of the Companies Act, 2013** codifies directors' duties. A director must:

1. Act in accordance with the company's **articles**.
2. Act in **good faith** to promote the objects of the company for the benefit of its members as a whole, and in the best interests of the company, its employees, shareholders, the community and the protection of the environment.
3. Exercise duties with **due and reasonable care, skill and diligence** and independent judgement.
4. Not be involved in a situation with a **direct or indirect conflict** with the company's interests.
5. Not achieve or attempt any **undue gain or advantage**, for themselves or relatives, partners or associates. Any such gain must be paid back to the company.
6. Not **assign** their office.

Breach can lead to a fine of ₹1 lakh to ₹5 lakh, alongside civil liability.

> The duty in point 2 is notably broad: it expressly names employees, the community and the environment, not shareholders alone.
"""),
   ("Independent directors", 6, """
**Section 149** requires every listed public company to have at least **one-third** of its board as independent directors, and certain other public companies to have at least two. SEBI LODR regulation 17 sets higher requirements for some listed entities, for example **half** the board where the chair is an executive or a promoter-related person.

Independent directors must meet tests of independence, register in the **independent directors' databank** and follow the **Code for Independent Directors in Schedule IV**, which includes:

- bringing objective judgement on strategy, performance, risk and key appointments
- safeguarding the interests of all stakeholders, particularly minority shareholders
- satisfying themselves on the integrity of financial information and the robustness of controls and risk management
- reporting concerns about unethical behaviour, actual or suspected fraud or breaches of the code of conduct
- meeting at least once a year **without** non-independent directors and management

Under section 149(12), an independent or non-executive director is liable only for acts of omission or commission that occurred **with their knowledge, attributable through board processes, and with their consent or connivance, or where they did not act diligently**.
"""),
   ("What makes a board effective", 7, """
Compliance with the law is the floor. Effective boards add value through how they work.

- **The right mix:** skills, experience and diversity matched to the company's strategy and risks. Section 149(1) requires at least one woman director on the boards of listed and certain other companies.
- **Good information:** papers that are concise, timely and decision-focused, with management's view, the options and the risks.
- **Constructive challenge:** directors ask probing questions and expect clear answers; dissent is minuted.
- **Time on what matters:** strategy, risk, culture, succession and capital allocation, not only compliance items.
- **Strong committees:** audit, nomination and remuneration, stakeholders' relationship, CSR and risk, each with clear terms of reference.
- **Annual evaluation** of the board, its committees and individual directors, as required for listed companies, with actions that follow.
- **Culture from the top:** the board sets and monitors the organisation's ethics and holds leaders to account for them.
"""),
  ],
  [
   ("Which section of the Companies Act, 2013 codifies directors' duties?", ["Section 134", "Section 149", "Section 166", "Section 188"], 2, "Section 166 sets out the duties of directors."),
   ("Under section 166, a director must act in the best interests of:", ["Shareholders only", "The company, its employees, shareholders, the community and the environment", "The promoter", "The chair"], 1, "Section 166(2) is deliberately broad in the stakeholders it names."),
   ("A listed public company must have at least what proportion of independent directors under section 149?", ["One-quarter", "One-third", "Half", "Two-thirds"], 1, "Section 149(4) requires at least one-third independent directors for listed public companies."),
   ("Independent directors must meet without non-independent directors and management at least:", ["Monthly", "Quarterly", "Once a year", "Never"], 2, "Schedule IV requires at least one such separate meeting each year."),
   ("An undue gain made by a director in breach of section 166:", ["Can be kept if disclosed", "Must be paid to the company", "Is taxed only", "Goes to the government"], 1, "Section 166(5) requires the director to pay an amount equal to the gain to the company."),
  ]))

COURSES.append(C("audit-committee", "The Audit Committee and Internal Financial Controls", "governance", "Intermediate",
  "The audit committee's role under the Companies Act and SEBI rules, internal financial controls and the directors' responsibility statement.",
  ["Explain the composition and role of the audit committee", "Describe internal financial controls and who reports on them", "Know the key questions an audit committee should ask"],
  [
   ("Composition and role", 7, """
**Section 177 of the Companies Act, 2013** requires listed companies and certain other public companies to constitute an **audit committee** of at least **three directors**, with **independent directors forming a majority**. Members, including the chair, must be able to read and understand financial statements. SEBI LODR regulation 18 adds that two-thirds must be independent and that the chair must be independent.

### What the committee does

- Recommends the appointment, remuneration and terms of the **auditors**, and reviews their independence and performance.
- Examines the **financial statements** and the auditor's report.
- Approves, and later modifies, **related-party transactions** (only independent directors vote on these).
- Scrutinises inter-corporate loans and investments.
- Evaluates **internal financial controls** and **risk management systems**.
- Oversees the **vigil mechanism**.
- Monitors end-use of funds raised through public offers.

The committee can call for the comments of auditors on internal control and has authority to investigate any matter within its remit, with access to outside professional advice.
"""),
   ("Internal financial controls", 7, """
**Internal financial controls (IFC)** are the policies and procedures that ensure the orderly and efficient conduct of the business, including adherence to policies, safeguarding of assets, prevention and detection of frauds and errors, accuracy and completeness of the accounting records, and timely preparation of reliable financial information.

### Who is responsible for what

- **The board:** under **section 134(5)(e)**, the directors' responsibility statement of a listed company must state that the directors have laid down internal financial controls, that they are adequate and that they were operating effectively.
- **The auditor:** under **section 143(3)(i)**, the auditor must report on whether the company has adequate internal financial controls with reference to financial statements and on their operating effectiveness, subject to exemptions for certain small private companies.
- **Independent directors:** must satisfy themselves that financial controls and risk management systems are robust and defensible.

### What good looks like

Documented processes and risk-control matrices for key cycles (revenue, procurement, payroll, inventory, treasury, financial close), **IT general controls** over access and changes, management testing, and timely remediation of deficiencies.
"""),
   ("Questions a good audit committee asks", 6, """
- Where are the **areas of significant judgement** in these accounts, and how sensitive are the numbers to them?
- What did the auditors **disagree** with management about, and how was it resolved?
- What are the **control deficiencies** identified this year, who owns them and when will they be fixed?
- Are there **unusual or year-end transactions**, or changes in accounting policies?
- What **related-party transactions** are proposed, and are they on arm's length terms and in the ordinary course of business?
- What has come through the **vigil mechanism**, how were cases handled, and were there any themes?
- Is internal audit **independent**, adequately resourced and covering the highest risks?
- Do we meet the auditors **without management** present at least once a year?

> The committee's value lies in informed scepticism: asking the question nobody else in the room wants to ask.
"""),
  ],
  [
   ("Under section 177, an audit committee must have at least:", ["Two directors", "Three directors with a majority of independent directors", "Five directors", "Only independent directors"], 1, "Section 177(2) requires a minimum of three directors with independent directors in the majority."),
   ("Which section requires the directors' responsibility statement to address internal financial controls for listed companies?", ["Section 134(5)(e)", "Section 166", "Section 188", "Section 447"], 0, "Section 134(5)(e) covers IFC in the directors' responsibility statement."),
   ("Who reports on internal financial controls with reference to financial statements under section 143(3)(i)?", ["The company secretary", "The statutory auditor", "SEBI", "The internal auditor only"], 1, "The statutory auditor reports on IFC over financial reporting under section 143(3)(i)."),
   ("Who may vote on related-party transactions in the audit committee?", ["All members", "Only independent directors", "Only the chair", "The CFO"], 1, "Only independent directors on the audit committee approve related-party transactions."),
   ("Which is a strong practice for an audit committee?", ["Meeting auditors only with management present", "Meeting auditors without management at least once a year", "Never challenging management", "Delegating all reviews to the CFO"], 1, "Private sessions allow auditors to raise concerns freely."),
  ]))

COURSES.append(C("related-parties", "Related-Party Transactions", "governance", "Advanced",
  "Identifying related parties, and the approval and disclosure rules under the Companies Act and SEBI LODR.",
  ["Identify related parties and related-party transactions", "Apply the approval route under section 188 and LODR regulation 23", "Recognise the risks and red flags in related-party dealings"],
  [
   ("Who is a related party", 6, """
Related-party transactions (RPTs) are not wrong in themselves; group companies trade with each other all the time. The risk is that they move value away from the company and its minority shareholders on terms that would not be agreed between independent parties.

Under **section 2(76) of the Companies Act, 2013**, related parties include, among others:

- a director or key managerial personnel (KMP), or their **relative**
- a firm in which a director, manager or their relative is a partner
- a private company in which a director or manager or their relative is a member or director
- a body corporate whose board or manager acts on the advice of a director or manager of the company
- holding, subsidiary and associate companies, and fellow subsidiaries

**SEBI LODR regulation 2(1)(zb)** widens this for listed companies to include, for example, any person or entity in the promoter group, and anyone holding **10 per cent or more** of the listed entity's equity (since April 2023).
"""),
   ("Approval and disclosure", 8, """
### Companies Act, section 188

Specified contracts with related parties, such as sale or purchase of goods, property and services, leasing, appointment of agents and appointment to an office or place of profit, need **board approval** with interested directors abstaining. Where they exceed thresholds in the Companies (Meetings of Board and its Powers) Rules, 2014, they also need a **shareholders' resolution**, on which related parties cannot vote.

The key exemption: transactions in the **ordinary course of business** and on an **arm's length basis** do not need section 188 approval, but they still need **audit committee** approval under section 177 for companies that must have one.

### SEBI LODR regulation 23 (listed companies)

- **All** RPTs and subsequent material modifications need **prior audit committee approval**, with only independent directors voting. Omnibus approval for repetitive transactions is allowed within limits.
- **Material RPTs**, those exceeding **₹1,000 crore or 10 per cent of annual consolidated turnover**, whichever is lower, need prior **shareholders' approval**, and related parties cannot vote in favour.
- RPTs must be **disclosed** to the stock exchanges half-yearly in the prescribed format.

Thresholds and formats are periodically revised by SEBI; always check the current text.
"""),
   ("Risks and red flags", 6, """
- Prices or terms that differ from those offered to unrelated parties
- Transactions with **newly formed** or thinly capitalised entities linked to promoters
- Large **advances, loans or guarantees** to related entities without clear business purpose
- Round-tripping: money that leaves through one related party and returns through another
- **Splitting** transactions to stay below approval thresholds
- Related parties that are **not disclosed** but surface through common addresses, directors or bank accounts

Investigators and auditors often uncover undisclosed related parties through **director network analysis**: mapping common directors, shareholders, addresses and contact details across companies in public registries.

> A good test: would the board be comfortable explaining this transaction, its terms and its counterparty to minority shareholders and the regulator?
"""),
  ],
  [
   ("Related-party transactions are:", ["Always prohibited", "Permitted with proper approval and disclosure", "Allowed only for private companies", "Exempt from audit committee review"], 1, "RPTs are common; the law controls them through approval and disclosure."),
   ("Under section 188, which transactions are exempt from board and shareholder approval?", ["All transactions below ₹1 crore", "Those in the ordinary course of business and at arm's length", "All transactions with subsidiaries", "None"], 1, "Ordinary-course, arm's length transactions are exempt from section 188, though audit committee approval still applies."),
   ("Under LODR regulation 23, a material RPT exceeds:", ["₹100 crore", "₹1,000 crore or 10% of annual consolidated turnover, whichever is lower", "5% of net worth", "₹10 crore"], 1, "This is the current materiality threshold for listed entities."),
   ("Who may vote on a shareholders' resolution approving a material RPT?", ["All shareholders", "Shareholders other than related parties voting in favour", "Only promoters", "Only independent directors"], 1, "Related parties cannot vote to approve the transaction."),
   ("Which technique helps uncover undisclosed related parties?", ["Director network analysis", "Increasing sales targets", "Reducing audit scope", "Ignoring addresses"], 0, "Mapping common directors, shareholders and addresses reveals hidden links."),
  ]))
