// A page that loads while it is not on screen (a background tab, a tab restored after the laptop wakes) draws no frames,
// so the detailed maps ask for no tiles. They must wait, not give up after 8 s and say "can't be shown on this device"
// for every map until a reload (Gregor, 2026-09-28). Run: ./test_pages.sh test_hidden.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
// hidden until window.__show(): visibilityState "hidden" and no animation frames, as Chrome does for a background tab
const HIDE=()=>{
  let hidden=true;const held=[];const raf=window.requestAnimationFrame.bind(window);
  Object.defineProperty(Document.prototype,'visibilityState',{get(){return hidden?'hidden':'visible';},configurable:true});
  Object.defineProperty(Document.prototype,'hidden',{get(){return hidden;},configurable:true});
  window.requestAnimationFrame=cb=>{if(hidden){held.push(cb);return held.length;}return raf(cb);};
  window.__show=()=>{hidden=false;document.dispatchEvent(new Event('visibilitychange'));held.splice(0).forEach(cb=>raf(cb));};
};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(()=>{try{localStorage.setItem("bw-asked:tv","1");}catch(e){}});
  await ctx.addInitScript(HIDE);
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  // a campus page loaded in the background
  await pg.goto(U+'#tv');
  await pg.waitForTimeout(11000);   // longer than the 8 s limit plus the 0.8 s start delay
  let s=await pg.evaluate(()=>({st:SITEGL.state,note:document.getElementById('country-note').hidden}));
  assert(s.st==="loading","hidden for 11 s, the campus page's detailed map is still waiting, not given up: "+JSON.stringify(s));
  await pg.evaluate(()=>window.__show());
  await pg.waitForFunction(()=>SITEGL.state!=="loading",null,{timeout:15000}).catch(()=>{});
  s=await pg.evaluate(()=>({st:SITEGL.state,gl:document.getElementById('map-wrap').classList.contains('gl')}));
  assert(s.st==="on"&&s.gl,"back on screen, the detailed map opens: "+JSON.stringify(s));
  // the PhilDev map loaded in the background
  const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push(e.message));
  await pg2.goto(U+'#ph');
  await pg2.waitForTimeout(11000);
  s=await pg2.evaluate(()=>({st:NATGL.state,note:document.getElementById('nat-note').hidden}));
  assert(s.st!=="off"&&s.note,"hidden for 11 s, the PhilDev map has not given up (no 'can't be shown' note): "+JSON.stringify(s));
  await pg2.evaluate(()=>window.__show());
  await pg2.waitForFunction(()=>NATGL.state==="on"||NATGL.state==="off",null,{timeout:15000}).catch(()=>{});
  s=await pg2.evaluate(()=>({st:NATGL.state,note:document.getElementById('nat-note').hidden}));
  assert(s.st==="on"&&s.note,"back on screen, the PhilDev map opens: "+JSON.stringify(s));
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
