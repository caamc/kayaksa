# Kayak Learn catalogue, part 1: topics, paths, and the Ethics and Compliance courses.
# Run `python3 packages/learnkit/content/build.py` to regenerate catalog.json.
# Facts are stated as at November 2026; regulatory references should be reviewed each year.

TOPICS = [
    {"id": "ethics", "name": "Ethics & Integrity", "color": "#0B5654", "blurb": "Doing the right thing when no rule tells you what to do."},
    {"id": "compliance", "name": "Compliance", "color": "#2D6A9F", "blurb": "The Indian and global rules that shape everyday business."},
    {"id": "risk", "name": "Risk", "color": "#9C630E", "blurb": "Seeing what could go wrong early enough to act."},
    {"id": "governance", "name": "Governance", "color": "#5E4B78", "blurb": "How boards and leaders steer and oversee a company."},
    {"id": "ai", "name": "Responsible AI", "color": "#17807E", "blurb": "Using AI well: its power, its limits and its rules."},
    {"id": "kayak", "name": "Kayak induction", "color": "#0E2F3C", "blurb": "How we work at Kayak Strategic Advisors."},
]

PATHS = [
    {"id": "ethics-integrity", "title": "Ethics and Integrity at Work", "topic": "ethics", "color": "#0B5654", "audience": "public",
     "summary": "Make sound ethical decisions, speak up with confidence and handle conflicts of interest, gifts and hospitality properly.",
     "courses": ["ethics-foundations", "speak-up", "conflicts-gifts"]},
    {"id": "compliance-india", "title": "Compliance Essentials for India", "topic": "compliance", "color": "#2D6A9F", "audience": "public",
     "summary": "Anti-bribery and corruption, personal data protection under the DPDP Act, and preventing sexual harassment at the workplace.",
     "courses": ["anti-bribery", "data-protection", "posh"]},
    {"id": "risk-fundamentals", "title": "Risk Management Fundamentals", "topic": "risk", "color": "#9C630E", "audience": "public",
     "summary": "Build and run a risk framework, manage third parties across their lifecycle and understand how fraud happens and is stopped.",
     "courses": ["erm-basics", "third-party-risk", "fraud-risk"]},
    {"id": "governance-boards", "title": "Corporate Governance for Boards and Leaders", "topic": "governance", "color": "#5E4B78", "audience": "public",
     "summary": "Directors' duties, the audit committee and internal financial controls, and related-party transactions under Indian law.",
     "courses": ["board-essentials", "audit-committee", "related-parties"]},
    {"id": "responsible-ai", "title": "Responsible AI", "topic": "ai", "color": "#17807E", "audience": "public",
     "summary": "How generative AI works and fails, the frameworks that govern AI risk, and how to use AI safely at work.",
     "courses": ["ai-foundations", "ai-governance", "ai-at-work"]},
    {"id": "kayak-induction", "title": "Kayak Induction", "topic": "kayak", "color": "#0E2F3C", "audience": "internal",
     "summary": "Who we are, how we protect client confidences, how we keep our independence and quality, and how we speak and look as Kayak.",
     "courses": ["kayak-who-we-are", "kayak-confidentiality", "kayak-independence-quality", "kayak-brand-voice"]},
]

def C(id, title, topic, level, summary, outcomes, lessons, questions, audience="public", passmark=70):
    lessons = [{"id": f"l{i+1}", "title": t, "minutes": m, "body": b.strip()} for i, (t, m, b) in enumerate(lessons)]
    return {"id": id, "title": title, "topic": topic, "level": level, "audience": audience, "summary": summary, "outcomes": outcomes,
            "minutes": sum(l["minutes"] for l in lessons) + 5, "lessons": lessons,
            "quiz": {"pass": passmark, "questions": [{"q": q, "options": o, "answer": a, "why": w} for q, o, a, w in questions]}}

COURSES = []

