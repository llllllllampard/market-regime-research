import {
  type Evidence,
  type MarketState,
  type Metric,
  SwitchConditionSchema,
  type SwitchCondition,
} from "../schema";

function evidenceForMetric(evidence: Evidence[], metricId: string): string[] {
  return evidence.filter((item) => item.metricIds.includes(metricId)).map((item) => item.id);
}

export function buildSwitchConditions(
  state: MarketState,
  metrics: Metric[],
  evidence: Evidence[],
): SwitchCondition[] {
  if (state.code === "insufficient_evidence") return [];
  const byId = new Map(metrics.map((metric) => [metric.id, metric]));
  const trend = byId.get("M_TREND_SCORE");
  const breadth = byId.get("M_BREADTH_SCORE");
  const liquidity = byId.get("M_LIQUIDITY_AMOUNT_RATIO");
  const result: SwitchCondition[] = [];

  const push = (input: Omit<SwitchCondition, "id">): void => {
    result.push(SwitchConditionSchema.parse({ ...input, id: `S${result.length + 1}` }));
  };

  if (trend?.value !== null && trend?.value !== undefined) {
    const positive = trend.value >= 0.25;
    const negative = trend.value <= -0.25;
    push({
      metricId: trend.id,
      direction: positive ? "below" : "above",
      threshold: positive ? 0.25 : negative ? -0.25 : trend.value >= 0 ? 0.25 : -0.25,
      currentValue: trend.value,
      unit: trend.unit,
      persistence: "日线收盘后重新计算",
      reason: positive
        ? "趋势分回到0.25以下时，偏强趋势条件不再成立。"
        : negative
          ? "趋势分升至-0.25以上时，偏弱趋势条件不再成立。"
          : "趋势分越过最近的分类阈值时，重新评估市场状态。",
      consequence: "重新评估核心市场状态。",
      evidenceIds: evidenceForMetric(evidence, trend.id),
    });
  }

  if (breadth?.value !== null && breadth?.value !== undefined) {
    const positive = breadth.value >= 0.15;
    const negative = breadth.value <= -0.15;
    push({
      metricId: breadth.id,
      direction: positive ? "below" : "above",
      threshold: positive ? 0.15 : negative ? -0.15 : breadth.value >= 0 ? 0.15 : -0.15,
      currentValue: breadth.value,
      unit: breadth.unit,
      persistence: "连续3个交易日满足",
      reason: positive
        ? "宽度分回到0.15以下时，广泛参与条件不再成立。"
        : negative
          ? "宽度分升至-0.15以上时，宽度偏弱条件不再成立。"
          : "宽度分越过最近的分类阈值并持续时，重新评估结构。",
      consequence: "重新评估核心市场状态。",
      evidenceIds: evidenceForMetric(evidence, breadth.id),
    });
  }

  if (liquidity?.value !== null && liquidity?.value !== undefined) {
    push({
      metricId: liquidity.id,
      direction: "below",
      threshold: 80,
      currentValue: liquidity.value,
      unit: liquidity.unit,
      persistence: "单个交易日收盘确认",
      reason: "成交额降至前20日均值的80%以下时，当前结构的参与强度需更谨慎解释。",
      consequence: "只降低解释置信度，不直接改变趋势状态。",
      evidenceIds: evidenceForMetric(evidence, liquidity.id),
    });
  }
  return result;
}
