import { calculateConfidence } from "./analysis/confidence";
import { calculateMetrics } from "./analysis/metrics";
import { classifyMarketState } from "./analysis/state";
import { buildSwitchConditions } from "./analysis/switches";
import { buildResearchPlan } from "./ai/planner";
import { synthesizeDeterministically } from "./ai/synthesize";
import { synthesizeWithOptionalLlm, type RuntimeLlmOptions } from "./ai/runtime";
import { validateAnalysisCitations, validateEvidenceChain } from "./ai/validate";
import { checkCompliance } from "./compliance";
import { loadMarketSnapshot, type MarketDataProvider } from "./data/provider";
import { PublicMarketProvider } from "./data/public-provider";
import { loadBundledMarketSnapshot } from "./data/snapshot";
import {
  AnalysisResultSchema,
  AnalyzeRequestSchema,
  type AnalysisResult,
  type AnalyzeRequest,
  type ComplianceDecision,
  type DataHealth,
  type MarketSnapshot,
} from "./schema";

export type AnalysisOptions = {
  provider?: MarketDataProvider;
  now?: Date;
  signal?: AbortSignal;
  llm?: RuntimeLlmOptions;
  dataMode?: "auto" | "live" | "snapshot";
  snapshot?: MarketSnapshot;
};

export type AnalyzeOutcome =
  | { ok: true; result: AnalysisResult }
  | {
      ok: false;
      error: {
        code: "COMPLIANCE_BLOCKED";
        category: Exclude<ComplianceDecision, { allowed: true }>["category"];
        message: string;
        safeQuestion: string;
      };
    };

function dataHealth(result: {
  coreAvailable: boolean;
  hasStaleCore: boolean;
  hasMissingSupport: boolean;
  issueCount: number;
}): DataHealth {
  if (!result.coreAvailable) return "failed";
  if (result.hasStaleCore) return "stale";
  if (result.hasMissingSupport || result.issueCount > 0) return "partial";
  return "healthy";
}

