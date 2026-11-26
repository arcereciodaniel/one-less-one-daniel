"use strict";
const oneV17Audit=(()=>{
 const FORMAT="one-less-one-v17-rc3-test-backup";
 const copy=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const sum=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))throw Error("Monto fuera de rango");return n};
 function grouped(items){const out={};for(const a of items){const k=JSON.stringify([a.categoryId,a.currency]);out[k]=sum(out[k]||0,a.minor)}return JSON.stringify(Object.entries(out).sort(([a],[b])=>a.localeCompare(b)))}
 function reconcile(base,model,F,month){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error("Mes inválido");
  const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10);
  const parentKeys=base.periods.filter(p=>p.financialMonth===month).map(p=>p.key);
  const legacy=F.project(base,{basis:"financial",parentKeys}),financial=F.project(model,{basis:"financial",parentKeys}),calendar=F.project(model,{basis:"calendar",start:month+"-01",end});
  const historicalOK=grouped(legacy.planned)===grouped(financial.planned)&&grouped(legacy.actuals)===grouped(financial.actuals);
  const newCalendar=calendar.planned.filter(a=>!a.parentKey),outsideFinancial=calendar.actuals.filter(a=>!parentKeys.includes(a.parentKey)),outsideCalendar=financial.actuals.filter(a=>a.date<month+"-01"||a.date>end);
  return {historicalOK,calendar:calendar.totals,financial:financial.totals,counts:{calendarOnlyAssignments:newCalendar.length,actualsOutsideFinancial:outsideFinancial.length,actualsOutsideCalendar:outsideCalendar.length,pending:calendar.pending.length},complete:calendar.complete};
 }
 function inspect(raw,base,model,F,P,legacyAudit){
  const report=P.audit(raw,base,F),issues=[...legacyAudit.issues.map(x=>({code:x.code,count:x.count})),...report.issues];
  const months=[...new Set(base.periods.map(p=>p.financialMonth))];let mismatches=0;
  for(const m of months)if(!reconcile(base,model,F,m).historicalOK)mismatches++;
  if(mismatches)issues.push({code:"historical-period-mismatch",count:mismatches});
  if(!same(base.actuals,model.actuals))issues.push({code:"actuals-changed",count:1});
  return {ready:legacyAudit.ready&&report.ready&&issues.length===0,counts:{...report.counts,financialMonths:months.length},issues};
 }
 function pack(serialized){const raw=JSON.parse(serialized);if(!raw||!Array.isArray(raw.movements))throw Error("Respaldo inválido");return JSON.stringify({format:FORMAT,ledger:raw})}
 function unpack(text){if(typeof text!=="string"||text.length>50*1024*1024)throw Error("Archivo inválido o demasiado grande");const obj=JSON.parse(text);if(obj?.format!==FORMAT||!obj.ledger||!Array.isArray(obj.ledger.periods)||!Array.isArray(obj.ledger.movements))throw Error("Solo respaldos de esta candidata de prueba");return copy(obj.ledger)}
 function prepare(text,expected,validate){const raw=unpack(text),report=validate(copy(raw));if(!report.ready)throw Error("El respaldo tiene incidencias de integridad");return {expected,serialized:JSON.stringify(raw),report}}
 function restore(preview,io,validate){if(!preview||io.read()!==preview.expected)throw Error("Los datos cambiaron; revisá nuevamente");const raw=JSON.parse(preview.serialized),report=validate(copy(raw));if(!report.ready||!same(report,preview.report))throw Error("La validación cambió");io.writeBackup(preview.expected);if(io.readBackup()!==preview.expected||io.read()!==preview.expected)throw Error("No se verificó el respaldo previo");io.write(preview.serialized);if(io.read()!==preview.serialized)throw Error("No se verificó la restauración");return report}
 return {reconcile,inspect,pack,unpack,prepare,restore};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17Audit;
