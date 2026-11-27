"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),H=require("../src/experimental/v17-production-handoff.cjs"),M=require("../src/experimental/v17-migration-rehearsal.cjs"),B=require("../scripts/build-v17-production-handoff.cjs");
test("handoff requires legacy disconnected, exact original bytes and a private V17 ledger",()=>{
 const source=JSON.stringify({version:6.2,periods:[],movements:[],debts:[],categories:[],settings:{}}),rows=new Map([[H.LEGACY,source]]),io={read:k=>rows.get(k)??null};
 rows.set(H.PREFS,"{}");assert.throws(()=>H.source(io),/Desvinculá/);rows.delete(H.PREFS);assert.equal(H.source(io),source);
 assert.throws(()=>H.assertActive(io,M),/activá/);rows.set(H.SOURCE,source);rows.set(H.ACTIVE,JSON.stringify({...JSON.parse(source),[M.FIELD]:{format:"v17-private-lab-v1",importDate:"2026-11-26"}}));assert(H.assertActive(io,M));
 rows.set(H.LEGACY,source+" ");assert.throws(()=>H.assertActive(io,M),/cambió/);rows.set(H.LEGACY,source);rows.set(H.PREFS,"{}");assert.throws(()=>H.assertActive(io,M),/Desvinculá/);
});
test("production candidate uses distinct key and exact origin, never automatically syncs",()=>{
 assert(H.locationAllowed(H.ORIGIN,H.PATH));assert(!H.locationAllowed(H.ORIGIN,"/one-less-one-daniel/"));assert(!H.locationAllowed("https://evil.invalid",H.PATH));
 const h=B.buildCandidate();assert(h.includes(H.ORIGIN));assert(h.includes(H.PATH));assert(h.includes(H.PREFIX));assert(h.includes(B.ENDPOINT));assert(!h.includes("one-less-one-mobile-v17-staging.one-less-one-rastro.workers.dev"));assert(h.includes("v17ProductionMobileReceipts"));
 const {JSDOM}=require("jsdom"),d=new JSDOM(h,{url:"https://evil.invalid/",runScripts:"dangerously"});try{assert.equal(d.window.localStorage.length,0);assert.match(d.window.document.body.textContent,/Ruta de activación no autorizada/)}finally{d.window.close()}
});

test("local migration rehearses actual UI and blocks production transport on changed V16",async()=>{
 const {JSDOM,VirtualConsole}=require("jsdom"),pre=require("../scripts/build-v17-prerelease.cjs"),calls=[],errors=[];
 const tick=()=>new Promise(r=>setTimeout(r,60));
 const boot=(html,entries={})=>{
  const vc=new VirtualConsole();vc.on("jsdomError",e=>{if(!/navigation \(except hash changes\)/.test(e.message))errors.push(e.message)});vc.on("error",e=>errors.push(String(e)));
  return new JSDOM(html,{url:H.ORIGIN+H.PATH,runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};
   w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}});
   w.confirm=()=>true;w.alert=x=>errors.push(String(x));w.prompt=()=>null;
   w.fetch=async(url,opt)=>{calls.push({url,method:opt?.method});return {ok:true,json:async()=>url.endsWith("/api/health")?{ok:true,service:"One Less One Mobile",version:1}:url.endsWith("/api/inbox")?{items:[]}:{ok:true}}};
   for(const [k,v] of Object.entries(entries))w.localStorage.setItem(k,v);
  }});
 };
 const fixture=boot(pre.buildCandidate());let source;
 try{source=fixture.window.localStorage.getItem("rastro_lab_v17_prerelease_data_v1");assert(source)}finally{await tick();fixture.window.close()}
 const first=boot(B.buildInner(),{[H.LEGACY]:source,[H.PREFS]:"{}"});let active;
 try{
  const w=first.window,g=id=>w.document.getElementById(id);g("rc-integrity").click();g("rc-handoffRead").click();
  assert.match(g("rc-migrationStatus").textContent,/Desvinculá/);assert(g("rc-migrationConfirm").disabled);
  w.localStorage.removeItem(H.PREFS);g("rc-handoffRead").click();assert(!g("rc-migrationConfirm").disabled,g("rc-migrationStatus").textContent);
  g("rc-migrationConfirm").click();active=w.localStorage.getItem(H.ACTIVE);assert(M.isPrivate(JSON.parse(active)));assert.equal(w.localStorage.getItem(H.SOURCE),source);assert.equal(w.localStorage.getItem(H.LEGACY),source);
  assert.equal(calls.length,0);
 }finally{await tick();first.window.close()}
 const second=boot(B.buildInner(),{[H.LEGACY]:source,[H.SOURCE]:source,[H.ACTIVE]:active});
 try{
  const w=second.window,g=id=>w.document.getElementById(id);g("rc-integrity").click();
  w.localStorage.setItem(H.LEGACY,source+" ");g("rc-mobileStagingKey").value="x".repeat(40);await g("rc-mobileStagingSync").onclick();
  assert.match(g("rc-mobileStagingStatus").textContent,/V16 cambió/);assert.equal(calls.length,0);
  w.localStorage.setItem(H.LEGACY,source);g("rc-mobileStagingKey").value="x".repeat(40);await g("rc-mobileStagingSync").onclick();
  assert.equal(calls.length,3);assert(calls.every(x=>x.url.startsWith(B.ENDPOINT+"/")));assert.match(g("rc-mobileStagingStatus").textContent,/0 pendiente/);
  assert.equal(w.localStorage.getItem(H.LEGACY),source);assert.deepEqual(errors,[]);
 }finally{await tick();second.window.close()}
});
