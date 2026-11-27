"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),{JSDOM,VirtualConsole}=require("jsdom"),{buildCandidate}=require("../scripts/build-v17-rc8.cjs"),O=require("../src/experimental/v17-operations.cjs");
const KEY="rastro_lab_v17_rc8_preview_data_v1";
function boot(saved,html=buildCandidate(),mockFetch=null){const errors=[],vc=new VirtualConsole();vc.on("jsdomError",e=>errors.push(e.message));vc.on("error",e=>errors.push(String(e)));const dom=new JSDOM(html,{runScripts:"dangerously",url:"https://rc8.invalid/",pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}});w.fetch=mockFetch|| (async()=>{throw Error("Sin red")});w.alert=x=>errors.push(String(x));w.confirm=()=>true;w.prompt=()=>null;if(saved)w.localStorage.setItem(KEY,saved)}});const w=dom.window,d=w.document,g=id=>d.getElementById(id),raw=()=>JSON.parse(w.localStorage.getItem(KEY));return {w,d,g,raw,errors}}
const tick=()=>new Promise(r=>setImmediate(r));

test("scheduled movements use native confirmation; recurrence is not cash before posting",async()=>{
 const e=boot(),{w,d,g,raw}=e;try{
  d.querySelector('[data-module="moves"]').click();const before=raw().movements.length;
  d.querySelector('[data-native-action="new-template"]').click();
  for(const [id,value] of Object.entries({mtName:"Suscripción prueba",mtType:"Gasto",mtCategory:"cat-exp",mtNextDate:"2026-11-20",mtFrequency:"monthly",mtAmount:"1500",mtCurrency:"CRC",mtDescription:"Suscripción prueba"}))g(id).value=value;
  g("movementTemplateForm").dispatchEvent(new w.Event("submit",{cancelable:true,bubbles:true}));await tick();
  const t=raw().movementTemplates.find(x=>x.name==="Suscripción prueba");assert(t,e.errors.join("\n"));assert.equal(raw().movements.length,before);
  d.querySelector('[data-native-action="template-post"][data-native-id="'+t.id+'"]').click();assert(g("movementComposerDialog").open);
  g("movementForm").dispatchEvent(new w.Event("submit",{cancelable:true,bubbles:true}));await tick();
  assert.equal(raw().movements.length,before+1,e.errors.join("\n"));assert.equal(raw().movementTemplates.find(x=>x.id===t.id).nextDate,"2026-12-20");
 }finally{w.close()}
});
test("recurring receivables generated once, not cash, archived groups excluded",async()=>{
 const e=boot(),{w,raw}=e;let saved;try{const r=raw();r.receivableRecurring=[{id:"monthly",person:"Prueba",day:21,reminderDay:22,startMonth:"2026-11",amount:5000,currency:"CRC",kind:"Uso / consumo",description:"Mensual"}];saved=JSON.stringify(r)}finally{w.close()}
 const b=boot(saved),{w:bw,d,g,raw:br}=b;try{g("rc-manageModules").click();const c=d.querySelector('#rc-moduleChoices input[value="collections"]');c.checked=true;c.dispatchEvent(new bw.Event("change"));g("rc-closeModules").click();d.querySelector('[data-module="collections"]').click();const before=br().movements.length,button=d.querySelector('[data-native-action="recurring-collections"]');assert(button);button.click();await tick();d.querySelector('[data-native-action="recurring-collections"]').click();await tick();assert.equal(br().sharedCharges.filter(x=>x.sourceRecurringId==="monthly"&&x.chargeMonth==="2026-11").length,1);assert.equal(br().movements.length,before)}finally{bw.close()}
});
test("private legacy backup inspection never persists or displays identifying values",async()=>{
 const e=boot(),{w,g,raw}=e;try{
  const before=w.localStorage.getItem(KEY),r=raw();r.movements[0].description="PRIVATE-TEST-NAME";
  g("rc-integrity").click();const payload=JSON.stringify(r),file=g("rc-privateAuditFile");
  Object.defineProperty(file,"files",{configurable:true,value:[{size:payload.length,text:async()=>payload}]});await file.onchange();
  assert.match(g("rc-privateAuditReport").textContent,/registros normalizados/);assert(!g("rc-privateAuditReport").textContent.includes("PRIVATE-TEST-NAME"));assert.equal(w.localStorage.getItem(KEY),before);assert(!JSON.stringify(raw()).includes("PRIVATE-TEST-NAME"));
 }finally{w.close()}
});
test("native iPhone importer uses isolated mock inbox; preserves overlay, historical FX, idempotency and ack ordering",async()=>{
 const fs=require("node:fs"),path=require("node:path");let mobile=fs.readFileSync(path.resolve(__dirname,"../mobile-pilot/desktop.js"),"utf8");
 mobile=mobile.replace('if(STORAGE_KEY!=="daniel_finanzas_local_v1")return;','if(STORAGE_KEY!=="rastro_lab_v17_rc8_preview_data_v1")return;');
 mobile=mobile.replace('if(validConfig(config)){\n    setTimeout','window.__testMobileImport=fetchAndImport;\n  if(validConfig(config)){\n    setTimeout');
 assert(mobile.includes("window.__testMobileImport"));
 const html=buildCandidate().replace("</body>",()=>"</body>");const end=html.lastIndexOf("</body>"),testHTML=html.slice(0,end)+"<script>"+mobile+"</script>"+html.slice(end);
 const ID="mockmobile000000001",BAD="mockmobile000000002";
 let e,acks=[],calls=[],items=[{id:ID,movement:{type:"Gasto",categoryId:"cat-exp",date:"2026-11-20",amount:10,currency:"USD",description:"Móvil de prueba"}},{id:BAD,movement:{type:"Gasto",categoryId:"missing",date:"2026-11-20",amount:20,currency:"CRC"}}];
 const transport=async(url,opt)=>{calls.push(url);assert(url.startsWith("https://mock.invalid/"));if(url.endsWith("/api/ack")){const id=JSON.parse(opt.body).id;assert(e.raw().movements.some(x=>x.mobilePilotId===id));acks.push(id)}return {ok:true,json:async()=>url.endsWith("/api/inbox")?{items}:{ok:true}}};
 const initial=boot();let saved;try{const r=initial.raw();r.settings.fxHistory=[{date:"2026-11-19",buy:490,sell:510}];r.settings.fxDate="2026-11-19";r.settings.fxBuy=490;r.settings.fxSell=510;r.v16AssignmentOverlay={version:1,replacements:[],added:[]};saved=JSON.stringify(r)}finally{initial.w.close()}
 e=boot(saved,testHTML,transport);const {w,raw}=e;try{assert.equal(typeof w.__testMobileImport,"function",e.errors.join("\n"));const config={url:"https://mock.invalid",key:"x".repeat(40)},before=raw().movements.length;
 const first=await w.__testMobileImport(config);await tick();assert.equal(first.imported,1);assert.equal(first.issues,1);assert.equal(raw().movements.length,before+1);
 const m=raw().movements.find(x=>x.mobilePilotId===ID);assert.equal(m.fxDate,"2026-11-19");assert.equal(m.fxSell,510);assert.equal(m.period,"P0");assert.deepEqual(raw().v16AssignmentOverlay,{version:1,replacements:[],added:[]});
 const second=await w.__testMobileImport(config);await tick();assert.equal(second.duplicates,1);assert.equal(raw().movements.length,before+1);assert.deepEqual(acks,[ID,ID]);assert(calls.every(x=>x.startsWith("https://mock.invalid/")));assert(!w.localStorage.getItem("daniel_finanzas_local_v1"));
 }finally{w.close()}
});
