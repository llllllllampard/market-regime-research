import type { EvidenceView } from "./market-types";
import { EVIDENCE_DIMENSIONS } from "./market-types";
import { ChevronRight, Database, Info } from "./icons";

interface EvidenceLedgerProps {
  evidence: EvidenceView[];
  onEvidenceOpen: (evidence: EvidenceView) => void;
}

const stanceMeta = {
  support: { label: "支持", tone: "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200/70", bar: "bg-emerald-300" },
  counter: { label: "反证", tone: "border-rose-300/15 bg-rose-300/[0.055] text-rose-200/70", bar: "bg-rose-300" },
  neutral: { label: "中性", tone: "border-white/[0.08] bg-white/[0.035] text-white/40", bar: "bg-white/25" },
};

const statusLabel: Record<EvidenceView["status"], string> = {
  ok: "可用",
  stale: "过期",
  missing: "缺失",
  conflict: "冲突",
  unavailable: "未覆盖",
};

function displayValue(evidence: EvidenceView) {
  if (evidence.value === null || evidence.value === "") return "—";
  if (typeof evidence.value === "number") {
    const value = Math.abs(evidence.value) < 10 ? Number(evidence.value.toFixed(2)) : Number(evidence.value.toFixed(1));
    return `${value}${evidence.unit}`;
  }
  return `${evidence.value}${evidence.unit}`;
}

export function EvidenceLedger({ evidence, onEvidenceOpen }: EvidenceLedgerProps) {
  return (
    <section aria-labelledby="evidence-ledger-heading" className="overflow-hidden rounded-[24px] border border-white/[0.075] bg-[#0b1513]/75">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.065] px-5 py-5 sm:px-7 sm:py-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-300/65">
            <Database size={13} /> Evidence ledger
          </div>
          <h2 id="evidence-ledger-heading" className="mt-2 text-lg font-medium tracking-[-0.02em] text-white/85">七维证据台账</h2>
        </div>
        <div className="flex max-w-md items-start gap-2 text-[10px] leading-5 text-white/30">
          <Info size={12} className="mt-1 shrink-0" />
          缺失维度保留在台账中并影响置信度，不用其他指标静默替代。
        </div>
      </div>

      <div className="divide-y divide-white/[0.055]">
        {EVIDENCE_DIMENSIONS.map((dimension, dimensionIndex) => {
          const entries = evidence.filter((item) => item.category === dimension.key);
          const available = entries.length > 0;
          return (
            <div key={dimension.key} className="grid min-h-24 transition hover:bg-white/[0.012] md:grid-cols-[190px_minmax(0,1fr)]">
              <div className="flex items-center gap-3 px-5 py-4 sm:px-7 md:border-r md:border-white/[0.055]">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-mono text-[10px] ${available ? "border-white/[0.09] bg-white/[0.035] text-white/52" : "border-white/[0.05] bg-transparent text-white/20"}`}>
                  {String(dimensionIndex + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className={`text-xs font-medium ${available ? "text-white/72" : "text-white/32"}`}>{dimension.label}</h3>
                  <p className="mt-1 text-[9px] leading-4 text-white/22">{dimension.description}</p>
                </div>
              </div>

              <div className="px-5 pb-4 sm:px-7 md:py-3">
                {available ? (
                  <div className="divide-y divide-white/[0.045]">
                    {entries.map((item) => {
                      const stance = stanceMeta[item.stance];
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onEvidenceOpen(item)}
                          className="group grid w-full gap-3 py-3 text-left outline-none transition focus-visible:bg-white/[0.025] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[9px] text-emerald-200/48">{item.id}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[9px] ${stance.tone}`}>{stance.label}</span>
                              {item.status !== "ok" && <span className="text-[9px] text-amber-200/55">{statusLabel[item.status]}</span>}
                            </div>
                            <p className="mt-1.5 text-xs leading-5 text-white/53 transition group-hover:text-white/72">{item.statement}</p>
                          </div>
                          <div className="flex items-center justify-between gap-4 sm:justify-end">
                            <div className="text-left sm:text-right">
                              <div className="text-sm font-medium tabular-nums text-white/72">{displayValue(item)}</div>
                              <div className="mt-1 text-[9px] text-white/25">{item.window || "当前"} · {item.asOf || "时点未提供"}</div>
                            </div>
                            <ChevronRight size={14} className="text-white/22 transition group-hover:translate-x-0.5 group-hover:text-white/50" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-dashed border-white/[0.055] px-4 py-3">
                    <div>
                      <div className="text-[10px] font-medium text-white/30">本次未覆盖 / 数据不可用</div>
                      <p className="mt-1 text-[9px] text-white/19">没有生成该维度结论，避免补全不存在的证据。</p>
                    </div>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/15" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
