"use strict";
const oneV17Handoff=(()=>{
 const LEGACY="daniel_finanzas_local_v1",PREFS=LEGACY+"_iphone_pilot_v1",PREFIX="olo_v17_daniel_",ACTIVE=PREFIX+"data_v1",SOURCE=ACTIVE+"_original_migration_source";
 const ORIGIN="https://arcereciodaniel.github.io",PATH="/one-less-one-daniel/v17/";
 function source(io){
  if(io.read(PREFS)!==null)throw Error("Desvinculá el piloto en V16 y cerrá todas sus pestañas");
  const raw=io.read(LEGACY);
  if(typeof raw!=="string")throw Error("No se encontró el registro original de Daniel");
  return raw;
 }
 function assertSource(io,expected){
  if(typeof expected!=="string"||source(io)!==expected)throw Error("V16 cambió; no se puede escribir ni sincronizar V17");
  return true;
 }
 function assertActive(io,M){
  const active=io.read(ACTIVE),original=io.read(SOURCE);
  if(!active||!M.isPrivate(JSON.parse(active)))throw Error("Primero activá la copia V17");
  assertSource(io,original);return true;
 }
 function locationAllowed(origin,path){return origin===ORIGIN&&(path===PATH||path===PATH+"index.html")}
 return {LEGACY,PREFS,PREFIX,ACTIVE,SOURCE,ORIGIN,PATH,source,assertSource,assertActive,locationAllowed};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17Handoff;
