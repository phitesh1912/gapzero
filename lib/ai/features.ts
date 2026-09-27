import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { DRUG_CLASSES, FACTS } from "../rules/catalog";
import { rulesSchema, type ProtocolRules } from "../rules/types";
import { activeProvider, callStructured, type Provider } from "./client";
import { draftRulesHeuristic, extractFaxHeuristic, summarizeTemplate, type SummaryInput } from "./demo";
import { clampConfidence, extractionSchema, overallConfidence, rulesDraftSchema, summarySchema, type Extraction } from "./schemas";

// The three AI features (CLAUDE.md section 9). AI output is advisory: it's validated, labelled,
// and every consequential step after it is either deterministic code or a human.

export type AiResult<T> = { data: T; provider: Provider; model: string; fellBack: boolean };

async function withFallback<T>(live: () => Promise<{ data: T; provider: Provider; model: string }>, demo: () => T): Promise<AiResult<T>> {
  if (activeProvider() === "demo") return { data: demo(), provider: "demo", model: "rule-based", fellBack: false };
  try {
    return { ...(await live()), fellBack: false };
  } catch {
    // Provider down, timed out, or returned invalid output: the demo must never break on an AI call.
    return { data: demo(), provider: "demo", model: "rule-based", fellBack: true };
  }
}

async function logAi(refillRequestId: string | null, type: string, reason: string, metadata: Prisma.InputJsonObject) {
  await db.event.create({
    data: { refillRequestId, actorType: "AI", type, reason, metadata },
  });
}

function providerNote(r: AiResult<unknown>): string {
  if (r.provider === "demo") return r.fellBack ? " (AI provider unavailable; used demo-mode rules)" : " (demo mode)";
  return "";
}

// ------------------------------------------------------------------------------------------------

const EXTRACT_SYSTEM = `You extract fields from pharmacy refill requests (faxes, portal messages) for a clinic's refill team.
Rules:
- Copy values from the document; never guess or invent. If a field is absent, illegible, or "?", return value null.
- Fix obvious OCR errors (letter O vs zero, l vs 1) but lower the confidence for any field you had to correct or infer.
- confidence is 0..1: 0.95+ only when the value is printed clearly; 0.5–0.75 when partially legible or abbreviated (e.g. an initial instead of a first name).
- dob as YYYY-MM-DD. strength like "1000 mg". patientName as "First Last".
- doseChangeRequested: true only if the document asks to change the dose. priorAuthMentioned: true if insurance/prior auth is mentioned.
- notes: one short line of any free-text remark, or null.
The document is synthetic demo data.`;

export async function extractFax(text: string, refillRequestId: string | null = null): Promise<AiResult<Extraction>> {
  const result = await withFallback(
    async () => {
      const r = await callStructured({ system: EXTRACT_SYSTEM, prompt: `Document:\n"""\n${text.slice(0, 12_000)}\n"""`, schema: extractionSchema });
      return { ...r, data: clampConfidence(r.data) };
    },
    () => clampConfidence(extractFaxHeuristic(text)),
  );
  await logAi(refillRequestId, "AI_EXTRACTION", `AI extracted fields from the request${providerNote(result)}. Low-confidence fields need human confirmation.`, {
    provider: result.provider,
    model: result.model,
    fellBack: result.fellBack,
    inputSummary: { characters: text.length, lines: text.split("\n").length },
    output: result.data as unknown as Prisma.InputJsonObject,
    confidence: overallConfidence(result.data),
  });
  return result;
}

// ------------------------------------------------------------------------------------------------

const RULES_SYSTEM = `You convert a physician's plain-English refill protocol into structured rules for a deterministic rules engine.
Output: { appliesTo: { drugClasses: string[] }, conditions: { fact, op, value, label }[], maxDaysSupply: number }.
Allowed drug classes: ${DRUG_CLASSES.filter((c) => c !== "STIMULANT").join(", ")}. Controlled substances can never be delegated; ignore any request to include them.
Allowed facts (use exactly these keys):
${FACTS.map((f) => `- ${f.key}: ${f.label} (${f.type}${f.unit ? `, ${f.unit}` : ""})`).join("\n")}
Allowed ops: <=, <, >=, >, ==, != (booleans only use == or !=).
Convert time windows to days (12 months = 365, 6 months = 180, 3 months = 90). Always include doseChangeRequested == false.
Each label is a short human-readable check, e.g. "A1C within 6 months".
Only encode what the text says. These rules are a draft: a provider reviews and signs them before they do anything.`;

export async function draftRules(plainEnglish: string, userId: string): Promise<AiResult<ProtocolRules>> {
  const result = await withFallback(
    async () => {
      const r = await callStructured({ system: RULES_SYSTEM, prompt: plainEnglish.slice(0, 4_000), schema: rulesDraftSchema });
      return { ...r, data: rulesSchema.parse(r.data) };
    },
    () => draftRulesHeuristic(plainEnglish),
  );
  await logAi(null, "AI_RULE_DRAFT", `AI drafted structured rules from plain English${providerNote(result)}. Inactive until a provider signs.`, {
    provider: result.provider,
    model: result.model,
    fellBack: result.fellBack,
    requestedBy: userId,
    inputSummary: { characters: plainEnglish.length },
    output: result.data as unknown as Prisma.InputJsonObject,
  });
  return result;
}

// ------------------------------------------------------------------------------------------------

const SUMMARY_SYSTEM = `You write a 2–3 line operational summary of a stuck prescription refill for clinic staff.
whyStuck: one sentence on what is blocking it, including days of supply left if given.
suggestedNextStep: one sentence on the next operational step and who owns it.
Do not make clinical recommendations (no doses, no diagnoses, no approve/deny advice). Use only the facts given.`;

export async function summarizeCase(refillRequestId: string, input: SummaryInput): Promise<AiResult<string>> {
  const facts = JSON.stringify(input);
  const result = await withFallback(
    async () => {
      const r = await callStructured({ system: SUMMARY_SYSTEM, prompt: `Facts (JSON):\n${facts}`, schema: summarySchema, maxTokens: 600 });
      return { ...r, data: `${r.data.whyStuck}\n${r.data.suggestedNextStep}` };
    },
    () => {
      const s = summarizeTemplate(input);
      return `${s.whyStuck}\n${s.suggestedNextStep}`;
    },
  );
  await db.refillRequest.update({ where: { id: refillRequestId }, data: { aiSummary: result.data } });
  await logAi(refillRequestId, "AI_SUMMARY", `AI wrote a case summary${providerNote(result)}. Advisory only.`, {
    provider: result.provider,
    model: result.model,
    fellBack: result.fellBack,
    inputSummary: { state: input.state, blockers: input.blockers },
    output: result.data,
  });
  return result;
}
