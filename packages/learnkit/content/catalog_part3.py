# Kayak Learn catalogue, part 3: Responsible AI and the internal Kayak Induction.
from catalog_part1 import C, COURSES

# ---------------------------------------------------------------- AI
COURSES.append(C("ai-foundations", "Generative AI: How It Works and Where It Fails", "ai", "Foundation",
  "A plain-English explanation of large language models, what they are good at, and the ways they go wrong.",
  ["Explain in plain terms how a large language model produces text", "Recognise hallucination, bias and other failure modes", "Write prompts that get reliable, checkable results"],
  [
   ("How a language model works", 7, """
A **large language model (LLM)** is a system trained on vast amounts of text to predict what comes next. Given some words, it estimates which word (strictly, which *token*, a word or part of a word) is most likely to follow, adds it, and repeats. Trained at enormous scale and then refined with human feedback, this simple mechanism produces fluent writing, summaries, translations, code and analysis.

Three things follow from how it works:

- **It generates, it does not look up.** Unless connected to search or documents, a model answers from patterns learned in training, not from a database of facts.
- **It has a knowledge cut-off.** It knows nothing after its training data ends unless given current information.
- **It is probabilistic.** The same question can produce different answers; confident phrasing is not evidence of accuracy.

Modern assistants add tools: web search, document retrieval, calculators and code execution. These make answers far more reliable, **when** the model actually uses them and cites what it found.
"""),
   ("Where AI goes wrong", 7, """
- **Hallucination:** fluent, plausible statements that are false, including invented citations, case law, statistics and quotes. Courts in several countries have sanctioned lawyers for filing AI-invented case citations.
- **Bias:** models reflect patterns in their training data and can reproduce stereotypes or treat groups unfairly, especially in hiring, lending or risk scoring.
- **Outdated or missing context:** a model may not know recent law, your client's facts or your firm's policy.
- **Over-agreement:** models tend to go along with the framing of a question. Ask "why is this wrong?" as well as "why is this right?".
- **Prompt injection:** text hidden in a document or web page can try to instruct an AI to do something its user did not ask for.
- **Data leakage:** anything you paste into a public AI tool may be stored or used to train future models, depending on the service's terms.

> Treat AI output like a draft from a bright, fast, overconfident junior colleague: useful, but always reviewed.
"""),
   ("Prompting for reliable results", 6, """
1. **Give context and a role:** who the audience is, what the output is for, what good looks like.
2. **Provide the source material** rather than relying on the model's memory, and ask it to answer only from that material.
3. **Ask for structure:** headings, tables, numbered steps, a specific length.
4. **Ask for sources and uncertainty:** "Cite the paragraph you relied on" and "Say if you are not sure".
5. **Iterate:** refine the prompt, ask for alternatives, ask it to critique its own draft.
6. **Verify:** check every fact, figure, name and citation against the original source before you rely on it.

A good prompt is specific: *"Summarise the attached audit report for a board audit committee in under 300 words. Use three headings: key findings, management response, open actions. Quote figures exactly as they appear. Flag anything you are unsure about."*
"""),
  ],
  [
   ("A large language model produces text by:", ["Looking up answers in a database", "Predicting likely next tokens based on training", "Copying web pages", "Asking a human"], 1, "LLMs generate text by repeatedly predicting the next token."),
   ("A fluent but false statement from an AI is called:", ["Bias", "Hallucination", "Encryption", "Overfitting"], 1, "Hallucination is plausible-sounding but untrue output."),
   ("Which makes AI answers more reliable?", ["Asking it to sound confident", "Providing the source material and asking it to cite it", "Using longer sentences", "Avoiding any instructions"], 1, "Grounding the model in sources and asking for citations reduces hallucination."),
   ("Hidden text in a document that tries to instruct an AI is known as:", ["Phishing", "Prompt injection", "Tokenisation", "Fine-tuning"], 1, "Prompt injection uses content to try to redirect an AI's behaviour."),
   ("The right attitude to AI output is to treat it as:", ["Final and authoritative", "A draft to be reviewed and verified", "Legally binding", "Always wrong"], 1, "AI output is useful but must be checked before you rely on it."),
  ]))

