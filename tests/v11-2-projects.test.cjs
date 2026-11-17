"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert(script,"Proyecto V11.2 debe incluir script financiero");
function seed(){
 const today=new Date().toISOString().slice(0,10);
 return {version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,
 settings:{fx:495,fxBuy:490,fxSell:500,fxDate:today,fxCheckedOn:today,fxSource:"manual",displayCurrency:"CRC",fxHistory:[]},
 periods:[
 {key:"2026-T4-11-1",quarter:"2026-T4",n:1,budgetMonth:"2026-11",fortnight:1,date:"2026-10-28",categoryBudgets:{},budgets:{},income:0,otherIncome:0},
 {key:"2026-T4-11-2",quarter:"2026-T4",n:2,budgetMonth:"2026-11",fortnight:2,date:"2026-11-14",categoryBudgets:{},budgets:{},income:0,otherIncome:0}
 ],
 categories:[{id:"cat-g",name:"Alimentación",group:"Gastos",type:"Gasto",active:true,budgetable:true,sort:1}],
 movements:[
 {id:"usd-gasto",seq:1,type:"Gasto",date:"2026-11-16",categoryId:"cat-g",category:"Alimentación",amount:500,currency:"USD",fxBuy:490,fxSell:500,fxRef:495,period:"2026-T4-11-2",description:"Hotel"},
 {id:"crc-gasto",seq:2,type:"Gasto",date:"2026-11-16",categoryId:"cat-g",category:"Alimentación",amount:2000,currency:"CRC",fxBuy:490,fxSell:500,fxRef:495,period:"2026-T4-11-2",description:"Taxi"}
 ],movementSeq:2,movementAudit:[],movementTemplates:[],
 reconciliations:[],debts:[],reserves:[],reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[]
 };
}
function boot(){
 const errors=[],vc=new VirtualConsole();vc.on("jsdomError",error=>errors.push(String(error.stack||error)));
 const dom=new JSDOM(html,{url:"https://example.com/",pretendToBeVisual:true,runScripts:"outside-only",virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}})};
 w.HTMLElement.prototype.focus=function(){};
 w.alert=msg=>errors.push("ALERT "+msg);w.confirm=()=>true;w.prompt=()=>null;
 w.fetch=async()=>{throw Error("Offline")};
 const storageKey="daniel_finanzas_local_v1";
 w.localStorage.setItem(storageKey,JSON.stringify(seed()));
 w.eval(script);
 const read=()=>JSON.parse(w.localStorage.getItem(storageKey));
 const elem=id=>w.document.getElementById(id);
 return {w,dom,errors,read,elem};
}
function submit(w,form){
 form.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
}
function createProject(e,name="Viaje",currency="USD",budget=3000){
 const {w,elem,read}=e;
 w.oneSetModuleEnabled("projects",true);
 elem("oneProjectName").value=name;
 elem("oneProjectCurrency").value=currency;
 elem("oneProjectBudget").value=String(budget);
 submit(w,elem("oneProjectForm"));
 return read().projects.find(p=>p.name===name);
}
test("V11.2: habilitación opcional mantiene los tres módulos fijos",()=>{
 const e=boot();
 assert.equal(e.w.oneModuleEnabled("projects"),false);
 assert.equal(e.elem("moduleProjectsToggle").checked,false);
 e.w.oneSetModuleEnabled("projects",true);
 assert.equal(e.w.oneModuleEnabled("projects"),true);
 assert.equal(e.elem("moduleProjectsToggle").checked,true);
 assert.equal(e.elem("view-projects").id,"view-projects");
 assert.equal(e.read().movements.length,2);
 assert.deepEqual(e.errors,[]);
});
test("V11.2: crear proyecto y previsión NO genera movimientos",()=>{
 const e=boot(),p=createProject(e);
 assert(p&&p.id);assert.equal(p.budget,3000);assert.equal(p.currency,"USD");
 const {w,elem,read}=e;
 w.oneProjectOpenBucket();
 elem("oneProjectBucketName").value="Hotel";
 elem("oneProjectBucketBudget").value="1500";
 submit(w,elem("oneProjectBucketForm"));
 assert.equal(read().projects.find(x=>x.id===p.id).buckets.length,1);
 w.oneProjectOpenPlan();
 elem("oneProjectPlanName").value="Traslado previsto";
 elem("oneProjectPlanAmount").value="250";
 submit(w,elem("oneProjectPlanForm"));
 assert.equal(w.oneProjectPending(w.oneProjectById(p.id)),250);
 assert.equal(w.oneProjectSpent(w.oneProjectById(p.id)),0);
 assert.equal(read().movements.length,2);
 assert.equal(read().reconciliations.length,0);
 assert.deepEqual(e.errors,[]);
});
test("V11.2: vincular gasto ya registrado se contabiliza UNA vez, con moneda original",()=>{
 const e=boot(),p=createProject(e,"Viaje", "USD",3000),{w,elem,read}=e;
 elem("oneProjectMovementSelect").value="usd-gasto";
 submit(w,elem("oneProjectLinkForm"));
 assert.equal(read().projectLinks.length,1);
 assert.equal(read().movements.length,2);
 assert.equal(w.oneProjectSpent(w.oneProjectById(p.id)),500);
 assert.equal(read().movements.find(x=>x.id==="usd-gasto").amount,500);
 // No se puede vincular un gasto ya asignado a un segundo proyecto.
 const second=createProject(e,"Otro","CRC",1500000);
 const duplicate=e.w.oneProjectLinkForMovement("usd-gasto");
 assert.equal(duplicate.projectId,p.id);
 assert.notEqual(second.id,p.id);
 assert.equal(read().projectLinks.length,1);
 assert.deepEqual(e.errors,[]);
});
test("V11.2: gasto CRC vinculado a proyecto USD utiliza TC histórico del propio gasto",()=>{
 const e=boot(),p=createProject(e),{w,elem,read}=e;
 elem("oneProjectMovementSelect").value="crc-gasto";
 submit(w,elem("oneProjectLinkForm"));
 assert.equal(w.oneProjectSpent(w.oneProjectById(p.id)),4);
 assert.equal(read().movements.length,2);
 assert.deepEqual(e.errors,[]);
});
test("V11.2: crear gasto desde Movimientos vinculado al proyecto sin asiento doble",()=>{
 const e=boot(),p=createProject(e),{w,elem,read}=e;
 w.m2OpenComposer();
 elem("mProject").value=p.id;elem("mProject").dispatchEvent(new w.Event("change",{bubbles:true}));
 elem("mDate").value="2026-11-16";
 elem("mCategory").value="cat-g";
 elem("mAmount").value="90";
 elem("mCurrency").value="USD";
 elem("mDescription").value="Cena";
 submit(w,elem("movementForm"));
 const saved=read(),actual=saved.movements.find(m=>m.description==="Cena");
 assert(actual,"debe existir gasto real");
 assert.equal(saved.movements.length,3);
 assert.equal(saved.projectLinks.filter(l=>l.movementId===actual.id).length,1);
 assert.equal(saved.projectLinks.find(l=>l.movementId===actual.id).projectId,p.id);
 assert.equal(w.oneProjectSpent(w.oneProjectById(p.id)),90);
 assert.deepEqual(e.errors,[]);
});
test("V11.2: editar importe actualiza proyecto; borrar gasto libera vínculo",()=>{
 const e=boot(),p=createProject(e),{w,elem,read}=e;
 elem("oneProjectMovementSelect").value="usd-gasto";submit(w,elem("oneProjectLinkForm"));
 assert.equal(w.oneProjectSpent(w.oneProjectById(p.id)),500);
 const old=read().movements.find(x=>x.id==="usd-gasto");
 w.m2OpenComposer(old);
 elem("mAmount").value="600";
 submit(w,elem("movementForm"));
 assert.equal(w.oneProjectSpent(w.oneProjectById(p.id)),600);
 assert.equal(read().projectLinks.length,1);
 const button=w.document.createElement("button");button.dataset.deleteMovement="usd-gasto";w.document.body.appendChild(button);button.click();
 assert.equal(read().movements.some(m=>m.id==="usd-gasto"),false);
 assert.equal(read().projectLinks.length,0);
 assert.equal(w.oneProjectSpent(w.oneProjectById(p.id)),0);
 assert.deepEqual(e.errors,[]);
});
test("V11.2: archivar proyecto mantiene gastos y respaldo admite sus vínculos",()=>{
 const e=boot(),p=createProject(e),{w,elem,read}=e;
 elem("oneProjectMovementSelect").value="usd-gasto";submit(w,elem("oneProjectLinkForm"));
 elem("oneProjectArchiveBtn").click();
 const saved=read();
 assert.equal(saved.projects.find(x=>x.id===p.id).status,"archived");
 assert.equal(saved.movements.length,2);
 assert.equal(saved.projectLinks.length,1);
 assert.doesNotThrow(()=>w.restorePrepare(saved));
 w.oneSetModuleEnabled("projects",false);
 assert.equal(read().projectLinks.length,1);
 assert.deepEqual(e.errors,[]);
});
