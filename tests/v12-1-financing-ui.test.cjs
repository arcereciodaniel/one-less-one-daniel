"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),{JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8"),js=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];assert(js);
function sample(){
 return {version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,
  settings:{fx:500,fxBuy:490,fxSell:510,fxDate:"2026-11-17",fxCheckedOn:new Date().toISOString().slice(0,10),displayCurrency:"CRC"},
  periods:[{key:"q",date:"2026-11-14",budgetMonth:"2026-11",fortnight:2,quarter:"2026-T4",n:2,opening:100000,budgets:{},categoryBudgets:{}}],
  movements:[],movementSeq:0,categories:[
   {id:"g",name:"Comida",type:"Gasto",active:true,budgetable:true},
   {id:"p",name:"Pago tarjeta",type:"Pago deuda",active:true,budgetable:true}],
  debts:[{id:"card",type:"Tarjeta",typeId:"olo-debt-card",name:"Tarjeta principal",status:"active",crc:0,usd:0,minimum:10000,minimumCurrency:"CRC",payDay:"25"}],
  reconciliations:[],reserves:[],reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[],projects:[],projectLinks:[],projectPlans:[]
 };
}
function boot(raw=sample()){
 const dom=new JSDOM(html,{url:"https://example.com/",runScripts:"outside-only",pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
 const w=dom.window,errors=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}})};
 w.alert=x=>errors.push(String(x));w.confirm=()=>true;w.prompt=()=>null;
 w.fetch=async()=>{throw Error("offline")};
 w.localStorage.setItem("daniel_finanzas_local_v1",JSON.stringify(raw));
 w.eval(js);
 return {w,errors,get:id=>w.document.getElementById(id),read:()=>JSON.parse(w.localStorage.getItem("daniel_finanzas_local_v1"))};
}
test("V12.1.2: barra mínima, controles intactos y datos dentro de Configuración",()=>{
 assert(html.includes('<small class="brand-version">v16.0.0-rc.1</small>'));
 const {w,get}=boot(),bar=get("oneSettingsBtn").closest(".header-actions");
 assert(bar);
 assert.equal(bar.querySelectorAll("button").length,5);
 assert.equal(bar.querySelectorAll("[data-theme-choice]").length,2);
 assert.equal(bar.querySelectorAll("[data-display-currency]").length,2);
 assert(bar.querySelector(".one-minimal-settings-btn svg"));
 for(const id of ["fxBtn","exportBtn","importBtn","oneBackupNotice","oneSettingsFx","oneSettingsBackup","oneSettingsRestore"])
   assert(get(id),"Missing "+id);
 for(const id of ["fxBtn","exportBtn","importBtn"]){
   assert(!bar.contains(get(id)),"La acción no debe estar en el encabezado: "+id);
   assert(get("oneSettingsDialog").contains(get(id)),"La acción debe vivir dentro de configuración: "+id);
   assert(get(id).hidden,"El botón auxiliar debe permanecer oculto: "+id);
 }
 assert(get("oneSettingsFxDetail").textContent.includes("Compra"));
 assert(get("oneSettingsFxDetail").textContent.includes("Venta"));
 get("oneSettingsBtn").click();
 assert.equal(get("oneSettingsDialog").open,true);
});
test("V12.1: gasto con tarjeta no reduce efectivo y sí incrementa deuda; pago reduce efectivo por total y deuda por capital",()=>{
 const {w,get,read,errors}=boot();
 w.m2OpenComposer();get("mDate").value="2026-11-17";get("mType").value="Gasto";
 w.refreshMovementCategorySelect("g");get("mCategory").value="g";
 get("mAmount").value="30000";get("mCurrency").value="CRC";
 get("mPaymentSource").value="credit";get("mPaymentSource").dispatchEvent(new w.Event("change",{bubbles:true}));
 get("mFinancedDebt").value="card";
 assert.equal(get("mFinancedDebtField").hidden,false);
 get("movementForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
 assert.deepEqual(errors,[]);
 assert.equal(read().movements.length,1);
 assert.equal(read().movements[0].financedDebtId,"card");
 assert.equal(w.signedMovement(w.data?.movements?.[0]||read().movements[0]),0);
 assert.equal(w.actualBalanceAt("2026-11-17"),100000);
 assert.equal(w.debtOutstanding(w.activeDebts()[0]),30000);
 w.m2OpenComposer();
 get("mType").value="Pago deuda";get("mType").dispatchEvent(new w.Event("change",{bubbles:true}));
 get("mDate").value="2026-11-17";
 get("mDebt").value="card";w.refreshMovementCategorySelect("p");get("mCategory").value="p";
 get("mAmount").value="12000";get("mCurrency").value="CRC";get("mPrincipalAmount").value="9000";
 get("movementForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
 assert.deepEqual(errors,[]);
 assert.equal(read().movements.length,2);
 assert.equal(w.actualBalanceAt("2026-11-17"),88000);
 assert.equal(w.debtOutstanding(w.activeDebts()[0]),21000);
 assert.equal(w.debtPayments(w.activeDebts()[0]),12000);
 assert.equal(w.debtPrincipalPayments(w.activeDebts()[0]),9000);
});
test("V12.1: conciliación absorbe compras anteriores sin duplicarlas",()=>{
 const s=sample();s.movements=[
  {id:"sale",seq:1,type:"Gasto",date:"2026-11-16",categoryId:"g",amount:30000,currency:"CRC",financedDebtId:"card"},
  {id:"payment",seq:2,type:"Pago deuda",date:"2026-11-16",categoryId:"p",debtId:"card",amount:12000,principalAmount:9000,currency:"CRC"}];
 s.movementSeq=2;
 s.debts[0].balanceAdjustments=[{id:"r",date:"2026-11-16",afterSeq:2,createdAt:"2026-11-16T22:00:00Z",amount:21000,currency:"CRC",paidAtAdjustment:12000}];
 const {w,get,errors}=boot(s),d=w.activeDebts()[0];
 assert.equal(w.debtOutstanding(d),21000);
 w.m2OpenComposer();
 get("mDate").value="2026-11-17";w.refreshMovementCategorySelect("g");get("mCategory").value="g";
 get("mAmount").value="8000";get("mCurrency").value="CRC";
 get("mPaymentSource").value="credit";
 get("mPaymentSource").dispatchEvent(new w.Event("change",{bubbles:true}));
 get("mFinancedDebt").value="card";
 get("movementForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
 assert.deepEqual(errors,[]);
 assert.equal(w.debtOutstanding(d),29000);
});
test("V12.1: pagos heredados siguen aplicando el total a capital estimado",()=>{
 const s=sample();s.debts[0].crc=100000;
 s.movements=[{id:"old",seq:1,type:"Pago deuda",date:"2026-11-17",categoryId:"p",debtId:"card",amount:10000,currency:"CRC"}];
 const {w}=boot(s);
 assert.equal(w.debtOutstanding(w.activeDebts()[0]),90000);
 assert.equal(w.debtPaymentsNeedReconciliation(w.activeDebts()[0]),true);
 assert.equal(w.oneHealthCheck(s).issues.length,0);
});
test("V12.1: rechazo de vínculo a tarjeta inexistente y capital mayor al pago al restaurar",()=>{
 const {w,read}=boot(),s=read();
 s.movements.push({id:"fake",type:"Gasto",date:"2026-11-17",currency:"CRC",amount:100,categoryId:"g",financedDebtId:"missing"});
 assert.throws(()=>w.restoreValidate(s),/tarjeta inexistente/);
 s.movements=[{id:"wrong",type:"Pago deuda",date:"2026-11-17",currency:"CRC",amount:100,principalAmount:120,categoryId:"p"}];
 assert.throws(()=>w.restoreValidate(s),/capital amortizado inválido/);
});
