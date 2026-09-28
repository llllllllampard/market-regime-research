"use client";

import { useCallback, useRef, useState } from "react";
import { DataHealthBar } from "./DataHealthBar";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { EvidenceLedger } from "./EvidenceLedger";
import { ExecutionTrace } from "./ExecutionTrace";
import { MarketSummary } from "./MarketSummary";
import { ResearchInput } from "./ResearchInput";
import { CompliancePanel, ErrorPanel, HealthNotice } from "./ResultNotices";
import { StyleFollowup } from "./StyleFollowup";
import { SwitchConditions } from "./SwitchConditions";
import type { AnalyzeView, EvidenceView, Horizon, Intent, MetricView, SourceView } from "./market-types";
import { normalizeAnalyzeResponse } from "./market-types";
import { Activity, Database, Shield, Sparkles } from "./icons";

const DEFAULT_QUESTION = "当前沪深 300 处于什么市场状态？主要矛盾和状态切换条件是什么？";
const STYLE_QUESTION = "当前大盘与小盘风格的相对强弱如何？有哪些支持证据、反证和不确定性？";
const SESSION_STORAGE_KEY = "market-regime-analysis-session";
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

let ephemeralSessionId: string | null = null;

function createSessionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function analysisSessionId(): string {
  if (ephemeralSessionId) return ephemeralSessionId;
  try {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored && SESSION_ID_PATTERN.test(stored)) {
      ephemeralSessionId = stored;
      return stored;
    }
    const nextId = createSessionId();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, nextId);
    ephemeralSessionId = nextId;
    return nextId;
  } catch {
    ephemeralSessionId = createSessionId();
    return ephemeralSessionId;
  }
}

type DrawerContext = {
  evidence: EvidenceView;
  metrics: MetricView[];
  sources: SourceView[];
};

type LastRequest = { horizon: Horizon; question: string; intent?: Intent };

async function postAnalysis(request: LastRequest, signal?: AbortSignal): Promise<AnalyzeView> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Market-Session-Id": analysisSessionId(),
    },
    body: JSON.stringify(request),
    signal,
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("分析服务返回了无法读取的响应，请稍后重试。");
  }

  const normalized = normalizeAnalyzeResponse(payload);
  if (!response.ok && normalized.status !== "blocked") {
    const raw = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const error = raw.error && typeof raw.error === "object" ? (raw.error as Record<string, unknown>) : {};
    const message = typeof error.message === "string"
      ? error.message
      : typeof raw.message === "string"
        ? raw.message
        : `分析服务暂时不可用（${response.status}）`;
    throw new Error(message);
  }
  return normalized;
}

