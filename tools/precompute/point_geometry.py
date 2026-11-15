"""Geometria de un punto (lat, lon) a partir de Copernicus DEM GLO-30 (COG en AWS, lectura parcial, sin almacenamiento).

Devuelve los parametros del catalogo de docs/scenarios.md:
    elevation   altitud en el punto (m)
    slope_mean  pendiente media en una ventana de 1 km (grados)
    slope_max   pendiente maxima en una ventana de 1 km (grados)
    roughness   desviacion estandar de la altitud en una ventana de 1 km (m)

Dependencias: numpy, rasterio.  Uso:
    python point_geometry.py -24.1 -70.0
    from point_geometry import point_geometry; point_geometry(75.4, -89.8)
"""
from __future__ import annotations
import json
import math
import sys

import numpy as np

R_EARTH = 6_371_000.0
BASE_URL = "https://copernicus-dem-30m.s3.amazonaws.com"


class TileNotFound(Exception):
    """El tile no existe (oceano) o no se pudo abrir."""


def tile_name(lat: float, lon: float) -> str:
    """Nombre del tile de 1x1 grado que contiene el punto, p. ej. Copernicus_DSM_COG_10_S25_00_W071_00_DEM."""
    la, lo = math.floor(lat), math.floor(lon)
    ns, ew = ("N" if la >= 0 else "S"), ("E" if lo >= 0 else "W")
    return f"Copernicus_DSM_COG_10_{ns}{abs(la):02d}_00_{ew}{abs(lo):03d}_00_DEM"


def tile_url(lat: float, lon: float) -> str:
    name = tile_name(lat, lon)
    return f"{BASE_URL}/{name}/{name}.tif"


def point_tile_url(lat: float, lon: float) -> str:
    """Tile a ouvrir para el punto. Una latitud entera (p. ej. 25.0) es el borde inferior del tile N25,
    fuera de su raster (fila = altura) : se usa el tile de abajo (N24), cuyo borde superior la contiene."""
    if lat == math.floor(lat) and lat > -90:
        lat -= 1e-9
    return tile_url(lat, lon)


def slope_deg(z: np.ndarray, dx_m: float, dy_m: float) -> np.ndarray:
    """Pendiente en grados por diferencias centradas. Los NaN se propagan."""
    gy = np.gradient(z, dy_m, axis=0)
    gx = np.gradient(z, dx_m, axis=1)
    return np.degrees(np.arctan(np.hypot(gx, gy)))


def geometry_from_array(z: np.ndarray, dx_m: float, dy_m: float, margin: int = 1) -> dict:
    """Estadisticas de la ventana. `margin` = pixeles de borde leidos solo para el gradiente (se descartan al final)."""
    z = np.asarray(z, dtype="float64")
    s = slope_deg(z, dx_m, dy_m)
    if margin and min(z.shape) > 2 * margin:
        z_in, s_in = z[margin:-margin, margin:-margin], s[margin:-margin, margin:-margin]
    else:
        z_in, s_in = z, s
    valid = float(np.isfinite(z_in).mean()) if z_in.size else 0.0
    if valid == 0.0 or not np.isfinite(s_in).any():
        return {"elevation": None, "slope_mean": None, "slope_max": None, "roughness": None, "valid_frac": round(valid, 3)}
    cy, cx = z_in.shape[0] // 2, z_in.shape[1] // 2
    centre = z_in[cy, cx]
    return {
        "elevation": round(float(centre if np.isfinite(centre) else np.nanmean(z_in)), 1),
        "slope_mean": round(float(np.nanmean(s_in)), 2),
        "slope_max": round(float(np.nanmax(s_in)), 2),
        "roughness": round(float(np.nanstd(z_in)), 2),
        "valid_frac": round(valid, 3),
    }


def point_geometry(lat: float, lon: float, window_m: float = 1000.0, url: str | None = None) -> dict:
    """Lee solo la ventana de `window_m` metros alrededor del punto y calcula los 4 parametros.

    `url` permite apuntar a otro raster (pruebas, NASADEM). Limite conocido: si el punto esta a menos de
    ~500 m del borde de un tile, la ventana se recorta al tile (valid_frac y window_px lo reflejan).
    """
    import rasterio
    from rasterio.errors import RasterioIOError
    from rasterio.windows import Window

    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("lat/lon fuera de rango")
    src_url = url or point_tile_url(lat, lon)
    try:
        src = rasterio.open(src_url)
    except RasterioIOError as e:
        raise TileNotFound(f"tile inexistente o inaccesible (oceano, o sin red) para ({lat}, {lon}): {src_url}") from e
    with src:
        if src.crs is None or not src.crs.is_geographic:
            raise ValueError("se espera un DEM en coordenadas geograficas (EPSG:4326)")
        dy_m = math.radians(abs(src.transform.e)) * R_EARTH
        dx_m = math.radians(abs(src.transform.a)) * R_EARTH * max(math.cos(math.radians(lat)), 0.01)
        row, col = src.index(lon, lat)
        if not (0 <= row < src.height and 0 <= col < src.width):
            raise TileNotFound(f"el punto ({lat}, {lon}) cae fuera del raster {src_url}")
        half_r = max(int(round(window_m / 2 / dy_m)), 1)
        half_c = max(int(round(window_m / 2 / dx_m)), 1)
        margin = 1
        r0, r1 = max(row - half_r - margin, 0), min(row + half_r + margin + 1, src.height)
        c0, c1 = max(col - half_c - margin, 0), min(col + half_c + margin + 1, src.width)
        z = src.read(1, window=Window(c0, r0, c1 - c0, r1 - r0), masked=True).astype("float64").filled(np.nan)
    out = geometry_from_array(z, dx_m, dy_m, margin)
    out.update({"lat": lat, "lon": lon, "source": "Copernicus DEM GLO-30" if url is None else url,
                "window_m": window_m, "window_px": [int(z.shape[0]), int(z.shape[1])],
                "pixel_m": [round(dx_m, 1), round(dy_m, 1)]})
    return out


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("uso: python point_geometry.py <lat> <lon>")
    print(json.dumps(point_geometry(float(sys.argv[1]), float(sys.argv[2])), indent=1))
