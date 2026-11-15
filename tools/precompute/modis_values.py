"""MODIS précalculé pour chaque site candidat : ndvi, lst_day, lst_night, lst_amplitude (docs/scenarios.md).

Source : Microsoft Planetary Computer (STAC, jeton anonyme, aucun compte), lecture d'un seul pixel par image.
    LST  : modis-11A2-061, actifs LST_Day_1km / LST_Night_1km (8 jours, 1 km)  -> °C
    NDVI : modis-13A1-061, actif 500m_16_days_NDVI (16 jours, 500 m)

Usage (après enrich_candidates.py, qui ajoute la géométrie) :
    python modis_values.py ../../data/candidates-precomputed.json
    python modis_values.py ../../data/candidates.json -o ../../data/candidates-precomputed.json
    python modis_values.py FICHIER --year 2024 --samples 12 --force

Le bloc "precomputed" de chaque site reçoit :
    lst_day        moyenne des LST de jour (°C)
    lst_night      moyenne des LST de nuit (°C)
    lst_amplitude  moyenne de (jour - nuit) sur les compositions où les deux existent (°C)
    ndvi           médiane du NDVI sur l'année (filtre « sol nu » : ndvi <= 0,2)
Une valeur introuvable reste null (jamais inventée) ; l'erreur est notée dans "modis_error".
"""
from __future__ import annotations
import argparse
import json
import math
import statistics
import sys
import time
from datetime import datetime, timezone

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
LST_COLLECTION, LST_DAY, LST_NIGHT = "modis-11A2-061", "LST_Day_1km", "LST_Night_1km"
NDVI_COLLECTION, NDVI_ASSET = "modis-13A1-061", "500m_16_days_NDVI"

# Facteurs d'échelle MODIS (guides utilisateur MOD11 et MOD13).
LST_SCALE, LST_VALID_MIN = 0.02, 7500        # 0 = valeur manquante ; plage valide 7500-65535
NDVI_SCALE, NDVI_VALID = 0.0001, (-2000, 10000)  # -3000 = valeur manquante
KEYS = ("ndvi", "lst_day", "lst_night", "lst_amplitude")
# En dessous de ce nombre de compositions valides, la moyenne annuelle n'est pas représentative
# (ex. : seules quelques compositions d'hiver polaire) : la valeur reste null.
MIN_VALID = 6

# Grille sinusoïdale MODIS (MODLAND) : tuiles de 1 111 950,5197 m, sphère de rayon 6 371 007,181 m.
SIN_RADIUS, SIN_TILE, SIN_X0, SIN_Y0 = 6371007.181, 1111950.5197, 20015109.354, 10007554.677


