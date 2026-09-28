import {
  type AnalysisWindow,
  type Evidence,
  EvidenceSchema,
  type IndexSeries,
  type MarketSnapshot,
  type Metric,
  MetricSchema,
} from "../schema";
import { sourceFor } from "../data/provider";

const clamp = (value: number, minimum = -1, maximum = 1): number =>
  Math.min(maximum, Math.max(minimum, value));

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]): number | null {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sourceStatus(snapshot: MarketSnapshot, sourceId: string, now: Date): "ok" | "stale" {
  const marketDate = sourceFor(snapshot, sourceId)?.marketDate;
  if (!marketDate) return "ok";
  return businessDaysBetween(marketDate, now.toISOString().slice(0, 10)) > 1 ? "stale" : "ok";
}

export function businessDaysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return 0;
  let days = 0;
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= end) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function metric(
  input: Omit<Metric, "displayValue"> & { displayValue?: string },
): Metric {
  const displayValue =
    input.displayValue ??
    (input.value === null
      ? "数据不可用"
      : input.unit === "%"
        ? `${input.value.toFixed(2)}%`
        : input.value.toFixed(2));
  return MetricSchema.parse({ ...input, displayValue });
}

function missingMetric(
  id: string,
  category: Metric["category"],
  name: string,
  unit: string,
  window: string,
  formula: string,
): Metric {
  return metric({
    id,
    category,
    name,
    value: null,
    unit,
    window,
    formula,
    status: "missing",
    asOf: null,
    sourceIds: [],
  });
}

function closeReturn(series: IndexSeries, window: AnalysisWindow): number | null {
  if (series.bars.length < window + 1) return null;
  const latest = series.bars.at(-1)?.close;
  const base = series.bars.at(-(window + 1))?.close;
  if (latest === undefined || base === undefined || base === 0) return null;
  const value = latest / base - 1;
  return Number.isFinite(value) ? value : null;
}

function trendMetrics(
  snapshot: MarketSnapshot,
  window: AnalysisWindow,
  now: Date,
): { metrics: Metric[]; trendScore: number | null } {
  const series = snapshot.indices.HS300;
  const names = {
    return: `沪深300 ${window}日收益率`,
    gap: "最新点位相对 MA20",
    slope: "MA20 五日斜率",
    score: "趋势分 T",
  };
  if (!series) {
    return {
      metrics: [
        missingMetric("M_TREND_RETURN", "trend", names.return, "%", `${window}个交易日`, "close[t] / close[t-window] - 1"),
        missingMetric("M_TREND_MA_GAP", "trend", names.gap, "%", "20个交易日", "close[t] / MA20[t] - 1"),
        missingMetric("M_TREND_MA_SLOPE", "trend", names.slope, "%", "5个交易日", "MA20[t] / MA20[t-5] - 1"),
        missingMetric("M_TREND_SCORE", "trend", names.score, "score", "composite", "mean(normalized return, MA gap, MA slope)"),
      ],
      trendScore: null,
    };
  }

  const bars = series.bars;
  const latest = bars.at(-1);
  const closes20 = bars.slice(-20).map((bar) => bar.close);
  const prior20 = bars.slice(-25, -5).map((bar) => bar.close);
  const ma20 = closes20.length === 20 ? mean(closes20) : null;
  const ma20Prior = prior20.length === 20 ? mean(prior20) : null;
  const periodReturn = closeReturn(series, window);
  const maGap = latest && ma20 && ma20 !== 0 ? latest.close / ma20 - 1 : null;
  const maSlope = ma20 && ma20Prior && ma20Prior !== 0 ? ma20 / ma20Prior - 1 : null;
  const returnScale = window === 60 ? 0.1 : 0.05;
  const components = [
    periodReturn === null ? null : clamp(periodReturn / returnScale),
    maGap === null ? null : clamp(maGap / 0.03),
    maSlope === null ? null : clamp(maSlope / 0.02),
  ];
  const validComponents = components.filter((value): value is number => value !== null);
  const score = validComponents.length === 3 ? mean(validComponents) : null;
  const status = sourceStatus(snapshot, series.sourceId, now);
  const asOf = latest?.date ?? null;
  const sourceIds = [series.sourceId];

  return {
    metrics: [
      metric({
        id: "M_TREND_RETURN",
        category: "trend",
        name: names.return,
        value: periodReturn === null ? null : round(periodReturn * 100, 4),
        unit: "%",
        window: `${window}个交易日`,
        formula: "（最新收盘点位 / N个交易日前收盘点位 - 1）× 100",
        status: periodReturn === null ? "missing" : status,
        asOf,
        sourceIds,
      }),
      metric({
        id: "M_TREND_MA_GAP",
        category: "trend",
        name: names.gap,
        value: maGap === null ? null : round(maGap * 100, 4),
        unit: "%",
        window: "20个交易日",
        formula: "（最新收盘点位 / MA20算术平均值 - 1）× 100",
        status: maGap === null ? "missing" : status,
        asOf,
        sourceIds,
      }),
      metric({
        id: "M_TREND_MA_SLOPE",
        category: "trend",
        name: names.slope,
        value: maSlope === null ? null : round(maSlope * 100, 4),
        unit: "%",
        window: "当前MA20相对5个交易日前",
        formula: "(MA20[t] / MA20[t-5] - 1) * 100",
        status: maSlope === null ? "missing" : status,
        asOf,
        sourceIds,
      }),
      metric({
        id: "M_TREND_SCORE",
        category: "trend",
        name: names.score,
        value: score === null ? null : round(score),
        unit: "分",
        window: `${window}日收益与MA20结构的复合指标`,
        formula: `mean(clamp(区间收益/${returnScale}), clamp(MA20偏离/0.03), clamp(MA20斜率/0.02))；输入均为小数收益率`,
        status: score === null ? "missing" : status,
        asOf,
        sourceIds,
      }),
    ],
    trendScore: score === null ? null : round(score),
  };
}

