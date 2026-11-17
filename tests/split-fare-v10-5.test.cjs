"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const helper=fs.readFileSync("mobile-pilot/public/split-fare.js","utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
const KEY="daniel_finanzas_local_v1";
function boot(){
 const errors=[],vc=new VirtualConsole();
 vc.on("jsdomError",e=>errors.push(String(e.stack||e)));
 const dom=new JSDOM(html,{url:"https://arcereciodaniel.github.io/one-less-one-daniel/",
  runScripts:"outside-only",pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){
  return new Proxy({},{get:(o,key)=>key==="measureText"?()=>({width:80}):()=>{}});
 };
 w.alert=s=>errors.push("ALERT: "+s);w.confirm=()=>true;w.prompt=()=>null;
 w.localStorage.setItem(KEY,JSON.stringify({
  version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,
  settings:{fx:500,fxBuy:490,fxSell:510,displayCurrency:"CRC"},
  periods:[{key:"p1",quarter:"2026-T4",n:1,budgetMonth:"2026-11",fortnight:1,
   date:"2026-10-28",opening:400000,openingCurrency:"CRC",income:0,
   otherIncome:0,budgets:{},categoryBudgets:{}}],
  categories:[],movements:[],movementSeq:0,debts:[],reconciliations:[],
  reserves:[],reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[]
 }));
 w.eval(helper);
 w.eval(script+"\nwindow.__splitTest={data,oneCreateSplitFare,oneSplitFarePayload,actualBalanceAt,renderSharedCharges,save};");
 return {w,f:w.__splitTest,errors,read:()=>JSON.parse(w.localStorage.getItem(KEY)),close:()=>w.close()};
}
const hotel={groupName:"Hotel con amigos",description:"Reserva del hotel",date:"2026-11-16",dueDate:"",
 currency:"USD",amount:328,splitMode:"equal",selfShares:1,
 participants:[{person:"Charlie",shares:2},{person:"Ana",shares:1}]};
test("Cobros: grupo USD 328, Charlie paga 2 partes y no duplica gasto",()=>{
 const x=boot();try{
  const original=x.f.actualBalanceAt("2026-11-16");
  const result=x.f.oneCreateSplitFare(hotel);
  assert.equal(result.charges.length,2);
  assert.equal(result.group.splitFare.totalAmount,328);
  assert.equal(result.group.splitFare.currency,"USD");
  assert.equal(result.group.splitFare.selfAmount,82);
  assert.equal(result.group.splitFare.totalShares,4);
  assert.equal(result.charges[0].person,"Charlie");
  assert.equal(result.charges[0].amount,164);
  assert.equal(result.charges[0].splitFareShares,2);
  assert.equal(result.charges[1].amount,82);
  assert.equal(result.charges[1].groupId,result.group.id);
  assert.equal(x.f.data.movements.length,0);
  assert.equal(x.f.actualBalanceAt("2026-11-16"),original);
  x.f.save();
  const persisted=x.read();
  assert.equal(persisted.sharedChargeGroups.length,1);
  assert.equal(persisted.sharedCharges.length,2);
  assert.equal(persisted.sharedCharges.reduce((s,c)=>s+c.amount,0),246);
 }finally{x.close()}
});
test("Cobros: el reparto personalizado crea las deudas especificadas",()=>{
 const x=boot();try{
  const p={...hotel,splitMode:"amount",selfAmount:48,
   participants:[{person:"Charlie",shares:2,amount:200},{person:"Ana",shares:1,amount:80}]};
  x.f.oneCreateSplitFare(p);
  assert.equal(x.f.data.sharedCharges[0].amount,200);
  assert.equal(x.f.data.sharedCharges[1].amount,80);
  assert.equal(x.f.data.sharedChargeGroups[0].splitFare.selfAmount,48);
  assert.equal(x.f.data.movements.length,0);
 }finally{x.close()}
});
test("Cobros: un reintento móvil no duplica el grupo ni los cargos",()=>{
 const x=boot();try{
  const opts={sourceId:"hotel-mobile-abcdefgh123456"};
  const first=x.f.oneCreateSplitFare(hotel,opts);
  assert.equal(first.charges.length,2);
  x.f.save();
  const second=x.f.oneCreateSplitFare(hotel,opts);
  assert.equal(second.already,true);
  assert.equal(x.f.data.sharedChargeGroups.length,1);
  assert.equal(x.f.data.sharedCharges.length,2);
  assert.equal(x.read().sharedChargeGroups[0].mobilePilotId,opts.sourceId);
 }finally{x.close()}
});
test("Cobros: el formulario construye y guarda el grupo completo desde la UI",()=>{
 const x=boot();try{
  const {w}=x,root=w.document;
  root.getElementById("oneSplitFareOpen").click();
  assert.equal(root.getElementById("oneSplitFareDialog").open,true);
  root.getElementById("oneSplitGroupName").value="Hotel con amigos";
  root.getElementById("oneSplitDescription").value="Reserva";
  root.getElementById("oneSplitTotal").value="328";
  root.getElementById("oneSplitCurrency").value="USD";
  root.getElementById("oneSplitDate").value="2026-11-16";
  let rows=root.querySelectorAll("#oneSplitPeople .one-split-person");
  assert.equal(rows.length,1);
  rows[0].querySelector(".one-split-name").value="Charlie";
  rows[0].querySelector(".one-split-shares").value="2";
  root.getElementById("oneSplitAddPerson").click();
  rows=root.querySelectorAll("#oneSplitPeople .one-split-person");
  rows[1].querySelector(".one-split-name").value="Ana";
  rows[1].querySelector(".one-split-shares").value="1";
  assert.equal(x.f.oneSplitFarePayload().selfAmount,82);
  root.getElementById("oneSplitFareForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  assert.equal(root.getElementById("oneSplitFareDialog").open,false);
  const saved=x.read();
  assert.equal(saved.sharedChargeGroups.length,1);
  assert.equal(saved.sharedCharges.length,2);
  assert.equal(saved.sharedCharges[0].amount,164);
  assert.equal(saved.sharedCharges[1].amount,82);
  assert.equal(saved.movements.length,0);
  assert.equal(x.errors.filter(e=>e.startsWith("ALERT:")&&!e.includes("Grupo creado")).length,0);
 }finally{x.close()}
});
test("Cobros: los importes inválidos no alteran nada",()=>{
 const x=boot();try{
  assert.throws(()=>x.f.oneCreateSplitFare({...hotel,participants:[
   {person:"Charlie",shares:1},{person:"charlie",shares:2}]}));
  assert.equal(x.f.data.sharedChargeGroups.length,0);
  assert.equal(x.f.data.sharedCharges.length,0);
 }finally{x.close()}
});
