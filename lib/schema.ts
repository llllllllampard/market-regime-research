import { z } from "zod";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const IsoDateTimeSchema = z.string().datetime({ offset: true });
const FiniteNumberSchema = z.number().finite();
const NullableFiniteNumberSchema = FiniteNumberSchema.nullable();
const RequestParameterSchema = z.union([
  z.string(),
  FiniteNumberSchema,
  z.boolean(),
  z.null(),
]);

export const AnalysisWindowSchema = z.union([z.literal(20), z.literal(60)]);
export type AnalysisWindow = z.infer<typeof AnalysisWindowSchema>;

export const AnalyzeRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(500),
    window: AnalysisWindowSchema.default(20),
    intent: z.enum(["market_state", "style_rotation", "risk_variables"]).optional(),
  })
  .strict();
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const IndexSymbolSchema = z.enum(["HS300", "CSI1000"]);
export type IndexSymbol = z.infer<typeof IndexSymbolSchema>;

export const DataModeSchema = z.enum(["live", "snapshot", "demo"]);
export type DataMode = z.infer<typeof DataModeSchema>;

export const SourceRefSchema = z
  .object({
    id: z.string().min(1),
    provider: z.string().min(1),
    dataset: z.string().min(1),
    endpoint: z.string().url(),
    requestParams: z.record(z.string(), RequestParameterSchema),
    fetchedAt: IsoDateTimeSchema,
    marketDate: DateSchema.nullable(),
    rawFields: z.array(z.string().min(1)).min(1),
    units: z.record(z.string(), z.string()),
    mode: DataModeSchema,
    scope: z.string().min(1),
    notes: z.array(z.string()),
  })
  .strict();
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const DataIssueSchema = z
  .object({
    code: z.enum([
      "NETWORK_ERROR",
      "HTTP_ERROR",
      "INVALID_RESPONSE",
      "EMPTY_DATA",
      "PARTIAL_DATA",
      "UNKNOWN_MARKET_DATE",
      "STALE_DATA",
    ]),
    severity: z.enum(["warning", "error"]),
    message: z.string().min(1),
    provider: z.string().min(1),
    dataset: z.string().min(1),
    retriable: z.boolean(),
  })
  .strict();
export type DataIssue = z.infer<typeof DataIssueSchema>;

export const MarketBarSchema = z
  .object({
    date: DateSchema,
    open: FiniteNumberSchema,
    close: FiniteNumberSchema,
    high: FiniteNumberSchema,
    low: FiniteNumberSchema,
    volume: NullableFiniteNumberSchema,
    amount: NullableFiniteNumberSchema,
    pctChange: NullableFiniteNumberSchema,
  })
  .strict();
export type MarketBar = z.infer<typeof MarketBarSchema>;

export const IndexSeriesSchema = z
  .object({
    symbol: IndexSymbolSchema,
    code: z.string().min(1),
    name: z.string().min(1),
    bars: z.array(MarketBarSchema).min(1),
    sourceId: z.string().min(1),
  })
  .strict();
export type IndexSeries = z.infer<typeof IndexSeriesSchema>;

export const BreadthSnapshotSchema = z
  .object({
    universe: z.string().min(1),
    advancers: z.number().int().nonnegative(),
    decliners: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
    total: z.number().int().positive(),
    advanceRatio: FiniteNumberSchema.min(0).max(1),
    marketDate: DateSchema.nullable(),
    observedAt: IsoDateTimeSchema,
    methodology: z.string().min(1),
    sourceId: z.string().min(1),
  })
  .strict();
export type BreadthSnapshot = z.infer<typeof BreadthSnapshotSchema>;

export const MarketSnapshotSchema = z
  .object({
    mode: DataModeSchema,
    requestedWindow: AnalysisWindowSchema,
    fetchedAt: IsoDateTimeSchema,
    indices: z
      .object({
        HS300: IndexSeriesSchema.optional(),
        CSI1000: IndexSeriesSchema.optional(),
      })
      .strict(),
    breadth: BreadthSnapshotSchema.optional(),
    sources: z.array(SourceRefSchema),
    issues: z.array(DataIssueSchema),
  })
  .strict();
export type MarketSnapshot = z.infer<typeof MarketSnapshotSchema>;

export const MetricStatusSchema = z.enum(["ok", "missing", "stale", "conflict"]);
export const MetricCategorySchema = z.enum(["trend", "breadth", "style", "liquidity"]);

export const MetricSchema = z
  .object({
    id: z.string().regex(/^M_[A-Z0-9_]+$/),
    category: MetricCategorySchema,
    name: z.string().min(1),
    value: NullableFiniteNumberSchema,
    displayValue: z.string().min(1),
    unit: z.string(),
    window: z.string().min(1),
    formula: z.string().min(1),
    status: MetricStatusSchema,
    asOf: DateSchema.nullable(),
    sourceIds: z.array(z.string().min(1)),
  })
  .strict();
export type Metric = z.infer<typeof MetricSchema>;

