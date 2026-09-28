import storedSnapshot from "../../data/market-snapshot.json";

import {
  DataIssueSchema,
  MarketSnapshotSchema,
  type AnalysisWindow,
  type DataIssue,
  type MarketSnapshot,
} from "../schema";

/**
 * A real, time-stamped public-market snapshot captured by
 * `npm run snapshot:capture`. It is used only when live core data fails and is
 * always surfaced as snapshot mode; it is never relabelled as current data.
 */
export function loadBundledMarketSnapshot(
  window: AnalysisWindow,
  liveIssues: DataIssue[] = [],
): MarketSnapshot {
  const parsed = MarketSnapshotSchema.parse(storedSnapshot);
  const fallbackIssue = liveIssues.length
    ? [DataIssueSchema.parse({
        code: "PARTIAL_DATA",
        severity: "warning",
        message: `在线核心数据不可用，已显式切换到 ${parsed.fetchedAt} 抓取的历史快照。`,
        provider: "snapshot-fallback",
        dataset: "bundled public-market snapshot",
        retriable: true,
      })]
    : [];

  return MarketSnapshotSchema.parse({
    ...parsed,
    mode: "snapshot",
    requestedWindow: window,
    sources: parsed.sources.map((source) => ({
      ...source,
      mode: "snapshot",
      notes: [...source.notes, `本地快照抓取时间：${parsed.fetchedAt}`],
    })),
    issues: [...liveIssues, ...fallbackIssue],
  });
}
