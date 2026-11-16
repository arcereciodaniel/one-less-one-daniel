"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert(script,"Debe existir el script financiero");
const KEY="daniel_finanzas_local_v1";
function tx(id,seq,date,type,amount,categoryId,extra={}){
 return {id,seq,date,type,amount,currency:"CRC",categoryId,category:categoryId,
 period:"nov-1",quarter:"2026-T4",createdAt:date+"T12:00:00.000Z",...extra};
}
function fixture(){
 return {version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,movementSeq:3,
  settings:{fx:490,fxBuy:480,fxSell:500,displayCurrency:"CRC",payDays:{first:14,second:28}},
  periods:[{key:"nov-1",quarter:"2026-T4",n:1,budgetMonth:"2026-11",fortnight:1,
   date:"2026-10-28",opening:300000,openingCurrency:"CRC",income:0,otherIncome:0,
   budgets:{},categoryBudgets:{save:25000},categoryBudgetCurrencies:{save:"CRC"}}],
  categories:[
   {id:"income",name:"Ingreso",type:"Ingreso",active:true,budgetable:true,sort:1},
   {id:"g1",name:"Supermercado",type:"Gasto",active:true,budgetable:true,sort:2},
   {id:"g2",name:"Hogar",type:"Gasto",active:true,budgetable:true,sort:3},
   {id:"debtcat",name:"Pago préstamo",type:"Pago deuda",active:true,budgetable:true,sort:4},
   {id:"save",name:"Ahorro e inversión",type:"Gasto",active:true,budgetable:true,sort:5}],
  movements:[
   tx("income-1",1,"2026-11-02","Ingreso",50000,"income"),
   tx("grocery",2,"2026-11-03","Gasto",10000,"g1",
    {splits:[{categoryId:"g1",amount:6000},{categoryId:"g2",amount:4000}]}),
   tx("debt-payment",3,"2026-11-04","Pago deuda",20000,"debtcat",{debtId:"loan",debt:"Préstamo"})],
  debts:[{id:"loan",name:"Préstamo",type:"Préstamo",status:"active",
   crc:120000,usd:0,minimum:5000,minimumCurrency:"CRC",limit:0,balanceAdjustments:[]}],
  reserves:[{id:"trip",name:"Viaje",type:"goal",status:"active",openingDate:"2026-10-01",
   openingAmount:0,openingCurrency:"CRC",target:100000,targetCurrency:"CRC",budgetCategoryId:"save"}],
  reserveMovements:[
   {id:"goal-1",reserveId:"trip",type:"Aporte",date:"2026-11-05",amount:25000,
    currency:"CRC",budgetCategoryId:"save",createdAt:"2026-11-05T12:00:00.000Z"},
   {id:"goal-2",reserveId:"trip",type:"Retiro a operación",date:"2026-11-07",amount:5000,
    currency:"CRC",createdAt:"2026-11-07T12:00:00.000Z"}],
  sharedCharges:[{id:"charge",date:"2026-11-01",chargeMonth:"2026-11",
   person:"Ana",description:"Cena",currency:"CRC",amount:12000,payments:[],status:"pending",dueDate:""}],
  sharedChargeGroups:[],receivableRecurring:[],reconciliations:[],movementAudit:[]};
}
function boot(seed=fixture()){
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
 w.alert=s=>errors.push("ALERT "+s);w.confirm=()=>true;w.prompt=()=>null;
 w.localStorage.setItem(KEY,JSON.stringify(seed));
 w.eval(script+"\nwindow.__finance={data,actualBalanceAt,reserveBalanceAt,oneBudgetSavingsActual,debtOutstanding,movementAmountCRC,movementCategoryAmountCRC,signedMovement,oneCommitCobroPayment,oneRevertCobroPayment,oneCobroMovement,cobroRemainingOriginal,cobroReceivedCRC,cobroPaymentCRC,renderSharedCharges,save};");
 return {w,f:w.__finance,errors,close:()=>w.close()};
}
function eq(actual,expected,message){
 assert(Math.abs(actual-expected)<.005,message+"; actual "+actual+" vs expected "+expected);
}
test("Gasto dividido, deuda, aporte y retiro mantienen saldos sin doble conteo",()=>{
 const x=boot();try{
  const f=x.f,m=f.data.movements.find(m=>m.id==="grocery");
  eq(f.signedMovement(m),-10000,"Egreso único");
  eq(f.movementCategoryAmountCRC(m,f.data.categories.find(c=>c.id==="g1")),6000,"Supermercado");
  eq(f.movementCategoryAmountCRC(m,f.data.categories.find(c=>c.id==="g2")),4000,"Hogar");
  eq(f.actualBalanceAt("2026-11-07"),300000,"Efectivo consolidado");
  eq(f.oneBudgetSavingsActual(f.data.periods[0],"save","2026-11-15"),25000,"Aporte presupuestado");
  eq(f.reserveBalanceAt(f.data.reserves[0],"2026-11-15"),20000,"Meta con retiro");
  eq(f.debtOutstanding(f.data.debts[0]),100000,"Pago de deuda");
  assert.equal(f.data.movements.length,3);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("Cobros parciales vinculados: reembolso, ingreso y reversión exacta",()=>{
 const x=boot();try{
  const f=x.f,c=f.data.sharedCharges[0],base=f.actualBalanceAt("2026-11-15");
  const first=f.oneCommitCobroPayment(c,{amount:3000,date:"2026-11-11",linked:true,kind:"reimbursement"});
  assert(first.ok,first.error);
  eq(f.actualBalanceAt("2026-11-15"),base+3000,"Reembolso");
  eq(f.cobroRemainingOriginal(c),9000,"Saldo pendiente");
  assert.equal(f.oneCobroMovement(c,first.payment).cashFlowKind,"cobro_reembolso");
  const second=f.oneCommitCobroPayment(c,{amount:9000,date:"2026-11-12",linked:true,
    kind:"income",categoryId:"income"});
  assert(second.ok,second.error);
  eq(f.actualBalanceAt("2026-11-15"),base+12000,"Cobro completo");
  assert.equal(c.status,"paid");
  assert.equal(f.data.movements.length,5);
  assert.equal(f.oneCobroMovement(c,second.payment).type,"Ingreso");
  assert(f.oneRevertCobroPayment(c,second.payment));
  assert(f.oneRevertCobroPayment(c,first.payment));
  eq(f.actualBalanceAt("2026-11-15"),base,"Reversión");
  assert.equal(f.data.movements.length,3);
  assert.equal(c.status,"pending");
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("Editar un abono vinculado actualiza el mismo movimiento, no crea otro",()=>{
 const x=boot();try{
  const f=x.f,c=f.data.sharedCharges[0],base=f.actualBalanceAt("2026-11-15");
  const a=f.oneCommitCobroPayment(c,{amount:3000,date:"2026-11-11",linked:true,kind:"reimbursement"});
  assert(a.ok,a.error);
  const movementId=f.oneCobroMovement(c,a.payment).id;
  const b=f.oneCommitCobroPayment(c,{paymentId:a.payment.id,amount:2000,date:"2026-11-11",
    linked:true,kind:"reimbursement"});
  assert(b.ok,b.error);
  assert.equal(c.payments.length,1);
  assert.equal(f.data.movements.length,4);
  assert.equal(f.oneCobroMovement(c,b.payment).id,movementId);
  eq(f.actualBalanceAt("2026-11-15"),base+2000,"Efectivo tras editar");
 }finally{x.close()}
});
test("Cobro USD vinculado congela tasa de compra, aunque cambie TC",()=>{
 const seed=fixture();
 seed.sharedCharges=[{id:"usd",date:"2026-11-01",chargeMonth:"2026-11",
  person:"Cliente",description:"USD",currency:"USD",amount:20,payments:[],status:"pending",dueDate:""}];
 const x=boot(seed);try{
  const f=x.f,c=f.data.sharedCharges[0],base=f.actualBalanceAt("2026-11-15");
  const a=f.oneCommitCobroPayment(c,{amount:10,date:"2026-11-12",linked:true,kind:"reimbursement"});
  assert(a.ok,a.error);
  eq(f.cobroReceivedCRC(c),4800,"TC 480 del abono");
  eq(f.actualBalanceAt("2026-11-15"),base+4800,"Efectivo USD histórico");
  assert.equal(a.payment.fxBuy,480);
  assert.equal(f.oneCobroMovement(c,a.payment).fxBuy,480);
  f.data.settings.fxBuy=580;f.data.settings.fxSell=600;f.data.settings.fx=590;
  eq(f.cobroReceivedCRC(c),4800,"Histórico congelado");
  eq(f.actualBalanceAt("2026-11-15"),base+4800,"No revalorizar cobrado");
  eq(f.cobroRemainingOriginal(c),10,"Pendiente en USD original");
  f.renderSharedCharges();
  const recovered=x.w.document.getElementById("sharedKpis").textContent;
  assert(/4[\s\u00a0.,]?800/.test(recovered),"El reporte del mes muestra ₡4.800 históricos");
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("Abono USD no vinculado conserva cambio sin modificar la liquidez",()=>{
 const seed=fixture();
 seed.sharedCharges=[{id:"usd2",date:"2026-11-01",chargeMonth:"2026-11",
  person:"Cliente",description:"USD",currency:"USD",amount:20,payments:[],status:"pending",dueDate:""}];
 const x=boot(seed);try{
  const f=x.f,c=f.data.sharedCharges[0],base=f.actualBalanceAt("2026-11-15");
  const a=f.oneCommitCobroPayment(c,{amount:10,date:"2026-11-12",linked:false});
  assert(a.ok,a.error);eq(f.cobroReceivedCRC(c),4800,"Abono no vinculado");
  f.data.settings.fxBuy=580;f.data.settings.fxSell=600;
  eq(f.cobroReceivedCRC(c),4800,"Conserva TC");
  eq(f.actualBalanceAt("2026-11-15"),base,"No crear ingreso ficticio");
  assert.equal(f.data.movements.length,3);
 }finally{x.close()}
});
test("Movimientos históricos CRC/USD no dependen del TC vigente",()=>{
 const seed=fixture();
 seed.movements.push(tx("incUSD",4,"2026-11-08","Ingreso",10,"income",
  {currency:"USD",fxBuy:470,fxSell:495,fxRef:482.5}));
 seed.movements.push(tx("expUSD",5,"2026-11-09","Gasto",3,"g1",
  {currency:"USD",fxBuy:470,fxSell:495,fxRef:482.5}));
 seed.movementSeq=5;
 const x=boot(seed);try{
  const f=x.f,balance=f.actualBalanceAt("2026-11-15");
  eq(f.movementAmountCRC(f.data.movements.find(m=>m.id==="incUSD")),4700,"Ingreso compra");
  eq(f.movementAmountCRC(f.data.movements.find(m=>m.id==="expUSD")),1485,"Gasto venta");
  eq(balance,303215,"Saldo con USD");
  f.data.settings.fxBuy=580;f.data.settings.fxSell=600;
  eq(f.actualBalanceAt("2026-11-15"),balance,"TC vigente no altera flujos");
 }finally{x.close()}
});
test("Conciliación heredada sin secuencia no duplica un movimiento del mismo día",()=>{
 const seed=fixture();
 seed.reconciliations=[{id:"old",date:"2026-11-11",amount:123456,currency:"CRC"}];
 seed.movements.push(tx("same",4,"2026-11-11","Ingreso",5000,"income"));
 seed.movements.push(tx("next",5,"2026-11-12","Ingreso",1000,"income"));
 seed.movementSeq=5;
 const x=boot(seed);try{
  eq(x.f.actualBalanceAt("2026-11-12"),124456,"Conciliación histórica");
 }finally{x.close()}
});
test("Conciliaciones nuevas incluyen movimientos y aportes posteriores el mismo día",()=>{
 const seed=fixture();
 seed.reconciliations=[{id:"new",date:"2026-11-11",amount:200000,
  currency:"CRC",afterSeq:3,createdAt:"2026-11-11T12:00:00.000Z"}];
 seed.movements.push(tx("later",4,"2026-11-11","Ingreso",5000,"income",
  {createdAt:"2026-11-11T13:00:00.000Z"}));
 seed.reserveMovements.push({id:"late-goal",reserveId:"trip",type:"Aporte",date:"2026-11-11",
  amount:2000,currency:"CRC",createdAt:"2026-11-11T13:00:00.000Z"});
 seed.movementSeq=4;
 const x=boot(seed);try{eq(x.f.actualBalanceAt("2026-11-11"),203000,"Operaciones posteriores");}
 finally{x.close()}
});
test("Fecha inexistente de abono es rechazada sin efectos",()=>{
 const x=boot();try{
  const c=x.f.data.sharedCharges[0],base=x.f.actualBalanceAt("2026-11-15");
  const r=x.f.oneCommitCobroPayment(c,{amount:3000,date:"2026-02-31",linked:true,kind:"reimbursement"});
  assert.equal(r.ok,false);
  assert.equal(c.payments.length,0);
  eq(x.f.actualBalanceAt("2026-11-15"),base,"Cobro no alterado");
 }finally{x.close()}
});