export function MarketWorkspace() {
  const [horizon, setHorizon] = useState<Horizon>(20);
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [result, setResult] = useState<AnalyzeView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [styleResult, setStyleResult] = useState<AnalyzeView | null>(null);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerContext | null>(null);
  const [lastRequest, setLastRequest] = useState<LastRequest | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const primaryRequestIdRef = useRef(0);
  const styleControllerRef = useRef<AbortController | null>(null);
  const styleRequestIdRef = useRef(0);

  const runPrimary = useCallback(async (intent?: Intent, questionOverride?: string) => {
    const nextQuestion = (questionOverride ?? question).trim();
    if (!nextQuestion || loading) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    const primaryRequestId = ++primaryRequestIdRef.current;
    controllerRef.current = controller;
    styleControllerRef.current?.abort();
    styleControllerRef.current = null;
    styleRequestIdRef.current += 1;
    const request: LastRequest = { horizon, question: nextQuestion, ...(intent ? { intent } : {}) };
    setLastRequest(request);
    setLoading(true);
    setError(null);
    setStyleResult(null);
    setStyleError(null);
    setStyleLoading(false);

    try {
      const nextResult = await postAnalysis(request, controller.signal);
      if (primaryRequestIdRef.current !== primaryRequestId) return;
      setResult(nextResult);
      window.requestAnimationFrame(() => document.getElementById("research-output")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (primaryRequestIdRef.current !== primaryRequestId) return;
      setError(caught instanceof Error ? caught.message : "分析请求失败，请稍后重试。");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  }, [horizon, loading, question]);

  const retry = useCallback(() => {
    if (lastRequest) {
      setQuestion(lastRequest.question);
      setHorizon(lastRequest.horizon);
      void runPrimary(lastRequest.intent, lastRequest.question);
    } else {
      void runPrimary();
    }
  }, [lastRequest, runPrimary]);

  const runStyleFollowup = useCallback(async () => {
    if (styleLoading || loading) return;
    styleControllerRef.current?.abort();
    const controller = new AbortController();
    styleControllerRef.current = controller;
    const styleRequestId = ++styleRequestIdRef.current;
    const primaryRequestId = primaryRequestIdRef.current;
    setStyleLoading(true);
    setStyleError(null);
    try {
      const styleHorizon = result?.plan?.horizon ?? horizon;
      const nextResult = await postAnalysis(
        { horizon: styleHorizon, question: STYLE_QUESTION, intent: "style_rotation" },
        controller.signal,
      );
      if (
        styleRequestIdRef.current !== styleRequestId
        || primaryRequestIdRef.current !== primaryRequestId
      ) return;
      if (nextResult.status === "blocked") {
        setStyleError(nextResult.compliance?.message ?? "风格研究请求未能执行。");
      } else if (nextResult.status === "error") {
        setStyleError(nextResult.health.reasons[0] ?? "风格研究的数据不可用。");
      } else {
        setStyleResult(nextResult);
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (
        styleRequestIdRef.current !== styleRequestId
        || primaryRequestIdRef.current !== primaryRequestId
      ) return;
      setStyleError(caught instanceof Error ? caught.message : "风格研究请求失败，请稍后重试。");
    } finally {
      if (styleControllerRef.current === controller) {
        styleControllerRef.current = null;
        setStyleLoading(false);
      }
    }
  }, [horizon, loading, result, styleLoading]);

  const openEvidence = useCallback((evidence: EvidenceView, contextResult = result) => {
    if (!contextResult?.analysis) return;
    setDrawer({ evidence, metrics: contextResult.analysis.metrics, sources: contextResult.analysis.sources });
  }, [result]);

  const openEvidenceById = useCallback((id: string, contextResult: AnalyzeView | null) => {
    const evidence = contextResult?.analysis?.evidence.find((item) => item.id === id);
    if (evidence && contextResult?.analysis) {
      setDrawer({ evidence, metrics: contextResult.analysis.metrics, sources: contextResult.analysis.sources });
    }
  }, []);

  const closeDrawer = useCallback(() => setDrawer(null), []);
  const visibleTrace = loading ? null : result?.plan ?? null;
  const showAnalysis = result?.analysis && result.status !== "error" && result.status !== "blocked";

  return (
    <div className="min-h-screen bg-transparent text-white">
      <DataHealthBar result={result} loading={loading} />

      <header className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between py-5">
          <a href="#top" className="flex items-center gap-3" aria-label="市场状态研判助手首页">
            <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200">
              <Activity size={18} />
              <span className="absolute inset-x-1 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[-0.01em] text-white/88">市场状态研判助手</span>
              <span className="block text-[9px] uppercase tracking-[0.19em] text-white/28">Market Regime Research</span>
            </span>
          </a>
          <div className="hidden items-center gap-5 text-[11px] text-white/35 sm:flex">
            <a href="#research-output" className="transition hover:text-white/65">研判结果</a>
            <a href="#evidence" className="transition hover:text-white/65">证据台账</a>
            <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-white/30">MVP · 沪深 300</span>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1480px] px-4 pb-16 pt-7 sm:px-6 sm:pt-10 lg:px-8">
        <div className="mb-8 max-w-4xl sm:mb-10">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d7b477]/65">
            <span className="h-px w-5 bg-[#d7b477]/50" /> AI-native market research
          </div>
          <h1 className="text-[34px] font-medium leading-[1.13] tracking-[-0.045em] text-white sm:text-5xl lg:text-[58px]">
            把市场观点，拆成<br className="hidden sm:block" />
            <span className="text-white/42">可以核验的证据。</span>
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/42 sm:text-[15px]">
            从行情结构、宽度与风格等证据出发，判断沪深 300 当前所处状态，并明确什么条件会改变判断。
          </p>
        </div>

        <ResearchInput
          horizon={horizon}
          question={question}
          loading={loading}
          onHorizonChange={setHorizon}
          onQuestionChange={setQuestion}
          onSubmit={(intent, override) => void runPrimary(intent, override)}
        />

        <div id="research-output" className="mt-5 scroll-mt-5 space-y-5 sm:mt-6 sm:space-y-6">
          <ExecutionTrace plan={visibleTrace} loading={loading} />

          {error && <ErrorPanel message={error} onRetry={retry} loading={loading} />}

          {!error && result?.status === "blocked" && result.compliance && (
            <CompliancePanel
              message={result.compliance.message}
              suggestedQuestion={result.compliance.suggestedQuestion}
              loading={loading}
              onContinue={() => {
                setQuestion(result.compliance?.suggestedQuestion ?? DEFAULT_QUESTION);
                void runPrimary("market_state", result.compliance?.suggestedQuestion ?? DEFAULT_QUESTION);
              }}
            />
          )}

          {!error && result?.status === "error" && (
            <ErrorPanel
              message={result.health.reasons[0] ?? "核心数据不足，系统没有生成伪正常的市场结论。"}
              onRetry={retry}
              loading={loading}
            />
          )}

          {!error && result && showAnalysis && result.analysis && (
            <>
              <HealthNotice result={result} />
              <MarketSummary analysis={result.analysis} onEvidenceOpen={(id) => openEvidenceById(id, result)} />
              <SwitchConditions conditions={result.analysis.switchConditions} />
              <div id="evidence" className="scroll-mt-5">
                <EvidenceLedger evidence={result.analysis.evidence} onEvidenceOpen={(evidence) => openEvidence(evidence, result)} />
              </div>
              <StyleFollowup
                result={styleResult}
                loading={styleLoading}
                error={styleError}
                onRun={() => void runStyleFollowup()}
                onEvidenceOpen={(id) => openEvidenceById(id, styleResult)}
              />
            </>
          )}

          {!error && !result && !loading && <IdleState />}
          {loading && <LoadingState />}
        </div>
      </main>

      <footer className="border-t border-white/[0.06] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 text-[10px] text-white/25">
          <span>市场状态研判助手 · 研究辅助工具</span>
          <span className="inline-flex items-center gap-1.5"><Shield size={11} /> 不预测涨跌，不构成投资建议</span>
        </div>
      </footer>

      <EvidenceDrawer
        evidence={drawer?.evidence ?? null}
        metrics={drawer?.metrics ?? []}
        sources={drawer?.sources ?? []}
        onClose={closeDrawer}
      />
    </div>
  );
}

function IdleState() {
  const items = [
    { icon: Database, title: "证据优先", body: "数字来自可追溯指标，缺失就明确留白。" },
    { icon: Sparkles, title: "分层表达", body: "把客观事实、证据归纳和不确定性分开。" },
    { icon: Shield, title: "条件化判断", body: "说明当前状态和切换条件，不预测未来涨跌。" },
  ];
  return (
    <section className="rounded-[24px] border border-dashed border-white/[0.08] bg-white/[0.012] px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-4xl text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.025] text-white/34"><Activity size={18} /></span>
        <h2 className="mt-4 text-sm font-medium text-white/58">准备开始一次可追溯研判</h2>
        <p className="mt-2 text-xs leading-5 text-white/27">保留默认问题，点击“开始研判”即可。</p>
        <div className="mt-7 grid gap-3 text-left md:grid-cols-3">
          {items.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-white/[0.055] bg-black/10 p-4">
              <Icon size={14} className="text-emerald-200/42" />
              <div className="mt-3 text-[11px] font-medium text-white/48">{title}</div>
              <p className="mt-1.5 text-[10px] leading-5 text-white/24">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <section aria-live="polite" className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#0b1513]/60 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="relative grid h-10 w-10 place-items-center rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200/20 border-t-emerald-200/75" />
        </span>
        <div><h2 className="text-sm font-medium text-white/65">正在完成证据计算与校验</h2><p className="mt-1 text-[10px] text-white/28">结果返回前不展示推测性内容</p></div>
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl border border-white/[0.04] bg-white/[0.018]" />)}
      </div>
    </section>
  );
}
