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
function boot(custom=seed(),lab=false,mobileEntries=null,clock=null){
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
 if(clock){const RealDate=w.Date,stamp=RealDate.parse(clock+'T12:00:00Z');w.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[stamp]))}static now(){return stamp}};}
 const now=new w.Date();
 custom.settings.fxCheckedOn=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
 w.localStorage.setItem(storageKey,JSON.stringify(custom));
 // Test-only accessor in the same lexical scope; never shipped in application code.
 const acks=[];
 if(mobileEntries){
  w.localStorage.setItem(storageKey+"_iphone_pilot_v1",JSON.stringify({url:"https://pilot.example.com",key:"x".repeat(40)}));
  w.fetch=async(url,opt={})=>{
   const path=new URL(url).pathname;
   if(path==="/api/catalog")return {ok:true,json:async()=>({ok:true})};
   if(path==="/api/inbox")return {ok:true,json:async()=>({items:[...mobileEntries]})};
   if(path==="/api/ack"){const id=JSON.parse(opt.body).id;acks.push(id);const i=mobileEntries.findIndex(x=>x.id===id);if(i>=0)mobileEntries.splice(i,1);return {ok:true,json:async()=>({ok:true})}}
   throw Error("unexpected route");
  };
 }
 const pilot=mobileEntries?fs.readFileSync("mobile-pilot/desktop.js","utf8"):"";
 const split=mobileEntries?fs.readFileSync("mobile-pilot/public/split-fare.js","utf8"):"";
 w.eval(split+"\n"+script+"\n;globalThis.__v15LedgerJSON=()=>JSON.stringify(data);\n"+pilot);
 return {w,errors,acks,get:id=>w.document.getElementById(id),
  serialized:()=>w.localStorage.getItem(storageKey),
  read:()=>JSON.parse(w.localStorage.getItem(storageKey))};
}













const {transitionPreflight,materializeTransition}=require("../src/experimental/v15-financial-query.cjs");
test("V15.6 integrated mobile: mixed periods, boundary rejection and deduplication",async()=>{
 const base=boot();let mixed;
 try{
 const w=base.w,raw=JSON.parse(w.__v15LedgerJSON()),asOf=w.todayIso(),endFor=p=>w.periodEndDate(p,raw.periods,raw.settings);
 const proposal={frequency:"weekly",start:w.oneShiftDate(asOf,1),days:90};proposal.start=transitionPreflight(raw,proposal,asOf,endFor).earliest;
 const check=transitionPreflight(raw,proposal,asOf,endFor);mixed=materializeTransition(raw,{...proposal,status:"prepared",boundary:check.boundary},asOf,endFor).ledger;
 }finally{base.w.close()}
 const flex=mixed.periods.filter(p=>p.periodKind==="flexible");
 const mk=(id,date,type,categoryId)=>({id,movement:{date,type,categoryId,currency:"CRC",amount:1234,description:"Prueba ficticia"}});
 const entries=[mk("iphone-v15-legacy-000001","2026-11-16","Gasto","cat-exp"),mk("iphone-v15-flex-00000001",flex[0].date,"Gasto","cat-exp"),mk("iphone-v15-flex-00000002",flex[1].date,"Ingreso","cat-salary"),mk("iphone-v15-outside-00001",new Date(Date.parse(flex.at(-1).endDate)+86400000).toISOString().slice(0,10),"Gasto","cat-exp")];
 const e=boot(mixed,false,entries,entries.at(-1).movement.date),w=e.w;
 try{
  e.get("oneMobileSync").click();
  await new Promise(r=>setTimeout(r,200));
  const saved=e.read(),find=id=>saved.movements.find(m=>m.mobilePilotId===id);
  assert.equal(find("iphone-v15-legacy-000001").period,"P0");
  assert.equal(find("iphone-v15-flex-00000001")?.period,flex[0].key,e.get("oneMobileIssuesList").textContent);
  assert.equal(find("iphone-v15-flex-00000002")?.period,flex[1].key,e.get("oneMobileIssuesList").textContent);
  assert.equal(find("iphone-v15-outside-00001"),undefined);
  assert.equal(entries.length,1);assert.equal(e.acks.length,3);
  assert.match(e.get("oneMobileIssuesList").textContent,/no tiene período presupuestario/);
  entries.push(mk("iphone-v15-flex-00000001",flex[0].date,"Gasto","cat-exp"));
  e.get("oneMobileSync").click();await new Promise(r=>setTimeout(r,100));
  assert.equal(e.read().movements.filter(m=>m.mobilePilotId==="iphone-v15-flex-00000001").length,1);
  assert.equal(entries.length,1);assert.equal(e.acks.length,4);
  assert.deepEqual(e.errors,[]);
 }finally{w.close()}
});
test("V15.6 isolated preview: no external assets or mobile, distinct storage, synthetic ledger",()=>{
 const {buildPreview}=require("../scripts/build-v15-preview.cjs");
 const html=buildPreview();
 assert.match(html,/V15\.6 LAB · DEMO/);
 assert.match(html,/connect-src 'none'/);
 assert.doesNotMatch(html,/<script\s+src=/);
 const dom=new JSDOM(html,{url:"https://preview.example.com/",runScripts:"outside-only",pretendToBeVisual:true});
 const w=dom.window;
 try{
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}})};
 w.fetch=async()=>{throw Error("offline")};w.alert=()=>{};w.confirm=()=>true;w.prompt=()=>null;
 w.localStorage.setItem("daniel_finanzas_local_v1","protected");
 w.localStorage.setItem("rastro_lab_v7_1_data_v1","protected");
 const scripts=[...w.document.querySelectorAll("script")].map(x=>x.textContent);
 w.eval(scripts.join("\n")+"\n;globalThis.__previewNavigate=navigate;");
 const raw=JSON.parse(w.localStorage.getItem("rastro_lab_v15_6_preview_data_v1"));
 assert.equal(raw.periods[0].categoryBudgets["cat-exp"],80000);
 assert.equal(w.localStorage.getItem("daniel_finanzas_local_v1"),"protected");
 assert.equal(w.localStorage.getItem("rastro_lab_v7_1_data_v1"),"protected");
 assert.equal(w.document.getElementById("oneMobilePilot"),null);
 assert.equal(w.document.getElementById("oneSettingsRestore").disabled,true);
 w.__previewNavigate("plan");assert(w.document.getElementById("planMonths").querySelector(".r8-fortnight-card"));
 }finally{w.close()}
});

