"""Offline tests of terrain_shape.py (synthetic terrains, no network):  python -m pytest tools/precompute -q"""
import math
import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(__file__))
import terrain_shape as ts  # noqa: E402
from lunar_reference import latitude_grid, MOON_RADIUS_M  # noqa: E402

N = 27
X = (np.arange(N) - 13) * 40.0
XX, YY = np.meshgrid(X, X)                      # XX: columns (east), YY: rows


def plane(deg=10.0):
    return XX * math.tan(math.radians(deg))


def crater(radius=400.0, depth=120.0):
    return depth * np.minimum(np.hypot(XX, YY) / radius, 1.0)


def ridges(amp=30.0, wavelength=300.0):
    return amp * np.sin(2 * np.pi * XX / wavelength)


def feats(z, raw=False):
    f = ts.window_features(z)
    return f["hist_raw" if raw else "hist_shape"][0, 0], f["rough"][0, 0]


def synth_moon(m=200, seed=0):
    """Synthetic lunar dict with the keys that top_matches / differences_block use."""
    rng = np.random.default_rng(seed)
    rough = rng.random((m, 3)) * 100 + 1.0
    frac = rng.random((m, 3)) * 0.2
    hist = rng.random((m, 18))
    hist /= hist.sum(axis=1, keepdims=True)
    rs, fs = np.sort(rough, axis=0).T, np.sort(frac, axis=0).T
    pct = np.stack([ts.lunar_percentile(rough[:, k], rs[k]) for k in range(3)], axis=-1)
    return {"hist_shape": hist, "rough": rough, "frac_above": frac, "rough_pct": pct, "rough_sorted": rs,
            "frac_sorted": fs, "block_row": np.arange(m), "block_col": np.arange(m)[::-1],
            "lat": np.linspace(-90, -85, m), "lon": np.linspace(0, 359, m)}


def pct_of(rough, moon):
    return np.array([ts.lunar_percentile(rough[k], moon["rough_sorted"][k]) for k in range(3)])


_REF = np.linspace(0, 150, 300)                 # reference lunar roughness (m) used to turn synthetic windows into percentiles


def sim(za, zb):
    ha, ra = feats(za)
    hb, rb = feats(zb)
    pa = np.array([ts.lunar_percentile(v, _REF) for v in ra])
    pb = np.array([ts.lunar_percentile(v, _REF) for v in rb])
    return float(ts.similarity(ha, pa, hb, pb))


# ------------------------------------------------------------------ similarity behaviour
def test_crater_closer_to_crater_than_to_plane():
    assert sim(crater(400, 120), crater(450, 130)) > sim(crater(400, 120), plane())


def test_crater_vs_ridges():
    # Only asserted because it holds with the unmodified formula.
    assert sim(crater(400, 120), crater(450, 130)) > sim(crater(400, 120), ridges())


def test_plane_detrended_is_flat():
    h, r = feats(plane(10))
    assert h[0] == pytest.approx(1.0) and h[1:].sum() == pytest.approx(0.0)
    assert np.allclose(r, 0.0, atol=1e-6)


def test_raw_histogram_keeps_tilt():
    h, _ = feats(plane(11), raw=True)
    assert int(np.argmax(h)) == 4 and h[4] == pytest.approx(1.0)       # 11 deg -> bin [10, 12.5)


def test_tilted_plane_raw_vs_shape():
    f = ts.window_features(plane(21))
    assert int(np.argmax(f["hist_raw"][0, 0])) == 8 and f["hist_raw"][0, 0, 8] == pytest.approx(1.0)
    assert f["hist_shape"][0, 0, 0] == pytest.approx(1.0)
    assert np.allclose(f["frac_above"][0, 0], [1.0, 1.0, 0.0])         # 21 deg: above 15 and 20, below 25
    assert f["frac_above"].shape == (1, 1, 3)


def test_frac_above_exact_not_from_bins():
    # Half of the window at 16 deg, the rest flat: the fraction counts pixels, independent of bin edges.
    z = np.where(XX > 0, XX * math.tan(math.radians(16)), 0.0)
    fr = ts.window_features(z)["frac_above"][0, 0]
    assert 0.3 < fr[0] < 0.7 and fr[1] == 0 and fr[2] == 0


