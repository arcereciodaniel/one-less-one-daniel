"use strict";
// Read-only reconciliation. Do not rewrite dates, periods, ledger, or amounts.
const oneV17TransitionAudit=(()=>{
 const sum=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))throw Error("Monto fuera de rango");return n};
 function inspect(model,month,F){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error("Mes inválido");
  const start=month+"-01",end=new Date(Date.UTC(+month.slice(0,4),+month.slice(5),0)).toISOString().slice(0,10);
  const parentKeys=model.periods.filter(p=>p.financialMonth===month).map(p=>p.key);
  const financial=F.project(model,{basis:"financial",parentKeys}),calendar=F.budgetProject(model,{basis:"calendar",start,end,actualBasis:"date"}),reconciled=F.budgetProject(model,{basis:"calendar",start,end});
  const cats=new Map(model.categories.map(c=>[c.id,c])),rows=new Map();
  const row=a=>{const key=JSON.stringify([a.categoryId||a.id,a.currency]),id=a.categoryId||a.id,c=cats.get(id);if(!rows.has(key))rows.set(key,{id,name:c?.name||"Sin categoría",type:c?.type||"Sin categoría",currency:a.currency,oldPlan:0,newPlan:0,relatedPlan:0,oldActual:0,newActual:0,reconciledActual:0,carryMinor:0,onlyOld:0,onlyNew:0,items:[]});return rows.get(key)};
  for(const [field,items] of [["oldPlan",financial.planned],["newPlan",calendar.planned],["relatedPlan",calendar.pending],["oldActual",financial.actuals],["newActual",calendar.actuals],["reconciledActual",reconciled.actuals],["carryMinor",reconciled.actuals.filter(x=>x.transitionCarry)]])for(const a of items){const r=row(a);r[field]=sum(r[field],a.minor)}
  const old=new Set(financial.actuals.map(a=>a.id)),now=new Set(calendar.actuals.map(a=>a.id));
  for(const a of model.actuals){const was=old.has(a.id),is=now.has(a.id);if(!was&&!is)continue;const r=row(a),status=was&&is?"both":was?"onlyOld":"onlyNew";
   if(status!=="both")r[status]=sum(r[status],a.minor);
   r.items.push({id:a.id,sourceId:a.sourceId,date:a.date,month:a.financialMonth||null,type:a.type,source:a.source,minor:a.minor,currency:a.currency,status});
  }
  const result=[...rows.values()].map(r=>{if(r.newActual!==sum(r.oldActual-r.onlyOld,r.onlyNew))throw Error("No se pudo conciliar");return {...r,delta:r.newActual-r.oldActual,remaining:r.relatedPlan?null:r.newPlan-r.reconciledActual,items:r.items.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))}}).sort((a,b)=>a.name.localeCompare(b.name,"es")||a.currency.localeCompare(b.currency));
  return {month,start,end,periods:model.periods.filter(p=>parentKeys.includes(p.key)),rows:result,issues:model.issues||[]};
 }
 return {inspect};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17TransitionAudit;
