"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert(script,"Falta script integrado");
const AS_OF="2026-11-17";
function seed(){
  return {version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,
   settings:{fx:500,fxBuy:490,fxSell:510,fxDate:AS_OF,fxCheckedOn:AS_OF,
    fxSource:"manual",fxHistory:[],displayCurrency:"CRC",payDays:{first:14,second:28}},
   periods:[{key:"p1",date:"2026-11-14",budgetMonth:"2026-11",fortnight:2,
    quarter:"2026-T4",n:2,opening:200000,categoryBudgets:{},
    categoryBudgetCurrencies:{},categoryBudgetSources:{},categoryBudgetScheduledDates:{},budgets:{}}],
   categories:[],movements:[],movementSeq:0,movementAudit:[],movementTemplates:[],
   debts:[{id:"loan",name:"Préstamo ejemplo",type:"Préstamo",typeId:"olo-debt-loan",status:"active",
    crc:120000,usd:0,minimum:12000,minimumCurrency:"CRC",rate:"12",
    payDay:"25",balanceAdjustments:[]}],
   reconciliations:[{id:"r1",date:AS_OF,amount:200000,currency:"CRC",fxBuy:490,fxSell:510,
    afterSeq:0,createdAt:AS_OF+"T09:00:00Z",scope:"operating"}],
   reserves:[],reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[],
   projects:[],projectLinks:[],projectPlans:[]
  };
}
function boot(sample=seed()){
 const errors=[],vc=new VirtualConsole();vc.on("jsdomError",e=>errors.push(String(e.stack||e)));
 const dom=new JSDOM(html,{url:"https://example.com/",runScripts:"outside-only",
  pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLElement.prototype.focus=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){
  return new Proxy({},{get:(_,key)=>key==="measureText"?()=>({width:80}):()=>{}});
 };
 w.alert=message=>errors.push("ALERT: "+message);w.confirm=()=>true;w.prompt=()=>null;
 w.fetch=async()=>{throw Error("Sin red")};
 w.localStorage.setItem("daniel_finanzas_local_v1",JSON.stringify(sample));
 w.eval(script);
 return {w,errors,read:()=>w.localStorage.getItem("daniel_finanzas_local_v1"),
  get:id=>w.document.getElementById(id)};
}
test("V11.7: sin interés, calcula abonos únicos y mensuales sin simular ahorro inexistente",()=>{
 const {w}=boot(),r=w.oneDebtAmortize({balance:1000,minimum:100,annualRate:0,once:200,monthlyExtra:50});
 assert.equal(r.baseline.months,10);assert.equal(r.accelerated.months,6);
 assert.equal(r.monthsSaved,4);assert.equal(r.interestSaved,0);
 assert.equal(r.baseline.interest,0);assert.equal(r.accelerated.total+r.upfront,1000);
});
test("V11.7: con interés positivo reduce plazo e intereses, no modifica pagos reales",()=>{
 const e=boot(),before=e.read();
 const d=e.w.activeDebts()[0],result=e.w.oneDebtSimulate(d,{onceCRC:12000,monthlyCRC:2000},AS_OF);
 assert.equal(result.valid,true);
 assert.equal(result.projection.comparable,true);
 assert(result.projection.monthsSaved>0);
 assert(result.projection.interestSaved>0);
 assert(result.acceleratedDate<result.baselineDate);
 assert.equal(e.read(),before);assert.deepEqual(e.errors,[]);
});
test("V11.7: cuota que no cubre intereses no genera ahorros ficticios",()=>{
 const {w}=boot();
 const bad=w.oneDebtAmortize({balance:100000,minimum:500,annualRate:12,monthlyExtra:0});
 assert.equal(bad.baseline.status,"insufficient");assert.equal(bad.comparable,false);
 assert.equal(bad.interestSaved,null);assert.equal(bad.monthsSaved,null);
 const rescued=w.oneDebtAmortize({balance:100000,minimum:500,annualRate:12,monthlyExtra:2000});
 assert.equal(rescued.baseline.status,"insufficient");
 assert.equal(rescued.accelerated.status,"paid");assert.equal(rescued.comparable,false);
});
test("V11.7: datos incompletos o monedas mixtas bloquean la promesa de ahorro",()=>{
 const e=boot(),d=e.w.activeDebts()[0],base=e.read();
 d.rate="";assert.equal(e.w.oneDebtSimulate(d).valid,false);
 d.rate="0";assert.equal(e.w.oneDebtSimulate(d).valid,true);
 d.minimum=0;assert.equal(e.w.oneDebtSimulate(d).valid,false);
 d.minimum=12000;d.usd=100;assert.equal(e.w.oneDebtSimulate(d).valid,false);
 assert.equal(e.read(),base);
 assert.throws(()=>e.w.oneDebtAmortize({balance:1000,minimum:100,annualRate:-1}));
});
test("V11.7: cuotas USD usan tasa de venta para mostrar CRC sin alterar moneda original",()=>{
 const s=seed(),d=s.debts[0];d.crc=0;d.usd=1000;d.minimum=100;d.minimumCurrency="USD";d.rate="8";
 const e=boot(s),before=e.read(),out=e.w.oneDebtSimulate(e.w.activeDebts()[0],{onceCRC:5100},AS_OF);
 assert.equal(out.valid,true);
 assert.equal(out.balance,510000);assert.equal(out.minimum,51000);
 assert(out.warnings.some(x=>x.includes("tipo de cambio")));
 assert.equal(e.read(),before);
});
test("V11.7: UI navegable desde Deudas y escenario no genera movimientos ni se respalda",()=>{
 const e=boot(),before=e.read();
 e.w.oneSetModuleEnabled("debts",true);
 e.w.navigate("debts");
 const button=e.w.document.querySelector('[data-simulate-debt="loan"]');
 assert(button,"Debe haber acción Simular en deuda activa");
 button.click();
 assert.equal(e.get("view-future").classList.contains("active"),true);
 assert.equal(e.get("oneDebtSimulatorPanel").open,true);
 const once=e.get("oneDebtSimOnce"),monthly=e.get("oneDebtSimMonthly");
 once.value="12000";once.dispatchEvent(new e.w.Event("input",{bubbles:true}));
 monthly.value="2000";monthly.dispatchEvent(new e.w.Event("input",{bubbles:true}));
 assert(e.get("oneDebtSimSummary").textContent.includes("Ahorro posible"));
 assert(e.get("oneDebtSimSchedule").querySelector("table"));
 const currency=e.get("oneDebtSimCurrency");currency.value="USD";
 currency.dispatchEvent(new e.w.Event("change",{bubbles:true}));
 assert.equal(once.value,String(Number((12000/510).toFixed(2))));
 currency.value="CRC";currency.dispatchEvent(new e.w.Event("change",{bubbles:true}));
 assert.equal(once.value,"12000");
 e.get("oneDebtSimReset").click();
 assert.equal(once.value,"0");assert.equal(monthly.value,"0");
 assert.equal(JSON.parse(e.read()).movements.length,0);
 assert.equal(e.read(),before);
 assert.deepEqual(e.errors,[]);
});
