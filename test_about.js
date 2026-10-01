// The About tab (2026-09-29, for Noam's GHTC talk): how the dashboard works, the data, the sensor units and their assumed
// mounting, accuracy and biases, future work, and an FAQ, with notes on underlined terms (first "?" buttons; the terms themselves since Gregor found the "?" too big). Also the San Joaquin tab and the
// Details text trimmed behind the same tips. Run: ./test_pages.sh test_about.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
const openTips=pg=>pg.evaluate(()=>[...document.querySelectorAll('.tt-p')].filter(p=>!p.hidden).length);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const errs=[];
  for(const w of [1280,375]){
    const ctx=await b.newContext({viewport:{width:w,height:900}});
    await ctx.addInitScript(()=>{try{for(const k of ["tv","sjq"])localStorage.setItem("bw-asked:"+k,"1");}catch(e){}});
    const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
    await pg.goto(U+'#about');await ready(pg,"about");
    let s=await pg.evaluate(()=>({route:ROUTE,shown:getComputedStyle(document.getElementById('about')).display!=="none",nat:getComputedStyle(document.getElementById('nat')).display,
      tabs:[...document.querySelectorAll('.site-tabs')].map(n=>[...n.querySelectorAll('[role=tab]')].map(t=>t.dataset.site+(t.getAttribute('aria-selected')==="true"?"*":"")).join()),
      rail:[...document.querySelectorAll('#about .ab-rail a')].map(a=>a.textContent),h1:document.getElementById('ab-h').textContent,sw:document.documentElement.scrollWidth,
      small:[...document.querySelectorAll('#about a,#about button,#about summary')].filter(e=>e.offsetParent&&!e.closest('.site-tabs')&&!e.classList.contains('tt-b')&&!(e.tagName==='A'&&e.closest('.ab-main p,.ab-main .flow li'))&&e.getBoundingClientRect().height<48).length}));
    assert(s.route==="about"&&s.shown&&s.nat==="none"&&s.h1==="About BahaWatch",`${w}: #about opens the About page alone`);
    assert(s.tabs.length===7&&s.tabs.every(t=>t==="home,ph,tv,sjq,berkeley,try,history,about*,access"),`${w}: every tab bar has San Joaquin and About, About selected: ${s.tabs[0]}`);
    assert(s.rail.join("|")==="What it is|How it works|Data|Sensor units|Accuracy and limits|Future work|FAQ",`${w}: the contents rail lists the sections and the FAQ`);
    assert(s.sw<=w&&s.small===0,`${w}: no sideways scroll; rail links, buttons and FAQ questions are at least 48 px tall`);
    // the sensor placement and mounting assumptions are written down, and marked as assumptions
    s=await pg.evaluate(()=>{const t=document.getElementById('ab-sensors').textContent;return {tag:/Our assumptions, not yet field-tested/.test(t),h:/About 2 m above the road/.test(t),zero:/dry pavement/.test(t),rule:/0\.5 × how low it sits/.test(t),prop:/proposals/.test(t)};});
    assert(Object.values(s).every(Boolean),`${w}: Sensor units states the mounting height, zero point and placement rule, labelled as assumptions: ${JSON.stringify(s)}`);
    s=await pg.evaluate(()=>{const t=document.getElementById('about').textContent;return {synth:/This demo runs on synthetic data/.test(t),real:/In a real deployment/.test(t)&&/dashboard’s server/.test(t),exp:/UC Berkeley, California: an experiment/.test(t),noUnit:!/test (unit|sensor)/.test(t)};});
    assert(Object.values(s).every(Boolean),`${w}: About says the demo is synthetic, how real sensors would feed the server, that Berkeley was an experiment, and names no test unit: ${JSON.stringify(s)}`);
    s=await pg.evaluate(()=>{const t=document.getElementById('ab-limits').textContent;return /17,936/.test(t)&&/1\.4 m/.test(t)&&/2 m too high/.test(t)&&/by design/.test(t);});
    assert(s,`${w}: Accuracy and limits gives the ICESat-2 check and the demo's built-in agreement with NOAH`);
    // for researchers: the processing flowchart under Data, and every model setting under Accuracy and limits
    s=await pg.evaluate(()=>({st:[...document.querySelectorAll('#ab-data .flow-st h4')].map(h=>h.textContent.replace(/^\d/,'').split(/\s{2,}|build|pipeline|Designed/)[0].trim()),
      code:/build_data\.py/.test(document.getElementById('ab-data').textContent)&&/2 cm &lt;|2 cm </.test(document.getElementById('ab-data').innerHTML),
      rows:document.querySelectorAll('#ab-limits .ab-table tbody tr').length,bias:/cancels out/.test(document.getElementById('ab-limits').textContent),sw:document.documentElement.scrollWidth}));
    assert(s.st.length===6&&s.code&&s.rows>=13&&s.bias&&s.sw<=w,`${w}: About has a six-stage processing flowchart, a settings table and the note on how terrain bias cancels: ${JSON.stringify(s)}`);
    // deep links: #about/<section> scrolls there, focuses its heading and marks the rail
    await pg.goto(U+'#about/sensors');await ready(pg,"about");
    await pg.waitForFunction(()=>{const t=document.getElementById('ab-sensors-h').getBoundingClientRect().top;return t>=0&&t<60;},null,{timeout:4000}).catch(()=>{});await pg.waitForTimeout(150);   // a smooth scroll from the top
    s=await pg.evaluate(()=>({f:document.activeElement.id,cur:document.querySelector('.ab-rail a[aria-current]').dataset.sec,top:Math.round(document.getElementById('ab-sensors-h').getBoundingClientRect().top),hash:location.hash}));
    assert(s.f==="ab-sensors-h"&&s.cur==="sensors"&&s.top>=0&&s.top<60&&s.hash==="#about/sensors",`${w}: #about/sensors lands on Sensor units: ${JSON.stringify(s)}`);
    await pg.click('.ab-rail a[data-sec="faq"]');await pg.waitForTimeout(900);
    s=await pg.evaluate(()=>({hash:location.hash,cur:document.querySelector('.ab-rail a[aria-current]').dataset.sec,f:document.activeElement.id}));
    assert(s.hash==="#about/faq"&&s.cur==="faq"&&s.f==="ab-faq-h",`${w}: the rail's FAQ link goes to the FAQ: ${JSON.stringify(s)}`);
    await pg.click('#ab-faq summary >> nth=1');
    assert(await pg.evaluate(()=>document.querySelectorAll('#ab-faq details')[1].open&&document.querySelectorAll('#ab-faq details')[1].querySelector('p').offsetHeight>0),`${w}: an FAQ question opens its answer`);
    // "?" toggletips: tap/click pins, Escape closes and returns focus, a click elsewhere closes, one at a time
    await pg.goto(U+'#about/how');await ready(pg,"about");await pg.waitForTimeout(300);
    const tip=pg.locator('#ab-how .tt-b').nth(2);
    s=await pg.evaluate(()=>{const b=document.querySelectorAll('#ab-how .tt-b')[2],p=document.getElementById(b.getAttribute('aria-controls'));
      const cs=getComputedStyle(b);return {name:b.textContent,exp:b.getAttribute('aria-expanded'),hidden:p.hidden,next:b.nextElementSibling===p,bold:+cs.fontWeight>=700,under:/underline/.test(cs.textDecorationLine),q:document.querySelectorAll('.tt-b').length>0&&[...document.querySelectorAll('.tt-b')].every(x=>x.textContent!=="?")};});
    assert(s.name==="fades with distance"&&s.exp==="false"&&s.hidden&&s.next&&s.bold&&s.under&&s.q,`${w}: the term itself is the button, bold and underlined, its note hidden and next in reading order; no "?" left: ${JSON.stringify(s)}`);
    await tip.click();await pg.waitForTimeout(250);
    s=await pg.evaluate(()=>{const b=document.querySelectorAll('#ab-how .tt-b')[2],p=document.getElementById(b.getAttribute('aria-controls')),r=p.getBoundingClientRect(),br=b.getBoundingClientRect();
      return {exp:b.getAttribute('aria-expanded'),op:getComputedStyle(p).opacity,in:r.left>=15&&r.right<=innerWidth-15,below:r.top>br.bottom||r.bottom<br.top,px:parseFloat(getComputedStyle(p).fontSize),text:/1 cm for every 15 m/.test(p.textContent),sw:document.documentElement.scrollWidth,hit:(()=>{const a=getComputedStyle(b,'::after');return b.getBoundingClientRect().height+2*Math.abs(parseFloat(a.top));})()};});
    assert(s.exp==="true"&&s.op==="1"&&s.in&&s.below&&s.px>=14&&s.text&&s.sw<=w,`${w}: the note fades in beside its term, inside the window, 14 px: ${JSON.stringify(s)}`);
    assert(s.hit>=40,`${w}: the term's tap area reaches past its text (${s.hit} px tall)`);
    await pg.keyboard.press('Escape');
    s=await pg.evaluate(()=>({open:[...document.querySelectorAll('.tt-p')].filter(p=>!p.hidden).length,f:document.activeElement.textContent}));
    assert(s.open===0&&s.f==="fades with distance",`${w}: Escape closes the note and focus returns to its "?": ${JSON.stringify(s)}`);
    await tip.click();await pg.locator('#ab-how .tt-b').nth(0).click();
    assert(await openTips(pg)===1&&await pg.evaluate(()=>document.querySelectorAll('#ab-how .tt-b')[0].getAttribute('aria-expanded')==="true"),`${w}: opening another note closes the first`);
    await pg.mouse.click(5,Math.round(900*0.9));
    assert(await openTips(pg)===0,`${w}: a click elsewhere closes the note`);
    await tip.focus();await pg.keyboard.press('Enter');await pg.keyboard.press('Tab');
    assert(await openTips(pg)===0,`${w}: tabbing away closes the note`);
    if(w===1280){
      await pg.hover('#ab-how .tt-b >> nth=0');await pg.waitForTimeout(100);const on=await openTips(pg);
      await pg.mouse.move(1200,20);await pg.waitForTimeout(400);
      assert(on===1&&await openTips(pg)===0,"1280: hovering a \"?\" shows its note; moving away hides it");
    }
    // tabs: About → a site → About, and the browser's Back button
    await pg.click('#about .site-tabs [data-site="tv"]');await ready(pg,"tv");
    s=await pg.evaluate(()=>({route:ROUTE,hash:location.hash,about:getComputedStyle(document.getElementById('about')).display}));
    assert(s.route==="site"&&s.hash==="#tv"&&s.about==="none",`${w}: the Teachers Village tab leaves About`);
    await pg.click('#public .site-tabs [data-site="about"]');await ready(pg,"about");
    s=await pg.evaluate(()=>({route:ROUTE,hash:location.hash,playing,y:scrollY}));
    assert(s.route==="about"&&s.hash==="#about"&&s.playing===false&&s.y===0,`${w}: the About tab opens About at its top and pauses the storm: ${JSON.stringify(s)}`);
    await pg.goBack();await ready(pg,"tv");
    assert(await pg.evaluate(()=>ROUTE==="site"&&SITE==="tv"),`${w}: Back returns to Teachers Village`);
    await pg.goto(U+'#try');await ready(pg,"tv");await pg.click('#public .site-tabs [data-site="about"]');await ready(pg,"about");
    assert(await pg.evaluate(()=>!TRY&&location.hash==="#about"),`${w}: About from Try reporting leaves the pretend phone`);
    await ctx.close();
  }
  // reduced motion: the note appears without a fade
  {const ctx=await b.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
   await pg.goto(U+'#about');await ready(pg,"about");
   assert(await pg.evaluate(()=>getComputedStyle(document.querySelector('.tt-p')).transitionDuration==="0s"),"reduced motion: notes appear without a fade");
   await ctx.close();}
  // dark theme: the page and a note keep ≥ 4.5:1 text contrast
  {const ctx=await b.newContext({viewport:{width:1280,height:900},colorScheme:'dark'});const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
   await pg.goto(U+'#about/how');await ready(pg,"about");await pg.locator('#ab-how .tt-b').first().click();
   const s=await pg.evaluate(()=>{const rgb=c=>c.match(/[\d.]+/g).slice(0,3).map(Number),L=c=>{const v=rgb(c).map(x=>{x/=255;return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4;});return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];},
     cr=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);},bg=getComputedStyle(document.body).backgroundColor;
     const p=[...document.querySelectorAll('.tt-p')].find(p=>!p.hidden),pc=getComputedStyle(p);
     return {theme:document.documentElement.dataset.theme,body:cr(getComputedStyle(document.querySelector('.ab-main p')).color,bg),rail:cr(getComputedStyle(document.querySelector('.ab-rail a:not([aria-current])')).color,bg),use:cr(getComputedStyle(document.querySelector('.ab-use')).color,bg),note:cr(pc.color,pc.backgroundColor)};});
   assert(s.theme==="dark"&&s.body>=4.5&&s.rail>=4.5&&s.use>=4.5&&s.note>=4.5,"dark theme: About text and notes ≥ 4.5:1: "+JSON.stringify(s));
   await ctx.close();}
  // San Joaquin (Mabalacat City, Pampanga), next to Teachers Village in the tabs: its own site with eight units inside the barangay
  {const ctx=await b.newContext({viewport:{width:1280,height:900}});await ctx.addInitScript(()=>{try{localStorage.setItem("bw-asked:sjq","1");}catch(e){}});
   const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
   await pg.goto(U+'#tv');await ready(pg,"tv");await pg.click('#public .site-tabs [data-site="sjq"]');await ready(pg,"sjq");
   const s=await pg.evaluate(()=>({site:SITE,place:document.getElementById('p-place').textContent,units:HOUSEHOLD.length,ids:HOUSEHOLD.map(h=>h.id).join(),inside:DATA.sensors.every(u=>/San Joaquin/.test(u.brgy||u.bld||"")),
     sel:document.querySelector('#public .site-tabs [aria-selected=true]').dataset.site,noah:["5","25","100"].every(k=>DATA.noah&&DATA.noah[k])}));
   assert(s.site==="sjq"&&s.sel==="sjq"&&/San Joaquin/.test(s.place)&&/Mabalacat/.test(s.place),"the San Joaquin tab opens Brgy. San Joaquin, Mabalacat City: "+s.place);
   const pin=await pg.evaluate(()=>{const u=HOUSEHOLD.find(h=>h.id==="BW-SJQ-01");return u&&{bld:u.bld,near:u.near,lon:u.lon,lat:u.lat};});
   assert(pin&&pin.bld==="71 Imelda Marcos St · San Joaquin"&&pin.near===null&&Math.abs(pin.lon-120.57104)<1e-4&&Math.abs(pin.lat-15.23066)<1e-4,"San Joaquin: unit 01 at 71 Imelda Marcos St, where Gregor placed it: "+JSON.stringify(pin));
   assert(s.units===8&&/^BW-SJQ-01,.*BW-SJQ-08$/.test(s.ids)&&s.inside&&s.noah,"San Joaquin: eight units, all inside the barangay, with NOAH 5/25/100-year layers: "+JSON.stringify(s));
   await pg.click('#p-details');await pg.waitForTimeout(500);
   const d=await pg.evaluate(()=>{const f=document.querySelector('.foot-note');return {words:f.firstChild.textContent.trim().split(/\s+/).length,tip:!!f.querySelector('.tt-b'),nb:!!f.querySelector('#foot-nb'),link:f.querySelector('a[href="#about"]')?.textContent,
     rail:[...document.querySelectorAll('.rail-h')].map(h=>{const c=h.cloneNode(true);c.querySelectorAll('.tt-p').forEach(e=>e.remove());return c.textContent.trim();}).join("|"),hint:document.querySelector('#legend .hint').textContent};});
   assert(d.words<=14&&d.tip&&d.nb&&d.link==="About","Details: the footnote is one short line; the rest is behind a \"?\" and a link to About: "+JSON.stringify(d));
   assert(/^Selected unit\|Household units\|/.test(d.rail)&&d.hint.split(/\s+/).length<=14,"Details: shorter headings and legend hint: "+JSON.stringify(d));
   await ctx.close();}
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
