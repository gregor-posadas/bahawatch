#!/usr/bin/env python3
"""BahaWatch basemap styles for MapLibre (spec §4.2): our paper look over our own vector tiles (shared/tiles/, built by
tools/build_basemap.py); UC Berkeley's zoomed-out view alone uses OpenFreeMap (basemap-style-world*.json).
  python3 tools/basemap_style.py     # writes shared/basemap-style.json, shared/basemap-style-dark.json and the
                                     # offline test style tests/fixtures/basemap-offline.json (GeoJSON only)
One definition, two palettes (plan ruling 8); tools/test_basemap_style.py checks them."""
import glob, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES = "https://tiles.openfreemap.org/planet"
WORLD_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf"
GLYPHS = "shared/fonts/{fontstack}/{range}.pbf"
OWN_ATTRIBUTION = "© OpenStreetMap contributors · buildings: Open Buildings (Google, Microsoft, via VIDA)"
ATTRIBUTION = "OpenFreeMap © OpenMapTiles Data from OpenStreetMap"
PALETTES = {
    "light": dict(land="#f8f4ec", sea="#d6ddde", river="#70c0e0", residential="#f1ebdf", park="#e6e8d8", boundary="#a39a8a",
                  road="#ffffff", casing="#c9bca6", building="#e2d8c6", builtup="#d8cab2", label="#232120", halo="#f8f4ec"),
    "dark": dict(land="#1f1e1c", sea="#1f2c35", river="#70c0e0", residential="#262421", park="#232821", boundary="#6b645b",
                 road="#4a4640", casing="#1c1a18", building="#34312c", builtup="#3a352f", label="#f3efe7", halo="#1f1e1c"),
}
MAJOR, MID, MINOR = ["motorway", "trunk", "primary"], ["secondary", "tertiary"], ["minor", "service"]


def width(z0, w0, z1, w1):
    return ["interpolate", ["exponential", 1.5], ["zoom"], z0, w0, z1, w1]


def road(id_, classes, minzoom, w, casing, p):
    f = ["match", ["get", "class"], classes, True, False]
    base = {"type": "line", "source": "openmaptiles", "source-layer": "transportation", "minzoom": minzoom, "filter": f,
            "layout": {"line-cap": "round", "line-join": "round"}}
    return [dict(base, id=id_ + "-casing", paint={"line-color": p["casing"], "line-width": casing}),
            dict(base, id=id_, paint={"line-color": p["road"], "line-width": w})]


def label_paint(p):
    return {"text-color": p["label"], "text-halo-color": p["halo"], "text-halo-width": 1.5}


