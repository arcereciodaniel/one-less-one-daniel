"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),http=require("node:http"),assert=require("node:assert/strict"),{chromium}=require("playwright");
const {buildStaging,HOST,PREFIX,CSP}=require("./build-v17-staging.cjs");
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"olo-hosted-"));buildStaging(dir);
 const html=fs.readFileSync(path.join(dir,"index.html"));
 const server=http.createServer((req,res)=>{res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":CSP,"Cache-Control":"no-store"});res.end(html)});
 await new Promise(r=>server.listen(0,"127.0.0.1",r));const origin="http://127.0.0.1:"+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}}),p=await context.newPage(),errors=[],requests=[];
  p.on("pageerror",e=>errors.push(e.message));p.on("request",r=>requests.push(r.url()));
  await p.addInitScript(()=>{localStorage.setItem("daniel_finanzas_local_v1","PROD");localStorage.setItem("rastro_lab_v7_1_data_v1","LAB");localStorage.setItem("rastro_lab_v17_prerelease_data_v1","PRE")});
  await p.goto(origin);await p.locator("#rc-content").getByText("Saldo operativo",{exact:false}).first().waitFor();
  const key=PREFIX+"data_v1",before=await p.evaluate(k=>localStorage.getItem(k),key);assert(before);
  await p.locator("#rc-lightTheme").click();await p.reload();await p.locator("#rc-title").waitFor();
  assert.equal(await p.locator("html").getAttribute("data-theme"),"light");
  const vals=await p.evaluate(k=>[localStorage.getItem(k),localStorage.getItem("daniel_finanzas_local_v1"),localStorage.getItem("rastro_lab_v7_1_data_v1"),localStorage.getItem("rastro_lab_v17_prerelease_data_v1")],key);
  assert.deepEqual(vals,[before,"PROD","LAB","PRE"]);assert.deepEqual(errors,[]);assert(requests.every(u=>u===origin+"/"));
  // Simulate the exact intended HTTPS origin and production origin without contacting either.
  for(const [hostname,allowed] of [[HOST,true],["arcereciodaniel.github.io",false],[HOST+".example.com",false]]){
   const c=await browser.newContext(),q=await c.newPage(),url="https://"+hostname+"/";
   await c.route("**/*",route=>route.request().url()===url?route.fulfill({status:200,headers:{"content-type":"text/html; charset=utf-8","content-security-policy":CSP},body:html}):route.abort());
   await q.goto(url);
   if(allowed){await q.locator("#rc-title").waitFor();assert(await q.evaluate(k=>localStorage.getItem(k),key))}
   else{assert.match(await q.locator("body").innerText(),/no autorizado/);assert.equal(await q.evaluate(()=>localStorage.length),0);assert.equal(await q.locator("#rc-title").count(),0)}
   await c.close();
  }
  console.log("Hosted HTTP, intended HTTPS origin simulation, wrong-origin blocking, reload, isolated storage and network checks passed.");
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
