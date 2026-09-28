"use client";

import { useEffect } from "react";
import type { EvidenceView, MetricView, SourceView } from "./market-types";
import { Close, Database, ExternalLink, Info, Layers } from "./icons";

interface EvidenceDrawerProps {
  evidence: EvidenceView | null;
  metrics: MetricView[];
  sources: SourceView[];
  onClose: () => void;
}

const statusText: Record<EvidenceView["status"], string> = {
  ok: "数据可用",
  missing: "数据缺失",
  stale: "数据过期",
  conflict: "口径冲突",
  unavailable: "本次未覆盖",
};

const kindText: Record<EvidenceView["kind"], string> = {
  fact: "事实",
  inference: "归纳",
  uncertain: "不确定判断",
};

export function EvidenceDrawer({ evidence, metrics, sources, onClose }: EvidenceDrawerProps) {
  useEffect(() => {
    if (!evidence) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [evidence, onClose]);

  if (!evidence) return null;

  const linkedMetrics = metrics.filter((metric) => evidence.metricIds.includes(metric.id));
  const sourceIds = new Set(linkedMetrics.flatMap((metric) => metric.sourceIds));
  const linkedSources = sources.filter((source) => sourceIds.has(source.id));

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="evidence-drawer-title">
      <button type="button" aria-label="关闭证据详情" onClick={onClose} className="absolute inset-0 bg-[#020605]/75 backdrop-blur-sm" />
      <aside className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l border-white/[0.1] bg-[#091310] shadow-[-30px_0_80px_rgba(0,0,0,0.45)]">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.07] bg-[#091310]/95 px-5 py-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3">
            <span className="rounded-md border border-emerald-300/15 bg-emerald-300/[0.06] px-2 py-1 font-mono text-[10px] text-emerald-200/65">{evidence.id}</span>
            <div>
              <div className="text-[9px] uppercase tracking-[0.14em] text-white/28">Evidence trace</div>
              <h2 id="evidence-drawer-title" className="text-sm font-medium text-white/75">证据追溯</h2>
            </div>
          </div>
          <button autoFocus type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-white/40 transition hover:bg-white/[0.05] hover:text-white" aria-label="关闭">
            <Close size={16} />
          </button>
        </header>

        <div className="space-y-7 p-5 sm:p-7">
          <section>
            <div className="flex flex-wrap gap-2 text-[9px]">
              <span className="rounded-full border border-white/[0.08] px-2 py-1 text-white/40">{kindText[evidence.kind]}</span>
              <span className="rounded-full border border-white/[0.08] px-2 py-1 text-white/40">{statusText[evidence.status]}</span>
              <span className="rounded-full border border-white/[0.08] px-2 py-1 text-white/40">截至 {evidence.asOf || "未提供"}</span>
            </div>
            <h3 className="mt-4 text-lg font-medium leading-7 tracking-[-0.015em] text-white/86">{evidence.statement}</h3>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <DetailCell label="观测值" value={displayValue(evidence.value, evidence.unit)} />
              <DetailCell label="观察窗口" value={evidence.window || "未提供"} />
            </div>
          </section>

          <section className="border-t border-white/[0.07] pt-6">
            <SectionTitle icon={<Layers size={14} />} eyebrow="Metrics" title="指标与计算口径" />
            {linkedMetrics.length ? (
              <div className="mt-4 space-y-3">
                {linkedMetrics.map((metric) => (
                  <div key={metric.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-mono text-[9px] text-sky-200/50">{metric.id}</span>
                        <h4 className="mt-1 text-xs font-medium text-white/68">{metric.name}</h4>
                      </div>
                      <span className="text-sm font-medium tabular-nums text-white/72">{displayValue(metric.value, metric.unit)}</span>
                    </div>
                    <div className="mt-3 border-t border-white/[0.05] pt-3">
                      <div className="text-[9px] uppercase tracking-wider text-white/24">计算公式</div>
                      <p className="mt-1 font-mono text-[10px] leading-5 text-white/38">{metric.formula}</p>
                    </div>
                    <div className="mt-2 flex justify-between text-[9px] text-white/24">
                      <span>{metric.window || "窗口未标明"}</span><span>{metric.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyDetail text="响应未提供该证据对应的指标明细。" />
            )}
          </section>

          <section className="border-t border-white/[0.07] pt-6">
            <SectionTitle icon={<Database size={14} />} eyebrow="Sources" title="原始数据来源" />
            {linkedSources.length ? (
              <div className="mt-4 space-y-3">
                {linkedSources.map((source) => (
                  <article key={source.id} className="rounded-2xl border border-white/[0.07] bg-black/15 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-[9px] text-emerald-200/45">{source.id}</div>
                        <h4 className="mt-1 text-xs font-medium text-white/68">{source.provider} · {source.dataset}</h4>
                      </div>
                      {source.url && (
                        <a href={source.url} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] text-white/30 transition hover:text-white/65" aria-label="打开数据源">
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                    <dl className="mt-4 grid gap-2 text-[10px]">
                      <div className="flex justify-between gap-4"><dt className="text-white/27">市场日期</dt><dd className="text-right text-white/48">{source.marketDate || "未提供"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-white/27">抓取时间</dt><dd className="text-right text-white/48">{source.fetchedAt || "未提供"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-white/27">原始字段</dt><dd className="max-w-[70%] text-right font-mono text-white/48">{source.rawFields.join(", ") || "未提供"}</dd></div>
                    </dl>
                    {source.requestParams && (
                      <details className="mt-3 border-t border-white/[0.05] pt-3">
                        <summary className="cursor-pointer text-[9px] text-white/30">查看请求参数</summary>
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-black/25 p-3 font-mono text-[9px] leading-4 text-white/38">{JSON.stringify(source.requestParams, null, 2)}</pre>
                      </details>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyDetail text="响应未提供可继续追溯的来源字段。" />
            )}
          </section>

          <div className="flex gap-2 rounded-xl border border-sky-300/10 bg-sky-300/[0.035] p-3 text-[10px] leading-5 text-sky-100/45">
            <Info size={13} className="mt-0.5 shrink-0" />
            页面仅展示服务端返回的指标、公式和来源；缺少的追溯信息会明确标注，不进行补写。
          </div>
        </div>
      </aside>
    </div>
  );
}

function displayValue(value: number | string | null, unit: string) {
  if (value === null || value === "") return "—";
  const formatted = typeof value === "number" ? Number(value.toFixed(3)) : value;
  return `${formatted}${unit}`;
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.065] bg-white/[0.025] p-3">
      <div className="text-[9px] uppercase tracking-wider text-white/24">{label}</div>
      <div className="mt-1.5 text-sm font-medium tabular-nums text-white/66">{value}</div>
    </div>
  );
}

function SectionTitle({ icon, eyebrow, title }: { icon: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <div className="flex items-center gap-2 text-white/55">
      {icon}
      <div><div className="text-[8px] uppercase tracking-[0.16em] text-white/23">{eyebrow}</div><h3 className="text-xs font-medium text-white/62">{title}</h3></div>
    </div>
  );
}

function EmptyDetail({ text }: { text: string }) {
  return <div className="mt-4 rounded-xl border border-dashed border-white/[0.07] p-4 text-[10px] text-white/25">{text}</div>;
}
