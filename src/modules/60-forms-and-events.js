// Run the real migration and restore path against an in-memory copy only.
function oneV15ValidateTransitionShadow(raw,record,asOf){
 const endFor=p=>periodEndDate(p,raw.periods,raw.settings);
 const materialized=oneV15QueryCore.materializeTransition(raw,record,asOf,endFor);
 const baseline=restorePrepare(clone(raw)),candidate=restorePrepare(materialized.ledger);
 const legacyKeys=new Set(baseline.periods.map(periodKey));
 const existing=candidate.periods.filter(p=>legacyKeys.has(periodKey(p)));
 const comparable=p=>({key:periodKey(p),date:p.date,end:periodEndDate(p,baseline.periods,baseline.settings),categoryBudgets:p.categoryBudgets,categoryBudgetCurrencies:p.categoryBudgetCurrencies,categoryBudgetSources:p.categoryBudgetSources,categoryBudgetScheduledDates:p.categoryBudgetScheduledDates,opening:p.opening});
 if(JSON.stringify(existing.map(comparable))!==JSON.stringify(baseline.periods.map(comparable)))throw Error("La simulación cambió un presupuesto original.");
 if(JSON.stringify(candidate.movements)!==JSON.stringify(baseline.movements))throw Error("La simulación cambió movimientos.");
 const newRows=candidate.periods.filter(p=>!legacyKeys.has(periodKey(p)));
 if(newRows.length!==materialized.createdKeys.length||newRows.some(p=>!oneV15IsFlexiblePeriod(p)||!materialized.createdKeys.includes(periodKey(p))))throw Error("La simulación no conservó todos los períodos.");
 for(const p of newRows)oneV15ValidateFlexiblePeriod(p);
 return {count:newRows.length,first:newRows[0].date,last:newRows.at(-1).endDate};
}

// Only the isolated Lab candidate may explicitly commit a flexible calendar.
function oneV15StageCalendarChange(raw,record,asOf,extend=false){
 const endFor=p=>periodEndDate(p,raw.periods,raw.settings);
 const materialized=extend?oneV15QueryCore.extendFlexibleCalendar(raw,record,asOf):oneV15QueryCore.materializeTransition(raw,record,asOf,endFor);
 const baseline=restorePrepare(clone(raw)),candidate=restorePrepare(materialized.ledger);
 const originalKeys=new Set(baseline.periods.map(periodKey)),existing=candidate.periods.filter(p=>originalKeys.has(periodKey(p)));
 if(JSON.stringify(existing)!==JSON.stringify(baseline.periods)||JSON.stringify(candidate.movements)!==JSON.stringify(baseline.movements))throw Error("La transición modificaría registros existentes.");
 for(const p of baseline.periods){
  const next=existing.find(x=>periodKey(x)===periodKey(p));
  if(!next||periodEndDate(p,baseline.periods,baseline.settings)!==periodEndDate(next,candidate.periods,candidate.settings))throw Error("La transición modificaría fechas existentes.");
 }
 const created=candidate.periods.filter(p=>!originalKeys.has(periodKey(p)));
 if(created.length!==materialized.createdKeys.length||created.some(p=>!materialized.createdKeys.includes(periodKey(p))))throw Error("No se conservaron los nuevos períodos.");
 for(const p of created)oneV15ValidateFlexiblePeriod(p);
 const staged=clone(raw);staged.periods.push(...created);
 staged.v15CalendarTransition={...record,status:"active",through:created.at(-1).endDate};
 oneV15ValidatePeriodIdentities(staged.periods,staged.settings);
 return staged;
}
function oneV15CommitCalendarLab(record,expected,extend=false){
 if(!STORAGE_KEY.startsWith("rastro_lab_"))throw Error("Activación disponible únicamente en Lab.");
 if(JSON.stringify(data)!==expected)throw Error("Los datos cambiaron. Volvé a abrir la configuración.");
 oneStorageAssertCurrent();
 const staged=oneV15StageCalendarChange(data,record,todayIso(),extend);
 const previous=localStorage.getItem(STORAGE_KEY);
 if(previous===null)throw Error("No existe historial local para respaldar.");
 const backupKey=STORAGE_KEY+"_pre_calendar_"+id();
 localStorage.setItem(backupKey,previous);
 if(localStorage.getItem(backupKey)!==previous)throw Error("No se verificó el respaldo.");
 oneStoragePersist(JSON.stringify(staged));data=staged;
 syncQuarterSelectors();renderDashboard();renderPlan();renderMovements();renderReports();
 return true;
}

// Calendar preparation and explicitly gated Lab activation.
function oneV15CalendarInit(){
 const dialog=document.getElementById("v15CalendarDialog"),form=document.getElementById("v15CalendarForm");
 const frequency=document.getElementById("v15CalendarFrequency"),start=document.getElementById("v15CalendarStart");
 const preview=document.getElementById("v15CalendarPreview"),saveBtn=document.getElementById("v15CalendarSave");
 const status=document.getElementById("v15TransitionStatus"),prepare=document.getElementById("v15TransitionPrepare"),withdraw=document.getElementById("v15TransitionCancel");
 const endFor=p=>periodEndDate(p,data.periods,data.settings);
 const activate=document.getElementById("v15TransitionActivate"),extend=document.getElementById("v15TransitionExtend");
 const labOnly=STORAGE_KEY.startsWith("rastro_lab_");
 let snapshot=null,proposal=null,preflight=null;
 function render(){
  proposal=null;preflight=null;saveBtn.disabled=true;prepare.disabled=true;
  status.textContent="";
  const active=data.v15CalendarTransition?.status==="active";
  withdraw.hidden=!data.v15CalendarTransition||active;
  activate.hidden=!labOnly||data.v15CalendarTransition?.status!=="prepared";activate.disabled=true;
  extend.hidden=!labOnly||!active;extend.disabled=true;
  if(active){
   status.textContent="Calendario flexible activo en Lab · hasta "+dateLabel(data.v15CalendarTransition.through)+". Sindatos anteriores modificados.".replace("Sindatos","Sin datos");
   preview.textContent="Ampliá la planificación 90 días sin modificar los períodos existentes.";
   try{oneV15StageCalendarChange(data,data.v15CalendarTransition,todayIso(),true);extend.disabled=!labOnly}catch(error){status.textContent+=" · "+error.message;}
   return;
  }
  try{
   if(!restoreValidDate(start.value)||start.value<oneShiftDate(todayIso(),1))throw Error("Elegí una fecha futura.");
   const draft=oneV15QueryCore.previewPlanningCalendar(data,start.value,frequency.value,90);
   proposal={frequency:frequency.value,start:start.value,days:90};
   preflight=oneV15QueryCore.transitionPreflight(data,proposal,todayIso(),endFor);
   const current=oneV15QueryCore.transitionStatus(data,data.v15CalendarTransition,todayIso(),endFor);
   const issues={"legacy-overlap":"Coincide con períodos existentes.","transition-gap":"Hay un intervalo sin planificación.","not-future":"Elegí una fecha futura.","assigned-future-movements":"Hay movimientos futuros asignados al calendario original."};
   status.textContent="Primera fecha disponible: "+dateLabel(preflight.earliest)+". "+(preflight.ready?"Sin solapamientos. Preparación disponible.":preflight.issues.map(x=>issues[x]||x).join(" "))+(current.status==="prepared"?" · Transición preparada (no activa).":current.status==="review"?" · Transición anterior pendiente de revisión.":"");
   prepare.disabled=!preflight.ready;
   if(labOnly&&current.status==="prepared"){try{oneV15StageCalendarChange(data,data.v15CalendarTransition,todayIso());activate.disabled=false}catch(error){status.textContent+=" · Activación bloqueada: "+error.message;}}
   if(preflight.ready){
    try{
     const shadow=oneV15ValidateTransitionShadow(data,{...proposal,status:"prepared",boundary:preflight.boundary},todayIso());
     status.textContent+=" · Ensayo local: "+shadow.count+" períodos conservados.";
    }catch(error){status.textContent+=" · Ensayo pendiente: "+error.message;prepare.disabled=true;preflight=null;}
   }
   const rows=draft.periods.map(p=>{
    const byCurrency=new Map();for(const e of p.incomes){const amount=(byCurrency.get(e.currency)||0)+e.minor;if(!Number.isSafeInteger(amount))throw Error("Monto fuera de rango");byCurrency.set(e.currency,amount)}
    const amounts=[...byCurrency].map(([c,n])=>originalMoney(n/100,c)).join(" + ")||"Sin ingresos programados";
    return '<div class="r8-budget-row"><span class="r8-budget-row-label"><span>'+safe(dateLabel(p.start)+" – "+dateLabel(p.end))+'</span></span><strong>'+safe(amounts)+'</strong></div>';
   }).join("");
   preview.innerHTML='<div class="r8-section-heading"><span>Ingresos programados · estimación</span></div>'+rows+(draft.warnings.length?'<p class="muted">'+draft.warnings.length+' configuración(es) de ingresos pendiente(s) de revisión.</p>':"");
   saveBtn.disabled=false;
  }catch(error){proposal=null;preflight=null;saveBtn.disabled=true;prepare.disabled=true;preview.textContent=error.message;status.textContent="Transición no disponible.";}
 }
 document.getElementById("v15CalendarOpen").addEventListener("click",()=>{
  snapshot=JSON.stringify(data);
  const saved=data.v15CalendarTransition||data.v15PlanningCalendarDraft,minimum=oneShiftDate(todayIso(),1);
  frequency.value=["weekly","biweekly","semimonthly","monthly"].includes(saved?.frequency)?saved.frequency:"monthly";
  start.min=minimum;start.value=restoreValidDate(saved?.start)&&saved.start>=minimum?saved.start:minimum;
  render();document.getElementById("oneSettingsDialog").close();dialog.showModal();
 });
 document.getElementById("v15CalendarCancel").addEventListener("click",()=>dialog.close());
 function commitLab(continuation){
  if(!labOnly||!(continuation?data.v15CalendarTransition?.status==="active":data.v15CalendarTransition?.status==="prepared"))return;
  if(!confirm(continuation?"¿Ampliar 90 días el calendario de Lab?":"¿Activar el calendario flexible únicamente en Lab? Se conservará un respaldo local."))return;
  try{oneV15CommitCalendarLab(data.v15CalendarTransition,snapshot,continuation);snapshot=JSON.stringify(data);render();}
  catch(error){status.textContent=error.message;}
 }
 activate.addEventListener("click",()=>commitLab(false));
 extend.addEventListener("click",()=>commitLab(true));
 for(const field of [frequency,start])field.addEventListener("change",render);
 document.getElementById("v15TransitionDate").addEventListener("click",()=>{
  try{
   const check=oneV15QueryCore.transitionPreflight(data,{frequency:frequency.value,start:oneShiftDate(todayIso(),1),days:90},todayIso(),endFor);
   start.value=check.earliest;render();
  }catch(error){status.textContent=error.message;}
 });
 prepare.addEventListener("click",()=>{
  render();if(!proposal||!preflight?.ready)return;
  if(!confirm("¿Preparar esta transición? No activará el nuevo calendario ni modificará tus presupuestos."))return;
  try{
   if(snapshot!==JSON.stringify(data))throw Error("Los datos cambiaron. Volvé a abrir la propuesta.");
   const check=oneV15QueryCore.transitionPreflight(data,proposal,todayIso(),endFor);
   if(!check.ready||check.boundary!==preflight.boundary)throw Error("Las fechas originales cambiaron.");
   const staged=clone(data);staged.v15CalendarTransition={...proposal,status:"prepared",boundary:check.boundary};
   oneStoragePersist(JSON.stringify(staged));data=staged;snapshot=JSON.stringify(data);render();
  }catch(error){status.textContent=error.message;}
 });
 withdraw.addEventListener("click",()=>{
  if(!confirm("¿Retirar la transición preparada? Los presupuestos originales no cambiarán."))return;
  try{
   if(snapshot!==JSON.stringify(data))throw Error("Los datos cambiaron. Volvé a abrir la propuesta.");
   const staged=clone(data);delete staged.v15CalendarTransition;
   oneStoragePersist(JSON.stringify(staged));data=staged;snapshot=JSON.stringify(data);render();
  }catch(error){status.textContent=error.message;}
 });
 form.addEventListener("submit",event=>{
  event.preventDefault();render();if(!proposal)return;
  try{
   if(snapshot!==JSON.stringify(data))throw Error("Los datos cambiaron. Volvé a abrir la propuesta.");
   const staged=clone(data);staged.v15PlanningCalendarDraft={...proposal,status:"draft"};
   oneStoragePersist(JSON.stringify(staged));data=staged;dialog.close();
  }catch(error){preview.textContent=error.message;}
 });
}

