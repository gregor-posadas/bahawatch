// Flood history (#history, Gregor 2026-10-01): a photo essay of Philippine floods, living with water and the politics of
// flood control. Every photo is openly licensed and credited under it (author, licence link, Commons page), served from
// our own site; every figure links its source; the politics stay attributed and even-handed.
// Run: ./test_pages.sh test_history.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const errs=[];
  for(const w of [1280,375]){
    const ctx=await b.newContext({viewport:{width:w,height:900}});
    const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
    const outside=[];pg.on('request',r=>{const u=r.url();if(!u.startsWith(BASE)&&!u.startsWith('blob:')&&!u.startsWith('data:'))outside.push(u);});
    await pg.goto(U+'#history');await ready(pg,"history");
    let s=await pg.evaluate(()=>({route:ROUTE,shown:getComputedStyle(document.getElementById('history')).display,title:document.title,h1:document.getElementById('hi-h').textContent,
      tab:[...document.querySelectorAll('#history .site-tabs [role=tab]')].map(t=>t.dataset.site+(t.getAttribute('aria-selected')==="true"?"*":"")).join(),
      rail:[...document.querySelectorAll('#history .ab-rail a')].map(a=>a.textContent).join("|"),sw:document.documentElement.scrollWidth}));
    assert(s.route==="history"&&s.shown==="block"&&s.h1==="Flood history"&&/Flood history/.test(s.title),`${w}: #history opens the Flood history page: ${JSON.stringify(s)}`);
    assert(s.tab==="home,ph,tv,sjq,berkeley,try,history*,about,access",`${w}: a Flood history tab sits after Try reporting, selected: ${s.tab}`);
    assert(s.rail==="The floods|Living with water|The politics of flood control|Photo credits",`${w}: the contents rail lists the four sections: ${s.rail}`);
    assert(s.sw<=w,`${w}: no sideways scroll`);
    // every photo: alt text, fixed size (no layout jump), lazy, from our own site, credited with licence and Commons page
    s=await pg.evaluate(()=>[...document.querySelectorAll('#history .gl-fig')].map(f=>{const i=f.querySelector('img'),c=f.querySelector('.gl-credit');
      return {alt:i.alt,w:+i.getAttribute('width'),h:+i.getAttribute('height'),lazy:i.loading==="lazy",own:/^shared\/gallery\/[a-z0-9-]+-1024\.jpg$/.test(i.getAttribute('src')),
        cap:f.querySelector('.gl-cap').textContent,by:/^Photo: \S/.test(c.textContent),
        lic:!!c.querySelector('a[href^="https://creativecommons.org/"]')||/public domain \(Philippine government work\)/.test(c.textContent),
        commons:!!c.querySelector('a[href^="https://commons.wikimedia.org/wiki/File:"]')};}));
    const bad=s.filter(f=>!(f.alt.length>20&&f.w&&f.h&&f.lazy&&f.own&&f.cap.length>20&&f.by&&f.lic&&f.commons));
    assert(s.length===17&&bad.length===0,`${w}: 17 photos, each described, sized, lazy, served by us and credited with licence and Commons page: ${JSON.stringify(bad.slice(0,2))}`);
    // the photos load from our own files
    await pg.evaluate(()=>document.querySelectorAll('#history img').forEach(i=>i.loading='eager'));
    await pg.waitForFunction(()=>[...document.querySelectorAll('#history .gl-fig img')].every(i=>i.complete),null,{timeout:20000});
    assert(await pg.evaluate(()=>[...document.querySelectorAll('#history .gl-fig img')].every(i=>i.naturalWidth>0)),`${w}: every photo loads`);
    // events in date order, each with a year and at least one source link
    s=await pg.evaluate(()=>[...document.querySelectorAll('#history .gl-ev')].map(e=>({y:+e.querySelector('.gl-yr').textContent,src:e.querySelectorAll('a.src').length})));
    assert(s.length>=9&&s.every((e,i)=>e.src>=1&&(i===0||e.y>=s[i-1].y)),`${w}: flood events run in date order, each with a linked source: ${JSON.stringify(s)}`);
    // politics: a dated timeline, every entry sourced, people charged presumed innocent, and where things stand
    s=await pg.evaluate(()=>{const p=document.getElementById('hi-politics');return {items:[...p.querySelectorAll('.gl-time li')].map(li=>({t:li.querySelector('time').textContent,src:li.querySelectorAll('a.src').length})),
      innocent:/presumed innocent until a court decides/.test(p.textContent),asof:/As of 1 October 2026/.test(p.textContent),deny:(p.textContent.match(/denied|denies|not guilty/g)||[]).length};});
    assert(s.items.length>=10&&s.items.every(i=>i.src>=1),`${w}: the politics timeline has ${s.items.length} dated entries, each linked to reporting`);
    assert(s.innocent&&s.asof&&s.deny>=3,`${w}: the politics section says those charged are presumed innocent, gives denials and pleas, and dates where things stand: ${JSON.stringify({i:s.innocent,a:s.asof,d:s.deny})}`);
    // every source link names its source
    s=await pg.evaluate(()=>[...document.querySelectorAll('#history a.src')].filter(a=>!/^https:/.test(a.href)||!a.dataset.src||!/source:/.test(a.textContent)).length);
    assert(s===0,`${w}: every source link opens https and names its source`);
    // the rail jumps to a section
    await pg.click('#history .ab-rail a[data-sec="politics"]');await pg.waitForFunction(()=>{const t=document.getElementById('hi-politics-h').getBoundingClientRect().top;return t>=0&&t<160;},null,{timeout:5000}).catch(()=>{});
    s=await pg.evaluate(()=>({hash:location.hash,top:Math.round(document.getElementById('hi-politics-h').getBoundingClientRect().top)}));
    assert(s.hash==="#history/politics"&&s.top>=0&&s.top<160,`${w}: the rail goes to The politics of flood control: ${JSON.stringify(s)}`);
    assert(outside.length===0,`${w}: nothing is fetched from outside the site: ${outside.slice(0,2).join(", ")}`);
    await ctx.close();
  }
  // dark theme: captions and credits keep their contrast
  {const ctx=await b.newContext({viewport:{width:1280,height:900},colorScheme:'dark'});const pg=await ctx.newPage();
   await pg.goto(U+'#history');await ready(pg,"history");
   const s=await pg.evaluate(()=>{const rgb=c=>c.match(/[\d.]+/g).slice(0,3).map(Number),L=c=>{const v=rgb(c).map(x=>{x/=255;return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4;});return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];},
     cr=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);},bg=getComputedStyle(document.body).backgroundColor,g=e=>getComputedStyle(document.querySelector(e)).color;
     return {cap:cr(g('#history .gl-cap'),bg),credit:cr(g('#history .gl-credit'),bg),creditLink:cr(g('#history .gl-credit a'),bg),src:cr(g('#history a.src'),bg),time:cr(g('#history .gl-time time'),bg)};});
   assert(Object.values(s).every(v=>v>=4.5),"dark theme: captions, credits, links and dates ≥ 4.5:1: "+JSON.stringify(s));
   await ctx.close();}
  assert(errs.length===0,"no page errors: "+errs.join(" | "));
  await b.close();
})();
