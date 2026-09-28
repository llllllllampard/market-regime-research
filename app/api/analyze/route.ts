import { NextResponse } from "next/server";
import { z } from "zod";

import { runAnalysis } from "../../../lib/analyze";
import { checkResearchScope } from "../../../lib/compliance";
import type { MarketSnapshot } from "../../../lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const sessionSnapshots = new Map<string, { capturedAt: number; snapshot: MarketSnapshot }>();
const SESSION_SNAPSHOT_TTL_MS = 2 * 60 * 1000;
const SESSION_ID_HEADER = "x-market-session-id";
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 12;

function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "local";
}

function isRateLimited(request: Request): boolean {
  const key = clientKey(request);
  const now = Date.now();
  const bucket = requestBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    requestBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

function sessionSnapshotKey(request: Request, analysisWindow: 20 | 60): string | null {
  const sessionId = request.headers.get(SESSION_ID_HEADER)?.trim();
  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) return null;
  return `${sessionId}:${analysisWindow}`;
}

function removeExpiredSessionSnapshots(now: number): void {
  for (const [key, entry] of sessionSnapshots) {
    if (now - entry.capturedAt >= SESSION_SNAPSHOT_TTL_MS) sessionSnapshots.delete(key);
  }
}

const PublicRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(500),
    horizon: z.union([z.literal(20), z.literal(60)]).optional(),
    window: z.union([z.literal(20), z.literal(60)]).optional(),
    intent: z.enum(["market_state", "style_rotation", "risk_variables"]).optional(),
  })
  .strict();

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return NextResponse.json(
      { status: "error", error: { code: "RATE_LIMITED", message: "请求过于频繁，请一分钟后重试。" } },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 10_000) {
      return NextResponse.json(
        { status: "error", error: { code: "PAYLOAD_TOO_LARGE", message: "请求内容过长。" } },
        { status: 413 },
      );
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { status: "error", error: { code: "INVALID_JSON", message: "请求体必须是有效 JSON。" } },
      { status: 400 },
    );
  }

  const parsed = PublicRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        error: {
          code: "INVALID_REQUEST",
          message: "研究问题不能为空，观察窗口仅支持 20 或 60 个交易日。",
          details: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }

  const scope = checkResearchScope(parsed.data.question);
  if (!scope.supported) {
    return NextResponse.json(
      {
        status: "blocked",
        compliance: {
          blocked: true,
          message: scope.message,
          suggestedQuestion: scope.safeQuestion,
        },
      },
      { status: 422 },
    );
  }

  try {
    const analysisWindow = parsed.data.horizon ?? parsed.data.window ?? 20;
    const now = Date.now();
    removeExpiredSessionSnapshots(now);
    const cacheKey = sessionSnapshotKey(request, analysisWindow);
    const cached = cacheKey ? sessionSnapshots.get(cacheKey) : undefined;
    const canReuse = Boolean(
      parsed.data.intent
      && parsed.data.intent !== "market_state"
      && cached
      && now - cached.capturedAt < SESSION_SNAPSHOT_TTL_MS,
    );
    const outcome = await runAnalysis({
      question: parsed.data.question,
      window: analysisWindow,
      intent: parsed.data.intent,
    }, canReuse && cached ? { snapshot: cached.snapshot, signal: request.signal } : { signal: request.signal });

    if (!outcome.ok) {
      return NextResponse.json(outcome, { status: 422 });
    }

    if (cacheKey && !canReuse) {
      sessionSnapshots.set(cacheKey, { capturedAt: Date.now(), snapshot: outcome.result.snapshot });
    }

    return NextResponse.json(outcome, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Market analysis failed", error);
    return NextResponse.json(
      {
        status: "error",
        error: {
          code: "ANALYSIS_FAILED",
          message: "行情数据或分析链路暂时不可用。系统没有生成未经验证的正常结论，请稍后重试。",
        },
      },
      { status: 503 },
    );
  }
}

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "market-regime-analysis",
    scope: "沪深300",
    supportedWindows: [20, 60],
    disclaimer: "仅用于市场状态研究，不预测涨跌，不构成投资建议。",
  });
}
