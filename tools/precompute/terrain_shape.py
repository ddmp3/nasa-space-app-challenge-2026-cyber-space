"""Compare the SHAPE of 1 km terrain windows: Earth (Copernicus DEM GLO-30) vs lunar south pole (LOLA 40 m).

For every 1 km window (25 x 25 pixels of 40 m) two shape descriptors are computed:
    * slope histogram: 18 bins of 2.5 deg (0-45 deg, steeper slopes go into the last bin), normalized to sum 1,
      computed on relief shape ("hist_shape", plane of the window removed) and on physical slope ("hist_raw");
    * multi-scale roughness: mean std of elevation after removing a best-fit plane in sub-blocks of
      120 m, 360 m and 1000 m (3, 9, 25 pixels).
Before computing slopes the best-fit plane of the 1 km window is removed ("relative height"), so the descriptors
describe relief shape and not regional tilt. Earth sites are resampled (average) onto the same 40 m local grid.
Each site is then matched against all lunar windows between 85 deg S and the pole (top 3 by similarity).
The roughness part of the similarity works on percentiles within the lunar roughness distribution of the same scale.
Besides the similarity, every site gets a "differences" block, neutral so that any mode (mobility, calibration,
colony) can read it: fraction of the window steeper than 15, 20 and 25 deg and roughness at 3 scales, each with the
lunar quartiles, the lunar percentile of the site and a direction higher / similar / lower. The top-level
"not_covered" lists what a 40 m terrain comparison cannot say.
Anything that cannot be computed is null with an "error" string; no value is ever invented.

Sources:
    Earth: Copernicus DEM GLO-30 (COG on AWS), read by partial window (point_geometry.py)
    Moon:  LRO LOLA LDEM_85S_40M (NASA PDS Geosciences Node), see lunar_reference.py

Usage (from tools/precompute):
    python terrain_shape.py ~/data/lola/ldem_85s_40m.img --candidates ../../data/candidates.json \
        --out ../../data/terrain-shape.json [--only haughton,atacama]
    (without --out the JSON is printed to stdout)

Limits:
    * Earth 30 m averaged to 40 m is still not identical to the effective resolution of LOLA (40 m gridded from
      sparse tracks, smoother in places); small-scale roughness is not strictly comparable.
    * The shape histogram removes regional tilt, so a uniform hillside looks flat in it: it compares shape, not
      steepness. Steepness is reported separately (hist_raw, slope_frac_above, differences block).
    * Direction rule: earth value > lunar p75 -> "higher", < lunar p25 -> "lower", else "similar". It describes
      terrain geometry only, with no judgement on whether higher or lower is better; see "not_covered".
    * When the lunar quartiles of a fraction are all 0 (slopes >= 25 deg: fewer than 25 % of lunar windows have
      any), any non-zero Earth fraction is "higher", even a very small one.
    * The similarity weights (W_SLOPE, W_ROUGH) are a choice, not derived from data.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import math
import os
import sys
import time
from datetime import datetime, timezone

import numpy as np

from lunar_reference import latitude_grid, read_ldem, MOON_RADIUS_M
from point_geometry import R_EARTH, TileNotFound, point_tile_url



def _use_bundled_proj() -> None:
    """A foreign PROJ install (e.g. PostgreSQL/PostGIS setting PROJ_LIB) breaks CRS lookups: prefer the proj_data
    shipped with the rasterio wheel. Must run before rasterio is imported."""
    if "rasterio" in sys.modules:
        return
    spec = importlib.util.find_spec("rasterio")
    if spec and spec.submodule_search_locations:
        data = os.path.join(list(spec.submodule_search_locations)[0], "proj_data")
        if os.path.isdir(data):
            os.environ["PROJ_LIB"] = os.environ["PROJ_DATA"] = data


_use_bundled_proj()

PIXEL_M = 40.0
WINDOW_PX = 25                                  # 1000 m / 40 m
SLOPE_EDGES = np.arange(0, 45.01, 2.5)          # 19 edges -> 18 bins
N_BINS = len(SLOPE_EDGES) - 1
BIN_DEG = 2.5
ROUGHNESS_SCALES_PX = (3, 9, 25)                # 120 m, 360 m, 1000 m
ROUGHNESS_KEYS = tuple(str(int(s * PIXEL_M)) for s in ROUGHNESS_SCALES_PX)
W_SLOPE = 0.5                                   # weights: a choice, not derived from data
W_ROUGH = 0.5
SLOPE_THRESHOLDS_DEG = (15.0, 20.0, 25.0)           # slope limits, see docs/scenarios.md
LIMIT_KEYS = tuple(str(int(v)) for v in SLOPE_THRESHOLDS_DEG)
SLOPE_THRESHOLDS = {"15": "taken from the VIPER nominal slope limit", "20": "taken from the NASA LTV slope requirement",
                    "25": "taken from the Apollo LRV slope limit"}
SLOPE_THRESHOLDS_SOURCE = ("docs/scenarios.md (NASA NTRS 20240013903 and 20250004148 for VIPER; NASA SP-4214 ch. 13 for the "
                       "Apollo LRV; LTV figure from a secondary summary of the NASA solicitation)")
NOT_COVERED = [
    "Features smaller than about 40 m (rocks, boulders, small craters) are invisible in a 40 m DEM.",
    "Surface material (regolith versus Earth soils and rock: strength, grain size, cohesion) is not compared.",
    "Lunar gravity (1/6 g) is not modelled.",
    "Illumination, shadows and temperature are not part of this terrain comparison.",
    "The 15 / 20 / 25 deg thresholds come from vehicle specifications; they are reference values, not measurements.",
]
W1_MAX = BIN_DEG * (N_BINS - 1)                 # 42.5: all mass in bin 0 vs all mass in the last bin

EARTH_SOURCE = "Copernicus DEM GLO-30 (COG on AWS), 30 m, averaged onto a local 40 m grid"
MOON_SOURCE = "LRO LOLA LDEM_85S_40M (NASA PDS Geosciences Node, lro-l-lola-3-rdr-v1), 40 m/pixel, 85S-90S"
METHOD = (
    "Windows of 1 km (25x25 px of 40 m). Earth: DEM read +-800 m around the site and resampled (average) to a "
    "local azimuthal-equidistant 40 m grid. Slope by central differences, two fields from the same gradients: "
    "slope_shape (heights relative to the best-fit plane of each window, i.e. without regional tilt) and slope_raw "
    "(physical slope, no plane removal). Slope histograms: 18 bins of 2.5 deg from 0 to 45 deg, slopes >= 45 deg in "
    "the last bin, normalized to 1 (hist_shape from slope_shape, hist_raw from slope_raw). slope_frac_above: exact "
    "fraction of the window pixels with slope_raw >= 15, 20 and 25 deg. Roughness: mean std of elevation after "
    "removing a best-fit plane in non-overlapping sub-blocks of 120, 360 and 1000 m. Slope distance: Wasserstein-1 "
    "between hist_shape histograms, divided by 42.5 deg (max). Roughness distance: each scale is converted to its "
    "mid-rank percentile (0-100) within the lunar windows of the same scale, then ||p1 - p2|| / (100 * sqrt(3)) "
    "(in [0, 1]; no saturation for very flat Earth sites). "
    f"Weights {W_SLOPE} / {W_ROUGH} (a choice). Similarity (%) = 100 * (1 - (w_slope * W1_norm + w_rough * d_rough)). "
    "Lunar windows: non-overlapping, fully south of 85 deg S. Differences block per site: for each slope threshold "
    "the fraction of the window above it, and for each roughness scale the value, each with the lunar p25 / p50 / "
    "p75, the lunar percentile of the site and a direction: value > lunar p75 -> higher, < lunar p25 -> lower, else "
    "similar. Top-level not_covered lists what a 40 m terrain comparison cannot say."
)


# ------------------------------------------------------------------ block utilities
def block_view(a: np.ndarray, n: int) -> np.ndarray:
    """Non-overlapping n x n blocks of a 2D array -> (R, C, n, n); remainder rows/columns are dropped."""
    r, c = a.shape[0] // n, a.shape[1] // n
    return a[:r * n, :c * n].reshape(r, n, c, n).swapaxes(1, 2)


def _centered(n: int) -> np.ndarray:
    return np.arange(n, dtype="float64") - (n - 1) / 2.0


def plane_coeffs(blocks: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Least-squares plane z = a + b*x + c*y per block (array (..., n, n)); x = column, y = row, both centered.
    x and y are orthogonal, so b = sum(x z) / sum(x^2), c = sum(y z) / sum(y^2), a = mean. b, c in m per pixel."""
    ny, nx = blocks.shape[-2], blocks.shape[-1]
    x, y = _centered(nx), _centered(ny)
    a = blocks.mean(axis=(-2, -1))
    b = (blocks * x[None, :]).sum(axis=(-2, -1)) / (ny * (x ** 2).sum())
    c = (blocks * y[:, None]).sum(axis=(-2, -1)) / (nx * (y ** 2).sum())
    return a, b, c


