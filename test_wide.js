// Wide screens (Gregor, 2026-10-01: "why is there so much blank space here?"): the reading pages (About,
// Accessibility, Flood history) fill the screen. Prose keeps a readable line (about 72 characters); lists, FAQs, data
// blocks and photos use the width. Below 1200 px everything stacks as before. Run: ./test_pages.sh test_wide.js
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
      const s=await pg.evaluate(r=>{const m=document.querySelector('#'+r+' .ab-main'),mr=m.getBoundingClientRect();
        const ch=parseFloat(getComputedStyle(m).fontSize)*0.55;   // rough width of one character
        const ps=[...m.querySelectorAll(':scope > section > p, .ab-lead')].filter(p=>p.offsetParent);
        return {main:Math.round(mr.width),right:Math.round(innerWidth-mr.right),maxP:Math.round(Math.max(...ps.map(p=>p.getBoundingClientRect().width))),limit:Math.round(80*ch),sw:document.documentElement.scrollWidth};},r);
      if(w===1920)assert(s.main>=1500&&s.right<=40,`${w} #${r}: the reading column fills the screen (${s.main} px wide, ${s.right} px to spare)`);
      assert(s.maxP<=s.limit,`${w} #${r}: prose keeps a readable line (${s.maxP} px ≤ ${s.limit})`);
      assert(s.sw<=w,`${w} #${r}: no sideways scroll`);
    }
    // lists and the FAQ use the width on wide screens and stack on phones
    await pg.goto(U+'#access');await ready(pg,"access");
    let s=await pg.evaluate(()=>{const l=document.querySelector('#access .ab-list');return {cols:getComputedStyle(l).columnCount,w:Math.round(l.getBoundingClientRect().width)};});
    if(w===1920)assert(+s.cols>=2,`${w}: Accessibility lists flow into columns: ${JSON.stringify(s)}`);
    if(w===375)assert(s.cols==="auto"||+s.cols<=1,`${w}: on a phone the lists are one column`);
    await pg.goto(U+'#about/faq');await ready(pg,"about");
    s=await pg.evaluate(()=>{const d=[...document.querySelectorAll('#about .ab-faq details')].slice(0,2).map(x=>x.getBoundingClientRect());return {sameRow:Math.abs(d[0].top-d[1].top)<2,side:d[1].left>d[0].right};});
    if(w===1920)assert(s.sameRow&&s.side,`${w}: FAQ questions sit two to a row`);
    if(w===375)assert(!s.side,`${w}: FAQ questions stack on a phone`);
    // Flood history: photos sit beside their story on wide screens; the politics photos stay beside the timeline
    await pg.goto(U+'#history');await ready(pg,"history");
    s=await pg.evaluate(()=>{const ev=[...document.querySelectorAll('#history .gl-ev')].find(e=>e.querySelector('figure'));const t=ev.querySelector('p').getBoundingClientRect(),f=ev.querySelector('figure').getBoundingClientRect();
      const fs=[...document.querySelectorAll('#history .gl-figs figure')].map(x=>x.getBoundingClientRect().width);
      return {beside:f.left>=t.right,top:Math.abs(f.top-ev.querySelector('h3').getBoundingClientRect().top)<80,maxImg:Math.round(Math.max(...[...document.querySelectorAll('#history .gl-fig img')].map(i=>i.getBoundingClientRect().width))),minFig:Math.round(Math.min(...fs))};});
    if(w===1920)assert(s.beside&&s.top&&s.maxImg<=1100&&s.minFig>=320,`${w}: Flood history photos sit beside their story, not stretched past their size: ${JSON.stringify(s)}`);
    if(w===375)assert(!s.beside,`${w}: on a phone the photos follow the text`);
    if(w===1920){
      await pg.evaluate(()=>document.getElementById('hi-politics').querySelector('.gl-time li:nth-child(6)').scrollIntoView({block:'center'}));await pg.waitForTimeout(300);
      s=await pg.evaluate(()=>{const f=document.querySelector('#hi-politics .gl-figs').getBoundingClientRect(),t=document.querySelector('#hi-politics .gl-time').getBoundingClientRect();return {visible:f.top<innerHeight&&f.bottom>0,beside:f.left>=t.right};});
      assert(s.visible&&s.beside,`${w}: the protest photos stay in view beside the political timeline: ${JSON.stringify(s)}`);
    }
    await ctx.close();
  }
  assert(errs.length===0,"no page errors: "+errs.join(" | "));
  await b.close();
})();