# ---------------------------------------------------------------- ETHICS
COURSES.append(C("ethics-foundations", "Ethical Decision-Making at Work", "ethics", "Foundation",
  "A practical way to recognise an ethical issue, think it through and act on it, even under pressure.",
  ["Recognise when a business decision has an ethical dimension", "Apply a five-step test to a grey-area decision", "Explain why pressure and rationalisation lead good people to bad choices"],
  [
   ("Why ethics is a business skill", 6, """
Most ethical failures at work are not committed by bad people. They are committed by ordinary people under pressure: a target to hit, a client to keep, a manager to please. The decisions rarely look like "steal or don't steal". They look like "round this number up", "don't mention that clause yet" or "let's not put that in writing".

Ethics at work is therefore less about knowing right from wrong in the abstract, and more about **noticing** that a decision has an ethical side, and having a habit for thinking it through.

### What is at stake

- **Trust.** Clients, regulators and colleagues give us latitude because they believe we will act properly when no one is watching.
- **Legal exposure.** Many ethical lapses are also offences: misstatement, bribery, data misuse, harassment.
- **Your own name.** Careers outlast employers. A reputation for integrity travels with you.

> A useful rule: if you would be uncomfortable explaining a decision to your family, your regulator or a journalist, stop and think again.
"""),
   ("A five-step test for grey areas", 7, """
When something feels uncomfortable, slow down and work through five questions.

1. **What exactly is the issue?** State it plainly in one sentence. Vague unease becomes clearer once it has a name.
2. **Who is affected?** List the people and organisations who gain or lose: client, colleagues, the public, the firm, you.
3. **What do the rules say?** Law, regulation, contract, company policy, professional standards. If a rule clearly answers the question, follow it.
4. **What are the options?** There are almost always more than two. Could you disclose, delay, escalate, or do part of what was asked?
5. **Could you defend it in the open?** Imagine the decision, and your reasons, printed on the front page tomorrow.

If you are still unsure after the five steps, **ask before you act**. Talk to your manager, a senior colleague, compliance or legal. Asking is a sign of judgement, not weakness.
"""),
   ("Pressure, rationalisation and how to resist them", 7, """
People who cross the line usually tell themselves a story first. Researchers call this **rationalisation**, and the stories are remarkably similar:

- "Everyone does it." — Common is not the same as acceptable.
- "It's only temporary; I'll fix it next quarter." — Temporary fixes have a way of becoming permanent.
- "No one is really harmed." — Ask who would be harmed if the facts came out.
- "I was told to." — Instructions do not transfer responsibility for an unlawful act.
- "It's for the good of the company." — Companies are rarely helped by misconduct once it surfaces.

### Building resistance

- **Decide in advance.** Know your red lines before the pressure arrives.
- **Use the pause.** "Let me come back to you this afternoon" buys time to think and to ask.
- **Put it in writing.** Requests that cannot survive being written down usually should not be done.
- **Find allies.** You are rarely the only person uncomfortable. Raising concerns together is easier and more effective.
"""),
  ],
  [
   ("A colleague says 'everyone in the industry rounds these numbers up'. This is an example of:", ["A sound business judgement", "Rationalisation", "A legal defence", "Materiality"], 1, "Saying 'everyone does it' is a classic rationalisation. How common a practice is does not make it acceptable."),
   ("What is the first step of the five-step test?", ["Ask your manager", "State the issue plainly", "Check the policy", "Pick the cheapest option"], 1, "Naming the issue in one sentence turns vague unease into something you can reason about."),
   ("If a rule clearly answers the question, you should:", ["Follow the rule", "Weigh the rule against the target", "Ask the client", "Do what peers do"], 0, "Where law, regulation or policy is clear, the decision is made for you."),
   ("Which is the best response to an uncomfortable request with a short deadline?", ["Do it and raise it later", "Refuse without explanation", "Ask for time and seek advice before acting", "Do half of it"], 2, "Buying a little time to think and ask is almost always possible and leads to better decisions."),
   ("Being told to do something by a senior person:", ["Transfers responsibility to them", "Does not make an unlawful act acceptable", "Is a full defence", "Means you need not record it"], 1, "Instructions do not make misconduct lawful, and you remain responsible for your own actions."),
  ]))

