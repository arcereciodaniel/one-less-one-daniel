"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),{JSDOM,VirtualConsole}=require("jsdom"),{buildCandidate}=require("../scripts/build-v17-prerelease.cjs");
const KEY="rastro_lab_v17_prerelease_data_v1",tick=()=>new Promise(r=>setImmediate(r));
function boot(saved){
 const errors=[],vc=new VirtualConsole();vc.on("jsdomError",e=>errors.push(e.message));vc.on("error",e=>errors.push(String(e)));
 const dom=new JSDOM(buildCandidate(),{runScripts:"dangerously",url:"https://parity.invalid/",pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}});w.fetch=async()=>{throw Error("Sin red")};w.alert=x=>errors.push(String(x));w.confirm=()=>true;w.prompt=()=> "Prueba";if(saved)w.localStorage.setItem(KEY,saved)}});
 const w=dom.window,d=w.document,g=id=>d.getElementById(id),raw=()=>JSON.parse(w.localStorage.getItem(KEY));
 const module=id=>{if(!d.querySelector('[data-module="'+id+'"]')||d.querySelector('[data-module="'+id+'"]').hidden){g("rc-manageModules").click();const c=d.querySelector('#rc-moduleChoices input[value="'+id+'"]');c.checked=true;c.dispatchEvent(new w.Event("change"));g("rc-closeModules").click()}d.querySelector('[data-module="'+id+'"]').click()};
 const action=(a,id)=>{const b=d.querySelector('[data-native-action="'+a+'"][data-native-id="'+id+'"]');assert(b,g("rc-content").textContent);b.click()};
 return {w,d,g,raw,module,action,errors};
}
test("debt and project archive/reactivate, group edit and archive, undated collection and split accessible without another selector",async()=>{
 const first=boot();let saved;try{const r=first.raw();
 r.projects=[{id:"project-parity",name:"Proyecto prueba",currency:"CRC",budget:10000,status:"active",startDate:"2026-11-01",endDate:"2026-11-30",buckets:[]}];
 r.sharedChargeGroups=[{id:"group-parity",name:"Grupo prueba",person:"Prueba",status:"active",notes:"",cutDay:0}];
 r.sharedCharges=[{id:"charge-parity",groupId:"group-parity",person:"Prueba",date:"2026-11-20",dueDate:"",chargeMonth:"2026-11",currency:"CRC",amount:1000,status:"pending",payments:[],description:"Sin fecha"}];
 saved=JSON.stringify(r)}finally{first.w.close()}
 const e=boot(saved);try{const {w,d,g,raw,module,action}=e,initial=raw(),balance=w.actualBalanceAt("2026-11-20");
 module("debts");action("debt-archive","debt1");await tick();assert.equal(raw().debts[0].status,"archived");
 action("debt-reactivate","debt1");await tick();assert.equal(raw().debts[0].status,"active");
 module("projects");action("project-toggle","project-parity");await tick();assert.equal(raw().projects[0].status,"archived");action("project-toggle","project-parity");await tick();assert.equal(raw().projects[0].status,"active");
 module("collections");action("group-edit","group-parity");assert(g("sharedGroupDialog").open);g("sharedGroupDialog").close();
 action("group-split","group-parity");assert(g("oneSplitFareDialog").open);assert.equal(g("oneSplitGroupChoice").value,"group-parity");g("oneSplitFareDialog").close();
 action("group-archive","group-parity");await tick();assert.equal(raw().sharedChargeGroups[0].status,"archived");assert.equal(raw().sharedCharges[0].amount,1000);
 action("group-reactivate","group-parity");await tick();assert.equal(raw().sharedChargeGroups[0].status,"active");
 action("collection","charge-parity");assert(g("sharedChargeDialog").open);assert.equal(g("scId").value,"charge-parity");g("sharedChargeDialog").close();
 assert.equal(raw().movements.length,initial.movements.length);assert.equal(w.actualBalanceAt("2026-11-20"),balance);assert.equal(d.querySelectorAll(".demo-filter").length,1);
 assert(!w.localStorage.getItem("daniel_finanzas_local_v1"));assert.deepEqual(e.errors,[]);
 }finally{e.w.close()}
});