test("V15.7 native detail is collapsed and read-only; pace and incomplete range guards",()=>{
 const raw=seed();raw.movements[0].amount=15000;
 const e=boot(raw,false,null,"2026-11-20"),w=e.w;
 try{
  const before=e.serialized(),p=e.read().periods[0];
  const markup=w.oneV15PeriodIntelligence(p,"2026-11-20");
  assert.match(markup,/data-v15-intelligence/);
  assert.match(markup,/Por encima del ritmo de referencia/);
  assert.match(markup,/Supermercado/);
  const el=w.document.createElement("div");el.innerHTML=markup;
  assert.equal(el.querySelector("details").open,false);
  assert.equal(w.oneV15DateIntelligence({coverage:"partial"},{start:"2026-11-16",end:"2026-11-22"},"2026-11-20"),"");
  assert.equal(e.serialized(),before);
  assert.deepEqual(e.errors,[]);
 }finally{w.close()}
});
test("V15.7 demo has three synthetic cases and isolated storage, no mobile or network",()=>{
 const {buildIntelligencePreview}=require("../scripts/build-v15-intelligence-preview.cjs");
 const html=buildIntelligencePreview();
 assert.match(html,/V15\.7 LAB · DEMO/);assert.match(html,/rastro_lab_v15_7_preview_data_v1/);
 assert.doesNotMatch(html,/rastro_lab_v15_6_preview_|<script\s+src=/);
 assert.match(html,/connect-src 'none'/);
 const dom=new JSDOM(html,{url:"https://preview.example.com/",runScripts:"outside-only",pretendToBeVisual:true});
 const w=dom.window;
 try{
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
  w.HTMLDialogElement.prototype.close=function(){this.open=false};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}})};
  w.fetch=async()=>{throw Error("offline")};w.alert=()=>{};w.confirm=()=>true;w.prompt=()=>null;
  const RealDate=w.Date,stamp=RealDate.parse("2026-11-20T12:00:00Z");w.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[stamp]))}static now(){return stamp}};
  for(const key of ["daniel_finanzas_local_v1","rastro_lab_v7_1_data_v1","rastro_lab_v15_6_preview_data_v1"])w.localStorage.setItem(key,"protected");
  w.eval([...w.document.querySelectorAll("script")].map(x=>x.textContent).join("\n")+"\n;globalThis.__v15Demo={navigate,oneV15PeriodIntelligence,data};");
  const p=w.__v15Demo.data.periods[0],markup=w.__v15Demo.oneV15PeriodIntelligence(p,"2026-11-20");
  for(const s of ["Sin presupuesto","Exceso del presupuesto","Por encima del ritmo de referencia","Comida fuera","Transporte","Supermercado"])assert(markup.includes(s),s);
  w.__v15Demo.navigate("plan");assert(w.document.querySelector("#planMonths [data-v15-intelligence]"));
  for(const key of ["daniel_finanzas_local_v1","rastro_lab_v7_1_data_v1","rastro_lab_v15_6_preview_data_v1"])assert.equal(w.localStorage.getItem(key),"protected");
  assert.equal(w.document.getElementById("oneMobilePilot"),null);
 }finally{w.close()}
});

test("V15.8 current snapshot agrees with remaining budget and native detail",()=>{
 const raw=seed();raw.movements[0].amount=15000;
 const e=boot(raw,false,null,"2026-11-20"),w=e.w;
 try{
  const before=e.serialized(),s=w.oneV15CurrentBudget("2026-11-20");
  assert(s&&s.hasPlan);
  assert.equal(s.rows.find(r=>r.id==="cat-exp").remainingCRC,5000);
  assert.equal(s.rows.find(r=>r.id==="cat-debt").remainingCRC,20000);
  assert.equal(w.remainingBudgetForCurrentPeriod(s.p,"2026-11-20"),25000);
  assert.equal(s.analysis.remaining,2500000);
  assert.match(w.oneV15PeriodIntelligence(s.p,"2026-11-20"),/Por encima del ritmo de referencia/);
  w.renderDashboard();
  assert.match(w.document.getElementById("dashboardInsight").textContent,/por encima del ritmo/i);
  assert.equal(e.serialized(),before);
 }finally{w.close()}
});
test("V15.8 isolated demo uses fresh keys and keeps network blocked",()=>{
 const {buildGlobalPreview}=require("../scripts/build-v15-global-preview.cjs");
 const html=buildGlobalPreview();
 assert.match(html,/V15\.8 LAB · DEMO/);assert.match(html,/rastro_lab_v15_8_preview_data_v1/);
 assert.doesNotMatch(html,/rastro_lab_v15_7_preview_|<script\s+src=/);
 assert.match(html,/connect-src 'none'/);
});
