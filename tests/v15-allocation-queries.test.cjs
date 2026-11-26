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






const {allocationPreview}=require("../src/experimental/v15-financial-query.cjs");
test("V15.5b exact weekly blocks, cut dates, currencies, no double counting or stale use",()=>{
 const p={key:"p",budgetMonth:"2026-11",fortnight:2,date:"2026-11-14",categoryBudgets:{food:100.01,other:20},categoryBudgetCurrencies:{food:"USD",other:"CRC"}};
 const parent={start:p.date,end:"2026-11-27",amount:100.01,currency:"USD"},v=allocationPreview(parent,null,0,40,"maintain");
 const rec={periodKey:"p",categoryId:"food",start:parent.start,end:parent.end,currency:parent.currency,parentMinor:v.total,amounts:v.next};
 const raw={periods:[p],categories:[{id:"food",type:"Gasto"},{id:"other",type:"Gasto"}],v15WeeklyAllocations:[rec]};
 const snapshot=JSON.stringify(raw),q=(anchor,end)=>queryBudget(raw,{basis:"calendar",mode:"custom",anchor,end},()=>parent.end);
 let r=q("2026-11-14","2026-11-15");assert.equal(r.coverage,"partial");assert.deepEqual(r.resolvedCategoryIds,["food"]);assert.equal(r.knownSubtotal.find(x=>x.categoryId==="food").minor,4000);
 r=q("2026-11-14","2026-11-14");assert.equal(r.knownSubtotal.length,0);assert(r.unresolvedCategoryIds.includes("food"));
 r=q("2026-11-14","2026-11-27");assert.equal(r.totals.find(x=>x.categoryId==="food").minor,10001);
 assert.equal(JSON.stringify(raw),snapshot);
 p.categoryBudgets.food=101;r=q("2026-11-14","2026-11-15");assert.equal(r.knownSubtotal.length,0);assert.equal(r.allocationReview.length,1);
});
for(const lab of [false,true])test("V15.5b stale reconciliation preview, cancel and confirmed reset "+(lab?"Lab":"Daniel"),()=>{
 const raw=seed(),e=boot(raw,lab),w=e.w,d=w.document;
 try{
 w.navigate("plan");const select=e.get("planLevel");select.value="month";select.dispatchEvent(new w.Event("change",{bubbles:true}));
 const month=e.get("planMonth");month.value="2026-11";month.dispatchEvent(new w.Event("change",{bubbles:true}));
 const open=()=>d.querySelector('[data-v15-allocate="P0"]').click();
 const submit=()=>e.get("v15AllocationForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
 open();const field=e.get("v15AllocationAmount");field.value="10000";field.dispatchEvent(new w.Event("input",{bubbles:true}));submit();
 const initial=e.read(),old=initial.v15WeeklyAllocations[0];
 select.value="custom";select.dispatchEvent(new w.Event("change",{bubbles:true}));
 e.get("v15PlanStart").value="2026-11-14";e.get("v15PlanEnd").value="2026-11-15";e.get("v15PlanEnd").dispatchEvent(new w.Event("change",{bubbles:true}));
 assert.match(e.get("planMonths").textContent,/Asignado:.*10[.,\s\u00a0]?000/);
 select.value="month";select.dispatchEvent(new w.Event("change",{bubbles:true}));month.value="2026-11";month.dispatchEvent(new w.Event("change",{bubbles:true}));
 const input=Array.from(d.querySelectorAll("[data-category-budget]")).find(x=>x.dataset.categoryBudget==="P0|cat-exp");
 input.value="25000";input.dispatchEvent(new w.Event("change",{bubbles:true}));
 const stale=e.serialized();open();assert.equal(e.get("v15AllocationReview").hidden,false);assert.equal(e.get("v15AllocationConfirm").disabled,true);
 e.get("v15AllocationReview").click();assert.equal(e.get("v15AllocationConfirm").disabled,false);assert.equal(e.serialized(),stale);e.get("v15AllocationCancel").click();assert.equal(e.serialized(),stale);
 open();e.get("v15AllocationReview").click();submit();
 const saved=e.read();assert.equal(saved.periods.find(p=>p.key==="P0").categoryBudgets["cat-exp"],25000);assert.equal(saved.v15WeeklyAllocations[0].parentMinor,2500000);assert.deepEqual(saved.v15WeeklyAllocations[0].undo.previous.amounts,old.amounts);
 assert.deepEqual(saved.movements,initial.movements);assert.deepEqual(e.errors,[]);
 }finally{w.close()}
});
