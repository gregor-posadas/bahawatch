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
  s=await pg.evaluate(()=>({hidden:document.getElementById('c-card').hidden,h:document.getElementById('c-card-h').textContent,uh:document.getElementById('c-units-h').textContent,
    units:[...document.querySelectorAll('#c-units li')].map(l=>l.textContent),brgyS:document.getElementById('c-brgy-s').textContent,brgy:document.querySelectorAll('#c-brgy li').length,
    card:DATA.card,noah:[...document.querySelectorAll('#c-noah li')].map(l=>l.textContent),role:document.querySelectorAll('#c-role li').length}));
  assert(!s.hidden&&s.h==="What a partnership looks like","partnership card shown with its heading");
  assert(s.uh==="Proposed units: 8 household water-level units, placed automatically"&&s.units.length===8,"8 proposed units listed");
  assert(/^BW-XU-01 · .+ · on campus$/.test(s.units[0])&&s.units.slice(1).every(u=>!/on campus/.test(u)),"unit 01, and only unit 01, is marked on campus: "+s.units[0]);
  assert(s.brgy===s.card.barangays.length&&s.brgy>0&&s.brgyS===(s.brgy===1?"1 barangay":s.brgy+" barangays"),"barangays covered: count, then the list ("+s.brgyS+")");
  assert(s.noah.length===3&&s.noah.every((t,i)=>new RegExp("^"+["5","25","100"][i]+"-year rain: (\\d+%|not available from NOAH)$").test(t)),"three NOAH lines: "+s.noah.join(" | "));
  assert(s.role===3,"university role: three lines");
  s=await pg.evaluate(()=>{DATA.card.noah["100"]=null;syncCampusUI();return document.querySelectorAll('#c-noah li')[2].textContent;});
  assert(s==="100-year rain: not available from NOAH","a missing NOAH period reads 'not available', never 0%");
  // details view: bar stays, card goes; Try tab and pilot sites: neither
  await pg.click('#p-details');await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({bar:!document.querySelector('header + .site-tabs + [data-cbar]').hidden,card:document.getElementById('c-card').hidden}));
  assert(s.bar&&s.card,"details view: the campus bar stays, the card is for the simple view");
  await pg.click('header + .site-tabs [data-site="try"]');await pg.waitForTimeout(300);
  assert(await pg.evaluate(()=>[...document.querySelectorAll('[data-cbar]')].every(b=>b.hidden)&&document.getElementById('c-card').hidden),"Try reporting: no campus bar, no card");
  await pg.click('#public .site-tabs [data-site="tv"]');await pg.waitForTimeout(300);
  assert(await pg.evaluate(()=>[...document.querySelectorAll('[data-cbar]')].every(b=>b.hidden)&&document.getElementById('c-card').hidden),"a pilot site: no campus bar, no card");
  // ▾ opens the national list with the search box focused; ‹ All campuses opens the map
  await pg.goto(U+'#xu');await ready(pg,"xu");
  await pg.click('#public [data-cbar] .c-pick');await ready(pg,"ph");
  assert(await pg.evaluate(()=>document.activeElement.id==="nat-q"),"'XU ▾' opens the campus list with the search box focused");
  await pg.goBack();await ready(pg,"xu");
  await pg.click('#public [data-cbar] .c-back');await ready(pg,"ph");
  assert(await pg.evaluate(()=>ROUTE==="ph"),"'‹ All campuses' returns to the national map");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
