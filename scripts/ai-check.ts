// Calls the configured AI provider directly (no DB writes) to check extraction, rule drafting and summaries.
// Run: node --conditions=react-server --env-file=.env --import tsx scripts/ai-check.ts
import { readFileSync } from "node:fs";
import { activeProvider, callStructured } from "../lib/ai/client";
import { EXTRACT_SYSTEM } from "../lib/ai/features";
import { calibrate } from "../lib/ai/calibrate";
import { extractFaxHeuristic } from "../lib/ai/demo";
import { clampConfidence, extractionSchema, lowConfidenceFields, missingRequired, rulesDraftSchema, summarySchema } from "../lib/ai/schemas";
import { rulesSchema } from "../lib/rules/types";
import { validateRules } from "../lib/rules/catalog";

async function main() {
  console.log("provider:", activeProvider());
  for (const f of ["fax-clean.txt", "fax-messy.txt", "fax-missing-info.txt"]) {
    const t0 = Date.now();
    const text = readFileSync(`public/samples/${f}`, "utf8");
    const r = await callStructured({ system: EXTRACT_SYSTEM, prompt: `Document:\n"""\n${text}\n"""`, schema: extractionSchema });
    const e = calibrate(clampConfidence(r.data), clampConfidence(extractFaxHeuristic(text)), text);
    console.log(`\n${f} (${Date.now() - t0}ms, ${r.model})`);
    console.log("  name:", e.patientName.value, e.patientName.confidence, "| dob:", e.dob.value, e.dob.confidence, "| med:", e.medication.value, e.strength.value);
    console.log("  low:", lowConfidenceFields(e).join(",") || "-", "| missing:", missingRequired(e).join(",") || "-", "| PA:", e.priorAuthMentioned);
  }
  const rules = await callStructured({ system: "Convert a refill protocol into rules. Facts: daysSinceLastVisit, daysSinceLab:A1C, daysSinceLab:BMP, daysSinceLab:LIPID, daysSinceLab:TSH, doseChangeRequested (boolean). Drug classes: ACE_INHIBITOR, ARB, CCB, THIAZIDE, BIGUANIDE, STATIN, THYROID, SSRI. Months to days: 12=365, 6=180, 3=90.", prompt: "Nurses may renew metformin for up to 90 days if seen in the last 12 months and A1C within 3 months.", schema: rulesDraftSchema });
  const parsed = rulesSchema.parse(rules.data);
  console.log("\nrules:", JSON.stringify(parsed), "\nproblems:", validateRules(parsed));
  const s = await callStructured({ system: "2-line operational summary of a stuck refill. No clinical advice.", prompt: JSON.stringify({ state: "READY_FOR_PROVIDER", blockers: ["NO_REFILLS_REMAINING", "LABS_OVERDUE"], failedChecks: ["A1C within 6 months"], daysLeft: 6 }), schema: summarySchema, maxTokens: 600 });
  console.log("\nsummary:", s.data);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