COURSES.append(C("speak-up", "Speaking Up and Whistleblowing", "ethics", "Foundation",
  "Why speaking up matters, the channels available in Indian companies, how reports are handled and how reporters are protected.",
  ["Explain the purpose of a speak-up programme and vigil mechanism", "Know what to report, how and to whom", "Describe how good organisations investigate and protect reporters"],
  [
   ("Why speaking up matters", 6, """
Most serious misconduct is known to someone inside the organisation long before it becomes a crisis. Fraud examiners consistently find that **tips are the most common way fraud is detected**, ahead of internal audit and management review. An organisation that makes it easy and safe to speak up finds problems early, while they are still small.

Speaking up is not disloyalty. It is how an organisation protects its people, its customers and its reputation.

### What to raise

- Suspected fraud, bribery or financial misstatement
- Breaches of law, regulation or company policy
- Harassment, discrimination or retaliation
- Risks to health, safety or the environment
- Misuse of confidential or personal data
- Conflicts of interest that have not been declared

You do not need proof. You need a **genuine, reasonable concern**. It is the organisation's job to investigate.
"""),
   ("Channels and the law in India", 7, """
In India, the **Companies Act, 2013** (section 177(9) and (10)) requires listed companies, and certain others such as those that accept public deposits or borrow above set limits, to establish a **vigil mechanism** for directors and employees to report genuine concerns. The mechanism must protect against victimisation and allow direct access to the chair of the audit committee in appropriate cases.

For listed entities, **SEBI's Listing Obligations and Disclosure Requirements Regulations, 2015** (regulation 22) require a vigil mechanism and its disclosure on the website and in the board's report.

Internationally, **ISO 37002:2021** sets out good practice for whistleblowing management systems: trust, impartiality and protection.

### Typical channels

- Your manager or another senior leader you trust
- Compliance, legal, HR or internal audit
- An ethics hotline or web portal, often run by an independent provider, that allows **anonymous** reports
- The chair of the audit committee, for serious matters or concerns about senior management
"""),
   ("What happens after a report", 7, """
A well-run programme handles every report in the same disciplined way.

1. **Acknowledge** receipt, and give an anonymous reporter a way to follow up.
2. **Triage** the report: what is alleged, how serious, who should investigate and whether anyone is conflicted.
3. **Investigate** independently, gathering documents and data first and interviewing in a planned order.
4. **Conclude** with findings based on evidence, not rumour, and decide on action.
5. **Close the loop** with the reporter as far as confidentiality allows, and fix the control weakness that allowed the problem.

### Protection from retaliation

Retaliation, such as demotion, exclusion, threats or dismissal because someone raised a concern in good faith, is itself serious misconduct. Good organisations treat it as a disciplinary matter and monitor reporters' treatment for months after a case closes.

A report made in good faith that turns out to be mistaken is never misconduct. Deliberately false reports are.
"""),
  ],
  [
   ("Which is most often the way fraud is first detected?", ["External audit", "Tips from people", "Management review", "Data analytics"], 1, "Studies by fraud examiners consistently find tips are the most common detection method."),
   ("To raise a concern, you need:", ["Documentary proof", "A genuine, reasonable concern", "Two witnesses", "Your manager's permission"], 1, "You do not need proof; investigating is the organisation's job."),
   ("Under the Companies Act, 2013 a vigil mechanism must allow, in appropriate cases, direct access to:", ["The statutory auditor", "The chair of the audit committee", "The Registrar of Companies", "The police"], 1, "Section 177(10) provides for direct access to the audit committee chair in appropriate or exceptional cases."),
   ("Which international standard covers whistleblowing management systems?", ["ISO 27001", "ISO 9001", "ISO 37002", "ISO 31000"], 2, "ISO 37002:2021 gives guidance on whistleblowing management systems."),
   ("A good-faith report that turns out to be mistaken is:", ["Misconduct", "Not misconduct", "Grounds for dismissal", "A criminal offence"], 1, "Only deliberately false reports are misconduct. Protecting good-faith reporters keeps the channel open."),
  ]))

