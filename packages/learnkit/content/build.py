# Builds catalog.json from the three course files plus the awareness bytes below.
# Usage: python3 packages/learnkit/content/build.py
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from catalog_part1 import TOPICS, PATHS, COURSES
import catalog_part2, catalog_part3  # noqa: F401  (they append to COURSES)

def B(id, topic, title, body, q, options, answer, why, minutes=2, audience="public"):
    return {"id": id, "topic": topic, "title": title, "minutes": minutes, "audience": audience, "body": body.strip(),
            "check": {"q": q, "options": options, "answer": answer, "why": why}}

BYTES = [
  B("byte-pause", "ethics", "The two-minute pause",
    "When a request feels wrong, you rarely have to answer at once. Saying *\"Let me check and come back to you\"* buys time to think, read the policy and ask someone you trust. Most poor decisions are made in the first sixty seconds, under pressure.",
    "What is the simplest way to avoid a rushed ethical mistake?", ["Decide immediately", "Ask for time before answering", "Do what the senior person says", "Say nothing"], 1, "A short pause lets you think, check and ask."),
  B("byte-gift-card", "ethics", "Why gift cards are cash",
    "A voucher or gift card can be spent like money, which is why almost every gifts policy treats it as **cash**. Politely decline, thank the giver, and record the offer in the gifts register.",
    "A vendor sends you a ₹5,000 shopping voucher at Diwali. You should:", ["Keep it, it's festive", "Decline politely and record it", "Share it with the team", "Use it for team lunch"], 1, "Vouchers are cash equivalents and should be declined and recorded."),
  B("byte-bank-change", "risk", "The bank-detail change email",
    "One of the costliest frauds is simple: an email, apparently from a supplier, asks you to update its bank account. **Always verify by calling a number you already hold**, never one in the email. Business email compromise costs organisations billions each year.",
    "How should you verify a supplier's bank-change request?", ["Reply to the email", "Call a number you already hold for the supplier", "Check the logo", "Ask a colleague to approve it"], 1, "Independent verification defeats email impersonation."),
  B("byte-dpdp-minimum", "compliance", "Collect the minimum",
    "The DPDP Act, 2023 expects you to collect only the personal data necessary for a stated purpose and to erase it when the purpose is served. Before adding a field to a form, ask: **do we actually need this?**",
    "Which principle does 'collect only what you need' reflect?", ["Data minimisation", "Data monetisation", "Data maximisation", "Open data"], 0, "Data minimisation is central to the DPDP Act."),
  B("byte-breach-72", "compliance", "The 72-hour clock",
    "Under the DPDP Rules, 2025 a data fiduciary must inform affected people of a personal data breach without delay and give the Data Protection Board a detailed report within **72 hours**. That clock starts when you become aware, so report incidents internally at once.",
    "Within how long must a detailed breach report reach the Data Protection Board?", ["24 hours", "72 hours", "30 days", "There is no deadline"], 1, "The Rules require a detailed report within 72 hours of becoming aware."),
  B("byte-facilitation", "compliance", "Small payments, big trouble",
    "A 'speed money' payment to get a file moved is still a bribe under India's Prevention of Corruption Act and the UK Bribery Act. Size does not matter. If someone asks, refuse, record it and tell compliance.",
    "Is a small 'speed' payment to an official acceptable?", ["Yes, if under ₹1,000", "No, it is a bribe", "Yes, if recorded", "Yes, if customary"], 1, "Facilitation payments are bribes, whatever their size."),
  B("byte-deepfake", "ai", "Spotting a deepfake call",
    "Voice and video can now be faked convincingly. Be wary of **urgency, secrecy and a request to skip process**. Hang up and call back on a number you already have. A real colleague will understand.",
    "A video call from your 'CFO' urgently asks for a confidential transfer. What should you do?", ["Make the transfer", "Call the CFO back on a known number", "Ask on the same call for proof", "Email the CFO's assistant from the call link"], 1, "Verify through a separate, known channel."),
  B("byte-ai-paste", "ai", "Think before you paste",
    "Free AI tools may keep and learn from what you type. Never paste client documents, personal data, passwords or unpublished financials into a tool your organisation has not approved.",
    "Which is safe to paste into an unapproved AI tool?", ["A client contract", "A general writing question", "Your password", "Unpublished results"], 1, "Only non-confidential content belongs in unapproved tools."),
  B("byte-ai-citation", "ai", "Check every citation",
    "AI tools sometimes invent convincing references: cases, reports and quotes that do not exist. Before you rely on any citation an AI gives you, **open the original source and read it**.",
    "An AI gives you a case citation. Before using it you should:", ["Trust it", "Find and read the original judgment", "Ask the AI again", "Shorten it"], 1, "Only cite what you have verified at source."),
  B("byte-board-minutes", "governance", "Dissent belongs in the minutes",
    "If a director disagrees with a board decision, that dissent should be recorded in the minutes. Under the Companies Act, 2013, non-executive and independent directors are liable mainly where they knew of a wrong and consented, or failed to act diligently. A recorded objection is evidence of diligence.",
    "Why should a director's dissent be minuted?", ["It is a formality", "It is evidence that the director acted diligently", "It is required for tax", "It hides the decision"], 1, "Recorded dissent shows the director exercised independent judgement."),
  B("byte-rpt", "governance", "The arm's length test",
    "A related-party transaction is at arm's length when its terms are what independent parties would agree. Ask: **would we offer the same price and terms to a stranger?** If not, it needs a closer look.",
    "What does 'arm's length' mean for a related-party transaction?", ["Signed far away", "Terms that independent parties would agree", "Approved by the promoter", "Below ₹1 crore"], 1, "Arm's length means market terms between unrelated parties."),
  B("byte-kri", "risk", "Indicators that warn early",
    "A key risk indicator tells you a risk is rising before it happens: for example, overdue vendor reviews, staff attrition in a key team or a growing patch backlog. Set a threshold and agree in advance who acts when it turns red.",
    "What makes a good key risk indicator?", ["It reports losses after they occur", "It signals rising risk early, with a threshold and an owner", "It is reviewed once a year", "It is kept secret"], 1, "Good KRIs are early, measurable and owned."),
  B("byte-posh-ic", "compliance", "Know your Internal Committee",
    "Every workplace with ten or more employees must have an Internal Committee under the POSH Act, 2013, with its members' names displayed. Find out who is on yours, so you know where to go, or where to send a colleague who needs help.",
    "From how many employees must an employer constitute an Internal Committee?", ["5", "10", "25", "100"], 1, "The POSH Act applies the Internal Committee requirement from ten employees."),
  B("byte-kayak-conflict", "kayak", "No conflict check, no start",
    "At Kayak, no engagement begins until the conflict check has cleared, covering the client, its group and every counterparty. If you learn of a personal link to anyone involved, declare it straight away.",
    "When does work on a new Kayak engagement begin?", ["When the client asks", "After the conflict check clears", "After the first meeting", "After the report"], 1, "No conflict check, no start.", audience="internal"),
]

def main():
    ids = [c["id"] for c in COURSES]
    assert len(ids) == len(set(ids)), "duplicate course id"
    for p in PATHS:
        for cid in p["courses"]:
            assert cid in ids, f"path {p['id']} references missing course {cid}"
    for c in COURSES:
        for q in c["quiz"]["questions"]:
            assert 0 <= q["answer"] < len(q["options"]), f"bad answer in {c['id']}"
        assert c["topic"] in {t["id"] for t in TOPICS}
    for p in PATHS:
        p["minutes"] = sum(next(c["minutes"] for c in COURSES if c["id"] == cid) for cid in p["courses"])
    out = {"version": "2026.11", "topics": TOPICS, "paths": PATHS, "courses": COURSES, "bytes": BYTES}
    with open(os.path.join(HERE, "catalog.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"{len(TOPICS)} topics, {len(PATHS)} paths, {len(COURSES)} courses, {len(BYTES)} bytes, "
          f"{sum(len(c['lessons']) for c in COURSES)} lessons, {sum(len(c['quiz']['questions']) for c in COURSES)} questions")

if __name__ == "__main__":
    main()
