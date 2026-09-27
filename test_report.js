const {chromium}=require('playwright');
const {execSync}=require('child_process');
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
execSync('BAHAWATCH_API=https://api.test.local TURNSTILE_SITEKEY=1x00000000000000000000AA OUT=/tmp/bw_live_test.html python3 build_html.py',{cwd:'/home/claude/work'});
const U='file:///tmp/bw_live_test.html#tv/live';
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:390,height:844}});
  await ctx.addInitScript(()=>{localStorage.setItem("bw-place:tv","tv:s:BW-H01");localStorage.setItem("bw-asked:tv","1");
    window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback("tok-ok"),0);return "w1";},remove(){}};});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const posted=[];let reportStatus=201;let statusBody=null;let statusFail=false;
  await pg.route('https://api.test.local/**',async r=>{
    const u=r.request().url(),m=r.request().method();
    if(m==="POST"&&/\/report$/.test(u)){posted.push(JSON.parse(r.request().postData()));return r.fulfill({status:reportStatus,contentType:'application/json',body:JSON.stringify(reportStatus===201?{id:41}:{error:'already recorded'})});}
    if(m==="POST"&&/\/undo$/.test(u))return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
    if(/\/status\//.test(u)){if(statusFail)return r.abort();return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(statusBody)});}
    return r.fulfill({status:404,body:'{}'});
  });
  const SN=Date.UTC(2026,8,26,9,0);
  statusBody={place:"tv:s:BW-H01",answer:"baka",reason:{key:"rain_flood_zone",vars:{mm:9}},etaMin:null,updatedAt:SN-3*60000,checkedAt:SN-60000,serverNow:SN,stillThere:null};
  await pg.goto(U);await pg.waitForTimeout(600);
  // live answer comes from the Worker; age uses the server clock even if the phone clock is 3 h fast
  await pg.evaluate(()=>{const d=Date.now;Date.now=()=>d()+3*3600000;});
  await pg.evaluate(()=>pollStatus());await pg.waitForTimeout(200);
  let s=await pg.evaluate(()=>({a:document.getElementById('p-answer').dataset.answer,age:document.getElementById('p-ans-age').textContent}));
  assert(s.a==="baka","live mode shows the Worker's answer: "+s.a);
  assert(/3 min/.test(s.age),"age uses the server clock, not the phone's: "+s.age);
  // report row: three buttons, 48 px, question in the current language
  s=await pg.evaluate(()=>({q:document.getElementById('p-rep-q').textContent,btns:[...document.querySelectorAll('#p-rep [data-ans]')].map(b=>[b.dataset.ans,b.getBoundingClientRect().height])}));
  assert(s.btns.map(x=>x[0]).join()==="oo,hindi,di_sigurado"&&s.btns.every(x=>x[1]>=48),"report row: Oo · Hindi · Hindi sigurado, 48 px tall");
  // location denied -> report still sent at the place centre, rounded to 3 decimals
  await pg.evaluate(()=>{navigator.geolocation.getCurrentPosition=(ok,fail)=>fail({code:1});});
  await pg.click('#p-rep [data-ans="oo"]');await pg.waitForTimeout(400);
  const P=await pg.evaluate(()=>currentPlace());
  assert(posted.length===1&&posted[0].lat===Math.round(P.lat*1000)/1000&&posted[0].token==="tok-ok"&&posted[0].demo===false&&/^[a-f0-9]{24}$/.test(posted[0].device),"denied location: report sent at the place centre with bot token and anonymous id");
  s=await pg.evaluate(()=>({t:document.getElementById('p-rep-msg').textContent,undo:!document.getElementById('p-rep-undo').hidden}));
  assert(/Thanks|Salamat/.test(s.t)&&s.undo,"thanks message with Undo");
  await pg.click('#p-rep-undo');await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>document.getElementById('p-rep-undo').hidden);
  assert(s,"Undo sent and hidden");
  // double tap: server 429 shows as recorded, not as an error
  reportStatus=429;
  await pg.click('#p-rep [data-ans="hindi"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>document.getElementById('p-rep-msg').textContent);
  assert(/Thanks|Salamat/.test(s),"429 is shown as recorded: "+s);
  // Still there? prompt
  reportStatus=201;statusBody={...statusBody,stillThere:{ageMin:12,distM:140}};
  await pg.evaluate(()=>pollStatus());await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>document.getElementById('p-rep-q').textContent);
  assert(/still there|Nandiyan pa ba/i.test(s),"Still there? replaces the question when a nearby report exists: "+s);
  // offline: report held, sent when back online within 10 min; older than 10 min dropped
  const n0=posted.length;
  await ctx.setOffline(true);
  await pg.evaluate(()=>{localStorage.removeItem("bw-lastrep");});
  await pg.click('#p-rep [data-ans="oo"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>JSON.parse(localStorage.getItem("bw-pending")||"null"));
  assert(s&&s.body.answer==="oo","offline report held on the phone");
  await ctx.setOffline(false);await pg.evaluate(()=>flushPending());await pg.waitForTimeout(400);
  assert(posted.length===n0+1&&!(await pg.evaluate(()=>localStorage.getItem("bw-pending"))),"held report sent when back online");
  await pg.evaluate(()=>localStorage.setItem("bw-pending",JSON.stringify({madeAt:Date.now()-11*60000,body:{place:"tv:s:BW-H01",answer:"oo",lat:1,lon:1,device:"a".repeat(24),demo:false}})));
  await pg.evaluate(()=>flushPending());await pg.waitForTimeout(200);
  assert(posted.length===n0+1&&!(await pg.evaluate(()=>localStorage.getItem("bw-pending"))),"a held report older than 10 min is dropped");
  // Worker unreachable for 25 min -> nodata, never Hindi
  statusFail=true;
  await pg.evaluate(()=>{lastLive={...lastLive,answer:"hindi",checkedAt:lastLive.serverNow-25*60000,updatedAt:lastLive.serverNow-25*60000};pollStatus();});await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>document.getElementById('p-answer').dataset.answer);
  assert(s==="nodata","Worker unreachable and data older than 20 min -> nodata");
  // demo page: reports tagged demo, no network without API_BASE
  const pg2=await ctx.newPage();await pg2.goto('file:///home/claude/work/bahawatch_dashboard.html');await pg2.waitForTimeout(400);
  s=await pg2.evaluate(()=>({live:LIVE,api:API_BASE}));
  assert(s.live===false&&s.api==="","the published demo page has no API and stays in demo mode");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
