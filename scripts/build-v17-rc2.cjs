"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{buildCandidate:rc1}=require("./build-v17-rc1.cjs");
const root=path.resolve(__dirname,"..");
function buildCandidate(){
 let h=rc1().replaceAll("rastro_lab_v17_rc1_preview_","rastro_lab_v17_rc2_preview_").replaceAll("_pre_v17_rc1","_pre_v17_rc2").replaceAll("V17.0 RC1","V17.0 RC2").replace("RC1 técnica","RC2 técnica");
 const rep=(a,b)=>{assert.equal(h.split(a).length,2,"Marker: "+a);h=h.replace(a,()=>b)};
 rep('const rawNow=()=>JSON.parse(JSON.stringify(data));',fs.readFileSync(path.join(root,"src/experimental/v17-operations.cjs"),"utf8")+'\nconst O=oneV17Operations;\nconst rawNow=()=>JSON.parse(JSON.stringify(data));');
 rep('let model=getModel(),display="CRC";',`
let model=getModel(),display="CRC",nativeBlocked=false;
let refreshQueued=false;
function refreshNative(){if(refreshQueued)return;refreshQueued=true;queueMicrotask(()=>{refreshQueued=false;if(nativeBlocked)return;try{model=getModel();render()}catch(error){blockNative(error)}})}
function blockNative(error){nativeBlocked=true;el("content").textContent="No se puede continuar: "+error.message+". Recargá la candidata para revisar los datos guardados.";document.querySelectorAll('[id^="rc-"] button,[id^="rc-"] select,[id^="rc-"] input').forEach(b=>b.disabled=true)}
// Only the approved native forms operate here. Guard persistence against a changed historical origin.
const nativeSave=save;
save=function(){
 if(nativeBlocked)throw Error("Recargá antes de guardar");
 try{getModel();const result=nativeSave();refreshNative();return result}
 catch(error){blockNative(error);throw error}
};
function nativeDialog(id){const dialog=document.getElementById(id);if(!dialog)throw Error("Formulario no disponible");if(dialog.parentNode!==document.body)document.body.appendChild(dialog);return dialog}
for(const id of ["movementComposerDialog","oneActionSuccessDialog","debtDialog","reserveDialog","sharedChargeDialog","sharedGroupDialog","cobroPaymentDialog","cobroHistoryDialog","oneProjectDialog","oneProjectBucketDialog","oneProjectPlanDialog","oneProjectReconcileDialog","debtBalanceDialog","oneSplitFareDialog"]){const d=nativeDialog(id);d.addEventListener("close",refreshNative)}
function selectedDate(){const r=agg(T.select(state));return T.contains(r,TODAY)?TODAY:r.start}
function openMovement(m=null){m2OpenComposer(m);if(!m)document.getElementById("mDate").value=selectedDate()}
function openNative(action,id){
 if(nativeBlocked)return;
 const find=(k)=>(data[k]||[]).find(x=>x.id===id);
 if(action==="movement"){openMovement();return}
 if(action==="edit-movement"){const m=find("movements");if(m&&!oneIsLinkedCobroMovement(m))openMovement(m);return}
 if(action==="delete-movement"){const m=find("movements");if(!m||oneIsLinkedCobroMovement(m))return;const b=document.createElement("button");b.dataset.deleteMovement=m.id;document.body.appendChild(b);try{b.click()}finally{b.remove()}return}
 if(action==="debt"){openDebt(id?find("debts"):null);return}
 if(action==="goal"){openReserve(id?find("reserves"):null);return}
 if(action==="contribution"){openMovement();oneCentralOpenGoal({reserveId:id});document.getElementById("oneCentralGoalDate").value=selectedDate();return}
 if(action==="collection"){openSharedCharge(id?find("sharedCharges"):null);if(!id)document.getElementById("scDate").value=selectedDate();return}
 if(action==="group"){openSharedGroup();return}
 if(action==="payment"){const c=find("sharedCharges");if(c)openCobroPayment(c);return}
 if(action==="project"){oneProjectOpen(id?find("projects"):null);return}
 if(action==="project-plan"){if(find("projects")){oneProjectSelect(id);oneProjectOpenPlan();document.getElementById("oneProjectPlanDue").value=selectedDate()}return}
}
const actionButton=(action,name,id="")=>'<button type="button" class="demo-add" data-native-action="'+action+'" data-native-id="'+esc(id)+'">'+name+'</button>';
function moduleActions(v){
 const toolbar=buttons=>'<div class="demo-native-actions">'+buttons.join("")+'</div>';
 if(moduleName==="moves")return toolbar([actionButton("movement","＋ Agregar movimiento")]);
 if(moduleName==="debts")return toolbar([actionButton("debt","＋ Agregar deuda")])+(data.debts||[]).filter(d=>debtStatus(d)==="active").map(d=>'<div class="demo-alloc"><span>'+esc(d.name)+'</span>'+actionButton("debt","Editar",d.id)+'</div>').join("");
 if(moduleName==="goals")return toolbar([actionButton("goal","＋ Crear meta")])+v.goals.map(g=>'<div class="demo-alloc"><span>'+esc(g.name)+'</span>'+actionButton("goal","Editar",g.id)+actionButton("contribution","Aportar",g.id)+'</div>').join("");
 if(moduleName==="collections")return toolbar([actionButton("collection","＋ Agregar cobro"),actionButton("group","Grupo")])+v.collections.due.map(c=>'<div class="demo-alloc"><span>'+esc(c.name)+'</span>'+actionButton("collection","Editar",c.id)+actionButton("payment","Abonar",c.id)+'</div>').join("");
 if(moduleName==="projects")return toolbar([actionButton("project","＋ Crear proyecto")])+v.projects.map(p=>'<div class="demo-alloc"><span>'+esc(p.name)+'</span>'+actionButton("project","Editar",p.id)+actionButton("project-plan","Prever gasto",p.id)+'</div>').join("");
 return "";
}
function nativeFeed(range){const rows=O.movements(data,range);return '<div class="demo-feed">'+(rows.length?rows.map(m=>'<div class="demo-feed-row"><small class="muted">'+short(m.date)+'</small><div><strong>'+esc(m.description||m.category||m.type)+'</strong><div class="demo-chip">'+esc(m.type)+' · '+esc(m.category||"")+'</div></div><div><strong>'+f(Math.round(m.amount*100),m.currency||"CRC")+'</strong>'+(!oneIsLinkedCobroMovement(m)?'<details class="demo-alloc-list"><summary>Acciones</summary>'+actionButton("edit-movement","Editar",m.id)+actionButton("delete-movement","Eliminar",m.id)+'</details>':'<small class="muted">Vinculado a Cobros</small>')+'</div></div>').join(""):'<div class="demo-empty">Sin movimientos registrados en este período.</div>')+'</div>'}
`);
 const start=h.indexOf(' else if(moduleName==="moves")el("content").innerHTML='),end=h.indexOf(' else el("content").innerHTML=moduleCards(v);',start);
 assert(start>0&&end>start);
 h=h.slice(0,start)+' else if(moduleName==="moves")el("content").innerHTML=kpis(p)+moduleActions(v)+nativeFeed(range);\n'+h.slice(end);
 rep('else el("content").innerHTML=moduleCards(v);','else el("content").innerHTML=moduleActions(v)+moduleCards(v);');
 rep('const b=e.target.closest("[data-add],[data-edit],[data-distribute],[data-transfer]");','const action=e.target.closest("[data-native-action]");if(action){try{openNative(action.dataset.nativeAction,action.dataset.nativeId)}catch(error){alert(error.message)}return}const b=e.target.closest("[data-add],[data-edit],[data-distribute],[data-transfer]");');
 rep('b.setAttribute("aria-pressed",String(id===moduleName))','b.setAttribute("aria-pressed",String(id===moduleName))');
 // Optional modules in the native app must also be enabled to retain movement-project links.
 rep('if(input.checked)enabledModules.add(id);','if(input.checked){enabledModules.add(id);const nativeId=({goals:"capital",collections:"shared"})[id]||id;if(!oneModuleEnabled(nativeId))oneSetModuleEnabled(nativeId,true)}');
 rep('function commitNative(staged){','function commitNative(staged){if(nativeBlocked)throw Error("Recargá antes de guardar");');
 rep('const a=v.future,scenario=B.scenario(model,TODAY,v.range.end,confirmedFlows(),currentRates(),F,S);','const a=v.future,scenario=B.scenario(model,TODAY,v.range.end,confirmedFlows(),currentRates(),F,S),liquidity=O.liquidity(scenario,v.operating.minor,oneFutureForecast(TODAY,90).items,TODAY,v.range.end);');
 rep('No es saldo futuro. Excluye obligaciones no conciliadas y presupuesto sin fecha.','Escenario parcial: cuotas nativas hasta 90 días, sin presupuesto de deuda adicional, proyectos ni cobros pendientes.');
 rep('<h2>Flujo fechado parcial</h2>','<h2>Escenario de liquidez parcial</h2>');
 rep('(scenario.netMinor===null?"—":f(scenario.netMinor,"CRC"))','(liquidity===null?"—":f(liquidity.netMinor,"CRC"))');
 rep('<span>Variación incluida · desde hoy</span>','<span>Variación incluida · desde hoy</span>');
 rep('Compromisos separados del presupuesto.','Compromisos separados del presupuesto; no se suman automáticamente.');
 rep('#v17NativeHost{display:none!important}', '#v17NativeHost{display:none!important}.olo-demo .demo-native-actions{display:flex;justify-content:flex-end;gap:6px;margin:0 0 12px}.olo-demo .demo-native-actions+ .demo-alloc{margin-top:4px}.olo-demo dialog:not([id^="rc-"]){max-width:calc(100vw - 24px)}');
 assert(!h.includes("rastro_lab_v17_rc1_preview_"));return h;
}
if(require.main===module){const out=path.join(root,"preview-v17-rc2");fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"One-Less-One-V17.0-RC2-TECNICA.html"),buildCandidate());fs.writeFileSync(path.join(out,"LEEME.txt"),"RC2 técnica aislada. Datos ficticios, almacenamiento separado de RC1/Daniel/Lab, sin red. No importés datos reales. Probá registrar, editar y eliminar movimientos, crear deuda, meta, cobro y proyecto, y recargar. Futuro es parcial, no saldo definitivo. No apta para producción.");}
module.exports={buildCandidate};