def test_lunar_percentile():
    ref = np.sort(np.array([1.0, 2.0, 2.0, 3.0, 10.0]))
    v = np.array([0.0, 1.0, 2.0, 2.5, 10.0, 11.0])
    p = ts.lunar_percentile(v, ref)
    assert p[0] == 0.0 and p[-1] == 100.0
    assert np.all(np.diff(p) >= 0)                                    # monotone
    assert p[2] == pytest.approx(100 * (1 + 3) / 2 / 5)                # ties count half
    assert float(ts.lunar_percentile(5.0, np.full(10, 5.0))) == pytest.approx(50.0)
    assert float(ts.lunar_percentile(0.0, np.zeros(4))) == pytest.approx(50.0)
    assert p.shape == v.shape


def test_flat_site_no_roughness_saturation():
    moon = synth_moon()
    flat_pct = pct_of(np.zeros(3), moon)                               # roughness 0 m: below every lunar window
    smoothest = int(np.argmin(np.linalg.norm(moon["rough_pct"], axis=1)))   # lowest percentiles
    d = float(ts.roughness_distance(flat_pct, moon["rough_pct"][smoothest]))
    assert d < 0.25                                                    # the old formula gave 1.0 here
    assert float(ts.roughness_distance(np.zeros(3), np.full(3, 100.0))) == pytest.approx(1.0)


def test_histogram_properties():
    assert len(ts.SLOPE_EDGES) - 1 == ts.N_BINS == 18
    for z in (crater(), ridges(), plane()):
        h, _ = feats(z)
        assert h.shape == (18,) and h.sum() == pytest.approx(1.0)
    h, _ = feats(plane(60), raw=True)                                  # 60 deg wall -> last bin
    assert h[-1] == pytest.approx(1.0)


def test_identical_and_bounds():
    h, r = feats(crater())
    assert float(ts.similarity(h, r, h, r)) == pytest.approx(100.0)
    zs = [crater(), crater(300, 200), ridges(), plane(), ridges(60, 120)]
    for za in zs:
        for zb in zs:
            assert 0.0 <= sim(za, zb) <= 100.0
    h1, h2 = feats(crater())[0], feats(ridges())[0]
    assert ts.wasserstein_1d(h1, h2) == pytest.approx(ts.wasserstein_1d(h2, h1))
    assert ts.wasserstein_1d(h1, h1) == 0
    lo, hi = np.eye(18)[0], np.eye(18)[-1]
    assert ts.wasserstein_norm(lo, hi) == pytest.approx(1.0)
    assert ts.roughness_distance(np.zeros(3), np.zeros(3)) == 0
    assert ts.roughness_distance(np.array([10.0, 20, 30]), np.array([10.0, 20, 30])) == 0


# ------------------------------------------------------------------ plane fit
def test_plane_coeffs_and_detrend():
    n = 9
    x = np.arange(n) - 4.0
    z = 5.0 + 0.3 * x[None, :] - 0.7 * x[:, None]
    a, b, c = ts.plane_coeffs(np.stack([z, z * 2]))
    assert np.allclose(a, [5.0, 10.0]) and np.allclose(b, [0.3, 0.6]) and np.allclose(c, [-0.7, -1.4])
    assert np.abs(ts.detrend(z[None])).max() < 1e-12


def test_block_view():
    a = np.arange(7 * 8).reshape(7, 8)
    v = ts.block_view(a, 3)
    assert v.shape == (2, 2, 3, 3) and v[1, 1, 0, 0] == a[3, 3]


# ------------------------------------------------------------------ Moon
def test_pixel_to_latlon():
    size, px, r = 101, 40.0, 40.0 * 20
    lat, lon = ts.pixel_to_latlon(50, 50, size, px)
    assert lat == pytest.approx(-90.0)
    expected = math.degrees(2 * math.atan(r / (2 * MOON_RADIUS_M)) - math.pi / 2)
    lat, lon = ts.pixel_to_latlon(50, 70, size, px)                    # +col axis
    assert lon == pytest.approx(90.0) and lat == pytest.approx(expected)
    lat, lon = ts.pixel_to_latlon(70, 50, size, px)                    # +row axis (down) = lon 180
    assert lon == pytest.approx(180.0) and lat == pytest.approx(expected)
    assert ts.pixel_to_latlon(30, 50, size, px)[1] == pytest.approx(0.0)  # top = lon 0
    assert ts.pixel_to_latlon(50, 30, size, px)[1] == pytest.approx(270.0)


