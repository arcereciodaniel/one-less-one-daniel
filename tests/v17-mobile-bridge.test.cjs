"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),B=require("../src/experimental/v17-mobile-bridge.cjs");
require("../mobile-pilot/public/split-fare.js");
const id="v17-mobile-test-00001",date="2026-11-20",item={id,movement:{type:"Gasto",date,currency:"USD",amount:10,categoryId:"cat-exp"}};
const row={id,mobilePilotId:id,type:"Gasto",date,currency:"USD",amount:10,categoryId:"cat-exp",period:"P0",fxDate:"2026-11-19",fxBuy:490,fxSell:510};
test("receipts require matching local rows and reject conflicting ids, missing rows and invalid split batches",async()=>{
 const raw={movements:[row]};
 assert.throws(()=>B.check(raw,item),/existente/);B.mark(raw,item);assert(B.verify(raw,item));assert.equal(B.check(raw,item),"duplicate");
 assert.throws(()=>B.check(raw,{...item,movement:{...item.movement,amount:11}}),/reutilizado/);
 assert.throws(()=>B.verify({...raw,movements:[]},item),/Filas/);
 const calls=[];const result=await B.drain([item,{...item,id:"v17-mobile-test-00002",movement:{type:"Cobro dividido"}}],{importItem:i=>B.check(raw,i),verify:i=>B.verify(raw,i),ack:async i=>calls.push(i.id)});
 assert.deepEqual(result,{inserted:0,duplicates:1,pending:1,confirmed:1});assert.deepEqual(calls,[id]);
});
test("failed persistence or acknowledgement never silently confirms, retry is idempotent",async()=>{
 let disk={movements:[]},failWrite=true,failAck=true,acks=0;
 const io={importItem(i){if(B.check(disk,i)==="duplicate")return "duplicate";if(failWrite)throw Error("quota");disk={movements:[row]};B.mark(disk,i);return "inserted"},verify:i=>B.verify(disk,i),ack:async()=>{if(failAck)throw Error("network");acks++}};
 assert.deepEqual(await B.drain([item],io),{inserted:0,duplicates:0,pending:1,confirmed:0});assert.equal(acks,0);
 failWrite=false;assert.deepEqual(await B.drain([item],io),{inserted:1,duplicates:0,pending:1,confirmed:0});
 failAck=false;assert.deepEqual(await B.drain([item],io),{inserted:0,duplicates:1,pending:0,confirmed:1});assert.equal(disk.movements.length,1);assert.equal(acks,1);
});

