const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(BASE+'bahawatch_dashboard.html#tv');await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(400);
  await pg.evaluate(()=>Promise.all(["berkeley","upd"].map(loadSiteData)));     // site files arrive on demand
  const r=await pg.evaluate(()=>{
    const before={site:SITE,units:HOUSEHOLD.length,gw:GW,gh:GH,n:N};
    initSite("berkeley");
    const mid={site:SITE,units:HOUSEHOLD.length,gw:GW,gh:GH,n:N,eMin:eMinD,eMax:eMaxD,scen:Object.values(SCEN).map(s=>s.label).join("|"),profile:SITE_CFG.profile,hazard:SITE_CFG.hazard,depthLen:depth.length};
    initSite("tv");
    const after={site:SITE,units:HOUSEHOLD.length,gw:GW,gh:GH,n:N};
    return {before,mid,after,keys:Object.keys(DATA_ALL)};
  });
  assert(r.keys.sort().join()==="berkeley,tv,upd","only the sites opened so far are loaded: "+r.keys);
  assert(r.before.site==="tv"&&r.before.units===8,"boots on Teachers Village with 8 units");
  assert(r.mid.site==="berkeley"&&r.mid.units===9&&r.mid.gw===240&&r.mid.gh===180&&r.mid.n===43200,"initSite(berkeley) swaps grid and units");
  assert(r.mid.depthLen===43200,"model buffers resized to the new grid");
  assert(r.mid.eMin>45&&r.mid.eMax>300,"elevation range is Berkeley's");
  assert(r.mid.scen==="Dry day|Winter storm|Atmospheric river","scenario labels come from the site");
  assert(r.mid.profile==="path"&&r.mid.hazard===false,"site config exposed");
  assert(r.after.site==="tv"&&r.after.units===8&&r.after.n===35400,"initSite(tv) restores");
  const nd=await pg.evaluate(()=>{try{initSite("uplb");return "no error";}catch(e){return e.message;}});
  assert(nd!=="no error","initSite needs the site's data file first (it isn't fetched here)");
  const sw=await pg.evaluate(()=>{
    switchSite("tv");                                 // block 1 left bare initSite() state (no cards); resync the page
    selectSensor(HOUSEHOLD[1]);                       // a highlighted street on tv
    switchSite("upd");
    const a={sel:selected,hl:selectedStreetWays().length,place:document.getElementById("p-place").textContent,
      rows:document.querySelectorAll("#p-all .p-row").length,cards:document.querySelectorAll("#house-cards .house-card").length,
      scen:[...document.querySelectorAll(".scenarios button")].map(b=>b.textContent).join("|"),t:tMin,z:ZOOM.z>=1&&isFinite(ZOOM.cx)&&isFinite(ZOOM.cy)};   // Diliman's units span the frame, so the fit clamps at z=1
    switchSite("berkeley");
    const b2={rows:document.querySelectorAll("#p-all .p-row").length,scen:[...document.querySelectorAll(".scenarios button")].map(b=>b.textContent).join("|"),cap:document.getElementById("p-fig-cap").textContent};
    switchSite("tv");
    return {a,b2,back:HOUSEHOLD.length};
  });
  assert(sw.a.sel===null&&sw.a.hl===0,"switching clears selection and highlight");
  assert(/University of the Philippines Diliman/.test(sw.a.place)&&sw.a.rows===8&&sw.a.cards===8,"UP Diliman campus: place line, 8 rows, 8 cards: "+sw.a.place);
  assert(sw.a.scen==="Dry day|Habagat rain|Typhoon"&&sw.a.t===0&&sw.a.z,"clock reset, scenarios relabelled, map fitted");
  assert(sw.b2.rows===9&&sw.b2.scen==="Dry day|Winter storm|Atmospheric river","Berkeley: 9 rows, storm names");
  assert(/Oxford Hall|Creekside|Chavez|Anthony|Faculty|Chou|Stebbins/.test(sw.b2.cap),"Berkeley caption names a campus building: "+sw.b2.cap);
  assert(sw.back===8,"back to Teachers Village");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
