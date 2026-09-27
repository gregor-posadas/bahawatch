#!/usr/bin/env python3
"""Render a Markdown design doc to a styled PDF (BahaWatch house style) via headless Chromium.
Usage: python3 tools/md_to_pdf.py <in.md> <out.pdf> [--svg <file.html-with-svg> --after "<heading text>"]"""
import sys, re, subprocess, json, os, markdown, tempfile
args=sys.argv[1:]; src, out = args[0], args[1]
svg_src = args[args.index("--svg")+1] if "--svg" in args else None
after   = args[args.index("--after")+1] if "--after" in args else None
md=open(src,encoding="utf-8").read()
def _lists_for_python_markdown(md):
    """Python-Markdown needs 4-space nesting and a blank line before a list; specs use CommonMark's 2-space style."""
    LIST=re.compile(r"^( *)([-*+]|\d+\.)\s")
    lines=md.split("\n")
    two=any((m:=LIST.match(l)) and len(m.group(1))%4==2 for l in lines)   # a 2-space-nested document
    out=[]; fence=False; prev=""; in_list=False
    for line in lines:
        if line.lstrip().startswith("```"): fence=not fence
        m=None if fence else LIST.match(line)
        if m:
            n=len(m.group(1))
            if prev.strip() and n==0 and not in_list and not prev.lstrip().startswith("|"): out.append("")
            if two: line=" "*(n*2)+line[n:]
            in_list=True
        elif not fence and in_list and line.strip() and line.startswith(" "):
            n=len(line)-len(line.lstrip())
            if two: line=" "*(n*2)+line[n:]      # continuation line keeps pace with its item
        elif not line.strip() or not line.startswith(" "):
            if line.strip(): in_list=False
        out.append(line); prev=line
    return "\n".join(out)
md=_lists_for_python_markdown(md)
body=markdown.markdown(md, extensions=["tables","fenced_code","sane_lists"])
if svg_src and after:
    svg=re.search(r"<svg.*?</svg>", open(svg_src,encoding="utf-8").read(), re.S).group(0)
    # light-theme token values for print
    tok={"--bg":"#ffffff","--panel":"#f6f5f2","--ink":"#1d1c1a","--ink-2":"#5f5b55","--line":"#d9d5ce",
         "--ok":"#007a58","--warn":"#9a6300","--alert":"#c24e00","--stale":"#6b6660",
         "--ok-bg":"#e3f2ec","--warn-bg":"#fbf0dc","--alert-bg":"#fbe4d6","--stale-bg":"#efedea"}
    style=":root{"+";".join(f"{k}:{v}" for k,v in tok.items())+"}"
    fig=f'<figure class="flow"><style>{style}</style>{svg}<figcaption>Figure 1. The "Babaha ba?" rule. Shapes match the map markers so the answer reads without colour.</figcaption></figure>'
    h=re.search(r"(<h2>[^<]*"+re.escape(after)+r"[^<]*</h2>)", body)
    body=body.replace(h.group(1), h.group(1)+fig,1)
title=re.search(r"^# (.+)$", md, re.M).group(1)
css="""
@page{size:Letter; margin:18mm 17mm 20mm}
body{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; color:#1d1c1a; font-size:10.3pt; line-height:1.45}
h1{font-size:20pt; line-height:1.15; margin:0 0 4pt; padding-bottom:8pt; border-bottom:2.5pt solid #1d1c1a; letter-spacing:-.01em}
h2{font-size:12.5pt; margin:16pt 0 5pt; padding-top:6pt; border-top:.6pt solid #d9d5ce; break-after:avoid}
h3{font-size:11pt; margin:10pt 0 4pt; break-after:avoid}
p{margin:0 0 6pt} ul,ol{margin:0 0 6pt; padding-left:16pt} li{margin:1.5pt 0}
table{border-collapse:collapse; width:100%; margin:4pt 0 8pt; font-size:9.2pt; break-inside:avoid}
th,td{border-top:.6pt solid #d9d5ce; padding:3.5pt 5pt; text-align:left; vertical-align:top}
th{font-size:8pt; text-transform:uppercase; letter-spacing:.05em; color:#5f5b55; border-top:none}
code{font-family:"DejaVu Sans Mono",Menlo,monospace; font-size:8.6pt; background:#f3f1ed; padding:0 2pt; border-radius:2pt}
pre{background:#f6f5f2; border:.6pt solid #d9d5ce; padding:7pt 9pt; font-size:8.2pt; line-height:1.35; white-space:pre-wrap; overflow-wrap:anywhere; break-inside:auto}
pre code{background:none; padding:0}
strong{font-weight:700}
a{color:#0030a0; text-decoration:none}
figure.flow{margin:6pt 0 10pt; break-inside:avoid}
figure.flow svg{width:100%; height:auto; display:block}
figcaption{font-size:8.5pt; color:#5f5b55; margin-top:3pt}
"""
html=f"<!doctype html><html><head><meta charset='utf-8'><title>{title}</title><style>{css}</style></head><body>{body}</body></html>"
tmp=tempfile.NamedTemporaryFile("w",suffix=".html",delete=False,encoding="utf-8"); tmp.write(html); tmp.close()
js=f"""const {{chromium}}=require('playwright');(async()=>{{const b=await chromium.launch({{executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']}});
const pg=await b.newPage();await pg.goto('file://{tmp.name}');await pg.waitForTimeout(200);
await pg.pdf({{path:{json.dumps(os.path.abspath(out))},format:'Letter',printBackground:true,displayHeaderFooter:true,
headerTemplate:'<div></div>',footerTemplate:'<div style="font:8px Helvetica,Arial;color:#6b6660;width:100%;padding:0 17mm;display:flex;justify-content:space-between"><span>{title.replace("'","&#39;").replace('"',"&quot;")}</span><span><span class=pageNumber></span> / <span class=totalPages></span></span></div>',
margin:{{top:'18mm',bottom:'20mm',left:'17mm',right:'17mm'}}}});await b.close();}})();"""
subprocess.run(["node","-e",js],check=True,cwd="/home/claude/work")
print("wrote",out)
