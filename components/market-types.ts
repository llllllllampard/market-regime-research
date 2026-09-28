export type Horizon = 20 | 60;
export type Intent = "market_state" | "style_rotation" | "risk_variables";
export type DataMode = "live" | "snapshot" | "demo" | "unavailable";
export type HealthStatus = "healthy" | "partial" | "stale" | "failed";
export type StepStatus = "waiting" | "running" | "success" | "degraded" | "failed";
export type EvidenceStatus = "ok" | "missing" | "stale" | "conflict" | "unavailable";
export type EvidenceStance = "support" | "counter" | "neutral";
export type NarrativeKind = "fact" | "inference" | "uncertain";

export interface ExecutionStep {
  id: string;
  label: string;
  status: StepStatus;
  detail: string;
  source?: string;
}

export interface ResearchPlan {
  intent: Intent;
  scope: string;
  horizon: Horizon;
  steps: ExecutionStep[];
}

export interface NarrativeItem {
  text: string;
  evidenceIds: string[];
}

export interface ConfidenceView {
  score: number;
  label: string;
  meaning: string;
  components: {
    dataQuality: number;
    consistency: number;
    margin: number;
  };
  reasons: string[];
}

export interface SwitchCondition {
  id: string;
  metric: string;
  currentValue: number | string | null;
  unit: string;
  operator: string;
  threshold: number | string | null;
  direction: string;
  persistence: string;
  reason: string;
  consequence: string;
}

export interface EvidenceView {
  id: string;
  category: string;
  label: string;
  statement: string;
  kind: NarrativeKind;
  stance: EvidenceStance;
  value: number | string | null;
  unit: string;
  window: string;
  asOf: string | null;
  status: EvidenceStatus;
  metricIds: string[];
}

export interface MetricView {
  id: string;
  name: string;
  value: number | string | null;
  unit: string;
  window: string;
  formula: string;
  status: EvidenceStatus;
  sourceIds: string[];
}

export interface SourceView {
  id: string;
  provider: string;
  dataset: string;
  marketDate: string | null;
  fetchedAt: string | null;
  rawFields: string[];
  requestParams?: Record<string, unknown>;
  url?: string;
}

export interface AnalysisView {
  state: string;
  headline: string;
  mainConflict: string;
  confidence: ConfidenceView;
  facts: NarrativeItem[];
  inferences: NarrativeItem[];
  uncertainties: NarrativeItem[];
  switchConditions: SwitchCondition[];
  evidence: EvidenceView[];
  metrics: MetricView[];
  sources: SourceView[];
  limitations: string[];
}

export interface ComplianceView {
  blocked: boolean;
  message: string;
  suggestedQuestion: string;
}

export interface AnalyzeView {
  status: "ok" | "degraded" | "blocked" | "error";
  mode: DataMode;
  asOf: string | null;
  fetchedAt: string | null;
  health: { status: HealthStatus; reasons: string[] };
  plan: ResearchPlan | null;
  analysis?: AnalysisView;
  compliance?: ComplianceView;
}

export interface EvidenceDimension {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
}

export const EVIDENCE_DIMENSIONS: EvidenceDimension[] = [
  { key: "market_structure", label: "行情结构", shortLabel: "结构", description: "趋势、均线与价格结构" },
  { key: "breadth", label: "市场宽度", shortLabel: "宽度", description: "成分股参与度与扩散程度" },
  { key: "style", label: "风格轮动", shortLabel: "风格", description: "大盘与小盘相对强弱" },
  { key: "valuation", label: "估值", shortLabel: "估值", description: "估值水平与历史位置" },
  { key: "liquidity", label: "流动性", shortLabel: "流动性", description: "成交活跃度与资金条件" },
  { key: "sentiment", label: "情绪", shortLabel: "情绪", description: "风险偏好与交易拥挤度" },
  { key: "events", label: "重要事件", shortLabel: "事件", description: "影响定价的政策与事件" },
];

const objectOf = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const arrayOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const textOf = (value: unknown, fallback = ""): string =>
  typeof value === "string" || typeof value === "number" ? String(value) : fallback;

const nullableValue = (value: unknown): number | string | null =>
  typeof value === "number" || typeof value === "string" ? value : null;

const stringArray = (value: unknown): string[] =>
  arrayOf(value).map((item) => textOf(item)).filter(Boolean);

const clampScore = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric <= 1 ? numeric * 100 : numeric));
};

const normalizeStepStatus = (value: unknown): StepStatus => {
  const status = textOf(value).toLowerCase();
  if (["success", "done", "completed", "ok"].includes(status)) return "success";
  if (["degraded", "partial", "skipped"].includes(status)) return "degraded";
  if (["failed", "error"].includes(status)) return "failed";
  if (["running", "loading", "in_progress"].includes(status)) return "running";
  return "waiting";
};

