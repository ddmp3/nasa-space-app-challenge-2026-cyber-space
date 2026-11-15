"""Tests fonctionnels de bout en bout (docs/tests-fonctionnels.md) contre l'application lancée.

    docker compose up --build -d
    python tools/validation/e2e.py                       # front http://localhost:8080, API http://localhost:3001
    python tools/validation/e2e.py --web URL --api URL   # autre environnement (Azure)

Chaque test porte l'identifiant du plan (TF-xx). Sortie : code 0 si tout passe. Bibliothèque standard uniquement.
"""
from __future__ import annotations
import argparse
import json
import re
import sys
import urllib.error
import urllib.request

RESULTS: list[tuple[str, bool, str]] = []


def http(url: str, method: str = "GET", body=None, headers=None, timeout: int = 120):
    data = json.dumps(body).encode() if isinstance(body, (dict, list)) else body
    h = {"Content-Type": "application/json"} if data is not None else {}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, dict(res.headers), res.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def check(test_id: str, label: str, fn) -> None:
    try:
        detail = fn() or ""
        RESULTS.append((test_id, True, f"{label}{' : ' + detail if detail else ''}"))
    except AssertionError as e:
        RESULTS.append((test_id, False, f"{label} : {e}"))
    except Exception as e:  # réseau, JSON illisible
        RESULTS.append((test_id, False, f"{label} : {type(e).__name__}: {e}"))


