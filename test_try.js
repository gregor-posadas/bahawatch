const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ans=pg=>pg.evaluate(()=>({a:document.getElementById('p-answer').dataset.answer,k:document.getElementById('p-ans-reason').textContent,why:document.getElementById('try-why').textContent}));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(()=>{if(!sessionStorage.getItem("seeded")){sessionStorage.setItem("seeded","1");localStorage.setItem("bw-lang:tv","en");localStorage.setItem("bw-place:tv","tv:s:BW-H07");localStorage.setItem("bw-street:tv","BW-H07");localStorage.setItem("bw-asked:tv","1");}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  // the map's own static files (styles, tiles, fonts, library) are part of the page; nothing else may be requested
  const net=[];pg.on('request',r=>{const u=r.url();if(!u.startsWith('file:')&&!u.startsWith('data:')&&!/\/(shared\/(fonts|tiles)\/|shared\/basemap-style|lib\/)/.test(u))net.push(u);});
  await pg.goto(U+'#tv');await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(400);
  net.length=0;                                   // the page and data/tv.json are loaded; from here on nothing may be fetched
  let s=await pg.evaluate(()=>[...document.querySelectorAll('#public .site-tabs [role=tab]')].map(t=>t.dataset.site));
  assert(s.join()==="ph,tv,berkeley,try","fourth tab 'Try reporting' after UC Berkeley: "+s);
  await pg.focus('#public .site-tabs [data-site="berkeley"]');await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({t:TRY,hash:location.hash,sel:document.querySelector('#public .site-tabs [aria-selected="true"]').dataset.site,place:document.getElementById('p-ans-place').textContent,playing,panel:!document.getElementById('try-panel').hidden,sim:document.getElementById('try-sim').textContent,where:document.getElementById('p-where').hidden}));
  assert(s.t&&s.hash==="#try"&&s.sel==="try","keyboard: ArrowRight from UC Berkeley opens the Try reporting tab (#try)");
  assert(/22 Malingap/.test(s.place)&&!s.playing&&s.panel&&s.where&&/nothing leaves this page/i.test(s.sim),"fixed place 22 Malingap Street, storm stopped, controls and simulation label shown, no Saan ka?");
  s=await ans(pg);
  assert(s.a==="hindi","start: dry sensor, no reports -> Hindi ("+s.k+")");
  assert(/^Simulation/.test(await pg.evaluate(()=>document.getElementById('p-ans-announce').textContent)),"screen readers hear 'Simulation' first in the Try tab");
  await pg.click('#p-rep [data-ans="oo"]');await pg.waitForTimeout(150);
  assert(/^1 phone says .Yes. within 1 km/.test(await pg.evaluate(()=>document.getElementById('try-why').textContent)),"one phone: '1 phone says' (not 'say')");
  s=await pg.evaluate(()=>({a:document.getElementById('p-answer').dataset.answer,msg:document.getElementById('p-rep-msg').textContent,undo:!document.getElementById('p-rep-undo').hidden,d:drawnReports,log:[...document.querySelectorAll('#try-log li')].map(l=>l.textContent)}));
  assert(s.a==="baka"&&/Thanks/.test(s.msg)&&s.undo,"your Yes -> Baka, 'Thanks, recorded.' with Undo");
  assert(s.d===1&&s.log.length===1&&/^You: Yes$/.test(s.log[0]),"your report is a diamond on the map and a line in the list: "+s.log);
  await pg.click('#p-rep-undo');await pg.waitForTimeout(150);
  s=await pg.evaluate(()=>({a:document.getElementById('p-answer').dataset.answer,d:drawnReports,m:tryState.mine}));
  assert(s.a==="hindi"&&s.d===0&&s.m===null,"Undo removes your report and its diamond");
  await pg.click('#p-rep [data-ans="oo"]');await pg.click('#try-add-oo');await pg.click('#try-add-oo');await pg.waitForTimeout(150);
  s=await ans(pg);
  assert(s.a==="baka"&&/sensor here is dry/.test(s.k),"3 phones say Yes, sensor dry -> Baka, reason names the dry sensor: "+s.k);
  assert(/^3 phones say .Yes. within 1 km · sensor dry · no rain → Maybe/.test(s.why)&&/can.t say .Yes./.test(s.why),"explanation line: "+s.why);
  assert(/→ Maybe\. Reports alone/.test(s.why),"the answer and the cap note are separate sentences: "+s.why);
  s=await pg.evaluate(()=>{const h=HOUSEHOLD.find(x=>x.id===TRY_SENSOR),w=lonLatToWorld(tryState.mine.lon,tryState.mine.lat);return Math.hypot(w.x-h.x,w.y-h.y)*view.sc;});
  assert(s>=26,"your diamond sits clear of the sensor marker on screen ("+s.toFixed(1)+" px apart)");
  await pg.click('#try-ctrls [data-cm="3"]');await pg.waitForTimeout(100);
  s=await ans(pg);
  assert(s.a==="baka"&&/^3 neighbours report flooding/.test(s.k)&&/sensor 3 cm/.test(s.why),"sensor 3 cm -> still Baka, '3 neighbours report flooding': "+s.k);
  await pg.click('#try-ctrls [data-cm="20"]');await pg.waitForTimeout(100);
  s=await ans(pg);
  assert(s.a==="oo"&&/20 cm/.test(s.k)&&!/can.t say/.test(s.why),"sensor 20 cm -> Oo from the sensor");
  s=await pg.evaluate(()=>({q:document.getElementById('p-rep-q').textContent,p:[...document.querySelectorAll('#try-ctrls [data-cm]')].map(x=>x.getAttribute('aria-pressed')).join()}));
  assert(/still there/i.test(s.q)&&s.p==="false,false,true","a neighbour's Yes turns the question into 'still there?'; the sensor switch shows 20 cm pressed");
  await pg.click('#try-add-hindi');await pg.waitForTimeout(100);
  s=await pg.evaluate(()=>({n:document.querySelectorAll('#try-log li').length,d:drawnReports,a:document.getElementById('p-answer').dataset.answer}));
  assert(s.n===4&&s.d===4&&s.a==="oo","a neighbour's No is recorded on the map and in the list");
  await pg.evaluate(()=>{for(let i=0;i<10;i++)document.getElementById('try-add-oo').click();});await pg.waitForTimeout(100);
  s=await pg.evaluate(()=>({n:tryState.neighbours.length,dis:document.getElementById('try-add-oo').disabled&&document.getElementById('try-add-hindi').disabled,full:document.getElementById('try-full').textContent}));
  assert(s.n===8&&s.dis&&/8/.test(s.full),"at most 8 pretend neighbours; the add buttons disable and say why");
  await pg.click('#try-reset');await pg.waitForTimeout(100);
  s=await pg.evaluate(()=>({a:document.getElementById('p-answer').dataset.answer,d:drawnReports,n:tryState.neighbours.length,m:tryState.mine,cm:tryState.sensorCm,dis:document.getElementById('try-add-oo').disabled}));
  assert(s.a==="hindi"&&s.d===0&&s.n===0&&s.m===null&&s.cm===0&&!s.dis,"Reset -> no reports, dry sensor, Hindi, add buttons enabled");
  s=await pg.evaluate(()=>({flood:mapDrawn.flood,markers:mapDrawn.statusMarkers,inTry:document.getElementById('try-map').contains(document.getElementById('map-wrap'))}));
  assert(!s.flood&&s.markers===1&&s.inTry,"map: no simulated flood layer, only the Malingap sensor, inside the tab");
  assert(net.length===0,"no network requests from the tab: "+net.join(","));
  await pg.click('#p-rep [data-ans="oo"]');await pg.waitForTimeout(100);   // leave inside the 10 s Undo window
  await pg.click('#public .site-tabs [data-site="tv"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({msg:document.getElementById('p-rep-msg').textContent,undo:document.getElementById('p-rep-undo').hidden}));
  assert(s.msg===""&&s.undo,"leaving the tab clears the Try 'Thanks, recorded.' and its Undo (nothing claimed for your own place): "+s.msg);
  assert(net.length===0,"still no network requests after leaving the tab: "+net.join(","));
  s=await pg.evaluate(()=>({t:TRY,hash:location.hash,place:document.getElementById('p-ans-place').textContent,stored:localStorage.getItem("bw-place:tv"),playing,list:!document.getElementById('p-col-list').hidden,panel:document.getElementById('try-panel').hidden,map:document.getElementById('public-map').contains(document.getElementById('map-wrap')),flood:mapDrawn.flood}));
  assert(!s.t&&s.hash==="#tv"&&/Mayaman/.test(s.place)&&s.stored==="tv:s:BW-H07","back on Teachers Village: your own place (43 Mayaman) untouched");
  assert(s.playing&&s.list&&s.panel&&s.map&&s.flood,"demo restored: storm playing, street list shown, Try panel hidden, map and flood layer back");
  await pg.click('#public .site-tabs [data-site="try"]');await pg.waitForTimeout(200);
  await pg.click('#p-details');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({t:TRY,view:VIEW,panel:document.getElementById('try-panel').hidden,inMain:document.querySelector('main').contains(document.getElementById('map-wrap'))}));
  assert(!s.t&&s.view==="details"&&s.panel&&s.inMain,"Details from the Try tab leaves the tab cleanly");
  await pg.click('header + .site-tabs [data-site="try"]');await pg.waitForTimeout(300);   // the details view's own tab row
  s=await pg.evaluate(()=>({t:TRY,view:VIEW}));
  assert(s.t&&s.view==="public","the details view's tab row also opens the Try tab (in the simple layout)");
  const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push(e.message));await pg2.goto(U+'#try');await pg2.waitForFunction(()=>document.body.dataset.ready);await pg2.waitForTimeout(400);
  s=await pg2.evaluate(()=>({t:TRY,sel:document.querySelector('#public .site-tabs [aria-selected="true"]').dataset.site,where:document.getElementById('p-where').hidden,a:document.getElementById('p-answer').dataset.answer,playing}));
  assert(s.t&&s.sel==="try"&&s.where&&s.a==="hindi"&&!s.playing,"#try link opens the tab directly: no Saan ka?, no storm");
  const pg3=await ctx.newPage();pg3.on('pageerror',e=>errs.push(e.message));await pg3.goto(U+'#tv');await pg3.waitForFunction(()=>document.body.dataset.ready);await pg3.waitForTimeout(400);
  await pg3.click('#p-rep [data-ans="oo"]');await pg3.waitForTimeout(100);
  s=await pg3.evaluate(()=>({m:document.getElementById('p-rep-msg').textContent,l:!document.getElementById('p-try-link').hidden,t:document.getElementById('p-try-link').textContent}));
  assert(/Demo — not sent/.test(s.m)&&s.l&&/Try reporting/.test(s.t),"demo tabs: 'Demo — not sent' plus a link to the Try reporting tab");
  await pg3.click('#p-try-link');await pg3.waitForTimeout(300);
  assert(await pg3.evaluate(()=>TRY&&location.hash==="#try"),"the link opens the Try reporting tab");
  // every language: all Try strings exist and the tab shows no English leftovers
  s=await pg2.evaluate(()=>{const need=Object.keys(TRY_LANGS.en);const miss=[];for(const k of ["en","fil","ceb","ilo","hil","pam"])for(const n of need)if(!TRY_LANGS[k]||!TRY_LANGS[k][n])miss.push(k+"."+n);return miss;});
  assert(s.length===0,"Try strings complete in six languages: "+s.join(","));
  await pg2.selectOption('#p-lang','fil');await pg2.click('#p-rep [data-ans="oo"]');await pg2.click('#try-add-oo');await pg2.click('#try-add-oo');await pg2.waitForTimeout(150);
  s=await pg2.evaluate(()=>({sim:document.getElementById('try-sim').textContent,add:document.getElementById('try-add-oo').textContent,why:document.getElementById('try-why').textContent,log:document.getElementById('try-log').textContent,q:document.getElementById('p-rep-q').textContent,word:document.getElementById('p-ans-word').textContent}));
  assert(/Simulasyon/.test(s.sim)&&/Kapitbahay: “Oo”/.test(s.add)&&/walang ulan → Baka/.test(s.why)&&/Ikaw: Oo/.test(s.log)&&/Nandiyan pa ba/.test(s.q)&&s.word==="Baka","Filipino: panel, explanation, list, question and answer all switch: "+s.why);
  assert(!/Neighbour|Reports on this map|nothing leaves|Sensor at/.test(s.sim+s.add+s.why+s.log),"Filipino: no English left in the Try panel");
  // contrast: every text element in the phone and the panel, both themes, three answer states
  const lum=c=>{const m=c.match(/[\d.]+/g).map(Number);const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(m[0])+0.7152*f(m[1])+0.0722*f(m[2]);};
  for(const theme of ["light","dark"]){
    await pg2.evaluate(t=>setTheme(t,true),theme);
    for(const cm of [0,3,20]){
      await pg2.evaluate(c=>trySetSensor(c),cm);await pg2.waitForTimeout(80);
      const pairs=await pg2.evaluate(()=>{const bg=e=>{for(let x=e;x;x=x.parentElement){const c=getComputedStyle(x).backgroundColor;if(!/rgba\(0, 0, 0, 0\)|transparent/.test(c))return c;}return getComputedStyle(document.body).backgroundColor;};
        return [...document.querySelectorAll('#p-answer *, #p-rep *, #try-panel *, #try-sim')].filter(e=>e.offsetParent&&e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!e.closest('.sr-only')).map(e=>({id:e.id||e.tagName,fg:getComputedStyle(e).color,bg:bg(e),op:getComputedStyle(e).opacity}));});
      const bad=pairs.filter(p=>p.op==="1").map(p=>{const a=lum(p.fg),b2=lum(p.bg);return {...p,r:(Math.max(a,b2)+0.05)/(Math.min(a,b2)+0.05)};}).filter(p=>p.r<4.5);
      assert(bad.length===0,`contrast ≥ 4.5:1 (${theme}, sensor ${cm} cm): `+bad.map(p=>p.id+" "+p.r.toFixed(2)).join(", "));
    }
  }
  // phone width: order phone → controls → explanation → map → list; no horizontal scroll; 48 px buttons
  const pg4=await b.newPage({viewport:{width:390,height:844}});pg4.on('pageerror',e=>errs.push(e.message));
  await pg4.goto(U+'#try');await pg4.waitForFunction(()=>document.body.dataset.ready);await pg4.waitForTimeout(400);
  s=await pg4.evaluate(()=>{const y=id=>document.getElementById(id).getBoundingClientRect().top;
    return {order:[y('p-answer'),y('try-ctrls'),y('try-why'),y('try-map'),y('try-log-h')],sw:document.documentElement.scrollWidth,btn:Math.min(...[...document.querySelectorAll('#try-ctrls button, #p-rep [data-ans]')].map(b=>b.getBoundingClientRect().height))};});
  assert(s.order.every((v,i,a)=>i===0||v>a[i-1]),"390 px: phone, then controls, explanation, map, list: "+s.order.map(Math.round));
  assert(s.sw<=390,"390 px: no horizontal scroll ("+s.sw+")");
  assert(s.btn>=48,"all Try and report buttons ≥ 48 px ("+s.btn+")");
  // keyboard: the controls are reachable and operable with Tab and Enter
  await pg4.focus('#try-add-oo');await pg4.keyboard.press('Enter');await pg4.waitForTimeout(100);
  assert(await pg4.evaluate(()=>tryState.neighbours.length===1),"keyboard: Enter on '+ Neighbour' adds one");
  const {execSync}=require('child_process');
  execSync('BAHAWATCH_API=https://api.test.local TURNSTILE_SITEKEY=1x00000000000000000000AA OUT=/home/claude/work/_bw_try_live.html python3 build_html.py',{cwd:'/home/claude/work'});
  const pg5=await ctx.newPage();pg5.on('pageerror',e=>errs.push(e.message));
  await pg5.route('https://api.test.local/**',r=>r.fulfill({status:503,body:'{}'}));
  await pg5.goto(BASE+'_bw_try_live.html#tv/live');await pg5.waitForFunction(()=>document.body.dataset.ready);await pg5.waitForTimeout(400);
  await pg5.click('#public .site-tabs [data-site="try"]');await pg5.waitForTimeout(200);
  await pg5.click('#public .site-tabs [data-site="tv"]');await pg5.waitForTimeout(300);
  s=await pg5.evaluate(()=>({live:LIVE,hash:location.hash,playing,flag:document.body.dataset.live}));
  assert(s.live&&s.hash==="#tv/live"&&!s.playing&&s.flag==="1","live build: Try then back returns to live mode (#tv/live, no storm): "+JSON.stringify(s));
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  // the map re-measures itself when it moves into the Try panel, at any display scale (spec §3.2)
  for(const dpr of [1.25,1.5])for(const from of ["#uplb","#tv"]){
    const c2=await b.newContext({viewport:{width:1169,height:873},deviceScaleFactor:dpr});
    await c2.addInitScript(()=>{try{localStorage.setItem("bw-asked:uplb","1");localStorage.setItem("bw-asked:tv","1");}catch(e){}});
    const p=await c2.newPage();await p.goto(U+from);
    await p.waitForFunction(()=>document.body.dataset.ready&&document.body.dataset.ready!=="");await p.waitForTimeout(400);
    await p.locator('.site-tabs [data-site="try"]:visible').first().click();await p.waitForTimeout(600);
    const m=await p.evaluate(()=>{const w=document.getElementById('map-wrap'),c=document.getElementById('map'),d=Math.min(devicePixelRatio,2);
      return {bw:Math.round(w.clientWidth*d),bh:Math.round(w.clientHeight*d),cw:c.width,ch:c.height};});
    assert(Math.abs(m.bw-m.cw)<=1&&Math.abs(m.bh-m.ch)<=1,`Try map sharp at ${dpr}x from ${from}: box ${m.bw}x${m.bh}, canvas ${m.cw}x${m.ch}`);
    await c2.close();
  }
  // a phone outline around the answer and the report buttons (spec §5), and the whole neighbourhood in view
  {const c3=await b.newContext({viewport:{width:1280,height:900}});
   await c3.addInitScript(()=>{try{localStorage.setItem("bw-asked:tv","1");}catch(e){}});
   const p=await c3.newPage();await p.goto(U+'#try');await p.waitForFunction(()=>TRY&&document.body.dataset.ready);await p.waitForTimeout(500);
   let r=await p.evaluate(()=>{const l=document.querySelector('.p-left'),cs=getComputedStyle(l),pill=getComputedStyle(l,'::before'),
     a=document.getElementById('p-answer').getBoundingClientRect(),q=document.querySelector('#p-rep .p-rep-btns').getBoundingClientRect(),lr=l.getBoundingClientRect();
     return {bw:cs.borderTopWidth,rad:cs.borderTopLeftRadius,screen:l.clientWidth,pill:pill.content!=="none"&&pill.width==="96px",
       inside:a.left>=lr.left&&a.right<=lr.right&&q.bottom<=lr.bottom};});
   assert(r.bw==="12px"&&r.rad==="48px"&&Math.abs(r.screen-390)<=2&&r.pill&&r.inside,"Try: a phone outline (12 px frame, 48 px corners, camera pill) around a 390 px screen holding the answer and the buttons: "+JSON.stringify(r));
   for(let i=0;i<8;i++)await p.click(i%2?'#try-add-hindi':'#try-add-oo');await p.waitForTimeout(200);
   r=await p.evaluate(()=>{const b=DATA.bbox,lat=(b[1]+b[3])/2,mpu=(b[2]-b[0])*111320*Math.cos(lat*Math.PI/180)/W;
     const span=Math.min(view.w,view.h)/view.sc*mpu;
     const all=tryState.neighbours.every(n=>{const w=lonLatToWorld(n.lon,n.lat),x=view.ox+w.x*view.sc,y=view.oy+w.y*view.sc;return x>=0&&x<=view.w&&y>=0&&y<=view.h;});
     return {span:Math.round(span),all,n:tryState.neighbours.length};});
   assert(r.span>=630&&r.span<=770&&r.all&&r.n===8,"Try: the map opens on about 700 m around 22 Malingap St, all 8 pretend neighbours in view: "+JSON.stringify(r));
   await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);
   r=await p.evaluate(()=>({bw:getComputedStyle(document.querySelector('.p-left')).borderTopWidth,sw:document.documentElement.scrollWidth}));
   assert(r.bw==="0px"&&r.sw<=390,"Try at 390 px: no phone outline (the page already is a phone), no sideways scroll");
   await c3.close();}
  await b.close();
})();
