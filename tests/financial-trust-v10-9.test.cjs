"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("index.html","utf8");
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
const KEY="daniel_finanzas_local_v1";
function dayShift(dayOffset){return new Date(Date.now()+dayOffset*86400000).toISOString().slice(0,10)}
const today=dayShift(0);
function base(){
 const m=today.slice(0,7),q=m.slice(0,4)+"-T"+(Math.floor((Number(m.slice(5,7))-1)/3)+1);
 return {
  version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,movementSeq:0,
  settings:{fx:500,fxBuy:490,fxSell:510,displayCurrency:"CRC"},
  periods:[{key:"this-1",quarter:q,n:1,budgetMonth:m,fortnight:1,date:dayShift(-60),
   opening:100000,openingCurrency:"CRC",income:0,otherIncome:0,budgets:{},categoryBudgets:{}},
   {key:"this-2",quarter:q,n:2,budgetMonth:m,fortnight:2,date:dayShift(10),
   opening:null,income:0,otherIncome:0,budgets:{},categoryBudgets:{}}],
  categories:[{id:"food",name:"Alimentación",type:"Gasto",active:true,budgetable:true,sort:10}],
  movements:[],movementAudit:[],debts:[],reconciliations:[],reserves:[],
  reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[]
 };
}
function boot(seed=base()){
 const errors=[],vc=new VirtualConsole();
 vc.on("jsdomError",e=>errors.push(String(e.stack||e)));
 const dom=new JSDOM(html,{url:"https://arcereciodaniel.github.io/one-less-one-daniel/",
  runScripts:"outside-only",pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(o,k)=>k==="measureText"?()=>({width:80}):()=>{}})};
 w.alert=x=>errors.push("ALERT "+x);w.confirm=()=>true;w.prompt=()=>null;
 w.localStorage.setItem(KEY,JSON.stringify(seed));
 w.eval(script+"\nwindow.__v109={data,oneHealthCheck,oneRenderDataHealth,updateReconcilePreview,actualBalanceAt,renderDashboard,save};");
 return {w,api:w.__v109,errors,close:()=>w.close(),persisted:()=>w.localStorage.getItem(KEY)};
}
test("V10.9: diagnóstico sin hallazgos es de solo lectura y el historial no cambia",()=>{
 const x=boot();try{
  const before=x.persisted(),runtime=JSON.stringify(x.api.data);
  const report=x.api.oneHealthCheck(x.api.data);
  assert.equal(report.issues.length,0);
  assert.equal(report.checked,0);
  x.api.oneRenderDataHealth();
  assert.equal(x.persisted(),before);
  assert.equal(JSON.stringify(x.api.data),runtime);
  const slot=x.w.document.getElementById("oneDataHealthReport");
  assert.match(slot.textContent,/Sin anomalías detectadas/);
  assert.match(slot.textContent,/No consta una descarga solicitada/);
  assert.match(slot.textContent,/comprobalo en Descargas/);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("V10.9: detecta duplicados y referencias huérfanas sin reparar ni crear movimientos",()=>{
 const x=boot();try{
  const a=x.api.data;
  a.movements.push({id:"same",date:today,type:"Gasto",amount:2500,currency:"CRC",categoryId:"absent"});
  a.movements.push({id:"same",date:today,type:"Gasto",amount:1000,currency:"CRC",categoryId:"food"});
  a.reserveMovements.push({id:"save1",reserveId:"absent-goal",date:today,type:"Aporte",amount:500,currency:"CRC"});
  a.sharedCharges.push({id:"charge1",groupId:"unknown-group",date:today,amount:100,payments:[],currency:"CRC"});
  const before=JSON.stringify(a),disk=x.persisted();
  const report=x.api.oneRenderDataHealth();
  const msg=report.issues.map(o=>o.message).join(" ");
  assert.match(msg,/ID duplicado en movements/);
  assert.match(msg,/categorías que ya no existen/);
  assert.match(msg,/metas inexistentes/);
  assert.match(msg,/grupos inexistentes/);
  assert.equal(report.checked,4);
  assert.equal(JSON.stringify(a),before);
  assert.equal(x.persisted(),disk);
  const slot=x.w.document.getElementById("oneDataHealthReport");
  assert.equal(slot.querySelectorAll("li").length,4);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("V10.9: respaldo informa solicitud, no asegura descarga, y registra fecha solo tras solicitar",()=>{
 const x=boot();try{
  const w=x.w,btn=w.document.getElementById("exportBtn"),initial=x.persisted();
  let clickCount=0;
  w.URL.createObjectURL=()=>"blob:mock-respaldo";
  w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){clickCount++};
  btn.click();
  assert.equal(clickCount,1);
  assert.equal(w.localStorage.getItem(KEY+"_last_backup_requested"),today);
  const note=w.document.getElementById("oneBackupNotice");
  assert.equal(note.hidden,false);
  assert.match(note.textContent,/Descarga solicitada/);
  assert.match(note.textContent,/Comprobá el archivo JSON/);
  assert(!note.textContent.includes("Descarga confirmada"));
  assert.equal(x.persisted(),initial,"No debe tocar finanzas para respaldarlas");
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("V10.9: conflicto de otras pestañas impide solicitar respaldos desactualizados",()=>{
 const x=boot();try{
  const w=x.w;let clicked=0;
  w.URL.createObjectURL=()=>"blob:test";
  w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){clicked++};
  const remote=JSON.parse(x.persisted());remote.settings.fxBuy=600;
  const external=JSON.stringify(remote);
  w.localStorage.setItem(KEY,external);
  w.document.getElementById("exportBtn").click();
  assert.equal(clicked,0);
  assert.equal(w.localStorage.getItem(KEY+"_last_backup_requested"),null);
  assert.equal(x.persisted(),external);
  assert(x.errors.some(e=>e.includes("otra pestaña")||e.includes("cambiaron")));
 }finally{x.close()}
});
test("V10.9: conciliación explica el ajuste y no genera gasto ni ingreso",()=>{
 const x=boot();try{
  const {w,api}=x;
  const starting=api.actualBalanceAt(today);
  const form=w.document.getElementById("reconcileForm");
  w.document.getElementById("rDate").value=today;
  w.document.getElementById("rCurrency").value="CRC";
  w.document.getElementById("rAmount").value=String(starting+5000);
  api.updateReconcilePreview();
  const note=w.document.getElementById("oneReconcileExplanation").textContent;
  assert.match(note,/aumentará/);
  assert.match(note,/no un ingreso, gasto ni pago de deuda/);
  assert.equal(api.data.movements.length,0);
  form.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  assert.equal(api.data.reconciliations.length,1);
  assert.equal(api.data.movements.length,0);
  assert(Math.abs(api.actualBalanceAt(today)-(starting+5000))<.005);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test("V10.9: indicador 30 días refleja saldo, no gasto, sin semáforo engañoso",()=>{
 const x=boot();try{
  const {w,api}=x;
  api.renderDashboard();
  const el=w.document.getElementById("dashboardHeroDelta");
  assert.match(el.textContent,/Saldo operativo/);
  assert.match(el.textContent,/hace 30 días/);
  assert.match(el.title,/no del gasto/);
  assert(!el.classList.contains("good")&&!el.classList.contains("bad"));
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
