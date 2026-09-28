import { describe, expect, it } from "vitest";

import { calculateConfidence } from "../lib/analysis/confidence";
import { calculateMetrics } from "../lib/analysis/metrics";
import { FIXED_NOW, snapshot } from "./helpers";

describe("confidence is deterministic and capped", () => {
  it("exposes all four components and never describes a forecast probability", () => {
    const fixture = snapshot();
    const calculated = calculateMetrics(fixture, FIXED_NOW);
    const confidence = calculateConfidence({
      snapshot: fixture,
      metrics: calculated.metrics,
      trendScore: calculated.trendScore,
      breadthScore: calculated.breadthScore,
      now: FIXED_NOW,
    });
    expect(confidence.score).toBeGreaterThanOrEqual(0);
    expect(confidence.score).toBeLessThanOrEqual(100);
    expect(confidence.coverage).toBe(0.5714);
    expect(confidence.cappedBy).toContain("市场宽度使用全A代理而非沪深300成分股口径，上限84分");
    expect(confidence.explanation).toContain("不是未来上涨概率");
  });

  it("caps data older than three business days at 49", () => {
    const fixture = snapshot({ marketDate: "2026-09-18" });
    const calculated = calculateMetrics(fixture, FIXED_NOW);
    const confidence = calculateConfidence({
      snapshot: fixture,
      metrics: calculated.metrics,
      trendScore: calculated.trendScore,
      breadthScore: calculated.breadthScore,
      now: FIXED_NOW,
    });
    expect(confidence.score).toBeLessThanOrEqual(49);
    expect(confidence.cappedBy.join(" ")).toContain("超过3个工作日");
  });

  it("caps demo mode at 35", () => {
    const fixture = snapshot({ mode: "demo" });
    const calculated = calculateMetrics(fixture, FIXED_NOW);
    const confidence = calculateConfidence({
      snapshot: fixture,
      metrics: calculated.metrics,
      trendScore: calculated.trendScore,
      breadthScore: calculated.breadthScore,
      now: FIXED_NOW,
    });
    expect(confidence.score).toBeLessThanOrEqual(35);
  });

  it("explicitly caps an intraday historical snapshot at 74", () => {
    const base = snapshot({ mode: "snapshot" });
    const fixture = {
      ...base,
      fetchedAt: "2026-09-28T03:24:04.494Z",
      sources: base.sources.map((item) => ({
        ...item,
        fetchedAt: "2026-09-28T03:24:04.494Z",
      })),
    };
    const calculated = calculateMetrics(fixture, FIXED_NOW);
    const confidence = calculateConfidence({
      snapshot: fixture,
      metrics: calculated.metrics,
      trendScore: calculated.trendScore,
      breadthScore: calculated.breadthScore,
      now: FIXED_NOW,
    });

    expect(confidence.score).toBeLessThanOrEqual(74);
    expect(confidence.cappedBy).toContain(
      "历史快照由盘中未收盘截面生成，收盘数据尚未定型，上限74分",
    );
  });

  it("caps missing core evidence and stays finite", () => {
    const fixture = snapshot({ includeBreadth: false });
    const calculated = calculateMetrics(fixture, FIXED_NOW);
    const confidence = calculateConfidence({
      snapshot: fixture,
      metrics: calculated.metrics,
      trendScore: calculated.trendScore,
      breadthScore: calculated.breadthScore,
      now: FIXED_NOW,
    });
    expect(confidence.score).toBeLessThanOrEqual(49);
    expect(Number.isFinite(confidence.score)).toBe(true);
  });
});