def test_lunar_windows_masking():
    size = 103
    rng = np.random.default_rng(0)
    z = rng.normal(0, 5, (size, size))
    max_lat = -89.95
    res = ts.lunar_windows(z, 40.0, max_lat, strip_rows=2)
    lat = latitude_grid(size, 40.0)
    n = len(res["hist_shape"])
    assert 0 < n < 16 and res["rough"].shape == (n, 3) and np.isfinite(res["hist_shape"]).all()
    assert res["frac_above"].shape == (n, 3) and res["rough_pct"].shape == (n, 3)
    assert np.asarray(res["rough_sorted"]).shape == (3, n) and np.asarray(res["frac_sorted"]).shape == (3, n)
    assert np.all(np.diff(res["rough_sorted"], axis=1) >= 0)
    assert ((res["rough_pct"] >= 0) & (res["rough_pct"] <= 100)).all()
    for br, bc, row, col, la in zip(res["block_row"], res["block_col"], res["row"], res["col"], res["lat"]):
        assert (row, col) == (1 + br * 25 + 12, 1 + bc * 25 + 12)
        assert (lat[1 + br * 25: 1 + br * 25 + 25, 1 + bc * 25: 1 + bc * 25 + 25] <= max_lat).all()
        assert la == pytest.approx(lat[row, col], abs=1e-6)
    expected = sum((lat[1 + i * 25: 26 + i * 25, 1 + j * 25: 26 + j * 25] <= max_lat).all()
                   for i in range(4) for j in range(4))
    assert n == expected
    one = ts.window_features(z[0:27, 0:27])                            # strips agree with direct computation
    i = [k for k in range(n) if res["block_row"][k] == 0 and res["block_col"][k] == 0]
    assert not i or np.allclose(res["hist_shape"][i[0]], one["hist_shape"][0, 0])


def test_top_matches():
    moon = synth_moon(50, seed=1)
    res = ts.top_matches(moon["hist_shape"][17], moon["rough_pct"][17], moon, k=3)
    assert len(res) == 3 and [r["rank"] for r in res] == [1, 2, 3]
    assert res[0]["block_row"] == 17 and res[0]["similarity_pct"] == 100.0
    sims = [r["similarity_pct"] for r in res]
    assert sims == sorted(sims, reverse=True)


def known_moon():
    """Lunar reference with known distributions: roughness 1..100 m at every scale, frac_above 0..0.2."""
    return {"rough_sorted": np.tile(np.linspace(1, 100, 100), (3, 1)),
            "frac_sorted": np.tile(np.linspace(0.0, 0.2, 100), (3, 1))}


def test_differences_block_direction_and_flags():
    moon = known_moon()
    q25, q75 = np.percentile(moon["rough_sorted"][1], [25, 75])
    earth = {"slope_frac_above": {"15": 0.19, "20": 0.01, "25": 0.1},
             "roughness_m": {"120": 0.5, "360": 50.0, "1000": 150.0}}
    r = ts.differences_block(earth, moon)
    assert r["slope_frac_above"]["15"]["direction"] == "higher"
    assert r["slope_frac_above"]["20"]["direction"] == "lower"
    assert r["slope_frac_above"]["25"]["direction"] == "similar"
    assert r["roughness"]["120"]["direction"] == "lower" and r["roughness"]["120"]["below_lunar_min"]
    assert r["roughness"]["360"]["direction"] == "similar" and not r["roughness"]["360"]["below_lunar_min"]
    assert r["roughness"]["1000"]["direction"] == "higher" and r["roughness"]["1000"]["above_lunar_max"]
    assert r["roughness"]["120"]["lunar_percentile"] == 0.0 and r["roughness"]["1000"]["lunar_percentile"] == 100.0
    assert r["roughness"]["360"]["moon_p25_m"] == round(float(q25), 2)
    assert r["roughness"]["360"]["moon_p75_m"] == round(float(q75), 2)
    assert set(r["slope_frac_above"]["15"]) == {"earth", "moon_p25", "moon_p50", "moon_p75", "lunar_percentile",
                                                "direction"}
    assert set(r["roughness"]["120"]) == {"earth_m", "moon_p25_m", "moon_p50_m", "moon_p75_m", "lunar_percentile",
                                          "below_lunar_min", "above_lunar_max", "direction"}


