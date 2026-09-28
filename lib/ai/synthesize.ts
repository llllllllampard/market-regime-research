import type {
  Evidence,
  MarketSnapshot,
  MarketState,
  Metric,
  NarrativeItem,
  ResearchPlan,
} from "../schema";

export type DeterministicSynthesis = {
  headline: NarrativeItem;
  mainConflict: NarrativeItem;
  facts: NarrativeItem[];
  inferences: NarrativeItem[];
  uncertainties: NarrativeItem[];
  limitations: string[];
};

function withCitation(text: string, evidenceIds: string[]): NarrativeItem {
  const suffix = evidenceIds.map((id) => `[${id}]`).join("");
  return { text: `${text}${suffix ? ` ${suffix}` : ""}`, evidenceIds };
}

function coreIds(evidence: Evidence[]): string[] {
  return evidence
    .filter((item) => item.category === "trend" || item.category === "breadth")
    .map((item) => item.id);
}

function conflictCopy(state: MarketState): string {
  switch (state.code) {
    case "synchronized_improvement":
      return "趋势与宽度目前同向，主要观察点转向风格和成交额是否配合。";
    case "index_strength_divergence":
      return "主要矛盾是沪深300趋势改善，但全A上涨参与度代理仍弱，指数表现尚缺广泛确认。";
    case "breadth_repair_unconfirmed":
      return "主要矛盾是全A上涨参与度代理已修复，但沪深300趋势结构仍未确认。";
    case "synchronized_pressure":
      return "趋势与宽度目前同向承压，主要观察是宽度能否先于指数止跌修复。";
    case "range_or_conflict":
      return "趋势与宽度未同时越过分类阈值，当前主要矛盾是信号强度不足或方向不一致。";
    case "insufficient_evidence":
      return "核心趋势或宽度证据缺失，无法识别有效的市场主要矛盾。";
  }
}

export function synthesizeDeterministically(
  state: MarketState,
  snapshot: MarketSnapshot,
  metrics: Metric[],
  evidence: Evidence[],
  intent: ResearchPlan["intent"] = "market_state",
): DeterministicSynthesis {
  const ids = coreIds(evidence);
  const latestDate = snapshot.indices.HS300?.bars.at(-1)?.date ?? snapshot.breadth?.marketDate ?? null;
  const styleEvidence = evidence.find((item) => item.category === "style");
  const styleMetric = metrics.find((item) => item.id === "M_STYLE_RELATIVE_RETURN");
  const styleHeadline = styleEvidence && styleMetric?.value !== null && styleMetric?.value !== undefined
    ? styleMetric.value > 1
      ? `当前窗口内沪深300相对中证1000占优 ${styleMetric.displayValue}，大盘风格相对更强。`
      : styleMetric.value < -1
        ? `当前窗口内中证1000相对沪深300占优 ${Math.abs(styleMetric.value).toFixed(2)}个百分点，小盘风格相对更强。`
        : `当前窗口内沪深300与中证1000相对收益差为 ${styleMetric.displayValue}，大小盘尚未形成显著单边优势。`
    : "大小盘相对收益证据不可用，本次不形成风格归纳。";
  const headline = intent === "style_rotation"
    ? withCitation(styleHeadline, styleEvidence ? [styleEvidence.id] : [])
    : state.code === "insufficient_evidence"
    ? withCitation("核心数据不完整，本次不输出正常市场状态。", ids)
    : withCitation(`${latestDate ? `截至 ${latestDate}` : "截至最新可用数据"}，程序化状态为“${state.label}”。`, ids);
  const mainConflict = intent === "style_rotation" && styleEvidence
    ? withCitation(
        styleMetric?.value !== null && styleMetric?.value !== undefined && Math.abs(styleMetric.value) < 1
          ? "主要矛盾是大小盘相对差距有限，现阶段风格信号弱于趋势与宽度信号。"
          : "主要矛盾是风格相对强弱能否得到市场宽度与趋势结构的共同确认。",
        [styleEvidence.id, ...ids],
      )
    : withCitation(conflictCopy(state), ids);
  const facts = [...evidence]
    .sort((a, b) => intent === "style_rotation" ? Number(b.category === "style") - Number(a.category === "style") : 0)
    .map((item) => withCitation(item.claim, [item.id]));
  const inferences = intent === "style_rotation" && styleEvidence
    ? [withCitation("风格结论只描述当前窗口内的相对表现，不代表下一阶段风格必然延续。", [styleEvidence.id])]
    : state.code === "insufficient_evidence"
    ? []
    : [
        withCitation(
          `按公开阈值矩阵（趋势±0.25、宽度±0.15），两个核心分数对应“${state.label}”；这是当前状态归类，不是涨跌预测。`,
          ids,
        ),
      ];

  const uncertainties: NarrativeItem[] = [];
  if (snapshot.breadth) {
    const breadthId = evidence.find((item) => item.category === "breadth")?.id;
    uncertainties.push(
      withCitation(
        "宽度使用全A股票涨跌分布代理，不是沪深300成分股宽度，两者可能出现口径偏差。",
        breadthId ? [breadthId] : [],
      ),
    );
  } else {
    uncertainties.push(withCitation("宽度数据不可用，市场参与度无法校验。", []));
  }
  for (const metric of metrics.filter((item) => item.status === "missing")) {
    uncertainties.push(withCitation(`${metric.name}数据缺失，未进入本次判断。`, []));
  }
  if (metrics.some((item) => item.status === "conflict")) {
    uncertainties.push(withCitation("核心证据的市场日期未对齐，本次不把这些分数合并为正常市场状态。", []));
  }
  if (snapshot.issues.length) {
    uncertainties.push(
      withCitation(`数据调用存在 ${snapshot.issues.length} 项显式异常或降级，详情见执行轨迹。`, []),
    );
  }

  return {
    headline,
    mainConflict,
    facts,
    inferences,
    uncertainties,
    limitations: [
      "本 MVP 未覆盖估值、政策与新闻事件，这些维度不得视为已被验证。",
      "宽度是全A代理而非沪深300成分股统计；成交额也仅为沪深300指数口径。",
      "结果仅用于研究归纳，不构成投资建议。",
    ],
  };
}
