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
    const pins=await pg.evaluate(()=>({map:getComputedStyle(document.getElementById('nat-map')).backgroundColor,
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
  // a campus page: bar and card text contrast in both themes
  await pg.goto(U+'#xu');await ready(pg,"xu");
  for(const theme of ["light","dark"]){
    await pg.evaluate(t=>setTheme(t,true),theme);await pg.waitForTimeout(100);
    const pairs=await pg.evaluate(`(${TEXT})('#public [data-cbar] *, #c-card *')`);
    const bad=pairs.map(p=>({...p,r:ratio(p.fg,p.bg)})).filter(p=>p.r<4.5);
    assert(pairs.length>10&&bad.length===0,`${theme}: campus bar and card contrast ≥ 4.5:1: `+bad.slice(0,4).map(p=>p.id+" "+p.r.toFixed(2)).join(", "));
  }
  // phone width: no sideways scroll; every control in the national view and the campus bar is ≥ 48 px tall
  const ph=await b.newPage({viewport:{width:390,height:844}});ph.on('pageerror',e=>errs.push(e.message));
  await ph.goto(U);await ready(ph,"ph");
  s=await ph.evaluate(()=>({sw:document.documentElement.scrollWidth,small:[...document.querySelectorAll('#nat a, #nat button, #nat input, #nat select')].filter(e=>e.offsetParent&&!e.closest('.site-tabs')&&e.getBoundingClientRect().height<48).map(e=>e.className||e.id)}));
  assert(s.sw<=390&&s.small.length===0,"390 px national view: no sideways scroll ("+s.sw+"), controls ≥ 48 px: "+s.small.slice(0,5));
  await ph.goto(U+'#xu');await ready(ph,"xu");
  s=await ph.evaluate(()=>({sw:document.documentElement.scrollWidth,small:[...document.querySelectorAll('#public [data-cbar] a, #public [data-cbar] button, #c-card summary')].filter(e=>e.getBoundingClientRect().height<48).map(e=>e.className||e.id)}));
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
  // Task 7 ruling: files are budgeted on the wire (≤ 250 KB gzipped, ≤ 750,000 raw), not the spec's 450,000 raw
  const big=fs.readdirSync(path.join(__dirname,'data')).filter(f=>f.endsWith('.json')).map(f=>{const b=fs.readFileSync(path.join(__dirname,'data',f));return [f,b.length,zlib.gzipSync(b).length];}).filter(([,n,g])=>n>750000||g>250*1024);
  assert(big.length===0,"every data file ≤ 250 KB gzipped and ≤ 750,000 bytes raw: "+big.map(x=>x.join(" ")).join(", "));
  // speed: a campus appears within 3 s on the browser's "Fast 3G" profile
  const slow=await b.newPage({viewport:{width:1280,height:900}});
  await slow.goto(U);await ready(slow,"ph");
  const cdp=await slow.context().newCDPSession(slow);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:562.5,downloadThroughput:1.6*1024*1024/8*0.9,uploadThroughput:750*1024/8*0.9});
  const t0=Date.now();await slow.click('#nat-list a[href="#uplb"]');await ready(slow,"uplb");const dt=Date.now()-t0;
  assert(dt<=3000,`UPLB appears in ${dt} ms on Fast 3G (≤ 3000)`);
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
