// A campus page (spec §3.2, §7.3): "‹ All campuses · <campus> ▾" with the simulation label, and the partnership card.
// Run: ./test_pages.sh test_campus.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(()=>{try{localStorage.setItem("bw-asked:xu","1");}catch(e){}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message+' @ '+(e.stack||'').split('\n').slice(1,4).join(' | ')));
  await pg.goto(U+'#xu');await ready(pg,"xu");
  let s=await pg.evaluate(()=>{const bar=document.querySelector('#public [data-cbar]');return {shown:!bar.hidden,back:bar.querySelector('.c-back').textContent,href:bar.querySelector('.c-back').getAttribute('href'),
    pick:bar.querySelector('.c-pick').textContent,pickL:bar.querySelector('.c-pick').getAttribute('aria-label'),sim:bar.querySelector('.c-sim').textContent,
    tab:document.querySelector('#public .site-tabs [aria-selected="true"]').dataset.site};});
  assert(s.shown&&s.back==="‹ All campuses"&&s.href==="#ph"&&s.pick==="XU ▾"&&/Change campus \(now Xavier University/.test(s.pickL),"campus bar: ‹ All campuses · XU ▾ ("+s.pickL+")");
  assert(s.sim==="Simulation: sensor readings are simulated; unit spots are proposals. Terrain: FABDEM (30 m). Not a forecast; not for emergency use.","simulation label always shown on a campus page");
  assert(s.tab==="ph","the PhilDev campuses tab stays selected on a campus page");
  assert(await pg.evaluate(()=>!document.getElementById('c-card')),"no partnership card on campus pages (removed at Gregor's request)");
  // details view: bar stays, card goes; Try tab and pilot sites: neither
  await pg.click('#p-details');await pg.waitForTimeout(200);
  assert(await pg.evaluate(()=>!document.querySelector('header + .site-tabs + [data-cbar]').hidden),"details view: the campus bar stays");
  s=await pg.evaluate(()=>({cards:[...document.querySelectorAll('#house-cards .house-card')].map(c=>Math.round(c.getBoundingClientRect().height)),grid:Math.round(document.getElementById('house-cards').getBoundingClientRect().height)}));
  assert(s.cards.length===8&&s.cards.every(h=>h>=44)&&s.grid>=4*44,"details view: the eight unit cards are shown, not squeezed to nothing by the side panel (grid "+s.grid+" px)");
  await pg.click('header + .site-tabs [data-site="try"]');await pg.waitForTimeout(300);
  assert(await pg.evaluate(()=>[...document.querySelectorAll('[data-cbar]')].every(b=>b.hidden)),"Try reporting: no campus bar");
  await pg.click('#public .site-tabs [data-site="tv"]');await pg.waitForTimeout(300);
  assert(await pg.evaluate(()=>[...document.querySelectorAll('[data-cbar]')].every(b=>b.hidden)),"a pilot site: no campus bar");
  // ▾ opens the national list with the search box focused; ‹ All campuses opens the map
  await pg.goto(U+'#xu');await ready(pg,"xu");
  await pg.click('#public [data-cbar] .c-pick');await ready(pg,"ph");
  assert(await pg.evaluate(()=>document.activeElement.id==="nat-q"),"'XU ▾' opens the campus list with the search box focused");
  await pg.goBack();await ready(pg,"xu");
  await pg.click('#public [data-cbar] .c-back');await ready(pg,"ph");
  assert(await pg.evaluate(()=>ROUTE==="ph"),"'‹ All campuses' returns to the national map");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  // one language choice carries across the national map and every campus (25 campuses: nobody should pick it 25 times)
  {const c2=await b.newContext({viewport:{width:1280,height:900}});await c2.addInitScript(()=>{try{for(const k of ["xu","upd","usc"])localStorage.setItem("bw-asked:"+k,"1");}catch(e){}});
    const p3=await c2.newPage();await p3.goto(U+'#ph');await ready(p3,"ph");
    await p3.selectOption('#nat-lang','fil');
    const d0=await p3.evaluate(()=>({lang:document.documentElement.lang,tr:document.documentElement.getAttribute("translate"),h:document.getElementById("nat-q-l").textContent}));
    assert(d0.lang==="fil"&&d0.tr==="no"&&d0.h==="Maghanap ng kampus","Filipino on the national map: <html lang=fil translate=no>, search label in Filipino: "+JSON.stringify(d0));
    await p3.goto(U+'#xu');await ready(p3,"xu");
    assert(await p3.evaluate(()=>document.querySelector("#public [data-cbar] .c-sim").textContent===NAT_LANGS.fil.sim),"the campus bar is in Filipino");
    const a1=await p3.evaluate(()=>LANG);
    await p3.selectOption('#p-lang','ceb');
    await p3.goto(U+'#upd');await ready(p3,"upd");
    const a2=await p3.evaluate(()=>LANG);
    await p3.goto(U+'#ph');await ready(p3,"ph");
    const a3=await p3.evaluate(()=>[LANG,document.getElementById('nat-lang').value]);
    await p3.selectOption('#nat-lang','en');
    const d1=await p3.evaluate(()=>({lang:document.documentElement.lang,tr:document.documentElement.getAttribute("translate")}));
    assert(d1.lang==="en"&&d1.tr===null,"back to English: <html lang=en>, and Chrome may translate again: "+JSON.stringify(d1));
    assert(a1==="fil"&&a2==="ceb"&&a3[0]==="ceb"&&a3[1]==="ceb","language chosen on the national map carries to a campus, and a campus choice to the next campus and back ("+[a1,a2,a3].join(" → ")+")");
    await c2.close();}
  // a fresh visitor whose browser is set to Filipino, deep-linking straight into a campus's details view (no saved
  // language, no visit to the national map or the simple view first): <html lang>/translate must still be right
  {const c3=await b.newContext({viewport:{width:1280,height:900},locale:'fil-PH'});await c3.addInitScript(()=>{try{localStorage.setItem("bw-asked:xu","1");}catch(e){}});
    const p5=await c3.newPage();await p5.goto(U+'#xu/details');await ready(p5,"xu");
    const d2=await p5.evaluate(()=>({lang:document.documentElement.lang,tr:document.documentElement.getAttribute("translate"),LANG}));
    assert(d2.lang==="fil"&&d2.tr==="no"&&d2.LANG==="fil","boot straight into a campus's details view with a Filipino browser: <html lang=fil translate=no>: "+JSON.stringify(d2));
    await c3.close();}
  {const c4=await b.newContext({viewport:{width:1280,height:900}});await c4.addInitScript(()=>{try{localStorage.setItem("bw-asked:xu","1");}catch(e){}});
    const p6=await c4.newPage();await p6.goto(U+'#xu/details');await ready(p6,"xu");
    const d3=await p6.evaluate(()=>({lang:document.documentElement.lang,tr:document.documentElement.getAttribute("translate")}));
    assert(d3.lang==="en"&&d3.tr===null,"boot straight into a campus's details view with an English browser: <html lang=en>, no translate attribute: "+JSON.stringify(d3));
    await c4.close();}
  // OSM names are data, not markup: a street name with HTML must show as text in the cards, the log and the warning
  {const p2=await ctx.newPage();const fs=require('fs');
    await p2.route('**/data/usc.json',r=>{const d=JSON.parse(fs.readFileSync('data/usc.json','utf8'));d.sensors.forEach(u=>{u.street='<img id="pwn" src="x">';});r.fulfill({contentType:'application/json',body:JSON.stringify(d)});});
    await p2.goto(U+'#usc/details');await ready(p2,"usc");
    await p2.click('.scenarios [data-sc="typhoon"]');
    const r=await p2.evaluate(()=>{setPlay(false);for(let t=0;t<=720;t+=10){tMin=t;step(0,true);}
      return {pwn:document.querySelectorAll('#pwn').length,card:document.querySelector('#house-cards .h-st').textContent,log:document.getElementById('log-list').textContent};});
    assert(r.pwn===0&&/<img id="pwn"/.test(r.card)&&/<img id="pwn"/.test(r.log),"street names with markup are shown as text, never parsed (cards, log, warning)");
    await p2.close();}
  // each campus bar belongs to one view (Gregor's screenshot: the Details copy showed mid-page in the simple view)
  {const p4=await ctx.newPage();
   for(const [h,want] of [["#uplb","public"],["#uplb/details","details"],["#tv",null],["#try",null]]){
     await p4.goto(U+h);await p4.waitForFunction(()=>document.body.dataset.ready&&document.body.dataset.ready!=="");await p4.waitForTimeout(300);
     const v=await p4.evaluate(()=>[...document.querySelectorAll('[data-cbar]')].filter(b=>b.getClientRects().length&&getComputedStyle(b).visibility!=="hidden").map(b=>b.closest('#public')?"public":"details"));
     assert(want?v.length===1&&v[0]===want:v.length===0,`${h}: the campus bars shown are ${JSON.stringify(v)}`);}
   await p4.close();}
  await b.close();
})();