const normalizeEvidenceStatus = (value: unknown): EvidenceStatus => {
  const status = textOf(value).toLowerCase();
  if (["ok", "healthy", "available", "success", "good"].includes(status)) return "ok";
  if (["stale", "outdated"].includes(status)) return "stale";
  if (["conflict", "conflicted"].includes(status)) return "conflict";
  if (["missing", "failed", "error"].includes(status)) return "missing";
  if (["unavailable", "not_covered", "unsupported"].includes(status)) return "unavailable";
  return "ok";
};

const normalizeHealthStatus = (value: unknown): HealthStatus => {
  const status = textOf(value).toLowerCase();
  if (["healthy", "ok", "normal", "success"].includes(status)) return "healthy";
  if (["stale", "outdated"].includes(status)) return "stale";
  if (["failed", "error", "unavailable"].includes(status)) return "failed";
  return "partial";
};

const normalizeMode = (value: unknown): DataMode => {
  const mode = textOf(value).toLowerCase();
  if (["live", "snapshot", "demo", "unavailable"].includes(mode)) return mode as DataMode;
  return "unavailable";
};

const normalizeIntent = (value: unknown): Intent => {
  const intent = textOf(value);
  if (intent === "style_rotation" || intent === "risk_variables") return intent;
  return "market_state";
};

const normalizeNarratives = (value: unknown): NarrativeItem[] =>
  arrayOf(value)
    .map((item) => {
      if (typeof item === "string") return { text: item, evidenceIds: [] };
      const entry = objectOf(item);
      return {
        text: textOf(entry.text ?? entry.statement ?? entry.claim),
        evidenceIds: stringArray(entry.evidenceIds ?? entry.evidence_ids ?? entry.references),
      };
    })
    .filter((item) => item.text);

const normalizeCategory = (value: unknown): string => {
  const raw = textOf(value).toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    trend: "market_structure",
    structure: "market_structure",
    price: "market_structure",
    market: "market_structure",
    market_structure: "market_structure",
    market_breadth: "breadth",
    breadth: "breadth",
    style_rotation: "style",
    rotation: "style",
    style: "style",
    valuation: "valuation",
    liquidity: "liquidity",
    volume: "liquidity",
    sentiment: "sentiment",
    important_events: "events",
    event: "events",
    events: "events",
  };
  return aliases[raw] ?? raw ?? "other";
};

const normalizeEvidence = (value: unknown): EvidenceView[] =>
  arrayOf(value).map((item, index) => {
    const entry = objectOf(item);
    const stanceRaw = textOf(entry.stance ?? entry.direction).toLowerCase();
    const kindRaw = textOf(entry.kind).toLowerCase();
    return {
      id: textOf(entry.id, `E${index + 1}`),
      category: normalizeCategory(entry.category),
      label: textOf(entry.label ?? entry.name ?? entry.category, "证据"),
      statement: textOf(entry.statement ?? entry.claim ?? entry.text, "该证据暂无可读说明"),
      kind: kindRaw === "inference" ? "inference" : kindRaw === "uncertain" ? "uncertain" : "fact",
      stance: ["support", "positive", "bullish"].includes(stanceRaw)
        ? "support"
        : ["counter", "negative", "bearish"].includes(stanceRaw)
          ? "counter"
          : "neutral",
      value: nullableValue(entry.value),
      unit: textOf(entry.unit),
      window: textOf(entry.window ?? entry.lookback),
      asOf: textOf(entry.asOf ?? entry.as_of) || null,
      status: normalizeEvidenceStatus(entry.status ?? entry.quality),
      metricIds: stringArray(entry.metricIds ?? entry.metric_ids),
    };
  });

const normalizeMetrics = (value: unknown): MetricView[] =>
  arrayOf(value).map((item, index) => {
    const entry = objectOf(item);
    return {
      id: textOf(entry.id, `M${index + 1}`),
      name: textOf(entry.name ?? entry.label, "指标"),
      value: nullableValue(entry.value),
      unit: textOf(entry.unit),
      window: textOf(entry.window ?? entry.lookback),
      formula: textOf(entry.formula ?? entry.methodology, "未提供计算公式"),
      status: normalizeEvidenceStatus(entry.status),
      sourceIds: stringArray(entry.sourceIds ?? entry.source_ids),
    };
  });

