// The national map (spec §4): a full-window map and a side list; the vector basemap with an outline fallback; pins,
// clusters, fly-to with the campus box and "Open"; search; smooth zoom. Run: ./test_pages.sh test_national.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const ready=(pg,v)=>pg.waitForFunction(x=>document.body.dataset.ready===x,v,{timeout:15000});
const settle=pg=>pg.waitForFunction(()=>!natBusy(),null,{timeout:10000}).then(()=>pg.waitForTimeout(80));
const openRow=(pg,id)=>pg.evaluate(id=>{const a=document.querySelector('#nat-list a[data-id="'+id+'"]');for(let d=a.closest('details');d;d=d.parentElement.closest('details'))d.open=true;},id);   // the list is a tree of drop-downs (2026-09-29)
const glUp=pg=>pg.waitForFunction(()=>NATGL.state==="on"||NATGL.state==="off",null,{timeout:15000}).then(()=>pg.evaluate(()=>NATGL.state));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  for(const mode of ["vector","outline"]){
    const ctx=await b.newContext({viewport:{width:1280,height:900}});
    if(mode==="outline")await ctx.addInitScript(()=>{window.BW_NO_BASEMAP=true;});
    const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
    await pg.goto(U);await ready(pg,"ph");
    const st=await glUp(pg);
    assert(st===(mode==="vector"?"on":"off"),`${mode}: basemap state ${st}`);
    if(mode==="outline")assert(await pg.evaluate(()=>!document.getElementById('nat-note').hidden&&document.getElementById('nat-note').textContent==="The detailed map can't be shown on this device."),"outline: the note says the detailed map can't be shown");
    else assert(await pg.evaluate(()=>document.getElementById('nat-note').hidden&&document.body.dataset.natgl==="1"&&getComputedStyle(document.getElementById('nat-svg')).visibility==="hidden"),"vector: the basemap replaced the outline, no note");
    if(mode==="vector")assert(await pg.evaluate(()=>!NATGL.map.cooperativeGestures.isEnabled()),"vector, mouse: no cooperative gestures (the wheel zooms, one drag pans)");
    let s=await pg.evaluate(()=>{
      const pins=[...document.querySelectorAll('#nat-pins .pin')],cl=[...document.querySelectorAll('#nat-pins .pin-cluster')],m=document.getElementById('nat-map').getBoundingClientRect();
      return {n:CAMPUSES.length,shown:pins.length+cl.reduce((a,c)=>a+c.dataset.ids.split(",").length,0),
        inside:[...pins,...cl].every(e=>{const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return x>=m.left&&x<=m.right&&y>=m.top&&y<=m.bottom;}),
        labels:pins.every(p=>/: .+, .+\. (State|Local|Private)/.test(p.getAttribute('aria-label'))),text:pins.every(p=>p.querySelector('.pin-t').textContent.length>1),
        clusters:cl.map(c=>c.getAttribute('aria-label')),legend:[...document.querySelectorAll('#nat-legend li')].map(l=>l.textContent),
        credit:document.getElementById('nat-credit').textContent,creditShown:(e=>e.getClientRects().length>0&&getComputedStyle(e).display!=="none")(document.getElementById('nat-credit')),desc:document.getElementById('nat-desc').textContent,title:document.title,
        tabs:[...document.querySelectorAll('#nat .site-tabs [role=tab]')].map(t=>t.dataset.site+(t.getAttribute('aria-selected')==="true"?"*":""))};});
    assert(s.n===25&&s.shown===25&&s.inside,`${mode}: all 25 campuses are on the map, as pins or in clusters, inside the map box: ${s.shown}`);
    assert(s.labels&&s.text,`${mode}: each pin has a visible short label and a full spoken label`);
    assert(s.clusters.length>=1&&s.clusters.every(c=>/^\d+ campuses: .+Zoom in$/.test(c)),`${mode}: crowded pins become a cluster that says how many and which`);
    assert(s.legend.join("|")==="State|Local|Private|Sea",`${mode}: legend: the pin types and the sea: ${s.legend}`);
    // the tiles' credit renders only under the vector map: the outline is not from OpenStreetMap and loads no MapLibre (as rendered, not the attribute)
    if(mode==="vector")assert(s.creditShown&&s.credit==="© OpenStreetMap contributors · Open Buildings (Google, Microsoft, VIDA) · MapLibre",`${mode}: map credits shown`);
    else assert(!s.creditShown,`outline: no OpenStreetMap/OpenFreeMap/MapLibre credit under the outline`);
    assert(s.desc==="Map of the Philippines with 25 PhilDev partner campuses: 17 in Luzon, 5 in Visayas, 3 in Mindanao. The campus list has the same campuses.",`${mode}: screen-reader description`);
    assert(s.tabs.join()==="ph*,tv,sjq,berkeley,try,about"&&/PhilDev partner campuses/.test(s.title),`${mode}: tabs and title`);
    s=await pg.evaluate(()=>[...document.querySelectorAll('#nat-list details.nat-grp')].map(d=>d.dataset.group+d.dataset.n+":"+d.querySelectorAll('.nat-item').length+(d.open?"open":"")));
    assert(s.join()==="Luzon17:17,Visayas5:5,Mindanao3:3",`${mode}: list grouped Luzon 17, Visayas 5, Mindanao 3, closed until opened: ${s}`);
    // drop-downs: island group › province › campuses (2026-09-29 feedback)
    await pg.click('.nat-grp[data-group="Visayas"] > summary');await pg.click('.nat-prov[data-key="Visayas/Cebu"] > summary');
    s=await pg.evaluate(()=>({provs:[...document.querySelectorAll('.nat-grp[data-group="Visayas"] .nat-prov')].map(d=>d.dataset.key),shown:[...document.querySelectorAll('#nat-list .nat-item')].filter(a=>a.checkVisibility()).map(a=>a.dataset.id).join()}));
    assert(s.provs.join()==="Visayas/Cebu"&&s.shown==="ctu,usc,llcc,mcc,upc",`${mode}: Visayas › Cebu opens to its five campuses: ${JSON.stringify(s)}`);
    await pg.fill('#nat-q','Xavier');await pg.waitForTimeout(450);
    s=await pg.evaluate(()=>[...document.querySelectorAll('#nat-list .nat-item')].filter(a=>a.checkVisibility()).map(a=>a.dataset.id).join());
    assert(s==="xu",`${mode}: a search opens the branches with a match: ${s}`);
    await pg.fill('#nat-q','');await pg.waitForTimeout(450);
    s=await pg.evaluate(()=>[...document.querySelectorAll('#nat-list details[open]')].map(d=>d.dataset.key).join());
    assert(s==="Visayas,Visayas/Cebu",`${mode}: clearing the search restores what was open: ${s}`);
    s=await pg.evaluate(()=>({pilots:!!document.getElementById('nat-pilots-h')||[...document.querySelectorAll('#nat a')].some(a=>/^#(tv|berkeley|try)$/.test(a.getAttribute('href')||"")),
      rows:[...document.querySelectorAll('#nat-list .nat-item')].slice(0,2).map(a=>a.textContent)}));
    assert(!s.pilots,`${mode}: no Pilot sites or Try reporting in the list (they are tabs)`);
    assert(s.rows.every(t=>!/ · /.test(t))&&s.rows[0]==="BatStateU Batangas State UniversityBatangas City",`${mode}: list rows are two plain lines: ${s.rows[0]}`);
    // search: accents, case, city names; announced once typing pauses
    const find=async q=>{await pg.fill('#nat-q',q);await pg.waitForTimeout(500);return pg.evaluate(()=>({ids:[...document.querySelectorAll('#nat-list .nat-item')].map(a=>a.dataset.id),count:document.getElementById('nat-count').textContent,none:document.getElementById('nat-list').textContent}));};
    for(const [q,want] of [["Xavier",["xu"]],["xavier",["xu"]],["UPLB",["uplb"]],["banos",["uplb"]],["mapua",["mapua"]],["Iligan",["msuiit"]],["cebu city",["ctu","usc","upc"]]]){
      s=await find(q);assert(s.ids.join()===want.join(),`${mode}: search "${q}" finds ${want}: ${s.ids}`);}
    s=await find("Xavier");assert(s.count==="1 campus matches.",`${mode}: search announces how many matched`);
    s=await find("zzz");assert(s.ids.length===0&&/No campus matches “zzz”/.test(s.none),`${mode}: no match says so`);
    await pg.fill('#nat-q','');await pg.waitForTimeout(450);
    // icon-buttons: the zoom/home controls have a real tooltip (not the native title), shown on hover and keyboard focus — before
    // any mouse click on them, so the browser's own :focus-visible heuristic (mouse-clicked buttons don't re-show it) doesn't skew the check
    s=await pg.evaluate(()=>['nat-zin','nat-zout','nat-home'].map(id=>{
      const b=document.getElementById(id),tipId=b.getAttribute('aria-describedby'),tip=tipId&&document.getElementById(tipId);
      return {id,hasTitle:b.hasAttribute('title'),tipRole:tip&&tip.getAttribute('role'),tipText:tip&&tip.textContent,label:b.getAttribute('aria-label')};
    }));
    assert(s.every(b=>!b.hasTitle&&b.tipRole==="tooltip"&&b.tipText===b.label),`${mode}: no native title; each has a role=tooltip matching its aria-label: `+JSON.stringify(s));
    await pg.focus('#nat-zin');await pg.waitForTimeout(150);
    const tipVisible=await pg.evaluate(()=>{const tip=document.getElementById(document.getElementById('nat-zin').getAttribute('aria-describedby'));return tip&&getComputedStyle(tip).visibility!=="hidden"&&getComputedStyle(tip).opacity!=="0";});
    assert(tipVisible,`${mode}: the tooltip shows on keyboard focus, not only on hover`);
    // zoom: a cluster zooms in and separates pins; + − ⌂ zoom smoothly
    const before=await pg.evaluate(()=>document.querySelectorAll('#nat-pins .pin').length);
    await pg.click('#nat-pins .pin-cluster');await settle(pg);
    s=await pg.evaluate(()=>({pins:document.querySelectorAll('#nat-pins .pin').length,focus:!!document.activeElement.closest('#nat-pins')}));
    assert(s.pins>before&&s.focus,`${mode}: a cluster zooms in to separate pins and keeps focus on the map: ${before} → ${s.pins}`);
    for(let i=0;i<4&&await pg.$('#nat-pins .pin-cluster');i++){await pg.click('#nat-pins .pin-cluster');await settle(pg);}
    assert(await pg.evaluate(()=>!document.querySelector('#nat-pins .pin-cluster')||document.querySelectorAll('#nat-pins .pin').length>1),`${mode}: zooming further separates even the closest campuses`);
    await pg.click('#nat-home');await settle(pg);
    assert(await pg.evaluate(()=>document.querySelectorAll('#nat-pins .pin').length)===before,`${mode}: ⌂ returns to the whole country`);
    const zoomState=()=>pg.evaluate(()=>NATGL.state==="on"?NATGL.map.getZoom():NAT.full[2]/NAT.vb[2]);
    const z0=await zoomState();await pg.click('#nat-zin');
    const mid=await pg.evaluate(()=>natBusy());await settle(pg);const z1=await zoomState();
    assert(z1>z0&&mid,`${mode}: + zooms in smoothly (still moving right after the click): ${z0.toFixed(2)} → ${z1.toFixed(2)}`);
    await pg.click('#nat-zout');await settle(pg);
    assert(Math.abs(await zoomState()-z0)<0.05,`${mode}: − zooms back out`);
    // a list row flies the map to the campus, outlines its box and offers "Open XU"; Open opens the campus
    await openRow(pg,"xu");await pg.click('#nat-list a[data-id="xu"]');await settle(pg);
    s=await pg.evaluate(()=>{const o=document.getElementById('nat-open'),bx=document.getElementById('nat-box').getBoundingClientRect(),m=document.getElementById('nat-map').getBoundingClientRect(),
      pin=document.querySelector('#nat-pins .pin[data-id="xu"]');
      return {route:ROUTE,open:!o.hidden&&o.textContent==="Open XU"&&o.getAttribute('href')==="#xu",focus:document.activeElement===o,
        box:!document.getElementById('nat-box').hidden&&bx.width>=12&&bx.left>=m.left&&bx.right<=m.right,sel:!!pin&&pin.classList.contains('pin-sel')};});
    assert(s.route==="ph"&&s.open&&s.focus&&s.box&&s.sel,`${mode}: choosing XU in the list flies there, draws its box, offers 'Open XU' with focus: `+JSON.stringify(s));
    await pg.click('#nat-open');await ready(pg,"xu");
    assert(await pg.evaluate(()=>SITE==="xu"&&location.hash==="#xu"),`${mode}: 'Open XU' opens its page`);
    await pg.goBack();await ready(pg,"ph");
    assert(await pg.evaluate(()=>ROUTE==="ph"&&getComputedStyle(document.getElementById('nat')).display!=="none"),`${mode}: Back returns to the national map`);
    // a pin works the same way
    await pg.click('#nat-home');await settle(pg);
    await pg.click('#nat-pins .pin >> nth=0');await settle(pg);
    s=await pg.evaluate(()=>({route:ROUTE,open:!document.getElementById('nat-open').hidden}));
    assert(s.route==="ph"&&s.open,`${mode}: choosing a pin selects it on the map and offers Open`);
    // Review Focus 5: a language change reaches our words on the map (the map's own place names are not ours)
    await pg.selectOption('#nat-lang','fil');await pg.waitForTimeout(150);
    s=await pg.evaluate(()=>({pin:document.querySelector('#nat-pins .pin').getAttribute('aria-label'),legend:document.getElementById('nat-legend').textContent,open:document.getElementById('nat-open').textContent,zin:document.getElementById('nat-zin').getAttribute('aria-label')}));
    assert(/(ng estado|unibersidad o kolehiyo|Pribado)\.$/.test(s.pin)&&/Dagat/.test(s.legend)&&/^Buksan ang /.test(s.open)&&s.zin==="Palakihin",`${mode}: Filipino reaches the pins, legend, Open and the zoom buttons: `+JSON.stringify(s));
    await pg.selectOption('#nat-lang','en');await pg.waitForTimeout(150);
    // Review Focus 3: a resize keeps the map filling its box and every pin inside it
    await pg.setViewportSize({width:1000,height:700});await pg.waitForTimeout(400);await settle(pg);
    s=await pg.evaluate(()=>{const m=document.getElementById('nat-map').getBoundingClientRect(),g=document.querySelector('#nat-gl canvas');
      return {fill:!g||Math.abs(g.getBoundingClientRect().width-m.width)<=2,inside:[...document.querySelectorAll('#nat-pins > *')].every(e=>{const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return x>=m.left-1&&x<=m.right+1&&y>=m.top-1&&y<=m.bottom+1;})};});
    assert(s.fill&&s.inside,`${mode}: after a resize the map fills its box and every pin is inside it`);
    // Review Focus 2: a theme switch restyles the vector map and keeps the overlays
    const n0=await pg.evaluate(()=>document.querySelectorAll('#nat-pins > *').length);
    await pg.click('#nat-theme');await pg.waitForTimeout(600);
    s=await pg.evaluate(()=>({theme:NATGL.theme,n:document.querySelectorAll('#nat-pins > *').length,open:!document.getElementById('nat-open').hidden}));
    assert((mode==="outline"||s.theme==="dark")&&s.n===n0&&s.open,`${mode}: switching theme restyles the map and keeps the pins and Open: `+JSON.stringify(s));
    await pg.click('#nat-theme');
    assert(errs.length===0,`${mode}: no page errors: `+errs.join("; "));
    await ctx.close();
  }
  // the outline keeps the map box's shape once the note has taken its line under the map (nothing stretched, pins on land)
  {const ctx=await b.newContext({viewport:{width:1280,height:900}});await ctx.addInitScript(()=>{window.BW_NO_BASEMAP=true;});
   const pg=await ctx.newPage();await pg.goto(U);await ready(pg,"ph");await glUp(pg);await pg.waitForTimeout(300);
   const s=await pg.evaluate(()=>{const m=document.getElementById('nat-map');return {vb:NAT.vb[2]/NAT.vb[3],box:m.clientWidth/m.clientHeight};});
   assert(Math.abs(s.vb-s.box)<0.01,`outline: the view keeps the map box's shape after the note appears: ${s.vb.toFixed(3)} vs ${s.box.toFixed(3)}`);
   await ctx.close();}
  // a theme switch while the vector map is still loading: it arrives in the new theme
  {const ctx=await b.newContext({viewport:{width:1280,height:900},colorScheme:"light"});const pg=await ctx.newPage();const styles=[];
   pg.on('request',r=>{if(/basemap-style/.test(r.url()))styles.push(r.url());});
   await pg.goto(U);await ready(pg,"ph");const st0=await pg.evaluate(()=>NATGL.state);await pg.click('#nat-theme');await glUp(pg);await pg.waitForTimeout(300);
   const s=await pg.evaluate(()=>({t:document.documentElement.dataset.theme,gl:NATGL.theme}));
   assert(st0!=="loading"||(s.t==="dark"&&s.gl==="dark"&&/basemap-style-dark/.test(styles[styles.length-1]||"")),`a theme switch during loading restyles the map once it opens: ${st0} ${JSON.stringify(s)} ${styles.join(" ")}`);
   await ctx.close();}
  // reduced motion: the vector map jumps instead of flying; a cluster still hands focus to the pins it opens
  {const ctx=await b.newContext({viewport:{width:1280,height:900},reducedMotion:"reduce"});const pg=await ctx.newPage();
   await pg.goto(U);await ready(pg,"ph");await glUp(pg);
   await pg.click('#nat-pins .pin-cluster');await pg.waitForTimeout(300);
   assert(await pg.evaluate(()=>!!document.activeElement.closest('#nat-pins')),"reduced motion: a cluster zooms in and focus moves to the pins");
   await ctx.close();}
  // "Open …" never covers the map credits (the credit must stay readable), in both maps, wide and narrow
  for(const mode of ["vector","outline"])for(const [w,h] of [[920,800],[390,844]]){
    const ctx=await b.newContext({viewport:{width:w,height:h}});if(mode==="outline")await ctx.addInitScript(()=>{window.BW_NO_BASEMAP=true;});
    const pg=await ctx.newPage();await pg.goto(U);await ready(pg,"ph");await glUp(pg);
    await pg.evaluate(()=>natSelect("mapua"));await settle(pg);
    const s=await pg.evaluate(()=>{const a=document.getElementById('nat-open').getBoundingClientRect(),c=document.getElementById('nat-credit').getBoundingClientRect();
      return {hit:a.left<c.right&&c.left<a.right&&a.top<c.bottom&&c.top<a.bottom,open:!document.getElementById('nat-open').hidden};});
    assert(s.open&&!s.hit,`${mode} ${w} px: "Open Mapúa" and the map credits don't overlap`);
    await ctx.close();}
  // a list row's hover or focus marks its pin, or the cluster it is in; the chosen campus's cluster is marked too
  {const ctx=await b.newContext({viewport:{width:1280,height:900}});const pg=await ctx.newPage();await pg.goto(U);await ready(pg,"ph");await glUp(pg);await settle(pg);
   const mark=cls=>pg.evaluate(c=>{const e=[...document.querySelectorAll('#nat-pins > *')].find(e=>(e.dataset.id||e.dataset.ids).split(",").includes("bsu"));
     return {kind:e&&e.className.split(" ")[0],on:!!e&&e.classList.contains(c),ring:!!e&&getComputedStyle(e,'::before').borderTopStyle==="solid",others:document.querySelectorAll('#nat-pins .'+c).length};},cls);
   await openRow(pg,"bsu");await pg.hover('#nat-list a[data-id="bsu"]');let s=await mark("pin-hl");
   assert(s.on&&s.ring&&s.others===1,"hovering the BatStateU row marks its pin or cluster with a ring: "+JSON.stringify(s));
   await pg.mouse.move(5,5);await pg.focus('#nat-list a[data-id="bsu"]');s=await mark("pin-hl");
   assert(s.on&&s.ring&&s.others===1,"focusing the BatStateU row marks its pin or cluster: "+JSON.stringify(s));
   await pg.focus('#nat-q');
   await pg.evaluate(()=>{NAT.sel="bsu";natPins();});s=await mark("pin-sel");
   assert(s.kind==="pin-cluster"&&s.on&&s.ring,"the chosen campus's cluster is marked when the campus is inside it: "+JSON.stringify(s));
   await ctx.close();}
  // leaving the tab while the vector map is still loading: back on the tab, the map shows the whole country, not zoomed out
  {const ctx=await b.newContext({viewport:{width:1280,height:844}});const pg=await ctx.newPage();
   await pg.route('**/maplibre-gl.mjs',r=>setTimeout(()=>r.continue(),1500));
   await pg.goto(U);await ready(pg,"ph");const st0=await pg.evaluate(()=>NATGL.state);
   await pg.evaluate(()=>{location.hash="#xu";});await ready(pg,"xu");
   await pg.waitForFunction(()=>NATGL.state==="on"||NATGL.state==="off",null,{timeout:15000});
   await pg.goBack();await ready(pg,"ph");await pg.waitForTimeout(300);await settle(pg);
   const s=await pg.evaluate(()=>({z:NATGL.map.getZoom(),want:NATGL.map.cameraForBounds(PH_BOUNDS,{padding:24}).zoom,n:document.querySelectorAll('#nat-pins > *').length}));
   assert(st0==="loading"&&Math.abs(s.z-s.want)<0.05,`back on the tab after the map opened out of sight, it fits the country: ${st0} z${s.z.toFixed(2)} (want z${s.want.toFixed(2)}), ${s.n} pins/clusters`);
   await ctx.close();}
  // Review Focus 1: the real style with its tile archives unreachable: the outline, pins and note within 8 s, no late switch
  {const ctx=await b.newContext({viewport:{width:1280,height:900}});
   await ctx.addInitScript(()=>{window.BW_BASEMAP_STYLE="shared/basemap-style.json?real";});
   await ctx.route('**/*.pmtiles',r=>r.abort());
   const pg=await ctx.newPage();const t0=Date.now();await pg.goto(U);await ready(pg,"ph");
   await pg.waitForFunction(()=>NATGL.state==="off"||NATGL.state==="on",null,{timeout:12000});
   const dt=Date.now()-t0;
   const s=await pg.evaluate(()=>({st:NATGL.state,note:!document.getElementById('nat-note').hidden,pins:document.querySelectorAll('#nat-pins > *').length,gl:document.body.dataset.natgl}));
   assert(s.st==="off"&&s.note&&s.pins>0&&!s.gl&&dt<=10000,`tiles unreachable: the outline, pins and the note after ${dt} ms`);
   await pg.waitForTimeout(3000);
   assert(await pg.evaluate(()=>NATGL.state==="off"&&!document.body.dataset.natgl),"no late switch to the vector map in the same visit");
   await ctx.close();}
  // our own tiles (shared/tiles/*.pmtiles): the real style opens with no outside server; UP Diliman shows its buildings
  {const ctx=await b.newContext({viewport:{width:1280,height:900}});
   await ctx.addInitScript(()=>{window.BW_BASEMAP_STYLE="shared/basemap-style.json?real";});
   const pg=await ctx.newPage();const outside=[];pg.on('request',r=>{if(!r.url().startsWith(BASE))outside.push(r.url());});
   await pg.goto(U);await ready(pg,"ph");
   await pg.waitForFunction(()=>NATGL.state==="off"||NATGL.state==="on",null,{timeout:15000});
   assert(await pg.evaluate(()=>NATGL.state==="on"),"the detailed map opens from our own tile files");
   await pg.evaluate(()=>NATGL.map.jumpTo({center:[121.068,14.652],zoom:15}));
   await pg.waitForFunction(()=>NATGL.map.areTilesLoaded(),null,{timeout:15000});await pg.waitForTimeout(500);
   const n=await pg.evaluate(()=>({b:NATGL.map.queryRenderedFeatures({layers:["building-upd"]}).length,r:NATGL.map.queryRenderedFeatures({layers:["road-minor-site-upd"]}).length}));
   assert(n.b>50&&n.r>10,`UP Diliman at street zoom: building footprints and streets drawn (${n.b} buildings, ${n.r} streets)`);
   assert(outside.length===0,"no request leaves the site: "+outside.slice(0,3).join(", "));
   // a wheel over a pin zooms the map (HTML pins sit on top of the vector map and used to swallow it)
   await pg.evaluate(()=>NATGL.map.jumpTo({center:[121.0,14.6],zoom:12}));await pg.waitForTimeout(800);
   const pr=await pg.evaluate(()=>{const e=document.querySelector('#nat-pins a.pin');const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
   await pg.mouse.move(pr.x,pr.y);const z0=await pg.evaluate(()=>NATGL.map.getZoom());
   for(let i=0;i<4;i++){await pg.mouse.wheel(0,-150);await pg.waitForTimeout(120);}await pg.waitForTimeout(500);
   assert(await pg.evaluate(z0=>NATGL.map.getZoom()>z0+0.3,z0),"a mouse wheel over a campus pin zooms the map");
   // the country-wide simulated storm: every campus in view floods at once, with the campus pages' sensor shapes
   await pg.evaluate(()=>NATGL.map.jumpTo({center:[121.0,14.6],zoom:12.8}));await pg.waitForTimeout(500);
   assert(await pg.evaluate(()=>!document.getElementById('nat-storm').hidden&&document.getElementById('nat-storm').textContent==="Simulate a typhoon"),"a 'Simulate a typhoon' button on the detailed map");
   await pg.click('#nat-storm');await pg.waitForTimeout(6000);
   const st=await pg.evaluate(()=>({on:NSIM.on,pressed:document.getElementById('nat-storm').getAttribute('aria-pressed'),t:document.getElementById('nat-storm-t').textContent,
     sites:Object.keys(NSIM.sites).length,wet:Object.values(NSIM.sites).some(m=>m.hh.some(h=>h.status!=="ok")),
     lg:[...document.querySelectorAll('#nat-legend .lg-storm')].length,grad:/linear-gradient/.test((document.querySelector('#nat-legend .lg-grad i')||{}).style?.background||""),units:document.querySelectorAll('#nat-units .nat-unit').length}));
   assert(st.on&&st.pressed==="true"&&/^Simulated typhoon · \d+:\d\d$/.test(st.t),"the storm runs on a shared clock: "+st.t);
   assert(st.sites>=5&&st.wet,`every campus in view floods at once (${st.sites} campuses, some sensors wet)`);
   assert(st.lg===4&&st.grad&&st.units===0,"the legend explains the water (one depth spectrum) and the three sensor shapes; the plain unit rings give way to status shapes");
   // the campus pages' water drawing (2026-09-29): a campus big on screen is painted 4× finer with a faded margin
   await pg.evaluate(()=>{const c=CAMPUS_BY_ID.upd;NATGL.map.jumpTo({center:[c.lon,c.lat],zoom:14.2});});await pg.waitForTimeout(4000);
   const wd=await pg.evaluate(()=>{const m=Object.values(NSIM.sites).find(m=>m.fk>1&&m.FS.depth.some(d=>d>0.03));if(!m)return {fks:Object.values(NSIM.sites).map(m=>m.fk+":"+m.id)};
     const a=m.cv.getContext('2d').getImageData(0,0,m.cv.width,m.cv.height).data;let soft=0,full=0;for(let i=3;i<a.length;i+=4){if(a[i]>0&&a[i]<200)soft++;else if(a[i]>=200)full++;}
     return {w:m.cv.width,gw:m.g.GW,fk:m.fk,px:m.g.cellM/m.fk,soft,full};});
   assert(wd&&wd.fk>1&&wd.w<=wd.gw*wd.fk&&wd.px<4.5&&wd.soft>0&&wd.full>0,   // painted only where water can be (a rectangle within the box)
     "zoomed in on a campus, its typhoon water uses the campus pages' drawing (~3.75 m pixels, faded shallow margin): "+JSON.stringify(wd));
   await pg.click('#nat-storm');
   assert(await pg.evaluate(()=>!NSIM.on&&document.getElementById('nat-storm-t').textContent===""&&!document.querySelector('#nat-legend .lg-storm')),"'Stop the typhoon' ends it");
   // a chosen campus lets go when you zoom back out to the country; the map keeps the Philippines in view
   await pg.evaluate(()=>natSelect("bsu"));await pg.waitForTimeout(1800);
   assert(await pg.evaluate(()=>NAT.sel==="bsu"&&!document.getElementById('nat-open').hidden),"setup: BatStateU chosen, 'Open BatStateU' shown");
   await pg.evaluate(()=>NATGL.map.jumpTo({center:[122,12],zoom:5}));await pg.waitForTimeout(600);
   assert(await pg.evaluate(()=>NAT.sel===null&&document.getElementById('nat-open').hidden&&document.getElementById('nat-box').hidden),"zooming back out to the country lets go of the campus: no 'Open …', no box");
   const lim=await pg.evaluate(()=>{const m=NATGL.map;m.jumpTo({center:[160,40],zoom:1});const c=m.getCenter(),b=m.getBounds();
     return {z:m.getZoom(),min:m.getMinZoom(),seesPH:b.getWest()<121&&b.getEast()>121&&b.getSouth()<12&&b.getNorth()>12,c:[c.lng,c.lat]};});
   assert(lim.z>=lim.min&&lim.min>2&&lim.seesPH,"no zooming out past the whole country or dragging it out of view: "+JSON.stringify(lim));
   await ctx.close();}
  // no WebGL: the outline stays
  {const b2=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox','--disable-webgl','--disable-3d-apis']});
   const pg=await b2.newPage({viewport:{width:1280,height:900}});await pg.goto(U);await ready(pg,"ph");
   const st=await glUp(pg);
   assert(st==="off"&&await pg.evaluate(()=>!document.getElementById('nat-note').hidden),"no WebGL: the outline stays, with the note");
   await b2.close();}
  // narrow screens: the map above the list; a list row opens the campus directly (plan ruling 5)
  {const ctx=await b.newContext({viewport:{width:390,height:844}});const pg=await ctx.newPage();await pg.goto(U);await ready(pg,"ph");
   const s=await pg.evaluate(()=>({mapTop:document.querySelector('.nat-mapcol').getBoundingClientRect().top,listTop:document.querySelector('.nat-listcol').getBoundingClientRect().top,sw:document.documentElement.scrollWidth}));
   assert(s.mapTop<s.listTop&&s.sw<=390,"390 px: the map sits above the list, no sideways scroll");
   await openRow(pg,"xu");await pg.click('#nat-list a[data-id="xu"]');await ready(pg,"xu");
   assert(await pg.evaluate(()=>location.hash==="#xu"),"390 px: a list row opens the campus directly");
   await ctx.close();}
  // finding 1 (whole-branch review): on a phone, a one-finger drag over the map scrolls the page; moving the map takes two
  // fingers (MapLibre's cooperative gestures), with its help line in our language
  {const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const pg=await ctx.newPage();
   await pg.goto(U);await ready(pg,"ph");const st=await glUp(pg);await settle(pg);await pg.waitForTimeout(300);
   const c0=await pg.evaluate(()=>{const c=NATGL.map.getCenter();return [c.lng,c.lat];});
   const r=await pg.evaluate(()=>{const m=document.getElementById('nat-map').getBoundingClientRect();return {x:m.left+m.width*0.3,y:m.top+m.height*0.8};});
   const cdp=await ctx.newCDPSession(pg);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x,y:r.y}]});
   for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x,y:r.y-i*30}]});await pg.waitForTimeout(16);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pg.waitForTimeout(600);
   let s=await pg.evaluate(()=>{const c=NATGL.map.getCenter();return {y:scrollY,c:[c.lng,c.lat],coop:NATGL.map.cooperativeGestures.isEnabled()};});
   assert(st==="on"&&s.coop&&s.y>0&&Math.hypot(s.c[0]-c0[0],s.c[1]-c0[1])<0.01,"390 px touch: a one-finger drag over the map scrolls the page and leaves the map where it was: "+JSON.stringify({st,c0,...s}));
   const coopText=()=>pg.evaluate(()=>{const k="CooperativeGesturesHandler.",L=NL().coop;
     return {mobile:(document.querySelector('#nat-gl .maplibregl-mobile-message')||{}).textContent,want:L.mobile,
       loc:[NATGL.map._locale[k+"WindowsHelpText"],NATGL.map._locale[k+"MacHelpText"],NATGL.map._locale[k+"MobileHelpText"]].join("|"),wantLoc:[L.win,L.mac,L.mobile].join("|")};});
   s=await coopText();
   assert(s.mobile===s.want&&s.want==="Use two fingers to move the map"&&s.loc===s.wantLoc,"390 px touch: the two-finger help line is ours (English): "+JSON.stringify(s));
   await pg.evaluate(()=>scrollTo(0,0));await pg.selectOption('#nat-lang','ceb');await pg.waitForTimeout(150);
   s=await coopText();
   assert(s.mobile===s.want&&s.want===await pg.evaluate(()=>NAT_LANGS.ceb.coop.mobile)&&s.loc===s.wantLoc,"390 px touch: a language change rewrites the help line (Cebuano): "+JSON.stringify(s));
   await pg.selectOption('#nat-lang','en');
   await ctx.close();}
  await b.close();
})();
