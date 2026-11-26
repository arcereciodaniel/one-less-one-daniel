function oneCentralNotify(message){
  const note=document.getElementById("oneCentralFeedback");
  if(!note)return;
  note.textContent=String(message||"");
  note.hidden=!message;
}
function oneCentralRestoreCobroForm(){
  const form=document.getElementById("sharedChargeForm");
  if(form?.parentNode?.id==="oneCentralCobroMount")document.querySelector("#sharedChargeDialog .dialog-body").appendChild(form);
  const mount=document.getElementById("oneCentralCobroMount");if(mount)mount.hidden=true;
  oneCentralCobroFromMovements=false;
}
function oneCentralRestoreMovementForm(){
  oneCentralRestoreCobroForm();
  document.getElementById("oneCentralGoalForm").hidden=true;
  document.getElementById("movementForm").hidden=false;
  document.querySelectorAll("[data-one-action]").forEach(b=>{b.classList.remove("active");b.setAttribute("aria-pressed","false")});
  document.getElementById("movementComposerTitle").textContent="Nuevo movimiento";
  document.getElementById("movementSplitToggle").hidden=document.getElementById("mType").value!=="Gasto";
}
function oneCentralPrepareGoalList(){
  const select=document.getElementById("oneCentralGoalSelect"),goals=activeReserves().filter(r=>r.type==="goal");
  select.replaceChildren();
  for(const r of goals){const option=document.createElement("option");option.value=r.id;option.textContent=r.name;select.appendChild(option);}
  document.getElementById("oneCentralGoalEmpty").hidden=goals.length>0;
  document.getElementById("oneCentralGoalSubmit").disabled=goals.length===0;
  select.required=goals.length>0;
  oneFillGoalBudgetCategory("oneCentralGoalCategory",oneGoalBudgetCategory(goals.find(r=>r.id===select.value)));
  return goals;
}
function oneCentralSyncGoalTxnType(){
  const type=document.getElementById("oneCentralGoalTxnType").value;
  document.getElementById("oneCentralGoalCategoryField").hidden=type!=="Aporte";
  const hint=type==="Aporte"?"El aporte reduce tu saldo operativo y aumenta tu ahorro, sin registrar un gasto.":
    type==="Retiro a operación"?"El retiro devuelve dinero de la meta al saldo operativo. No es un ingreso nuevo.":
    "Usar los ahorros reduce el saldo de la meta; registrá una compra aparte solamente si corresponde.";
  document.getElementById("oneCentralGoalHint").textContent=hint;
}
function oneCentralOpenGoal(options={}){
  if(document.getElementById("mEditId")?.value||document.getElementById("mScheduledId")?.value)return;
  oneCentralRestoreCobroForm();
  const form=document.getElementById("oneCentralGoalForm");
  form.reset();
  oneCentralPrepareGoalList();
  const selected=typeof options==="object"&&options?.reserveId?options.reserveId:"";
  if(selected&&[...document.getElementById("oneCentralGoalSelect").options].some(x=>x.value===selected)){
    document.getElementById("oneCentralGoalSelect").value=selected;
    oneFillGoalBudgetCategory("oneCentralGoalCategory",oneGoalBudgetCategory(data.reserves.find(r=>r.id===selected)));
  }
  document.getElementById("oneCentralGoalTxnType").value=
    ["Aporte","Retiro a operación","Uso objetivo"].includes(options?.type)?options.type:"Aporte";
  oneCentralSyncGoalTxnType();
  document.getElementById("oneCentralGoalDate").value=todayIso();
  document.getElementById("oneCentralGoalCurrency").value=displayCurrency();
  document.getElementById("movementForm").hidden=true;
  document.getElementById("movementSplitToggle").hidden=true;
  form.hidden=false;
  document.getElementById("movementComposerTitle").textContent="Movimiento de meta";
  document.querySelectorAll("[data-m2-type],[data-one-action]").forEach(b=>{
    const active=b.dataset.oneAction==="goal";
    b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));
  });
  if(!document.getElementById("oneCentralGoalEmpty").hidden)document.getElementById("oneCentralCreateGoal").focus();
  else document.getElementById("oneCentralGoalAmount").focus({preventScroll:true});
}
function oneCentralOpenCobro(){
  if(document.getElementById("mEditId")?.value||document.getElementById("mScheduledId")?.value)return;
  oneCentralRestoreCobroForm();
  openSharedCharge(null,"",{inline:true});
  document.getElementById("oneCentralGoalForm").hidden=true;
  document.getElementById("movementForm").hidden=true;
  document.getElementById("movementSplitToggle").hidden=true;
  const mount=document.getElementById("oneCentralCobroMount");
  mount.hidden=false;mount.appendChild(document.getElementById("sharedChargeForm"));
  document.getElementById("movementComposerTitle").textContent="Registrar cobro";
  oneCentralCobroFromMovements=true;
  document.querySelectorAll("[data-m2-type],[data-one-action]").forEach(b=>{
    const active=b.dataset.oneAction==="cobro";b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));
  });
  document.getElementById("scPerson").focus({preventScroll:true});
}
function oneCentralSaveGoal(event){
  event.preventDefault();
  if(storageReadError)return alert("No se puede guardar mientras exista un problema leyendo el almacenamiento local.");
  const reserveId=document.getElementById("oneCentralGoalSelect").value;
  const fund=data.reserves.find(r=>r.id===reserveId&&r.type==="goal"&&reserveStatus(r)==="active");
  if(!fund)return alert("Seleccioná una meta activa.");
  const amount=Number(document.getElementById("oneCentralGoalAmount").value);
  if(!Number.isFinite(amount)||amount<=0)return alert("El aporte debe ser mayor que cero.");
  const candidate={
    id:id(),reserveId,date:document.getElementById("oneCentralGoalDate").value,
    type:document.getElementById("oneCentralGoalTxnType").value,amount,currency:normalizeCurrency(document.getElementById("oneCentralGoalCurrency").value),
    budgetCategoryId:document.getElementById("oneCentralGoalTxnType").value==="Aporte"?document.getElementById("oneCentralGoalCategory").value:"",
    ...currentFxSnapshot(),description:document.getElementById("oneCentralGoalDescription").value.trim(),
    createdAt:new Date().toISOString()
  };
  const permission=oneGoalTxnEligibility(fund,candidate);
  if(!permission.ok)return alert(permission.error);
  data.reserveMovements.push(candidate);
  try{save()}catch(error){data.reserveMovements.pop();return alert("No se pudo guardar el aporte. No se creó ningún movimiento adicional.");}
  if(!oneModuleEnabled("capital"))oneSetModuleEnabled("capital",true);
  m2ResetComposer();
  renderMovements();renderDashboard();renderPlan();renderCapital();
  oneActionSaved(candidate.type==="Aporte"?"Ahorro registrado":"Movimiento de meta registrado",
    originalMoney(amount,candidate.currency)+" · "+fund.name+"\nTransferencia interna: no se creó un gasto ni un ingreso ficticio.");
}

