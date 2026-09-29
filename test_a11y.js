// Accessibility, speed and size for the national view and campus pages (spec §7.4, §7.5).
// Run: ./test_pages.sh test_a11y.js
const {chromium}=require('playwright');
const fs=require('fs'),zlib=require('zlib'),path=require('path');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
const lum=c=>{const m=c.match(/[\d.]+/g).map(Number);const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(m[0])+0.7152*f(m[1])+0.0722*f(m[2]);};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
// Machado, Oliveira & Fernandes (2009) simulation matrices, severity 1.0, applied in linear RGB
const CVD={protan:[[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]],
  deutan:[[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]],
  tritan:[[1.255528,-0.076749,-0.178779],[-0.078411,0.930809,0.147602],[0.004733,0.691367,0.303900]]};
const toLin=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);},toS=v=>{v=Math.min(1,Math.max(0,v));return 255*(v<=0.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-0.055);};
const sim=(c,m)=>{const l=c.match(/[\d.]+/g).slice(0,3).map(Number).map(toLin);return m.map(r=>toS(r[0]*l[0]+r[1]*l[1]+r[2]*l[2]));};
const TEXT=`(sel)=>{const bg=e=>{for(let x=e;x;x=x.parentElement){const c=getComputedStyle(x).backgroundColor;if(!/rgba\\(0, 0, 0, 0\\)|transparent/.test(c))return c;}return getComputedStyle(document.body).backgroundColor;};
  return [...document.querySelectorAll(sel)].filter(e=>e.offsetParent&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!e.closest('.sr-only'))
    .map(e=>({id:e.id||e.className||e.tagName,fg:getComputedStyle(e).color,bg:bg(e)}));}`;
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await ready(pg,"ph");
  await pg.click('#nat-theme');await pg.click('#nat-theme');
  assert(errs.length===0&&await pg.evaluate(()=>document.documentElement.dataset.theme==="light"),"the theme button works on the national map before any site is opened");
  // wide screens: the national tab is one screen; only the campus list scrolls (spec §4.1)
  const one=await pg.evaluate(()=>{const l=document.querySelector('#nat .nat-listcol'),cs=getComputedStyle(l);return {page:document.scrollingElement.scrollHeight,vh:innerHeight,list:l.scrollHeight>l.clientHeight,ov:cs.overflowY};});
  assert(one.page<=one.vh+1&&one.list&&one.ov==="auto","1280 px national tab: the page doesn't scroll, the campus list does: "+JSON.stringify(one));
  // spec §7: pin labels are labels, not credits: 14 px
  const pinPx=await pg.evaluate(()=>[...document.querySelectorAll('#nat-pins .pin-t')].map(e=>parseFloat(getComputedStyle(e).fontSize)));
  assert(pinPx.length>0&&pinPx.every(v=>v>=14),"national map: pin labels are 14 px, not 12: "+pinPx.join());
  // keyboard: the search box, the list and the pins are reachable with Tab, and focus is visible
  await pg.focus('#nat-q');await pg.keyboard.press('Tab');
  let s=await pg.evaluate(()=>({cls:document.activeElement.className,ol:getComputedStyle(document.activeElement).outlineStyle}));
  assert(s.cls==="nat-item"&&s.ol!=="none","Tab from the search box reaches the campus list, with a visible focus ring");
  s=await pg.evaluate(()=>[...document.querySelectorAll('#nat-pins a, #nat-pins button')].every(e=>e.tabIndex===0));
  assert(s,"every pin and cluster is in the Tab order");
  await pg.focus('#nat-pins .pin');
  assert(await pg.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle!=="none"),"a focused pin shows its focus ring");
  // search results are announced once per pause, not per keystroke
  await pg.evaluate(()=>{window.__ann=0;new MutationObserver(()=>window.__ann++).observe(document.getElementById('nat-count'),{childList:true,characterData:true,subtree:true});});
  await pg.type('#nat-q','cebu',{delay:40});await pg.waitForTimeout(700);
  s=await pg.evaluate(()=>({n:window.__ann,t:document.getElementById('nat-count').textContent}));
  assert(s.n===1&&s.t==="5 campuses match.","typing 'cebu' is announced once: "+JSON.stringify(s));
  await pg.fill('#nat-q','');
  // contrast in both themes: national view text ≥ 4.5:1, pins ≥ 3:1 against the map; pins stay apart for colour-blind viewers
  for(const theme of ["light","dark"]){
    await pg.evaluate(t=>setTheme(t,true),theme);await pg.waitForTimeout(100);
    const pairs=await pg.evaluate(`(${TEXT})('#nat *')`);
    const bad=pairs.map(p=>({...p,r:ratio(p.fg,p.bg)})).filter(p=>p.r<4.5);
    assert(pairs.length>40&&bad.length===0,`${theme}: national view text contrast ≥ 4.5:1 (${pairs.length} elements): `+bad.slice(0,4).map(p=>p.id+" "+p.r.toFixed(2)).join(", "));
    const pins=await pg.evaluate(()=>({map:getComputedStyle(document.getElementById('nat-land')).fill,
      c:["suc","luc","private"].map(t=>{const e=document.querySelector('#nat-legend .pin-'+t);return getComputedStyle(e).backgroundColor;})}));
    const low=pins.c.map(c=>ratio(c,pins.map));
    assert(low.every(r=>r>=3),`${theme}: pin colours ≥ 3:1 against the map: ${low.map(r=>r.toFixed(1))}`);
    for(const [k,m] of Object.entries(CVD)){
      const q=pins.c.map(c=>sim(c,m));let min=1e9;
      for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)min=Math.min(min,Math.hypot(...q[i].map((v,x)=>v-q[j][x])));
      assert(min>=60,`${theme}: pin colours stay distinct under ${k} simulation (closest pair ${min.toFixed(0)})`);
    }
  }
  await pg.evaluate(()=>setTheme("light",true));
  // a campus page: bar text contrast in both themes
  await pg.goto(U+'#xu');await ready(pg,"xu");
  for(const theme of ["light","dark"]){
    await pg.evaluate(t=>setTheme(t,true),theme);await pg.waitForTimeout(100);
    const pairs=await pg.evaluate(`(${TEXT})('#public [data-cbar] *')`);
    const bad=pairs.map(p=>({...p,r:ratio(p.fg,p.bg)})).filter(p=>p.r<4.5);
    assert(pairs.length>=3&&bad.length===0,`${theme}: campus bar contrast ≥ 4.5:1: `+bad.slice(0,4).map(p=>p.id+" "+p.r.toFixed(2)).join(", "));
  }
  // phone width: no sideways scroll; every control in the national view and the campus bar is ≥ 48 px tall
  const ph=await b.newPage({viewport:{width:390,height:844}});ph.on('pageerror',e=>errs.push(e.message));
  await ph.goto(U);await ready(ph,"ph");
  s=await ph.evaluate(()=>({sw:document.documentElement.scrollWidth,small:[...document.querySelectorAll('#nat a, #nat button, #nat input, #nat select')].filter(e=>e.offsetParent&&!e.closest('.site-tabs')&&e.getBoundingClientRect().height<48).map(e=>e.className||e.id)}));
  assert(s.sw<=390&&s.small.length===0,"390 px national view: no sideways scroll ("+s.sw+"), controls ≥ 48 px: "+s.small.slice(0,5));
  await ph.goto(U+'#xu');await ready(ph,"xu");
  s=await ph.evaluate(()=>({sw:document.documentElement.scrollWidth,small:[...document.querySelectorAll('#public [data-cbar] a, #public [data-cbar] button')].filter(e=>e.getBoundingClientRect().height<48).map(e=>e.className||e.id)}));
  assert(s.sw<=390&&s.small.length===0,"390 px campus page: no sideways scroll ("+s.sw+"), bar and card controls ≥ 48 px: "+s.small);
  for(const id of ["xu","ust","upd"]){   // the details view too: long automatic unit names must wrap, not widen the page
    await ph.goto(U+'#'+id+'/details');await ready(ph,id);
    const sw=await ph.evaluate(()=>document.documentElement.scrollWidth);
    assert(sw<=390,`390 px ${id} details view: no sideways scroll (${sw})`);
  }
  // new strings exist in six languages (non-English marked for native review)
  s=await pg.evaluate(()=>{const miss=[];for(const k of ["en","fil","ceb","ilo","hil","pam"]){for(const n of Object.keys(NAT_LANGS.en))if(NAT_LANGS[k]==null||NAT_LANGS[k][n]==null)miss.push(k+"."+n);if(k!=="en"&&!NAT_LANGS[k]._review)miss.push(k+"._review");}return miss;});
  assert(s.length===0,"national and campus strings in six languages, non-English marked for review: "+s.join(","));
  s=await pg.evaluate(()=>{const SAME_OK=new Set(["groups.Luzon","groups.Visayas","groups.Mindanao","credit","brgy1"]),same=[];
    const walk=(en,xx,path)=>{for(const k of Object.keys(en)){const p=path?path+"."+k:k;
      if(en[k]&&typeof en[k]==="object")walk(en[k],xx[k],p);else if(xx[k]===en[k]&&!SAME_OK.has(p))same.push(p);}};
    for(const k of ["fil","ceb","ilo","hil","pam"])walk(NAT_LANGS.en,NAT_LANGS[k],"");return same;});
  assert(s.length===0,"every national and campus string is translated, not an English copy: "+s.slice(0,8).join(", "));
  // size: the opening page is small; site files stay within budget
  const html=fs.readFileSync(path.join(__dirname,'bahawatch_dashboard.html'));
  const gz=zlib.gzipSync(html).length;
  assert(gz<=250*1024,`opening page ${Math.round(gz/1024)} KB gzipped (≤ 250 KB)`);
  // Task 7 ruling: files are budgeted on the wire (≤ 250 KB gzipped); raw ≤ 950,000 since the 7.5 m masks (2026-09-29)
  const big=fs.readdirSync(path.join(__dirname,'data')).filter(f=>f.endsWith('.json')).map(f=>{const b=fs.readFileSync(path.join(__dirname,'data',f));return [f,b.length,zlib.gzipSync(b).length];}).filter(([,n,g])=>n>950000||g>250*1024);
  assert(big.length===0,"every data file ≤ 250 KB gzipped and ≤ 950,000 bytes raw: "+big.map(x=>x.join(" ")).join(", "));
  // speed: a campus appears within 3 s on the browser's "Fast 3G" profile
  const slow=await b.newPage({viewport:{width:1280,height:900}});
  await slow.goto(U);await ready(slow,"ph");
  const cdp=await slow.context().newCDPSession(slow);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:562.5,downloadThroughput:1.6*1024*1024/8*0.9,uploadThroughput:750*1024/8*0.9});
  await slow.click('#nat-list a[href="#uplb"]');     // at 1280 px a list row flies the map to the campus; "Open UPLB" opens it
  const t0=Date.now();await slow.click('#nat-open');await ready(slow,"uplb");const dt=Date.now()-t0;
  assert(dt<=3000,`UPLB appears in ${dt} ms on Fast 3G (≤ 3000)`);
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  // visual pass (spec §7): nothing below 12 px, three weights, sentence case, no emoji icons
  const TYPE=`()=>{const small=[],weights=new Set(),upper=[];
    for(const e of document.querySelectorAll('body *')){if(!(e instanceof HTMLElement)||!e.getClientRects().length||e.closest('.sr-only,svg,canvas'))continue;
      if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
      const cs=getComputedStyle(e);if(cs.visibility==="hidden")continue;
      if(parseFloat(cs.fontSize)<12)small.push((e.id||e.className||e.tagName)+" "+cs.fontSize);
      weights.add(cs.fontWeight);if(cs.textTransform==="uppercase")upper.push(e.id||e.className||e.tagName);}
    const emoji=[...document.querySelectorAll('body *:not(script):not(style)')].some(e=>[...e.childNodes].some(n=>n.nodeType===3&&/⚠|️/.test(n.textContent)));
    return {small:small.slice(0,6),weights:[...weights].sort(),upper:upper.slice(0,6),emoji};}`;
  for(const [w,h] of [[1280,900],[375,812]])for(const r of ["","#uplb","#uplb/details","#tv","#try"]){
    const v=await b.newPage({viewport:{width:w,height:h}});
    await v.addInitScript(()=>{try{localStorage.setItem("bw-asked:uplb","1");localStorage.setItem("bw-asked:tv","1");}catch(e){}});
    await v.goto(U+r);await v.waitForFunction(()=>document.body.dataset.ready&&document.body.dataset.ready!=="");await v.waitForTimeout(500);
    const t=await v.evaluate(`(${TYPE})()`);
    assert(t.small.length===0,`${w}px ${r||"#ph"}: no text below 12 px: ${t.small}`);
    assert(t.weights.every(x=>["400","600","700"].includes(x)),`${w}px ${r||"#ph"}: only weights 400/600/700: ${t.weights}`);
    assert(t.upper.length===0&&!t.emoji,`${w}px ${r||"#ph"}: sentence case, no emoji icons: ${t.upper} ${t.emoji}`);
    await v.close();
  }
  // spec §7: 12 px is for credits, timestamps and helper lines only — interactive labels and the map legend are 14 px
  const twelve=await b.newPage({viewport:{width:1280,height:900}});
  await twelve.addInitScript(()=>{try{localStorage.setItem("bw-asked:uplb","1");}catch(e){}});
  await twelve.goto(U+'#uplb');await ready(twelve,"uplb");
  s=await twelve.evaluate(()=>{
    const px=sel=>{const e=document.querySelector(sel);return e?parseFloat(getComputedStyle(e).fontSize):null;};
    return {link:px('.p-sec-h .p-link'),legend:px('.p-maplegend'),demo:px('.p-ans-demo'),place:px('.p-head .p-place')};
  });
  assert(Object.values(s).every(v=>v===null||v>=14),"public view: interactive labels and the map legend are 14 px, not 12: "+JSON.stringify(s));
  await twelve.goto(U+'#uplb/details');await ready(twelve,"uplb");
  s=await twelve.evaluate(()=>{
    const px=sel=>{const e=document.querySelector(sel);return e?parseFloat(getComputedStyle(e).fontSize):null;};
    return {zoomUnit:px('.zoom-unit'),noah:px('.noah-chips button'),hint:px('#legend .hint'),clock:px('.t-clock l')};
  });
  assert(s.zoomUnit>=14&&s.noah>=14,"details view: zoom-to-unit and NOAH chips are 14 px, not 12: "+JSON.stringify(s));
  assert(s.hint===12&&s.clock===12,"credits/timestamps/helper text stays 12 px: "+JSON.stringify(s));
  await twelve.close();
  // wide screens: the campus page uses the width (spec §6.2)
  const wide=await b.newPage({viewport:{width:1920,height:1080}});
  await wide.addInitScript(()=>{try{localStorage.setItem("bw-asked:uplb","1");}catch(e){}});
  await wide.goto(U+'#uplb');await ready(wide,"uplb");
  s=await wide.evaluate(()=>document.querySelector('#public .p-inner').getBoundingClientRect().width);
  assert(s>=1500,"at 1920 px the campus page uses the width (content "+Math.round(s)+" px, was 1120)");
  // the map shares that width with the list (spec §6.2's 5:6 columns) — it must not be capped back down to a fixed preview size
  s=await wide.evaluate(()=>{const pi=document.querySelector('#public .p-inner').getBoundingClientRect().width,mw=document.getElementById('map-wrap').getBoundingClientRect().width;return {pi,mw};});
  assert(s.mw>=s.pi*0.5,`at 1920 px the simple view's map is at least half the page width (map ${Math.round(s.mw)} px of ${Math.round(s.pi)} px)`);
  await wide.close();
  // narrow single-column layout: the map fills its column instead of sitting at a leftover fixed width
  const narrow=await b.newPage({viewport:{width:768,height:1024}});
  await narrow.addInitScript(()=>{try{localStorage.setItem("bw-asked:uplb","1");}catch(e){}});
  await narrow.goto(U+'#uplb');await ready(narrow,"uplb");
  s=await narrow.evaluate(()=>{const col=document.getElementById('public-map').getBoundingClientRect().width,mw=document.getElementById('map-wrap').getBoundingClientRect().width;return {col,mw};});
  assert(s.mw>=s.col-2,`at 768 px (single column) the map fills its column (map ${Math.round(s.mw)} px of ${Math.round(s.col)} px)`);
  await narrow.close();
  // the national map's theme button is visible: a boundary ≥ 3:1, the glyph ≥ 4.5:1, 48 px
  const tb=await b.newPage({viewport:{width:1280,height:900}});await tb.goto(U);await ready(tb,"ph");
  for(const theme of ["light","dark"]){await tb.evaluate(t=>setTheme(t,true),theme);
    s=await tb.evaluate(()=>{const e=document.getElementById('nat-theme'),cs=getComputedStyle(e),r=e.getBoundingClientRect();
      return {fg:cs.color,bd:cs.borderTopColor,bw:parseFloat(cs.borderTopWidth),page:getComputedStyle(document.body).backgroundColor,fs:parseFloat(cs.fontSize),w:r.width,h:r.height};});
    assert(s.bw>=1&&ratio(s.bd,s.page)>=3&&ratio(s.fg,s.page)>=4.5&&s.fs>=16&&s.w>=48&&s.h>=48,`${theme}: the national theme button is visible: `+JSON.stringify(s));}
  await tb.evaluate(()=>setTheme("light",true));await tb.close();
  // the sea on campus maps: its own colour and a legend entry where the box has sea — checked as rendered, not just the hidden attribute
  // (fix round 1: .p-maplegend span / #legend .row set display, which used to beat [hidden] and show Sea on every campus regardless of the attribute)
  const sp=await b.newPage({viewport:{width:1280,height:900}});
  await sp.addInitScript(()=>{try{localStorage.setItem("bw-asked:ctu","1");localStorage.setItem("bw-asked:upd","1");}catch(e){}});
  await sp.goto(U+'#ctu');await ready(sp,"ctu");
  s=await sp.evaluate(()=>({pal:mapPal().sea.join(),lg:document.getElementById('p-lg-sea').getClientRects().length>0,t:document.getElementById('p-lg6').textContent,has:HAS_SEA}));
  assert(s.has&&s.lg&&s.t==="Sea"&&s.pal==="214,221,222","CTU has sea: the map legend renders Sea, drawn in #d6ddde: "+JSON.stringify(s));
  await sp.goto(U+'#ctu/details');await ready(sp,"ctu");
  s=await sp.evaluate(()=>({lg:document.getElementById('lg-sea').getClientRects().length>0,t:document.getElementById('lg-sea-t').textContent}));
  assert(s.lg&&s.t==="Sea","CTU details: the map legend renders Sea: "+JSON.stringify(s));
  await sp.goto(U+'#upd');await ready(sp,"upd");
  s=await sp.evaluate(()=>({has:HAS_SEA,lg:document.getElementById('p-lg-sea').getClientRects().length>0}));
  assert(!s.has&&!s.lg,"UP Diliman has no sea: no Sea legend entry rendered: "+JSON.stringify(s));
  await sp.goto(U+'#upd/details');await ready(sp,"upd");
  assert(!(await sp.evaluate(()=>document.getElementById('lg-sea').getClientRects().length>0)),"UP Diliman details: no Sea legend entry rendered");
  await sp.close();
  await b.close();
})();
