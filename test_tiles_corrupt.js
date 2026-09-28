// A stale or zero-filled piece of a tile file (Chrome's cache after a redeploy, seen in Gregor's Chrome 2026-09-28:
// "Wrong magic number for PMTiles archive") must not take the maps down: a bad piece is fetched again past the cache,
// and an archive that stays bad costs only its own streets and buildings. Run: ./test_pages.sh test_tiles_corrupt.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
// answer a range request for `file` with zeros of the right length (what the broken cache served)
async function zeros(route){
  const r=route.request().headers().range||"bytes=0-16383",m=/bytes=(\d+)-(\d+)/.exec(r),a=+m[1],b=+m[2];
  const real=await route.fetch();const total=(real.headers()['content-range']||'/0').split('/')[1];
  await route.fulfill({status:206,headers:{'content-type':'application/octet-stream','content-range':`bytes ${a}-${b}/${total}`},body:Buffer.alloc(b-a+1)});
}
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(()=>{try{for(const k of ["tv","upd"])localStorage.setItem("bw-asked:"+k,"1");}catch(e){}});
  await ctx.addInitScript(()=>{window.BW_BASEMAP_STYLE='shared/basemap-style.json?real';});   // our real style and tiles, not the offline fixture
  const errs=[];
  // 1. Teachers Village's archive answers zeros once (a bad cached piece), then the real bytes
  let pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  let bad=1,hits=0;
  await pg.route(/site-tv\.pmtiles/,async route=>{hits++;if(bad-->0)return zeros(route);return route.continue();});
  await pg.goto(U+'#tv');
  await pg.waitForFunction(()=>SITEGL.state==="on"||SITEGL.state==="off",null,{timeout:20000}).catch(()=>{});
  await pg.waitForTimeout(1500);
  let s=await pg.evaluate(()=>({st:SITEGL.state,bld:SITEGL.map?SITEGL.map.querySourceFeatures('site-tv',{sourceLayer:'buildings'}).length:0}));
  assert(s.st==="on"&&hits>=2,"a zero-filled piece is fetched again and the detailed map opens: "+JSON.stringify({...s,hits}));
  assert(s.bld>0,"Teachers Village's buildings draw from the re-fetched archive ("+s.bld+" features)");
  await pg.close();
  // 2. UP Diliman's archive stays bad: every other map is unaffected
  pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/site-upd\.pmtiles/,zeros);
  await pg.goto(U);
  await pg.waitForFunction(()=>NATGL.state==="on"||NATGL.state==="off",null,{timeout:20000}).catch(()=>{});
  s=await pg.evaluate(()=>({st:NATGL.state,note:document.getElementById('nat-note').hidden}));
  assert(s.st==="on"&&s.note,"one archive that stays bad: the PhilDev map still opens, no 'can't be shown' note: "+JSON.stringify(s));
  await pg.goto(U+'#tv');
  await pg.waitForFunction(()=>SITEGL.state==="on"||SITEGL.state==="off",null,{timeout:20000}).catch(()=>{});
  s=await pg.evaluate(()=>({st:SITEGL.state}));
  assert(s.st==="on","and Teachers Village's detailed map opens too: "+JSON.stringify(s));
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
