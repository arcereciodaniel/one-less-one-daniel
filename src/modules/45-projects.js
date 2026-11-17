/* V11.6 · Proyectos Beta 1.2. Capa de presupuesto sobre movimientos reales.
   No se crean movimientos contables al planificar, asociar ni archivar. */
let oneProjectSelectedId="";
function oneProjectById(idValue){return (data.projects||[]).find(p=>p&&p.id===idValue)||null}
function oneProjectCurrent(){return oneProjectById(oneProjectSelectedId)}
function oneProjectEnabled(p){return p?.status!=="archived"}
function oneProjectHasActivity(p){
 return (data.projectLinks||[]).some(x=>x.projectId===p.id)||
        (data.projectPlans||[]).some(x=>x.projectId===p.id)||
        (p.buckets||[]).some(b=>num(b.budget)>0)||!!p.goalId||!!p.cobroGroupId;
}
function oneProjectLinkForMovement(movementId){
 return (data.projectLinks||[]).find(l=>l.movementId===movementId)||null;
}
function oneProjectMovementRows(p){
 const ids=new Map((data.movements||[]).map(m=>[m.id,m]));
 return (data.projectLinks||[]).filter(l=>l.projectId===p.id).map(link=>({link,m:ids.get(link.movementId)}))
  .filter(x=>x.m&&x.m.type==="Gasto")
  .sort((a,b)=>b.m.date.localeCompare(a.m.date)||num(b.m.seq)-num(a.m.seq));
}
function oneProjectExpenseValue(p,m){
 const currency=normalizeCurrency(m.currency||"CRC");
 if(currency===p.currency)return num(m.amount);
 if(p.currency==="CRC")return recordToCRC(m,"pay");
 const sell=num(m.fxSell)||currentRates().sell;
 return sell>0?num(m.amount)/sell:0;
}
function oneProjectSpent(p,bucketId=null){
 return oneProjectMovementRows(p).filter(x=>bucketId===null||x.link.bucketId===bucketId)
  .reduce((sum,x)=>sum+oneProjectExpenseValue(p,x.m),0);
}
/* V11.6: una previsión puede conciliarse con uno o más gastos reales.
   projectLinks.planId es opcional; jamás representa un segundo asiento. */
