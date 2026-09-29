"""Shared definitions for the PhilDev campus pipeline. Runs on Gregor's PC (Python 3.10) and in the container.
Standard library only."""
import csv, math, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
CAMPUSES_CSV = os.path.join(HERE, "campuses.csv")
BOX_HALF_M = 1500.0          # a 3 km box centred on the campus (spec §3.2, N2)
MARGIN_M = 300.0             # extra ring cut around each box, so edge cells have neighbours
GRID = 200                   # model cells per side (≈15 m)
WORLD = 1200                 # page world units per side
M_PER_DEG_LAT = 110640.0     # the same constants build_data.py uses
GROUPS = ("Luzon", "Visayas", "Mindanao")
TYPES = ("SUC", "LUC", "Private")
ID_RE = re.compile(r"^[a-z]+$")   # share tokens #p.<id>.… accept lowercase letters only
PILOT_BOXES = {"tv": (121.0470, 14.6300, 121.0755, 14.6545),   # Teachers Village keeps its own frame
               # Brgy. San Joaquin, Mabalacat City, Pampanga (PSA PH0305409022): 3 km around its PSA centre (2026-09-29)
               "sjq": (120.545552, 15.207867, 120.573482, 15.234982)}


def m_per_deg_lon(lat):
    return 111320.0 * math.cos(math.radians(lat))


def read_campuses(path=CAMPUSES_CSV):
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["hint_lat"] = float(r["hint_lat"]); r["hint_lon"] = float(r["hint_lon"])
        r["lat"] = float(r["lat"]) if r.get("lat") else None
        r["lon"] = float(r["lon"]) if r.get("lon") else None
    return rows


def box_around(lat, lon, half_m=BOX_HALF_M):
    """(lon0, lat0, lon1, lat1) of the square reaching half_m from (lat, lon) on each side."""
    dx = half_m / m_per_deg_lon(lat); dy = half_m / M_PER_DEG_LAT
    return (round(lon - dx, 6), round(lat - dy, 6), round(lon + dx, 6), round(lat + dy, 6))


def grow(bbox, m):
    lon0, lat0, lon1, lat1 = bbox; lat = (lat0 + lat1) / 2
    dx = m / m_per_deg_lon(lat); dy = m / M_PER_DEG_LAT
    return (lon0 - dx, lat0 - dy, lon1 + dx, lat1 + dy)


def overlaps(a, b):
    return a[0] <= b[2] and a[2] >= b[0] and a[1] <= b[3] and a[3] >= b[1]


def boxes(rows):
    """Final model boxes: every campus that has a centre, plus the pilot boxes."""
    out = {r["id"]: box_around(r["lat"], r["lon"]) for r in rows if r.get("lat") is not None}
    out.update(PILOT_BOXES)
    return out
