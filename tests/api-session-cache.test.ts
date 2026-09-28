import { describe, expect, it, vi } from "vitest";

import { runAnalysis } from "../lib/analyze";
import { POST } from "../app/api/analyze/route";

vi.mock("../lib/analyze", () => ({ runAnalysis: vi.fn() }));

const mockedRunAnalysis = vi.mocked(runAnalysis);

function analysisRequest(sessionId: string, window: 20 | 60, intent: "market_state" | "style_rotation") {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Market-Session-Id": sessionId,
      "X-Forwarded-For": `test-${sessionId}`,
    },
    body: JSON.stringify({
      question: intent === "market_state"
        ? "当前沪深300处于什么市场状态？"
        : "当前大小盘风格的相对强弱如何？",
      horizon: window,
      intent,
    }),
  });
}

describe("analysis session snapshot cache", () => {
  it("isolates reusable snapshots by browser session and analysis window", async () => {
    mockedRunAnalysis.mockImplementation(async (request, options) => {
      const reused = options?.snapshot as unknown as { token?: string } | undefined;
      const token = reused?.token ?? request.question;
      return {
        ok: true,
        result: { snapshot: { token } },
      } as unknown as Awaited<ReturnType<typeof runAnalysis>>;
    });

    await POST(analysisRequest("session-aaaaaaaa", 20, "market_state"));
    await POST(analysisRequest("session-aaaaaaaa", 60, "market_state"));
    await POST(analysisRequest("session-bbbbbbbb", 20, "market_state"));
    await POST(analysisRequest("session-aaaaaaaa", 20, "style_rotation"));
    await POST(analysisRequest("session-aaaaaaaa", 60, "style_rotation"));
    await POST(analysisRequest("session-bbbbbbbb", 20, "style_rotation"));

    const optionsFor = (index: number) => {
      const options = mockedRunAnalysis.mock.calls[index]?.[1];
      if (!options) throw new Error(`Missing runAnalysis options for call ${index}`);
      return options;
    };
    expect(optionsFor(3).snapshot).toMatchObject({ token: "当前沪深300处于什么市场状态？" });
    expect(optionsFor(4).snapshot).toMatchObject({ token: "当前沪深300处于什么市场状态？" });
    expect(optionsFor(5).snapshot).toMatchObject({ token: "当前沪深300处于什么市场状态？" });

    expect(optionsFor(3).snapshot).not.toBe(optionsFor(4).snapshot);
    expect(optionsFor(3).snapshot).not.toBe(optionsFor(5).snapshot);
  });
});