function oneProjectPlanRows(p,plan){
 return oneProjectMovementRows(p).filter(x=>x.link.planId===plan.id);
}
function oneProjectPlanSummary(p,plan){
 const rows=oneProjectPlanRows(p,plan),planned=Math.max(0,num(plan.amount));
 const actual=rows.reduce((sum,x)=>sum+oneProjectExpenseValue(p,x.m),0);
 const remaining=plan.status==="closed"?0:Math.max(0,planned-actual);
 const status=plan.status==="closed"?"closed":actual>=planned-.005?"covered":actual>.005?"partial":"pending";
 return {planned,actual,remaining,delta:actual-planned,rows,status};
}
function oneProjectPending(p,bucketId=null){
 return (data.projectPlans||[]).filter(x=>x.projectId===p.id&&(bucketId===null||x.bucketId===bucketId))
  .reduce((sum,x)=>sum+oneProjectPlanSummary(p,x).remaining,0);
}
function oneProjectPlanTotals(p){
 const plans=(data.projectPlans||[]).filter(x=>x.projectId===p.id);
 const summaries=plans.map(plan=>oneProjectPlanSummary(p,plan));
 return {planned:summaries.reduce((sum,x)=>sum+x.planned,0),
  matched:summaries.reduce((sum,x)=>sum+x.actual,0),
  pending:summaries.reduce((sum,x)=>sum+x.remaining,0),
  count:plans.length,covered:summaries.filter(x=>x.status==="covered"||x.status==="closed").length,
  partial:summaries.filter(x=>x.status==="partial").length};
}
function oneProjectMoney(p,amount){return originalMoney(amount,p.currency)}
function oneProjectStore(mutator){
 const old={projects:clone(data.projects||[]),projectLinks:clone(data.projectLinks||[]),projectPlans:clone(data.projectPlans||[])};
 try{mutator();save();return true}
 catch(error){
  data.projects=old.projects;data.projectLinks=old.projectLinks;data.projectPlans=old.projectPlans;
  alert("No se pudo guardar Proyectos: "+String(error?.message||"Revisá el almacenamiento."));
  return false;
 }
}
function oneProjectSelect(projectId){
 oneProjectSelectedId=projectId||"";
 renderProjects();
}
function oneProjectBucketOptions(select,p,selected=""){
 if(!select)return;
 select.replaceChildren();
 const blank=document.createElement("option");blank.value="";blank.textContent="Sin concepto";select.appendChild(blank);
 for(const b of p?.buckets||[]){
  const opt=document.createElement("option");opt.value=b.id;opt.textContent=b.name;select.appendChild(opt);
 }
 select.value=(p?.buckets||[]).some(b=>b.id===selected)?selected:"";
}
function oneProjectMovementOptionList(){
 const sel=document.getElementById("mProject"),bucket=document.getElementById("mProjectBucket");
 if(!sel||!bucket)return;
 const editId=document.getElementById("mEditId")?.value||"";
 const old=oneProjectLinkForMovement(editId);
 const selected=sel.value||old?.projectId||"";
 sel.replaceChildren();
 const none=document.createElement("option");none.value="";none.textContent="Sin proyecto";sel.appendChild(none);
 for(const p of data.projects||[]){
  if(!oneProjectEnabled(p)&&p.id!==old?.projectId)continue;
  const op=document.createElement("option");op.value=p.id;
  op.textContent=p.name+(oneProjectEnabled(p)?"":" (archivado)");sel.appendChild(op);
 }
 const found=(data.projects||[]).some(p=>p.id===selected);
 sel.value=found&&[...sel.options].some(o=>o.value===selected)?selected:"";
 oneProjectBucketOptions(bucket,oneProjectById(sel.value),old?.projectId===sel.value?old?.bucketId:bucket.value);
}
function oneProjectSyncComposer(m=null){
 const field=document.getElementById("oneMovementProjectField");
 if(!field)return;
 const type=document.getElementById("mType")?.value;
 const old=oneProjectLinkForMovement(m?.id||document.getElementById("mEditId")?.value);
 field.hidden=type!=="Gasto"||(!oneModuleEnabled("projects")&&!old);
 if(field.hidden)return;
 const sel=document.getElementById("mProject"),bucket=document.getElementById("mProjectBucket");
 const desired=m?old?.projectId||"":sel.value;
 const desiredBucket=m?old?.bucketId||"":bucket.value;
 oneProjectMovementOptionList();
 if(desired&&[...sel.options].some(o=>o.value===desired))sel.value=desired;
 oneProjectBucketOptions(bucket,oneProjectById(sel.value),desiredBucket);
 bucket.disabled=!sel.value;
}
function oneProjectReadMovementSelection(type,existing){
 const current=oneProjectLinkForMovement(existing?.id);
 if(type!=="Gasto"){
  if(current)return {ok:false,error:"Este movimiento pertenece a un proyecto. Desvinculalo antes de cambiar su tipo."};
  return {ok:true,projectId:"",bucketId:""};
 }
 if(!oneModuleEnabled("projects"))return {ok:true,projectId:current?.projectId||"",bucketId:current?.bucketId||""};
 const pid=document.getElementById("mProject")?.value||"";
 const bid=document.getElementById("mProjectBucket")?.value||"";
 if(!pid)return {ok:true,projectId:"",bucketId:""};
 const p=oneProjectById(pid);
 if(!p)return {ok:false,error:"El proyecto ya no existe."};
 if(!oneProjectEnabled(p)&&current?.projectId!==p.id)return {ok:false,error:"El proyecto está archivado; reactiválo para vincular gastos."};
 if(bid&&!(p.buckets||[]).some(b=>b.id===bid))return {ok:false,error:"El concepto del proyecto no existe."};
 return {ok:true,projectId:pid,bucketId:bid};
}
function oneProjectAssignMovement(movementId,projectId,bucketId=""){
 const old=oneProjectLinkForMovement(movementId);
 const oldPlan=(data.projectPlans||[]).find(x=>x.id===old?.planId&&x.projectId===projectId);
 const keepPlanId=old?.projectId===projectId&&oldPlan&&
  (!oldPlan.bucketId||oldPlan.bucketId===bucketId)?oldPlan.id:"";
 if(old)data.projectLinks=data.projectLinks.filter(x=>x.movementId!==movementId);
 if(projectId)data.projectLinks.push({id:old?.id||id(),projectId,movementId,bucketId,
  ...(keepPlanId?{planId:keepPlanId}:{})});
}
function oneProjectCanMatch(p,plan,m){
 if(!m||m.type!=="Gasto")return false;
 const old=oneProjectLinkForMovement(m.id);
 if(old&&(old.projectId!==p.id||old.planId))return false;
 if(old&&plan.bucketId&&old.bucketId&&old.bucketId!==plan.bucketId)return false;
 return true;
}
function oneProjectMatchMovement(p,plan,movementId){
 if(!p||!oneProjectEnabled(p)||!plan||plan.projectId!==p.id)throw Error("La previsión no pertenece a un proyecto activo.");
 const m=(data.movements||[]).find(x=>x.id===movementId);
 if(!oneProjectCanMatch(p,plan,m))throw Error("El gasto ya pertenece a otra previsión, proyecto o concepto.");
 const old=oneProjectLinkForMovement(movementId);
 const bucketId=old?.bucketId||plan.bucketId||"";
 if(!old||bucketId!==old.bucketId)oneProjectAssignMovement(movementId,p.id,bucketId);
 const link=oneProjectLinkForMovement(movementId);
 if(!link||link.planId)throw Error("El gasto no puede conciliarse con esta previsión.");
 link.planId=plan.id;
}
function oneProjectUnmatchMovement(p,plan,movementId){
 const link=oneProjectLinkForMovement(movementId);
 if(!link||link.projectId!==p.id||link.planId!==plan.id)throw Error("No existe esta conciliación.");
 delete link.planId; // El movimiento sigue en el proyecto y conserva su asiento contable.
}

