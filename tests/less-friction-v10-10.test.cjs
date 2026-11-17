"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
const KEY="daniel_finanzas_local_v1";
const offset=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
const today=offset(0),month=today.slice(0,7),quarter=month.slice(0,4)+"-T"+(Math.floor((Number(month.slice(5,7))-1)/3)+1);
function fixture(){
 return {
  version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,movementSeq:0,
  settings:{fx:500,fxBuy:490,fxSell:510,fxDate:today,displayCurrency:"CRC"},
  periods:[{key:"period1",n:1,quarter,budgetMonth:month,fortnight:1,date:offset(-5),
    opening:300000,openingCurrency:"CRC",income:0,otherIncome:0,budgets:{},categoryBudgets:{}},
   {key:"period2",n:2,quarter,budgetMonth:month,fortnight:2,date:offset(6),
    opening:null,income:0,otherIncome:0,budgets:{},categoryBudgets:{}}],
  categories:[{id:"food",name:"Comida",type:"Gasto",active:true,budgetable:true,sort:1},
   {id:"income",name:"Extras",type:"Ingreso",active:true,budgetable:true,sort:2},
   {id:"debtcat",name:"Préstamo",type:"Pago deuda",active:true,budgetable:true,sort:3}],
  movements:[],movementAudit:[],movementTemplates:[],accounts:[],movementSeq:0,
  debts:[{id:"loan",name:"Préstamo",status:"active",type:"Préstamo",minimum:1000,minimumCurrency:"CRC",payDay:"31",usd:0,crc:30000,priority:1,balanceAdjustments:[]}],
  reserves:[{id:"goal",name:"Vacaciones",type:"goal",status:"active",
   openingDate:offset(-5),openingAmount:100000,openingCurrency:"CRC",target:100000,targetCurrency:"CRC",budgetCategoryId:""}],
  reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[],reconciliations:[]
 };
}
function boot(seed=fixture()){
 const errors=[],vc=new VirtualConsole();vc.on("jsdomError",e=>errors.push(String(e.stack||e)));
 const dom=new JSDOM(html,{url:"https://arcereciodaniel.github.io/one-less-one-daniel/",
  runScripts:"outside-only",pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(o,k)=>k==="measureText"?()=>({width:80}):()=>{}})};
 w.alert=x=>errors.push("ALERT "+x);w.confirm=()=>true;w.prompt=()=>null;
 w.localStorage.setItem(KEY,JSON.stringify(seed));
 w.eval(script+"\nwindow.__v1010={data,renderMovements,renderCapital,oneDebtDueEntry,oneDebtMonthlyDueIso,oneDebtDueWhen,oneDebtRenderDueSchedule,save,m2RenderTemplates,actualBalanceAt};");
 return {w,api:w.__v1010,errors,read:()=>JSON.parse(w.localStorage.getItem(KEY)),close:()=>w.close()};
}
test("V10.10: confirma gasto tras persistencia y no confirma formulario inválido",()=>{
 const x=boot();try{
  const d=x.w.document,form=d.getElementById("movementForm"),dlg=d.getElementById("oneActionSuccessDialog");
  d.getElementById("mType").value="Gasto";
  d.getElementById("mType").dispatchEvent(new x.w.Event("change",{bubbles:true}));
  d.getElementById("mDate").value=today;
  d.getElementById("mCategory").value="food";
  d.getElementById("mCurrency").value="CRC";
  d.getElementById("mAmount").value="0";
  form.dispatchEvent(new x.w.Event("submit",{bubbles:true,cancelable:true}));
  assert.equal(dlg.open,false,"No se confirma antes de guardarse");
  assert.equal(x.read().movements.length,0);
  d.getElementById("mAmount").value="2450";
  d.getElementById("mDescription").value="Almuerzo";
  form.dispatchEvent(new x.w.Event("submit",{bubbles:true,cancelable:true}));
  assert.equal(x.read().movements.length,1);
  assert.equal(x.read().movements[0].amount,2450);
  assert.equal(dlg.open,true);
  assert.match(d.getElementById("oneActionSuccessTitle").textContent,/Gasto registrado/);
  assert.match(d.getElementById("oneActionSuccessDescription").textContent,/Almuerzo/);
  d.getElementById("oneActionSuccessClose").click();
  assert.equal(dlg.open,false);
  assert.equal(x.errors.filter(e=>/TypeError|ReferenceError/.test(e)).length,0);
 }finally{x.close()}
});
test("V10.10: cerrar meta cumplida conserva fondos y no crea movimientos",()=>{
 const x=boot();try{
  const d=x.w.document,api=x.api;
  const before=api.actualBalanceAt(today),movements=api.data.movements.length,transfers=api.data.reserveMovements.length;
  api.renderCapital();
  const action=d.querySelector('[data-complete-goal="goal"]');
  assert(action,"El cierre aparece para una meta cuyo saldo alcanzó el objetivo");
  action.click();
  const after=x.read();
  assert.equal(after.reserves[0].status,"archived");
  assert.equal(after.reserves[0].closedReason,"Meta cumplida");
  assert.equal(after.movements.length,movements);
  assert.equal(after.reserveMovements.length,transfers);
  assert.equal(api.actualBalanceAt(today),before);
  assert.equal(d.getElementById("oneActionSuccessDialog").open,true);
  assert.match(d.getElementById("oneActionSuccessTitle").textContent,/Meta cumplida/);
  d.getElementById("oneActionSuccessClose").click();
  d.getElementById("goalStatusFilter").value="archived";api.renderCapital();
  assert.match(d.getElementById("goalCardGrid").textContent,/Cumplida/);
  assert(d.querySelector('[data-reactivate-reserve="goal"]'),"La meta debe poder reabrirse");
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("V10.10: una meta sin monto alcanzado no puede marcarse cumplida",()=>{
 const seed=fixture();seed.reserves[0].target=150000;
 const x=boot(seed);try{
  x.api.renderCapital();
  assert.equal(x.w.document.querySelector('[data-complete-goal="goal"]'),null);
  assert.equal(x.read().reserves[0].status,"active");
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("V10.10: repetir último prellena el formulario pero no crea otro movimiento",()=>{
 const seed=fixture();
 seed.movements.push({id:"g1",seq:1,date:today,type:"Gasto",amount:7800,currency:"CRC",
   categoryId:"food",category:"Comida",description:"Supermercado",createdAt:new Date().toISOString(),splits:[]});
 seed.movementSeq=1;
 const x=boot(seed);try{
  const d=x.w.document,button=d.getElementById("oneRepeatLastMovement");
  x.api.m2RenderTemplates();
  assert.equal(button.hidden,false);
  const before=x.read().movements.length;
  button.click();
  assert.equal(d.getElementById("movementComposerDialog").open,true);
  assert.equal(d.getElementById("mAmount").value,"7800");
  assert.equal(d.getElementById("mDescription").value,"Supermercado");
  assert.equal(d.getElementById("mEditId").value,"");
  assert.equal(x.read().movements.length,before,"Repetir solo prepara, requiere confirmar");
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("V10.10: programados distinguen pendiente y futuro; ninguno se contabiliza automáticamente",()=>{
 const seed=fixture();
 const common={type:"Gasto",frequency:"monthly",anchorDay:15,
  categoryId:"food",amount:5500,currency:"CRC",active:true,account:"",description:"Servicio"};
 seed.movementTemplates=[
  {...common,id:"old",name:"Internet",nextDate:offset(-1)},
  {...common,id:"future",name:"Streaming",nextDate:offset(5)}
 ];
 const x=boot(seed);try{
  const d=x.w.document,box=d.getElementById("movementTemplatesList");
  x.api.m2RenderTemplates();
  assert.match(box.textContent,/Revisar y registrar/);
  assert.match(box.textContent,/Preparar/);
  assert.equal(x.read().movements.length,0);
  const future=d.querySelector('[data-m2-post-template="future"]');
  future.click();
  assert.equal(d.getElementById("movementComposerDialog").open,true);
  assert.equal(d.getElementById("mAmount").value,"5500");
  assert.equal(x.read().movements.length,0);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("V10.10: cuotas entre meses, pagos parciales y febrero se calculan sin mutar deudas",()=>{
 const x=boot();try{
  const d=x.api.data.debts[0];
  assert.equal(x.api.oneDebtMonthlyDueIso(d,"2027-02"),"2027-02-28");
  assert.equal(x.api.oneDebtMonthlyDueIso(d,"2026-02"),"2026-02-28");
  assert.equal(x.api.oneDebtMonthlyDueIso(d,"2028-02"),"2028-02-29");
  x.api.data.movements.push({id:"pay1",seq:1,date:"2027-02-05",type:"Pago deuda",amount:400,currency:"CRC",debtId:"loan",categoryId:"debtcat"});
  const before=JSON.stringify(x.api.data.debts);
  const due=x.api.oneDebtDueEntry(d,"2027-02-20");
  assert.equal(due.state,"partial");
  assert.equal(due.paid,400);
  assert.equal(due.minimum,600);
  assert.equal(due.date,"2027-02-28");
  assert.match(x.api.oneDebtDueWhen(due.date,"2027-02-20"),/En 8 día/);
  assert.equal(JSON.stringify(x.api.data.debts),before);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
