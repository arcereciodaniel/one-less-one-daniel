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









const {transitionPreflight,materializeTransition,auditLedger}=require("../src/experimental/v15-financial-query.cjs");
test("V15.6c explicit identities and calendar sums for multiple periods in one month",()=>{
 const raw={periods:[{key:"p",budgetMonth:"2026-11",fortnight:2,date:"2026-11-14",categoryBudgets:{food:100},categoryBudgetCurrencies:{food:"CRC"}}],movements:[],categories:[{id:"food",type:"Gasto"}]};
 const proposal={start:"2026-11-28",frequency:"weekly",days:90},endFor=p=>p.endDate||"2026-11-27",asOf="2026-11-26";
 const snapshot=JSON.stringify(raw),check=transitionPreflight(raw,proposal,asOf,endFor);
 const {ledger,createdKeys}=materializeTransition(raw,{...proposal,status:"prepared",boundary:check.boundary},asOf,endFor);
 assert.equal(createdKeys.length,13);assert.equal(new Set(createdKeys).size,13);assert.equal(ledger.periods.filter(p=>p.budgetMonth==="2027-01").length,5);
 const p=ledger.periods[1];p.categoryBudgets.food=10;p.categoryBudgetCurrencies.food="USD";
 assert.equal(auditLedger(ledger).issues.length,0);assert.equal(auditLedger(ledger).legacyOnly,false);
 const exact=queryBudget(ledger,{basis:"financial",mode:"period",key:p.key},endFor);assert.equal(exact.totals[0].minor,1000);assert.equal(exact.totals[0].currency,"USD");
 assert.throws(()=>queryBudget(ledger,{basis:"financial",mode:"month",month:"2026-12"},endFor));
 const mixed=queryBudget(ledger,{basis:"calendar",mode:"custom",anchor:"2026-11-14",end:"2026-12-04"},endFor);assert.equal(mixed.coverage,"complete");assert.equal(mixed.totals.length,2);
 assert.equal(JSON.stringify(raw),snapshot);
});
for(const lab of [false,true])test("V15.6c full restore rehearsal and original ledger conservation "+(lab?"Lab":"Daniel"),()=>{
 const e=boot(seed(),lab),w=e.w;
 try{
 const before=e.serialized(),memory=w.__v15LedgerJSON(),raw=JSON.parse(memory);
 const proposal={frequency:"weekly",start:w.oneShiftDate(w.todayIso(),1),days:90};
 const endFor=p=>w.periodEndDate(p,raw.periods,raw.settings);
 let check=transitionPreflight(raw,proposal,w.todayIso(),endFor);proposal.start=check.earliest;check=transitionPreflight(raw,proposal,w.todayIso(),endFor);
 const rec={...proposal,status:"prepared",boundary:check.boundary};
 const report=w.oneV15ValidateTransitionShadow(raw,rec,w.todayIso());assert.equal(report.count,13);
 const {ledger,createdKeys}=materializeTransition(raw,rec,w.todayIso(),endFor);
 const restored=w.restorePrepare(ledger);
 assert.equal(restored.periods.filter(p=>createdKeys.includes(p.key)).length,13);
 const p=restored.periods.find(p=>p.key===createdKeys[0]);assert.equal(w.periodEndDate(p,restored.periods,restored.settings),p.endDate);
 assert.equal(w.periodForDateIn(restored.periods,p.date).key,p.key);
 assert.equal(w.periodForDateIn(restored.periods,w.oneShiftDate(report.last,1)),null);
 const malformed=JSON.parse(JSON.stringify(ledger));malformed.periods.push(malformed.periods.at(-1));assert.throws(()=>w.restorePrepare(malformed));
 assert.equal(e.serialized(),before);assert.equal(w.__v15LedgerJSON(),memory);assert.deepEqual(e.errors,[]);
 }finally{w.close()}
});
