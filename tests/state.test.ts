import { describe, expect, it } from "vitest";

import { classifyMarketState } from "../lib/analysis/state";

describe("transparent market-state matrix", () => {
  it.each([
    [0.25, 0.15, "synchronized_improvement"],
    [0.25, -0.15, "index_strength_divergence"],
    [-0.25, 0.15, "breadth_repair_unconfirmed"],
    [-0.25, -0.15, "synchronized_pressure"],
    [0.24, 0.14, "range_or_conflict"],
    [0.9, 0, "range_or_conflict"],
  ] as const)("maps T=%s and B=%s to %s", (trend, breadth, expected) => {
    expect(classifyMarketState(trend, breadth).code).toBe(expected);
  });

  it("refuses a complete state when either core coordinate is absent", () => {
    expect(classifyMarketState(null, 0.8).code).toBe("insufficient_evidence");
    expect(classifyMarketState(0.8, null).code).toBe("insufficient_evidence");
  });
});
