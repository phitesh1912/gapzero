# GapZero

**Patients never run out of medication because of paperwork.**

A refill command center for physician groups. It takes in every stuck refill request (e-prescribing renewals, faxes, portal messages), finds out *why* it's stuck, checks it against the practice's doctor-signed protocols, and hands a nurse or provider a one-screen decision packet. It then handles and verifies the follow-up until the patient has their medication. It also flags refills that will get stuck about 10 days before the patient runs out.

Live demo: https://gapzero-rose.vercel.app (synthetic data only; use the role switcher at the top right).

## What makes it safe

- **Humans make every clinical decision.** Protocols only decide *who* reviews a request (nurse co-sign vs. provider), never the outcome.
- **Controlled substances always go to a provider.** This is enforced in server code and can't be overridden by protocol data.
- **AI is advisory.** Extracted fields carry per-field confidence, and low-confidence fields must be confirmed by a person before anything moves. Summaries are labelled "AI-generated".
- **Protocols are inactive until a provider signs them.** Signed versions are immutable; edits create a new version with a visible diff.
- **Everything is on the record.** Every state change and every user, system or AI action writes an append-only event.
- **Role checks run on the server** in every action and route.
- **The patient tracking page** shows first name, status and next step only.

## Stack

Next.js (App Router) · TypeScript · Tailwind · Prisma · Postgres (Supabase) · Vercel.
AI runs through a provider adapter: Claude (`ANTHROPIC_API_KEY`), then Groq (`GROQ_API_KEY`), then a deterministic demo mode, so the demo works with no keys.

## Run locally

```bash
cp .env.example .env   # add your Supabase DATABASE_URL and DIRECT_URL
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## Tests

```bash
npm test         # unit tests: rules engine, state machine, permissions, guardrails, demo data
npm run smoke    # runs the full demo script against the database, then resets it
```

## Where things live

| Path | What |
|---|---|
| `lib/rules/` | Pure protocol rules engine, fact computation, validation, version diff |
| `lib/refill/stateMachine.ts` | The only code allowed to change a refill's state (validates, updates, logs an event in one transaction) |
| `lib/refill/triage.ts` | Deterministic routing, including the controlled-substance guardrail |
| `lib/refill/workflow.ts` | Decisions, pharmacy delivery with retries and escalation, fill verification |
| `lib/auth/permissions.ts` | Role matrix and decision rules |
| `lib/ai/` | Provider adapter, schemas, demo-mode fallbacks |
| `lib/adapters/` | Mocked EHR, pharmacy and SMS integrations |
