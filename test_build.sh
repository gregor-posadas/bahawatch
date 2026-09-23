#!/bin/bash
set -e
# Teachers Village must build byte-identically from the site config.
set -e
cd "$(dirname "$0")"
SITE=tv OUTPUT=/tmp/data_tv_check.json python3 build_data.py > /tmp/build_tv.log
python3 - <<'PY'
import json
a=json.load(open("data.json")); b=json.load(open("/tmp/data_tv_check.json"))
assert b["site"]["id"]=="tv", "site key missing"
a.pop("site",None); b.pop("site",None)
assert a==b, "Teachers Village data changed"
print("ok   tv data identical, site key present")
PY
for s in diliman berkeley; do
  SITE=$s python3 build_data.py > /tmp/build_$s.log
  python3 - "$s" <<'PY'
import json,sys,base64,numpy as np
s=sys.argv[1]; d=json.load(open(f"data_{s}.json"))
assert d["site"]["id"]==s
assert len(d["sensors"])==(9 if s=="berkeley" else 8), len(d["sensors"])
e=np.frombuffer(base64.b64decode(d["elev"]),dtype="<i2")/10.0
assert e.size==d["GW"]*d["GH"]
assert (e>0).all(), "nodata leaked into the terrain grid"
if s=="berkeley":
    assert 45<e.min()<60 and 300<e.max()<330, (e.min(),e.max())
    assert not d["site"]["hazard"] and d["noah"]=={}
    assert d["site"]["profile"]=="path" and d["site"]["units"]=="imperial"
    assert any(w["n"]=="Strawberry Creek" for w in d["waters"]), "Strawberry Creek missing"
else:
    assert d["site"]["hazard"] and set(d["noah"])=={"5","25","100"}
for u in d["sensors"]:
    assert u["g"]>0 and 0<=u["cx"]<d["GW"] and 0<=u["cy"]<d["GH"]
    if d["site"]["profile"]=="path" or s=="diliman": assert u.get("bld"), u["id"]+" has no building name"
print(f"ok   {s} data builds: {len(d['sensors'])} units, terrain {e.min():.1f}-{e.max():.1f} m, {len(d['roads'])} ways")
PY
done

# default output: with no SITE the build must write data.json (what build_html.py embeds), not data_tv.json
grep -q '"data.json" if SITE_ID=="tv"' build_data.py || { echo "FAIL default OUTPUT for the tv build is not data.json"; exit 1; }
echo "ok   default output for the Teachers Village build is data.json"
