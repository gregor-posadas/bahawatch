// Raised controls (Gregor, 2026-09-30: "Love the raised and sinked buttons... implement this in all of the buttons, or
// wherever it makes the most sense"). Action buttons and link-buttons sit on a hard ink shadow; pressing one sinks it
// into its shadow; a selected choice in a group (the weather scenario, the simulated sensor reading) stays sunk.
// Tabs, list rows, map pins and the pill groups in the Details view keep their own look. Run: ./test_pages.sh test_raise.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
// what a raised control looks like: an offset shadow and no shift; sunk: shifted by the lift and no shadow
const look=(pg,sel)=>pg.evaluate(s=>[...document.querySelectorAll(s)].filter(e=>e.offsetParent||getComputedStyle(e).position==="fixed").map(e=>{const cs=getComputedStyle(e);
  return {id:e.id||e.className||e.textContent.trim().slice(0,20),sh:cs.boxShadow,tf:cs.transform};}),sel);
const raised=x=>/rgb[^)]*\) [3-5]px [3-5]px 0px/.test(x.sh)&&(x.tf==="none"||x.tf==="matrix(1, 0, 0, 1, 0, 0)");
const sunk=x=>(x.sh==="none"||/ 0px 0px 0px/.test(x.sh))&&/matrix\(1, 0, 0, 1, [3-5], [3-5]\)/.test(x.tf);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const errs=[];
  for(const w of [1280,375]){
    const ctx=await b.newContext({viewport:{width:w,height:900}});
    await ctx.addInitScript(()=>{try{for(const k of ["tv","sjq"])localStorage.setItem("bw-asked:"+k,"1");}catch(e){}});
    const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
    // homepage: the buttons, LinkedIn links, copy button and collaborator logos are raised
    await pg.goto(U);await ready(pg,"home");
    let s=await look(pg,'#home .hm-btn,#hm-theme,#home .hm-in,#hm-copy,#home .hm-logos a');
    assert(s.length>=10&&s.every(raised),`${w}: homepage buttons, LinkedIn links, Copy and logos are raised: ${s.filter(x=>!raised(x)).map(x=>x.id+" "+x.sh).join(" | ")||s.length}`);
    // the simple site view
    await pg.goto(U+'#tv');await ready(pg,"tv");await pg.waitForTimeout(300);
    s=await look(pg,'#p-theme,#public .p-link,.p-scen button:not(.active),#to-country,#p-lang');
    assert(s.length>=6&&s.every(raised),`${w}: in the simple view the theme, Details, Choose my street, the other scenarios, Whole country and the language menu are raised: ${s.filter(x=>!raised(x)).map(x=>x.id+" "+x.sh+" "+x.tf).join(" | ")||s.length}`);
    s=await look(pg,'.p-scen button.active');
    assert(s.length===1&&s.every(sunk),`${w}: the chosen weather stays sunk: ${JSON.stringify(s)}`);
    // pressing sinks a button; it comes back up after
    const box=await pg.locator('#p-my-btn').boundingBox();
    await pg.mouse.move(box.x+box.width/2,box.y+box.height/2);await pg.mouse.down();await pg.waitForTimeout(300);
    s=await look(pg,'#p-my-btn');const down=s[0];
    await pg.mouse.up();await pg.keyboard.press('Escape');await pg.waitForTimeout(400);
    s=await look(pg,'#p-my-btn');
    assert(sunk(down)&&raised(s[0]),`${w}: pressing a button sinks it into its shadow, and it comes back up: ${down.tf} → ${s[0].tf}`);
    // a quick tap still shows the press (the sunk state is held for a moment)
    await pg.evaluate(()=>{const e=document.getElementById('p-theme');e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}));e.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch'}));});
    const held=await pg.evaluate(()=>document.getElementById('p-theme').classList.contains('rz-press'));
    await pg.waitForTimeout(300);
    const gone=await pg.evaluate(()=>!document.getElementById('p-theme').classList.contains('rz-press'));
    assert(held&&gone,`${w}: a quick tap holds the sunk look briefly, then lets go`);
    // keyboard: Enter or Space shows the press too
    await pg.focus('#p-theme');await pg.keyboard.down(' ');
    const kd=await pg.evaluate(()=>document.getElementById('p-theme').classList.contains('rz-press'));
    await pg.keyboard.up(' ');await pg.waitForTimeout(300);
    assert(kd,`${w}: pressing Space on a focused button sinks it as well`);
    await pg.evaluate(()=>setTheme("light",false));
    // the Details view: Simple view, the theme, Zoom to unit, play and the map's Whole country button
    await pg.goto(U+'#tv/details');await pg.waitForFunction(()=>document.body.dataset.view==="details",null,{timeout:15000});await pg.waitForTimeout(400);
    s=await look(pg,'#d-simple,#theme-toggle,#f-zoom,#play,#to-country');
    assert(s.length>=4&&s.every(raised),`${w}: in the Details view the action buttons are raised: ${s.filter(x=>!raised(x)).map(x=>x.id+" "+x.sh).join(" | ")||s.length}`);
    s=await look(pg,'.site-tabs [role=tab],.scenarios button,.speed button,.noah-chips button,.house-card');
    assert(s.every(x=>!/[3-5]px [3-5]px 0px/.test(x.sh)),`${w}: tabs, pill groups and unit cards keep their own look`);
    // the national map: zoom, home, theme and the open buttons
    await pg.goto(U+'#ph');await ready(pg,"ph");
    s=await look(pg,'#nat-theme,.nat-zoom button,#nat-lang');
    assert(s.length>=4&&s.every(raised),`${w}: on the national map the zoom, home, theme and language controls are raised: ${s.filter(x=>!raised(x)).map(x=>x.id+" "+x.sh).join(" | ")||s.length}`);
    // Try reporting: the report buttons, neighbour buttons and Reset are raised; the chosen sensor reading is sunk
    await pg.goto(U+'#try');await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(300);
    s=await look(pg,'.p-rep-btns button,#try-add-oo,#try-add-hindi,#try-reset,.try-row button[aria-pressed="false"]');
    assert(s.length>=8&&s.every(raised),`${w}: Try reporting's buttons are raised: ${s.filter(x=>!raised(x)).map(x=>x.id+" "+x.sh).join(" | ")||s.length}`);
    s=await look(pg,'.try-row button[aria-pressed="true"]');
    assert(s.length===1&&s.every(sunk),`${w}: the chosen sensor reading stays sunk`);
    await pg.click('.try-row button[data-cm="20"]');await pg.waitForTimeout(400);
    s=await look(pg,'.try-row button[data-cm="20"]');
    assert(sunk(s[0]),`${w}: choosing another reading sinks it`);
    // About and Accessibility theme buttons
    await pg.goto(U+'#about');await ready(pg,"about");
    s=await look(pg,'#ab-theme');assert(s.length===1&&raised(s[0]),`${w}: About's theme button is raised`);
    // dark theme: the shadow is the light ink, so the lift still shows
    await pg.evaluate(()=>setTheme("dark",false));await pg.waitForTimeout(100);
    s=await pg.evaluate(()=>{const cs=getComputedStyle(document.getElementById('ab-theme'));return {sh:cs.boxShadow,bg:getComputedStyle(document.body).backgroundColor};});
    const lum=c=>{const m=c.match(/\d+/g).slice(0,3).map(Number);return m.reduce((a,b)=>a+b,0)/3;};
    assert(lum(s.sh)-lum(s.bg)>120,`${w}: in the dark theme the shadow is light against the page: ${s.sh} on ${s.bg}`);
    await pg.evaluate(()=>setTheme("light",false));
    assert(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${w}: no sideways scroll`);
    await ctx.close();
  }
  // reduced motion: the press does not move the button (the shadow only thins), and nothing transitions
  {const ctx=await b.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
   await ctx.addInitScript(()=>{try{localStorage.setItem("bw-asked:tv","1");}catch(e){}});
   const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
   await pg.goto(U+'#tv');await ready(pg,"tv");
   const box=await pg.locator('#p-theme').boundingBox();
   await pg.mouse.move(box.x+box.width/2,box.y+box.height/2);await pg.mouse.down();await pg.waitForTimeout(100);
   const s=await pg.evaluate(()=>{const cs=getComputedStyle(document.getElementById('p-theme'));return {tf:cs.transform,tr:cs.transitionDuration,sh:cs.boxShadow};});
   await pg.mouse.up();
   const a=await pg.evaluate(()=>{const cs=getComputedStyle(document.querySelector('.p-scen button.active'));return cs.transform;});
   assert(s.tf==="none"&&/^0s/.test(s.tr)&&/1px 1px 0px/.test(s.sh)&&a==="none","reduced motion: a press thins the shadow but nothing moves: "+JSON.stringify({s,a}));
   await ctx.close();}
  assert(errs.length===0,"no page errors: "+errs.join(" | "));
  await b.close();
})();
