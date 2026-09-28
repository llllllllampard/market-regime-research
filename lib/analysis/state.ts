import { MarketStateSchema, type MarketState } from "../schema";

const STATE_COPY: Record<MarketState["code"], { label: string; description: string }> = {
  synchronized_improvement: {
    label: "趋势与宽度同步改善",
    description: "指数结构与市场参与度同时偏强。",
  },
  index_strength_divergence: {
    label: "指数偏强、结构分化",
    description: "指数结构改善，但市场上涨参与度不足。",
  },
  breadth_repair_unconfirmed: {
    label: "宽度修复、趋势未确认",
    description: "市场参与度改善，但沪深300趋势结构尚未确认。",
  },
  synchronized_pressure: {
    label: "趋势与宽度同步承压",
    description: "指数结构与市场参与度同时偏弱。",
  },
  range_or_conflict: {
    label: "区间拉锯或证据分歧",
    description: "主坐标未同时越过状态阈值，不强行归类为单边状态。",
  },
  insufficient_evidence: {
    label: "证据不足",
    description: "趋势或宽度核心序列缺失，不输出完整市场状态。",
  },
};

export function classifyMarketState(
  trendScore: number | null,
  breadthScore: number | null,
): MarketState {
  let code: MarketState["code"];
  if (trendScore === null || breadthScore === null) {
    code = "insufficient_evidence";
  } else if (trendScore >= 0.25 && breadthScore >= 0.15) {
    code = "synchronized_improvement";
  } else if (trendScore >= 0.25 && breadthScore <= -0.15) {
    code = "index_strength_divergence";
  } else if (trendScore <= -0.25 && breadthScore >= 0.15) {
    code = "breadth_repair_unconfirmed";
  } else if (trendScore <= -0.25 && breadthScore <= -0.15) {
    code = "synchronized_pressure";
  } else {
    code = "range_or_conflict";
  }

  return MarketStateSchema.parse({
    code,
    ...STATE_COPY[code],
    trendScore,
    breadthScore,
  });
}

export const STATE_THRESHOLDS = Object.freeze({
  trendPositive: 0.25,
  trendNegative: -0.25,
  breadthPositive: 0.15,
  breadthNegative: -0.15,
});
