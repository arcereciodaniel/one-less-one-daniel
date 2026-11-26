"use strict";
const assert=require("node:assert/strict"),{test}=require("node:test"),fs=require("node:fs"),vm=require("node:vm");
const src=fs.readFileSync("src/modules/70-views-and-filters.js","utf8"),ctx=vm.createContext({});
vm.runInContext(src.slice(src.indexOf("function oneFlexConfig("),src.indexOf("function oneFlexRuntime(")),ctx);
const month={start:"2026-12-01",end:"2026-12-28"},week={start:"2026-12-22",end:"2026-12-28"},cat={id:"food",type:"Gasto"},base=[{...month,amount:160000}],slice=(p,c,r)=>ctx.oneUniversalSlice(p.amount,p,r),fx=(a,c)=>a*(c==="USD"?500:1);
test("V14.1: weekly override replaces 40000 with 60000; parent increases to 180000, no duplicate",()=>{
 const rows=ctx.oneLivingReplace([],"food",week,60000,"CRC");
 assert.equal(ctx.oneLivingSum(cat,week,base,rows,slice,fx),60000);
 assert.equal(ctx.oneLivingSum(cat,month,base,rows,slice,fx),180000);
 assert.equal(ctx.oneLivingSum(cat,{start:"2026-12-01",end:"2026-12-21"},base,rows,slice,fx),120000);
});
test("V14.1: editing parent replaces child adjustments, preserves dates outside selection and exact cents",()=>{
 let rows=ctx.oneLivingReplace([],"food",week,60000,"CRC");
 rows=ctx.oneLivingReplace(rows,"food",month,160000.01,"CRC");
 assert.equal(ctx.oneLivingSum(cat,month,base,rows,slice,fx),160000.01);
 rows=ctx.oneLivingReplace(rows,"food",week,0,"CRC");
 assert.equal(ctx.oneLivingSum(cat,week,base,rows,slice,fx),0);
 assert.equal(rows.length,28);
});
test("V14.1: no duplicate entries, invalid date or currency; USD values retained",()=>{
 const rows=ctx.oneLivingReplace([],"food",week,100,"USD");
 assert.equal(ctx.oneLivingSum(cat,week,base,rows,slice,fx),50000);
 assert.throws(()=>ctx.oneLivingValidate([...rows,rows[0]]));assert.throws(()=>ctx.oneLivingReplace([],"food",week,-1,"CRC"));assert.throws(()=>ctx.oneLivingReplace([],"food",week,10,"EUR"));
 assert.throws(()=>ctx.oneLivingValidate([{categoryId:"food",date:"2027-02-29",amount:10,currency:"CRC"}]));
});
