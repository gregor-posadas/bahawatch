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
  // baseline sizes for the area line while it's still at the top (no place chosen) — used below to check it shrinks
  const topArea=await pg.evaluate(()=>({hlSize:parseFloat(getComputedStyle(document.getElementById('p-headline')).fontSize),updSize:parseFloat(getComputedStyle(document.getElementById('p-updated')).fontSize)}));
  // places are embedded
  s=await pg.evaluate(()=>({n:PLACES.sites.tv.length,b:PLACES.sites.tv.some(p=>p.kind==="barangay"),berk:PLACES.sites.berkeley.every(p=>p.kind==="sensor")}));
  assert(s.n>=18&&s.b&&s.berk,"places.json embedded with barangays for Philippine sites only");
  // pick a sensor street, storm peak -> Oo with square shape, reason names the street
  await pg.evaluate(()=>{setPlace("tv:s:BW-H07");playing=false;scenario="typhoon";tMin=495;lastEmit=-999;step(0,true);});
  s=await pg.evaluate(()=>({ans:document.getElementById('p-answer').dataset.answer,word:document.getElementById('p-ans-word').textContent,
    shape:getComputedStyle(document.getElementById('p-ans-shape')).borderRadius,
    reason:document.getElementById('p-ans-reason').textContent,
    bottom:document.getElementById('p-bottom-area').contains(document.getElementById('p-area'))}));
  assert(s.ans==="oo"&&s.shape==="3px"&&/Mayaman/.test(s.reason),"storm peak on Mayaman: Oo, square shape, reason naming the street: "+s.reason);
  assert(s.bottom,"with a place chosen, the area headline moves under the list");
  // the visible answer text is no longer itself a live region — a visually-hidden #p-ans-announce is
  s=await pg.evaluate(()=>{
    const ann=document.getElementById('p-ans-announce'),cs=getComputedStyle(ann);
    return {role:ann.getAttribute('role'),live:ann.getAttribute('aria-live'),
      hiddenVisually:cs.position==="absolute"&&parseFloat(cs.width)<=1&&parseFloat(cs.height)<=1,
      text:ann.textContent,
      visibleNotLive:!document.querySelector('#p-answer .p-ans-live[role], #p-answer .p-ans-live[aria-live]')};
  });
  assert(s.role==="status"&&s.live==="polite"&&s.hiddenVisually,"a visually-hidden #p-ans-announce carries role=status/aria-live=polite: "+JSON.stringify(s));
  assert(s.visibleNotLive,"the visible word/gloss/reason are plain text, not themselves a live region");
  assert(/Yes/.test(s.text)&&/Mayaman/.test(s.text),"announcement names the word and the reason: "+s.text);
  // stepping forward within the same answer state must NOT rewrite the announcement (no per-tick re-announce)
  s=await pg.evaluate(async()=>{
    const ann=document.getElementById('p-ans-announce');
    let mutations=0;const mo=new MutationObserver(()=>mutations++);
    mo.observe(ann,{childList:true,characterData:true,subtree:true});
    const before=ann.textContent;
    for(let i=0;i<5;i++){tMin+=1;lastEmit=-999;step(0,true);}
    await new Promise(r=>setTimeout(r,0));   // let any queued MutationObserver callback actually fire before disconnecting
    mo.disconnect();
    return {mutations,unchanged:ann.textContent===before,stillOo:document.getElementById('p-answer').dataset.answer==="oo"};
  });
  assert(s.stillOo&&s.mutations===0&&s.unchanged,"same answer state across several ticks does not rewrite the hidden announcement: "+JSON.stringify(s));
  // area headline/sub/updated keep their severity styling (colour + hierarchy) once moved under the list, just smaller
  s=await pg.evaluate(()=>{
    const toRGB=v=>{const d=document.createElement('span');d.style.color=v;document.body.appendChild(d);const c=getComputedStyle(d).color;d.remove();return c;};
    const alertRGB=toRGB(getComputedStyle(document.documentElement).getPropertyValue('--alert').trim());
    const ink2RGB=toRGB(getComputedStyle(document.documentElement).getPropertyValue('--ink-2').trim());
    const hl=document.getElementById('p-headline'),upd=document.getElementById('p-updated');
    return {tier:document.getElementById('p-area').className,hlColor:getComputedStyle(hl).color,alertRGB,
      updColor:getComputedStyle(upd).color,ink2RGB,
      hlSize:parseFloat(getComputedStyle(hl).fontSize),updSize:parseFloat(getComputedStyle(upd).fontSize)};
  });
  assert(/tier-alert/.test(s.tier),"the tier class travels onto #p-area so its styling holds wherever it lives: "+s.tier);
  assert(s.hlColor===s.alertRGB,"headline keeps its --alert severity colour once moved under the list: "+s.hlColor+" vs "+s.alertRGB);
  assert(s.updColor===s.ink2RGB,"updated line keeps its --ink-2 colour once moved under the list: "+s.updColor+" vs "+s.ink2RGB);
  assert(s.hlSize<topArea.hlSize&&s.updSize<=topArea.updSize,`area line is visibly smaller under the list than at the top: headline ${s.hlSize}px vs ${topArea.hlSize}px, updated ${s.updSize}px vs ${topArea.updSize}px`);
  // dry day -> Hindi; a real state change (oo -> hindi) rewrites the hidden announcement exactly once
  s=await pg.evaluate(async()=>{
    const ann=document.getElementById('p-ans-announce');
    let mutations=0;const mo=new MutationObserver(()=>mutations++);
    mo.observe(ann,{childList:true,characterData:true,subtree:true});
    scenario="clear";tMin=100;lastEmit=-999;step(0,true);
    await new Promise(r=>setTimeout(r,0));
    mo.disconnect();
    return {mutations,text:ann.textContent,ans:document.getElementById('p-answer').dataset.answer};
  });
  assert(s.ans==="hindi","dry day: Hindi");
  assert(s.mutations===1,"a real state change rewrites the hidden announcement exactly once: "+s.mutations);
  assert(/No/.test(s.text),"announcement updates to the new state's word: "+s.text);
  // nodata rendering is grey and dashed, never Hindi
  s=await pg.evaluate(()=>{showAnswer({answer:"nodata",reason:{key:"stale",vars:{}},updatedAt:null,etaMin:null});const e=document.getElementById('p-answer');return {a:e.dataset.answer,bs:getComputedStyle(e).borderStyle,w:document.getElementById('p-ans-word').textContent};});
  assert(s.a==="nodata"&&/dashed/.test(s.bs)&&!/Hindi|^No$/.test(s.w),"nodata: dashed grey box, not Hindi: "+s.w);
  // Filipino words
  await pg.selectOption('#p-lang','fil');await pg.evaluate(()=>{scenario="typhoon";tMin=495;lastEmit=-999;step(0,true);});
  s=await pg.evaluate(()=>({q:document.getElementById('p-ans-q').textContent,w:document.getElementById('p-ans-word').textContent}));
  assert(/Babaha ba\?/.test(s.q)&&s.w==="Oo","Filipino: Babaha ba? · Oo");
  // switching language ALONE (place/scenario/tMin unchanged) must re-announce exactly once, in the new language —
  // the debounce key must include LANG, not just place/answer/reason. fil and ceb both happen to say "Oo", so
  // pick a language with a visibly different word for "oo" (ilo: "Wen") to make the check unambiguous.
  s=await pg.evaluate(()=>document.getElementById('p-ans-announce').textContent);
  const beforeLangSwitch=s;
  s=await pg.evaluate(()=>{window.__ann=document.getElementById('p-ans-announce');window.__muts=0;window.__mo=new MutationObserver(()=>window.__muts++);window.__mo.observe(window.__ann,{childList:true,characterData:true,subtree:true});});
  await pg.selectOption('#p-lang','ilo');
  s=await pg.evaluate(async()=>{await new Promise(r=>setTimeout(r,0));window.__mo.disconnect();return {mutations:window.__muts,text:window.__ann.textContent,ans:document.getElementById('p-answer').dataset.answer};});
  assert(s.ans==="oo"&&s.mutations===1&&/Wen/.test(s.text)&&!/Oo/.test(s.text)&&s.text!==beforeLangSwitch,"language switch alone (no scenario/tMin change) re-announces exactly once in the new language: "+JSON.stringify(s));
  // ticking afterwards, still in the new language and the same answer state, must not rewrite it again
  s=await pg.evaluate(async()=>{
    const ann=document.getElementById('p-ans-announce');
    let mutations=0;const mo=new MutationObserver(()=>mutations++);
    mo.observe(ann,{childList:true,characterData:true,subtree:true});
    const before=ann.textContent;
    for(let i=0;i<5;i++){tMin+=1;lastEmit=-999;step(0,true);}
    await new Promise(r=>setTimeout(r,0));
    mo.disconnect();
    return {mutations,unchanged:ann.textContent===before};
  });
  assert(s.mutations===0&&s.unchanged,"after a language-only switch, further ticks in the same state do not re-announce: "+JSON.stringify(s));
  // every language has every string
  s=await pg.evaluate(()=>{const need=["q","pick","pickBtn","whereQ","useLoc","pickBrgy","pickSensor","skip","age","justNow","locFail"];const miss=[];for(const k of Object.keys(ANS_LANGS)){const L=ANS_LANGS[k];for(const n of need)if(!L[n])miss.push(k+"."+n);for(const w of ["oo","baka","hindi","nodata"]){if(!L.word[w])miss.push(k+".word."+w);if(!L.gloss[w])miss.push(k+".gloss."+w);}for(const r of ["stale","sensor_now","sensor_soon","upstream","reports","reports_vs_dry_sensor","rain_flood_zone","rain_heavy","reports_few","sensor_trace","clear","clear_no_sensor"])if(!L.reason[r])miss.push(k+".reason."+r);}return miss;});
  assert(s.length===0,"all six languages complete: "+s.join(","));
  // I9: the no-sensor Hindi reason has its own exact wording in every language
  s=await pg.evaluate(()=>Object.fromEntries(Object.keys(ANS_LANGS).map(k=>[k,ANS_LANGS[k].reason.clear_no_sensor])));
  assert(s.en==="No heavy rain or flood reports nearby. No sensor here yet."&&s.fil==="Walang malakas na ulan o ulat ng baha sa malapit. Wala pang sensor dito."
    &&s.ceb==="Walay kusog nga ulan o taho sa baha duol diri. Wala pay sensor diri."&&s.ilo==="Awan ti napigsa a tudo wenno damag ti layus iti asideg. Awan pay ti sensor ditoy."
    &&s.hil==="Wala sang mabaskog nga ulan ukon report sang baha malapit diri. Wala pa sang sensor diri."&&s.pam==="Alang makusog a uran o report ning albug malapit keni. Ala pang sensor keni.",
    "clear_no_sensor strings, six languages: "+JSON.stringify(s));
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
  // place picked on tv, "oo" naming the street — then switch to Berkeley (no stored place there): the announcement
  // must lose the tv street identifier and become exactly the pick-your-place prompt, not the old site's leftover text.
  await pg.evaluate(()=>{showAnswer({answer:"oo",reason:{key:"sensor_now",vars:{name:"22 Malingap St",cm:50}},updatedAt:Date.now(),etaMin:0});});
  s=await pg.evaluate(()=>document.getElementById('p-ans-announce').textContent);
  assert(/Malingap/.test(s),"setup: announcement names the tv street before switching sites: "+s);
  await pg.click('.site-tabs [data-site="berkeley"]');await pg.waitForTimeout(300);
  s=await pg.evaluate(()=>({text:document.getElementById('p-ans-announce').textContent,pick:ANS_LANGS.en.pick,place:myPlace}));
  assert(!/Malingap/.test(s.text)&&s.text===s.pick&&s.place===null,"switching to a no-place site clears the previous site's announcement to the pick-your-place prompt: "+JSON.stringify(s));
  // ticking on the no-place site must not repeatedly rewrite the pick-your-place announcement
  s=await pg.evaluate(async()=>{
    const ann=document.getElementById('p-ans-announce');
    let mutations=0;const mo=new MutationObserver(()=>mutations++);
    mo.observe(ann,{childList:true,characterData:true,subtree:true});
    const before=ann.textContent;
    for(let i=0;i<5;i++){tMin+=1;lastEmit=-999;step(0,true);}
    await new Promise(r=>setTimeout(r,0));
    mo.disconnect();
    return {mutations,unchanged:ann.textContent===before};
  });
  assert(s.mutations===0&&s.unchanged,"on the no-place site, ticking does not repeatedly rewrite the pick-your-place announcement: "+JSON.stringify(s));
  // Berkeley: no barangay choice
  s=await pg.evaluate(()=>{openWhere();return document.querySelector('#p-where [data-act="brgy"]').hidden;});
  assert(s===true,"Berkeley has no barangay choice");
  // 48 px targets, contrast of the answer word
  s=await pg.evaluate(()=>[...document.querySelectorAll('#p-where button')].filter(b=>!b.hidden).every(b=>b.getBoundingClientRect().height>=48));
  assert(s,"Saan ka? buttons are at least 48 px tall");
  // WCAG contrast (>=4.5:1) for every text element in the answer band, in every state, in both themes —
  // computed from actual rendered colours (getComputedStyle), not hard-coded hex guesses.
  const checkAnswerContrast=()=>pg.evaluate(()=>{
    const toRGBArr=c=>c.match(/[\d.]+/g).map(Number).slice(0,3);
    const relLum=([r,g,b])=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);};
    const contrast=(c1,c2)=>{const l1=relLum(toRGBArr(c1)),l2=relLum(toRGBArr(c2));const hi=Math.max(l1,l2),lo=Math.min(l1,l2);return (hi+0.05)/(lo+0.05);};
    const alpha=c=>{const m=c.match(/^rgba?\(([^)]+)\)$/);if(!m)return 1;const p=m[1].split(",").map(Number);return p.length>3?p[3]:1;};
    const effectiveBg=el=>{let e=el;while(e){const bg=getComputedStyle(e).backgroundColor;if(alpha(bg)>0)return bg;e=e.parentElement;}return getComputedStyle(document.body).backgroundColor;};
    const states=["oo","baka","hindi","nodata"];
    const ids=["p-ans-q","p-ans-place","p-ans-word","p-ans-gloss","p-ans-reason","p-ans-age","p-ans-pick"];
    const box=document.getElementById("p-answer"),pick=document.getElementById("p-ans-pick");
    const origAnswer=box.dataset.answer,origPickHidden=pick.hidden;
    pick.hidden=false;
    const fails=[];
    for(const st of states){
      box.dataset.answer=st;
      for(const id of ids){
        const el=document.getElementById(id);
        const ratio=contrast(getComputedStyle(el).color,effectiveBg(el));
        if(ratio<4.5)fails.push(`${st}/${id}=${ratio.toFixed(2)}`);
      }
    }
    box.dataset.answer=origAnswer;pick.hidden=origPickHidden;
    return fails;
  });
  await pg.evaluate(()=>setTheme("light",true));
  let failsLight=await checkAnswerContrast();
  assert(failsLight.length===0,"light theme: every answer-band text element is >=4.5:1 in every state: "+failsLight.join(", "));
  await pg.evaluate(()=>setTheme("dark",true));
  let failsDark=await checkAnswerContrast();
  assert(failsDark.length===0,"dark theme: every answer-band text element is >=4.5:1 in every state: "+failsDark.join(", "));
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
