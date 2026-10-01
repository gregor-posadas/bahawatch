// Routing and on-demand site files (spec §3.1–3.3, §7.3): plain link → national map, one file per site, the latest
// choice wins, a failed file shows a retry, old Diliman links and home-screen relaunches land on the campus.
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>x?document.body.dataset.ready===x:!!document.body.dataset.ready,v,{timeout:15000});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const files=[];pg.on('request',r=>{const m=r.url().match(/\/data\/(\w+)\.json/);if(m)files.push(m[1]);});
  await pg.goto(U+'#ph');await ready(pg,"ph");
  let s=await pg.evaluate(()=>({route:ROUTE,hash:location.hash,nat:getComputedStyle(document.getElementById('nat')).display,pub:getComputedStyle(document.getElementById('public')).display,booted:siteBooted}));
  assert(s.route==="ph"&&s.hash==="#ph"&&s.nat!=="none"&&s.pub==="none"&&!s.booted,"#ph opens the national map and loads no site");
  assert(files.length===0,"no site file fetched for the national map: "+files);
  await pg.evaluate(()=>{location.hash="#tv";});await ready(pg,"tv");
  s=await pg.evaluate(()=>({route:ROUTE,site:SITE,loaded:Object.keys(DATA_ALL)}));
  assert(s.route==="site"&&s.site==="tv"&&s.loaded.join()==="tv"&&files.join()==="tv","#tv fetches data/tv.json only: "+files);
  await pg.evaluate(()=>{location.hash="#ph";});await ready(pg,"ph");
  await pg.evaluate(()=>{location.hash="#tv";});await ready(pg,"tv");
  assert(files.join()==="tv","going back to a site does not fetch its file again: "+files);
  await pg.goBack();await ready(pg,"ph");await pg.goBack();await ready(pg,"tv");
  assert(await pg.evaluate(()=>ROUTE==="site"&&SITE==="tv"),"browser Back and Forward move between the national map and the site");

  // latest choice wins: UP Diliman is slow, then UC Berkeley is chosen; Diliman's late file must not take over
  const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push(e.message));
  let release;const held=new Promise(r=>{release=r;});
  await pg2.route('**/data/upd.json',async r=>{await held;r.continue();});
  await pg2.goto(U+'#ph');await ready(pg2,"ph");
  await pg2.evaluate(()=>{location.hash="#upd";});await pg2.waitForTimeout(150);
  s=await pg2.evaluate(()=>({route:ROUTE,msg:document.getElementById('load-msg').textContent,shown:getComputedStyle(document.getElementById('route-loading')).display}));
  assert(s.route==="loading"&&/Loading UP Diliman/.test(s.msg)&&s.shown!=="none","a slow file shows 'Loading UP Diliman…': "+s.msg);
  await pg2.evaluate(()=>{location.hash="#berkeley";});await ready(pg2,"berkeley");
  release();await pg2.waitForTimeout(600);
  s=await pg2.evaluate(()=>({site:SITE,hash:location.hash,ready:document.body.dataset.ready}));
  assert(s.site==="berkeley"&&s.hash==="#berkeley"&&s.ready==="berkeley","latest choice wins: Berkeley stays after Diliman's late file: "+JSON.stringify(s));

  // a file that fails: message, focus on Try again, retry loads it
  const pg3=await ctx.newPage();pg3.on('pageerror',e=>errs.push(e.message));
  let fail=true;await pg3.route('**/data/upd.json',r=>fail?r.abort():r.continue());
  await pg3.goto(U+'#upd');await ready(pg3,"fail");
  s=await pg3.evaluate(()=>({route:ROUTE,msg:document.getElementById('fail-msg').textContent,focus:document.activeElement.id,btn:document.getElementById('load-retry').textContent,back:document.getElementById('fail-back').getAttribute('href')}));
  assert(s.route==="fail"&&/UP Diliman didn.t load/.test(s.msg)&&s.focus==="load-retry"&&s.btn==="Try again"&&s.back==="#ph","a failed file: message, 'Try again' focused, a way back to all campuses: "+s.msg);
  fail=false;await pg3.click('#load-retry');await ready(pg3,"upd");
  assert(await pg3.evaluate(()=>ROUTE==="site"&&SITE==="upd"),"Try again loads the campus once the file arrives");

  // old UP Diliman links and a home-screen relaunch that saved #diliman
  const pg4=await ctx.newPage();pg4.on('pageerror',e=>errs.push(e.message));
  await pg4.goto(U+'#diliman');await ready(pg4,"upd");
  assert(await pg4.evaluate(()=>SITE==="upd"&&location.hash==="#upd"),"#diliman opens the UP Diliman campus and rewrites the link to #upd");
  const code=await pg4.evaluate(()=>PLACES.sites.upd.find(p=>p.kind==="barangay").id.split(":")[2]);
  const pg5=await ctx.newPage();pg5.on('pageerror',e=>errs.push(e.message));             // share links open in a fresh tab
  await pg5.goto(U+'#p.diliman.b.'+code);await ready(pg5,"upd");
  s=await pg5.evaluate(()=>({site:SITE,place:myPlace}));
  assert(s.site==="upd"&&s.place==="upd:b:"+code,"an old #p.diliman.b.<pcode> share link opens that barangay on the campus: "+JSON.stringify(s));
  await pg4.evaluate(()=>localStorage.setItem("bw-last-hash","#diliman"));
  await pg4.goto(U+'?source=pwa');await ready(pg4,"upd");
  assert(await pg4.evaluate(()=>SITE==="upd"&&ROUTE==="site"),"home-screen relaunch with a saved #diliman lands on the campus");
  await pg4.evaluate(()=>localStorage.setItem("bw-last-hash","#ph"));
  await pg4.goto(U+'?source=pwa');await ready(pg4,"ph");
  assert(await pg4.evaluate(()=>ROUTE==="ph"),"home-screen relaunch after the national map returns to the national map");
  await pg4.evaluate(()=>localStorage.setItem("bw-last-hash",""));
  await pg4.goto(U+'?source=pwa');await ready(pg4,"home");
  assert(await pg4.evaluate(()=>ROUTE==="home"),"home-screen relaunch after the homepage returns to the homepage");

  // Try reporting from a campus page, before Teachers Village's file is loaded: no half-switched frame
  const pg6=await ctx.newPage();pg6.on('pageerror',e=>errs.push(e.message));
  await pg6.route('**/data/tv.json',async r=>{await new Promise(z=>setTimeout(z,400));r.continue();});
  await pg6.goto(U+'#upd');await ready(pg6,"upd");
  await pg6.click('#public .site-tabs [data-site="try"]');await pg6.waitForTimeout(150);
  s=await pg6.evaluate(()=>({route:ROUTE,t:TRY,site:SITE}));
  assert(s.route==="loading"&&!s.t&&s.site==="upd","while Teachers Village loads, the page is not yet in the Try tab: "+JSON.stringify(s));
  await ready(pg6,"tv");await pg6.waitForTimeout(200);
  assert(await pg6.evaluate(()=>TRY&&SITE==="tv"&&location.hash==="#try"),"then the Try tab opens on Teachers Village");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
