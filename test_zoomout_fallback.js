// Without the detailed map (no WebGL): the flood map hands over to the country outline view and back (spec §6.1).
// Run: ./test_pages.sh test_zoomout_fallback.js. The one-map zoom with the detailed map is test_zoomout.js.
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
const up=pg=>pg.waitForFunction(()=>document.body.dataset.ready&&document.body.dataset.ready!=="",null,{timeout:15000}).then(()=>pg.waitForTimeout(300));
const glReady=pg=>pg.waitForFunction(()=>COUNTRY.state==="on"||COUNTRY.state==="off",null,{timeout:15000})
  .then(()=>pg.waitForFunction(()=>!COUNTRY.easing,null,{timeout:5000})).then(()=>pg.waitForTimeout(150));
// zoom out with the mouse wheel over the flood map, as a person would
async function wheelOut(pg){
  // a campus page puts its partnership card above the map: scroll the map into view first, as a person would
  const r=await pg.evaluate(()=>{const o=document.getElementById('overlay');o.scrollIntoView({block:"center"});const b=o.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};});
  await pg.mouse.move(r.x,r.y);
  for(let i=0;i<30&&!await pg.evaluate(()=>siteZoomedOut);i++){await pg.mouse.wheel(0,200);await pg.waitForTimeout(40);}
}
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const nc=async o=>{const c=await b.newContext(o);await c.addInitScript(()=>{window.BW_SITE_NO_GL=true;});return c;};
  const ctx=await nc({viewport:{width:1280,height:900}});
  await ctx.addInitScript(()=>{try{for(const k of ["tv","upd","berkeley"])localStorage.setItem("bw-asked:"+k,"1");}catch(e){}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const libReqs=[];pg.on('request',r=>{if(/maplibre-gl|basemap-style/.test(r.url()))libReqs.push(r.url());});
  await pg.goto(U+'#tv');await up(pg);
  let s=await pg.evaluate(()=>({btn:!document.getElementById('to-country').hidden&&document.getElementById('to-country').textContent,out:siteZoomedOut}));
  assert(s.btn==="Whole country"&&!s.out,"Teachers Village: a 'Whole country' button, flood map showing");
  assert(libReqs.length===0,"spec §8: a campus page loads no MapLibre and no basemap style before the first handover: "+libReqs.join(", "));
  await wheelOut(pg);await glReady(pg);
  assert(libReqs.some(u=>/maplibre-gl\.mjs/.test(u)),"the first handover loads MapLibre");
  s=await pg.evaluate(()=>{const el=document.getElementById('country'),r=el.getBoundingClientRect(),bx=document.getElementById('country-box').getBoundingClientRect();
    return {out:siteZoomedOut,shown:!el.hidden,gl:el.dataset.gl==="1",state:COUNTRY.state,
      box:!document.getElementById('country-box').hidden&&bx.left>=r.left&&bx.right<=r.right&&bx.top>=r.top&&bx.bottom<=r.bottom,
      label:document.getElementById('country-label').textContent,pins:document.querySelectorAll('#country-pins > *').length,
      back:document.activeElement.id,cov:bwCoverage(countryBoxPx(countryProj()),el.clientWidth,el.clientHeight)};});
  assert(s.out&&s.shown&&s.gl&&s.state==="on","wheeling out past the whole box hands over to the vector map: "+JSON.stringify(s));
  assert(s.box&&s.label==="Simulated area"&&s.cov<0.9,"the site's box is outlined and labelled 'Simulated area', smaller than the view: "+s.cov.toFixed(2));
  assert(s.pins>0&&s.back==="country-back","campus pins show, and focus is on 'Back to the flood map'");
  assert(await pg.evaluate(()=>[...document.querySelectorAll('#map-wrap > :not(#country)')].every(e=>getComputedStyle(e).visibility==="hidden")),
    "the flood map's own controls step out of sight and out of the tab order under the country view");
  // screen-reader text (UX profile: every map): a named group, described by the site's area, the region and the campuses
  const srText=pg=>pg.evaluate(()=>{const el=document.getElementById('country'),l=document.getElementById(el.getAttribute('aria-labelledby')),d=document.getElementById(el.getAttribute('aria-describedby'));
    return {role:el.getAttribute('role'),name:l&&l.textContent,desc:d&&d.textContent,site:siteLabel(SITE),n:CAMPUSES.length};});
  s=await srText(pg);
  assert(s.role==="group"&&s.name==="Teachers Village, zoomed out","the country view is a group named for the site: "+JSON.stringify(s.name));
  assert(s.desc==="Map of the Philippines. A dashed box marks the simulated area of Teachers Village. Pins mark the PhilDev partner campuses in view, out of "+s.n+" across the country. Zoom in on the box, or use Back to the flood map, to return.",
    "its description names the simulated area, the region and the campuses: "+s.desc);
  // true at every zoom: at the entry zoom only a few pins are in view, so it never claims all of them are on the map
  s=await pg.evaluate(()=>({desc:document.getElementById('country-desc').textContent,inView:document.querySelectorAll('#country-pins .pin').length+[...document.querySelectorAll('#country-pins .pin-cluster')].reduce((a,c)=>a+c.dataset.ids.split(",").length,0),n:CAMPUSES.length}));
  assert(s.inView<s.n&&!new RegExp("marks the "+s.n+"|"+s.n+" PhilDev partner campuses").test(s.desc),"it does not claim all "+s.n+" campuses are on the map when "+s.inView+" are in view: "+s.desc);
  assert(await pg.getByRole('group',{name:"Teachers Village, zoomed out"}).count()===1,"the accessible name resolves in the browser");
  await pg.selectOption('#p-lang','fil');await pg.waitForTimeout(100);
  s=await pg.evaluate(()=>({name:document.getElementById('country-l').textContent,desc:document.getElementById('country-desc').textContent,
    wantL:fill(NAT_LANGS.fil.countryL,{site:"Teachers Village"}),wantD:fill(NAT_LANGS.fil.countryPh,{site:"Teachers Village",n:CAMPUSES.length}),out:siteZoomedOut}));
  assert(s.out&&s.name===s.wantL&&s.desc===s.wantD&&!/Map of/.test(s.desc),"a language change rewrites the name and description (Filipino): "+s.name+" / "+s.desc);
  await pg.selectOption('#p-lang','en');await pg.waitForTimeout(100);
  // the slack: a small zoom back in does not flip back
  await pg.evaluate(()=>COUNTRY.map.zoomTo(COUNTRY.map.getZoom()+0.3,{duration:0}));await pg.waitForTimeout(200);
  assert(await pg.evaluate(()=>siteZoomedOut),"a small zoom back in stays on the country view (no flicker)");
  // zooming in until the box fills the view returns to the flood map
  await pg.evaluate(()=>COUNTRY.map.fitBounds([[DATA.bbox[0],DATA.bbox[1]],[DATA.bbox[2],DATA.bbox[3]]],{padding:0,duration:0}));await pg.waitForTimeout(200);
  s=await pg.evaluate(()=>({out:siteZoomedOut,hidden:document.getElementById('country').hidden,z:ZOOM.z,min:ZOOM.min}));
  assert(!s.out&&s.hidden&&s.z===s.min,"zooming in until the box fills the view returns to the flood map, at the whole-box zoom");
  // the button, Back, and Escape
  await pg.click('#to-country');await glReady(pg);
  assert(await pg.evaluate(()=>siteZoomedOut),"'Whole country' hands over too");
  await pg.click('#country-back');
  assert(await pg.evaluate(()=>!siteZoomedOut&&document.getElementById('country').hidden&&document.activeElement.id==="to-country"),"'Back to the flood map' returns, with focus on 'Whole country'");
  await pg.click('#to-country');await glReady(pg);await pg.keyboard.press('Escape');
  assert(await pg.evaluate(()=>!siteZoomedOut),"Escape returns to the flood map");
  // Review Focus 2: a theme switch restyles the country map and keeps the box
  await pg.click('#to-country');await glReady(pg);
  await pg.click('#p-theme');await pg.waitForTimeout(500);
  s=await pg.evaluate(()=>({t:COUNTRY.theme,box:!document.getElementById('country-box').hidden,out:siteZoomedOut}));
  assert(s.t==="dark"&&s.box&&s.out,"switching theme restyles the country map and keeps the box: "+JSON.stringify(s));
  await pg.click('#p-theme');
  // Review Focus 4: leaving a site while zoomed out closes the country view; the next site starts on its flood map
  await pg.goto(U+'#upd');await up(pg);
  s=await pg.evaluate(()=>({out:siteZoomedOut,hidden:document.getElementById('country').hidden,site:SITE}));
  assert(!s.out&&s.hidden&&s.site==="upd","opening UP Diliman closes Teachers Village's country view");
  await wheelOut(pg);await glReady(pg);
  s=await pg.evaluate(()=>({out:siteZoomedOut,own:!!document.querySelector('#country-pins .pin-sel[data-id="upd"]')||[...document.querySelectorAll('#country-pins .pin-cluster')].some(c=>c.dataset.ids.split(",").includes("upd"))}));
  assert(s.out&&s.own,"UP Diliman zooms out too; its own pin is marked (or inside a cluster)");
  await pg.click('.site-tabs [data-site="ph"]:visible');await pg.waitForFunction(()=>ROUTE==="ph");
  await pg.goto(U+'#upd');await up(pg);
  assert(await pg.evaluate(()=>!siteZoomedOut&&document.getElementById('country').hidden),"after the national map and back, UP Diliman starts on its flood map");
  await wheelOut(pg);await glReady(pg);
  await pg.click('.site-tabs [data-site="try"]:visible');await pg.waitForTimeout(400);
  assert(await pg.evaluate(()=>TRY&&!siteZoomedOut&&document.getElementById('country').hidden&&document.getElementById('to-country').hidden),"Try reporting closes the country view and has no 'Whole country'");
  await wheelOut(pg);
  assert(await pg.evaluate(()=>!siteZoomedOut),"in Try reporting, zooming out never hands over");
  // UC Berkeley: its country view is California, with no PhilDev pins
  await pg.goto(U+'#berkeley');await up(pg);await wheelOut(pg);await glReady(pg);
  s=await pg.evaluate(()=>({out:siteZoomedOut,pins:document.querySelectorAll('#country-pins > *').length,min:COUNTRY.map.getMinZoom()}));
  assert(s.out&&s.pins===0&&s.min<=2,"UC Berkeley zooms out too, with no PhilDev pins: "+JSON.stringify(s));
  s=await srText(pg);
  assert(s.role==="group"&&s.name==="UC Berkeley, zoomed out"&&s.desc==="Map of the San Francisco Bay Area and beyond. A dashed box marks the simulated area of UC Berkeley. There are no PhilDev campuses here. Zoom in on the box, or use Back to the flood map, to return.",
    "UC Berkeley's country view is named and described without campuses: "+JSON.stringify(s));
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await ctx.close();
  // controller ruling: the vector country view carries the tile credit, 12 px, never under "Back to the flood map" or the note
  for(const vw of [1280,390]){
    const c=await nc({viewport:{width:vw,height:vw>900?900:844},reducedMotion:vw>900?"no-preference":"reduce"});
    await c.addInitScript(()=>{try{localStorage.setItem("bw-asked:tv","1");}catch(e){}});
    const p=await c.newPage();await p.goto(U+'#tv');await up(p);
    // "Whole country" covers none of the flood map's own chrome (the coach note, zoom, legend, notes), in either view
    for(const v of ["public","details"]){
      if(v==="details"){await p.click('#p-details');await p.waitForTimeout(300);}
      const hits=await p.evaluate(()=>{const t=document.getElementById('to-country').getBoundingClientRect();
        return [...document.querySelectorAll('#map-wrap > *:not(#to-country):not(#country):not(canvas):not(#map-tooltip):not(.sr-only):not(#site-gl):not(#site-pins)')]
          .filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=="none"&&getComputedStyle(e).visibility!=="hidden")
          .filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.left<t.right&&t.left<r.right&&r.top<t.bottom&&t.top<r.bottom;}).map(e=>e.id||e.className);});
      assert(hits.length===0,vw+" px, "+v+" view: 'Whole country' covers no other map control or note: "+hits.join(", "));
    }
    await p.goto(U+'#tv');await up(p);
    await p.click('#to-country');await glReady(p);
    s=await p.evaluate(()=>{const cr=document.getElementById('country-credit'),bk=document.getElementById('country-back'),nt=document.getElementById('country-note'),
      box=document.getElementById('country').getBoundingClientRect(),r=cr?cr.getBoundingClientRect():null,k=bk.getBoundingClientRect(),n=nt.getBoundingClientRect();
      const hit=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
      return {gl:document.getElementById('country').dataset.gl==="1",shown:!!cr&&cr.getClientRects().length>0&&getComputedStyle(cr).display!=="none",
        text:cr&&cr.textContent,want:NL().credit,px:cr&&getComputedStyle(cr).fontSize,
        inside:!!r&&r.left>=box.left&&r.right<=box.right&&r.top>=box.top&&r.bottom<=box.bottom,
        clearBack:!!r&&!hit(r,k),clearNote:!!r&&(nt.hidden||!hit(r,n)),backH:k.height};});
    assert(s.gl&&s.shown&&s.text===s.want&&s.px==="12px"&&s.inside,vw+" px: the vector country view shows the OpenStreetMap/OpenFreeMap credit, 12 px, inside the map: "+JSON.stringify(s));
    assert(s.clearBack&&s.clearNote&&s.backH>=48,vw+" px: the credit is not covered by 'Back to the flood map' (48 px) or the note");
    if(vw<900){   // reduced motion: the ease out is instant, and zooming back in still returns
      await p.evaluate(()=>COUNTRY.map.fitBounds([[DATA.bbox[0],DATA.bbox[1]],[DATA.bbox[2],DATA.bbox[3]]],{padding:0,duration:0}));await p.waitForTimeout(200);
      assert(await p.evaluate(()=>!siteZoomedOut),"under reduced motion, zooming in until the box fills the view returns to the flood map");}
    await c.close();
  }
  // finding 2 (whole-branch review): the first handover on a cold library (spec §6.1). While MapLibre loads, the flood map stays
  // (dimmed) with a loading line, never the whole-country outline; once it is up, the flood canvas fades out (200 ms, none under
  // reduced motion) onto the site-fitted view eased out 1.5 levels. Back/Escape cancel during loading; a second zoom out loads nothing new.
  const rendered=id=>{const e=document.getElementById(id);return !!e&&e.getClientRects().length>0&&getComputedStyle(e).display!=="none"&&getComputedStyle(e).visibility!=="hidden";};
  const floodCv=()=>{const e=document.getElementById('map'),cs=getComputedStyle(e);
    return {vis:cs.visibility,op:+cs.opacity,fade:cs.transitionProperty.split(", ").map((p,i)=>p+" "+cs.transitionDuration.split(", ")[i]).find(x=>/^(opacity|all) /.test(x))||"none"};};
  for(const rm of ["no-preference","reduce"]){
    const c=await nc({viewport:{width:1280,height:900},reducedMotion:rm});
    await c.addInitScript(()=>{try{localStorage.setItem("bw-asked:tv","1");}catch(e){}});
    const p=await c.newPage();const lib=[];p.on('request',r=>{if(/maplibre-gl\.mjs/.test(r.url()))lib.push(r.url());});
    await p.route('**/maplibre-gl.mjs',r=>setTimeout(()=>r.continue(),2500));
    await p.goto(U+'#tv');await up(p);
    await p.click('#to-country');await p.waitForTimeout(400);
    s=await p.evaluate(`(()=>{const rendered=${rendered};const floodCv=${floodCv};
      return {st:COUNTRY.state,out:siteZoomedOut,cv:floodCv(),svg:rendered('country-svg'),box:rendered('country-box'),label:rendered('country-label'),
        pins:document.querySelectorAll('#country-pins > *').length,note:rendered('country-note')&&document.getElementById('country-note').textContent,want:NL().mapLoading,
        back:rendered('country-back'),focus:document.activeElement.id};})()`);
    assert(s.st==="loading"&&s.out&&s.cv.vis==="visible"&&s.cv.op>0,rm+": while the library loads, the flood map stays in view: "+JSON.stringify(s));
    assert(!s.svg&&!s.box&&!s.label&&s.pins===0,rm+": while the library loads, no whole-country outline, box or pins: "+JSON.stringify(s));
    assert(!!s.want&&s.note===s.want&&s.back&&s.focus==="country-back",rm+": while the library loads, a loading line and 'Back to the flood map' (focused): "+JSON.stringify(s));
    await p.keyboard.press('Escape');
    s=await p.evaluate(`(()=>{const floodCv=${floodCv};return {out:siteZoomedOut,hidden:document.getElementById('country').hidden,cv:floodCv(),st:COUNTRY.state};})()`);
    assert(!s.out&&s.hidden&&s.cv.vis==="visible"&&s.cv.op===1,rm+": Escape during loading returns to the flood map: "+JSON.stringify(s));
    await p.click('#to-country');await p.waitForTimeout(100);
    assert(await p.evaluate(()=>siteZoomedOut&&COUNTRY.state==="loading")&&lib.length===1,rm+": zooming out again during loading starts no second load: "+lib.length);
    await p.waitForFunction(()=>COUNTRY.state==="on",null,{timeout:15000});
    s=await p.evaluate(`(()=>{const floodCv=${floodCv};return {cv:floodCv(),gl:document.getElementById('country').dataset.gl};})()`);
    assert(s.gl==="1"&&(rm==="reduce"?s.cv.fade==="none"||/ 0s$/.test(s.cv.fade):s.cv.fade==="opacity 0.2s"),rm+": the flood canvas fades out as the map appears ("+(rm==="reduce"?"instantly":"200 ms")+"): "+JSON.stringify(s));
    await glReady(p);
    s=await p.evaluate(`(()=>{const rendered=${rendered};const floodCv=${floodCv};const m=COUNTRY.map,el=document.getElementById('country'),want=m.cameraForBounds(siteLL(),{padding:0}),cc=m.getCenter();
      return {z:m.getZoom(),want:want.zoom-1.5,d:Math.hypot(cc.lng-want.center.lng,cc.lat-want.center.lat),cov:bwCoverage(countryBoxPx(countryProj()),el.clientWidth,el.clientHeight),
        cv:floodCv(),svg:rendered('country-svg'),box:rendered('country-box'),note:rendered('country-note')};})()`);
    assert(Math.abs(s.z-s.want)<0.05&&s.d<0.01&&s.cov>0.2&&s.cov<0.9,rm+": once loaded, the view is centred on the site at its fitting zoom, eased out 1.5 levels: "+JSON.stringify(s));
    assert(s.cv.vis==="hidden"&&s.cv.op===0&&!s.svg&&s.box&&!s.note,rm+": the flood canvas is gone, the box shows, no outline or note: "+JSON.stringify(s));
    await c.close();
  }
  // a load that fails after a while: the outline with the box and the note, as before
  {const c=await nc({viewport:{width:1280,height:900}});
   await c.addInitScript(()=>{try{localStorage.setItem("bw-asked:tv","1");}catch(e){}});
   const p=await c.newPage();await p.route('**/maplibre-gl.mjs',r=>setTimeout(()=>r.abort(),1200));
   await p.goto(U+'#tv');await up(p);await p.click('#to-country');await p.waitForTimeout(300);
   s=await p.evaluate(`(()=>{const rendered=${rendered};return {st:COUNTRY.state,svg:rendered('country-svg')};})()`);
   assert(s.st==="loading"&&!s.svg,"a failing load: no outline while it is still loading: "+JSON.stringify(s));
   await glReady(p);await p.waitForTimeout(250);                    // the flood canvas's 200 ms fade
   s=await p.evaluate(`(()=>{const rendered=${rendered};const floodCv=${floodCv};return {st:COUNTRY.state,out:siteZoomedOut,svg:rendered('country-svg'),box:rendered('country-box'),
     note:rendered('country-note')&&document.getElementById('country-note').textContent,want:NL().mapNote,cv:floodCv().vis};})()`);
   assert(s.st==="off"&&s.out&&s.svg&&s.box&&s.note===s.want&&s.cv==="hidden","a failing load: the outline with its box and the note: "+JSON.stringify(s));
   await c.close();}
  // offline: a Philippine site shows the outline with its box; Berkeley shows only the note (plan ruling 7)
  {const c2=await nc({viewport:{width:1280,height:900}});
   await c2.addInitScript(()=>{window.BW_NO_BASEMAP=true;try{for(const k of ["tv","berkeley"])localStorage.setItem("bw-asked:"+k,"1");}catch(e){}});
   const p=await c2.newPage();await p.goto(U+'#tv');await up(p);await wheelOut(p);await glReady(p);
   s=await p.evaluate(()=>({out:siteZoomedOut,svg:getComputedStyle(document.getElementById('country-svg')).display!=="none",box:!document.getElementById('country-box').hidden,note:!document.getElementById('country-note').hidden}));
   s.credit=await p.evaluate(()=>{const cr=document.getElementById('country-credit');return !!cr&&cr.getClientRects().length>0;});
   assert(!s.credit,"offline: the outline carries no tile credit");
   assert(s.out&&s.svg&&s.box&&s.note,"offline: Teachers Village's country view is the outline with its box, and the note: "+JSON.stringify(s));
   await p.click('#country-back');
   await p.goto(U+'#berkeley');await up(p);await wheelOut(p);await glReady(p);
   s=await p.evaluate(()=>({out:siteZoomedOut,svg:getComputedStyle(document.getElementById('country-svg')).display!=="none",note:!document.getElementById('country-note').hidden}));
   assert(s.out&&!s.svg&&s.note,"offline: Berkeley shows the note only: "+JSON.stringify(s));
   s=await p.evaluate(()=>({name:document.getElementById('country-l').textContent,desc:document.getElementById('country-desc').textContent,note:NL().mapNote}));
   assert(s.name==="UC Berkeley, zoomed out"&&s.desc==="The simulated area of UC Berkeley, zoomed out. "+s.note,"offline: Berkeley's description says there is no map to describe: "+JSON.stringify(s));
   await c2.close();}
  await b.close();
})();
