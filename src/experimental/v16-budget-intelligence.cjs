"use strict";
const oneV16Intelligence=(()=>{
 const valid=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
 const inside=(r,d)=>r.start<=d&&d<=r.end;
 const add=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))throw Error("Monto fuera de rango");return n};
 const rangeOK=r=>r&&valid(r.start)&&valid(r.end)&&r.start<=r.end;
 function analyze(model,range,asOf,F){
  if(!valid(asOf)||!rangeOK(range))throw Error("Intervalo inválido");
  const p=(F.budgetProject||F.project)(model,{basis:"calendar",...range}),status=asOf<range.start?"future":asOf>range.end?"closed":"current";
  const rows=p.rows.filter(r=>r.type!=="Ingreso").map(r=>{
   const match=a=>a.categoryId===r.id&&a.currency===r.currency;
   const actual=p.actuals.filter(a=>match(a)&&a.date<=asOf).reduce((s,a)=>add(s,a.minor),0);
   const plans=p.planned.filter(match),due=plans.filter(a=>a.date&&a.date<=asOf).reduce((s,a)=>add(s,a.minor),0);
   const incomplete=r.pendingMinor>0||p.issues.length>0;
   return {...r,actualToDateMinor:actual,dueMinor:due,remainingToDateMinor:incomplete?null:r.plannedMinor-actual,signal:incomplete?"review":!actual?"none":!r.plannedMinor?"unplanned":actual>r.plannedMinor?"over":status==="current"&&plans.every(a=>a.date)&&actual>due?"ahead":"none"};
  });
  const totals={};for(const r of rows){const t=totals[r.currency]??={unplannedMinor:0,overMinor:0,remainingMinor:0,pendingCategories:0};if(r.signal==="unplanned")t.unplannedMinor=add(t.unplannedMinor,r.actualToDateMinor);if(r.signal==="over")t.overMinor=add(t.overMinor,r.actualToDateMinor-r.plannedMinor);if(r.remainingToDateMinor!==null)t.remainingMinor=add(t.remainingMinor,Math.max(0,r.remainingToDateMinor));if(r.signal==="review")t.pendingCategories++}
  return {status,rows,totals,issues:p.issues,pending:p.pending,asOf};
 }
 function donors(model,range,asOf,F,destination){
  if(!rangeOK(range)||!valid(asOf)||!inside(range,asOf)||!valid(destination.date)||!inside(range,destination.date)||destination.date<asOf||model.issues?.length)return [];
  const p=(F.budgetProject||F.project)(model,{basis:"calendar",...range});
  const protectedCat=c=>!c||c.synthetic||c.active===false||c.budgetable===false||c.type!=="Gasto"||c.isSavings||c.protected||/ahorro|inversi[oó]n|meta/i.test(c.name||"")||model.actuals.some(a=>a.categoryId===c.id&&a.source==="saving");
  const c=model.categories.find(c=>c.id===destination.categoryId);
  if(protectedCat(c))return [];
  const target=p.rows.find(r=>r.id===c.id&&r.currency===destination.currency);
  if(!target||target.pendingMinor||target.actualMinor<=target.plannedMinor)return [];
  const existing=model.allocations.filter(x=>x.date===destination.date&&x.categoryId===c.id&&x.currency===destination.currency);
  if(existing.length>1||existing.some(x=>x.parentKey||x.originId||x.source!=="dated"))return [];
  const need=target.actualMinor-target.plannedMinor;
  return p.planned.filter(a=>a.date&&a.date>=asOf&&a.currency===destination.currency&&a.categoryId!==c.id&&!a.parentKey&&!a.originId&&a.source==="dated").flatMap(a=>{
   const r=p.rows.find(r=>r.id===a.categoryId&&r.currency===a.currency);
   if(protectedCat(model.categories.find(c=>c.id===a.categoryId))||!r||r.pendingMinor)return [];
   const month=a.date.slice(0,7),last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10);
   const wider=(F.budgetProject||F.project)(model,{basis:"calendar",start:month+"-01"<range.start?month+"-01":range.start,end:last>range.end?last:range.end});
   const wr=wider.rows.find(x=>x.id===a.categoryId&&x.currency===a.currency);
   if(!wr||wr.pendingMinor)return [];
   const maxMinor=Math.min(a.minor,r.plannedMinor-r.actualMinor,wr.plannedMinor-wr.actualMinor,need);
   return maxMinor>0?[{id:a.id,categoryId:a.categoryId,date:a.date,currency:a.currency,maxMinor,needMinor:need}]:[];
  }).sort((a,b)=>b.maxMinor-a.maxMinor||a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 }
 return {analyze,donors};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV16Intelligence;