def test_differences_block_zero_vs_zero_quartile_is_similar():
    moon = {"rough_sorted": np.tile(np.linspace(1, 100, 100), (3, 1)), "frac_sorted": np.zeros((3, 100))}
    earth = {"slope_frac_above": {"15": 0.0, "20": 0.0, "25": 0.0}, "roughness_m": {"120": 5, "360": 5, "1000": 5}}
    r = ts.differences_block(earth, moon)
    assert all(v["direction"] == "similar" and v["lunar_percentile"] == 50.0 for v in r["slope_frac_above"].values())


def test_lunar_reference_and_constants():
    ref = ts.lunar_reference(known_moon())
    assert set(ref["slope_frac_above"]) == {"15", "20", "25"} and set(ref["roughness_m"]) == {"120", "360", "1000"}
    assert ref["roughness_m"]["120"]["p50_m"] == 50.5
    assert set(ts.SLOPE_THRESHOLDS) == {"15", "20", "25"} and ts.NOT_COVERED and ts.SLOPE_THRESHOLDS_SOURCE


def fake_features(lat, lon):
    if lat > 50:
        raise ValueError("window not fully covered by the DEM")
    return {"slope_hist_shape": list(np.eye(18)[2]), "slope_hist_raw": list(np.eye(18)[3]),
            "slope_frac_above": {"15": 0.123456, "20": 0.05, "25": 0.0},
            "roughness_m": {"120": 1.0, "360": 1.0, "1000": 1.0}}


def test_build_survives_failure():
    moon = synth_moon(5, seed=2)
    moon["hist_shape"] = np.eye(18)[:5]
    sites = [{"id": "a", "name": "A", "lat": 10, "lon": 0}, {"id": "b", "name": "B", "lat": 60, "lon": 0},
             {"id": "c", "name": "C", "lat": -10, "lon": 0}]
    out = ts.build(sites, moon, feature_fn=fake_features)
    assert [o["id"] for o in out] == ["a", "b", "c"]
    assert out[1]["earth"] is None and out[1]["matches"] is None and out[1]["differences"] is None
    assert "not fully covered" in out[1]["error"]
    assert out[0]["earth"] is not None and len(out[0]["matches"]) == 3 and "error" not in out[0]
    assert out[0]["earth"]["slope_frac_above"]["15"] == 0.123                  # rounded in the output only
    rv = out[0]["differences"]
    assert set(rv) == {"slope_frac_above", "roughness"} and set(rv["slope_frac_above"]) == {"15", "20", "25"}
    assert set(rv["roughness"]) == {"120", "360", "1000"}
    assert all("direction" in v and "lunar_percentile" in v for v in rv["roughness"].values())
    assert out[2]["matches"][0]["similarity_pct"] > 50


# ------------------------------------------------------------------ Earth (rasterio)
def test_earth_window_on_synthetic_geotiff(tmp_path):
    rasterio = pytest.importorskip("rasterio")
    from rasterio.transform import from_origin
    lat0, lon0, deg = 10.0, 20.0, 11.0
    pix = 1 / 3600
    size = 200
    left, top = lon0 - size / 2 * pix, lat0 + size / 2 * pix
    east_m = (np.arange(size) + 0.5 - size / 2) * pix * math.radians(1) * 6_371_000.0 * math.cos(math.radians(lat0))
    z = np.tile(east_m * math.tan(math.radians(deg)), (size, 1)).astype("float32")
    path = str(tmp_path / "dem.tif")
    with rasterio.open(path, "w", driver="GTiff", height=size, width=size, count=1, dtype="float32",
                       crs="EPSG:4326", transform=from_origin(left, top, pix, pix), nodata=-9999) as dst:
        dst.write(z, 1)
    w = ts.earth_window(lat0, lon0, url=path)
    assert w.shape == (27, 27) and np.isfinite(w).all()
    h, _ = feats(w, raw=True)
    assert int(np.argmax(h)) == 4 and h[4] > 0.9
    f = ts.earth_features(lat0, lon0, url=path)
    assert f["slope_hist_shape"][0] > 0.9 and set(f["roughness_m"]) == {"120", "360", "1000"}
    assert int(np.argmax(f["slope_hist_raw"])) == 4 and set(f["slope_frac_above"]) == {"15", "20", "25"}
    assert f["slope_frac_above"]["15"] == 0.0
    with pytest.raises(ValueError, match="not fully covered"):          # window runs off the raster
        ts.earth_features(lat0 + size / 2 * pix - 0.0005, lon0, url=path)
