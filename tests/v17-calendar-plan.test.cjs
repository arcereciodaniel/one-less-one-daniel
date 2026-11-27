"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),P=require("../src/experimental/v17-calendar-plan.cjs"),Q=require("../src/experimental/v15-financial-query.cjs"),{buildCandidate}=require("../scripts/build-v17-prerelease.cjs");
const today="2026-11-20",endFor=p=>p.endDate||"2026-11-27";
const seed=()=>({settings:{payDays:{first:14,second:28}},periods:[{key:"P0",date:"2026-11-14",budgetMonth:"2026-11",fortnight:2}],movements:[{id:"m",date:"2026-11-19",period:"P0",amount:10}],v16AssignmentOverlay:{version:1,replacements:[],added:[{id:"dated",date:"2026-12-04",minor:123,currency:"CRC"}]},v17CashCommitmentLinks:[]});
test("calendar plans start after original horizon; all existing ledger and overlay bytes are preserved",()=>{
 for(const frequency of ["weekly","biweekly","semimonthly","monthly"]){
  const raw=seed(),before=JSON.stringify(raw),p=P.stage(raw,today,frequency,90,Q,endFor),after={...raw,periods:[...raw.periods,...p.newRows]};
  assert.equal(p.preview.proposal.start,"2026-11-28");assert.equal(p.newRows[0].date,"2026-11-28");assert.equal(p.newRows.at(-1).endDate,"2027-02-25");
  assert(P.verify(raw,after,today,endFor));assert.equal(JSON.stringify(raw),before);assert.deepEqual(after.v16AssignmentOverlay,raw.v16AssignmentOverlay);
  assert.throws(()=>P.verify(raw,{...after,movements:[]},today,endFor),/historial/);
  assert.throws(()=>P.verify(raw,after,today,(p,rows)=>rows.length===1?"2026-11-27":"2026-11-26"),/límite/);
 }
});
test("future cash or reserves, an existing transition and lapsed calendar block materialization",()=>{
 const raw=seed();raw.movements.push({id:"f",date:"2026-11-28",period:"P0"});assert(P.preview(raw,today,"weekly",30,Q,endFor).issues.includes("future-records"));assert.throws(()=>P.stage(raw,today,"weekly",30,Q,endFor),/revisión/);
 const reserve=seed();reserve.reserveMovements=[{date:"2026-12-01"}];assert.equal(P.preview(reserve,today,"weekly",30,Q,endFor).ready,false);
 assert.throws(()=>P.preview(seed(),"2026-11-28","weekly",30,Q,endFor),/terminó/);
 const t=seed();t.v15CalendarTransition={status:"active"};assert(P.preview(t,today,"weekly",30,Q,endFor).issues.includes("existing-transition"));
});
test("candidate mounts local read-only salary calendar, without an activation button",()=>{
 const h=buildCandidate();assert(h.includes('id="rc-calendarPreview"'));assert(h.includes('oneV17CalendarPlan.preview(raw,TODAY'));assert(!h.includes('id="rc-calendarActivate"'));
});
