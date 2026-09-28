import type { FormEvent } from "react";
import type { Horizon, Intent } from "./market-types";
import { ArrowRight, Search, Shield, Sparkles } from "./icons";

interface ResearchInputProps {
  horizon: Horizon;
  question: string;
  loading: boolean;
  onHorizonChange: (value: Horizon) => void;
  onQuestionChange: (value: string) => void;
  onSubmit: (intent?: Intent, questionOverride?: string) => void;
}

const prompts: Array<{ label: string; value: string; intent: Intent }> = [
  {
    label: "当前状态与主要矛盾",
    value: "当前沪深 300 处于什么市场状态？主要矛盾和状态切换条件是什么？",
    intent: "market_state",
  },
  {
    label: "哪些变量会改变判断",
    value: "当前哪些已观测变量最可能改变沪深 300 的状态判断？",
    intent: "risk_variables",
  },
  {
    label: "大小盘风格如何分化",
    value: "当前大盘与小盘风格的相对强弱如何？有哪些支持和反证？",
    intent: "style_rotation",
  },
];

export function ResearchInput({
  horizon,
  question,
  loading,
  onHorizonChange,
  onQuestionChange,
  onSubmit,
}: ResearchInputProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <section aria-labelledby="research-input-heading" className="relative overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#0c1715]/85 shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-300/[0.055] blur-3xl" />
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_260px]">
        <form onSubmit={handleSubmit} className="relative p-5 sm:p-7 lg:p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
                <Sparkles size={14} /> Research brief
              </div>
              <h2 id="research-input-heading" className="text-xl font-medium tracking-[-0.02em] text-white sm:text-2xl">
                你想理解市场的哪一面？
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                研究范围固定为沪深 300。系统会把问题约束到可验证的指标与证据，不做涨跌预测。
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-white/[0.08] bg-black/20 p-1" aria-label="观察窗口">
              {([20, 60] as Horizon[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onHorizonChange(value)}
                  disabled={loading}
                  aria-pressed={horizon === value}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                    horizon === value
                      ? "bg-white/[0.11] text-white shadow-sm"
                      : "text-white/40 hover:text-white/70"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {value} 日
                </button>
              ))}
            </div>
          </div>

          <div className="group rounded-2xl border border-white/[0.1] bg-black/20 p-2 transition focus-within:border-emerald-300/35 focus-within:bg-black/25 focus-within:shadow-[0_0_0_3px_rgba(110,231,183,0.05)]">
            <div className="flex items-start gap-2.5">
              <Search size={18} className="ml-2 mt-3 shrink-0 text-white/35" />
              <textarea
                value={question}
                onChange={(event) => onQuestionChange(event.target.value)}
                disabled={loading}
                rows={3}
                maxLength={300}
                aria-label="研究问题"
                placeholder="例如：当前沪深 300 处于什么市场状态？"
                className="min-h-24 w-full resize-none bg-transparent px-1 py-2.5 text-[15px] leading-7 text-white outline-none placeholder:text-white/25 disabled:opacity-60"
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-2 pt-2">
              <span className="text-[10px] tabular-nums text-white/25">{question.length}/300</span>
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-[#d7b477] px-4 py-2.5 text-sm font-semibold text-[#15130d] transition hover:bg-[#e4c58e] focus:outline-none focus:ring-2 focus:ring-[#d7b477]/40 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#15130d]/25 border-t-[#15130d]" />
                    正在研判
                  </>
                ) : (
                  <>
                    开始研判 <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] text-white/30">快速问题</span>
            {prompts.map((prompt) => (
              <button
                key={prompt.intent}
                type="button"
                disabled={loading}
                onClick={() => {
                  onQuestionChange(prompt.value);
                  onSubmit(prompt.intent, prompt.value);
                }}
                className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[11px] text-white/50 transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        </form>

        <aside className="relative border-t border-white/[0.07] bg-white/[0.018] p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-7">
          <div className="flex items-center gap-2 text-xs font-semibold text-white/75">
            <Shield size={15} className="text-emerald-300" />
            研究边界
          </div>
          <p className="mt-3 text-xs leading-6 text-white/40">
            输出描述当前证据状态，明确事实、归纳和不确定性。不会提供个股推荐、仓位建议、收益承诺或确定性涨跌预测。
          </p>
          <div className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-5 text-[11px] text-white/38">
            <div className="flex items-center justify-between"><span>研究对象</span><span className="font-medium text-white/70">沪深 300</span></div>
            <div className="flex items-center justify-between"><span>观察窗口</span><span className="font-medium text-white/70">{horizon} 个交易日</span></div>
            <div className="flex items-center justify-between"><span>输出类型</span><span className="font-medium text-white/70">条件化判断</span></div>
          </div>
        </aside>
      </div>
    </section>
  );
}
