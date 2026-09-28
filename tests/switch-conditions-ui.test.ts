import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { normalizeAnalyzeResponse } from "../components/market-types";
import { SwitchConditions } from "../components/SwitchConditions";

describe("switch-condition UI contract", () => {
  it("normalizes and renders both confirmation persistence and consequence", () => {
    const result = normalizeAnalyzeResponse({
      status: "ok",
      dataHealth: "healthy",
      request: { window: 20, intent: "market_state" },
      plan: { object: "沪深300", window: 20, intent: "market_state" },
      snapshot: { mode: "snapshot", sources: [], issues: [] },
      state: { label: "区间或证据冲突" },
      confidence: { score: 68, coverage: 0.5, freshness: 1, consistency: 0.7, safetyMargin: 0.5 },
      metrics: [{
        id: "M_TREND_SCORE",
        name: "趋势分",
        value: 0.3,
        unit: "分",
        window: "20个交易日",
        formula: "fixture",
        status: "ok",
        sourceIds: [],
      }],
      evidence: [],
      switchConditions: [{
        id: "S1",
        metricId: "M_TREND_SCORE",
        direction: "below",
        currentValue: 0.3,
        threshold: 0.25,
        unit: "分",
        persistence: "连续3个交易日满足",
        reason: "趋势条件不再成立。",
        consequence: "重新评估核心市场状态。",
      }],
    });

    const condition = result.analysis?.switchConditions[0];
    expect(condition?.persistence).toBe("连续3个交易日满足");
    expect(condition?.consequence).toBe("重新评估核心市场状态。");

    const html = renderToStaticMarkup(createElement(SwitchConditions, {
      conditions: condition ? [condition] : [],
    }));
    expect(html).toContain("确认规则");
    expect(html).toContain("连续3个交易日满足");
    expect(html).toContain("触发后");
    expect(html).toContain("重新评估核心市场状态。");
  });
});
