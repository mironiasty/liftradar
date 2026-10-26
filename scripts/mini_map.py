"""Draw the small map in the index page's header: shaded relief and country borders.

Writes three files to the output folder, all covering the same frame (below):

- `mini-map-light.webp` and `mini-map-dark.webp`: shaded relief for each theme, from the
  open Terrain Tiles on AWS (Mapzen's terrarium format, https://registry.opendata.aws/terrain-tiles/).
- `mini-map.svg`: one path per country, with the country's code as `data-country`, from
  Natural Earth's 1:50m countries (ne_50m_admin_0_countries.geojson from
  https://github.com/nvkelso/natural-earth-vector/tree/master/geojson).

The page draws the resorts on top, using the frame stored on the SVG's root element:

    x = (lon - west) * k * scale,  y = (north - lat) * scale

    uv run --no-project --with shapely --with numpy --with pillow \\
        python3 scripts/mini_map.py ne_50m_admin_0_countries.geojson assets
"""

import io
import json
import math
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from shapely.geometry import box, shape
from shapely.geometry.base import BaseGeometry

# From the French Pyrenees to the Tatras, about the tile's 7:4 shape.
WEST, EAST, SOUTH, NORTH = -2.0, 23.0, 41.8, 51.5
K = math.cos(math.radians((SOUTH + NORTH) / 2))
SCALE = 40
WIDTH, HEIGHT = round((EAST - WEST) * K * SCALE), round((NORTH - SOUTH) * SCALE)
# The relief images are this many times the SVG's size, so they stay sharp on wide phones.
PIXELS = 1.5

TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
ZOOM = 6
EXAGGERATION = 3

# Elevation (m) to colour, per theme; the first entry is the sea.
PALETTES = {
    "light": [(None, (196, 218, 234)), (0, (222, 230, 216)), (600, (214, 222, 200)), (1200, (226, 220, 200)),
              (1900, (234, 231, 226)), (2500, (247, 249, 251)), (3500, (255, 255, 255))],
    "dark": [(None, (24, 33, 44)), (0, (33, 37, 35)), (600, (40, 44, 40)), (1200, (52, 52, 50)),
             (1900, (78, 82, 88)), (2500, (118, 126, 136)), (3500, (150, 158, 168))],
}


def point(lon: float, lat: float) -> str:
    return f"{(lon - WEST) * K * SCALE:.1f} {(NORTH - lat) * SCALE:.1f}"


def path(geometry: BaseGeometry) -> str:
    polygons = getattr(geometry, "geoms", [geometry])
    parts = []
    for polygon in polygons:
        if polygon.geom_type != "Polygon":
            continue
        for ring in [polygon.exterior, *polygon.interiors]:
            coords = list(ring.coords)[:-1]
            parts.append("M" + " L".join(point(lon, lat) for lon, lat in coords) + "Z")
    return "".join(parts)


def borders(countries: Path) -> str:
    frame = box(WEST - 1, SOUTH - 1, EAST + 1, NORTH + 1)
    paths = []
    for feature in json.loads(countries.read_text(encoding="utf-8"))["features"]:
        geometry = shape(feature["geometry"]).intersection(frame).simplify(0.015, preserve_topology=True)
        if geometry.is_empty:
            continue
        code = feature["properties"]["ISO_A2_EH"].lower()
        paths.append(f'<path data-country="{code}" d="{path(geometry)}"/>')
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" '
        f'data-west="{WEST}" data-north="{NORTH}" data-k="{K:.5f}" data-scale="{SCALE}">\n'
        + "\n".join(sorted(paths)) + "\n</svg>\n"
    )


def mercator(lon: np.ndarray, lat: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Pixel position in the world at ZOOM."""
    size = 256 * 2**ZOOM
    lat = np.radians(lat)
    return (lon + 180) / 360 * size, (1 - np.log(np.tan(lat) + 1 / np.cos(lat)) / math.pi) / 2 * size


def elevation() -> np.ndarray:
    """Elevation in metres for every pixel of the relief images."""
    width, height = round(WIDTH * PIXELS), round(HEIGHT * PIXELS)
    lon = WEST + (np.arange(width) + 0.5) / width * (EAST - WEST)
    lat = NORTH - (np.arange(height) + 0.5) / height * (NORTH - SOUTH)
    x, y = mercator(*np.meshgrid(lon, lat))
    x0, y0 = int(x.min()) // 256, int(y.min()) // 256
    x1, y1 = int(x.max()) // 256, int(y.max()) // 256
    mosaic = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256))
    for ty in range(y0, y1 + 1):
        for tx in range(x0, x1 + 1):
            with urllib.request.urlopen(TILES.format(z=ZOOM, x=tx, y=ty), timeout=30) as response:
                rgb = np.asarray(Image.open(io.BytesIO(response.read())).convert("RGB"), dtype=float)
            tile = rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768
            mosaic[(ty - y0) * 256:(ty - y0 + 1) * 256, (tx - x0) * 256:(tx - x0 + 1) * 256] = tile
    # Bilinear sampling of the mosaic.
    mx, my = x - x0 * 256 - 0.5, y - y0 * 256 - 0.5
    ix, iy = np.clip(mx.astype(int), 0, mosaic.shape[1] - 2), np.clip(my.astype(int), 0, mosaic.shape[0] - 2)
    fx, fy = np.clip(mx - ix, 0, 1), np.clip(my - iy, 0, 1)
    top = mosaic[iy, ix] * (1 - fx) + mosaic[iy, ix + 1] * fx
    bottom = mosaic[iy + 1, ix] * (1 - fx) + mosaic[iy + 1, ix + 1] * fx
    return top * (1 - fy) + bottom * fy


def hillshade(height: np.ndarray) -> np.ndarray:
    """Light from the north-west, 1 on flat ground, darker on slopes facing away."""
    metres = (EAST - WEST) * K * 111_320 / height.shape[1]
    dy, dx = np.gradient(height * EXAGGERATION, metres)
    slope = np.arctan(np.hypot(dx, dy))
    aspect = np.arctan2(-dx, dy)
    azimuth, altitude = math.radians(315), math.radians(45)
    shade = np.sin(altitude) * np.cos(slope) + np.cos(altitude) * np.sin(slope) * np.cos(azimuth - math.pi / 2 - aspect)
    return np.clip(1 + 0.75 * (shade - math.sin(altitude)), 0.45, 1.15)


def relief(height: np.ndarray, shade: np.ndarray, palette: list) -> Image.Image:
    sea, *land = palette
    stops = np.array([h for h, _ in land], dtype=float)
    colours = np.array([c for _, c in land], dtype=float)
    rgb = np.stack([np.interp(height, stops, colours[:, i]) for i in range(3)], axis=-1)
    rgb *= np.where(height > 0, shade, 1)[..., None]
    rgb[height <= 0] = sea[1]
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))


def main() -> None:
    countries, target = Path(sys.argv[1]), Path(sys.argv[2])
    (target / "mini-map.svg").write_text(borders(countries), encoding="utf-8")
    height = elevation()
    shade = hillshade(height)
    for theme, palette in PALETTES.items():
        relief(height, shade, palette).save(target / f"mini-map-{theme}.webp", quality=80, method=6)


if __name__ == "__main__":
    main()