def run(web: str, api: str) -> None:
    origin = web.rstrip("/")

    def front_loads():
        code, _, html = http(f"{web}/")
        assert code == 200, f"HTTP {code}"
        page = html.decode("utf-8", "replace")
        assert "<div id=\"root\"" in page, "point de montage React absent"
        scripts = re.findall(r'src="(/assets/[^"]+\.js)"', page)
        assert scripts, "aucun bundle JS"
        code, _, js = http(f"{web}{scripts[0]}")
        assert code == 200 and len(js) > 10_000, "bundle JS illisible"
        assert api.rstrip("/").encode() in js, f"le bundle n'appelle pas {api}"
        return f"bundle {len(js) // 1024} Ko, API {api}"

    def health():
        code, _, b = http(f"{api}/api/health")
        assert code == 200 and json.loads(b) == {"status": "ok"}, f"HTTP {code}"

    def cors():
        code, h, _ = http(f"{api}/api/analyze", "OPTIONS", headers={"Origin": origin, "Access-Control-Request-Method": "POST"})
        allowed = {k.lower(): v for k, v in h.items()}.get("access-control-allow-origin")
        assert allowed == origin, f"origine {origin} refusée ({allowed})"
        _, h2, _ = http(f"{api}/api/modes", headers={"Origin": "https://inconnu.example"})
        assert "access-control-allow-origin" not in {k.lower() for k in h2}, "origine inconnue acceptée"

    analyses: dict[str, list[dict]] = {}

    def mode(m):
        def fn():
            code, _, b = http(f"{api}/api/analyze", "POST", {"mode": m})
            assert code == 200, f"HTTP {code}"
            sites = json.loads(b)["sites"]
            assert len(sites) >= 30, f"{len(sites)} sites"
            totals = [s["total"] for s in sites if not s.get("excluded")]
            assert totals == sorted(totals, reverse=True), "classement non trié"
            assert all(0 <= t <= 100 for t in totals), "score hors de 0-100"
            excluded = [s for s in sites if s.get("excluded")]
            assert sites[-len(excluded):] == excluded if excluded else True, "sites écartés pas en dernier"
            amazon = next(s for s in sites if s["role"] == "negative")
            assert amazon.get("excluded") == "vegetation", "témoin négatif non écarté"
            missing = sum(c["verdict"] == "missing" for s in sites for c in s["criteria"])
            analyses[m] = sites
            return f"{len(sites)} sites, 1er {sites[0]['id']} ({sites[0]['total']}), {missing} critères sans valeur"
        return fn

    def custom():
        crit = [{"param": "t2m_mean", "max": -10, "tolerance": 10, "weight": 2}, {"param": "wind", "max": 3, "tolerance": 3, "weight": 1}]
        code, _, b = http(f"{api}/api/analyze", "POST", {"criteria": crit, "bareSoilOnly": False})
        assert code == 200, f"HTTP {code}"
        sites = json.loads(b)["sites"]
        assert not any(s.get("excluded") for s in sites), "filtre sol nu actif alors qu'il est désactivé"
        assert all(len(s["criteria"]) == 2 for s in sites)
        return f"1er {sites[0]['id']} ({sites[0]['total']})"

    def custom_invalid():
        for body, why in [({"criteria": []}, "liste vide"),
                          ({"criteria": [{"param": "gravite", "max": 1, "tolerance": 1, "weight": 1}]}, "paramètre inconnu"),
                          ({"mode": "mars"}, "mode inconnu"),
                          (b"{pas du json", "JSON illisible")]:
            code, _, b = http(f"{api}/api/analyze", "POST", body)
            assert code == 400, f"{why} : HTTP {code}"
            assert "error" in json.loads(b), f"{why} : pas de message d'erreur"

    def detail():
        code, _, b = http(f"{api}/api/sites/haughton?mode=robotics")
        assert code == 200, f"HTTP {code}"
        d = json.loads(b)
        for key in ("values", "valueSources", "moon", "criteria", "sources"):
            assert key in d, f"champ {key} absent"
        known = [k for k, v in d["values"].items() if isinstance(v, (int, float))]
        assert set(known) <= set(d["valueSources"]), "valeur sans source"
        assert "fixtures" not in d["valueSources"].values(), "données d'exemple servies en mode réel"
        assert "slope_mean" in d["moon"] and "source" in d["moon"]["slope_mean"], "référence lunaire absente"
        code, _, _ = http(f"{api}/api/sites/inconnu")
        assert code == 404, f"site inconnu : HTTP {code}"
        return f"{len(known)} valeurs sourcées, {len(d['moon'])} références lunaires"

    def sources():
        code, _, b = http(f"{api}/api/sources")
        assert code == 200
        s = json.loads(b)["sources"]
        assert all(x["name"] and x["url"].startswith("https://") and x["terms"] for x in s), "source incomplète"
        return ", ".join(x["id"] for x in s)

    def moon_reference():
        code, _, b = http(f"{api}/api/reference/moon")
        assert code == 200
        ref = json.loads(b)
        limits = {x["id"] for x in ref.get("earth_limits", [])}
        assert {"gravity", "vacuum", "radiation"} <= limits, f"limites absentes : {limits}"
        assert all("source" in p for p in ref["params"].values()), "paramètre lunaire sans source"

    def docs():
        code, _, b = http(f"{api}/api/docs/")
        assert code == 200 and b"swagger" in b.lower()

    check("TF-01", "Le front se charge et vise la bonne API", front_loads)
    check("TF-02", "Sonde de santé de l'API", health)
    check("TF-03", "CORS : origine du front acceptée, origine inconnue refusée", cors)
    check("TF-04", "Mode 1, validation robotique", mode("robotics"))
    check("TF-05", "Mode 2, calibration d'instruments", mode("calibration"))
    check("TF-06", "Mode 3, colonie autosuffisante", mode("colony"))
    check("TF-07", "Mode 4, critères libres, filtre sol nu désactivé", custom)
    check("TF-08", "Requêtes invalides refusées avec un message (400)", custom_invalid)
    check("TF-09", "Fiche site : valeurs, source de chaque valeur, référence lunaire ; 404 site inconnu", detail)
    check("TF-10", "Catalogue des sources complet", sources)
    check("TF-11", "Profil lunaire sourcé et limites de la Terre", moon_reference)
    check("TF-12", "Documentation de l'API", docs)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--web", default="http://localhost:8080")
    ap.add_argument("--api", default="http://localhost:3001")
    args = ap.parse_args(argv)
    run(args.web.rstrip("/"), args.api.rstrip("/"))
    for test_id, ok, text in RESULTS:
        print(f"{'OK  ' if ok else 'ÉCHEC'} {test_id}  {text}")
    failed = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} tests passés")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
