import { describe, expect, it } from "vitest";

import { PublicMarketProvider } from "../lib/data/public-provider";

describe("public provider identity validation", () => {
  it("rejects a K-line payload for a different index", async () => {
    const provider = new PublicMarketProvider({
      fetch: (async () => new Response(JSON.stringify({
        rc: 0,
        data: {
          code: "000852",
          name: "中证1000",
          klines: ["2026-09-28,1,1,1,1,1,1,0,0,0,0"],
        },
      }), { status: 200 })) as typeof fetch,
      now: () => new Date("2026-09-28T08:00:00Z"),
    });

    const result = await provider.fetchIndex("HS300", 60);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issue.code).toBe("INVALID_RESPONSE");
      expect(result.issue.message).toContain("identity mismatch");
    }
  });
});
