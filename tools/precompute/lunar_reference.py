"""Relief du pôle Sud lunaire mesuré comme sur Terre : pente moyenne, pente max et rugosité en fenêtres de 1 km.

Source : LRO LOLA, modèle d'élévation polaire LDEM_85S_40M (NASA PDS Geosciences Node), 40 m/pixel,
projection stéréographique polaire centrée sur -90°, de 85°S au pôle :
    https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_85s_40m.img
    (étiquette : ldem_85s_40m.lbl ; entiers 16 bits petit-boutistes, hauteur = DN x 0,5 m)

Même méthode que point_geometry.py pour la Terre (Copernicus DEM, ~30 m) : gradient par différences centrées,
puis, par fenêtre de 1 km, moyenne et maximum de la pente et écart-type de l'altitude. Le DEM lunaire (40 m) est un
peu plus grossier : la pente lunaire est donc légèrement lissée par rapport à la pente terrestre (voir
docs/verification-modes-1-2.md, point 5).

Usage :
    python lunar_reference.py ~/data/lola/ldem_85s_40m.img            # imprime le bloc JSON
    python lunar_reference.py ~/data/lola/ldem_85s_40m.img --write ../../data/reference/moon-south-pole.json
"""
from __future__ import annotations
import argparse
import json
import math
import sys

import numpy as np

from point_geometry import slope_deg

MOON_RADIUS_M = 1_737_400.0
SOURCE = ("LRO LOLA LDEM_85S_40M (NASA PDS Geosciences Node, lro-l-lola-3-rdr-v1), 40 m/pixel, 85°S-90°S ; "
          "pente et rugosité calculées en fenêtres de 1 km comme pour la Terre (tools/precompute/lunar_reference.py)")
PERCENTILES = (10, 25, 50, 75, 90)


def read_ldem(path: str, size: int = 7584, scale: float = 0.5) -> np.ndarray:
    """Hauteurs (m) d'un LDEM polaire LOLA (entiers 16 bits petit-boutistes, LINES = LINE_SAMPLES = size)."""
    dn = np.fromfile(path, dtype="<i2")
    if dn.size != size * size:
        raise ValueError(f"{path} : {dn.size} valeurs, {size * size} attendues (LINES x LINE_SAMPLES de l'étiquette)")
    return dn.reshape(size, size).astype("float32") * scale


def latitude_grid(size: int, pixel_m: float, radius_m: float = MOON_RADIUS_M) -> np.ndarray:
    """Latitude (°, négative) au centre de chaque pixel d'une grille stéréographique polaire Sud centrée sur le pôle.
    Stéréographique : r = 2R tan(pi/4 + lat/2), donc lat = 2 atan(r / 2R) - pi/2."""
    offset = (size - 1) / 2.0
    idx = (np.arange(size, dtype="float64") - offset) * pixel_m
    r = np.hypot(idx[None, :], idx[:, None])
    return np.degrees(2 * np.arctan(r / (2 * radius_m)) - math.pi / 2)


def window_stats(z: np.ndarray, pixel_m: float, window_m: float = 1000.0, mask: np.ndarray | None = None) -> dict:
    """slope_mean, slope_max, roughness pour chaque fenêtre carrée de window_m, sans recouvrement.
    Une fenêtre n'est gardée que si tous ses pixels sont dans `mask` (ex. : au sud de 85°S)."""
    n = max(int(round(window_m / pixel_m)), 2)
    s = slope_deg(z.astype("float64"), pixel_m, pixel_m)
    rows, cols = (z.shape[0] // n) * n, (z.shape[1] // n) * n

    def blocks(a):
        return a[:rows, :cols].reshape(rows // n, n, cols // n, n).swapaxes(1, 2).reshape(rows // n, cols // n, n * n)

    zb, sb = blocks(z.astype("float64")), blocks(s)
    keep = np.ones(zb.shape[:2], dtype=bool) if mask is None else blocks(mask).all(axis=2)
    return {
        "slope_mean": sb.mean(axis=2)[keep],
        "slope_max": sb.max(axis=2)[keep],
        "roughness": zb.std(axis=2)[keep],
        "window_px": n,
    }


def summarize(stats: dict) -> dict:
    out = {"windows": int(stats["slope_mean"].size), "window_m": None}
    for key in ("slope_mean", "slope_max", "roughness"):
        values = stats[key]
        out[key] = {f"p{p}": round(float(np.percentile(values, p)), 2) for p in PERCENTILES}
    return out


def lunar_reference(path: str, pixel_m: float = 40.0, size: int = 7584, window_m: float = 1000.0,
                    max_lat: float = -85.0) -> dict:
    z = read_ldem(path, size)
    mask = latitude_grid(size, pixel_m) <= max_lat
    stats = window_stats(z, pixel_m, window_m, mask)
    summary = summarize(stats)
    summary["window_m"] = round(stats["window_px"] * pixel_m, 1)
    return summary


def apply_to_profile(profile: dict, summary: dict) -> dict:
    """Écrit pente et rugosité (intervalle interquartile p25-p75) dans le profil lunaire de référence."""
    params = profile.setdefault("params", {})
    units = {"slope_mean": "°", "slope_max": "°", "roughness": "m"}
    for key, unit in units.items():
        d = summary[key]
        params[key] = {
            "min": d["p25"], "max": d["p75"], "unit": unit,
            "distribution": d,
            "source": f"{SOURCE} ; intervalle interquartile (p25-p75) de {summary['windows']} fenêtres de "
                      f"{summary['window_m']:.0f} m",
        }
    profile["todo"] = [t for t in profile.get("todo", []) if not t.startswith("slope_mean, slope_max, roughness")]
    return profile


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ldem")
    ap.add_argument("--write", help="profil lunaire JSON à mettre à jour (data/reference/moon-south-pole.json)")
    args = ap.parse_args(argv)
    summary = lunar_reference(args.ldem)
    print(json.dumps(summary, indent=1))
    if args.write:
        with open(args.write, encoding="utf-8") as f:
            profile = json.load(f)
        with open(args.write, "w", encoding="utf-8") as f:
            json.dump(apply_to_profile(profile, summary), f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"écrit : {args.write}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
