// Car scale + MMDA passability thresholds. Run: node test_car.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(BASE+'bahawatch_dashboard.html#tv');await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(400);
  const setDepth=async(cm)=>pg.evaluate(cm=>{playing=false;for(const s of HOUSEHOLD){s.depth=0;s.rate=0;s.status="ok";}HOUSEHOLD[6].depth=cm/100;HOUSEHOLD[6].status=statusOf(HOUSEHOLD[6]);computeFlood(0);renderFlood();drawMap();renderPublic();},cm);
  const cap=async()=>pg.$eval('#p-fig-cap',e=>e.textContent);
  const svg=await pg.$eval('#p-figure svg',e=>e.textContent);
  assert(/half-tire/.test(svg)&&/tire/.test(svg),"car ticks present (half-tire, tire)");
  assert(await pg.$('#fig-car')!==null,"car figure drawn");
  // thresholds from the MMDA gauge / Mamuyac et al. 2025: 25 slow, 33 NPLV, 66 NPATV
  const st=async cm=>pg.evaluate(cm=>statusOf({depth:cm/100}),cm);
  assert(await st(30)==="warn"&&await st(33)==="alert","'flooded' shape starts at 33 cm (half-tire), not 45");
  const passAt=async cm=>pg.evaluate(cm=>T().pass[passIdx(cm/100)],cm);
  assert(/all vehicles/.test(await passAt(20)),"20 cm: passable to all vehicles");
  assert(/slowly/.test(await passAt(28)),"28 cm: passable — drive slowly");
  assert(/light vehicles/.test(await passAt(40)),"40 cm: not passable to light vehicles");
  assert(/any vehicle/.test(await passAt(70)),"70 cm: not passable to any vehicle");
  // caption carries a car line
  await setDepth(40);let c=await cap();
  assert(/Sedan/.test(c)&&/tire/.test(c)&&/light vehicles/.test(c),"40 cm caption has the sedan line: "+c);
  await setDepth(70);c=await cap();
  assert(/any vehicle/.test(c),"70 cm caption: not passable to any vehicle: "+c);
  await setDepth(10);c=await cap();
  assert(/Sedan/.test(c)&&/all vehicles/.test(c),"10 cm caption: sedan passable: "+c);
  // headline counts 'not passable' streets at the new threshold
  await pg.evaluate(()=>{for(const s of HOUSEHOLD){s.depth=0.35;s.status=statusOf(s);}renderPublic();});
  const head=await pg.$eval('#p-headline',e=>e.textContent);
  assert(/not passable to light vehicles/.test(head),"headline uses 33 cm cutoff: "+head);
  // description mentions the car
  await setDepth(40);const desc=await pg.$eval('#fig-desc',e=>e.textContent);
  assert(/sedan/i.test(desc),"screen-reader description mentions the sedan: "+desc);
  // front-view sedan with real parts, and scale type that reads at 100 % zoom on a laptop
  const parts=await pg.evaluate(()=>({tires:document.querySelectorAll('#fig-car .tire').length,ws:!!document.querySelector('#fig-car .windshield'),hl:document.querySelectorAll('#fig-car .headlight').length,mir:document.querySelectorAll('#fig-car .mirror').length}));
  assert(parts.tires===2&&parts.ws&&parts.hl===2&&parts.mir===2,"sedan has two tires, a windshield, two headlights, two mirrors: "+JSON.stringify(parts));
  const px=await pg.evaluate(()=>{const r=[...document.querySelectorAll('#fig-ruler text')].filter(t=>/^\d+$/.test(t.textContent));const c=[...document.querySelectorAll('#fig-car-ticks text[data-car], #fig-bike-ticks text[data-bike]')].filter(t=>t.textContent.length>2);
    const h=el=>el.getBoundingClientRect().height;return {ruler:Math.min(...r.map(h)),car:Math.min(...c.map(h)),n:r.length}});
  assert(px.n>=5&&px.ruler>=9&&px.car>=9,"ruler numbers and car tick labels render ≥ 9 px tall at 1280 px: "+JSON.stringify(px));
  // motorcycle (underbone) with BahaWatch's exhaust rule: slow from 15 cm (engine), not passable from 30 cm (exhaust / footpegs)
  const bike=await pg.evaluate(()=>({g:!!document.querySelector('#fig-bike'),tire:document.querySelectorAll('#fig-bike .tire').length,mir:document.querySelectorAll('#fig-bike .mirror').length,
    ticks:[...document.querySelectorAll('#fig-bike-ticks text')].map(t=>t.textContent).join('|'),idx:[10,20,35].map(cm=>bikeIdx(cm/100)).join(',')}));
  assert(bike.g&&bike.tire===1&&bike.mir===2,"motorcycle drawn with a tire and two mirrors: "+JSON.stringify(bike));
  assert(/engine/.test(bike.ticks)&&/exhaust/.test(bike.ticks),"motorcycle ticks name the engine and exhaust: "+bike.ticks);
  assert(bike.idx==="1,2,3","bike verdict index: 10 cm passable, 20 cm slow, 35 cm not passable: "+bike.idx);
  await setDepth(20);c=await cap();
  assert(/Motorcycle/.test(c)&&/ride slowly/.test(c),"20 cm caption: motorcycle ride slowly: "+c);
  await setDepth(40);c=await cap();
  assert(/Motorcycle: over the exhaust · not passable/.test(c),"40 cm caption: motorcycle not passable: "+c);
  const d2=await pg.$eval('#fig-desc',e=>e.textContent);
  assert(/motorcycle/i.test(d2),"screen-reader description mentions the motorcycle: "+d2);
  await setDepth(10);c=await cap();
  assert(/Motorcycle: under the engine · passable/.test(c),"10 cm caption: motorcycle passable: "+c);
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
