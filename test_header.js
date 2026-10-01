// One header on every page (Gregor, 2026-10-01): the logo, "BahaWatch" at the same size and weight, and the thick black
// rule under the top of the page. Also: the "Choose my street" button sits centred on its row with its shadow inside the
// column, and the PhilDev page says the collaboration is still being discussed. Run: ./test_pages.sh test_header.js
const {chromium}=require('playwright');
const BASE=process.env.BW_BASE||'http://127.0.0.1:8765/';
const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exitCode=1;}else console.log("ok  ",m);};
const U=BASE+'bahawatch_dashboard.html';
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const errs=[];
  for(const w of [1280,375]){
    const ctx=await b.newContext({viewport:{width:w,height:900}});
    await ctx.addInitScript(()=>{try{for(const k of ["tv","sjq","berkeley"])localStorage.setItem("bw-asked:"+k,"1");}catch(e){}});
    const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
    const seen=[];
    for(const h of ['','#ph','#tv','#tv/details','#sjq','#berkeley','#try','#about','#access']){
      await pg.goto(U+h);await pg.waitForFunction(()=>document.body.dataset.ready,null,{timeout:15000});await pg.waitForTimeout(h==='#tv/details'?800:300);
      const s=await pg.evaluate(()=>{
        const name=[...document.querySelectorAll('.p-name,.brand-name')].find(e=>e.offsetParent&&e.textContent.trim()==="BahaWatch");
        if(!name)return null;
        const top=name.closest('.nat-top,.p-head,header');const cs=getComputedStyle(name),tb=getComputedStyle(top);
        const logo=top.querySelector('img');
        return {size:cs.fontSize,weight:cs.fontWeight,rule:tb.borderBottomWidth+" "+tb.borderBottomStyle+" "+tb.borderBottomColor,logo:!!(logo&&logo.complete&&logo.naturalWidth>0&&logo.getBoundingClientRect().width>=32)};});
      seen.push((h||'#home')+": "+JSON.stringify(s));
      assert(s&&s.size==="20px"&&s.weight==="700",`${w} ${h||'#home'}: "BahaWatch" is 20 px bold: ${JSON.stringify(s)}`);
      assert(s&&s.rule==="3px solid rgb(35, 33, 32)",`${w} ${h||'#home'}: a thick black rule closes the top of the page: ${s&&s.rule}`);
      assert(s&&s.logo,`${w} ${h||'#home'}: the logo sits beside the name`);
    }
    // Choose my street: centred on the "My street" row, its shadow inside the column
    await pg.goto(U+'#tv');await pg.waitForFunction(()=>document.body.dataset.ready==="tv");
    const c=await pg.evaluate(()=>{const btn=document.getElementById('p-my-btn'),row=btn.closest('.p-sec-h'),h=row.querySelector('h2');
      const rb=btn.getBoundingClientRect(),rr=row.getBoundingClientRect(),hb=h.getBoundingClientRect(),lift=parseFloat(getComputedStyle(btn).getPropertyValue('--lift'))||0;
      return {mid:(rb.top+rb.bottom+lift)/2,hmid:(hb.top+hb.bottom)/2,right:rb.right+lift,rowRight:rr.right};});
    assert(Math.abs(c.mid-c.hmid)<=2&&c.right<=c.rowRight+0.5,`${w}: "Choose my street" (with its shadow) is centred on the row and stays inside it: ${JSON.stringify(c)}`);
    // the PhilDev page: the collaboration is under discussion; barangay is glossed
    await pg.goto(U+'#ph');await pg.waitForFunction(()=>document.body.dataset.ready==="ph");
    const p=await pg.evaluate(()=>{const t=document.getElementById('nat-talks'),i=document.getElementById('nat-intro');return {t:t&&t.textContent,before:t&&!!(t.compareDocumentPosition(i)&Node.DOCUMENT_POSITION_FOLLOWING),i:i.textContent};});
    assert(/in talks with PhilDev/.test(p.t)&&/what that collaboration could look like/.test(p.t)&&p.before,`${w}: the PhilDev page first says the collaboration is being discussed: ${p.t}`);
    assert(/barangays \(neighbourhoods\)/.test(p.i),`${w}: the PhilDev intro glosses barangays`);
    await pg.selectOption('#nat-lang','fil');await pg.waitForTimeout(200);
    const fil=await pg.evaluate(()=>document.getElementById('nat-talks').textContent);
    assert(/PhilDev/.test(fil)&&!/We are in talks/.test(fil),`${w}: the note is translated: ${fil.slice(0,60)}`);
    await pg.selectOption('#nat-lang','en');
    await ctx.close();
  }
  assert(errs.length===0,"no page errors: "+errs.join(" | "));
  await b.close();
})();
