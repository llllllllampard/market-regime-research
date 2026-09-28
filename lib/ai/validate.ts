import type { AnalysisResult, Evidence, Metric, NarrativeItem, SourceRef } from "../schema";

export type ValidationResult = { ok: true; errors: [] } | { ok: false; errors: string[] };

export function extractInlineEvidenceIds(text: string): string[] {
  return [...text.matchAll(/\[(E\d+)\]/g)].map((match) => match[1]);
}

export function validateEvidenceChain(
  sources: SourceRef[],
  metrics: Metric[],
  evidence: Evidence[],
): ValidationResult {
  const errors: string[] = [];
  const sourceIds = new Set(sources.map((source) => source.id));
  const metricIds = new Set(metrics.map((metric) => metric.id));
  const duplicateMetricIds = metrics.filter((item, index) => metrics.findIndex((other) => other.id === item.id) !== index);
  const duplicateEvidenceIds = evidence.filter((item, index) => evidence.findIndex((other) => other.id === item.id) !== index);
  if (duplicateMetricIds.length) errors.push(`duplicate metric IDs: ${duplicateMetricIds.map((item) => item.id).join(", ")}`);
  if (duplicateEvidenceIds.length) errors.push(`duplicate evidence IDs: ${duplicateEvidenceIds.map((item) => item.id).join(", ")}`);

  for (const item of metrics) {
    if (item.value !== null && item.sourceIds.length === 0) {
      errors.push(`${item.id} has a value but no source`);
    }
    for (const sourceId of item.sourceIds) {
      if (!sourceIds.has(sourceId)) errors.push(`${item.id} references unknown source ${sourceId}`);
    }
  }
  for (const item of evidence) {
    for (const metricId of item.metricIds) {
      if (!metricIds.has(metricId)) errors.push(`${item.id} references unknown metric ${metricId}`);
    }
  }
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

function validateNarrativeItem(
  item: NarrativeItem,
  evidenceIds: Set<string>,
  location: string,
  errors: string[],
): void {
  for (const id of item.evidenceIds) {
    if (!evidenceIds.has(id)) errors.push(`${location} declares unknown citation ${id}`);
  }
  for (const id of extractInlineEvidenceIds(item.text)) {
    if (!evidenceIds.has(id)) errors.push(`${location} contains unknown citation ${id}`);
    if (!item.evidenceIds.includes(id)) errors.push(`${location} contains undeclared citation ${id}`);
  }
}

export function validateAnalysisCitations(
  analysis: Pick<
    AnalysisResult,
    "evidence" | "headline" | "mainConflict" | "facts" | "inferences" | "uncertainties"
  >,
): ValidationResult {
  const errors: string[] = [];
  const evidenceIds = new Set(analysis.evidence.map((item) => item.id));
  validateNarrativeItem(analysis.headline, evidenceIds, "headline", errors);
  validateNarrativeItem(analysis.mainConflict, evidenceIds, "mainConflict", errors);
  analysis.facts.forEach((item, index) => validateNarrativeItem(item, evidenceIds, `facts[${index}]`, errors));
  analysis.inferences.forEach((item, index) => validateNarrativeItem(item, evidenceIds, `inferences[${index}]`, errors));
  analysis.uncertainties.forEach((item, index) =>
    validateNarrativeItem(item, evidenceIds, `uncertainties[${index}]`, errors),
  );
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}