export const EvidenceSchema = z
  .object({
    id: z.string().regex(/^E\d+$/),
    category: MetricCategorySchema,
    kind: z.enum(["fact", "inference", "uncertain"]),
    direction: z.enum(["support", "counter", "neutral"]),
    claim: z.string().min(1),
    metricIds: z.array(z.string().regex(/^M_[A-Z0-9_]+$/)).min(1),
    asOf: DateSchema.nullable(),
    quality: MetricStatusSchema,
  })
  .strict();
export type Evidence = z.infer<typeof EvidenceSchema>;

export const MarketStateCodeSchema = z.enum([
  "synchronized_improvement",
  "index_strength_divergence",
  "breadth_repair_unconfirmed",
  "synchronized_pressure",
  "range_or_conflict",
  "insufficient_evidence",
]);
export type MarketStateCode = z.infer<typeof MarketStateCodeSchema>;

export const MarketStateSchema = z
  .object({
    code: MarketStateCodeSchema,
    label: z.string().min(1),
    description: z.string().min(1),
    trendScore: NullableFiniteNumberSchema,
    breadthScore: NullableFiniteNumberSchema,
  })
  .strict();
export type MarketState = z.infer<typeof MarketStateSchema>;

export const ConfidenceSchema = z
  .object({
    score: FiniteNumberSchema.min(0).max(100),
    level: z.enum(["high", "medium", "low"]),
    coverage: FiniteNumberSchema.min(0).max(1),
    freshness: FiniteNumberSchema.min(0).max(1),
    consistency: FiniteNumberSchema.min(0).max(1),
    safetyMargin: FiniteNumberSchema.min(0).max(1),
    explanation: z.string().min(1),
    cappedBy: z.array(z.string()),
  })
  .strict();
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const SwitchConditionSchema = z
  .object({
    id: z.string().regex(/^S\d+$/),
    metricId: z.string().regex(/^M_[A-Z0-9_]+$/),
    direction: z.enum(["above", "below"]),
    threshold: FiniteNumberSchema,
    currentValue: NullableFiniteNumberSchema,
    unit: z.string(),
    persistence: z.string().min(1),
    reason: z.string().min(1),
    consequence: z.string().min(1),
    evidenceIds: z.array(z.string().regex(/^E\d+$/)),
  })
  .strict();
export type SwitchCondition = z.infer<typeof SwitchConditionSchema>;

export const NarrativeItemSchema = z
  .object({
    text: z.string().min(1),
    evidenceIds: z.array(z.string().regex(/^E\d+$/)),
  })
  .strict();
export type NarrativeItem = z.infer<typeof NarrativeItemSchema>;

export const ResearchPlanSchema = z
  .object({
    intent: z.enum(["market_state", "style_rotation", "risk_variables"]),
    object: z.literal("沪深300"),
    window: AnalysisWindowSchema,
    tools: z.array(z.enum(["index_kline", "market_breadth"])),
    metrics: z.array(z.string().min(1)),
  })
  .strict();
export type ResearchPlan = z.infer<typeof ResearchPlanSchema>;

export const ExecutionTraceItemSchema = z
  .object({
    step: z.enum(["intent", "plan", "data", "metrics", "synthesis", "validation"]),
    status: z.enum(["success", "degraded", "failed"]),
    message: z.string().min(1),
  })
  .strict();
export type ExecutionTraceItem = z.infer<typeof ExecutionTraceItemSchema>;

export const DataHealthSchema = z.enum(["healthy", "partial", "stale", "failed"]);
export type DataHealth = z.infer<typeof DataHealthSchema>;

export const AnalysisResultSchema = z
  .object({
    request: AnalyzeRequestSchema,
    plan: ResearchPlanSchema,
    snapshot: MarketSnapshotSchema,
    metrics: z.array(MetricSchema),
    evidence: z.array(EvidenceSchema),
    state: MarketStateSchema,
    confidence: ConfidenceSchema,
    headline: NarrativeItemSchema,
    mainConflict: NarrativeItemSchema,
    facts: z.array(NarrativeItemSchema),
    inferences: z.array(NarrativeItemSchema),
    uncertainties: z.array(NarrativeItemSchema),
    switchConditions: z.array(SwitchConditionSchema),
    limitations: z.array(z.string()),
    dataHealth: DataHealthSchema,
    executionTrace: z.array(ExecutionTraceItemSchema),
    disclaimer: z.string().min(1),
  })
  .strict();
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const ComplianceDecisionSchema = z.discriminatedUnion("allowed", [
  z
    .object({
      allowed: z.literal(true),
      category: z.literal("research"),
    })
    .strict(),
  z
    .object({
      allowed: z.literal(false),
      category: z.enum(["prediction", "recommendation", "return_promise", "position"]),
      message: z.string().min(1),
      safeQuestion: z.string().min(1),
    })
    .strict(),
]);
export type ComplianceDecision = z.infer<typeof ComplianceDecisionSchema>;
