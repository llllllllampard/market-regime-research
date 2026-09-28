import type { AnalyzeView } from "./market-types";
import { AlertTriangle, ArrowRight, Info, Shield } from "./icons";

export function HealthNotice({ result }: { result: AnalyzeView }) {
  const reasons = result.health.reasons;
  const limitations = result.analysis?.limitations ?? [];
  if (result.health.status === "healthy" && reasons.length === 0 && limitations.length === 0) return null;

  const limitationsOnly = result.health.status === "healthy" && reasons.length === 0;

  return (
    <div className={`rounded-2xl border px-5 py-4 ${limitationsOnly ? "border-sky-300/12 bg-sky-300/[0.035]" : "border-amber-300/15 bg-amber-300/[0.045]"}`}>
      <div className="flex items-start gap-3">
        {limitationsOnly
          ? <Info size={15} className="mt-0.5 shrink-0 text-sky-200/65" />
          : <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-200/70" />}
        <div className="min-w-0">
          <h2 className={`text-xs font-medium ${limitationsOnly ? "text-sky-100/72" : "text-amber-100/72"}`}>
            {limitationsOnly ? "本次研究范围说明" : result.health.status === "stale" ? "本次数据已过期" : result.health.status === "failed" ? "数据获取失败" : "本次分析存在降级"}
          </h2>
          <ul className={`mt-1.5 space-y-1 text-[10px] leading-5 ${limitationsOnly ? "text-sky-100/42" : "text-amber-100/42"}`}>
            {[...reasons, ...limitations].filter(Boolean).map((item, index) => <li key={`${item}-${index}`}>· {item}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function CompliancePanel({
  message,
  suggestedQuestion,
  onContinue,
  loading,
}: {
  message: string;
  suggestedQuestion: string;
  onContinue: () => void;
  loading: boolean;
}) {
  return (
    <section className="relative overflow-hidden rounded-[26px] border border-sky-300/15 bg-[#0b1718]/85 p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-sky-300/[0.06] blur-3xl" />
      <div className="relative flex max-w-3xl items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-300/15 bg-sky-300/[0.06] text-sky-200/75"><Shield size={18} /></span>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-sky-200/50">Research boundary</div>
          <h2 className="mt-1.5 text-xl font-medium text-white/82">已转换为可研究的问题</h2>
          <p className="mt-3 text-sm leading-6 text-white/48">{message}</p>
          <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/15 p-4">
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-wider text-white/28"><Info size={11} /> 建议继续</div>
            <p className="mt-2 text-xs leading-5 text-white/63">{suggestedQuestion}</p>
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={loading}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-100 px-4 py-2.5 text-xs font-semibold text-[#071315] transition hover:bg-white disabled:opacity-50"
          >
            按合规问题研判 <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}

export function ErrorPanel({ message, onRetry, loading }: { message: string; onRetry: () => void; loading: boolean }) {
  return (
    <section className="rounded-[24px] border border-rose-300/15 bg-rose-300/[0.035] p-6 text-center sm:p-8">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-rose-300/15 bg-rose-300/[0.06] text-rose-200/65"><AlertTriangle size={18} /></span>
      <h2 className="mt-4 text-base font-medium text-white/78">本次研判未完成</h2>
      <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-white/38">{message}</p>
      <button type="button" onClick={onRetry} disabled={loading} className="mt-5 rounded-xl border border-white/[0.1] bg-white/[0.055] px-4 py-2.5 text-xs font-medium text-white/68 transition hover:bg-white/[0.09] disabled:opacity-50">
        {loading ? "正在重试…" : "重新执行"}
      </button>
    </section>
  );
}