/* V11.4: estas relaciones son vistas de solo lectura sobre Metas y Cobros.
   Nunca generan ingresos, gastos, aportes ni ajustes a liquidez. */
function oneProjectConnectionMoney(p,crc){
 return originalMoney(p.currency==="CRC"?crc:fromCRC(crc,"USD"),p.currency);
}
function oneProjectLinkedGoal(p){
 return (data.reserves||[]).find(r=>r.id===p?.goalId&&r.type==="goal")||null;
}
function oneProjectLinkedCobroGroup(p){
 return (data.sharedChargeGroups||[]).find(g=>g.id===p?.cobroGroupId)||null;
}
function oneProjectCobroSummary(p){
 const group=oneProjectLinkedCobroGroup(p);
 const charges=group?(data.sharedCharges||[]).filter(c=>c.groupId===group.id):[];
 return {
  group,charges,
  pendingCRC:charges.reduce((sum,c)=>sum+cobroRemainingCRC(c),0),
  receivedCRC:charges.reduce((sum,c)=>sum+cobroReceivedCRC(c),0),
  pendingCount:charges.filter(c=>cobroRemainingOriginal(c)>.005).length
 };
}
function oneProjectConnectionChoices(select,rows,selected,placeholder){
 select.replaceChildren();
 const empty=document.createElement("option");empty.value="";empty.textContent=placeholder;select.appendChild(empty);
 for(const item of rows){
  const option=document.createElement("option");option.value=item.id;option.textContent=item.name;
  if(item.archived)option.textContent+=" (archivado)";
  if(item.busy){option.textContent+=" (otro proyecto)";option.disabled=true;}
  select.appendChild(option);
 }
 select.value=rows.some(r=>r.id===selected)?selected:"";
}
function oneProjectRefreshConnections(p=null){
 const all=(data.projects||[]).filter(x=>x.id!==p?.id);
 const goals=(data.reserves||[]).filter(r=>r.type==="goal").map(r=>({
  id:r.id,name:r.name,archived:reserveStatus(r)!=="active",busy:all.some(x=>x.goalId===r.id)
 }));
 const groups=(data.sharedChargeGroups||[]).map(g=>({
  id:g.id,name:g.name,archived:sharedGroupStatus(g)!=="active",busy:all.some(x=>x.cobroGroupId===g.id)
 }));
 oneProjectConnectionChoices(document.getElementById("oneProjectGoal"),goals,p?.goalId||"","Sin meta vinculada");
 oneProjectConnectionChoices(document.getElementById("oneProjectCobroGroup"),groups,p?.cobroGroupId||"","Sin grupo vinculado");
}
function oneProjectValidateConnections(existing,goalId,groupId){
 const other=(data.projects||[]).filter(x=>x.id!==existing?.id);
 if(goalId){
  const goal=(data.reserves||[]).find(r=>r.id===goalId&&r.type==="goal");
  if(!goal)return "La meta seleccionada ya no existe.";
  if(reserveStatus(goal)!=="active"&&existing?.goalId!==goalId)return "Reactivá la meta para vincularla.";
  if(other.some(p=>p.goalId===goalId))return "Esta meta ya está vinculada a otro proyecto.";
 }
 if(groupId){
  const group=sharedGroupById(groupId);
  if(!group)return "El grupo de Cobros seleccionado ya no existe.";
  if(sharedGroupStatus(group)!=="active"&&existing?.cobroGroupId!==groupId)return "Reactivá el grupo de Cobros para vincularlo.";
  if(other.some(p=>p.cobroGroupId===groupId))return "Este grupo de Cobros ya está vinculado a otro proyecto.";
 }
 return "";
}
function oneProjectConnectionsRender(p){
 const slot=document.getElementById("oneProjectConnections");
 if(!slot)return;
 const goal=oneProjectLinkedGoal(p),goalMissing=!!p.goalId&&!goal;
 const saved=goal?reserveBalanceAt(goal,todayIso()):0;
 const target=goal?reserveTargetCRC(goal):0;
 const percent=target>0?Math.round(Math.min(100,saved/target*100)):0;
 const cobro=oneProjectCobroSummary(p);
 const groupMissing=!!p.cobroGroupId&&!cobro.group;
 const goalHtml=goal?
  '<div class="one-project-connection-main"><strong>'+safe(goal.name)+'</strong><span>'+
   safe(oneProjectConnectionMoney(p,saved))+' ahorrado'+
   (target>0?' de '+safe(oneProjectConnectionMoney(p,target))+' · '+percent+'%':'')+'</span></div>'+
   '<p class="muted">'+(reserveStatus(goal)==="archived"?"Meta archivada. ":"")+
   'Ahorro apartado; no se cuenta como gasto ni como saldo operativo del proyecto.</p>':
  '<p class="muted">'+(goalMissing?"La meta vinculada ya no existe. Podés editar la relación.":"Relacioná una meta existente desde Editar para ver su ahorro.")+'</p>';
 const groupHtml=cobro.group?
  '<div class="one-project-connection-main"><strong>'+safe(cobro.group.name)+'</strong><span>'+
   cobro.charges.length+' cobro(s) · '+cobro.pendingCount+' pendiente(s)</span></div>'+
   '<div class="one-project-connection-values"><span>Pendiente <strong>'+safe(oneProjectConnectionMoney(p,cobro.pendingCRC))+'</strong></span>'+
   '<span>Recuperado <strong>'+safe(oneProjectConnectionMoney(p,cobro.receivedCRC))+'</strong></span></div>'+
   '<p class="muted">'+(sharedGroupStatus(cobro.group)==="archived"?"Grupo archivado. ":"")+
   'El cobro pendiente no es ingreso disponible. Los abonos se registran únicamente desde Cobros.</p>':
  '<p class="muted">'+(groupMissing?"El grupo vinculado ya no existe. Podés editar la relación.":"Relacioná un grupo de Cobros desde Editar para seguir lo pendiente y recuperado.")+'</p>';
 slot.innerHTML='<div class="one-project-connection"><div class="one-project-connection-head"><h3>Meta de ahorro</h3>'+
  '<button type="button" class="btn secondary small" data-one-project-go-to="capital">Abrir Metas</button></div>'+goalHtml+'</div>'+
  '<div class="one-project-connection"><div class="one-project-connection-head"><h3>Cobros relacionados</h3>'+
  '<button type="button" class="btn secondary small" data-one-project-go-to="shared">Abrir Cobros</button></div>'+groupHtml+'</div>';
}
function oneProjectOpen(p=null){
 const form=document.getElementById("oneProjectForm");form.reset();
 document.getElementById("oneProjectDialogTitle").textContent=p?"Editar proyecto":"Nuevo proyecto";
 document.getElementById("oneProjectId").value=p?.id||"";
 document.getElementById("oneProjectName").value=p?.name||"";
 document.getElementById("oneProjectStart").value=p?.startDate||"";
 document.getElementById("oneProjectEnd").value=p?.endDate||"";
 document.getElementById("oneProjectBudget").value=p?.budget??"";
 document.getElementById("oneProjectCurrency").value=normalizeCurrency(p?.currency||displayCurrency());
 document.getElementById("oneProjectNotes").value=p?.notes||"";
 oneProjectRefreshConnections(p);
 document.getElementById("oneProjectDialog").showModal();
}
function oneProjectOpenBucket(b=null){
 const p=oneProjectCurrent();if(!p||!oneProjectEnabled(p))return;
 document.getElementById("oneProjectBucketForm").reset();
 document.getElementById("oneProjectBucketTitle").textContent=b?"Editar concepto":"Nuevo concepto";
 document.getElementById("oneProjectBucketId").value=b?.id||"";
 document.getElementById("oneProjectBucketName").value=b?.name||"";
 document.getElementById("oneProjectBucketBudget").value=b?.budget??"";
 document.getElementById("oneProjectBucketDialog").showModal();
}
function oneProjectOpenPlan(plan=null){
 const p=oneProjectCurrent();if(!p||!oneProjectEnabled(p))return;
 document.getElementById("oneProjectPlanForm").reset();
 document.getElementById("oneProjectPlanTitle").textContent=plan?"Editar gasto previsto":"Gasto previsto";
 document.getElementById("oneProjectPlanId").value=plan?.id||"";
 document.getElementById("oneProjectPlanName").value=plan?.name||"";
 document.getElementById("oneProjectPlanAmount").value=plan?.amount??"";
 document.getElementById("oneProjectPlanDue").value=plan?.dueDate||"";
 oneProjectBucketOptions(document.getElementById("oneProjectPlanBucket"),p,plan?.bucketId||"");
 document.getElementById("oneProjectPlanDialog").showModal();
}
function oneProjectDetailRender(p){
 const section=document.getElementById("oneProjectDetails");section.hidden=false;
 const paid=oneProjectSpent(p),planned=oneProjectPending(p),budget=num(p.budget);
 document.getElementById("oneProjectDetailTitle").textContent=p.name;
 document.getElementById("oneProjectDetailMeta").textContent=[
  p.startDate?"Desde "+dateLabel(p.startDate):"",
  p.endDate?"Hasta "+dateLabel(p.endDate):"",
  p.currency,p.status==="archived"?"Archivado":"Activo"
 ].filter(Boolean).join(" · ");
 document.getElementById("oneProjectArchiveBtn").textContent=oneProjectEnabled(p)?"Archivar":"Reactivar";
 document.getElementById("oneAddProjectBucket").disabled=!oneProjectEnabled(p);
 document.getElementById("oneAddProjectPlan").disabled=!oneProjectEnabled(p);
 document.getElementById("oneProjectNewExpense").disabled=!oneProjectEnabled(p);
 const remaining=budget-paid,forecastRemaining=budget-paid-planned,pct=budget>0?paid/budget*100:0;
 oneProjectConnectionsRender(p);
 document.getElementById("oneProjectKpis").innerHTML=[
  ["Presupuesto",oneProjectMoney(p,budget)],
  ["Gastado",oneProjectMoney(p,paid)],
  ["Disponible",oneProjectMoney(p,remaining)],
  ["Previsto pendiente",oneProjectMoney(p,planned)]
 ].map(row=>'<div class="one-project-kpi"><span>'+row[0]+'</span><strong>'+safe(row[1])+'</strong></div>').join("");
 document.getElementById("oneProjectProgressLabel").textContent=budget?Math.round(pct)+"%":"Sin presupuesto";
 document.getElementById("oneProjectProgressFill").style.width=Math.min(100,Math.max(0,pct))+"%";
 document.getElementById("oneProjectProgressFill").classList.toggle("over",pct>100);
 document.getElementById("oneProjectBudgetNote").textContent="Proyección incluyendo previstos pendientes: "+oneProjectMoney(p,forecastRemaining)+
  ". Los previstos no modifican tu saldo real ni los reportes generales. Si registrás uno, marcá su previsión como resuelta.";
 const buckets=p.buckets||[];
 const bucketSum=buckets.reduce((s,b)=>s+num(b.budget),0);
 const assignedSpend=buckets.reduce((s,b)=>s+oneProjectSpent(p,b.id),0);
 const unassigned=paid-assignedSpend;
 document.getElementById("oneProjectBuckets").innerHTML=buckets.map(b=>{
  const spent=oneProjectSpent(p,b.id),pending=oneProjectPending(p,b.id),limit=num(b.budget);
  return '<div class="one-project-item"><div><strong>'+safe(b.name)+'</strong><small>'+
   safe(oneProjectMoney(p,spent))+' gastado · '+safe(oneProjectMoney(p,pending))+' previsto / '+safe(oneProjectMoney(p,limit))+' asignado</small></div>'+
   '<button type="button" class="btn secondary small" data-one-edit-bucket="'+safe(b.id)+'" '+(oneProjectEnabled(p)?"":"disabled")+'>Editar</button></div>';
 }).join("")+
 '<div class="one-project-item"><div><strong>Sin concepto</strong><small>'+safe(oneProjectMoney(p,unassigned))+
 ' de gastos sin asignación · '+safe(oneProjectMoney(p,budget-bucketSum))+' del presupuesto sin distribuir</small></div></div>'+
 (bucketSum>budget?'<p class="one-project-caution">Los conceptos suman más que el presupuesto total del proyecto.</p>':"");
 const plans=(data.projectPlans||[]).filter(x=>x.projectId===p.id);
 document.getElementById("oneProjectPlans").innerHTML=plans.length?plans.map(x=>{
  const closed=x.status==="closed";
  return '<div class="one-project-item'+(closed?" one-project-resolved":"")+'"><div><strong>'+safe(x.name)+'</strong><small>'+
   safe(oneProjectMoney(p,num(x.amount)))+(x.dueDate?" · "+safe(dateLabel(x.dueDate)):"")+
   ' · '+(closed?"Resuelto":"Pendiente")+'</small></div><div class="one-project-item-actions">'+
   '<button type="button" class="btn secondary small" data-one-edit-plan="'+safe(x.id)+'" '+(!oneProjectEnabled(p)||closed?"disabled":"")+'>Editar</button>'+
   '<button type="button" class="btn secondary small" data-one-toggle-plan="'+safe(x.id)+'" '+(!oneProjectEnabled(p)?"disabled":"")+'>'+(closed?"Reabrir":"Resolver")+'</button></div></div>';
 }).join(""):'<p class="muted">Todavía no tenés gastos previstos.</p>';
 const linked=oneProjectMovementRows(p);
 document.getElementById("oneProjectLinkedMovements").innerHTML=linked.length?linked.map(x=>
  '<div class="one-project-item"><div><strong>'+safe(x.m.description||movementCategoryName(x.m))+'</strong><small>'+
  safe(dateLabel(x.m.date))+' · '+safe(originalMoney(x.m.amount,x.m.currency))+
  ' · '+safe(oneProjectMoney(p,oneProjectExpenseValue(p,x.m)))+
  ((p.buckets||[]).find(b=>b.id===x.link.bucketId)?' · '+safe(p.buckets.find(b=>b.id===x.link.bucketId).name):'')+
  '</small></div><button type="button" class="btn secondary small" data-one-unlink-movement="'+safe(x.m.id)+'" '+(oneProjectEnabled(p)?"":"disabled")+'>Desvincular</button></div>'
 ).join(""):'<p class="muted">Ningún gasto vinculado todavía.</p>';
 const available=(data.movements||[]).filter(m=>m.type==="Gasto"&&!oneProjectLinkForMovement(m.id))
  .sort((a,b)=>b.date.localeCompare(a.date)||num(b.seq)-num(a.seq)).slice(0,200);
 const movementSelect=document.getElementById("oneProjectMovementSelect");
 movementSelect.replaceChildren();
 const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent=available.length?"Seleccioná un gasto sin proyecto":"No hay gastos disponibles";movementSelect.appendChild(placeholder);
 for(const m of available){
  const opt=document.createElement("option");opt.value=m.id;
  opt.textContent=m.date+" · "+(m.description||movementCategoryName(m))+" · "+originalMoney(m.amount,m.currency);
  movementSelect.appendChild(opt);
 }
 oneProjectBucketOptions(document.getElementById("oneProjectLinkBucket"),p);
 const form=document.getElementById("oneProjectLinkForm");
 form.querySelector('button[type="submit"]').disabled=!oneProjectEnabled(p)||!available.length;
 movementSelect.disabled=!oneProjectEnabled(p)||!available.length;
 document.getElementById("oneProjectLinkBucket").disabled=!oneProjectEnabled(p);
}
function renderProjects(){
 const list=document.getElementById("oneProjectsList");if(!list)return;
 const projects=(data.projects||[]).filter(p=>p&&p.id);
 const active=projects.filter(oneProjectEnabled);
 document.getElementById("oneProjectsSummary").innerHTML=
  '<span><strong>'+active.length+'</strong> activo(s)</span><span><strong>'+projects.length+'</strong> total</span>'+
  '<span class="muted">Un vínculo solo agrega seguimiento; nunca otro gasto.</span>';
 const filter=document.getElementById("oneProjectStatusFilter").value;
 const visible=projects.filter(p=>filter==="all"||(filter==="active"?oneProjectEnabled(p):!oneProjectEnabled(p)));
 if(!visible.some(p=>p.id===oneProjectSelectedId))oneProjectSelectedId=visible[0]?.id||"";
 list.innerHTML=visible.length?visible.map(p=>{
  const spent=oneProjectSpent(p),budget=num(p.budget),pct=budget?Math.round(100*spent/budget):0;
  return '<button type="button" class="one-project-card'+(oneProjectSelectedId===p.id?' selected':'')+
  '" data-one-select-project="'+safe(p.id)+'"><span class="one-project-card-top"><strong>'+safe(p.name)+'</strong><small>'+
  (oneProjectEnabled(p)?"Activo":"Archivado")+'</small></span><span class="one-project-card-meta">'+
  safe(oneProjectMoney(p,spent))+' de '+safe(oneProjectMoney(p,budget))+'</span><span class="one-project-card-track"><i style="width:'+Math.min(100,Math.max(0,pct))+'%"></i></span><span class="muted">'+pct+'% gastado</span></button>';
 }).join(""):'<div class="one-project-empty">No hay proyectos en esta vista. Creá uno para empezar a planificar.</div>';
 const selected=oneProjectCurrent();
 if(selected&&visible.some(p=>p.id===selected.id))oneProjectDetailRender(selected);
 else document.getElementById("oneProjectDetails").hidden=true;
}
function oneProjectInit(){
 const q=id=>document.getElementById(id);
 q("oneProjectStatusFilter").addEventListener("change",renderProjects);
 q("oneCreateProjectBtn").addEventListener("click",()=>oneProjectOpen());
 q("oneProjectCancel").addEventListener("click",()=>q("oneProjectDialog").close());
 q("oneProjectBucketCancel").addEventListener("click",()=>q("oneProjectBucketDialog").close());
 q("oneProjectPlanCancel").addEventListener("click",()=>q("oneProjectPlanDialog").close());
 q("oneProjectEditBtn").addEventListener("click",()=>oneProjectOpen(oneProjectCurrent()));
 q("oneAddProjectBucket").addEventListener("click",()=>oneProjectOpenBucket());
 q("oneAddProjectPlan").addEventListener("click",()=>oneProjectOpenPlan());
 q("oneProjectsList").addEventListener("click",event=>{
  const target=event.target.closest("[data-one-select-project]");
  if(target)oneProjectSelect(target.dataset.oneSelectProject);
 });
 q("oneProjectArchiveBtn").addEventListener("click",()=>{
  const p=oneProjectCurrent();if(!p)return;
  if(oneProjectEnabled(p)&&!confirm("¿Archivar este proyecto? Se conservarán sus presupuestos, previsiones y vínculos históricos."))return;
  if(!oneProjectStore(()=>{p.status=oneProjectEnabled(p)?"archived":"active";p.closedAt=p.status==="archived"?todayIso():"";}))return;
  renderProjects();
 });
 q("oneProjectForm").addEventListener("submit",event=>{
  event.preventDefault();
  const projectId=q("oneProjectId").value,existing=oneProjectById(projectId);
  const name=q("oneProjectName").value.trim(),budget=Number(q("oneProjectBudget").value);
  const startDate=q("oneProjectStart").value,endDate=q("oneProjectEnd").value;
  const currency=normalizeCurrency(q("oneProjectCurrency").value);
  const goalId=q("oneProjectGoal").value,cobroGroupId=q("oneProjectCobroGroup").value;
  const connectionError=oneProjectValidateConnections(existing,goalId,cobroGroupId);
  if(connectionError)return alert(connectionError);
  if(!name||!Number.isFinite(budget)||budget<0)return alert("Ingresá un nombre y un presupuesto válido.");
  if((startDate&&!restoreValidDate(startDate))||(endDate&&!restoreValidDate(endDate))||(startDate&&endDate&&endDate<startDate))return alert("Revisá las fechas: la finalización no puede ser anterior al inicio.");
  if(existing&&existing.currency!==currency&&oneProjectHasActivity(existing))return alert("Este proyecto ya tiene importes asociados. No podés cambiar su moneda sin alterar su interpretación histórica.");
  let selectedId=existing?.id||id();
  if(!oneProjectStore(()=>{
   const next={...(existing||{}),id:selectedId,name,budget,currency,startDate,endDate,goalId,cobroGroupId,
     notes:q("oneProjectNotes").value.trim(),status:existing?.status||"active",
     buckets:existing?.buckets||[],createdAt:existing?.createdAt||new Date().toISOString()};
   if(existing)Object.assign(existing,next);else data.projects.push(next);
  }))return;
  q("oneProjectDialog").close();
  q("oneProjectStatusFilter").value=existing&&!oneProjectEnabled(existing)?"archived":"active";
  oneProjectSelectedId=selectedId;renderProjects();
  oneActionSaved(existing?"Proyecto actualizado":"Proyecto creado",name+" · presupuesto "+oneProjectMoney(oneProjectById(selectedId),budget));
 });
 q("oneProjectBucketForm").addEventListener("submit",event=>{
  event.preventDefault();const p=oneProjectCurrent();if(!p||!oneProjectEnabled(p))return;
  const bucketId=q("oneProjectBucketId").value,old=p.buckets.find(b=>b.id===bucketId);
  const name=q("oneProjectBucketName").value.trim(),budget=Number(q("oneProjectBucketBudget").value);
  if(!name||!Number.isFinite(budget)||budget<0)return alert("Completá el concepto y su presupuesto.");
  if(p.buckets.some(b=>b.id!==bucketId&&b.name.trim().toLocaleLowerCase("es")===name.toLocaleLowerCase("es")))return alert("Ya existe un concepto con ese nombre.");
  if(!oneProjectStore(()=>{
    if(old){old.name=name;old.budget=budget}
    else p.buckets.push({id:id(),name,budget});
  }))return;
  q("oneProjectBucketDialog").close();renderProjects();
 });
 q("oneProjectPlanForm").addEventListener("submit",event=>{
  event.preventDefault();const p=oneProjectCurrent();if(!p||!oneProjectEnabled(p))return;
  const planId=q("oneProjectPlanId").value,plan=(data.projectPlans||[]).find(x=>x.id===planId&&x.projectId===p.id);
  const name=q("oneProjectPlanName").value.trim(),amount=Number(q("oneProjectPlanAmount").value),dueDate=q("oneProjectPlanDue").value,bucketId=q("oneProjectPlanBucket").value;
  if(!name||!Number.isFinite(amount)||amount<=0||dueDate&&!restoreValidDate(dueDate))return alert("Completá una descripción y un monto previsto válido.");
  if(bucketId&&!p.buckets.some(b=>b.id===bucketId))return alert("El concepto ya no existe.");
  if(!oneProjectStore(()=>{
   const next={id:plan?.id||id(),projectId:p.id,name,amount,dueDate,bucketId,status:plan?.status||"pending"};
   if(plan)Object.assign(plan,next);else data.projectPlans.push(next);
  }))return;
  q("oneProjectPlanDialog").close();renderProjects();
 });
 q("oneProjectDetails").addEventListener("click",event=>{
  const open=event.target.closest("[data-one-project-go-to]");
  if(open){
   const target=open.dataset.oneProjectGoTo;
   if(!oneModuleEnabled(target))return alert("Activá esta herramienta desde el botón + antes de abrirla.");
   navigate(target);return;
  }
  const p=oneProjectCurrent();if(!p||!oneProjectEnabled(p))return;
  const bucket=event.target.closest("[data-one-edit-bucket]");
  const plan=event.target.closest("[data-one-edit-plan]");
  const toggle=event.target.closest("[data-one-toggle-plan]");
  const unlink=event.target.closest("[data-one-unlink-movement]");
  if(bucket){oneProjectOpenBucket(p.buckets.find(x=>x.id===bucket.dataset.oneEditBucket));return;}
  if(plan){oneProjectOpenPlan(data.projectPlans.find(x=>x.id===plan.dataset.oneEditPlan&&x.projectId===p.id));return;}
  if(toggle){
   const target=data.projectPlans.find(x=>x.id===toggle.dataset.oneTogglePlan&&x.projectId===p.id);if(!target)return;
   if(!oneProjectStore(()=>{target.status=target.status==="closed"?"pending":"closed"}))return;
   renderProjects();return;
  }
  if(unlink){
   const idValue=unlink.dataset.oneUnlinkMovement;
   if(!confirm("¿Desvincular este gasto? Se conservará intacto en Movimientos y Presupuesto."))return;
   if(!oneProjectStore(()=>{data.projectLinks=data.projectLinks.filter(x=>!(x.projectId===p.id&&x.movementId===idValue))}))return;
   renderProjects();return;
  }
 });
 q("oneProjectLinkForm").addEventListener("submit",event=>{
  event.preventDefault();const p=oneProjectCurrent();if(!p||!oneProjectEnabled(p))return;
  const movementId=q("oneProjectMovementSelect").value,bucketId=q("oneProjectLinkBucket").value;
  const movement=data.movements.find(m=>m.id===movementId);
  if(!movement||movement.type!=="Gasto")return alert("Seleccioná un gasto real de Movimientos.");
  if(oneProjectLinkForMovement(movementId))return alert("El gasto ya está vinculado a otro proyecto.");
  if(bucketId&&!p.buckets.some(b=>b.id===bucketId))return alert("El concepto del proyecto no existe.");
  if(!oneProjectStore(()=>oneProjectAssignMovement(movementId,p.id,bucketId)))return;
  renderProjects();
 });
 q("oneProjectNewExpense").addEventListener("click",()=>{
  const p=oneProjectCurrent();if(!p||!oneProjectEnabled(p))return;
  m2OpenComposer();
  oneProjectSyncComposer();
  const select=q("mProject"),bucket=q("mProjectBucket");
  if([...select.options].some(op=>op.value===p.id)){
   select.value=p.id;oneProjectBucketOptions(bucket,p);bucket.disabled=false;
  }
 });
 q("mProject").addEventListener("change",()=>{
  oneProjectBucketOptions(q("mProjectBucket"),oneProjectById(q("mProject").value));
  q("mProjectBucket").disabled=!q("mProject").value;
 });
}
