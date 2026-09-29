// How the flood is drawn (2026-09-29, Gregor): smooth shorelines where the water surface meets the terrain, water cut
// around the building footprints that touch it, depth shaded with a faded shallow margin; and fast enough for a demo
// (the outline read once took 12 s). The drawing must never show more water than the model. Run: ./test_pages.sh test_flood_look.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const up=pg=>pg.waitForFunction(()=>document.body.dataset.ready,null,{timeout:15000});
// a typhoon at its peak, paused, so the drawing holds still
const storm=pg=>pg.evaluate(()=>{document.querySelector('.p-scen [data-sc="typhoon"]').click();setPlay(false);
  let best=0,bt=0;for(let t=0;t<=T_END;t+=60){tMin=t;emitReadings();computeFlood(t);let n=0;for(let i=0;i<N;i++)if(depth[i]>0.03)n++;if(n>best){best=n;bt=t;}}
  tMin=bt;rebuildHistory();lastEmit=-999;step(0,true);return best;});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const mk=async o=>{const c=await b.newContext({viewport:{width:1280,height:900},...o});
    await c.addInitScript(()=>{try{localStorage.setItem("bw-asked:tv","1");}catch(e){}window.BW_BASEMAP_STYLE='shared/basemap-style.json?real';});return c;};
  const ctx=await mk({});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U+'#tv');await up(pg);
  await pg.waitForFunction(()=>SITEGL.state==="on",null,{timeout:20000});
  const wetCells=await storm(pg);
  assert(wetCells>50,"a typhoon peak floods some of Teachers Village ("+wetCells+" cells)");
  // 1. the edge lands where the water surface meets the terrain: across a wet cell and a dry, higher neighbour, the
  //    drawn water fades out near the model's zero crossing, not at the cell boundary halfway between
  let s=await pg.evaluate(()=>{
    const F=shoreField({elev,block:null,sea:SEA,GW,GH},depth,false),c=floodCv.getContext('2d'),k=floodCv.width/GW;
    const a=(gx,gy)=>c.getImageData(Math.floor((gx+0.5)*k),Math.floor((gy+0.5)*k),1,1).data[3];
    let tried=0,good=0;
    for(let i=0;i<N&&tried<40;i++){const x=i%GW,y=(i/GW)|0;if(x>=GW-1||!(depth[i]>0.1)||depth[i+1]>0.03||(BLOCK&&BLOCK[i+1])||(SEA&&SEA[i+1]))continue;
      const t=F[i]/(F[i]-F[i+1]);if(t>0.35&&t<0.65)continue;           // only pairs where the two answers differ
      tried++;let last=0;for(let s=0;s<=20;s++){if(a(x+s/20,y)>0)last=s/20;}   // how far the drawn water reaches
      if(Math.abs(last-t)<0.2)good++;}
    return {tried,good};});
  assert(s.tried>=5&&s.good/s.tried>=0.8,"the drawn shoreline follows the terrain (edge within 0.2 cell of the model's crossing): "+JSON.stringify(s));
  // never more water than the model: a pixel at the centre of a dry, unbuilt cell far from water is clear
  s=await pg.evaluate(()=>{const c=floodCv.getContext('2d'),k=floodCv.width/GW;let bad=0,n=0;
    for(let i=0;i<N;i++){const x=i%GW,y=(i/GW)|0;if(depth[i]>0.03||x<1||y<1||x>=GW-1||y>=GH-1)continue;
      if([i-1,i+1,i-GW,i+GW].some(j=>depth[j]>0.03))continue;n++;if(c.getImageData(Math.floor((x+0.5)*k),Math.floor((y+0.5)*k),1,1).data[3]>0)bad++;}
    return {n,bad};});
  assert(s.n>100&&s.bad===0,"no water drawn on dry ground away from the flood: "+JSON.stringify(s));
  // 3. shaded by depth: the shallow margin is fainter than deep water
  s=await pg.evaluate(()=>{const c=floodCv.getContext('2d'),k=floodCv.width/GW,A=i=>c.getImageData(Math.floor((i%GW+0.5)*k),Math.floor(((i/GW|0)+0.5)*k),1,1).data[3];
    let sh=null,dp=null;for(let i=0;i<N;i++){if(BLOCK&&BLOCK[i])continue;const d=depth[i];if(d>0.035&&d<0.06&&sh===null)sh=A(i);if(d>0.4&&dp===null)dp=A(i);}return {sh,dp};});
  assert(s.sh!==null&&s.dp!==null&&s.sh<s.dp,"the shallowest water is drawn fainter than deep water: "+JSON.stringify(s));
  // 2. cut around buildings: the detailed map's footprints are cleared from the water
  await pg.waitForFunction(()=>FOOT.site===SITE&&FOOT.n>0,null,{timeout:15000}).catch(()=>{});
  s=await pg.evaluate(()=>{const c=floodCv.getContext('2d'),R=floodCv.width/W;let inW=0,clear=0;
    for(const p of FOOT.pts){const i=cellAt(p[0],p[1]);if(!(depth[i]>0.1))continue;inW++;if(c.getImageData(Math.floor(p[0]*R),Math.floor(p[1]*R),1,1).data[3]===0)clear++;if(inW>=60)break;}
    return {n:FOOT.n,inW,clear};});
  assert(s.n>1000&&s.inW>=10&&s.clear/s.inW>=0.9,"water is cut around building footprints (building points in deep water left clear): "+JSON.stringify(s));
  // speed: reading the outlines and redrawing the water stay well under a frame budget's worth of seconds
  s=await pg.evaluate(()=>{const T=f=>{const a=performance.now();f();return performance.now()-a;};
    const foot=T(()=>{FOOT.at=-1e9;FOOT.n=0;footLoad();}),rf=[0,1,2].map(()=>T(renderFlood));return {foot:Math.round(foot),render:Math.round(Math.max(...rf))};});
  assert(s.foot<800&&s.render<120,"reading 42,000 building outlines and redrawing the water are quick (ms): "+JSON.stringify(s));
  assert(await pg.evaluate(()=>typeof drawShimmer==="undefined"),"no shimmer (removed at Gregor's request)");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await ctx.close();
  await b.close();
})();