COURSES.append(C("conflicts-gifts", "Conflicts of Interest, Gifts and Hospitality", "ethics", "Foundation",
  "Spot, declare and manage conflicts of interest, and judge when gifts and hospitality are acceptable.",
  ["Identify actual, potential and perceived conflicts of interest", "Declare and manage a conflict correctly", "Apply the test for acceptable gifts and hospitality"],
  [
   ("What a conflict of interest is", 6, """
A **conflict of interest** arises when a personal interest could influence, or appear to influence, the decisions you make for your employer or client.

- **Actual:** you are deciding on a contract with a company your spouse owns.
- **Potential:** you hold shares in a supplier that may bid next year.
- **Perceived:** you are close friends with a candidate you are interviewing.

Having a conflict is normal; everyone has relationships and interests. The problem is a conflict that is **hidden** or **unmanaged**.

### Common sources

- Family members or close friends at suppliers, customers or competitors
- Shareholdings, directorships or other paid work
- Outside business interests and side ventures
- Personal relationships within a reporting line

For directors of Indian companies, **section 184 of the Companies Act, 2013** requires disclosure of interest in other entities and of interest in contracts the company enters into, and the interested director must not take part in the discussion or vote.
"""),
   ("Declare, then manage", 6, """
The single most important step is to **declare early and in writing**, usually to your manager and through the organisation's register or declaration form. Declare when you first become aware of the conflict, and update the declaration when circumstances change.

Once declared, the organisation decides how to manage it. Typical measures are:

- **Recusal:** you take no part in the decision or the process.
- **Reassignment:** someone else handles the relationship.
- **Additional review:** a second person approves your work.
- **Divestment:** you give up the interest, in more serious cases.

> If in doubt, declare. A declared conflict that turns out to be minor costs nothing. An undeclared one can end a career.
"""),
   ("Gifts and hospitality: the test", 7, """
Gifts and hospitality build relationships, but they can also be used to buy influence. A modest lunch is courtesy; an expensive holiday during a tender is something else.

Ask four questions before giving or accepting:

1. **Purpose:** is it a genuine courtesy, or is it meant to influence a decision?
2. **Timing:** is a decision, tender, audit or negotiation pending? Gifts at such times are rarely appropriate.
3. **Value and frequency:** would a reasonable observer think it lavish or too frequent?
4. **Transparency:** would you be comfortable recording it in the gifts register and telling your manager?

### Hard lines

- **Never** give or accept cash or cash equivalents such as gift cards or vouchers.
- **Never** offer anything of value to a public official to influence an official act. Under the Prevention of Corruption Act, 1988 this can be a criminal offence, for the individual and the company.
- **Record** everything above your organisation's threshold, whether accepted or declined.
"""),
  ],
  [
   ("You hold shares in a company that may bid for a contract next year. This is:", ["Not a conflict", "A potential conflict", "Only a perceived conflict", "Insider trading"], 1, "A future bid creates a potential conflict that should be declared now."),
   ("The most important first step with a conflict is to:", ["Sell your interest", "Declare it early in writing", "Keep it confidential", "Ask the other party"], 1, "Early written declaration lets the organisation manage the conflict properly."),
   ("Which gift should never be accepted?", ["A branded notebook", "A modest working lunch", "A ₹10,000 shopping voucher", "A festive box of sweets of modest value"], 2, "Vouchers and gift cards are cash equivalents and should never be accepted."),
   ("A supplier invites you to an expensive resort weekend while its tender is being evaluated. You should:", ["Accept if your manager agrees", "Decline and record the offer", "Accept but pay for your own meals", "Accept after the tender closes"], 1, "Hospitality during a pending decision is inappropriate; declining and recording protects everyone."),
   ("Section 184 of the Companies Act, 2013 requires an interested director to:", ["Resign", "Disclose the interest and not participate in the decision", "Inform SEBI", "Seek shareholder approval"], 1, "Section 184 requires disclosure and that the interested director not take part in the discussion or vote."),
  ]))

