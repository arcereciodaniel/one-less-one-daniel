"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert(script,"Falta el script de One Less One");
const AS_OF="2026-11-17";
function seed(){
 const periods=[
 ["2026-10-28","2026-11",1],["2026-11-14","2026-11",2],
 ["2026-11-28","2026-12",1],["2026-12-14","2026-12",2],
 ["2026-12-28","2027-01",1],["2027-01-14","2027-01",2],
 ["2027-01-28","2027-02",1],["2027-02-14","2027-02",2],
 ["2027-02-28","2027-03",1],["2027-03-14","2027-03",2]
 ].map(([date,budgetMonth,fortnight],i)=>({
  key:"P"+i,date,budgetMonth,fortnight,
  quarter:date.slice(0,4)+"-T"+Math.floor((Number(date.slice(5,7))-1)/3+1),
  n:i+1,opening:i===0?150000:null,
  categoryBudgets:{
   "cat-exp":i>=1?100000:0,"cat-save":i>=1?20000:0,"cat-debt":i>=1?10000:0
  },
  categoryBudgetCurrencies:{"cat-exp":"CRC","cat-save":"CRC","cat-debt":"CRC"},
  categoryBudgetSources:{},categoryBudgetScheduledDates:{},budgets:{}
 }));
 return {version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,
  settings:{fx:500,fxBuy:490,fxSell:510,fxDate:AS_OF,fxCheckedOn:AS_OF,
   fxSource:"manual",fxHistory:[],displayCurrency:"CRC",payDays:{first:14,second:28}},
  periods,
  categories:[
   {id:"cat-exp",name:"Supermercado",group:"Gastos",type:"Gasto",active:true,budgetable:true,sort:1},
   {id:"cat-save",name:"Ahorro e inversión",group:"Gastos",type:"Gasto",active:true,budgetable:true,sort:2},
   {id:"cat-debt",name:"Pago préstamo",group:"Deudas",type:"Pago deuda",active:true,budgetable:true,sort:3}
  ],
  movements:[
   {id:"spent",seq:1,type:"Gasto",date:"2026-11-16",amount:20000,currency:"CRC",categoryId:"cat-exp",category:"Supermercado",period:"P1",description:"Compras"},
   {id:"future",seq:2,type:"Gasto",date:"2026-11-20",amount:6000,currency:"CRC",categoryId:"cat-exp",category:"Supermercado",period:"P1",description:"Gasto ya programado"}
  ],movementSeq:2,movementAudit:[],movementTemplates:[],
  debts:[{id:"debt1",name:"Préstamo",type:"Préstamo",status:"active",crc:150000,usd:0,
   minimum:10000,minimumCurrency:"CRC",payDay:"25",rate:"",balanceAdjustments:[]}],
  reconciliations:[{id:"recon",date:AS_OF,amount:250000,currency:"CRC",fxBuy:490,fxSell:510,
   afterSeq:2,createdAt:AS_OF+"T09:00:00Z"}],
  reserves:[{id:"goal",name:"Meta",type:"goal",status:"active",openingDate:"2026-01-01",
   openingAmount:50000,openingCurrency:"CRC",target:200000,targetCurrency:"CRC",budgetCategoryId:"cat-save"}],
  reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[],
  projects:[],projectLinks:[],projectPlans:[]
 };
}
function boot(custom=seed()){
 const errors=[],vc=new VirtualConsole();vc.on("jsdomError",e=>errors.push("JSDOM "+String(e.stack||e)));
 const dom=new JSDOM(html,{url:"https://example.com/",runScripts:"outside-only",pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLElement.prototype.focus=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){
  return new Proxy({},{get:(_,key)=>key==="measureText"?()=>({width:80}):()=>{}});
 };
 w.alert=msg=>errors.push("ALERT "+msg);w.confirm=()=>true;w.prompt=()=>null;
 w.fetch=async()=>{throw Error("Offline")};
 w.localStorage.setItem("daniel_finanzas_local_v1",JSON.stringify(custom));
 w.eval(script);
 return {w,dom,errors,q:id=>w.document.getElementById(id),
  raw:()=>w.localStorage.getItem("daniel_finanzas_local_v1"),
  read:()=>JSON.parse(w.localStorage.getItem("daniel_finanzas_local_v1"))};
}
function forecast(e,days=30){return e.w.oneFutureForecast(AS_OF,days)}
const almost=(actual,expected,delta=.01)=>assert(Math.abs(actual-expected)<delta,
 "Esperado "+expected+", recibido "+actual);
test("V11.5: simulación neutra = Futuro sin operaciones adicionales",()=>{
 const e=boot(),f=forecast(e,30),s=e.w.oneScenarioEvaluate(f,{});
 almost(s.balance,f.balance);almost(s.difference,0);
 assert.equal(s.points.length,31);assert.equal(s.extraSavings,0);
 assert.equal(s.extraDebt,0);assert.equal(s.avoided,0);
 assert.deepEqual(e.errors,[]);
});
test("V11.5: recorte afecta solamente gasto ordinario pendiente, NO metas, cuotas o movimiento confirmado",()=>{
 const e=boot(),f=forecast(e),s=e.w.oneScenarioEvaluate(f,{cutPercent:25});
 const ordinary=f.items.filter(x=>x.kind==="budget").reduce((sum,x)=>sum-x.amount,0);
 const setAside=f.items.filter(x=>x.kind==="budget-savings").reduce((sum,x)=>sum-x.amount,0);
 const debt=f.items.filter(x=>x.kind==="debt").reduce((sum,x)=>sum-x.amount,0);
 assert(ordinary>0);
 assert(setAside>0);
 assert(debt>0);
 almost(s.avoided,ordinary*.25);
 almost(s.difference,s.avoided);
 assert.equal(s.extraDebt,0);assert.equal(s.extraSavings,0);
 assert.equal(f.items.filter(x=>x.kind==="confirmed"&&x.label==="Gasto ya programado").length,1);
 assert.deepEqual(e.errors,[]);
});
test("V11.5: ahorro extra reduce liquidez y no se contabiliza como gasto real",()=>{
 const e=boot(),f=forecast(e,60),before=e.raw();
 const s=e.w.oneScenarioEvaluate(f,{monthlySavingsCRC:30000});
 const dates=e.w.oneScenarioDates(f);
 assert.deepEqual([...dates],["2026-11-28","2026-12-28"]);
 assert.equal(s.scheduled.filter(x=>x.type==="goal").length,2);
 almost(s.extraSavings,60000);almost(s.difference,-60000);
 assert.equal(e.raw(),before);
 assert.equal(e.read().reserveMovements.length,0);
});
test("V11.5: abonos extra tienen tope de deuda y nunca generan pagos reales",()=>{
 const e=boot(),f=forecast(e,90),before=e.raw();
 const s=e.w.oneScenarioEvaluate(f,{monthlyDebtCRC:100000000});
 assert(s.extraDebt>0&&s.extraDebt<=150000);
 assert(s.scheduled.every(x=>x.type==="debt"&&x.amount>0));
 assert(s.warnings.some(x=>x.includes("intereses")));
 assert(s.warnings.some(x=>x.includes("limitaron")));
 assert.equal(e.raw(),before);
 assert.equal(e.read().movements.length,2);
});
test("V11.5: sin deudas, el abono no se descuenta ni se promete como amortización",()=>{
 const sample=seed();sample.debts=[];
 const e=boot(sample),f=forecast(e),s=e.w.oneScenarioEvaluate(f,{monthlyDebtCRC:10000});
 almost(s.extraDebt,0);almost(s.difference,0);
 assert(s.warnings.some(x=>x.includes("No hay saldo de deuda activo")));
});
test("V11.5: escenario conjunto combina efectos sin doble conteo",()=>{
 const e=boot(),f=forecast(e,60);
 const s=e.w.oneScenarioEvaluate(f,{cutPercent:15,monthlySavingsCRC:20000,monthlyDebtCRC:5000});
 almost(s.difference,s.avoided-s.extraSavings-s.extraDebt);
 almost(s.points[30].baseline,e.w.oneFutureForecast(AS_OF,30).balance);
 assert(s.extraSavings>0&&s.extraDebt>0&&s.avoided>0);
 assert(s.points.every((x,i)=>i===0||x.date>=s.points[i-1].date));
});
test("V11.5: UI comparativo es funcional, moneda reversible y Restablecer no guarda",()=>{
 const e=boot(),before=e.raw();
 e.w.oneSetModuleEnabled("future",true);
 e.w.navigate("future");
 const panel=e.q("oneScenarioPanel");panel.open=true;
 const slider=e.q("oneScenarioCut");
 slider.value="20";slider.dispatchEvent(new e.w.Event("input",{bubbles:true}));
 assert.equal(e.q("oneScenarioCutValue").textContent,"20%");
 assert.equal(e.q("oneScenarioReset").disabled,false);
 assert(e.q("oneScenarioChart").querySelectorAll("polyline").length===2);
 const save=e.q("oneScenarioSave");save.value="5100";
 save.dispatchEvent(new e.w.Event("input",{bubbles:true}));
 const currency=e.q("oneScenarioCurrency");currency.value="USD";currency.dispatchEvent(new e.w.Event("change",{bubbles:true}));
 assert.equal(save.value,"10");
 currency.value="CRC";currency.dispatchEvent(new e.w.Event("change",{bubbles:true}));
 assert.equal(save.value,"5100");
 e.q("oneScenarioReset").click();
 assert.equal(slider.value,"0");assert.equal(save.value,"0");
 assert.equal(e.q("oneScenarioReset").disabled,true);
 assert.equal(e.raw(),before);
 assert.deepEqual(e.errors,[]);
});
test("V11.5: intervalos 30, 60 y 90 conservan misma proyección a fechas coincidentes",()=>{
 const e=boot();const rows=[30,60,90].map(d=>e.w.oneScenarioEvaluate(forecast(e,d),{
  cutPercent:10,monthlySavingsCRC:15000,monthlyDebtCRC:3000
 }));
 almost(rows[0].balance,rows[1].points[30].balance);
 almost(rows[0].balance,rows[2].points[30].balance);
 assert(rows.every(x=>x.points.length===x.baseline.days+1));
 assert.deepEqual(e.errors,[]);
});
