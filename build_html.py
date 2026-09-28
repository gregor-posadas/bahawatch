#!/usr/bin/env python3
"""Build bahawatch_dashboard.html from template.html. Site data is not embedded: the page fetches data/<site>.json
when a site is opened. Embedded: the PhilDev campus list (pipeline/campuses.csv), the country outline (data/ph_outline.json), the shared rule
and the shared flood fill."""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "pipeline"))
from common import read_campuses  # noqa: E402

tpl = open("template.html", encoding="utf-8").read()
KEYS = ("id", "short", "name", "campus", "group", "type", "city", "province", "lat", "lon")
campuses = [{k: r[k] for k in KEYS} for r in read_campuses() if r["lat"] is not None]   # only campuses with a centre
strip = lambda f: open(f, encoding="utf-8").read().replace("export const ", "const ").replace("export function ", "function ").replace("export class ", "class ")
verdict, flood, basemap = strip("shared/verdict.js"), strip("shared/flood.js"), strip("shared/basemap.js")
api_base = os.environ.get("BAHAWATCH_API", "")
sitekey = os.environ.get("TURNSTILE_SITEKEY", "")
outline = open("data/ph_outline.json", encoding="utf-8").read()
nat_i18n = json.dumps(json.load(open("i18n/nat.json", encoding="utf-8")), ensure_ascii=False, separators=(",", ":"))
for ph in ("__CAMPUSES__", "__PH_OUTLINE__", "__NAT_I18N__", "/*__VERDICT_JS__*/", "/*__FLOOD_JS__*/", "/*__BASEMAP_JS__*/", "__API_BASE__", "__TURNSTILE_SITEKEY__"):
    assert ph in tpl, f"template.html is missing {ph}"
out = (tpl.replace("__CAMPUSES__", json.dumps(campuses, ensure_ascii=False, separators=(",", ":"))).replace("__PH_OUTLINE__", outline).replace("__NAT_I18N__", nat_i18n)
          .replace("/*__VERDICT_JS__*/", verdict).replace("/*__FLOOD_JS__*/", flood).replace("/*__BASEMAP_JS__*/", basemap)
          .replace("__API_BASE__", json.dumps(api_base)).replace("__TURNSTILE_SITEKEY__", json.dumps(sitekey)))
dest = os.environ.get("OUT", "bahawatch_dashboard.html")
open(dest, "w", encoding="utf-8").write(out)
print(f"{dest} written ({os.path.getsize(dest) // 1024} KB, {len(campuses)} campuses)")
