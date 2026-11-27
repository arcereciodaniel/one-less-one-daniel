"use strict";
// Pure, staged transactions for the normalized V16 model. No storage writes.
const oneV16Editor=(()=>{
 const valid=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
 const inside=(a,d)=>a.start<=d&&d<=a.end;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const add=(a,b)=>{const x=a+b;if(!Number.isSafeInteger(x))throw Error("Monto fuera de rango");return x};
 const amount=v=>{if(typeof v!=="number"||!Number.isFinite(v)||v<=0||!Number.isSafeInteger(Math.round(v*100))||Math.abs(v*100-Math.round(v*100))>1e-5)throw Error("Ingresá un monto positivo con hasta dos decimales.");return Math.round(v*100)};
 const totals=rows=>{const t={CRC:0,USD:0};for(const r of rows){if(!Object.hasOwn(t,r.currency)||!Number.isSafeInteger(r.minor)||r.minor<0)throw Error("Asignación inválida");t[r.currency]=add(t[r.currency],r.minor)}return t};
 function dates(start,frequency="once",count=1){
  if(!valid(start)||!["once","weekly","biweekly","monthly"].includes(frequency)||!Number.isInteger(count)||count<1||count>60||frequency==="once"&&count!==1)throw Error("Repetición inválida.");
  return Array.from({length:count},(_,i)=>{const d=new Date(start+"T00:00:00Z");if(frequency==="monthly"){const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+i);const end=new Date(d);end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);d.setUTCDate(Math.min(day,end.getUTCDate()))}else d.setUTCDate(d.getUTCDate()+i*(frequency==="biweekly"?14:7));const s=d.toISOString().slice(0,10);if(!valid(s))throw Error("Fecha fuera de rango");return s});
 }
 function stage(model,command){
  if(!model||!Array.isArray(model.allocations)||!Array.isArray(model.categories)||!Array.isArray(model.actuals)||!command)throw Error("Modelo inválido.");
  if(model.issues?.length)throw Error("Revisá las incidencias del historial antes de editar.");
  const F=typeof oneV16Finance!=="undefined"?oneV16Finance:require("./v16-financial-assignments.cjs");
  const old=model.allocations,ids=new Set();totals(old);for(const a of old){if(typeof a.id!=="string"||!a.id||ids.has(a.id))throw Error("ID de asignación duplicado");ids.add(a.id)}
  const {kind,id}=command;
  const creating=kind==="create"||kind==="create-range";
  const target=creating?null:old.find(a=>a.id===id);
  if(!creating&&!target)throw Error("La asignación ya no existe.");
  const category=cid=>{const c=model.categories.find(x=>x.id===cid);if(!c||c.synthetic||c.active===false||c.budgetable===false||!["Ingreso","Gasto","Pago deuda"].includes(c.type))throw Error("Categoría no disponible.");return c};
  const baseId=command.transactionId;if(typeof baseId!=="string"||!baseId||baseId.length>100)throw Error("Identificador de operación inválido.");
  let created=[],removed=[];
  function dated(cid,date,minor,currency,newId,extra={}){
   category(cid);if(!valid(date)||!["CRC","USD"].includes(currency)||!Number.isSafeInteger(minor)||minor<=0)throw Error("Asignación inválida.");
   return {id:newId,categoryId:cid,date,minor,currency,source:"dated",...extra};
  }
  if(kind==="create-range"||kind==="edit-range"){
   const {start,end,categoryId,currency}=command;category(categoryId);
   if(!valid(start)||!valid(end)||start>end||!["CRC","USD"].includes(currency))throw Error("Intervalo inválido.");
   if(kind==="edit-range"&&(target.source!=="range"||target.parentKey||target.originId||currency!==target.currency))throw Error("No se modifica el presupuesto original.");
   if(kind==="edit-range")removed=[target];
   created=[{id:target?.id||baseId+":0",categoryId,currency,minor:amount(command.amount),source:"range",start,end}];
  }else if(kind==="create"){
   const {categoryId,date,currency,frequency="once",count=1}=command;category(categoryId);
   created=dates(date,frequency,count).map((d,i)=>dated(categoryId,d,amount(command.amount),currency,baseId+":"+i));
  }else if(kind==="edit"){
   if(!target.date||target.source==="legacy-scheduled-income")throw Error("Esta asignación requiere revisión del origen.");
   const cid=command.categoryId??target.categoryId,unit=command.currency??target.currency;
   if(unit!==target.currency)throw Error("Para cambiar moneda, eliminá y creá una nueva asignación explícitamente.");
   const historical=target.parentKey||target.originId;
   if(historical&&(cid!==target.categoryId||amount(command.amount)!==target.minor||target.parentKey&&!model.periods.some(p=>p.key===target.parentKey&&inside(p,command.date))&&!inside(model.calendarSlots?.[target.parentKey]||{start:"~",end:""},command.date)||target.originId&&!inside({start:target.originStart,end:target.originEnd},command.date)&&!inside(model.calendarSlots?.[target.parentKey]||{start:"~",end:""},command.date)))throw Error("El monto y categoría históricos se conservan; solo podés mover la fecha dentro del período original.");
   removed=[target];created=[dated(cid,command.date,amount(command.amount),unit,target.id,{...(target.parentKey?{parentKey:target.parentKey,financialMonth:target.financialMonth}:{}),...(target.originId?{originId:target.originId,originStart:target.originStart,originEnd:target.originEnd}:{})})];
  }else if(kind==="transfer"){
   const {destinationCategoryId,date,range,asOf}=command,minor=amount(command.amount);
   const I=typeof oneV16Intelligence!=="undefined"?oneV16Intelligence:require("./v16-budget-intelligence.cjs");
   const option=I.donors(model,range,asOf,F,{categoryId:destinationCategoryId,date,currency:target.currency}).find(x=>x.id===target.id);
   if(!option||minor>option.maxMinor)throw Error("El monto supera el presupuesto que se puede redistribuir.");
   const existing=old.find(a=>a.date===date&&a.categoryId===destinationCategoryId&&a.currency===target.currency);
   removed=[target,...(existing?[existing]:[])];
   if(target.minor>minor)created.push({...target,minor:target.minor-minor});
   created.push(existing?{...existing,minor:add(existing.minor,minor)}:dated(destinationCategoryId,date,minor,target.currency,baseId+":0"));
  }else if(kind==="delete"){
   if((!target.date&&target.source!=="range")||target.parentKey||target.originId||target.source==="legacy-scheduled-income")throw Error("No se permite eliminar una asignación histórica.");
   removed=[target];
  }else if(kind==="distribute"){
   if(target.source==="range"||target.date||!valid(target.start)||!valid(target.end)||target.start>target.end)throw Error("La asignación no es un intervalo pendiente.");
   if(!Array.isArray(command.parts)||!command.parts.length||command.parts.length>60)throw Error("Ingresá las fechas de distribución.");
   created=command.parts.map((p,i)=>{if(!inside(model.calendarSlots?.[target.parentKey]?F.budgetBounds(model,target):target,p.date))throw Error("La fecha debe estar dentro del intervalo del presupuesto.");return dated(target.categoryId,p.date,amount(p.amount),target.currency,baseId+":"+i,{originId:target.originId||target.id,originStart:target.originStart||target.start,originEnd:target.originEnd||target.end,...(target.parentKey?{parentKey:target.parentKey,financialMonth:target.financialMonth}:{})})});
   if(created.reduce((s,x)=>add(s,x.minor),0)!==target.minor)throw Error("La distribución debe conservar exactamente el total original.");
   removed=[target];
  }else throw Error("Operación no disponible.");
  const retained=old.filter(a=>!removed.some(r=>r.id===a.id)),used=new Set(retained.map(a=>a.id)),slots=new Set(retained.filter(a=>a.date).map(a=>JSON.stringify([a.categoryId,a.currency,a.date])));
  for(const a of created){
   if(used.has(a.id))throw Error("ID de asignación duplicado.");used.add(a.id);
   if(model.calendarSlots&&!a.parentKey&&["create","create-range","edit","edit-range","transfer"].includes(kind)&&retained.some(x=>x.parentKey&&F.budgetOverlaps(model,a,x)&&!F.budgetAllocation(model,x).date))throw Error("Ya existe presupuesto histórico en este intervalo. Distribuí el monto existente.");
   if(a.source==="range"){
    const overlaps=x=>x.categoryId===a.categoryId&&x.currency===a.currency&&(x.date?inside(a,x.date):x.start<=a.end&&a.start<=x.end);
    if(retained.some(overlaps)||created.some(x=>x!==a&&overlaps(x)))throw Error("Ya existe presupuesto para esta categoría en parte del intervalo. Editá el existente.");
    continue;
   }
   const slot=JSON.stringify([a.categoryId,a.currency,a.date]);if(slots.has(slot))throw Error("Ya existe una asignación para esta categoría, moneda y fecha. Editala o elegí otra fecha.");slots.add(slot);
   if((kind==="create"||kind==="transfer"||kind==="edit"&&(a.date!==target.date||a.categoryId!==target.categoryId||a.minor>target.minor))&&retained.some(x=>!x.date&&x.categoryId===a.categoryId&&x.currency===a.currency&&inside(x,a.date)))throw Error("Esta categoría tiene presupuesto pendiente de distribuir en esa fecha. Distribuí primero el monto existente.");
  }
  const next=[...retained,...created],before=totals(old),after=totals(next);
  if(kind==="transfer"&&(before.CRC!==after.CRC||before.USD!==after.USD))throw Error("La redistribución debe conservar los totales.");
  return {command:clone(command),baseline:JSON.stringify(model),created:clone(created),removed:clone(removed),before,after,delta:{CRC:after.CRC-before.CRC,USD:after.USD-before.USD}};
 }
 function commit(model,preview){
  if(!preview||preview.baseline!==JSON.stringify(model))throw Error("Los datos cambiaron. Revisá nuevamente la operación.");
  const fresh=stage(model,preview.command);
  if(JSON.stringify(fresh)!==JSON.stringify(preview))throw Error("Vista previa modificada. Volvé a revisar.");
  const removed=new Set(fresh.removed.map(x=>x.id));
  return {...clone(model),allocations:[...clone(model.allocations.filter(a=>!removed.has(a.id))),...clone(fresh.created)]};
 }
 return {dates,stage,commit};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV16Editor;