# ---------------------------------------------------------------- COMPLIANCE
COURSES.append(C("anti-bribery", "Anti-Bribery and Anti-Corruption", "compliance", "Foundation",
  "How bribery laws in India and abroad apply to companies and individuals, the red flags and the 'adequate procedures' that protect an organisation.",
  ["Explain the main offences under India's Prevention of Corruption Act and key foreign laws", "Recognise bribery red flags, including through third parties", "Describe the controls that make up adequate procedures"],
  [
   ("The laws that matter", 8, """
**India: the Prevention of Corruption Act, 1988 (PCA)**, as amended in 2018:

- **Giving** an undue advantage to a public servant is an offence (section 8), not only receiving one.
- A **commercial organisation** commits an offence if any person associated with it, such as an employee, agent or distributor, gives or promises an undue advantage to a public servant to obtain or retain business (section 9).
- The organisation's main defence is to prove it had **adequate procedures** in place to prevent such conduct.
- Where an offence is committed with the consent or connivance of a director, manager or other officer, **that individual is also liable** (section 10).

**Abroad**, two laws reach Indian companies with international links:

- The **US Foreign Corrupt Practices Act (FCPA)** prohibits bribing foreign officials and requires accurate books and records for issuers.
- The **UK Bribery Act 2010** covers private-sector bribery as well as public officials, and its **section 7 "failure to prevent"** offence makes a company liable for bribery by associated persons unless it had adequate procedures.
"""),
   ("Red flags, especially through third parties", 7, """
Most large bribery cases involve an **intermediary**: an agent, consultant, distributor, customs broker or "facilitator". The company never hands over cash directly; someone else does it on its behalf.

Watch for:

- Commissions or fees that are unusually high for the service described
- Requests for payment in cash, to a third country or to a different entity
- A third party recommended by the official who will decide on your matter
- Vague invoices: "consultancy", "liaison", "miscellaneous expenses"
- Reluctance to sign anti-bribery clauses or to allow audit rights
- Close family or business links between the third party and officials

**Facilitation payments**, small payments to speed up routine government action, are bribes under Indian law and the UK Bribery Act. Treat them as prohibited.
"""),
   ("Adequate procedures in practice", 7, """
Regulators and courts look for a programme that is real, risk-based and working. The core elements are consistent across the PCA guidance, UK guidance and FCPA practice:

1. **Top-level commitment:** the board and leaders set the tone and act on it.
2. **Risk assessment:** where, with whom and through whom bribery could happen.
3. **Policies and procedures:** gifts and hospitality, donations, sponsorships, facilitation payments, books and records.
4. **Third-party due diligence:** checks proportionate to risk before engagement, contractual protections, monitoring.
5. **Training and communication** tailored to roles at risk.
6. **Speak-up channels** and prompt investigation of concerns.
7. **Monitoring and review:** testing, audit and improvement over time.

> A policy on paper, with no due diligence, training or monitoring behind it, will not be treated as adequate.
"""),
  ],
  [
   ("Under the PCA as amended in 2018, a commercial organisation's main defence to section 9 is:", ["The bribe was small", "It had adequate procedures to prevent bribery", "The employee acted alone", "The public servant asked for it"], 1, "Section 9 allows the organisation to prove it had adequate procedures in place."),
   ("Which law contains the 'failure to prevent bribery' offence in section 7?", ["FCPA", "UK Bribery Act 2010", "PMLA", "Companies Act, 2013"], 1, "Section 7 of the UK Bribery Act 2010 is the failure-to-prevent offence."),
   ("Small payments to speed up routine government actions are:", ["Allowed under Indian law", "Bribes and should be treated as prohibited", "Allowed if recorded", "Allowed below ₹5,000"], 1, "Facilitation payments are bribes under the PCA and the UK Bribery Act."),
   ("Which is a red flag with an agent?", ["A clear scope of work", "Payment requested to a bank account in a third country", "Agreement to audit rights", "A fee in line with the market"], 1, "Payments routed to unrelated places or entities are a classic warning sign."),
   ("Which is NOT one of the core elements of adequate procedures?", ["Risk assessment", "Third-party due diligence", "Guaranteed sales targets", "Training"], 2, "Sales targets are not an anti-bribery control; the others are core elements."),
  ]))

