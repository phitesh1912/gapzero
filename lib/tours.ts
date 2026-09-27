// Walkthrough copy for each screen. Steps whose target isn't on screen (e.g. hidden for a role) are skipped.

export type TourStep = { target?: string; title: string; body: string; side?: "top" | "bottom" | "left" | "right" };

export const QUEUE_TOUR: TourStep[] = [
  {
    title: "Welcome to the command center",
    body: "Every refill that needs a provider's attention lands here, from any channel. Here's a 30-second tour of what's on screen.",
  },
  {
    target: "kpis",
    title: "The numbers that matter",
    body: "Our north star is gap days: days a patient goes without their medication. Out of meds, running out this week, and what's waiting on you.",
    side: "bottom",
  },
  {
    target: "prevention",
    title: "Prevention: catch it before it's stuck",
    body: "These patients run out soon, and their refill will get stuck (no refills left, or labs or a visit overdue), but nobody has asked yet. Start opens the request now, days ahead of the gap.",
    side: "bottom",
  },
  {
    target: "upload-fax",
    title: "Upload fax",
    body: "Pharmacies still send many refill requests by fax. Upload one (or try a sample): AI reads it, flags anything it's unsure of for you to confirm, matches the patient, and it's triaged like everything else.",
    side: "left",
  },
  {
    target: "tabs",
    title: "Needs me",
    body: "Just the requests waiting on your role. Nurses see protocol co-signs and patient matching; providers see decisions; front desk sees visits to book.",
    side: "bottom",
  },
  {
    target: "col-supply",
    title: "Supply",
    body: "Days of medication left, from fill history. The queue is sorted by this, so whoever runs out first is on top. Red means out or nearly out.",
    side: "bottom",
  },
  {
    target: "col-status",
    title: "Status and time stuck",
    body: "Where the refill is in its lifecycle, and how long it has sat there. It turns amber after 2 days.",
    side: "bottom",
  },
  {
    target: "col-why",
    title: "Why it's stuck",
    body: "Blockers found by deterministic checks, not AI: overdue labs or visit, prior auth, missing info, controlled substance. 'Routine renewal' means only the refill count ran out.",
    side: "bottom",
  },
  {
    target: "col-owner",
    title: "Ball is with",
    body: "Who owns the next step right now. YOU means it's waiting on your role.",
    side: "left",
  },
  {
    target: "role-switcher",
    title: "Switch roles",
    body: "See the same refills as a nurse, provider, front desk or ops. Permissions are enforced on the server, not just hidden in the UI.",
    side: "right",
  },
  {
    title: "Open any row",
    body: "Click a patient, or use j / k and Enter, to open its one-screen decision packet. There's a short tour there too.",
  },
];

export const REFILL_TOUR: TourStep[] = [
  {
    target: "journey",
    title: "The journey",
    body: "Five stages from request to filled. The highlighted stage shows who holds it now and for how long. Amber means waiting on someone outside the clinic; red means something failed.",
    side: "bottom",
  },
  {
    target: "state-panel",
    title: "Where this refill stands",
    body: "The system's reasoning in plain language: what's blocking it, what's missing, who can resolve it, and what happens next. 'Did it happen?' only turns green when the pharmacy confirms.",
    side: "right",
  },
  {
    target: "match-review",
    title: "Confirm what the AI read",
    body: "Fields under 75% confidence are highlighted amber. Confirm or correct them, pick the patient, and the request moves on. The AI's confidence is cross-checked against a rule-based parser.",
    side: "right",
  },
  {
    target: "ai-summary",
    title: "AI case summary",
    body: "A short, labelled summary of why it's stuck and the next step. Advisory only: it never makes the decision.",
    side: "right",
  },
  {
    target: "protocol-checks",
    title: "Protocol checks",
    body: "The practice's doctor-signed rules, checked one by one against the actual value. Pass them all and a nurse may co-sign; fail one and it goes to a provider. No AI here.",
    side: "right",
  },
  {
    target: "actions",
    title: "Actions",
    body: "One-click decisions for your role. A provider can approve a short bridge supply and order the overdue labs in one action. Nurses can't approve controlled or out-of-protocol requests; try it and watch the server refuse.",
    side: "left",
  },
  {
    target: "timeline",
    title: "Timeline",
    body: "Every state change and every person, system and AI action, with the rule behind it. Append-only, so you can always see why something happened.",
    side: "left",
  },
  {
    target: "patient-view",
    title: "Patient view",
    body: "What the patient sees from their text message: first name, status and next step. Never the medication or any clinical detail.",
    side: "left",
  },
];

export const INTAKE_TOUR: TourStep[] = [
  {
    title: "What 'Upload fax' means",
    body: "Pharmacies send refill requests as faxes: scanned, often messy text. Here you drop one in, and GapZero turns it into a structured request.",
  },
  {
    target: "samples",
    title: "Try a sample",
    body: "Three synthetic faxes: a clean one (matches automatically), a messy one (AI flags the garbled name and date of birth), and one missing key details.",
    side: "bottom",
  },
  {
    target: "fax-text",
    title: "The fax text",
    body: "Paste OCR output or upload a .txt file. Synthetic data only.",
    side: "top",
  },
  {
    target: "extract",
    title: "Extract and triage",
    body: "AI pulls out each field with a confidence score. Anything uncertain waits for you to confirm; then the same deterministic checks run as for every other request.",
    side: "top",
  },
];

export const PROTOCOL_TOUR: TourStep[] = [
  {
    target: "plain-english",
    title: "Write it like you'd say it",
    body: "Describe when nurses may renew without the provider, e.g. 'metformin for up to 90 days if seen in the last year and A1C within 6 months'.",
    side: "bottom",
  },
  {
    target: "ai-draft",
    title: "Draft rules with AI",
    body: "AI converts your sentence into structured checks. It's a draft: it can only use known facts, and it can never cover controlled substances.",
    side: "right",
  },
  {
    target: "rules",
    title: "Review the rules",
    body: "These exact checks run on every refill. Edit anything the AI got wrong.",
    side: "top",
  },
  {
    target: "sign",
    title: "Save and sign",
    body: "A draft does nothing. Only a provider can sign; signing makes it active and retires the old version. Signed versions never change, so every decision can point to the exact rules it used.",
    side: "top",
  },
  {
    target: "versions",
    title: "Version history",
    body: "Every version with who signed it and a diff of what changed.",
    side: "left",
  },
];

export const OPS_TOUR: TourStep[] = [
  {
    target: "value",
    title: "Value delivered",
    body: "What the practice is getting: refills resolved and verified, how many were handled by nurses via protocol, refills caught before they got stuck, and estimated staff time saved.",
    side: "bottom",
  },
  {
    target: "sends",
    title: "Failed and retrying sends",
    body: "When a pharmacy doesn't answer, GapZero retries with backoff and escalates to staff after 3 failures. Nothing is marked done until the pharmacy confirms.",
    side: "top",
  },
  {
    target: "pharmacies",
    title: "Simulate an outage",
    body: "Toggle a pharmacy down, approve a refill that goes to it, and watch it fail, retry, and recover when you bring it back up.",
    side: "left",
  },
  {
    target: "ops-controls",
    title: "Retry worker and reset",
    body: "Run the retry worker now instead of waiting for the backoff. Reset demo restores all the synthetic data.",
    side: "bottom",
  },
];