def detrend(blocks: np.ndarray) -> np.ndarray:
    """Blocks minus their own best-fit plane."""
    a, b, c = plane_coeffs(blocks)
    x, y = _centered(blocks.shape[-1]), _centered(blocks.shape[-2])
    plane = (a[..., None, None] + b[..., None, None] * x[None, :] + c[..., None, None] * y[:, None])
    return blocks - plane


# ------------------------------------------------------------------ features
def _slope_histogram(slope: np.ndarray) -> np.ndarray:
    """slope (R, C, n, n) -> normalized histogram (R, C, 18); slopes >= 45 deg go into the last bin."""
    r, c = slope.shape[:2]
    idx = np.clip(np.digitize(slope.reshape(r * c, -1), SLOPE_EDGES[1:-1]), 0, N_BINS - 1)
    offsets = np.arange(r * c)[:, None] * N_BINS
    counts = np.bincount((idx + offsets).ravel(), minlength=r * c * N_BINS).reshape(r, c, N_BINS)
    return counts / float(idx.shape[1])


def _roughness(zd: np.ndarray, scales=ROUGHNESS_SCALES_PX) -> np.ndarray:
    """zd (R, C, n, n) -> (R, C, len(scales)): mean over sub-blocks of the std after removing each sub-block's plane."""
    out = []
    for s in scales:
        m = zd.shape[-1] // s
        sub = zd[..., :m * s, :m * s].reshape(*zd.shape[:2], m, s, m, s).swapaxes(-3, -2)  # (R, C, m, m, s, s)
        out.append(detrend(sub).std(axis=(-2, -1)).mean(axis=(-2, -1)))
    return np.stack(out, axis=-1)


