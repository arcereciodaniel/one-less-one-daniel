"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),H=require("../src/experimental/v17-production-handoff.cjs"),M=require("../src/experimental/v17-migration-rehearsal.cjs"),B=require("../scripts/build-v17-production-handoff.cjs");
test("handoff requires legacy disconnected, exact original bytes and a private V17 ledger",()=>{
 const source=JSON.stringify({version:6.2,periods:[],movements:[],debts:[],categories:[],settings:{}}),rows=new Map([[H.LEGACY,source]]),io={read:k=>rows.get(k)??null};
 rows.set(H.PREFS,"{}");assert.throws(()=>H.source(io),/Desvinculá/);rows.delete(H.PREFS);assert.equal(H.source(io),source);
 assert.throws(()=>H.assertActive(io,M),/activá/);rows.set(H.SOURCE,source);rows.set(H.ACTIVE,JSON.stringify({...JSON.parse(source),[M.FIELD]:{format:"v17-private-lab-v1",importDate:"2026-11-26"}}));assert(H.assertActive(io,M));
 rows.set(H.LEGACY,source+" ");assert.throws(()=>H.assertActive(io,M),/cambió/);rows.set(H.LEGACY,source);rows.set(H.PREFS,"{}");assert.throws(()=>H.assertActive(io,M),/Desvinculá/);
});
test("production candidate uses distinct key and exact origin, never automatically syncs",()=>{
 assert(H.locationAllowed(H.ORIGIN,H.PATH));assert(!H.locationAllowed(H.ORIGIN,"/one-less-one-daniel/"));assert(!H.locationAllowed("https://evil.invalid",H.PATH));
 const h=B.buildCandidate();assert(h.includes(H.ORIGIN));assert(h.includes(H.PATH));assert(h.includes(H.PREFIX));assert(h.includes(B.ENDPOINT));assert(!h.includes("one-less-one-mobile-v17-staging.one-less-one-rastro.workers.dev"));assert(h.includes("v17ProductionMobileReceipts"));
 const {JSDOM}=require("jsdom"),d=new JSDOM(h,{url:"https://evil.invalid/",runScripts:"dangerously"});try{assert.equal(d.window.localStorage.length,0);assert.match(d.window.document.body.textContent,/Ruta de activación no autorizada/)}finally{d.window.close()}
});

test("local migration rehearses actual UI and blocks production transport on changed V16",async()=>{
 const {JSDOM,VirtualConsole}=require("jsdom"),pre=require("../scripts/build-v17-prerelease.cjs"),calls=[],errors=[];
 const tick=()=>new Promise(r=>setTimeout(r,60));
 const boot=(html,entries={})=>{
  const vc=new VirtualConsole();vc.on("jsdomError",e=>{if(!/navigation \(except hash changes\)/.test(e.message))errors.push(e.message)});vc.on("error",e=>errors.push(String(e)));
  return new JSDOM(html,{url:H.ORIGIN+H.PATH,runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};
   w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}});
   w.confirm=()=>true;w.alert=x=>errors.push(String(x));w.prompt=()=>null;
   w.fetch=async(url,opt)=>{calls.push({url,method:opt?.method});return {ok:true,json:async()=>url.endsWith("/api/health")?{ok:true,service:"One Less One Mobile",version:1}:url.endsWith("/api/inbox")?{items:[]}:{ok:true}}};
   for(const [k,v] of Object.entries(entries))w.localStorage.setItem(k,v);
  }});
 };
 const fixture=boot(pre.buildCandidate());let source;
 try{const raw=JSON.parse(fixture.window.localStorage.getItem("rastro_lab_v17_prerelease_data_v1"));const [g,p]=raw.movements;const expense=g.categoryId,debt=p.categoryId;g.categoryId=debt;g.category=p.category;p.categoryId=expense;p.category="Supermercado";raw.movements.push({...g,id:"legacy-cross-third",seq:3,amount:125});raw.movementSeq=3;source=JSON.stringify(raw);assert(source)}finally{await tick();fixture.window.close()}
 const first=boot(B.buildInner(),{[H.LEGACY]:source,[H.PREFS]:"{}"});let active;
 try{
  const w=first.window,g=id=>w.document.getElementById(id);g("rc-integrity").click();g("rc-handoffRead").click();
  assert.match(g("rc-migrationStatus").textContent,/Desvinculá/);assert(g("rc-migrationConfirm").disabled);
  w.localStorage.removeItem(H.PREFS);const bad=JSON.parse(source);bad.movements[0].period="unlinked";w.localStorage.setItem(H.LEGACY,JSON.stringify(bad));const before=w.localStorage.getItem(H.ACTIVE);g("rc-handoffRead").click();assert.match(g("rc-migrationStatus").textContent,/missing-period-link \(1\)/);assert(g("rc-migrationConfirm").disabled);assert.equal(w.localStorage.getItem(H.ACTIVE),before);assert.equal(w.localStorage.getItem(H.SOURCE),null);w.localStorage.setItem(H.LEGACY,source);g("rc-handoffRead").click();assert(!g("rc-migrationConfirm").disabled,g("rc-migrationStatus").textContent);
  g("rc-migrationConfirm").click();active=w.localStorage.getItem(H.ACTIVE);assert(M.isPrivate(JSON.parse(active)));assert.deepEqual(JSON.parse(active).movements,JSON.parse(source).movements);assert.deepEqual(JSON.parse(active).debts,JSON.parse(source).debts);assert.deepEqual(JSON.parse(active).periods,JSON.parse(source).periods);assert.equal(w.localStorage.getItem(H.SOURCE),source);assert.equal(w.localStorage.getItem(H.LEGACY),source);
  assert.equal(calls.length,0);
 }finally{await tick();first.window.close()}
 const second=boot(B.buildInner(),{[H.LEGACY]:source,[H.SOURCE]:source,[H.ACTIVE]:active});
 try{
  const w=second.window,g=id=>w.document.getElementById(id);
  assert.equal(g("view-dashboard").hidden,false);assert(!g("view-dashboard").closest("#v17NativeHost"));assert(!g("expenseChart").closest("#v17NativeHost"));assert(!g("cashChart").closest("#v17NativeHost"));
  assert.equal(w.document.querySelector(".demo-header").hidden,true);assert(w.document.querySelector(".olo-original-header #nav"));assert.equal(g("rc-content").hidden,true);
  const exact=w.localStorage.getItem(H.ACTIVE);
  w.document.querySelector('.olo-original-header [data-view="plan"]').click();assert(g("view-dashboard").hidden);assert(!g("rc-content").hidden);assert.equal(g("rc-title").textContent,"Presupuesto");
  w.document.querySelector('.olo-original-header [data-view="dashboard"]').click();assert(!g("view-dashboard").hidden);
  w.document.querySelector('.olo-original-header [data-theme-choice="light"]').click();assert.equal(w.document.documentElement.dataset.theme,"light");
  w.document.querySelector('.olo-original-header [data-display-currency="USD"]').click();assert.equal(g("rc-displayCurrency").value,"USD");assert.equal(w.localStorage.getItem(H.ACTIVE),exact);
  w.document.querySelector('.olo-original-header [data-display-currency="CRC"]').click();
  g("rc-integrity").click();
  w.localStorage.setItem(H.LEGACY,source+" ");g("rc-mobileStagingKey").value="x".repeat(40);await g("rc-mobileStagingSync").onclick();
  assert.match(g("rc-mobileStagingStatus").textContent,/V16 cambió/);assert.equal(calls.length,0);
  w.localStorage.setItem(H.LEGACY,source);g("rc-mobileStagingKey").value="x".repeat(40);await g("rc-mobileStagingSync").onclick();
  assert.equal(calls.length,3);assert(calls.every(x=>x.url.startsWith(B.ENDPOINT+"/")));assert.match(g("rc-mobileStagingStatus").textContent,/0 pendiente/);
  assert.equal(w.localStorage.getItem(H.LEGACY),source);assert.deepEqual(errors,[]);
 }finally{await tick();second.window.close()}
});

