"use client";

import { useState } from "react";
import type { ResearchPlan, StepStatus } from "./market-types";
import { Check, ChevronDown, Clock, Database, Layers, X } from "./icons";

const stepMeta: Record<StepStatus, { label: string; icon: typeof Check; tone: string; iconTone: string }> = {
  waiting: { label: "等待", icon: Clock, tone: "text-white/35", iconTone: "border-white/10 bg-white/[0.03]" },
  running: { label: "执行中", icon: Clock, tone: "text-sky-200", iconTone: "border-sky-300/25 bg-sky-300/10" },
  success: { label: "完成", icon: Check, tone: "text-emerald-200", iconTone: "border-emerald-300/25 bg-emerald-300/10" },
  degraded: { label: "降级", icon: Database, tone: "text-amber-200", iconTone: "border-amber-300/25 bg-amber-300/10" },
  failed: { label: "失败", icon: X, tone: "text-rose-200", iconTone: "border-rose-300/25 bg-rose-300/10" },
};

export function ExecutionTrace({ plan, loading }: { plan: ResearchPlan | null; loading: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const completeCount = plan?.steps.filter((step) => step.status === "success" || step.status === "degraded").length ?? 0;

  return (
    <section className="rounded-2xl border border-white/[0.075] bg-[#0b1513]/70">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-white/55">
            <Layers size={15} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-medium text-white/82">研究执行轨迹</h2>
              {plan && (
                <span className="rounded-full border border-white/[0.07] px-2 py-0.5 text-[10px] text-white/35">
                  {completeCount}/{plan.steps.length} 步完成
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-white/32">
              {loading
                ? "服务端正在执行受限计划，完成后将展示真实步骤"
                : plan
                  ? `${plan.scope} · ${plan.horizon} 个交易日 · ${intentLabel(plan.intent)}`
                  : "提交问题后显示实际调用与降级情况"}
            </p>
          </div>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-white/35 transition ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] px-5 py-5 sm:px-6">
          {loading ? (
            <div className="flex items-center gap-3 rounded-xl border border-sky-300/10 bg-sky-300/[0.035] px-4 py-3 text-xs text-sky-100/70">
              <span className="h-2 w-2 animate-pulse rounded-full bg-sky-300" />
              等待服务端返回实际执行记录；此处不模拟未发生的工具调用。
            </div>
          ) : plan?.steps.length ? (
            <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {plan.steps.map((step, index) => {
                const meta = stepMeta[step.status];
                const Icon = meta.icon;
                return (
                  <li key={step.id} className="relative rounded-xl border border-white/[0.065] bg-black/15 px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${meta.iconTone}`}>
                        <Icon size={13} className={meta.tone} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium text-white/75">{step.label}</span>
                          <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider ${meta.tone}`}>{meta.label}</span>
                        </div>
                        {step.detail && <p className="mt-1.5 text-[11px] leading-5 text-white/35">{step.detail}</p>}
                        {step.source && (
                          <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-white/28">
                            <Database size={10} /> {step.source}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="absolute right-3 top-3 font-mono text-[9px] text-white/15">{String(index + 1).padStart(2, "0")}</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="py-2 text-center text-xs text-white/30">尚无执行记录</p>
          )}
        </div>
      )}
    </section>
  );
}

function intentLabel(intent: ResearchPlan["intent"]) {
  if (intent === "style_rotation") return "风格轮动";
  if (intent === "risk_variables") return "风险变量";
  return "市场状态";
}
