import { PARAM_IDS } from "../scoring/index.js";
import type { ParamId } from "../scoring/index.js";

/** Valeur lunaire de référence d'un paramètre (data/reference/moon-south-pole.json, docs/contrats.md §2). */
export type MoonValue = { min?: number; max?: number; unit?: string; source?: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/**
 * Valeurs lunaires des paramètres demandés, pour les afficher à côté des valeurs terrestres.
 * Un paramètre sans référence lunaire sourcée est absent (jamais inventé).
 */
export function moonValues(reference: unknown, params: readonly ParamId[]): Partial<Record<ParamId, MoonValue>> {
  const table = isObject(reference) && isObject(reference.params) ? reference.params : {};
  const out: Partial<Record<ParamId, MoonValue>> = {};
  for (const param of params) {
    const entry = table[param];
    if (!PARAM_IDS.includes(param) || !isObject(entry)) continue;
    const value: MoonValue = {};
    const min = num(entry.min);
    const max = num(entry.max);
    if (min === undefined && max === undefined) continue;
    if (min !== undefined) value.min = min;
    if (max !== undefined) value.max = max;
    const unit = str(entry.unit);
    if (unit !== undefined) value.unit = unit;
    const source = str(entry.source);
    if (source !== undefined) value.source = source;
    out[param] = value;
  }
  return out;
}
