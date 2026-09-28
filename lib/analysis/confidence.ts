import { ConfidenceSchema, type Confidence, type MarketSnapshot, type Metric } from "../schema";
import { businessDaysBetween } from "./metrics";

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function freshnessForDate(marketDate: string | null, nowDate: string): number {
  if (!marketDate) return 0.4;
  const age = businessDaysBetween(marketDate, nowDate);
  if (age === 0) return 1;
  if (age === 1) return 0.85;
  if (age === 2) return 0.65;
  if (age === 3) return 0.45;
  return 0.25;
}

function thresholdMargin(score: number, threshold: number): number {
  return Math.min(1, Math.abs(Math.abs(score) - threshold) / threshold);
}

function wasCapturedIntraday(marketDate: string | null, fetchedAt: string): boolean {
  if (!marketDate) return false;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(fetchedAt)).reduce<Record<string, string>>((result, item) => {
    if (item.type !== "literal") result[item.type] = item.value;
    return result;
  }, {});
  const capturedDate = `${parts.year}-${parts.month}-${parts.day}`;
  const capturedMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  return capturedDate === marketDate && capturedMinutes < 15 * 60 + 5;
}

export type ConfidenceInput = {
  snapshot: MarketSnapshot;
  metrics: Metric[];
  trendScore: number | null;
  breadthScore: number | null;
  now?: Date;
};

export function calculateConfidence(input: ConfidenceInput): Confidence {
  const nowDate = (input.now ?? new Date()).toISOString().slice(0, 10);
  const expectedIds = [
    "M_TREND_SCORE",
    "M_BREADTH_SCORE",
    "M_STYLE_RELATIVE_RETURN",
    "M_LIQUIDITY_AMOUNT_RATIO",
  ];
  const byId = new Map(input.metrics.map((metric) => [metric.id, metric]));
  const available = expectedIds.filter((id) => byId.get(id)?.value !== null).length;
  // The brief names seven evidence dimensions. This MVP computes four and
  // leaves valuation, sentiment and events explicitly uncovered.
  const coverage = available / 7;

  const referencedSourceIds = new Set(
    input.metrics
      .filter((metric) => metric.value !== null)
      .flatMap((metric) => metric.sourceIds),
  );
  const relevantSources = input.snapshot.sources.filter((source) => referencedSourceIds.has(source.id));
  const freshnessValues = relevantSources.map((source) => freshnessForDate(source.marketDate, nowDate));
  const freshness = freshnessValues.length
    ? freshnessValues.reduce((sum, value) => sum + value, 0) / freshnessValues.length
    : 0;
  const dataQuality = 0.5 * coverage + 0.5 * freshness;

  const coreAvailable = input.trendScore !== null && input.breadthScore !== null;
  const consistency = coreAvailable
    ? Math.max(0, 1 - Math.abs(input.trendScore! - input.breadthScore!) / 2)
    : 0;
  const safetyMargin = coreAvailable
    ? (thresholdMargin(input.trendScore!, 0.25) + thresholdMargin(input.breadthScore!, 0.15)) / 2
    : 0;

  let score = 100 * (0.45 * dataQuality + 0.35 * consistency + 0.2 * safetyMargin);
  const cappedBy: string[] = [];
  const coreSourceIds = new Set(
    input.metrics
      .filter((metric) => metric.id === "M_TREND_SCORE" || metric.id === "M_BREADTH_SCORE")
      .flatMap((metric) => metric.sourceIds),
  );
  const coreSources = input.snapshot.sources.filter((source) => coreSourceIds.has(source.id));
  const coreAges = coreSources
    .map((source) => source.marketDate)
    .filter((date): date is string => date !== null)
    .map((date) => businessDaysBetween(date, nowDate));
  const oldestCoreAge = coreAges.length ? Math.max(...coreAges) : null;

  const applyCap = (cap: number, reason: string): void => {
    if (score > cap) score = cap;
    cappedBy.push(reason);
  };

  if (!coreAvailable) applyCap(49, "核心趋势或宽度证据缺失，上限49分");
  if (coreSources.some((source) => source.marketDate === null)) {
    applyCap(69, "核心数据源未提供可核验交易日，上限69分");
  }
  if (oldestCoreAge !== null && oldestCoreAge > 3) {
    applyCap(49, "核心数据超过3个工作日，上限49分");
  } else if (oldestCoreAge !== null && oldestCoreAge > 1) {
    applyCap(69, "核心数据超过1个工作日，上限69分");
  }
  if (input.snapshot.mode === "demo") applyCap(35, "构造演示数据上限35分");
  if (/proxy|代理/i.test(input.snapshot.breadth?.universe ?? "")) {
    applyCap(84, "市场宽度使用全A代理而非沪深300成分股口径，上限84分");
  }
  const hasIntradayCoreSnapshot = coreSources.some((source) =>
    wasCapturedIntraday(source.marketDate, source.fetchedAt));
  if (hasIntradayCoreSnapshot && input.snapshot.mode === "snapshot") {
    applyCap(74, "历史快照由盘中未收盘截面生成，收盘数据尚未定型，上限74分");
  } else if (hasIntradayCoreSnapshot) {
    applyCap(74, "核心行情包含盘中未收盘截面，上限74分");
  }

  score = round(Math.max(0, Math.min(100, score)));
  return ConfidenceSchema.parse({
    score,
    level: score >= 75 ? "high" : score >= 55 ? "medium" : "low",
    coverage: round(coverage, 4),
    freshness: round(freshness, 4),
    consistency: round(consistency, 4),
    safetyMargin: round(safetyMargin, 4),
    explanation: "置信度表示当前状态分类的证据质量与稳定性，不是未来上涨概率。",
    cappedBy,
  });
}