COURSES.append(C("ai-governance", "AI Risk and Governance Frameworks", "ai", "Intermediate",
  "The frameworks organisations use to govern AI: NIST AI RMF, ISO/IEC 42001, the EU AI Act and India's approach.",
  ["Describe the main AI governance frameworks and what they require", "Classify AI uses by risk", "Outline the components of an AI governance programme"],
  [
   ("The frameworks", 8, """
- **NIST AI Risk Management Framework (AI RMF 1.0, 2023):** a voluntary US framework built around four functions: **Govern, Map, Measure, Manage**. A Generative AI Profile (2024) adds risks specific to generative AI.
- **ISO/IEC 42001:2023:** the first certifiable international **AI management system** standard. Like ISO 27001 for security, it sets requirements for policy, roles, risk and impact assessment, controls, monitoring and continual improvement.
- **EU AI Act (Regulation (EU) 2024/1689):** the first comprehensive AI law. It entered into force on 1 August 2024 and applies in stages: prohibited practices and AI literacy from February 2025, general-purpose AI obligations from August 2025, and most high-risk obligations from August 2026 onwards, with some later dates and proposed adjustments. It reaches organisations outside the EU whose AI systems or outputs are used in the EU.
- **India:** there is no AI-specific statute yet. The government's **India AI Governance Guidelines (November 2025)** favour a principles-based, sector-led approach using existing laws, such as the **IT Act, 2000**, the **DPDP Act, 2023** and consumer protection law, alongside rules on deepfakes and synthetic content under the IT Rules. Sector regulators such as the RBI and SEBI have issued their own guidance on AI use.
"""),
   ("Classifying AI risk", 6, """
The EU AI Act's tiers are a useful way to think about risk, even outside Europe:

- **Unacceptable (prohibited):** for example social scoring by public authorities, manipulative techniques that cause harm, untargeted scraping of facial images, and emotion recognition at work or in education (with narrow exceptions).
- **High risk:** AI used in areas such as employment and worker management, credit scoring, access to essential services, education, critical infrastructure, law enforcement and justice. These need risk management, data governance, documentation, human oversight, accuracy and robustness, and registration.
- **Limited risk (transparency):** chatbots must disclose that users are dealing with AI, and AI-generated or manipulated content such as deepfakes must be labelled.
- **Minimal risk:** most other uses, such as spam filters or AI in games.

Inside an organisation, a simple test helps: **what decision does this AI influence, about whom, and what happens if it is wrong?**
"""),
   ("Building an AI governance programme", 6, """
1. **Inventory:** know every AI system you build, buy or use, including AI features inside existing software.
2. **Policy and accountability:** an acceptable-use policy, a named owner for each system and an oversight forum.
3. **Risk and impact assessment** before deployment, proportionate to risk: purpose, data, affected people, fairness, security, explainability and legal requirements.
4. **Data governance:** lawful basis for training and input data, confidentiality and retention.
5. **Human oversight:** a person can understand, challenge and override significant outputs.
6. **Testing and monitoring:** accuracy, bias, robustness and drift, before and after go-live.
7. **Transparency:** tell people when they are interacting with AI or when AI shaped a decision about them.
8. **Vendor management:** contractual terms on data use, security, audit and incident notice.
9. **Literacy:** train staff on what AI can and cannot do, as the EU AI Act now requires of providers and deployers.
"""),
  ],
  [
   ("The four functions of the NIST AI RMF are:", ["Plan, Do, Check, Act", "Govern, Map, Measure, Manage", "Identify, Protect, Detect, Respond", "Assess, Approve, Audit, Archive"], 1, "NIST AI RMF is organised around Govern, Map, Measure and Manage."),
   ("Which is a certifiable AI management system standard?", ["ISO/IEC 42001", "ISO 9001", "NIST CSF", "ISO 37001"], 0, "ISO/IEC 42001:2023 sets certifiable requirements for an AI management system."),
   ("Under the EU AI Act, AI used to screen job applicants is:", ["Minimal risk", "High risk", "Prohibited", "Exempt"], 1, "Employment and worker management uses are high-risk."),
   ("Under the EU AI Act, a chatbot must:", ["Never be used", "Disclose that the user is interacting with AI", "Be registered as high-risk", "Use only EU data"], 1, "Chatbots carry transparency obligations."),
   ("India's approach to AI governance is currently:", ["A single AI statute", "Principles-based and sector-led, using existing laws", "A total ban on generative AI", "Identical to the EU AI Act"], 1, "India's 2025 guidelines rely on existing laws and sector regulators rather than a new AI statute."),
  ]))

