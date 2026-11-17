"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert(script,"El módulo financiero debe estar integrado");
function seed(){
 const now=new Date().toISOString().slice(0,10);
 return {version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,
 settings:{fx:495,fxBuy:490,fxSell:500,fxDate:now,fxCheckedOn:now,fxSource:"manual",fxHistory:[],displayCurrency:"CRC"},
 periods:[
 {key:"p1",quarter:"2026-T4",n:1,budgetMonth:"2026-11",fortnight:1,date:"2026-10-28",budgets:{},categoryBudgets:{},income:0},
 {key:"p2",quarter:"2026-T4",n:2,budgetMonth:"2026-11",fortnight:2,date:"2026-11-14",budgets:{},categoryBudgets:{},income:0}
 ],
 categories:[{id:"cat-g",name:"Compras",group:"Gastos",type:"Gasto",active:true,budgetable:true,sort:1}],
 movements:[{id:"gasto1",seq:1,type:"Gasto",date:"2026-11-16",categoryId:"cat-g",category:"Compras",amount:2000,currency:"CRC",fxBuy:490,fxSell:500,fxRef:495,period:"p2",description:"Hotel"}],movementSeq:1,movementAudit:[],movementTemplates:[],
 debts:[],reconciliations:[],
 reserves:[{id:"goal1",name:"Ahorro Japón",type:"goal",status:"active",openingDate:"2026-01-01",
    openingAmount:100000,openingCurrency:"CRC",target:250000,targetCurrency:"CRC"}],
 reserveMovements:[],
 sharedChargeGroups:[{id:"group1",name:"Gastos compartidos Japón",person:"Ana",status:"active"}],
 sharedCharges:[
 {id:"charge1",groupId:"group1",person:"Ana",date:"2026-11-16",amount:120000,currency:"CRC",
   payments:[{id:"pay1",date:"2026-11-16",amount:40000,fxBuy:490,fxSell:500,fxRef:495}],status:"pending"},
 {id:"charge2",groupId:"group1",person:"Juan",date:"2026-11-16",amount:20000,currency:"CRC",payments:[],status:"pending"}
 ],receivableRecurring:[],projects:[],projectLinks:[],projectPlans:[]
 };
}
function boot(custom=seed()){
 const vc=new VirtualConsole(),errors=[];
 vc.on("jsdomError",e=>errors.push("JSDOM: "+String(e.stack||e)));
 const dom=new JSDOM(html,{url:"https://example.com/",runScripts:"outside-only",pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLElement.prototype.focus=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(_,name)=>name==="measureText"?()=>({width:80}):()=>{}})};
 w.alert=msg=>errors.push("ALERT: "+String(msg));w.confirm=()=>true;w.prompt=()=>null;
 w.fetch=async()=>{throw Error("Offline")};
 w.localStorage.setItem("daniel_finanzas_local_v1",JSON.stringify(custom));
 w.eval(script);
 return {w,errors,elem:id=>w.document.getElementById(id),
  read:()=>JSON.parse(w.localStorage.getItem("daniel_finanzas_local_v1"))};
}
function submit(w,form){form.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));}
function create(e,name="Viaje Japón",goalId="goal1",groupId="group1"){
 e.w.oneSetModuleEnabled("projects",true);
 e.w.oneProjectOpen();
 e.elem("oneProjectName").value=name;
 e.elem("oneProjectBudget").value="300000";
 e.elem("oneProjectCurrency").value="CRC";
 e.elem("oneProjectGoal").value=goalId;
 e.elem("oneProjectCobroGroup").value=groupId;
 submit(e.w,e.elem("oneProjectForm"));
 return e.read().projects.find(p=>p.name===name);
}
test("V11.4: proyectos V11.2 heredados cargan sin vínculos ni cambios contables",()=>{
 const raw=seed();raw.projects=[{id:"old",name:"Anterior",currency:"CRC",budget:30000,status:"active",buckets:[]}];
 const e=boot(raw),p=e.w.oneProjectById("old");
 assert.equal(p.goalId,"");
 assert.equal(p.cobroGroupId,"");
 assert.equal(e.w.oneProjectSpent(p),0);
 assert.equal(e.read().movements.length,1);
 assert.equal(e.read().sharedCharges.length,2);
 assert.deepEqual(e.errors,[]);
});
test("V11.4: enlazar meta y grupo no registra ningún movimiento, aporte ni abono",()=>{
 const e=boot(),before=e.read(),balance=e.w.actualBalanceAt("2026-11-17");
 const p=create(e);
 assert(p&&p.goalId==="goal1"&&p.cobroGroupId==="group1");
 const after=e.read();
 assert.equal(after.movements.length,before.movements.length);
 assert.equal(after.movements[0].id,before.movements[0].id);
 assert.equal(after.movements[0].amount,before.movements[0].amount);
 assert.equal(after.movements[0].currency,before.movements[0].currency);
 assert.equal(after.reserves.length,before.reserves.length);
 assert.equal(after.reserves[0].openingAmount,before.reserves[0].openingAmount);
 assert.equal(after.reserves[0].target,before.reserves[0].target);
 assert.equal(after.reserveMovements.length,before.reserveMovements.length);
 assert.equal(after.sharedCharges.length,before.sharedCharges.length);
 assert.equal(after.sharedCharges[0].amount,before.sharedCharges[0].amount);
 assert.equal(after.sharedCharges[0].payments[0].amount,before.sharedCharges[0].payments[0].amount);
 assert.equal(after.sharedChargeGroups.length,before.sharedChargeGroups.length);
 assert.equal(after.sharedChargeGroups[0].id,before.sharedChargeGroups[0].id);
 assert.equal(e.w.actualBalanceAt("2026-11-17"),balance);
 const summary=e.w.oneProjectCobroSummary(e.w.oneProjectById(p.id));
 assert.equal(summary.pendingCount,2);
 assert.equal(summary.pendingCRC,100000);
 assert.equal(summary.receivedCRC,40000);
 assert.equal(e.w.oneProjectSpent(e.w.oneProjectById(p.id)),0);
 const text=e.elem("oneProjectConnections").textContent;
 assert(text.includes("Ahorro Japón")&&text.includes("Gastos compartidos Japón"));
 assert(text.includes("Pendiente")&&text.includes("Recuperado"));
 assert.deepEqual(e.errors,[]);
});
test("V11.4: una misma meta y grupo no se reasignan a un segundo proyecto",()=>{
 const e=boot(),p=create(e);
 assert(p);
 e.w.oneProjectOpen();
 e.elem("oneProjectName").value="Segundo";
 e.elem("oneProjectBudget").value="100000";
 e.elem("oneProjectCurrency").value="CRC";
 e.elem("oneProjectGoal").value="goal1";
 e.elem("oneProjectCobroGroup").value="group1";
 submit(e.w,e.elem("oneProjectForm"));
 assert.equal(e.read().projects.length,1);
 assert(e.errors.some(x=>x.includes("ya está vinculada a otro proyecto")));
 assert.equal(e.read().projects[0].id,p.id);
});
test("V11.4: cobros editados se reflejan sin movimientos de proyecto nuevos",()=>{
 const e=boot(),p=create(e),group=e.w.oneProjectById(p.id);
 const charge=e.w.oneProjectCobroSummary(group).charges.find(c=>c.id==="charge1");
 const before=e.read();
 charge.payments.push({id:"pay2",date:"2026-11-17",amount:30000,fxBuy:490,fxSell:500,fxRef:495});
 e.w.save();
 const result=e.w.oneProjectCobroSummary(group);
 assert.equal(result.pendingCRC,70000);
 assert.equal(result.receivedCRC,70000);
 assert.equal(e.read().movements.length,before.movements.length);
 assert.equal(e.read().projectLinks.length,0);
 assert.deepEqual(e.errors,[]);
});
test("V11.4: archivar conserva enlaces y restaurar respaldo valida relaciones",()=>{
 const e=boot(),p=create(e);
 e.elem("oneProjectArchiveBtn").click();
 assert.equal(e.read().projects[0].status,"archived");
 assert.equal(e.read().projects[0].goalId,"goal1");
 assert.equal(e.read().projects[0].cobroGroupId,"group1");
 assert.doesNotThrow(()=>e.w.restorePrepare(e.read()));
 e.w.oneProjectOpen(e.w.oneProjectById(p.id));
 assert.equal(e.elem("oneProjectGoal").value,"goal1");
 assert.equal(e.elem("oneProjectCobroGroup").value,"group1");
 assert.deepEqual(e.errors,[]);
});
test("V11.4: desvincular no elimina meta, cobro, gasto ni saldo",()=>{
 const e=boot(),p=create(e);
 e.w.oneProjectOpen(e.w.oneProjectById(p.id));
 e.elem("oneProjectGoal").value="";
 e.elem("oneProjectCobroGroup").value="";
 submit(e.w,e.elem("oneProjectForm"));
 const after=e.read();
 assert.equal(after.projects[0].goalId,"");
 assert.equal(after.projects[0].cobroGroupId,"");
 assert.equal(after.reserves.length,1);
 assert.equal(after.sharedCharges.length,2);
 assert.equal(after.movements.length,1);
 assert.deepEqual(e.errors,[]);
});
test("V11.4: referencias perdidas se advierten sin destruir los datos históricos",()=>{
 const raw=seed();
 raw.projects=[{id:"orphan",name:"Anterior",currency:"USD",budget:100,status:"archived",buckets:[],
   goalId:"meta-inexistente",cobroGroupId:"grupo-inexistente"}];
 const e=boot(raw),status=e.w.oneHealthCheck(e.read());
 assert(status.issues.some(x=>x.message.includes("Metas inexistentes")));
 assert(status.issues.some(x=>x.message.includes("grupos de Cobros inexistentes")));
 assert.doesNotThrow(()=>e.w.restorePrepare(e.read()));
 assert(e.elem("oneProjectConnections"));
 assert.deepEqual(e.errors,[]);
});
test("V11.4: respaldo no permite duplicar asignación de una misma Meta",()=>{
 const e=boot(),p=create(e);
 const copy=e.read();
 copy.projects.push({id:"dupe",name:"Otro",currency:"CRC",budget:0,status:"active",buckets:[],goalId:"goal1",cobroGroupId:""});
 assert.throws(()=>e.w.restoreValidate(copy),/varios proyectos/i);
 assert.equal(e.read().projects.length,1);
 assert.equal(e.read().projects[0].id,p.id);
});
