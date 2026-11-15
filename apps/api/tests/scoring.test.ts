import { describe, expect, it } from "vitest";
import { MODES, scoreCriterion, scoreSite, scoreValue, vegetationFactor, verdictFor, weightedTotal } from "../src/scoring/index.js";
import type { Criterion } from "../src/scoring/index.js";

const range: Criterion = { param: "slope_mean", min: 5, max: 15, tolerance: 10, weight: 1 };

describe("scoreValue", () => {
  it("is 1 inside the interval, bounds included", () => {
    expect(scoreValue(5, range)).toBe(1);
    expect(scoreValue(10, range)).toBe(1);
    expect(scoreValue(15, range)).toBe(1);
  });

  it("decreases linearly outside the interval", () => {
    expect(scoreValue(0, range)).toBeCloseTo(0.5);
    expect(scoreValue(20, range)).toBeCloseTo(0.5);
    expect(scoreValue(22.5, range)).toBeCloseTo(0.25);
  });

  it("is 0 beyond the tolerance", () => {
    expect(scoreValue(25, range)).toBe(0);
    expect(scoreValue(-100, range)).toBe(0);
  });

  it("handles open intervals", () => {
    const maxOnly: Criterion = { param: "t2m_min", max: -20, tolerance: 20, weight: 1 };
    expect(scoreValue(-50, maxOnly)).toBe(1);
    expect(scoreValue(-10, maxOnly)).toBeCloseTo(0.5);
    const minOnly: Criterion = { param: "lst_amplitude", min: 20, tolerance: 15, weight: 1 };
    expect(scoreValue(40, minOnly)).toBe(1);
    expect(scoreValue(5, minOnly)).toBe(0);
  });

  it("zero tolerance: all or nothing", () => {
    const strict: Criterion = { ...range, tolerance: 0 };
    expect(scoreValue(15, strict)).toBe(1);
    expect(scoreValue(15.01, strict)).toBe(0);
  });
});

describe("verdictFor", () => {
  it("applies the 0.7 and 0.4 thresholds", () => {
    expect(verdictFor(1)).toBe("match");
    expect(verdictFor(0.7)).toBe("match");
    expect(verdictFor(0.69)).toBe("partial");
    expect(verdictFor(0.4)).toBe("partial");
    expect(verdictFor(0.39)).toBe("mismatch");
    expect(verdictFor(0)).toBe("mismatch");
  });
});

describe("scoreCriterion", () => {
  it("marks an absent, null or non-finite value as missing", () => {
    expect(scoreCriterion({}, range)).toEqual({ param: "slope_mean", value: null, score: 0, verdict: "missing" });
    expect(scoreCriterion({ slope_mean: null }, range).verdict).toBe("missing");
    expect(scoreCriterion({ slope_mean: Number.NaN }, range).verdict).toBe("missing");
  });

  it("returns the value, score and verdict", () => {
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

  it("computes the weighted mean out of 100", () => {
    const result = scoreSite({ slope_mean: 10, wind: 6 }, criteria);
    expect(result.total).toBe(75);
    expect(result.criteria.map((c) => c.verdict)).toEqual(["match", "mismatch"]);
  });

  it("excludes missing criteria from the total", () => {
    const result = scoreSite({ slope_mean: 10, wind: null }, criteria);
    expect(result.total).toBe(100);
    expect(result.criteria[1].verdict).toBe("missing");
  });

  it("is 0 if no value is available", () => {
    expect(scoreSite({}, criteria).total).toBe(0);
  });

  it("keeps the criteria order", () => {
    expect(scoreSite({}, criteria).criteria.map((c) => c.param)).toEqual(["slope_mean", "wind"]);
  });
});

describe("vegetationFactor", () => {
  it("is 1 up to NDVI 0.2, linear down to 0 at NDVI 0.6", () => {
    expect(vegetationFactor({ ndvi: -0.02 })).toBe(1);
    expect(vegetationFactor({ ndvi: 0.2 })).toBe(1);
    expect(vegetationFactor({ ndvi: 0.4 })).toBeCloseTo(0.5);
    expect(vegetationFactor({ ndvi: 0.6 })).toBe(0);
    expect(vegetationFactor({ ndvi: 0.85 })).toBe(0);
  });

  it("keeps a moderately vegetated site mostly intact (impact craters of the candidate list)", () => {
    expect(vegetationFactor({ ndvi: 0.24 })).toBeCloseTo(0.9); // Popigai, Gosses Bluff
    expect(vegetationFactor({ ndvi: 0.325 })).toBeCloseTo(0.69, 1); // Wolfe Creek
    expect(vegetationFactor({ ndvi: 0.551 })).toBeLessThan(0.15); // Manicouagan
  });

  it("is 1 when NDVI is unknown", () => {
    expect(vegetationFactor({})).toBe(1);
    expect(vegetationFactor({ ndvi: null })).toBe(1);
  });
});

describe("weightedTotal", () => {
  it("is the unrounded weighted mean and ignores missing criteria", () => {
    const criteria: Criterion[] = [
      { param: "slope_mean", min: 5, max: 15, tolerance: 10, weight: 1 },
      { param: "wind", max: 3, tolerance: 3, weight: 2 },
      { param: "humidity", max: 40, tolerance: 30, weight: 5 },
    ];
    expect(weightedTotal({ slope_mean: 0, wind: 4.5 }, criteria)).toBeCloseTo((100 * (0.5 + 2 * 0.5)) / 3);
    expect(weightedTotal({}, criteria)).toBe(0);
  });
});

describe("MODES", () => {
  it("defines valid criteria for every mode", () => {
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
