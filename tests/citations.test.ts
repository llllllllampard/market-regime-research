import { describe, expect, it } from "vitest";

import { calculateMetrics } from "../lib/analysis/metrics";
import { validateAnalysisCitations, validateEvidenceChain } from "../lib/ai/validate";
import { FIXED_NOW, snapshot } from "./helpers";

describe("evidence traceability", () => {
  it("validates Evidence -> Metric -> Source links", () => {
    const fixture = snapshot();
    const calculated = calculateMetrics(fixture, FIXED_NOW);
    expect(validateEvidenceChain(fixture.sources, calculated.metrics, calculated.evidence)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects an unknown source in a metric", () => {
    const fixture = snapshot();
    const calculated = calculateMetrics(fixture, FIXED_NOW);
    const metrics = calculated.metrics.map((metric, index) =>
      index === 0 ? { ...metric, sourceIds: ["SRC_DOES_NOT_EXIST"] } : metric,
    );
    const result = validateEvidenceChain(fixture.sources, metrics, calculated.evidence);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("unknown source");
  });

  it("rejects hallucinated inline evidence IDs", () => {
    const result = validateAnalysisCitations({
      evidence: [],
      headline: { text: "unsupported [E99]", evidenceIds: ["E99"] },
      mainConflict: { text: "none", evidenceIds: [] },
      facts: [],
      inferences: [],
      uncertainties: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("E99");
  });
});