def window_features(z_with_margin: np.ndarray, pixel_m: float = PIXEL_M) -> dict:
    """Descriptors of every 25x25 window of an elevation array with exactly 1 px of margin all around (the margin
    only serves the gradient). Returns {"hist_shape": (R, C, 18), "hist_raw": (R, C, 18), "frac_above": (R, C, 3),
    "rough": (R, C, 3), "valid": (R, C)}. hist_shape uses the slope of the window relief after removing its
    best-fit plane; hist_raw and frac_above use the physical slope. frac_above is the exact fraction of the window
    pixels with raw slope >= each of SLOPE_THRESHOLDS_DEG. A window is valid if its heights and gradients are all
    finite; invalid ones get NaN features."""
    z = np.asarray(z_with_margin, dtype="float64")
    gy, gx = np.gradient(z, pixel_m)
    n = WINDOW_PX
    zb = block_view(z[1:-1, 1:-1], n)
    gxb, gyb = block_view(gx[1:-1, 1:-1], n), block_view(gy[1:-1, 1:-1], n)
    valid = np.isfinite(zb).all(axis=(2, 3)) & np.isfinite(gxb).all(axis=(2, 3)) & np.isfinite(gyb).all(axis=(2, 3))
    zb = np.where(valid[..., None, None], zb, 0.0)
    gxb = np.where(valid[..., None, None], gxb, 0.0)
    gyb = np.where(valid[..., None, None], gyb, 0.0)
    _, b, c = plane_coeffs(zb)                  # b: m per pixel along columns (x), c: along rows (y)
    slope_raw = np.degrees(np.arctan(np.hypot(gxb, gyb)))
    slope_shape = np.degrees(np.arctan(np.hypot(gxb - (b / pixel_m)[..., None, None],
                                                gyb - (c / pixel_m)[..., None, None])))
    hist_shape = _slope_histogram(slope_shape)
    hist_raw = _slope_histogram(slope_raw)
    frac = np.stack([(slope_raw >= lim).mean(axis=(-2, -1)) for lim in SLOPE_THRESHOLDS_DEG], axis=-1)
    rough = _roughness(detrend(zb))
    for a in (hist_shape, hist_raw, frac, rough):
        a[~valid] = np.nan
    return {"hist_shape": hist_shape, "hist_raw": hist_raw, "frac_above": frac, "rough": rough, "valid": valid}


