"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{buildCandidate:rc7}=require("./build-v17-rc7.cjs");
const root=path.resolve(__dirname,"..");
function buildCandidate(){
 let h=rc7().replaceAll("rastro_lab_v17_rc7_preview_","rastro_lab_v17_rc8_preview_").replaceAll("_pre_v17_rc7","_pre_v17_rc8").replaceAll("_before_rc7_restore","_before_rc8_restore").replaceAll("RC7","RC8").replaceAll("v17-rc7-test-backup","v17-rc8-test-backup");
 const rep=(a,b)=>{assert.equal(h.split(a).length,2,"Marker: "+a);h=h.replace(a,()=>b)};
 rep('"oneDebtTypesDialog","fxDialog"]','"oneDebtTypesDialog","fxDialog","movementTemplateDialog"]');
 rep('if(action==="movement"){openMovement();return}',`
 if(action==="new-template"){m2OpenTemplate();document.getElementById("mtNextDate").value=selectedDate();return}
 if(action==="schedule"||action==="repeat"){const m=find("movements");if(m&&!oneIsLinkedCobroMovement(m)){if(action==="schedule")m2OpenTemplate(m);else m2OpenComposer(m,{repeat:true})}return}
 if(action==="template-edit"||action==="template-post"||action==="template-toggle"){const t=find("movementTemplates");if(t){if(action==="template-edit")m2OpenTemplate(t);else if(action==="template-post")m2PrepareScheduled(t);else{t.active=!t.active;save();render()}}return}
 if(action==="recurring-collections"){
  const month=state.month;if(confirm("¿Preparar los cobros recurrentes de "+month+"? No se registrará efectivo.")){ensureRecurringChargesForMonth(month);model=getModel();render()}return
 }
 if(action==="movement"){openMovement();return}`);
 rep('if(moduleName==="moves")return toolbar([actionButton("movement","＋ Agregar movimiento")]);',`
 if(moduleName==="moves"){
  const items=(data.movementTemplates||[]).slice().sort((a,b)=>a.nextDate.localeCompare(b.nextDate));
  return toolbar([actionButton("movement","＋ Agregar movimiento")])+'<details class="demo-alloc-list"><summary>Programados · '+items.length+'</summary><div class="demo-native-actions">'+actionButton("new-template","＋ Programar")+'</div>'+items.map(t=>'<div class="demo-alloc"><div><strong>'+esc(t.name)+'</strong><small class="muted"> · '+short(t.nextDate)+' · '+(t.active?"Activo":"Pausado")+'</small></div><strong>'+f(Math.round(t.amount*100),t.currency)+'</strong><details class="demo-alloc-list"><summary>Acciones</summary>'+(t.active?actionButton("template-post","Preparar",t.id):"")+actionButton("template-edit","Editar",t.id)+actionButton("template-toggle",t.active?"Pausar":"Reactivar",t.id)+'</details></div>').join("")+'</details>';
 }`);
 rep('actionButton("edit-movement","Editar",m.id)+actionButton("delete-movement","Eliminar",m.id)','actionButton("edit-movement","Editar",m.id)+actionButton("repeat","Repetir",m.id)+actionButton("schedule","Programar",m.id)+actionButton("delete-movement","Eliminar",m.id)');
 rep('actionButton("collection","＋ Agregar cobro"),actionButton("group","Grupo")','actionButton("collection","＋ Agregar cobro"),actionButton("group","Grupo"),...((data.receivableRecurring||[]).length?[actionButton("recurring-collections","Preparar recurrentes")]:[])');
 rep('<div id="rc-integrityReport"></div>','<div id="rc-integrityReport"></div><details class="demo-alloc-list"><summary>Revisar respaldo V16.0 (solo lectura)</summary><label for="rc-privateAuditFile">Archivo JSON local</label><input id="rc-privateAuditFile" type="file" accept=".json,application/json"><p id="rc-privateAuditReport" role="status"></p><small class="muted">No importa, guarda ni envía el archivo. No muestra nombres ni montos.</small></details>');
 rep('el("integrity").onclick=',`
let auditGeneration=0;
el("privateAuditFile").onchange=async()=>{
 const generation=++auditGeneration,file=el("privateAuditFile").files[0],out=el("privateAuditReport");out.textContent="";
 if(!file)return;
 try{
  if(file.size>50*1024*1024)throw Error("Archivo demasiado grande");
  const raw=JSON.parse(await file.text());
  if(generation!==auditGeneration)return;
  if(!raw||!Array.isArray(raw.periods)||!Array.isArray(raw.movements)||raw.v16AssignmentOverlay||raw.v17CashCommitmentLinks||raw.v17ProjectBudgetLinks)throw Error("Formato no admitido");
  const before=localStorage.getItem(STORAGE_KEY),memory=JSON.stringify(data);
  const report=inspectRaw(raw);
  if(localStorage.getItem(STORAGE_KEY)!==before||JSON.stringify(data)!==memory)throw Error("Se detectó un cambio inesperado");
  out.textContent=(report.ready?"Sin incidencias detectadas.":"Requiere revisión.")+" · "+report.counts.actuals+" registros normalizados · "+report.counts.undated+" asignaciones sin fecha exacta. "+report.issues.map(x=>x.code+": "+x.count).join(" · ");
 }catch{if(generation===auditGeneration)out.textContent="No se pudo validar el formato o la integridad. No se importó el archivo."}
 finally{if(generation===auditGeneration)el("privateAuditFile").value=""}
};
el("integrity").onclick=`);
 rep('el("closeIntegrity").onclick=()=>{resetRestore();','el("closeIntegrity").onclick=()=>{auditGeneration++;el("privateAuditFile").value="";el("privateAuditReport").textContent="";resetRestore();');
 // Recover native optional-tool preferences; hiding a tool never removes its data.
 rep('enabledModules=new Set();','enabledModules=new Set(optionalModules.map(([id])=>id).filter(id=>oneModuleEnabled(({goals:"capital",collections:"shared"})[id]||id)));');
 rep('else{enabledModules.delete(id);if(moduleName===id)moduleName="home"}render()','else{enabledModules.delete(id);if(moduleName===id)moduleName="home";oneSetModuleEnabled(({goals:"capital",collections:"shared"})[id]||id,false)}render()');
 // Keep the financial UI single-source; visual preferences are separate from the ledger.
 rep('function theme(value){document.documentElement.dataset.theme=value;','const rcVisualKey=STORAGE_KEY+"_visual";function visualPrefs(){try{return JSON.parse(localStorage.getItem(rcVisualKey)||"{}")}catch{return {}}}function saveVisual(patch){try{localStorage.setItem(rcVisualKey,JSON.stringify({...visualPrefs(),...patch}))}catch{}}function theme(value){saveVisual({theme:value});document.documentElement.dataset.theme=value;');
 rep('display=e.target.value;render()','display=e.target.value;saveVisual({currency:display});render()');
 rep('theme("dark");render();','const initialVisual=visualPrefs();display=initialVisual.currency==="USD"?"USD":"CRC";el("displayCurrency").value=display;theme(initialVisual.theme==="light"?"light":"dark");render();');
 assert(!h.includes("rastro_lab_v17_rc7_preview_"));return h;
}
if(require.main===module){const out=path.join(root,"preview-v17-rc8");fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"One-Less-One-V17.0-RC8-TECNICA.html"),buildCandidate());fs.writeFileSync(path.join(out,"LEEME.txt"),"RC8 técnica aislada. Solo datos ficticios para operaciones. Configuración: revisión privada de respaldo original V16.0, solo lectura, sin red ni persistencia del archivo. No restaurés un respaldo real. Movimientos: programados y repetición. Cobros: preparar recurrentes. El piloto móvil se prueba exclusivamente con transporte simulado; no se conecta a Cloudflare. No publicar.");}
module.exports={buildCandidate};
