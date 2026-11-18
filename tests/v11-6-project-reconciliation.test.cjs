"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert(script,"Falta el script principal");
const DAY="2026-11-17",P="trip-2026",B="other-2026",HOTEL="bucket-hotel-2026",TRANSFER="bucket-transfer-2026";
const PLAN="plan-hotel-2026",PLAN2="plan-taxi-2026";
function seed(){
 return {version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,
  settings:{fx:495,fxBuy:490,fxSell:500,fxDate:DAY,fxCheckedOn:new Date().toISOString().slice(0,10),displayCurrency:"CRC"},
  periods:[{key:"2026-T4-11-2",quarter:"2026-T4",n:2,budgetMonth:"2026-11",fortnight:2,date:"2026-11-14",
   opening:700000,openingCurrency:"CRC",categoryBudgets:{},budgets:{}}],
  categories:[{id:"cat-g",name:"Viajes",type:"Gasto",active:true,budgetable:true,group:"Otros",sort:1}],
  movements:[
   {id:"hotel-usd",seq:1,type:"Gasto",date:DAY,categoryId:"cat-g",category:"Viajes",amount:200,currency:"USD",fxBuy:490,fxSell:500,fxRef:495,period:"2026-T4-11-2",description:"Hotel primera noche"},
   {id:"hotel-crc",seq:2,type:"Gasto",date:DAY,categoryId:"cat-g",category:"Viajes",amount:20000,currency:"CRC",fxBuy:490,fxSell:500,period:"2026-T4-11-2",description:"Traslado al hotel"},
   {id:"hotel-extra",seq:3,type:"Gasto",date:DAY,categoryId:"cat-g",category:"Viajes",amount:350,currency:"USD",fxBuy:490,fxSell:500,period:"2026-T4-11-2",description:"Hotel noche extra"},
   {id:"foreign",seq:4,type:"Gasto",date:DAY,categoryId:"cat-g",category:"Viajes",amount:60,currency:"USD",fxBuy:490,fxSell:500,period:"2026-T4-11-2",description:"Otro viaje"}
  ],movementSeq:4,movementAudit:[],movementTemplates:[],
  reconciliations:[],debts:[],reserves:[],reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[],
  projects:[
   {id:P,name:"Viaje a Japón",status:"active",currency:"USD",budget:1200,buckets:[
    {id:HOTEL,name:"Hotel",budget:700},{id:TRANSFER,name:"Transporte",budget:300}]},
   {id:B,name:"Viaje antiguo",status:"active",currency:"USD",budget:300,buckets:[]}
  ],
  projectLinks:[
   {id:"link-hotel",projectId:P,movementId:"hotel-usd",bucketId:HOTEL},
   {id:"link-other",projectId:B,movementId:"foreign",bucketId:""}
  ],
  projectPlans:[
   {id:PLAN,projectId:P,name:"Reserva hotel",amount:500,bucketId:HOTEL,status:"pending",dueDate:DAY},
   {id:PLAN2,projectId:P,name:"Traslados",amount:300,bucketId:TRANSFER,status:"pending",dueDate:DAY}
  ]
 };
}
function boot(raw=seed()){
 const errors=[],vc=new VirtualConsole();vc.on("jsdomError",e=>errors.push(String(e.stack||e)));
 const dom=new JSDOM(html,{url:"https://example.com/",runScripts:"outside-only",pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(_,n)=>n==="measureText"?()=>({width:80}):()=>{}})};
 w.alert=v=>errors.push("ALERT "+v);w.confirm=()=>true;w.prompt=()=>null;
 w.fetch=async()=>{throw Error("offline")};
 const key="daniel_finanzas_local_v1";w.localStorage.setItem(key,JSON.stringify(raw));w.eval(script);
 return {w,dom,errors,q:id=>w.document.getElementById(id),
  read:()=>JSON.parse(w.localStorage.getItem(key)),close:()=>dom.window.close()};
}
const send=(e,form)=>form.dispatchEvent(new e.w.Event("submit",{bubbles:true,cancelable:true}));
const nearly=(x,y)=>assert(Math.abs(x-y)<.01,"Esperado "+y+", recibido "+x);
function match(e,movementId,planId=PLAN){
 const {w,q}=e,p=w.oneProjectById(P),plan=e.read().projectPlans.find(x=>x.id===planId);
 w.oneProjectSelect(P);w.oneProjectOpenReconcile(plan);
 assert(q("oneProjectReconcileDialog").open);
 q("oneProjectReconcileMovement").value=movementId;
 send(e,q("oneProjectReconcileForm"));
}
test("V11.6: legacy sin reconciliación sigue igual y mantiene saldos",()=>{
 const e=boot();try{
  const p=e.w.oneProjectById(P),summary=e.w.oneProjectPlanSummary(p,e.read().projectPlans[0]);
  nearly(summary.planned,500);nearly(summary.actual,0);nearly(summary.remaining,500);
  nearly(e.w.oneProjectPending(p),800);nearly(e.w.oneProjectSpent(p),200);
  assert.doesNotThrow(()=>e.w.restorePrepare(e.read()));
  assert.equal(e.read().movements.length,4);
  assert.deepEqual(e.errors,[]);
 }finally{e.close()}
});
test("V11.6: gasto vinculado se concilia sin crear otra operación y reduce saldo pendiente",()=>{
 const e=boot();try{
  const before=e.read();match(e,"hotel-usd");
  const now=e.read(),p=e.w.oneProjectById(P),plan=now.projectPlans.find(x=>x.id===PLAN);
  assert.equal(now.movements.length,before.movements.length);
  assert.equal(now.projectLinks.length,before.projectLinks.length);
  assert.equal(now.projectLinks.find(x=>x.movementId==="hotel-usd").planId,PLAN);
  const sum=e.w.oneProjectPlanSummary(p,plan);
  nearly(sum.actual,200);nearly(sum.remaining,300);nearly(e.w.oneProjectPending(p),600);
  nearly(e.w.oneProjectSpent(p),200);
  assert(e.q("oneProjectPlans").textContent.includes("Parcial"));
  assert.doesNotThrow(()=>e.w.restorePrepare(now));
  assert.deepEqual(e.errors,[]);
 }finally{e.close()}
});
test("V11.6: vincula un gasto todavía sin proyecto, usa TC histórico y no duplica ejecución",()=>{
 const e=boot();try{
  match(e,"hotel-usd");match(e,"hotel-crc");
  const now=e.read(),p=e.w.oneProjectById(P),plan=now.projectPlans.find(x=>x.id===PLAN);
  const link=now.projectLinks.find(x=>x.movementId==="hotel-crc");
  assert.equal(link.bucketId,HOTEL);assert.equal(link.planId,PLAN);
  assert.equal(now.projectLinks.length,3);
  assert.equal(now.movements.length,4);
  nearly(e.w.oneProjectSpent(p),240);
  const sum=e.w.oneProjectPlanSummary(p,plan);
  nearly(sum.actual,240);nearly(sum.remaining,260);
  nearly(e.w.oneProjectPending(p),560);
  nearly(e.w.oneProjectSpent(p)+e.w.oneProjectPending(p),800);
  assert.deepEqual(e.errors,[]);
 }finally{e.close()}
});
test("V11.6: varios pagos cubren una previsión y la desviación refleja sobrecoste",()=>{
 const e=boot();try{
  match(e,"hotel-usd");match(e,"hotel-crc");match(e,"hotel-extra");
  const p=e.w.oneProjectById(P),plan=e.read().projectPlans.find(x=>x.id===PLAN);
  const sum=e.w.oneProjectPlanSummary(p,plan);
  nearly(sum.actual,590);nearly(sum.remaining,0);nearly(sum.delta,90);
  assert.equal(sum.rows.length,3);
  assert.equal(sum.status,"covered");
  nearly(e.w.oneProjectPending(p),300);
  assert(e.q("oneProjectPlans").textContent.includes("Cubierto"));
  assert(e.q("oneProjectPlans").textContent.includes("Sobre lo previsto"));
  assert.equal(e.read().movements.length,4);
  assert.deepEqual(e.errors,[]);
 }finally{e.close()}
});
test("V11.6: impedir asignar un movimiento a otra previsión o proyecto",()=>{
 const e=boot();try{
  match(e,"hotel-usd");
  const p=e.w.oneProjectById(P),other=e.read().projectPlans.find(x=>x.id===PLAN2);
  assert.equal(e.w.oneProjectCanMatch(p,other,e.read().movements.find(m=>m.id==="hotel-usd")),false);
  assert.equal(e.w.oneProjectCanMatch(p,other,e.read().movements.find(m=>m.id==="hotel-crc")),true);
  assert.equal(e.w.oneProjectCanMatch(p,other,e.read().movements.find(m=>m.id==="foreign")),false);
  e.w.oneProjectOpenReconcile(other);
  const ids=[...e.q("oneProjectReconcileMovement").options].map(x=>x.value);
  assert(!ids.includes("hotel-usd"));assert(!ids.includes("foreign"));
  assert.deepEqual(e.errors,[]);
 }finally{e.close()}
});
test("V11.6: quitar conciliación mantiene el gasto vinculado al proyecto",()=>{
 const e=boot();try{
  match(e,"hotel-usd");
  e.q("oneProjectPlans").querySelector('[data-one-unmatch-movement="hotel-usd"]').click();
  const saved=e.read(),link=saved.projectLinks.find(x=>x.movementId==="hotel-usd");
  assert(link);assert.equal(link.planId,undefined);
  nearly(e.w.oneProjectPending(e.w.oneProjectById(P)),800);
  nearly(e.w.oneProjectSpent(e.w.oneProjectById(P)),200);
  assert.equal(saved.movements.length,4);
  assert.deepEqual(e.errors,[]);
 }finally{e.close()}
});
test("V11.6: cierre manual conserva el histórico y reabrir vuelve a pendientes",()=>{
 const e=boot();try{
  e.w.oneProjectSelect(P);
  e.q("oneProjectPlans").querySelector('[data-one-toggle-plan="'+PLAN+'"]').click();
  nearly(e.w.oneProjectPending(e.w.oneProjectById(P)),300);
  assert(e.q("oneProjectPlans").textContent.includes("Resuelto manualmente"));
  e.q("oneProjectPlans").querySelector('[data-one-toggle-plan="'+PLAN+'"]').click();
  nearly(e.w.oneProjectPending(e.w.oneProjectById(P)),800);
  assert.deepEqual(e.errors,[]);
 }finally{e.close()}
});
test("V11.6: respaldo rechaza plan huérfano, proyecto ajeno y concepto incompatible",()=>{
 const e=boot();try{
  match(e,"hotel-usd");
  const good=e.read(),base=good.projectLinks.find(x=>x.movementId==="hotel-usd");
  assert.doesNotThrow(()=>e.w.restorePrepare(good));
  const missing=structuredClone(good);missing.projectLinks.find(x=>x.id===base.id).planId="desaparecido";
  assert.throws(()=>e.w.restorePrepare(missing),/conciliación/i);
  const wrong=structuredClone(good);wrong.projectLinks.find(x=>x.id===base.id).projectId=B;
  wrong.projectLinks.find(x=>x.id===base.id).bucketId="";
  assert.throws(()=>e.w.restorePrepare(wrong),/conciliación/i);
  const badBucket=structuredClone(good);badBucket.projectLinks.find(x=>x.id===base.id).bucketId="";
  assert.throws(()=>e.w.restorePrepare(badBucket),/concepto/i);
  const health=e.w.oneHealthCheck(missing);
  assert(health.issues.some(x=>x.message.includes("conciliación")));
  assert.deepEqual(e.errors,[]);
 }finally{e.close()}
});
test("V11.6: gasto eliminado vuelve a pendiente sin perder previsión",()=>{
 const e=boot();try{
  match(e,"hotel-usd");
  const button=e.w.document.createElement("button");button.dataset.deleteMovement="hotel-usd";e.w.document.body.append(button);button.click();
  const saved=e.read();
  assert(!saved.movements.some(x=>x.id==="hotel-usd"));
  assert(!saved.projectLinks.some(x=>x.movementId==="hotel-usd"));
  nearly(e.w.oneProjectPending(e.w.oneProjectById(P)),800);
  assert.equal(saved.projectPlans.length,2);
  assert.deepEqual(e.errors,[]);
 }finally{e.close()}
});
