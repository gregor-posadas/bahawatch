// One map from the whole country to the street: the detailed map sits under the flood map and follows its camera;
// zooming out past the simulated box keeps going on the same map, the sensors fade out (and back in), other campuses
// show as pins. Run: ./test_pages.sh test_zoomout.js   (the no-WebGL handover is test_zoomout_fallback.js)
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const up=pg=>pg.waitForFunction(()=>document.body.dataset.ready&&document.body.dataset.ready!=="",null,{timeout:15000}).then(()=>pg.waitForTimeout(300));
const glUp=pg=>pg.waitForFunction(()=>SITEGL.state==="on"||SITEGL.state==="off",null,{timeout:20000}).then(()=>pg.waitForTimeout(300));
const idle=pg=>pg.waitForFunction(()=>!zoomAnim,null,{timeout:8000}).then(()=>pg.waitForTimeout(200));
async function wheel(pg,n,dy){
  const r=await pg.evaluate(()=>{const o=document.getElementById('overlay');o.scrollIntoView({block:"center"});const b=o.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};});
  await pg.mouse.move(r.x,r.y);
  for(let i=0;i<n;i++){await pg.mouse.wheel(0,dy);await pg.waitForTimeout(40);}
  await pg.waitForTimeout(250);
}
// the detailed map and the flood canvas agree: the box's corners land on the same pixels
const aligned=pg=>pg.evaluate(()=>{const b=DATA.bbox,m=SITEGL.map,nw=m.project([b[0],b[3]]),se=m.project([b[2],b[1]]);
  const Y=y=>view.h/2+(y-view.h/2)*GL_K;   // the canvas is stretched by GL_K about the centre line
  return Math.max(Math.abs(nw.x-view.ox),Math.abs(nw.y-Y(view.oy)),Math.abs(se.x-(view.ox+W*view.sc)),Math.abs(se.y-Y(view.oy+H*view.sc)));});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(()=>{try{for(const k of ["tv","upd","berkeley","bsu"])localStorage.setItem("bw-asked:"+k,"1");}catch(e){}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U+'#tv');await up(pg);await glUp(pg);
  let s=await pg.evaluate(()=>({st:SITEGL.state,gl:document.getElementById('map-wrap').classList.contains('gl'),btn:document.getElementById('to-country').textContent,
    z:ZOOM.z,fade:siteFade(),markers:mapDrawn.statusMarkers}));
  assert(s.st==="on"&&s.gl,"Teachers Village: the detailed map is under the flood map");
  assert(s.btn==="Whole country"&&s.z>=1&&s.fade===1&&s.markers===8,"it opens on the neighbourhood with all 8 sensors, and a 'Whole country' button: "+JSON.stringify(s));
  let d=await aligned(pg);assert(d<2,`the two maps line up (box corners within ${d.toFixed(2)} px)`);
  // the weather, chosen on the campus page itself (no trip to Details): the same scenarios, kept in step with Details
  await pg.click('.p-scen [data-sc="typhoon"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({sc:scenario,chip:document.getElementById('p-ans-demo').textContent,lbl:document.getElementById('p-scen-l').textContent,
    btns:[...document.querySelectorAll('.p-scen button')].map(b=>b.textContent),det:document.querySelector('.scenarios .active').dataset.sc,
    tall:[...document.querySelectorAll('.p-scen button')].every(b=>b.getBoundingClientRect().height>=48)}));
  assert(s.sc==="typhoon"&&s.chip==="Demo · simulated typhoon"&&s.det==="typhoon"&&s.lbl==="Simulated weather"&&s.btns.join("|")==="Dry day|Habagat rain|Typhoon"&&s.tall,
    "the campus page picks the weather itself (Dry day, Habagat rain, Typhoon); the chip and Details follow: "+JSON.stringify(s));
  // wheel out: no hand-over, the same map keeps zooming; the sensors fade, other campuses appear as pins
  await wheel(pg,8,200);
  s=await pg.evaluate(()=>({z:ZOOM.z,fade:siteFade(),over:!document.getElementById('country').hidden,out:siteZoomedOut,btn:document.getElementById('to-country').textContent}));
  assert(s.z<1&&!s.over&&!s.out,"wheeling out past the box keeps the same map (no separate country view): z "+s.z.toFixed(3));
  assert(s.btn==="Back to the flood map","zoomed out, the button offers 'Back to the flood map'");
  d=await aligned(pg);assert(d<2,`still lined up when zoomed out (${d.toFixed(2)} px)`);
  await wheel(pg,20,200);
  s=await pg.evaluate(()=>({z:ZOOM.z,fade:siteFade(),markers:mapDrawn.statusMarkers,pins:document.querySelectorAll('#site-pins > *').length,glz:SITEGL.map.getZoom()}));
  assert(s.fade===0&&s.markers===0,"far out, the sensors have faded away: "+JSON.stringify(s));
  assert(s.pins>0&&s.glz<9,"other PhilDev campuses show as pins on the zoomed-out map (z"+s.glz.toFixed(1)+")");
  // back in with the wheel: the sensors fade back in
  await wheel(pg,28,-200);
  s=await pg.evaluate(()=>({z:ZOOM.z,fade:siteFade(),markers:mapDrawn.statusMarkers,pins:document.querySelectorAll('#site-pins > *').length}));
  assert(s.fade===1&&s.markers===8&&s.pins===0,"zooming back in brings the 8 sensors back and clears the pins: "+JSON.stringify(s));
  // the button: the whole country, then back to the flood map, both animated
  await pg.click('#to-country');await idle(pg);
  s=await pg.evaluate(()=>({z:ZOOM.z,floor:zoomFloor(),glz:SITEGL.map.getZoom(),btn:document.getElementById('to-country').textContent}));
  assert(Math.abs(s.z-s.floor)<1e-9&&s.glz<7&&s.btn==="Back to the flood map","'Whole country' zooms out to the whole Philippines: z"+s.glz.toFixed(2));
  await pg.click('#to-country');await idle(pg);
  s=await pg.evaluate(()=>({z:ZOOM.z,fade:siteFade(),btn:document.getElementById('to-country').textContent,markers:mapDrawn.statusMarkers}));
  assert(s.z>=1&&s.fade===1&&s.markers===8&&s.btn==="Whole country","'Back to the flood map' returns to the neighbourhood");
  // theme: the detailed map restyles
  await pg.click('#p-theme');await pg.waitForTimeout(400);
  assert(await pg.evaluate(()=>SITEGL.theme==="dark"),"a theme switch restyles the detailed map");
  await pg.click('#p-theme');
  // leaving a zoomed-out site: the next site opens on its own neighbourhood
  await wheel(pg,20,200);
  await pg.goto(U+'#upd');await up(pg);await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>({z:ZOOM.z,fade:siteFade()}));
  assert(s.z>=1&&s.fade===1,"another site opens on its own box, not zoomed out");
  d=await aligned(pg);assert(d<2,`UP Diliman: the maps line up (${d.toFixed(2)} px)`);
  // Berkeley: the world style, no PhilDev pins
  await pg.goto(U+'#berkeley');await up(pg);await pg.waitForTimeout(1200);
  s=await pg.evaluate(()=>({gl:document.getElementById('map-wrap').classList.contains('gl'),on:glOn(),pins:document.querySelectorAll('#site-pins > *').length,markers:mapDrawn.statusMarkers,n:HOUSEHOLD.length}));
  assert(!s.gl&&!s.on&&s.pins===0&&s.markers===s.n,"UC Berkeley (outside our tiles): the flood map draws its own base, never a blank map: "+JSON.stringify(s));
  // Try reporting: no zooming out to the country
  await pg.goto(U+'#try');await up(pg);await pg.waitForTimeout(300);
  assert(await pg.evaluate(()=>document.getElementById('to-country').hidden&&document.querySelectorAll('#site-pins > *').length===0),"Try reporting: no 'Whole country', no campus pins");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
