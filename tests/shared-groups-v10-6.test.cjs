"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const helper=fs.readFileSync("mobile-pilot/public/split-fare.js","utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
const key="daniel_finanzas_local_v1";
function boot(){
 const errors=[],vc=new VirtualConsole();vc.on("jsdomError",e=>errors.push(String(e.stack||e)));
 const dom=new JSDOM(html,{url:"https://arcereciodaniel.github.io/one-less-one-daniel/",
  runScripts:"outside-only",pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(obj,name)=>name==="measureText"?()=>({width:80}):()=>{}})};
 w.alert=message=>errors.push("ALERT "+message);w.confirm=()=>true;w.prompt=()=>null;
 w.localStorage.setItem(key,JSON.stringify({
  version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,
  settings:{fx:500,fxBuy:490,fxSell:510,displayCurrency:"CRC"},
  periods:[{key:"p1",quarter:"2026-T4",n:1,budgetMonth:"2026-11",fortnight:1,date:"2026-10-28",
   opening:500000,openingCurrency:"CRC",income:0,otherIncome:0,budgets:{},categoryBudgets:{}}],
  categories:[],movements:[],movementSeq:0,debts:[],reconciliations:[],reserves:[],
  reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[]
 }));
 w.eval(helper+"\n"+script+"\nwindow.__groupTest={data,oneCreateSplitFare,oneGroupPersonLedger,renderSharedCharges,actualBalanceAt,save};");
 return {w,api:w.__groupTest,errors,read:()=>JSON.parse(w.localStorage.getItem(key)),close:()=>w.close()};
}
const hotel={groupName:"Viaje a Santa Teresa",description:"Hotel",date:"2026-11-16",
 currency:"USD",amount:720,splitMode:"equal",selfShares:1,
 participants:[{person:"Charlie",shares:1},{person:"Cardona",shares:1},{person:"Joshua",shares:1}]};
const cena={groupName:"",description:"Cena",date:"2026-11-17",
 currency:"USD",amount:60,splitMode:"equal",selfShares:1,
 participants:[{person:"Charlie",shares:1},{person:"Cardona",shares:1}]};
