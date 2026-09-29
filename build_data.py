#!/usr/bin/env python3
"""
BahaWatch dashboard — data preprocessing.

Turns open geodata for one site into the compact JSON file the dashboard fetches (data/<site>.json).
Run once per site; re-run only when inputs, the frame, or the sensor sites change.

  SITE=tv python3 build_data.py          # a pilot site from sites.SITES
  SITE=upd python3 build_data.py         # a PhilDev campus from pipeline/campuses.csv (inputs/campuses/upd/)

Inputs (see README.md for how to obtain each):
  osm         OpenStreetMap GeoJSON: highways, waterways (and, for the pilots, buildings with addresses/names)
  dem         terrain GeoTIFF: FABDEM V1-2 for Philippine sites, USGS 1 m for Berkeley
  buildings   footprint GeoJSON from the pipeline (Philippine sites)
  noah        NOAH flood hazard (shapefiles for Teachers Village, clipped GeoJSON for campuses)

Output:
  data/<site>.json   frame + terrain + streets + creeks + buildings + NOAH + sea/blocked/building-count grids + units
                     (+ the partnership card for campuses; tools/build_places.py adds "places" afterwards)

Dependencies:  numpy scipy rasterio pyshp shapely
"""
import json, base64, math, os, sys
import numpy as np
import rasterio, shapefile
from scipy.ndimage import minimum_filter, gaussian_filter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from model import grids, placement, campus as campus_model

# ------------------------------------------------------------------ site config
from sites import get_site
SITE_ID = os.environ.get("SITE", "tv")
CFG = get_site(SITE_ID)
INPUT_OSM, INPUT_DEM, INPUT_NOAH = CFG["osm"], CFG["dem"], CFG["noah"]
OUTPUT = os.environ.get("OUTPUT", f"data/{SITE_ID}.json")        # the page fetches data/<site>.json
BUDGET = int(os.environ.get("BW_BUDGET", "650000"))              # raw bytes before places
GZ_BUDGET = int(os.environ.get("BW_GZ_BUDGET", str(225 * 1024)))  # gzipped bytes before places; the file must stay ≤ 250 KB gz
LON0, LAT0, LON1, LAT1 = CFG["bbox"]
W, H, GW, GH = CFG["W"], CFG["H"], CFG["GW"], CFG["GH"]
DSM_MIN_FILTER, DSM_SMOOTH_SIGMA, STREET_CARVE_M = CFG["min_filter"], CFG["sigma"], CFG["carve"]
SENSOR_TARGETS, LABEL_STREETS, ROAD_CLASS = CFG["sensors"], CFG["labels"], CFG["road_class"]
CREEK_TAGS = CFG["creek_tags"]

# ------------------------------------------------------------------ helpers
def wx(lon): return (lon-LON0)/(LON1-LON0)*W
def wy(lat): return (LAT1-lat)/(LAT1-LAT0)*H
def cell_ll(gx, gy):
    return (LON0+(gx+0.5)/GW*(LON1-LON0), LAT1-(gy+0.5)/GH*(LAT1-LAT0))
def b64(arr): return base64.b64encode(arr.tobytes()).decode()
def rle(g):
    flat=g.flatten(); out=bytearray(); i=0
    while i < len(flat):
        v=flat[i]; n=1
        while i+n < len(flat) and flat[i+n]==v and n<255: n+=1
        out += bytes([n,int(v)]); i+=n
    return base64.b64encode(bytes(out)).decode()
