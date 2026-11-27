"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),{JSDOM,VirtualConsole}=require("jsdom"),{buildCandidate}=require("../scripts/build-v17-prerelease.cjs"),O=require("../src/experimental/v17-operations.cjs");
const KEY="rastro_lab_v17_prerelease_data_v1";
function boot(saved,html=buildCandidate(),mockFetch=null){const errors=[],vc=new VirtualConsole();vc.on("jsdomError",e=>errors.push(e.message));vc.on("error",e=>errors.push(String(e)));const dom=new JSDOM(html,{runScripts:"dangerously",url:"https://prerelease.invalid/lab/v17/",pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}});w.fetch=mockFetch|| (async()=>{throw Error("Sin red")});w.alert=x=>errors.push(String(x));w.confirm=()=>true;w.prompt=()=>null;if(saved){if(typeof saved==="string")w.localStorage.setItem(KEY,saved);else for(const [k,v] of Object.entries(saved))w.localStorage.setItem(k,v)}}});const w=dom.window,d=w.document,g=id=>d.getElementById(id),raw=()=>JSON.parse(w.localStorage.getItem(KEY));return {w,d,g,raw,errors}}
const tick=()=>new Promise(r=>setImmediate(r));



const M=require("../src/experimental/v17-migration-rehearsal.cjs"),U=require("../src/experimental/v17-portable-session.cjs"),SRC=KEY+"_original_migration_source";
test("portable session preserves exact original and active bytes, fails closed on storage conflict",()=>{
 const source=JSON.stringify({version:6.2,periods:[],movements:[],debts:[],categories:[],settings:{}},null,2),date="2026-11-26",validate=()=>({ready:true,issues:[]});
 const active=JSON.stringify({...JSON.parse(source),[M.FIELD]:{format:"v17-private-lab-v1",importDate:date},v16AssignmentOverlay:{version:1,replacements:[],added:[]}},null,2);
 const text=U.pack(source,active,M),draft=U.prepare(text,"{}",date,M,validate,validate);
 let disk="{}",original=null;const io={read:()=>disk,readSource:()=>original,writeSource:x=>original=x,write:x=>disk=x};
 assert(draft.ready);assert.throws(()=>U.commit(draft,{...io,read:()=>"changed"},M,validate,validate),/sesión cambió/);
 U.commit(draft,io,M,validate,validate);assert.equal(disk,active);assert.equal(original,source);
 assert.throws(()=>U.commit(draft,io,M,validate,validate),/sesión cambió/);
 assert(!U.prepare(text,"{}",date,M,validate,()=>({ready:false})).ready);assert.throws(()=>U.pack(source,source,M),/privada/);
});
test("pre-release imports a portable fixture and reloads, without reading or changing stable keys",async()=>{
 const e=boot(),{w,g,raw}=e;let saved,source,active;
 try{
  const r=raw();source=JSON.stringify(r,null,2);active=JSON.stringify({...r,[M.FIELD]:{format:"v17-private-lab-v1",importDate:"2026-11-26"},v16AssignmentOverlay:{version:1,replacements:[],added:[]}});
  const payload=U.pack(source,active,M),before=w.localStorage.getItem(KEY);
  w.localStorage.setItem("daniel_finanzas_local_v1","PROD_SENTINEL");w.localStorage.setItem("rastro_lab_v7_1_data_v1","LAB_SENTINEL");
  g("rc-integrity").click();const file=g("rc-sessionFile");Object.defineProperty(file,"files",{configurable:true,value:[{size:payload.length,text:async()=>payload}]});await file.onchange();
  assert(!g("rc-sessionConfirm").disabled,g("rc-sessionStatus").textContent);assert.equal(w.localStorage.getItem(KEY),before);
  g("rc-sessionConfirm").click();assert.equal(w.localStorage.getItem(KEY),active);assert.equal(w.localStorage.getItem(SRC),source);
  assert.equal(w.localStorage.getItem("daniel_finanzas_local_v1"),"PROD_SENTINEL");assert.equal(w.localStorage.getItem("rastro_lab_v7_1_data_v1"),"LAB_SENTINEL");
  saved={[KEY]:active,[SRC]:source,daniel_finanzas_local_v1:"PROD_SENTINEL",rastro_lab_v7_1_data_v1:"LAB_SENTINEL"};
 }finally{w.close()}
 const b=boot(saved);try{assert.match(b.g("rc-labFooter").textContent,/V17 Pre-release · Copia privada/);assert.deepEqual(b.raw().v16AssignmentOverlay,{version:1,replacements:[],added:[]});assert.equal(b.w.localStorage.getItem(SRC),source);assert.equal(b.w.localStorage.getItem("daniel_finanzas_local_v1"),"PROD_SENTINEL");assert.equal(b.w.localStorage.getItem("rastro_lab_v7_1_data_v1"),"LAB_SENTINEL");b.g("rc-integrity").click();assert(b.g("rc-sessionFile").disabled);assert(!b.g("rc-migrationReset").hidden)}finally{b.w.close()}
});
test("pre-release package has separate path and no deploy script or external network access",()=>{
 const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),dir=fs.mkdtempSync(path.join(os.tmpdir(),"olo-pre-"));
 try{require("../scripts/build-v17-prerelease.cjs").buildPackage(dir);const h=fs.readFileSync(path.join(dir,"lab/v17/index.html"),"utf8");assert.match(h,/connect-src 'none'/);assert(!h.includes("daniel_finanzas_local_v1"));assert(!fs.existsSync(path.join(dir,"index.html")));assert(!fs.existsSync(path.join(dir,"lab/index.html")))}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
