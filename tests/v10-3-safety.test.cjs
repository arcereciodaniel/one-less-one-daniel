"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const lab=fs.readFileSync("lab/index.html","utf8");
const legacy=fs.readFileSync("index-lab.html","utf8");
const mobile=fs.readFileSync("mobile-pilot/desktop.js","utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert(script,"El código financiero principal debe estar presente");
const KEY="daniel_finanzas_local_v1";
function setup(){
 const errors=[],vc=new VirtualConsole();
 vc.on("jsdomError",e=>errors.push(String(e.stack||e)));
 const dom=new JSDOM(html,{url:"https://arcereciodaniel.github.io/one-less-one-daniel/",runScripts:"outside-only",pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};
 w.alert=msg=>errors.push("ALERT "+msg);w.confirm=()=>true;w.prompt=()=>null;
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({}, {get:(o,key)=>key==="measureText"?()=>({width:80}):()=>{}})};
 w.localStorage.setItem(KEY,JSON.stringify({
  version:6.2,settings:{fx:500,fxBuy:500,fxSell:500,displayCurrency:"CRC"},
  periods:[{key:"2026-11-Q1",quarter:"2026-T4",n:1,budgetMonth:"2026-11",fortnight:1,date:"2026-10-28",opening:40000,income:0,otherIncome:0,budgets:{},categoryBudgets:{}}],
  movements:[],reconciliations:[],debts:[],categories:[
   {id:"g",name:"Compras",type:"Gasto",group:"Necesidades",active:true,budgetable:true,sort:1},
   {id:"i",name:"Salario",type:"Ingreso",group:"Trabajo",active:true,budgetable:true,sort:1}],
  reserves:[],reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[]
 }));
 w.eval(script+"\nwindow.__oneTest={data,save,renderReconciliationStatus,renderSharedCharges,fillSelect,fillObjectSelect};");
 return {w,errors,close:()=>w.close()};
}
test("Lab V7 antiguo redirige, sin escribir finanzas",()=>{
 assert(legacy.includes("location.replace(new URL"));
 assert(legacy.includes("./lab/"));
 assert(!legacy.includes("const STORAGE_KEY"));
 assert(lab.includes('const STORAGE_KEY = "rastro_lab_v7_1_data_v1";'));
 assert(html.includes('const STORAGE_KEY = "daniel_finanzas_local_v1";'));
 assert(mobile.includes('if(STORAGE_KEY!=="daniel_finanzas_local_v1")return;'));
});
test("Guardado financiero comprueba persistencia",()=>{
 const {w,errors,close}=setup();
 try{
  w.__oneTest.data.settings.fx=513;w.__oneTest.save();
  assert.equal(JSON.parse(w.localStorage.getItem(KEY)).settings.fx,513);
  assert.equal(w.document.getElementById("oneStorageGuardBanner").hidden,true);
  assert.equal(errors.length,0);
 }finally{close()}
});
test("Cambio de otra pestaña bloquea sobrescrituras",()=>{
 const {w,close}=setup();
 try{
  const oldValue=w.localStorage.getItem(KEY);
  const remote=JSON.parse(oldValue);remote.settings.fx=644;
  const remoteRaw=JSON.stringify(remote);
  w.localStorage.setItem(KEY,remoteRaw);
  w.dispatchEvent(new w.StorageEvent("storage",{key:KEY,oldValue,newValue:remoteRaw,storageArea:w.localStorage}));
  w.__oneTest.data.settings.fx=999;
  assert.throws(()=>w.__oneTest.save(),/otra pestaña|cambiaron/);
  assert.equal(w.localStorage.getItem(KEY),remoteRaw);
  assert.equal(w.document.getElementById("oneStorageGuardBanner").hidden,false);
 }finally{close()}
});
test("Comprobar directamente el almacenamiento también detecta colisiones",()=>{
 const {w,close}=setup();
 try{
  const remote=JSON.parse(w.localStorage.getItem(KEY));remote.settings.fx=701;
  w.localStorage.setItem(KEY,JSON.stringify(remote));
  assert.throws(()=>w.__oneTest.save(),/otra pestaña|cambiaron/);
  assert.equal(JSON.parse(w.localStorage.getItem(KEY)).settings.fx,701);
 }finally{close()}
});
test("Notas y grupos peligrosos son texto, no HTML ejecutable",()=>{
 const {w,close}=setup();
 try{
  w.__oneTest.data.reconciliations.push({id:"r1",date:"2026-11-10",amount:41000,currency:"CRC",note:"<img src=x onerror=alert(1)>",createdAt:"2026-11-10T00:00:00Z"});w.__oneTest.renderReconciliationStatus();
  assert.equal(w.document.querySelector("#reconcileStatus img"),null);
  assert(w.document.getElementById("reconcileStatus").textContent.includes("<img src=x"));
  w.__oneTest.data.sharedChargeGroups.push({id:"grp1",name:"<img src=x onerror=alert(2)>",person:"Persona",notes:"<svg onload=alert(3)>",status:"active"});w.__oneTest.renderSharedCharges();
  assert.equal(w.document.querySelector("#sharedGroupsContainer img"),null);
  assert.equal(w.document.querySelector("#sharedGroupsContainer svg"),null);
 }finally{close()}
});
test("V10.3 identifica Daniel y Lab sin alterar claves",()=>{
 assert(html.includes('<small class="brand-version">v16.0.0</small>'));
 assert(lab.includes('<small class="brand-version">v16.0.0 LAB</small>'));
 assert(lab.includes('src="../mobile-pilot/desktop.js"'));
 assert(html.includes('src="mobile-pilot/desktop.js"'));
});

test("Los selectores no interpretan contenido HTML de categorías y grupos",()=>{
 const {w,close}=setup();
 try{
  const select=w.document.getElementById("scGroup");
  w.__oneTest.fillObjectSelect(select,[{value:"id",label:"<img src=x onerror=alert(4)>"}],"id");
  assert.equal(select.querySelector("img"),null);
  assert.equal(select.options[0].textContent,"<img src=x onerror=alert(4)>");
  w.__oneTest.fillSelect(select,["<svg onload=alert(5)>"],"<svg onload=alert(5)>");
  assert.equal(select.querySelector("svg"),null);
  assert.equal(select.options[0].value,"<svg onload=alert(5)>");
 }finally{close()}
});
