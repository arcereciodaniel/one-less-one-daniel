"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {JSDOM}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
function boot(seed){
 const dom=new JSDOM(html,{url:"https://example.com",runScripts:"outside-only",pretendToBeVisual:true});
 const w=dom.window,errors=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){
   return new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}});
 };
 w.alert=x=>errors.push(String(x));w.confirm=()=>true;w.prompt=()=>null;
 w.fetch=async()=>{throw Error("Sin red")};
 w.localStorage.setItem("daniel_finanzas_local_v1",JSON.stringify(seed));
 w.eval(script);
 return {w,errors,read:()=>JSON.parse(w.localStorage.getItem("daniel_finanzas_local_v1"))};
}
function sample(){
 return {version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,
 settings:{fx:500,fxBuy:495,fxSell:505,fxDate:"2026-11-17",fxCheckedOn:"2026-11-17",fxHistory:[],displayCurrency:"CRC"},
 periods:[],movements:[],reconciliations:[],reserves:[],reserveMovements:[],
 sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[],
 categories:[],debts:[{id:"legacy",type:"Tarjeta",name:"Tarjeta histórica",usd:0,crc:100000,minimum:15000,minimumCurrency:"CRC",payDay:"14",status:"active"}]};
}
test("V11.1: HTML y JavaScript integrados son válidos",()=>{
 assert(script);assert.doesNotThrow(()=>new vm.Script(script));
 for(const id of ["oneSettingsBtn","oneSettingsDialog","oneDebtTypesDialog","oneDebtTypeForm","dCloseDay","dInstallmentsTotal"]){
  assert(html.includes('id="'+id+'"'));
 }
});
test("V11.1: migración conservadora del tipo antiguo y panel de ajustes",()=>{
 const {w,read,errors}=boot(sample());
 assert.deepEqual(errors,[]);
 assert.equal(read().debts[0].id,"legacy");
 assert.equal(read().debts[0].type,"Tarjeta");
 assert.equal(w.oneDebtTypeForDebt(read().debts[0]).shape,"card");
 assert(w.data.debtTypes.some(t=>t.shape==="installments"));
 assert(w.document.getElementById("oneSettingsPaydayMount").contains(w.document.getElementById("onePaydayForm")));
 assert(w.document.getElementById("oneSettingsMaintenanceMount").contains(w.document.getElementById("resetBtn")));
});
test("V11.1: crear tipo personalizado, deuda a cuotas y mantener historial",()=>{
 const {w,read,errors}=boot(sample());
 const get=id=>w.document.getElementById(id);
 get("oneDebtTypeName").value="Mi compra de cuotas";
 get("oneDebtTypeShape").value="installments";
 get("oneDebtTypeForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
 const custom=read().debtTypes.find(t=>t.name==="Mi compra de cuotas");
 assert(custom&&custom.shape==="installments");
 w.openDebt();
 get("dType").value=custom.id;w.oneDebtFormUpdate();
 assert.equal(w.document.querySelector('[data-debt-fields="installments"]').hidden,false);
 assert.equal(w.document.querySelector('[data-debt-fields="card"]').hidden,true);
 get("dName").value="Computadora";
 get("dCrc").value="200000";
 get("dMinimum").value="10000";
 get("dPayDay").value="20";
 get("dInstallmentsTotal").value="20";
 get("dInstallmentsLeft").value="20";
 get("debtForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
 const saved=read(),d=saved.debts.find(x=>x.name==="Computadora");
 assert(d);assert.equal(d.type,"Préstamo");assert.equal(d.typeId,custom.id);
 assert.equal(d.installmentsTotal,20);
 assert.equal(saved.debts.find(x=>x.id==="legacy").crc,100000);
 assert.equal(saved.movements.length,0);
 assert.deepEqual(errors,[]);
});
test("V11.1: bloquear cambio de estructura con deuda vinculada",()=>{
 const {w,read,errors}=boot(sample());
 const get=id=>w.document.getElementById(id), card=read().debtTypes.find(t=>t.id==="olo-debt-card");
 get("oneDebtTypeId").value=card.id;
 get("oneDebtTypeName").value="Tarjeta editada";
 get("oneDebtTypeShape").value="loan";
 get("oneDebtTypeForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
 assert(errors.some(e=>e.includes("No se puede modificar la estructura")));
 assert.equal(read().debtTypes.find(t=>t.id===card.id).shape,"card");
 assert.equal(read().debts.find(d=>d.id==="legacy").type,"Tarjeta");
});
