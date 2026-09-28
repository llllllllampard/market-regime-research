import { describe, expect, it } from "vitest";

import { analyzeMarket, runAnalysis } from "../lib/analyze";
import { calculateMetrics } from "../lib/analysis/metrics";
import { classifyMarketState } from "../lib/analysis/state";
import { FIXED_NOW, FixtureProvider, snapshot } from "./helpers";

describe("missing and partial data", () => {
  it("never turns missing data into zero, NaN, or Infinity", () => {
    const fixture = snapshot({
      includeHS300: false,
      includeCSI1000: false,
      includeBreadth: false,
    });
    const calculated = calculateMetrics(fixture, FIXED_NOW);
    expect(calculated.metrics.every((metric) => metric.value === null || Number.isFinite(metric.value))).toBe(true);
    expect(calculated.metrics.every((metric) => metric.value !== 0)).toBe(true);
    expect(classifyMarketState(calculated.trendScore, calculated.breadthScore).code).toBe(
      "insufficient_evidence",
    );
  });

  it("returns explicit insufficient evidence when breadth fails but keeps available facts", async () => {
    const fixture = snapshot({ includeBreadth: false });
    const result = await analyzeMarket(
      { question: "当前市场状态是什么？", window: 20 },
      { provider: new FixtureProvider(fixture), now: FIXED_NOW, dataMode: "live" },
    );
    expect(result.state.code).toBe("insufficient_evidence");
    expect(result.dataHealth).toBe("failed");
    expect(result.metrics.find((metric) => metric.id === "M_TREND_SCORE")?.value).not.toBeNull();
    expect(result.metrics.find((metric) => metric.id === "M_BREADTH_SCORE")?.value).toBeNull();
    expect(result.snapshot.issues.length).toBeGreaterThan(0);
  });

  it("does not combine trend and breadth from different market dates", () => {
    const base = snapshot();
    const fixture = {
      ...base,
      breadth: base.breadth ? { ...base.breadth, marketDate: "2026-09-25" } : undefined,
    };
    const calculated = calculateMetrics(fixture, FIXED_NOW);
    expect(calculated.breadthScore).toBeNull();
    expect(calculated.metrics.find((metric) => metric.id === "M_BREADTH_SCORE")?.status).toBe("conflict");
    expect(classifyMarketState(calculated.trendScore, calculated.breadthScore).code).toBe("insufficient_evidence");
  });

  it("returns a structured compliance response before calling a provider", async () => {
    const outcome = await runAnalysis(
      { question: "明天必然涨到多少点？", window: 20 },
      { provider: new FixtureProvider(), now: FIXED_NOW },
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe("COMPLIANCE_BLOCKED");
  });
});