const normalizeSources = (value: unknown): SourceView[] =>
  arrayOf(value).map((item, index) => {
    const entry = objectOf(item);
    const params = objectOf(entry.requestParams ?? entry.request_params);
    const rawFieldsValue = entry.rawFields ?? entry.raw_fields;
    return {
      id: textOf(entry.id, `S${index + 1}`),
      provider: textOf(entry.provider, "未标明"),
      dataset: textOf(entry.dataset ?? entry.name, "未标明"),
      marketDate: textOf(entry.marketDate ?? entry.market_date ?? entry.asOf) || null,
      fetchedAt: textOf(entry.fetchedAt ?? entry.fetched_at) || null,
      rawFields: Array.isArray(rawFieldsValue)
        ? stringArray(rawFieldsValue)
        : Object.keys(objectOf(rawFieldsValue)),
      requestParams: Object.keys(params).length ? params : undefined,
      url: textOf(entry.url ?? entry.endpoint) || undefined,
    };
  });

const normalizeSwitches = (value: unknown): SwitchCondition[] =>
  arrayOf(value).map((item, index) => {
    const entry = objectOf(item);
    return {
      id: textOf(entry.id, `C${index + 1}`),
      metric: textOf(entry.metric ?? entry.metricName ?? entry.metricId, "关键指标"),
      currentValue: nullableValue(entry.currentValue ?? entry.current ?? entry.value),
      unit: textOf(entry.unit),
      operator: textOf(entry.operator ?? entry.comparator, "达到"),
      threshold: nullableValue(entry.threshold ?? entry.targetValue ?? entry.target),
      direction: textOf(entry.direction ?? entry.trigger, "变化"),
      persistence: textOf(entry.persistence ?? entry.confirmation, "触发后再次确认"),
      reason: textOf(entry.reason ?? entry.description, "达到该条件时需要重新评估当前状态。"),
      consequence: textOf(entry.consequence ?? entry.effect, "重新评估当前市场状态。"),
    };
  });

/**
 * Accepts both the route's public response contract and the analysis engine's
 * `{ ok, result }` envelope. This keeps UI failure modes explicit while the API
 * boundary remains free to evolve.
 */
