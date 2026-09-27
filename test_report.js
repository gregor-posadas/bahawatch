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
  let delayPlace=null,delayResolve=null,delayAbort=false,statusBody2=null;   // Finding 1: hold one place's /status reply under test control
  await pg.route('https://api.test.local/**',async r=>{
    const u=r.request().url(),m=r.request().method();
    if(m==="POST"&&/\/report$/.test(u)){posted.push(JSON.parse(r.request().postData()));return r.fulfill({status:reportStatus,contentType:'application/json',body:JSON.stringify(reportStatus===201?{id:41}:{error:'already recorded'})});}
    if(m==="POST"&&/\/undo$/.test(u))return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
    if(/\/status\//.test(u)){
      if(statusFail)return r.abort();
      const place=decodeURIComponent(u.split('/status/')[1]);
      if(place===delayPlace){
        await new Promise(res=>{delayResolve=res;});
        if(delayAbort)return r.abort();
      }
      const body=(place==="tv:s:BW-H02"&&statusBody2)?statusBody2:statusBody;
      return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    }
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
  // Finding 8: Undo is a touch target too, not just the report buttons
  s=await pg.evaluate(()=>document.getElementById('p-rep-undo').getBoundingClientRect().height);
  assert(s>=48,"Undo button is at least 48 px tall: "+s);
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
  // Finding 1: switching place while a /status request is in flight must never show the old place's answer,
  // and must never write the new place's cache entry with the old place's body — success case, then failure case.
  statusBody2={place:"tv:s:BW-H02",answer:"hindi",reason:{key:"clear",vars:{}},etaMin:null,updatedAt:SN-2*60000,checkedAt:SN-60000,serverNow:SN,stillThere:null};
  await pg.evaluate(()=>{playing=false;});   // isolate pollStatus()'s own place-match handling from the ~1/s render tick
  {
    await pg.evaluate(()=>{myPlace="tv:s:BW-H01";lastLive=null;});
    delayPlace="tv:s:BW-H01";delayAbort=false;
    const inFlight=pg.evaluate(()=>pollStatus());
    await pg.waitForTimeout(150);
    await pg.evaluate(()=>{myPlace="tv:s:BW-H02";});      // the person switches place while the BW-H01 request is still pending
    const release=delayResolve;delayPlace=null;if(release)release();   // now let the stale BW-H01 reply resolve
    await inFlight;await pg.waitForTimeout(300);
    let s1=await pg.evaluate(()=>({ans:document.getElementById('p-answer').dataset.answer,cached:localStorage.getItem("bw-last:tv:s:BW-H02")}));
    assert(s1.ans==="hindi","switching place mid-flight shows the NEW place's answer, never the old one (baka): "+s1.ans);
    const cachedAns=s1.cached&&JSON.parse(s1.cached).answer;
    assert(cachedAns==="hindi","bw-last:<new place> is keyed and written with the new place's own body, never the old one's: "+cachedAns);
  }
  {
    await pg.evaluate(()=>{myPlace="tv:s:BW-H01";lastLive=null;});
    delayPlace="tv:s:BW-H01";delayAbort=true;             // this time the stale in-flight request ends in failure, not a late success
    const inFlight=pg.evaluate(()=>pollStatus());
    await pg.waitForTimeout(150);
    await pg.evaluate(()=>{myPlace="tv:s:BW-H02";});
    const release=delayResolve;delayPlace=null;if(release)release();
    await inFlight;await pg.waitForTimeout(300);
    let s2=await pg.evaluate(()=>document.getElementById('p-answer').dataset.answer);
    assert(s2==="hindi","band still shows the new place's answer when the stale in-flight request fails instead of resolving: "+s2);
  }
  delayPlace=null;delayResolve=null;delayAbort=false;
  await pg.evaluate(()=>{myPlace="tv:s:BW-H01";pollNow();});await pg.waitForTimeout(300);   // restore state for the rest of this test
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

  // Finding 2: renderAnswer() must never itself trigger a fetch — with the Worker unreachable, ~10 s of demo-speed
  // playback (renderAnswer runs ~1×/s from step()) must produce at most 2 /status requests, not one per tick.
  {
    const pgF=await ctx.newPage();
    let reqCount=0;
    await pgF.route('https://api.test.local/**',async r=>{
      const u=r.request().url();
      if(/\/status\//.test(u)){reqCount++;return r.abort();}
      return r.fulfill({status:404,body:'{}'});
    });
    await pgF.goto(U);await pgF.waitForTimeout(10000);
    assert(reqCount<=2,"Worker unreachable for 10 s of playback -> at most 2 /status requests: "+reqCount);
    await pgF.close();
  }

  // Finding 3: a Turnstile widget that never calls back (interaction-only, waiting on the person) must not hang
  // forever — it rejects after a timeout, shows the fail message, and never wedges the send lock.
  {
    const pgF=await ctx.newPage();
    await pgF.addInitScript(()=>{window.turnstile={render:(el,o)=>{window.__renderCalls=(window.__renderCalls||0)+1;return "wstuck";},remove(){}};});
    let posted3=[];
    await pgF.route('https://api.test.local/**',async r=>{
      const u=r.request().url(),m=r.request().method();
      if(m==="POST"&&/\/report$/.test(u)){posted3.push(1);return r.fulfill({status:201,contentType:'application/json',body:JSON.stringify({id:99})});}
      if(/\/status\//.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(statusBody)});
      return r.fulfill({status:404,body:'{}'});
    });
    await pgF.goto(U);await pgF.waitForTimeout(500);
    await pgF.evaluate(()=>{TURNSTILE_TIMEOUT_MS=50;});   // don't wait out a real 15 s in a test
    await pgF.evaluate(()=>{navigator.geolocation.getCurrentPosition=(ok,fail)=>fail({code:1});});
    await pgF.click('#p-rep [data-ans="oo"]');await pgF.waitForTimeout(400);
    let s3=await pgF.evaluate(()=>document.getElementById('p-rep-msg').textContent);
    assert(/Couldn't send|Hindi naipadala/.test(s3),"a Turnstile widget that never calls back rejects after the timeout, showing the fail message: "+s3);
    assert(posted3.length===0,"no token ever arrived, so no POST was sent");
    await pgF.evaluate(()=>localStorage.setItem("bw-pending",JSON.stringify({madeAt:Date.now(),body:{place:"tv:s:BW-H01",answer:"oo",lat:1,lon:1,device:"b".repeat(24),demo:false}})));
    await pgF.evaluate(()=>flushPending());await pgF.waitForTimeout(300);
    const renderCalls=await pgF.evaluate(()=>window.__renderCalls||0);
    assert(renderCalls>=2,"the send lock cleared after the timeout — a later flush attempt actually re-renders Turnstile: "+renderCalls);
    await pgF.close();
  }

  // Finding 4: Undo and a failed flush must say so, not claim success
  {
    const pgF=await ctx.newPage();
    await pgF.route('https://api.test.local/**',async r=>{
      const u=r.request().url(),m=r.request().method();
      if(m==="POST"&&/\/report$/.test(u))return r.fulfill({status:201,contentType:'application/json',body:JSON.stringify({id:77})});
      if(m==="POST"&&/\/undo$/.test(u))return r.fulfill({status:410,contentType:'application/json',body:'{}'});   // past the server's 15 s undo window
      if(/\/status\//.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(statusBody)});
      return r.fulfill({status:404,body:'{}'});
    });
    await pgF.goto(U);await pgF.waitForTimeout(500);
    await pgF.evaluate(()=>{navigator.geolocation.getCurrentPosition=(ok,fail)=>fail({code:1});});
    await pgF.click('#p-rep [data-ans="oo"]');await pgF.waitForTimeout(400);
    await pgF.click('#p-rep-undo');await pgF.waitForTimeout(300);
    let s4=await pgF.evaluate(()=>document.getElementById('p-rep-msg').textContent);
    assert(/Couldn't send|Hindi naipadala/.test(s4),"Undo shows the fail message on a non-ok server reply (410), not 'Removed.': "+s4);
    await pgF.close();
  }
  {
    const pgF=await ctx.newPage();
    await pgF.route('https://api.test.local/**',async r=>{
      const u=r.request().url(),m=r.request().method();
      if(m==="POST"&&/\/report$/.test(u))return r.fulfill({status:500,contentType:'application/json',body:'{}'});
      if(/\/status\//.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(statusBody)});
      return r.fulfill({status:404,body:'{}'});
    });
    await pgF.goto(U);await pgF.waitForTimeout(500);
    await pgF.evaluate(()=>localStorage.setItem("bw-pending",JSON.stringify({madeAt:Date.now(),body:{place:"tv:s:BW-H01",answer:"oo",lat:1,lon:1,device:"c".repeat(24),demo:false}})));
    await pgF.evaluate(()=>flushPending());await pgF.waitForTimeout(400);
    let s5=await pgF.evaluate(()=>document.getElementById('p-rep-msg').textContent);
    assert(/Couldn't send|Hindi naipadala/.test(s5),"a failed flush attempt shows the fail message instead of staying silent: "+s5);
    await pgF.evaluate(()=>{try{localStorage.removeItem("bw-pending");}catch(e){}});   // localStorage is shared across pages in this context — don't leak a queued report into later blocks
    await pgF.close();
  }

  // Finding 5: double tap sends exactly one POST and never loses a still-valid Undo; buttons are disabled while sending
  {
    const pgF=await ctx.newPage();
    await pgF.addInitScript(()=>{try{localStorage.removeItem("bw-pending");}catch(e){}});   // don't let an earlier block's queued report auto-flush at this page's boot and inflate the count
    let posted5=[];
    await pgF.route('https://api.test.local/**',async r=>{
      const u=r.request().url(),m=r.request().method();
      if(m==="POST"&&/\/report$/.test(u)){posted5.push(1);await new Promise(res=>setTimeout(res,150));return r.fulfill({status:201,contentType:'application/json',body:JSON.stringify({id:55})});}
      if(/\/status\//.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(statusBody)});
      return r.fulfill({status:404,body:'{}'});
    });
    await pgF.goto(U);await pgF.waitForTimeout(500);
    await pgF.evaluate(()=>{navigator.geolocation.getCurrentPosition=(ok,fail)=>fail({code:1});});
    await pgF.evaluate(()=>{sendReport('oo');sendReport('oo');});   // two taps in immediate succession
    await pgF.waitForTimeout(30);
    let mid=await pgF.evaluate(()=>{const b=document.querySelector('#p-rep [data-ans="oo"]');return {disabled:b.disabled,ariaD:b.getAttribute('aria-disabled'),msg:document.getElementById('p-rep-msg').textContent};});
    assert(mid.disabled&&mid.ariaD==="true","report buttons are disabled + aria-disabled while a report is sending");
    assert(/Sending|Ipinapadala/.test(mid.msg),"a 'sending' message shows while the report is in flight: "+mid.msg);
    await pgF.waitForTimeout(500);
    assert(posted5.length===1,"double tap sends exactly one POST, not two: "+posted5.length);
    let after=await pgF.evaluate(()=>{const b=document.querySelector('#p-rep [data-ans="oo"]');return {disabled:b.disabled,undo:!document.getElementById('p-rep-undo').hidden};});
    assert(!after.disabled,"buttons re-enable once the reply arrives");
    assert(after.undo,"Undo is visible after a double tap, not lost to a 429 reply");
    await pgF.close();
  }

  // Finding 6: LIVE hides the simulated figure, My street/Monitored streets and the area headline, and shows a
  // placeholder line instead; demo mode (#tv, no /live) is unaffected.
  {
    const pgF=await ctx.newPage();
    await pgF.route('https://api.test.local/**',async r=>{
      const u=r.request().url();
      if(/\/status\//.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(statusBody)});
      return r.fulfill({status:404,body:'{}'});
    });
    await pgF.goto(U);await pgF.waitForTimeout(500);
    let live6=await pgF.evaluate(()=>({fig:document.getElementById('p-fig').hidden,list:document.getElementById('p-col-list').hidden,area:document.getElementById('p-area').hidden,
      note:document.getElementById('p-live-note').hidden,noteText:document.getElementById('p-live-note').textContent,demo:document.getElementById('p-demo').hidden}));
    assert(live6.fig&&live6.list&&live6.area,"LIVE hides the depth figure, My street/Monitored streets, and the area headline");
    assert(!live6.note&&/Sensor readings|sukat ng sensor/.test(live6.noteText),"LIVE shows a placeholder line under the report row: "+live6.noteText);
    assert(live6.demo,"LIVE never shows the 'Demo: … simulated' footer claim");
    await pgF.close();
  }
  {
    const pgF=await ctx.newPage();
    await pgF.goto('file:///home/claude/work/bahawatch_dashboard.html#tv');await pgF.waitForTimeout(500);
    let demo6=await pgF.evaluate(()=>({fig:document.getElementById('p-fig').hidden,list:document.getElementById('p-col-list').hidden,demo:document.getElementById('p-demo').hidden}));
    assert(!demo6.fig&&!demo6.list&&!demo6.demo,"demo mode (#tv, not live) still shows the figure, street lists and the Demo footer claim");
    await pgF.close();
  }

  // Finding 7: no GPS permission prompt mid-tap — only use it when already granted, or reached via "Use my location"
  {
    const pgF=await ctx.newPage();
    let posted7=[];
    await pgF.route('https://api.test.local/**',async r=>{
      const u=r.request().url(),m=r.request().method();
      if(m==="POST"&&/\/report$/.test(u)){posted7.push(JSON.parse(r.request().postData()));return r.fulfill({status:201,contentType:'application/json',body:JSON.stringify({id:88})});}
      if(/\/status\//.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(statusBody)});
      return r.fulfill({status:404,body:'{}'});
    });
    await pgF.goto(U);await pgF.waitForTimeout(500);
    await pgF.evaluate(()=>{navigator.geolocation.getCurrentPosition=(ok)=>{window.__gpsCalled=true;ok({coords:{latitude:1,longitude:1}});};});
    await pgF.click('#p-rep [data-ans="oo"]');await pgF.waitForTimeout(400);
    const gpsCalled=await pgF.evaluate(()=>!!window.__gpsCalled);
    assert(!gpsCalled,"permission state 'prompt' (the default, ungranted) -> getCurrentPosition is never called");
    const P7=await pgF.evaluate(()=>currentPlace());
    assert(posted7.length===1&&posted7[0].lat===Math.round(P7.lat*1000)/1000&&posted7[0].lon===Math.round(P7.lon*1000)/1000,
      "report sent at the place centre with no GPS prompt mid-tap");
    await pgF.close();
  }

  // Finding 9: the demo page (not LIVE) never sends a report — tapping shows a demo-specific "not sent" message
  const pg2=await ctx.newPage();
  let netReqs=0;pg2.on('request',req=>{if(req.url().startsWith('http'))netReqs++;});
  await pg2.goto('file:///home/claude/work/bahawatch_dashboard.html');await pg2.waitForTimeout(400);
  s=await pg2.evaluate(()=>({live:LIVE,api:API_BASE}));
  assert(s.live===false&&s.api==="","the published demo page has no API and stays in demo mode");
  netReqs=0;
  await pg2.click('#p-rep [data-ans="oo"]');await pg2.waitForTimeout(400);
  assert(netReqs===0,"tapping a report button on the demo page makes no network request: "+netReqs);
  let demoMsg=await pg2.evaluate(()=>document.getElementById('p-rep-msg').textContent);
  assert(/Demo — not sent|Demo — hindi ipinadala/.test(demoMsg),"the demo page shows a demo-specific 'not sent' message, not 'Thanks, recorded.': "+demoMsg);
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
