"use strict";
const assert=require("node:assert/strict"),{test}=require("node:test"),fs=require("node:fs"),vm=require("node:vm");
const src=fs.readFileSync("src/modules/70-views-and-filters.js","utf8"),ctx=vm.createContext({});
vm.runInContext(src.slice(src.indexOf("function oneFlexConfig("),src.indexOf("function oneFlexRuntime(")),ctx);
const x=(p,a,partial=false)=>({p,a,partial});
test("V14.3: 35k + 45k within 80k is compensated, not overspending",()=>{
 const status=ctx.oneLivingStatus(x(40000,45000),x(80000,80000),x(80000,80000),{closed:true});
 assert.equal(status.code,"compensated");assert.equal(status.amount,5000);
 assert.equal(ctx.oneLivingStatus(x(40000,45000),x(80000,80000),x(80000,80000)).code,"compensated");
 assert.equal(ctx.oneLivingStatus(x(40000,45000),x(160000,45000),x(40000,45000)).code,"temporary");
 assert.equal(ctx.oneLivingStatus(x(40000,45000),x(80000,90000),x(80000,90000)).amount,10000);
 assert.equal(ctx.oneLivingStatus(x(80000,80000),x(80000,80000),x(80000,80000),{closed:true,childOver:true}).code,"compensated");
});
test("V14.3: unknown, zero allocation, future and local excess are distinct",()=>{
 assert.equal(ctx.oneLivingStatus(x(null,100),null,null).code,"unknown");
 assert.equal(ctx.oneLivingStatus(x(50,100,true),x(300,100),null).code,"unknown");
 assert.equal(ctx.oneLivingStatus(x(0,100),x(300,100),null).code,"unassigned");
 assert.equal(ctx.oneLivingStatus(x(50,100),x(300,100,true),null).code,"local");
 assert.equal(ctx.oneLivingStatus(x(50,0),null,null,{future:true}).code,"future");
});
test("V14.3: context contains the selected interval, with no hidden partial week",()=>{
 const c={first:14,second:28,weekday:1},p=ctx.oneLivingContextParent({start:"2026-12-14",end:"2026-12-20"},c);
 assert.equal(p.start,"2026-12-14");assert.equal(p.end,"2026-12-27");
 const cross=ctx.oneLivingContextParent({start:"2026-12-28",end:"2027-01-03"},c);
 assert.equal(cross.start,"2026-12-28");assert.equal(cross.end,"2027-01-13");
 const cut=ctx.oneLivingContextParent({start:"2026-12-12",end:"2026-12-18"},c);
 assert.equal(cut.start,"2026-12-01");assert.equal(cut.end,"2026-12-31");
});
test("V14.3: liquidity is conditional on known balance and complete coverage",()=>{
 assert.equal(ctx.oneLivingLiquidity(100000,120000,true,true).shortfall,20000);
 assert.equal(ctx.oneLivingLiquidity(100000,80000,true,true).available,20000);
 assert.equal(ctx.oneLivingLiquidity(100000,120000,false,true),null);
 assert.equal(ctx.oneLivingLiquidity(100000,120000,true,false),null);
});
test("V14.3: category-specific dated adjustments can cover a gap without claiming all categories are covered",()=>{
 const r={start:"2026-12-01",end:"2026-12-07"},base=[{start:"2026-12-01",end:"2026-12-03"}];
 const rows=ctx.oneLivingReplace([],"food",{start:"2026-12-04",end:"2026-12-07"},40000,"CRC");
 assert.equal(ctx.oneLivingCategoryComplete(r,base,rows,"food"),true);
 assert.equal(ctx.oneLivingCategoryComplete(r,base,rows,"other"),false);
 assert.equal(ctx.oneLivingCategoryComplete(r,[],rows,"food"),false);
});
test("V14.3: real dated expenses drive compensated status; hypothetical adjustments do not mutate data",()=>{
 const r={start:"2026-12-14",end:"2026-12-27"},food={id:"food",type:"Gasto"},data={categories:[food],periods:[],flexBudgets:[{id:"p",...r,entries:[{categoryId:"food",amount:80000,currency:"CRC"}]}],livingBudgets:[],movements:[{date:"2026-12-16",type:"Gasto",categoryId:"food",amount:35000},{date:"2026-12-24",type:"Gasto",categoryId:"food",amount:45000}],reserveMovements:[]};
 Object.assign(ctx,{data,periodEndDate:p=>p.end,sortedCategories:x=>x,oneContributionCategory:t=>t.categoryId,reserveTxnHistoricalCRC:t=>t.amount,oneIsCobroReimbursement:m=>false,movementCategoryAmountCRC:(m,c)=>m.categoryId===c.id?m.amount:0,movementAmountCRC:m=>m.amount,currentToCRC:v=>v,periodCategoryBudgetCRC:()=>0,num:v=>Number(v)||0,normalizeCurrency:v=>v==="USD"?"USD":"CRC"});
 const week={start:"2026-12-21",end:"2026-12-27"},m=ctx.oneUniversalMetrics(week,"2026-12-28");
 const report=ctx.oneLivingContextReport(week,m,{first:14,second:28,weekday:1},"2026-12-28");
 assert.equal(report.statuses.get("food").code,"compensated");
 assert.equal(m.categories[0].p,40000);assert.equal(m.categories[0].a,45000);
 const hypothetical=ctx.oneLivingReplace([],"food",week,60000,"CRC"),before=JSON.stringify(data);
 assert.equal(ctx.oneUniversalMetrics(r,"2026-12-28",hypothetical).categories[0].p,100000);
 assert.equal(JSON.stringify(data),before);
});
