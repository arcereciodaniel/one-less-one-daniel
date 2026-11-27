"use strict";
const oneV17Migration=(()=>{
 const FIELD="v17MigrationRehearsal",FORMAT="v17-private-lab-v1",copy=x=>JSON.parse(JSON.stringify(x));
 const dateOK=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
 function parse(text){
  if(typeof text!=="string"||text.length>50*1024*1024)throw Error("Archivo inválido");
  const raw=JSON.parse(text);
  if(!raw||Array.isArray(raw)||raw.version!==6.2||!Array.isArray(raw.periods)||!Array.isArray(raw.movements)||!Array.isArray(raw.debts)||!Array.isArray(raw.categories)||!raw.settings||[FIELD,"v16AssignmentOverlay","v17ProjectBudgetLinks","v17CashCommitmentLinks"].some(k=>Object.hasOwn(raw,k)))throw Error("Solo respaldo original compatible V16.0");
  return raw;
 }
 function prepare(text,expected,asOf,validate){
  if(!dateOK(asOf)||typeof expected!=="string")throw Error("Estado local inválido");
  const raw=parse(text),report=validate(copy(raw),asOf);
  if(!report||!report.ready) return {ready:false,report};
  // The original text is kept separately; the active copy adds only a rehearsal marker.
  const next={...raw,[FIELD]:{format:FORMAT,importDate:asOf}};
  return {ready:true,expected,source:text,serialized:JSON.stringify(next),asOf,report};
 }
 function commit(draft,io,validate){
  if(!draft?.ready||io.read()!==draft.expected||io.readSource()!==null)throw Error("La sesión cambió; no se importó el archivo");
  const verified=prepare(draft.source,draft.expected,draft.asOf,validate);
  if(!verified.ready||verified.serialized!==draft.serialized||JSON.stringify(verified.report)!==JSON.stringify(draft.report))throw Error("La revisión cambió");
  io.writeSource(draft.source);
  if(io.readSource()!==draft.source||io.read()!==draft.expected)throw Error("No se verificó la copia original");
  io.write(draft.serialized);
  if(io.read()!==draft.serialized)throw Error("No se verificó la copia activa");
 }
 function isPrivate(raw){return raw?.[FIELD]?.format===FORMAT&&dateOK(raw[FIELD].importDate)}
 function resetCopy(source,expected,asOf,io,validate){
  if(io.read()!==expected||io.readSource()!==source||!isPrivate(JSON.parse(expected)))throw Error("La sesión cambió");
  const p=prepare(source,expected,asOf,validate);
  if(!p.ready)throw Error("La copia original requiere revisión");
  io.writePrevious(expected);
  if(io.readPrevious()!==expected||io.read()!==expected||io.readSource()!==source)throw Error("No se verificó el respaldo previo");
  io.write(p.serialized);
  if(io.read()!==p.serialized)throw Error("No se verificó la restauración");
 }
 return {FIELD,parse,prepare,commit,isPrivate,resetCopy};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17Migration;
