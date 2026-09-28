import type { AnalyzeView, DataMode, HealthStatus } from "./market-types";
import { Activity, Clock, Database, Shield } from "./icons";

const modeMeta: Record<DataMode, { label: string; detail: string; tone: string }> = {
  live: { label: "实时数据", detail: "在线数据源", tone: "text-emerald-200 bg-emerald-400/10 border-emerald-300/20" },
  snapshot: { label: "历史快照", detail: "可追溯历史数据", tone: "text-sky-200 bg-sky-400/10 border-sky-300/20" },
  demo: { label: "演示数据", detail: "不用于真实研判", tone: "text-amber-200 bg-amber-400/10 border-amber-300/20" },
  unavailable: { label: "等待取数", detail: "尚无数据结果", tone: "text-white/55 bg-white/[0.04] border-white/10" },
};

const healthMeta: Record<HealthStatus, { label: string; dot: string; tone: string }> = {
  healthy: { label: "数据健康", dot: "bg-emerald-300", tone: "text-emerald-100" },
  partial: { label: "部分可用", dot: "bg-amber-300", tone: "text-amber-100" },
  stale: { label: "数据过期", dot: "bg-orange-300", tone: "text-orange-100" },
  failed: { label: "数据失败", dot: "bg-rose-300", tone: "text-rose-100" },
};

function formatTimestamp(value: string | null) {
  if (!value) return "待分析";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function DataHealthBar({ result, loading }: { result: AnalyzeView | null; loading: boolean }) {
  const mode = modeMeta[result?.mode ?? "unavailable"];
  const health = healthMeta[result?.health.status ?? "partial"];

  return (
    <div className="border-b border-white/[0.07] bg-[#07100f]/90 px-4 py-2.5 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-x-5 gap-y-2 text-[11px] tracking-wide text-white/48">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 font-medium text-white/70">
            <Shield size={13} className="text-emerald-300" />
            研究辅助 · 非投资建议
          </span>
          <span className="hidden h-3 w-px bg-white/10 sm:block" />
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 ${mode.tone}`} title={mode.detail}>
            <Database size={12} />
            {loading ? "正在取数" : mode.label}
          </span>
          <span className={`inline-flex items-center gap-1.5 ${health.tone}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${loading ? "animate-pulse bg-sky-300" : health.dot}`} />
            {loading ? "分析进行中" : result ? health.label : "尚未分析"}
          </span>
        </div>

        <div className="flex items-center gap-4 tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <Activity size={12} />
            市场日 {result?.asOf ?? "—"}
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <Clock size={12} />
            抓取 {formatTimestamp(result?.fetchedAt ?? null)}
          </span>
        </div>
      </div>
    </div>
  );
}
