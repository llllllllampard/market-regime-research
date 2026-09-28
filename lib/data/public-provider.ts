import { z } from "zod";
import { setDefaultResultOrder } from "node:dns";

import {
  BreadthSnapshotSchema,
  DataIssueSchema,
  IndexSeriesSchema,
  type IndexSymbol,
  MarketBarSchema,
  SourceRefSchema,
} from "../schema";
import type {
  MarketDataProvider,
  ProviderFailure,
  ProviderResult,
} from "./provider";

type FetchLike = typeof fetch;

const EASTMONEY_KLINE_ENDPOINT = "https://push2his.eastmoney.com/api/qt/stock/kline/get";
const EASTMONEY_BREADTH_ENDPOINT = "https://push2ex.eastmoney.com/getTopicZDFenBu";

// The quote host currently advertises IPv6 addresses that intermittently close
// Node/undici connections in some networks, while the IPv4 route is healthy.
// This affects server-side requests only; the provider never runs in the browser.
setDefaultResultOrder("ipv4first");

const INDEX_META = {
  HS300: { secid: "1.000300", code: "000300", name: "沪深300" },
  CSI1000: { secid: "1.000852", code: "000852", name: "中证1000" },
} as const;

const EastmoneyKlineResponseSchema = z
  .object({
    rc: z.number(),
    data: z
      .object({
        code: z.string(),
        name: z.string(),
        klines: z.array(z.string()),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough();

const EastmoneyBreadthResponseSchema = z
  .object({
    rc: z.number(),
    data: z
      .object({
        qdate: z.union([z.number(), z.string()]),
        fenbu: z.array(z.record(z.string(), z.union([z.number(), z.string()]))),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough();

export type PublicMarketProviderOptions = {
  fetch?: FetchLike;
  now?: () => Date;
  timeoutMs?: number;
};

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function yyyymmdd(value: string | number): string | null {
  const text = String(value);
  if (!/^\d{8}$/.test(text)) return null;
  const date = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  return Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? null : date;
}

function issue(
  code: "NETWORK_ERROR" | "HTTP_ERROR" | "INVALID_RESPONSE" | "EMPTY_DATA",
  message: string,
  provider: string,
  dataset: string,
  retriable: boolean,
): ProviderFailure {
  return {
    ok: false,
    issue: DataIssueSchema.parse({
      code,
      severity: "error",
      message,
      provider,
      dataset,
      retriable,
    }),
  };
}

function serializeParams(params: URLSearchParams): Record<string, string> {
  return Object.fromEntries(params.entries());
}

export class PublicMarketProvider implements MarketDataProvider {
  readonly id = "public-market-data";
  readonly mode = "live" as const;

  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private readonly timeoutMs: number;

  constructor(options: PublicMarketProviderOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  private async request(url: URL, signal?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abortParent = () => controller.abort();
    signal?.addEventListener("abort", abortParent, { once: true });
    try {
      return await this.fetchImpl(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json,text/plain,*/*",
          Referer: "https://quote.eastmoney.com/",
          // Several public quote gateways reject non-browser UA tokens even
          // though the same endpoint is otherwise public.
          "User-Agent": "Mozilla/5.0",
        },
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortParent);
    }
  }

  async fetchIndex(
    symbol: IndexSymbol,
    limit: number,
    signal?: AbortSignal,
  ): Promise<ProviderResult<z.infer<typeof IndexSeriesSchema>>> {
    const meta = INDEX_META[symbol];
    const params = new URLSearchParams({
      secid: meta.secid,
      klt: "101",
      fqt: "1",
      lmt: String(limit),
      end: "20500101",
      fields1: "f1,f2,f3,f4,f5,f6,f7,f8",
      fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
    });
    const url = new URL(EASTMONEY_KLINE_ENDPOINT);
    url.search = params.toString();
    const fetchedAt = this.now().toISOString();
    const dataset = `${meta.name}日线行情`;

    let response: Response;
    try {
      response = await this.request(url, signal);
    } catch (error) {
      return issue(
        "NETWORK_ERROR",
        `${dataset} network failure: ${error instanceof Error ? error.message : "unknown error"}`,
        "Eastmoney",
        dataset,
        true,
      );
    }
    if (!response.ok) {
      return issue("HTTP_ERROR", `${dataset} returned HTTP ${response.status}`, "Eastmoney", dataset, true);
    }

    let parsed: z.infer<typeof EastmoneyKlineResponseSchema>;
    try {
      parsed = EastmoneyKlineResponseSchema.parse(await response.json());
    } catch (error) {
      return issue(
        "INVALID_RESPONSE",
        `${dataset} response did not match the expected envelope: ${error instanceof Error ? error.message : "invalid JSON"}`,
        "Eastmoney",
        dataset,
        false,
      );
    }
    if (parsed.rc !== 0 || !parsed.data || parsed.data.klines.length === 0) {
      return issue("EMPTY_DATA", `${dataset} contained no K-line rows`, "Eastmoney", dataset, true);
    }
    if (parsed.data.code !== meta.code) {
      return issue(
        "INVALID_RESPONSE",
        `${dataset} identity mismatch: expected ${meta.code}, received ${parsed.data.code}`,
        "Eastmoney",
        dataset,
        false,
      );
    }

    const bars = parsed.data.klines
      .map((line) => {
        const [date, open, close, high, low, volume, amount, , pctChange] = line.split(",");
        const values = [open, close, high, low].map(finite);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || values.some((value) => value === null)) {
          return null;
        }
        return MarketBarSchema.parse({
          date,
          open: values[0],
          close: values[1],
          high: values[2],
          low: values[3],
          volume: finite(volume),
          amount: finite(amount),
          pctChange: finite(pctChange),
        });
      })
      .filter((bar): bar is z.infer<typeof MarketBarSchema> => bar !== null)
      .sort((a, b) => a.date.localeCompare(b.date));

    const deduplicated = [...new Map(bars.map((bar) => [bar.date, bar])).values()];
    if (deduplicated.length === 0) {
      return issue("INVALID_RESPONSE", `${dataset} had no valid numeric rows`, "Eastmoney", dataset, false);
    }

    const marketDate = deduplicated.at(-1)?.date ?? null;
    const sourceId = `SRC_EM_${symbol}_${marketDate ?? "UNKNOWN"}`;
    const source = SourceRefSchema.parse({
      id: sourceId,
      provider: "东方财富公开行情接口（Eastmoney）",
      dataset,
      endpoint: EASTMONEY_KLINE_ENDPOINT,
      requestParams: serializeParams(params),
      fetchedAt,
      marketDate,
      rawFields: [
        "f51(date)",
        "f52(open)",
        "f53(close)",
        "f54(high)",
        "f55(low)",
        "f56(volume)",
        "f57(amount)",
        "f59(pctChange)",
      ],
      units: { price: "指数点", volume: "股", amount: "人民币元", pctChange: "%" },
      mode: "live",
      scope: `${meta.name} (${meta.secid}), daily adjusted parameter fqt=1`,
      notes: [
        "公开行情接口，不属于交易所认证数据服务。",
        "交易时段内日线最后一根为动态未收盘值，产品会降低置信度并避免把盘中成交额与完整交易日直接比较。",
      ],
    });

    return {
      ok: true,
      data: IndexSeriesSchema.parse({
        symbol,
        code: parsed.data.code || meta.code,
        name: parsed.data.name || meta.name,
        bars: deduplicated,
        sourceId,
      }),
      source,
      warnings: [],
    };
  }

  async fetchBreadth(
    signal?: AbortSignal,
  ): Promise<ProviderResult<z.infer<typeof BreadthSnapshotSchema>>> {
    // Do not fall back to Sina's hs_a endpoint: despite a large `num`
    // parameter it currently caps responses at 100 rows, which is not a valid
    // whole-market breadth sample. The orchestration layer will instead use a
    // clearly labelled, time-stamped full snapshot when this source fails.
    return this.fetchEastmoneyBreadth(signal);
  }

  private async fetchEastmoneyBreadth(
    signal?: AbortSignal,
  ): Promise<ProviderResult<z.infer<typeof BreadthSnapshotSchema>>> {
    const params = new URLSearchParams({
      ut: "7eea3edcaed734bea9cbfc24409ed989",
      dpt: "wz.ztzt",
    });
    const url = new URL(EASTMONEY_BREADTH_ENDPOINT);
    url.search = params.toString();
    const fetchedAt = this.now().toISOString();
    const dataset = "A股涨跌分布";
    let response: Response;
    try {
      response = await this.request(url, signal);
    } catch (error) {
      return issue(
        "NETWORK_ERROR",
        `${dataset} network failure: ${error instanceof Error ? error.message : "unknown error"}`,
        "Eastmoney",
        dataset,
        true,
      );
    }
    if (!response.ok) {
      return issue("HTTP_ERROR", `${dataset} returned HTTP ${response.status}`, "Eastmoney", dataset, true);
    }
    let parsed: z.infer<typeof EastmoneyBreadthResponseSchema>;
    try {
      parsed = EastmoneyBreadthResponseSchema.parse(await response.json());
    } catch (error) {
      return issue(
        "INVALID_RESPONSE",
        `${dataset} response did not match the expected envelope: ${error instanceof Error ? error.message : "invalid JSON"}`,
        "Eastmoney",
        dataset,
        false,
      );
    }
    if (parsed.rc !== 0 || !parsed.data) {
      return issue("EMPTY_DATA", `${dataset} was empty`, "Eastmoney", dataset, true);
    }

    let advancers = 0;
    let decliners = 0;
    let unchanged = 0;
    for (const bucket of parsed.data.fenbu) {
      for (const [key, rawCount] of Object.entries(bucket)) {
        const bin = finite(key);
        const count = finite(rawCount);
        if (bin === null || count === null || count < 0) continue;
        if (bin > 0) advancers += Math.trunc(count);
        else if (bin < 0) decliners += Math.trunc(count);
        else unchanged += Math.trunc(count);
      }
    }
    const total = advancers + decliners + unchanged;
    if (total === 0) {
      return issue("EMPTY_DATA", `${dataset} had no valid distribution counts`, "Eastmoney", dataset, true);
    }
    const marketDate = yyyymmdd(parsed.data.qdate);
    if (!marketDate) {
      return issue("INVALID_RESPONSE", `${dataset} qdate was invalid`, "Eastmoney", dataset, false);
    }
    const sourceId = `SRC_EM_BREADTH_${marketDate}`;
    const source = SourceRefSchema.parse({
      id: sourceId,
      provider: "东方财富公开行情接口（Eastmoney）",
      dataset,
      endpoint: EASTMONEY_BREADTH_ENDPOINT,
      requestParams: serializeParams(params),
      fetchedAt,
      marketDate,
      rawFields: ["data.qdate", "data.fenbu[-11..11]"],
      units: { qdate: "date", fenbu: "security count by percentage-change bin" },
      mode: "live",
      scope: "东方财富全A涨跌分布；作为市场宽度代理指标使用",
      notes: [
        "Positive bins are summed as advancers, negative bins as decliners, and bin 0 as unchanged.",
        "这是全市场代理口径，不是沪深300成分股宽度；接口范围也不等同于交易所成分定义。",
      ],
    });
    return {
      ok: true,
      data: BreadthSnapshotSchema.parse({
        universe: "东方财富全A涨跌分布代理",
        advancers,
        decliners,
        unchanged,
        total,
        advanceRatio: advancers / total,
        marketDate,
        observedAt: fetchedAt,
        methodology: "sum positive percentage-change bins / sum all bins, including unchanged securities",
        sourceId,
      }),
      source,
      warnings: [],
    };
  }

}
