import { describe, expect, it } from "vitest";

import { checkCompliance, checkResearchScope } from "../lib/compliance";

describe("compliance intent guard", () => {
  it.each([
    ["明天沪深300肯定涨还是跌？", "prediction"],
    ["推荐一只值得买的股票", "recommendation"],
    ["这个策略能保证收益吗？", "return_promise"],
    ["我应该几成仓？", "position"],
    ["后天沪深300会涨吗？", "prediction"],
    ["预计年底到多少点？", "prediction"],
    ["现在沪深300能买吗？", "recommendation"],
    ["我应该全仓吗？", "position"],
    ["推荐茅台", "recommendation"],
    ["我该买宁德时代还是比亚迪？", "recommendation"],
  ])("blocks %s as %s and supplies a safe research rewrite", (question, category) => {
    const decision = checkCompliance(question);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.category).toBe(category);
      expect(decision.safeQuestion).toContain("状态");
    }
  });

  it("allows conditional market-state research", () => {
    expect(checkCompliance("当前沪深300的状态切换条件是什么？")).toEqual({
      allowed: true,
      category: "research",
    });
  });

  it("does not confuse recommendations for research methods with stock picks", () => {
    expect(checkCompliance("推荐一个市场状态研究框架")).toEqual({
      allowed: true,
      category: "research",
    });
  });
});

describe("research scope guard", () => {
  it("allows the supported market-state question", () => {
    expect(checkResearchScope("当前沪深300的市场状态和主要矛盾是什么？")).toEqual({ supported: true });
  });

  it("does not pretend to support an unimplemented stock valuation tool", () => {
    const result = checkResearchScope("请分析贵州茅台的估值和财报");
    expect(result.supported).toBe(false);
    if (!result.supported) expect(result.message).toContain("尚未接入");
  });
});