const {JSDOM,VirtualConsole}=require("jsdom"),{buildCandidate,ENDPOINT}=require("../scripts/build-v17-mobile-bridge.cjs"),KEY="rastro_lab_v17_prerelease_data_v1";
function boot(saved,fetch){
 const errors=[],vc=new VirtualConsole();vc.on("jsdomError",e=>errors.push(e.message));vc.on("error",e=>errors.push(String(e)));
 const dom=new JSDOM(buildCandidate(),{runScripts:"dangerously",url:"https://staging.invalid/",pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}});w.fetch=fetch|| (async()=>{throw Error("Sin red")});w.alert=x=>errors.push(String(x));w.confirm=()=>true;w.prompt=()=>null;if(saved)w.localStorage.setItem(KEY,saved)}});
 const w=dom.window,g=id=>w.document.getElementById(id),raw=()=>JSON.parse(w.localStorage.getItem(KEY));return {w,g,raw,errors};
}
test("native staging sync preserves historic FX and overlay, retries ack, leaves invalid records pending, never saves credentials",async()=>{
 const seed=boot();let saved;try{const r=seed.raw();r.settings.fxHistory=[{date:"2026-11-19",buy:490,sell:510}];r.settings.fxDate="2026-11-19";r.settings.fxBuy=490;r.settings.fxSell=510;r.v16AssignmentOverlay={version:1,replacements:[],added:[]};saved=JSON.stringify(r)}finally{seed.w.close()}
 const simple={id:"v17-mobile-test-00002",movement:{type:"Cobro",date,amount:300,currency:"CRC",person:"Prueba"}},bad={id:"v17-mobile-test-00003",movement:{...item.movement,categoryId:"missing"}},split={id:"v17-mobile-test-00004",movement:{type:"Cobro dividido"}};
 let e,fail=true,acks=[];
 const transport=async(url,opt)=>{assert(url.startsWith(ENDPOINT+"/"));assert.equal(opt.redirect,"error");
  let data={ok:true};
  if(url.endsWith("/api/health"))data={service:"One Less One Mobile V17 Staging",mode:"synthetic-only"};
  if(url.endsWith("/api/inbox"))data={items:[item,simple,bad,split]};
  if(url.endsWith("/api/ack")){const i=JSON.parse(opt.body).id;B.verify(e.raw(),i===id?item:simple);if(i===id&&fail)throw Error("network");acks.push(i)}
  return {ok:true,json:async()=>data};
 };
 e=boot(saved,transport);try{
  const {w,g,raw}=e;assert(g("rc-migrationDetails").hidden,e.errors.join("\n"));assert(g("rc-migrationFile").disabled);assert(g("rc-sessionFile").disabled);
  const key="test-only-secret".repeat(3),run=async()=>{g("rc-mobileStagingKey").value=key;await g("rc-mobileStagingSync").onclick();await new Promise(r=>setImmediate(r));assert.equal(g("rc-mobileStagingKey").value,"")};
  const before=raw().movements.length;await run();assert.match(g("rc-mobileStagingStatus").textContent,/2 importado\(s\), 0 repetido\(s\), 3 pendiente\(s\), 1 confirmado/);
  assert.equal(raw().movements.length,before+1);assert.equal(raw().movements.find(x=>x.mobilePilotId===id).fxSell,510);assert.deepEqual(raw().v16AssignmentOverlay,{version:1,replacements:[],added:[]});
  fail=false;await run();assert.match(g("rc-mobileStagingStatus").textContent,/0 importado\(s\), 2 repetido\(s\), 2 pendiente\(s\), 2 confirmado/);
  assert.equal(raw().movements.length,before+1);assert.deepEqual(acks,[simple.id,id,simple.id]);assert(!Object.values(w.localStorage).some(v=>String(v).includes(key)));
 }finally{e.w.close()}
});

