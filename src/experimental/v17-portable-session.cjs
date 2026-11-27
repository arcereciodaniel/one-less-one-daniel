"use strict";
const oneV17Session=(()=>{
 const FORMAT="one-less-one-v17-private-session-v1",MAX=50*1024*1024;
 function pack(source,active,M){
  M.parse(source);const a=JSON.parse(active);
  if(!M.isPrivate(a))throw Error("No hay sesión privada activa");
  const text=JSON.stringify({format:FORMAT,source,active});if(text.length>MAX)throw Error("Respaldo demasiado grande");return text;
 }
 function prepare(text,expected,asOf,M,validateSource,validateActive){
  if(typeof text!=="string"||text.length>MAX||typeof expected!=="string")throw Error("Archivo inválido");
  const p=JSON.parse(text);if(p?.format!==FORMAT||typeof p.source!=="string"||typeof p.active!=="string")throw Error("Formato de sesión privada inválido");
  const original=M.prepare(p.source,expected,asOf,validateSource);
  const active=JSON.parse(p.active);if(!M.isPrivate(active))throw Error("La copia activa no es privada");
  const report=validateActive(active,asOf);if(!original.ready||!report.ready)return {ready:false,report:{source:original.report,active:report}};
  return {ready:true,expected,source:p.source,serialized:p.active,asOf,report:{source:original.report,active:report}};
 }
 function commit(draft,io,M,validateSource,validateActive,allowResume=false){
  const existing=io.readSource();
  if(!draft?.ready||io.read()!==draft.expected||M.isPrivate(JSON.parse(draft.expected))||(existing!==null&&(!allowResume||existing!==draft.source)))throw Error("La sesión cambió o ya existe");
  const checked=prepare(pack(draft.source,draft.serialized,M),draft.expected,draft.asOf,M,validateSource,validateActive);
  if(!checked.ready||JSON.stringify(checked.report)!==JSON.stringify(draft.report))throw Error("La validación cambió");
  if(existing===null)io.writeSource(draft.source);if(io.readSource()!==draft.source||io.read()!==draft.expected)throw Error("No se verificó el original");
  io.write(draft.serialized);if(io.read()!==draft.serialized)throw Error("No se verificó la sesión");
 }
 return {FORMAT,pack,prepare,commit};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17Session;