function oneInitPaydayControls(){
  const form=document.getElementById("onePaydayForm");if(!form)return;
  const first=document.getElementById("onePaydayFirst"),second=document.getElementById("onePaydaySecond");
  const sync=()=>{const d=onePayDays(data.settings);first.value=d.first;second.value=d.second};
  sync();
  form.addEventListener("submit",e=>{
    e.preventDefault();
    const a=Number(first.value),b=Number(second.value);
    if(!Number.isInteger(a)||!Number.isInteger(b)||a<1||a>27||b<=a||b>31)return alert("Ingresá dos días válidos; el segundo debe ser posterior al primero.");
    if(!confirm("¿Aplicar las fechas de salario desde el mes actual? Los movimientos, montos y meses anteriores no se eliminan."))return;
    data.settings.payDays={first:a,second:b};oneUpdatePaydayPeriods(todayIso().slice(0,7));
    save();syncQuarterSelectors();m2SyncMovementPeriod();renderPlan();renderMovements();renderDashboard();sync();
  });
}
function initMovements2(){
  oneInitPaydayControls();
  const form=document.getElementById("movementForm"),composer=document.getElementById("movementComposer");
  document.body.appendChild(document.getElementById("movementComposerDialog"));
  m2ResetComposer(true);
  document.getElementById("movementLevel").value="month";
  m2SyncMovementPeriod(true);
  m2RefreshAccounts("");
  m2RenderTemplates();
  document.getElementById("toggleMovementComposer")?.addEventListener("click",()=>m2OpenComposer());
  document.getElementById("oneRepeatLastMovement")?.addEventListener("click",()=>{
    const latest=m2LastRepeatable();if(latest)m2OpenComposer(latest,{repeat:true});
  });
  document.getElementById("closeMovementComposer")?.addEventListener("click",()=>m2ResetComposer());
  const dialog=document.getElementById("movementComposerDialog");
  dialog?.addEventListener("cancel",e=>{e.preventDefault();m2ResetComposer()});
  dialog?.addEventListener("click",e=>{if(e.target===dialog)m2ResetComposer()});
  document.getElementById("movementCancelEdit")?.addEventListener("click",()=>m2ResetComposer());
  document.querySelectorAll("[data-m2-type]").forEach(btn=>btn.addEventListener("click",()=>{
    if(!document.getElementById("oneCentralGoalForm").hidden||!document.getElementById("oneCentralCobroMount").hidden)oneCentralRestoreMovementForm();
    document.getElementById("mType").value=btn.dataset.m2Type;
    document.getElementById("mType").dispatchEvent(new Event("change",{bubbles:true}));
  }));
  document.querySelector('[data-one-action="goal"]')?.addEventListener("click",oneCentralOpenGoal);
  document.querySelector('[data-one-action="cobro"]')?.addEventListener("click",oneCentralOpenCobro);
  document.getElementById("oneCentralGoalForm")?.addEventListener("submit",oneCentralSaveGoal);
  document.getElementById("oneCentralGoalTxnType")?.addEventListener("change",oneCentralSyncGoalTxnType);
  document.getElementById("oneCentralGoalSelect")?.addEventListener("change",e=>{
    oneFillGoalBudgetCategory("oneCentralGoalCategory",oneGoalBudgetCategory(data.reserves.find(r=>r.id===e.target.value)));
  });
  document.getElementById("oneCentralCreateGoal")?.addEventListener("click",()=>{
    m2ResetComposer();
    if(!oneModuleEnabled("capital"))oneSetModuleEnabled("capital",true);
    openReserve();
    oneCentralNotify("Creá tu meta y después elegí “Ahorro para meta” desde Movimientos para hacer el primer aporte.");
  });
  document.getElementById("sharedChargeDialog")?.addEventListener("close",()=>{oneCentralCobroFromMovements=false});
  document.getElementById("mType")?.addEventListener("change",m2RefreshQuickTypes);
  const splits=document.getElementById("movementSplitRows");
  document.getElementById("movementSplitToggle")?.addEventListener("click",()=>{
    m2SetSplitMode(!m2IsSplitMode());
  });
  document.getElementById("addMovementSplit")?.addEventListener("click",()=>{
    const used=new Set([...splits.querySelectorAll(".m2-split-category")].map(el=>el.value));
    const next=categoriesOfType("Gasto").find(c=>!used.has(c.id));
    if(!next)return alert("No hay otras categorías de Gasto disponibles.");
    m2AddSplitRow();
  });
  splits?.addEventListener("click",e=>{
    if(e.target.closest("[data-m2-remove-split]")){e.target.closest(".m2-split-row")?.remove();m2SplitMessage()}
  });
  splits?.addEventListener("input",m2SplitMessage);
  splits?.addEventListener("change",m2SplitMessage);
  document.getElementById("mAmount")?.addEventListener("input",m2SplitMessage);
  ["movementDateFrom","movementDateTo","movementCurrencyFilter"].forEach(id=>{
    document.getElementById(id)?.addEventListener("change",renderMovements);
  });
  document.getElementById("movementClearFilters")?.addEventListener("click",()=>{
    for(const key of ["movementDateFrom","movementDateTo","movementCurrencyFilter","movementSearch","movementTypeFilter","movementCategoryFilter"]){
      const el=document.getElementById(key);if(el)el.value="";
    }
    renderMovements();
  });
  document.getElementById("addMovementTemplateBtn")?.addEventListener("click",()=>m2OpenTemplate());
  document.getElementById("mtType")?.addEventListener("change",()=>m2TemplateCategoryOptions());
  document.getElementById("cancelMovementTemplate")?.addEventListener("click",()=>document.getElementById("movementTemplateDialog").close());
  document.getElementById("movementTemplateForm")?.addEventListener("submit",e=>{e.preventDefault();m2SaveTemplate()});
  document.getElementById("manageMovementAccounts")?.addEventListener("click",()=>{
    document.getElementById("newMovementAccount").value="";
    document.getElementById("movementAccountsList").textContent="Cuentas disponibles: "+m2Accounts().join(" · ");
    document.getElementById("movementAccountsDialog").showModal();
  });
  document.getElementById("closeMovementAccounts")?.addEventListener("click",()=>document.getElementById("movementAccountsDialog").close());
  document.getElementById("movementAccountForm")?.addEventListener("submit",e=>{
    e.preventDefault();const input=document.getElementById("newMovementAccount");
    const name=input.value.trim();
    if(!name)return;
    if(m2Accounts().some(a=>a.toLocaleLowerCase("es")===name.toLocaleLowerCase("es")))return alert("Esta cuenta ya existe.");
    data.accounts=data.accounts||[];data.accounts.push(name);
    save();m2RefreshAccounts(name);
    document.getElementById("movementAccountsList").textContent="Cuentas disponibles: "+m2Accounts().join(" · ");
    input.value="";
    renderMovements();
  });
  document.addEventListener("click",e=>{
    const linked=e.target.closest("[data-open-linked-cobro]");
    if(linked){
      const c=(data.sharedCharges||[]).find(row=>row.id===linked.dataset.openLinkedCobro);
      if(!c)return alert("El cobro original ya no está disponible.");
      if(!oneModuleEnabled("shared"))oneSetModuleEnabled("shared",true);
      navigate("shared");openCobroPaymentHistory(c);return;
    }
    const edit=e.target.closest("[data-m2-edit]");
    if(edit){const m=data.movements.find(x=>x.id===edit.dataset.m2Edit);if(oneIsLinkedCobroMovement(m))return alert("Este movimiento se modifica desde Cobros.");if(m)m2OpenComposer(m);return}
    const repeat=e.target.closest("[data-m2-repeat]");
    if(repeat){const m=data.movements.find(x=>x.id===repeat.dataset.m2Repeat);if(oneIsLinkedCobroMovement(m))return alert("Los abonos vinculados se administran desde Cobros.");if(m)m2OpenComposer(m,{repeat:true});return}
    const schedule=e.target.closest("[data-m2-schedule]");
    if(schedule){const m=data.movements.find(x=>x.id===schedule.dataset.m2Schedule);if(oneIsLinkedCobroMovement(m))return alert("Los abonos vinculados se administran desde Cobros.");if(m)m2OpenTemplate(m);return}
    const post=e.target.closest("[data-m2-post-template]");
    if(post){const t=data.movementTemplates.find(x=>x.id===post.dataset.m2PostTemplate);if(t)m2PrepareScheduled(t);return}
    const editTemplate=e.target.closest("[data-m2-edit-template]");
    if(editTemplate){const t=data.movementTemplates.find(x=>x.id===editTemplate.dataset.m2EditTemplate);if(t)m2OpenTemplate(t);return}
    const toggle=e.target.closest("[data-m2-toggle-template]");
    if(toggle){
      const t=data.movementTemplates.find(x=>x.id===toggle.dataset.m2ToggleTemplate);
      if(t){t.active=!t.active;save();m2RenderTemplates()}
      return;
    }
  });
}

