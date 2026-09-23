#!/usr/bin/env python3
"""Inject the site data files into template.html → bahawatch_dashboard.html."""
import json, os
tpl=open("template.html",encoding="utf-8").read()
sites={"tv":"data.json","diliman":"data_diliman.json","berkeley":"data_berkeley.json"}
blob="{"+",".join(f'"{k}":{open(f,encoding="utf-8").read()}' for k,f in sites.items())+"}"
assert "__DATA_ALL__" in tpl, "template.html is missing the __DATA_ALL__ placeholder"
out=tpl.replace("__DATA_ALL__",blob)
open("bahawatch_dashboard.html","w",encoding="utf-8").write(out)
print(f"bahawatch_dashboard.html written ({os.path.getsize('bahawatch_dashboard.html')//1024} KB)")
