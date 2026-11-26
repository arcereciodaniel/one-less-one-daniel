"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert(script,"Falta JavaScript integrado");
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
function boot(custom=seed()){
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
 w.localStorage.setItem("daniel_finanzas_local_v1",JSON.stringify(custom));
 w.eval(script);
 return {w,errors,get:id=>w.document.getElementById(id),
  serialized:()=>w.localStorage.getItem("daniel_finanzas_local_v1"),
  read:()=>JSON.parse(w.localStorage.getItem("daniel_finanzas_local_v1"))};
}
test("V11.3: Futuro es opcional y no desplaza Inicio/Presupuesto/Movimientos",()=>{
 const e=boot();
 assert.equal(e.w.oneModuleEnabled("future"),false);
 assert.equal(e.get("moduleFutureToggle").checked,false);
 e.w.oneSetModuleEnabled("future",true);
 assert.equal(e.get("moduleFutureToggle").checked,true);
 e.w.navigate("future");
 assert.equal(e.get("view-future").classList.contains("active"),true);
 e.w.oneSetModuleEnabled("future",false);
 assert.equal(e.get("view-dashboard").classList.contains("active"),true);
 assert.deepEqual(e.errors,[]);
});
test("V11.3: ingreso con fecha y saldo inicial conciliado; no cuenta salarios ya recibidos",()=>{
 const e=boot(),m=e.w.oneFutureForecast(AS_OF,30);
 assert.equal(m.base,100000);
 assert.equal(m.days,30);
 assert.equal(m.recurringIncome,200000);
 assert.equal(m.scheduledDebt,20000);
 assert.equal(m.budgetExpense,15000);
 assert.equal(m.balance,265000);
 assert.equal(m.income,200000);
 assert.equal(m.outgo,35000);
 assert.equal(m.coverageDays,30);
 assert.equal(m.warnings.length,0);
 assert.deepEqual(e.errors,[]);
});
test("V11.3: el presupuesto de deuda no duplica su cuota programada",()=>{
 const e=boot(),m=e.w.oneFutureForecast(AS_OF,30);
 assert.equal(m.items.filter(x=>x.kind==="budget-debt").length,0);
 assert.equal(m.items.filter(x=>x.kind==="debt").length,1);
 assert.equal(m.items.find(x=>x.kind==="debt").date,"2026-11-25");
 assert.equal(m.items.find(x=>x.kind==="debt").amount,-20000);
 assert.equal(m.items.filter(x=>x.kind==="budget").reduce((s,x)=>s-x.amount,0),15000);
});
test("V11.3: gasto futuro real reemplaza parte de presupuesto, nunca suma dos veces",()=>{
 const sample=seed();
 sample.movements.push({id:"g2",seq:3,type:"Gasto",date:"2026-11-20",
  amount:6000,currency:"CRC",categoryId:"cat-exp",category:"Supermercado",period:"P0"});
 sample.movementSeq=3;
 const e=boot(sample),m=e.w.oneFutureForecast(AS_OF,30);
 assert.equal(m.items.filter(x=>x.kind==="confirmed"&&x.amount===-6000).length,1);
 assert.equal(m.budgetExpense,9000);
 assert.equal(m.balance,265000);
 assert.deepEqual(e.errors,[]);
});
test("V11.3: ingreso futuro ya registrado sustituye ingreso programado de la misma fecha",()=>{
 const sample=seed();
 sample.movements.push({id:"salary-nov",seq:3,type:"Ingreso",date:"2026-11-28",
  amount:100000,currency:"CRC",categoryId:"cat-salary",category:"Salario",period:"P1"});
 sample.movementSeq=3;
 const e=boot(sample),m=e.w.oneFutureForecast(AS_OF,30);
 assert.equal(m.recurringIncome,100000);
 assert.equal(m.items.filter(x=>x.kind==="confirmed"&&x.amount===100000).length,1);
 assert.equal(m.balance,265000);
});
test("V11.3: ingresos manuales sin fecha NO se inventan; alertar faltantes",()=>{
 const sample=seed(),salary=sample.categories.find(c=>c.id==="cat-salary");
 salary.incomeConfig.projectAutomatically=false;
 for(const p of sample.periods){
  p.categoryBudgets["cat-salary"]=100000;
  p.categoryBudgetCurrencies["cat-salary"]="CRC";
  p.categoryBudgetSources["cat-salary"]="manual";
 }
 const e=boot(sample),m=e.w.oneFutureForecast(AS_OF,30);
 assert.equal(m.recurringIncome,0);
 assert(m.warnings.some(x=>x.includes("sin automatización")));
 assert.equal(m.balance,65000);
});
test("V11.3: ventanas coherentes y llamadas sin ninguna modificación financiera",()=>{
 const e=boot();
 const before=e.serialized();
 const a=e.w.oneFutureForecast(AS_OF,30),b=e.w.oneFutureForecast(AS_OF,60),c=e.w.oneFutureForecast(AS_OF,90);
 assert.equal(a.points.length,31);assert.equal(b.points.length,61);assert.equal(c.points.length,91);
 assert.equal(a.balance,b.points[30].balance);
 assert.equal(a.balance,c.points[30].balance);
 e.w.oneSetModuleEnabled("future",true);
 e.w.navigate("future");
 for(const value of [30,60,90]){
  e.w.document.querySelector('[data-one-future-days="'+value+'"]').click();
  assert.equal(e.get("oneFutureNumbers").children.length,4);
  assert(e.get("oneFutureChart").querySelector("svg"));
 }
 assert.equal(e.serialized(),before);
 assert.deepEqual(e.errors,[]);
});
test("V11.3: deuda sin vencimiento genera advertencia y no inventa fecha",()=>{
 const sample=seed();sample.debts[0].payDay="";
 const e=boot(sample),m=e.w.oneFutureForecast(AS_OF,30);
 assert.equal(m.scheduledDebt,0);
 assert(m.warnings.some(x=>x.includes("deuda(s) activas sin día")));
 assert.equal(m.balance,265000);
});
test("V11.3: proyectos previstos y cobros sin ingreso real no entran al saldo",()=>{
 const sample=seed();
 sample.projects=[{id:"project1",name:"Japón",status:"active",currency:"CRC",budget:800000,buckets:[]}];
 sample.projectPlans=[{id:"plan1",projectId:"project1",name:"Hotel previsto",amount:400000,status:"pending"}];
 sample.sharedCharges=[{id:"charge1",person:"Cliente",amount:200000,currency:"CRC",date:"2026-11-16",status:"pending"}];
 const e=boot(sample),m=e.w.oneFutureForecast(AS_OF,30);
 assert.equal(m.balance,265000);
 assert.equal(e.read().movements.length,2);
 assert.deepEqual(e.errors,[]);
});


