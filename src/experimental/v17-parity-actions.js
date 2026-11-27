// V17 parity: contextual actions, no second navigation or independent financial engine.
function parityDispatch(name,id){
 const b=document.createElement("button");b.dataset[name]=id;document.body.appendChild(b);try{b.click()}finally{b.remove()}
}
function openNative(action,id){
 if(nativeBlocked)return;
 if(action==="export-budget"||action==="export-movements"){
  oneStorageAssertCurrent();
  const range=agg(T.select(state)),fresh=getModel(),report=action==="export-budget"?oneV17Csv.budget(F.project(fresh,{basis:"calendar",...range}),range):oneV17Csv.movements(O.movements(rawNow(),range),range);
  download("OLO-V17-"+(action==="export-budget"?"presupuesto":"movimientos")+"-"+range.start+"-"+range.end+".csv",report,"text/csv;charset=utf-8");return;
 }
 const d=(data.debts||[]).find(x=>x.id===id),g=(data.reserves||[]).find(x=>x.id===id),p=(data.projects||[]).find(x=>x.id===id),group=sharedGroupById(id),charge=(data.sharedCharges||[]).find(x=>x.id===id);
 if(action==="debt-reactivate"){if(d&&debtStatus(d)==="archived")parityDispatch("reactivateDebt",id);return}
 if(action==="goal-reactivate"){if(g&&reserveStatus(g)==="archived")parityDispatch("reactivateReserve",id);return}
 if(action==="group-edit"){if(group)openSharedGroup(group);return}
 if(action==="group-archive"){if(group)archiveSharedGroup(group);return}
 if(action==="group-reactivate"){if(group)reactivateSharedGroup(group);return}
 if(action==="group-add"){if(group&&sharedGroupStatus(group)==="active"){openSharedCharge(null,id);document.getElementById("scDate").value=selectedDate()}return}
 if(action==="group-split"){if(!id||group&&sharedGroupStatus(group)==="active"){oneOpenSplitFare(id);document.getElementById("oneSplitDate").value=selectedDate();oneSplitFarePreview()}return}
 if(action==="collection-reopen"){if(charge&&charge.status==="paid"&&!(charge.payments||[]).length)parityDispatch("reopenSharedCharge",id);return}
 if(action==="project-toggle"){
  if(!p)return;
  if(!confirm(oneProjectEnabled(p)?"¿Archivar este proyecto? Se conservarán sus presupuestos, previsiones y vínculos históricos.":"¿Reactivar este proyecto?"))return;
  if(oneProjectStore(()=>{p.status=oneProjectEnabled(p)?"archived":"active";p.closedAt=p.status==="archived"?todayIso():""}))refreshNative();
  return;
 }
 return baseOpenNative(action,id);
}
function paritySection(title,rows){
 if(!rows.length)return "";
 return '<details class="demo-alloc-list"><summary>'+esc(title)+' · '+rows.length+'</summary>'+rows.join("")+'</details>';
}
function parityRow(name,actions,detail=""){
 return '<div class="demo-alloc"><div><strong>'+esc(name)+'</strong>'+(detail?'<small class="muted"> · '+esc(detail)+'</small>':"")+'</div><details class="demo-alloc-list"><summary>Acciones</summary>'+actions+'</details></div>';
}
function moduleActions(v){
 let html=baseModuleActions(v);
 if(moduleName==="budget"||moduleName==="moves")html+='<div class="demo-native-actions">'+actionButton(moduleName==="budget"?"export-budget":"export-movements","Exportar CSV")+'</div>';
 if(moduleName==="debts")html+=paritySection("Archivadas",(data.debts||[]).filter(d=>debtStatus(d)==="archived").map(d=>parityRow(d.name,actionButton("debt-reactivate","Reactivar",d.id))));
 if(moduleName==="goals")html+=paritySection("Archivadas",(data.reserves||[]).filter(g=>g.type==="goal"&&reserveStatus(g)==="archived").map(g=>parityRow(g.name,actionButton("goal-reactivate","Reactivar",g.id))));
 if(moduleName==="projects"){
  // Show administration even for projects outside the selected date interval.
  const visible=new Set(v.projects.map(p=>p.id));
  html+=paritySection("Administrar proyectos",(data.projects||[]).filter(p=>oneProjectEnabled(p)).map(p=>parityRow(p.name,(visible.has(p.id)?"":actionButton("project","Editar",p.id))+actionButton("project-toggle","Archivar",p.id))));
  html+=paritySection("Archivados",(data.projects||[]).filter(p=>!oneProjectEnabled(p)).map(p=>parityRow(p.name,actionButton("project-toggle","Reactivar",p.id))));
 }
 if(moduleName==="collections"){
  const visible=new Set(v.collections.due.map(c=>c.id));
  html+= '<div class="demo-native-actions">'+actionButton("group-split","Dividir cobro")+'</div>';
  html+=paritySection("Grupos",activeSharedGroups().map(g=>parityRow(g.name,actionButton("group-add","Agregar cobro",g.id)+actionButton("group-split","Dividir",g.id)+actionButton("group-edit","Editar",g.id)+actionButton("group-archive","Archivar",g.id))));
  html+=paritySection("Grupos archivados",archivedSharedGroups().map(g=>parityRow(g.name,actionButton("group-reactivate","Reactivar",g.id))));
  const other=(data.sharedCharges||[]).filter(c=>!visible.has(c.id)&&((c.date>=v.range.start&&c.date<=v.range.end)||cobroRemainingOriginal(c)>0&&(!c.dueDate||c.dueDate<v.range.start)));
  html+=paritySection("Otros cobros del período y pendientes",other.map(c=>parityRow(cobroPerson(c),actionButton("collection","Editar",c.id)+(cobroRemainingOriginal(c)>0?actionButton("payment","Abonar",c.id):"")+actionButton("collection-history","Historial",c.id)+(c.status==="paid"&&!(c.payments||[]).length?actionButton("collection-reopen","Reabrir",c.id):""),f(Math.round(cobroRemainingOriginal(c)*100),c.currency||"CRC"))));
 }
 return html;
}
