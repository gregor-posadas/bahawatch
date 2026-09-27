const {chromium}=require('playwright');
const {execSync}=require('child_process');
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
execSync('BAHAWATCH_API=https://api.test.local TURNSTILE_SITEKEY=1x00000000000000000000AA OUT=/tmp/bw_live_test.html python3 build_html.py',{cwd:'/home/claude/work'});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(()=>{localStorage.setItem("bw-place:tv","tv:s:BW-H01");localStorage.setItem("bw-asked:tv","1");});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const SN=Date.UTC(2026,8,26,9,0);
  const recent={serverNow:SN,reports:[{lat:14.638,lon:121.060,answer:"oo",ageMin:4},{lat:14.642,lon:121.058,answer:"hindi",ageMin:12},{lat:14.644,lon:121.057,answer:"di_sigurado",ageMin:30}]};
  let recentHits=0;
  await pg.route('https://api.test.local/**',r=>{const u=r.request().url();
    if(/\/recent\/tv$/.test(u)){recentHits++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(recent)});}
    if(/\/status\//.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({place:"tv:s:BW-H01",answer:"hindi",reason:{key:"clear",vars:{}},etaMin:null,updatedAt:SN-60000,checkedAt:SN-60000,serverNow:SN,stillThere:null})});
    return r.fulfill({status:404,body:'{}'});});
  // simple live view does not fetch the per-site report list
  await pg.goto('file:///tmp/bw_live_test.html#tv/live');await pg.waitForTimeout(500);
  assert(recentHits===0,"simple view: report list not fetched");
  // details + live: hash kept, list fetched, diamonds drawn, log filled
  await pg.goto('file:///tmp/bw_live_test.html#tv/details/live');await pg.waitForTimeout(700);
  let s=await pg.evaluate(()=>({live:LIVE,view:VIEW,hash:location.hash,drawn:drawnReports,items:[...document.querySelectorAll('#rep-log li')].map(li=>li.textContent),shown:!document.getElementById('rep-log-wrap').hidden}));
  assert(s.live&&s.view==="details"&&s.hash==="#tv/details/live","details + live parsed and kept in the hash: "+s.hash);
  assert(recentHits>=1&&s.drawn===3,"three reports drawn as diamonds: "+s.drawn);
  assert(s.shown&&s.items.length===3&&/4 min ago.*Yes/.test(s.items[0])&&/Not sure/.test(s.items[2]),"report log, newest first, with the answer: "+s.items.join(" | "));
  // a report at a sensor's own coordinate lands on that sensor's map position
  s=await pg.evaluate(()=>{const h=HOUSEHOLD[0],w=lonLatToWorld(h.lon,h.lat);return Math.hypot(w.x-h.x,w.y-h.y);});
  assert(s<1,"lon/lat → map position agrees with the sensors' positions (off by "+s.toFixed(2)+")");
  // an hour with no reports
  recent.reports=[];await pg.evaluate(()=>pollRecent());await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({drawn:drawnReports,t:document.getElementById('rep-log').textContent}));
  assert(s.drawn===0&&/No reports in the last hour/.test(s.t),"empty hour: no diamonds, and the log says so");
  // published demo page: no report log, no diamonds
  const pg2=await ctx.newPage();await pg2.goto('file:///home/claude/work/bahawatch_dashboard.html#tv/details');await pg2.waitForTimeout(400);
  s=await pg2.evaluate(()=>({hidden:document.getElementById('rep-log-wrap').hidden,drawn:drawnReports}));
  assert(s.hidden&&s.drawn===0,"demo page: no report log, no diamonds");
  assert(errs.length===0,"no page errors: "+errs.join("; "));

  // boot into a live details view makes exactly one /recent request before the first interval;
  // toggling simple -> details makes one more (no duplicate fetch from setView()+switchSite() both firing)
  {
    const ctx3=await b.newContext({viewport:{width:1280,height:900}});
    await ctx3.addInitScript(()=>{localStorage.setItem("bw-place:tv","tv:s:BW-H01");localStorage.setItem("bw-asked:tv","1");});
    const pg3=await ctx3.newPage();const errs3=[];pg3.on('pageerror',e=>errs3.push(e.message));
    let hits=0;
    await pg3.route('https://api.test.local/**',r=>{const u=r.request().url();
      if(/\/recent\/tv$/.test(u)){hits++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(recent)});}
      if(/\/status\//.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({place:"tv:s:BW-H01",answer:"hindi",reason:{key:"clear",vars:{}},etaMin:null,updatedAt:SN-60000,checkedAt:SN-60000,serverNow:SN,stillThere:null})});
      return r.fulfill({status:404,body:'{}'});});
    await pg3.goto('file:///tmp/bw_live_test.html#tv/details/live');await pg3.waitForTimeout(400);
    assert(hits===1,"boot into #tv/details/live makes exactly one /recent request: "+hits);
    await pg3.evaluate(()=>setView("public"));await pg3.waitForTimeout(150);
    await pg3.evaluate(()=>setView("details"));await pg3.waitForTimeout(400);
    assert(hits===2,"toggling simple -> details makes one more /recent request: "+hits);
    assert(errs3.length===0,"no page errors (boot dedup test): "+errs3.join("; "));
    await ctx3.close();
  }

  // a /recent/<old site> reply that lands after switching sites must not overwrite the new site's reports
  {
    const ctx4=await b.newContext({viewport:{width:1280,height:900}});
    await ctx4.addInitScript(()=>{localStorage.setItem("bw-place:tv","tv:s:BW-H01");localStorage.setItem("bw-asked:tv","1");});
    const pg4=await ctx4.newPage();const errs4=[];pg4.on('pageerror',e=>errs4.push(e.message));
    const tvRecent={serverNow:SN,reports:[{lat:14.638,lon:121.060,answer:"oo",ageMin:4}]};
    const dilimanRecent={serverNow:SN,reports:[{lat:14.66,lon:121.07,answer:"hindi",ageMin:5}]};
    let holdTvRoute=null;
    await pg4.route('https://api.test.local/**',r=>{const u=r.request().url();
      if(/\/recent\/tv$/.test(u)){holdTvRoute=r;return;}                         // hold this one; released manually below
      if(/\/recent\/diliman$/.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dilimanRecent)});
      if(/\/status\//.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({place:"tv:s:BW-H01",answer:"hindi",reason:{key:"clear",vars:{}},etaMin:null,updatedAt:SN-60000,checkedAt:SN-60000,serverNow:SN,stillThere:null})});
      return r.fulfill({status:404,body:'{}'});});
    await pg4.goto('file:///tmp/bw_live_test.html#tv/details/live');await pg4.waitForTimeout(400);
    assert(holdTvRoute!==null,"setup: the tv /recent request is in flight and held");
    await pg4.evaluate(()=>switchSite("diliman"));await pg4.waitForTimeout(400);
    let s4=await pg4.evaluate(()=>({site:SITE,items:recentReports.map(r=>r.answer)}));
    assert(s4.site==="diliman"&&s4.items.length===1&&s4.items[0]==="hindi","setup: on diliman with diliman's own reports before the stale tv reply lands: "+JSON.stringify(s4));
    await holdTvRoute.fulfill({status:200,contentType:'application/json',body:JSON.stringify(tvRecent)});
    await pg4.waitForTimeout(400);
    s4=await pg4.evaluate(()=>({site:SITE,items:recentReports.map(r=>r.answer),drawn:drawnReports}));
    assert(s4.site==="diliman"&&s4.items.length===1&&s4.items[0]==="hindi","stale tv reply after switching to diliman must not overwrite recentReports: "+JSON.stringify(s4));
    assert(errs4.length===0,"no page errors (stale-reply test): "+errs4.join("; "));
    await ctx4.close();
  }

  await b.close();
})();
