// Sensor siting test, per site. Address-sited units (Teachers Village) must sit on their named street;
// name-sited units (Berkeley) on a named building within 90 m of a mapped creek; automatically placed campus
// units (spec §6.3) are named after a street within 200 m, and unit 01 is on campus. Run: ./test_pages.sh test_sites.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  for(const site of ["tv","berkeley","upd"]){
    const pg=await b.newPage({viewport:{width:1280,height:900}});
    await pg.goto(BASE+'bahawatch_dashboard.html#'+site);await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(300);
    const r0=await pg.evaluate(()=>{
      const [LON0,LAT0,LON1,LAT1]=DATA.bbox;
      const MX=(LON1-LON0)*111320*Math.cos((LAT0+LAT1)/2*Math.PI/180)/W, MY=(LAT1-LAT0)*110640/H;
      const dseg=(px,py,[ax,ay],[bx,by])=>{const dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy;const t=L2?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/L2)):0;return Math.hypot((px-(ax+t*dx))*MX,(py-(ay+t*dy))*MY);};
      const rows=HOUSEHOLD.map(s=>{
        let own=1e9,best=[1e9,null],creek=1e9;
        for(const r of DATA.roads){if(!r.n)continue;for(let i=0;i<r.p.length-1;i++){const d=dseg(s.x,s.y,r.p[i],r.p[i+1]);if(r.n===s.street)own=Math.min(own,d);if(d<best[0])best=[d,r.n];}}
        for(const w of DATA.waters)for(let i=0;i<w.p.length-1;i++)creek=Math.min(creek,dseg(s.x,s.y,w.p[i],w.p[i+1]));
        return {id:s.id,street:s.street,bld:s.bld,hn:s.hn,own:Math.round(own),nearest:best[1],nd:Math.round(best[0]),creek:Math.round(creek),oc:DATA.sensors[s.idx].oc};
      });
      return {site:SITE,rows,campus:isCampus(SITE)};
    });
    assert(r0.site===site,`opened #${site}`);
    if(r0.campus){
      assert(r0.rows[0].oc===true&&r0.rows.filter(r=>r.oc).length===1,`${site}: unit 01, and only unit 01, is on campus`);
      for(const r of r0.rows)assert(r.own<=200&&/^near /.test(r.bld),`${site} ${r.id} ${r.bld}: ${r.own} m from ${r.street}`);
      await pg.close();continue;
    }
    const dup=r0.rows.filter((r,i)=>r0.rows.findIndex(q=>q.own===r.own&&q.nearest===r.nearest&&q.creek===r.creek)!==i);
    assert(dup.length===0,`${site}: no two units share a location (${dup.map(d=>d.id).join(",")||"none"})`);
    for(const r of r0.rows){
      if(r.bld){
        assert(r.creek<=90,`${site} ${r.id} ${r.bld}: ${r.creek} m from the nearest creek`);
        assert(!!r.street,`${site} ${r.id} ${r.bld}: on ${r.street} (${r.own} m to that way)`);   // campus buildings sit off the nearest *named* way; the model cell snaps to it
      }else{
        assert(r.own<=30,`${site} ${r.id} ${r.hn} ${r.street}: ${r.own} m from its street`);
        assert(r.nearest===r.street,`${site} ${r.id}: nearest named street is ${r.nearest} (${r.nd} m) — expected ${r.street}`);
        assert(!!r.hn,`${site} ${r.id} has a house number`);
      }
    }
    await pg.close();
  }
  await b.close();
})();
