function reserveLabel(r){return r.type==="protected"?"Capital protegido":"Meta / reserva"}
function openReserve(r=null){
  document.getElementById("reserveDialogTitle").textContent=r?"Editar fondo":"Agregar fondo";
  document.getElementById("fId").value=r?.id||"";
  document.getElementById("fName").value=r?.name||"";
  document.getElementById("fType").value=r?.type||"goal";
  document.getElementById("fTarget").value=num(r?.target);
  document.getElementById("fTargetCurrency").value=normalizeCurrency(r?.targetCurrency||displayCurrency());
  document.getElementById("fTargetDate").value=r?.targetDate||"";
  document.getElementById("fOpeningAmount").value=num(r?.openingAmount);
  document.getElementById("fOpeningCurrency").value=normalizeCurrency(r?.openingCurrency||displayCurrency());
  document.getElementById("fOpeningDate").value=r?.openingDate||todayIso();
  document.getElementById("fLocation").value=r?.location||"";
  document.getElementById("fRate").value=num(r?.rate);
  document.getElementById("fNotes").value=r?.notes||"";
  oneFillGoalBudgetCategory("fBudgetCategory",r?oneGoalBudgetCategory(r):null);
  document.getElementById("reserveDialog").showModal();
}
function reserveStatus(r){return r?.status==="archived"?"archived":"active"}
function activeReserves(){return data.reserves.filter(r=>reserveStatus(r)==="active")}
function refreshReserveSelect(selected=""){
  const el=document.getElementById("rtReserve");if(!el)return;
  fillObjectSelect(el,activeReserves().map(r=>({value:r.id,label:r.name})),selected||el.value);
}
function sharedGroupById(id){return (data.sharedChargeGroups||[]).find(g=>g.id===id)}
function sharedGroupStatus(g){return g?.status==="archived"?"archived":"active"}
function activeSharedGroups(){return (data.sharedChargeGroups||[]).filter(g=>sharedGroupStatus(g)==="active")}
function archivedSharedGroups(){return (data.sharedChargeGroups||[]).filter(g=>sharedGroupStatus(g)==="archived")}
function sharedGroupView(){return uiState.sharedGroupView==="archived"?"archived":"active"}
function setSharedGroupView(view){uiState.sharedGroupView=view==="archived"?"archived":"active";saveUiState();renderSharedCharges()}
const sharedSelectedChargeIds=new Set();
function selectedSharedCharges(){return (data.sharedCharges||[]).filter(c=>sharedSelectedChargeIds.has(c.id))}
function clearSharedSelection(){sharedSelectedChargeIds.clear();renderSharedCharges()}
function syncSharedBulkBar(){
  const bar=document.getElementById("sharedBulkActions"), count=document.getElementById("sharedSelectedCount");if(!bar||!count)return;
  const rows=selectedSharedCharges();count.textContent=`${rows.length} ${rows.length===1?"cobro seleccionado":"cobros seleccionados"}`;bar.classList.toggle("active",rows.length>0);
  const remove=document.getElementById("removeSelectedGroupBtn");if(remove)remove.style.display=rows.some(c=>c.groupId)?"":"none";
}
function selectSharedCharge(idValue,checked){checked?sharedSelectedChargeIds.add(idValue):sharedSelectedChargeIds.delete(idValue);syncSharedBulkBar()}
function openAssignSharedGroup(ids=null){
  if(Array.isArray(ids)){sharedSelectedChargeIds.clear();ids.forEach(x=>sharedSelectedChargeIds.add(x))}
  const rows=selectedSharedCharges();if(!rows.length)return alert("Seleccioná al menos un cobro.");
  const groups=activeSharedGroups(), sel=document.getElementById("assignGroupSelect");
  fillObjectSelect(sel,groups.map(g=>({value:g.id,label:g.name})),groups[0]?.id||"");
  document.getElementById("assignSharedGroupSummary").textContent=`Vas a agrupar ${rows.length} ${rows.length===1?"cobro":"cobros"}.`;
  document.getElementById("assignNewGroupName").value="";document.getElementById("assignNewGroupPerson").value="";document.getElementById("assignNewGroupNotes").value="";
  setAssignSharedMode(groups.length?"existing":"new");
  document.getElementById("assignSharedGroupDialog").showModal();
}
function setAssignSharedMode(mode){
  const isNew=mode==="new";document.getElementById("assignExistingWrap").hidden=isNew;document.getElementById("assignNewWrap").hidden=!isNew;
  document.getElementById("assignExistingModeBtn").classList.toggle("active",!isNew);document.getElementById("assignNewModeBtn").classList.toggle("active",isNew);
  document.getElementById("assignExistingModeBtn").dataset.mode=isNew?"":"active";document.getElementById("assignNewModeBtn").dataset.mode=isNew?"active":"";
}
function applyGroupToSelected(groupId){
  if(groupId){const target=sharedGroupById(groupId);if(!target||sharedGroupStatus(target)!=="active")return alert("Ese grupo está archivado. Reactívalo antes de agregar nuevos cobros.");}
  const month=selectedReceivableMonth(), selected=[...sharedSelectedChargeIds];
  for(const cid of selected){
    const c=(data.sharedCharges||[]).find(x=>x.id===cid);if(!c)continue;c.groupId=groupId;
    if(c.sourceRecurringId){
      const t=(data.receivableRecurring||[]).find(x=>x.id===c.sourceRecurringId);if(t)t.groupId=groupId;
      (data.sharedCharges||[]).filter(x=>x.sourceRecurringId===c.sourceRecurringId&&(x.chargeMonth||monthKey(x.date))>=month).forEach(x=>x.groupId=groupId);
    }
  }
  sharedSelectedChargeIds.clear();save();renderSharedCharges();
}
function refreshSharedGroupSelects(selected=""){
  const form=document.getElementById("scGroup");
  if(form){
    const current=selected!==undefined&&selected!==null?selected:(form.value||"");
    let groups=activeSharedGroups();
    const currentGroup=sharedGroupById(current);
    if(currentGroup&&sharedGroupStatus(currentGroup)==="archived"&&!groups.some(g=>g.id===currentGroup.id))groups=[currentGroup,...groups];
    fillObjectSelect(form,[{value:"",label:"Sin grupo"},...groups.map(g=>({value:g.id,label:g.name+(sharedGroupStatus(g)==="archived"?" (archivado)":"")}))],current);
    form.value=groups.some(g=>g.id===current)?current:"";
  }
}
function selectedReceivableMonth(){
  const el=document.getElementById("sharedStatementMonth");
  return el?.value||currentFinancialContext().financialMonth||todayIso().slice(0,7);
}
function shiftMonthKey(month,delta){
  if(!/^\d{4}-\d{2}$/.test(month||""))return "";
  const [y,m]=month.split("-").map(Number),d=new Date(Date.UTC(y,m-1+delta,1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`;
}
function recurringApplies(t,month){return !!t&&t.startMonth<=month&&(!t.endMonth||month<=t.endMonth)}
function lastDayOfMonth(year,month){return new Date(Date.UTC(year,month,0)).getUTCDate()}
function recurringChargeDate(t,month){
  const [y,m]=month.split("-").map(Number),day=Math.min(Math.max(1,num(t.day)||1),lastDayOfMonth(y,m));
  return `${month}-${String(day).padStart(2,"0")}`;
}
function ensureRecurringChargesForMonth(month){
  if(!/^\d{4}-\d{2}$/.test(month||""))return;
  let changed=false;
  for(const t of data.receivableRecurring||[]){
    const linkedGroup=t.groupId?sharedGroupById(t.groupId):null;
    if(linkedGroup&&sharedGroupStatus(linkedGroup)==="archived")continue;
    if(!recurringApplies(t,month))continue;
    const exists=(data.sharedCharges||[]).some(c=>c.sourceRecurringId===t.id&&(c.chargeMonth||monthKey(c.date))===month);
    if(exists)continue;
    data.sharedCharges.push({id:id(),groupId:t.groupId,person:t.person,date:recurringChargeDate(t,month),dueDate:recurringChargeDate({...t,day:t.reminderDay||t.day},month),remindBeforeDays:num(t.remindBeforeDays??3),payments:[],snoozedUntil:"",chargeMonth:month,kind:t.kind,description:t.description,amount:num(t.amount),currency:normalizeCurrency(t.currency||"CRC"),...currentFxSnapshot(),status:"pending",paidAt:"",notes:t.notes||"",sourceRecurringId:t.id,createdAt:new Date().toISOString()});
    changed=true;
  }
  if(changed)save();
}
function openSharedGroup(g=null){
  document.getElementById("sharedGroupDialogTitle").textContent=g?"Editar grupo":"Agregar grupo";
  document.getElementById("sgId").value=g?.id||"";
  document.getElementById("sgName").value=g?.name||"";
  document.getElementById("sgPerson").value=g?.person||"";
  document.getElementById("sgNotes").value=g?.notes||"";
  document.getElementById("sharedGroupDialog").showModal();
}
function archiveSharedGroup(group){
  if(!group||sharedGroupStatus(group)==="archived")return;
  const closeMonth=currentFinancialContext().financialMonth||todayIso().slice(0,7);
  const charges=(data.sharedCharges||[]).filter(c=>c.groupId===group.id);
  const pending=charges.reduce((sum,c)=>sum+cobroRemainingCRC(c),0);
  const recurring=(data.receivableRecurring||[]).filter(t=>t.groupId===group.id&&recurringApplies(t,closeMonth));
  const reason=prompt(`Motivo para archivar “${group.name}” (opcional):`,`Grupo finalizado`);
  if(reason===null)return;
  const warning=[
    pending?`Tiene ${money(pending)} pendientes. Esos cobros se conservarán y seguirán apareciendo hasta pagarse.`:"",
    recurring.length?`Tiene ${recurring.length} ${recurring.length===1?"recurrencia activa":"recurrencias activas"}. Se detendrán los cargos futuros.`:""
  ].filter(Boolean).join("\n\n");
  if(!confirm(`¿Archivar “${group.name}”?${warning?`\n\n${warning}`:""}`))return;
  group.status="archived";group.closedAt=todayIso();group.closedReason=reason.trim()||"Grupo finalizado";
  recurring.forEach(t=>{if(!t.endMonth||t.endMonth>closeMonth)t.endMonth=closeMonth;t.stoppedByGroupArchive=true});
  const recurringIds=new Set(recurring.map(t=>t.id));
  data.sharedCharges=(data.sharedCharges||[]).filter(c=>!(recurringIds.has(c.sourceRecurringId)&&(c.chargeMonth||monthKey(c.date))>closeMonth&&c.status!=="paid"&&!(c.payments||[]).length));
  sharedSelectedChargeIds.clear();save();refreshSharedGroupSelects();renderSharedCharges();
}
function reactivateSharedGroup(group){
  if(!group||sharedGroupStatus(group)!=="archived")return;
  if(!confirm(`¿Reactivar “${group.name}”? Podrás volver a agregar cobros al grupo.\n\nLas recurrencias que se detuvieron al archivarlo no se reanudan automáticamente.`))return;
  group.status="active";group.closedAt="";group.closedReason="";save();refreshSharedGroupSelects();renderSharedCharges();
}
function deleteSharedGroup(group){
  if(!group)return;
  const charges=(data.sharedCharges||[]).filter(c=>c.groupId===group.id), recurring=(data.receivableRecurring||[]).filter(t=>t.groupId===group.id);
  const detail=charges.length?`\n\n${charges.length} ${charges.length===1?"cobro será movido":"cobros serán movidos"} a “Sin agrupar”; no se borrará ningún cobro.`:"\n\nEl grupo está vacío y se eliminará directamente.";
  const recurText=recurring.length?`\n${recurring.length} ${recurring.length===1?"recurrencia quedará":"recurrencias quedarán"} sin grupo.`:"";
  if(!confirm(`¿Eliminar definitivamente el grupo “${group.name}”?${detail}${recurText}`))return;
  charges.forEach(c=>c.groupId="");recurring.forEach(t=>t.groupId="");
  data.sharedChargeGroups=(data.sharedChargeGroups||[]).filter(g=>g.id!==group.id);
  sharedSelectedChargeIds.clear();save();refreshSharedGroupSelects();renderSharedCharges();
}
function oneSyncCobroReminderField(){
  const hasDate=!!document.getElementById("scDueDate")?.value;
  const field=document.getElementById("scReminderField");
  if(field)field.hidden=!hasDate;
  if(!hasDate)document.getElementById("scReminderDays").value="0";
}
function openSharedCharge(c=null,preferredGroupId="",options={}){
  document.getElementById("sharedChargeDialogTitle").textContent=c?"Editar cobro":"Agregar cobro";
  if(!c&&preferredGroupId){const g=sharedGroupById(preferredGroupId);if(g&&sharedGroupStatus(g)==="archived")return alert("Ese grupo está archivado. Reactívalo para agregar nuevos cobros.");}
  const preferred=c?.groupId||preferredGroupId||"";refreshSharedGroupSelects(preferred);
  const group=sharedGroupById(preferred), selectedMonth=selectedReceivableMonth(), recurring=!!c?.sourceRecurringId;
  document.getElementById("scId").value=c?.id||"";
  document.getElementById("scGroup").value=preferred;
  document.getElementById("scPerson").value=c?.person||group?.person||"";
  document.getElementById("scMonth").value=c?.chargeMonth||selectedMonth;
  document.getElementById("scDate").value=c?.date||todayIso();
  document.getElementById("scDueDate").value=c?c.dueDate||"":"";
  document.getElementById("scReminderDays").value=String(c?.remindBeforeDays??0);
  document.getElementById("scKind").value=c?.kind||"Uso / consumo";
  document.getElementById("scDescription").value=c?.description||"";
  document.getElementById("scAmount").value=num(c?.amount);
  document.getElementById("scCurrency").value=normalizeCurrency(c?.currency||displayCurrency());
  document.getElementById("scStatus").value=c?.status||"pending";
  document.getElementById("scRecurring").checked=recurring;
  document.getElementById("scNotes").value=c?.notes||"";
  document.getElementById("scAdvanced").open=!!(c&&(c.groupId||c.sourceRecurringId||c.notes));
  oneSyncCobroReminderField();
  if(!options.inline)document.getElementById("sharedChargeDialog").showModal();
}


/* V10.5 · Los cobros divididos son varios derechos de cobro, no gastos adicionales. */
function oneCreateSplitFare(raw,{sourceId="",fxSnapshot=null}={}){
 const p=globalThis.OneSplitFare.normalize(raw);
 if(!restoreValidDate(p.date))throw Error("Fecha de gasto inválida.");
 if(p.dueDate&&!restoreValidDate(p.dueDate))throw Error("Fecha esperada inválida.");
 if(sourceId&&((data.sharedChargeGroups||[]).some(g=>g.mobilePilotId===sourceId)||
    (data.sharedCharges||[]).some(c=>c.mobilePilotId===sourceId)))
   return {already:true};
 const existing=p.groupId?sharedGroupById(p.groupId):null;
 if(p.groupId&&(!existing||sharedGroupStatus(existing)!=="active"))
   throw Error("El grupo fue archivado o ya no existe. Elegí un grupo activo.");
 const group=existing||{
  id:id(),name:p.groupName,person:"",notes:"",cutDay:0,status:"active",
  closedAt:"",closedReason:"",createdAt:new Date().toISOString(),
  splitFare:{totalAmount:p.amount,currency:p.currency,selfAmount:p.selfAmount,
    totalShares:p.totalShares,mode:p.splitMode,date:p.date},
  ...(sourceId?{mobilePilotId:sourceId}:{})
 };
 const expenseId=id(),snapshot=fxSnapshot||currentFxSnapshot(),createdAt=new Date().toISOString();
 const charges=p.participants.map(row=>({
  id:id(),groupId:group.id,person:row.person,date:p.date,dueDate:p.dueDate,
  remindBeforeDays:p.dueDate?3:0,chargeMonth:monthKey(p.date),
  kind:"Compra compartida",description:p.description||group.name,
  amount:row.amount,currency:p.currency,...snapshot,
  status:"pending",paidAt:"",payments:[],snoozedUntil:"",notes:"",
  sourceRecurringId:"",createdAt,splitFareShares:row.shares,splitFareExpenseId:expenseId,
  ...(sourceId?{mobilePilotId:sourceId}:{})
 }));
 if(!existing)data.sharedChargeGroups.push(group);
 data.sharedCharges.push(...charges);
 return {group,charges,reused:!!existing};
}
function oneSplitFareAddRow(person="",shares=1,amount=""){
 const box=document.getElementById("oneSplitPeople");
 if(box.children.length>=20)return;
 const row=document.createElement("div");row.className="one-split-person";
 row.innerHTML='<label>Persona<input class="one-split-name" placeholder="Nombre" maxlength="120" required></label>'+
  '<label class="one-split-shares-label">Partes<input class="one-split-shares" type="number" min="1" max="20" step="1" required></label>'+
  '<label class="one-split-amount-label" hidden>Monto<input class="one-split-amount" type="number" min="0.01" step="0.01"></label>'+
  '<button type="button" class="one-split-remove" aria-label="Eliminar persona">×</button>';
 row.querySelector(".one-split-name").value=person;
 row.querySelector(".one-split-shares").value=shares;
 if(amount!=="")row.querySelector(".one-split-amount").value=amount;
 row.querySelector("button").addEventListener("click",()=>{row.remove();oneSplitFarePreview();oneSplitFareRefreshMembers()});
 row.addEventListener("input",()=>{oneSplitFarePreview();oneSplitFareRefreshMembers()});
 box.append(row);oneSplitFareMode();oneSplitFareRefreshMembers();
}
function oneSplitFareMode(){
 const custom=document.getElementById("oneSplitMode").value==="amount";
 document.getElementById("oneSplitSelfSharesField").hidden=custom;
 document.getElementById("oneSplitSelfAmountField").hidden=!custom;
 document.querySelectorAll("#oneSplitPeople .one-split-person").forEach(row=>{
  row.querySelector(".one-split-shares-label").hidden=custom;
  row.querySelector(".one-split-amount-label").hidden=!custom;
  row.querySelector(".one-split-shares").disabled=custom;
  row.querySelector(".one-split-amount").disabled=!custom;
  row.querySelector(".one-split-shares").required=!custom;
  row.querySelector(".one-split-amount").required=custom;
 });
 oneSplitFarePreview();
}
function oneSplitFarePayload(){
 return globalThis.OneSplitFare.normalize({
  groupId:document.getElementById("oneSplitGroupChoice").value,
  groupName:document.getElementById("oneSplitGroupName").value,
  description:document.getElementById("oneSplitDescription").value,
  date:document.getElementById("oneSplitDate").value,
  dueDate:document.getElementById("oneSplitDue").value,
  amount:Number(document.getElementById("oneSplitTotal").value),
  currency:document.getElementById("oneSplitCurrency").value,
  splitMode:document.getElementById("oneSplitMode").value,
  selfShares:Number(document.getElementById("oneSplitSelfShares").value),
  selfAmount:Number(document.getElementById("oneSplitSelfAmount").value),
  participants:[...document.querySelectorAll("#oneSplitPeople .one-split-person")].map(row=>({
   person:row.querySelector(".one-split-name").value,
   shares:Number(row.querySelector(".one-split-shares").value),
   amount:Number(row.querySelector(".one-split-amount").value)
  }))
 });
}
function oneSplitFarePreview(){
 const out=document.getElementById("oneSplitPreview");if(!out)return;
 try{
  const p=oneSplitFarePayload(),sym=p.currency==="USD"?"$":"₡",fmt=v=>sym+v.toFixed(2);
  out.textContent="Tu parte: "+fmt(p.selfAmount)+
    " · Total por cobrar: "+fmt(p.participants.reduce((sum,row)=>sum+row.amount,0))+
    " · "+p.participants.map(row=>row.person+": "+fmt(row.amount)+(p.splitMode==="equal"?" ("+row.shares+" partes)":"")).join(" · ");
  out.dataset.valid="true";
 }catch(error){out.textContent=error.message;out.dataset.valid="false";}
}
function oneSplitFareGroupChanged(){
 const select=document.getElementById("oneSplitGroupChoice"),group=sharedGroupById(select.value);
 const existing=!!group&&sharedGroupStatus(group)==="active";
 document.getElementById("oneSplitGroupNameField").hidden=existing;
 document.getElementById("oneSplitGroupName").required=!existing;
 document.getElementById("oneSplitSubmit").textContent=existing?"Agregar gasto al grupo":"Crear grupo y cobros";
 oneSplitFareRefreshMembers();
 oneSplitFarePreview();
}
function oneSplitFareRefreshMembers(){
 const box=document.getElementById("oneSplitMembers");if(!box)return;
 const group=sharedGroupById(document.getElementById("oneSplitGroupChoice").value);
 box.replaceChildren();
 if(!group||sharedGroupStatus(group)!=="active"){box.hidden=true;return}
 const people=new Map();
 for(const charge of data.sharedCharges||[]){
  if(charge.groupId!==group.id)continue;
  const name=String(charge.person||"").trim(),key=name.toLocaleLowerCase("es");
  if(name&&!people.has(key))people.set(key,name);
 }
 box.hidden=!people.size;
 if(!people.size)return;
 const header=document.createElement("small");
 header.textContent="Personas de este grupo · seleccioná solo a quienes participaron";
 box.append(header);
 for(const [key,name] of people){
  const used=[...document.querySelectorAll("#oneSplitPeople .one-split-name")].
   some(el=>el.value.trim().toLocaleLowerCase("es")===key);
  const button=document.createElement("button");button.type="button";button.textContent=name;button.disabled=used;
  button.addEventListener("click",()=>{
   const blank=[...document.querySelectorAll("#oneSplitPeople .one-split-name")].find(el=>!el.value.trim());
   if(blank){blank.value=name;blank.dispatchEvent(new Event("input",{bubbles:true}))}
   else oneSplitFareAddRow(name,1);
   oneSplitFareRefreshMembers();
  });
  box.append(button);
 }
}
function oneOpenSplitFare(groupId=""){
 const form=document.getElementById("oneSplitFareForm");form.reset();
 const groups=activeSharedGroups();
 fillObjectSelect(document.getElementById("oneSplitGroupChoice"),
   [{value:"",label:"Crear grupo nuevo"},...groups.map(g=>({value:g.id,label:g.name}))],groupId);
 document.getElementById("oneSplitGroupChoice").value=groups.some(g=>g.id===groupId)?groupId:"";
 document.getElementById("oneSplitDate").value=todayIso();
 document.getElementById("oneSplitPeople").replaceChildren();
 oneSplitFareAddRow("",1);oneSplitFareMode();
 oneSplitFareGroupChanged();
 document.getElementById("oneSplitFareDialog").showModal();
}
function oneInitSplitFare(){
 const d=document.getElementById("oneSplitFareDialog");
 document.getElementById("oneSplitFareOpen")?.addEventListener("click",()=>oneOpenSplitFare());
 document.addEventListener("click",event=>{
  const button=event.target.closest("[data-split-add-to-group]");
  if(button)oneOpenSplitFare(button.dataset.splitAddToGroup);
 });
 document.getElementById("oneSplitCancel")?.addEventListener("click",()=>d.close());
 document.getElementById("oneSplitAddPerson")?.addEventListener("click",()=>oneSplitFareAddRow());
 document.getElementById("oneSplitMode")?.addEventListener("change",oneSplitFareMode);
 document.getElementById("oneSplitGroupChoice")?.addEventListener("change",oneSplitFareGroupChanged);
 for(const name of ["oneSplitGroupName","oneSplitDescription","oneSplitTotal","oneSplitCurrency",
  "oneSplitDate","oneSplitDue","oneSplitSelfShares","oneSplitSelfAmount"])
   document.getElementById(name)?.addEventListener("input",oneSplitFarePreview);
 document.getElementById("oneSplitFareForm")?.addEventListener("submit",event=>{
  event.preventDefault();
  const snapshot=JSON.stringify(data);
  try{
   const p=oneSplitFarePayload(),created=oneCreateSplitFare(p);
   save();d.close();
   uiState.cobrosDisplayMode="groups";saveUiState();
   document.getElementById("sharedStatementMonth").value=p.date.slice(0,7);
   renderSharedCharges();renderDashboard();
   oneActionSaved(created.reused?"Cobros agregados al grupo":"Grupo y cobros creados",
     created.charges.length+" cobro(s) · "+p.currency+"\nNo se registró un gasto ni ingreso adicional.");
  }catch(error){
   data=JSON.parse(snapshot);
   alert(error.message||"No se pudo registrar el gasto compartido.");
  }
 });
}

/* Ledger de abonos en la moneda original del cobro. Historial previo respetado. */
function cobroPaidOriginal(c){
 const ps=Array.isArray(c.payments)?c.payments:[];
 return ps.length?Math.min(num(c.amount),ps.reduce((sum,p)=>sum+Math.max(0,num(p.amount)),0)):c.status==="paid"?num(c.amount):0;
}
function cobroRemainingOriginal(c){return Math.max(0,num(c.amount)-cobroPaidOriginal(c))}
function cobroRemainingCRC(c){return currentToCRC(cobroRemainingOriginal(c),c.currency||"CRC","receive")}
// Los ingresos ya cobrados mantienen la tasa registrada, a diferencia de un saldo
// pendiente que sí puede visualizarse a la cotización actual.
function cobroPaymentCRC(c,p){
  const linked=oneCobroMovement(c,p);
  if(linked)return movementAmountCRC(linked);
  return recordToCRC({...p,currency:c.currency||"CRC"},"receive");
}
function cobroReceivedCRC(c){
  const payments=Array.isArray(c.payments)?c.payments:[];
  return payments.length
    ?payments.reduce((total,p)=>total+cobroPaymentCRC(c,p),0)
    :c.status==="paid"?currentToCRC(c.amount,c.currency||"CRC","receive"):0;
}
function cobroPaymentState(c){return cobroRemainingOriginal(c)<.005?"Pagado":cobroPaidOriginal(c)>.005?"Parcial":"Pendiente"}
function syncCobroPaymentState(c){
 if((c.payments||[]).length){
  c.status=cobroRemainingOriginal(c)<.005?"paid":"pending";
  c.paidAt=c.status==="paid"?(c.payments.at(-1)?.date||todayIso()):"";
 }
}
function recordCobroPayment(c,amount,date,note=""){
 const value=Math.round(Number(amount)*100)/100;
 if(!c||!Number.isFinite(value)||value<=0||value-cobroRemainingOriginal(c)>.005)return false;
 c.payments=Array.isArray(c.payments)?c.payments:[];
 if(c.status==="paid"&&!c.payments.length)return false;
 c.payments.push({id:id(),date,amount:value,note,...currentFxSnapshot()});
 syncCobroPaymentState(c);c.snoozedUntil="";
 return true;
}
function cobroPerson(c){return String(c.person||sharedGroupById(c.groupId)?.person||"Sin persona").trim()||"Sin persona"}
function cobroReminderStart(c){
 if(!c.dueDate)return "9999-12-31";
  const due=c.dueDate,days=Math.max(0,Math.min(30,num(c.remindBeforeDays??0)));
 const early=addDaysIso(due,-days);
 return c.snoozedUntil&&c.snoozedUntil>early?c.snoozedUntil:early;
}
/* Cobros: libro de abonos vinculado con ingresos / reembolsos del flujo real. */
function oneIsLinkedCobroMovement(m){return !!(m?.receivableChargeId&&m?.receivablePaymentId)}
function oneIsCobroReimbursement(m){return oneIsLinkedCobroMovement(m)&&m.cashFlowKind==="cobro_reembolso"}
function oneCobroMovement(c,p){
  return (data.movements||[]).find(m=>m.receivableChargeId===c.id&&m.receivablePaymentId===p.id)||null;
}
function oneCobroMovementOptions(selected=""){
  const el=document.getElementById("cpMovementIncomeCategory");if(!el)return;
  const active=categoriesOfType("Ingreso"),previous=categoryById(selected);
  const options=previous&&!active.some(c=>c.id===previous.id)?[...active,previous]:active;
  el.innerHTML=options.map(c=>`<option value="${safe(c.id)}">${safe(c.name)}${categoryIsActive(c)?"":" (archivada)"}</option>`).join("");
  const preferred=options.find(c=>c.id===selected)||options.find(c=>/otros ingresos/i.test(c.name))||options[0];
  el.value=preferred?.id||"";
}
function oneRefreshCobroMovementOptions(){
  const checked=!!document.getElementById("cpSyncMovement")?.checked;
  const options=document.getElementById("cpMovementOptions");
  const income=document.getElementById("cpMovementKind")?.value==="income";
  const wrap=document.getElementById("cpMovementIncomeWrap"),category=document.getElementById("cpMovementIncomeCategory");
  if(options)options.hidden=!checked;
  if(wrap)wrap.hidden=!checked||!income;
  if(category)category.required=checked&&income;
  const hint=document.getElementById("cpMovementHint");
  if(hint)hint.textContent=income?"Se contabilizará como ingreso real. Elegí la categoría correspondiente.":"Un reembolso aumenta la liquidez, sin sumarse a los ingresos habituales.";
}
function oneDeleteCobroLinkedMovement(c,p){
  const linked=(data.movements||[]).filter(m=>m.receivableChargeId===c.id&&m.receivablePaymentId===p.id);
  if(!linked.length)return;
  linked.forEach(m=>m2Audit("delete",m,m));
  const ids=new Set(linked.map(m=>m.id));
  data.movements=data.movements.filter(m=>!ids.has(m.id));
}
function oneDeleteCobroLinkedMovements(c){
  for(const m of [...(data.movements||[])].filter(m=>m.receivableChargeId===c.id)){
    m2Audit("delete",m,m);
  }
  data.movements=data.movements.filter(m=>m.receivableChargeId!==c.id);
}
function oneUpsertCobroLinkedMovement(c,p,kind="reimbursement",categoryId=""){
  const old=oneCobroMovement(c,p);
  const period=periodForDate(p.date);
  if(!period||p.date>periodEndDate(period))return false;
  const income=kind==="income",cat=income?categoryById(categoryId):null;
  if(income&&(!cat||cat.type!=="Ingreso"))return false;
  const meta={receivableChargeId:c.id,receivablePaymentId:p.id,
    cashFlowKind:income?"cobro_ingreso":"cobro_reembolso"};
  const obj={...old,id:old?.id||id(),seq:old?.seq||data.movementSeq+1,
    createdAt:old?.createdAt||new Date().toISOString(),
    ...meta,date:p.date,type:income?"Ingreso":"Movimiento patrimonial",
    categoryId:income?cat.id:"",category:income?cat.name:"Reembolso / devolución",
    splits:[],debtId:"",debt:"",account:old?.account||"",paymentMethod:old?.paymentMethod||"",
    description:`Cobro · ${cobroPerson(c)} · ${c.description||c.kind||"Abono"}`,
    amount:p.amount,currency:normalizeCurrency(c.currency),
    ...((old&&normalizeCurrency(old.currency)===normalizeCurrency(c.currency))?
      {fxBuy:old.fxBuy,fxSell:old.fxSell,fxRef:old.fxRef,fxDate:old.fxDate}:
      (num(p.fxBuy)>0&&num(p.fxSell)>0
        ?{fxBuy:p.fxBuy,fxSell:p.fxSell,fxRef:p.fxRef,fxDate:p.fxDate}
        :currentFxSnapshot())),
    period:periodKey(period),quarter:budgetQuarter(period)};
  if(old){
    m2Audit("edit",obj,old);
    const i=data.movements.findIndex(m=>m.id===old.id);data.movements[i]=obj;
  }else{
    data.movementSeq++;obj.seq=data.movementSeq;
    data.movements.push(obj);m2Audit("create",obj);
  }
  return true;
}
function oneCommitCobroPayment(c,{paymentId="",amount,date,note="",linked=false,kind="reimbursement",categoryId=""}={}){
  if(!c)return {ok:false,error:"No se encontró el cobro."};
  const old=(c.payments||[]).find(p=>p.id===paymentId)||null;
  if(paymentId&&!old)return {ok:false,error:"Este abono ya no existe."};
  const value=Math.round(Number(amount)*100)/100;
  if(!restoreValidDate(date)||!Number.isFinite(value)||value<=0)
    return {ok:false,error:"Ingresá una fecha y un importe mayor que cero."};
  const other=(c.payments||[]).filter(p=>p.id!==paymentId).reduce((sum,p)=>sum+num(p.amount),0);
  if(value+other-num(c.amount)>.005)return {ok:false,error:"El abono supera el saldo pendiente del cobro."};
  if(!old&&c.status==="paid"&&!(c.payments||[]).length)
    return {ok:false,error:"El cobro figura como pagado sin historial de abonos. Reabrilo para registrar nuevos pagos."};
  if(linked){
    const period=periodForDate(date);
    if(!period||date>periodEndDate(period))
      return {ok:false,error:"Para reflejar el dinero en Movimientos, la fecha debe pertenecer a un período configurado en Presupuesto."};
    if(kind==="income"){
      const cat=categoryById(categoryId),oldMove=old?oneCobroMovement(c,old):null;
      if(!cat||cat.type!=="Ingreso"||(!categoryIsActive(cat)&&cat.id!==oldMove?.categoryId))
        return {ok:false,error:"Seleccioná una categoría de ingreso activa."};
    }
  }
  let payment=old;
  if(old){payment={...old,date,amount:value,note};c.payments=c.payments.map(p=>p.id===old.id?payment:p)}
  else{
    if(!recordCobroPayment(c,value,date,note))
      return {ok:false,error:"No se pudo registrar el abono."};
    payment=c.payments.at(-1);
  }
  syncCobroPaymentState(c);c.snoozedUntil="";
  if(linked)oneUpsertCobroLinkedMovement(c,payment,kind,categoryId);
  else oneDeleteCobroLinkedMovement(c,payment);
  return {ok:true,payment};
}
function oneRevertCobroPayment(c,p){
  if(!c||!p||!(c.payments||[]).some(x=>x.id===p.id))return false;
  oneDeleteCobroLinkedMovement(c,p);
  c.payments=c.payments.filter(x=>x.id!==p.id);
  c.status="pending";c.paidAt="";syncCobroPaymentState(c);
  return true;
}
function oneRefreshCobroViews(){
  save();refreshV7MovementCategoryFilter();renderSharedCharges();
  renderDashboard();renderMovements();renderPlan();renderCapital();
}

function openCobroPayment(c,payment=null){
  if(!c||(!payment&&cobroRemainingOriginal(c)<.005))return;
  const linked=payment?oneCobroMovement(c,payment):null;
  document.getElementById("cpChargeId").value=c.id;
  document.getElementById("cpPaymentId").value=payment?.id||"";
  document.getElementById("cpDate").value=payment?.date||todayIso();
  document.getElementById("cpAmount").value=(payment?.amount??cobroRemainingOriginal(c)).toFixed(2);
  document.getElementById("cpAmount").max=(cobroRemainingOriginal(c)+num(payment?.amount)).toFixed(2);
  document.getElementById("cpCurrency").value=normalizeCurrency(c.currency);
  document.getElementById("cpNote").value=payment?.note||"";
  document.getElementById("cpSyncMovement").checked=!!linked;
  document.getElementById("cpMovementKind").value=linked?.cashFlowKind==="cobro_ingreso"?"income":"reimbursement";
  oneCobroMovementOptions(linked?.cashFlowKind==="cobro_ingreso"?linked.categoryId:"");
  oneRefreshCobroMovementOptions();
  document.getElementById("cpSubmitBtn").textContent=payment?"Guardar cambios":"Guardar abono";
  document.getElementById("cpContext").textContent=cobroPerson(c)+" · "+c.description+" · pendiente "+originalMoney(cobroRemainingOriginal(c),c.currency);
  document.getElementById("cobroPaymentDialog").showModal();
}
function openCobroPaymentHistory(c){
  if(!c)return;
  document.getElementById("cpHistoryContext").textContent=cobroPerson(c)+" · "+c.description;
  const payments=c.payments||[];
  document.getElementById("cpHistoryList").innerHTML=payments.length?payments.map(p=>{
    const linked=oneCobroMovement(c,p),status=linked?
      `<small class="one-cobro-linked-tag">En Movimientos · ${linked.cashFlowKind==="cobro_ingreso"?"Ingreso":"Reembolso"}</small>`:"";
    return `<div class="one-payment-line"><span><strong>${originalMoney(p.amount,c.currency)}</strong><small>${dateLabel(p.date)}${p.note?" · "+safe(p.note):""}</small>${status}</span><div class="one-cobro-payment-actions"><button class="btn secondary small" type="button" data-edit-cobro-payment="${safe(c.id)}|${safe(p.id)}">Editar</button><button class="btn danger small" type="button" data-revert-cobro-payment="${safe(c.id)}|${safe(p.id)}">Revertir</button></div></div>`;
  }).join(""):`<div class="empty">${c.status==="paid"?"Pago histórico sin detalle de abonos.":"No se han registrado abonos."}</div>`;
  const dialog=document.getElementById("cobroHistoryDialog");if(!dialog.open)dialog.showModal();
}
function cobroPeopleCards(rows,month){
 const people=new Map();
 rows.forEach(c=>{const name=cobroPerson(c),key=name.toLocaleLowerCase("es");if(!people.has(key))people.set(key,{name,charges:[]});people.get(key).charges.push(c)});
 return [...people.values()].sort((a,b)=>a.name.localeCompare(b.name,"es")).map(person=>{
  const pending=person.charges.reduce((s,c)=>s+cobroRemainingCRC(c),0),received=person.charges.reduce((s,c)=>s+cobroReceivedCRC(c),0);
  const next=person.charges.filter(c=>cobroRemainingOriginal(c)>.005).map(c=>c.dueDate).filter(Boolean).sort()[0];
  const groups=new Map();
  person.charges.forEach(c=>{const key=c.groupId||"",name=sharedGroupById(key)?.name||"Sin grupo";if(!groups.has(key))groups.set(key,{name,rows:[]});groups.get(key).rows.push(c)});
  return `<article class="one-person-card"><div class="one-person-head"><div><strong>${safe(person.name)}</strong><small>${person.charges.length} cobros${next?" · Próximo "+dateLabel(next):""}</small></div><div class="one-person-totals"><span>Recibido <b>${money(received)}</b></span><span>Pendiente <b>${money(pending)}</b></span></div></div>${[...groups.values()].map(g=>`<details class="one-person-group" open><summary>${safe(g.name)} <small>${money(g.rows.reduce((s,c)=>s+cobroRemainingCRC(c),0))} pendiente</small></summary>${receivableRowsTable(g.rows,"people",month)}</details>`).join("")}</article>`;
 }).join("")||`<div class="empty">No hay cobros en este período. Registrá el primero para comenzar.</div>`;
}

function groupReceivableRows(groupId,month){
  return (data.sharedCharges||[]).filter(c=>(c.groupId||"")===groupId&&(c.chargeMonth||monthKey(c.date))===month).sort((a,b)=>a.date.localeCompare(b.date)||String(a.description).localeCompare(String(b.description)));
}
function receivableDisplayRows(groupId,month){
  return (data.sharedCharges||[]).filter(c=>{
    if((c.groupId||"")!==groupId)return false;
    const origin=c.chargeMonth||monthKey(c.date);
    return origin===month||(origin<month&&cobroRemainingOriginal(c)>.005);
  }).sort((a,b)=>{
    const ao=a.chargeMonth||monthKey(a.date),bo=b.chargeMonth||monthKey(b.date);
    if(ao!==bo)return ao.localeCompare(bo);
    return a.date.localeCompare(b.date)||String(a.description).localeCompare(String(b.description));
  });
}
function allReceivableDisplayRows(month){
  return (data.sharedCharges||[]).filter(c=>{
    const origin=c.chargeMonth||monthKey(c.date);
    return origin===month||(origin<month&&cobroRemainingOriginal(c)>.005);
  });
}
function isReceivableCarryover(c,month){return (c.chargeMonth||monthKey(c.date))<month&&cobroRemainingOriginal(c)>.005}
function receivableAmountCRC(c){return currentToCRC(c.amount,c.currency||"CRC","receive")}
function groupRecurringCount(groupId,month){const g=sharedGroupById(groupId);if(g&&sharedGroupStatus(g)==="archived")return 0;return (data.receivableRecurring||[]).filter(t=>(t.groupId||"")===groupId&&recurringApplies(t,month)).length}
function receivableRowsTable(rows,sectionKey="",month=selectedReceivableMonth()){
 const head=rows.length&&sectionKey!=="people"?`<input class="charge-check" type="checkbox" data-select-shared-section="${safe(sectionKey)}" aria-label="Seleccionar todos">`:"";
 return `<div class="table-wrap"><table><thead><tr><th>${head}</th><th>Fecha</th><th>Persona</th><th>Concepto</th><th>Total</th><th>Abonado</th><th>Restante</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows.length?rows.map(c=>{
  const carry=isReceivableCarryover(c,month),origin=c.chargeMonth||monthKey(c.date),left=cobroRemainingOriginal(c);
  return `<tr><td><input class="charge-check" type="checkbox" data-select-shared="${safe(c.id)}" ${sharedSelectedChargeIds.has(c.id)?"checked":""} aria-label="Seleccionar cobro"></td>
  <td>${dateLabel(c.date)}<br><small class="muted">${c.dueDate?"Pago esperado: "+dateLabel(c.dueDate):"Sin fecha de pago prevista"}</small>${carry?`<br><span class="overdue-badge">Arrastre ${monthLabel(origin)}</span>`:""}</td>
  <td>${safe(cobroPerson(c))}</td>
  <td><strong>${safe(c.description||c.kind)}</strong>${c.sourceRecurringId?`<span class="recurring-badge">Mensual</span>`:""}${c.notes?`<br><small class="muted">${safe(c.notes)}</small>`:""}</td>
  <td class="num">${money(receivableAmountCRC(c))}${originalHint(c.amount,c.currency)}</td>
  <td class="num">${money(cobroReceivedCRC(c))}</td><td class="num">${money(cobroRemainingCRC(c))}</td>
  <td><span class="pill">${cobroPaymentState(c)}</span></td>
  <td><div class="actions">${!c.groupId?`<button class="btn secondary small" data-group-one-shared="${safe(c.id)}">Agrupar</button>`:""}
  ${left>.005?`<button class="btn small" data-cobro-pay="${safe(c.id)}">Abonar</button>`:""}
  <button class="btn secondary small" data-cobro-history="${safe(c.id)}">Historial</button>
  <button class="btn secondary small" data-edit-shared-charge="${safe(c.id)}">Editar</button>
  ${c.status==="paid"&&!(c.payments||[]).length?`<button class="btn secondary small" data-reopen-shared-charge="${safe(c.id)}">Reabrir</button>`:""}
  <button class="btn danger small" data-delete-shared-charge="${safe(c.id)}">${c.sourceRecurringId?"Cancelar recurrencia":"Eliminar"}</button>
  </div></td></tr>`;
 }).join(""):`<tr><td colspan="9" class="empty">Sin cobros en ${monthLabel(month)}.</td></tr>`}</tbody></table></div>`;
}

function oneGroupPersonLedger(groupId){
 const people=new Map();
 for(const c of data.sharedCharges||[]){
  if(c.groupId!==groupId)continue;
  const name=String(c.person||"Sin nombre").trim()||"Sin nombre";
  const key=name.toLocaleLowerCase("es");
  if(!people.has(key))people.set(key,{name,charges:[],currencies:{}});
  const row=people.get(key),currency=normalizeCurrency(c.currency||"CRC");
  const totals=row.currencies[currency]||(row.currencies[currency]={charged:0,paid:0,pending:0});
  const charged=Math.round(num(c.amount)*100);
  const paid=Math.round(cobroPaidOriginal(c)*100);
  totals.charged+=charged;totals.paid+=paid;totals.pending+=Math.max(0,charged-paid);
  row.charges.push(c);
 }
 return [...people.values()].sort((a,b)=>a.name.localeCompare(b.name,"es"));
}
function oneGroupPersonBreakdown(groupId,month){
 const people=oneGroupPersonLedger(groupId);
 if(!people.length)return '<p class="empty">Este grupo todavía no tiene cobros.</p>';
 return '<section class="one-group-person-summary">'+
   '<div class="one-group-person-caption">Acumulado por persona · incluye los gastos de todos los meses. Los dólares y colones se muestran separados.</div>'+
   people.map(p=>{
    const amounts=Object.entries(p.currencies).map(([currency,t])=>
      '<span>Total <b>'+originalMoney(t.charged/100,currency)+'</b> · Pendiente <b>'+
      originalMoney(t.pending/100,currency)+'</b> · Abonado <b>'+originalMoney(t.paid/100,currency)+'</b></span>').join("");
    const items=p.charges.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).
      map(c=>'<li><span><strong>'+safe(c.description||c.kind||"Cobro")+'</strong>'+
        '<small>'+dateLabel(c.date)+'</small></span><span>'+originalMoney(c.amount,c.currency)+
        ' · Pendiente '+originalMoney(cobroRemainingOriginal(c),c.currency)+'</span></li>').join("");
    return '<details class="one-group-person-card" open><summary><span>'+
      safe(p.name)+'</span><span class="one-group-person-values">'+amounts+
      '</span></summary><ul class="one-group-person-items">'+items+'</ul>'+
      receivableRowsTable(p.charges,"people",month)+'</details>';
   }).join("")+'</section>';
}

function renderSharedCharges(){
  const monthEl=document.getElementById("sharedStatementMonth");
  if(monthEl&&!monthEl.value)monthEl.value=currentFinancialContext().financialMonth||todayIso().slice(0,7);
  const month=selectedReceivableMonth();
  const monthLabelEl=document.getElementById("sharedMonthLabel");if(monthLabelEl)monthLabelEl.textContent=monthLabel(month);
  ensureRecurringChargesForMonth(month);refreshSharedGroupSelects();
  const allGroups=data.sharedChargeGroups||[], view=sharedGroupView(), displayRows=allReceivableDisplayRows(month), currentRows=(data.sharedCharges||[]).filter(c=>(c.chargeMonth||monthKey(c.date))===month);
  const archivedCount=archivedSharedGroups().length,toggle=document.getElementById("toggleArchivedSharedGroups");
  if(toggle){toggle.textContent=view==="archived"?"Ver activos":`Ver archivados${archivedCount?` (${archivedCount})`:""}`;toggle.disabled=!archivedCount&&view!=="archived"}
  // Limpiar selecciones que ya no pertenecen a la vista visible.
  const visibleIds=new Set(displayRows.map(c=>c.id));[...sharedSelectedChargeIds].forEach(cid=>{if(!visibleIds.has(cid))sharedSelectedChargeIds.delete(cid)});
  const currentTotal=currentRows.reduce((s,c)=>s+receivableAmountCRC(c),0),currentPaid=currentRows.reduce((s,c)=>s+cobroReceivedCRC(c),0);
  const carryRows=displayRows.filter(c=>isReceivableCarryover(c,month)),carryPending=carryRows.reduce((s,c)=>s+cobroRemainingCRC(c),0),pending=displayRows.reduce((s,c)=>s+cobroRemainingCRC(c),0);
  const today=todayIso(),overdue=displayRows.filter(c=>c.dueDate&&c.dueDate<today).reduce((s,c)=>s+cobroRemainingCRC(c),0);
  const recoveredMonth=(data.sharedCharges||[]).reduce((sum,c)=>{
    const abonos=(c.payments||[]).filter(p=>p.date?.startsWith(month))
      .reduce((total,p)=>total+cobroPaymentCRC(c,p),0);
    const legacy=!(c.payments||[]).length&&c.status==="paid"&&c.paidAt?.startsWith(month)
      ?currentToCRC(c.amount,c.currency||"CRC","receive"):0;
    return sum+abonos+legacy;
  },0);
  const ungrouped=receivableDisplayRows("",month),ungroupedPending=ungrouped.reduce((s,c)=>s+cobroRemainingCRC(c),0),ungroupedCarry=ungrouped.filter(c=>isReceivableCarryover(c,month)).reduce((s,c)=>s+receivableAmountCRC(c),0);
  document.getElementById("sharedKpis").innerHTML=[["Por recuperar",pending],["Vencido",overdue],["Recuperado en el mes",recoveredMonth],["Cargos del mes",currentTotal]].map(([name,value])=>`<div><small>${name}</small><strong>${money(value)}</strong></div>`).join("");
  const byGroups=uiState.cobrosDisplayMode==="groups";
  document.getElementById("sharedPeopleContainer").hidden=byGroups;
  document.getElementById("sharedGroupsContainer").hidden=!byGroups;
  document.getElementById("cobrosPeopleTab").classList.toggle("active",!byGroups);
  document.getElementById("cobrosGroupsTab").classList.toggle("active",byGroups);
  document.getElementById("cobrosPeopleTab").setAttribute("aria-pressed",String(!byGroups));
  document.getElementById("cobrosGroupsTab").setAttribute("aria-pressed",String(byGroups));
  if(!byGroups)document.getElementById("sharedPeopleContainer").innerHTML=cobroPeopleCards(displayRows,month);
  const container=document.getElementById("sharedGroupsContainer");
  const archivedWithPending=new Set(allGroups.filter(g=>sharedGroupStatus(g)==="archived"&&receivableDisplayRows(g.id,month).some(c=>cobroRemainingOriginal(c)>.005)).map(g=>g.id));
  const groups=view==="archived"?allGroups.filter(g=>sharedGroupStatus(g)==="archived"):allGroups.filter(g=>sharedGroupStatus(g)==="active"||archivedWithPending.has(g.id));
  const ungroupedCard=ungrouped.length?`<div class="card receivable-group ungrouped-card"><div class="receivable-group-head"><div><div class="receivable-group-title">Sin agrupar</div><div class="receivable-group-meta">Cobros rápidos todavía sin grupo. Los pendientes anteriores también aparecen aquí hasta pagarse.</div></div><div class="actions"><button class="btn small" data-select-all-ungrouped>Agrupar varios</button><button class="btn secondary small" data-add-shared-to-group="">Agregar cobro</button></div></div><div class="receivable-group-stats"><span>Pendiente: <strong>${money(ungroupedPending)}</strong></span>${ungroupedCarry?`<span>Arrastre: <strong>${money(ungroupedCarry)}</strong></span>`:""}<span>Cargos visibles: <strong>${ungrouped.length}</strong></span></div>${receivableRowsTable(ungrouped,"__ungrouped__",month)}</div>`:"";
  const groupCards=groups.map(g=>{
    const rows=receivableDisplayRows(g.id,month),current=groupReceivableRows(g.id,month),gCurrent=current.reduce((s,c)=>s+receivableAmountCRC(c),0),gPending=rows.reduce((s,c)=>s+cobroRemainingCRC(c),0),gCarry=rows.filter(c=>isReceivableCarryover(c,month)).reduce((s,c)=>s+receivableAmountCRC(c),0),gPaid=current.reduce((s,c)=>s+cobroReceivedCRC(c),0),recCount=groupRecurringCount(g.id,month),status=sharedGroupStatus(g);
    const lifecycle=status==="active"?`<button class="btn secondary small" data-archive-shared-group="${safe(g.id)}">Archivar</button>`:`<button class="btn secondary small" data-reactivate-shared-group="${safe(g.id)}">Reactivar</button>`;
    const add=status==="active"?`<button class="btn small" data-split-add-to-group="${safe(g.id)}">+ Dividir gasto</button><button class="btn secondary small" data-add-shared-to-group="${safe(g.id)}">Cobro individual</button>`:"";
    const archivedMeta=status==="archived"?`<span class="status-badge archived">Archivado</span>${g.closedReason?` · ${safe(g.closedReason)}`:""}${g.closedAt?` · ${dateLabel(g.closedAt)}`:""}`:"";
    return `<div class="card receivable-group"><div class="receivable-group-head"><div><div class="receivable-group-title">${safe(g.name)}</div><div class="receivable-group-meta">${g.person?`Persona principal: ${safe(g.person)}`:"Sin persona principal"}${g.notes?` · ${safe(g.notes)}`:""}${archivedMeta?`<br>${archivedMeta}`:""}</div></div><div class="actions">${add}<button class="btn secondary small" data-print-shared-group="${safe(g.id)}">PDF</button><button class="btn secondary small" data-edit-shared-group="${safe(g.id)}">Editar</button>${lifecycle}<button class="btn danger small" data-delete-shared-group="${safe(g.id)}">Eliminar</button></div></div><div class="receivable-group-stats">${g.splitFare?`<span>Reparto inicial: <strong>${originalMoney(g.splitFare.totalAmount,g.splitFare.currency)}</strong> · Tu parte: ${originalMoney(g.splitFare.selfAmount,g.splitFare.currency)}</span>`:""}<span>Pendiente total: <strong>${money(gPending)}</strong></span>${gCarry?`<span>Arrastre anterior: <strong>${money(gCarry)}</strong></span>`:""}<span>Cargos del mes: <strong>${money(gCurrent)}</strong></span><span>Pagado del mes: <strong>${money(gPaid)}</strong></span>${recCount?`<span>Recurrentes activos: <strong>${recCount}</strong></span>`:""}</div>${oneGroupPersonBreakdown(g.id,month)}</div>`;
  }).join("");
  if(!ungroupedCard&&!groupCards){
    const msg=view==="archived"?"No tienes grupos archivados.":"Todavía no tienes cobros ni grupos. Puedes registrar un cobro suelto o crear un grupo primero.";
    container.innerHTML=`<div class="card empty" style="padding:42px 20px">${msg}</div>`;
  }else container.innerHTML=ungroupedCard+groupCards;
  syncSharedBulkBar();
}
function printSharedStatement(groupId){
  const group=sharedGroupById(groupId),month=selectedReceivableMonth();if(!group)return;
  ensureRecurringChargesForMonth(month);
  const rows=receivableDisplayRows(group.id,month),current=groupReceivableRows(group.id,month),currentTotal=current.reduce((s,c)=>s+receivableAmountCRC(c),0),carry=rows.filter(c=>isReceivableCarryover(c,month)).reduce((s,c)=>s+receivableAmountCRC(c),0),pending=rows.reduce((s,c)=>s+cobroRemainingCRC(c),0);
  const win=window.open("","_blank","width=900,height=700");if(!win)return alert("El navegador bloqueó la ventana de impresión.");
  const safe=s=>String(s??"").replace(/[&<>\"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(group.name)} · ${safe(month)}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111;margin:36px}h1{margin:0;font-size:24px}.muted{color:#666;margin:6px 0 24px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border-bottom:1px solid #ddd;padding:9px;text-align:left;font-size:13px}th{background:#f3f4f6}.num{text-align:right}.total{margin-top:20px;display:flex;justify-content:flex-end;gap:28px;flex-wrap:wrap;font-size:15px}.brand{font-weight:800;letter-spacing:.03em;margin-bottom:24px}.carry{font-size:11px;color:#7a5b00;font-weight:700}@media print{body{margin:18mm}}
</style></head><body><div class="brand">RASTRO</div><h1>${safe(group.name)}</h1><div class="muted">${group.person?`Desglose para ${safe(group.person)} · `:""}${safe(monthLabel(month))}</div><table><thead><tr><th>Fecha</th><th>Mes origen</th><th>Persona</th><th>Tipo</th><th>Concepto</th><th>Estado</th><th class="num">Monto</th></tr></thead><tbody>${rows.map(c=>{const origin=c.chargeMonth||monthKey(c.date),isCarry=isReceivableCarryover(c,month);return `<tr><td>${safe(dateLabel(c.date))}</td><td>${safe(monthLabel(origin))}${isCarry?`<br><span class="carry">Arrastre pendiente</span>`:""}</td><td>${safe(c.person)}</td><td>${safe(c.kind)}${c.sourceRecurringId?" · Mensual":""}</td><td>${safe(c.description)}</td><td>${cobroPaymentState(c)}</td><td class="num">${safe(money(receivableAmountCRC(c)))}${safe(c.currency&&normalizeCurrency(c.currency)!==displayCurrency()?` (original ${originalMoney(c.amount,c.currency)})`:``)}</td></tr>`}).join("")||`<tr><td colspan="7">Sin cobros</td></tr>`}</tbody></table><div class="total"><div><strong>Cargos del mes:</strong> ${safe(money(currentTotal))}</div><div><strong>Arrastre anterior:</strong> ${safe(money(carry))}</div><div><strong>Pendiente total:</strong> ${safe(money(pending))}</div></div><script>window.onload=()=>setTimeout(()=>window.print(),150)<\/script></body></html>`);win.document.close();
}
function cancelRecurringFromMonth(charge){
  const month=charge.chargeMonth||monthKey(charge.date),template=(data.receivableRecurring||[]).find(t=>t.id===charge.sourceRecurringId);if(!template)return;
  if(!confirm(`¿Cancelar “${charge.description}” desde ${monthLabel(month)}?\n\nSe eliminará este cobro y cualquier copia automática de meses posteriores. Los meses anteriores se conservan.`))return;
  template.endMonth=shiftMonthKey(month,-1);
  data.sharedCharges=data.sharedCharges.filter(c=>!(c.sourceRecurringId===template.id&&(c.chargeMonth||monthKey(c.date))>=month&&!(c.payments||[]).length&&c.status!=="paid"));
  save();renderSharedCharges();
}


/* Metas Beta 1.0: vistas derivadas de reserves / reserveMovements, sin otro libro contable. */
/* Enlaces contables: las metas son transferencias; el presupuesto muestra la ejecución sin un gasto duplicado. */
function oneSavingsCategories(){return budgetCategories("Gasto").filter(c=>categoryIsActive(c))}
function oneSuggestedSavingsCategoryId(){
  return oneSavingsCategories().find(c=>/(ahorro|inversi[oó]n|meta)/i.test(c.name||""))?.id||"";
}
