"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {budgetIntelligence}=require("../src/experimental/v15-financial-query.cjs");
const row=(id,plannedCRC,spentCRC,extras={})=>({id,type:"Gasto",plannedCRC,spentCRC,savingsCRC:0,paceEligible:true,...extras});
const start="2026-11-14",end="2026-11-27",asOf="2026-11-20";
test("V15.7 distinguishes cumulative excess, zero budget, and linear pace without changing inputs",()=>{
 const rows=[row("pace",10000,7000),row("over",10000,12000),row("none",0,1500),row("debt",6000,1000,{type:"Pago deuda"}),row("saving",5000,3000,{savingsCRC:1000,paceEligible:false})];
 const before=JSON.stringify(rows),r=budgetIntelligence(rows,start,end,asOf);
 assert.equal(JSON.stringify(rows),before);assert.equal(r.elapsed,7);
 assert.deepEqual(r.ahead.map(x=>[x.id,x.ahead]),[["pace",200000]]);
 assert.deepEqual(r.over.map(x=>[x.id,x.excess]),[["over",200000]]);
 assert.deepEqual(r.unbudgeted.map(x=>[x.id,x.used]),[["none",150000]]);
 assert.equal(r.remaining,900000);assert.equal(r.remainingDebt,500000);assert.equal(r.remainingOther,400000);
});
test("V15.7 no pace for future/closed periods, debt, savings, or date views",()=>{
 const rows=[row("g",100,90),row("d",100,90,{type:"Pago deuda"}),row("s",100,0,{savingsCRC:90})];
 assert.equal(budgetIntelligence(rows,start,end,"2026-11-13").ahead.length,0);
 assert.equal(budgetIntelligence(rows,start,end,"2026-11-28").remaining,null);
 assert.equal(budgetIntelligence(rows,start,end,asOf,{pace:false}).ahead.length,0);
 assert.deepEqual(budgetIntelligence(rows,start,end,asOf).ahead.map(x=>x.id),["g"]);
});
test("V15.7 unknown allocations never imply zero and invalid/duplicate rows reject",()=>{
 assert.equal(budgetIntelligence([row("a",null,10)],start,end,asOf).unbudgeted.length,0);
 assert.equal(budgetIntelligence([row("a",0,10)],start,end,asOf,{complete:false}).rows.length,0);
 assert.throws(()=>budgetIntelligence([row("a",1,0),row("a",1,0)],start,end,asOf));
 assert.throws(()=>budgetIntelligence([row("a",1,-1)],start,end,asOf));
});
test("V15.7 exact minor units and full period final day",()=>{
 const r=budgetIntelligence([row("a",10.01,10.03)],start,end,end);
 assert.equal(r.over[0].excess,2);assert.equal(r.ahead.length,0);
});
