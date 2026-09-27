import { z } from "zod";

export const OPS = ["<=", "<", ">=", ">", "==", "!="] as const;
export type Op = (typeof OPS)[number];

export const conditionSchema = z.object({
  fact: z.string().min(1),
  op: z.enum(OPS),
  value: z.union([z.number(), z.boolean(), z.string()]),
  label: z.string().min(1),
});

export const rulesSchema = z.object({
  appliesTo: z.object({ drugClasses: z.array(z.string()).min(1) }),
  conditions: z.array(conditionSchema),
  maxDaysSupply: z.number().int().positive(),
});

export type Condition = z.infer<typeof conditionSchema>;
export type ProtocolRules = z.infer<typeof rulesSchema>;

export type FactValue = number | boolean | string | null;
export type Facts = Record<string, FactValue>;

export type CheckResult = {
  label: string;
  passed: boolean;
  actual: FactValue;
  expected: string;
  // Set for checks that come from code, not protocol data.
  hardCoded?: boolean;
};

export type Evaluation = { eligible: boolean; results: CheckResult[] };
