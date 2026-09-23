#!/usr/bin/env python3
"""
BahaWatch dashboard — data preprocessing.

Turns raw open geodata for Teachers Village, Quezon City into the compact
JSON blob (data.json) that the dashboard embeds.  Run once; re-run only when
inputs, the frame, or the sensor sites change.

Inputs (see README.md for how to obtain each):
  INPUT_OSM   OpenStreetMap Overpass export (GeoJSON): highways, buildings, waterways
  INPUT_DEM   Copernicus GLO-30 GeoTIFF from OpenTopography (EPSG:4326)
  INPUT_NOAH  Project NOAH Metro Manila flood hazard shapefiles (5/25/100-yr)

Output:
  data.json   frame + terrain grid + streets + creeks + buildings + NOAH rasters + sensors

Dependencies:  numpy scipy rasterio pyshp
"""
import json, base64, math, os, sys
import numpy as np
import rasterio, shapefile
from scipy.ndimage import minimum_filter, gaussian_filter

# ------------------------------------------------------------------ site config
from sites import SITES
SITE_ID = os.environ.get("SITE", "tv")
CFG = SITES[SITE_ID]
INPUT_OSM, INPUT_DEM, INPUT_NOAH = CFG["osm"], CFG["dem"], CFG["noah"]
OUTPUT = os.environ.get("OUTPUT", "data.json" if SITE_ID=="tv" else f"data_{SITE_ID}.json")   # build_html.py embeds these names
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
elev=np.zeros((GH,GW))
for gy in range(GH):
    for gx in range(GW):
        elev[gy,gx]=dem_at(*cell_ll(gx,gy))
hole=np.isnan(elev)
if hole.any():
    from scipy.ndimage import distance_transform_edt
    idx=distance_transform_edt(hole,return_distances=False,return_indices=True)
    elev=elev[tuple(idx)]
    print(f"  filled {int(hole.sum())} nodata cells from nearest neighbours")
if DSM_MIN_FILTER: elev=minimum_filter(elev,size=DSM_MIN_FILTER)
elev=gaussian_filter(elev,sigma=DSM_SMOOTH_SIGMA)

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
mn=minimum_filter(elev,size=3)
elev[street]=mn[street]-STREET_CARVE_M

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
sensors=[]
for sid,st,lon,lat in SENSOR_TARGETS:
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

# ------------------------------------------------------------------ 5. labels + encode
print("5/5 labels + encoding ...")
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

data={"W":W,"H":H,"GW":GW,"GH":GH,"bbox":[LON0,LAT0,LON1,LAT1],
      "elev":b64(np.clip(np.round(elev*10),0,32000).astype("<i2")),
      "elev_min":float(elev.min()),"elev_max":float(elev.max()),
      "blds":b64(np.array([[int(x*10),int(y*10)] for x,y in blds],dtype="<u2")),"nb":len(blds),
      "roads":roads,"waters":waters,"labels":labels,"sensors":sensors,
      "noah":{k:rle(v) for k,v in noah.items()},"street":rle(street.astype(np.uint8))}
data["site"]={k:CFG[k] for k in ("id","name","place","profile","langs","units","emergency","attribution","tz","utc")}
if "g_ref" in CFG: data["site"]["g_ref"]=CFG["g_ref"]
data["site"]["scen"]={k:{"label":v[0],"P":v[1],"dur":v[2],"start":v[3]} for k,v in CFG["scen"].items()}
data["site"]["hazard"]=CFG["noah"] is not None
json.dump(data,open(OUTPUT,"w"),separators=(",",":"),ensure_ascii=False)
print(f"wrote {OUTPUT}: {os.path.getsize(OUTPUT)//1024} KB · {len(blds)} buildings · {len(roads)} road ways · "
      f"{len(waters)} creek segments · terrain {elev.min():.1f}–{elev.max():.1f} m")
for s in sensors: print(f"  {s['id']} {s['hn']:>5s} {s['street']:20s} street cell ({s['cx']},{s['cy']}) ground {s['g']:.1f} m")
