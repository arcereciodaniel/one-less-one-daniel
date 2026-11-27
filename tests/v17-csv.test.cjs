"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),F=require("../src/experimental/v16-financial-assignments.cjs"),C=require("../src/experimental/v17-csv.cjs"),{buildCandidate}=require("../scripts/build-v17-prerelease.cjs");
const range={start:"2026-11-01",end:"2026-11-30"};
test("budget CSV uses current dated plans and keeps currencies and unresolved amounts separate",()=>{
 const model={categories:[{id:"g",name:"=SUM(1,2)",type:"Gasto"}],issues:[],allocations:[{id:"a",categoryId:"g",date:"2026-11-20",currency:"CRC",minor:30000},{id:"b",categoryId:"g",start:"2026-10-28",end:"2026-11-30",currency:"CRC",minor:10000},{id:"c",categoryId:"g",date:"2026-11-21",currency:"USD",minor:1250}],actuals:[{id:"x",categoryId:"g",date:"2026-11-20",currency:"CRC",minor:15000}]};
 const before=JSON.stringify(model),p=F.project(model,{basis:"calendar",...range}),csv=C.budget(p,range);
 assert(csv.startsWith("\ufeff"));assert(csv.includes("'=SUM(1,2)"));assert(csv.includes('"CRC",300,150,100,,"pending",0'));assert(csv.includes('"USD",12.5,0,0,12.5,"defined",0'));assert.equal(JSON.stringify(model),before);
});
test("movement CSV preserves one row per original record, actual FX and salary identity; dangerous text is neutralized",()=>{
 const m={id:"m",date:"2026-11-20",type:"Gasto",categoryId:"g",category:"Gasto",description:"  =HYPERLINK(\"x\")",currency:"USD",amount:10.25,period:"P0",fxBuy:490,fxSell:510,fxDate:"2026-11-19",splits:[{categoryId:"g",amount:10.25}]};
 const csv=C.movements([m],range);assert.equal(csv.trimEnd().split("\r\n").length,2);assert(csv.includes("'  =HYPERLINK"));assert(csv.includes('"USD",10.25,"P0","",490,510,"2026-11-19"'));assert.throws(()=>C.movements([{...m,date:"2026-12-01"}],range),/inválido/);
});
test("prerelease includes both exports using the shared temporal selector",()=>{
 const h=buildCandidate();assert(h.includes('oneV17Csv.budget(F.project(fresh,{basis:"calendar",...range}),range)'));assert(h.includes('oneV17Csv.movements(O.movements(rawNow(),range),range)'));assert(h.includes('if(moduleName==="budget")el("content").innerHTML=moduleActions(v)+kpis(p)'));
});

test("fully contained interval budget is counted once, distinct from partial-overlap pending",()=>{
 const model={categories:[{id:"g",name:"Gasto",type:"Gasto"}],issues:[],allocations:[{id:"whole",categoryId:"g",start:"2026-11-01",end:"2026-11-30",currency:"CRC",minor:10000}],actuals:[]};
 const full=C.budget(F.project(model,{basis:"calendar",...range}),range);
 assert(full.includes('"CRC",100,0,0,100,"defined",0'));
 const partial={start:"2026-11-01",end:"2026-11-15"};
 assert(C.budget(F.project(model,{basis:"calendar",...partial}),partial).includes('"CRC",0,0,100,,"pending",0'));
});
