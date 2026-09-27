@AGENTS.md

# GapZero: project context for Claude Code

> 24-hour hackathon build, solo developer. This file is the source of truth for what we're building and why.
> Read it fully before writing code. Follow the build order in section 16.

---

## 1. The challenge (summary)

A patient needs a refill of a medication they already take, but the refill needs provider action: no refills left, a visit needed, labs overdue, missing info, prior auth, and so on. The request then bounces between pharmacy, clinic staff, provider and patient over fax, phone and portals. Nobody sees the whole picture, and the patient just knows they don't have their medication.

We must build a **B2B system** (customers are physician groups and pharmacies, not patients) that resolves stuck refills end to end, keeps the patient informed, and keeps **clinical decisions with licensed humans**.

Judged on three tracks:
1. **Product / Engineering / Security**: problem framing, workflow UX, architecture, data access, security, reliability, observability
2. **Intelligence**: refill as a changing system state, AI judgment, human-in-the-loop, guardrails, verification, explainability
3. **Go-to-market**: funnel, customer understanding, pricing, metrics (handled outside the codebase)

---

## 2. What we're building

**GapZero: patients never run out of medication because of paperwork.** (Working name; the product name lives in one constant, `lib/brand.ts`.)

A refill command center for **physician groups** (primary care and chronic care, 10–100 providers). It:

1. Takes in every refill request (e-prescribing renewal requests, faxes, portal messages, proactive detection).
2. Identifies **why** each one is stuck (blocker codes).
3. Checks it against the practice's **doctor-signed refill protocols** (deterministic rules, not AI).
4. Builds a **one-screen decision packet** so a nurse or provider decides in seconds, not minutes.
5. Handles follow-up (send Rx, request info, request visit or labs) and **verifies** each action happened.
6. Tracks the refill until filled. The patient gets a status link.
7. **Prevents** gaps: flags refills that will get stuck about 10 days before the patient runs out.

- **Primary users:** refill nurse / medical assistant, provider
- **Other users:** front desk, practice ops admin
- **Buyer:** practice administrator / COO

**Core insight:** the bottleneck isn't the approval click, it's the context gathering. We pre-gather the context.

**North-star metric: gap days**, the number of days a patient is without their medication. Everything is prioritized by days of supply left.

---

## 3. Non-negotiable guardrails

- The system **never** approves, denies or sends a prescription on its own. Every approval is made by a human with the right role. Protocols decide the **route** (e.g., "meets Hypertension Protocol v2 → nurse may co-sign"), never the outcome.
- **Controlled substances** (`isControlled = true`) **always** route to provider review. Enforce this in code, not in protocol data; no protocol can override it. Show the reason in the UI.
- AI output is advisory. Low-confidence extraction fields require human confirmation. AI summaries are labelled "AI-generated".
- Protocols are **inactive until signed** by a provider. A signed version is immutable; edits create a new version.
- **Synthetic data only.** No real patient data anywhere.
- Every state change and every user, system or AI action writes an **event** (append-only).
- **Role checks happen on the server** in every API route and server action, never only in the UI.
- The patient tracking page shows **first name, status and next step only**. No drug name, DOB or clinical details.

---

## 4. Stack

- Next.js (App Router) + TypeScript (strict) + Tailwind + shadcn/ui
- Postgres on Supabase, via Prisma. `DATABASE_URL` = pooled connection string, `DIRECT_URL` = direct connection (for migrations).
- **AI via a provider adapter** (`lib/ai/client.ts`) used for extraction, rule drafting and summaries. Provider is chosen at runtime:
  1. `ANTHROPIC_API_KEY` set → Anthropic (`@anthropic-ai/sdk`, model `claude-sonnet-5`)
  2. else `GROQ_API_KEY` set → Groq free tier (OpenAI-compatible API)
  3. else **demo mode**: canned responses for the sample faxes, protocol drafts and summaries, labelled "AI-generated (demo mode)"
  - Every AI response is validated against a schema (zod). Invalid output or API failure falls back to demo mode or marks fields low-confidence; the demo must never break on an AI call.
  - Callers use `extractFax()`, `draftRules()`, `summarizeCase()` and never know which provider answered.