test("El mismo grupo acumula hotel $180 y cena $20 de Charlie; Joshua queda excluido",()=>{
 const x=boot();try{
  const before=x.api.actualBalanceAt("2026-11-17");
  const first=x.api.oneCreateSplitFare(hotel);
  const next=x.api.oneCreateSplitFare({...cena,groupId:first.group.id});
  assert.equal(next.reused,true);
  assert.equal(x.api.data.sharedChargeGroups.length,1);
  assert.equal(x.api.data.sharedCharges.length,5);
  assert.equal(x.api.data.movements.length,0);
  assert.equal(x.api.actualBalanceAt("2026-11-17"),before);
  const people=x.api.oneGroupPersonLedger(first.group.id);
  const charlie=people.find(p=>p.name==="Charlie"),cardona=people.find(p=>p.name==="Cardona"),joshua=people.find(p=>p.name==="Joshua");
  assert.equal(charlie.charges.length,2);
  assert.deepEqual(charlie.charges.map(c=>[c.description,c.amount]),[["Hotel",180],["Cena",20]]);
  assert.equal(charlie.currencies.USD.charged,20000);
  assert.equal(charlie.currencies.USD.pending,20000);
  assert.equal(cardona.currencies.USD.charged,20000);
  assert.equal(joshua.currencies.USD.charged,18000);
  assert.equal(joshua.charges.length,1);
  assert.equal(first.group.splitFare.totalAmount,720,"No reescribir el primer gasto del grupo");
  x.api.save();
  assert.equal(x.read().sharedChargeGroups.length,1);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("Los totales de CRC y USD se muestran separados por persona",()=>{
 const x=boot();try{
  const g=x.api.oneCreateSplitFare(hotel).group;
  x.api.oneCreateSplitFare({...cena,groupId:g.id,currency:"CRC",amount:6000});
  const p=x.api.oneGroupPersonLedger(g.id).find(p=>p.name==="Charlie");
  assert.equal(p.currencies.USD.charged,18000);
  assert.equal(p.currencies.CRC.charged,200000);
  assert.equal(p.currencies.USD.pending,18000);
  assert.equal(p.currencies.CRC.pending,200000);
  assert.equal(x.api.data.movements.length,0);
 }finally{x.close()}
});
test("Grupo existente, reintento de iPhone, dos cobros pero ningún grupo nuevo",()=>{
 const x=boot();try{
  const g=x.api.oneCreateSplitFare(hotel).group;
  const sourceId="santa-cena-abcdefgh123456";
  const first=x.api.oneCreateSplitFare({...cena,groupId:g.id},{sourceId});
  const repeated=x.api.oneCreateSplitFare({...cena,groupId:g.id},{sourceId});
  assert.equal(first.charges.length,2);
  assert.equal(repeated.already,true);
  assert.equal(x.api.data.sharedChargeGroups.length,1);
  assert.equal(x.api.data.sharedCharges.length,5);
  assert.equal(x.api.data.sharedCharges.filter(c=>c.mobilePilotId===sourceId).length,2);
 }finally{x.close()}
});
test("No se permite agregar cobros a un grupo archivado",()=>{
 const x=boot();try{
  const g=x.api.oneCreateSplitFare(hotel).group;
  g.status="archived";
  assert.throws(()=>x.api.oneCreateSplitFare({...cena,groupId:g.id}),/archivado/);
  assert.equal(x.api.data.sharedChargeGroups.length,1);
  assert.equal(x.api.data.sharedCharges.length,3);
 }finally{x.close()}
});
test("Desde el grupo se elige la cena y solo Charlie y Cardona sin Joshua",()=>{
 const x=boot();try{
  const {w,api}=x,doc=w.document;
  const g=api.oneCreateSplitFare(hotel).group;
  api.renderSharedCharges();
  doc.getElementById("cobrosGroupsTab").click();
  const b=doc.querySelector('[data-split-add-to-group="'+g.id+'"]');
  assert(b,"Debe aparecer Dividir gasto en el grupo");
  b.click();
  assert.equal(doc.getElementById("oneSplitFareDialog").open,true);
  assert.equal(doc.getElementById("oneSplitGroupChoice").value,g.id);
  assert.equal(doc.getElementById("oneSplitGroupNameField").hidden,true);
  const picks=[...doc.querySelectorAll("#oneSplitMembers button")];
  assert(picks.some(b=>b.textContent==="Joshua"),"Joshua está disponible pero no preseleccionado");
  picks.find(b=>b.textContent==="Charlie").click();
  [...doc.querySelectorAll("#oneSplitMembers button")].find(b=>b.textContent==="Cardona").click();
  doc.getElementById("oneSplitDescription").value="Cena";
  doc.getElementById("oneSplitTotal").value="60";
  doc.getElementById("oneSplitCurrency").value="USD";
  doc.getElementById("oneSplitDate").value="2026-11-17";
  assert.equal(doc.querySelectorAll("#oneSplitPeople .one-split-person").length,2);
  doc.getElementById("oneSplitFareForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  assert.equal(doc.getElementById("oneSplitFareDialog").open,false);
  assert.equal(api.data.sharedChargeGroups.length,1);
  assert.equal(api.data.sharedCharges.length,5);
  assert.equal(api.data.sharedCharges.filter(c=>c.description==="Cena"&&c.person==="Joshua").length,0);
  api.renderSharedCharges();
  const summary=doc.getElementById("sharedGroupsContainer").textContent;
  assert(summary.includes("Charlie"));assert(summary.includes("Hotel"));assert(summary.includes("Cena"));
  assert(summary.includes("$200")||summary.includes("200.00"),"Debe mostrar total de Charlie");
  assert.equal(x.errors.filter(e=>e.startsWith("ALERT ")&&!e.includes("Gasto agregado")).length,0);
 }finally{x.close()}
});
