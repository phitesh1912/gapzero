import "server-only";
import type { Prisma, User } from "@prisma/client";
import { db } from "../db";
import { validateRules } from "../rules/catalog";
import { rulesSchema, type ProtocolRules } from "../rules/types";
import { logEvent, WorkflowError } from "../refill/workflow";

// Protocol lifecycle (CLAUDE.md sections 3 and 8): drafts are editable and never route anything;
// signing is provider-only; a signed version is immutable, and edits create a new version.

export function parseRules(raw: unknown): { rules: ProtocolRules | null; problems: string[] } {
  const parsed = rulesSchema.safeParse(raw);
  if (!parsed.success) return { rules: null, problems: parsed.error.issues.map((i) => `${i.path.join(".") || "rules"}: ${i.message}`) };
  const problems = validateRules(parsed.data).map((p) => `${p.path}: ${p.message}`);
  return { rules: parsed.data, problems };
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "protocol";
}

// Saves a draft. Updates the open draft for this key if there is one, otherwise starts the next version.
export async function saveDraft(user: User, input: { key?: string; name: string; plainEnglish: string; rules: unknown; draftedBy?: "AI" | "USER" }) {
  const { rules, problems } = parseRules(input.rules);
  if (!rules) throw new WorkflowError(`Rules are invalid: ${problems.join("; ")}`);

  const key = input.key ?? slugify(input.name);
  const versions = await db.protocol.findMany({ where: { key }, orderBy: { version: "desc" } });
  const openDraft = versions.find((v) => v.status === "DRAFT");

  const protocol = openDraft
    ? await db.protocol.update({
        where: { id: openDraft.id },
        data: { name: input.name, plainEnglish: input.plainEnglish, rules: rules as Prisma.InputJsonObject },
      })
    : await db.protocol.create({
        data: {
          key,
          name: input.name,
          version: (versions[0]?.version ?? 0) + 1,
          plainEnglish: input.plainEnglish,
          rules: rules as Prisma.InputJsonObject,
          status: "DRAFT",
          createdById: user.id,
        },
      });

  await logEvent(db, {
    actor: { type: "USER", id: user.id },
    type: "PROTOCOL_DRAFT_SAVED",
    reason: `${user.name} saved a draft of ${protocol.name} v${protocol.version}${input.draftedBy === "AI" ? " (rules drafted by AI, pending review)" : ""}.`,
    ruleRef: `protocol:${protocol.id}@v${protocol.version}`,
    metadata: { problems },
  });
  return { protocol, problems };
}

export async function signProtocol(user: User, protocolId: string) {
  if (user.role !== "PROVIDER") throw new WorkflowError("Only a provider can sign a protocol.");
  const protocol = await db.protocol.findUniqueOrThrow({ where: { id: protocolId } });
  if (protocol.status !== "DRAFT") throw new WorkflowError("Only drafts can be signed. Signed versions are immutable.");

  const { rules, problems } = parseRules(protocol.rules);
  if (!rules || problems.length) throw new WorkflowError(`Fix these before signing: ${problems.join("; ")}`);

  await db.$transaction(async (tx) => {
    // Conditional update: two providers can't sign the same draft twice.
    const { count } = await tx.protocol.updateMany({
      where: { id: protocolId, status: "DRAFT" },
      data: { status: "SIGNED", signedById: user.id, signedAt: new Date() },
    });
    if (count !== 1) throw new WorkflowError("This draft was just changed. Refresh and try again.");
    await tx.protocol.updateMany({
      where: { key: protocol.key, status: "SIGNED", id: { not: protocolId } },
      data: { status: "RETIRED" },
    });
    await logEvent(tx, {
      actor: { type: "USER", id: user.id },
      type: "PROTOCOL_SIGNED",
      reason: `${user.name} signed ${protocol.name} v${protocol.version}. It now routes new requests; earlier versions are retired.`,
      ruleRef: `protocol:${protocol.id}@v${protocol.version}`,
    });
  });
}

export async function discardDraft(user: User, protocolId: string) {
  const protocol = await db.protocol.findUniqueOrThrow({ where: { id: protocolId } });
  if (protocol.status !== "DRAFT") throw new WorkflowError("Only drafts can be discarded.");
  await db.protocol.delete({ where: { id: protocolId } });
  await logEvent(db, {
    actor: { type: "USER", id: user.id },
    type: "PROTOCOL_DRAFT_DISCARDED",
    reason: `${user.name} discarded the draft of ${protocol.name} v${protocol.version}.`,
  });
}

export async function listProtocols() {
  const all = await db.protocol.findMany({ include: { signedBy: true, createdBy: true }, orderBy: [{ key: "asc" }, { version: "desc" }] });
  const byKey = new Map<string, typeof all>();
  for (const p of all) byKey.set(p.key, [...(byKey.get(p.key) ?? []), p]);
  return [...byKey.entries()].map(([key, versions]) => ({
    key,
    name: versions[0].name,
    current: versions.find((v) => v.status === "SIGNED") ?? null,
    draft: versions.find((v) => v.status === "DRAFT") ?? null,
    versions,
  }));
}

export async function getProtocolVersions(key: string) {
  return db.protocol.findMany({ where: { key }, include: { signedBy: true, createdBy: true }, orderBy: { version: "desc" } });
}
