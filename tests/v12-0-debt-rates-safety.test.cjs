"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),{JSDOM}=require("jsdom");
const html=fs.readFileSync("index.html","utf8"),js=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];assert(js);
const card=(extra={})=>({id:"card-v12",type:"Tarjeta",typeId:"olo-debt-card",name:"Tarjeta histórica",crc:100000,usd:0,minimum:15000,minimumCurrency:"CRC",status:"active",payDay:"20",rate:"25",...extra});
function boot(debts=[]){
 const dom=new JSDOM(html,{url:"https://example.com/",runScripts:"outside-only",pretendToBeVisual:true}),w=dom.window,alerts=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}})};
 w.alert=s=>alerts.push(String(s));w.confirm=()=>true;w.prompt=()=>null;w.fetch=async()=>{throw Error("offline")};
 w.localStorage.setItem("daniel_finanzas_local_v1",JSON.stringify({version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,
 settings:{fx:500,fxBuy:490,fxSell:510,fxDate:"2026-11-17",fxCheckedOn:new Date().toISOString().slice(0,10),displayCurrency:"CRC"},
 periods:[{key:"p1",date:"2026-11-14",budgetMonth:"2026-11",fortnight:2,quarter:"2026-T4",n:2,opening:1000000,categoryBudgets:{},budgets:{}}],
 movements:[],categories:[],debts,reconciliations:[],reserves:[],reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[],projects:[],projectLinks:[],projectPlans:[]}));
 w.eval(js);return {w,alerts,get:id=>w.document.getElementById(id),read:()=>JSON.parse(w.localStorage.getItem("daniel_finanzas_local_v1"))};
}
test("V12: campos independientes solo en tarjetas",()=>{
 const {w,get}=boot();w.openDebt();
 assert.equal(get("dRateCRC").closest("[data-debt-fields]").hidden,false);
 assert.equal(get("dRateUSD").closest("[data-debt-fields]").hidden,false);
 assert.equal(get("dRate").closest("[data-debt-fields]").hidden,true);
 get("dType").value="olo-debt-loan";w.oneDebtFormUpdate();
 assert.equal(get("dRateCRC").closest("[data-debt-fields]").hidden,true);
 assert.equal(get("dRate").closest("[data-debt-fields]").hidden,false);
});
test("V12: tasas históricas se aplican solo a su moneda real",()=>{
 const {w}=boot([card()]);assert.equal(w.oneDebtCurrencyRate(w.activeDebts()[0],"CRC"),25);assert.equal(w.oneDebtCurrencyRate(w.activeDebts()[0],"USD"),null);
 const {w:usd}=boot([card({crc:0,usd:1000,minimumCurrency:"USD"})]);
 assert.equal(usd.oneDebtCurrencyRate(usd.activeDebts()[0],"USD"),25);
 assert.equal(usd.oneDebtCurrencyRate(usd.activeDebts()[0],"CRC"),null);
 const {w:mixed}=boot([card({usd:1000})]);
 assert.equal(mixed.oneDebtCurrencyRate(mixed.activeDebts()[0],"CRC"),null);
 assert.equal(mixed.oneDebtCurrencyRate(mixed.activeDebts()[0],"USD"),null);
 assert.equal(mixed.oneDebtSimulate(mixed.activeDebts()[0]).valid,false);
});
test("V12: guardar CRC y USD sin reescribir la tasa histórica",()=>{
 const {w,alerts,get,read}=boot([card()]);w.openDebt(w.activeDebts()[0]);
 get("dRateCRC").value="29,75";get("dRateUSD").value="19.5";
 get("debtForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
 assert.deepEqual(alerts,[]);
 const saved=read().debts[0];assert.equal(saved.rateCRC,"29.75");assert.equal(saved.rateUSD,"19.5");assert.equal(saved.rate,"25");
 assert.equal(w.oneDebtSimulate(w.activeDebts()[0]).rate,29.75);
 w.openDebt(w.activeDebts()[0]);get("dRateUSD").value="299";
 get("debtForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
 assert(alerts.some(s=>s.includes("200%")));assert.equal(read().debts[0].rateUSD,"19.5");
});
test("V12: simulador usa tasa USD no CRC",()=>{
 const {w}=boot([card({crc:0,usd:1000,minimum:100,minimumCurrency:"USD",rateCRC:"35",rateUSD:"9"})]);
 assert.equal(w.oneDebtSimulate(w.activeDebts()[0]).rate,9);
});
test("V12: CSV no ejecuta textos con apariencia de fórmulas",()=>{
 const {w}=boot();
 for(const text of ["=1+1","+SUM(1,1)","-2+3","@X","  =3","\t+3"])assert(/^["']/.test(w.csvEscape(text)),text);
 assert.equal(w.csvEscape(-100),"-100");
 assert.equal(w.csvEscape("Alimentación"),"Alimentación");
});
test("V12: IDs de deudas no crean atributos de eventos",()=>{
 const d=card({id:'x" onclick="alert(1)'}),{w}=boot([d]);
 w.oneSetModuleEnabled("debts",true);w.renderDebts();
 const button=w.document.querySelector("#debtList [data-pay-debt]");
 assert(button);assert.equal(button.dataset.payDebt,d.id);assert.equal(button.hasAttribute("onclick"),false);
});
