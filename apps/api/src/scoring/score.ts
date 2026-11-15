import type { Criterion, CriterionScore, ParamValues, SiteScore, Verdict } from "./types.js";

export const MATCH_THRESHOLD = 0.7;
export const PARTIAL_THRESHOLD = 0.4;

/** Seuil du filtre commun « sol nu » (docs/scenarios.md). */
export const NDVI_BARE_SOIL_MAX = 0.2;

/**
 * Score d'une valeur pour un critère : 1 dans l'intervalle [min, max],
 * puis décroissance linéaire jusqu'à 0 à `tolerance` de distance.
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
 * Score global d'un site : moyenne pondérée des critères, sur 100.
 * Un critère sans valeur (source en panne) est exclu du total pour ne pas
 * pénaliser le site à cause d'une source ; il reste visible avec le verdict « missing ».
 */
export function scoreSite(values: ParamValues, criteria: Criterion[]): SiteScore {
  const scored = criteria.map((c) => scoreCriterion(values, c));
  let weighted = 0;
  let weights = 0;
  scored.forEach((s, i) => {
    if (s.verdict === "missing") return;
    weighted += criteria[i].weight * s.score;
    weights += criteria[i].weight;
  });
  const total = weights > 0 ? Math.round((100 * weighted) / weights) : 0;
  return { total, criteria: scored };
}

/** Filtre commun : vrai si le site est végétalisé (NDVI connu et > 0,2). */
export function isVegetated(values: ParamValues): boolean {
  const ndvi = values.ndvi;
  return typeof ndvi === "number" && ndvi > NDVI_BARE_SOIL_MAX;
}
