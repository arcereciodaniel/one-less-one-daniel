"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{buildCandidate:migration}=require("./build-v17-migration-lab.cjs");
const root=path.resolve(__dirname,"..");
function buildCandidate(){
 let h=migration().replaceAll("rastro_lab_v17_migration_preview_","rastro_lab_v17_prerelease_").replaceAll("_pre_v17_migration","_pre_v17_prerelease").replaceAll("_before_migration_restore","_before_prerelease_restore").replaceAll("V17.0 LAB","V17.0 PRE").replaceAll("v17-migration-test-backup","v17-prerelease-test-backup");
 const rep=(a,b)=>{assert.equal(h.split(a).length,2,"Marker: "+a);h=h.replace(a,()=>b)};
 rep('<p id="rc-migrationStatus" role="status"></p>','<p id="rc-migrationStatus" role="status"></p><label for="rc-sessionFile">O trasladar sesión privada V17</label><input id="rc-sessionFile" type="file" accept=".json,application/json"><p id="rc-sessionStatus" role="status"></p><button type="button" class="btn secondary" id="rc-sessionConfirm" disabled>Importar sesión</button>');
 rep('function updateMigrationControls(){',`
let sessionDraft=null,sessionGeneration=0;
function sessionActiveValidation(raw,asOf){
 const saved=data,before=localStorage.getItem(STORAGE_KEY);
 try{
  restoreValidate(raw);data=restorePrepare(raw);
  if(!M.isPrivate(data))throw Error("Marcador de sesión perdido");
  L.read(data);C.read(data);
  const {base,model}=B.snapshot(rawNow(),api,asOf,F,S,P);
  const report=A.inspect(data,base,model,F,P,oneV15QueryCore.releaseAudit(data));
  if(localStorage.getItem(STORAGE_KEY)!==before)throw Error("La revisión modificó almacenamiento");
  return report;
 }finally{data=saved}
}
el("sessionFile").onchange=async()=>{
 const generation=++sessionGeneration;sessionDraft=null;el("sessionConfirm").disabled=true;
 const file=el("sessionFile").files[0],out=el("sessionStatus");out.textContent="";if(!file)return;
 try{
  if(file.size>50*1024*1024||M.isPrivate(data)||nativeBlocked)throw Error("Sesión no disponible");
  const expected=oneStorageSnapshot,text=await file.text();if(generation!==sessionGeneration)return;
  const draft=U.prepare(text,expected,todayIso(),M,migrationValidation,sessionActiveValidation);
  if(!draft.ready){out.textContent="La sesión requiere revisión. No se importó.";return}
  if(migrationIO.readSource()!==null&&migrationIO.readSource()!==draft.source)throw Error("El original no coincide");
  sessionDraft=draft;out.textContent="Sesión validada. Conserva el respaldo original y la copia activa con sus asignaciones y vínculos.";el("sessionConfirm").disabled=false;
 }catch{if(generation===sessionGeneration)out.textContent="No se pudo validar la sesión. No se importó."}
 finally{if(generation===sessionGeneration)el("sessionFile").value=""}
};
el("sessionConfirm").onclick=()=>{
 try{
  if(!sessionDraft||nativeBlocked||M.isPrivate(data)||!confirm("¿Trasladar la sesión privada a esta pre-release?"))return;
  oneStorageAssertCurrent();U.commit(sessionDraft,migrationIO,M,migrationValidation,sessionActiveValidation,true);sessionDraft=null;location.reload();
 }catch{el("sessionStatus").textContent="No se pudo activar la sesión. Revisá el almacenamiento local.";el("sessionConfirm").disabled=true}
};
function updateMigrationControls(){`);
 rep('el("migrationFile").disabled=active||hasSource||nativeBlocked;','el("migrationFile").disabled=active||nativeBlocked;el("sessionFile").disabled=active||nativeBlocked;el("sessionConfirm").disabled=true;');
 rep('Existe una copia original sin activar. Borrá este Lab para volver a empezar.','Importación interrumpida. Elegí el mismo respaldo original o la misma sesión privada para reintentar sin borrar nada.');
 rep('if(M.isPrivate(data)||migrationIO.readSource()!==null||nativeBlocked)','if(M.isPrivate(data)||nativeBlocked)');
 rep('const draft=M.prepare(text,expected,todayIso(),migrationValidation);','const draft=M.prepare(text,expected,todayIso(),migrationValidation);if(migrationIO.readSource()!==null&&migrationIO.readSource()!==draft.source)throw Error("El original no coincide");');
 rep('M.commit(migrationDraft,migrationIO,migrationValidation);','M.commit(migrationDraft,migrationIO,migrationValidation,true);');
 rep('el("closeIntegrity").onclick=()=>{migrationGeneration++;','el("closeIntegrity").onclick=()=>{sessionGeneration++;sessionDraft=null;el("sessionFile").value="";el("sessionStatus").textContent="";el("sessionConfirm").disabled=true;migrationGeneration++;');
 rep('active?"Lab privado · Copia de respaldo · "+TODAY+" · Sin conexión":"Lab privado · Datos ficticios · Fecha simulada: "+TODAY+" · Sin conexión"','active?"V17 Pre-release · Copia privada · "+TODAY+" · Sin conexión":"V17 Pre-release · Datos ficticios · Fecha simulada: "+TODAY+" · Sin conexión"');
 assert(!h.includes("rastro_lab_v17_migration_preview_"));assert(!h.includes("daniel_finanzas_local_v1"));assert(!h.includes("rastro_lab_v7_1_data_v1"));assert(h.includes("connect-src 'none'"));return h;
}
function buildPackage(dir){
 const target=path.join(dir,"lab","v17");fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,"index.html"),buildCandidate());
 // Staging only. Do not copy this to the published site before approval.
 fs.writeFileSync(path.join(dir,"LEEME.txt"),"V17 PRE-RELEASE — PAQUETE DE PRUEBA, NO PUBLICADO. Abrí lab/v17/index.html en Chrome/Edge desde una copia descomprimida o servilo localmente. Almacenamiento separado de Daniel, Lab V16 y Lab privado. Importá un respaldo V16.0 o una sesión privada V17 (exportada desde el Lab actualizado); nunca restaurés el JSON de sesión en V16.0. Sin conexión a Cloudflare. No reemplaza index.html ni lab/index.html existentes. Futuro parcial. No subir datos privados a GitHub.");
}
if(require.main===module)buildPackage(path.join(root,"preview-v17-prerelease"));
module.exports={buildCandidate,buildPackage};