function breadthMetrics(
  snapshot: MarketSnapshot,
  now: Date,
): { metrics: Metric[]; breadthScore: number | null } {
  const breadth = snapshot.breadth;
  if (!breadth) {
    return {
      metrics: [
        missingMetric("M_BREADTH_ADVANCE_RATIO", "breadth", "上涨家数占比", "%", "latest cross-section", "advancers / all valid rows"),
        missingMetric("M_BREADTH_SCORE", "breadth", "宽度分 B", "score", "latest cross-section", "clamp((advance ratio - 50%) / 25%)"),
      ],
      breadthScore: null,
    };
  }
  const score = clamp((breadth.advanceRatio - 0.5) / 0.25);
  const status = sourceStatus(snapshot, breadth.sourceId, now);
  return {
    metrics: [
      metric({
        id: "M_BREADTH_ADVANCE_RATIO",
        category: "breadth",
        name: "上涨家数占比（全A代理）",
        value: round(breadth.advanceRatio * 100, 4),
        unit: "%",
        window: "最新涨跌分布截面",
        formula: breadth.methodology,
        status,
        asOf: breadth.marketDate,
        sourceIds: [breadth.sourceId],
      }),
      metric({
        id: "M_BREADTH_SCORE",
        category: "breadth",
        name: "宽度分 B",
        value: round(score),
        unit: "分",
        window: "最新涨跌分布截面",
        formula: "clamp((advance ratio - 0.50) / 0.25, -1, 1)",
        status,
        asOf: breadth.marketDate,
        sourceIds: [breadth.sourceId],
      }),
    ],
    breadthScore: round(score),
  };
}

