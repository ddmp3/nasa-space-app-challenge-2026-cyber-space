import { describe, expect, it } from "vitest";
import { isVegetated, MODES, scoreCriterion, scoreSite, scoreValue, verdictFor } from "../src/scoring/index.js";
import type { Criterion } from "../src/scoring/index.js";

const range: Criterion = { param: "slope_mean", min: 5, max: 15, tolerance: 10, weight: 1 };

describe("scoreValue", () => {
  it("vaut 1 dans l'intervalle, bornes comprises", () => {
    expect(scoreValue(5, range)).toBe(1);
    expect(scoreValue(10, range)).toBe(1);
    expect(scoreValue(15, range)).toBe(1);
  });

  it("décroît linéairement hors de l'intervalle", () => {
    expect(scoreValue(0, range)).toBeCloseTo(0.5);
    expect(scoreValue(20, range)).toBeCloseTo(0.5);
    expect(scoreValue(22.5, range)).toBeCloseTo(0.25);
  });

  it("vaut 0 au-delà de la tolérance", () => {
    expect(scoreValue(25, range)).toBe(0);
    expect(scoreValue(-100, range)).toBe(0);
  });

  it("gère les intervalles ouverts", () => {
    const maxOnly: Criterion = { param: "t2m_min", max: -20, tolerance: 20, weight: 1 };
    expect(scoreValue(-50, maxOnly)).toBe(1);
    expect(scoreValue(-10, maxOnly)).toBeCloseTo(0.5);
    const minOnly: Criterion = { param: "lst_amplitude", min: 20, tolerance: 15, weight: 1 };
    expect(scoreValue(40, minOnly)).toBe(1);
    expect(scoreValue(5, minOnly)).toBe(0);
  });

  it("tolérance nulle : tout ou rien", () => {
    const strict: Criterion = { ...range, tolerance: 0 };
    expect(scoreValue(15, strict)).toBe(1);
    expect(scoreValue(15.01, strict)).toBe(0);
  });
});

describe("verdictFor", () => {
  it("applique les seuils 0,7 et 0,4", () => {
    expect(verdictFor(1)).toBe("match");
    expect(verdictFor(0.7)).toBe("match");
    expect(verdictFor(0.69)).toBe("partial");
    expect(verdictFor(0.4)).toBe("partial");
    expect(verdictFor(0.39)).toBe("mismatch");
    expect(verdictFor(0)).toBe("mismatch");
  });
});

describe("scoreCriterion", () => {
  it("marque missing une valeur absente, nulle ou non finie", () => {
    expect(scoreCriterion({}, range)).toEqual({ param: "slope_mean", value: null, score: 0, verdict: "missing" });
    expect(scoreCriterion({ slope_mean: null }, range).verdict).toBe("missing");
    expect(scoreCriterion({ slope_mean: Number.NaN }, range).verdict).toBe("missing");
  });

  it("renvoie la valeur, le score et le verdict", () => {
    expect(scoreCriterion({ slope_mean: 20 }, range)).toEqual({
      param: "slope_mean",
      value: 20,
      score: 0.5,
      verdict: "partial",
    });
  });
});

describe("scoreSite", () => {
  const criteria: Criterion[] = [
    { param: "slope_mean", min: 5, max: 15, tolerance: 10, weight: 3 },
    { param: "wind", max: 3, tolerance: 3, weight: 1 },
  ];

  it("calcule la moyenne pondérée sur 100", () => {
    const result = scoreSite({ slope_mean: 10, wind: 6 }, criteria);
    expect(result.total).toBe(75);
    expect(result.criteria.map((c) => c.verdict)).toEqual(["match", "mismatch"]);
  });

  it("exclut les critères manquants du total", () => {
    const result = scoreSite({ slope_mean: 10, wind: null }, criteria);
    expect(result.total).toBe(100);
    expect(result.criteria[1].verdict).toBe("missing");
  });

  it("vaut 0 si aucune valeur n'est disponible", () => {
    expect(scoreSite({}, criteria).total).toBe(0);
  });

  it("conserve l'ordre des critères", () => {
    expect(scoreSite({}, criteria).criteria.map((c) => c.param)).toEqual(["slope_mean", "wind"]);
  });
});

describe("isVegetated", () => {
  it("applique le seuil NDVI 0,2 (NASA Earth Observatory : ≤ 0,1 roche, sable ou neige ; 0,2 à 0,3 arbustes et prairies)", () => {
    expect(isVegetated({ ndvi: 0.85 })).toBe(true);
    expect(isVegetated({ ndvi: 0.2 })).toBe(false);
    expect(isVegetated({ ndvi: 0.157 })).toBe(false); // Meteor Crater : désert à végétation clairsemée, gardé
    expect(isVegetated({ ndvi: 0.24 })).toBe(true);
    expect(isVegetated({ ndvi: null })).toBe(false);
    expect(isVegetated({})).toBe(false);
  });
});

describe("MODES", () => {
  it("définit des critères valides pour chaque mode", () => {
    for (const mode of Object.values(MODES)) {
      expect(mode.criteria.length).toBeGreaterThan(0);
      for (const c of mode.criteria) {
        expect(c.min !== undefined || c.max !== undefined).toBe(true);
        expect(c.weight).toBeGreaterThan(0);
        expect(c.tolerance).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
