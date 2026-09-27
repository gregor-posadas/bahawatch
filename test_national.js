// The national map and campus list (spec §3.1, §7.3): 25 campuses as labelled pins and a grouped list, search that
// ignores accents and case, clusters that zoom, pilot links. Run: ./test_pages.sh test_national.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await ready(pg,"ph");
  let s=await pg.evaluate(()=>{
    const pins=[...document.querySelectorAll('#nat-pins .pin')],cl=[...document.querySelectorAll('#nat-pins .pin-cluster')];
    return {n:CAMPUSES.length,shown:pins.length+cl.reduce((a,c)=>a+c.dataset.ids.split(",").length,0),
      labels:pins.every(p=>/: .+, .+\. (State|Local|Private)/.test(p.getAttribute('aria-label'))),text:pins.every(p=>p.querySelector('.pin-t').textContent.length>1),
      clusters:cl.map(c=>c.getAttribute('aria-label')),legend:[...document.querySelectorAll('#nat-legend li')].map(l=>l.textContent),
      desc:document.getElementById('nat-desc').textContent,title:document.title,
      tabs:[...document.querySelectorAll('#nat .site-tabs [role=tab]')].map(t=>t.dataset.site+(t.getAttribute('aria-selected')==="true"?"*":""))};});
  assert(s.n===25&&s.shown===25,"all 25 campuses are on the map, as pins or inside clusters: "+s.shown);
  assert(s.labels&&s.text,"each pin has a visible short label and a full spoken label (name, place, type)");
  assert(s.clusters.length>=1&&s.clusters.every(c=>/^\d+ campuses: .+Zoom in$/.test(c)),"crowded Metro Manila pins become a cluster that says how many and which: "+s.clusters[0]);
  assert(s.legend.join("|")==="State university or college (circle)|Local university or college (square)|Private (triangle)","legend says the pin shapes in words");
  assert(s.desc==="Map of the Philippines with 25 PhilDev partner campuses: 17 in Luzon, 5 in Visayas, 3 in Mindanao. The list below has the same campuses.","screen-reader description of the map");
  assert(s.tabs.join()==="ph*,tv,berkeley,try"&&/PhilDev partner campuses/.test(s.title),"tab row with 'PhilDev campuses' selected; page title");
  s=await pg.evaluate(()=>[...document.querySelectorAll('#nat-list h2')].map(h=>h.dataset.group+h.dataset.n+":"+h.nextElementSibling.children.length));
  assert(s.join()==="Luzon17:17,Visayas5:5,Mindanao3:3","list grouped Luzon 17 · Visayas 5 · Mindanao 3: "+s);
  // search: accents, case, city names; the count is announced once typing pauses
  const find=async q=>{await pg.fill('#nat-q',q);await pg.waitForTimeout(500);return pg.evaluate(()=>({ids:[...document.querySelectorAll('#nat-list .nat-item')].map(a=>a.getAttribute('href').slice(1)),count:document.getElementById('nat-count').textContent,none:document.getElementById('nat-list').textContent}));};
  for(const [q,want] of [["Xavier",["xu"]],["xavier",["xu"]],["UPLB",["uplb"]],["banos",["uplb"]],["mapua",["mapua"]],["Iligan",["msuiit"]],["cebu city",["ctu","usc","upc"]]]){
    s=await find(q);assert(s.ids.join()===want.join(),`search "${q}" finds ${want}: ${s.ids}`);
  }
  s=await find("Xavier");assert(s.count==="1 campus matches.","search announces how many matched: "+s.count);
  s=await find("zzz");assert(s.ids.length===0&&/No campus matches “zzz”/.test(s.none)&&/No campus matches/.test(s.count),"no match says so");
  await pg.fill('#nat-q','');await pg.waitForTimeout(450);
  // a cluster zooms in; 'Whole country' zooms back out
  const before=await pg.evaluate(()=>document.querySelectorAll('#nat-pins .pin').length);
  await pg.click('#nat-pins .pin-cluster');await pg.waitForTimeout(100);
  s=await pg.evaluate(()=>({pins:document.querySelectorAll('#nat-pins .pin').length,out:!document.getElementById('nat-zoom-out').hidden,focus:document.activeElement.closest('#nat-pins')!==null}));
  assert(s.pins>0&&s.out&&s.focus,"a cluster zooms in to separate pins, shows 'Whole country', and keeps focus on the map: "+s.pins);
  for(let i=0;i<4&&await pg.$('#nat-pins .pin-cluster');i++){await pg.click('#nat-pins .pin-cluster');await pg.waitForTimeout(80);}
  assert(await pg.evaluate(()=>!document.querySelector('#nat-pins .pin-cluster')||document.querySelectorAll('#nat-pins .pin').length>1),"zooming further separates even the closest campuses");
  await pg.click('#nat-zoom-out');
  assert(await pg.evaluate(()=>document.querySelectorAll('#nat-pins .pin').length)===before,"'Whole country' returns to the full map");
  // choosing a campus from the list opens it; Back returns to the map
  await pg.click('#nat-list a[href="#xu"]');await ready(pg,"xu");
  s=await pg.evaluate(()=>({site:SITE,hash:location.hash,title:document.title}));
  assert(s.site==="xu"&&s.hash==="#xu","choosing XU in the list opens its page: "+s.hash);
  await pg.goBack();await ready(pg,"ph");
  assert(await pg.evaluate(()=>ROUTE==="ph"&&getComputedStyle(document.getElementById('nat')).display!=="none"),"Back returns to the national map");
  await pg.click('#nat-pins .pin-cluster');await pg.click('#nat-pins .pin >> nth=0');
  assert(await pg.waitForFunction(()=>ROUTE==="site"&&isCampus(SITE),null,{timeout:15000}).then(()=>true,()=>false),"choosing a pin opens that campus");
  await pg.goBack();await ready(pg,"ph");
  // pilot sites and Try reporting stay reachable from here
  s=await pg.evaluate(()=>[...document.querySelectorAll('#nat-pilots-h + .nat-ul a')].map(a=>a.getAttribute('href')));
  assert(s.join()==="#tv,#berkeley,#try","pilot sites and Try reporting listed after the campuses");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