COURSES.append(C("data-protection", "Personal Data Protection under the DPDP Act", "compliance", "Foundation",
  "The Digital Personal Data Protection Act, 2023 and its Rules: what data fiduciaries must do, individuals' rights, breaches and penalties.",
  ["Explain the key roles and obligations under the DPDP Act, 2023", "Describe valid consent and notice, and individuals' rights", "Know what to do when personal data is breached"],
  [
   ("The Act in one page", 7, """
The **Digital Personal Data Protection Act, 2023 (DPDP Act)** governs the processing of **digital personal data** in India, and of data processed outside India in connection with offering goods or services to people in India. The **Digital Personal Data Protection Rules, 2025** were notified in November 2025, with most obligations phased in over the following eighteen months.

### Key roles

- **Data principal:** the individual the data is about.
- **Data fiduciary:** the organisation that decides why and how data is processed. It carries the obligations.
- **Data processor:** processes data on the fiduciary's behalf under a contract.
- **Significant data fiduciary:** a fiduciary notified by the government because of the volume or sensitivity of its data, with extra duties such as a Data Protection Officer in India, independent data audits and impact assessments.
- **Data Protection Board of India:** the regulator that inquires into breaches and imposes penalties.
"""),
   ("Consent, notice and legitimate uses", 7, """
Personal data may be processed for a lawful purpose either with **consent** or for certain **legitimate uses** set out in the Act (for example, where an individual voluntarily provides data for a specified purpose, for employment purposes, or to comply with law).

**Valid consent** must be free, specific, informed, unconditional and unambiguous, given by a clear affirmative action, and limited to the data necessary for the purpose. It must be **as easy to withdraw as to give**.

Each request for consent must be accompanied by a **notice** in clear and plain language, available in English and the languages of the Eighth Schedule, describing the data, the purpose, and how to exercise rights and complain to the Board.

### Children and people with disabilities

Processing a child's data (under 18) requires **verifiable consent of a parent or lawful guardian**, and tracking, behavioural monitoring and targeted advertising directed at children are prohibited, subject to limited exemptions in the Rules.

### Individuals' rights

Data principals can **access** information about their data, seek **correction and erasure**, use **grievance redressal**, and **nominate** someone to exercise their rights on death or incapacity.
"""),
   ("Security, breaches and penalties", 7, """
A data fiduciary must take **reasonable security safeguards** to prevent personal data breaches, such as encryption, access control, logging and monitoring, and must ensure its processors do the same.

### When a breach happens

The fiduciary must notify **the Data Protection Board and each affected data principal**. The Rules require prompt intimation to affected individuals, describing the breach, its likely consequences, the steps taken and what they can do, and a fuller report to the Board within **72 hours** of becoming aware, unless the Board allows longer.

### Retention

Data must be **erased** once the purpose is served or consent is withdrawn, unless law requires it to be kept. The Rules set retention periods for certain large platforms.

### Penalties

The Board can impose financial penalties up to **₹250 crore** for failing to take reasonable security safeguards, and up to **₹200 crore** for failing to notify a breach or meet obligations relating to children, with other breaches attracting penalties up to ₹50 crore.

> Practical rule: collect only what you need, keep it only as long as you need it, protect it while you have it, and tell people promptly if it is compromised.
"""),
  ],
  [
   ("Who carries the main obligations under the DPDP Act?", ["The data principal", "The data fiduciary", "The Data Protection Board", "The data processor alone"], 1, "The data fiduciary decides the purpose and means of processing and carries the obligations."),
   ("Valid consent under the DPDP Act must be:", ["Implied from silence", "Free, specific, informed, unconditional and unambiguous", "Bundled with the terms of service", "Permanent once given"], 1, "These are the statutory qualities of valid consent, and withdrawal must be as easy as giving it."),
   ("Processing a child's personal data requires:", ["No special steps", "Verifiable consent of a parent or lawful guardian", "Approval from the Board", "Consent from the child only"], 1, "The Act requires verifiable parental or guardian consent for children's data."),
   ("After a personal data breach, the fiduciary must notify:", ["Only the police", "The Board and each affected data principal", "Only the processor", "No one if the data was encrypted"], 1, "The Act requires notice to both the Board and affected individuals."),
   ("The maximum penalty for failing to take reasonable security safeguards is up to:", ["₹50 lakh", "₹5 crore", "₹250 crore", "There is no penalty"], 2, "The Schedule to the Act provides for penalties up to ₹250 crore for this breach."),
  ]))