# ------------------------------------------------------------------ distances
def wasserstein_1d(h1: np.ndarray, h2: np.ndarray) -> np.ndarray:
    """Wasserstein-1 distance (deg) between normalized histograms with equal 2.5 deg bins (last axis = bins)."""
    return BIN_DEG * np.abs(np.cumsum(h1, axis=-1) - np.cumsum(h2, axis=-1)).sum(axis=-1)


def wasserstein_norm(h1: np.ndarray, h2: np.ndarray) -> np.ndarray:
    """W1 divided by its maximum (42.5 deg): in [0, 1]."""
    return wasserstein_1d(h1, h2) / W1_MAX


def lunar_percentile(values, sorted_ref) -> np.ndarray:
    """Mid-rank percentile in [0, 100] of each value within the sorted 1-D reference array:
    100 * (searchsorted left + right) / 2 / N. Ties count half (all-equal reference -> 50)."""
    ref = np.asarray(sorted_ref, dtype="float64")
    v = np.asarray(values, dtype="float64")
    return 100.0 * (np.searchsorted(ref, v, side="left") + np.searchsorted(ref, v, side="right")) / 2.0 / len(ref)


def roughness_distance(p1: np.ndarray, p2: np.ndarray) -> np.ndarray:
    """Distance between two roughness descriptors given as lunar percentiles (0-100) per scale (last axis, 3 scales):
    ||p1 - p2|| / (100 * sqrt(3)); in [0, 1]."""
    return np.linalg.norm(np.asarray(p1, dtype="float64") - np.asarray(p2, dtype="float64"), axis=-1) / (100.0 * math.sqrt(3))


def similarity(h1, p1, h2, p2) -> np.ndarray:
    """Similarity in % (100 = identical shape descriptors); h = hist_shape, p = roughness percentiles;
    broadcastable over leading dimensions."""
    d = W_SLOPE * wasserstein_norm(h1, h2) + W_ROUGH * roughness_distance(p1, p2)
    return 100.0 * (1.0 - d)


# ------------------------------------------------------------------ Moon
def pixel_to_latlon(row, col, size: int, pixel_m: float = PIXEL_M, radius_m: float = MOON_RADIUS_M):
    """Latitude and east-positive longitude (0..360) of pixel (row, col), 0-based, of a south polar stereographic
    grid (center offset (size - 1) / 2, as in lunar_reference.latitude_grid). Longitude convention, checked on
    LDEM_85S_40M against Shackleton (89.66S 129.2E), Faustini (87.2S 84.3E) and Haworth (87.4S 355E), whose floors
    appear only with this orientation: sample = off + r sin(lon) / pixel, line = off - r cos(lon) / pixel
    (lon 0 towards the top of the image, lon 90E towards the right)."""
    off = (size - 1) / 2.0
    x = (np.asarray(col, dtype="float64") - off) * pixel_m
    y = (off - np.asarray(row, dtype="float64")) * pixel_m      # rows grow towards lon 180
    r = np.hypot(x, y)
    lat = np.degrees(2 * np.arctan(r / (2 * radius_m)) - math.pi / 2)
    lon = np.degrees(np.arctan2(x, y)) % 360.0
    return lat, lon


