// Buildings and sea on the page (spec §6.1–6.2, §7.2): the fill never wets a blocked or sea cell, the flooded-building
// count uses every footprint, and the footnote names the terrain. Run: ./test_pages.sh test_obstacles.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  for(const site of ["upd","tv"]){
    await pg.goto(BASE+'bahawatch_dashboard.html#'+site+'/details');await pg.waitForFunction(x=>document.body.dataset.ready===x,site);
    const s=await pg.evaluate(()=>{
      playing=false;scenario="typhoon";let most=null;
      for(let t=300;t<=700;t+=20){tMin=t;lastEmit=-999;step(0,true);let w=0;for(let i=0;i<N;i++)if(depth[i]>0.05)w++;if(!most||w>most.w)most={t,w};}
      tMin=most.t;lastEmit=-999;step(0,true);
      let wetBlocked=0,wetSea=0,bc=0;
      for(let i=0;i<N;i++){if(depth[i]>0){if(BLOCK&&BLOCK[i])wetBlocked++;if(SEA&&SEA[i])wetSea++;}if(BC&&BC[i]&&depth[i]>0.05)bc+=BC[i];}
      return {wet:most.w,wetBlocked,wetSea,bc,shown:+document.getElementById("st-houses").textContent.replace(/,/g,""),
        blocked:BLOCK?BLOCK.reduce((a,v)=>a+v,0):0,terrain:document.getElementById("foot-terrain").textContent,blk:!document.getElementById("foot-block").hidden,
        nb:document.getElementById("foot-nb").textContent,limits:!document.getElementById("foot-limits").hidden};
    });
    assert(s.wet>0&&s.blocked>0,`${site}: the storm peak floods cells (${s.wet}) and the site has blocked cells (${s.blocked})`);
    assert(s.wetBlocked===0&&s.wetSea===0,`${site}: no water in blocked or sea cells (${s.wetBlocked}, ${s.wetSea})`);
    assert(s.shown===s.bc,`${site}: 'buildings in flooded cells' counts footprints per cell: ${s.shown} vs ${s.bc}`);
    assert(/FABDEM/.test(s.terrain)&&s.blk&&s.limits&&/^\d/.test(s.nb),`${site}: footnote names FABDEM, its limits, the 75% rule and the footprint count: ${s.terrain} · ${s.nb}`);
  }
  await pg.goto(BASE+'bahawatch_dashboard.html#berkeley/details');await pg.waitForFunction(()=>document.body.dataset.ready==="berkeley");
  const s=await pg.evaluate(()=>({t:document.getElementById("foot-terrain").textContent,blk:document.getElementById("foot-block").hidden,lim:document.getElementById("foot-limits").hidden,block:BLOCK,sea:SEA}));
  assert(/USGS/.test(s.t)&&s.blk&&s.lim&&s.block===null&&s.sea===null,"Berkeley: USGS terrain, no obstacle grids, no 75% clause, no FABDEM caveat");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
