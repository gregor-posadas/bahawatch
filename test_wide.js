// Reading pages on wide screens. Gregor, 2026-10-01: first "why is there so much blank space here?", then "maybe there's a
// happy medium", then, reading About and Accessibility, "too much horizontality can be a bad thing... let's stick with best
// practices and keep things centered like before". So About and Accessibility are one centred reading column (about 75
// characters a line, lists in one column, FAQ questions one under another), and Flood history keeps its photos beside
// their stories, with its people chart ("Lives lost") in the space to the right on wide screens.
// Run: ./test_pages.sh test_wide.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const errs=[];
  for(const w of [1920,1280,375]){
    const ctx=await b.newContext({viewport:{width:w,height:1000}});
    const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
    for(const r of ['about','access','history']){
      await pg.goto(U+'#'+r);await ready(pg,r);
      const s=await pg.evaluate(r=>{const m=document.querySelector('#'+r+' .ab-main'),mr=m.getBoundingClientRect(),rail=document.querySelector('#'+r+' .ab-rail').getBoundingClientRect();
        const ch=parseFloat(getComputedStyle(m).fontSize)*0.55;   // rough width of one character
        const ps=[...m.querySelectorAll(':scope > section > p, .ab-lead')].filter(p=>p.offsetParent);
        return {main:Math.round(mr.width),left:Math.round(rail.left),right:Math.round(innerWidth-mr.right),maxP:Math.round(Math.max(...ps.map(p=>p.getBoundingClientRect().width))),limit:Math.round(80*ch),sw:document.documentElement.scrollWidth};},r);
      if(w===1920&&r!=="history")assert(s.main>=600&&s.main<=720&&Math.abs(s.left-s.right)<=40,`${w} #${r}: one reading column, centred on the screen: ${JSON.stringify(s)}`);
      if(w===1280&&r!=="history")assert(s.main<=720,`${w} #${r}: the reading column stays narrow: ${s.main} px`);
      assert(s.maxP<=s.limit,`${w} #${r}: prose keeps a readable line (${s.maxP} px ≤ ${s.limit})`);
      assert(s.sw<=w,`${w} #${r}: no sideways scroll`);
    }
    // lists and the FAQ stay in one column, as before the wide experiment
    await pg.goto(U+'#access');await ready(pg,"access");
    let s=await pg.evaluate(()=>getComputedStyle(document.querySelector('#access .ab-list')).columnCount);
    assert(s==="auto"||+s<=1,`${w}: Accessibility lists are one column (${s})`);
    await pg.goto(U+'#about/faq');await ready(pg,"about");
    s=await pg.evaluate(()=>{const d=[...document.querySelectorAll('#about .ab-faq details')].slice(0,2).map(x=>x.getBoundingClientRect());return {side:d[1].left>d[0].right};});
    assert(!s.side,`${w}: FAQ questions sit one under another`);
    // Flood history: photos beside their story on wide screens
    await pg.goto(U+'#history');await ready(pg,"history");
    s=await pg.evaluate(()=>{const ev=[...document.querySelectorAll('#history .gl-ev')].find(e=>e.querySelector('figure'));const t=ev.querySelector('p').getBoundingClientRect(),f=ev.querySelector('figure').getBoundingClientRect();
      const fs=[...document.querySelectorAll('#history .gl-figs figure')].map(x=>x.getBoundingClientRect().width);
      return {beside:f.left>=t.right,top:Math.abs(f.top-ev.querySelector('h3').getBoundingClientRect().top)<80,maxImg:Math.round(Math.max(...[...document.querySelectorAll('#history .gl-fig img')].map(i=>i.getBoundingClientRect().width))),minFig:Math.round(Math.min(...fs))};});
    if(w===1920)assert(s.beside&&s.top&&s.maxImg<=1100&&s.minFig>=320,`${w}: Flood history photos sit beside their story, not stretched past their size: ${JSON.stringify(s)}`);
    if(w===375)assert(!s.beside,`${w}: on a phone the photos follow the text`);
    // the people chart: in the right-hand space on wide screens, staying in view while you read; after the introduction otherwise
    s=await pg.evaluate(()=>{const v=document.querySelector('#history .gl-viz'),vr=v.getBoundingClientRect(),vi=document.querySelector('#history .gl-viz-in').getBoundingClientRect(),fl=document.getElementById('hi-floods').getBoundingClientRect(),wa=document.getElementById('hi-water').getBoundingClientRect();
      return {beside:vr.left>=fl.right,after:vr.top>=fl.bottom-1&&vr.bottom<=wa.top+1,inView:vi.top>=0&&vi.top<innerHeight/2&&vi.height<=innerHeight-32,h:Math.round(vi.height),top:Math.round(vi.top),w:Math.round(vr.width),right:Math.round(innerWidth-vr.right)};});
    if(w===1920)assert(s.beside&&s.top>=0&&s.top<500&&s.right>=16,`${w}: the Lives lost chart fills the space to the right of the stories, starting at the top: ${JSON.stringify(s)}`);
    else assert(!s.beside&&s.after,`${w}: the Lives lost chart follows the flood stories: ${JSON.stringify(s)}`);
    if(w===1920){
      const fw=await pg.evaluate(()=>Math.round(document.querySelector('#history .gl-p-ppl').getBoundingClientRect().width));
      assert(fw===336,`${w}: inside its card the figures keep their full size (Ormoc's block ${fw} px wide)`);
      await pg.evaluate(()=>document.getElementById('hi-politics').querySelector('.gl-time li:nth-child(6)').scrollIntoView({block:'center'}));await pg.waitForTimeout(300);
      s=await pg.evaluate(()=>{const f=document.querySelector('#hi-politics .gl-figs').getBoundingClientRect(),t=document.querySelector('#hi-politics .gl-time').getBoundingClientRect();
        return {visible:f.top<innerHeight&&f.bottom>0,beside:f.left>=t.right};});
      assert(s.visible&&s.beside,`${w}: the protest photos stay in view beside the political timeline: ${JSON.stringify(s)}`);
    }
    await ctx.close();
  }
  assert(errs.length===0,"no page errors: "+errs.join(" | "));
  await b.close();
})();
