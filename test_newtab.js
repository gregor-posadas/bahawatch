// Links that leave BahaWatch open in a new tab, so the dashboard stays open behind them (Gregor, 2026-10-01: "clicking on a
// link (for example, the linkedin buttons for each of our cards) opens a new tab instead of overriding the current tab").
// Every outside link gets target="_blank" with rel="noopener noreferrer" (the new page cannot reach back into ours), and
// screen readers hear "opens in a new tab" through one shared description. Links inside the site (#about, #history/…)
// and mail links stay as they are. Run: ./test_pages.sh test_newtab.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.route('**/*',r=>r.request().url().startsWith(BASE)?r.continue():r.fulfill({status:200,contentType:'text/html',body:'<title>outside</title>'}));
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const audit=()=>pg.evaluate(()=>{const out=[...document.querySelectorAll('a[href]')].filter(a=>{try{const u=new URL(a.href,location.href);return /^https?:$/.test(u.protocol)&&u.origin!==location.origin;}catch(e){return false;}});
    const bad=out.filter(a=>a.target!=="_blank"||!/\bnoopener\b/.test(a.rel)||!/\bnoreferrer\b/.test(a.rel)||!(a.getAttribute('aria-describedby')||"").split(/\s+/).includes('ext-note')).map(a=>a.href.slice(0,60));
    const inside=[...document.querySelectorAll('a[href^="#"], a[href^="mailto:"]')].filter(a=>a.target==="_blank").map(a=>a.getAttribute('href'));
    const note=document.getElementById('ext-note');
    return {n:out.length,bad,inside,note:note&&note.textContent};});
  for(const r of ['home','about','access','history','ph']){
    await pg.goto(U+'#'+r);await ready(pg,r);
    const s=await audit();
    assert(s.n>0&&s.bad.length===0,`#${r}: all ${s.n} outside links open in a new tab, safely, and say so to screen readers: ${s.bad.slice(0,3).join(" | ")}`);
    assert(s.inside.length===0,`#${r}: links inside the site and mail links open in place: ${s.inside.slice(0,3).join(" ")}`);
    assert(s.note==="opens in a new tab",`#${r}: the shared description reads "opens in a new tab": ${s.note}`);
  }
  // clicking Gregor's LinkedIn opens a new tab and leaves the dashboard where it was
  await pg.goto(U+'#home');await ready(pg,"home");
  const before=pg.url();
  const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:5000}).catch(()=>null),pg.click('a.hm-in[href*="gregorposadas"]')]);
  assert(pop&&/linkedin\.com\/in\/gregorposadas/.test(pop.url())&&pg.url()===before,`LinkedIn opens in a new tab; BahaWatch stays open: ${pop&&pop.url()} / ${pg.url()}`);
  if(pop)await pop.close();
  // links added later (a campus page's sources, map credits) are handled too
  await pg.goto(U+'#uplb');await ready(pg,"uplb");
  const s=await audit();
  assert(s.n>0&&s.bad.length===0,`a campus page: all ${s.n} outside links open in a new tab: ${s.bad.slice(0,3).join(" | ")}`);
  assert(errs.length===0,"no page errors: "+errs.join(" | "));
  await b.close();
})();