COURSES.append(C("ai-at-work", "Using AI Safely at Work", "ai", "Foundation",
  "Practical rules for using AI tools at work: protecting confidential data, checking outputs, disclosing AI use and spotting deepfakes.",
  ["Decide what information can and cannot go into an AI tool", "Review AI output to a professional standard", "Recognise AI-enabled fraud such as deepfakes and voice cloning"],
  [
   ("What goes in, and what does not", 6, """
The most common AI risk at work is not a rogue machine. It is a person pasting the wrong thing into the wrong tool.

**Use only tools your organisation has approved**, and know which ones are approved for which data. Enterprise versions usually contract not to train on your data; free consumer versions often do not offer that protection.

**Never paste into an unapproved tool:**

- client names, matters or confidential documents
- personal data: names with contact details, ID numbers, health or financial data
- passwords, API keys or access tokens
- unpublished financial results, deal information or anything price-sensitive
- source code or trade secrets

If you must use AI on sensitive material, use the approved enterprise tool, remove identifiers where you can, and share the minimum needed.
"""),
   ("Checking and owning the output", 6, """
You are responsible for anything you send, sign or file, however it was drafted.

- **Verify facts, figures and citations** against original sources. Never cite a case, statute or report you have not seen.
- **Check the reasoning,** not just the wording. Does the conclusion follow from the facts?
- **Look for what is missing:** risks, caveats, alternative views.
- **Keep your judgement:** AI can draft and analyse; professional conclusions are yours.
- **Disclose AI use** where your client, regulator, publisher or court expects it.
- **Respect intellectual property:** do not ask AI to reproduce copyrighted works or others' branding.

> A practical rule: if you could not defend a sentence without saying "the AI wrote it", rewrite it or remove it.
"""),
   ("Deepfakes and AI-enabled fraud", 7, """
AI makes impersonation cheap. Criminals now use **cloned voices** and **deepfake video** to pose as executives, suppliers or family members. In one widely reported 2024 case, an employee in Hong Kong transferred about US$25 million after a video call in which every other participant was a deepfake of a colleague.

### Warning signs

- Urgency and secrecy: "this must be done in the next hour, don't tell anyone"
- A request to bypass normal approval or payment processes
- A new channel: a personal number, a new messaging account, an unexpected video link
- Small glitches: lip-sync slightly off, odd lighting, unnatural blinking, flat voice tone

### What to do

- **Verify through a separate, known channel:** call back on a number you already have.
- **Use a code word** or a question only the real person could answer for high-value requests.
- **Never let urgency override process.** Real leaders will wait the five minutes it takes to verify.
- **Report** attempts to your security or compliance team, even if you did not fall for them.
"""),
  ],
  [
   ("Which is safe to paste into an unapproved free AI tool?", ["A client's draft contract", "A colleague's PAN number", "A general question about grammar with no confidential content", "Your API key"], 2, "Only non-confidential, non-personal content belongs in unapproved tools."),
   ("If AI drafts a report that you send to a client, who is responsible for it?", ["The AI vendor", "You", "No one", "The client"], 1, "You remain responsible for anything you send or sign."),
   ("An AI cites a court case you cannot find. You should:", ["Cite it anyway", "Remove it unless you can verify it from the original source", "Ask the AI if it is real and trust the answer", "Change the case name"], 1, "Never rely on a citation you have not verified yourself."),
   ("The best defence against a deepfake call asking for an urgent payment is to:", ["Pay quickly", "Verify through a separate, known channel", "Ask the caller to confirm by email", "Record the call"], 1, "Independent verification on a known channel defeats impersonation."),
   ("Enterprise AI tools approved by your organisation usually:", ["Train on all your data", "Contract not to train on your data and provide stronger protection", "Have no terms", "Are always free"], 1, "Approved enterprise tools generally carry contractual data protections."),
  ]))

