"use strict";
const {chromium}=require("playwright"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{JSDOM,VirtualConsole}=require("jsdom");
const B=require("./build-v17-production-handoff.cjs"),H=require("../src/experimental/v17-production-handoff.cjs"),pre=require("./build-v17-prerelease.cjs"),S=require("./build-v17-production-site.cjs");
const out=path.resolve(__dirname,"../preview-v17-native-design");
fs.mkdirSync(out,{recursive:true});
const old=H.ORIGIN+H.PATH,root=H.ORIGIN+H.PATH.replace(/v17\/$/,"");
const fixture=new JSDOM(pre.buildCandidate(),{url:"https://fixture.invalid/",runScripts:"dangerously",virtualConsole:new VirtualConsole(),beforeParse(w){
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}});
 w.fetch=async()=>{throw Error("Sin red")};
}});
const source=fixture.window.localStorage.getItem("rastro_lab_v17_prerelease_data_v1");fixture.window.close();
assert(source);const active=JSON.stringify({...JSON.parse(source),v17MigrationRehearsal:{format:"v17-private-lab-v1",importDate:"2026-11-26"}});
const modules=["dashboard","plan","movements","debts","shared","capital","projects","future"];
(async()=>{
 const browser=await chromium.launch({headless:true});const checks=[];
 try{
  const site=path.join(out,"site");S.build(site);
  const launcher=fs.readFileSync(path.join(site,"index.html"),"utf8"),pageHtml=fs.readFileSync(path.join(site,"v17/index.html"),"utf8");
  // All network is intercepted: no real account data or Worker requests.
  for(const width of [1440,390,320]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[],requests=[];
   page.on("pageerror",e=>errors.push(e.message));
   await page.route("**/*",route=>{const u=route.request().url();if(u===root||u===root+"index.html")return route.fulfill({contentType:"text/html",body:launcher});if(u===old||u===old+"index.html")return route.fulfill({contentType:"text/html",body:pageHtml});requests.push(u);return route.abort()});
   await page.addInitScript(({entries,origin})=>{if(location.origin===origin&&!localStorage.getItem("olo_v17_daniel_data_v1"))for(const [k,v] of Object.entries(entries))localStorage.setItem(k,v)},{origin:H.ORIGIN,entries:{[H.LEGACY]:source,[H.SOURCE]:source,[H.ACTIVE]:active}});
   await page.goto(root);await page.waitForURL(old);
   await page.locator(".olo-original-header").waitFor();
   assert.equal(await page.locator("style#v17-native-module-css").count(),1);assert.equal(await page.locator("style#v17-original-design").count(),1);
   const baseline=await page.evaluate(k=>localStorage.getItem(k),H.ACTIVE);assert.equal(baseline,active);
   await page.locator(".olo-original-header #manageModulesBtn").click();for(const c of await page.locator("#rc-moduleChoices input").all())await c.check();await page.locator("#rc-closeModules").click();
   for(const theme of ["dark","light"]){
    await page.locator('.olo-original-header [data-theme-choice="'+theme+'"]').click();
    for(const name of modules){
     const button=page.locator('.olo-original-header [data-view="'+name+'"]');await button.click();
     assert(await button.evaluate(b=>b.classList.contains("active")));
     assert.equal(await page.locator(".demo-filter:visible").count(),["dashboard","plan","movements","shared","future"].includes(name)?1:0);
     assert.equal(await page.locator(".demo-header:visible").count(),0);
     assert.equal(await page.locator("html").getAttribute("data-theme"),theme);
     if(name==="dashboard"){
      assert(await page.locator("#view-dashboard").isVisible());
      assert(await page.locator("#expenseChart").isVisible());assert(await page.locator("#cashChart").isVisible());
      assert(await page.locator("#dashboardHeroValue").textContent()!=="—");
      // Check real pixels instead of merely checking existence of canvas tags.
      for(const id of ["expenseChart","cashChart"]){
       await page.waitForFunction(id=>{const c=document.getElementById(id);if(!c||!c.width||!c.height)return false;const d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i])return true;return false},id);
      }
      if(width!==320)await page.screenshot({path:path.join(out,"Inicio-"+width+"-"+theme+".png"),fullPage:true});
     }else {assert(!(await page.locator("#view-dashboard").isVisible()));if(["movements","debts","shared","capital","projects"].includes(name))assert(await page.locator("#view-"+name).isVisible());if(name==="future")assert(await page.locator(".one-future-panel:visible").count()>=1);if(name==="plan")assert.equal(await page.locator(".olo-budget-shell:visible").count(),1);}
     if(width===1440&&name!=="dashboard")await page.screenshot({path:path.join(out,name+"-"+theme+".png"),fullPage:true});
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1?[]:[...document.querySelectorAll("body *")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)&&!e.closest(".table-wrap")}).slice(0,20).map(e=>({id:e.id,cls:String(e.className).slice(0,100),width:Math.round(e.getBoundingClientRect().width),right:Math.round(e.getBoundingClientRect().right)})));
     if(overflow.length){await page.screenshot({path:path.join(out,"OVERFLOW-"+name+"-"+width+"-"+theme+".png"),fullPage:true});console.error(JSON.stringify(overflow))}
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Overflow "+width+" "+theme+" "+name);
     checks.push({width,theme,module:name});
    }
   }
   await page.locator('.olo-original-header [data-view="plan"]').click();
   for(const level of ["week","fortnight","month","quarter","half","year"]){
    await page.locator("#olo-period-level").selectOption(level);assert.equal(await page.locator(".olo-budget-shell:visible").count(),1);assert(!/^\d{4}-\d{2}$/.test(await page.locator("#olo-period-label").textContent()));
    await page.locator("#olo-prev").click();await page.locator("#olo-next").click();
    for(const group of ["Ingreso","Pago deuda","Gasto"])await page.locator('[data-budget-group="'+group+'"]').click();
    assert.equal(await page.locator("[data-budget-total]").count(),3);
    if(level==="week"&&width===1440)await page.screenshot({path:path.join(out,"Presupuesto-semanal.png"),fullPage:true});
   }
   await page.locator("#olo-period-level").selectOption("month");
   await page.locator('.olo-original-header [data-display-currency="USD"]').click();
   assert.equal(await page.locator("#rc-displayCurrency").inputValue(),"USD");
   await page.locator('.olo-original-header [data-view="dashboard"]').click();
   assert(await page.locator("#view-dashboard").isVisible());
   await page.locator(".olo-original-header #oneSettingsBtn").click();assert(await page.locator("#rc-integrityDialog").isVisible());await page.locator("#rc-closeIntegrity").click();
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),H.ACTIVE),baseline);
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),H.LEGACY),source);
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),H.SOURCE),source);
   if(width===1440){
    await page.locator('.olo-original-header [data-view="plan"]').click();
    await page.locator("#olo-period-level").selectOption("month");
    await page.locator("#olo-period-label").click();
    const futureMonth=await page.locator("#olo-month-choice option").last().getAttribute("value");
    await page.locator("#olo-month-choice").selectOption(futureMonth);
    await page.locator('[data-budget-group="Gasto"]').click();
    await page.locator(".olo-budget-tools [data-add]").click();
    assert.equal(await page.locator("#olo-assignment-mode").inputValue(),"range");
    await page.locator("#rc-amount").fill("1234");
    await page.locator("#rc-review").click();
    assert(await page.locator("#rc-confirm").isEnabled(),await page.locator("#rc-error").textContent());
    await page.locator("#rc-confirm").click();
    await page.locator("#rc-edit").waitFor({state:"hidden"});
    const stored=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),H.ACTIVE)),assignment=stored.v16AssignmentOverlay.added.find(a=>a.source==="range");
    assert(assignment);assert.equal(assignment.minor,123400);assert.equal(assignment.start.slice(0,7),futureMonth);assert.equal(assignment.date,undefined);
    const original=JSON.parse(baseline);delete stored.v16AssignmentOverlay;delete original.v16AssignmentOverlay;assert.deepEqual(stored,original);
    assert.match(await page.locator('[data-budget-total="0"]').textContent(),/1[., \s]?234/);
    await page.locator("#olo-period-level").selectOption("week");
    assert(await page.locator(".olo-related:visible").count()>=1);
    await page.locator("#olo-period-level").selectOption("month");
    await page.locator(".olo-row-details summary").first().click();
    await page.locator('.olo-row-details [data-edit="'+assignment.id+'"]').click();
    await page.locator("#rc-amount").fill("2345");await page.locator("#rc-review").click();assert(await page.locator("#rc-confirm").isEnabled());await page.locator("#rc-confirm").click();
    const afterEdit=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),H.ACTIVE));assert.equal(afterEdit.v16AssignmentOverlay.added.find(a=>a.id===assignment.id).minor,234500);
    await page.locator(".olo-row-details summary").first().click();await page.locator('.olo-row-details [data-edit="'+assignment.id+'"]').click();await page.locator("#rc-deleteAssignment").click();assert(await page.locator("#rc-confirm").isEnabled());await page.locator("#rc-confirm").click();
    const afterDelete=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),H.ACTIVE));assert(!afterDelete.v16AssignmentOverlay.added.some(a=>a.id===assignment.id));
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),H.LEGACY),source);
   }
   assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);await page.close();
  }
  fs.writeFileSync(path.join(out,"visual-checks.json"),JSON.stringify({passed:true,checks},null,2));console.log("Native V16 header/dashboard + V17 data: "+checks.length+" combinations, both graphs painted, one temporal selector, root redirect, exact ledger preserved.");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