export function normalizeAnalyzeResponse(payload: unknown): AnalyzeView {
  const envelope = objectOf(payload);
  const raw = objectOf(envelope.ok === true && envelope.result ? envelope.result : payload);
  const error = objectOf(envelope.error);

  if (
    raw.status === "blocked" ||
    objectOf(raw.compliance).blocked === true ||
    textOf(error.code) === "COMPLIANCE_BLOCKED"
  ) {
    const compliance = objectOf(raw.compliance);
    return {
      status: "blocked",
      mode: normalizeMode(raw.mode),
      asOf: textOf(raw.asOf) || null,
      fetchedAt: textOf(raw.fetchedAt) || null,
      health: { status: "partial", reasons: [] },
      plan: null,
      compliance: {
        blocked: true,
        message: textOf(compliance.message ?? error.message, "该问题超出本工具的研究边界。"),
        suggestedQuestion: textOf(
          compliance.suggestedQuestion ?? error.safeQuestion,
          "当前沪深 300 处于什么市场状态？主要矛盾和状态切换条件是什么？",
        ),
      },
    };
  }

  const snapshot = objectOf(raw.snapshot);
  const healthValue = raw.health ?? raw.dataHealth;
  const healthRaw = objectOf(healthValue);
  const planRaw = objectOf(raw.plan);
  const analysisRaw = Object.keys(objectOf(raw.analysis)).length ? objectOf(raw.analysis) : raw;
  const stateRaw = objectOf(analysisRaw.state);
  const confidenceRaw = objectOf(analysisRaw.confidence);
  const confidenceComponents = objectOf(confidenceRaw.components);
  const execution = arrayOf(planRaw.steps).length ? planRaw.steps : raw.executionTrace;
  const horizonValue = Number(planRaw.horizon ?? planRaw.window ?? objectOf(raw.request).window);
  const score = clampScore(confidenceRaw.score);

  const executionLabels: Record<string, string> = {
    intent: "识别研究意图",
    plan: "生成受限取数计划",
    data: "调用数据工具",
    metrics: "计算确定性指标",
    synthesis: "组织证据归纳",
    validation: "校验引用与边界",
  };
  const steps: ExecutionStep[] = arrayOf(execution).map((item, index) => {
    const step = objectOf(item);
    const stepCode = textOf(step.step);
    return {
      id: textOf(step.id ?? stepCode, `step-${index + 1}`),
      label: textOf(step.label ?? step.name, executionLabels[stepCode] ?? `执行步骤 ${index + 1}`),
      status: normalizeStepStatus(step.status),
      detail: textOf(step.detail ?? step.message ?? step.description),
      source: textOf(step.source ?? step.provider) || undefined,
    };
  });

  const issueReasons = arrayOf(snapshot.issues)
    .map((issue) => textOf(objectOf(issue).message))
    .filter(Boolean);
  const healthReasons = [
    ...stringArray(healthRaw.reasons ?? healthRaw.messages),
    ...issueReasons,
  ];
  const metrics = normalizeMetrics(analysisRaw.metrics);
  const evidence = normalizeEvidence(analysisRaw.evidence).map((item) => {
    const linkedMetric = metrics.find((metric) => item.metricIds.includes(metric.id));
    return {
      ...item,
      label: item.label === "证据" || item.label === item.category ? linkedMetric?.name ?? item.label : item.label,
      value: item.value ?? linkedMetric?.value ?? null,
      unit: item.unit || linkedMetric?.unit || "",
      window: item.window || linkedMetric?.window || "",
    };
  });
  const sources = normalizeSources(analysisRaw.sources ?? snapshot.sources);
  const state = textOf(
    typeof analysisRaw.state === "string" ? analysisRaw.state : stateRaw.label ?? stateRaw.description,
    "证据不足",
  );

  const headlineObject = objectOf(analysisRaw.headline);
  const conflictObject = objectOf(analysisRaw.mainConflict);
  const confidenceLabelRaw = textOf(confidenceRaw.label ?? confidenceRaw.level);
  const confidenceLabel = confidenceLabelRaw === "high"
    ? "高"
    : confidenceLabelRaw === "medium"
      ? "中"
      : confidenceLabelRaw === "low"
        ? "低"
        : confidenceLabelRaw || (score >= 75 ? "高" : score >= 55 ? "中" : "低");
  const normalizedSwitches = normalizeSwitches(analysisRaw.switchConditions).map((condition) => {
    const linkedMetric = metrics.find((metric) => metric.id === condition.metric);
    const direction = condition.direction === "above"
      ? "向上突破"
      : condition.direction === "below"
        ? "向下跌破"
        : condition.direction;
    return {
      ...condition,
      metric: linkedMetric?.name ?? condition.metric,
      operator: condition.operator === "达到" ? direction || condition.operator : condition.operator,
    };
  });

  const analysis: AnalysisView = {
    state,
    headline: textOf(
      typeof analysisRaw.headline === "string" ? analysisRaw.headline : headlineObject.text,
      "已完成证据整理，请结合下方台账审阅当前市场状态。",
    ),
    mainConflict: textOf(
      typeof analysisRaw.mainConflict === "string" ? analysisRaw.mainConflict : conflictObject.text,
      "可用证据尚未形成足够明确的主要矛盾。",
    ),
    confidence: {
      score,
      label: confidenceLabel,
      meaning: textOf(
        confidenceRaw.meaning ?? confidenceRaw.explanation,
        "代表当前状态分类的证据质量，不是未来上涨概率。",
      ),
      components: {
        dataQuality: clampScore(
          confidenceComponents.dataQuality ??
            confidenceRaw.dataQuality ??
            (Number(confidenceRaw.coverage || 0) + Number(confidenceRaw.freshness || 0)) / 2,
        ),
        consistency: clampScore(confidenceComponents.consistency ?? confidenceRaw.consistency),
        margin: clampScore(confidenceComponents.margin ?? confidenceRaw.safetyMargin),
      },
      reasons: stringArray(confidenceRaw.reasons ?? confidenceRaw.cappedBy),
    },
    facts: normalizeNarratives(analysisRaw.facts),
    inferences: normalizeNarratives(analysisRaw.inferences),
    uncertainties: normalizeNarratives(analysisRaw.uncertainties),
    switchConditions: normalizedSwitches,
    evidence,
    metrics,
    sources,
    limitations: stringArray(analysisRaw.limitations),
  };

  const rawStatus = textOf(raw.status).toLowerCase();
  const normalizedHealth = normalizeHealthStatus(healthRaw.status ?? healthValue ?? rawStatus);
  const resultStatus: AnalyzeView["status"] =
    rawStatus === "error" || normalizedHealth === "failed"
      ? "error"
      : rawStatus === "degraded" || normalizedHealth !== "healthy"
        ? "degraded"
        : "ok";

  return {
    status: resultStatus,
    mode: normalizeMode(raw.mode ?? snapshot.mode ?? healthRaw.mode),
    asOf: textOf(
      raw.asOf ??
        snapshot.asOf ??
        snapshot.marketDate ??
        healthRaw.asOf ??
        evidence.find((item) => item.asOf)?.asOf ??
        sources.find((item) => item.marketDate)?.marketDate,
    ) || null,
    fetchedAt: textOf(raw.fetchedAt ?? snapshot.fetchedAt ?? healthRaw.fetchedAt) || null,
    health: { status: normalizedHealth, reasons: healthReasons },
    plan: {
      intent: normalizeIntent(planRaw.intent ?? objectOf(raw.request).intent),
      scope: textOf(planRaw.scope ?? planRaw.object ?? snapshot.scope, "沪深300"),
      horizon: horizonValue === 60 ? 60 : 20,
      steps,
    },
    analysis,
  };
}
