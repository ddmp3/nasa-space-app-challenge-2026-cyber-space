import type { Criterion } from "./types.js";

/**
 * Modes 1 à 3 : critères prédéfinis, recopiés de docs/scenarios.md.
 * Toute modification d'intervalle doit aussi être faite dans scenarios.md, avec sa source.
 */

export type ModeId = "robotics" | "calibration" | "colony";

export type Mode = {
  id: ModeId;
  name: string;
  criteria: Criterion[];
};

export const MODES: Record<ModeId, Mode> = {
  robotics: {
    id: "robotics",
    name: "Validation robotique",
    criteria: [
      // Pente moyenne et rugosité : intervalle interquartile du pôle Sud lunaire (LRO LOLA, fenêtres de 1 km,
      // tools/precompute/lunar_reference.py). Pente max : limites des rovers (docs/verification-modes-1-2.md).
      { param: "slope_mean", min: 5, max: 13, tolerance: 10, weight: 3 },
      { param: "slope_max", min: 15, max: 30, tolerance: 10, weight: 1 },
      { param: "roughness", min: 22, max: 65, tolerance: 30, weight: 2 },
      { param: "precipitation", max: 1, tolerance: 1, weight: 1 },
      { param: "t2m_min", max: -20, tolerance: 20, weight: 1 },
      { param: "lst_amplitude", min: 20, tolerance: 15, weight: 1 },
      { param: "volcano_distance", max: 50, tolerance: 100, weight: 1 },
    ],
  },
  calibration: {
    id: "calibration",
    name: "Calibration d'instruments",
    criteria: [
      { param: "t2m_mean", max: 0, tolerance: 10, weight: 2, group: "drill" },
      { param: "volcano_distance", max: 50, tolerance: 100, weight: 1, group: "drill" },
      { param: "wind", max: 3, tolerance: 3, weight: 2, group: "wind" },
      { param: "humidity", max: 40, tolerance: 30, weight: 2, group: "gas" },
      { param: "precipitation", max: 0.5, tolerance: 1, weight: 1, group: "gas" },
      { param: "quake_count", max: 5, tolerance: 20, weight: 3, group: "seismograph" },
      { param: "lst_amplitude", min: 25, tolerance: 15, weight: 2, group: "thermal" },
      { param: "t2m_min", max: -30, tolerance: 20, weight: 1, group: "thermal" },
    ],
  },
  colony: {
    id: "colony",
    name: "Colonie autosuffisante",
    criteria: [
      { param: "t2m_mean", max: -5, tolerance: 10, weight: 3, group: "water" },
      { param: "latitude_abs", min: 65, tolerance: 15, weight: 2, group: "energy" },
      { param: "solar", min: 2, tolerance: 2, weight: 1, group: "energy" },
      { param: "slope_mean", max: 5, tolerance: 5, weight: 3, group: "construction" },
      { param: "volcano_distance", max: 100, tolerance: 200, weight: 1, group: "shelter" },
      { param: "quake_count", max: 10, tolerance: 30, weight: 2, group: "stability" },
      { param: "t2m_min", max: -30, tolerance: 20, weight: 1, group: "survival" },
    ],
  },
};

export function isModeId(value: unknown): value is ModeId {
  return typeof value === "string" && Object.hasOwn(MODES, value);
}
