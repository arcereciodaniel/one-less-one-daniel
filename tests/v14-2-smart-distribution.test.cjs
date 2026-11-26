"use strict";
const assert=require("node:assert/strict"),{test}=require("node:test"),fs=require("node:fs"),vm=require("node:vm");
const src=fs.readFileSync("src/modules/70-views-and-filters.js","utf8"),ctx=vm.createContext({});
vm.runInContext(src.slice(src.indexOf("function oneFlexConfig("),src.indexOf("function oneFlexRuntime(")),ctx);
const r={start:"2026-12-01",end:"2026-12-31"},cfg={first:14,second:28,weekday:1,day:1};
test("V14.2: weeks are disjoint, clipped and conserve all days and cents",()=>{
 const parts=ctx.oneLivingPartition(r,cfg,"week");assert.equal(parts.length,5);assert.equal(parts[0].start,r.start);assert.equal(parts.at(-1).end,r.end);assert(parts[0].partial&&parts.at(-1).partial);
 assert.equal(parts.reduce((s,p)=>s+ctx.oneLivingDays(p).length,0),31);
 for(let i=1;i<parts.length;i++)assert.equal(parts[i-1].next,parts[i].start);
 assert.equal(Math.round(parts.reduce((s,p)=>s+ctx.oneUniversalSlice(160000.01,r,p),0)*100),16000001);
});
test("V14.2: configured cuts may intersect three calendar-month blocks",()=>{
 const parts=ctx.oneLivingPartition(r,cfg,"fortnight");assert.equal(parts.length,3);assert.equal(parts.reduce((s,p)=>s+ctx.oneLivingDays(p).length,0),31);
});
test("V14.2: maintain total preserves last edit and cents",()=>{
 const values=Array.from(ctx.oneLivingRedistribute([40000,40000,40000,60000],3,160000));assert.equal(values[3],60000);assert.equal(Math.round(values.reduce((s,v)=>s+v,0)*100),16000000);
 assert.throws(()=>ctx.oneLivingRedistribute([40000,200000],1,160000));
 assert.deepEqual(Array.from(ctx.oneLivingRedistribute([0,0,30],2,100)),[35,35,30]);
});
test("V14.2: only changed blocks are written, other categories stay unchanged",()=>{
 const parent={start:"2026-12-01",end:"2026-12-28"},parts=ctx.oneLivingPartition(parent,{weekday:2},"week"),base=[{...parent,amount:160000}],slice=(p,c,r)=>ctx.oneUniversalSlice(p.amount,p,r),fx=a=>a;
 const prior=ctx.oneLivingReplace([],"other",parent,100,"CRC");
 const next=ctx.oneLivingDistributionChanges(prior,"food",parts,[40000,40000,40000,40000],[40000,40000,40000,60000],"CRC");
 assert.equal(next.filter(x=>x.categoryId==="food").length,7);assert.equal(next.filter(x=>x.categoryId==="other").length,28);
 assert.equal(ctx.oneLivingSum({id:"food",type:"Gasto"},parent,base,next,slice,fx),180000);
 assert.equal(ctx.oneLivingDistributionChanges(prior,"food",parts,[40000,40000,40000,40000],[40000,40000,40000,40000],"CRC"),prior);
});