# ---------------------------------------------------------------- KAYAK INDUCTION (internal)
COURSES.append(C("kayak-who-we-are", "Who We Are: Kayak Strategic Advisors", "kayak", "Induction",
  "Our purpose, our values of Balance, Clarity and Direction, the promises we make to clients and the group we belong to.",
  ["Explain Kayak's purpose and values", "State the five promises we make to every client", "Describe the Kayak group and our practice areas"],
  [
   ("Our purpose and values", 6, """
**Kayak Strategic Advisors Private Limited** helps organisations make sound decisions in difficult water: governance, risk, integrity, crisis and growth. We are named after the kayak because it is the craft of moving forward with control in conditions you cannot command.

### Our values

- **Balance.** We weigh every side before we advise. Steady judgement, not drama.
- **Clarity.** We make complex matters understandable and say plainly what we think.
- **Direction.** Advice must lead somewhere. We give clients a course they can follow.

### The group

Kayak works alongside three affiliate entities:

- **Kayak Innovations (OPC) Private Limited:** holds the intellectual property in all Kayak technology solutions.
- **Brand Defence & Integrity™:** the brand belongs to Kayak's leadership and is currently used by Brand Defence Consulting Private Limited (Brand Defence India), known for market intelligence and intellectual-property work.
- **Kayak Technology Solutions** (a partnership firm): develops and markets the Kayak Group's SaaS solutions, led by Tan.ai, the group's CTO.

We work from **Mumbai** and **Thane**.
"""),
   ("Our five promises", 6, """
Every client engagement is held to five promises. They are on our website, so clients can hold us to them.

1. **Independent by design.** Our advice is not shaped by who pays for the next engagement. We decline work that would compromise our independence.
2. **Senior-led.** Experienced people lead every engagement and are present in it, not just at the pitch.
3. **Evidence before opinion.** We form conclusions from facts we can show, and say how sure we are.
4. **Plain English.** We write so a busy director can understand the point in one reading.
5. **Built to be carried out.** Recommendations come with the practical steps, owners and sequence to implement them.

When you are unsure how to handle a situation, ask which answer best keeps these promises.
"""),
   ("What we do", 6, """
Our work is organised into six practice clusters, serving clients across more than forty sectors:

- **Strategy, Deal & Transactions:** growth and market-entry strategy, M&A advisory, commercial, financial and integrity due diligence, valuation support and post-deal integration.
- **Tax & Regulatory:** direct tax, GST and transfer pricing; SEBI, RBI, FEMA and Companies Act compliance; DPDP readiness; ESG and BRSR reporting.
- **Crisis & Resilience:** enterprise and third-party risk, conduct forensics, brand and marketplace integrity, IP enforcement support with counsel, expert witness and arbitration support, and crisis management.
- **Technology & AI:** digital and data strategy, AI adoption and governance, analytics, cyber-risk assessment and technology due diligence.
- **Managed Services:** compliance calendars, virtual CFO, HR and payroll compliance, brand monitoring and due diligence as a service.
- **International Desk:** India entry, outbound expansion, cross-border structuring, FDI, ODI and FEMA support, and international background checks.

We also build our own products, including **NexaPair**, **SayUsNow**, **SeeCounter** and **DocuVow**.

> Know the practice areas well enough to recognise when a client problem belongs to a colleague's team, and introduce them.
"""),
  ],
  [
   ("Kayak's three values are:", ["Speed, Scale, Success", "Balance, Clarity, Direction", "Trust, Teamwork, Talent", "Integrity, Innovation, Impact"], 1, "Balance, Clarity and Direction are Kayak's values."),
   ("'Evidence before opinion' means:", ["Opinions are never given", "Conclusions are formed from facts we can show", "Clients supply all evidence", "Opinions come first"], 1, "We reach conclusions from demonstrable facts and say how sure we are."),
   ("Which is one of the five promises?", ["Lowest price", "Senior-led", "Fastest delivery", "Unlimited revisions"], 1, "Senior-led is one of our five promises."),
   ("Kayak's offices are in:", ["Delhi and Pune", "Mumbai and Thane", "Bengaluru and Chennai", "Dubai and Mumbai"], 1, "We work from Mumbai and Thane."),
   ("If a client problem belongs to another practice, you should:", ["Handle it yourself anyway", "Introduce the right colleague", "Ignore it", "Refer it to a competitor"], 1, "Knowing the practices lets you connect clients with the right team."),
  ], audience="internal"))

