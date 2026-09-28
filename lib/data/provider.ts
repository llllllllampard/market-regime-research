import {
  type AnalysisWindow,
  type BreadthSnapshot,
  DataIssueSchema,
  type DataIssue,
  type DataMode,
  type IndexSeries,
  type IndexSymbol,
  MarketSnapshotSchema,
  type MarketSnapshot,
  SourceRefSchema,
  type SourceRef,
} from "../schema";

export type ProviderSuccess<T> = {
  ok: true;
  data: T;
  source: SourceRef;
  warnings: DataIssue[];
};

export type ProviderFailure = {
  ok: false;
  issue: DataIssue;
  source?: SourceRef;
};

export type ProviderResult<T> = ProviderSuccess<T> | ProviderFailure;

export interface MarketDataProvider {
  readonly id: string;
  readonly mode: DataMode;
  fetchIndex(
    symbol: IndexSymbol,
    limit: number,
    signal?: AbortSignal,
  ): Promise<ProviderResult<IndexSeries>>;
  fetchBreadth(signal?: AbortSignal): Promise<ProviderResult<BreadthSnapshot>>;
}

export type LoadSnapshotOptions = {
  signal?: AbortSignal;
  now?: Date;
};

function unexpectedFailure(provider: MarketDataProvider, dataset: string, error: unknown): ProviderFailure {
  const detail = error instanceof Error ? error.message : "unknown error";
  return {
    ok: false,
    issue: DataIssueSchema.parse({
      code: "NETWORK_ERROR",
      severity: "error",
      message: `${dataset} request failed: ${detail}`,
      provider: provider.id,
      dataset,
      retriable: true,
    }),
  };
}

async function neverThrow<T>(
  provider: MarketDataProvider,
  dataset: string,
  operation: () => Promise<ProviderResult<T>>,
): Promise<ProviderResult<T>> {
  try {
    return await operation();
  } catch (error) {
    return unexpectedFailure(provider, dataset, error);
  }
}

/**
 * Loads all independent datasets concurrently. Every failure is retained as a
 * structured issue; a successful sibling dataset is never discarded.
 */
export async function loadMarketSnapshot(
  provider: MarketDataProvider,
  window: AnalysisWindow,
  options: LoadSnapshotOptions = {},
): Promise<MarketSnapshot> {
  const limit = Math.max(90, window + 26);
  const [hs300, csi1000, breadth] = await Promise.all([
    neverThrow(provider, "HS300 daily K-line", () =>
      provider.fetchIndex("HS300", limit, options.signal),
    ),
    neverThrow(provider, "CSI1000 daily K-line", () =>
      provider.fetchIndex("CSI1000", limit, options.signal),
    ),
    neverThrow(provider, "A-share breadth", () => provider.fetchBreadth(options.signal)),
  ]);

  const sources: SourceRef[] = [];
  const issues: DataIssue[] = [];
  const indices: { HS300?: IndexSeries; CSI1000?: IndexSeries } = {};

  for (const result of [hs300, csi1000, breadth]) {
    if (result.ok) {
      sources.push(SourceRefSchema.parse(result.source));
      issues.push(...result.warnings.map((warning) => DataIssueSchema.parse(warning)));
    } else {
      issues.push(DataIssueSchema.parse(result.issue));
      if (result.source) sources.push(SourceRefSchema.parse(result.source));
    }
  }

  if (hs300.ok) indices.HS300 = hs300.data;
  if (csi1000.ok) indices.CSI1000 = csi1000.data;

  return MarketSnapshotSchema.parse({
    mode: provider.mode,
    requestedWindow: window,
    fetchedAt: (options.now ?? new Date()).toISOString(),
    indices,
    breadth: breadth.ok ? breadth.data : undefined,
    sources,
    issues,
  });
}

export function sourceFor(snapshot: MarketSnapshot, sourceId: string): SourceRef | undefined {
  return snapshot.sources.find((source) => source.id === sourceId);
}
