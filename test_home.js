// The homepage (2026-09-30, Gregor): a plain link opens it. Who the team is, why BahaWatch exists, an animated line
// from sensor to answer, the collaborators, the timeline and how to get in touch. Run: ./test_pages.sh test_home.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const errs=[];
  for(const w of [1280,375]){
    const ctx=await b.newContext({viewport:{width:w,height:900}});const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
    const files=[],bad=[];pg.on('request',r=>{const m=r.url().match(/\/data\/(\w+)\.json/);if(m)files.push(m[1]);});
    pg.on('response',r=>{if(r.status()>=400)bad.push(r.status()+" "+r.url());});
    await pg.goto(U);await ready(pg,"home");
    let s=await pg.evaluate(()=>({route:ROUTE,hash:location.hash,shown:getComputedStyle(document.getElementById('home')).display,nat:getComputedStyle(document.getElementById('nat')).display,
      tabs:[...document.querySelectorAll('.site-tabs')].map(n=>[...n.querySelectorAll('[role=tab]')].map(t=>t.dataset.site+(t.getAttribute('aria-selected')==="true"?"*":"")).join()),
      title:document.title,sw:document.documentElement.scrollWidth,h1:document.getElementById('hm-h').textContent}));
    assert(s.route==="home"&&s.hash===""&&s.shown!=="none"&&s.nat==="none"&&s.h1==="BahaWatch"&&/BahaWatch/.test(s.title),`${w}: a plain link opens the homepage, alone`);
    assert(s.tabs.length===5&&s.tabs.every(t=>t==="home*,ph,tv,sjq,berkeley,try,about"),`${w}: every tab bar starts with Home, selected: ${s.tabs[0]}`);
    assert(s.sw<=w&&files.length===0,`${w}: no sideways scroll; no site file fetched (${files})`);
    // the team: three people, photos, roles and emails
    s=await pg.evaluate(()=>[...document.querySelectorAll('.hm-team li')].map(li=>({n:li.querySelector('h3').textContent,img:li.querySelector('img').getAttribute('alt'),mail:li.querySelector('a[href^="mailto:"]').getAttribute('href')})));
    assert(s.map(x=>x.n).join()==="Noam Anglo,Tim Groeschel,Gregor Posadas"&&s.every(x=>x.img===x.n),`${w}: the team is Noam, Tim and Gregor, each photo named`);
    assert(s.map(x=>x.mail).join()==="mailto:nanglo@berkeley.edu,mailto:tim_groeschel@berkeley.edu,mailto:gregorposadas@berkeley.edu",`${w}: each has an email link`);
    // collaborators' logos, all loaded, each named
    await pg.evaluate(()=>document.getElementById('hm-collab').scrollIntoView());await pg.waitForTimeout(300);
    s=await pg.evaluate(()=>[...document.querySelectorAll('.hm-logos img')].map(i=>({alt:i.alt,ok:i.complete&&i.naturalWidth>0})));
    assert(s.map(x=>x.alt).join("|")==="Bike Scouts|University of the Philippines|Blum Center for Developing Economies|UC Berkeley Disaster Lab"&&s.every(x=>x.ok),`${w}: the four collaborators' logos load, with their names: ${JSON.stringify(s)}`);
    s=await pg.evaluate(()=>[...document.querySelectorAll('.hm-team img')].map(i=>{i.loading="eager";return i.src;}));
    await pg.evaluate(()=>document.getElementById('hm-team').scrollIntoView());await pg.waitForTimeout(400);
    assert(await pg.evaluate(()=>[...document.querySelectorAll('.hm-team img')].every(i=>i.complete&&i.naturalWidth>0)),`${w}: the team photos load`);
    // how it works: five stops in order; the line moves only on screen; a button pauses it
    s=await pg.evaluate(()=>[...document.querySelectorAll('.hm-stop h3')].map(h=>h.textContent).join());
    assert(s==="Measure,Send,Combine,Spread,Answer",`${w}: how it works has five stops: ${s}`);
    s=await pg.evaluate(()=>/FABDEM/.test(document.getElementById('hm-how').textContent)&&/LoRaWAN/.test(document.getElementById('hm-how').textContent)&&/simulated|stands in/.test(document.getElementById('hm-how').textContent));
    assert(s,`${w}: it names LoRaWAN and FABDEM, and says the demo's readings are simulated`);
    await pg.evaluate(()=>document.getElementById('hm-how').scrollIntoView());await pg.waitForTimeout(300);
    let run=await pg.evaluate(()=>({on:document.getElementById('hm-how').classList.contains('hm-run'),anim:getComputedStyle(document.querySelector('.hm-pulse')).animationName}));
    assert(run.on&&/hm-pulse/.test(run.anim),`${w}: on screen, the pulse travels along the line: ${JSON.stringify(run)}`);
    await pg.click('#hm-play');
    run=await pg.evaluate(()=>({on:document.getElementById('hm-how').classList.contains('hm-run'),pressed:document.getElementById('hm-play').getAttribute('aria-pressed'),label:document.getElementById('hm-play').textContent}));
    assert(!run.on&&run.pressed==="true"&&run.label==="Play the animation",`${w}: "Pause the animation" stops it: ${JSON.stringify(run)}`);
    await pg.evaluate(()=>window.scrollTo(0,0));await pg.waitForTimeout(300);await pg.click('#hm-play').catch(()=>{});
    // links: the main button opens the flood map; "See how it works" lands on the line
    await pg.evaluate(()=>window.scrollTo(0,0));
    await pg.click('.hm-cta a[href="#home/how"]');await pg.waitForTimeout(900);
    s=await pg.evaluate(()=>({hash:location.hash,f:document.activeElement.id,top:Math.round(document.getElementById('hm-how-h').getBoundingClientRect().top)}));
    assert(s.hash==="#home/how"&&s.f==="hm-how-h"&&s.top>=0&&s.top<60,`${w}: "See how it works" scrolls to it and moves focus there: ${JSON.stringify(s)}`);
    await pg.click('.hm-cta a[href="#ph"]');await ready(pg,"ph");
    s=await pg.evaluate(()=>({route:ROUTE,hash:location.hash,sel:document.querySelector('#nat .site-tabs [aria-selected=true]').dataset.site}));
    assert(s.route==="ph"&&s.hash==="#ph"&&s.sel==="ph",`${w}: "Open the flood map" opens the PhilDev map at #ph`);
    await pg.click('#nat .site-tabs [data-site="home"]');await ready(pg,"home");
    assert(await pg.evaluate(()=>ROUTE==="home"&&location.hash===""&&scrollY===0),`${w}: the Home tab comes back to the top of the homepage`);
    await pg.goto(U+'#tv');await ready(pg,"tv");await pg.click('#public .site-tabs [data-site="home"]');await ready(pg,"home");
    assert(await pg.evaluate(()=>ROUTE==="home"&&playing===false),`${w}: Home from a site pauses its storm`);
    assert(bad.length===0,`${w}: no missing files: ${bad.join(", ")}`);
    await ctx.close();
  }
  // reduced motion: nothing moves and there is nothing to pause
  {const ctx=await b.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
   await pg.goto(U+'#home/how');await ready(pg,"home");await pg.waitForTimeout(300);
   const s=await pg.evaluate(()=>({on:document.getElementById('hm-how').classList.contains('hm-run'),btn:document.getElementById('hm-play').hidden,anim:getComputedStyle(document.querySelector('.hm-pulse')).animationName}));
   assert(!s.on&&s.btn&&s.anim==="none","reduced motion: the line stays still and the pause button is hidden: "+JSON.stringify(s));
   await ctx.close();}
  // dark theme: text and buttons keep ≥ 4.5:1
  {const ctx=await b.newContext({viewport:{width:1280,height:900},colorScheme:'dark'});const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
   await pg.goto(U);await ready(pg,"home");
   const s=await pg.evaluate(()=>{const rgb=c=>c.match(/[\d.]+/g).slice(0,3).map(Number),L=c=>{const v=rgb(c).map(x=>{x/=255;return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4;});return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];},
     cr=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);},bg=getComputedStyle(document.body).backgroundColor,g=e=>getComputedStyle(document.querySelector(e));
     return {theme:document.documentElement.dataset.theme,h1:cr(g('#hm-h').color,bg),note:cr(g('.hm-demo').color,bg),btn:cr(g('.hm-btn-p').color,g('.hm-btn-p').backgroundColor),stat:cr(g('.hm-stats span').color,g('.hm-stats li').backgroundColor),link:cr(g('.hm-team a').color,g('.hm-team li').backgroundColor)};});
   assert(s.theme==="dark"&&Object.entries(s).every(([k,v])=>k==="theme"||v>=4.5),"dark theme: homepage text, links and the main button ≥ 4.5:1: "+JSON.stringify(s));
   await ctx.close();}
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
