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
 w.eval(script+"\n;globalThis.__v15LedgerJSON=()=>JSON.stringify(data);");
 return {w,errors,get:id=>w.document.getElementById(id),
  serialized:()=>w.localStorage.getItem(storageKey),
  read:()=>JSON.parse(w.localStorage.getItem(storageKey))};
}





const {allocationState,allocationPreview}=require("../src/experimental/v15-financial-query.cjs");
test("V15.5 cent conservation, increase and stale parent",()=>{
 const p={start:"2026-11-14",end:"2026-11-27",amount:100.01,currency:"USD"};
 const a=allocationPreview(p,null,0,40,"maintain");assert.equal(a.total,10001);assert.equal(a.next[0],4000);assert.equal(a.next.reduce((s,v)=>s+v,0),10001);
 const rec={start:p.start,end:p.end,currency:p.currency,parentMinor:a.total,amounts:a.next};
 const b=allocationPreview(p,rec,0,50,"increase");assert.equal(b.total,11001);assert.deepEqual(b.next.slice(1),a.next.slice(1));
 assert.throws(()=>allocationPreview(p,rec,0,100.02,"maintain"));assert.throws(()=>allocationPreview(p,rec,0,39,"increase"));
 assert.equal(allocationState({...p,amount:101},rec).stale,true);
});
for(const lab of [false,true])test("V15.5 confirm, increase, undo and cancellation "+(lab?"Lab":"Daniel"),()=>{
 const e=boot(seed(),lab),w=e.w,d=w.document;
 try{
 w.navigate("plan");const select=e.get("planLevel");select.value="month";select.dispatchEvent(new w.Event("change",{bubbles:true}));
 const month=e.get("planMonth");month.value="2026-11";month.dispatchEvent(new w.Event("change",{bubbles:true}));
 const open=()=>d.querySelector('[data-v15-allocate="P0"]').click();
 const before=e.serialized(),initial=JSON.parse(w.__v15LedgerJSON()),parent=initial.periods.find(p=>p.key==="P0");
 open();e.get("v15AllocationCancel").click();assert.equal(e.serialized(),before);
 open();const field=e.get("v15AllocationAmount");field.value="10000";field.dispatchEvent(new w.Event("input",{bubbles:true}));
 assert.equal(e.serialized(),before);
 e.get("v15AllocationForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
 let saved=e.read(),record=saved.v15WeeklyAllocations[0];assert.equal(record.amounts[0],1000000);assert.equal(record.amounts.reduce((s,n)=>s+n,0),parent.categoryBudgets["cat-exp"]*100);
 assert.deepEqual(saved.periods,initial.periods);assert.deepEqual(saved.movements,initial.movements);
 open();const mode=e.get("v15AllocationMode");mode.value="increase";mode.dispatchEvent(new w.Event("input",{bubbles:true}));field.value="11000";field.dispatchEvent(new w.Event("input",{bubbles:true}));
 e.get("v15AllocationForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
 saved=e.read();assert.equal(saved.periods.find(p=>p.key==="P0").categoryBudgets["cat-exp"],parent.categoryBudgets["cat-exp"]+1000);
 open();e.get("v15AllocationUndo").click();saved=e.read();assert.deepEqual(saved.periods,initial.periods);assert.deepEqual(saved.movements,initial.movements);assert.deepEqual(saved.v15WeeklyAllocations[0].amounts,record.amounts);
 assert.deepEqual(e.errors,[]);
 }finally{w.close()}
});
