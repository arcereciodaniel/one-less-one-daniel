"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),{JSDOM,VirtualConsole}=require("jsdom"),{buildCandidate}=require("../scripts/build-v17-migration-lab.cjs"),O=require("../src/experimental/v17-operations.cjs");
const KEY="rastro_lab_v17_migration_preview_data_v1";
function boot(saved,html=buildCandidate(),mockFetch=null){const errors=[],vc=new VirtualConsole();vc.on("jsdomError",e=>errors.push(e.message));vc.on("error",e=>errors.push(String(e)));const dom=new JSDOM(html,{runScripts:"dangerously",url:"https://migration.invalid/",pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}});w.fetch=mockFetch|| (async()=>{throw Error("Sin red")});w.alert=x=>errors.push(String(x));w.confirm=()=>true;w.prompt=()=>null;if(saved){if(typeof saved==="string")w.localStorage.setItem(KEY,saved);else for(const [k,v] of Object.entries(saved))w.localStorage.setItem(k,v)}}});const w=dom.window,d=w.document,g=id=>d.getElementById(id),raw=()=>JSON.parse(w.localStorage.getItem(KEY));return {w,d,g,raw,errors}}
const tick=()=>new Promise(r=>setImmediate(r));


const M=require("../src/experimental/v17-migration-rehearsal.cjs"),SRC=KEY+"_original_migration_source";
test("migration writes exact source first, preserves original ledger, rejects conflicts and invalid backup",()=>{
 const raw={version:6.2,periods:[],movements:[],debts:[],categories:[],settings:{}},source=JSON.stringify(raw,null,2),validate=()=>({ready:true,counts:{actuals:0},issues:[]}),date="2026-11-26";
 let disk="{}",original=null,previous=null;const io={read:()=>disk,readSource:()=>original,writeSource:x=>original=x,write:x=>disk=x,readPrevious:()=>previous,writePrevious:x=>previous=x};
 const draft=M.prepare(source,disk,date,validate);assert(draft.ready);assert.throws(()=>M.commit(draft,{...io,writeSource:()=>{}},validate),/copia original/);assert.equal(disk,"{}");
 M.commit(draft,io,validate);assert.equal(original,source);const obj=JSON.parse(disk);assert(M.isPrivate(obj));delete obj[M.FIELD];assert.deepEqual(obj,raw);
 assert.throws(()=>M.commit(draft,io,validate),/sesión cambió/);
 const edited=JSON.parse(disk);edited.movements.push({id:"test"});disk=JSON.stringify(edited);const saved=disk;M.resetCopy(source,disk,date,io,validate);assert.equal(previous,saved);assert.equal(JSON.parse(disk).movements.length,0);assert.equal(original,source);
 assert.throws(()=>M.parse(JSON.stringify({...raw,v16AssignmentOverlay:{}})),/original compatible/);
 assert(!M.prepare(source,disk,date,()=>({ready:false,issues:[{code:"test"}]})).ready)
});
test("private Lab imports a fixture from original V16 with explicit confirmation, retains bytes, boots isolated copy and preserves balance",async()=>{
 const e=boot(),{w,d,g,raw}=e;let stored,source,balance;
 try{
  assert.match(g("rc-content").textContent,/Saldo operativo/);
  source=JSON.stringify(raw(),null,2);balance=w.actualBalanceAt(w.todayIso());
  const before=w.localStorage.getItem(KEY);g("rc-integrity").click();const file=g("rc-migrationFile");Object.defineProperty(file,"files",{configurable:true,value:[{size:source.length,text:async()=>source}]});
  await file.onchange();assert(!g("rc-migrationConfirm").disabled,g("rc-migrationStatus").textContent);assert.equal(w.localStorage.getItem(KEY),before);assert.equal(w.localStorage.getItem(SRC),null);
  g("rc-migrationConfirm").click();assert.equal(w.localStorage.getItem(SRC),source);const active=raw();assert(M.isPrivate(active));delete active[M.FIELD];assert.deepEqual(active,JSON.parse(source));stored=w.localStorage.getItem(KEY);
 }finally{w.close()}
 const r=boot({[KEY]:stored,[SRC]:source});try{
  assert.match(r.g("rc-labFooter").textContent,/Copia de respaldo/);assert.match(r.g("rc-content").textContent,/Saldo operativo/);assert.equal(r.w.actualBalanceAt(r.w.todayIso()),balance);assert.equal(r.w.localStorage.getItem(SRC),source);assert.equal(r.w.localStorage.getItem(KEY),stored);
  r.g("rc-integrity").click();assert(r.g("rc-migrationFile").disabled);assert(!r.g("rc-migrationReset").hidden);assert(r.g("rc-restoreTest").disabled);
  assert(!r.w.localStorage.getItem("daniel_finanzas_local_v1"));assert(!r.w.localStorage.getItem("rastro_lab_v7_1_data_v1"));
 }finally{r.w.close()}
});