test("V13.3: native plan overrides intersecting legacy periods and does not mutate ledger",()=>{
 const sample=seed();sample.settings.financialPeriods={enabled:true,mode:"month",day:1};
 sample.flexBudgets=[{id:"native",mode:"month",start:"2026-11-01",end:"2026-11-30",entries:[{categoryId:"cat-exp",amount:20000,currency:"CRC"},{categoryId:"cat-debt",amount:30000,currency:"CRC"},{categoryId:"cat-salary",amount:200000,currency:"CRC"}]}];
 const e=boot(sample),before=e.serialized(),m=e.w.oneFutureForecast(AS_OF,30);
 assert.equal(m.flexible,true);assert.equal(m.base,100000);assert.equal(m.recurringIncome,200000);assert.equal(m.budgetExpense,15000);assert.equal(m.scheduledDebt,20000);
 assert.equal(m.balance,265000);assert.equal(m.daysWithoutBudget,13);assert.equal(e.serialized(),before);assert.deepEqual(e.errors,[]);
 const long=e.w.oneFutureForecast(AS_OF,90);assert.equal(m.balance,long.points[30].balance);
});
test("V13.3: a native plan counts dated real income and future expense only once",()=>{
 const sample=seed();sample.settings.financialPeriods={enabled:true,mode:"month",day:1};
 sample.flexBudgets=[{id:"native",mode:"month",start:"2026-11-01",end:"2026-11-30",entries:[{categoryId:"cat-exp",amount:20000,currency:"CRC"},{categoryId:"cat-salary",amount:200000,currency:"CRC"}]}];
 sample.movements.push({id:"mobile",seq:3,type:"Gasto",date:"2026-11-20",amount:6000,currency:"CRC",categoryId:"cat-exp",period:"P0",mobilePilotSource:"iphone"},{id:"salary",seq:4,type:"Ingreso",date:"2026-11-28",amount:100000,currency:"CRC",categoryId:"cat-salary",period:"P1"});
 sample.movementSeq=4;
 const e=boot(sample),m=e.w.oneFutureForecast(AS_OF,30);
 assert.equal(m.recurringIncome,100000);assert.equal(m.budgetExpense,9000);assert.equal(m.items.filter(x=>x.kind==="confirmed"&&x.amount===-6000).length,1);
 assert.equal(m.items.filter(x=>x.kind==="confirmed"&&x.amount===100000).length,1);assert.equal(m.balance,265000);assert.deepEqual(e.errors,[]);
});
test("V13.3: overlapping legacy coverage is not silently prorated; disabled beta retains legacy",()=>{
 const a={date:"2026-11-14",end:"2026-11-27"},b={date:"2026-11-28",end:"2026-12-13"},n={start:"2026-11-20",end:"2026-11-26"};
 const e=boot(),w=e.w;
 assert.deepEqual(Array.from(w.oneFuturePlanSources([a,b],[n],p=>p.end,true),p=>p.start),["2026-11-20","2026-11-28"]);
 assert.deepEqual(Array.from(w.oneFuturePlanSources([a,b],[n],p=>p.end,false),p=>p.start),["2026-11-14","2026-11-28"]);
 assert.equal(w.oneFutureIncomeAllocations(300,["2027-02-28","2027-02-28","2027-03-15"])[0].amount,200);
});

