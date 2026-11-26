"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{buildCandidate:rc4}=require("./build-v17-rc4.cjs");
const root=path.resolve(__dirname,"..");
function buildCandidate(){
 let h=rc4().replaceAll("rastro_lab_v17_rc4_preview_","rastro_lab_v17_rc5_preview_").replaceAll("_pre_v17_rc4","_pre_v17_rc5").replaceAll("_before_rc4_restore","_before_rc5_restore").replaceAll("RC4","RC5").replaceAll("v17-rc4-test-backup","v17-rc5-test-backup");
 const rep=(a,b)=>{assert.equal(h.split(a).length,2,"Marker: "+a);h=h.replace(a,()=>b)};
 rep('const Q=oneV17Forecast,A=oneV17Audit,O=oneV17Operations;',fs.readFileSync(path.join(root,"src/experimental/v17-commitment-links.cjs"),"utf8")+'\nconst L=oneV17Links,Q=oneV17Forecast,A=oneV17Audit,O=oneV17Operations;');
 rep('<div id="rc-content"></div>','<div id="rc-content"></div><dialog id="rc-linkDialog"><div class="demo-card-head"><h2>Vincular presupuesto</h2><button class="demo-add" id="rc-linkClose" type="button" aria-label="Cerrar">×</button></div><p id="rc-linkContext" class="muted"></p><label for="rc-linkAssignment">Asignación</label><select id="rc-linkAssignment"></select><p class="muted">Misma fecha y moneda. Vincular no aumenta el presupuesto ni crea movimientos.</p><p id="rc-linkError" role="alert"></p><div class="demo-dialog-actions"><button type="button" class="btn" id="rc-linkConfirm">Guardar vínculo</button></div></dialog>');
 rep('function openNative(action,id){',`
let linkDraft=null;
function openLink(id){
 const raw=rawNow(),plan=(model.modules.projectPlans||[]).find(x=>x.id===id);
 if(!plan)throw Error("Previsión no disponible");
 linkDraft={id,baseline:JSON.stringify(raw),expected:oneStorageSnapshot};
 el("linkContext").textContent=plan.name+" · "+(plan.date?short(plan.date):"Sin fecha")+" · "+f(plan.remainingMinor,plan.currency);
 const select=el("linkAssignment"),none=document.createElement("option");none.value="";none.textContent="Sin vínculo";
 select.replaceChildren(none,...L.options(raw,model,id).map(a=>{const o=document.createElement("option");o.value=a.id;o.textContent=cat(a.categoryId).name+" · "+f(a.minor,a.currency);return o}));
 select.value=L.read(raw).find(x=>x.planId===id)?.assignmentId||"";if(select.selectedIndex<0)select.value="";
 el("linkError").textContent="";el("linkDialog").showModal();
}
el("linkClose").onclick=()=>{linkDraft=null;el("linkDialog").close()};
el("linkConfirm").onclick=()=>{try{
 if(nativeBlocked||!linkDraft||linkDraft.baseline!==JSON.stringify(rawNow())||linkDraft.expected!==oneStorageSnapshot)throw Error("Los datos cambiaron. Volvé a revisar.");
 const raw=rawNow(),fresh=getModel(),next=L.stage(raw,fresh,linkDraft.id,el("linkAssignment").value);
 const disk=JSON.parse(linkDraft.expected),nextDisk={...disk,[L.FIELD]:next[L.FIELD]};
 P.persist({read:()=>localStorage.getItem(STORAGE_KEY),readBackup:()=>localStorage.getItem(STORAGE_KEY+"_pre_v17_rc5"),writeBackup:x=>localStorage.setItem(STORAGE_KEY+"_pre_v17_rc5",x),write:oneStoragePersist},linkDraft.expected,nextDisk);
 data=next;model=getModel();linkDraft=null;el("linkDialog").close();render();
 }catch(error){el("linkError").textContent=error.message}};
function openNative(action,id){`);
 rep('if(action==="movement"){openMovement();return}','if(action==="link-project"){openLink(id);return}\n if(action==="project-edit-plan"||action==="project-reconcile"){const p=find("projectPlans");const plan=(data.projectPlans||[]).find(x=>x.id===id);if(plan){oneProjectSelect(plan.projectId);if(action==="project-edit-plan")oneProjectOpenPlan(plan);else oneProjectOpenReconcile(plan)}return}\n if(action==="collection-history"){const c=find("sharedCharges");if(c)openCobroPaymentHistory(c);return}\n if(action==="movement"){openMovement();return}');
 rep('actionButton("payment","Abonar",c.id)','actionButton("payment","Abonar",c.id)+actionButton("collection-history","Historial",c.id)');
 rep('p.plans.map(x=>\'<div class="demo-alloc"><span>\'+short(x.date)+\' · \'+esc(x.name)+\'</span><strong>\'+f(x.remainingMinor,x.currency)+\'</strong></div>\')','p.plans.map(x=>\'<div class="demo-alloc"><span>\'+short(x.date)+\' · \'+esc(x.name)+\'</span><strong>\'+f(x.remainingMinor,x.currency)+\'</strong><details class="demo-alloc-list"><summary>Acciones</summary>\'+actionButton("project-edit-plan","Editar",x.id)+actionButton("project-reconcile","Conciliar gasto",x.id)+actionButton("link-project",L.read(rawNow()).some(l=>l.planId===x.id)?"Revisar vínculo":"Vincular presupuesto",x.id)+\'</details></div>\')');
 rep('liquidity=Q.forecast(model,TODAY,v.range.end,confirmedFlows(),oneFutureForecast(TODAY,90).items,currentRates(),F);','liquidity=L.reconcile(rawNow(),model,Q.forecast(model,TODAY,v.range.end,confirmedFlows(),oneFutureForecast(TODAY,90).items,currentRates(),F),TODAY,currentRates());');
 rep('partidas por revisar</small>','partidas por revisar</small><div class="demo-alloc"><span>Proyectos cubiertos por presupuesto</span><strong>\'+liquidity.counts.coveredProjects+\'</strong></div>');
 rep('return A.inspect(data,base,model,F,P,oneV15QueryCore.releaseAudit(data));','L.read(data);return A.inspect(data,base,model,F,P,oneV15QueryCore.releaseAudit(data));');
 rep('const r=A.reconcile(base,model,F,state.month),mapped=','const links=L.status(raw,model);el("integrityReport").innerHTML+=\'<div class="demo-alloc"><span>Vínculos por revisar</span><strong>\'+links.filter(x=>!x.valid).length+\'</strong></div>\';\n const r=A.reconcile(base,model,F,state.month),mapped=');
 assert(!h.includes("rastro_lab_v17_rc4_preview_"));return h;
}
if(require.main===module){const out=path.join(root,"preview-v17-rc5");fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"One-Less-One-V17.0-RC5-TECNICA.html"),buildCandidate());fs.writeFileSync(path.join(out,"LEEME.txt"),"RC5 técnica aislada. Datos ficticios. Proyectos: acciones por previsión, editar, conciliar gasto y vincular presupuesto. Cobros: historial nativo. Futuro sigue parcial. No importés datos reales ni respaldos de otras candidatas.");}
module.exports={buildCandidate};
