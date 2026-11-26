"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{buildCandidate:rc2}=require("./build-v17-rc2.cjs");
const root=path.resolve(__dirname,"..");
function buildCandidate(){
 let h=rc2().replaceAll("rastro_lab_v17_rc2_preview_","rastro_lab_v17_rc3_preview_").replaceAll("_pre_v17_rc2","_pre_v17_rc3").replaceAll("V17.0 RC2","V17.0 RC3").replace("RC2 técnica","RC3 técnica");
 const rep=(a,b)=>{assert.equal(h.split(a).length,2,"Marker: "+a);h=h.replace(a,()=>b)};
 rep('const O=oneV17Operations;',fs.readFileSync(path.join(root,"src/experimental/v17-release-audit.cjs"),"utf8")+'\nconst A=oneV17Audit,O=oneV17Operations;');
 rep('<div id="rc-content"></div>', '<div id="rc-content"></div><dialog id="rc-integrityDialog"><div class="demo-card-head"><h2>Datos y respaldo</h2><button type="button" id="rc-closeIntegrity" class="demo-add" aria-label="Cerrar">×</button></div><div id="rc-integrityReport"></div><details class="demo-alloc-list"><summary>Calendario y mes financiero</summary><div id="rc-basisReport"></div></details><div class="demo-dialog-actions"><button type="button" class="btn secondary" id="rc-exportTest">Exportar prueba</button></div><label for="rc-restoreTest">Restaurar respaldo de prueba RC3</label><input id="rc-restoreTest" type="file" accept=".json,application/json"><p id="rc-restoreStatus" role="status"></p><button type="button" class="btn" id="rc-confirmRestore" disabled>Restaurar</button></dialog>');
 rep('<span class="demo-version">V17.0 RC3</span>','<button type="button" class="demo-add" id="rc-integrity" aria-label="Datos y respaldo" title="Datos y respaldo">⚙</button><span class="demo-version">V17.0 RC3</span>');
 rep('function commitNative(staged){',`
function inspectRaw(raw){
 const saved=data;
 try{
  restoreValidate(raw);
  data=restorePrepare(raw);
  const {base,model}=B.snapshot(rawNow(),api,TODAY,F,S,P);
  return A.inspect(data,base,model,F,P,oneV15QueryCore.releaseAudit(data));
 }finally{data=saved}
}
let restoreDraft=null,restoreGeneration=0;
function resetRestore(){restoreGeneration++;restoreDraft=null;el("confirmRestore").disabled=true;el("restoreStatus").textContent="";el("restoreTest").value=""}
function openIntegrity(){
 resetRestore();const raw=rawNow(),{base,model}=B.snapshot(raw,api,TODAY,F,S,P),report=A.inspect(raw,base,model,F,P,oneV15QueryCore.releaseAudit(raw));
 el("integrityReport").innerHTML='<p class="muted">'+(report.ready?"Sin incidencias detectadas":"Revisión pendiente")+'</p><div class="demo-alloc"><span>Asignaciones</span><strong>'+report.counts.assignments+'</strong></div><div class="demo-alloc"><span>Sin fecha exacta</span><strong>'+report.counts.undated+'</strong></div>'+report.issues.map(x=>'<div class="demo-alloc"><span>'+esc(x.code)+'</span><strong>'+x.count+'</strong></div>').join("");
 const r=A.reconcile(base,model,F,state.month),lines=Object.entries(r.calendar).map(([c,t])=>'<div class="demo-alloc"><span>Calendario · '+c+'</span><strong>'+f(t.outflow.plannedMinor,c)+'</strong></div>').join("")+Object.entries(r.financial).map(([c,t])=>'<div class="demo-alloc"><span>Mes salarial original · '+c+'</span><strong>'+f(t.outflow.plannedMinor,c)+'</strong></div>').join("");
 el("basisReport").innerHTML='<p class="muted">Egresos planificados · '+esc(state.month)+'</p>'+lines+'<p class="muted">'+(r.historicalOK?"Histórico conservado.":"Histórico requiere revisión.")+' Las bases no se suman. Nuevas asignaciones calendario: '+r.counts.calendarOnlyAssignments+'. Pendientes de distribuir: '+r.counts.pending+'.</p>';
 el("integrityDialog").showModal();
}
el("integrity").onclick=()=>{try{openIntegrity()}catch(error){alert(error.message)}};
el("closeIntegrity").onclick=()=>{resetRestore();el("integrityDialog").close()};
el("exportTest").onclick=()=>{try{download("One-Less-One-RC3-TEST.json",A.pack(localStorage.getItem(STORAGE_KEY)),"application/json")}catch(error){el("restoreStatus").textContent=error.message}};
el("restoreTest").onchange=async()=>{const generation=++restoreGeneration;restoreDraft=null;el("confirmRestore").disabled=true;const file=el("restoreTest").files[0];if(!file)return;try{if(file.size>50*1024*1024)throw Error("Archivo demasiado grande");const expected=localStorage.getItem(STORAGE_KEY),text=await file.text();if(generation!==restoreGeneration)return;restoreDraft=A.prepare(text,expected,inspectRaw);el("restoreStatus").textContent="Respaldo validado. Se sustituirán únicamente los datos de prueba de RC3.";el("confirmRestore").disabled=false}catch(error){if(generation===restoreGeneration)el("restoreStatus").textContent="No se puede restaurar: "+error.message}};
el("confirmRestore").onclick=()=>{try{if(!restoreDraft||nativeBlocked||!confirm("¿Restaurar los datos ficticios de RC3?"))return;A.restore(restoreDraft,{read:()=>localStorage.getItem(STORAGE_KEY),readBackup:()=>localStorage.getItem(STORAGE_KEY+"_before_rc3_restore"),writeBackup:x=>localStorage.setItem(STORAGE_KEY+"_before_rc3_restore",x),write:oneStoragePersist},inspectRaw);restoreDraft=null;location.reload()}catch(error){el("restoreStatus").textContent=error.message;el("confirmRestore").disabled=true}};
function commitNative(staged){`);
 // Keep the financial warning visible; avoid overflowing a compact header/dialog.
 rep('#v17NativeHost{display:none!important}', '#v17NativeHost{display:none!important}.olo-demo #rc-integrityDialog{width:min(460px,calc(100vw - 24px));max-height:85vh;overflow:auto}.olo-demo .demo-utility{min-width:0}.olo-demo .demo-native-actions{flex-wrap:wrap}.olo-demo .demo-feed-row>div{min-width:0;overflow-wrap:anywhere}');
 assert(!h.includes("rastro_lab_v17_rc2_preview_"));return h;
}
if(require.main===module){const out=path.join(root,"preview-v17-rc3");fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"One-Less-One-V17.0-RC3-TECNICA.html"),buildCandidate());fs.writeFileSync(path.join(out,"LEEME.txt"),"RC3 técnica aislada. Solo datos ficticios. Abrí en Chrome o Edge. Configuración ⚙ permite auditoría, comparación de calendario y mes salarial y respaldo exclusivo de RC3. No importés respaldo real. Futuro parcial y operaciones pendientes: no publicar.");}
module.exports={buildCandidate};
