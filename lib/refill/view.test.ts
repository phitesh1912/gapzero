import { describe, expect, it } from "vitest";
import { ownerFor, redactRow, type QueueRowFull } from "./view";

const row: QueueRowFull = {
  id: "r1",
  state: "READY_FOR_PROVIDER",
  source: "PORTAL",
  blockers: ["CONTROLLED_SUBSTANCE"],
  waitingOn: "PROVIDER",
  owner: "Dr. Asha Rao",
  createdAt: new Date(),
  patientName: "Marcus Johnson",
  medication: "Methylphenidate ER 20 mg tablet",
  isControlled: true,
  drugClass: "STIMULANT",
  daysLeft: 1,
  runOutDate: new Date(),
  urgency: { level: "red", label: "1 day left" },
  hasAiSummary: false,
  daysSupply: 30,
  stateSince: new Date(),
  stuckMs: 0,
  needsMe: false,
};

describe("redactRow", () => {
  it("shows everything to clinical roles", () => {
    expect(redactRow("NURSE", row)).toMatchObject({ medication: row.medication, blockers: row.blockers, redacted: false });
  });

  it("hides medication and clinical blockers from front desk and admin", () => {
    for (const role of ["FRONT_DESK", "ADMIN"] as const) {
      const r = redactRow(role, row);
      expect(r.medication).toBeNull();
      expect(r.blockers).toEqual([]);
      expect(r.isControlled).toBeNull();
      expect(r.redacted).toBe(true);
      // Still sees the four things every refill shows.
      expect(r).toMatchObject({ patientName: "Marcus Johnson", state: "READY_FOR_PROVIDER", owner: "Dr. Asha Rao" });
      expect(r.runOutDate).toBeInstanceOf(Date);
    }
  });
});

describe("ownerFor", () => {
  it("names the provider when waiting on one", () => {
    expect(ownerFor("PROVIDER", "Dr. Asha Rao")).toBe("Dr. Asha Rao");
    expect(ownerFor("NURSE", "Dr. Asha Rao")).toBe("Refill nurses");
  });
});
