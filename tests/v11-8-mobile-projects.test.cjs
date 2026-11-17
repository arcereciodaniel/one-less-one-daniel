"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const desktopHtml=fs.readFileSync("index.html","utf8"),
 desktopScript=desktopHtml.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1],
 pilot=fs.readFileSync("mobile-pilot/desktop.js","utf8"),
 split=fs.readFileSync("mobile-pilot/public/split-fare.js","utf8"),
 phoneHtml=fs.readFileSync("mobile-pilot/public/index.html","utf8"),
 phoneScript=fs.readFileSync("mobile-pilot/public/app.js","utf8");
const today=new Date().toISOString().slice(0,10);
const month=today.slice(0,7),quarter=month.slice(0,4)+"-T"+(Math.floor((Number(month.slice(5,7))-1)/3)+1);
const PROJECT="trip-v11-8-japan-2026",BUCKET="trip-v11-8-hotels",ARCHIVED="trip-v11-8-archived";
function sample(){
 return {version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,
 settings:{fx:500,fxBuy:490,fxSell:510,fxDate:today,fxCheckedOn:today,fxSource:"manual",displayCurrency:"CRC"},
 periods:[{key:month+"-Q2",quarter,n:2,budgetMonth:month,fortnight:2,date:today,
  opening:500000,openingCurrency:"CRC",income:0,otherIncome:0,budgets:{},categoryBudgets:{}}],
 movementSeq:0,movements:[],movementAudit:[],reconciliations:[],
 categories:[
  {id:"cat-g",name:"Transporte",type:"Gasto",sort:10,active:true,budgetable:true,group:"Viajes"},
  {id:"cat-i",name:"Ingreso",type:"Ingreso",sort:20,active:true,budgetable:true,group:"Ingresos"}],
 debts:[],reserves:[],reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[],
 projects:[
  {id:PROJECT,name:"Viaje a Japón",currency:"CRC",budget:600000,status:"active",goalId:"no-publicar",
   notes:"Privado",buckets:[{id:BUCKET,name:"Hoteles",budget:300000}]},
  {id:ARCHIVED,name:"Viaje anterior",currency:"CRC",budget:40000,status:"archived",buckets:[]}],
 projectLinks:[],projectPlans:[]
 };
}
function createWindow(html){
 const errors=[],virtualConsole=new VirtualConsole();
 virtualConsole.on("jsdomError",e=>errors.push(String(e.stack||e)));
 const dom=new JSDOM(html,{url:"https://daniel.example.com/",runScripts:"outside-only",
  pretendToBeVisual:true,virtualConsole});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{
  get:(_,name)=>name==="measureText"?()=>({width:80}):()=>{}
 })};
 w.alert=e=>errors.push("ALERT "+e);w.confirm=()=>true;w.prompt=()=>null;
 return {w,dom,errors,q:id=>w.document.getElementById(id),close:()=>dom.window.close()};
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test("V11.8: desktop importación atómica, enlace real, USD, reintentos y proyectos archivados",async()=>{
 const e=createWindow(desktopHtml),w=e.w,data=sample(),key="daniel_finanzas_local_v1";
 w.localStorage.setItem(key,JSON.stringify(data));
 w.localStorage.setItem(key+"_iphone_pilot_v1",JSON.stringify({url:"https://pilot.workers.dev",key:"s".repeat(40)}));
 const entries=[
  {id:"iphone-project-000000000001",movement:{type:"Gasto",date:today,currency:"CRC",amount:25000,
   categoryId:"cat-g",description:"Tren",projectId:PROJECT,projectBucketId:BUCKET}},
  {id:"iphone-project-000000000002",movement:{type:"Gasto",date:today,currency:"USD",amount:20,
   categoryId:"cat-g",description:"Taxi",projectId:PROJECT}},
  {id:"iphone-project-000000000003",movement:{type:"Gasto",date:today,currency:"CRC",amount:5000,
   categoryId:"cat-g",description:"Compra cotidiana"}},
  {id:"iphone-project-000000000004",movement:{type:"Gasto",date:today,currency:"CRC",amount:7000,
   categoryId:"cat-g",description:"Proyecto archivado",projectId:ARCHIVED}},
  {id:"iphone-project-000000000005",movement:{type:"Gasto",date:today,currency:"CRC",amount:3000,
   categoryId:"cat-g",description:"Concepto inexistente",projectId:PROJECT,projectBucketId:"unknown-bucket-00001"}}
 ];
 let published=null,acks=0;
 w.fetch=async(url,opt={})=>{
  const path=new URL(url).pathname;
  if(path==="/api/catalog"&&opt.method==="PUT"){
   published=JSON.parse(opt.body);return {ok:true,json:async()=>({ok:true})};
  }
  if(path==="/api/inbox"&&opt.method==="GET")return {ok:true,json:async()=>({items:[...entries]})};
  if(path==="/api/ack"&&opt.method==="POST"){
   acks++;const id=JSON.parse(opt.body).id,idx=entries.findIndex(x=>x.id===id);
   if(idx>=0)entries.splice(idx,1);
   return {ok:true,json:async()=>({ok:true})};
  }
  throw Error("Unexpected fetch "+url);
 };
 try{
  w.eval(split+"\n"+desktopScript+"\n"+pilot);
  e.q("oneMobileSync").click();await sleep(200);
  const saved=JSON.parse(w.localStorage.getItem(key));
  assert.equal(saved.movements.length,3);
  assert.equal(saved.projectLinks.length,2);
  assert.equal(saved.movementAudit.filter(x=>x.action==="create").length,3);
  const link=saved.projectLinks.find(x=>x.movementId==="iphone-project-000000000001");
  assert(link);assert.equal(link.projectId,PROJECT);assert.equal(link.bucketId,BUCKET);
  const linkUsd=saved.projectLinks.find(x=>x.movementId==="iphone-project-000000000002");
  assert(linkUsd);assert.equal(linkUsd.projectId,PROJECT);assert.equal(linkUsd.bucketId,"");
  assert.equal(saved.movements.find(x=>x.mobilePilotId===linkUsd.movementId).fxSell,510);
  assert.equal(saved.projectLinks.some(l=>l.movementId==="iphone-project-000000000003"),false);
  assert.equal(entries.length,2,"Archivar un proyecto o eliminar concepto deja registro pendiente");
  assert.equal(acks,3);
  assert(e.q("oneMobileIssues").hidden===false);
  assert(e.q("oneMobileIssues").querySelector('[data-mobile-fix="projects"]'));
  assert.deepEqual(published.projects.map(x=>x.id),[PROJECT]);
  const info=JSON.stringify(published.projects);
  for(const sensitive of ["600000","300000","no-publicar","Privado","budget","currency"])
   assert(!info.includes(sensitive),"El catálogo filtró dato privado "+sensitive);
  assert.equal(published.projects[0].buckets[0].name,"Hoteles");
  e.q("oneMobileSync").click();await sleep(100);
  const again=JSON.parse(w.localStorage.getItem(key));
  assert.equal(again.movements.length,3);
  assert.equal(again.projectLinks.length,2);
  assert.equal(again.movementAudit.filter(x=>x.action==="create").length,3);
  assert.equal(acks,3);
  assert.deepEqual(e.errors,[]);
 }finally{e.close()}
});
test("V11.8: formulario iPhone muestra Proyectos solo en Gasto y envía el concepto elegido",async()=>{
 const e=createWindow(phoneHtml),w=e.w,submissions=[];
 Object.defineProperty(w.crypto,"randomUUID",{configurable:true,value:()=>"iphone-project-000000000099"});
 w.localStorage.setItem("one_one_mobile_v1_key","m".repeat(40));
 const projects=[{id:PROJECT,name:"Viaje a Japón",buckets:[{id:BUCKET,name:"Hoteles"}]}];
 w.fetch=async(url,opt={})=>{
  const path=new URL(url,w.location.href).pathname;
  if(path==="/api/catalog")return {ok:true,json:async()=>({catalog:{
   categories:[{id:"cat-g",name:"Transporte",type:"Gasto"},{id:"cat-i",name:"Ingreso",type:"Ingreso"}],
   debts:[],goals:[],groups:[],projects}})};
  if(path==="/api/inbox"){
   const payload=JSON.parse(opt.body);submissions.push(payload);
   return {ok:true,json:async()=>({received:true,id:payload.id})};
  }
  throw Error("unexpected "+url);
 };
 try{
  w.eval(split+"\n"+phoneScript);
  await sleep(30);
  assert.equal(e.q("projectField").hidden,false);
  assert.equal(e.q("projectBucketField").hidden,true);
  e.q("projectId").value=PROJECT;
  e.q("projectId").dispatchEvent(new w.Event("change",{bubbles:true}));
  assert.equal(e.q("projectBucketField").hidden,false);
  e.q("projectBucketId").value=BUCKET;
  e.q("categoryId").value="cat-g";
  e.q("date").value=today;e.q("amount").value="127";
  e.q("entryForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  await sleep(40);
  assert.equal(submissions.length,1);
  assert.equal(submissions[0].movement.projectId,PROJECT);
  assert.equal(submissions[0].movement.projectBucketId,BUCKET);
  assert.equal(submissions[0].movement.amount,127);
  assert.equal(e.q("projectId").value,"");
  e.q("entrySuccessClose").click();
  e.q("entryForm").querySelector("#description").value="Ingresos del mes";
  w.document.querySelector('[data-type="Ingreso"]').click();
  assert.equal(e.q("projectField").hidden,true);
  assert.equal(e.q("projectBucketField").hidden,true);
  e.q("categoryId").value="cat-i";e.q("amount").value="200";
  e.q("entryForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  await sleep(30);
  assert.equal(submissions.length,2);
  assert.equal(submissions[1].movement.type,"Ingreso");
  assert.equal(Object.hasOwn(submissions[1].movement,"projectId"),false);
  assert.deepEqual(e.errors,[]);
 }finally{e.close()}
});