function initV7(){
  refreshV7MovementCategoryFilter();
  const advancedDetails=document.getElementById("dashboardAdvancedDetails");
  advancedDetails?.addEventListener("toggle",()=>{
    if(advancedDetails.open&&document.getElementById("view-dashboard")?.classList.contains("active"))renderDashboard();
  });
  document.getElementById("oneDataHealthDetails")?.addEventListener("toggle",event=>{
    if(event.target.open)oneRenderDataHealth();
  });
  document.getElementById("movementSearch")?.addEventListener("input",renderMovements);
  document.getElementById("movementCategoryFilter")?.addEventListener("change",renderMovements);
  const updateMovementPeriod=()=>{m2SyncMovementPeriod();renderMovements()};
  document.querySelectorAll("[data-one-move-level]").forEach(b=>b.addEventListener("click",()=>{
    document.getElementById("movementLevel").value=b.dataset.oneMoveLevel;
    updateMovementPeriod();
  }));
  ["movementQuarter","movementMonth","movementFortnight"].forEach(id=>document.getElementById(id)?.addEventListener("change",updateMovementPeriod));
  const step=delta=>{
    const level=document.getElementById("movementLevel").value;
    const options=filterOptions(level),current=document.getElementById("movementPeriod").value;
    const index=options.findIndex(o=>o.value===current),next=options[index+delta];
    if(!next)return;
    if(level==="quarter")document.getElementById("movementQuarter").value=next.value;
    else if(level==="month")document.getElementById("movementMonth").value=next.value;
    else{
      const period=periodByKey(next.value);if(!period)return;
      document.getElementById("movementMonth").value=period.budgetMonth;
      syncHierarchicalFilter("movement",false);
      document.getElementById("movementFortnight").value=String(period.fortnight);
    }
    updateMovementPeriod();
  };
  document.getElementById("movementPreviousPeriod")?.addEventListener("click",()=>step(-1));
  document.getElementById("movementNextPeriod")?.addEventListener("click",()=>step(1));
  document.getElementById("movementTodayPeriod")?.addEventListener("click",()=>{document.getElementById("movementLevel").value="month";m2SyncMovementPeriod(true);renderMovements()});
  const filterButton=document.getElementById("movementFilterToggle"),filterPanel=document.getElementById("movementFiltersPanel");
  const showFilters=open=>{filterPanel.hidden=!open;filterButton.setAttribute("aria-expanded",String(open))};
  filterButton?.addEventListener("click",()=>showFilters(filterPanel.hidden));
  document.getElementById("movementFiltersClose")?.addEventListener("click",()=>showFilters(false));
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!filterPanel.hidden){showFilters(false);filterButton.focus()}});
  document.addEventListener("click",e=>{if(!e.target.closest(".one-move-row-more"))document.querySelectorAll(".one-move-row-more[open]").forEach(d=>d.open=false)});


}

