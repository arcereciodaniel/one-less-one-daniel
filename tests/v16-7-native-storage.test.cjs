"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const {queryBudget,auditLedger}=require("../src/experimental/v15-financial-query.cjs");
const AS_OF="2026-11-17";
function seed(){
 const periods=[
 ["2026-11-14","2026-11",2],
 ["2026-11-28","2026-12",1],
 ["2026-12-14","2026-12",2],
 ["2026-12-28","2027-01",1],
 ["2027-01-14","2027-01",2],
 ["2027-01-28","2027-02",1],
 ["2027-02-14","2027-02",2],
 ["2027-02-28","2027-03",1],
 ["2027-03-14","2027-03",2]
 ].map(([date,budgetMonth,fortnight],i)=>({
  key:"P"+i,date,budgetMonth,fortnight,
  quarter:date.slice(0,4)+"-T"+Math.floor((Number(date.slice(5,7))-1)/3+1),n:i+1,
  categoryBudgets:{"cat-exp":i===0?20000:0,"cat-debt":i===0?30000:0},
  categoryBudgetCurrencies:{"cat-exp":"CRC","cat-debt":"CRC"},
  categoryBudgetSources:{},categoryBudgetScheduledDates:{},budgets:{}
 }));
 const categories=[
  {id:"cat-exp",name:"Supermercado",type:"Gasto",group:"Gastos",active:true,budgetable:true,sort:1},
  {id:"cat-debt",name:"Préstamos",type:"Pago deuda",group:"Deudas",active:true,budgetable:true,sort:2},
  {id:"cat-salary",name:"Salario",type:"Ingreso",group:"Ingresos",active:true,budgetable:true,sort:3,
   incomeConfig:{subtype:"Salario",behavior:"fixed",frequency:"semimonthly",
    expectedAmount:100000,expectedCurrency:"CRC",projectAutomatically:true,
    day1:14,day2:28,assignment1:"current-2",assignment2:"next-1"}}
 ];
 return {version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,settings:{
   fx:500,fxBuy:495,fxSell:505,fxDate:AS_OF,fxCheckedOn:AS_OF,
   fxSource:"manual",fxHistory:[],displayCurrency:"CRC",payDays:{first:14,second:28}
  },periods,categories,
  movements:[
   {id:"g1",seq:1,type:"Gasto",date:"2026-11-16",amount:5000,currency:"CRC",categoryId:"cat-exp",category:"Supermercado",period:"P0"},
   {id:"d1",seq:2,type:"Pago deuda",date:"2026-11-15",amount:10000,currency:"CRC",categoryId:"cat-debt",category:"Préstamos",debtId:"debt1",debt:"Préstamo",period:"P0"}
  ],movementSeq:2,
  debts:[{id:"debt1",name:"Préstamo",type:"Préstamo",status:"active",crc:100000,usd:0,minimum:30000,minimumCurrency:"CRC",payDay:"25",rate:"",balanceAdjustments:[]}],
  reconciliations:[{id:"r1",date:AS_OF,amount:100000,currency:"CRC",fxBuy:495,fxSell:505,afterSeq:2,
    createdAt:AS_OF+"T09:00:00.000Z",scope:"operating"}],
  reserves:[],reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[],
  projects:[],projectLinks:[],projectPlans:[],movementTemplates:[],movementAudit:[]
 };
}
function boot(custom=seed(),lab=false){
 const html=fs.readFileSync(lab?"lab/index.html":"index.html","utf8"), script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
 assert(script,"Falta JavaScript integrado");
 const storageKey=lab?"rastro_lab_v7_1_data_v1":"daniel_finanzas_local_v1";
 const vc=new VirtualConsole(),errors=[];
 vc.on("jsdomError",e=>errors.push("JSDOM "+String(e.stack||e)));
 const dom=new JSDOM(html,{url:"https://example.com/",pretendToBeVisual:true,runScripts:"outside-only",virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){
  return new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}});
 };
 w.alert=x=>errors.push("ALERT "+x);w.confirm=()=>true;w.prompt=()=>null;
 w.fetch=async()=>{throw Error("Sin red")};
 const now=new w.Date();
 custom.settings.fxCheckedOn=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
 w.localStorage.setItem(storageKey,JSON.stringify(custom));
 // Test-only accessor in the same lexical scope; never shipped in application code.
 w.eval(script+"\n;globalThis.__v15LedgerJSON=()=>JSON.stringify(data);globalThis.__v16TestPersist=(P,expected,next)=>P.persist({read:()=>localStorage.getItem(STORAGE_KEY),readBackup:()=>localStorage.getItem(STORAGE_KEY+\"_pre_v17_test\"),writeBackup:x=>localStorage.setItem(STORAGE_KEY+\"_pre_v17_test\",x),write:x=>oneStoragePersist(x)},expected,next);globalThis.__v16NativeSnapshot=(S,F,asOf)=>S.nativeSnapshot(data,{endFor:p=>periodEndDate(p,data.periods,data.settings),allocationState:oneV15QueryCore.allocationState,contributionCategory:oneContributionCategory,projectRows:oneProjectMovementRows,projectExpense:oneProjectExpenseValue,projectPlan:oneProjectPlanSummary,goalCategory:oneGoalBudgetCategory,goalTarget:reserveTargetCRC,goalBalance:reserveBalanceAt,debtEntries:oneDebtUpcomingEntries,cobroPerson,cobroRemaining:cobroRemainingOriginal,actualBalance:actualBalanceAt},asOf,F);");
 return {w,errors,get:id=>w.document.getElementById(id),
  serialized:()=>w.localStorage.getItem(storageKey),
  read:()=>JSON.parse(w.localStorage.getItem(storageKey))};
}



const S=require("../src/experimental/v16-system-views.cjs"),F=require("../src/experimental/v16-financial-assignments.cjs"),E=require("../src/experimental/v16-assignment-editor.cjs"),P=require("../src/experimental/v16-storage-overlay.cjs");
for(const lab of [false,true])test("V16.7 guarded native storage roundtrip "+(lab?"Lab":"Daniel"),()=>{
 const e=boot(seed(),lab),w=e.w;let saved,model,balance;
 try{
  const expected=e.serialized(),raw=JSON.parse(w.__v15LedgerJSON());model=w.__v16NativeSnapshot(S,F,AS_OF);balance=w.actualBalanceAt(AS_OF);
  const target=model.allocations.find(a=>a.categoryId==="cat-exp"&&a.parentKey==="P0");assert(target&&!target.date);
  const p=P.prepare(raw,model,{kind:"distribute",id:target.id,transactionId:"native-dist",parts:[{date:"2026-11-16",amount:20000}]},F,E);
  const next=P.commit(raw,model,p,F,E);
  assert.deepEqual(P.bare(next),raw);saved=JSON.parse(w.__v16TestPersist(P,expected,next));assert.deepEqual(saved,next);
  assert.equal(w.actualBalanceAt(AS_OF),balance);
 }finally{w.close()}
 const reload=boot(saved,lab);
 try{
  const raw=JSON.parse(reload.w.__v15LedgerJSON()),b=reload.w.__v16NativeSnapshot(S,F,AS_OF),before=reload.serialized();assert(raw[P.FIELD]);
  const hydrated=P.hydrate(raw,b,F);
  assert.equal(F.project(hydrated,{basis:"calendar",start:"2026-11-16",end:"2026-11-22"}).rows.find(r=>r.id==="cat-exp").plannedMinor,2000000);
  assert.equal(reload.w.actualBalanceAt(AS_OF),balance);assert.equal(reload.serialized(),before);
 }finally{reload.w.close()}
});
