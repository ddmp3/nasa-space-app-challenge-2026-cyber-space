"""Reference scorer in Python for the team contract (docs/contrats.md section 4-5, docs/scenarios.md).

Compares each Earth site with the lunar criteria of a mode and returns the same shape as POST /api/analyze:
    {"mode": ..., "sites": [{id, name, lat, lon, role, total, criteria: [{param, value, score, verdict}]}]}

    python score_sites.py data/fixtures/site-values.json --mode robotics
    python score_sites.py data/fixtures/site-values.json --mode colony --json out.json

Rules implemented (scenarios.md):
  * criterion score = 1 inside [min, max]; linear decay to 0 at `tolerance` away from the interval
  * total = sum(w * score) / sum(w), on 100
  * verdict: match >= 0.7 | partial 0.4-0.7 | mismatch < 0.4 | missing (value is null)
  * common filter: sites with ndvi > 0.2 are excluded before scoring (can be turned off)
Not defined by the contract, so made explicit here: a MISSING value is left out of the weighted mean
(missing="skip", default) or counted as 0 (missing="zero"). To be confirmed with the team.
"""
from __future__ import annotations
import argparse
import json
import math
import sys

NDVI_MAX = 0.2


def C(param, lo=None, hi=None, tolerance=0.0, weight=1.0) -> dict:
    c = {"param": param, "tolerance": tolerance, "weight": weight}
    if lo is not None:
        c["min"] = lo
    if hi is not None:
        c["max"] = hi
    return c


# Intervals / tolerances / weights copied from docs/scenarios.md (first proposal, to be validated by the team).
MODES: dict[str, list[dict]] = {
    "robotics": [
        C("slope_mean", 5, 13, 10, 3), C("slope_max", 15, 30, 10, 1), C("roughness", 22, 65, 30, 2),
        C("precipitation", None, 1, 1, 1), C("t2m_min", None, -20, 20, 1), C("lst_amplitude", 20, None, 15, 1),
        C("volcano_distance", None, 50, 100, 1),
    ],
    "calibration": [
        C("t2m_mean", None, 0, 10, 2), C("volcano_distance", None, 50, 100, 1), C("wind", None, 3, 3, 2),
        C("humidity", None, 40, 30, 2), C("precipitation", None, 0.5, 1, 1), C("quake_count", None, 5, 20, 3),
        C("lst_amplitude", 25, None, 15, 2), C("t2m_min", None, -30, 20, 1),
    ],
    "colony": [
        C("t2m_mean", None, -5, 10, 3), C("latitude_abs", 65, None, 15, 2), C("solar", 2, None, 2, 1),
        C("slope_mean", None, 5, 5, 3), C("volcano_distance", None, 100, 200, 1), C("quake_count", None, 10, 30, 2),
        C("t2m_min", None, -30, 20, 1),
    ],
}


def _is_number(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def criterion_score(value, criterion: dict) -> float:
    """1 inside the interval, linear decay to 0 at `tolerance` outside it."""
    lo, hi, tol = criterion.get("min"), criterion.get("max"), float(criterion.get("tolerance", 0))
    if lo is not None and hi is not None and lo > hi:
        raise ValueError(f"criterion {criterion['param']}: min > max")
    if tol < 0:
        raise ValueError(f"criterion {criterion['param']}: negative tolerance")
    dist = 0.0
    if lo is not None and value < lo:
        dist = lo - value
    elif hi is not None and value > hi:
        dist = value - hi
    if dist == 0:
        return 1.0
    return max(0.0, 1.0 - dist / tol) if tol > 0 else 0.0


def verdict(score: float) -> str:
    return "match" if score >= 0.7 else "partial" if score >= 0.4 else "mismatch"


def score_site(values: dict, criteria: list[dict], missing: str = "skip") -> dict:
    """values: ParamValues ({param: number | null}). Returns {"total": 0-100, "criteria": [CriterionScore]}."""
    if missing not in ("skip", "zero"):
        raise ValueError("missing must be 'skip' or 'zero'")
    out, num, den = [], 0.0, 0.0
    for c in criteria:
        w = float(c.get("weight", 1))
        if w < 0:
            raise ValueError(f"criterion {c['param']}: negative weight")
        v = values.get(c["param"])
        if not _is_number(v):
            out.append({"param": c["param"], "value": None, "score": 0, "verdict": "missing"})
            if missing == "zero":
                den += w
            continue
        s = criterion_score(v, c)
        out.append({"param": c["param"], "value": v, "score": round(s, 3), "verdict": verdict(s)})
        num += w * s
        den += w
    return {"total": round(100 * num / den) if den > 0 else 0, "criteria": out}


def analyze(sites: list[dict], mode: str | None = None, criteria: list[dict] | None = None,
            ndvi_filter: bool = True, missing: str = "skip") -> dict:
    """sites: [{id, name, lat, lon, role, values}]. Returns the POST /api/analyze response, sorted by total desc.
    Sites removed by the NDVI filter are listed under "excluded" (extra key, not in the contract)."""
    if criteria is None:
        if mode not in MODES:
            raise ValueError(f"mode must be one of {sorted(MODES)} (or pass criteria)")
        criteria = MODES[mode]
    ranked, excluded = [], []
    for s in sites:
        vals = s.get("values") or {}
        ndvi = vals.get("ndvi")
        if ndvi_filter and _is_number(ndvi) and ndvi > NDVI_MAX:
            excluded.append({"id": s["id"], "name": s.get("name"), "reason": f"ndvi {ndvi} > {NDVI_MAX}"})
            continue
        r = score_site(vals, criteria, missing)
        ranked.append({"id": s["id"], "name": s.get("name"), "lat": s.get("lat"), "lon": s.get("lon"),
                       "role": s.get("role"), "total": r["total"], "criteria": r["criteria"]})
    ranked.sort(key=lambda x: (-x["total"], x["id"]))
    res = {"mode": mode if mode in MODES else "custom", "sites": ranked}
    if excluded:
        res["excluded"] = excluded
    return res


def _print(res: dict) -> None:
    print(f"mode: {res['mode']}")
    for s in res["sites"]:
        print(f"\n{s['total']:>3}/100  {s['id']}  ({s.get('role')})   ecart global: {100 - s['total']} %")
        for c in s["criteria"]:
            gap = "  -" if c["verdict"] == "missing" else f"{round((1 - c['score']) * 100):>3}"
            print(f"     {c['param']:<17} value={str(c['value']):<8} score={c['score']:<5} ecart={gap} %  {c['verdict']}")
    for e in res.get("excluded", []):
        print(f"\nexclu  {e['id']}: {e['reason']}")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sites", help="JSON: {'sites': [...]} (data/fixtures/site-values.json) or a list of sites with 'values'")
    ap.add_argument("--mode", choices=sorted(MODES), default="robotics")
    ap.add_argument("--no-ndvi-filter", action="store_true")
    ap.add_argument("--missing", choices=("skip", "zero"), default="skip")
    ap.add_argument("--json", default=None, help="also write the /api/analyze-shaped response to this file")
    a = ap.parse_args(argv)
    with open(a.sites, encoding="utf-8") as fh:
        data = json.load(fh)
    sites = data["sites"] if isinstance(data, dict) else data
    res = analyze(sites, a.mode, ndvi_filter=not a.no_ndvi_filter, missing=a.missing)
    _print(res)
    if a.json:
        with open(a.json, "w", encoding="utf-8") as fh:
            json.dump(res, fh, ensure_ascii=False, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