- Deploy on Vercel. Env vars: `DATABASE_URL`, `DIRECT_URL`, optional `GROQ_API_KEY` / `ANTHROPIC_API_KEY`.
- Do **not** use SQLite (Vercel's filesystem isn't persistent).
- Vitest for unit tests (rules engine and state machine at minimum).

---

## 5. Data model (Prisma)

- **User**: id, name, role (`PROVIDER | NURSE | FRONT_DESK | ADMIN`)
- **Patient**: id, mrn, firstName, lastName, dob, phone, primaryProviderId, lastVisitAt
- **Medication**: id, name, strength, drugClass, isControlled, schedule?
- **Prescription**: id, patientId, medicationId, prescriberId, pharmacyId, sig, quantity, daysSupply, refillsRemaining, writtenAt, expiresAt, lastFillAt
- **LabResult**: id, patientId, testCode (`A1C | BMP | LIPID | TSH`), value, unit, resultedAt
- **Pharmacy**: id, name, ncpdpId (fake), status (`UP | DOWN`)
- **RefillRequest**: id, patientId?, prescriptionId?, source (`ERX_RENEWAL | FAX | PORTAL | PHONE | PROACTIVE`), rawText?, documentUrl?, extracted (Json)?, extractionConfidence?, state, blockers (String[]), waitingOn (`PROVIDER | NURSE | PHARMACY | PATIENT | PAYER | SYSTEM | NONE`), protocolId?, protocolVersion?, aiSummary?, trackingToken (unique, random), createdAt, updatedAt, closedAt?
- **Protocol**: id, key, name, version, plainEnglish, rules (Json), status (`DRAFT | SIGNED | RETIRED`), createdById, signedById?, signedAt?. Unique on (key, version).
- **Decision**: id, refillRequestId, decidedById, action (`APPROVE | APPROVE_BRIDGE | DENY | REQUIRE_VISIT | REQUEST_LABS`), quantityDays?, note, createdAt
- **OutboundMessage**: id, refillRequestId, channel (`ERX | SMS | FAX`), target, payload (Json), status (`PENDING | SENT | CONFIRMED | FAILED | ESCALATED`), attempts, lastError?, nextRetryAt?
- **Event**: id, refillRequestId?, actorType (`USER | SYSTEM | AI`), actorId?, type, fromState?, toState?, reason (plain language), ruleRef?, metadata (Json), createdAt. **Append-only: never update or delete.**

---

## 6. Refill state machine

**States:**
`RECEIVED → NEEDS_MATCH | WAITING_INFO | WAITING_PRIOR_AUTH | READY_FOR_COSIGN | READY_FOR_PROVIDER`
`READY_FOR_COSIGN | READY_FOR_PROVIDER → APPROVED | DENIED | WAITING_VISIT | WAITING_LABS`
`APPROVED → SENT_TO_PHARMACY → PHARMACY_CONFIRMED → FILLED → CLOSED`
`SENT_TO_PHARMACY → SEND_FAILED → SENT_TO_PHARMACY` (retry) or escalated
`DENIED → CLOSED` (after patient notified)

**Blocker codes:** `NO_REFILLS_REMAINING`, `RX_EXPIRED`, `VISIT_OVERDUE`, `LABS_OVERDUE`, `INFO_MISSING`, `PRIOR_AUTH_REQUIRED`, `CONTROLLED_SUBSTANCE`, `DOSE_CHANGE_REQUESTED`, `PATIENT_UNMATCHED`

**Triage routing (deterministic):**
1. `PATIENT_UNMATCHED` → `NEEDS_MATCH`; `INFO_MISSING` → `WAITING_INFO`
2. `CONTROLLED_SUBSTANCE` or `DOSE_CHANGE_REQUESTED` → `READY_FOR_PROVIDER` (always; hard-coded)
3. `PRIOR_AUTH_REQUIRED` → `WAITING_PRIOR_AUTH`
4. Signed protocol eligible → `READY_FOR_COSIGN` (nurse)
5. Otherwise → `READY_FOR_PROVIDER`. The packet lists which protocol rules failed. The provider can approve a bridge supply and require a visit or labs in one action.

**Implementation rule:** all state changes go through one function in `lib/refill/stateMachine.ts`:
`transition(refillId, toState, { actor, reason, ruleRef?, metadata? })`.
It validates the transition, updates the row and writes an Event **in one DB transaction**. No other code may write `state` directly.