def sinusoidal_tile(lat: float, lon: float) -> tuple[int, int]:
    """(h, v) de la tuile MODIS qui contient le point. Les emprises STAC des tuiles se chevauchent :
    une recherche par point renvoie des tuiles voisines (le pixel lu tombe alors hors de l'image)."""
    x = SIN_RADIUS * math.radians(lon) * math.cos(math.radians(lat))
    y = SIN_RADIUS * math.radians(lat)
    return int((x + SIN_X0) // SIN_TILE), int((SIN_Y0 - y) // SIN_TILE)


# ----------------------------------------------------------------- conversions (pures, testées)
def _finite(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def lst_celsius(raw) -> float | None:
    """Valeur brute MODIS LST -> °C, ou None si manquante / hors plage."""
    if not _finite(raw) or raw < LST_VALID_MIN or raw > 65535:
        return None
    return raw * LST_SCALE - 273.15


def ndvi_value(raw) -> float | None:
    if not _finite(raw) or raw < NDVI_VALID[0] or raw > NDVI_VALID[1]:
        return None
    return raw * NDVI_SCALE


def pick_evenly(items: list, n: int) -> list:
    """n éléments répartis sur l'année (triés par date) pour limiter le nombre de lectures."""
    items = sorted(items, key=_item_date)
    if n <= 0 or len(items) <= n:
        return items
    step = len(items) / n
    return [items[int(i * step)] for i in range(n)]


def aggregate(lst_pairs: list[tuple[float | None, float | None]], ndvi: list[float | None],
              min_valid: int = MIN_VALID) -> dict:
    """lst_pairs : (jour, nuit) en °C par composition ; ndvi : valeurs par composition."""
    day = [d for d, _ in lst_pairs if d is not None]
    night = [n for _, n in lst_pairs if n is not None]
    amp = [d - n for d, n in lst_pairs if d is not None and n is not None]
    veg = [v for v in ndvi if v is not None]
    enough = lambda values: len(values) >= min_valid  # noqa: E731
    return {
        "lst_day": round(statistics.fmean(day), 2) if enough(day) else None,
        "lst_night": round(statistics.fmean(night), 2) if enough(night) else None,
        "lst_amplitude": round(statistics.fmean(amp), 2) if enough(amp) else None,
        "ndvi": round(statistics.median(veg), 3) if enough(veg) else None,
        "modis_samples": {"lst": len(lst_pairs), "lst_valid_pairs": len(amp), "ndvi": len(ndvi), "ndvi_valid": len(veg)},
    }


# ----------------------------------------------------------------- accès réseau (remplaçable dans les tests)
def _item_date(item):
    dt = getattr(item, "datetime", None) or (getattr(item, "properties", {}) or {}).get("start_datetime")
    return str(dt)


def _href(item, key: str) -> str | None:
    asset = item.assets.get(key) if hasattr(item, "assets") else None
    return getattr(asset, "href", None)


class PlanetaryComputer:
    """Recherche STAC + lecture d'un pixel. Nouvelles tentatives sur erreur (Planetary Computer renvoie parfois 502)."""

    def __init__(self, retries: int = 2, pause_s: float = 1.5):
        self.retries, self.pause_s = retries, pause_s
        self._catalog = None

    def _retry(self, fn):
        for attempt in range(self.retries + 1):
            try:
                return fn()
            except Exception:
                if attempt == self.retries:
                    raise
                time.sleep(self.pause_s * (attempt + 1))

    def search(self, collection: str, lat: float, lon: float, start: str, end: str) -> list:
        import planetary_computer
        import pystac_client

        if self._catalog is None:
            self._catalog = self._retry(lambda: pystac_client.Client.open(STAC_URL, modifier=planetary_computer.sign_inplace))
        h, v = sinusoidal_tile(lat, lon)
        tile = {"modis:horizontal-tile": {"eq": h}, "modis:vertical-tile": {"eq": v}}
        return self._retry(lambda: list(self._catalog.search(collections=[collection], query=tile,
                                                             datetime=f"{start}/{end}").items()))

    def sample(self, href: str, lat: float, lon: float) -> float | None:
        """Valeur brute (sans échelle) du pixel qui contient le point, ou None."""
        import rasterio
        from rasterio.warp import transform
        from rasterio.windows import Window

        def read():
            with rasterio.open(href) as src:
                xs, ys = transform("EPSG:4326", src.crs, [lon], [lat])
                row, col = src.index(xs[0], ys[0])
                if not (0 <= row < src.height and 0 <= col < src.width):
                    return None
                v = float(src.read(1, window=Window(col, row, 1, 1))[0, 0])
                return None if (src.nodata is not None and v == src.nodata) else v

        return self._retry(read)


# ----------------------------------------------------------------- calcul par site
def site_modis(lat: float, lon: float, io, year: int = 2024, samples: int = 12) -> dict:
    start, end = f"{year}-01-01", f"{year}-12-31"
    lst_items = pick_evenly(io.search(LST_COLLECTION, lat, lon, start, end), samples)
    ndvi_items = pick_evenly(io.search(NDVI_COLLECTION, lat, lon, start, end), samples)
    if not lst_items and not ndvi_items:
        raise LookupError(f"aucune image MODIS pour ({lat}, {lon}) en {year}")
    pairs = []
    for it in lst_items:
        d, n = _href(it, LST_DAY), _href(it, LST_NIGHT)
        pairs.append((lst_celsius(io.sample(d, lat, lon)) if d else None, lst_celsius(io.sample(n, lat, lon)) if n else None))
    ndvi = []
    for it in ndvi_items:
        h = _href(it, NDVI_ASSET)
        ndvi.append(ndvi_value(io.sample(h, lat, lon)) if h else None)
    return aggregate(pairs, ndvi)


def enrich_modis(sites: list[dict], io=None, year: int = 2024, samples: int = 12, force: bool = False,
                 log=print) -> list[dict]:
    io = io or PlanetaryComputer()
    out = []
    for s in sites:
        for k in ("id", "lat", "lon"):
            if k not in s:
                raise ValueError(f"site sans '{k}' : {s}")
        pre = dict(s.get("precomputed") or {})
        if not force and all(pre.get(k) is not None for k in KEYS):
            log(f"  skip  {s['id']} (MODIS déjà calculé)")
            out.append(s)
            continue
        pre.pop("modis_error", None)
        try:
            vals = site_modis(float(s["lat"]), float(s["lon"]), io, year, samples)
            pre.update(vals)
            missing = [k for k in KEYS if vals[k] is None]
            if missing:
                pre["modis_error"] = f"valeurs absentes : {', '.join(missing)}"
            log(f"  {'part' if missing else 'ok  '}  {s['id']}: " + " ".join(f"{k}={vals[k]}" for k in KEYS))
        except Exception as e:  # le site garde des null, le lot continue
            for k in KEYS:
                pre.setdefault(k, None)
            pre["modis_error"] = f"{type(e).__name__}: {e}"
            log(f"  FAIL  {s['id']}: {pre['modis_error']}")
        pre["modis_source"] = f"MODIS {LST_COLLECTION} + {NDVI_COLLECTION} (Planetary Computer), {year}"
        pre["modis_computed_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        out.append({**s, "precomputed": pre})
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("candidates")
    ap.add_argument("-o", "--output", default=None, help="par défaut : réécrit le fichier d'entrée")
    ap.add_argument("--year", type=int, default=2024)
    ap.add_argument("--samples", type=int, default=12, help="compositions lues par produit et par site")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args(argv)
    with open(a.candidates, encoding="utf-8") as fh:
        data = json.load(fh)
    sites = data if isinstance(data, list) else data.get("sites")
    if not isinstance(sites, list):
        sys.exit("le fichier doit être une liste de sites (ou { sites: [...] })")
    out = enrich_modis(sites, year=a.year, samples=a.samples, force=a.force)
    with open(a.output or a.candidates, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    bad = [s["id"] for s in out if "modis_error" in s.get("precomputed", {})]
    print(f"{len(out) - len(bad)}/{len(out)} sites complets" + (f" | à vérifier : {bad}" if bad else ""))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
