"use strict";
// A reversible, versioned extension of the original ledger. Never replaces source records.
const oneV16Storage=(()=>{
 const FIELD="v16AssignmentOverlay",clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const valid=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
 const inRange=(r,d)=>r.start<=d&&d<=r.end;
 const sum=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))throw Error("Monto fuera de rango");return n};
 const clean=a=>Object.fromEntries(["id","categoryId","currency","minor","source","date","start","end","parentKey","financialMonth","originId","originStart","originEnd"].filter(k=>a[k]!==undefined).map(k=>[k,a[k]]));
 const signature=a=>JSON.stringify(clean(a));
 function bare(raw){const copy=clone(raw);delete copy[FIELD];return copy}
 function shape(overlay){
  if(!overlay||overlay.version!==1||!Array.isArray(overlay.replacements)||!Array.isArray(overlay.added))throw Error("Extensión de presupuesto inválida");
  const seen=new Set();
  for(const r of overlay.replacements){if(!r||typeof r.originId!=="string"||!r.originId||seen.has(r.originId)||typeof r.signature!=="string"||!Array.isArray(r.rows)||!r.rows.length)throw Error("Origen histórico inválido");seen.add(r.originId)}
  return overlay;
 }
 function hydrate(raw,base,F){
  if(!Object.hasOwn(raw,FIELD))return base;
  const o=shape(raw[FIELD]),original=new Map(base.allocations.map(a=>[a.id,a])),removed=new Set(),rows=[];
  for(const r of o.replacements){
   const a=original.get(r.originId);
   if(!a||signature(a)!==r.signature)throw Error("El presupuesto histórico cambió; reconciliá la asignación antes de continuar.");
   if(a.date)throw Error("No se sustituye un ingreso histórico fechado");
   removed.add(a.id);let total=0;
   for(const b of r.rows){
    if(!b||b.source!=="dated"||b.originId!==a.id||b.originStart!==a.start||b.originEnd!==a.end||b.categoryId!==a.categoryId||b.currency!==a.currency||b.parentKey!==a.parentKey||b.financialMonth!==a.financialMonth||!valid(b.date)||!inRange(a,b.date)||!Number.isSafeInteger(b.minor)||b.minor<=0)throw Error("Distribución histórica inválida");
    total=sum(total,b.minor);rows.push(clean(b));
   }
   if(total!==a.minor)throw Error("La distribución no conserva el presupuesto original");
  }
  const retained=base.allocations.filter(a=>!removed.has(a.id)),ids=new Set(retained.map(a=>a.id)),slots=new Set(retained.filter(a=>a.date).map(a=>JSON.stringify([a.categoryId,a.currency,a.date])));
  for(const b of o.added){
   const c=base.categories.find(c=>c.id===b?.categoryId);
   if(!c||c.synthetic||!["Ingreso","Gasto","Pago deuda"].includes(c.type)||!b||!["dated","range"].includes(b.source)||b.parentKey!==undefined||b.financialMonth!==undefined||b.originId!==undefined||(b.source==="dated"?(!valid(b.date)||b.start!==undefined||b.end!==undefined):(!valid(b.start)||!valid(b.end)||b.start>b.end||b.date!==undefined))||!Number.isSafeInteger(b.minor)||b.minor<=0||!["CRC","USD"].includes(b.currency))throw Error("Nueva asignación inválida");
   if(retained.some(a=>a.categoryId===b.categoryId&&a.currency===b.currency&&(b.source==="range"?(a.date?inRange(b,a.date):a.start<=b.end&&b.start<=a.end):!a.date&&inRange(a,b.date))))throw Error("Nueva asignación superpuesta con presupuesto pendiente");
   rows.push(clean(b));
  }
  for(const a of rows){
   if(typeof a.id!=="string"||!a.id||ids.has(a.id))throw Error("Asignación duplicada");ids.add(a.id);
   if(a.date){const slot=JSON.stringify([a.categoryId,a.currency,a.date]);if(slots.has(slot))throw Error("Asignación duplicada");slots.add(slot)}
   if(a.source==="range"&&rows.some(b=>a!==b&&a.categoryId===b.categoryId&&a.currency===b.currency&&(b.date?inRange(a,b.date):b.start<=a.end&&a.start<=b.end)))throw Error("Asignaciones de intervalo superpuestas");
  }
  const model={...base,allocations:[...retained,...rows]};
  F.project(model,{basis:"calendar",start:"0001-01-01",end:"9999-12-31"});
  return model;
 }
 function encode(base,next){
  const orig=new Map(base.allocations.map(a=>[a.id,a])),remaining=new Map(next.allocations.map(a=>[a.id,a])),replacements=[],added=[];
  for(const a of base.allocations){
   if(remaining.has(a.id)&&signature(remaining.get(a.id))===signature(a)){remaining.delete(a.id);continue}
   const rows=[...remaining.values()].filter(b=>b.originId===a.id);
   if(!rows.length)throw Error("No se puede quitar un presupuesto histórico");
   replacements.push({originId:a.id,signature:signature(a),rows:rows.map(clean)});rows.forEach(b=>remaining.delete(b.id));
  }
  for(const a of remaining.values()){if(orig.has(a.id)||a.originId||a.parentKey)throw Error("Origen de asignación no reconocido");added.push(clean(a))}
  return {version:1,replacements,added};
 }
 function prepare(raw,base,command,F,E){
  const current=hydrate(raw,base,F),preview=E.stage(current,command);
  return {rawBaseline:JSON.stringify(raw),baseBaseline:JSON.stringify(base),preview};
 }
 function commit(raw,base,prepared,F,E){
  if(!prepared||prepared.rawBaseline!==JSON.stringify(raw)||prepared.baseBaseline!==JSON.stringify(base))throw Error("Los datos cambiaron. Revisá nuevamente.");
  const current=hydrate(raw,base,F),next=E.commit(current,prepared.preview),overlay=encode(base,next);
  const result={...bare(raw),[FIELD]:overlay},roundtrip=hydrate(result,base,F);
  const sorted=m=>m.allocations.map(signature).sort();
  if(!same(sorted(next),sorted(roundtrip))||!same(bare(result),bare(raw)))throw Error("No se pudo verificar la conservación del historial");
  return result;
 }
 // Persistence is injected; existing app's guard must be used in production.
 // A byte-identical backup is verified before any financial write. This is not cross-tab CAS.
 function persist({read,readBackup,writeBackup,write},expected,next){
  if(typeof expected!=="string"||read()!==expected)throw Error("Cambios externos detectados");
  if(readBackup()===null){writeBackup(expected);if(readBackup()!==expected)throw Error("No se pudo verificar el respaldo")}
  if(read()!==expected)throw Error("Cambios externos detectados");
  const serialized=JSON.stringify(next);write(serialized);if(read()!==serialized)throw Error("No se pudo verificar el guardado");
  return serialized;
 }
 function audit(raw,base,F){
  try{const model=hydrate(raw,base,F);return {ready:!model.issues.length,counts:{original:base.allocations.length,assignments:model.allocations.length,dated:model.allocations.filter(a=>a.date).length,undated:model.allocations.filter(a=>!a.date).length,actuals:model.actuals.length},issues:[...new Set(model.issues.map(x=>x.code))].map(code=>({code,count:model.issues.filter(x=>x.code===code).length}))}}catch{return {ready:false,counts:{},issues:[{code:"assignment-overlay-review",count:1}]}}
 }
 return {FIELD,bare,hydrate,prepare,commit,persist,audit};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV16Storage;
