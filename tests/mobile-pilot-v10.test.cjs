"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
const pilot=fs.readFileSync("mobile-pilot/desktop.js","utf8");
const split=fs.readFileSync("mobile-pilot/public/split-fare.js","utf8");
assert(html.includes('mobile-pilot/desktop.js'),"Debe cargar el piloto opcional");
const today=new Date().toISOString().slice(0,10);
const month=today.slice(0,7),quarter=month.slice(0,4)+"-T"+(Math.floor((Number(month.slice(5,7))-1)/3)+1);
const seed={
 version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,
 settings:{fx:450,fxBuy:444,fxSell:456,fxDate:today,fxCheckedOn:today,fxSource:"manual",displayCurrency:"CRC"},
 periods:[{key:month+"-Q2",quarter,n:2,budgetMonth:month,fortnight:2,date:today,
  opening:300000,openingCurrency:"CRC",income:0,otherIncome:0,budgets:{},categoryBudgets:{}}],
 movementSeq:0,movements:[],movementAudit:[],reconciliations:[],
 categories:[
  {id:"cat-g",name:"Supermercado",type:"Gasto",sort:10,active:true,budgetable:true,group:"Gastos"},
  {id:"cat-i",name:"Otros ingresos",type:"Ingreso",sort:20,active:true,budgetable:true,group:"Ingresos"},
  {id:"cat-d",name:"Tarjetas",type:"Pago deuda",sort:30,active:true,budgetable:true,group:"Deudas"}
 ],
 debts:[{id:"debt-1",name:"Tarjeta prueba",type:"Tarjeta",status:"active",minimum:1000,minimumCurrency:"CRC",usd:0,crc:200000,payDay:"30"}],
 reserves:[{id:"goal-1",name:"Vacaciones",type:"goal",status:"active",openingDate:today,openingAmount:0,openingCurrency:"CRC",target:80000,targetCurrency:"CRC",budgetCategoryId:""}],
 reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[]
};
const messages=[];
const vc=new VirtualConsole();vc.on("jsdomError",e=>messages.push(String(e.stack||e)));
const dom=new JSDOM(html,{url:"https://daniel.example.com/",runScripts:"outside-only",pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};
w.HTMLElement.prototype.scrollIntoView=function(){};
w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(o,key)=>key==="measureText"?()=>({width:80}):()=>{}})};
w.alert=message=>messages.push("ALERT "+message);
w.confirm=()=>true;w.prompt=()=>null;
const key=script.match(/const STORAGE_KEY = "([^"]+)"/)?.[1];assert(key);
w.localStorage.setItem(key,JSON.stringify(seed));
w.localStorage.setItem(key+"_iphone_pilot_v1",JSON.stringify({url:"https://pilot.workers.dev",key:"secret".repeat(8)}));
const create=(id,movement)=>({id,movement});
const rows=[
 create("mobile-entry-gasto-0000000001",{type:"Gasto",date:today,currency:"CRC",amount:18500,categoryId:"cat-g",description:"Supermercado"}),
 create("mobile-entry-ingreso-00000002",{type:"Ingreso",date:today,currency:"CRC",amount:12500,categoryId:"cat-i",description:"Regalo"}),
 create("mobile-entry-deuda-0000000003",{type:"Pago deuda",date:today,currency:"CRC",amount:1000,debtId:"debt-1"}),
 create("mobile-entry-cobro-0000000004",{type:"Cobro",date:today,currency:"CRC",amount:15000,person:"Ana",description:"Compra compartida"}),
 create("mobile-entry-ahorro-000000005",{type:"Aporte",date:today,currency:"CRC",amount:5000,reserveId:"goal-1"}),
 create("mobile-entry-cobro-usd-000008",{type:"Cobro",date:today,currency:"USD",amount:72.5,person:"Luis",description:"Pasaje"}),
 create("mobile-entry-split-hotel-000009",{type:"Cobro dividido",date:today,currency:"USD",amount:328,
   groupName:"Hotel con amigos",description:"Reserva",splitMode:"equal",selfShares:1,selfAmount:82,totalShares:4,
   dueDate:"",participants:[{person:"Charlie",shares:2,amount:164},{person:"Ana",shares:1,amount:82}]}),
 create("mobile-entry-gasto-usd-00007",{type:"Gasto",date:today,currency:"USD",amount:19.75,categoryId:"cat-g",description:"Compra USD"}),
 create("mobile-entry-ingreso-usd-0008",{type:"Ingreso",date:today,currency:"USD",amount:120,categoryId:"cat-i",description:"Dólares recibidos"}),
 create("mobile-entry-mama-grupo-0009",{type:"Cobro",date:today,currency:"CRC",amount:8500,person:"Mamá",groupName:"Mamá",description:"Supermercado"}),
 create("mobile-entry-invalido-000006",{type:"Gasto",date:today,currency:"CRC",amount:4200,categoryId:"categoria-archivada"})
];
let catalog=null,fetchCalls=0;
w.fetch=async(url,opts={})=>{
 const path=new URL(url).pathname;fetchCalls++;
 if(path==="/api/catalog"&&opts.method==="PUT"){
  catalog=JSON.parse(opts.body);return {ok:true,json:async()=>({ok:true})};
 }
 if(path==="/api/inbox"&&opts.method==="GET")return {ok:true,json:async()=>({items:rows.slice()})};
 if(path==="/api/ack"&&opts.method==="POST"){
  const payload=JSON.parse(opts.body);
  const at=rows.findIndex(x=>x.id===payload.id);
  if(at>=0)rows.splice(at,1);
  return {ok:true,json:async()=>({ok:true})};
 }
 throw Error("Unexpected fetch "+url);
};
w.eval(split+"\n"+script+"\n"+pilot);
assert(w.document.getElementById("oneMobilePilot"),"Se muestra conexión en Movimientos, sin nuevo módulo");
(async()=>{
 await new Promise(resolve=>setTimeout(resolve,650));
 let saved=JSON.parse(w.localStorage.getItem(key));
 assert.equal(saved.movements.length,5);
 assert.equal(saved.reserveMovements.length,1);
 assert.equal(saved.sharedCharges.length,5);
 assert.equal(saved.movementSeq,5);
 assert.equal(saved.movements.find(m=>m.type==="Gasto").amount,18500);
 assert.equal(saved.movements.find(m=>m.type==="Ingreso").amount,12500);
 assert.equal(saved.movements.find(m=>m.type==="Pago deuda").debtId,"debt-1");
 assert.equal(saved.sharedChargeGroups.length,2);
 assert.equal(saved.sharedChargeGroups[0].name,"Hotel con amigos");
 assert.equal(saved.sharedChargeGroups[0].splitFare.totalAmount,328);
 const shares=saved.sharedCharges.filter(c=>c.mobilePilotId==="mobile-entry-split-hotel-000009");
 assert.equal(shares.length,2);
 assert.equal(shares.find(c=>c.person==="Charlie").amount,164);
 assert.equal(shares.find(c=>c.person==="Ana").amount,82);
 assert.equal(shares.every(c=>c.groupId===saved.sharedChargeGroups[0].id),true);
 assert.equal(saved.sharedCharges.find(c=>c.person==="Luis").currency,"USD");
 assert.equal(saved.sharedCharges[0].person,"Ana");
 const incomeUsd=saved.movements.find(m=>m.description==="Dólares recibidos");
 const expenseUsd=saved.movements.find(m=>m.description==="Compra USD");
 assert.equal(incomeUsd.amount,120);assert.equal(incomeUsd.currency,"USD");
 assert.equal(incomeUsd.fxBuy,444);assert.equal(incomeUsd.fxSell,456);
 assert.equal(incomeUsd.amount*incomeUsd.fxBuy,53280);
 assert.equal(expenseUsd.amount,19.75);assert.equal(expenseUsd.currency,"USD");
 assert.equal(expenseUsd.amount*expenseUsd.fxSell,9006);
 const mama=saved.sharedChargeGroups.find(g=>g.name==="Mamá");
 const mamaCharge=saved.sharedCharges.find(c=>c.person==="Mamá");
 assert(mama);assert(mamaCharge);assert.equal(mamaCharge.groupId,mama.id);
 assert.equal(mama.mobilePilotId,"mobile-entry-mama-grupo-0009");
 assert.equal(saved.sharedCharges[0].status,"pending");
 assert.equal(saved.reserveMovements[0].type,"Aporte");
 assert.equal(saved.reserveMovements[0].budgetCategoryId,"");
 assert.equal(rows.length,1,"El movimiento inválido debe seguir pendiente, sin perderse");
 assert.equal(rows[0].movement.categoryId,"categoria-archivada");
 assert(catalog.categories.some(c=>c.id==="cat-g"));
 assert(catalog.debts.some(d=>d.id==="debt-1"));
 assert(catalog.goals.some(g=>g.id==="goal-1"));
 // Releer la bandeja no debe crear ninguna operación ni borrar historial.
 w.document.getElementById("oneMobileSync").click();
 await new Promise(resolve=>setTimeout(resolve,150));
 saved=JSON.parse(w.localStorage.getItem(key));
 assert.equal(saved.movements.length,5);
 assert.equal(saved.reserveMovements.length,1);
 assert.equal(saved.sharedCharges.length,5);
 assert.equal(saved.sharedChargeGroups.length,2);
 assert.equal(saved.movementAudit.filter(x=>x.action==="create").length,5);
 assert(fetchCalls>=4);
 assert.deepEqual(messages,[]);
 dom.window.close();
 console.log("V10 Mobile: 5 operaciones, persistencia, confirmación, integridad y reintentos OK");
})().catch(e=>{dom.window.close();console.error(e);process.exitCode=1;});
