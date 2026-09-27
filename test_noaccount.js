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
    await b6.close();
  }

  // Ruling 4 (fix): "Link copied" must survive the playback loop's re-renders (step()->renderPublic()->renderAnswer()
  // runs ~1/s) and be announced once through a dedicated role=status element, then the label must revert.
  {
    const b7=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
    const ctx7=await b7.newContext({viewport:{width:390,height:844}});
    const pg7=await ctx7.newPage();const errs7=[];pg7.on('pageerror',e=>errs7.push(e.message));
    await pg7.goto('file:///home/claude/work/bahawatch_dashboard.html#p.tv.s.BW-H05');await pg7.waitForTimeout(400);
    await pg7.evaluate(()=>{
      Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
      Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.resolve()},configurable:true});
    });
    await pg7.click('#p-share');
    // Do NOT pause playback: renderAnswer() fires repeatedly during this wait, which is exactly what overwrote
    // the confirmation before the fix (renderAnswer() used to hard-set textContent=L.share on every call).
    await pg7.waitForTimeout(1500);
    const COPIED=["Link copied","Nakopya ang link","Nakopia ti link","Me-kopya ne ing link"];
    const SHARE_LBL=["Share my place","Ibahagi ang lugar ko","Ipakigbahin ang akong lugar","Iranud ti lugarko","Ipaambit ang akon lugar","Ibahagi me ing lugal ku"];
    const mid=await pg7.evaluate(()=>({
      btn:document.getElementById('p-share').textContent,
      status:document.getElementById('p-share-status').textContent,
      role:document.getElementById('p-share-status').getAttribute('role'),
    }));
    assert(COPIED.includes(mid.btn),"confirmation survives ~1.5s of playback re-renders (visible button text): "+mid.btn);
    assert(mid.role==="status"&&COPIED.includes(mid.status),"confirmation is announced once via its own role=status element: "+JSON.stringify(mid));
    await pg7.waitForTimeout(2000);   // ~3.5 s total since the click
    const after=await pg7.evaluate(()=>document.getElementById('p-share').textContent);
    assert(SHARE_LBL.includes(after),"button label is restored ~3.5s after the click: "+after);
    assert(errs7.length===0,"share-confirmation persistence: no page errors: "+errs7.join("; "));
    await b7.close();
  }

  console.log("done");
})();
