import { z } from "zod";

import type { DeterministicSynthesis } from "./synthesize";
import type { Evidence, MarketState, NarrativeItem, ResearchPlan } from "../schema";

const NarrativeSchema = z
  .object({
    text: z.string().trim().min(1).max(240),
    evidenceIds: z.array(z.string().regex(/^E\d+$/)).min(1),
  })
  .strict();

const RuntimeSynthesisSchema = z
  .object({
    headline: NarrativeSchema,
    mainConflict: NarrativeSchema,
    inferences: z.array(NarrativeSchema).min(1).max(3),
    uncertainties: z.array(NarrativeSchema).max(3),
  })
  .strict();

const ChatResponseSchema = z
  .object({
    choices: z.array(
      z.object({
        message: z.object({ content: z.string() }).passthrough(),
      }).passthrough(),
    ).min(1),
  })
  .passthrough();

export type RuntimeLlmOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type RuntimeSynthesisResult = {
  synthesis: DeterministicSynthesis;
  mode: "llm" | "template";
  model?: string;
  reason?: string;
};

const DEFAULT_LLM_TIMEOUT_MS = 15_000;

function isBailianBaseUrl(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return /^dashscope(?:-[a-z0-9-]+)?\.aliyuncs\.com$/.test(hostname)
      || hostname.endsWith(".maas.aliyuncs.com");
  } catch {
    return false;
  }
}

function configured(options: RuntimeLlmOptions): Required<Pick<RuntimeLlmOptions, "apiKey" | "baseUrl" | "model">> | null {
  const apiKey = options.apiKey ?? process.env.LLM_API_KEY;
  const baseUrl = options.baseUrl ?? process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
  const model = options.model ?? process.env.LLM_MODEL;
  return apiKey && model ? { apiKey, baseUrl, model } : null;
}

function allText(value: z.infer<typeof RuntimeSynthesisSchema>): string[] {
  return [value.headline.text, value.mainConflict.text, ...value.inferences.map((item) => item.text), ...value.uncertainties.map((item) => item.text)];
}

function containsUnknownIndexToken(text: string): boolean {
  const withoutAllowedTokens = text.replace(/\{\{(?:HS_INDEX|CSI_INDEX)\}\}/g, "");
  return /\{\{|\}\}/.test(withoutAllowedTokens);
}

function restoreCanonicalIndexNames(item: NarrativeItem): NarrativeItem {
  return {
    ...item,
    text: item.text
      .replaceAll("{{HS_INDEX}}", "沪深300")
      .replaceAll("{{CSI_INDEX}}", "中证1000"),
  };
}

function validateRuntimeNarrative(
  value: z.infer<typeof RuntimeSynthesisSchema>,
  evidence: Evidence[],
): string | null {
  const allowedIds = new Set(evidence.map((item) => item.id));
  const items = [value.headline, value.mainConflict, ...value.inferences, ...value.uncertainties];
  for (const item of items) {
    if (item.evidenceIds.some((id) => !allowedIds.has(id))) return "模型引用了不存在的 Evidence ID";
    const cited = evidence.filter((entry) => item.evidenceIds.includes(entry.id));
    if (/(改善|偏强|占优|扩张)/.test(item.text) && cited.length && cited.every((entry) => entry.direction === "counter")) {
      return "模型解释方向与所引证据相反";
    }
    if (/(承压|偏弱|收缩)/.test(item.text) && cited.length && cited.every((entry) => entry.direction === "support")) {
      return "模型解释方向与所引证据相反";
    }
  }
  const texts = allText(value);
  if (texts.some((text) => /\p{Number}/u.test(text))) return "模型解释包含未经白名单校验的数字";
  if (texts.some(containsUnknownIndexToken)) return "模型解释包含未知指数占位符";
  if (texts.some((text) => /(必涨|必跌|肯定涨|肯定跌|买入|卖出|加仓|减仓|几成仓|收益承诺|逢低布局|做多|做空|目标价|建议.{0,8}(买|卖|持有|布局)|适合.{0,8}(买|卖|做多|做空))/i.test(text))) {
    return "模型解释越过研究合规边界";
  }
  return null;
}

function appendCitations(item: NarrativeItem): NarrativeItem {
  const suffix = item.evidenceIds.map((id) => `[${id}]`).join("");
  return { ...item, text: `${item.text}${suffix ? ` ${suffix}` : ""}` };
}

export async function synthesizeWithOptionalLlm(input: {
  plan: ResearchPlan;
  state: MarketState;
  evidence: Evidence[];
  fallback: DeterministicSynthesis;
  options?: RuntimeLlmOptions;
}): Promise<RuntimeSynthesisResult> {
  const options = input.options ?? {};
  const config = configured(options);
  if (!config) {
    return { synthesis: input.fallback, mode: "template", reason: "未配置运行时 LLM，已使用确定性模板" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS);
  const abortFromParent = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromParent, { once: true });
  const fetchImpl = options.fetch ?? fetch;
  try {
    const response = await fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        max_tokens: 650,
        response_format: { type: "json_object" },
        ...(isBailianBaseUrl(config.baseUrl) ? { enable_thinking: false } : {}),
        messages: [
          {
            role: "system",
            content:
              "你是A股市场状态研究助手。只能依据给定证据归纳当前状态，不预测未来，不给买卖或仓位建议。只输出JSON。解释文本不得写任何数字；如需提及沪深300或中证1000，只能分别写成 {{HS_INDEX}} 或 {{CSI_INDEX}}；所有结论必须引用给定Evidence ID。",
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "用简洁中文输出 headline、mainConflict、inferences、uncertainties；每项格式为 {text,evidenceIds}；inferences 必须为一至三项，uncertainties 为零至三项；text 不得写任何数字，指数名称仅可用 {{HS_INDEX}} 或 {{CSI_INDEX}} 占位，Evidence ID 仅放入 evidenceIds",
              plan: input.plan,
              state: input.state,
              evidence: input.evidence.map((item) => ({
                id: item.id,
                category: item.category,
                claim: item.claim,
                direction: item.direction,
                quality: item.quality,
              })),
            }),
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
    const envelope = ChatResponseSchema.parse(await response.json());
    const parsed = RuntimeSynthesisSchema.parse(JSON.parse(envelope.choices[0].message.content));
    const validationError = validateRuntimeNarrative(parsed, input.evidence);
    if (validationError) throw new Error(validationError);

    return {
      mode: "llm",
      model: config.model,
      synthesis: {
        ...input.fallback,
        headline: appendCitations(restoreCanonicalIndexNames(parsed.headline)),
        mainConflict: appendCitations(restoreCanonicalIndexNames(parsed.mainConflict)),
        inferences: parsed.inferences.map(restoreCanonicalIndexNames).map(appendCitations),
        uncertainties: parsed.uncertainties.map(restoreCanonicalIndexNames).map(appendCitations),
      },
    };
  } catch (error) {
    return {
      synthesis: input.fallback,
      mode: "template",
      reason: error instanceof Error ? `运行时 LLM 校验失败：${error.message}` : "运行时 LLM 不可用",
    };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromParent);
  }
}
