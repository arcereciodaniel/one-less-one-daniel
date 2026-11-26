"use strict";
// Shared read models. Module details are references to facts, not additional ledger entries.
const oneV16System=(()=>{
 const valid=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
 const inRange=(r,d)=>valid(d)&&r.start<=d&&d<=r.end;
 const minor=v=>{if(typeof v!=="number"||!Number.isFinite(v)||v<0||!Number.isSafeInteger(Math.round(v*100)))throw Error("Monto inválido");return Math.round(v*100)};
 const sum=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))throw Error("Monto fuera de rango");return n};
 const monthEnd=m=>new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5)),0)).toISOString().slice(0,10);
 const list=(x,k)=>Array.isArray(x?.[k])?x[k]:[];
 // Existing native calculators stay authoritative for balances, obligations and historical FX.
 function nativeSnapshot(raw,api,asOf,F){
  if(!valid(asOf))throw Error("Fecha inválida");
  const model=F.adaptLegacy(raw,{endFor:api.endFor,allocationState:api.allocationState,contributionCategory:api.contributionCategory});
  const mods={projects:[],projectExpenses:[],projectPlans:[],goals:[],goalActivity:[],debts:[],debtPayments:[],collections:[],collectionPayments:[]};
  const cats=new Map(model.categories.map(c=>[c.id,c]));
  const protect=id=>{if(cats.has(id))cats.get(id).protected=true};
  const movementIds=new Set();
  for(const p of list(raw,"projects")){
   if(p.status==="archived")continue;
   mods.projects.push({id:p.id,name:p.name,currency:p.currency||"CRC",budgetMinor:minor(p.budget||0),start:p.startDate||null,end:p.endDate||null});
   for(const {link,m} of api.projectRows(p)){
    if(movementIds.has(m.id))throw Error("Movimiento vinculado a más de un proyecto");
    movementIds.add(m.id);mods.projectExpenses.push({id:m.id,ownerId:p.id,date:m.date,minor:minor(api.projectExpense(p,m)),currency:p.currency||"CRC",name:m.description||m.category||"Gasto",planId:link.planId||null});
    model.actuals.filter(a=>a.source==="movement"&&a.sourceId===m.id).forEach(a=>protect(a.categoryId));
   }
   for(const plan of list(raw,"projectPlans").filter(x=>x.projectId===p.id)){
    const s=api.projectPlan(p,plan);mods.projectPlans.push({id:plan.id,ownerId:p.id,name:plan.name,date:plan.dueDate||null,minor:minor(s.planned),remainingMinor:minor(s.remaining),currency:p.currency||"CRC"});
   }
  }
  for(const g of list(raw,"reserves").filter(r=>r.type==="goal"&&r.status!=="archived")){
   const categoryId=api.goalCategory(g);protect(categoryId);
   mods.goals.push({id:g.id,name:g.name,date:g.targetDate||null,categoryId,targetMinor:minor(api.goalTarget(g)),balanceMinor:minor(api.goalBalance(g,asOf)),currency:"CRC"});
   for(const t of list(raw,"reserveMovements").filter(t=>t.reserveId===g.id&&t.type==="Aporte")){
    mods.goalActivity.push({id:t.id,ownerId:g.id,date:t.date,minor:minor(t.amount),currency:t.currency||"CRC",name:g.name});
    protect(api.contributionCategory(t));
   }
  }
  for(const x of api.debtEntries(asOf))mods.debts.push({id:x.debt.id,name:x.debt.name,date:x.date||null,minor:minor(Math.max(0,x.minimum||0)),currency:"CRC",state:x.state});
  for(const m of list(raw,"movements").filter(m=>m.type==="Pago deuda"))mods.debtPayments.push({id:m.id,ownerId:m.debtId||null,name:m.debt||"Pago de deuda",date:m.date,minor:minor(m.amount),currency:m.currency||"CRC"});
  for(const c of list(raw,"sharedCharges")){
   mods.collections.push({id:c.id,name:api.cobroPerson(c),date:c.dueDate||null,minor:minor(api.cobroRemaining(c)),currency:c.currency||"CRC"});
   for(const p of list(c,"payments"))mods.collectionPayments.push({id:JSON.stringify([c.id,p.id]),ownerId:c.id,name:api.cobroPerson(c),date:p.date,minor:minor(p.amount),currency:c.currency||"CRC"});
  }
  // Never inject these snapshots into budget or actuals.
  return {...model,modules:mods,operating:{asOf,minor:Math.round(api.actualBalance(asOf)*100),currency:"CRC",source:"native"}};
 }
 function datedPlan(model,range,asOf,F){
  const p=F.project(model,{basis:"calendar",...range});
  const next=[],unresolved=p.pending.concat(p.planned.filter(a=>!a.date)),prior=[];
  // Consume dated assignments oldest first by category, currency and calendar month.
  // Undated assignments in a month make matching ambiguous: withhold that category.
  // Past remaining assignments are shown separately; no invented rescheduling.
  const cache=new Map();
  for(const a of p.planned.filter(a=>a.date).sort((x,y)=>x.date.localeCompare(y.date)||x.id.localeCompare(y.id))){
   const m=a.date.slice(0,7),k=JSON.stringify([a.categoryId,a.currency,m]);
   if(!cache.has(k)){
    const month=F.project(model,{basis:"calendar",start:m+"-01",end:monthEnd(m)});
    const match=x=>x.categoryId===a.categoryId&&x.currency===a.currency;
    const ambiguous=month.pending.some(match)||month.planned.some(x=>match(x)&&!x.date)||month.issues.length>0;
    let used=month.actuals.filter(match).reduce((s,x)=>sum(s,x.minor),0);
    const remains=new Map();
    for(const x of month.planned.filter(x=>match(x)&&x.date).sort((x,y)=>x.date.localeCompare(y.date)||x.id.localeCompare(y.id))){
     const applied=Math.min(used,x.minor);used-=applied;remains.set(x.id,x.minor-applied);
    }
    cache.set(k,{ambiguous,remains});
   }
   const entry=cache.get(k);
   if(entry.ambiguous){unresolved.push(a);continue}
   const remaining=entry.remains.get(a.id)||0;
   if(remaining){const row={...a,remainingMinor:remaining,type:model.categories.find(c=>c.id===a.categoryId)?.type};(a.date<=asOf?prior:next).push(row)}
  }
  return {next,prior,unresolved:[...new Map(unresolved.map(a=>[a.id,a])).values()],complete:!unresolved.length&&!p.issues.length};
 }
 function view(model,range,asOf,F){
  if(!valid(asOf)||!valid(range.start)||!valid(range.end)||range.start>range.end)throw Error("Intervalo inválido");
  const budget=F.project(model,{basis:"calendar",...range}),m=model.modules||{};
  const dateRows=k=>list(m,k).filter(x=>inRange(range,x.date));
  const pending=(k)=>list(m,k).filter(x=>x.minor>0&&!valid(x.date));
  const debts=dateRows("debts").filter(x=>x.minor>0),collections=dateRows("collections").filter(x=>x.minor>0);
  return {range,asOf,budget,operating:model.operating?.asOf===asOf?model.operating:null,
   future:{...datedPlan(model,range,asOf,F),debtCommitments:debts,receivables:collections,projectPlans:dateRows("projectPlans").filter(x=>x.remainingMinor>0),undated:[...pending("debts"),...pending("collections"),...list(m,"projectPlans").filter(x=>x.remainingMinor>0&&!valid(x.date))]},
   projects:list(m,"projects").map(p=>({...p,expenses:dateRows("projectExpenses").filter(x=>x.ownerId===p.id),plans:dateRows("projectPlans").filter(x=>x.ownerId===p.id),undated:list(m,"projectPlans").filter(x=>x.ownerId===p.id&&!valid(x.date))})).filter(p=>p.expenses.length||p.plans.length||p.undated.length||(!p.start||p.start<=range.end)&&(!p.end||p.end>=range.start)),
   goals:list(m,"goals").map(g=>({...g,activity:dateRows("goalActivity").filter(x=>x.ownerId===g.id),due:inRange(range,g.date),budget:budget.rows.filter(r=>r.id===g.categoryId)})),
   debts:{commitments:debts,payments:dateRows("debtPayments"),undated:pending("debts"),overdue:list(m,"debts").filter(x=>x.minor>0&&valid(x.date)&&x.date<asOf&&!inRange(range,x.date))},
   collections:{due:collections,payments:dateRows("collectionPayments"),undated:pending("collections"),overdue:list(m,"collections").filter(x=>x.minor>0&&valid(x.date)&&x.date<asOf&&!inRange(range,x.date))}};
 }
 return {nativeSnapshot,view,datedPlan};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV16System;