function styleMetric(snapshot: MarketSnapshot, window: AnalysisWindow, now: Date): Metric {
  const large = snapshot.indices.HS300;
  const small = snapshot.indices.CSI1000;
  if (!large || !small) {
    return missingMetric(
      "M_STYLE_RELATIVE_RETURN",
      "style",
      "沪深300相对中证1000收益",
      "个百分点",
      `${window}个交易日`,
      "HS300 period return - CSI1000 period return",
    );
  }
  const largeReturn = closeReturn(large, window);
  const smallReturn = closeReturn(small, window);
  const value = largeReturn === null || smallReturn === null ? null : (largeReturn - smallReturn) * 100;
  const largeStatus = sourceStatus(snapshot, large.sourceId, now);
  const smallStatus = sourceStatus(snapshot, small.sourceId, now);
  return metric({
    id: "M_STYLE_RELATIVE_RETURN",
    category: "style",
    name: "沪深300相对中证1000收益",
    value: value === null ? null : round(value, 4),
    unit: "个百分点",
    window: `${window}个交易日`,
    formula: "HS300 close-to-close return minus CSI1000 close-to-close return",
    status: value === null ? "missing" : largeStatus === "stale" || smallStatus === "stale" ? "stale" : "ok",
    asOf: large.bars.at(-1)?.date ?? null,
    sourceIds: [large.sourceId, small.sourceId],
  });
}

function liquidityMetric(snapshot: MarketSnapshot, now: Date): Metric {
  const series = snapshot.indices.HS300;
  if (!series || series.bars.length < 21) {
    return missingMetric(
      "M_LIQUIDITY_AMOUNT_RATIO",
      "liquidity",
      "沪深300最新成交额 / 前20日均值",
      "%",
      "最新完整交易日相对前20个交易日",
      "latest amount / mean(previous 20 daily amounts) * 100",
    );
  }
  const latest = series.bars.at(-1);
  const sourceFetchedAt = sourceFor(snapshot, series.sourceId)?.fetchedAt;
  const observationTime = sourceFetchedAt ? new Date(sourceFetchedAt) : now;
  const shanghaiTime = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(observationTime).reduce<Record<string, string>>((parts, item) => {
    if (item.type !== "literal") parts[item.type] = item.value;
    return parts;
  }, {});
  const shanghaiDate = `${shanghaiTime.year}-${shanghaiTime.month}-${shanghaiTime.day}`;
  const shanghaiMinutes = Number(shanghaiTime.hour) * 60 + Number(shanghaiTime.minute);
  const isIncompleteSession = latest?.date === shanghaiDate && shanghaiMinutes < 15 * 60 + 5;
  if (latest && isIncompleteSession) {
    return metric({
      id: "M_LIQUIDITY_AMOUNT_RATIO",
      category: "liquidity",
      name: "沪深300最新成交额 / 前20日均值",
      value: null,
      displayValue: "盘中未完成",
      unit: "%",
      window: "当前交易日（未收盘）",
      formula: "盘中累计成交额不可直接与完整交易日均值比较，因此本次不计算",
      status: "missing",
      asOf: latest.date,
      sourceIds: [series.sourceId],
    });
  }
  const history = series.bars.slice(-21, -1).map((bar) => bar.amount).filter((v): v is number => v !== null);
  const average = history.length === 20 ? mean(history) : null;
  const ratio = latest?.amount !== null && latest?.amount !== undefined && average && average > 0
    ? (latest.amount / average) * 100
    : null;
  return metric({
    id: "M_LIQUIDITY_AMOUNT_RATIO",
    category: "liquidity",
    name: "沪深300最新成交额 / 前20日均值",
    value: ratio === null ? null : round(ratio, 4),
    unit: "%",
    window: "最新完整交易日相对前20个交易日",
    formula: "最新完整交易日沪深300成交额 / 前20个交易日成交额算术平均值 × 100",
    status: ratio === null ? "missing" : sourceStatus(snapshot, series.sourceId, now),
    asOf: latest?.date ?? null,
    sourceIds: [series.sourceId],
  });
}

export type CalculatedMetrics = {
  metrics: Metric[];
  evidence: Evidence[];
  trendScore: number | null;
  breadthScore: number | null;
};

