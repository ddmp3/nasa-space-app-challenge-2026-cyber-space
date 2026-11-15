import { isModeId, MODES, PARAM_IDS } from "../scoring/index.js";
import type { Criterion, ModeId, ParamId } from "../scoring/index.js";

/** Requête de POST /api/analyze (docs/contrats.md §5). */
export type AnalyzeRequest = {
  mode?: ModeId;
  criteria?: Criterion[];
  /** Filtre « sol nu » (NDVI ≤ 0,2) ; actif par défaut, désactivable en mode 4. */
  bareSoilOnly?: boolean;
};

export type ResolvedRequest = {
  mode: ModeId | "custom";
  criteria: Criterion[];
  bareSoilOnly: boolean;
};

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const MAX_CRITERIA = PARAM_IDS.length;

function isParamId(value: unknown): value is ParamId {
  return typeof value === "string" && (PARAM_IDS as readonly string[]).includes(value);
}

function optionalFinite(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`${field} doit être un nombre`);
  }
  return value;
}

function parseCriterion(raw: unknown, index: number): Criterion {
  if (typeof raw !== "object" || raw === null) {
    throw new ValidationError(`criteria[${index}] doit être un objet`);
  }
  const c = raw as Record<string, unknown>;
  const at = `criteria[${index}]`;
  if (!isParamId(c.param)) throw new ValidationError(`${at}.param inconnu : ${String(c.param)}`);
  const min = optionalFinite(c.min, `${at}.min`);
  const max = optionalFinite(c.max, `${at}.max`);
  const tolerance = optionalFinite(c.tolerance, `${at}.tolerance`);
  const weight = optionalFinite(c.weight, `${at}.weight`);
  if (min === undefined && max === undefined) {
    throw new ValidationError(`${at} doit avoir min, max ou les deux`);
  }
  if (min !== undefined && max !== undefined && min > max) {
    throw new ValidationError(`${at}.min doit être inférieur ou égal à max`);
  }
  if (tolerance === undefined || tolerance < 0) {
    throw new ValidationError(`${at}.tolerance doit être un nombre positif ou nul`);
  }
  if (weight === undefined || weight <= 0) {
    throw new ValidationError(`${at}.weight doit être un nombre strictement positif`);
  }
  const criterion: Criterion = { param: c.param, tolerance, weight };
  if (min !== undefined) criterion.min = min;
  if (max !== undefined) criterion.max = max;
  return criterion;
}

/** Valide le corps de la requête et le traduit en critères à appliquer. */
export function resolveRequest(body: unknown): ResolvedRequest {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Le corps doit être un objet JSON");
  }
  const b = body as Record<string, unknown>;
  if (b.bareSoilOnly !== undefined && typeof b.bareSoilOnly !== "boolean") {
    throw new ValidationError("bareSoilOnly doit être un booléen");
  }
  const bareSoilOnly = b.bareSoilOnly !== false;
  const hasMode = b.mode !== undefined;
  const hasCriteria = b.criteria !== undefined;
  if (hasMode === hasCriteria) {
    throw new ValidationError("Indiquer soit mode, soit criteria");
  }
  if (hasMode) {
    if (!isModeId(b.mode)) throw new ValidationError(`Mode inconnu : ${String(b.mode)}`);
    return { mode: b.mode, criteria: MODES[b.mode].criteria, bareSoilOnly };
  }
  if (!Array.isArray(b.criteria) || b.criteria.length === 0 || b.criteria.length > MAX_CRITERIA) {
    throw new ValidationError(`criteria doit contenir entre 1 et ${MAX_CRITERIA} critères`);
  }
  const criteria = b.criteria.map(parseCriterion);
  const params = new Set(criteria.map((c) => c.param));
  if (params.size !== criteria.length) {
    throw new ValidationError("Un paramètre ne peut apparaître qu'une fois dans criteria");
  }
  return { mode: "custom", criteria, bareSoilOnly };
}