export async function analyzeMarket(
  input: AnalyzeRequest,
  options: AnalysisOptions = {},
): Promise<AnalysisResult> {
  const request = AnalyzeRequestSchema.parse(input);
  const compliance = checkCompliance(request.question);
  if (!compliance.allowed) {
    throw new Error(`COMPLIANCE_BLOCKED:${compliance.category}:${compliance.safeQuestion}`);
  }
  const now = options.now ?? new Date();
  const plan = buildResearchPlan(request);
  const provider = options.provider ?? new PublicMarketProvider({ now: () => now });
  const configuredMode = options.dataMode ?? process.env.DATA_MODE ?? "auto";
  let snapshot = options.snapshot ?? (configuredMode === "snapshot"
    ? loadBundledMarketSnapshot(request.window)
    : await loadMarketSnapshot(provider, request.window, {
        signal: options.signal,
        now,
      }));
  const liveCoreMissing = !snapshot.indices.HS300 || !snapshot.breadth;
  if (configuredMode === "auto" && liveCoreMissing) {
    snapshot = loadBundledMarketSnapshot(request.window, snapshot.issues);
  }
  const calculated = calculateMetrics(snapshot, now);
  const state = classifyMarketState(calculated.trendScore, calculated.breadthScore);
  const confidence = calculateConfidence({
    snapshot,
    metrics: calculated.metrics,
    trendScore: calculated.trendScore,
    breadthScore: calculated.breadthScore,
    now,
  });
  const switches = buildSwitchConditions(state, calculated.metrics, calculated.evidence);
  const deterministicSynthesis = synthesizeDeterministically(
    state,
    snapshot,
    calculated.metrics,
    calculated.evidence,
    plan.intent,
  );
  const runtimeSynthesis = await synthesizeWithOptionalLlm({
    plan,
    state,
    evidence: calculated.evidence,
    fallback: deterministicSynthesis,
    options: { ...options.llm, signal: options.signal },
  });
  const synthesis = runtimeSynthesis.synthesis;

  const chainValidation = validateEvidenceChain(snapshot.sources, calculated.metrics, calculated.evidence);
  if (!chainValidation.ok) {
    throw new Error(`Evidence chain validation failed: ${chainValidation.errors.join("; ")}`);
  }
  const citationValidation = validateAnalysisCitations({
    evidence: calculated.evidence,
    headline: synthesis.headline,
    mainConflict: synthesis.mainConflict,
    facts: synthesis.facts,
    inferences: synthesis.inferences,
    uncertainties: synthesis.uncertainties,
  });
  if (!citationValidation.ok) {
    throw new Error(`Citation validation failed: ${citationValidation.errors.join("; ")}`);
  }

  const coreAvailable = calculated.trendScore !== null && calculated.breadthScore !== null;
  const coreIds = new Set(["M_TREND_SCORE", "M_BREADTH_SCORE"]);
  const health = dataHealth({
    coreAvailable,
    hasStaleCore: calculated.metrics.some((metric) => coreIds.has(metric.id) && metric.status === "stale"),
    hasMissingSupport: calculated.metrics.some(
      (metric) => !coreIds.has(metric.id) && metric.status === "missing",
    ),
    issueCount: snapshot.issues.length,
  });

  return AnalysisResultSchema.parse({
    request,
    plan,
    snapshot,
    metrics: calculated.metrics,
    evidence: calculated.evidence,
    state,
    confidence,
    headline: synthesis.headline,
    mainConflict: synthesis.mainConflict,
    facts: synthesis.facts,
    inferences: synthesis.inferences,
    uncertainties: synthesis.uncertainties,
    switchConditions: switches,
    limitations: runtimeSynthesis.mode === "template" && runtimeSynthesis.reason
      ? [...synthesis.limitations, runtimeSynthesis.reason]
      : synthesis.limitations,
    dataHealth: health,
    executionTrace: [
      { step: "intent", status: "success", message: `识别为 ${plan.intent} 研究意图。` },
      { step: "plan", status: "success", message: `已锁定沪深300与 ${request.window} 个交易日窗口。` },
      {
        step: "data",
        status: snapshot.issues.length ? "degraded" : "success",
        message: options.snapshot
          ? `复用同一研究会话的 ${snapshot.sources.length} 个数据集，保持研究时点一致。`
          : snapshot.issues.length
          ? `保留可用数据，并显式记录 ${snapshot.issues.length} 项数据问题。`
          : `成功获得 ${snapshot.sources.length} 个可追溯数据集。`,
      },
      {
        step: "metrics",
        status: coreAvailable ? "success" : "failed",
        message: coreAvailable ? "完成确定性指标与状态矩阵计算。" : "核心指标缺失，已转为证据不足。",
      },
      {
        step: "synthesis",
        status: runtimeSynthesis.mode === "llm" ? "success" : "degraded",
        message: runtimeSynthesis.mode === "llm"
          ? `运行时模型已在证据白名单内完成归纳（${runtimeSynthesis.model}）。`
          : runtimeSynthesis.reason ?? "已使用确定性模板组织事实、归纳与不确定性。",
      },
      { step: "validation", status: "success", message: "Evidence→Metric→Source 链路与引用白名单校验通过。" },
    ],
    disclaimer: "本结果用于市场研究归纳，不预测未来涨跌，不构成投资建议。",
  });
}

export async function runAnalysis(
  input: AnalyzeRequest,
  options: AnalysisOptions = {},
): Promise<AnalyzeOutcome> {
  const request = AnalyzeRequestSchema.parse(input);
  const compliance = checkCompliance(request.question);
  if (!compliance.allowed) {
    return {
      ok: false,
      error: {
        code: "COMPLIANCE_BLOCKED",
        category: compliance.category,
        message: compliance.message,
        safeQuestion: compliance.safeQuestion,
      },
    };
  }
  return { ok: true, result: await analyzeMarket(request, options) };
}

export * from "./schema";
export * from "./data/provider";
export * from "./data/public-provider";
