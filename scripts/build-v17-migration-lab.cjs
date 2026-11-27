"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{buildCandidate:rc8}=require("./build-v17-rc8.cjs");
const root=path.resolve(__dirname,"..");
function buildCandidate(){
 let h=rc8().replaceAll("rastro_lab_v17_rc8_preview_","rastro_lab_v17_migration_preview_").replaceAll("_pre_v17_rc8","_pre_v17_migration").replaceAll("_before_rc8_restore","_before_migration_restore").replaceAll("V17.0 RC8","V17.0 LAB").replaceAll("RC8 técnica","Lab de migración").replaceAll("v17-rc8-test-backup","v17-migration-test-backup");
 const rep=(a,b)=>{assert.equal(h.split(a).length,2,"Marker: "+a);h=h.replace(a,()=>b)};
 // Never generate recurring charges just by opening hidden native panels.
 rep('ensureRecurringChargesForMonth(month);refreshSharedGroupSelects();','refreshSharedGroupSelects();');
 rep('const V=oneV17Available,C=oneV17Commitments,L=oneV17Links,Q=oneV17Forecast,A=oneV17Audit,O=oneV17Operations;',fs.readFileSync(path.join(root,"src/experimental/v17-migration-rehearsal.cjs"),"utf8")+'\nconst M=oneV17Migration,V=oneV17Available,C=oneV17Commitments,L=oneV17Links,Q=oneV17Forecast,A=oneV17Audit,O=oneV17Operations;');
 // Real copies use the browser's civil date. Fixtures retain the previously approved simulated date.
 rep('TODAY="2026-11-20",el=id=>','TODAY=data?.v17MigrationRehearsal?.format==="v17-private-lab-v1"?todayIso():"2026-11-20",el=id=>');
 rep('Saldo operativo · fecha simulada','Saldo operativo');
 rep('<div class="demo-footer">Lab de migración · Datos ficticios · Hoy simulado: 20 nov. 2026 · Almacenamiento aislado · Sin red.</div>','<div class="demo-footer" id="rc-labFooter">Lab privado · Sin conexión</div>');
 rep('<div id="rc-integrityReport"></div>','<div id="rc-integrityReport"></div><details class="demo-alloc-list" id="rc-migrationDetails"><summary>Ensayar migración V16.0</summary><p class="muted" id="rc-migrationMode"></p><label for="rc-migrationFile">Respaldo original JSON</label><input id="rc-migrationFile" type="file" accept=".json,application/json"><p id="rc-migrationStatus" role="status"></p><button type="button" class="btn" id="rc-migrationConfirm" disabled>Crear copia privada</button><div class="demo-dialog-actions"><button type="button" class="btn secondary" id="rc-migrationReset" hidden>Volver a la copia original</button><button type="button" class="btn secondary" id="rc-migrationClear">Borrar datos de este Lab</button></div><small class="muted">La copia se queda en este navegador. Conservá el JSON original fuera del Lab. Ningún cambio se sincroniza con Daniel.</small></details>');
 // Do not reuse the test restore route for private copies. A Lab export must remain clearly marked.
 rep('el("exportTest").onclick=()=>{try{download("One-Less-One-RC8-TEST.json",A.pack(localStorage.getItem(STORAGE_KEY)),"application/json")}','el("exportTest").onclick=()=>{try{download("One-Less-One-V17-LAB-PRIVADO.json",A.pack(localStorage.getItem(STORAGE_KEY)),"application/json")}');
 rep('el("integrity").onclick=',`
const migrationSourceKey=STORAGE_KEY+"_original_migration_source",migrationPreviousKey=STORAGE_KEY+"_before_migration_reset";
const migrationIO={read:()=>localStorage.getItem(STORAGE_KEY),readSource:()=>localStorage.getItem(migrationSourceKey),writeSource:x=>localStorage.setItem(migrationSourceKey,x),readPrevious:()=>localStorage.getItem(migrationPreviousKey),writePrevious:x=>localStorage.setItem(migrationPreviousKey,x),write:oneStoragePersist};
let migrationDraft=null,migrationGeneration=0;
function migrationValidation(raw,asOf){
 const saved=data,before=localStorage.getItem(STORAGE_KEY);
 try{
  restoreValidate(raw);
  const legacy=oneV15QueryCore.releaseAudit(raw);
  if(!legacy.ready)return {ready:false,counts:legacy.counts,issues:legacy.issues};
  data=restorePrepare(raw);
  const {base,model}=B.snapshot(rawNow(),api,asOf,F,S,P);
  const report=A.inspect(data,base,model,F,P,oneV15QueryCore.releaseAudit(data));
  if(localStorage.getItem(STORAGE_KEY)!==before)throw Error("La revisión modificó almacenamiento");
  return report;
 }finally{data=saved}
}
function updateMigrationControls(){
 const active=M.isPrivate(data),hasSource=migrationIO.readSource()!==null;
 el("labFooter").textContent=active?"Lab privado · Copia de respaldo · "+TODAY+" · Sin conexión":"Lab privado · Datos ficticios · Fecha simulada: "+TODAY+" · Sin conexión";
 el("migrationMode").textContent=active?"Copia privada activa. Los cambios no vuelven a producción.":hasSource?"Existe una copia original sin activar. Borrá este Lab para volver a empezar.":"Solo datos ficticios. Elegí un respaldo original para ensayar.";
 el("migrationFile").disabled=active||hasSource||nativeBlocked;
 el("migrationReset").hidden=!active||!hasSource;
 el("migrationConfirm").disabled=true;
 el("exportTest").textContent=active?"Exportar copia privada del Lab":"Exportar prueba";
 // A Lab export is for review/retention, not an original V16 backup; reset uses the exact source.
 el("restoreTest").disabled=true;el("confirmRestore").disabled=true;
 el("restoreTest").previousElementSibling.textContent="Restauración de pruebas deshabilitada en este Lab";
}
el("migrationFile").onchange=async()=>{
 const generation=++migrationGeneration; migrationDraft=null;el("migrationConfirm").disabled=true;const file=el("migrationFile").files[0],out=el("migrationStatus");out.textContent="";
 if(!file)return;
 try{
  if(file.size>50*1024*1024)throw Error("Archivo demasiado grande");
  const expected=oneStorageSnapshot,text=await file.text();
  if(generation!==migrationGeneration)return;
  if(M.isPrivate(data)||migrationIO.readSource()!==null||nativeBlocked)throw Error("Sesión no disponible");
  const draft=M.prepare(text,expected,todayIso(),migrationValidation);
  if(!draft.ready){out.textContent="Revisión requerida: "+(draft.report?.issues||[]).map(x=>x.code+": "+x.count).join(" · ");return}
  migrationDraft=draft;out.textContent="Validación aprobada. "+draft.report.counts.actuals+" registros normalizados; "+draft.report.counts.undated+" asignaciones sin fecha exacta. Confirmá para crear la copia privada.";
  el("migrationConfirm").disabled=false;
 }catch{if(generation===migrationGeneration)out.textContent="No se pudo validar el respaldo original. No se importó."}
 finally{if(generation===migrationGeneration)el("migrationFile").value=""}
};
el("migrationConfirm").onclick=()=>{
 try{
  if(nativeBlocked||!migrationDraft||M.isPrivate(data)||!confirm("¿Crear una copia privada del respaldo en este navegador? No modifica Daniel."))return;
  oneStorageAssertCurrent();M.commit(migrationDraft,migrationIO,migrationValidation);
  migrationDraft=null;location.reload();
 }catch{el("migrationStatus").textContent="No se pudo activar la copia. Revisá el almacenamiento local; el respaldo original no cambió.";el("migrationConfirm").disabled=true}
};
el("migrationReset").onclick=()=>{
 try{
  if(nativeBlocked||!M.isPrivate(data)||!confirm("¿Volver al respaldo original? Se conservará una copia previa de los cambios del Lab."))return;
  oneStorageAssertCurrent();M.resetCopy(migrationIO.readSource(),oneStorageSnapshot,todayIso(),migrationIO,migrationValidation);location.reload();
 }catch{el("migrationStatus").textContent="No se pudo restaurar la copia original. No se autorizó una sustitución sin respaldo."}
};
el("migrationClear").onclick=()=>{
 if(!confirm("¿Borrar todos los datos de este Lab privado? No se borrará Daniel, Lab publicado ni tu archivo JSON."))return;
 try{
  oneStorageAssertCurrent();const prefix="rastro_lab_v17_migration_preview_",keys=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(k=>k?.startsWith(prefix));
  for(const k of keys)localStorage.removeItem(k);location.reload();
 }catch{el("migrationStatus").textContent="No se pudo borrar el Lab. Recargá y revisá el almacenamiento."}
};
el("integrity").onclick=`);
 rep('el("integrityDialog").showModal();','updateMigrationControls();el("integrityDialog").showModal();');
 rep('el("closeIntegrity").onclick=()=>{auditGeneration++;','el("closeIntegrity").onclick=()=>{migrationGeneration++;migrationDraft=null;el("migrationFile").value="";el("migrationStatus").textContent="";el("migrationConfirm").disabled=true;auditGeneration++;');
 rep('theme(initialVisual.theme==="light"?"light":"dark");render();','theme(initialVisual.theme==="light"?"light":"dark");updateMigrationControls();render();');
 rep('const M=oneV17Migration,V=oneV17Available,',fs.readFileSync(path.join(root,"src/experimental/v17-portable-session.cjs"),"utf8")+'\nconst U=oneV17Session,M=oneV17Migration,V=oneV17Available,');
 rep('el("exportTest").onclick=()=>{try{download("One-Less-One-V17-LAB-PRIVADO.json",A.pack(localStorage.getItem(STORAGE_KEY)),"application/json")}','el("exportTest").onclick=()=>{try{if(M.isPrivate(data))download("One-Less-One-V17-SESION-PRIVADA.json",U.pack(localStorage.getItem(STORAGE_KEY+"_original_migration_source"),localStorage.getItem(STORAGE_KEY),M),"application/json");else download("One-Less-One-V17-LAB-PRUEBA.json",A.pack(localStorage.getItem(STORAGE_KEY)),"application/json")}');
 assert(!h.includes("rastro_lab_v17_rc8_preview_"));assert(!h.includes("daniel_finanzas_local_v1"));assert(!h.includes("rastro_lab_v7_1_data_v1"));assert(h.includes("connect-src 'none'"));return h;
}
if(require.main===module){const out=path.join(root,"preview-v17-migration");fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"One-Less-One-V17-LAB-PRIVADO.html"),buildCandidate());fs.writeFileSync(path.join(out,"LEEME.txt"),"LAB PRIVADO, NO PRODUCCIÓN. Descomprimí y abrí el HTML en Chrome/Edge en tu dispositivo personal. Primero exportá un respaldo JSON de V16.0 desde Daniel y guardalo fuera del Lab. En Configuración > Ensayar migración V16.0, elegí el JSON y revisá el diagnóstico. Solo si pasa, confirmá Crear copia privada. Se guarda una copia original adicional en este navegador y una copia activa editable con claves propias. No se envían datos, no se conecta al iPhone y no se escribe en Daniel. Compará saldo operativo y disponible (mes salarial), luego probá con la copia. Futuro es parcial. Podés volver a la copia original o borrar todo este Lab. El respaldo exportado del Lab está marcado y NO debe restaurarse en V16.0. No publiques ni compartas el archivo privado.");}
module.exports={buildCandidate};
