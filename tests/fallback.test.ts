import { describe, expect, it } from "vitest";

import { analyzeMarket } from "../lib/analyze";
import { FIXED_NOW, FixtureProvider, snapshot } from "./helpers";

const request = {
  question: "当前沪深300处于什么市场状态？",
  window: 20 as const,
};

describe("explicit data fallback", () => {
  it("switches to the labelled bundled snapshot in auto mode when core live data is absent", async () => {
    const result = await analyzeMarket(request, {
      provider: new FixtureProvider(snapshot({ includeHS300: false })),
      now: FIXED_NOW,
      dataMode: "auto",
    });

    expect(result.snapshot.mode).toBe("snapshot");
    expect(result.snapshot.issues.some((issue) => issue.code === "EMPTY_DATA")).toBe(true);
    expect(result.snapshot.issues.at(-1)?.code).toBe("PARTIAL_DATA");
    expect(result.snapshot.issues.at(-1)?.message).toContain("显式切换");
    expect(result.state.code).not.toBe("insufficient_evidence");
  });

  it("does not silently fall back when live-only mode is requested", async () => {
    const result = await analyzeMarket(request, {
      provider: new FixtureProvider(snapshot({ includeHS300: false })),
      now: FIXED_NOW,
      dataMode: "live",
    });

    expect(result.snapshot.mode).toBe("live");
    expect(result.state.code).toBe("insufficient_evidence");
    expect(result.dataHealth).toBe("failed");
  });
});