test("V13.3.1: monetary totals round once, not each daily fraction",()=>{
 const e=boot(),w=e.w;
 const sum=amount=>Array(13).fill(amount/13).reduce((s,v)=>s+v,0);
 assert.equal(w.oneFutureMoney(sum(15000)),15000);
 assert.equal(w.oneFutureMoney(sum(9000)),9000);
 assert.equal(w.oneFutureMoney(265000.00000000006),265000);
 assert.equal(w.oneFutureMoney(-0.123456),-0.12);
});

test("V14.4: weekly replacement affects full source once and preserves confirmed movements",()=>{
 const sample=seed();sample.livingBudgets=[];
 const e=boot(sample),w=e.w;
 const rows=w.oneLivingReplace([],"cat-exp",{start:"2026-11-21",end:"2026-11-27"},30000,"CRC");
 sample.livingBudgets=Array.from(rows);
 const a=boot(sample),before=a.serialized(),m=a.w.oneFutureForecast(AS_OF,30);
 assert.equal(m.living,true);assert.equal(m.recurringIncome,200000);assert.equal(m.scheduledDebt,20000);assert.equal(m.budgetExpense,35000);assert.equal(m.balance,245000);
 assert.equal(m.balance,a.w.oneFutureForecast(AS_OF,90).points[30].balance);assert.equal(a.serialized(),before);assert.deepEqual(a.errors,[]);
});
test("V14.4: forecast uses dated overrides in gaps and does not fabricate coverage",()=>{
 const sample=seed();sample.settings.financialPeriods={enabled:true,mode:"month",day:1};
 sample.flexBudgets=[{id:"n",mode:"month",start:"2026-11-01",end:"2026-11-30",entries:[{categoryId:"cat-exp",amount:20000,currency:"CRC"}]}];
 const w=boot(sample).w;sample.livingBudgets=Array.from(w.oneLivingReplace([],"cat-exp",{start:"2026-12-01",end:"2026-12-07"},7000,"CRC"));
 const a=boot(sample),m=a.w.oneFutureForecast(AS_OF,30);
 assert.equal(m.budgetExpense,22000);assert.equal(m.daysWithoutBudget,13);
 assert.equal(m.items.filter(x=>x.kind==="budget"&&x.date>="2026-12-01"&&x.date<="2026-12-07").reduce((s,x)=>s-x.amount,0),7000);
 assert.equal(m.recurringIncome,200000);assert.deepEqual(a.errors,[]);
});
test("V14.5: restore round trip preserves original plans and dated overrides",()=>{
 const sample=seed();const e=boot(sample),w=e.w;
 sample.flexBudgets=[{id:"n",mode:"month",start:"2026-12-01",end:"2026-12-31",entries:[{categoryId:"cat-exp",amount:160000,currency:"CRC"}]}];
 sample.livingBudgets=Array.from(w.oneLivingReplace([],"cat-exp",{start:"2026-12-21",end:"2026-12-27"},60000,"CRC"));
 const restored=w.restorePrepare(sample);
 assert.equal(JSON.stringify(restored.flexBudgets),JSON.stringify(sample.flexBudgets));
 assert.equal(JSON.stringify(restored.livingBudgets),JSON.stringify(sample.livingBudgets));
 assert.equal(restored.movements.length,sample.movements.length);
 assert.throws(()=>w.restorePrepare({...sample,livingBudgets:[...sample.livingBudgets,sample.livingBudgets[0]]}));
});

test("V14.5: one budget interface is visible from first load; interval persists independently of ledger",()=>{
 const e=boot(),w=e.w,d=w.document;w.navigate("plan");
 assert.equal(d.getElementById("oneLegacyBudgetHeader").hidden,true);assert.equal(d.getElementById("planMonths").hidden,true);assert.equal(d.getElementById("r8PlanOptions").hidden,true);
 assert.equal(d.getElementById("oneFlexPlan").hidden,false);assert(d.querySelector("#oneFlexPlan .r8-fortnight-card"));assert(!d.getElementById("oneFlexPlan").textContent.includes("Lectura del presupuesto"));
 const before=e.serialized(),select=d.getElementById("oloPlanPeriod");select.value="week";select.dispatchEvent(new w.Event("change",{bubbles:true}));
 assert.equal(d.getElementById("oloPlanPeriod").value,"week");assert.equal(JSON.parse(w.localStorage.getItem("daniel_finanzas_ui_v1")).oloBudgetView.mode,"week");
 assert.equal(e.serialized(),before);assert.deepEqual(e.errors,[]);
});

test("V14.5: Home and Movements have one visible date filter without legacy toggles",()=>{const e=boot(),d=e.w.document;assert.equal(d.getElementById("dashboardFilters").hidden,true);assert.equal(d.getElementById("oneFlexHome").hidden,false);assert.equal(d.querySelector(".one-move-period-control").hidden,true);assert.equal(d.getElementById("oneFlexMoves").hidden,false);assert(!d.querySelector("[data-olo-enter]"));assert.deepEqual(e.errors,[]);});
