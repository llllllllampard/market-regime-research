import type { AnalysisView, NarrativeItem } from "./market-types";
import { AlertTriangle, Check, Compass, Info, Sparkles, Target } from "./icons";

interface MarketSummaryProps {
  analysis: AnalysisView;
  onEvidenceOpen: (id: string) => void;
}

export function MarketSummary({ analysis, onEvidenceOpen }: MarketSummaryProps) {
  const confidence = analysis.confidence;
  const angle = Math.round(confidence.score * 3.6);

  return (
    <section aria-labelledby="market-summary-heading" className="overflow-hidden rounded-[26px] border border-white/[0.085] bg-[#0b1614]/85 shadow-[0_26px_70px_rgba(0,0,0,0.24)]">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative p-5 sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute left-0 top-0 h-56 w-56 rounded-full bg-emerald-300/[0.035] blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/[0.075] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-emerald-200">
                <Compass size={12} /> 当前状态
              </span>
              <span className="text-[10px] text-white/28">基于当前可用证据的分类，不是行情预测</span>
            </div>

            <h2 id="market-summary-heading" className="mt-5 text-2xl font-medium tracking-[-0.035em] text-white sm:text-[32px] sm:leading-tight">
              {analysis.state}
            </h2>
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-white/68">{analysis.headline}</p>

            <div className="mt-6 rounded-2xl border border-[#d7b477]/15 bg-[#d7b477]/[0.045] p-4 sm:p-5">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d7b477]/75">
                <Target size={13} /> 主要矛盾
              </div>
              <p className="mt-2 text-sm leading-6 text-[#f4e6ca]/80">{analysis.mainConflict}</p>
            </div>
          </div>
        </div>

        <aside className="border-t border-white/[0.07] bg-black/[0.13] p-5 sm:p-7 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/34">Evidence confidence</div>
              <div className="mt-1 text-sm font-medium text-white/75">证据置信度</div>
            </div>
            <div
              className="grid h-[74px] w-[74px] place-items-center rounded-full"
              style={{ background: `conic-gradient(#7ee2ba 0deg ${angle}deg, rgba(255,255,255,.07) ${angle}deg 360deg)` }}
              aria-label={`置信度 ${Math.round(confidence.score)} 分`}
            >
              <div className="grid h-[62px] w-[62px] place-items-center rounded-full bg-[#0a1412] text-center">
                <div><span className="text-xl font-semibold tabular-nums text-white">{Math.round(confidence.score)}</span><span className="text-[9px] text-white/30"> /100</span></div>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3.5">
            <ConfidenceBar label="数据质量" value={confidence.components.dataQuality} />
            <ConfidenceBar label="证据一致性" value={confidence.components.consistency} />
            <ConfidenceBar label="阈值安全边际" value={confidence.components.margin} />
          </div>

          <div className="mt-5 flex gap-2 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-white/35">
            <Info size={13} className="mt-0.5 shrink-0 text-sky-200/65" />
            <p>{confidence.meaning || "置信度衡量当前证据质量，不代表未来上涨概率。"}</p>
          </div>
          {confidence.reasons.length > 0 && (
            <ul className="mt-3 space-y-1 text-[10px] leading-4 text-amber-100/45">
              {confidence.reasons.map((reason) => <li key={reason}>· {reason}</li>)}
            </ul>
          )}
        </aside>
      </div>

      <div className="grid border-t border-white/[0.07] lg:grid-cols-3">
        <NarrativeColumn
          title="已验证事实"
          eyebrow="Facts"
          items={analysis.facts}
          icon={<Check size={14} />}
          tone="text-emerald-200"
          border=""
          onEvidenceOpen={onEvidenceOpen}
        />
        <NarrativeColumn
          title="证据归纳"
          eyebrow="Inference"
          items={analysis.inferences}
          icon={<Sparkles size={14} />}
          tone="text-sky-200"
          border="border-t lg:border-l lg:border-t-0"
          onEvidenceOpen={onEvidenceOpen}
        />
        <NarrativeColumn
          title="仍需留意"
          eyebrow="Uncertainty"
          items={analysis.uncertainties}
          icon={<AlertTriangle size={14} />}
          tone="text-amber-200"
          border="border-t lg:border-l lg:border-t-0"
          onEvidenceOpen={onEvidenceOpen}
        />
      </div>
    </section>
  );
}

function ConfidenceBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[10px]">
        <span className="text-white/38">{label}</span>
        <span className="font-medium tabular-nums text-white/62">{Math.round(value)}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400/55 to-emerald-200/85" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function NarrativeColumn({
  title,
  eyebrow,
  items,
  icon,
  tone,
  border,
  onEvidenceOpen,
}: {
  title: string;
  eyebrow: string;
  items: NarrativeItem[];
  icon: React.ReactNode;
  tone: string;
  border: string;
  onEvidenceOpen: (id: string) => void;
}) {
  return (
    <div className={`${border} border-white/[0.07] p-5 sm:p-6`}>
      <div className={`flex items-center gap-2 ${tone}`}>
        {icon}
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] opacity-55">{eyebrow}</div>
          <h3 className="text-xs font-medium text-white/72">{title}</h3>
        </div>
      </div>
      {items.length ? (
        <ul className="mt-4 space-y-4">
          {items.map((item, index) => (
            <li key={`${item.text}-${index}`} className="text-xs leading-6 text-white/48">
              {item.text}
              {item.evidenceIds.length > 0 && (
                <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">
                  {item.evidenceIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onEvidenceOpen(id)}
                      className="rounded border border-white/[0.09] bg-white/[0.035] px-1.5 py-0.5 font-mono text-[9px] leading-none text-emerald-200/65 transition hover:border-emerald-300/25 hover:text-emerald-100"
                      aria-label={`查看证据 ${id}`}
                    >
                      {id}
                    </button>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs leading-5 text-white/25">本次没有可展示的{title}。</p>
      )}
    </div>
  );
}
