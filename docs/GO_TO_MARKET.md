# GapZero: Go-to-Market Plan

As of Sep 27, 2026 · Live product: [gapzero-rose.vercel.app](https://gapzero-rose.vercel.app) (synthetic data)

We sell to independent primary and chronic-care physician groups of 10–100 providers, where refill staff chase stuck refills by phone and fax every day. We win them with a free 30-day pilot that shows, on day one, which of their patients are about to run out, then convert at $129 per provider per month on measured staff time saved and gap days prevented. Expansion comes from adding providers, sites and whole networks (MSOs, IPAs, ACOs).

## Who we sell to first

Our beachhead is independent physician groups of 10–100 providers in primary care, internal medicine and chronic care (cardiology, endocrinology). They carry the most refill volume, have no dedicated refill team, and decide in weeks, not quarters.

**Ideal customer profile**

- 10–100 providers, 1–8 sites, on a mainstream ambulatory EHR
- A large chronic-medication panel: blood pressure, diabetes, statins, thyroid
- At least one value-based contract (Medicare Advantage risk, ACO): adherence affects their revenue
- Pain signals: hiring refill nurses or medical assistants, patient reviews that mention refills, a practice administrator who owns phone and fax volume

**Why this segment wins**

- **The pain is daily and visible.** Refill work lands on nurses and MAs as faxes, portal messages and callbacks, and the administrator sees the overtime.
- **Value-based money is on the line.** The drug classes our starter protocols cover (diabetes, blood-pressure RAS antagonists, statins) are the same three that Medicare Part D adherence measures rate plans on, so a gap in medication shows up in quality scores and shared savings.
- **Short path to yes.** One administrator and one medical director can say yes to a 30-day pilot.

**Why not start elsewhere**

| Segment | Why not first | When we go there |
| --- | --- | --- |
| Health systems | 12–18 month cycles, heavy security review, EHR-native tooling already in place | Year 2, with case studies and SOC 2 |
| Pharmacies | They send refill requests; the stuck step is the provider's approval, which they don't control | As a channel: they refer the practices they fax most |
| MSOs, IPAs, ACOs | Great for scale, but they buy on proof from member practices | Year 1 expansion: one network deal after 2–3 member wins |
| Patients | The brief is B2B; patients get a free status link as part of the product | Never as payers |

## Customer map

The administrator buys, the refill nurse decides whether it sticks, and the medical director has to trust it. We sell to all three at once.

| Role | Who | What they care about | How GapZero wins them |
| --- | --- | --- | --- |
| Feels the pain | Patients | "I still don't have my medication" | A status link: first name, where the refill is, what happens next |
| Primary user | Refill nurse or medical assistant | Hours lost to fax, phone and chart digging | Context pre-gathered; in-protocol renewals co-signed in one click |
| Clinical decider | Provider | Inbox overload, liability | Only out-of-protocol and controlled requests reach them, with a bridge + labs action |
| Economic buyer | Practice administrator or COO | Staff cost, phone volume, patient complaints, quality scores | Staff hours saved and gap days prevented, on the Ops screen weekly |
| Champion | Nurse manager or clinical ops lead | A queue the team can actually clear | "Needs me" view, time-stuck flags, escalation rules |
| Must approve | Medical director | Clinical control | Protocols stay in their hands: drafted from their own words, inactive until they sign, versioned |
| Can block | IT, compliance, EHR admin | HIPAA, integration risk | BAA, role checks on the server, audit log, fax and e-Rx channels that need no EHR write access |
| Influencer and channel | Pharmacies, MSOs, IPAs, ACOs | Fewer callbacks; network-wide adherence | Faster answers to their requests; one dashboard across member practices |

## Positioning

**For practice administrators at primary and chronic-care groups whose staff lose hours chasing refills, GapZero is the refill command center that finds why each refill is stuck, routes it by the practice's own signed protocols, and verifies it until the patient has the medication. Unlike an EHR refill inbox or a fax queue, it shows every refill's state, owner and next step, and it catches refills before they get stuck.**

Tagline: *Patients never run out of medication because of paperwork.*

| Alternative | What it does well | Where it falls short | GapZero's edge |
| --- | --- | --- | --- |
| Status quo: EHR inbox + fax + phone | Already paid for | No single view; refills bounce; nobody knows who owns the next step | One queue across channels, with owner and time-stuck on every refill |
| EHR-native refill protocols (where available) | Inside the chart | Usually covers e-Rx renewals only, not faxes or calls; no prevention; stops at "sent" | All channels, prevention 10 days ahead, verified until filled |
| Outsourced refill staff or virtual MAs | Takes work off the team | Cost grows with volume; same fragmented tools; clinical control moves outside the practice | Software cost, not headcount; protocols and decisions stay with the practice |
| Pharmacy-side automation | Faster requests out | Can't approve anything; the bottleneck is on the clinic side | Works on the clinic's approval step, where refills stall |

What we never claim: GapZero does not make clinical decisions. Protocols decide who reviews a refill; a licensed human decides the outcome.

## The funnel

Every stage has one job: earn the next step with evidence from the practice's own data. Marketing owns stages 1–4, founder-led sales owns 5–7, customer success owns 8. The year-one targets are planning assumptions to test, not results.

| Stage | What we do | Signals to move forward | What the customer experiences | Year-one target |
| --- | --- | --- | --- | --- |
| 1. Nothing | Define the ICP; build a list of groups from public directories, CMS ACO participant lists and EHR partner marketplaces; set up tracking | Account matches size, specialty and EHR | Nothing yet | 2,000 ICP accounts listed |
| 2. Prospect | Enrich each account: provider count, EHR, value-based contracts, open refill-nurse or MA roles, reviews mentioning refills | Fit plus at least two pain signals | Sees a relevant post or note about refill gaps | 800 enriched |
| 3. Data analysis | Score accounts on fit, pain and value-based exposure; pick the top tier for outreach | Score above threshold; a named administrator and nurse manager found | Outreach that names their specialty and their refill channels | 300 top-tier accounts |
| 4. TOFU: awareness | Free Gap Days Calculator (providers + refill volume → estimated gap days and staff hours); "The 7 hand-offs" explainer; webinars with state practice-management chapters; pharmacy co-marketing | Calculator completed; webinar attended; replies to outreach | "This is exactly our fax pile" | 150 engaged |
| 5. MOFU: consideration | Discovery call; a free Refill Audit of two weeks of their de-identified refill volume by channel and blocker; demo using their own written refill policy, drafted into rules by AI | They share volume counts; nurse manager and medical director join the second call; they send the policy document | Sees their own blocker mix and estimated gap days | 60 audits |
| 6. BOFU: decision | Security packet (BAA, access model, audit log, AI data handling); ROI case built from the audit; pilot plan with agreed success criteria | Security review started; success criteria signed off by administrator and medical director | Confident it's safe, and knows what success looks like | 25 pilots |
| 7. Close | 30-day pilot, then annual order form; onboarding plan with dates | Pilot hits its criteria (see Metrics); order form in legal | A simple go-live and clear next steps | 15 paying groups |
| 8. Customer success | Day-one go-live scan; weekly value report; quarterly review; expansion to more providers, sites and protocols; case study and referrals | Weekly active nurses; share of refills through GapZero; protocols added; NPS | Sees fewer gap days and calmer phones every week | 13 retained, 3 expanded to a network |

## Pricing and ROI

We charge per provider per month, the way practices already budget clinical software, so price grows with refill volume and expansion is a seat count, not a new negotiation.

| Plan | Price | For | Includes |
| --- | --- | --- | --- |
| Pilot | Free for 30 days | Up to 15 providers | Full product; success criteria agreed before start |
| Practice | $129 per provider per month, billed annually | Groups of 10–100 providers | Refill queue, signed protocols, AI fax intake, prevention, patient status links, Ops value reporting |
| Network | Custom, from $99 per provider per month at 250+ providers | MSOs, IPAs, ACOs | Everything in Practice, plus cross-practice views, adherence reporting, SSO, EHR integration, uptime SLA |

Onboarding is free for our first 10 design partners, then $2,500 one-time for EHR integration on Practice plans.

**Why $129 pays for itself (assumptions to confirm in each Refill Audit)**

- 60 refill requests per provider per month need clinic action *(assumption)*
- 12 minutes of staff time saved per request: no chart digging, no callback loop *(assumption; the same figure the Ops screen uses)*
- $35 per hour blended loaded cost for nurses and medical assistants *(assumption)*
- Result: 12 staff hours and about $420 saved per provider per month, against a $129 price, or about 3.3x on staff time alone

A 25-provider group pays $38,700 a year and saves about $126,000 in staff time on these assumptions. Not counted: fewer patient calls, adherence and quality bonuses in value-based contracts, and fewer urgent visits caused by gaps.

## Onboarding and time to value

The goal is value within 24 hours of go-live: the first patient caught before they run out. Nothing in the first week requires the practice to change its EHR or retrain providers.

1. **Day 0: sign.** Pilot agreement and BAA; success criteria written down (see Metrics).
2. **Day 1: connect the channels that need no EHR write access.** Forward the refill fax line, add the e-prescribing renewal feed, and load a read-only export of active chronic prescriptions, last fills, visits and labs.
3. **Day 1: go-live scan, the "aha" moment.** "12 patients are out of medication today, 9 will run out this week, and here's why each one will get stuck." Staff start the at-risk refills on day one.
4. **Day 2: protocols.** The medical director reviews our starter protocols (blood pressure, diabetes, statin, thyroid) or pastes the practice's written refill policy for AI to draft, then edits and signs. Nothing routes until signed.
5. **Day 3: team setup.** One hour with the refill nurses and front desk: roles, the "Needs me" view, confirming AI-read faxes.
6. **Weeks 1–4: run it.** A daily 10-minute huddle on the queue; a weekly value report to the administrator (gap days, staff hours saved, share handled by protocol).
7. **Day 30: pilot review.** Results against the agreed criteria; convert to annual, and plan which protocols and sites come next.

The numbers in step 3 are illustrative; each practice's scan uses its own data.

## Growth engine

Growth compounds through five loops, each feeding the funnel stage it names, so wins turn into the next wins instead of staying one-offs.

- **Value loop (stage 8 → expansion).** More refills flow through GapZero → the weekly value report shows gap days and hours saved → the administrator adds providers, sites and protocols → more refills flow through.
- **Proof loop (stage 8 → stages 4–5).** Each pilot's audit and results become a de-identified case study and a benchmark (a "Refill Gap Index" by specialty) → sharper content and calculator → more audits.
- **Network loop (stage 8 → Network plan).** Two or three wins inside one MSO, IPA or ACO → a network deal with a cross-practice dashboard → rollout to member practices on a proven playbook.
- **Pharmacy referral loop (stage 4).** Pharmacies get answers in hours from GapZero practices → they recommend GapZero to the other practices they fax, using a co-marketing kit → warm inbound leads.
- **Product loop (all stages).** More refills → better data on which blockers stall which drug classes → better starter protocols and earlier prevention → faster time to value for the next customer.

## Metrics

The north star is gap days: days a patient goes without a chronic medication. Product metrics show why it moves; commercial metrics show the model works. Pilot criteria are agreed with each customer on day 0; the product already measures most of these on the Ops screen.

| Metric | Definition | Pilot success criterion | Year-one target |
| --- | --- | --- | --- |
| **Gap days per 1,000 patients (north star)** | Days any patient on a chronic medication is out of it, per month | 50% lower than the day-1 scan | 70% lower |
| Median time to resolution | Refill received to filled and verified | Half the baseline from the Refill Audit | Under 2 days |
| Protocol automation rate | Approvals co-signed by nurses under a signed protocol, of all approvals | 40% or more | 60% or more |
| Prevented share | Refills started proactively, before the patient asked, of all refills | 15% or more | 30% or more |
| Verified fill rate | Closed refills the pharmacy confirmed as filled | 95% or more | 98% or more |
| Staff hours saved | Refills resolved × minutes saved, measured during the pilot | Reported weekly | 10+ hours per provider per month |
| Weekly active refill staff | Nurses and MAs working the queue each week | 80% or more | 90% or more |
| Pilot to paid | Pilots that convert to an annual plan | — | 60% or more |
| Sales cycle | First call to signed order form | — | 60 days or less |
| CAC payback | Months of gross margin to recover acquisition cost | — | 9 months or less |
| Logo retention | Customers still paying after 12 months | — | 90% or more |
| Net revenue retention | Revenue from a year-ago cohort today, including expansion | — | 115% or more |

## Risks

The biggest risk is integration drag slowing time to value; we start on channels that need no EHR write access.

| Risk | How we de-risk it |
| --- | --- |
| EHR integration takes months | Start with the fax line, the e-prescribing renewal feed and a read-only export; deeper FHIR integration only after value is proven |
| Clinicians don't trust automated routing | Protocols are drafted from their own policy, inactive until signed and versioned; every decision is a human's and cites the rule behind the route |
| AI reads a fax wrong | Every field is cross-checked against a rule-based parser; low-confidence fields wait for a person; the model never decides anything |
| Security review stalls the deal | BAA, a HIPAA-eligible AI provider, SSO and MFA, server-side role checks, an append-only audit log, and a ready-made security packet at stage 6 |
| Staff don't change habits | Day-one scan gives an immediate win; one-click co-sign is faster than the current fax loop; the nurse manager champions the daily huddle |
| The ROI assumptions are wrong | The Refill Audit measures each practice's real volume and blockers before pricing; the pilot measures time saved instead of assuming it |
| An EHR vendor ships a similar feature | Stay cross-channel (fax, phone, portal, e-Rx), EHR-agnostic, and focused on prevention and verification to filled, which inbox tools don't do |

## First 90 days

In 90 days we aim for five design-partner pilots, at least three paying groups, and one network conversation, with case studies to feed the next quarter's funnel.

| Weeks | Goal | Done when |
| --- | --- | --- |
| 1–3 | Launch the Gap Days Calculator; recruit audit candidates through our network and one state practice-management chapter webinar | 10 Refill Audits booked |
| 3–6 | Run the audits; turn the best fits into design-partner pilots with free onboarding | 5 pilots signed, each with written success criteria |
| 6–10 | Pilots live; weekly value reports; refine the starter protocols from what we see | 4 of 5 pilots on track against their criteria |
| 10–13 | Convert to annual; publish two case studies; approach one MSO, IPA or ACO where a partner is a member; sign two pharmacy referral partners | 3 or more paying groups and 1 network in discussion |