def lunar_windows(z: np.ndarray, pixel_m: float = PIXEL_M, max_lat: float = -85.0, strip_rows: int = 20) -> dict:
    """Descriptors of all non-overlapping 1 km windows fully south of max_lat. 1 px margin (outer ring) is used
    for the gradient only. Processed in strips of `strip_rows` block rows to bound memory.
    Besides "hist_shape" (N, 18), "rough" (N, 3) and "frac_above" (N, 3) returns "rough_pct" (N, 3), the lunar
    percentile of each window's roughness per scale, and "rough_sorted" / "frac_sorted" (3, N): sorted lunar
    roughness / frac_above per scale, the reference for lunar_percentile and differences_block."""
    size = z.shape[0]
    n = WINDOW_PX
    mask = latitude_grid(size, pixel_m) <= max_lat
    keep = block_view(mask[1:-1, 1:-1], n).all(axis=(2, 3))
    nbr, nbc = keep.shape
    hists, roughs, fracs, brs, bcs = [], [], [], [], []
    for r0 in range(0, nbr, strip_rows):
        r1 = min(r0 + strip_rows, nbr)
        if not keep[r0:r1].any():
            continue
        feats = window_features(z[r0 * n: r1 * n + 2, : nbc * n + 2], pixel_m)
        ok = keep[r0:r1] & feats["valid"]
        br, bc = np.nonzero(ok)
        hists.append(feats["hist_shape"][br, bc])
        roughs.append(feats["rough"][br, bc])
        fracs.append(feats["frac_above"][br, bc])
        brs.append(br + r0)
        bcs.append(bc)
    n_sc = len(ROUGHNESS_SCALES_PX)
    if hists:
        hist, rough, frac = np.concatenate(hists), np.concatenate(roughs), np.concatenate(fracs)
        br, bc = np.concatenate(brs).astype(int), np.concatenate(bcs).astype(int)
    else:
        hist, rough, frac = np.empty((0, N_BINS)), np.empty((0, n_sc)), np.empty((0, len(SLOPE_THRESHOLDS_DEG)))
        br = bc = np.empty(0, dtype=int)
    rough_sorted = np.sort(rough, axis=0).T
    frac_sorted = np.sort(frac, axis=0).T
    rough_pct = (np.stack([lunar_percentile(rough[:, k], rough_sorted[k]) for k in range(n_sc)], axis=-1)
                 if len(rough) else np.empty((0, n_sc)))
    row = 1 + br * n + n // 2
    col = 1 + bc * n + n // 2
    lat, lon = pixel_to_latlon(row, col, size, pixel_m)
    return {"hist_shape": hist, "rough": rough, "frac_above": frac, "rough_pct": rough_pct,
            "rough_sorted": rough_sorted, "frac_sorted": frac_sorted, "block_row": br, "block_col": bc,
            "row": row, "col": col, "lat": lat, "lon": lon}


# ------------------------------------------------------------------ Earth
def earth_window(lat: float, lon: float, url: str | None = None) -> np.ndarray:
    """27x27 elevation array (m, float64) on a local 40 m azimuthal-equidistant grid centered on (lat, lon):
    25x25 window of 1 km plus 1 px margin. DEM resampled with Resampling.average; nodata / outside tile -> NaN."""
    import rasterio
    from rasterio.crs import CRS
    from rasterio.enums import Resampling
    from rasterio.errors import RasterioIOError
    from rasterio.transform import from_origin
    from rasterio.warp import reproject

    from rasterio.merge import merge

    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("lat/lon out of range")
    # Area read: +-800 m around the site (covers the 27 x 27 grid of 40 m plus resampling support).
    dlat = math.degrees(800 / R_EARTH)
    dlon = math.degrees(800 / (R_EARTH * max(math.cos(math.radians(lat)), 0.01)))
    bounds = (lon - dlon, lat - dlat, lon + dlon, lat + dlat)
    if url:
        urls = [url]
    else:                                       # the area can straddle up to 4 tiles of 1 x 1 deg
        urls = list(dict.fromkeys(point_tile_url(la, lo) for la in (bounds[1], bounds[3]) for lo in (bounds[0], bounds[2])))
    sources = []
    try:
        for u in urls:
            try:
                sources.append(rasterio.open(u))
            except RasterioIOError:             # tile not published (ocean): its part stays NaN
                pass
        if not sources:
            raise TileNotFound(f"tile missing or unreachable (ocean, or no network) for ({lat}, {lon}): {urls}")
        for s in sources:
            if s.crs is None or not s.crs.is_geographic:
                raise ValueError("a DEM in geographic coordinates (EPSG:4326) is expected")
        data, src_transform = merge(sources, bounds=bounds, nodata=np.nan, dtype="float64", indexes=[1])
        data, src_crs = data[0], sources[0].crs
    finally:
        for s in sources:
            s.close()
    dst = np.full((27, 27), np.nan, dtype="float64")
    dst_crs = CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m")
    reproject(source=data, destination=dst, src_transform=src_transform, src_crs=src_crs,
              src_nodata=np.nan, dst_transform=from_origin(-540, 540, 40, 40), dst_crs=dst_crs,
              dst_nodata=np.nan, resampling=Resampling.average)
    return dst


