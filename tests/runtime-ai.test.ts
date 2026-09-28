import { describe, expect, it } from "vitest";

import { synthesizeWithOptionalLlm } from "../lib/ai/runtime";
import type { DeterministicSynthesis } from "../lib/ai/synthesize";
import type { Evidence, MarketState, ResearchPlan } from "../lib/schema";

const fallback: DeterministicSynthesis = {
  headline: { text: "模板结论 [E1]", evidenceIds: ["E1"] },
  mainConflict: { text: "模板矛盾 [E1]", evidenceIds: ["E1"] },
  facts: [{ text: "模板事实 [E1]", evidenceIds: ["E1"] }],
  inferences: [{ text: "模板归纳 [E1]", evidenceIds: ["E1"] }],
  uncertainties: [],
  limitations: ["模板边界"],
};

const evidence: Evidence[] = [{
  id: "E1",
  category: "trend",
  kind: "fact",
  direction: "counter",
  claim: "趋势证据偏弱。",
  metricIds: ["M_TREND_SCORE"],
  asOf: "2026-09-28",
  quality: "ok",
}];

const plan: ResearchPlan = {
  intent: "market_state",
  object: "沪深300",
  window: 20,
  tools: ["index_kline"],
  metrics: ["趋势分"],
};

const state: MarketState = {
  code: "synchronized_pressure",
  label: "趋势与宽度同步承压",
  description: "当前核心证据偏弱。",
  trendScore: -0.8,
  breadthScore: -0.7,
};

function fakeFetch(content: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(content) } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
}

const validStructuredExplanation = {
  headline: { text: "核心证据显示当前结构偏弱", evidenceIds: ["E1"] },
  mainConflict: { text: "趋势修复仍缺少确认", evidenceIds: ["E1"] },
  inferences: [{ text: "当前状态应保持审慎解释", evidenceIds: ["E1"] }],
  uncertainties: [{ text: "仍需观察后续证据变化", evidenceIds: ["E1"] }],
};

describe("optional runtime LLM synthesis", () => {
  it("uses an explicitly labelled template fallback without configuration", async () => {
    const result = await synthesizeWithOptionalLlm({ plan, state, evidence, fallback, options: {} });
    expect(result.mode).toBe("template");
    expect(result.reason).toContain("未配置");
  });

  it("accepts a citation-only structured explanation", async () => {
    const result = await synthesizeWithOptionalLlm({
      plan,
      state,
      evidence,
      fallback,
      options: {
        apiKey: "test-only",
        baseUrl: "https://example.invalid/v1",
        model: "test-model",
        fetch: fakeFetch(validStructuredExplanation),
      },
    });
    expect(result.mode).toBe("llm");
    expect(result.synthesis.headline.text).toContain("[E1]");
  });

  it("disables thinking only for Bailian-compatible endpoints", async () => {
    const requestBodies: Array<Record<string, unknown>> = [];
    const recordingFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(validStructuredExplanation) } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    for (const baseUrl of [
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "https://workspace-id.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
      "https://example.oss-cn-beijing.aliyuncs.com/v1",
      "https://example.invalid/v1",
    ]) {
      const result = await synthesizeWithOptionalLlm({
        plan,
        state,
        evidence,
        fallback,
        options: { apiKey: "test-only", baseUrl, model: "test-model", fetch: recordingFetch },
      });
      expect(result.mode).toBe("llm");
    }

    expect(requestBodies[0].enable_thinking).toBe(false);
    expect(requestBodies[1].enable_thinking).toBe(false);
    expect(requestBodies[2]).not.toHaveProperty("enable_thinking");
    expect(requestBodies[3]).not.toHaveProperty("enable_thinking");
  });

  it("restores canonical index tokens but rejects all model-authored numbers and unknown tokens", async () => {
    const accepted = await synthesizeWithOptionalLlm({
      plan,
      state,
      evidence,
      fallback,
      options: {
        apiKey: "test-only",
        model: "test-model",
        fetch: fakeFetch({
          ...validStructuredExplanation,
          headline: { text: "{{HS_INDEX}}当前结构偏弱", evidenceIds: ["E1"] },
          mainConflict: { text: "{{CSI_INDEX}}对比信号仍待确认", evidenceIds: ["E1"] },
        }),
      },
    });

    expect(accepted.mode).toBe("llm");
    expect(accepted.synthesis.headline.text).toBe("沪深300当前结构偏弱 [E1]");
    expect(accepted.synthesis.mainConflict.text).toBe("中证1000对比信号仍待确认 [E1]");
    expect(accepted.synthesis.headline.text).not.toContain("{{");

    for (const unsafeText of [
      "沪深300当前结构偏弱",
      "当前幅度为3",
      "当前幅度为３",
      "当前幅度为٣",
      "当前幅度为③",
      "当前{{UNKNOWN_INDEX}}结构偏弱",
    ]) {
      const rejected = await synthesizeWithOptionalLlm({
        plan,
        state,
        evidence,
        fallback,
        options: {
          apiKey: "test-only",
          model: "test-model",
          fetch: fakeFetch({
            ...validStructuredExplanation,
            headline: { text: unsafeText, evidenceIds: ["E1"] },
          }),
        },
      });
      expect(rejected.mode).toBe("template");
      expect(rejected.reason).toMatch(/数字|占位符/);
    }
  });

  it("rejects an unknown citation and falls back safely", async () => {
    const result = await synthesizeWithOptionalLlm({
      plan,
      state,
      evidence,
      fallback,
      options: {
        apiKey: "test-only",
        model: "test-model",
        fetch: fakeFetch({
          headline: { text: "核心证据显示当前结构偏弱", evidenceIds: ["E999"] },
          mainConflict: { text: "趋势修复仍缺少确认", evidenceIds: ["E1"] },
          inferences: [{ text: "当前状态应保持审慎解释", evidenceIds: ["E1"] }],
          uncertainties: [],
        }),
      },
    });
    expect(result.mode).toBe("template");
    expect(result.reason).toContain("不存在");
    expect(result.synthesis).toBe(fallback);
  });

  it("rejects a narrative whose direction contradicts every cited evidence item", async () => {
    const result = await synthesizeWithOptionalLlm({
      plan,
      state,
      evidence,
      fallback,
      options: {
        apiKey: "test-only",
        model: "test-model",
        fetch: fakeFetch({
          headline: { text: "趋势证据显示结构明显改善", evidenceIds: ["E1"] },
          mainConflict: { text: "趋势修复仍缺少确认", evidenceIds: ["E1"] },
          inferences: [{ text: "当前状态应保持审慎解释", evidenceIds: ["E1"] }],
          uncertainties: [],
        }),
      },
    });
    expect(result.mode).toBe("template");
    expect(result.reason).toContain("方向");
  });
});
