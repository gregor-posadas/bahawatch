# FABDEM vs ICESat-2 ground (SlideRule PhoREAL exports), per campus box. Heights: H = h_te_median - N(EGM2008).
import sys, glob, json, os, numpy as np, pandas as pd, rasterio
from scipy.interpolate import RegularGridInterpolator
SP, csvs = sys.argv[1], sys.argv[2:]
d = pd.concat([pd.read_csv(f) for f in csvs], ignore_index=True).drop_duplicates(["time_ns", "gt", "segment_id_beg"])
d = d[(d.h_te_median > 0) & (d.ground_photon_count >= 10) & (d.pflags == 0)]
def bil(path, lon, lat):
    with rasterio.open(path) as r:
        a = r.read(1).astype(float); t = r.transform
        if r.nodata is not None: a[a == r.nodata] = np.nan
        xs = t.c + t.a * (np.arange(r.width) + 0.5); ys = t.f + t.e * (np.arange(r.height) + 0.5)
    return RegularGridInterpolator((ys[::-1], xs), a[::-1], bounds_error=False, fill_value=np.nan)(np.c_[lat, lon])
d["H"] = d.h_te_median - bil(f"{SP}/us_nga_egm08_25.tif", d.longitude.values, d.latitude.values)
rows, keep = [], []
for f in sorted(glob.glob("data/*.json")):
    j = json.load(open(f)); b = j.get("bbox"); sid = os.path.basename(f)[:-5]
    if not b or b[0] < 100: continue
    s = d[(d.longitude >= b[0]) & (d.longitude <= b[2]) & (d.latitude >= b[1]) & (d.latitude <= b[3])].copy()
    if not len(s): continue
    s["fabdem"] = bil(f"inputs/campuses/{sid}/dem.tif", s.longitude.values, s.latitude.values); s["site"] = sid
    e = (s.fabdem - s.H).dropna(); keep.append(s)
    rows.append(dict(site=sid, n=len(e), bias=e.mean(), median=e.median(), rmse=np.sqrt((e**2).mean()),
                     nmad=1.4826*np.median(np.abs(e-e.median())), within1=100*(e.abs()<1).mean(), within2=100*(e.abs()<2).mean(),
                     tall=(s.h_canopy>=12).mean()*100))
t = pd.DataFrame(rows)
a = pd.concat(keep); e = (a.fabdem - a.H).dropna()
print(t.round(2).to_string(index=False))
print(f"\nALL {len(e)} segments, {len(t)} campuses: bias {e.mean():+.2f}  median {e.median():+.2f}  RMSE {np.sqrt((e**2).mean()):.2f}  NMAD {1.4826*np.median(np.abs(e-e.median())):.2f}  <1m {100*(e.abs()<1).mean():.0f}%  <2m {100*(e.abs()<2).mean():.0f}%")
a[["site","latitude","longitude","H","fabdem","ground_photon_count","h_canopy","solar_elevation","time_ns_formatted"]].to_csv(f"{SP}/icesat2_ground_points.csv", index=False)
