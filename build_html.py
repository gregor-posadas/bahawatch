#!/usr/bin/env python3
"""Inject the site data files into template.html → bahawatch_dashboard.html."""
import json, os
tpl=open("template.html",encoding="utf-8").read()
sites={"tv":"data.json","diliman":"data_diliman.json","berkeley":"data_berkeley.json"}
blob="{"+",".join(f'"{k}":{open(f,encoding="utf-8").read()}' for k,f in sites.items())+"}"
assert "__DATA_ALL__" in tpl, "template.html is missing the __DATA_ALL__ placeholder"
verdict=open("shared/verdict.js",encoding="utf-8").read().replace("export const ","const ").replace("export function ","function ")
places=open("places.json",encoding="utf-8").read()
api_base=os.environ.get("BAHAWATCH_API","")
sitekey=os.environ.get("TURNSTILE_SITEKEY","")
for ph in ("/*__VERDICT_JS__*/","__PLACES__","__API_BASE__","__TURNSTILE_SITEKEY__"):
    assert ph in tpl, f"template.html is missing {ph}"
out=(tpl.replace("__DATA_ALL__",blob).replace("/*__VERDICT_JS__*/",verdict).replace("__PLACES__",places)
        .replace("__API_BASE__",json.dumps(api_base)).replace("__TURNSTILE_SITEKEY__",json.dumps(sitekey)))
dest=os.environ.get("OUT","bahawatch_dashboard.html")
open(dest,"w",encoding="utf-8").write(out)
print(f"{dest} written ({os.path.getsize(dest)//1024} KB)")
