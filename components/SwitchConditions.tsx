import type { SwitchCondition } from "./market-types";
import { ArrowRight, Refresh, Target } from "./icons";

function displayValue(value: number | string | null, unit: string) {
  if (value === null || value === "") return "—";
  return `${typeof value === "number" ? Number(value.toFixed(2)) : value}${unit}`;
}

export function SwitchConditions({ conditions }: { conditions: SwitchCondition[] }) {
  return (
    <section aria-labelledby="switch-heading" className="rounded-[24px] border border-white/[0.075] bg-[#0b1513]/75 p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#d7b477]/70">
            <Refresh size={13} /> Reassessment triggers
          </div>
          <h2 id="switch-heading" className="mt-2 text-lg font-medium tracking-[-0.02em] text-white/85">何时需要重新判断</h2>
        </div>
        <p className="max-w-md text-right text-[10px] leading-5 text-white/30">这些是可观测触发条件，不代表系统预测它们一定发生。</p>
      </div>

      {conditions.length ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {conditions.map((condition, index) => (
            <article key={condition.id} className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-black/15 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.045] text-white/45"><Target size={13} /></span>
                <span className="font-mono text-[9px] text-white/18">{condition.id || `T${index + 1}`}</span>
              </div>
              <h3 className="mt-3 text-xs font-medium text-white/70">{condition.metric}</h3>
              <div className="mt-3 flex items-center gap-2 text-xs tabular-nums">
                <span className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-white/48">{displayValue(condition.currentValue, condition.unit)}</span>
                <ArrowRight size={13} className="text-white/25" />
                <span className="rounded-lg border border-[#d7b477]/15 bg-[#d7b477]/[0.05] px-2.5 py-1.5 font-medium text-[#ead3a8]/75">
                  {condition.operator} {displayValue(condition.threshold, condition.unit)}
                </span>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-white/34">{condition.reason}</p>
              <dl className="mt-3 space-y-2 border-t border-white/[0.055] pt-3 text-[10px] leading-5">
                <div className="grid grid-cols-[52px_1fr] gap-2">
                  <dt className="text-white/25">确认规则</dt>
                  <dd className="text-white/45">{condition.persistence}</dd>
                </div>
                <div className="grid grid-cols-[52px_1fr] gap-2">
                  <dt className="text-white/25">触发后</dt>
                  <dd className="text-[#ead3a8]/60">{condition.consequence}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-white/[0.08] px-4 py-7 text-center text-xs text-white/28">
          当前响应未提供可验证的状态切换条件。
        </div>
      )}
    </section>
  );
}
