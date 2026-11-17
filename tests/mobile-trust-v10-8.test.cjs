"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const main=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
const split=fs.readFileSync("mobile-pilot/public/split-fare.js","utf8");
const pilot=fs.readFileSync("mobile-pilot/desktop.js","utf8");
const key="daniel_finanzas_local_v1";
const isoOffset=days=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
const today=isoOffset(0),historical=isoOffset(-2),older=isoOffset(-3);
const month=historical.slice(0,7),quarter=month.slice(0,4)+"-T"+(Math.floor((+month.slice(5,7)-1)/3)+1);
const entry=(id,type,currency,amount,extra={})=>({
 id,movement:{type,date:historical,currency,amount,description:"Prueba "+type,...extra}
});
async function boot({items,history=[],failAckOnce=false}={}){
 const errors=[],vc=new VirtualConsole();
 vc.on("jsdomError",e=>errors.push(String(e.stack||e)));
 const dom=new JSDOM(html,{url:"https://daniel.example.com/",runScripts:"outside-only",
  pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(obj,k)=>k==="measureText"?()=>({width:80}):()=>{}})};
 w.alert=x=>errors.push("ALERT "+x);w.confirm=()=>true;w.prompt=()=>null;
 w.localStorage.setItem(key,JSON.stringify({
  version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,
  settings:{fx:555,fxBuy:550,fxSell:560,fxDate:today,fxCheckedOn:today,fxSource:"manual",
   displayCurrency:"CRC",fxHistory:history},
  periods:[{key:month+"-Q2",n:2,quarter,budgetMonth:month,fortnight:2,date:historical,
   opening:350000,openingCurrency:"CRC",income:0,otherIncome:0,budgets:{},categoryBudgets:{}}],
  categories:[{id:"cat-income",name:"Ingresos extra",type:"Ingreso",sort:10,active:true,budgetable:true},
   {id:"cat-expense",name:"Alimentación",type:"Gasto",sort:20,active:true,budgetable:true}],
  movements:[],movementSeq:0,movementAudit:[],reserves:[],reserveMovements:[],
  debts:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[],reconciliations:[]
 }));
 w.localStorage.setItem(key+"_iphone_pilot_v1",JSON.stringify({url:"https://pilot.workers.dev",key:"m".repeat(40)}));
 const rows=items.slice();let fail=failAckOnce;
 w.fetch=async(url,opts={})=>{
  const path=new URL(url).pathname;
  if(path==="/api/catalog"&&opts.method==="PUT")return {ok:true,json:async()=>({ok:true})};
  if(path==="/api/inbox"&&opts.method==="GET")return {ok:true,json:async()=>({items:rows.slice()})};
  if(path==="/api/ack"&&opts.method==="POST"){
   if(fail){fail=false;return {ok:false,json:async()=>({error:"Error transitorio"})};}
   const id=JSON.parse(opts.body).id,index=rows.findIndex(x=>x.id===id);
   if(index>=0)rows.splice(index,1);
   return {ok:true,json:async()=>({ok:true})};
  }
  throw Error("Unexpected API "+url);
 };
 w.eval(split+"\n"+main+"\n"+pilot+"\nwindow.__qaV108={data,save};");
 await new Promise(resolve=>setTimeout(resolve,650));
 return {w,rows,errors,read:()=>JSON.parse(w.localStorage.getItem(key)),
  retry:async()=>{w.document.getElementById("oneMobileSync").click();await new Promise(r=>setTimeout(r,180));},
  close:()=>w.close()};
}
test("V10.8: ingreso y gasto USD históricos usan compra y venta de la fecha, no la tasa actual",async()=>{
 const x=await boot({items:[
  entry("v108-income-historical-0001","Ingreso","USD",120,{categoryId:"cat-income"}),
  entry("v108-expense-historical-001","Gasto","USD",19.75,{categoryId:"cat-expense"})
 ],history:[{date:historical,buy:430,sell:450}]});
 try{
  const saved=x.read();
  assert.equal(saved.movements.length,2);
  const income=saved.movements.find(x=>x.type==="Ingreso"),expense=saved.movements.find(x=>x.type==="Gasto");
  assert.equal(income.amount,120);assert.equal(income.currency,"USD");
  assert.equal(income.fxDate,historical);assert.equal(income.fxBuy,430);
  assert.equal(expense.fxDate,historical);assert.equal(expense.fxSell,450);
  assert.notEqual(income.fxBuy,saved.settings.fxBuy);
  assert.equal(x.rows.length,0);
  assert.equal(x.w.document.getElementById("oneMobileIssues").hidden,true);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("V10.8: tasa futura no se usa; se explica la incidencia y reintenta sin duplicar",async()=>{
 const x=await boot({items:[entry("v108-income-needs-fx-00001","Ingreso","USD",120,{categoryId:"cat-income",description:"Regalo de dólares"})]});
 try{
  assert.equal(x.read().movements.length,0);
  assert.equal(x.rows.length,1,"El registro queda pendiente sin confirmarse ante el Worker");
  const panel=x.w.document.getElementById("oneMobileIssues");
  assert.equal(panel.hidden,false);
  assert.match(panel.textContent,/Regalo de dólares/);
  assert.match(panel.textContent,/tipo de cambio histórico/i);
  const fix=panel.querySelector("button");
  assert.match(fix.textContent,/tipo de cambio/i);
  fix.click();
  assert.equal(x.w.document.getElementById("fxDialog").open,true);
  x.w.__qaV108.data.settings.fxHistory.push({date:historical,buy:445,sell:460});
  x.w.__qaV108.save();
  await x.retry();
  assert.equal(x.read().movements.length,1);
  assert.equal(x.read().movements[0].fxDate,historical);
  assert.equal(x.read().movements[0].fxBuy,445);
  assert.equal(x.rows.length,0);
  assert.equal(panel.hidden,true,"Se limpia la incidencia tras importar");
  await x.retry();
  assert.equal(x.read().movements.length,1);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("V10.8: cobro dividido USD usa tasa previa dentro de siete días y lo declara",async()=>{
 const x=await boot({items:[entry("v108-split-prior-rate-00001","Cobro dividido","USD",60,
  {groupName:"Viaje",description:"Cena",splitMode:"equal",selfShares:1,
   participants:[{person:"Mamá",shares:1},{person:"Ana",shares:1}]})
 ],history:[{date:older,buy:470,sell:490}]});
 try{
  const saved=x.read();
  assert.equal(saved.sharedCharges.length,2);
  assert.equal(saved.sharedChargeGroups.length,1);
  assert(saved.sharedCharges.every(c=>c.fxDate===older&&c.fxBuy===470&&c.fxSell===490));
  assert.match(x.w.document.getElementById("oneMobileStatus").textContent,/tasa anterior/i);
  assert.equal(x.rows.length,0);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("V10.8: fallar la confirmación del Worker no duplica el movimiento y se reintenta",async()=>{
 const x=await boot({items:[entry("v108-ack-retry-unique-00001","Gasto","CRC",3500,{categoryId:"cat-expense"})],
  failAckOnce:true});
 try{
  assert.equal(x.read().movements.length,1);
  assert.equal(x.rows.length,1,"Todavía no se confirmó en Cloudflare");
  await x.retry();
  assert.equal(x.read().movements.length,1);
  assert.equal(x.rows.length,0);
  assert.match(x.w.document.getElementById("oneMobileStatus").textContent,/repetido/);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