function bind(){
  oneV15CalendarInit();
  const settingsDialog=document.getElementById("oneSettingsDialog");
  const debtTypesDialog=document.getElementById("oneDebtTypesDialog");
  document.querySelector("#oneSettingsPaydayMount")?.appendChild(document.querySelector(".one-payday-panel"));
  document.querySelector("#oneSettingsMaintenanceMount")?.appendChild(document.querySelector(".rastro-maintenance"));
  document.getElementById("oneSettingsBtn").addEventListener("click",()=>settingsDialog.showModal());
  document.getElementById("oneSettingsCategories").addEventListener("click",()=>{settingsDialog.close();renderCategories();document.getElementById("categoryManagerDialog").showModal()});
  document.getElementById("oneSettingsDebtTypes").addEventListener("click",()=>{settingsDialog.close();oneDebtTypeFormReset();oneDebtTypesRender();debtTypesDialog.showModal()});
  document.getElementById("oneSettingsFx").addEventListener("click",()=>{settingsDialog.close();openFxDialog(true)});
  document.getElementById("oneSettingsBackup").addEventListener("click",()=>document.getElementById("exportBtn").click());
  document.getElementById("oneSettingsRestore").addEventListener("click",()=>{settingsDialog.close();document.getElementById("importBtn").click()});
  document.getElementById("oneDebtTypeCancel").addEventListener("click",oneDebtTypeFormReset);
  document.getElementById("oneDebtTypesList").addEventListener("click",event=>{
    const edit=event.target.closest("[data-edit-debt-type]");
    const toggle=event.target.closest("[data-toggle-debt-type]");
    if(edit){
      const t=data.debtTypes.find(x=>x.id===edit.dataset.editDebtType);if(!t)return;
      document.getElementById("oneDebtTypeId").value=t.id;document.getElementById("oneDebtTypeName").value=t.name;document.getElementById("oneDebtTypeShape").value=t.shape;
      document.getElementById("oneDebtTypeName").focus();return;
    }
    if(toggle){
      const t=data.debtTypes.find(x=>x.id===toggle.dataset.toggleDebtType);if(!t)return;
      if(t.active&&oneDebtTypeUsage(t)>0)return alert("Este tipo tiene deudas asociadas. Para conservar el historial, primero reasigná esas deudas.");
      const previous=t.active;t.active=!t.active;
      try{save()}catch(e){t.active=previous;return alert("No se pudo guardar el cambio.")}
      oneDebtTypesRender();
    }
  });
  document.getElementById("oneDebtTypeForm").addEventListener("submit",event=>{
    event.preventDefault();
    const typeId=document.getElementById("oneDebtTypeId").value;
    const name=document.getElementById("oneDebtTypeName").value.trim();
    const shape=document.getElementById("oneDebtTypeShape").value;
    if(!name||!Object.hasOwn(ONE_DEBT_SHAPES,shape))return;
    if(data.debtTypes.some(t=>t.id!==typeId&&t.active&&t.name.toLocaleLowerCase("es")===name.toLocaleLowerCase("es")))return alert("Ya existe un tipo de deuda activo con ese nombre.");
    const current=data.debtTypes.find(t=>t.id===typeId);
    if(current&&current.shape!==shape&&(current.builtin||oneDebtTypeUsage(current)>0))return alert("No se puede modificar la estructura de este tipo. Podés cambiar su nombre o crear otro tipo nuevo.");
    const snapshot=clone(data.debtTypes);
    if(current){current.name=name;current.shape=shape}
    else data.debtTypes.push({id:id(),name,shape,active:true,builtin:false});
    try{save()}catch(e){data.debtTypes=snapshot;return alert("No se pudo guardar el tipo de deuda.")}
    oneDebtTypeFormReset();oneDebtTypesRender();
  });
  document.getElementById("dType").addEventListener("change",oneDebtFormUpdate);
  const categoryManager=document.getElementById("categoryManagerDialog");
  const categoryManagerMount=document.getElementById("categoryManagerMount");
  const categoryView=document.getElementById("view-categories");
  if(categoryManager&&categoryManagerMount&&categoryView)categoryManagerMount.appendChild(categoryView);
  document.querySelectorAll("[data-manage-categories]").forEach(btn=>btn.addEventListener("click",()=>{renderCategories();categoryManager?.showModal()}));
  document.getElementById("closeCategoryManager")?.addEventListener("click",()=>categoryManager?.close());
  document.querySelectorAll("#nav button[data-view]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
  syncQuarterSelectors();
  const planPref=uiState.v15PlanSelection;
  if(planPref&&["week","fortnight","month","quarter","half","year","custom"].includes(planPref.level)){
    const level=document.getElementById("planLevel"),q=document.getElementById("planQuarter"),m=document.getElementById("planMonth");
    level.value=planPref.level;
    if(planningQuarters().includes(planPref.quarter))q.value=planPref.quarter;
    if(availableBudgetMonths().includes(planPref.month))m.value=planPref.month;
    syncHierarchicalFilter("plan",false);
    const f=document.getElementById("planFortnight");
    if([...f.options].some(o=>o.value===planPref.fortnight))f.value=planPref.fortnight;
  }
  fillSelect(document.getElementById("mType"),MOVEMENT_TYPES);
  refreshMovementCategorySelect();
  fillSelect(document.getElementById("mAccount"),ACCOUNTS);
  document.getElementById("mCurrency").value=displayCurrency();
  document.getElementById("rtCurrency").value=displayCurrency();
  fillSelect(document.getElementById("movementTypeFilter"),["",...MOVEMENT_TYPES]);
  document.getElementById("movementTypeFilter").options[0].text="Todos";
  document.getElementById("debtStatusFilter").addEventListener("change",renderDebts);
  document.getElementById("reserveStatusFilter").addEventListener("change",renderCapital);
  document.getElementById("categoryStatusFilter").addEventListener("change",renderCategories);
  document.getElementById("categoryTypeFilter").addEventListener("change",renderCategories);
  document.getElementById("addCategoryBtn").addEventListener("click",()=>openCategory());
  document.getElementById("cancelCategoryBtn").addEventListener("click",()=>document.getElementById("categoryDialog").close());
  document.getElementById("cType").addEventListener("change",()=>{const type=document.getElementById("cType").value;if(type==="Movimiento patrimonial")document.getElementById("cBudgetable").checked=false;updateIncomeConfigVisibility()});
  document.getElementById("cIncomeFrequency").addEventListener("change",updateIncomeConfigVisibility);
  document.getElementById("categoryForm").addEventListener("submit",e=>{
    e.preventDefault();const cid=document.getElementById("cId").value,name=document.getElementById("cName").value.trim(),type=document.getElementById("cType").value,group=document.getElementById("cGroup").value.trim(),budgetable=document.getElementById("cBudgetable").checked&&type!=="Movimiento patrimonial",incomeCfg=type==="Ingreso"?readIncomeConfigForm():null;
    if(!name)return;if(incomeCfg&&!validateIncomeConfig(incomeCfg))return;const duplicate=(data.categories||[]).find(c=>c.id!==cid&&categoryIsActive(c)&&c.type===type&&c.name.trim().toLocaleLowerCase("es")===name.toLocaleLowerCase("es"));if(duplicate)return alert("Ya existe una categoría activa con ese nombre y tipo.");
    let c=cid?categoryById(cid):null;if(c){
      if(c.type!==type&&(categoryUsageCount(c)>0||categoryBudgetUsage(c)>0))return alert("Esta categoría ya tiene historial. Para proteger tus reportes, su tipo financiero no se puede cambiar. Puedes renombrarla, cambiar el grupo o archivarla.");
      c.name=name;c.type=type;c.group=group;c.budgetable=budgetable;if(type==="Ingreso")c.incomeConfig=incomeCfg;else delete c.incomeConfig;(data.movements||[]).filter(m=>m.categoryId===c.id).forEach(m=>m.category=name)
    }else{c={id:id(),name,type,group,budgetable,active:true,sort:Math.max(0,...(data.categories||[]).map(x=>num(x.sort)))+10,createdAt:new Date().toISOString()};if(type==="Ingreso")c.incomeConfig=incomeCfg;data.categories.push(c)}
    syncIncomeProjectionsForData(data,{categoryId:c.id,adoptExisting:false});save();document.getElementById("categoryDialog").close();refreshMovementCategorySelect();renderCategories();renderPlan();renderDashboard();renderReports();
  });
  document.getElementById("mDate").value=todayIso();
  refreshDebtSelect();
  refreshReserveSelect();
  document.getElementById("rtDate").value=todayIso();
  document.getElementById("sharedStatementMonth").value=currentFinancialContext().financialMonth||todayIso().slice(0,7);
  refreshSharedGroupSelects();
  updateCurrencyHeader();
  document.querySelectorAll("[data-display-currency]").forEach(btn=>btn.addEventListener("click",()=>{data.settings.displayCurrency=normalizeCurrency(btn.dataset.displayCurrency);save();renderActiveView()}));
  document.getElementById("fxBtn").addEventListener("click",()=>openFxDialog(true));
  document.getElementById("fxFetchNowBtn").addEventListener("click",()=>{oneFxAutoUpdate(true)});
  document.getElementById("fxForm").addEventListener("submit",e=>{e.preventDefault();const date=document.getElementById("fxDate").value,buy=num(document.getElementById("fxBuy").value),sell=num(document.getElementById("fxSell").value);if(saveFxRate(date,buy,sell)){document.getElementById("fxDialog").close();renderActiveView()}});
  document.getElementById("useLastFxBtn").addEventListener("click",()=>{document.getElementById("fxDialog").close();updateCurrencyHeader()});

  ["dashboard","plan"].forEach(prefix=>{
    document.getElementById(prefix+"Level").addEventListener("change",()=>{syncHierarchicalFilter(prefix,true);prefix==="dashboard"?renderDashboard():renderPlan()});
    document.getElementById(prefix+"Quarter").addEventListener("change",()=>prefix==="dashboard"?renderDashboard():renderPlan());
    document.getElementById(prefix+"Month").addEventListener("change",()=>{syncHierarchicalFilter(prefix,false);prefix==="dashboard"?renderDashboard():renderPlan()});
    document.getElementById(prefix+"Fortnight").addEventListener("change",()=>prefix==="dashboard"?renderDashboard():renderPlan());
  });
  document.getElementById("expandPlanBtn").addEventListener("click",()=>setAllPlanMonths(true));
  document.getElementById("collapsePlanBtn").addEventListener("click",()=>setAllPlanMonths(false));
  document.getElementById("planMonths").addEventListener("click",e=>{
    const btn=e.target.closest("[data-toggle-plan-month]");if(!btn)return;
    const month=btn.dataset.togglePlanMonth, section=document.querySelector(`[data-plan-month="${month}"]`);
    if(!section)return;const open=btn.getAttribute("aria-expanded")!=="true";
    setPlanMonthOpen(section,open);
  });
  document.getElementById("reportHistoryRange")?.addEventListener("change",renderReports);
  document.querySelectorAll("[data-report-tab]").forEach(btn=>btn.addEventListener("click",()=>{reportActiveTab=btn.dataset.reportTab||"overview";renderReports()}));
  document.getElementById("movementTypeFilter").addEventListener("change",renderMovements);
  document.getElementById("mType").addEventListener("change",()=>{refreshMovementCategorySelect();refreshDebtSelect();updateMovementFields()});
  document.getElementById("mPaymentSource").addEventListener("change",oneV121SyncPaymentFields);
  document.getElementById("mDebt").addEventListener("change",()=>{
    const d=data.debts.find(x=>x.id===document.getElementById("mDebt").value);
    if(d&&document.getElementById("mType").value==="Pago deuda"){
      const cid=suggestDebtCategoryId(d);if(cid)document.getElementById("mCategory").value=cid;
    }
    updateMovementFields();
  });
  document.getElementById("reconcileBtn").addEventListener("click",openReconcile);
  document.getElementById("cancelReconcileBtn").addEventListener("click",()=>document.getElementById("reconcileDialog").close());
  document.getElementById("rDate").addEventListener("change",updateReconcilePreview);
  document.getElementById("rAmount").addEventListener("input",updateReconcilePreview);
  document.getElementById("rCurrency").addEventListener("change",updateReconcilePreview);
  document.getElementById("reconcileForm").addEventListener("submit",e=>{
    e.preventDefault();
    const date=document.getElementById("rDate").value, amount=num(document.getElementById("rAmount").value),currency=normalizeCurrency(document.getElementById("rCurrency").value);
    const p=periodForDate(date);
    if(!restoreValidDate(date)||date>todayIso()||!p||date>periodEndDate(p))
      return alert("La fecha debe ser válida, no futura y pertenecer a un período presupuestario.");
    const calculatedBefore=actualBalanceAt(date);
    data.reconciliations.push({id:id(),date,amount,currency,...currentFxSnapshot(),afterSeq:num(data.movementSeq),calculatedBefore,note:document.getElementById("rNote").value.trim(),createdAt:new Date().toISOString()});
    save();document.getElementById("reconcileDialog").close();syncQuarterSelectors();renderDashboard();renderPlan();
  });

  document.getElementById("movementForm").addEventListener("submit",e=>{
    e.preventDefault();
    const priorLinked=data.movements.find(m=>m.id===document.getElementById("mEditId").value);
    if(oneIsLinkedCobroMovement(priorLinked))return alert("Este movimiento está vinculado a Cobros. Modificá el abono desde esa herramienta.");
    const editId=document.getElementById("mEditId").value;
    const existing=editId?data.movements.find(m=>m.id===editId):null;
    if(editId&&!existing)return alert("El movimiento que intentás editar ya no existe.");
    const date=document.getElementById("mDate").value,p=periodForDate(date);
    if(!p||(oneV15HasFlexiblePeriods()&&date>periodEndDate(p)))return alert("La fecha no pertenece a un período configurado. Revisá Presupuesto.");
    const type=document.getElementById("mType").value,selectedCategoryId=document.getElementById("mCategory").value;
    const debtId=document.getElementById("mDebt").value,debtObj=data.debts.find(d=>d.id===debtId);
    if(type==="Pago deuda"&&!debtObj)return alert("Seleccioná la deuda o acreedor.");
    const amount=Number(document.getElementById("mAmount").value);
    if(!Number.isFinite(amount)||amount<=0)return alert("El monto debe ser mayor que cero.");
    const currency=normalizeCurrency(document.getElementById("mCurrency").value);
    const financedChoice=type==="Gasto"&&document.getElementById("mPaymentSource").value==="credit"?
      document.getElementById("mFinancedDebt").value:"";
    const financedCard=(data.debts||[]).find(d=>d.id===financedChoice&&oneDebtTypeForDebt(d)?.shape==="card");
    if(financedChoice&&(!financedCard||(debtStatus(financedCard)!=="active"&&existing?.financedDebtId!==financedChoice)))
      return alert("Seleccioná una tarjeta de crédito activa para vincular el gasto.");
    if(type==="Gasto"&&document.getElementById("mPaymentSource").value==="credit"&&!financedCard)
      return alert("Elegí una tarjeta. Podés crearla en Deudas antes de registrar esta compra.");
    const principalRaw=type==="Pago deuda"?document.getElementById("mPrincipalAmount").value.trim():"";
    const principal=principalRaw===""?undefined:Number(principalRaw);
    if(principal!==undefined&&(!Number.isFinite(principal)||principal<0||principal>amount))
      return alert("El capital aplicado debe estar entre 0 y el total pagado, en la misma moneda.");
    const distribution=type==="Gasto"?m2GetSplits():{splits:[],error:""};
    if(distribution.error)return alert(distribution.error);
    const splits=distribution.splits;
    const categoryId=splits.length?splits[0].categoryId:selectedCategoryId;
    const category=categoryById(categoryId);
    if(!category||category.type!==type)return alert("Seleccioná una categoría válida para el tipo de movimiento.");
    const historicalCategories=new Set([existing?.categoryId,...(existing?.splits||[]).map(x=>x.categoryId)]);
    if(!categoryIsActive(category)&&!historicalCategories.has(categoryId))
      return alert("La categoría seleccionada está archivada; elegí una categoría activa.");
    for(const line of splits){
      const splitCategory=categoryById(line.categoryId);
      if(!splitCategory||splitCategory.type!=="Gasto"||(!categoryIsActive(splitCategory)&&!historicalCategories.has(line.categoryId)))
        return alert("Una categoría de la división ya no está disponible. Elegí una categoría activa.");
    }
    const projectChoice=oneProjectReadMovementSelection(type,existing);
    if(!projectChoice.ok)return alert(projectChoice.error);
    const scheduledId=!existing?document.getElementById("mScheduledId").value:"";
    const scheduledTemplate=scheduledId?data.movementTemplates.find(t=>t.id===scheduledId):null;
    if(scheduledId){
      if(!scheduledTemplate?.active)return alert("Esta programación ya no está activa.");
      if(data.movements.some(m=>m.scheduleTemplateId===scheduledId&&m.scheduledFor===scheduledTemplate.nextDate))
        return alert("Esta fecha programada ya fue registrada. Revisá el historial antes de continuar.");
    }
    const obj={...existing,id:existing?.id||id(),seq:existing?.seq||data.movementSeq+1,
      createdAt:existing?.createdAt||new Date().toISOString(),date,type,categoryId,
      category:category.name,
      splits,debtId:type==="Pago deuda"?(debtObj?.id||""):"",debt:type==="Pago deuda"?(debtObj?.name||""):"",
      financedDebtId:financedCard?.id||"",principalAmount:principal,
      account:document.getElementById("mAccount").value,
      paymentMethod:financedCard?"Tarjeta de crédito":document.getElementById("mPaymentMethod").value,
      description:document.getElementById("mDescription").value.trim(),amount,currency,
      ...(existing&&normalizeCurrency(existing.currency)===currency?{fxBuy:existing.fxBuy,fxSell:existing.fxSell,fxRef:existing.fxRef,fxDate:existing.fxDate}:currentFxSnapshot()),
      period:periodKey(p),quarter:budgetQuarter(p)};
    const dup=data.movements.find(m=>m.id!==obj.id&&m2SameMovement(m,obj));
    if(dup&&!confirm(`Ya existe un ${type.toLowerCase()} de ${originalMoney(amount,currency)} el ${date} con la misma cuenta y categoría. ¿Registrar igualmente?`))return;
    if(existing&&!confirm("¿Guardar los cambios de este movimiento? Se actualizarán los indicadores y se conservará el registro del cambio."))return;
    const rollback={movements:data.movements.slice(),movementSeq:data.movementSeq,
      movementAudit:clone(data.movementAudit||[]),movementTemplates:clone(data.movementTemplates||[]),
      projectLinks:clone(data.projectLinks||[])};
    if(existing){
      m2Audit("edit",obj,existing);
      const index=data.movements.findIndex(m=>m.id===existing.id);
      data.movements[index]=obj;
    }else{
      data.movementSeq++;
      obj.seq=data.movementSeq;
      if(scheduledTemplate){
        obj.scheduleTemplateId=scheduledId;obj.scheduledFor=scheduledTemplate.nextDate;
        scheduledTemplate.lastPostedFor=scheduledTemplate.nextDate;
        scheduledTemplate.nextDate=m2NextScheduledDate(scheduledTemplate.nextDate,scheduledTemplate.frequency,scheduledTemplate.anchorDay);
      }
      data.movements.push(obj);m2Audit("create",obj);
    }
    oneProjectAssignMovement(obj.id,projectChoice.projectId,projectChoice.bucketId);
    try{save()}catch(error){
      data.movements=rollback.movements;data.movementSeq=rollback.movementSeq;
      data.movementAudit=rollback.movementAudit;data.movementTemplates=rollback.movementTemplates;
      data.projectLinks=rollback.projectLinks;
      return alert("No se pudo guardar el movimiento ni su vínculo al proyecto. Revisá el almacenamiento.");
    }
    m2ResetComposer();
    refreshV7MovementCategoryFilter();m2RefreshAccounts();
    renderMovements();renderDashboard();renderPlan();renderReports();m2RenderTemplates();
    if(oneModuleEnabled("projects"))renderProjects();
    oneActionSaved(existing?"Movimiento actualizado":
      type==="Ingreso"?"Ingreso registrado":type==="Gasto"?"Gasto registrado":"Pago de deuda registrado",
      originalMoney(amount,currency)+(obj.description?" · "+obj.description:"")+
      (obj.scheduleTemplateId?"\nProgramación confirmada; próximo registro pendiente de aprobación.":""));
  });

  document.addEventListener("click",e=>{
    const resetIncome=e.target.closest("[data-reset-income-budget]");if(resetIncome){const [key,cid]=resetIncome.dataset.resetIncomeBudget.split("|"),p=periodByKey(key);if(p){setIncomeBudgetToScheduled(p,cid);renderPlan();renderDashboard();renderReports()}return}
    const editCategory=e.target.closest("[data-edit-category]");if(editCategory){openCategory(categoryById(editCategory.dataset.editCategory));return}
    const archiveCategory=e.target.closest("[data-archive-category]");if(archiveCategory){const c=categoryById(archiveCategory.dataset.archiveCategory);if(c&&confirm(`¿Archivar “${c.name}”?\n\nSu historial y presupuestos anteriores se conservarán, pero dejará de aparecer para nuevos registros.`)){c.active=false;syncIncomeProjectionsForData(data,{categoryId:c.id});save();refreshMovementCategorySelect();renderCategories();renderPlan();renderDashboard()}return}
    const reactivateCategory=e.target.closest("[data-reactivate-category]");if(reactivateCategory){const c=categoryById(reactivateCategory.dataset.reactivateCategory);if(c){c.active=true;syncIncomeProjectionsForData(data,{categoryId:c.id});save();renderCategories();renderPlan();renderDashboard()}return}
    const del=e.target.closest("[data-delete-movement]");
    if(del){
      const movement=data.movements.find(m=>m.id===del.dataset.deleteMovement);
      if(oneIsLinkedCobroMovement(movement))return alert("Este movimiento está vinculado a un cobro. Editá o revertí el abono desde Cobros.");
      if(movement&&confirm("¿Eliminar este movimiento? Se actualizarán tus saldos, presupuesto e indicadores.")){
        const previousMovements=data.movements,previousLinks=data.projectLinks,previousAudit=clone(data.movementAudit||[]);
        m2Audit("delete",movement,movement);
        data.movements=data.movements.filter(m=>m.id!==movement.id);
        data.projectLinks=(data.projectLinks||[]).filter(l=>l.movementId!==movement.id);
        try{save()}catch(error){
          data.movements=previousMovements;data.projectLinks=previousLinks;data.movementAudit=previousAudit;
          return alert("No se pudo eliminar el movimiento. El historial sigue sin cambios.");
        }
        renderMovements();renderDashboard();renderPlan();renderReports();
        if(oneModuleEnabled("projects"))renderProjects();
        m2RenderAccountSummary(selectedMovements(document.getElementById("movementLevel").value,document.getElementById("movementPeriod").value));
      }
      return;
    }
    const edit=e.target.closest("[data-edit-debt]");if(edit)openDebt(data.debts.find(d=>d.id===edit.dataset.editDebt));
    const archive=e.target.closest("[data-archive-debt]");
    if(archive){
      const d=data.debts.find(x=>x.id===archive.dataset.archiveDebt);
      if(d){
        const remaining=debtOutstanding(d);
        const warning=remaining>1?`\n\nLa herramienta todavía estima un saldo restante de ${money(remaining)}. Puedes archivarla igualmente si confirmaste con el acreedor que ya está cancelada.`:"";
        if(confirm(`¿Cerrar y archivar “${d.name}”?${warning}\n\nSu historial de pagos se conservará y dejará de sumar en la deuda activa.`)){
          d.status="archived";d.closedAt=todayIso();d.closedReason="Pagada / finalizada";save();refreshDebtSelect();renderDebts();renderDashboard();renderCapital();
        }
      }
    }
    const reactivate=e.target.closest("[data-reactivate-debt]");
    if(reactivate){
      const d=data.debts.find(x=>x.id===reactivate.dataset.reactivateDebt);
      if(d&&confirm(`¿Reactivar “${d.name}”? Volverá a sumar en tus totales y a estar disponible para registrar pagos.`)){
        d.status="active";d.closedAt="";d.closedReason="";save();refreshDebtSelect();renderDebts();renderDashboard();renderCapital();
      }
    }
    const editReserve=e.target.closest("[data-edit-reserve]");if(editReserve)openReserve(data.reserves.find(r=>r.id===editReserve.dataset.editReserve));
    const markComplete=e.target.closest("[data-complete-goal]");
    if(markComplete){
      const r=data.reserves.find(x=>x.id===markComplete.dataset.completeGoal);
      if(!r||r.type!=="goal"||reserveStatus(r)!=="active")return;
      const balance=reserveBalanceAt(r,todayIso()),target=reserveTargetCRC(r);
      if(!(target>.005&&balance>=target-.005))return alert("La meta todavía no alcanzó su monto objetivo.");
      if(!confirm("¿Marcar “"+r.name+"” como cumplida?\n\nEl saldo "+money(balance)+" seguirá apartado y contará en tu patrimonio hasta registrar un Uso objetivo o Retiro. No se crea ningún ingreso ni gasto."))return;
      r.status="archived";r.closedAt=todayIso();r.closedReason="Meta cumplida";
      save();refreshReserveSelect();renderCapital();renderDashboard();renderPlan();
      oneActionSaved("Meta cumplida",r.name+"\nEl saldo sigue reservado. Reactivá la meta si necesitás registrar su uso, sin duplicar movimientos.");
      return;
    }
    const archiveReserve=e.target.closest("[data-archive-reserve]");
    if(archiveReserve){const r=data.reserves.find(x=>x.id===archiveReserve.dataset.archiveReserve);if(r){const bal=reserveBalanceAt(r,todayIso()),reason=prompt(`Motivo para archivar “${r.name}” (por ejemplo: Meta lograda o Meta cancelada):`,"Meta lograda");if(reason!==null&&confirm(`¿Archivar “${r.name}”?${bal?`\n\nEl fondo conserva un saldo de ${money(bal)} y seguirá contando dentro de tu patrimonio hasta que registres un Uso objetivo o Retiro.`:""}`)){r.status="archived";r.closedAt=todayIso();r.closedReason=reason.trim()||"Meta finalizada";save();refreshReserveSelect();renderCapital();renderDashboard();}}}
    const reactivateReserve=e.target.closest("[data-reactivate-reserve]");if(reactivateReserve){const r=data.reserves.find(x=>x.id===reactivateReserve.dataset.reactivateReserve);if(r&&confirm(`¿Reactivar “${r.name}”?`)){r.status="active";r.closedAt="";r.closedReason="";save();refreshReserveSelect();renderCapital();renderDashboard();}}
    const editSharedGroup=e.target.closest("[data-edit-shared-group]");if(editSharedGroup)openSharedGroup(sharedGroupById(editSharedGroup.dataset.editSharedGroup));
    const archiveSharedGroupBtn=e.target.closest("[data-archive-shared-group]");if(archiveSharedGroupBtn)archiveSharedGroup(sharedGroupById(archiveSharedGroupBtn.dataset.archiveSharedGroup));
    const reactivateSharedGroupBtn=e.target.closest("[data-reactivate-shared-group]");if(reactivateSharedGroupBtn)reactivateSharedGroup(sharedGroupById(reactivateSharedGroupBtn.dataset.reactivateSharedGroup));
    const deleteSharedGroupBtn=e.target.closest("[data-delete-shared-group]");if(deleteSharedGroupBtn)deleteSharedGroup(sharedGroupById(deleteSharedGroupBtn.dataset.deleteSharedGroup));
    const addSharedToGroup=e.target.closest("[data-add-shared-to-group]");if(addSharedToGroup)openSharedCharge(null,addSharedToGroup.dataset.addSharedToGroup||"");
    const groupOneShared=e.target.closest("[data-group-one-shared]");if(groupOneShared)openAssignSharedGroup([groupOneShared.dataset.groupOneShared]);
    const selectUngrouped=e.target.closest("[data-select-all-ungrouped]");if(selectUngrouped){receivableDisplayRows("",selectedReceivableMonth()).forEach(c=>sharedSelectedChargeIds.add(c.id));renderSharedCharges();}
    const printShared=e.target.closest("[data-print-shared-group]");if(printShared)printSharedStatement(printShared.dataset.printSharedGroup);
    const payCobro=e.target.closest("[data-cobro-pay]");
    if(payCobro){openCobroPayment(data.sharedCharges.find(c=>c.id===payCobro.dataset.cobroPay));return;}
    const historyCobro=e.target.closest("[data-cobro-history]");
    if(historyCobro){openCobroPaymentHistory(data.sharedCharges.find(c=>c.id===historyCobro.dataset.cobroHistory));return;}
    const editCobroPayment=e.target.closest("[data-edit-cobro-payment]");
    if(editCobroPayment){
      const [cid,pid]=editCobroPayment.dataset.editCobroPayment.split("|");
      const c=data.sharedCharges.find(x=>x.id===cid),p=c?.payments?.find(p=>p.id===pid);
      if(c&&p){
        document.getElementById("cobroHistoryDialog").close();
        openCobroPayment(c,p);
      }
      return;
    }
    const undo=e.target.closest("[data-revert-cobro-payment]");
    if(undo){
      const [cid,pid]=undo.dataset.revertCobroPayment.split("|"),c=data.sharedCharges.find(x=>x.id===cid);
      const p=c?.payments?.find(x=>x.id===pid),linked=p?oneCobroMovement(c,p):null;
      if(p&&confirm(linked?"¿Revertir el abono y eliminar su movimiento vinculado? El pendiente aumentará y se actualizará el saldo operativo.":"¿Revertir este abono? El pendiente aumentará.")){
        if(oneRevertCobroPayment(c,p)){oneRefreshCobroViews();openCobroPaymentHistory(c);}
      }
      return;
    }
    const snooze=e.target.closest("[data-snooze-cobro]");
    if(snooze){const c=data.sharedCharges.find(x=>x.id===snooze.dataset.snoozeCobro);if(c){c.snoozedUntil=addDaysIso(todayIso(),3);save();renderDashboard();}return;}
    const editShared=e.target.closest("[data-edit-shared-charge]");if(editShared)openSharedCharge(data.sharedCharges.find(c=>c.id===editShared.dataset.editSharedCharge));
    const payShared=e.target.closest("[data-pay-shared-charge]");if(payShared){openCobroPayment(data.sharedCharges.find(x=>x.id===payShared.dataset.paySharedCharge));return;}
    const reopenShared=e.target.closest("[data-reopen-shared-charge]");if(reopenShared){const c=data.sharedCharges.find(x=>x.id===reopenShared.dataset.reopenSharedCharge);if(c&&!(c.payments||[]).length&&confirm("¿Reabrir este cobro pagado?")){c.status="pending";c.paidAt="";save();renderSharedCharges();renderDashboard();}}
    const delShared=e.target.closest("[data-delete-shared-charge]");if(delShared){const c=data.sharedCharges.find(x=>x.id===delShared.dataset.deleteSharedCharge);if(c?.sourceRecurringId)cancelRecurringFromMonth(c);else if(c){
      const linked=data.movements.some(m=>m.receivableChargeId===c.id);
      if(confirm(`¿Eliminar “${c.description}”?${linked?" También se eliminarán los movimientos vinculados de este cobro.":""}`)){
        oneDeleteCobroLinkedMovements(c);data.sharedCharges=data.sharedCharges.filter(x=>x.id!==c.id);
        oneRefreshCobroViews();
      }
    }}
    const delReserveTxn=e.target.closest("[data-delete-reserve-txn]");if(delReserveTxn&&confirm("¿Eliminar este movimiento de fondo?")){data.reserveMovements=data.reserveMovements.filter(t=>t.id!==delReserveTxn.dataset.deleteReserveTxn);save();renderCapital();renderDashboard();renderPlan()}
    const delRec=e.target.closest("[data-delete-reconcile]");
    if(delRec&&confirm("¿Eliminar esta conciliación de saldo?")){data.reconciliations=data.reconciliations.filter(r=>r.id!==delRec.dataset.deleteReconcile);save();renderDashboard();renderPlan()}
    const pay=e.target.closest("[data-pay-debt]");
    if(pay){
      const d=data.debts.find(x=>x.id===pay.dataset.payDebt);if(!d||debtStatus(d)==="archived")return;navigate("movements");
      m2OpenComposer();
      document.getElementById("mType").value="Pago deuda";
      refreshMovementCategorySelect();
      document.getElementById("mDebt").value=d.id;
      const suggested=suggestDebtCategoryId(d);if(suggested)document.getElementById("mCategory").value=suggested;
      document.getElementById("mDescription").value=`Pago ${d.name}`;
      updateMovementFields();m2RefreshQuickTypes();
      document.getElementById("mAmount").focus({preventScroll:true});
    }
  });
  document.addEventListener("change",e=>{
    if(e.target.matches("[data-select-shared]")){selectSharedCharge(e.target.dataset.selectShared,e.target.checked);return}
    if(e.target.matches("[data-select-shared-section]")){
      const key=e.target.dataset.selectSharedSection,rows=receivableDisplayRows(key==="__ungrouped__"?"":key,selectedReceivableMonth());rows.forEach(c=>selectSharedCharge(c.id,e.target.checked));renderSharedCharges();return;
    }
    if(e.target.dataset.plan){
      const [key,field]=e.target.dataset.plan.split("|"),p=periodByKey(key);
      if(p&&field==="date"&&oneV15HasFlexiblePeriods()){e.target.value=p.date;return alert("No se modifican fechas de períodos cuando existe un calendario flexible.")}
      if(p){p[field]=field==="date"?e.target.value:num(e.target.value);const meta=deriveBudgetMeta(p);p.budgetMonth=meta.budgetMonth;p.fortnight=meta.fortnight;save();syncQuarterSelectors();renderPlan()}
    }
    if(e.target.dataset.planCurrency){
      const [key,field]=e.target.dataset.planCurrency.split("|"),p=periodByKey(key);if(p){p[field]=normalizeCurrency(e.target.value);save();renderPlan()}
    }
    if(e.target.dataset.budget){
      const [key,cat]=e.target.dataset.budget.split("|"),p=periodByKey(key);
      if(p){p.budgets[cat]=num(e.target.value);save();renderPlan()}
    }
    if(e.target.dataset.budgetCurrency){
      const [key,cat]=e.target.dataset.budgetCurrency.split("|"),p=periodByKey(key);if(p){p.budgetCurrencies=p.budgetCurrencies||{};p.budgetCurrencies[cat]=normalizeCurrency(e.target.value);save();renderPlan()}
    }
    if(e.target.dataset.categoryBudget){
      const [key,cid]=e.target.dataset.categoryBudget.split("|"),p=periodByKey(key);if(p){p.categoryBudgets=p.categoryBudgets||{};p.categoryBudgets[cid]=num(e.target.value);if(categoryById(cid)?.type==="Ingreso"){p.categoryBudgetSources=p.categoryBudgetSources||{};p.categoryBudgetSources[cid]="manual";if(p.categoryBudgetScheduledDates)delete p.categoryBudgetScheduledDates[cid]}save();renderPlan()}
    }
    if(e.target.dataset.categoryBudgetCurrency){
      const [key,cid]=e.target.dataset.categoryBudgetCurrency.split("|"),p=periodByKey(key);if(p){p.categoryBudgetCurrencies=p.categoryBudgetCurrencies||{};p.categoryBudgetCurrencies[cid]=normalizeCurrency(e.target.value);if(categoryById(cid)?.type==="Ingreso"){p.categoryBudgetSources=p.categoryBudgetSources||{};p.categoryBudgetSources[cid]="manual";if(p.categoryBudgetScheduledDates)delete p.categoryBudgetScheduledDates[cid]}save();renderPlan()}
    }
  });

  document.getElementById("cobrosPeopleTab").addEventListener("click",()=>{uiState.cobrosDisplayMode="people";saveUiState();renderSharedCharges()});
  document.getElementById("cobrosGroupsTab").addEventListener("click",()=>{uiState.cobrosDisplayMode="groups";saveUiState();renderSharedCharges()});
  document.getElementById("cpCancel").addEventListener("click",()=>document.getElementById("cobroPaymentDialog").close());
  document.getElementById("cpHistoryClose").addEventListener("click",()=>document.getElementById("cobroHistoryDialog").close());
  document.getElementById("cpSyncMovement").addEventListener("change",oneRefreshCobroMovementOptions);
  document.getElementById("cpMovementKind").addEventListener("change",oneRefreshCobroMovementOptions);
  document.getElementById("cpForm").addEventListener("submit",e=>{
    e.preventDefault();
    const c=data.sharedCharges.find(x=>x.id===document.getElementById("cpChargeId").value);
    const paymentId=document.getElementById("cpPaymentId").value;
    const result=oneCommitCobroPayment(c,{
      paymentId,amount:Number(document.getElementById("cpAmount").value),
      date:document.getElementById("cpDate").value,note:document.getElementById("cpNote").value.trim(),
      linked:document.getElementById("cpSyncMovement").checked,
      kind:document.getElementById("cpMovementKind").value,
      categoryId:document.getElementById("cpMovementIncomeCategory").value
    });
    if(!result.ok)return alert(result.error);
    document.getElementById("cobroPaymentDialog").close();
    oneRefreshCobroViews();
    if(paymentId)openCobroPaymentHistory(c);
    oneActionSaved(paymentId?"Abono actualizado":"Abono registrado",
      originalMoney(result.payment.amount,c.currency)+" · "+(c.person||"Cobro")+
      (document.getElementById("cpSyncMovement").checked?"\nMovimiento vinculado en tu saldo operativo.":"\nSin movimiento adicional en el saldo operativo."));
  });
  document.getElementById("addSharedGroupBtn").addEventListener("click",()=>openSharedGroup());
  document.getElementById("addSharedChargeBtn").addEventListener("click",()=>openSharedCharge());
  document.getElementById("cancelSharedGroupBtn").addEventListener("click",()=>document.getElementById("sharedGroupDialog").close());
  document.getElementById("cancelSharedChargeBtn").addEventListener("click",()=>document.getElementById("sharedChargeDialog").close());
  document.getElementById("sharedPrevMonth").addEventListener("click",()=>{const el=document.getElementById("sharedStatementMonth");el.value=shiftMonthKey(selectedReceivableMonth(),-1);renderSharedCharges()});
  document.getElementById("sharedNextMonth").addEventListener("click",()=>{const el=document.getElementById("sharedStatementMonth");el.value=shiftMonthKey(selectedReceivableMonth(),1);renderSharedCharges()});
  document.getElementById("sharedCurrentMonth").addEventListener("click",()=>{document.getElementById("sharedStatementMonth").value=currentFinancialContext().financialMonth||todayIso().slice(0,7);renderSharedCharges()});
  document.getElementById("toggleArchivedSharedGroups").addEventListener("click",()=>setSharedGroupView(sharedGroupView()==="archived"?"active":"archived"));
  document.getElementById("clearSharedSelectionBtn").addEventListener("click",clearSharedSelection);
  document.getElementById("assignSelectedGroupBtn").addEventListener("click",()=>openAssignSharedGroup());
  document.getElementById("removeSelectedGroupBtn").addEventListener("click",()=>{const rows=selectedSharedCharges();if(!rows.length)return;if(confirm(`¿Quitar ${rows.length===1?"este cobro":"estos cobros"} de su grupo?`))applyGroupToSelected("")});
  document.getElementById("cancelAssignSharedGroupBtn").addEventListener("click",()=>document.getElementById("assignSharedGroupDialog").close());
  document.getElementById("assignExistingModeBtn").addEventListener("click",()=>setAssignSharedMode("existing"));
  document.getElementById("assignNewModeBtn").addEventListener("click",()=>setAssignSharedMode("new"));
  document.getElementById("assignSharedGroupForm").addEventListener("submit",e=>{
    e.preventDefault();const creating=document.getElementById("assignNewModeBtn").classList.contains("active");let gid="";
    if(creating){
      const name=document.getElementById("assignNewGroupName").value.trim();if(!name)return alert("Escribí un nombre para el grupo.");
      const g={id:id(),name,person:document.getElementById("assignNewGroupPerson").value.trim(),notes:document.getElementById("assignNewGroupNotes").value.trim(),cutDay:0,status:"active",closedAt:"",closedReason:""};data.sharedChargeGroups.push(g);gid=g.id;
    }else{gid=document.getElementById("assignGroupSelect").value;if(!gid)return alert("Seleccioná un grupo o creá uno nuevo.")}
    document.getElementById("assignSharedGroupDialog").close();applyGroupToSelected(gid);
  });
  document.getElementById("scGroup").addEventListener("change",()=>{const g=sharedGroupById(document.getElementById("scGroup").value);if(g&&g.person)document.getElementById("scPerson").value=g.person});
  document.getElementById("scDueDate").addEventListener("change",oneSyncCobroReminderField);
  document.getElementById("sharedGroupForm").addEventListener("submit",e=>{
    e.preventDefault();const gid=document.getElementById("sgId").value,old=data.sharedChargeGroups.find(g=>g.id===gid),obj={id:gid||id(),name:document.getElementById("sgName").value.trim(),person:document.getElementById("sgPerson").value.trim(),notes:document.getElementById("sgNotes").value.trim(),cutDay:old?.cutDay||0,status:old?.status||"active",closedAt:old?.closedAt||"",closedReason:old?.closedReason||""};
    const i=data.sharedChargeGroups.findIndex(g=>g.id===gid);i>=0?data.sharedChargeGroups[i]={...data.sharedChargeGroups[i],...obj}:data.sharedChargeGroups.push(obj);save();document.getElementById("sharedGroupDialog").close();refreshSharedGroupSelects(obj.id);renderSharedCharges();
  });
  document.getElementById("sharedChargeForm").addEventListener("submit",e=>{
    e.preventDefault();
    const cid=document.getElementById("scId").value,existing=data.sharedCharges.find(c=>c.id===cid),status=document.getElementById("scStatus").value,recurring=document.getElementById("scRecurring").checked,chargeMonth=document.getElementById("scMonth").value,date=document.getElementById("scDate").value,dueDate=document.getElementById("scDueDate").value;
    if(recurring&&!dueDate)return alert("Para repetir un cobro cada mes, elegí la fecha en que esperás recibir el pago.");
    if(existing&&(existing.payments||[]).length&&normalizeCurrency(document.getElementById("scCurrency").value)!==normalizeCurrency(existing.currency))
      return alert("No podés cambiar la moneda de un cobro con abonos registrados. Revertí los abonos primero para evitar inconsistencias.");
    let sourceRecurringId=existing?.sourceRecurringId||"";
    const base={groupId:document.getElementById("scGroup").value,person:document.getElementById("scPerson").value.trim(),date,dueDate,remindBeforeDays:num(document.getElementById("scReminderDays").value),chargeMonth,kind:document.getElementById("scKind").value,description:document.getElementById("scDescription").value.trim(),amount:num(document.getElementById("scAmount").value),currency:normalizeCurrency(document.getElementById("scCurrency").value),...currentFxSnapshot(),status,paidAt:status==="paid"?(existing?.paidAt||todayIso()):"",notes:document.getElementById("scNotes").value.trim()};
    if(recurring){
      let template=(data.receivableRecurring||[]).find(t=>t.id===sourceRecurringId);
      if(!template){sourceRecurringId=id();template={id:sourceRecurringId,startMonth:chargeMonth,endMonth:""};data.receivableRecurring.push(template)}
      Object.assign(template,{groupId:base.groupId,person:base.person,day:Number(String(date).slice(8,10))||1,reminderDay:Number(String(dueDate).slice(8,10))||1,remindBeforeDays:base.remindBeforeDays,kind:base.kind,description:base.description,amount:base.amount,currency:base.currency,notes:base.notes,startMonth:template.startMonth&&template.startMonth<chargeMonth?template.startMonth:chargeMonth,endMonth:""});
      // Actualizar copias automáticas futuras que todavía no representan historia pasada.
      (data.sharedCharges||[]).filter(c=>c.sourceRecurringId===sourceRecurringId&&(c.chargeMonth||monthKey(c.date))>=chargeMonth&&c.id!==cid&&!(c.payments||[]).length&&c.status!=="paid").forEach(c=>Object.assign(c,{groupId:base.groupId,person:base.person,date:recurringChargeDate(template,c.chargeMonth||monthKey(c.date)),dueDate:recurringChargeDate({...template,day:template.reminderDay},c.chargeMonth||monthKey(c.date)),remindBeforeDays:base.remindBeforeDays,kind:base.kind,description:base.description,amount:base.amount,currency:base.currency,...currentFxSnapshot(),notes:base.notes}));
    }else if(sourceRecurringId){
      const template=(data.receivableRecurring||[]).find(t=>t.id===sourceRecurringId);if(template)template.endMonth=shiftMonthKey(chargeMonth,-1);sourceRecurringId="";
    }
    const payments=existing?.payments||[];
    if(payments.reduce((sum,p)=>sum+num(p.amount),0)>num(base.amount)+.005)return alert("El importe no puede ser menor que la suma de los abonos existentes.");
    const obj={...existing,id:cid||id(),...base,payments,snoozedUntil:existing?.snoozedUntil||"",sourceRecurringId,createdAt:existing?.createdAt||new Date().toISOString()};
    if(payments.length)syncCobroPaymentState(obj);
    const i=data.sharedCharges.findIndex(c=>c.id===cid);i>=0?data.sharedCharges[i]=obj:data.sharedCharges.push(obj);
    const fromMovements=oneCentralCobroFromMovements;
    oneCentralCobroFromMovements=false;
    save();const chargeDialog=document.getElementById("sharedChargeDialog");if(chargeDialog?.open)chargeDialog.close();document.getElementById("sharedStatementMonth").value=chargeMonth;renderSharedCharges();
    if(fromMovements){
      m2ResetComposer();
      if(!oneModuleEnabled("shared"))oneSetModuleEnabled("shared",true);
      renderMovements();
    }
    oneActionSaved(cid?"Cobro actualizado":"Cobro pendiente registrado",
      originalMoney(obj.amount,obj.currency)+" · "+(obj.person||"Persona sin nombre")+"\nEste cobro no crea un ingreso hasta registrar su pago.");
  });

  document.getElementById("addReserveBtn").addEventListener("click",()=>openReserve());
  document.getElementById("createGoalBtn")?.addEventListener("click",()=>openReserve());
  document.getElementById("goalStatusFilter")?.addEventListener("change",renderCapital);
  document.getElementById("cancelReserveBtn").addEventListener("click",()=>document.getElementById("reserveDialog").close());
  document.getElementById("reserveForm").addEventListener("submit",e=>{
    e.preventDefault();const rid=document.getElementById("fId").value;
    const oldReserve=data.reserves.find(r=>r.id===rid);
    const obj={id:rid||id(),name:document.getElementById("fName").value.trim(),type:document.getElementById("fType").value,target:num(document.getElementById("fTarget").value),targetCurrency:normalizeCurrency(document.getElementById("fTargetCurrency").value),targetDate:document.getElementById("fType").value==="goal"?document.getElementById("fTargetDate").value:(oldReserve?.targetDate||""),openingAmount:num(document.getElementById("fOpeningAmount").value),openingCurrency:normalizeCurrency(document.getElementById("fOpeningCurrency").value),openingDate:document.getElementById("fOpeningDate").value,location:document.getElementById("fLocation").value.trim(),rate:num(document.getElementById("fRate").value),notes:document.getElementById("fNotes").value.trim(),budgetCategoryId:document.getElementById("fBudgetCategory").value,status:oldReserve?.status||"active",closedAt:oldReserve?.closedAt||"",closedReason:oldReserve?.closedReason||""};
    if(obj.targetDate&&!restoreValidDate(obj.targetDate))return alert("Ingresá una fecha objetivo válida.");
    if(obj.targetDate&&obj.openingDate&&obj.targetDate<obj.openingDate)return alert("La fecha objetivo no puede ser anterior al inicio del fondo.");
    const eligibility=oneGoalTxnEligibility(obj,null,rid);
    if(!eligibility.ok)return alert(eligibility.error);
    const i=data.reserves.findIndex(r=>r.id===rid);i>=0?data.reserves[i]={...data.reserves[i],...obj}:data.reserves.push(obj);
    save();document.getElementById("reserveDialog").close();refreshReserveSelect();renderCapital();renderDashboard();renderPlan();
    oneActionSaved(rid?"Meta actualizada":"Meta creada",obj.name);
  });
  document.getElementById("reserveTxnForm").addEventListener("submit",e=>{
    e.preventDefault();const reserveId=document.getElementById("rtReserve").value;if(!reserveId)return alert("Selecciona un fondo.");
    const fund=data.reserves.find(r=>r.id===reserveId);
    const candidate={id:id(),date:document.getElementById("rtDate").value,reserveId,type:document.getElementById("rtType").value,amount:num(document.getElementById("rtAmount").value),currency:normalizeCurrency(document.getElementById("rtCurrency").value),...currentFxSnapshot(),description:document.getElementById("rtDescription").value.trim(),createdAt:new Date().toISOString()};
    const permission=oneGoalTxnEligibility(fund,candidate);
    if(!permission.ok)return alert(permission.error);
    data.reserveMovements.push(candidate);
    save();e.target.reset();document.getElementById("rtDate").value=todayIso();document.getElementById("rtCurrency").value=displayCurrency();refreshReserveSelect(reserveId);renderCapital();renderDashboard();renderPlan();
    oneActionSaved(candidate.type==="Aporte"?"Ahorro registrado":"Movimiento de meta registrado",
      originalMoney(candidate.amount,candidate.currency)+" · "+fund.name);
  });
  document.getElementById("addDebtBtn").addEventListener("click",()=>openDebt());
  document.getElementById("cancelDebtBtn").addEventListener("click",()=>document.getElementById("debtDialog").close());
  document.getElementById("debtForm").addEventListener("submit",e=>{
    e.preventDefault();const did=document.getElementById("dId").value;
    const status=document.getElementById("dStatus").value;
    const selectedType=data.debtTypes.find(t=>t.id===document.getElementById("dType").value);
    if(!selectedType)return alert("Seleccioná un tipo de deuda vigente.");
    const previous=data.debts.find(d=>d.id===did);
    if(!selectedType.active&&previous?.typeId!==selectedType.id)return alert("No podés usar un tipo archivado para una deuda nueva.");
    if(previous&&debtPayments(previous)>0&&previous.type!==ONE_DEBT_SHAPES[selectedType.shape])return alert("Esta deuda tiene pagos históricos. Para cambiar su estructura financiera, creá una nueva deuda sin alterar la anterior.");
    const shape=selectedType.shape,field=fieldName=>document.getElementById(fieldName).value,is=key=>shape===key;
    const obj={...(previous||{}),id:did||id(),type:ONE_DEBT_SHAPES[shape],typeId:selectedType.id,name:field("dName").trim(),status,
      usd:num(field("dUsd")),crc:num(field("dCrc")),fx:currentRates().sell,
      limit:is("card")?num(field("dLimit")):(previous?.type===ONE_DEBT_SHAPES[shape]?num(previous.limit):0),limitCurrency:normalizeCurrency(field("dLimitCurrency")),
      minimum:num(field("dMinimum")),
      minimumCurrency:normalizeCurrency(field("dMinimumCurrency")),
      payDay:field("dPayDay").trim(),
      rate:is("card")?String(previous?.rate??""):field("dRate").trim().replace(",","."),
      rateCRC:is("card")?field("dRateCRC").trim().replace(",","."):previous?.rateCRC,
      rateUSD:is("card")?field("dRateUSD").trim().replace(",","."):previous?.rateUSD,
      closeDay:is("card")?num(field("dCloseDay")):0,
      fullPayment:is("card")?num(field("dFullPayment")):0,
      fullPaymentCurrency:normalizeCurrency(field("dFullPaymentCurrency")),
      lender:["loan","installments","family"].includes(shape)?field("dLender").trim():"",
      endDate:["loan","installments"].includes(shape)?field("dEndDate"):"",
      installmentsTotal:is("installments")?num(field("dInstallmentsTotal")):0,
      installmentsLeft:is("installments")?num(field("dInstallmentsLeft")):0,
      priority:num(field("dPriority")),goal:field("dGoal").trim(),notes:field("dNotes").trim()};
    if(!obj.name)return alert("Ingresá un nombre para la deuda.");
    const rateValid=t=>t===""||oneDebtRateLiteral(t)!==null;
    if(is("card")?(!rateValid(obj.rateCRC)||!rateValid(obj.rateUSD)):!rateValid(obj.rate))
      return alert("La tasa anual debe estar entre 0 y 200% o quedar vacía si se desconoce.");
    if(obj.payDay&&!/^(?:[1-9]|[12][0-9]|3[01])$/.test(obj.payDay)&&obj.payDay!==previous?.payDay)return alert("El día de pago debe estar entre 1 y 31.");
    if(is("card")&&obj.closeDay&&(obj.closeDay<1||obj.closeDay>31))return alert("El día de corte debe estar entre 1 y 31.");
    if(is("installments")&&obj.installmentsTotal&&obj.installmentsLeft>obj.installmentsTotal)return alert("Las cuotas restantes no pueden superar las cuotas totales.");
    const i=data.debts.findIndex(d=>d.id===did),old=i>=0?data.debts[i]:null,oldName=old?.name||"";
    if(status==="archived"){obj.closedAt=old?.closedAt||todayIso();obj.closedReason=old?.closedReason||"Pagada / finalizada"}else{obj.closedAt="";obj.closedReason=""}
    const originalDebt=i>=0?clone(data.debts[i]):null;
    const matchedMovements=i>=0&&oldName!==obj.name?data.movements.filter(m=>m.debtId===obj.id||(!m.debtId&&m.debt===oldName)):[],movementSnapshot=matchedMovements.map(m=>({m,debtId:m.debtId,debt:m.debt}));
    i>=0?data.debts[i]=obj:data.debts.push(obj);
    matchedMovements.forEach(m=>{m.debtId=obj.id;m.debt=obj.name});
    try{save()}catch(error){
      if(i>=0)data.debts[i]=originalDebt;else data.debts.pop();
      movementSnapshot.forEach(x=>{x.m.debtId=x.debtId;x.m.debt=x.debt});
      return alert("No se pudo guardar la deuda. No se modificó el historial.");
    }
    document.getElementById("debtDialog").close();refreshDebtSelect();renderDebts();renderDashboard();renderCapital();
    oneActionSaved(did?"Deuda actualizada":"Deuda registrada",obj.name);
  });

  document.getElementById("newQuarterBtn").addEventListener("click",()=>{
    if(oneV15HasFlexiblePeriods())return alert("La ampliación del calendario flexible todavía no está disponible.");
    const q=prompt("Nombre del trimestre, por ejemplo 2027-T2");
    if(!q||planningQuarters().includes(q))return;
    const rows=makeQuarter(q);if(!rows.length)return alert("Formato inválido. Usa AAAA-T1, AAAA-T2, AAAA-T3 o AAAA-T4.");
    data.periods.push(...rows);syncIncomeProjectionsForData(data);save();syncQuarterSelectors();document.getElementById("planLevel").value="quarter";syncHierarchicalFilter("plan",false);document.getElementById("planQuarter").value=q;renderPlan()
  });
  document.getElementById("duplicateQuarterBtn").addEventListener("click",()=>{
    if(oneV15HasFlexiblePeriods())return alert("La duplicación entre calendarios requiere revisión.");
    const source=selectionQuarter("plan"),q=prompt("Nombre del nuevo trimestre, por ejemplo 2027-T2");
    if(!q||planningQuarters().includes(q))return;
    const src=getQuarterPeriods(source),rows=makeQuarter(q);if(!rows.length)return alert("Formato inválido.");
    rows.forEach((p,i)=>{const s=src[i];if(s){p.income=s.income;p.incomeCurrency=s.incomeCurrency;p.otherIncome=s.otherIncome;p.otherIncomeCurrency=s.otherIncomeCurrency;p.budgets=clone(s.budgets);p.budgetCurrencies=clone(s.budgetCurrencies||{});p.categoryBudgets=clone(s.categoryBudgets||{});p.categoryBudgetCurrencies=clone(s.categoryBudgetCurrencies||{});p.categoryBudgetSources=clone(s.categoryBudgetSources||{});p.categoryBudgetScheduledDates={}}});
    data.periods.push(...rows);syncIncomeProjectionsForData(data);save();syncQuarterSelectors();document.getElementById("planLevel").value="quarter";syncHierarchicalFilter("plan",false);document.getElementById("planQuarter").value=q;renderPlan()
  });

  document.getElementById("exportBtn").addEventListener("click",()=>{
    if(storageReadError)return alert("No se puede crear un respaldo porque no se pudo leer el historial local original.");
    try{
      oneStorageAssertCurrent();
      // Los navegadores no informan si el archivo fue finalmente guardado por el usuario.
      download("respaldo-finanzas-"+todayIso()+".json",JSON.stringify(data,null,2),"application/json");
      try{localStorage.setItem(STORAGE_KEY+"_last_backup_requested",todayIso())}catch{}
      const notice=document.getElementById("oneBackupNotice");
      if(notice){notice.hidden=false;notice.textContent="Descarga solicitada. Comprobá el archivo JSON en Descargas y guardá una copia fuera del navegador."}
      oneRenderDataHealth();
    }catch(error){alert("No se pudo solicitar el respaldo. "+String(error?.message||"Revisá el almacenamiento."));}
  });
  const restoreDialog=document.getElementById("restorePreviewDialog");
  let pendingRestore=null;
  document.getElementById("importBtn").addEventListener("click",()=>document.getElementById("importFile").click());
  document.getElementById("restorePreviewCancel").addEventListener("click",()=>restoreDialog.close());
  document.getElementById("restorePreviewClose").addEventListener("click",()=>restoreDialog.close());
  restoreDialog.addEventListener("close",()=>{pendingRestore=null});
  document.getElementById("importFile").addEventListener("change",async e=>{
    const file=e.target.files?.[0];e.target.value="";
    if(!file)return;
    try{
      if(file.size>RESTORE_MAX_BYTES)throw Error("El archivo supera 25 MB.");
      const parsed=restoreValidate(JSON.parse(await file.text()));
      restorePrepare(parsed);
      pendingRestore=parsed;
      document.getElementById("restorePreviewDetails").innerHTML=restoreDetailsHtml(parsed,file.name);
      restoreDialog.showModal();
    }catch(error){
      pendingRestore=null;
      alert("No se restauró ningún dato. "+(error?.message||"Archivo no válido."));
    }
  });
  document.getElementById("restorePreviewConfirm").addEventListener("click",()=>{
    if(!pendingRestore)return;
    const btn=document.getElementById("restorePreviewConfirm");btn.disabled=true;
    try{
      restoreSafely(pendingRestore);
      restoreDialog.close();
      alert("Datos restaurados. One Less One se recargará.");
      location.reload();
    }catch(error){
      alert("La restauración no pudo completarse: "+(error?.message||"No se pudo guardar."));
    }finally{btn.disabled=false}
  });
  document.getElementById("resetBtn").addEventListener("click",()=>{
    if(storageReadError)return alert("El historial guardado no pudo leerse. Para protegerlo, no se permite restablecer desde esta pantalla.");
    if(!confirm("¿Restablecer los datos financieros de este navegador? Se descargará un respaldo y se guardará una copia preventiva antes de continuar."))return;
    try{
      const fresh=migrateData(clone(initialData));
      fresh.version=6.2;fresh.currencySchemaVersion=1;fresh.categorySchemaVersion=1;fresh.incomeSchemaVersion=1;
      oneBackupBeforeReplace(RESET_SAFETY_KEY,"respaldo-previo-restablecimiento");
      oneStoragePersist(JSON.stringify(fresh));
      data=fresh;
      syncQuarterSelectors();refreshDebtSelect();refreshReserveSelect();refreshSharedGroupSelects();refreshMovementCategorySelect();
      navigate("dashboard");updateCurrencyHeader();
      if(needsInitialFx())setTimeout(()=>openFxDialog(true),120);
      alert("Datos locales restablecidos. Conservá el respaldo descargado.");
    }catch(error){alert("No se restablecieron los datos: "+(error?.message||"no se pudo guardar la copia preventiva."))}
  });

  document.getElementById("exportMovementsCsv").addEventListener("click",()=>{
    const level=document.getElementById("movementLevel").value,value=document.getElementById("movementPeriod").value;
    const rows=m2FilteredMovementRows().rows,headers=["Fecha","Mes presupuestario","Quincena","Tipo","Categoría","Deuda","Cuenta","Método","Descripción","División por categorías","Monto original","Moneda original","Equivalente CRC histórico","TC compra","TC venta","Periodo","Trimestre"];
    const csv=[headers,...rows.map(m=>{const p=movementPeriod(m);return [m.date,p?.budgetMonth||"",p?.fortnight||"",m.type,movementDisplayCategory(m),movementDebtName(m),m.account,m.paymentMethod||"",m.description,(m.splits||[]).map(x=>categoryNameById(x.categoryId,"?")+": "+x.amount).join(" | "),m.amount,normalizeCurrency(m.currency),movementAmountCRC(m),m.fxBuy||"",m.fxSell||"",m.period,movementBudgetQuarter(m)]})].map(r=>r.map(csvEscape).join(",")).join("\n");
    download(`movimientos-${level}-${value}.csv`,"\ufeff"+csv,"text/csv")
  });
  document.getElementById("exportReportCsv")?.addEventListener("click",()=>{
    const level=document.getElementById("reportLevel").value,value=document.getElementById("reportPeriod").value;
    const rows=reportCategoryRows(level,value),currency=displayCurrency(),total=rows.reduce((s,r)=>s+r.actual,0),headers=["Categoría","Tipo",`Presupuesto ${currency}`,`Real ${currency}`,`Variación ${currency}`,"Porcentaje usado","Participación del gasto"];
    const csv=[headers,...rows.map(r=>[r.category,r.type,fromCRC(r.budget,currency),fromCRC(r.actual,currency),fromCRC(r.variance,currency),r.budget?r.actual/r.budget:"",total?r.actual/total:0])].map(r=>r.map(csvEscape).join(",")).join("\n");
    download(`analisis-${level}-${value}.csv`,"\ufeff"+csv,"text/csv")
  });
  window.addEventListener("resize",()=>{if(document.getElementById("view-dashboard").classList.contains("active"))renderDashboard();if(document.getElementById("view-reports")?.classList.contains("active"))renderReports()});
}