function evidenceFromMetrics(metrics: Metric[], trendScore: number | null, breadthScore: number | null): Evidence[] {
  const byId = new Map(metrics.map((item) => [item.id, item]));
  const result: Evidence[] = [];
  const add = (evidence: Evidence): void => {
    if (evidence.metricIds.every((id) => byId.get(id)?.value !== null)) {
      result.push(EvidenceSchema.parse(evidence));
    }
  };
  const trendReturn = byId.get("M_TREND_RETURN");
  const maGap = byId.get("M_TREND_MA_GAP");
  const trend = byId.get("M_TREND_SCORE");
  if (trendReturn && maGap && trend) {
    add({
      id: "E1",
      category: "trend",
      kind: "fact",
      direction: trendScore === null ? "neutral" : trendScore >= 0.25 ? "support" : trendScore <= -0.25 ? "counter" : "neutral",
      claim: `${trendReturn.name}为 ${trendReturn.displayValue}，${maGap.name}为 ${maGap.displayValue}，程序化趋势分为 ${trend.displayValue}。`,
      metricIds: [trendReturn.id, maGap.id, trend.id],
      asOf: trend.asOf,
      quality: trend.status,
    });
  }
  const breadthRatio = byId.get("M_BREADTH_ADVANCE_RATIO");
  const breadth = byId.get("M_BREADTH_SCORE");
  if (breadthRatio && breadth) {
    add({
      id: "E2",
      category: "breadth",
      kind: "fact",
      direction: breadthScore === null ? "neutral" : breadthScore >= 0.15 ? "support" : breadthScore <= -0.15 ? "counter" : "neutral",
      claim: `全A代理口径下，上涨家数占比为 ${breadthRatio.displayValue}，程序化宽度分为 ${breadth.displayValue}。`,
      metricIds: [breadthRatio.id, breadth.id],
      asOf: breadth.asOf,
      quality: breadth.status,
    });
  }
  const style = byId.get("M_STYLE_RELATIVE_RETURN");
  if (style) {
    add({
      id: "E3",
      category: "style",
      kind: "fact",
      direction: style.value === null ? "neutral" : style.value > 1 ? "support" : style.value < -1 ? "counter" : "neutral",
      claim: `${style.window}内，沪深300相对中证1000收益为 ${style.displayValue}（正值表示大盘相对占优）。`,
      metricIds: [style.id],
      asOf: style.asOf,
      quality: style.status,
    });
  }
  const liquidity = byId.get("M_LIQUIDITY_AMOUNT_RATIO");
  if (liquidity) {
    add({
      id: "E4",
      category: "liquidity",
      kind: "fact",
      direction: liquidity.value === null ? "neutral" : liquidity.value >= 100 ? "support" : liquidity.value < 80 ? "counter" : "neutral",
      claim: `沪深300最新成交额为前20个交易日均值的 ${liquidity.displayValue}；该指标只表示指数成交额，不代表全市场资金流。`,
      metricIds: [liquidity.id],
      asOf: liquidity.asOf,
      quality: liquidity.status,
    });
  }
  return result;
}

export function calculateMetrics(snapshot: MarketSnapshot, now = new Date()): CalculatedMetrics {
  const trend = trendMetrics(snapshot, snapshot.requestedWindow, now);
  const breadth = breadthMetrics(snapshot, now);
  let metrics = [
    ...trend.metrics,
    ...breadth.metrics,
    styleMetric(snapshot, snapshot.requestedWindow, now),
    liquidityMetric(snapshot, now),
  ];
  const trendDate = metrics.find((item) => item.id === "M_TREND_SCORE")?.asOf;
  const breadthDate = metrics.find((item) => item.id === "M_BREADTH_SCORE")?.asOf;
  const coreDateConflict = Boolean(trendDate && breadthDate && trendDate !== breadthDate);
  if (coreDateConflict) {
    metrics = metrics.map((item) =>
      item.id === "M_TREND_SCORE" || item.id === "M_BREADTH_SCORE"
        ? MetricSchema.parse({ ...item, status: "conflict" })
        : item,
    );
  }
  const comparableBreadthScore = coreDateConflict ? null : breadth.breadthScore;
  return {
    metrics,
    evidence: evidenceFromMetrics(metrics, trend.trendScore, comparableBreadthScore),
    trendScore: trend.trendScore,
    breadthScore: comparableBreadthScore,
  };
}
