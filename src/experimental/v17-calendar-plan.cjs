"use strict";
const oneV17CalendarPlan=(()=>{
 const valid=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
 const next=d=>new Date(Date.parse(d+"T00:00:00Z")+86400000).toISOString().slice(0,10);
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function preview(raw,asOf,frequency,days,Q,endFor){
  if(!valid(asOf)||!["weekly","biweekly","semimonthly","monthly"].includes(frequency)||![30,60,90].includes(days))throw Error("Configuración inválida");
  if(!Array.isArray(raw.periods)||!raw.periods.length)throw Error("No hay períodos de referencia");
  const end=raw.periods.map(endFor).sort().at(-1);
  if(!valid(end)||end<asOf)throw Error("El calendario terminó; revisá el intervalo faltante");
  const proposal={start:next(end),frequency,days};
  const check=Q.transitionPreflight(raw,proposal,asOf,endFor);
  const future=(raw.movements||[]).filter(x=>x.date>=proposal.start);
  const futureReserves=(raw.reserveMovements||[]).filter(x=>x.date>=proposal.start);
  const futureReconciliations=(raw.reconciliations||[]).filter(x=>x.date>=proposal.start);
  const issues=[...check.issues];
  if(future.length||futureReserves.length||futureReconciliations.length)issues.push("future-records");
  if(raw.v15CalendarTransition)issues.push("existing-transition");
  return {...check,proposal,ready:!issues.length,issues:[...new Set(issues)]};
 }
 function stage(raw,asOf,frequency,days,Q,endFor){
  const p=preview(raw,asOf,frequency,days,Q,endFor);
  if(!p.ready)throw Error("El calendario requiere revisión");
  const record={...p.proposal,status:"prepared",boundary:p.boundary};
  const {ledger,createdKeys}=Q.materializeTransition(raw,record,asOf,endFor);
  if(!same(ledger.periods.slice(0,raw.periods.length),raw.periods)||!same({...ledger,periods:raw.periods},raw))throw Error("Cambió el historial");
  return {preview:p,newRows:ledger.periods.slice(raw.periods.length),createdKeys};
 }
 // Check each original record and its resolved period boundaries, then keep proposed rows isolated.
 function verify(before,after,asOf,endFor){
  if(!same(after.periods.slice(0,before.periods.length),before.periods)||!same({...after,periods:before.periods},before))throw Error("Cambió el historial");
  const oldEnds=before.periods.map(p=>endFor(p,before.periods,before.settings));
  const newEnds=before.periods.map(p=>endFor(p,after.periods,after.settings));
  if(!same(oldEnds,newEnds))throw Error("Cambió un límite histórico");
  const rows=after.periods.slice(before.periods.length);
  let cursor=next(oldEnds.slice().sort().at(-1));
  for(const p of rows){if(p.date!==cursor||p.date<=asOf||!valid(p.endDate)||p.endDate<p.date)throw Error("Calendario discontinuo");cursor=next(p.endDate)}
  return true;
 }
 return {preview,stage,verify};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17CalendarPlan;
