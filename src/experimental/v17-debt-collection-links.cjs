"use strict";
const oneV17Commitments=(()=>{
 const FIELD="v17CashCommitmentLinks",copy=x=>JSON.parse(JSON.stringify(x));
 const valid=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
 const key=d=>JSON.stringify([d.debtId,d.due]);
 function read(raw){
  const rows=raw[FIELD]===undefined?[]:raw[FIELD],keys=new Set(),assignments=new Set();
  if(!Array.isArray(rows))throw Error("Vínculos de compromisos inválidos");
  for(const x of rows){
   if(!x||!["debt","collection"].includes(x.kind)||typeof x.id!=="string"||!x.id||typeof x.assignmentId!=="string"||x.kind==="debt"&&(!x.assignmentId||x.mode!=="debt")||x.kind==="collection"&&(!["income","reimbursement"].includes(x.mode)||x.mode==="reimbursement"&&x.assignmentId)||keys.has(JSON.stringify([x.kind,x.id]))||x.assignmentId&&assignments.has(x.assignmentId))throw Error("Vínculo de compromiso inválido o duplicado");
   keys.add(JSON.stringify([x.kind,x.id]));if(x.assignmentId)assignments.add(x.assignmentId);
  }return copy(rows);
 }
 function occurrences(items){return items.filter(x=>x.kind==="debt"&&typeof x.debtId==="string"&&x.debtId&&valid(x.due)&&valid(x.date)&&Number.isSafeInteger(Math.round(-x.amount*100))&&x.amount<0).map(x=>({id:key(x),debtId:x.debtId,due:x.due,date:x.date,minor:Math.round(-x.amount*100),currency:"CRC",name:x.label}));}
 function options(raw,model,debts,kind,id,mode){
  const rows=read(raw),x=kind==="debt"?debts.find(d=>d.id===id):(model.modules?.collections||[]).find(c=>c.id===id);
  if(!x||model.issues.length||!valid(x.date)||x.minor<=0||kind==="collection"&&mode!=="income")return [];
  return model.allocations.filter(a=>a.date===x.date&&a.currency===x.currency&&a.minor===x.minor&&model.categories.find(c=>c.id===a.categoryId)?.type===(kind==="debt"?"Pago deuda":"Ingreso")&&!rows.some(r=>r.assignmentId===a.id&&(r.kind!==kind||r.id!==id))&&!(raw.v17ProjectBudgetLinks||[]).some(r=>r.assignmentId===a.id));
 }
 function stage(raw,model,debts,{kind,id,mode,assignmentId=""}){
  if(!["debt","collection"].includes(kind)||typeof id!=="string"||!id)throw Error("Compromiso inválido");
  const rows=read(raw).filter(x=>x.kind!==kind||x.id!==id);
  if(mode==="none")return {...copy(raw),[FIELD]:rows};
  if(kind==="debt"&&mode!=="debt"||kind==="collection"&&!["income","reimbursement"].includes(mode))throw Error("Clasificación inválida");
  if(kind==="collection"&&!(model.modules?.collections||[]).some(c=>c.id===id))throw Error("Cobro no disponible");
  if(kind==="debt"&&!assignmentId||mode==="reimbursement"&&assignmentId||assignmentId&&!options(raw,model,debts,kind,id,mode).some(a=>a.id===assignmentId))throw Error("La asignación no coincide exactamente");
  rows.push({kind,id,mode,assignmentId});const next={...copy(raw),[FIELD]:rows};read(next);return next;
 }
 function reconcile(raw,model,forecast,debts,asOf,rates){
  const rows=read(raw),coveredDebt=[],coveredCollections=[],review=[],classification={income:0,reimbursement:0};
  const active=forecast.balance!==null&&!model.issues.length;
  for(const r of rows){
   const a=model.allocations.find(x=>x.id===r.assignmentId);
   const x=r.kind==="debt"?debts.find(d=>d.id===r.id):(model.modules?.collections||[]).find(c=>c.id===r.id);
   if(!x||!valid(x.date)||x.date<=asOf||x.date>forecast.end){if(!x)review.push(r.id);continue}
   if(r.kind==="collection"){classification[r.mode]++;if(x.minor===0)continue}
   if(!active||!a||!options(raw,model,debts,r.kind,r.id,r.mode).some(y=>y.id===a.id)){review.push(r.id);continue}
   if(r.kind==="debt"){
    // Only exact CRC minimum with no execution in its category on that date.
    // Native event is already included; never add it again.
    const actual=model.actuals.some(m=>m.categoryId===a.categoryId&&m.date===a.date&&m.minor>0);
    const native=forecast.events.find(e=>e.kind==="debt"&&e.debtId===x.debtId&&e.due===x.due&&e.date===x.date&&e.minor===-x.minor);
    if(!actual&&native)coveredDebt.push(a.id);else review.push(r.id);
   }else{
    const fx=x.currency==="CRC"?1:rates.buy;
    const event=forecast.events.find(e=>e.id==="plan:"+a.id&&e.kind==="planned"&&e.date===x.date);
    if(r.mode==="income"&&event&&Number.isFinite(fx)&&fx>0&&event.minor===Math.round(x.minor*fx))coveredCollections.push(x.id);else review.push(r.id);
   }
  }
  const relevantDebts=model.allocations.filter(a=>a.date>asOf&&a.date<=forecast.end&&model.categories.find(c=>c.id===a.categoryId)?.type==="Pago deuda");
  const relevantCollections=(model.modules?.collections||[]).filter(c=>c.minor>0&&(!c.date||c.date<=forecast.end));
  const reasons=forecast.reasons.filter(c=>c!=="debt-budget-review"||relevantDebts.some(a=>!coveredDebt.includes(a.id))).filter(c=>c!=="collection-review"||relevantCollections.some(x=>!coveredCollections.includes(x.id)));
  return {...forecast,reasons,counts:{...forecast.counts,pending:Math.max(0,forecast.counts.pending-coveredDebt.length-coveredCollections.length),coveredDebt:coveredDebt.length,coveredCollections:coveredCollections.length},classification,review};
 }
 return {FIELD,read,occurrences,options,stage,reconcile};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17Commitments;
