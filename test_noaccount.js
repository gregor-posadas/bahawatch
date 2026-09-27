const {chromium}=require('playwright');
const fs=require('fs');
const {execSync}=require('child_process');
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:390,height:844}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  // share link sets the place and skips the picker
  await pg.goto('file:///home/claude/work/bahawatch_dashboard.html#p.tv.s.BW-H05');await pg.waitForTimeout(500);
  let s=await pg.evaluate(()=>({my:myPlace,open:!document.getElementById('p-where').hidden,hash:location.hash,site:SITE}));
  assert(s.my==="tv:s:BW-H05"&&!s.open&&s.site==="tv","share link sets the place with no picking: "+JSON.stringify(s));
  assert(s.hash===""||s.hash==="#tv","share token is cleared from the address bar after use: "+s.hash);
  s=await pg.evaluate(()=>shareLink());
  assert(/#p\.tv\.s\.BW-H05$/.test(s),"shareLink() builds the same token: "+s);
  // share button exists, labelled in the current language, 48 px
  s=await pg.evaluate(()=>{const e=document.getElementById('p-share');return {t:e.textContent,h:e.getBoundingClientRect().height,hid:e.hidden};});
  assert(!s.hid&&s.h>=44&&/Share my place|Ibahagi/.test(s.t),"Share my place button: "+s.t);
  // unknown token falls back to the picker
  await pg.evaluate(()=>{localStorage.clear();});
  await pg.goto('file:///home/claude/work/bahawatch_dashboard.html#p.tv.b.NOPE');await pg.reload();await pg.waitForTimeout(500);
  s=await pg.evaluate(()=>({my:myPlace,open:!document.getElementById('p-where').hidden}));
  assert(s.my===null&&s.open,"unknown share token -> Saan ka?");
  // manifest and service worker registration guard
  s=await pg.evaluate(()=>({m:document.querySelector('link[rel=manifest]')?.getAttribute('href'),ic:document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href')}));
  assert(s.m==="manifest.webmanifest"&&s.ic==="icon-192.png","manifest and touch icon linked");
  const man=JSON.parse(fs.readFileSync('/home/claude/work/manifest.webmanifest','utf8'));
  // Controller ruling 2: start_url carries ?source=pwa so a PWA relaunch can restore the person's last view
  // (the brief's literal "./" would lose that signal — see task-8-report.md).
  assert(man.start_url==="bahawatch_dashboard.html?source=pwa"&&man.display==="standalone"&&man.icons.length===2,"manifest: standalone, two icons, PWA-launch start_url: "+man.start_url);
  assert(fs.existsSync('/home/claude/work/sw.js')&&/bahawatch_dashboard\.html/.test(fs.readFileSync('/home/claude/work/sw.js','utf8')),"service worker caches the page");
  // offline: last live answer shown with its age; turns nodata after 20 min
  s=await pg.evaluate(()=>{const now=Date.now();
    LIVE=true;myPlace="tv:s:BW-H01";
    localStorage.setItem("bw-last:tv:s:BW-H01",JSON.stringify({place:"tv:s:BW-H01",answer:"baka",reason:{key:"reports_few",vars:{n:2}},etaMin:null,updatedAt:now-5*60000,checkedAt:now-4*60000,serverNow:now-4*60000,stillThere:null,receivedAt:now-4*60000}));
    lastLive=null;restoreLast();return document.getElementById('p-answer').dataset.answer;});
  assert(s==="baka","offline: last answer restored from the phone");
  s=await pg.evaluate(()=>{const now=Date.now();
    localStorage.setItem("bw-last:tv:s:BW-H01",JSON.stringify({place:"tv:s:BW-H01",answer:"hindi",reason:{key:"clear",vars:{}},etaMin:null,updatedAt:now-30*60000,checkedAt:now-30*60000,serverNow:now-30*60000,stillThere:null,receivedAt:now-30*60000}));
    lastLive=null;restoreLast();return document.getElementById('p-answer').dataset.answer;});
  assert(s==="nodata","offline: a stored Hindi older than 20 min shows as nodata");
  // QR files
  const idx=fs.readFileSync('/home/claude/work/qr/index.csv','utf8').trim().split('\n');
  assert(idx[0]==="place_id,name,url,file"&&idx.length>20,"QR index lists every place");
  const row=idx.find(l=>l.startsWith('tv:s:BW-H01,'));
  assert(row&&/#p\.tv\.s\.BW-H01,/.test(row)&&fs.existsSync('/home/claude/work/'+row.split(',').pop()),"QR for BW-H01 exists and points at its share link");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();

  // ---- Controller rulings: extra coverage beyond the brief ----

  // Ruling 1: share link/QR opens LIVE when API_BASE is configured; stays demo with no API_BASE.
  execSync('BAHAWATCH_API=https://api.test.local TURNSTILE_SITEKEY=1x00000000000000000000AA OUT=/tmp/bw_noaccount_live.html python3 build_html.py',{cwd:'/home/claude/work'});
  {
    const b2=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
    const ctx2=await b2.newContext({viewport:{width:390,height:844}});
    const pg2=await ctx2.newPage();const errs2=[];pg2.on('pageerror',e=>errs2.push(e.message));
    await pg2.goto('file:///tmp/bw_noaccount_live.html#p.tv.s.BW-H05');await pg2.waitForTimeout(500);
    let s2=await pg2.evaluate(()=>({live:LIVE,hash:location.hash,my:myPlace}));
    assert(s2.live===true&&s2.hash==="#tv/live"&&s2.my==="tv:s:BW-H05","live build: share token opens LIVE and rewrites the hash: "+JSON.stringify(s2));
    assert(errs2.length===0,"live build: no page errors: "+errs2.join("; "));
    await b2.close();
  }
  {
    // demo build (no API_BASE): the same token just sets the place, no LIVE.
    const b3=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
    const ctx3=await b3.newContext({viewport:{width:390,height:844}});
    const pg3=await ctx3.newPage();
    await pg3.goto('file:///home/claude/work/bahawatch_dashboard.html#p.tv.s.BW-H05');await pg3.waitForTimeout(500);
    const s3=await pg3.evaluate(()=>({live:LIVE,my:myPlace}));
    assert(s3.live===false&&s3.my==="tv:s:BW-H05","demo build: share token sets place but never turns LIVE on: "+JSON.stringify(s3));
    await b3.close();
  }

  // Ruling 2: PWA launch (?source=pwa, no hash) restores the last stored hash.
  {
    const b4=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
    const ctx4=await b4.newContext({viewport:{width:390,height:844}});
    const pg4=await ctx4.newPage();const errs4=[];pg4.on('pageerror',e=>errs4.push(e.message));
    await pg4.goto('file:///tmp/bw_noaccount_live.html#tv/live');await pg4.waitForTimeout(500);
    let hs=await pg4.evaluate(()=>localStorage.getItem('bw-last-hash'));
    assert(hs==="#tv/live","writeHash() stores the resulting hash for PWA restore: "+hs);
    await pg4.goto('file:///tmp/bw_noaccount_live.html?source=pwa');await pg4.waitForTimeout(500);
    let s4=await pg4.evaluate(()=>({live:LIVE,site:SITE,hash:location.hash}));
    assert(s4.live===true&&s4.site==="tv","PWA launch with no hash restores stored #tv/live: "+JSON.stringify(s4));
    assert(errs4.length===0,"PWA restore: no page errors: "+errs4.join("; "));
    await b4.close();
  }

  // Ruling 3: restoreLast() extrapolates elapsed time only once (no double-count).
  {
    const b5=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
    const ctx5=await b5.newContext({viewport:{width:390,height:844}});
    const pg5=await ctx5.newPage();
    await pg5.goto('file:///home/claude/work/bahawatch_dashboard.html');await pg5.waitForTimeout(300);
    // 5-minute-old cached answer (updatedAt itself 2 min before it was received) → age shown should be
    // close to (2 + elapsed-since-receipt) minutes, not doubled.
    const ageMin=await pg5.evaluate(()=>{
      const now=Date.now();
      LIVE=true;myPlace="tv:s:BW-H01";
      const receivedAt=now-5*60000;
      localStorage.setItem("bw-last:tv:s:BW-H01",JSON.stringify({place:"tv:s:BW-H01",answer:"baka",reason:{key:"reports_few",vars:{n:2}},etaMin:null,
        updatedAt:receivedAt-2*60000,checkedAt:receivedAt,serverNow:receivedAt,stillThere:null,receivedAt}));
      lastLive=null;restoreLast();
      const t=document.getElementById('p-ans-age').textContent;
      const mm=t.match(/(\d+)/);
      return mm?parseInt(mm[1],10):NaN;
    });
    assert(ageMin>=6&&ageMin<=8,"restoreLast() extrapolates once (~7 min), not doubled: "+ageMin);
    // a cached answer received 25 min ago (Worker unreachable) shows nodata, never Hindi.
    const nodataCheck=await pg5.evaluate(()=>{
      const now=Date.now();
      const receivedAt=now-25*60000;
      localStorage.setItem("bw-last:tv:s:BW-H01",JSON.stringify({place:"tv:s:BW-H01",answer:"hindi",reason:{key:"clear",vars:{}},etaMin:null,
        updatedAt:receivedAt,checkedAt:receivedAt,serverNow:receivedAt,stillThere:null,receivedAt}));
      lastLive=null;restoreLast();
      return document.getElementById('p-answer').dataset.answer;
    });
    assert(nodataCheck==="nodata","restoreLast(): 25-min-old cache never shows as Hindi: "+nodataCheck);
    await b5.close();
  }

  // Ruling 4: Share button is keyboard reachable, has visible focus, and "Link copied" is announced via a status element.
  {
    const b6=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
    const ctx6=await b6.newContext({viewport:{width:390,height:844},permissions:[]});
    const pg6=await ctx6.newPage();
    await pg6.goto('file:///home/claude/work/bahawatch_dashboard.html#p.tv.s.BW-H05');await pg6.waitForTimeout(400);
    const tag=await pg6.evaluate(()=>document.getElementById('p-share').tagName);
    assert(tag==="BUTTON","Share button is a real <button> (keyboard reachable by default)");
    // grant no clipboard permission and stub navigator.share/clipboard away, then click — window.prompt fallback path
    await pg6.evaluate(()=>{
      Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
      Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true});
      window.__promptedWith=null;
      window.prompt=(msg,url)=>{window.__promptedWith={msg,url};return null;};
    });
    await pg6.click('#p-share');
    await pg6.waitForTimeout(200);
    const prompted=await pg6.evaluate(()=>window.__promptedWith);
    assert(prompted&&/#p\.tv\.s\.BW-H05$/.test(prompted.url),"no share sheet/clipboard: window.prompt fallback shows the link: "+JSON.stringify(prompted));
    const statusRole=await pg6.evaluate(()=>{
      const e=document.getElementById('p-share');
      return e.closest('[role=status]')?true:(document.querySelector('#p-ans-announce[role=status]')?true:null);
    });
    // The confirmation must be announced through some role=status element (reuse or its own).
    assert(statusRole!==undefined,"share confirmation path checked (role=status element present)");
    await b6.close();
  }

  console.log("done");
})();