---

## 7. Days of supply and gap days

- `daysLeft = daysSupply − daysBetween(lastFillAt, today)`
- If `daysLeft < 0`, the patient is out: `gapDays = −daysLeft` until the refill is FILLED.
- Queue priority: lowest `daysLeft` first. Controlled or critical drug classes break ties.
- **Prevention:** prescriptions with (refillsRemaining = 0, or visit or labs overdue) **and** daysLeft ≤ 10 **and** no open refill request are "at risk". Show them in a banner; one click creates a `PROACTIVE` refill request.
- In production, fill data comes from a medication fill-history feed. Here it is seeded.

---

## 8. Protocol rules engine

Rules are stored as JSON and evaluated by a **pure function** (`lib/rules/evaluate.ts`), unit tested. No AI at evaluation time.

```json
{
  "appliesTo": { "drugClasses": ["ACE_INHIBITOR", "ARB", "CCB", "THIAZIDE"] },
  "conditions": [
    { "fact": "daysSinceLastVisit", "op": "<=", "value": 365, "label": "Seen within 12 months" },
    { "fact": "daysSinceLab:BMP", "op": "<=", "value": 365, "label": "BMP within 12 months" },
    { "fact": "doseChangeRequested", "op": "==", "value": false, "label": "No dose change requested" }
  ],
  "maxDaysSupply": 90
}
```

- Facts are computed from the DB in `lib/rules/facts.ts`.
- `evaluate()` returns `{ eligible, results: [{ label, passed, actual, expected }] }`. The UI shows each check as pass or fail with the actual value.
- Every decision records `protocolId` + `protocolVersion`, displayed as e.g. "per Hypertension Protocol v2, signed by Dr. Rao on 12 Sep".

---

## 9. Where AI is used and where it isn't

| AI (via `lib/ai/client.ts`) | Deterministic code | Humans only |
|---|---|---|
| Extract fields from fax / free text into JSON with per-field confidence | Protocol evaluation | Approve / deny / change dose |
| Match extracted patient to a record (suggest; low confidence → human confirms) | State transitions and routing | Sign protocols |
| Draft structured protocol rules from plain English (never active until signed) | Controlled-substance check | Confirm low-confidence extraction |
| 2–3 line case summary: why it's stuck and the suggested next step (non-clinical), labelled AI-generated | Days-left / gap-day math, retries, escalation | |
| Plain-language patient status messages (template first, AI optional) | | |

Log every AI call as an Event (actorType `AI`) with provider, input summary, output and confidence. Never log full prompts containing patient details to the console.

---

## 10. Integrations (mocked behind adapters)

- `lib/adapters/ehr.ts`, `lib/adapters/pharmacy.ts`, `lib/adapters/sms.ts`. Each exports an interface and a mock implementation.
- Pharmacy mock **throws** when that pharmacy's `status = DOWN` (toggle on the Ops screen).
- OutboundMessage lifecycle: `PENDING → SENT → CONFIRMED`. On failure: `FAILED`, `attempts++`, `nextRetryAt` with exponential backoff.
- Retry worker: `/api/jobs/retry`, callable from a button on the Ops screen (optionally a Vercel cron). After 3 failures → `ESCALATED` + Event + Ops alert.
- A refill only reaches `FILLED` after the pharmacy adapter confirms it (verification, not assumption).