def earth_features(lat: float, lon: float, url: str | None = None) -> dict:
    """{"slope_hist_shape": [18], "slope_hist_raw": [18], "slope_frac_above": {"15", "20", "25"} (full precision),
    "roughness_m": {"120": ..., "360": ..., "1000": ...}} for the 1 km window at the site. Raises ValueError if any
    pixel of the 27x27 array is missing."""
    z = earth_window(lat, lon, url)
    finite = float(np.isfinite(z).mean())
    if finite < 1.0:
        raise ValueError(f"window not fully covered by the DEM (tile edge or nodata): valid fraction {finite:.3f}")
    f = window_features(z)
    if not f["valid"][0, 0]:
        raise ValueError("window not fully covered by the DEM (tile edge or nodata): invalid gradient")
    return {"slope_hist_shape": [round(float(v), 4) for v in f["hist_shape"][0, 0]],
            "slope_hist_raw": [round(float(v), 4) for v in f["hist_raw"][0, 0]],
            "slope_frac_above": {k: float(v) for k, v in zip(LIMIT_KEYS, f["frac_above"][0, 0])},
            "roughness_m": {k: round(float(v), 2) for k, v in zip(ROUGHNESS_KEYS, f["rough"][0, 0])}}


# ------------------------------------------------------------------ matching and output
def top_matches(hist_shape: np.ndarray, rough_pct: np.ndarray, moon: dict, k: int = 3) -> list[dict]:
    """The k lunar windows most similar to (hist_shape, rough_pct), best first. "roughness_distance" in each match is
    the percentile-based distance in [0, 1] (see roughness_distance)."""
    n = len(moon["hist_shape"])
    if n == 0:
        return []
    sim = similarity(hist_shape, rough_pct, moon["hist_shape"], moon["rough_pct"])
    k = min(k, n)
    idx = np.argpartition(-sim, k - 1)[:k]
    idx = idx[np.argsort(-sim[idx], kind="stable")]
    w1 = wasserstein_1d(hist_shape, moon["hist_shape"][idx])
    dr = roughness_distance(rough_pct, moon["rough_pct"][idx])
    return [{"rank": i + 1, "block_row": int(moon["block_row"][j]), "block_col": int(moon["block_col"][j]),
             "lat": round(float(moon["lat"][j]), 4), "lon": round(float(moon["lon"][j]), 4),
             "similarity_pct": round(float(sim[j]), 1), "slope_w1_deg": round(float(w1[i]), 2),
             "roughness_distance": round(float(dr[i]), 3)} for i, j in enumerate(idx)]


def _direction(value: float, p25: float, p75: float) -> str:
    """Above the lunar p75 -> higher, below the p25 -> lower, else similar (no judgement on which is better)."""
    return "higher" if value > p75 else "lower" if value < p25 else "similar"


def _quartiles(sorted_ref) -> tuple[float, float, float]:
    q = np.percentile(np.asarray(sorted_ref, dtype="float64"), [25, 50, 75])
    return float(q[0]), float(q[1]), float(q[2])


def lunar_reference(moon: dict) -> dict:
    """Lunar p25 / p50 / p75 of frac_above per slope limit and of roughness (m) per scale (reported once)."""
    out = {"slope_frac_above": {}, "roughness_m": {}}
    for k, key in enumerate(LIMIT_KEYS):
        q = _quartiles(moon["frac_sorted"][k])
        out["slope_frac_above"][key] = {"p25": round(q[0], 3), "p50": round(q[1], 3), "p75": round(q[2], 3)}
    for k, key in enumerate(ROUGHNESS_KEYS):
        q = _quartiles(moon["rough_sorted"][k])
        out["roughness_m"][key] = {"p25_m": round(q[0], 2), "p50_m": round(q[1], 2), "p75_m": round(q[2], 2)}
    return out


