import { ComplianceDecisionSchema, type ComplianceDecision } from "./schema";

const RULES: Array<{
  category: Exclude<ComplianceDecision, { allowed: true }>["category"];
  pattern: RegExp;
  message: string;
}> = [
  {
    category: "return_promise",
    pattern: /(保证|承诺|稳赚|必赚|无风险).{0,8}(收益|回报|赚)|(年化|收益率).{0,8}(保证|承诺|稳定)/i,
    message: "不能承诺或保证投资收益。",
  },
  {
    category: "recommendation",
    pattern: /(推荐|选|买|卖|追|抄底).{0,12}(哪只|哪个|股票|个股|标的)|(哪只|哪个|什么).{0,10}(股票|个股|标的).{0,6}(值得买|能买|可以买)?|选股|股票推荐|买什么|卖什么|能买吗|能不能买|可以买吗|适合买|推荐(?!.*(?:指标|框架|方法|数据源|证据|研究|工具|资料|书籍|课程))[一-龥A-Za-z0-9]{2,20}|(?:我)?(?:该|应该|应当|要)?(?:买|卖|选|持有).{1,20}(?:还是|或者|或).{1,20}/i,
    message: "不能提供直接的个股买卖或荐股建议。",
  },
  {
    category: "position",
    pattern: /(仓位|几成仓|满仓|空仓|全仓|半仓|重仓|轻仓|梭哈|加仓|减仓|仓位比例)/i,
    message: "不能给出个人化仓位或交易操作建议。",
  },
  {
    category: "prediction",
    pattern: /(明天|后天|下周|下月|年底|年末|后市|未来|接下来).{0,16}(涨|跌|点位|到多少|怎么走)|(预测|预言|预计|预期|肯定|必然|会不会|能不能).{0,16}(涨|跌|走势|点位|到多少)|涨不涨|跌不跌|目标点位/i,
    message: "不能输出确定性涨跌或点位预测。",
  },
];

const SAFE_QUESTION = "当前沪深300处于什么市场状态？主要矛盾和需要重新判断的可观测条件是什么？";

const OUT_OF_SCOPE_PATTERN = /(个股|公司|公告|新闻|估值|市盈率|市净率|宏观|政策|行业|板块|财报|\b\d{6}\b)/i;

export function checkResearchScope(question: string):
  | { supported: true }
  | { supported: false; message: string; safeQuestion: string } {
  if (OUT_OF_SCOPE_PATTERN.test(question)) {
    return {
      supported: false,
      message: "当前 MVP 只支持沪深300市场状态、大小盘风格和状态切换变量，不会假装调用尚未接入的个股、估值、新闻或行业工具。",
      safeQuestion: SAFE_QUESTION,
    };
  }
  return { supported: true };
}

export function checkCompliance(question: string): ComplianceDecision {
  const normalized = question.replace(/\s+/g, "").trim();
  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) {
      return ComplianceDecisionSchema.parse({
        allowed: false,
        category: rule.category,
        message: `${rule.message}可以改为基于可追溯证据的条件化研究问题。`,
        safeQuestion: SAFE_QUESTION,
      });
    }
  }
  return ComplianceDecisionSchema.parse({ allowed: true, category: "research" });
}