def douglas_peucker(pts, eps):
    if len(pts) < 3: return pts
    (ax,ay),(bx,by)=pts[0],pts[-1]; dmax=0; idx=0
    for i in range(1,len(pts)-1):
        px,py=pts[i]
        if ax==bx and ay==by: d=math.hypot(px-ax,py-ay)
        else:
            t=((px-ax)*(bx-ax)+(py-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2)
            t=min(max(t,0),1); d=math.hypot(px-(ax+t*(bx-ax)),py-(ay+t*(by-ay)))
        if d>dmax: dmax=d; idx=i
    if dmax>eps: return douglas_peucker(pts[:idx+1],eps)[:-1]+douglas_peucker(pts[idx:],eps)
    return [pts[0],pts[-1]]

# ------------------------------------------------------------------ 1. terrain
print("1/5 terrain: resampling DEM ...")
from pyproj import Transformer
ds=rasterio.open(INPUT_DEM); dem=ds.read(1).astype(np.float64)
if ds.nodata is not None: dem[dem==ds.nodata]=np.nan
_to_dem=Transformer.from_crs("EPSG:4326",ds.crs,always_xy=True)   # identity for WGS84 inputs
def dem_at(lon,lat):
    X,Y=_to_dem.transform(lon,lat)
    c=(X-ds.bounds.left)/ds.res[0]-0.5; r=(ds.bounds.top-Y)/ds.res[1]-0.5
    c=min(max(c,0),ds.width-1.001); r=min(max(r,0),ds.height-1.001)
    c0,r0=int(c),int(r); fc,fr=c-c0,r-r0
    q=[dem[r0,c0],dem[r0,min(c0+1,ds.width-1)],dem[min(r0+1,ds.height-1),c0],dem[min(r0+1,ds.height-1),min(c0+1,ds.width-1)]]
    if any(np.isnan(v) for v in q): return np.nan
    return q[0]*(1-fc)*(1-fr)+q[1]*fc*(1-fr)+q[2]*(1-fc)*fr+q[3]*fc*fr
# the terrain is sampled and smoothed on the coarse grid (EW×EH, 15 m: the DEM is 30 m) and stored there; the model's
# fine grid (GW×GH, 7.5 m since 2026-09-29) interpolates it (grids.fine_elev, the same arithmetic as the page)
EF=CFG.get("elev_factor",1); EW,EH=GW//EF,GH//EF; assert EW*EF==GW and EH*EF==GH, "grid must divide by elev_factor"
def cell_llE(ex,ey): return (LON0+(ex+0.5)/EW*(LON1-LON0), LAT1-(ey+0.5)/EH*(LAT1-LAT0))
coarse=np.array([[dem_at(*cell_llE(ex,ey)) for ex in range(EW)] for ey in range(EH)])
chole=np.isnan(coarse)
if chole.any():
    from scipy.ndimage import distance_transform_edt
    idx=distance_transform_edt(chole,return_distances=False,return_indices=True)
    coarse=coarse[tuple(idx)]
    print(f"  filled {int(chole.sum())} nodata cells from nearest neighbours")
if DSM_MIN_FILTER: coarse=minimum_filter(coarse,size=DSM_MIN_FILTER)
coarse=gaussian_filter(coarse,sigma=DSM_SMOOTH_SIGMA)
ELEV_DM=np.clip(np.round(coarse*10),0,32000).astype("<i2")          # what the file stores
raw=np.array([[dem_at(*cell_ll(gx,gy)) for gx in range(GW)] for gy in range(GH)])   # fine, unfilled: sea and holes
hole=np.isnan(raw)
elev=grids.fine_elev(ELEV_DM,EW,EH,GW,GH)                           # streets are carved once they are known
CELL_M=(LON1-LON0)*111320*math.cos(math.radians((LAT0+LAT1)/2))/GW
print(f"  {CELL_M:.1f} m model cells; terrain stored on {EW}×{EH}")
SEA=grids.sea_mask(raw) if CFG.get("sea") else np.zeros((GH,GW),bool)
if SEA.any(): print(f"  sea: {int(SEA.sum())} cells")

# ------------------------------------------------------------------ 2. OSM
print("2/5 osm: streets, creeks, buildings ...")
osm=json.load(open(INPUT_OSM))
def clip(pts): return [(x,y) for x,y in pts if LON0-0.001<=x<=LON1+0.001 and LAT0-0.001<=y<=LAT1+0.001]
roads=[]; waters=[]; blds=[]; addressed=[]; named=[]; name_ways={}
for f in osm["features"]:
    p=f.get("properties",{}); g=f["geometry"]
    if "highway" in p and p["highway"] in ROAD_CLASS and g["type"]=="LineString":
        pts=clip(g["coordinates"])
        if len(pts)<2: continue
        w=douglas_peucker([(wx(x),wy(y)) for x,y in pts],2.5)
        rd={"c":ROAD_CLASS[p["highway"]],"p":[[round(x,1),round(y,1)] for x,y in w]}
        if p.get("name"): rd["n"]=p["name"]          # kept so the UI can highlight a whole street
        roads.append(rd)
        if p.get("name"): name_ways.setdefault(p["name"],[]).append(w)
    elif "waterway" in p and p["waterway"] in CREEK_TAGS and g["type"]=="LineString":
        pts=clip(g["coordinates"])
        if len(pts)<2: continue
        w=douglas_peucker([(wx(x),wy(y)) for x,y in pts],2.0)
        waters.append({"n":p.get("name",""),"p":[[round(x,1),round(y,1)] for x,y in w]})
    elif "building" in p and g["type"] in ("Polygon","MultiPolygon"):
        ring=g["coordinates"][0] if g["type"]=="Polygon" else g["coordinates"][0][0]
        cx=sum(q[0] for q in ring)/len(ring); cy=sum(q[1] for q in ring)/len(ring)
        if LON0<=cx<=LON1 and LAT0<=cy<=LAT1:
            blds.append((wx(cx),wy(cy)))
            if p.get("addr:housenumber") and p.get("addr:street"):
                addressed.append({"x":wx(cx),"y":wy(cy),"lon":cx,"lat":cy,"hn":p["addr:housenumber"],"street":p["addr:street"]})
            if p.get("name"):
                named.append({"x":wx(cx),"y":wy(cy),"lon":cx,"lat":cy,"name":p["name"]})

# footprints from the pipeline replace OSM's building dots (OSM still supplies addresses and names for siting)
ALLFOOT=[]; FOOT=[]
if CFG.get("buildings"):
    ALLFOOT=json.load(open(CFG["buildings"],encoding="utf-8"))["features"]
    FOOT=[f for f in ALLFOOT if LON0<=f["properties"]["px"]<=LON1 and LAT0<=f["properties"]["py"]<=LAT1]
    blds=[(wx(f["properties"]["px"]),wy(f["properties"]["py"])) for f in FOOT]
    print(f"  {len(FOOT)} footprints in the frame ({len(ALLFOOT)} cut)")

# street mask + carve
street=np.zeros((GH,GW),bool)
for r in roads:
    wide = r["c"]=="major"; w=r["p"]
    for i in range(len(w)-1):
        (x1,y1),(x2,y2)=w[i],w[i+1]; L=math.hypot(x2-x1,y2-y1); n=max(int(L/(W/GW*0.5)),1)
        for k in range(n+1):
            gx=int((x1+(x2-x1)*k/n)/W*GW); gy=int((y1+(y2-y1)*k/n)/H*GH)
            if 0<=gx<GW and 0<=gy<GH:
                street[gy,gx]=True
                if wide:
                    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        if 0<=gx+dx<GW and 0<=gy+dy<GH: street[gy+dy,gx+dx]=True
CARVE_WIN=2*round(15/CELL_M)+1                                      # the same ~40 m as a 3×3 window of 15 m cells
elev=grids.fine_elev(ELEV_DM,EW,EH,GW,GH,street,STREET_CARVE_M,CARVE_WIN)    # streets carved as flow paths

# creek mask: water may always run along a creek, however built-up its banks are
creek=np.zeros((GH,GW),bool)
for wt in waters:
    w=wt["p"]
    for i in range(len(w)-1):
        (x1,y1),(x2,y2)=w[i],w[i+1]; L=math.hypot(x2-x1,y2-y1); n=max(int(L/(W/GW*0.5)),1)
        for k in range(n+1):
            gx=int((x1+(x2-x1)*k/n)/W*GW); gy=int((y1+(y2-y1)*k/n)/H*GH)
            if 0<=gx<GW and 0<=gy<GH: creek[gy,gx]=True

# buildings as obstacles (spec §6.2): built fraction → blocked cells; footprints counted per cell
BLOCK=SEA.copy(); BC=None
if CFG.get("buildings"):
    frac=grids.built_fraction([f["geometry"] for f in ALLFOOT],(LON0,LAT0,LON1,LAT1),GW,GH)
    BLOCK=grids.block_mask(frac,street,creek,SEA)
    BC=grids.counts([(min(int(x/W*GW),GW-1),min(int(y/H*GH),GH-1)) for x,y in blds],GW,GH)
    print(f"  blocked: {int((BLOCK&~SEA).sum())} built-up cells of {GW*GH}")

# ------------------------------------------------------------------ 3. NOAH
print("3/5 noah: rasterizing hazard polygons (even-odd scanline) ...")
def rasterize_noah(path):
    sf=shapefile.Reader(path); grid=np.zeros((GH,GW),np.uint8)
    cell_y=[cell_ll(0,gy)[1] for gy in range(GH)]; cell_x=np.array([cell_ll(gx,0)[0] for gx in range(GW)])
    for si in range(sf.numRecords):
        var=int(round(sf.record(si)[0])); shp=sf.shape(si)
        pts=shp.points; parts=list(shp.parts)+[len(pts)]; E=[]
        for pi in range(len(parts)-1):
            ring=pts[parts[pi]:parts[pi+1]]
            xs=[q[0] for q in ring]; ys=[q[1] for q in ring]
            if max(xs)<LON0 or min(xs)>LON1 or max(ys)<LAT0 or min(ys)>LAT1: continue
            E += [(ring[i][0],ring[i][1],ring[i+1][0],ring[i+1][1]) for i in range(len(ring)-1)]
        if not E: continue
        E=np.array(E); x1,y1,x2,y2=E[:,0],E[:,1],E[:,2],E[:,3]
        for gy,cy in enumerate(cell_y):
            m=(y1<=cy)!=(y2<=cy)
            if not m.any(): continue
            xc=np.sort(x1[m]+(cy-y1[m])*(x2[m]-x1[m])/(y2[m]-y1[m]))
            inside=np.searchsorted(xc,cell_x)%2==1
            grid[gy,inside]=np.maximum(grid[gy,inside],var)
    return grid
def noah_geojson(path):
    """A clipped NOAH GeoJSON → grid of hazard class (highest wins); None when the pipeline found no map."""
    if not os.path.exists(path): return None
    fs=sorted(json.load(open(path,encoding="utf-8"))["features"],key=lambda f:f["properties"]["Var"])
    return grids.rasterize(((f["geometry"],int(f["properties"]["Var"])) for f in fs),(LON0,LAT0,LON1,LAT1),GW,GH)
if INPUT_NOAH=="geojson":
    noah={rp:noah_geojson(f"{CFG['noah_dir']}/noah_{rp}.geojson") for rp in ("5","25","100")}
else:
    noah={k:rasterize_noah(v) for k,v in INPUT_NOAH.items()} if INPUT_NOAH else {}

# ------------------------------------------------------------------ 4. sensors
print("4/5 sensors: siting on buildings, referencing to street cells ...")
MDEG_X=111320*math.cos(math.radians((LAT0+LAT1)/2)); MDEG_Y=110640
MX=(LON1-LON0)*MDEG_X/W; MY=(LAT1-LAT0)*MDEG_Y/H          # metres per world unit
def dist_pt_seg(px,py,ax,ay,bx,by):
    dx,dy=bx-ax,by-ay; L2=dx*dx+dy*dy
    t=0 if L2==0 else max(0,min(1,((px-ax)*dx+(py-ay)*dy)/L2))
    return math.hypot((px-(ax+t*dx))*MX,(py-(ay+t*dy))*MY)
def dist_to_street(px,py,name):
    return min((dist_pt_seg(px,py,*r["p"][i],*r["p"][i+1]) for r in roads if r.get("n")==name for i in range(len(r["p"])-1)),default=1e9)
def nearest_other_street(px,py,own):
    best=(1e9,None)
    for r in roads:
        n=r.get("n")
        if not n or n==own: continue
        for i in range(len(r["p"])-1):
            dd=dist_pt_seg(px,py,*r["p"][i],*r["p"][i+1])
            if dd<best[0]: best=(dd,n)
    return best
def shortSt(n): return n.replace(" Street"," St").replace(" Avenue"," Ave").replace(" Road"," Rd")
def nearest_cell(mask,gx,gy,R=10):
    for r in range(R+1):
        for dy in range(-r,r+1):
            for dx in range(-r,r+1):
                if max(abs(dx),abs(dy))!=r: continue
                x,y=gx+dx,gy+dy
                if 0<=x<GW and 0<=y<GH and mask[y,x]: return x,y
    return None
def auto_units():
    """Campus units (spec §6.3): score every footprint near a street, unit 01 on campus, the rest ≥ 300 m apart."""
    from shapely.geometry import shape, Point
    cell_m=(LON1-LON0)*MDEG_X/GW
    score=placement.score(elev,noah,grids.dist_m(creek,cell_m),cell_m,valid=~SEA)
    geom=shape(json.load(open(CFG["outline"],encoding="utf-8"))["features"][0]["geometry"])
    has_outline=geom.geom_type in ("Polygon","MultiPolygon"); c=CFG.get("campus")   # pilots (sjq) have an outline, no campus
    def on_campus(lon,lat):
        if has_outline: return geom.contains(Point(lon,lat))
        return math.hypot((lon-c["lon"])*MDEG_X,(lat-c["lat"])*MDEG_Y)<=150
    pts=[]
    for f in FOOT:
        p=f["properties"]; x,y=wx(p["px"]),wy(p["py"])
        pts.append(dict(fid=p["fid"],px=p["px"],py=p["py"],x=x,y=y,cx=min(int(x/W*GW),GW-1),cy=min(int(y/H*GH),GH-1),
                        x_m=x*MX,y_m=y*MY,oc=on_campus(p["px"],p["py"])))
    cands=campus_model.candidates(pts,score,street,SEA,cell_m)
    bfeats=json.load(open(CFG["barangays"],encoding="utf-8"))["features"]
    bgrid=grids.label_polys([f["geometry"] for f in bfeats],(LON0,LAT0,LON1,LAT1),GW,GH)
    bnames=[f["properties"]["name"] for f in bfeats]
    def ok(cd):                                   # asked only of a house about to be chosen
        dn,st=nearest_other_street(cd["x"],cd["y"],"")
        b=int(bgrid[cd["cy"],cd["cx"]]); cell=nearest_cell(street,cd["cx"],cd["cy"])
        if not st or dn>200 or b==0 or cell is None or SEA[cell[1],cell[0]]: return False
        cd["street"],cd["brgy"],cd["cell"]=st,bnames[b-1],cell
        return True
    # units fixed in advance at a coordinate (sjq: 71 Imelda Marcos St, from Gregor, 2026-09-29): on the nearest street
    # cell, named after the nearest street, labelled with the address given
    pins=[]
    for pu in CFG.get("pin_units",()):
        x,y=wx(pu["lon"]),wy(pu["lat"]);cx,cy=min(int(x/W*GW),GW-1),min(int(y/H*GH),GH-1)
        dn,st=nearest_other_street(x,y,"");cell=nearest_cell(street,cx,cy);b=int(bgrid[cy,cx])
        assert st and dn<60 and cell and b, f"pinned unit at {pu}: {dn:.0f} m from {st}, barangay {b}"
        pins.append(dict(fid=None,px=pu["lon"],py=pu["lat"],x=x,y=y,cx=cx,cy=cy,x_m=x*MX,y_m=y*MY,oc=on_campus(pu["lon"],pu["lat"]),
                         score=float(score[cy,cx]),street=st,brgy=bnames[b-1],cell=cell,hn=pu.get("hn",""),label=pu.get("label")))
    chosen,spacing=placement.pick(cands,ok=ok,all_inside=CFG.get("units_inside",False),pinned=pins)
    out=[]
    for k,cd in enumerate(chosen,1):
        cx,cy=cd["cell"]
        out.append({"id":f"BW-{SITE_ID.upper()}-{k:02d}","street":cd["street"],"hn":cd.get("hn",""),"near":None,
                    "x":round(float(cd["x"]),1),"y":round(float(cd["y"]),1),"cx":cx,"cy":cy,
                    "lon":round(cd["px"],5),"lat":round(cd["py"],5),"g":round(float(elev[cy,cx]),2),
                    "bld":f"{cd['label']} · {cd['brgy']}" if cd.get("label") else f"near {shortSt(cd['street'])} · {cd['brgy']}",
                    "short":cd["label"] if cd.get("label") else shortSt(cd["street"]),
                    "oc":bool(cd["oc"]),"brgy":cd["brgy"],"fid":cd["fid"]})
        print(f"  {out[-1]['id']} → {out[-1]['bld']}{' (on campus)' if cd['oc'] else ''} score {cd['score']:.2f}")
    print(f"  {len(cands)} candidate houses; spacing {spacing:.0f} m")
    return out,spacing,bgrid,bnames,has_outline

sensors=[]
for sid,st,lon,lat in ([] if SENSOR_TARGETS=="auto" else SENSOR_TARGETS):
    tx,ty=wx(lon),wy(lat)
    if sid in CFG.get("fixed",set()):
        b={"x":tx,"y":ty,"lon":lon,"lat":lat,"name":st}                # sited at the coordinate itself
    else:
        if CFG["site_by"]=="address":
            cands=[b for b in addressed if b["street"]==st]
            assert cands, f"no addressed building on {st}"
        else:
            cands=[b for b in named if b["name"]==st]
            assert cands, f"no building named {st}"
        b=min(cands,key=lambda b:(b["x"]-tx)**2+(b["y"]-ty)**2)
    x,y=b["x"],b["y"]
    if CFG["site_by"]=="address" and sid not in CFG.get("fixed",set()):
        dst=dist_to_street(x,y,st); assert dst<30, f"{sid}: {dst:.0f} m from {st}"
        street_name=st; bld=None
        dnear,near=nearest_other_street(x,y,st)
    else:
        dst=min((dist_pt_seg(x,y,*w["p"][i],*w["p"][i+1]) for w in waters for i in range(len(w["p"])-1)),default=1e9)
        assert dst<90, f"{sid}: {dst:.0f} m from any creek"
        dn_st,street_name=nearest_other_street(x,y,"")     # nearest named way is the unit's street
        assert street_name, f"{sid}: no named way nearby"
        bld=st; dnear,near=1e9,None
    lon,lat=b["lon"],b["lat"]
    gx=min(int(x/W*GW),GW-1); gy=min(int(y/H*GH),GH-1)
    own=np.zeros((GH,GW),bool)
    for r in roads:
        if r.get("n")!=street_name: continue
        w=r["p"]
        for i in range(len(w)-1):
            (x1,y1),(x2,y2)=w[i],w[i+1]; L=math.hypot(x2-x1,y2-y1); n=max(int(L/(W/GW*0.5)),1)
            for k in range(n+1):
                ox=int((x1+(x2-x1)*k/n)/W*GW); oy=int((y1+(y2-y1)*k/n)/H*GH)
                if 0<=ox<GW and 0<=oy<GH: own[oy,ox]=True
    best=None
    for R in range(0,10):
        for dy in range(-R,R+1):
            for dx in range(-R,R+1):
                if max(abs(dx),abs(dy))!=R: continue
                if 0<=gx+dx<GW and 0<=gy+dy<GH and own[gy+dy,gx+dx]: best=(gx+dx,gy+dy); break
            if best: break
        if best: break
    if best is None:                                            # own street too far in grid terms: any carved street cell
        for R in range(0,10):
            for dy in range(-R,R+1):
                for dx in range(-R,R+1):
                    if max(abs(dx),abs(dy))!=R: continue
                    if 0<=gx+dx<GW and 0<=gy+dy<GH and street[gy+dy,gx+dx]: best=(gx+dx,gy+dy); break
                if best: break
            if best: break
    assert best is not None, f"{sid}: no street cell within 10 cells"
    assert not hole[best[1],best[0]], f"{sid}: sensor cell is a DEM hole"
    rec={"id":sid,"street":street_name,"hn":b.get("hn",""),"near":near if dnear<150 else None,
         "x":round(float(x),1),"y":round(float(y),1),
         "cx":best[0],"cy":best[1],"lon":round(lon,5),"lat":round(lat,5),
         "g":round(float(elev[best[1],best[0]]),2)}
    if bld: rec["bld"]=CFG.get("unit_names",{}).get(sid,bld)     # name-sited units only; address-sited records stay unchanged
    if sid in CFG.get("short",{}): rec["short"]=CFG["short"][sid]
    if sid in CFG.get("label_pos",{}): rec["lp"]=CFG["label_pos"][sid]
    sensors.append(rec)
    print(f"  {sid} → {bld or b.get('hn','')} {street_name}  ({dst:.0f} m from {'creek' if bld else 'street'}; near {near}, {dnear:.0f} m)")

def reuse_units(prev):
    """Keep the units already placed (same houses, ids and names) and only re-reference each to the nearest street cell
    of this grid, so no unit moves when the grid changes (2026-09-29, 15 m → 7.5 m)."""
    from shapely.geometry import shape
    out=[]
    for u in prev["sensors"]:
        gx=min(int(u["x"]/W*GW),GW-1); gy=min(int(u["y"]/H*GH),GH-1)
        cell=nearest_cell(street&~SEA,gx,gy,R=40); assert cell, f"{u['id']}: no street cell near"
        v=dict(u); v["cx"],v["cy"]=int(cell[0]),int(cell[1]); v["g"]=round(float(elev[cell[1],cell[0]]),2); out.append(v)
    bfeats=json.load(open(CFG["barangays"],encoding="utf-8"))["features"]
    bgrid=grids.label_polys([f["geometry"] for f in bfeats],(LON0,LAT0,LON1,LAT1),GW,GH)
    geom=shape(json.load(open(CFG["outline"],encoding="utf-8"))["features"][0]["geometry"])
    pts=[(u["x"]*MX,u["y"]*MY) for u in out]
    spacing=min(math.hypot(a[0]-b[0],a[1]-b[1]) for i,a in enumerate(pts) for b in pts[i+1:])
    print(f"  kept {len(out)} placed units; spacing {spacing:.0f} m")
    return out,spacing,bgrid,[f["properties"]["name"] for f in bfeats],geom.geom_type in ("Polygon","MultiPolygon")
if SENSOR_TARGETS=="auto":
    # the units are placed once (and approved); later builds keep them, from data/<site>.json, unless PLACE_UNITS=1
    UNITS_FROM=os.environ.get("UNITS_FROM",f"data/{SITE_ID}.json")
    if not os.environ.get("PLACE_UNITS") and os.path.exists(UNITS_FROM):
        sensors,SPACING,BGRID,BNAMES,HAS_OUTLINE=reuse_units(json.load(open(UNITS_FROM,encoding="utf-8")))
    else:
        sensors,SPACING,BGRID,BNAMES,HAS_OUTLINE=auto_units()

# ------------------------------------------------------------------ 5. labels + encode
print("5/5 labels + encoding ...")
if LABEL_STREETS=="auto":                         # campuses: the longest named main roads
    lens={}
    for r in roads:
        if r.get("n") and r["c"] in ("major","mid"):
            lens[r["n"]]=lens.get(r["n"],0)+sum(math.hypot(r["p"][i+1][0]-r["p"][i][0],r["p"][i+1][1]-r["p"][i][1]) for i in range(len(r["p"])-1))
    LABEL_STREETS=[n for n,_ in sorted(lens.items(),key=lambda kv:(-kv[1],kv[0]))[:12]]
labels=[]
for nm in LABEL_STREETS:
    if nm not in name_ways: continue
    wb=max(name_ways[nm],key=lambda w:sum(math.hypot(w[i+1][0]-w[i][0],w[i+1][1]-w[i][1]) for i in range(len(w)-1)))
    mid=len(wb)//2; a=wb[max(mid-1,0)]; b=wb[min(mid+1,len(wb)-1)]
    ang=math.atan2(b[1]-a[1],b[0]-a[0])
    if ang>math.pi/2 or ang<-math.pi/2: ang+=math.pi
    labels.append({"n":nm.replace(" Street"," St").replace(" Avenue"," Ave").replace(" Road"," Rd"),
                   "x":round(wb[mid][0],1),"y":round(wb[mid][1],1),"a":round(ang,3)})
for wt in waters:
    if wt["n"] and wt["n"] not in [l["n"] for l in labels] and len(wt["p"])>3:
        p=wt["p"]; mid=len(p)//2; a,b=p[mid-1],p[min(mid+1,len(p)-1)]
        ang=math.atan2(b[1]-a[1],b[0]-a[0])
        if ang>math.pi/2 or ang<-math.pi/2: ang+=math.pi
        labels.append({"n":wt["n"],"x":p[mid][0],"y":p[mid][1],"a":round(ang,3),"w":1})

noah_ok={k:v for k,v in noah.items() if v is not None}
data={"W":W,"H":H,"GW":GW,"GH":GH,"bbox":[LON0,LAT0,LON1,LAT1],
      "elev":b64(ELEV_DM),"EW":EW,"EH":EH,"carve":STREET_CARVE_M,"carve_win":CARVE_WIN,
      "elev_min":float(elev.min()),"elev_max":float(elev.max()),
      "blds":"","nb":len(blds),
      "roads":roads,"waters":waters,"labels":labels,"sensors":sensors,
      "noah":{k:rle(v.reshape(EH,EF,EW,EF).max(axis=(1,3)) if EF>1 else v) for k,v in noah_ok.items()},"street":rle(street.astype(np.uint8))}
if EF>1: data["noah_ef"]=EF   # NOAH stored on the coarse grid (highest class of each EF×EF block); readers expand it
if CFG.get("sea"): data["sea"]=rle(SEA.astype(np.uint8))
if CFG.get("buildings"): data["block"]=rle(BLOCK.astype(np.uint8)); data["bc"]=rle(BC)
data["site"]={k:CFG[k] for k in ("id","name","place","profile","langs","units","emergency","attribution","tz","utc")}
if "g_ref" in CFG: data["site"]["g_ref"]=CFG["g_ref"]
data["site"]["scen"]={k:{"label":v[0],"P":v[1],"dur":v[2],"start":v[3]} for k,v in CFG["scen"].items()}
data["site"]["hazard"]=bool(noah_ok)
data["site"]["noah_missing"]=[rp for rp in ("5","25","100") if CFG["noah"] and rp not in noah_ok]
data["site"]["terrain"]=CFG.get("terrain","")
if "campus" in CFG:
    data["site"]["campus"]=CFG["campus"]
    data["card"]=campus_model.card(sensors,SPACING,BGRID,BNAMES,{rp:noah.get(rp) for rp in ("5","25","100")},SEA,HAS_OUTLINE)
# building dots last: thin them evenly if the file would pass its budget (the count and the model keep every footprint)
base=len(json.dumps(data,separators=(",",":"),ensure_ascii=False).encode())
nmax=max(int((BUDGET-base)/5.34),1)
step=1 if len(blds)<=nmax else math.ceil(len(blds)/nmax)
import gzip
while True:                                       # and thin further until it fits GZ_BUDGET on the wire (places come on top)
    data["blds"]=b64(np.array([[int(x*10),int(y*10)] for x,y in blds[::step]],dtype="<u2").reshape(-1,2))
    data["thin"]=step
    if step>=max(len(blds),1) or len(gzip.compress(json.dumps(data,separators=(",",":"),ensure_ascii=False).encode(),6))<=GZ_BUDGET: break
    step=max(step+1,int(step*1.15))
if step>1: print(f"  building dots thinned 1 in {step} to fit {BUDGET} bytes")
os.makedirs(os.path.dirname(OUTPUT) or ".",exist_ok=True)
json.dump(data,open(OUTPUT,"w",encoding="utf-8"),separators=(",",":"),ensure_ascii=False)
print(f"wrote {OUTPUT}: {os.path.getsize(OUTPUT)//1024} KB · {len(blds)} buildings · {len(roads)} road ways · "
      f"{len(waters)} creek segments · terrain {elev.min():.1f}–{elev.max():.1f} m")
for s in sensors: print(f"  {s['id']} {s['hn']:>5s} {s['street']:20s} street cell ({s['cx']},{s['cy']}) ground {s['g']:.1f} m")
