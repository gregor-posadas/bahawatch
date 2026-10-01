// Filipino words on the English pages are followed by their English meaning (Gregor, 2026-09-30: "make sure the
// filipino terms used in the English version of the page are followed by their english translations"), and the
// homepage explains its harder terms in notes that open on hover, focus or tap, like About.
// Rules checked: in every paragraph, list item, table cell, caption and note on Home, About and Accessibility,
// "Babaha ba?" comes with "Will it flood?", Oo with (yes), Baka with (maybe), Hindi with no, habagat with monsoon;
// "barangay" is glossed the first time it appears in each section. The English dashboard strings follow the same rules.
// Run: ./test_pages.sh test_words.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const errs=[];
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await ready(pg,"home");
  const check=root=>pg.evaluate(root=>{
    const R={babaha:[/Babaha ba\?/,/Will it flood\?/],oo:[/\bOo\b/,/\(yes\)/],baka:[/\bBaka\b/,/\(maybe\)/],hindi:[/\bHindi\b/,/\(no\)|“no”/],habagat:[/[Hh]abagat/,/monsoon/]};
    const bad=[];const blocks=[...document.querySelectorAll(`${root} :is(p,li,dd,dt,td,th,figcaption,summary,h3), ${root} .tt-p`)];
    for(const el of blocks){
      // a note's own text is checked as its own block; the sentence around it is checked without it
      const c=el.cloneNode(true);c.querySelectorAll('.tt-p').forEach(n=>{if(n!==c)n.remove();});
      // nested list items are checked on their own
      if(el.tagName==="LI")c.querySelectorAll('ul,ol').forEach(n=>n.remove());
      const t=c.textContent.replace(/\s+/g," ");
      for(const k in R){if(R[k][0].test(t)&&!R[k][1].test(t))bad.push(k+": "+t.slice(0,110));}
    }
    // barangay: glossed at its first appearance in each section
    for(const sec of document.querySelectorAll(`${root} > div section, ${root} section`)){
      const sc=sec.cloneNode(true);sc.querySelectorAll('.tt-p').forEach(n=>n.remove());const t=sc.textContent.replace(/\s+/g," ");const i=t.search(/\b[Bb]arangays?\b/);
      if(i>=0&&!/^[Bb]arangays? \((neighbourhood|village)/.test(t.slice(i)))bad.push("barangay in #"+sec.id+": "+t.slice(i,i+60));
    }
    return [...new Set(bad)];},root);
  for(const root of ['#home','#about','#access','#history']){
    const bad=await check(root);
    assert(bad.length===0,`${root}: every Filipino term is followed by its English meaning: ${bad.join(" || ")}`);
  }
  // the English dashboard strings
  const en=await pg.evaluate(()=>({brgy:LANGS.en.pickBrgy||ANS_LANGS.en.pickBrgy,fail:ANS_LANGS.en.locFail,em:LANGS.en.notEmergency||ANS_LANGS.en.notEmergency,chip:ANS_LANGS.en.demoScen.monsoon}));
  assert(/barangay \(neighbourhood\)/.test(en.brgy)&&/barangay \(neighbourhood\)/.test(en.fail),`English: "Pick my barangay (neighbourhood)" and the location-failed line gloss barangay: ${en.brgy} / ${en.fail}`);
  assert(/barangay \(village\) office/.test(en.em),`English: the emergency line says what the barangay is: ${en.em}`);
  assert(/habagat \(monsoon\)/.test(en.chip),`English: the demo chip glosses habagat: ${en.chip}`);
  await pg.goto(U+'#tv');await ready(pg,"tv");
  const sc=await pg.evaluate(()=>[...document.querySelectorAll('#public .p-scen button')].map(x=>x.textContent).join("|"));
  assert(sc==="Dry day|Habagat (monsoon)|Typhoon",`the weather buttons read Dry day, Habagat (monsoon), Typhoon: ${sc}`);
  // homepage notes: the harder terms open a note, as on About
  await pg.goto(U);await ready(pg,"home");
  const terms=await pg.evaluate(()=>[...document.querySelectorAll('#home .tt-b')].map(x=>x.textContent.trim()));
  const want=["disaster risk","tropical cyclones","Tino (Kalmaegi)","Bike Scouts Project","stream gauge","ultrasonic echo","LoRaWAN","gateway","surface level","Barangay","Building footprints","OpenStreetMap","FABDEM","mapped hazard zones","Neighbour reports","open source","storm generator"];
  const miss=want.filter(w=>!terms.some(t=>t.includes(w)));
  assert(miss.length===0&&terms.length>=want.length,`the homepage explains its harder terms in notes (${terms.length}): missing ${miss.join(", ")||"none"}`);
  assert(await pg.evaluate(()=>![...document.querySelectorAll('#home .tt-b')].some(x=>x.closest('a,button:not(.tt-b),b,h1,h2,h3'))),"no note sits inside a link, a button, bold text or a heading");
  // hover opens a note; it stays on screen at 375
  await pg.hover('#home .tt-b >> text=LoRaWAN');await pg.waitForTimeout(300);
  let s=await pg.evaluate(()=>{const p=[...document.querySelectorAll('#home .tt-p')].find(x=>!x.hidden);return p?{t:p.textContent,r:p.getBoundingClientRect().right}:null;});
  assert(s&&/radio/.test(s.t),`hovering LoRaWAN opens its note: ${s&&s.t.slice(0,60)}`);
  await pg.setViewportSize({width:375,height:800});await pg.mouse.move(1,1);await pg.waitForTimeout(300);
  await pg.click('#home .tt-b >> text=FABDEM');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>{const p=[...document.querySelectorAll('#home .tt-p')].find(x=>!x.hidden);const r=p&&p.getBoundingClientRect();return r?{l:r.left,r:r.right,w:innerWidth,sw:document.documentElement.scrollWidth}:null;});
  assert(s&&s.l>=0&&s.r<=s.w&&s.sw<=s.w,`375: tapping FABDEM opens its note inside the screen: ${JSON.stringify(s)}`);
  // the quote stresses "governance"
  assert(await pg.evaluate(()=>{const q=document.querySelector('.hm-quote p');const e=q.querySelector('b,strong');return e&&e.textContent==="governance";}),"the interview quote has “governance” in bold");
  assert(errs.length===0,"no page errors: "+errs.join(" | "));
  await b.close();
})();
