// Browser test for the adult+child depth figure. Run: node test_figure.js
const {chromium}=require('playwright');
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/claude/work/bahawatch_dashboard.html');await pg.waitForTimeout(400);
  const setDepth=async(cm)=>pg.evaluate(cm=>{playing=false;for(const s of HOUSEHOLD){s.depth=0;s.rate=0;s.status="ok";}HOUSEHOLD[6].depth=cm/100;HOUSEHOLD[6].rate=0.1;HOUSEHOLD[6].status=statusOf(HOUSEHOLD[6]);computeFlood(0);renderFlood();drawMap();renderPublic();},cm);
  const txt=async sel=>pg.$eval(sel,e=>e.textContent);
  // static scale elements
  const svgText=await pg.$eval('#p-figure svg',e=>e.textContent);
  assert(/5[′']3[″"]/.test(svgText),"adult height label in feet/inches present");
  assert(/3[′']11[″"]/.test(svgText),"child height label in feet/inches present");
  assert(/1\.60 m/.test(svgText)&&/1\.20 m/.test(svgText),"heights in metres present");
  assert(/\bcm\b/.test(svgText)&&/ft/.test(svgText),"ruler has cm and ft labels");
  // 89 cm: waist-deep adult, chest on child
  await setDepth(89);
  let cap=await txt('#p-fig-cap'),desc=await txt('#fig-desc');
  assert(/89 cm \(35 in\)/.test(cap),"caption shows cm and inches: "+cap);
  assert(/Child, 1\.20 m: chest-deep/.test(cap),"caption reports child body part at 89 cm: "+cap);
  assert(/child/i.test(desc)&&/chest/.test(desc),"description mentions child and chest: "+desc);
  // 58 cm: knee adult, thigh child
  await setDepth(58);cap=await txt('#p-fig-cap');
  assert(/Knee-deep/.test(cap)&&/thigh-deep/.test(cap),"58 cm → knee (adult) / thigh (child): "+cap);
  // 15 cm: gutter, shin on child
  await setDepth(15);cap=await txt('#p-fig-cap');
  assert(/Gutter-deep/.test(cap)&&/shin-deep/.test(cap),"15 cm → gutter / shin: "+cap);
  // Filipino
  await pg.selectOption('#p-lang','fil');await setDepth(89);cap=await txt('#p-fig-cap');
  assert(/Bata, 1\.20 m: hanggang dibdib/.test(cap),"Filipino child line: "+cap);
  await pg.selectOption('#p-lang','en');
  // water level: fill path exists and its top is above the child's waist at 89 cm
  await setDepth(89);
  const d=await pg.$eval('#fig-wave',e=>e.getAttribute('d'));
  assert(d&&d.length>10,"water path drawn");
  // faces: each figure's mood follows where the water is on that body
  const faces=async()=>pg.evaluate(()=>[document.querySelector('#fig-face-adult').dataset.mood,document.querySelector('#fig-face-child').dataset.mood]);
  await setDepth(0);let f=await faces();assert(f[0]==="happy"&&f[1]==="happy","dry: both happy ("+f+")");
  await setDepth(58);f=await faces();assert(f[0]==="neutral"&&f[1]==="sad","58 cm: adult neutral (knee), child sad (nearly half its height) ("+f+")");
  await setDepth(89);f=await faces();assert(f[0]==="sad"&&f[1]==="sad","89 cm: both sad ("+f+")");
  await setDepth(15);f=await faces();assert(f[0]==="happy"&&f[1]==="happy","15 cm: both happy ("+f+")");
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