def differences_block(earth: dict, moon: dict) -> dict:
    """How the Earth site's terrain differs from the lunar south pole (neutral, any mode). earth: {"slope_frac_above": {"15", "20",
    "25"}, "roughness_m": {"120", "360", "1000"}}; moon: lunar_windows result. Values are compared at full precision
    and rounded only for output. direction: earth > lunar p75 higher, < p25 lower, else similar."""
    slopes, rough = {}, {}
    for k, key in enumerate(LIMIT_KEYS):
        ref, v = moon["frac_sorted"][k], float(earth["slope_frac_above"][key])
        p25, p50, p75 = _quartiles(ref)
        slopes[key] = {"earth": round(v, 3), "moon_p25": round(p25, 3), "moon_p50": round(p50, 3),
                       "moon_p75": round(p75, 3), "lunar_percentile": round(float(lunar_percentile(v, ref)), 1),
                       "direction": _direction(v, p25, p75)}
    for k, key in enumerate(ROUGHNESS_KEYS):
        ref, v = moon["rough_sorted"][k], float(earth["roughness_m"][key])
        p25, p50, p75 = _quartiles(ref)
        rough[key] = {"earth_m": round(v, 2), "moon_p25_m": round(p25, 2), "moon_p50_m": round(p50, 2),
                      "moon_p75_m": round(p75, 2), "lunar_percentile": round(float(lunar_percentile(v, ref)), 1),
                      "below_lunar_min": bool(v < ref[0]), "above_lunar_max": bool(v > ref[-1]),
                      "direction": _direction(v, p25, p75)}
    return {"slope_frac_above": slopes, "roughness": rough}


def build(candidates: list[dict], moon: dict, feature_fn=earth_features, retries: int = 2) -> list[dict]:
    """One entry per site; a failing site gets earth None, matches None, differences None and an error, and never stops
    the run."""
    out = []
    for s in candidates:
        entry = {"id": s["id"], "name": s["name"], "lat": s["lat"], "lon": s["lon"], "earth": None, "matches": None,
                 "differences": None}
        for attempt in range(retries + 1):
            try:
                earth = feature_fn(float(s["lat"]), float(s["lon"]))
                rough = np.array([earth["roughness_m"][k] for k in ROUGHNESS_KEYS], dtype="float64")
                rough_pct = np.array([lunar_percentile(rough[k], moon["rough_sorted"][k]) for k in range(len(rough))])
                matches = top_matches(np.array(earth["slope_hist_shape"], dtype="float64"), rough_pct, moon)
                diffs = differences_block(earth, moon)
                entry["earth"] = dict(earth, slope_frac_above={k: round(float(v), 3)
                                                              for k, v in earth["slope_frac_above"].items()})
                entry["matches"], entry["differences"] = matches, diffs
                entry.pop("error", None)
                break
            except (TileNotFound, ValueError) as e:     # no point retrying
                entry["error"] = f"{type(e).__name__}: {e}"
                break
            except Exception as e:                      # network hiccup etc.
                entry["error"] = f"{type(e).__name__}: {e}"
                if attempt < retries:
                    time.sleep(1.5 * (attempt + 1))
        if "error" in entry:
            entry["earth"], entry["matches"], entry["differences"] = None, None, None
        best = entry["matches"][0]["similarity_pct"] if entry["matches"] else None
        print(f"  {'FAIL' if 'error' in entry else 'ok  '}  {s['id']}: " +
              (entry["error"] if "error" in entry else f"best similarity {best} %"), flush=True)
        out.append(entry)
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ldem")
    ap.add_argument("--candidates", required=True)
    ap.add_argument("--out")
    ap.add_argument("--only", help="comma-separated site ids")
    args = ap.parse_args(argv)
    with open(args.candidates, encoding="utf-8") as f:
        candidates = json.load(f)
    if args.only:
        wanted = set(args.only.split(","))
        candidates = [c for c in candidates if c["id"] in wanted]
    moon = lunar_windows(read_ldem(args.ldem))
    print(f"  {len(moon['hist_shape'])} lunar windows", file=sys.stderr)
    result = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "method": METHOD,
              "sources": {"earth": EARTH_SOURCE, "moon": MOON_SOURCE},
              "lunar_windows": int(len(moon["hist_shape"])), "slope_thresholds": SLOPE_THRESHOLDS,
              "slope_thresholds_source": SLOPE_THRESHOLDS_SOURCE, "not_covered": NOT_COVERED,
              "lunar_reference": lunar_reference(moon), "sites": build(candidates, moon)}
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"written: {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
