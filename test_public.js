// Browser tests for the public view: fixed figure placement and whole-street highlight. Run: node test_public.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1280,height:900}});
  await pg.addInitScript(()=>{window.BW_NO_BASEMAP=true;});   // these checks read the flood canvas's own drawing of the streets
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(BASE+'bahawatch_dashboard.html#tv');await pg.waitForFunction(()=>document.body.dataset.ready);await pg.waitForTimeout(400);
  const setAll=async(cm)=>pg.evaluate(cm=>{playing=false;for(const s of HOUSEHOLD){s.depth=cm/100;s.rate=0;s.status=statusOf(s);}computeFlood(0);renderFlood();drawMap();renderPublic();},cm);
  const figBox=async()=>pg.$eval('#p-figure svg',e=>{const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top)];});
  // 1. figure placement is independent of the sentence length
  await setAll(0);const short=await figBox();const s1=await pg.$eval('#p-headline',e=>e.textContent);
  await setAll(60);const long=await figBox();const s2=await pg.$eval('#p-headline',e=>e.textContent);
  assert(s1!==s2&&s1.length<s2.length,`sentences differ in length: "${s1}" vs "${s2}"`);
  assert(short[0]===long[0]&&short[1]===long[1],`figure at the same position for both (${short} vs ${long})`);
  // 2. whole-street highlight follows selection, by OSM street name
  await pg.evaluate(()=>selectSensor(HOUSEHOLD[1]));           // BW-H02, Maginhawa Street
  let ways=await pg.evaluate(()=>selectedStreetWays().length);
  assert(ways>1,"Maginhawa selection highlights several OSM ways ("+ways+")");
  const namesOk=await pg.evaluate(()=>selectedStreetWays().every(r=>r.n==="Maginhawa Street"));
  assert(namesOk,"all highlighted ways are named Maginhawa Street");
  await pg.evaluate(()=>selectSensor(HOUSEHOLD[2]));           // BW-H03, Malingap Street
  const mal=await pg.evaluate(()=>selectedStreetWays().map(r=>r.n));
  assert(mal.length>0&&mal.every(n=>n==="Malingap Street"),"switching to Malingap highlights only Malingap ("+mal.length+")");
  await pg.evaluate(()=>selectSensor(null));
  ways=await pg.evaluate(()=>selectedStreetWays().length);
  assert(ways===0,"deselecting clears the highlight");
  // 3. recede-and-outline: the selected street stays white, other streets fade, and no blue is used for the highlight
  const pxOf=async(name)=>pg.evaluate(name=>{
    const r=DATA.roads.filter(r=>r.n===name).sort((a,b)=>b.p.length-a.p.length)[0];
    const [x,y]=r.p[Math.floor(r.p.length/2)];
    const c=document.getElementById("map").getContext("2d");
    const X=(view.ox+x*view.sc)*view.dpr,Y=(view.oy+y*view.sc)*view.dpr;
    return Array.from(c.getImageData(Math.round(X),Math.round(Y),1,1).data).slice(0,3);
  },name);
  await setAll(0);await pg.evaluate(()=>{selectSensor(null);resetView();});
  const magBefore=await pxOf("Maginhawa Street"),malBefore=await pxOf("Malingap Street");
  await pg.evaluate(()=>selectSensor(HOUSEHOLD[1]));
  const magAfter=await pxOf("Maginhawa Street"),malAfter=await pxOf("Malingap Street");
  const isWhite=p=>p.every(v=>v>=250), isBlueish=p=>p[2]>p[0]+40;
  assert(isWhite(magBefore)&&isWhite(magAfter),`selected street stays white (${magBefore} → ${magAfter})`);
  assert(isWhite(malBefore)&&!isWhite(malAfter),`other streets recede (${malBefore} → ${malAfter})`);
  assert(!isBlueish(magAfter)&&!isBlueish(malAfter),"no blue used for the highlight");
  const lbl=await pg.evaluate(()=>typeof selectedStreetLabel==="function"&&!!selectedStreetLabel());
  assert(lbl,"a label position exists for the selected street");
  // 4. selection marker: no ring; the marker itself grows
  const ringless=await pg.evaluate(()=>!/R\+7,0,7\);ctx\.strokeStyle=P\.select/.test(drawOverlayInner.toString()));
  assert(ringless,"no selection ring drawn around markers");
  const grows=await pg.evaluate(()=>/selected\?/.test(drawOverlayInner.toString())&&/drawMarker\(ctx,X,Y,R\*/.test(drawOverlayInner.toString()));
  assert(grows,"selected marker is drawn at a larger radius");
  // "Choose my street" picker: the "near …" part sits on its own line, not glued to the name
  await pg.click('#p-my-btn');await pg.waitForTimeout(100);
  const pk=await pg.evaluate(()=>{const sm=document.querySelector('#p-pick button small');if(!sm)return null;const cs=getComputedStyle(sm);return {display:cs.display,weight:cs.fontWeight,n:document.querySelectorAll('#p-pick button').length};});
  assert(pk&&pk.display==="block"&&pk.n===8&&+pk.weight<600,"picker cross-street on its own line, regular weight: "+JSON.stringify(pk));
  await pg.click('#p-my-btn');await pg.waitForTimeout(50);
  // ping rings around non-normal sensors animate in the public view too
  const ring=await pg.evaluate(()=>{
    playing=false;for(const s of HOUSEHOLD){s.depth=0;s.status="ok";}const u=HOUSEHOLD[2];u.depth=0.3;u.status=statusOf(u);
    const X=view.ox+u.x*view.sc,Y=view.oy+u.y*view.sc,ctx=ovCv.getContext("2d");
    const sample=t=>{pulseT=t;drawOverlayCanvas();const r=9+3+t*15;const d=ctx.getImageData(Math.round(X*view.dpr),Math.round((Y+r)*view.dpr),1,1).data;return d[3];};   // sample below the marker, clear of its label
    return {early:sample(0.25),late:sample(0.95)};
  });
  assert(ring.early>40&&ring.late<ring.early,"ping ring drawn around a wet sensor in the public view: "+JSON.stringify(ring));
  assert(errs.length===0,"no page errors: "+errs.join("; "));
  await b.close();
})();