function initDebtBalanceReconciliation(){
 const dialog=document.getElementById("debtBalanceDialog"),close=()=>dialog.close();
 document.getElementById("closeDebtBalanceDialog").addEventListener("click",close);
 document.getElementById("cancelDebtBalance").addEventListener("click",close);
 document.addEventListener("click",e=>{const b=e.target.closest("[data-adjust-debt]");if(!b)return;
 const d=data.debts.find(x=>x.id===b.dataset.adjustDebt);if(!d||debtStatus(d)!=="active")return;
 document.getElementById("debtBalanceId").value=d.id;document.getElementById("debtBalanceName").value=d.name;
 document.getElementById("debtBalanceAmount").value=debtOutstanding(d).toFixed(2);
 document.getElementById("debtBalanceCurrency").value="CRC";document.getElementById("debtBalanceNote").value="";dialog.showModal();});
 document.getElementById("debtBalanceForm").addEventListener("submit",e=>{e.preventDefault();
 const d=data.debts.find(x=>x.id===document.getElementById("debtBalanceId").value);
 const amount=Number(document.getElementById("debtBalanceAmount").value);
 if(!d||debtStatus(d)!=="active"||!Number.isFinite(amount)||amount<0){alert("Ingresá un saldo válido.");return}
 const currency=normalizeCurrency(document.getElementById("debtBalanceCurrency").value);
 if(!confirm(`¿Guardar este saldo real para “${d.name}”? El historial de pagos se mantendrá intacto.`))return;
 if(!Array.isArray(d.balanceAdjustments))d.balanceAdjustments=[];
 d.balanceAdjustments.push({id:id(),date:todayIso(),createdAt:new Date().toISOString(),amount,currency,paidAtAdjustment:debtPayments(d),afterSeq:num(data.movementSeq),note:document.getElementById("debtBalanceNote").value.trim()});
 save();close();renderDebts();renderDashboard();renderCapital();renderPlan();
 });
}
bind();oneProjectInit();oneFutureInit();oneScenarioInit();oneDebtSimInit();oneActionSuccessInit();oneInitSplitFare();initDebtBalanceReconciliation();bindReportStudio();initV7();initR8();initMovements2();initGoalsBeta();oneFlexRuntime();initUiPreferences();initLiquidityChartInteraction();initModulesBeta();oneStorageGuardInit();initDataIntegrityNotice();navigate(uiState.activeView||"dashboard");updateCurrencyHeader();oneFxAutoUpdate();
