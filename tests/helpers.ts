import type { MarketDataProvider, ProviderResult } from "../lib/data/provider";
import {
  BreadthSnapshotSchema,
  IndexSeriesSchema,
  MarketSnapshotSchema,
  SourceRefSchema,
  type AnalysisWindow,
  type BreadthSnapshot,
  type IndexSeries,
  type IndexSymbol,
  type MarketSnapshot,
  type SourceRef,
} from "../lib/schema";

export const FIXED_NOW = new Date("2026-09-28T08:00:00.000Z");

export function source(
  id: string,
  marketDate: string | null = "2026-09-28",
  mode: "live" | "snapshot" | "demo" = "live",
): SourceRef {
  return SourceRefSchema.parse({
    id,
    provider: "test provider",
    dataset: id,
    endpoint: "https://example.com/data",
    requestParams: {},
    fetchedAt: FIXED_NOW.toISOString(),
    marketDate,
    rawFields: ["date", "close"],
    units: { close: "index point" },
    mode,
    scope: "deterministic test fixture",
    notes: [],
  });
}
export function series(
  symbol: IndexSymbol,
  sourceId: string,
  dailyChange = 2,
  length = 90,
): IndexSeries {
  const start = new Date("2026-07-01T00:00:00.000Z");
  const base = symbol === "HS300" ? 4000 : 6500;
  const bars = Array.from({ length }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const close = base + dailyChange * index;
    return {
      date: date.toISOString().slice(0, 10),
      open: close - 1,
      close,
      high: close + 2,
      low: close - 2,
      volume: 100_000_000 + index,
      amount: 200_000_000_000 + index * 1_000_000_000,
      pctChange: index === 0 ? null : (dailyChange / (close - dailyChange)) * 100,
    };
  });
  bars[bars.length - 1].date = "2026-09-28";
  return IndexSeriesSchema.parse({
    symbol,
    code: symbol === "HS300" ? "000300" : "000852",
    name: symbol === "HS300" ? "沪深300" : "中证1000",
    bars,
    sourceId,
  });
}

export function breadth(sourceId = "SRC_BREADTH", ratio = 0.6): BreadthSnapshot {
  const total = 5000;
  const advancers = Math.round(total * ratio);
  const unchanged = 100;
  const decliners = total - advancers - unchanged;
  return BreadthSnapshotSchema.parse({
    universe: "test all-A proxy",
    advancers,
    decliners,
    unchanged,
    total,
    advanceRatio: advancers / total,
    marketDate: "2026-09-28",
    observedAt: FIXED_NOW.toISOString(),
    methodology: "fixture advancers / total",
    sourceId,
  });
}

export function snapshot(options: {
  window?: AnalysisWindow;
  mode?: "live" | "snapshot" | "demo";
  marketDate?: string | null;
  includeHS300?: boolean;
  includeCSI1000?: boolean;
  includeBreadth?: boolean;
} = {}): MarketSnapshot {
  const mode = options.mode ?? "live";
  const marketDate = options.marketDate === undefined ? "2026-09-28" : options.marketDate;
  const includeHS300 = options.includeHS300 ?? true;
  const includeCSI1000 = options.includeCSI1000 ?? true;
  const includeBreadth = options.includeBreadth ?? true;
  const sources: SourceRef[] = [];
  const indices: { HS300?: IndexSeries; CSI1000?: IndexSeries } = {};
  if (includeHS300) {
    sources.push(source("SRC_HS300", marketDate, mode));
    indices.HS300 = series("HS300", "SRC_HS300", 3);
  }
  if (includeCSI1000) {
    sources.push(source("SRC_CSI1000", marketDate, mode));
    indices.CSI1000 = series("CSI1000", "SRC_CSI1000", 1);
  }
  let breadthData: BreadthSnapshot | undefined;
  if (includeBreadth) {
    sources.push(source("SRC_BREADTH", marketDate, mode));
    breadthData = { ...breadth(), marketDate };
  }
  return MarketSnapshotSchema.parse({
    mode,
    requestedWindow: options.window ?? 20,
    fetchedAt: FIXED_NOW.toISOString(),
    indices,
    breadth: breadthData,
    sources,
    issues: [],
  });
}

export class FixtureProvider implements MarketDataProvider {
  readonly id = "fixture-provider";
  readonly mode = "live" as const;

  constructor(private readonly fixture = snapshot()) {}

  async fetchIndex(symbol: IndexSymbol): Promise<ProviderResult<IndexSeries>> {
    const data = this.fixture.indices[symbol];
    if (!data) {
      return {
        ok: false,
        issue: {
          code: "EMPTY_DATA",
          severity: "error",
          message: `${symbol} unavailable`,
          provider: this.id,
          dataset: symbol,
          retriable: false,
        },
      };
    }
    return {
      ok: true,
      data,
      source: this.fixture.sources.find((item) => item.id === data.sourceId)!,
      warnings: [],
    };
  }

  async fetchBreadth(): Promise<ProviderResult<BreadthSnapshot>> {
    const data = this.fixture.breadth;
    if (!data) {
      return {
        ok: false,
        issue: {
          code: "EMPTY_DATA",
          severity: "error",
          message: "breadth unavailable",
          provider: this.id,
          dataset: "breadth",
          retriable: false,
        },
      };
    }
    return {
      ok: true,
      data,
      source: this.fixture.sources.find((item) => item.id === data.sourceId)!,
      warnings: [],
    };
  }
}