test("split receipts require every participant, same batch and exact original amounts, without creating a cash expense",()=>{
 const p=globalThis.OneSplitFare.normalize({type:"Cobro dividido",date,currency:"USD",amount:328,groupName:"Hotel de prueba",splitMode:"equal",selfShares:1,participants:[{person:"A",shares:2},{person:"B",shares:1}]});
 const entry={id:"v17-split-hotel-0001",movement:p};
 const group={id:"group-001",name:p.groupName,mobilePilotId:entry.id,splitFare:{totalAmount:p.amount,currency:p.currency,selfAmount:p.selfAmount,totalShares:p.totalShares,mode:p.splitMode,date:p.date}};
 const charges=p.participants.map((part,i)=>({id:"charge-"+i,mobilePilotId:entry.id,groupId:group.id,person:part.person,date,dueDate:"",currency:p.currency,amount:part.amount,splitFareShares:part.shares,splitFareExpenseId:"batch-001",fxDate:"2026-11-19",fxBuy:490,fxSell:510}));
 const raw={movements:[],sharedChargeGroups:[group],sharedCharges:charges};B.mark(raw,entry);assert(B.verify(raw,entry));
 assert.equal(p.selfAmount,82);assert.deepEqual(charges.map(c=>c.amount),[164,82]);
 assert.throws(()=>B.verify({...raw,sharedCharges:charges.slice(0,1)},entry),/incompleto/);
 assert.throws(()=>B.verify({...raw,sharedCharges:[{...charges[0],amount:165},charges[1]]},entry),/no coincide/);
 assert.throws(()=>B.verify({...raw,sharedCharges:[{...charges[0],splitFareExpenseId:"other"},charges[1]]},entry),/identidad|vínculo/i);
 assert.throws(()=>B.verify({...raw,movements:[{id:"extra",mobilePilotId:entry.id}]},entry),/incompleto/);
});
test("native split sync persists all rows and receipt together, reuses group, retries ack and leaves cash balance unchanged",async()=>{
 const seed=boot();let saved;try{const r=seed.raw();r.settings.fxHistory=[{date:"2026-11-19",buy:490,sell:510}];r.settings.fxDate="2026-11-19";r.settings.fxBuy=490;r.settings.fxSell=510;r.v16AssignmentOverlay={version:1,replacements:[],added:[]};saved=JSON.stringify(r)}finally{seed.w.close()}
 const first={id:"v17-split-hotel-0001",movement:globalThis.OneSplitFare.normalize({date,currency:"USD",amount:328,groupName:"Hotel prueba",splitMode:"equal",selfShares:1,participants:[{person:"A",shares:2},{person:"B",shares:1}]})};
 let e,items=[first],fail=true,acks=[];
 const transport=async(url,opt)=>{let data={ok:true};if(url.endsWith("/api/health"))data={service:"One Less One Mobile V17 Staging",mode:"synthetic-only"};if(url.endsWith("/api/inbox"))data={items};if(url.endsWith("/api/ack")){const i=JSON.parse(opt.body).id;B.verify(e.raw(),items.find(x=>x.id===i));if(fail)throw Error("network");acks.push(i)}return {ok:true,json:async()=>data}};
 e=boot(saved,transport);
 try{
  const {w,g,raw}=e,run=async()=>{g("rc-mobileStagingKey").value="test-only-secret".repeat(3);await g("rc-mobileStagingSync").onclick();await new Promise(r=>setImmediate(r))};
  const before=raw(),balance=w.actualBalanceAt(date);
  await run();assert.match(g("rc-mobileStagingStatus").textContent,/1 importado\(s\), 0 repetido\(s\), 1 pendiente\(s\), 0 confirmado/);
  const group=raw().sharedChargeGroups.find(x=>x.mobilePilotId===first.id);assert(group);assert(B.verify(raw(),first));assert.deepEqual(raw().movements,before.movements);assert.equal(w.actualBalanceAt(date),balance);
  fail=false;await run();assert.match(g("rc-mobileStagingStatus").textContent,/0 importado\(s\), 1 repetido\(s\), 0 pendiente\(s\), 1 confirmado/);
  const second={id:"v17-split-dinner-001",movement:globalThis.OneSplitFare.normalize({date,currency:"CRC",amount:10001,groupId:group.id,splitMode:"amount",selfShares:1,selfAmount:3001,participants:[{person:"A",shares:1,amount:7000}]})};
  items=[second];await run();assert(B.verify(raw(),second));assert.equal(raw().sharedChargeGroups.length,before.sharedChargeGroups.length+1);assert.equal(raw().sharedCharges.length,before.sharedCharges.length+3);assert.deepEqual(raw().movements,before.movements);assert.equal(w.actualBalanceAt(date),balance);assert.deepEqual(acks,[first.id,second.id]);
  assert.deepEqual(raw().v16AssignmentOverlay,before.v16AssignmentOverlay);
 }finally{e.w.close()}
});

test("mobile append patches preserve exact legacy rows and unrelated fields, reject non-append mutations",()=>{
 const disk={movements:[{id:"old",amount:25}],sharedCharges:[],settings:{foo:1}},before={...disk,movements:[{id:"old",amount:25,fxBuy:0}],movementSeq:7},after={...before,movements:[...before.movements,{id:"new",amount:12}],movementSeq:8};
 const next=B.appendPatch(disk,before,after);
 assert.deepEqual(next.movements,[disk.movements[0],after.movements[1]]);assert.equal(next.movementSeq,8);assert.deepEqual(next.settings,disk.settings);
 assert.throws(()=>B.appendPatch(disk,before,{...after,settings:{foo:2}}),/no permitido/);
 assert.throws(()=>B.appendPatch(disk,before,{...after,movements:[{id:"old",amount:99},after.movements[1]]}),/Historial/);
 assert.throws(()=>B.appendPatch(disk,before,{...after,movements:[...before.movements,{id:"old",amount:12}]}),/duplicada/);
});