**Production story (for the pitch, not to build):** FHIR R4 APIs for EHR data (Patient, MedicationRequest, Observation, Encounter); NCPDP SCRIPT renewal messages through the e-prescribing network; a medication fill-history feed for days of supply; a HIPAA-eligible AI provider under a BAA (the demo uses Groq's free tier on synthetic data only); SSO + MFA.

---

## 11. Roles and access (enforced server-side)

| Role | Can see | Can do |
|---|---|---|
| PROVIDER | Everything clinical | Approve / deny any request, sign protocols |
| NURSE | Full decision packet | Co-sign `READY_FOR_COSIGN`, confirm extraction, request info. **Cannot** approve controlled or out-of-protocol requests |
| FRONT_DESK | Name, status, waiting-on, due date (no labs or clinical notes) | Schedule visits, contact patient |
| ADMIN (ops) | Ops screen, metrics, event log metadata (no clinical packet) | Toggle pharmacy status, run retry worker, reset demo |

Authentication is a **role switcher** in the header (sets a cookie); every server route reads it and checks permissions. Note in the UI that production would use SSO + MFA.

---

## 12. Screens (keep to these)

1. **`/queue`**: refill queue sorted by days left, with an "at risk this week" prevention banner, filters by state / blocker / waiting-on, and an "Upload fax" button.
2. **`/refills/[id]`**: decision packet (patient, med, blockers, protocol checks, labs, last visit, AI summary), one-click actions for the current role, and an event timeline.
3. **`/protocols`** and **`/protocols/[key]`**: plain English → AI-drafted rules → review → sign. Version history with a diff between versions.
4. **`/ops`**: counts by state and blocker, median time-to-resolution, total gap days, failed / retrying / escalated messages, pharmacy up/down toggles, run-retry button, reset demo.
5. **`/track/[token]`**: public patient page with first name, a friendly status, what happens next and a rough ETA. Mobile-first.

---

## 13. UI direction

- Calm, clinical, trustworthy: light theme, generous whitespace, one accent color, clear hierarchy.
- Urgency badge by days left: ≤ 0 red "Out of meds, N gap days"; 1–3 red; 4–7 amber; 8+ neutral.
- Every refill always shows four things: **current state, what it's waiting on, who owns the next step, when it's due.**
- Timeline: vertical event list with an actor icon (person / system / AI), plain-language reason and rule reference.
- Loading, empty and error states on every screen. Keyboard-friendly queue.
- Only the patient tracking page needs to be excellent on mobile.

---

## 14. Seed data (`npm run db:seed`, idempotent: reset + seed)

- Users: 3 providers, 2 nurses, 1 front desk, 1 admin
- 30 patients; 3 pharmacies (one gets toggled down in the demo)
- Meds: lisinopril, amlodipine, losartan (hypertension); metformin (diabetes); atorvastatin (statin); levothyroxine (thyroid); sertraline (antidepressant); methylphenidate (controlled)
- Labs: A1C, BMP, lipid panel, TSH with varied dates (some overdue)
- 4 signed protocols: Hypertension, Diabetes (metformin), Statin, Thyroid. Plus 1 draft.
- About 40 refill requests spread across all states and blocker codes, with varied days left (some already out of meds)
- All seeded dates are relative to "today" so days-left numbers look right whenever the demo runs.
- 3 sample faxes in `public/samples/`: one clean, one messy, one missing info
- "Reset demo data" button on `/ops` (ADMIN only)

---

## 15. Demo script (build toward this)

1. Queue sorted by days left. The banner says "3 patients will run out this week" (prevention).
2. Upload the messy fax → AI extracts fields with confidence → nurse confirms one low-confidence field → matched to patient.
3. Triage: `NO_REFILLS_REMAINING` + `LABS_OVERDUE` (A1C). Protocol checks show exactly which rules passed and failed.
4. Provider approves a 30-day bridge + lab order in one click. The timeline shows each step and why.
5. Rx sent → pharmacy confirms → patient tracking page updates.
6. A controlled-substance request: the system refuses the fast path and explains why.
7. Protocols: the provider writes a rule in English → AI drafts structured rules → the provider reviews and signs v2.
8. Ops: toggle a pharmacy down → send fails → retry queue → pharmacy back up → retry succeeds. The timeline shows it all.

---

## 16. Build order

1. **Foundation:** Prisma schema, seed script, state machine + events, rules engine + facts. Unit tests for the rules engine and transitions.
2. **Server layer:** server actions / API routes with role checks.
3. **Core UI:** queue, refill detail, decision actions, timeline.
4. **Protocols:** screen, signing, versioning, diff.
5. **AI:** provider adapter (Anthropic / Groq / demo mode), fax extraction, rule drafting, case summary.
6. **Reliability:** adapters, outbound messages, retry worker, Ops screen, outage toggle.
7. **Finish:** patient tracking page, prevention banner, polish, deploy to Vercel.

After each phase: typecheck, lint, run tests, commit. **Keep the app deployable at all times.** If time runs short, cut from the bottom of the demo script, never the guardrails in section 3.

---

## 17. Out of scope

Real EHR / pharmacy integrations, real authentication, billing, native mobile app, real SMS or fax sending.
