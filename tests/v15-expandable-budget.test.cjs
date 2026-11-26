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




const {weeklyBreakdown}=require("../src/experimental/v15-financial-query.cjs");
test("V15.4 clipped calendar weeks preserve all actual events without allocations",()=>{
 const events=[{date:"2026-10-28",amountCRC:1},{date:"2026-11-01",amountCRC:2},{date:"2026-11-02",amountCRC:3},{date:"2026-11-13",amountCRC:4},{date:"2026-11-14",amountCRC:5}];
 const before=JSON.stringify(events),r=weeklyBreakdown("2026-10-28","2026-11-13",events);
 assert.deepEqual(r.weeks.map(w=>[w.start,w.end]),[["2026-10-28","2026-11-01"],["2026-11-02","2026-11-08"],["2026-11-09","2026-11-13"]]);
 assert.ok(r.weeks.every(w=>w.planned===null));
 assert.equal(r.weeks.flatMap(w=>w.events).reduce((s,e)=>s+e.amountCRC,0),10);
 assert.equal(r.outside[0].amountCRC,5);assert.equal(JSON.stringify(events),before);
});
for(const lab of [false,true])test("V15.4 monthly and weekly expansion preserves original cards "+(lab?"Lab":"Daniel"),()=>{
 const raw=seed();raw.periods[1].categoryBudgets["cat-exp"]=100000;raw.periods[2].categoryBudgets["cat-exp"]=100000;
 raw.periods[1].categoryBudgets["cat-debt"]=12.34;raw.periods[1].categoryBudgetCurrencies["cat-debt"]="USD";
 const e=boot(raw,lab),w=e.w,d=w.document;
 try{
 const before=e.serialized(),memory=w.__v15LedgerJSON();w.navigate("plan");
 const select=e.get("planLevel");select.value="month";select.dispatchEvent(new w.Event("change",{bubbles:true}));
 const month=e.get("planMonth");month.value="2026-12";month.dispatchEvent(new w.Event("change",{bubbles:true}));
 const totals=d.querySelector('[data-v15-month-totals="2026-12"]');assert(totals);assert.equal(totals.open,false);totals.open=true;
 assert.match(totals.textContent,/Supermercado/);assert.match(totals.textContent,/200[.,\s\u00a0]?000/);assert.match(totals.textContent,/12[.,]34/);
 const original=Array.from(d.querySelectorAll("#planMonths [data-category-budget]"),x=>[x.dataset.categoryBudget,x.value]);assert.ok(original.length>0);
 const weekly=d.querySelector('[data-v15-week-detail="P1"]');assert(weekly);assert.equal(weekly.open,false);weekly.open=true;
 assert.equal(weekly.querySelectorAll("[data-category-budget]").length,0);
 assert.match(weekly.textContent,/sin distribución semanal/);
 assert.equal(weekly.querySelector("[data-v15-week-start]").dataset.v15WeekStart,"2026-11-28");
 month.value="2026-11";month.dispatchEvent(new w.Event("change",{bubbles:true}));
 const nov=d.querySelector('[data-v15-month-totals="2026-11"]');assert.match(nov.textContent,/mes incompleto/);
 const weeks=d.querySelector('[data-v15-week-detail="P0"]');assert.match(weeks.textContent,/Supermercado/);assert.match(weeks.textContent,/5[.,\s\u00a0]?000/);assert.match(weeks.textContent,/Préstamos/);
 assert.equal(e.serialized(),before);assert.equal(w.__v15LedgerJSON(),memory);assert.deepEqual(e.errors,[]);
 }finally{w.close()}
});
