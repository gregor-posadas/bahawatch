#!/bin/bash
# Build checks (spec §7.1–7.2): pipeline and model unit tests; a made-up campus built twice (byte-identical) and
# checked, including that the checker catches a broken file; Teachers Village and UP Diliman rebuilt from the same
# inputs (identical to data/ apart from places); Berkeley unchanged; every data/*.json checked.
set -e
cd "$(dirname "$0")"
T=$(mktemp -d)
fail(){ echo "FAIL $1"; [ -n "$2" ] && tail -20 "$2"; exit 1; }

(cd pipeline && python3 -W ignore -m unittest discover -s tests -t .) > $T/u1.log 2>&1 || fail "pipeline unit tests" $T/u1.log
echo "ok   pipeline unit tests ($(grep -o 'Ran [0-9]* tests' $T/u1.log))"
python3 -W ignore -m unittest discover -s model/tests -t . > $T/u2.log 2>&1 || fail "model unit tests" $T/u2.log
echo "ok   model unit tests ($(grep -o 'Ran [0-9]* tests' $T/u2.log))"

# the made-up campus: same inputs → byte-identical file; the checker passes it and catches a broken copy
python3 model/tests/fixture_campus.py $T/fx > /dev/null
FX="CAMPUSES_CSV=$T/fx/campuses.csv CAMPUS_INPUTS=$T/fx/inputs"
for o in a b; do env $FX SITE=zz OUTPUT=$T/fx/$o/zz.json python3 -W ignore build_data.py > $T/fx_$o.log 2>&1 || fail "fixture campus build" $T/fx_$o.log; done
cmp -s $T/fx/a/zz.json $T/fx/b/zz.json || fail "same inputs gave different campus files"
echo "ok   same inputs give a byte-identical campus file"
env $FX BW_DATA_DIR=$T/fx/a BW_PLACES=$T/fx/places.json python3 -W ignore tools/build_places.py > /dev/null
env $FX BW_DATA_DIR=$T/fx/a python3 -W ignore tools/check_site_data.py zz > $T/chk.log || fail "fixture campus data checks" $T/chk.log
echo "ok   fixture campus passes the data checks"
mkdir -p $T/fx/bad
python3 - $T/fx/a/zz.json $T/fx/bad/zz.json <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
d["sensors"][3]["oc"] = True                                         # a second "on campus" unit
d["sensors"][5]["lon"], d["sensors"][5]["lat"] = d["sensors"][4]["lon"], d["sensors"][4]["lat"]   # two units on one spot
d["sensors"][6]["x"] = 5.0                                          # a unit at the box edge
json.dump(d, open(sys.argv[2], "w"))
PY
if env $FX BW_DATA_DIR=$T/fx/bad python3 -W ignore tools/check_site_data.py zz > $T/bad.log; then fail "the checker passed a broken file"; fi
grep -q "exactly one unit" $T/bad.log && grep -q "closer than" $T/bad.log && grep -q "from the box edge" $T/bad.log || fail "the checker missed a broken rule" $T/bad.log
echo "ok   the checker catches a broken file"

# real sites: rebuilding from the same inputs gives the same data (places are added afterwards by build_places.py)
for s in tv upd; do
  SITE=$s OUTPUT=$T/$s.json python3 -W ignore build_data.py > $T/$s.log 2>&1 || fail "$s build" $T/$s.log
  python3 - $s $T/$s.json <<'PY' || fail "$s rebuild"
import json, sys
a = json.load(open(f"data/{sys.argv[1]}.json")); b = json.load(open(sys.argv[2])); a.pop("places", None)
assert a == b, f"{sys.argv[1]}: rebuilding from the same inputs changed the data"
print(f"ok   {sys.argv[1]} rebuilds identically")
PY
done
python3 - <<'PY' || fail "pilot sites"
import json
tv = json.load(open("data/tv.json"))
assert [s["id"] for s in tv["sensors"]] == [f"BW-H0{i}" for i in range(1, 9)], "Teachers Village keeps its 8 hand-placed units"
assert "block" in tv and "bc" in tv and tv["site"]["terrain"].startswith("FABDEM") and "g_ref" not in tv["site"]
print("ok   Teachers Village: 8 hand-placed units on FABDEM, buildings as obstacles, median storm reference")
bk = json.load(open("data/berkeley.json"))
import base64, numpy as np
e = np.frombuffer(base64.b64decode(bk["elev"]), dtype="<i2") / 10.0
assert len(bk["sensors"]) == 9 and 45 < e.min() < 60 and 300 < e.max() < 330 and "block" not in bk and not bk["site"]["hazard"]
assert bk["site"]["terrain"].startswith("USGS")
print("ok   Berkeley unchanged: USGS 1 m terrain, 9 units, no obstacle grid, no hazard layer")
PY
python3 -W ignore tools/check_site_data.py > $T/all.log || { cat $T/all.log; fail "site data checks"; }
cat $T/all.log
grep -q 'f"data/{SITE_ID}.json"' build_data.py || fail "default output is not data/<site>.json"
echo "ok   default output is data/<site>.json"
