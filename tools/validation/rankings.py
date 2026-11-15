"""Vérifie les classements réels de l'API contre le classement attendu (docs/validation-classements.md).

Classement attendu (tâche « classement attendu par mode ») : chaque analogue connu (role = validation) porte dans
data/candidates.json le champ known_for, les modes pour lesquels il est réellement utilisé (Desert RATS, PISCES, AMASE…).
Un analogue n'a pas à bien sortir dans les autres modes : un désert chaud n'est pas un bon analogue de colonie polaire.

Critères :
  1. chaque analogue connu sort dans la moitié haute des modes de son known_for (au moins 75 % des attentes tenues) ;
  2. le témoin négatif (role = negative) sort dernier ou est écarté par le filtre « sol nu » dans tous les modes ;
  3. les meilleurs sites peu étudiés (role = candidate) sont listés comme découvertes possibles.

Usage (API lancée, par exemple avec docker compose up) :
    python tools/validation/rankings.py
    python tools/validation/rankings.py --api http://localhost:3001 --markdown docs/validation-classements.md
Sortie : code 0 si les critères sont tenus, 1 sinon. Bibliothèque standard uniquement.
"""
from __future__ import annotations
import argparse
import json
import os
import statistics
import sys
import urllib.request

MODES = {"robotics": "Validation robotique", "calibration": "Calibration d'instruments", "colony": "Colonie autosuffisante"}
MIN_SHARE = 0.75
CANDIDATES = os.path.join(os.path.dirname(__file__), "..", "..", "data", "candidates.json")


def fetch_ranking(api: str, mode: str) -> list[dict]:
    req = urllib.request.Request(f"{api}/api/analyze", data=json.dumps({"mode": mode}).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.load(res)["sites"]


def expected_by_mode(candidates: list[dict]) -> dict[str, set[str]]:
    """Mode -> ids des analogues connus attendus dans la moitié haute (champ known_for)."""
    out: dict[str, set[str]] = {m: set() for m in MODES}
    for s in candidates:
        for m in s.get("known_for", []):
            out.setdefault(m, set()).add(s["id"])
    return out


def check_mode(sites: list[dict], expected: set[str]) -> dict:
    """Résumé d'un classement (fonction pure, testée)."""
    ranked = [s for s in sites if not s.get("excluded")]
    n = len(ranked)
    rank = {s["id"]: i + 1 for i, s in enumerate(ranked)}
    half = (n + 1) // 2
    negatives = [s for s in sites if s["role"] == "negative"]
    expected_present = sorted(expected & {s["id"] for s in sites})
    met = [i for i in expected_present if rank.get(i, n + 1) <= half]
    missed = [i for i in expected_present if i not in met]
    candidates = [s for s in ranked if s["role"] == "candidate"]
    coverage = [sum(c["verdict"] != "missing" for c in s["criteria"]) / max(len(s["criteria"]), 1) for s in ranked]
    return {
        "ranked": n,
        "half": half,
        "excluded": [s["id"] for s in sites if s.get("excluded")],
        "expected_met": met,
        "expected_missed": [(i, rank.get(i)) for i in missed],
        "negative_ok": all(s.get("excluded") or rank.get(s["id"]) == n for s in negatives),
        "top_candidates": [(s["id"], s["name"], s["total"]) for s in candidates[:3]],
        "mean_coverage": round(statistics.fmean(coverage), 3) if coverage else 0.0,
        "top": [(rank[s["id"]], s["id"], s["role"], s["total"]) for s in ranked[:10]],
        "validation": [(rank.get(s["id"]), s["id"], s["total"]) for s in sites if s["role"] == "validation"],
    }


def overall(results: dict[str, dict]) -> dict:
    met = sum(len(s["expected_met"]) for s in results.values())
    total = met + sum(len(s["expected_missed"]) for s in results.values())
    share = met / total if total else 1.0
    negative_ok = all(s["negative_ok"] for s in results.values())
    return {"met": met, "total": total, "share": share, "negative_ok": negative_ok,
            "passes": negative_ok and share >= MIN_SHARE}


def to_markdown(results: dict[str, dict]) -> str:
    o = overall(results)
    lines = [f"**Verdict : {'tenu' if o['passes'] else 'non tenu'}.** Attentes tenues : {o['met']}/{o['total']} "
             f"({o['share']:.0%}, seuil {MIN_SHARE:.0%}). Témoin négatif écarté ou dernier dans tous les modes : "
             f"{'oui' if o['negative_ok'] else 'non'}.", "",
             "| Mode | Sites classés | Analogues attendus dans la moitié haute | Témoin négatif | Couverture moyenne des critères |",
             "|---|---|---|---|---|"]
    for mode, s in results.items():
        exp = len(s["expected_met"]) + len(s["expected_missed"])
        lines.append(f"| {MODES[mode]} | {s['ranked']} | {len(s['expected_met'])}/{exp} | "
                     f"{'écarté ou dernier' if s['negative_ok'] else '**pas dernier**'} | {s['mean_coverage']:.0%} |")
    for mode, s in results.items():
        lines += ["", f"### {MODES[mode]}", "", "| Rang | Site | Rôle | Score |", "|---|---|---|---|"]
        lines += [f"| {r} | {i} | {role} | {t} |" for r, i, role, t in s["top"]]
        lines += ["", f"Attendus dans la moitié haute (rang ≤ {s['half']}) et présents : "
                  + (", ".join(s["expected_met"]) or "aucun") + "."]
        if s["expected_missed"]:
            lines.append("Attendus mais plus bas : " + ", ".join(f"{i} ({r}ᵉ)" for i, r in s["expected_missed"]) + ".")
        lines.append("Tous les analogues connus : " + ", ".join(
            f"{i} ({'écarté' if r is None else f'{r}ᵉ'}, {t})" for r, i, t in s["validation"]) + ".")
        lines.append("Meilleurs sites peu étudiés : " + ", ".join(f"{n} ({t})" for _, n, t in s["top_candidates"]) + ".")
        if s["excluded"]:
            lines.append("Écartés par le filtre « sol nu » (NDVI > 0,2) : " + ", ".join(s["excluded"]) + ".")
    return "\n".join(lines) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default="http://localhost:3001")
    ap.add_argument("--candidates", default=CANDIDATES)
    ap.add_argument("--markdown", help="fichier Markdown où écrire le rapport (remplace le bloc entre les balises)")
    args = ap.parse_args(argv)
    with open(args.candidates, encoding="utf-8") as f:
        expected = expected_by_mode(json.load(f))
    results = {m: check_mode(fetch_ranking(args.api.rstrip("/"), m), expected[m]) for m in MODES}
    report = to_markdown(results)
    print(report)
    if args.markdown:
        start, end = "<!-- rankings:start -->", "<!-- rankings:end -->"
        with open(args.markdown, encoding="utf-8") as f:
            doc = f.read()
        if start not in doc or end not in doc:
            sys.exit(f"{args.markdown} : balises {start} et {end} absentes")
        head, rest = doc.split(start, 1)
        _, tail = rest.split(end, 1)
        with open(args.markdown, "w", encoding="utf-8") as f:
            f.write(f"{head}{start}\n{report}{end}{tail}")
    return 0 if overall(results)["passes"] else 1


if __name__ == "__main__":
    sys.exit(main())
