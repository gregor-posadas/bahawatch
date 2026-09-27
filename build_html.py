#!/usr/bin/env python3
"""Build bahawatch_dashboard.html from template.html. Site data is not embedded: the page fetches data/<site>.json
when a site is opened. Embedded: the PhilDev campus list (pipeline/campuses.csv) and the shared rule."""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "pipeline"))
from common import read_campuses  # noqa: E402

tpl = open("template.html", encoding="utf-8").read()
KEYS = ("id", "short", "name", "campus", "group", "type", "city", "province", "lat", "lon")
campuses = [{k: r[k] for k in KEYS} for r in read_campuses() if r["lat"] is not None]   # only campuses with a centre
strip = lambda f: open(f, encoding="utf-8").read().replace("export const ", "const ").replace("export function ", "function ")
verdict = strip("shared/verdict.js")
api_base = os.environ.get("BAHAWATCH_API", "")
sitekey = os.environ.get("TURNSTILE_SITEKEY", "")
for ph in ("__CAMPUSES__", "/*__VERDICT_JS__*/", "__API_BASE__", "__TURNSTILE_SITEKEY__"):
    assert ph in tpl, f"template.html is missing {ph}"
out = (tpl.replace("__CAMPUSES__", json.dumps(campuses, ensure_ascii=False, separators=(",", ":")))
          .replace("/*__VERDICT_JS__*/", verdict)
          .replace("__API_BASE__", json.dumps(api_base)).replace("__TURNSTILE_SITEKEY__", json.dumps(sitekey)))
dest = os.environ.get("OUT", "bahawatch_dashboard.html")
open(dest, "w", encoding="utf-8").write(out)
print(f"{dest} written ({os.path.getsize(dest) // 1024} KB, {len(campuses)} campuses)")
