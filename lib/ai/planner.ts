import { ResearchPlanSchema, type AnalyzeRequest, type ResearchPlan } from "../schema";

export function buildResearchPlan(request: AnalyzeRequest): ResearchPlan {
  const question = request.question.toLowerCase();
  const inferredIntent = /风格|大盘|小盘|中证1000|style/.test(question)
    ? "style_rotation"
    : /当前状态|市场状态|主要矛盾|大势|研判|regime/.test(question)
      ? "market_state"
    : /风险|变量|条件|什么情况|risk/.test(question)
      ? "risk_variables"
      : "market_state";
  const intent = request.intent ?? inferredIntent;

  return ResearchPlanSchema.parse({
    intent,
    object: "沪深300",
    window: request.window,
    tools: ["index_kline", "market_breadth"],
    metrics: [
      `${request.window}日收益率`,
      "收盘价相对MA20",
      "MA20斜率",
      "全A上涨家数占比代理",
      "沪深300相对中证1000收益",
      "沪深300成交额相对前20日均值",
    ],
  });
}
