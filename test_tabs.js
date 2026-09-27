const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const U=BASE+'bahawatch_dashboard.html';
  await pg.goto(U+'#berkeley');await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(400);
  let s=await pg.evaluate(()=>({site:SITE,view:VIEW,tab:document.querySelector('#public .site-tabs [aria-selected="true"]').textContent}));
  assert(s.site==="berkeley"&&s.view==="public"&&s.tab==="UC Berkeley","#berkeley opens Berkeley public view");
  await pg.goto(U+'#diliman/details');await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>({site:SITE,view:VIEW,hash:location.hash}));
  assert(s.site==="upd"&&s.view==="details"&&s.hash==="#upd/details","old #diliman/details opens the UP Diliman campus details: "+s.hash);
  await pg.goto(U+'#nowhere');await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>({route:ROUTE,hash:location.hash,shown:getComputedStyle(document.getElementById('nat')).display}));
  assert(s.route==="ph"&&s.hash===""&&s.shown!=="none","unknown hash opens the national map: "+s.hash);
  await pg.goto(U+'#details');await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>({site:SITE,view:VIEW,hash:location.hash}));
  assert(s.site==="tv"&&s.view==="details"&&s.hash==="#tv/details","legacy #details still opens Teachers Village details");
  await pg.goto(U+'#berkeley/x');await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>({site:SITE,view:VIEW}));
  assert(s.site==="berkeley"&&s.view==="public","malformed view suffix → public view of that site");
  // clicking tabs
  await pg.goto(U+'#tv');await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(400);
  await pg.click('#public .site-tabs [data-site="berkeley"]');await pg.waitForFunction(()=>document.body.dataset.ready==="berkeley");await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({site:SITE,hash:location.hash,rows:document.querySelectorAll('#p-all .p-row').length}));
  assert(s.site==="berkeley"&&s.hash==="#berkeley"&&s.rows===9,"tab click switches site and writes the hash");
  // per-site my-street memory; stale id falls back
  await pg.evaluate(()=>{localStorage.setItem("bw-street:upd","BW-UPD-04");localStorage.setItem("bw-street:tv","BW-GONE");});
  await pg.click('#public .site-tabs [data-site="tv"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({my:myStreet,btn:document.getElementById("p-my-btn").textContent}));
  assert(s.my===null&&/Choose/.test(s.btn),"stale stored street id → choose again");
  await pg.goto(U+'#upd');await pg.waitForFunction(()=>document.body.dataset.ready==="upd");await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({my:myStreet,cap:document.getElementById("p-fig-cap").textContent,street:shortSt(HOUSEHOLD.find(h=>h.id==="BW-UPD-04").street)}));
  assert(s.my==="BW-UPD-04"&&s.cap.includes(s.street),"the UP Diliman campus remembers its own street: "+s.cap);
  // keyboard: on a campus page the PhilDev campuses tab is selected; ArrowRight moves to Teachers Village
  s=await pg.evaluate(()=>document.querySelector('#public .site-tabs [aria-selected="true"]').dataset.site);
  assert(s==="ph","a campus page selects the 'PhilDev campuses' tab: "+s);
  await pg.focus('#public .site-tabs [aria-selected="true"]');await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>SITE);
  assert(s==="tv","ArrowRight moves to the next tab");
  // the PhilDev campuses tab opens the national map; Back returns to the site
  await pg.click('#public .site-tabs [data-site="ph"]');await pg.waitForFunction(()=>document.body.dataset.ready==="ph");
  s=await pg.evaluate(()=>({route:ROUTE,sel:document.querySelector('#nat .site-tabs [aria-selected="true"]').dataset.site}));
  assert(s.route==="ph"&&s.sel==="ph","'PhilDev campuses' tab opens the national map");
  await pg.goBack();await pg.waitForFunction(()=>document.body.dataset.ready==="tv");
  assert(await pg.evaluate(()=>ROUTE==="site"&&SITE==="tv"),"browser Back from the national map returns to Teachers Village");
  // wording profile + units + language rules on Berkeley
  await pg.goto(U+'#tv');await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(300);
  await pg.selectOption('#p-lang','fil');await pg.waitForTimeout(100);
  await pg.click('#public .site-tabs [data-site="berkeley"]');await pg.waitForTimeout(300);
  await pg.evaluate(()=>{playing=false;for(const s of HOUSEHOLD){s.depth=0;s.rate=0;s.status="ok";}HOUSEHOLD[3].depth=0.40;HOUSEHOLD[3].status=statusOf(HOUSEHOLD[3]);computeFlood(0);renderFlood();drawMap();renderPublic();});
  s=await pg.evaluate(()=>({lang:LANG,menu:getComputedStyle(document.getElementById('p-lang')).display,
     head:document.getElementById('p-headline').textContent,row:document.querySelector('#p-all .p-row .r-pass').textContent,
     cap:document.getElementById('p-fig-cap').textContent,foot:document.getElementById('p-emerg').textContent,
     myh:document.getElementById('p-my-h').textContent,noahChips:getComputedStyle(document.querySelector('.noah-chips')).display}));
  assert(s.lang==="en"&&s.menu==="none","Berkeley forces English and hides the language menu");
  assert(/1 path closed/.test(s.head),"path headline: "+s.head);
  assert(/Path closed/.test(s.row),"path row wording: "+s.row);
  assert(/16 in · 40 cm/.test(s.cap)&&/do not drive/.test(s.cap),"imperial-first caption with car verdict: "+s.cap);
  assert(/UCPD/.test(s.foot),"Berkeley emergency line");
  assert(s.myh==="My path","'My path' heading");
  assert(s.noahChips==="none","no hazard chips on a site without a layer");
  s=await pg.evaluate(()=>({lg:getComputedStyle(document.querySelector('.noah-lg')).display,nh:getComputedStyle(document.getElementById('f-nh-wrap')).display}));
  assert(s.lg==="none"&&s.nh==="none","legend hazard bands and per-unit NOAH class hidden too");
  await pg.click('#public .site-tabs [data-site="tv"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({lang:LANG,menu:getComputedStyle(document.getElementById('p-lang')).display}));
  assert(s.lang==="fil"&&s.menu!=="none","Teachers Village restores Filipino and shows the menu");
  // ---- final-review fix pass ----
  // picker left open across a switch
  await pg.goto(U+'#tv');await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(300);
  await pg.click('#p-my-btn');await pg.waitForTimeout(100);
  await pg.click('#public .site-tabs [data-site="berkeley"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({disp:document.getElementById('p-pick').style.display,n:document.querySelectorAll('#p-pick button').length,pm:pickMode}));
  assert(s.disp==="none"&&s.n===0&&s.pm===false,"street picker closes and empties on switch");
  // story ended, then switch: the new site must play
  await pg.evaluate(()=>{tMin=T_END-1;step(0,true);step(2000,true);});
  s=await pg.evaluate(()=>playing);
  assert(s===false,"precondition: story ended pauses playback");
  await pg.click('#public .site-tabs [data-site="tv"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({playing,t:tMin}));
  assert(s.playing===true&&s.t<60,"switch after the story ended restarts playback");
  // screen-reader map description names the site and profile
  await pg.click('#public .site-tabs [data-site="berkeley"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>document.getElementById('map-desc').textContent);
  assert(/UC Berkeley/.test(s)&&!/Teachers Village/.test(s)&&/path/.test(s),"map description is per site: "+s.slice(0,80));
  // Berkeley details chrome: no Philippine time zone or MMDA wording
  await pg.evaluate(()=>{setView("details");playing=false;scenario="typhoon";tMin=495;lastEmit=-999;step(0,true);});   // atmospheric-river peak: alerts on
  s=await pg.evaluate(()=>({cd:document.getElementById('clock-date').textContent,bn:document.getElementById('banner-text').textContent,api:JSON.stringify(SyntheticSensorAPI.latest(HOUSEHOLD[0].id,60).ts)}));
  assert(!/PHT/.test(s.cd)&&/PT/.test(s.cd),"clock label uses the site's time zone: "+s.cd);
  assert(s.bn.length>20&&!/MMDA/.test(s.bn),"banner is shown without MMDA wording on a path site: "+s.bn);
  assert(/-07:00/.test(s.api),"API timestamps carry the site's UTC offset: "+s.api);
  // storm-response reference: the median of the units' ground heights on every site (spec §6.4; the fixed 56 m is gone)
  await pg.goto(U+'#tv');await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>{const g=HOUSEHOLD.map(h=>h.gElev).sort((a,b)=>a-b);return {ref:HOUSEHOLD[0].gRef,med:g[Math.floor(g.length/2)]};});
  assert(s.ref===s.med,"Teachers Village gRef is its units' median ground height: "+JSON.stringify(s));
  // a fresh load of a campus must not overwrite that campus's stored language with Teachers Village's
  await pg.evaluate(()=>{localStorage.setItem("bw-lang:tv","fil");localStorage.setItem("bw-lang:upd","ceb");});
  await pg.goto(U+'#upd');await pg.reload();await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(400);   // a real document load, not a hash change
  s=await pg.evaluate(()=>({lang:LANG,stored:localStorage.getItem("bw-lang:upd")}));
  assert(s.lang==="ceb"&&s.stored==="ceb","fresh load keeps the campus's own language: "+JSON.stringify(s));
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
