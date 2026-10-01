// The homepage (2026-09-30, Gregor; reworked the same night): a plain link opens it. Why BahaWatch exists (with
// references), how it works (five stops and a side-view-to-map figure, always moving unless motion is reduced), raised
// explore cards that sink when pressed, the team with LinkedIn, collaborators and a call to partner, the timeline, and
// one contact (Noam) with a copy button. Run: ./test_pages.sh test_home.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
const TABS="home,ph,tv,sjq,berkeley,try,about,access";
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const errs=[];
  for(const w of [1280,375]){
    const ctx=await b.newContext({viewport:{width:w,height:900},permissions:['clipboard-read','clipboard-write']});const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
    const files=[],bad=[];pg.on('request',r=>{const m=r.url().match(/\/data\/(\w+)\.json/);if(m)files.push(m[1]);});
    pg.on('response',r=>{if(r.status()>=400)bad.push(r.status()+" "+r.url());});
    await pg.goto(U);await ready(pg,"home");
    let s=await pg.evaluate(()=>({route:ROUTE,hash:location.hash,shown:getComputedStyle(document.getElementById('home')).display,nat:getComputedStyle(document.getElementById('nat')).display,
      tabs:[...document.querySelectorAll('.site-tabs')].map(n=>[...n.querySelectorAll('[role=tab]')].map(t=>t.dataset.site+(t.getAttribute('aria-selected')==="true"?"*":"")).join()),
      title:document.title,sw:document.documentElement.scrollWidth,h1:document.getElementById('hm-h').textContent}));
    assert(s.route==="home"&&s.hash===""&&s.shown!=="none"&&s.nat==="none"&&s.h1==="BahaWatch"&&/BahaWatch/.test(s.title),`${w}: a plain link opens the homepage, alone`);
    assert(s.tabs.length===6&&s.tabs.every(t=>t===TABS.replace("home","home*")),`${w}: every tab bar starts with Home and ends with Accessibility: ${s.tabs[0]}`);
    assert(s.sw<=w&&files.length===0,`${w}: no sideways scroll; no site file fetched (${files})`);
    // why: no reference list; each figure's key words link straight to its source (Gregor, 2026-10-01), the source is
    // named on hover or focus and to screen readers
    s=await pg.evaluate(()=>{const src=[...document.querySelectorAll('#hm-why a.src')];
      return {list:document.querySelectorAll('.hm-refs,.hm-ref').length,stats:[...document.querySelectorAll('.hm-stats li')].map(l=>!!l.querySelector('a.src')),
        links:src.map(a=>({h:a.href,src:a.dataset.src,sr:(a.querySelector('.sr-only')||{}).textContent||""})),wrr:(src.find(a=>/reliefweb\.int/.test(a.href))||{}).dataset};});
    assert(s.list===0&&s.stats.length===4&&s.stats.every(Boolean),`${w}: no reference list; every figure in "Why BahaWatch" links its source in the text: ${JSON.stringify(s.stats)}`);
    assert(s.links.length>=7&&s.links.every(l=>/^https:/.test(l.h)&&l.src&&/source/i.test(l.sr)),`${w}: each source link names its source, also for screen readers: ${JSON.stringify(s.links.filter(l=>!l.src||!/source/i.test(l.sr)))}`);
    assert(s.wrr&&/WorldRiskReport 2026/.test(s.wrr.src),`${w}: the #1 figure links the WorldRiskReport 2026`);
    if(w>600){await pg.hover('#hm-why a.src >> nth=1');await pg.waitForTimeout(250);}else{await pg.focus('#hm-why a.src >> nth=1');await pg.waitForTimeout(250);}
    s=await pg.evaluate(()=>{const t=document.getElementById('src-tip'),r=t.getBoundingClientRect(),a=document.querySelectorAll('#hm-why a.src')[1];return {shown:!t.hidden,t:t.textContent,want:a.dataset.src,l:r.left,r:r.right,w:innerWidth,sw:document.documentElement.scrollWidth};});
    assert(s.shown&&s.t.includes(s.want)&&s.l>=0&&s.r<=s.w&&s.sw<=s.w,`${w}: ${w>600?"hovering":"focusing"} a source link names the source in a note on screen: ${JSON.stringify(s)}`);
    await pg.mouse.move(1,1);await pg.keyboard.press('Escape');
    // the team: LinkedIn, no email addresses on the cards
    s=await pg.evaluate(()=>[...document.querySelectorAll('.hm-team li')].map(li=>({n:li.querySelector('h3').textContent,img:li.querySelector('img').getAttribute('alt'),li:li.querySelector('a').getAttribute('href'),mail:!!li.querySelector('a[href^="mailto:"]')})));
    assert(s.map(x=>x.n).join()==="Noam Anglo,Tim Groeschel,Gregor Posadas"&&s.every(x=>x.img===x.n&&!x.mail),`${w}: the team is Noam, Tim and Gregor, photos named, no emails on the cards`);
    assert(s.map(x=>x.li).join()==="https://www.linkedin.com/in/n-anglo/,https://www.linkedin.com/in/tim-groeschel/,https://www.linkedin.com/in/gregorposadas/",`${w}: each card links to that person's LinkedIn`);
    assert(await pg.evaluate(()=>document.querySelectorAll('#home a[href^="mailto:"]').length===0),`${w}: no mailto: links anywhere on the homepage`);
    // how it works: five stops, the layer list is plain text, translations, and the figure
    s=await pg.evaluate(()=>({stops:[...document.querySelectorAll('.hm-stop h3')].map(h=>h.textContent).join(),layers:[...document.querySelectorAll('.hm-layers li')].map(l=>({t:l.textContent,b:getComputedStyle(l).borderTopWidth,role:l.closest('a,button')?1:0})),
      tr:/Will it flood\?/.test(document.getElementById('hm-how').textContent)&&/Oo\s*\(yes\)/.test(document.getElementById('hm-how').textContent)&&/Baka\s*\(maybe\)/.test(document.getElementById('hm-how').textContent)&&/Hindi\s*\(no\)/.test(document.getElementById('hm-how').textContent),
      fig:!!document.querySelector('.hm-fig svg[role=img] title')&&/walled off/.test(document.querySelector('.hm-fig desc').textContent),
      edges:[...document.querySelectorAll('.hm-xs .x-edge')].length,pause:!!document.getElementById('hm-play')}));
    assert(s.stops==="Measure,Send,Combine,Spread,Answer",`${w}: how it works has five stops`);
    assert(s.layers.length===4&&s.layers.every(l=>l.b==="0px"&&!l.role)&&/FABDEM/.test(s.layers[3].t),`${w}: the map layers are a plain list, not boxes that look like buttons: ${JSON.stringify(s.layers.map(l=>l.t))}`);
    assert(s.tr,`${w}: Babaha ba?, Oo, Baka and Hindi come with English translations`);
    assert(s.fig&&s.edges===2&&!s.pause,`${w}: the figure goes from the side view (two edges, a walled-off dip) to the map, is described for screen readers, and has no pause button`);
    // the sensor is drawn as it is built (Gregor, 2026-10-01, from the photo on the poster): a tall white pipe with end
    // caps, strapped to a thin post with a blue cap, looking down out of its bottom cap; in the side view it hangs above
    // the water level
    s=await pg.evaluate(()=>{const g=sel=>[...document.querySelectorAll(sel)].map(e=>{const b=e.getBBox();return {w:b.width,h:b.height,y:b.y,x:b.x,fill:getComputedStyle(e).fill};});
      return {icon:g('#hm-how .hm-ill .i-pipe'),fig:g('.hm-xs .x-pipe'),straps:document.querySelectorAll('.hm-xs .x-strap').length,cap:g('.hm-xs .x-postcap'),bot:g('.hm-xs .x-botcap'),boxes:document.querySelectorAll('#hm-how .hm-stop:nth-child(-n+2) .i-box, .hm-xs .x-box').length};});
    const tall=a=>a.length>0&&a.every(p=>p.h>=2*p.w&&p.fill==="rgb(255, 255, 255)");
    assert(tall(s.icon)&&s.icon.length===2&&tall(s.fig)&&s.straps===2&&s.cap.length===1&&s.boxes===0,`${w}: the sensor is a tall white pipe strapped to a post with a blue cap, not a flat box: ${JSON.stringify(s)}`);
    assert(s.bot.length===1&&s.bot[0].y+s.bot[0].h<160,`${w}: in the side view the sensor hangs above the water level: ${JSON.stringify(s.bot)}`);
    // the side view shows the buildings along A–A′ (the plan's row north of the street, same x), and black lines carry
    // both edges from the side view down to marks on A–A′ in the plan
    s=await pg.evaluate(()=>{const xr=r=>[+r.getAttribute('x'),+r.getAttribute('x')+ +r.getAttribute('width')].join('-');
      const side=[...document.querySelectorAll('.hm-xs .x-bldg-s rect')].map(xr),plan=[...document.querySelectorAll('.hm-xs .x-bldg rect')].filter(r=>+r.getAttribute('y')<400).map(xr);
      const g=document.querySelector('.hm-xs .x-guide'),cs=getComputedStyle(g);
      const ticks=[...document.querySelectorAll('.hm-xs .x-pedge')].map(t=>t.getAttribute('d'));
      return {side,plan,d:g.getAttribute('d'),stroke:cs.stroke,wd:parseFloat(cs.strokeWidth),ticks,lab:[...document.querySelectorAll('.hm-xs .x-plab')].map(t=>t.textContent).join()};});
    assert(s.side.length>=5&&s.side.every(x=>s.plan.includes(x)),`${w}: the side view shows the buildings along A–A′, lined up with the plan: ${s.side.join(" ")} vs ${s.plan.join(" ")}`);
    assert(/M213 178 V470/.test(s.d)&&/M550 178 V470/.test(s.d)&&s.stroke==="rgb(35, 33, 32)"&&s.wd>=2,`${w}: black lines run unbroken from each side-view edge down to A–A′: ${s.d} ${s.stroke}`);
    assert(s.ticks.length===2&&/M213 /.test(s.ticks[0])&&/M550 /.test(s.ticks[1])&&s.lab==="edge,edge",`${w}: the plan marks and labels both edges on A–A′: ${JSON.stringify(s.ticks)} ${s.lab}`);
    await pg.evaluate(()=>document.getElementById('hm-how').scrollIntoView());await pg.waitForTimeout(400);
    s=await pg.evaluate(()=>({on:document.getElementById('hm-how').classList.contains('hm-run'),pulse:getComputedStyle(document.querySelector('.hm-pulse')).animationName,level:getComputedStyle(document.querySelector('.x-grow')).animationName,flood:getComputedStyle(document.querySelector('.x-flood')).animationIterationCount}));
    assert(s.on&&/hm-pulse/.test(s.pulse)&&s.level==="x-grow"&&s.flood==="infinite",`${w}: on screen, the line and the figure play on repeat: ${JSON.stringify(s)}`);
    // sections fade in as they come into view
    await pg.evaluate(()=>window.scrollTo(0,0));await pg.waitForTimeout(200);
    s=await pg.evaluate(()=>({fx:document.body.classList.contains('fx-on'),team:getComputedStyle(document.getElementById('hm-team')).opacity}));
    await pg.evaluate(()=>document.getElementById('hm-team').scrollIntoView());await pg.waitForTimeout(700);
    const team2=await pg.evaluate(()=>getComputedStyle(document.getElementById('hm-team')).opacity);
    assert(s.fx&&s.team==="0"&&team2==="1",`${w}: sections fade in as they scroll into view: ${s.team} → ${team2}`);
    assert(await pg.evaluate(()=>[...document.querySelectorAll('.hm-team img')].every(i=>i.complete&&i.naturalWidth>0)),`${w}: the team photos load`);
    // collaborators and the call to partner
    await pg.evaluate(()=>document.getElementById('hm-collab').scrollIntoView());await pg.waitForTimeout(600);
    s=await pg.evaluate(()=>({logos:[...document.querySelectorAll('.hm-logos img')].map(i=>({alt:i.alt,ok:i.complete&&i.naturalWidth>0})),ask:document.querySelector('.hm-ask h3').textContent,cta:document.querySelector('.hm-ask a').getAttribute('href')}));
    assert(s.logos.length>=6&&s.logos.every(x=>x.ok&&x.alt),`${w}: the collaborators' logos load, each named: ${s.logos.map(x=>x.alt).join(" | ")}`);
    const links=await pg.evaluate(()=>[...document.querySelectorAll('.hm-logos a')].map(a=>{const i=a.querySelector('img');return (i?i.alt:a.textContent.trim())+"="+a.getAttribute('href');}));
    assert(links.join()==="Bike Scouts=https://bikescoutsproject.org/,University of the Philippines=https://up.edu.ph/,UP Resilience Institute=https://resilience.up.edu.ph/,Project NOAH=https://noah.up.edu.ph/,Blum Center for Developing Economies=https://blumcenter.berkeley.edu/,PhilDev=https://www.phildev.org/,Development Engineering at UC Berkeley=https://developmentengineering.berkeley.edu/,UC Berkeley Disaster Lab=https://disasterlab.berkeley.edu/",`${w}: each logo links to that collaborator's site, named by the logo's text: ${links.join(" ")}`);
    assert(/Partner with us/.test(s.ask)&&s.cta==="#home/contact",`${w}: a call to partner leads to the contact`);
    await pg.click('.hm-ask a');await pg.waitForTimeout(900);
    s=await pg.evaluate(()=>({hash:location.hash,f:document.activeElement.id,top:Math.round(document.getElementById('hm-contact-h').getBoundingClientRect().top),bot:Math.round(document.querySelector('.hm-mail').getBoundingClientRect().bottom),ih:innerHeight}));
    assert(s.hash==="#home/contact"&&s.f==="hm-contact-h"&&s.top>=0&&s.bot<=s.ih,`${w}: "Get in touch" lands on Contact, focused and fully in view: ${JSON.stringify(s)}`);
    // contact: Noam only, the address as text, and a copy button
    s=await pg.evaluate(()=>({n:document.querySelector('.hm-mail-n').textContent,a:document.getElementById('hm-mail').textContent,tag:document.getElementById('hm-mail').tagName,others:/tim_groeschel@|gregorposadas@/.test(document.getElementById('home').textContent),h:document.getElementById('hm-copy').getBoundingClientRect().height}));
    assert(s.n==="Noam Anglo"&&s.a==="nanglo@berkeley.edu"&&s.tag!=="A"&&!s.others&&s.h>=48,`${w}: Contact shows Noam's address as plain text, with a 48 px copy button: ${JSON.stringify(s)}`);
    await pg.click('#hm-copy');await pg.waitForTimeout(200);
    s=await pg.evaluate(async()=>({said:document.getElementById('hm-copied').textContent,clip:await navigator.clipboard.readText().catch(()=>"?")}));
    assert(s.said==="Copied"&&s.clip==="nanglo@berkeley.edu",`${w}: Copy puts the address on the clipboard and says so: ${JSON.stringify(s)}`);
    // explore: raised cards sink when pressed, then the page changes
    await pg.evaluate(()=>document.getElementById('hm-explore').scrollIntoView());await pg.waitForTimeout(500);
    s=await pg.evaluate(()=>getComputedStyle(document.querySelector('.hm-cards a')).boxShadow);
    assert(/5px 5px 0px/.test(s),`${w}: explore cards are raised (offset shadow): ${s}`);
    await pg.click('.hm-cards a[href="#about"]');
    const pressed=await pg.evaluate(()=>({press:document.querySelector('.hm-cards a[href="#about"]').classList.contains('hm-press'),route:ROUTE}));
    await ready(pg,"about");
    assert(pressed.press&&pressed.route==="home",`${w}: a clicked card sinks first, then the About page opens: ${JSON.stringify(pressed)}`);
    // the Accessibility tab
    await pg.goto(U+'#access');await ready(pg,"access");
    s=await pg.evaluate(()=>({route:ROUTE,sel:[...document.querySelectorAll('#access .site-tabs [aria-selected=true]')].map(b=>b.dataset.site).join(),rail:document.querySelectorAll('#access .ab-rail a').length,
      t:/Atkinson Hyperlegible/.test(document.getElementById('access').textContent)&&/Okabe/.test(document.getElementById('access').textContent)&&/falls short/.test(document.getElementById('access').textContent),sw:document.documentElement.scrollWidth,title:document.title}));
    assert(s.route==="access"&&s.sel==="access"&&s.rail===8&&s.t&&s.sw<=w&&/Accessibility/.test(s.title),`${w}: the Accessibility page covers the typeface, colours and what still falls short: ${JSON.stringify(s)}`);
    await pg.goto(U+'#access/gaps');await ready(pg,"access");await pg.waitForTimeout(400);
    assert(await pg.evaluate(()=>document.activeElement.id==="ax-gaps-h"&&location.hash==="#access/gaps"),`${w}: #access/gaps opens at that section`);
    // other tabs still work from Home
    await pg.goto(U);await ready(pg,"home");
    await pg.click('.hm-cta a[href="#ph"]');await ready(pg,"ph");
    assert(await pg.evaluate(()=>ROUTE==="ph"&&location.hash==="#ph"),`${w}: "Open the flood map" opens the PhilDev map at #ph`);
    await pg.click('#nat .site-tabs [data-site="home"]');await ready(pg,"home");
    assert(await pg.evaluate(()=>ROUTE==="home"&&location.hash===""&&scrollY===0),`${w}: the Home tab comes back to the top of the homepage`);
    assert(bad.length===0,`${w}: no missing files: ${bad.join(", ")}`);
    await ctx.close();
  }
  // loading feedback: a slow site file shows the top bar and a skeleton; a map that is loading shows its chip
  {const ctx=await b.newContext({viewport:{width:1280,height:900}});await ctx.addInitScript(()=>{window.BW_BASEMAP_STYLE='shared/basemap-style.json?real';try{localStorage.setItem("bw-asked:upd","1")}catch(e){}});
   const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
   await pg.route('**/data/upd.json',async r=>{await new Promise(z=>setTimeout(z,1200));r.continue();});
   await pg.goto(U+'#ph');await ready(pg,"ph");await pg.evaluate(()=>{location.hash="#upd";});await pg.waitForTimeout(500);
   let s=await pg.evaluate(()=>({route:ROUTE,bar:!document.getElementById('busy').hidden,role:document.getElementById('busy').getAttribute('role'),skel:getComputedStyle(document.querySelector('#route-loading .skel')).display}));
   assert(s.route==="loading"&&s.bar&&s.role==="progressbar"&&s.skel==="grid","while a site file loads: a progress bar at the top and a skeleton of the page: "+JSON.stringify(s));
   await ready(pg,"upd");
   // the detailed map starts 0.8 s after the flood map is up; its chip shows while it loads
   const chipSeen=await pg.waitForFunction(()=>!document.getElementById('site-busy').hidden,null,{timeout:10000}).then(()=>true,()=>false);
   s=await pg.evaluate(()=>({chip:!document.getElementById('site-busy').hidden,text:document.getElementById('site-busy').textContent}));
   await pg.waitForFunction(()=>SITEGL.state==="on"&&!BUSY.size,null,{timeout:20000}).catch(()=>{});await pg.waitForTimeout(300);
   const after=await pg.evaluate(()=>({bar:!document.getElementById('busy').hidden,chip:!document.getElementById('site-busy').hidden}));
   assert(chipSeen&&!after.bar&&!after.chip,"while the detailed map loads its chip shows; once loaded, the bar and the chip go away: "+JSON.stringify({s,after}));
   await ctx.close();}
  // "Listen" next to Baha: a Tagalog speaker's recording from Forvo (credited in the footer) plays on any device,
  // with no Filipino voice needed and nothing fetched from outside the site
  {const ctx=await b.newContext({viewport:{width:375,height:800}});
   await ctx.addInitScript(()=>{window.__played=[];HTMLMediaElement.prototype.play=function(){__played.push(this.src);return Promise.resolve();};});
   const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));const outside=[];pg.on('request',r=>{if(!r.url().startsWith(BASE)&&!r.url().startsWith('blob:'+BASE))outside.push(r.url());});
   await pg.goto(U);await ready(pg,"home");await pg.waitForTimeout(300);
   const s=await pg.evaluate(()=>{const bt=document.getElementById('hm-hear');const r=bt.getBoundingClientRect();return {shown:!bt.hidden,h:r.height,name:bt.getAttribute('aria-label'),near:/Baha/.test(bt.closest('p').textContent),sh:getComputedStyle(bt).boxShadow,credit:/Forvo/.test(document.querySelector('.hm-foot').textContent)};});
   await pg.click('#hm-hear');await pg.waitForTimeout(500);
   const played=await pg.evaluate(()=>__played);
   const file=await pg.evaluate(async()=>{const r=await fetch('shared/home/baha.mp3');return {ok:r.ok,type:r.headers.get('content-type'),n:(await r.arrayBuffer()).byteLength};});
   assert(s.shown&&s.h>=48&&/baha/i.test(s.name)&&s.near&&/4px 4px 0px/.test(s.sh)&&s.credit,`"Listen" sits next to Baha, raised, 48 px, named, with Forvo credited: ${JSON.stringify(s)}`);
   assert(played.length===1&&/^blob:|baha\.mp3$/.test(played[0])&&file.ok&&/audio\/mpeg/.test(file.type)&&file.n>5000,`pressing it plays the Tagalog recording from our own site: ${JSON.stringify({played,file})}`);
   assert(outside.length===0,"nothing is fetched from outside the site: "+outside.slice(0,2).join(", "));
   await ctx.close();}
  // reduced motion: nothing moves, nothing fades
  {const ctx=await b.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
   await pg.goto(U+'#home/how');await ready(pg,"home");await pg.waitForTimeout(300);
   const s=await pg.evaluate(()=>({on:document.getElementById('hm-how').classList.contains('hm-run'),anim:getComputedStyle(document.querySelector('.hm-pulse')).animationName,fx:document.body.classList.contains('fx-on'),op:getComputedStyle(document.getElementById('hm-team')).opacity}));
   assert(!s.on&&s.anim==="none"&&!s.fx&&s.op==="1","reduced motion: the drawings stand still and sections do not fade: "+JSON.stringify(s));
   await ctx.close();}
  // dark theme: text, links and the main button keep ≥ 4.5:1; the figure stays light paper with dark ink
  {const ctx=await b.newContext({viewport:{width:1280,height:900},colorScheme:'dark'});const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
   await pg.goto(U);await ready(pg,"home");
   const s=await pg.evaluate(()=>{const rgb=c=>c.match(/[\d.]+/g).slice(0,3).map(Number),L=c=>{const v=rgb(c).map(x=>{x/=255;return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4;});return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];},
     cr=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);},bg=getComputedStyle(document.body).backgroundColor,g=e=>getComputedStyle(document.querySelector(e));
     return {theme:document.documentElement.dataset.theme,h1:cr(g('#hm-h').color,bg),note:cr(g('.hm-demo').color,bg),btn:cr(g('.hm-btn-p').color,g('.hm-btn-p').backgroundColor),stat:cr(g('.hm-stats span').color,g('.hm-stats').backgroundColor),
       ref:cr(g('#hm-why a.src').color,bg),card:cr(g('.hm-cards span').color,g('.hm-cards a').backgroundColor),fig:cr(g('.hm-fig figcaption p').color,g('.hm-fig').backgroundColor),mail:cr(g('#hm-mail').color,g('.hm-mail').backgroundColor)};});
   assert(s.theme==="dark"&&Object.entries(s).every(([k,v])=>k==="theme"||v>=4.5),"dark theme: homepage text, links, cards, figure caption and the main button ≥ 4.5:1: "+JSON.stringify(s));
   await ctx.close();}
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
