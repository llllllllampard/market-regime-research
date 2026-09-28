import { describe, expect, it } from "vitest";

import { POST } from "../app/api/analyze/route";

function requestFor(question: string) {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": `compliance-${encodeURIComponent(question)}`,
    },
    body: JSON.stringify({ question, horizon: 20, intent: "market_state" }),
  });
}

describe("analysis API compliance boundary", () => {
  it.each(["推荐茅台", "我该买宁德时代还是比亚迪？"])(
    "returns 422 instead of executing a stock recommendation for %s",
    async (question) => {
      const response = await POST(requestFor(question));
      const payload = await response.json();

      expect(response.status).toBe(422);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("COMPLIANCE_BLOCKED");
      expect(payload.error?.category).toBe("recommendation");
    },
  );
});