test("three historical cross-outflow category links retain original category, type, date, money and FX; income mismatch still blocks",()=>{
 const F=require("../src/experimental/v16-financial-assignments.cjs");
 const categories=[{id:"card",name:"Tarjetas de Crédito",type:"Pago deuda"},{id:"other",name:"Otros",type:"Gasto"},{id:"salary",name:"Salario",type:"Ingreso"}];
 const raw={categories,periods:[{key:"P1",date:"2026-08-01",budgetMonth:"2026-08",categoryBudgets:{other:1000,card:100}}],movements:[
  {id:"one",date:"2026-08-03",type:"Gasto",categoryId:"card",category:"Tarjetas de Crédito",amount:25,currency:"USD",fxBuy:490,fxSell:500,fxDate:"2026-08-03",period:"P1",financedDebtId:"card-debt"},
  {id:"two",date:"2026-08-03",type:"Gasto",categoryId:"card",category:"Tarjetas de Crédito",amount:1500,currency:"CRC",period:"P1"},
  {id:"three",date:"2026-08-14",type:"Pago deuda",categoryId:"other",category:"Otros",amount:4000,currency:"CRC",period:"P1",debtId:"loan"}
 ]};
 const before=JSON.stringify(raw),adapter={endFor:()=>"2026-08-31",allocationState:()=>null,contributionCategory:()=>null};
 const m=F.adaptLegacy(raw,adapter);
 assert.deepEqual(m.issues,[]);assert.equal(JSON.stringify(raw),before);
 assert.deepEqual(m.actuals.map(a=>[a.sourceId,a.type,a.categoryId,a.date,a.currency,a.minor]),raw.movements.map(a=>[a.id,a.type,a.categoryId,a.date,a.currency,a.amount*100]));
 assert.equal(m.actuals[0].fxSell,500);assert.equal(m.actuals[0].financed,true);
 const q=F.project(m,{basis:"financial",parentKeys:["P1"]});
 assert.equal(q.totals.CRC.outflow.actualMinor,550000);assert.equal(q.totals.USD.outflow.actualMinor,2500);
 assert.equal(q.totals.CRC.income.actualMinor,0);assert.equal(F.valueCRC(q,{fxBuy:490,fxSell:510}).actualMinor,1800000);
 assert.equal(q.rows.find(r=>r.id==="other").actualMinor,400000);
 const invalid=JSON.parse(before);invalid.movements[0].categoryId="salary";assert(F.adaptLegacy(invalid,adapter).issues.some(x=>x.code==="movement-category-review"));
 invalid.movements[0].categoryId="unknown";assert(F.adaptLegacy(invalid,adapter).issues.some(x=>x.code==="movement-category-review"));
});

test("public entrypoint redirects to V17; original V16 stays byte-identical in archive",()=>{
 const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),P=require("../scripts/build-v17-production-site.cjs"),dir=fs.mkdtempSync(path.join(os.tmpdir(),"olo-native-entry-"));
 try{P.build(dir);assert.match(fs.readFileSync(path.join(dir,"index.html"),"utf8"),/location\.replace\(new URL\("\.\/v17\/"/);assert(fs.readFileSync(path.join(dir,"v16.html")).equals(fs.readFileSync(path.join(__dirname,"../index.html"))));assert(fs.readFileSync(path.join(dir,"lab/index.html")).equals(fs.readFileSync(path.join(__dirname,"../lab/index.html"))))}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
