import { describe, expect, it } from "vitest";
import { countBy, formatDuration, median } from "./stats";

describe("ops stats", () => {
  it("computes medians", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it("formats durations", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(30 * 60_000)).toBe("30m");
    expect(formatDuration(5 * 3_600_000)).toBe("5.0h");
    expect(formatDuration(72 * 3_600_000)).toBe("3.0d");
  });

  it("counts by single and multi-valued keys", () => {
    expect(countBy([{ s: "A" }, { s: "B" }, { s: "A" }], (x) => x.s)).toEqual({ A: 2, B: 1 });
    expect(countBy([{ b: ["X", "Y"] }, { b: ["X"] }], (x) => x.b)).toEqual({ X: 2, Y: 1 });
  });
});
