"use strict";
const oneV17Links=(()=>{
 const FIELD="v17ProjectBudgetLinks",copy=x=>JSON.parse(JSON.stringify(x));
 function read(raw){
  const rows=raw[FIELD]===undefined?[]:raw[FIELD];
  if(!Array.isArray(rows))throw Error("Vínculos de presupuesto inválidos");
  const plans=new Set(),assignments=new Set();
  for(const x of rows){if(!x||typeof x.planId!=="string"||!x.planId||typeof x.assignmentId!=="string"||!x.assignmentId||plans.has(x.planId)||assignments.has(x.assignmentId))throw Error("Vínculo duplicado o inválido");plans.add(x.planId);assignments.add(x.assignmentId)}
  return copy(rows);
 }
 function compatible(model,plan,assignment){
  return !!(plan&&assignment&&plan.remainingMinor>0&&plan.date&&plan.date===assignment.date&&plan.currency===assignment.currency&&assignment.minor>=plan.remainingMinor&&model.categories.find(c=>c.id===assignment.categoryId)?.type==="Gasto");
 }
 function options(raw,model,planId){
  const links=read(raw),plan=(model.modules?.projectPlans||[]).find(x=>x.id===planId);
  return model.allocations.filter(a=>compatible(model,plan,a)&&!links.some(x=>x.assignmentId===a.id&&x.planId!==planId));
 }
 function stage(raw,model,planId,assignmentId){
  if(typeof planId!=="string"||!planId)throw Error("Previsión inválida");
  const rows=read(raw).filter(x=>x.planId!==planId);
  if(assignmentId){if(model.issues.length||!options(raw,model,planId).some(a=>a.id===assignmentId))throw Error("La asignación no coincide con la previsión");rows.push({planId,assignmentId})}
  return {...copy(raw),[FIELD]:rows};
 }
 function status(raw,model){
  return read(raw).map(link=>({...link,valid:compatible(model,(model.modules?.projectPlans||[]).find(x=>x.id===link.planId),model.allocations.find(a=>a.id===link.assignmentId))}));
 }
 // A link never creates a cash event. Only a confirmed exact residual can satisfy the project.
 function reconcile(raw,model,forecast,asOf,rates){
  const covered=[],review=[],links=status(raw,model),plans=(model.modules?.projectPlans||[]).filter(p=>p.remainingMinor>0&&(!p.date||p.date<=forecast.end));
  for(const p of plans){
   const link=links.find(x=>x.planId===p.id),a=link?.valid?model.allocations.find(a=>a.id===link.assignmentId):null;
   const e=a&&forecast.events.find(x=>x.id==="plan:"+a.id&&x.kind==="planned"&&x.date===p.date);
   const fx=p.currency==="CRC"?1:rates.sell;
   if(forecast.balance!==null&&p.date>asOf&&e&&Number.isFinite(fx)&&fx>0&&-e.minor===Math.round(p.remainingMinor*fx))covered.push(p.id);
   else review.push(p.id);
  }
  const reasons=forecast.reasons.filter(c=>c!=="project-review"||review.length>0);
  return {...forecast,reasons,counts:{...forecast.counts,pending:Math.max(0,forecast.counts.pending-covered.length),coveredProjects:covered.length},coveredProjects:covered,reviewProjects:review};
 }
 return {FIELD,read,options,stage,status,reconcile};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17Links;
