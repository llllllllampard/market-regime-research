import type { AnalyzeView } from "./market-types";
import { ArrowRight, Check, Layers, Sparkles } from "./icons";

interface StyleFollowupProps {
  result: AnalyzeView | null;
  loading: boolean;
  error: string | null;
  onRun: () => void;
  onEvidenceOpen: (id: string) => void;
}

export function StyleFollowup({ result, loading, error, onRun, onEvidenceOpen }: StyleFollowupProps) {
  const analysis = result?.analysis;

  return (
    <section aria-labelledby="style-followup-heading" className="relative overflow-hidden rounded-[24px] border border-[#d7b477]/15 bg-[#17170f]/55 p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-14 -top-20 h-52 w-52 rounded-full bg-[#d7b477]/[0.055] blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#d7b477]/65"><Layers size={13} /> Continue research</div>
            <h2 id="style-followup-heading" className="mt-2 text-lg font-medium tracking-[-0.02em] text-white/85">继续研究：大小盘风格</h2>
            <p className="mt-2 text-xs leading-6 text-white/36">
              复用同一研究窗口，追加沪深 300 与小盘代表指数的相对强弱证据；返回支持、反证与不确定性。
            </p>
          </div>
          <button
            type="button"
            onClick={onRun}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#d7b477]/20 bg-[#d7b477]/[0.08] px-4 py-2.5 text-xs font-medium text-[#ead3a8]/80 transition hover:bg-[#d7b477]/[0.13] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-[#d7b477]/20 border-t-[#d7b477]" /> 正在追加研究</> : <>{analysis ? "重新研究" : "展开风格证据"} <ArrowRight size={14} /></>}
          </button>
        </div>

        {error && <p className="mt-5 rounded-xl border border-rose-300/10 bg-rose-300/[0.04] p-3 text-[10px] text-rose-100/55">{error}</p>}

        {analysis && (
          <div className="mt-6 border-t border-[#d7b477]/10 pt-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
              <div>
                <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-[#d7b477]/45"><Sparkles size={12} /> 风格归纳</div>
                <h3 className="mt-2 text-base font-medium text-white/76">{analysis.headline}</h3>
                <p className="mt-2 text-xs leading-6 text-white/42">{analysis.mainConflict}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/15 p-4">
                <div className="text-[9px] uppercase tracking-wider text-white/24">本次执行</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {result?.plan?.steps.map((step) => (
                    <span key={step.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] ${step.status === "success" ? "border-emerald-300/12 text-emerald-100/45" : "border-amber-300/12 text-amber-100/45"}`}>
                      {step.status === "success" && <Check size={9} />} {step.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <FollowupList title="事实" items={analysis.facts} onEvidenceOpen={onEvidenceOpen} />
              <FollowupList title="归纳" items={analysis.inferences} onEvidenceOpen={onEvidenceOpen} />
              <FollowupList title="不确定性" items={analysis.uncertainties} onEvidenceOpen={onEvidenceOpen} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FollowupList({ title, items, onEvidenceOpen }: { title: string; items: { text: string; evidenceIds: string[] }[]; onEvidenceOpen: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-4">
      <div className="text-[10px] font-medium text-white/45">{title}</div>
      {items.length ? (
        <ul className="mt-3 space-y-3">
          {items.map((item, index) => (
            <li key={`${item.text}-${index}`} className="text-[10px] leading-5 text-white/36">
              {item.text}
              {item.evidenceIds.map((id) => <button type="button" onClick={() => onEvidenceOpen(id)} key={id} className="ml-1 font-mono text-[9px] text-emerald-200/50 hover:text-emerald-100">[{id}]</button>)}
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-[10px] text-white/20">暂无</p>}
    </div>
  );
}