COURSES.append(C("kayak-confidentiality", "Confidentiality and Information Security at Kayak", "kayak", "Induction",
  "How we protect client confidences and data: classification, handling, devices, AI tools and incident reporting.",
  ["Classify and handle information correctly", "Follow Kayak's rules for devices, accounts and AI tools", "Report a security incident immediately and correctly"],
  [
   ("Confidential by default", 6, """
Clients come to us with their most sensitive matters: suspected fraud, board disputes, crises, transactions. **Confidential by default** is one of our standards: treat everything about a client, including the fact that they are a client, as confidential unless you are told otherwise.

### Classification

- **Public:** published on our website or in approved materials.
- **Internal:** for Kayak staff only, such as policies and templates.
- **Confidential:** client information, engagement files, personal data.
- **Restricted:** the most sensitive matters, such as investigations, price-sensitive information and whistleblower identities, shared strictly need-to-know.

### Handling rules

- Discuss client matters only with people who need to know, and never in public places.
- Use client code names where the engagement calls for them.
- Share files through Kayak's approved systems, never personal email or messaging.
- Lock your screen whenever you step away.
"""),
   ("Devices, accounts and AI", 6, """
- **Two-factor authentication** is required on Kayak systems, including this portal. Never share codes or approve a sign-in prompt you did not start.
- **Strong, unique passphrases** for every account, stored in a password manager.
- **Keep devices updated** and encrypted, and report a lost or stolen device immediately.
- **Use Kayak AI** (in this portal) for client work. Its keys are held server-side and it is configured for business use. Do not paste client information into personal or free AI tools.
- **Be sceptical of urgent requests.** Verify any request to change bank details, make a payment or share credentials through a separate, known channel.
- **Personal data** is handled under the DPDP Act, 2023: collect the minimum, keep it only as long as needed, and protect it.
"""),
   ("When something goes wrong", 5, """
Report immediately if you:

- clicked a suspicious link or opened a suspicious attachment
- sent information to the wrong person
- lost a device or a document
- suspect someone has accessed an account
- see a client's information where it should not be

**Report first, fix later.** Tell your engagement lead and email the founder's office straight away. Speed matters: under the DPDP Rules, a personal data breach must be reported to affected people without delay and to the Data Protection Board within 72 hours, and clients may have their own notification duties.

Nobody is blamed for reporting a mistake promptly. Hiding one is a serious matter.
"""),
  ],
  [
   ("At Kayak, information about a client is treated as:", ["Public unless marked", "Confidential by default", "Internal only", "Free to share with friends"], 1, "Confidential by default is a Kayak standard."),
   ("Whistleblower identities belong to which class?", ["Public", "Internal", "Confidential", "Restricted"], 3, "The most sensitive information is Restricted and shared strictly need-to-know."),
   ("For client work involving AI you should use:", ["Any free chatbot", "Kayak AI in the internal portal", "A personal account", "No AI under any circumstances"], 1, "Kayak AI is the approved tool for client work."),
   ("You sent a client file to the wrong email address. You should:", ["Hope no one notices", "Report it immediately to your engagement lead and the founder's office", "Wait a week", "Delete your sent items"], 1, "Report first, fix later: speed matters."),
   ("A sign-in approval prompt appears that you did not start. You should:", ["Approve it", "Deny it and report it", "Ignore it", "Share the code with IT by chat"], 1, "An unexpected prompt may mean someone has your password."),
  ], audience="internal"))

