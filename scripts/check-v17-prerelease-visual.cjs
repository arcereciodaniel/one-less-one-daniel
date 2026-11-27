"use strict";
const {chromium}=require("playwright"),assert=require("node:assert/strict"),path=require("node:path"),{pathToFileURL}=require("node:url"),fs=require("node:fs");
const modules=[["home","Inicio"],["budget","Presupuesto"],["moves","Movimientos"],["debts","Deudas"],["collections","Cobros"],["goals","Metas"],["projects","Proyectos"],["future","Futuro"]];
(async()=>{const browser=await chromium.launch({headless:true}),dir=path.resolve(__dirname,"../preview-v17-prerelease"),url=pathToFileURL(path.join(dir,"lab/v17/index.html")).href,results=[];
try{
 for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],requests=[];page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});await page.goto(url);
  await page.locator("#rc-content").getByText("Saldo operativo",{exact:false}).first().waitFor();
  const key="rastro_lab_v17_prerelease_data_v1",baseline=await page.evaluate(k=>localStorage.getItem(k),key);
  await page.locator("#rc-manageModules").click();for(const c of await page.locator("#rc-moduleChoices input").all())await c.check();await page.locator("#rc-closeModules").click();
  await page.locator("#rc-current").click();await page.locator("#rc-next").click();
  const selection=await page.locator("#rc-slot").inputValue(),month=await page.locator("#rc-month").inputValue();
  for(const mode of ["dark","light"]){
   await page.locator("#rc-"+mode+"Theme").click();
   for(const [id,title] of modules){
    await page.locator('[data-module="'+id+'"]').click();
    assert.equal(await page.locator("#rc-title").textContent(),title);
    assert.equal(await page.locator("#rc-slot").inputValue(),selection);
    assert.equal(await page.locator("#rc-month").inputValue(),month);
    assert.equal(await page.locator(".demo-filter:visible").count(),1);
    assert(await page.locator("#rc-manageModules").isVisible());
    assert.equal(await page.locator("html").getAttribute("data-theme"),mode);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Page overflow "+width+" "+mode+" "+id);
    assert(!(await page.locator("#rc-content").textContent()).includes("No se puede continuar"));
    if(width!==320)await page.screenshot({path:path.join(dir,title+"-"+width+"-"+mode+".png"),fullPage:true});
    results.push({width,mode,module:id,passed:true});
   }
  }
  await page.locator("#rc-displayCurrency").selectOption("USD");
  await page.reload();await page.locator("#rc-content").getByText("Saldo operativo",{exact:false}).first().waitFor();
  for(const [id] of modules)assert(await page.locator('[data-module="'+id+'"]').isVisible(),"Hidden module after reload "+id);
  assert.equal(await page.locator("#rc-displayCurrency").inputValue(),"USD");assert.equal(await page.locator("html").getAttribute("data-theme"),"light");
  // Settings and navigation preferences do not write the actual ledger.
  const after=await page.evaluate(k=>localStorage.getItem(k),key);assert.equal(after,baseline,"Navigation changed the test ledger");
  await page.locator('[data-module="moves"]').click();await page.locator('[data-native-action="movement"]').click();
  const checkDialog=async id=>{const b=await page.locator("#"+id).boundingBox();assert(b&&b.x>=-1&&b.x+b.width<=width+1,"Dialog overflow "+width+" "+id)};
  await checkDialog("movementComposerDialog");if(width!==320)await page.screenshot({path:path.join(dir,"Formulario-movimiento-"+width+".png")});await page.locator("#closeMovementComposer").click();
  await page.locator("#rc-integrity").click();await checkDialog("rc-integrityDialog");await page.locator("#rc-closeIntegrity").click();
  await page.locator("#rc-manageModules").click();await page.locator('#rc-moduleChoices input[value="future"]').uncheck();await page.locator("#rc-closeModules").click();await page.reload();await page.locator("#rc-title").waitFor();assert(!(await page.locator('[data-module="future"]').isVisible()));
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);await page.close();
 }
 fs.writeFileSync(path.join(dir,"Validacion-visual.json"),JSON.stringify({passed:true,checks:results},null,2));
 console.log("Validated "+results.length+" module/theme/viewport combinations plus preference persistence and dialogs.");
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
