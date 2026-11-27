"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{buildCandidate:pre}=require("./build-v17-prerelease.cjs"),H=require("../src/experimental/v17-production-handoff.cjs");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8"),ENDPOINT="https://one-less-one-mobile-daniel.one-less-one-rastro.workers.dev";
function buildInner(){
 let h=pre().replaceAll("rastro_lab_v17_prerelease_",H.PREFIX).replaceAll("V17.0 PRE","V17.0").replaceAll("V17 Pre-release","V17 Daniel");
 const rep=(a,b)=>{assert.equal(h.split(a).length,2,"Marker: "+a);h=h.replace(a,()=>b)};
 rep("connect-src 'none'","connect-src "+ENDPOINT);
 const desktop=read("mobile-pilot/desktop.js"),start=desktop.indexOf("  function catalog(){"),end=desktop.indexOf("  async function fetchAndImport(");
 assert(start>0&&end>start);
 let mobile=read("src/experimental/v17-mobile-bridge-ui.js").replaceAll("https://one-less-one-mobile-v17-staging.one-less-one-rastro.workers.dev",ENDPOINT)
 .replace('if(nativeBlocked||M.isPrivate(data)||migrationIO.readSource()!==null)throw Error("Solo datos ficticios");','if(nativeBlocked||!M.isPrivate(data))throw Error("Primero activá la copia V17");handoffGuard();')
 .replace('if(M.isPrivate(JSON.parse(oneStorageSnapshot)))throw Error("Solo datos ficticios");','if(!M.isPrivate(JSON.parse(oneStorageSnapshot)))throw Error("Primero activá la copia V17");')
 .replace('health.service!=="One Less One Mobile V17 Staging"||health.mode!=="synthetic-only"','health.service!=="One Less One Mobile"||health.version!==1')
 .replaceAll("Ingresá la clave de pruebas.","Ingresá la clave de sincronización de Daniel.").replaceAll("Sincronizando prueba…","Sincronizando…");
 rep('<div id="rc-integrityReport"></div>','<details class="demo-alloc-list"><summary>Registro desde iPhone</summary><small class="muted">Sincronización manual de Daniel. Antes de activar, desvinculá V16 y cerrá sus pestañas.</small><label for="rc-mobileStagingKey">Clave de sincronización de Daniel</label><input id="rc-mobileStagingKey" type="password" autocomplete="off" minlength="32"><button type="button" class="btn secondary" id="rc-mobileStagingSync">Sincronizar</button><p id="rc-mobileStagingStatus" role="status"></p></details><div id="rc-integrityReport"></div>');
 rep('Ensayar migración V16.0','Migrar desde V16.0');
 rep('Solo datos ficticios. Elegí un respaldo original para ensayar.','Revisá los datos locales de V16 para activar V17.');
 rep('Copia privada activa. Los cambios no vuelven a producción.','V17 activa. V16 conserva los datos originales.');
 rep('La copia se queda en este navegador. Conservá el JSON original fuera del Lab. Ningún cambio se sincroniza con Daniel.','Los datos quedan en este navegador. Conservá tu respaldo original. La sincronización móvil es manual.');
 rep('<label for="rc-migrationFile">Respaldo original JSON</label>','<button type="button" class="btn secondary" id="rc-handoffRead">Revisar datos locales de V16</button><label for="rc-migrationFile">Respaldo original JSON (no habilitado en esta ruta)</label>');
 rep('el("migrationFile").disabled=active||nativeBlocked;el("sessionFile").disabled=active||nativeBlocked;','el("migrationFile").disabled=true;el("sessionFile").disabled=active||nativeBlocked;el("handoffRead").disabled=active||nativeBlocked;');
 rep('el("migrationReset").hidden=!active||!hasSource;','el("migrationReset").hidden=true;el("migrationReset").disabled=true;el("migrationClear").hidden=true;el("migrationClear").disabled=true;');
 rep('el("migrationFile").onchange=async()=>{','el("migrationFile").onchange=async()=>{return;');
 rep('el("migrationReset").onclick=()=>{','el("migrationReset").onclick=()=>{return;');
 rep('el("migrationClear").onclick=()=>{','el("migrationClear").onclick=()=>{return;');
 rep('const draft=U.prepare(text,expected,todayIso(),M,migrationValidation,sessionActiveValidation);','const draft=U.prepare(text,expected,todayIso(),M,migrationValidation,sessionActiveValidation);oneV17Handoff.assertSource(handoffIO,draft.source);');
 rep('oneStorageAssertCurrent();U.commit(sessionDraft','oneStorageAssertCurrent();oneV17Handoff.assertSource(handoffIO,sessionDraft.source);U.commit(sessionDraft');
 rep('oneStorageAssertCurrent();M.commit(migrationDraft','oneStorageAssertCurrent();oneV17Handoff.assertSource(handoffIO,migrationDraft.source);M.commit(migrationDraft');
 rep('const nativeSave=save;','const nativeSave=save;');
 rep('if(nativeBlocked)throw Error("Recargá antes de guardar");\n try{getModel();','if(nativeBlocked)throw Error("Recargá antes de guardar");\n handoffGuard();try{getModel();');
 rep('function commitNative(staged){if(nativeBlocked)throw Error("Recargá antes de guardar");','function commitNative(staged){handoffGuard();if(nativeBlocked)throw Error("Recargá antes de guardar");');
 rep('theme(initialVisual.theme==="light"?"light":"dark");updateMigrationControls();render();',read("src/experimental/v17-production-handoff.cjs")+'\n'+
 'const handoffIO={read:k=>localStorage.getItem(k)};\nfunction handoffGuard(){oneV17Handoff.assertActive(handoffIO,M)}\n'+
 'el("handoffRead").onclick=()=>{migrationDraft=null;el("migrationConfirm").disabled=true;try{if(M.isPrivate(data))throw Error("Ya existe una copia");oneStorageAssertCurrent();const text=oneV17Handoff.source(handoffIO),draft=M.prepare(text,oneStorageSnapshot,todayIso(),migrationValidation);if(!draft.ready)throw Error("Migración detenida: "+(draft.report?.issues||[]).map(x=>x.code+" ("+x.count+")").join(" · ")+" . No se copiaron datos.");if(migrationIO.readSource()!==null&&migrationIO.readSource()!==text)throw Error("Existe otro respaldo original");migrationDraft=draft;el("migrationStatus").textContent="Original validado. Confirmá solo si todas las pestañas V16 están cerradas.";el("migrationConfirm").disabled=false}catch(e){el("migrationStatus").textContent=e.message}};\n'+
 read("src/experimental/v17-mobile-bridge.cjs").replaceAll("v17StagingMobileReceipts","v17ProductionMobileReceipts")+'\n(function(){\n'+desktop.slice(start,end)+'\n'+mobile+'\n})();\n'+
 'theme(initialVisual.theme==="light"?"light":"dark");updateMigrationControls();render();');
 return h;
}
function buildCandidate(){
 const h=buildInner();
 // No real data is ever initialized on a different origin or path.
 const encoded=JSON.stringify(h).replace(/</g,"\\u003c");
 return '<!doctype html><html lang="es"><meta charset="utf-8"><title>One Less One V17</title><body><script>(function(){if(location.origin!=='+JSON.stringify(H.ORIGIN)+'||!'+JSON.stringify([H.PATH,H.PATH+"index.html"])+'.includes(location.pathname)){document.body.textContent="Ruta de activación no autorizada.";return;}document.open();document.write('+encoded+');document.close()})();</script></body></html>';
}
if(require.main===module){const dir=path.join(root,"preview-v17-production-handoff","v17");fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,"index.html"),buildCandidate());}
module.exports={buildCandidate,buildInner,ENDPOINT};