COURSES.append(C("posh", "Preventing Sexual Harassment at the Workplace (POSH)", "compliance", "Foundation",
  "The Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013: what harassment is, the Internal Committee, and how complaints are handled.",
  ["Recognise conduct that amounts to sexual harassment under the POSH Act", "Explain the role and composition of the Internal Committee", "Describe the complaint and inquiry process and timelines"],
  [
   ("What the law covers", 7, """
The **Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013** (the POSH Act) protects women at the workplace. Many Indian organisations adopt **gender-neutral policies** that extend the same protection and process to everyone; check your own policy.

**Sexual harassment** includes unwelcome acts or behaviour, whether direct or implied, such as:

- physical contact and advances
- a demand or request for sexual favours
- sexually coloured remarks
- showing pornography
- any other unwelcome physical, verbal or non-verbal conduct of a sexual nature

It also covers circumstances such as an implied promise of preferential treatment, a threat about employment status, or creating an intimidating, hostile or offensive work environment.

The **workplace** is defined widely: it includes any place visited by the employee during employment, including transport provided by the employer, client sites, off-site events and, in practice, digital spaces such as messaging and video calls.

> What matters is how the conduct is **received**, not what was intended.
"""),
   ("The Internal Committee", 6, """
Every employer with **ten or more employees** must constitute an **Internal Committee (IC)** at each office or administrative unit.

- **Presiding Officer:** a woman employed at a senior level.
- At least **two members** from among employees committed to the cause of women or with experience in social work or legal knowledge.
- **One external member** from an NGO or association committed to the cause of women, or a person familiar with issues of sexual harassment.
- At least **half** the members must be women.

Members hold office for up to three years. Where an employer has fewer than ten employees, or the complaint is against the employer, complaints go to the **Local Committee** constituted by the District Officer.

### Employer duties

Display the consequences of sexual harassment and the IC's details at the workplace, run awareness programmes, help the IC with inquiries, treat harassment as misconduct under service rules, and include the number of cases in the **annual report**.
"""),
   ("Complaints, inquiry and outcomes", 7, """
1. **Complaint:** in writing to the IC within **three months** of the incident (or the last incident in a series). The IC can extend this by a further three months for sufficient reasons. The IC must help a complainant who cannot write.
2. **Conciliation:** at the complainant's request only, and never with a monetary settlement.
3. **Inquiry:** conducted following the principles of natural justice, and completed within **90 days**.
4. **Report:** the IC gives its findings to the employer within **10 days** of completing the inquiry.
5. **Action:** the employer acts on the recommendations within **60 days**. Action may include disciplinary measures under service rules and deductions from salary towards compensation.

### Confidentiality and retaliation

The identity of the complainant, respondent and witnesses, and the contents of the inquiry, are confidential; breaches can attract a penalty. Victimising a complainant or witness is itself misconduct.

Non-compliance by an employer, such as failing to constitute an IC, can attract a fine of up to **₹50,000**, higher penalties for repeat offences, and cancellation of licences.
"""),
  ],
  [
   ("Under the POSH Act, what matters most in deciding whether conduct is harassment?", ["The intention of the person", "How the conduct is received", "Whether it happened in the office building", "Whether there were witnesses"], 1, "Harassment is about unwelcome conduct; how it is received matters more than intent."),
   ("An Internal Committee is required where an employer has at least:", ["5 employees", "10 employees", "20 employees", "50 employees"], 1, "The Act requires an IC at every office with ten or more employees."),
   ("The Presiding Officer of the IC must be:", ["Any senior manager", "A woman employed at a senior level", "An external lawyer", "The HR head"], 1, "The Act requires a woman employed at a senior level."),
   ("Within what period should a complaint normally be made?", ["One month", "Three months, extendable by three months", "One year", "No time limit"], 1, "Three months from the incident, which the IC can extend by up to three more months."),
   ("Conciliation under the POSH Act:", ["Is mandatory", "Can include a monetary settlement", "Is only at the complainant's request and cannot involve money", "Replaces the inquiry in all cases"], 2, "Conciliation is optional, at the complainant's request, and no monetary settlement can be the basis."),
  ]))