COURSES.append(C("kayak-independence-quality", "Independence, Conflicts and Quality", "kayak", "Induction",
  "How we keep our independence, run conflict checks before every engagement and hold our work to a consistent standard.",
  ["Run a conflict check before any new engagement", "Apply Kayak's quality standards to work products", "Use lawful, ethical methods in every inquiry"],
  [
   ("Conflicts checked first", 6, """
Before we accept any engagement, we check for conflicts. **No work starts until the check is cleared.**

The check covers:

- the client, its group companies and key individuals
- the **counterparties**: the other side of a dispute, transaction or investigation
- current and past Kayak engagements involving any of them
- personal relationships and interests of the proposed team

If a conflict exists, we decline, or, where appropriate and permitted, disclose it and obtain informed consent with safeguards such as separate teams. We never act for both sides of a dispute.

Team members must declare any personal connection to a client or counterparty as soon as they become aware of it, including during an engagement.
"""),
   ("Evidence you can rely on", 6, """
Our reports are often relied upon by boards, courts, regulators and investors. Our standard, **Evidence you can rely on**, means:

- every factual statement is traceable to a source in the working file
- sources are graded for reliability, and hearsay is labelled as such
- figures are checked twice, by two people for anything material
- limitations of scope are stated clearly
- conclusions say how confident we are, and why
- a second reviewer who did not do the work reads every client deliverable

### Lawful, ethical methods

We gather information only by lawful and ethical means. We do **not** use pretexting, hacking, bribery, unlawful surveillance or access to data we are not entitled to. Where an engagement needs specialist activity, it is approved in advance and within the law.
"""),
   ("Working alongside advisers", 5, """
Our standard **Alongside your advisers** means we work constructively with a client's lawyers, auditors and other advisers, not against them or around them.

- Where legal privilege matters, engagements in investigations are often structured **through the client's counsel**. Follow the engagement's protocol for communications and documents.
- We do not give legal opinions; we give findings and advisory recommendations, and refer legal questions to counsel.
- Respect the roles of statutory and internal auditors; share findings through agreed channels.

### Quality in every deliverable

Use the Kayak brand templates from the Brand Portal, write in plain English, and run the final checklist: facts verified, names and figures correct, sources logged, limitations stated, reviewer sign-off recorded.
"""),
  ],
  [
   ("When can work on a new engagement begin?", ["Immediately on request", "After the conflict check is cleared", "After the first invoice", "After the report is drafted"], 1, "No work starts until the conflict check is cleared."),
   ("Kayak acting for both sides of a dispute is:", ["Allowed with a discount", "Never permitted", "Allowed if both agree by email", "Allowed for small matters"], 1, "We never act for both sides of a dispute."),
   ("Which method is NOT acceptable in a Kayak inquiry?", ["Public records research", "Interviews with consent", "Pretexting to obtain records", "Court record searches"], 2, "Pretexting is deceptive and is never used."),
   ("Material figures in a report should be checked by:", ["The client", "Two people", "No one", "The AI only"], 1, "Material figures are checked by two people."),
   ("Legal questions arising in an engagement should be:", ["Answered by us as a legal opinion", "Referred to the client's counsel", "Ignored", "Posted online"], 1, "We do not give legal opinions; we work alongside counsel."),
  ], audience="internal"))

