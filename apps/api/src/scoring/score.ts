import type { Criterion, CriterionScore, ParamValues, SiteScore, Verdict } from "./types.js";

export const MATCH_THRESHOLD = 0.7;
export const PARTIAL_THRESHOLD = 0.4;

/** Threshold of the common "bare soil" filter (docs/scenarios.md): up to here, no penalty. */
export const NDVI_BARE_SOIL_MAX = 0.2;

/**
 * NDVI at which the penalty reaches 100%: dense vegetation by the usual remote-sensing convention
 * (sparse vegetation ~0.2-0.5, dense > 0.6). Between the two the penalty is linear, like any tolerance.
 */
export const NDVI_DENSE_VEGETATION = 0.6;

/**
 * Score of a value for a criterion: 1 inside the [min, max] interval,
 * then a linear decrease down to 0 at `tolerance` distance.
 */
export function scoreValue(value: number, criterion: Criterion): number {
  const { min, max, tolerance } = criterion;
  let distance = 0;
  if (min !== undefined && value < min) distance = min - value;
  else if (max !== undefined && value > max) distance = value - max;
  if (distance === 0) return 1;
  if (tolerance <= 0) return 0;
  return Math.max(0, 1 - distance / tolerance);
}

export function verdictFor(score: number): Exclude<Verdict, "missing"> {
  if (score >= MATCH_THRESHOLD) return "match";
  if (score >= PARTIAL_THRESHOLD) return "partial";
  return "mismatch";
}

export function scoreCriterion(values: ParamValues, criterion: Criterion): CriterionScore {
  const raw = values[criterion.param];
  if (raw === undefined || raw === null || !Number.isFinite(raw)) {
    return { param: criterion.param, value: null, score: 0, verdict: "missing" };
  }
  const score = scoreValue(raw, criterion);
  return { param: criterion.param, value: raw, score, verdict: verdictFor(score) };
}

/**
 * Unrounded weighted mean of the criteria, between 0 and 100.
 * A criterion with no value (source down) is excluded from the mean so as not to
 * penalize the site because of a source; it stays visible with the "missing" verdict.
 */
export function weightedTotal(values: ParamValues, criteria: Criterion[]): number {
  let weighted = 0;
  let weights = 0;
  for (const criterion of criteria) {
    const s = scoreCriterion(values, criterion);
    if (s.verdict === "missing") continue;
    weighted += criterion.weight * s.score;
    weights += criterion.weight;
  }
  return weights > 0 ? (100 * weighted) / weights : 0;
}

/** Overall site score: weighted mean of the criteria, out of 100, rounded. */
export function scoreSite(values: ParamValues, criteria: Criterion[]): SiteScore {
  return {
    total: Math.round(weightedTotal(values, criteria)),
    criteria: criteria.map((c) => scoreCriterion(values, c)),
  };
}

/**
 * Multiplier applied to the total of a vegetated site: 1 up to NDVI 0.2, linear decrease to 0 at NDVI 0.6.
 * A single-point NDVI can misrepresent a large site (ring lake, forested rim), so the filter degrades the score
 * gradually instead of dropping the site; only dense vegetation (factor 0) is excluded.
 */
export function vegetationFactor(values: ParamValues): number {
  const ndvi = values.ndvi;
  if (typeof ndvi !== "number" || !Number.isFinite(ndvi)) return 1;
  return scoreValue(ndvi, { param: "ndvi", max: NDVI_BARE_SOIL_MAX, tolerance: NDVI_DENSE_VEGETATION - NDVI_BARE_SOIL_MAX, weight: 1 });
}
