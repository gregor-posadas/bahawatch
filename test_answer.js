const {chromium}=require('playwright');
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U='file:///home/claude/work/bahawatch_dashboard.html';
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.waitForTimeout(400);
  // first visit: "Saan ka?" shows with four choices
  let s=await pg.evaluate(()=>({open:!document.getElementById('p-where').hidden,btns:[...document.querySelectorAll('#p-where button')].map(b=>b.dataset.act)}));
  assert(s.open&&s.btns.join()==="loc,brgy,sensor,skip","first visit opens Saan ka? with four choices: "+s.btns);
  await pg.click('#p-where [data-act="skip"]');await pg.waitForTimeout(100);
  s=await pg.evaluate(()=>({open:!document.getElementById('p-where').hidden,top:document.getElementById('p-top-area').contains(document.getElementById('p-area')),pick:!document.getElementById('p-ans-pick').hidden}));
  assert(!s.open&&s.top&&s.pick,"skip: area status on top and a Pick your place button");
  // places are embedded
  s=await pg.evaluate(()=>({n:PLACES.sites.tv.length,b:PLACES.sites.tv.some(p=>p.kind==="barangay"),berk:PLACES.sites.berkeley.every(p=>p.kind==="sensor")}));
  assert(s.n>=18&&s.b&&s.berk,"places.json embedded with barangays for Philippine sites only");
  // pick a sensor street, storm peak -> Oo with square shape, reason names the street
  await pg.evaluate(()=>{setPlace("tv:s:BW-H07");playing=false;scenario="typhoon";tMin=495;lastEmit=-999;step(0,true);});
  s=await pg.evaluate(()=>({ans:document.getElementById('p-answer').dataset.answer,word:document.getElementById('p-ans-word').textContent,shape:getComputedStyle(document.getElementById('p-ans-shape')).borderRadius,reason:document.getElementById('p-ans-reason').textContent,live:document.querySelector('#p-answer [role=status]').getAttribute('aria-live'),bottom:document.getElementById('p-bottom-area').contains(document.getElementById('p-area'))}));
  assert(s.ans==="oo"&&s.shape==="3px"&&/Mayaman/.test(s.reason),"storm peak on Mayaman: Oo, square shape, reason naming the street: "+s.reason);
  assert(s.live==="polite","answer announced through a polite live region");
  assert(s.bottom,"with a place chosen, the area headline moves under the list");
  // dry day -> Hindi
  await pg.evaluate(()=>{scenario="clear";tMin=100;lastEmit=-999;step(0,true);});
  s=await pg.evaluate(()=>document.getElementById('p-answer').dataset.answer);
  assert(s==="hindi","dry day: Hindi");
  // nodata rendering is grey and dashed, never Hindi
  s=await pg.evaluate(()=>{showAnswer({answer:"nodata",reason:{key:"stale",vars:{}},updatedAt:null,etaMin:null});const e=document.getElementById('p-answer');return {a:e.dataset.answer,bs:getComputedStyle(e).borderStyle,w:document.getElementById('p-ans-word').textContent};});
  assert(s.a==="nodata"&&/dashed/.test(s.bs)&&!/Hindi|^No$/.test(s.w),"nodata: dashed grey box, not Hindi: "+s.w);
  // Filipino words
  await pg.selectOption('#p-lang','fil');await pg.evaluate(()=>{scenario="typhoon";tMin=495;lastEmit=-999;step(0,true);});
  s=await pg.evaluate(()=>({q:document.getElementById('p-ans-q').textContent,w:document.getElementById('p-ans-word').textContent}));
  assert(/Babaha ba\?/.test(s.q)&&s.w==="Oo","Filipino: Babaha ba? · Oo");
  // every language has every string
  s=await pg.evaluate(()=>{const need=["q","pick","pickBtn","whereQ","useLoc","pickBrgy","pickSensor","skip","age","justNow","locFail"];const miss=[];for(const k of Object.keys(ANS_LANGS)){const L=ANS_LANGS[k];for(const n of need)if(!L[n])miss.push(k+"."+n);for(const w of ["oo","baka","hindi","nodata"]){if(!L.word[w])miss.push(k+".word."+w);if(!L.gloss[w])miss.push(k+".gloss."+w);}for(const r of ["stale","sensor_now","sensor_soon","upstream","reports","reports_vs_dry_sensor","rain_flood_zone","rain_heavy","reports_few","sensor_trace","clear"])if(!L.reason[r])miss.push(k+".reason."+r);}return miss;});
  assert(s.length===0,"all six languages complete: "+s.join(","));
  // barangay pick
  await pg.evaluate(()=>{const b=PLACES.sites.tv.find(p=>p.kind==="barangay");setPlace(b.id);});
  s=await pg.evaluate(()=>({place:document.getElementById('p-ans-place').textContent,id:myPlace}));
  assert(/:b:/.test(s.id)&&s.place.length>2,"barangay place shows its name: "+s.place);
  // stored place that no longer exists -> picker opens again
  await pg.evaluate(()=>{localStorage.setItem("bw-place:tv","tv:b:GONE");});
  await pg.reload();await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>({open:!document.getElementById('p-where').hidden,my:myPlace}));
  assert(s.open&&s.my===null,"unknown stored place -> Saan ka? again");
  // old street picks migrate
  await pg.evaluate(()=>{localStorage.removeItem("bw-place:tv");localStorage.setItem("bw-street:tv","BW-H03");});
  await pg.reload();await pg.waitForTimeout(400);
  s=await pg.evaluate(()=>myPlace);
  assert(s==="tv:s:BW-H03","old My street pick migrates to a place");
  // Berkeley: no barangay choice
  await pg.click('.site-tabs [data-site="berkeley"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>{openWhere();return document.querySelector('#p-where [data-act="brgy"]').hidden;});
  assert(s===true,"Berkeley has no barangay choice");
  // 48 px targets, contrast of the answer word
  s=await pg.evaluate(()=>[...document.querySelectorAll('#p-where button')].filter(b=>!b.hidden).every(b=>b.getBoundingClientRect().height>=48));
  assert(s,"Saan ka? buttons are at least 48 px tall");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
