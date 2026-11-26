"use strict";
const {chromium}=require("playwright"),assert=require("node:assert/strict"),path=require("node:path"),fs=require("node:fs"),{pathToFileURL}=require("node:url");
(async()=>{const browser=await chromium.launch({headless:true}),dir=path.resolve(__dirname,"../preview-v16-6"),url=pathToFileURL(path.join(dir,"One-Less-One-V16.6-DEMO.html")).href;try{
 for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});const errors=[];page.on("pageerror",e=>errors.push(e.message));await page.goto(url);await page.locator('[data-module="budget"]').click();
  for(const mode of ["dark","light"]){await page.locator("#"+mode+"Theme").click();assert.equal(await page.locator("html").getAttribute("data-theme"),mode);
   const geom=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,header:document.querySelector(".demo-header").getBoundingClientRect().width,nav:document.querySelector(".demo-nav").getBoundingClientRect().toJSON(),controls:[...document.querySelectorAll(".demo-filter button,.demo-filter input,.demo-filter select")].filter(e=>!e.hidden).map(e=>e.getBoundingClientRect().toJSON())}));
   assert(geom.page<=width+1,"Horizontal overflow at "+width+": "+JSON.stringify(geom));assert(Math.abs(geom.header-width)<=1,"Header width");for(const c of geom.controls)assert(c.x>=-1&&c.right<=width+1,"Filter clipped "+JSON.stringify(c));if(width===1440)assert(Math.abs((geom.nav.left+geom.nav.right)/2-width/2)<24,"Nav not centered");
   if(width!==320)await page.screenshot({path:path.join(dir,"Presupuesto-"+width+"-"+mode+".png"),fullPage:true});
  }
  await page.locator("#current").click();await page.locator('[data-add=""]').first().click();assert(await page.locator("#edit").isVisible());const box=await page.locator("#edit").boundingBox();assert(box.x>=0&&box.x+box.width<=width+1,"Dialog clipped");if(width!==320)await page.screenshot({path:path.join(dir,"Editor-"+width+".png")});await page.locator("#cancel").click();
  await page.locator("#manageModules").click();for(const c of await page.locator("#moduleChoices input").all())await c.check();await page.locator("#closeModules").click();assert(await page.locator('[data-module="future"]').isVisible());assert(await page.locator("#manageModules").isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