def style(theme):
    """Our own tiles (tools/build_basemap.py): the whole country from ph-base.pmtiles, and every site's streets,
    waterways and building footprints from site-<id>.pmtiles. Fonts are served from shared/fonts/."""
    p = PALETTES[theme]
    sites = sorted(os.path.basename(f)[5:-8] for f in glob.glob(os.path.join(ROOT, "shared", "tiles", "site-*.pmtiles")))
    sources = {"base": {"type": "vector", "url": "pmtiles://shared/tiles/ph-base.pmtiles", "attribution": OWN_ATTRIBUTION}}
    for sid in sites:
        sources["site-" + sid] = {"type": "vector", "url": f"pmtiles://shared/tiles/site-{sid}.pmtiles"}
    cls = lambda *c: ["match", ["get", "class"], list(c), True, False]
    line = {"line-cap": "round", "line-join": "round"}

    def roads(src, lyr, mz):
        out = []
        for id_, c, z0, wmin, wmax in (("road-minor", ("minor",), 12, 0.5, 8), ("road-mid", ("secondary", "tertiary", "mid"), 9, 0.5, 12),
                                        ("road-major", ("motorway", "trunk", "primary", "major"), 4, 0.6, 16)):
            base = {"type": "line", "source": src, "source-layer": lyr, "minzoom": max(mz, z0), "filter": cls(*c), "layout": line}
            out += [dict(base, id=f"{id_}-casing{'' if src == 'base' else '-' + src}", paint={"line-color": p["casing"], "line-width": width(z0, wmin + 1.2, 18, wmax + 2)}),
                    dict(base, id=f"{id_}{'' if src == 'base' else '-' + src}", paint={"line-color": p["road"], "line-width": width(z0, wmin, 18, wmax)})]
        return out
    layers = [
        {"id": "water", "type": "background", "paint": {"background-color": p["sea"]}},
        {"id": "land", "type": "fill", "source": "base", "source-layer": "land", "paint": {"fill-color": p["land"]}},
        {"id": "builtup", "type": "fill", "source": "base", "source-layer": "builtup",
         "paint": {"fill-color": p["builtup"], "fill-antialias": False,
                   "fill-opacity": ["interpolate", ["linear"], ["zoom"], 4, ["*", 0.33, ["get", "d"]], 10, ["*", 0.25, ["get", "d"]], 12, ["*", 0.12, ["get", "d"]], 14, 0.1]}},
        {"id": "river", "type": "line", "source": "base", "source-layer": "rivers", "minzoom": 9,
         "paint": {"line-color": p["river"], "line-width": width(9, 0.6, 16, 3)}},
    ]
    for sid in sites:
        layers.append({"id": "waterway-" + sid, "type": "line", "source": "site-" + sid, "source-layer": "waterways", "minzoom": 12,
                       "paint": {"line-color": p["river"], "line-width": width(12, 1, 18, 5)}})
    for sid in sites:
        layers.append({"id": "building-" + sid, "type": "fill", "source": "site-" + sid, "source-layer": "buildings", "minzoom": 14,
                       "paint": {"fill-color": p["building"], "fill-outline-color": p["casing"]}})
    layers += roads("base", "roads", 4)
    for sid in sites:
        layers += roads("site-" + sid, "streets", 12)
    for sid in sites:
        layers.append({"id": "road-label-" + sid, "type": "symbol", "source": "site-" + sid, "source-layer": "streets", "minzoom": 15,
                       "layout": {"symbol-placement": "line", "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 12},
                       "paint": label_paint(p)})
    layers += [
        {"id": "road-label", "type": "symbol", "source": "base", "source-layer": "roads", "minzoom": 12,
         "filter": cls("motorway", "trunk", "primary"),
         "layout": {"symbol-placement": "line", "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 12},
         "paint": label_paint(p)},
        {"id": "place-label", "type": "symbol", "source": "base", "source-layer": "places",
         "layout": {"text-field": ["get", "name"], "text-font": ["Noto Sans Medium"],
                    "text-size": ["match", ["get", "place"], "city", 14, 12]},
         "paint": label_paint(p)},
    ]
    return {"version": 8, "name": f"BahaWatch {theme}", "glyphs": GLYPHS, "sources": sources, "layers": layers}


def world_style(theme):
    """OpenFreeMap tiles, only for UC Berkeley's zoomed-out view (our own tiles cover the Philippines only)."""
    p = PALETTES[theme]
    name = ["coalesce", ["get", "name:latin"], ["get", "name"]]
    layers = [
        {"id": "land", "type": "background", "paint": {"background-color": p["land"]}},
        {"id": "residential", "type": "fill", "source": "openmaptiles", "source-layer": "landuse",
         "filter": ["==", ["get", "class"], "residential"], "paint": {"fill-color": p["residential"]}},
        {"id": "park", "type": "fill", "source": "openmaptiles", "source-layer": "park", "paint": {"fill-color": p["park"]}},
        {"id": "water", "type": "fill", "source": "openmaptiles", "source-layer": "water", "paint": {"fill-color": p["sea"]}},
        {"id": "river", "type": "line", "source": "openmaptiles", "source-layer": "waterway", "minzoom": 8,
         "filter": ["match", ["get", "class"], ["river", "stream", "canal"], True, False],
         "paint": {"line-color": p["river"], "line-width": width(8, 0.6, 16, 4)}},
        {"id": "boundary-province", "type": "line", "source": "openmaptiles", "source-layer": "boundary",
         "filter": ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
         "paint": {"line-color": p["boundary"], "line-width": 0.8, "line-dasharray": [3, 2]}},
        *road("road-minor", MINOR, 12, width(12, 0.5, 18, 8), width(12, 1.5, 18, 10), p),
        *road("road-mid", MID, 9, width(9, 0.5, 18, 12), width(9, 1.5, 18, 14), p),
        *road("road-major", MAJOR, 6, width(6, 0.6, 18, 16), width(6, 1.6, 18, 18), p),
        {"id": "building", "type": "fill", "source": "openmaptiles", "source-layer": "building", "minzoom": 14,
         "paint": {"fill-color": p["building"], "fill-outline-color": p["casing"]}},
        {"id": "road-label", "type": "symbol", "source": "openmaptiles", "source-layer": "transportation_name", "minzoom": 13,
         "layout": {"symbol-placement": "line", "text-field": name, "text-font": ["Noto Sans Regular"], "text-size": 12},
         "paint": label_paint(p)},
        {"id": "place-label", "type": "symbol", "source": "openmaptiles", "source-layer": "place",
         "filter": ["match", ["get", "class"], ["city", "town", "village", "suburb"], True, False],
         "layout": {"text-field": name, "text-font": ["Noto Sans Bold"],
                    "text-size": ["match", ["get", "class"], "city", 15, "town", 13, 12]},
         "paint": label_paint(p)},
    ]
    return {"version": 8, "name": f"BahaWatch world {theme}", "glyphs": WORLD_GLYPHS,
            "sources": {"openmaptiles": {"type": "vector", "url": TILES, "attribution": ATTRIBUTION}}, "layers": layers}


def fixture():
    """The offline style for the page tests: the country outline on the sea and two roads, no network at all."""
    p = PALETTES["light"]
    outline = json.load(open(os.path.join(ROOT, "data", "ph_outline.json"), encoding="utf-8"))
    roads = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {}, "geometry": {"type": "LineString", "coordinates": [[120.98, 14.55], [121.07, 14.65]]}},
        {"type": "Feature", "properties": {}, "geometry": {"type": "LineString", "coordinates": [[123.88, 10.29], [123.93, 10.35]]}}]}
    return {"version": 8, "name": "BahaWatch offline test",
            "sources": {"land": {"type": "geojson", "data": {"type": "Feature", "properties": {}, "geometry": outline}},
                        "roads": {"type": "geojson", "data": roads}},
            "layers": [{"id": "water", "type": "background", "paint": {"background-color": p["sea"]}},
                       {"id": "land", "type": "fill", "source": "land", "paint": {"fill-color": p["land"]}},
                       {"id": "road-major", "type": "line", "source": "roads", "paint": {"line-color": p["casing"], "line-width": 3}}]}


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    write(os.path.join(ROOT, "shared", "basemap-style.json"), style("light"))
    write(os.path.join(ROOT, "shared", "basemap-style-dark.json"), style("dark"))
    write(os.path.join(ROOT, "shared", "basemap-style-world.json"), world_style("light"))
    write(os.path.join(ROOT, "shared", "basemap-style-world-dark.json"), world_style("dark"))
    write(os.path.join(ROOT, "tests", "fixtures", "basemap-offline.json"), fixture())
    print("wrote shared/basemap-style.json, shared/basemap-style-dark.json, tests/fixtures/basemap-offline.json")
