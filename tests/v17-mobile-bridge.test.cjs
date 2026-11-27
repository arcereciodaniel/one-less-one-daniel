"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),B=require("../src/experimental/v17-mobile-bridge.cjs");
const id="v17-mobile-test-00001",date="2026-11-20",item={id,movement:{type:"Gasto",date,currency:"USD",amount:10,categoryId:"cat-exp"}};
const row={id,mobilePilotId:id,type:"Gasto",date,currency:"USD",amount:10,categoryId:"cat-exp",period:"P0",fxDate:"2026-11-19",fxBuy:490,fxSell:510};
test("receipts require matching local rows and reject conflicting ids, missing rows and split batches",async()=>{
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
