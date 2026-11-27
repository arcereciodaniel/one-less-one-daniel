"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{buildCandidate:rc5}=require("./build-v17-rc5.cjs");
const root=path.resolve(__dirname,"..");
function buildCandidate(){
 let h=rc5().replaceAll("rastro_lab_v17_rc5_preview_","rastro_lab_v17_rc6_preview_").replaceAll("_pre_v17_rc5","_pre_v17_rc6").replaceAll("_before_rc5_restore","_before_rc6_restore").replaceAll("RC5","RC6").replaceAll("v17-rc5-test-backup","v17-rc6-test-backup");
 const rep=(a,b)=>{assert.equal(h.split(a).length,2,"Marker: "+a);h=h.replace(a,()=>b)};
 // Metadata only, on the isolated candidate's native scheduler.
 rep('const add=(date,amount,kind,label,source)=>{','const add=(date,amount,kind,label,source,meta={})=>{');
 rep('const item={date,amount,kind,label,source};','const item={date,amount,kind,label,source,...meta};');
 rep('add(debitDate,-unpaid,"debt",(due<=asOf?"Vencida · ":"")+d.name,"Cuota mínima estimada");','add(debitDate,-unpaid,"debt",(due<=asOf?"Vencida · ":"")+d.name,"Cuota mínima estimada",{debtId:d.id,due});');
 rep('const L=oneV17Links,Q=oneV17Forecast,A=oneV17Audit,O=oneV17Operations;',fs.readFileSync(path.join(root,"src/experimental/v17-debt-collection-links.cjs"),"utf8")+'\nconst C=oneV17Commitments,L=oneV17Links,Q=oneV17Forecast,A=oneV17Audit,O=oneV17Operations;');
 rep('<div id="rc-content"></div>','<div id="rc-content"></div><dialog id="rc-commitmentDialog"><div class="demo-card-head"><h2 id="rc-commitmentTitle">Vincular compromiso</h2><button type="button" class="demo-add" id="rc-commitmentClose" aria-label="Cerrar">×</button></div><p id="rc-commitmentContext" class="muted"></p><div id="rc-classificationFields"><label for="rc-commitmentMode">Tipo de cobro</label><select id="rc-commitmentMode"><option value="none">Sin clasificar</option><option value="income">Ingreso</option><option value="reimbursement">Reembolso</option></select></div><div id="rc-commitmentAssignmentFields"><label for="rc-commitmentAssignment">Asignación existente</label><select id="rc-commitmentAssignment"></select></div><small class="muted" id="rc-commitmentHint"></small><p role="alert" id="rc-commitmentError"></p><div class="demo-dialog-actions"><button type="button" class="btn" id="rc-commitmentConfirm">Guardar</button></div></dialog>');
 rep('function openNative(action,id){',`
const nativeOccurrences=()=>C.occurrences(oneFutureForecast(TODAY,90).items);
let commitmentDraft=null;
function commitmentOptions(){
 const d=commitmentDraft;if(!d)return;
 const mode=d.kind==="debt"?"debt":el("commitmentMode").value;
 const opts=C.options(rawNow(),model,nativeOccurrences(),d.kind,d.id,mode);
 const select=el("commitmentAssignment"),empty=document.createElement("option");empty.value="";empty.textContent=d.kind==="debt"?"Sin vínculo":"Sin asignación vinculada";
 select.replaceChildren(empty,...opts.map(a=>{const o=document.createElement("option");o.value=a.id;o.textContent=cat(a.categoryId).name+" · "+f(a.minor,a.currency);return o}));
 select.value=d.assignmentId||"";if(select.selectedIndex<0)select.value="";
 el("commitmentAssignmentFields").hidden=mode==="none"||mode==="reimbursement";
 el("commitmentHint").textContent=mode==="reimbursement"?"No aumenta ingresos ni saldo proyectado hasta conciliar su registro.":d.kind==="debt"?"Solo cuota residual exacta en CRC, ya incluida en Futuro.":"Vincular un ingreso existente evita duplicarlo; clasificar no anticipa efectivo.";
}
function openCommitment(kind,id){
 const x=kind==="debt"?nativeOccurrences().find(y=>y.id===id):(model.modules.collections||[]).find(y=>y.id===id);
 if(!x)throw Error("Compromiso no disponible");
 const raw=rawNow(),old=C.read(raw).find(r=>r.kind===kind&&r.id===id);
 commitmentDraft={kind,id,baseline:JSON.stringify(raw),expected:oneStorageSnapshot,assignmentId:old?.assignmentId||""};
 el("commitmentTitle").textContent=kind==="debt"?"Vincular cuota":"Clasificar cobro";
 el("commitmentContext").textContent=x.name+" · "+(x.date?short(x.date):"Sin fecha")+" · "+f(x.minor,x.currency);
 el("classificationFields").hidden=kind==="debt";el("commitmentMode").value=old?.mode||"none";el("commitmentError").textContent="";commitmentOptions();el("commitmentDialog").showModal();
}
el("commitmentMode").onchange=()=>{commitmentDraft.assignmentId="";commitmentOptions()};
el("commitmentClose").onclick=()=>{commitmentDraft=null;el("commitmentDialog").close()};
el("commitmentConfirm").onclick=()=>{try{
 const d=commitmentDraft;if(nativeBlocked||!d||d.baseline!==JSON.stringify(rawNow())||d.expected!==oneStorageSnapshot)throw Error("Los datos cambiaron. Volvé a revisar.");
 const assignmentId=el("commitmentAssignmentFields").hidden?"":el("commitmentAssignment").value,mode=d.kind==="debt"?(assignmentId?"debt":"none"):el("commitmentMode").value;
 const next=C.stage(rawNow(),getModel(),nativeOccurrences(),{kind:d.kind,id:d.id,mode,assignmentId}),disk=JSON.parse(d.expected);
 P.persist({read:()=>localStorage.getItem(STORAGE_KEY),readBackup:()=>localStorage.getItem(STORAGE_KEY+"_pre_v17_rc6"),writeBackup:x=>localStorage.setItem(STORAGE_KEY+"_pre_v17_rc6",x),write:oneStoragePersist},d.expected,{...disk,[C.FIELD]:next[C.FIELD]});
 data=next;model=getModel();commitmentDraft=null;el("commitmentDialog").close();render();
 }catch(error){el("commitmentError").textContent=error.message}};
function openNative(action,id){`);
 rep('if(action==="link-project"){openLink(id);return}','if(action==="link-debt"||action==="classify-collection"){openCommitment(action==="link-debt"?"debt":"collection",id);return}\n if(action==="link-project"){openLink(id);return}');
 rep('actionButton("collection-history","Historial",c.id)','actionButton("collection-history","Historial",c.id)+actionButton("classify-collection","Clasificar",c.id)');
 rep('if(moduleName==="debts")return toolbar([actionButton("debt","＋ Agregar deuda")])','if(moduleName==="debts")return toolbar([actionButton("debt","＋ Agregar deuda")])');
 rep('const a=moduleName==="debts"?v.debts:v.collections;','const a=moduleName==="debts"?v.debts:v.collections;\n if(moduleName==="debts"){const due=nativeOccurrences().filter(x=>x.date>=v.range.start&&x.date<=v.range.end);if(due.length)return layout([lines("Cuotas previstas",due.map(x=>({...x,name:x.name}))),lines("Pagos registrados",a.payments)])+\'<details class="demo-alloc-list"><summary>Vincular cuotas al presupuesto</summary>\'+due.map(x=>\'<div class="demo-alloc"><span>\'+esc(x.name)+\' · \'+short(x.date)+\'</span>\'+actionButton("link-debt","Vincular",x.id)+\'</div>\').join("")+\'</details>\'}');
 rep('liquidity=L.reconcile(rawNow(),model,Q.forecast(model,TODAY,v.range.end,confirmedFlows(),oneFutureForecast(TODAY,90).items,currentRates(),F),TODAY,currentRates());','liquidity=C.reconcile(rawNow(),model,L.reconcile(rawNow(),model,Q.forecast(model,TODAY,v.range.end,confirmedFlows(),oneFutureForecast(TODAY,90).items,currentRates(),F),TODAY,currentRates()),nativeOccurrences(),TODAY,currentRates());');
 rep('liquidity.counts.coveredProjects+\'</strong></div>','liquidity.counts.coveredProjects+\'</strong></div><div class="demo-alloc"><span>Cuotas y cobros vinculados</span><strong>\'+(liquidity.counts.coveredDebt+liquidity.counts.coveredCollections)+\'</strong></div>');
 rep('L.read(data);return A.inspect','L.read(data);C.read(data);return A.inspect');
 assert(!h.includes("rastro_lab_v17_rc5_preview_"));return h;
}
if(require.main===module){const out=path.join(root,"preview-v17-rc6");fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"One-Less-One-V17.0-RC6-TECNICA.html"),buildCandidate());fs.writeFileSync(path.join(out,"LEEME.txt"),"RC6 técnica aislada. Datos ficticios. Cuotas residuales CRC: vínculo explícito. Cobros: clasificación ingreso/reembolso; no agrega efectivo automáticamente. Futuro sigue parcial. No importés respaldos reales.");}
module.exports={buildCandidate};