COURSES.append(C("kayak-brand-voice", "The Kayak Brand and Voice", "kayak", "Induction",
  "How Kayak looks and sounds: the identity, colours and type, how to write in the Kayak voice and where to find the templates.",
  ["Apply the Kayak identity correctly", "Write in the Kayak voice", "Use the Brand Portal, Business Cards and Presentations tools"],
  [
   ("How we look", 6, """
The Kayak identity is calm, precise and confident, like the water it is named after.

- **Wordmark and identifier:** always use the master files from the **Brand Portal**. Never redraw, stretch, recolour or add effects to the logo.
- **Colours:** **Deep Current** (our deep teal-navy) is the anchor; **Open Water** teal supports it; **Saffron** is the accent, used sparingly to draw the eye to one thing.
- **Typography:** **Archivo** for headings and interface, **Source Serif 4** for long-form reading.
- **Space:** generous margins and clear hierarchy. When in doubt, take something away.
- **Imagery:** water, horizons and real places of work; never clichéd handshakes or stock "business people".

The **Brand Portal** holds the brand manual, logos, colours, fonts, templates and product logos.
"""),
   ("How we sound", 6, """
Our voice follows our values.

- **Balanced:** measured and fair. No hype, no alarm.
- **Clear:** plain English, short sentences, active voice. Explain jargon or avoid it.
- **Directional:** lead with the point, then the reasons, then what to do.

### Do

- "We found three control gaps. The most serious is in vendor payments. Fix it first."
- "We are confident about the first finding and less sure about the second, because the records are incomplete."

### Avoid

- "Leveraging synergistic paradigms to unlock holistic value."
- Exaggeration: "unprecedented", "game-changing", "world-class".
- Hedging everything until nothing is said.
"""),
   ("Tools that keep us on-brand", 5, """
The internal portal has tools that build on-brand material for you:

- **Business Cards:** create your card from a prompt; export print-ready PDF with bleed, plus SVG, PNG and JPG.
- **Presentations:** describe the deck by sector, service line and services; Kayak AI drafts it on the Kayak master slides; export to PowerPoint.
- **Kayak AI:** drafting, research and review in the Kayak voice.
- **Brand Portal:** download any asset, always the latest approved version.

Before anything goes to a client, run the brand check: correct logo file, Kayak colours and type, plain-English headline, no spelling errors, and the reviewer has signed off.
"""),
  ],
  [
   ("Where should you get the Kayak logo?", ["A web search", "The Brand Portal master files", "Redraw it", "A screenshot of the website"], 1, "Always use the master files from the Brand Portal."),
   ("Saffron in the Kayak palette is used:", ["As the main background", "Sparingly as an accent", "Never", "For all body text"], 1, "Saffron is an accent to draw the eye to one thing."),
   ("Which sentence is in the Kayak voice?", ["We are leveraging synergies", "We found three control gaps; fix vendor payments first", "This is an unprecedented, game-changing finding", "It may possibly perhaps be a concern"], 1, "Clear, direct and leading with the point."),
   ("Kayak's heading typeface is:", ["Arial", "Archivo", "Times New Roman", "Comic Sans"], 1, "Archivo is used for headings and interface."),
   ("To create an on-brand slide deck you should use:", ["Any template online", "The Presentations tool in the internal portal", "A blank document", "A competitor's deck"], 1, "The Presentations tool builds decks on the Kayak masters."),
  ], audience="internal"))
