function renderDashboard(){
  const {level,value}=hierarchicalSelection("dashboard");
  const summary=selectedSummary(level,value), cat=categoryReportFiltered(level,value), rows=summary.rows;
  const debtTotal=activeDebtTotal();
  const operatingToday=actualBalanceAt(todayIso()), reserves=reserveTotals(todayIso());
  const liquidPatrimony=operatingToday+reserves.total;
  const cards=[
    ["Saldo operativo hoy",operatingToday,operatingToday>=0?"good":"bad"],
    
    ["Fondos por objetivo",reserves.goalTotal,""],
    ["Patrimonio líquido",liquidPatrimony,"good"],
    ["Ingresos presupuestados",summary.plannedIncome,""],
    ["Egresos presupuestados",summary.plannedExpense,""],
    ["Saldo proyectado",summary.projected,summary.projected>=0?"good":"bad"],
    ["Deuda estimada",debtTotal,"warn"]
  ];
  document.getElementById("kpiGrid").innerHTML=cards.map(([l,v,c])=>`<div class="card kpi ${c}"><div class="label">${l}</div><div class="value">${money(v)}</div></div>`).join("");
  document.getElementById("dashboardCategories").innerHTML=categoryTable(cat);
  renderReconciliationStatus();
  if(document.getElementById("oneDataHealthDetails")?.open)oneRenderDataHealth();
  const labels=rows.map(r=>oneV15IsFlexiblePeriod(r)?dateLabel(r.date):level==="quarter"?`${monthLabel(r.budgetMonth).slice(0,3)} ${r.fortnight}Q`:level==="month"?`${r.fortnight}.ª`:dateLabel(r.date).replace(/ de /g," "));
  drawBarChart(document.getElementById("expenseChart"),labels.length?labels:["Sin datos"],labels.length?rows.map(r=>r.expenses):[0],labels.length?rows.map(r=>r.actualExpenses):[0]);
  drawLineChart(document.getElementById("cashChart"),labels.length?labels:["Sin datos"],labels.length?rows.map(r=>r.ending):[0],labels.length?rows.map(r=>r.actualBalance):[0]);
}
function renderReconciliationStatus(){
  const box=document.getElementById("reconcileStatus");if(!box)return;
  const today=todayIso(), latest=latestReconciliation(today), current=actualBalanceAt(today);
  if(!latest){
    box.innerHTML=`<div class="reconcile-row"><div><strong>Saldo calculado, todavía no confirmado</strong><div class="muted">Se estima con los movimientos registrados. Si no coincide con tu dinero disponible, usá «Actualizar saldo real» para establecer una referencia sin generar otro ingreso o gasto.</div></div><span class="pill">Calculado hoy: ${money(current)}</span></div>`;
    return;
  }
  const latestCRC=reconciliationAmountCRC(latest),diff=latest.calculatedBefore===null?null:latestCRC-num(latest.calculatedBefore);
  const recent=[...(data.reconciliations||[])].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,3);
  box.innerHTML=`<div class="reconcile-row">
    <div><strong>Saldo confirmado en ${dateLabel(latest.date)}: ${money(latestCRC)}</strong><div class="muted">Saldo calculado hoy: ${money(current)} (incluye movimientos posteriores)${latest.note?` · ${safe(latest.note)}`:""}. Confirmar saldo no agrega un ingreso ni un gasto.</div></div>
    ${diff===null?"":`<div class="delta ${diff>=0?"positive":"negative"}">Corrección del saldo: ${diff>=0?"+":""}${money(diff)}</div>`}
  </div>
  <div class="table-wrap" style="margin-top:10px"><table style="min-width:650px"><thead><tr><th>Fecha</th><th>Saldo real</th><th>Ajuste</th><th>Nota</th><th></th></tr></thead><tbody>
  ${recent.map(r=>`<tr><td>${dateLabel(r.date)}</td><td class="num">${money(reconciliationAmountCRC(r))}${originalHint(r.amount,r.currency)}</td><td class="num">${r.calculatedBefore===null?"—":money(reconciliationAmountCRC(r)-num(r.calculatedBefore))}</td><td>${safe(r.note||"")}</td><td><button class="btn danger small" data-delete-reconcile="${safe(r.id)}">Eliminar</button></td></tr>`).join("")}
  </tbody></table></div>`;
}
function openReconcile(){
  const dialog=document.getElementById("reconcileDialog"), date=todayIso();
  document.getElementById("rDate").value=date;
  document.getElementById("rAmount").value="";
  document.getElementById("rCurrency").value=displayCurrency();
  document.getElementById("rNote").value="";
  updateReconcilePreview();
  dialog.showModal();
  setTimeout(()=>document.getElementById("rAmount").focus(),50);
}
function updateReconcilePreview(){
  const date=document.getElementById("rDate").value||todayIso();
  const calculated=actualBalanceAt(date),entered=document.getElementById("rAmount").value,currency=document.getElementById("rCurrency").value;
  document.getElementById("rCalculated").value=money(calculated);
  const enteredCRC=entered===""?null:currentToCRC(entered,currency,"receive"),diff=enteredCRC===null?null:enteredCRC-calculated;
  document.getElementById("rDifference").value=diff===null?"":money(diff);
  const note=document.getElementById("oneReconcileExplanation");
  if(note)note.textContent=diff===null?"Ingresá el saldo real para revisar cómo cambiaría el cálculo.":
    Math.abs(diff)<.005?"El saldo real coincide con el calculado. No se generará una diferencia.":
    "El saldo operativo calculado "+(diff>0?"aumentará":"disminuirá")+" en "+money(Math.abs(diff))+
    ". Es una conciliación, no un ingreso, gasto ni pago de deuda.";
}
function categoryTable(rows){
  return `<table><thead><tr><th>Categoría</th><th>Presupuesto</th><th>Real</th><th>Disponible</th><th>Uso</th></tr></thead><tbody>${
    rows.length?rows.map(r=>`<tr><td>${safe(r.category)}${r.includesSavings?`<small class="one-saving-category-label">Incluye transferencias a metas</small>`:""}</td><td class="num">${money(r.budget)}</td><td class="num">${money(r.actual)}</td><td class="num ${r.variance<0?"negative":"positive"}">${money(r.variance)}</td><td><div class="progress"><span style="width:${Math.min(100,r.used*100)}%"></span></div><small>${(r.used*100).toFixed(0)}%</small></td></tr>`).join(""):`<tr><td colspan="5" class="empty">No hay categorías presupuestadas ni egresos reales en este período.</td></tr>`
  }</tbody></table>`
}

function setPlanMonthOpen(section,open,persist=true){
  if(!section)return;
  const body=section.querySelector(".plan-month-body"),btn=section.querySelector(".plan-month-toggle");
  if(body)body.hidden=!open;
  section.classList.toggle("is-collapsed",!open);
  if(btn){btn.setAttribute("aria-expanded",String(open));btn.textContent=open?"Ocultar detalle":oneV15HasFlexiblePeriods()?"Ver períodos":"Ver quincenas"}
  if(persist)rememberPlanMonthOpen(section.dataset.planMonth,open);
}
function setAllPlanMonths(open){
  document.querySelectorAll("#planMonths .plan-month").forEach(section=>setPlanMonthOpen(section,open,true));
}


/* Mes -> mes: solo asignaciones presupuestarias, no dinero realmente registrado. */
function oneBudgetMonthPeriods(month,raw=data){
  return (raw.periods||[]).filter(p=>(p.budgetMonth||deriveBudgetMeta(p).budgetMonth)===month)
    .sort((a,b)=>Number(a.fortnight)-Number(b.fortnight));
}
function oneCanCopyBudgetMonth(month,raw=data){
  const prev=shiftMonthKey(month,-1);
  const source=oneBudgetMonthPeriods(prev,raw),target=oneBudgetMonthPeriods(month,raw);
  return !!month&&month>=currentFinancialContext().financialMonth&&source.length===2&&target.length===2&&
    new Set(source.map(p=>Number(p.fortnight))).size===2&&
    target.every(p=>source.some(s=>Number(s.fortnight)===Number(p.fortnight)));
}
function oneOpenCopyBudgetMonth(month){
  if(!oneCanCopyBudgetMonth(month))return alert("Necesitás dos quincenas configuradas en ambos meses y un mes de destino actual o futuro.");
  const from=shiftMonthKey(month,-1),source=oneBudgetMonthPeriods(from),target=oneBudgetMonthPeriods(month),dialog=document.getElementById("copyBudgetDialog");
  const eligible=(data.categories||[]).filter(c=>["Ingreso","Gasto","Pago deuda"].includes(c.type));
  const count=source.reduce((n,p)=>n+eligible.filter(c=>Math.abs(num(p.categoryBudgets?.[c.id]))>.005&&
    !(c.type==="Ingreso"&&p.categoryBudgetSources?.[c.id]==="auto")).length,0);
  const existing=target.some(p=>eligible.some(c=>Math.abs(num(p.categoryBudgets?.[c.id]))>.005));
  dialog.dataset.targetMonth=month;
  document.getElementById("copyBudgetContext").textContent=monthLabel(from)+" → "+monthLabel(month);
  document.getElementById("copyBudgetPreview").innerHTML=
    `<div><span>Quincenas</span><strong>2</strong></div><div><span>Importes manuales por copiar</span><strong>${count}</strong></div>
    <div><span>Presupuesto de destino</span><strong>${existing?"Reemplazará asignaciones":"Sin asignaciones"}</strong></div>`;
  dialog.showModal();
}
function oneApplyCopyBudgetMonth(month){
  if(!oneCanCopyBudgetMonth(month))return false;
  const source=oneBudgetMonthPeriods(shiftMonthKey(month,-1));
  const target=oneBudgetMonthPeriods(month);
  const cats=(data.categories||[]).filter(c=>["Ingreso","Gasto","Pago deuda"].includes(c.type));
  const staged=target.map(p=>{
    const src=source.find(r=>Number(r.fortnight)===Number(p.fortnight));
    const budgets={...(p.categoryBudgets||{})},currencies={...(p.categoryBudgetCurrencies||{})};
    const sources={...(p.categoryBudgetSources||{})},dates={...(p.categoryBudgetScheduledDates||{})};
    for(const c of cats){
      const cid=c.id;
      // Los ingresos automáticos (o ausentes) mantienen su configuración del mes destino.
      // Un período del mes actual podría haber cerrado y no se recalcula automáticamente.
      if(c.type==="Ingreso"&&(src.categoryBudgetSources?.[cid]==="auto"||
        !Object.prototype.hasOwnProperty.call(src.categoryBudgets||{},cid)))continue;
      if(Object.prototype.hasOwnProperty.call(src.categoryBudgets||{},cid)){
        budgets[cid]=num(src.categoryBudgets[cid]);
        currencies[cid]=normalizeCurrency(src.categoryBudgetCurrencies?.[cid]||"CRC");
      }else{delete budgets[cid];delete currencies[cid]}
      if(c.type==="Ingreso")sources[cid]="manual";
      else delete sources[cid];
      delete dates[cid];
    }
    return {p,budgets,currencies,sources,dates};
  });
  for(const row of staged){
    row.p.categoryBudgets=row.budgets;row.p.categoryBudgetCurrencies=row.currencies;
    row.p.categoryBudgetSources=row.sources;row.p.categoryBudgetScheduledDates=row.dates;
  }
  syncIncomeProjectionsForData(data);
  save();renderPlan();renderDashboard();
  return true;
}

// V15.7: reuse the existing collapsed detail style. Advice never changes a budget.
function oneV15IntelligenceHtml(rows,start,end,asOf,pace=true){
 try{
  const result=oneV15QueryCore.budgetIntelligence(rows,start,end,asOf,{pace});
  const names=new Map(rows.map(r=>[r.id,r.name]));
  const line=(label,amount)=>'<div class="r8-budget-row"><span class="r8-budget-row-label"><span>'+safe(label)+'</span></span><strong>'+safe(money(amount/100))+'</strong></div>';
  const group=(label,items,field)=>items.length?'<div class="r8-section"><div class="r8-section-heading"><span>'+label+'</span></div>'+items.map(r=>line(names.get(r.id)||r.id,r[field])).join("")+'</div>':"";
  const sections=group("Sin presupuesto",result.unbudgeted,"used")+group("Exceso del presupuesto",result.over,"excess")+group("Por encima del ritmo de referencia",result.ahead,"ahead");
  const pending=result.remaining===null?"":'<div class="r8-section"><div class="r8-section-heading"><span>Presupuesto pendiente de utilizar</span><strong>'+safe(money(result.remaining/100))+'</strong></div>'+line("Pagos de deuda presupuestados",result.remainingDebt)+line("Otros gastos y ahorro",result.remainingOther)+'</div>';
  if(!sections&&!result.remaining)return "";
  const notes=(result.ahead.length?'<div class="r8-card-dates">Ritmo lineal por días; no es un pronóstico ni un exceso del total.</div>':"")+(pending?'<div class="r8-card-dates">Importes presupuestados, no saldos bancarios ni vencimientos confirmados.</div>':"");
  return '<details class="r8-unused" data-v15-intelligence><summary>Revisar presupuesto</summary>'+sections+pending+notes+'</details>';
 }catch{return ""}
}
function oneV15PeriodIntelligence(p,asOf){
 const ms=periodMovements(p,asOf);
 const cats=(data.categories||[]).filter(c=>["Gasto","Pago deuda"].includes(c.type)&&c.budgetable!==false);
 const rows=cats.map(c=>{
  const savings=oneBudgetSavingsActual(p,c.id,asOf);
  const spent=ms.filter(m=>m.type===c.type).reduce((s,m)=>s+movementCategoryAmountCRC(m,c),0);
  return {id:c.id,name:c.name,type:c.type,plannedCRC:periodCategoryBudgetCRC(p,c.id,"pay"),spentCRC:spent,savingsCRC:savings,paceEligible:c.type==="Gasto"&&!savings&&oneSuggestedSavingsCategoryId()!==c.id&&!(data.reserves||[]).some(x=>oneGoalBudgetCategory(x)===c.id)};
 }).filter(r=>r.plannedCRC!==0||r.spentCRC!==0||r.savingsCRC!==0);
 return oneV15IntelligenceHtml(rows,p.date,periodEndDate(p),asOf);
}
function oneV15DateIntelligence(query,range,asOf){
 // An incomplete query must never infer that an unknown allocation is zero.
 if(query?.coverage!=="complete"||query.requiresReconciliation)return "";
 const movements=data.movements.filter(m=>m.date>=range.start&&m.date<=range.end&&m.date<=asOf);
 const contributions=(data.reserveMovements||[]).filter(t=>t.type==="Aporte"&&t.date>=range.start&&t.date<=range.end&&t.date<=asOf);
 const rows=(data.categories||[]).filter(c=>["Gasto","Pago deuda"].includes(c.type)&&c.budgetable!==false).map(c=>({
  id:c.id,name:c.name,type:c.type,plannedCRC:query.totals.filter(x=>x.categoryId===c.id).reduce((s,x)=>s+currentToCRC(x.minor/100,x.currency,"pay"),0),
  spentCRC:movements.filter(m=>m.type===c.type).reduce((s,m)=>s+movementCategoryAmountCRC(m,c),0),
  savingsCRC:contributions.filter(t=>oneContributionCategory(t)===c.id).reduce((s,t)=>s+reserveTxnHistoricalCRC(t,"pay"),0),paceEligible:false
 })).filter(r=>r.plannedCRC!==0||r.spentCRC!==0||r.savingsCRC!==0);
 return oneV15IntelligenceHtml(rows,range.start,range.end,asOf,false);
}
function r8BudgetLine(category,period){
  const key=periodKey(period),cid=category.id,currency=normalizeCurrency(period.categoryBudgetCurrencies?.[cid]||"CRC");
  const amount=num(period.categoryBudgets?.[cid]);
  const planned=periodCategoryBudgetCRC(period,cid,category.type==="Ingreso"?"receive":"pay");
  const spent=category.type==="Ingreso"?0:selectedMovements("fortnight",key)
    .filter(m=>m.type===category.type).reduce((sum,m)=>sum+movementCategoryAmountCRC(m,category),0)+oneBudgetSavingsActual(period,cid);
  const excess=category.type==="Ingreso"?0:spent-planned;
  const extraTitle=category.type==="Ingreso"&&period.categoryBudgetSources?.[cid]==="auto"?"Ingreso generado automáticamente":"Editar presupuesto de esta categoría";
  return `<div class="r8-budget-row">
    <span class="r8-budget-row-label" title="${safe(category.name)}"><span>${safe(category.name)}</span>
      ${oneBudgetSavingsActual(period,cid)>.005?`<small class="one-budget-savings">Ahorrado: ${money(oneBudgetSavingsActual(period,cid))}</small>`:""}
      ${excess>.005?`<small class="r8-over-budget">Superado por ${money(excess)} <button type="button" data-r8-edit-budget="${key}|${cid}" aria-label="Ajustar presupuesto de ${safe(category.name)}">Ajustar</button></small>`:""}
    </span>
    <span class="r8-edit-cell">
      <button type="button" class="r8-value-button" data-r8-edit-budget="${key}|${cid}" title="${safe(extraTitle)}">${originalMoney(amount,currency)}</button>
      <span class="r8-edit-controls" hidden>
        <input class="editable" type="number" min="0" step="0.01" data-category-budget="${key}|${cid}" value="${amount}" aria-label="Monto de ${safe(category.name)}">
        <select class="editable" data-category-budget-currency="${key}|${cid}" aria-label="Moneda de ${safe(category.name)}">
          <option value="CRC" ${currency==="CRC"?"selected":""}>CRC</option>
          <option value="USD" ${currency==="USD"?"selected":""}>USD</option>
        </select>
      </span>
    </span>
  </div>`;
}
function r8BudgetSection(types,heading,period){
  const cats=budgetCategories(types,period);
  const intent=types==="Ingreso"?"receive":"pay";
  const total=cats.reduce((sum,c)=>sum+periodCategoryBudgetCRC(period,c.id,intent),0);
  const periodMovements=selectedMovements("fortnight",periodKey(period));
  const main=cats.filter(c=>Math.abs(num(period.categoryBudgets?.[c.id]))>.0001||
    (c.type!=="Ingreso"&&(periodMovements.some(m=>m.type===c.type&&movementCategoryAmountCRC(m,c)>.005)||oneBudgetSavingsActual(period,c.id)>.005)));
  const empty=cats.filter(c=>!main.includes(c));
  return `<div class="r8-section">
    <div class="r8-section-heading"><span>${heading}</span><strong>${money(total)}</strong></div>
    ${main.length?main.map(c=>r8BudgetLine(c,period)).join(""):`<div class="r8-empty-row">Sin montos asignados por ahora.</div>`}
    ${empty.length?`<details class="r8-unused"><summary>Mostrar ${empty.length} ${empty.length===1?"categoría":"categorías"} sin monto</summary>${empty.map(c=>r8BudgetLine(c,period)).join("")}</details>`:""}
  </div>`;
}

// Date views are intentionally read-only; the original financial cards remain unchanged.
function oneV15DateRange(level){
  const pref=uiState.v15DateQuery||{},today=todayIso();
  if(level==="week")return oneV15QueryCore.calendarRange(restoreValidDate(pref.week)?pref.week:today,"week");
  if(restoreValidDate(pref.start)&&restoreValidDate(pref.end)&&pref.start<=pref.end)return {start:pref.start,end:pref.end};
  return {start:today,end:today};
}
function oneV15SaveDateRange(level,range){
  uiState.v15DateQuery={...(uiState.v15DateQuery||{}),...(level==="week"?{week:range.start}:{start:range.start,end:range.end})};
  saveUiState();
}
function oneV15SyncDateControls(level){
  const dateMode=["week","custom"].includes(level),custom=level==="custom";
  const controls=document.getElementById("v15PlanDateControls");
  controls.hidden=!custom;
  // Existing stylesheet gives display:flex to period-filter; honor hidden explicitly.
  controls.style.display=custom?"":"none";
  for(const id of ["newQuarterBtn","duplicateQuarterBtn","expandPlanBtn","collapsePlanBtn"])document.getElementById(id).disabled=dateMode;
  if(custom){
    const r=oneV15DateRange(level),a=document.getElementById("v15PlanStart"),b=document.getElementById("v15PlanEnd");
    a.value=r.start;b.value=r.end;a.max=r.end;b.min=r.start;a.setCustomValidity("");b.setCustomValidity("");
  }
}
function oneV15RenderDatePlan(level,r){
  const preference={level,quarter:document.getElementById("planQuarter").value,month:document.getElementById("planMonth").value,fortnight:document.getElementById("planFortnight").value};
  if(JSON.stringify(uiState.v15PlanSelection)!==JSON.stringify(preference)){uiState.v15PlanSelection=preference;saveUiState()}
  oneV15SyncDateControls(level);
  const rangeLabel=dateLabel(r.start)+" – "+dateLabel(r.end);
  document.getElementById("planTitle").textContent="Presupuesto";
  document.getElementById("r8PlanEyebrow").textContent="PLAN FINANCIERO";
  document.getElementById("planSub").textContent=rangeLabel;
  document.querySelectorAll("[data-r8-period-shift]").forEach(b=>b.disabled=level==="custom");
  const today=todayIso(),allRows=allAdaptiveProjectedRows(),live=allRows.find(p=>p.date<=today&&today<=periodEndDate(p));
  const operation=actualBalanceAt(today),obligations=live?remainingBudgetForCurrentPeriod(live,today):0,closing=live?live.ending:operation;
  const items=[["Saldo operativo hoy",money(operation),""],["Compromisos pendientes",money(obligations),""],["Cierre actual estimado",money(closing),closing<0?"negative":"positive"]];
  document.getElementById("planQuarterSummary").innerHTML=items.map(([label,amount,tone])=>'<div class="summary-box"><div class="summary-label">'+label+'</div><div class="summary-value '+tone+'">'+amount+'</div></div>').join("");
  document.getElementById("goalBudgetPreview").hidden=true;
  document.getElementById("planSummary").textContent="";
  document.getElementById("planClosing").innerHTML="";
  let result=null;
  try{result=oneV15QueryCore.queryBudget(data,{basis:"calendar",mode:level,anchor:r.start,end:r.end},p=>periodEndDate(p,data.periods,data.settings))}catch(error){console.warn("V15 date query unavailable",error)}
  const complete=result?.coverage==="complete";
  const within=t=>t.date>=r.start&&t.date<=r.end;
  const movements=data.movements.filter(within),contributions=(data.reserveMovements||[]).filter(t=>t.type==="Aporte"&&within(t));
  const rows=sortedCategories((data.categories||[]).filter(c=>["Ingreso","Gasto","Pago deuda"].includes(c.type))).map(c=>{
    const actual=movements.filter(m=>m.type===c.type).reduce((s,m)=>s+movementCategoryAmountCRC(m,c),0)+(c.type==="Gasto"?contributions.filter(t=>oneContributionCategory(t)===c.id).reduce((s,t)=>s+reserveTxnHistoricalCRC(t,"pay"),0):0);
    const planned=(result?.totals||result?.knownSubtotal||[]).filter(x=>x.categoryId===c.id);
    return {c,actual,planned};
  }).filter(x=>x.actual!==0||x.planned.some(p=>p.minor!==0));
  const section=(title,income)=>{
    const visible=rows.filter(x=>(x.c.type==="Ingreso")===income);
    return '<div class="r8-section"><div class="r8-section-heading"><span>'+title+'</span><strong>'+money(visible.reduce((s,x)=>s+x.actual,0))+'</strong></div>'+ (visible.length?visible.map(x=>{
      const amounts=x.planned.filter(p=>p.minor!==0).map(p=>originalMoney(p.minor/100,p.currency)).join(" + ");
      const exact=complete||result?.resolvedCategoryIds?.includes(x.c.id);
      const hasKnown=x.planned.length>0;
      const displayAmounts=amounts||(hasKnown?x.planned.map(p=>originalMoney(0,p.currency)).join(" + "):"");
      const label=exact?(displayAmounts?"Asignado: "+displayAmounts:"Sin asignación"):(displayAmounts?"Subtotal asignado: "+displayAmounts:"Sin asignación completa");
      return '<div class="r8-budget-row"><span class="r8-budget-row-label"><span>'+safe(x.c.name)+'</span><small class="muted">'+safe(label)+'</small></span><strong>'+safe(money(x.actual))+'</strong></div>';
    }).join(""):'<div class="r8-empty-row">Sin registros</div>')+'</div>';
  };
  const status=complete?"Presupuesto definido":result?"Presupuesto sin asignación completa":"Presupuesto pendiente de revisión";
  const note=((data.flexBudgets||[]).length||(data.livingBudgets||[]).length?" · Ajustes V13/V14 pendientes":"")+(result?.allocationReview?.length?" · Distribuciones en revisión":"");
  document.getElementById("planMonths").innerHTML='<section class="r8-month"><div class="r8-month-heading"><h2>'+safe(rangeLabel)+'</h2></div><div class="r8-fortnight-grid"><article class="r8-fortnight-card"><div class="r8-card-main"><div class="r8-fortnight-heading"><h3>Registrado</h3><span class="r8-chip">Solo lectura</span></div><div class="r8-card-dates">'+safe(status+note)+'</div>'+section("Ingresos registrados",true)+section("Gastos, deudas y ahorro registrados",false)+oneV15DateIntelligence(result,r,today)+'</div></article></div></section>';
}

// V15.4: native, collapsed breakdowns. No writes to the financial model.
function oneV15MonthCategoryTotals(month){
 let result;
 try{
  const grouped=data.periods.filter(p=>p.budgetMonth===month);
  if(grouped.some(oneV15IsFlexiblePeriod)){
   const sums=new Map();
   for(const p of grouped){
    const exact=oneV15QueryCore.queryBudget(data,{basis:"financial",mode:"period",key:periodKey(p)},x=>periodEndDate(x,data.periods,data.settings));
    for(const a of exact.totals||[]){const k=JSON.stringify([a.categoryId,a.currency]),minor=(sums.get(k)?.minor||0)+a.minor;if(!Number.isSafeInteger(minor))throw Error("Monto fuera de rango");sums.set(k,{...a,minor})}
   }
   result={coverage:"grouped",knownSubtotal:[...sums.values()]};
  }else result=oneV15QueryCore.queryBudget(data,{basis:"financial",mode:"month",month},p=>periodEndDate(p,data.periods,data.settings));
 }
 catch{return '<details class="r8-unused"><summary>Totales por categoría</summary><div class="r8-empty-row">Presupuesto pendiente de revisión</div></details>'}
 const values=result.totals||result.knownSubtotal;
 const sections=[["Ingresos",["Ingreso"]],["Gastos, deudas y ahorro",["Gasto","Pago deuda"]]].map(([label,types])=>{
  const rows=sortedCategories((data.categories||[]).filter(c=>types.includes(c.type)&&c.budgetable!==false)).map(c=>{
   const amounts=values.filter(x=>x.categoryId===c.id&&x.minor!==0).map(x=>originalMoney(x.minor/100,x.currency));
   return amounts.length?'<div class="r8-budget-row"><span class="r8-budget-row-label"><span>'+safe(c.name)+'</span></span><strong>'+safe(amounts.join(" + "))+'</strong></div>':"";
  }).filter(Boolean);
  return '<div class="r8-section"><div class="r8-section-heading"><span>'+label+'</span></div>'+(rows.join("")||'<div class="r8-empty-row">Sin asignaciones</div>')+'</div>';
 }).join("");
 const status=result.coverage==="complete"?"":result.coverage==="grouped"?"<div class=\"r8-card-dates\">Períodos agrupados por mes de referencia</div>":"<div class=\"r8-card-dates\">Subtotal disponible · mes incompleto</div>";
 return '<details class="r8-unused" data-v15-month-totals="'+safe(month)+'"><summary>Totales por categoría</summary>'+status+sections+'</details>';
}
function oneV15WeekEvents(p){
 const key=periodKey(p),categories=budgetCategories(["Ingreso","Gasto","Pago deuda"],p),events=[];
 // Use the exact legacy period assignment and category/split calculation.
 for(const m of periodMovements(p))for(const c of categories){
  if(m.type!==c.type)continue;
  const amountCRC=movementCategoryAmountCRC(m,c);
  if(amountCRC)events.push({date:m.date,categoryId:c.id,type:c.type,amountCRC});
 }
 // Same linked contribution rule as oneBudgetSavingsActual; never add a second movement.
 for(const t of data.reserveMovements||[]){
  if(t.type!=="Aporte"||periodKey(periodForDate(t.date)||{})!==key)continue;
  const c=categories.find(c=>c.type!=="Ingreso"&&c.id===oneContributionCategory(t));
  if(c){const amountCRC=reserveTxnHistoricalCRC(t,"pay");if(amountCRC)events.push({date:t.date,categoryId:c.id,type:c.type,amountCRC});}
 }
 return events;
}
// V15.5: weekly allocations annotate canonical category budgets; they are not independent expenses.
let oneV15AllocationDraft=null;
function oneV15AllocationParent(p,c){
 if(!p||!c||c.active===false||c.budgetable===false||c.type!=="Gasto")throw Error("Categoría no disponible");
 const amount=p.categoryBudgets?.[c.id]??0,currency=p.categoryBudgetCurrencies?.[c.id]||"CRC";
 return {start:p.date,end:periodEndDate(p),amount,currency};
}
function oneV15AllocationRecord(p,c){
 const rows=data.v15WeeklyAllocations;
 if(rows===undefined)return null;
 if(!Array.isArray(rows))throw Error("Asignaciones pendientes de revisión");
 const matches=rows.filter(x=>x?.periodKey===periodKey(p)&&x.categoryId===c.id);
 if(matches.length>1)throw Error("Asignaciones duplicadas");
 return matches[0]||null;
}
function oneV15AllocationRows(p,w,index){
 const list=[];
 for(const c of budgetCategories("Gasto",p)){
  try{
   const rec=oneV15AllocationRecord(p,c);if(!rec)continue;
   const state=oneV15QueryCore.allocationState(oneV15AllocationParent(p,c),rec);
   if(state.stale)continue;
   list.push('<div class="r8-budget-row"><span class="r8-budget-row-label"><span>'+safe(c.name)+'</span></span><strong>'+safe(originalMoney(state.amounts[index]/100,rec.currency))+'</strong></div>');
  }catch{}
 }
 return list.length?'<div class="r8-section"><div class="r8-section-heading"><span>Presupuesto asignado</span></div>'+list.join("")+'</div>':"";
}
function oneV15OpenAllocation(key){
 const p=periodByKey(key),dialog=document.getElementById("v15AllocationDialog");if(!p)return;
 const cats=budgetCategories("Gasto",p).filter(c=>c.active!==false&&c.budgetable!==false);
 if(!cats.length)return alert("No hay categorías de gasto disponibles.");
 oneV15AllocationDraft={key,ledger:JSON.stringify(data)};
 document.getElementById("v15AllocationCategory").replaceChildren(...cats.map(c=>{const o=document.createElement("option");o.value=c.id;o.textContent=c.name;return o}));
 oneV15ResetAllocationFields();dialog.showModal();
}
function oneV15ResetAllocationFields(){
 const d=oneV15AllocationDraft;if(!d)return;
 const p=periodByKey(d.key),c=categoryById(document.getElementById("v15AllocationCategory").value);
 const week=document.getElementById("v15AllocationWeek"),amount=document.getElementById("v15AllocationAmount");
 const undo=document.getElementById("v15AllocationUndo"),review=document.getElementById("v15AllocationReview");
 d.reviewCategory=null;d.preview=null;review.hidden=true;
 try{
  const parent=oneV15AllocationParent(p,c),rec=oneV15AllocationRecord(p,c),state=oneV15QueryCore.allocationState(parent,rec);
  if(state.stale){
   review.hidden=false;week.replaceChildren();amount.value="";
   throw Error("El presupuesto original cambió. Revisá la distribución para conservar el monto vigente.");
  }
  week.replaceChildren(...state.weeks.map((w,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=dateLabel(w.start)+" – "+dateLabel(w.end);return o}));
  document.getElementById("v15AllocationCurrency").textContent=parent.currency;
  const initial=oneV15QueryCore.allocationPreview(parent,rec,0,(state.amounts?.[0]??Math.ceil(state.total/state.weeks.length))/100,"maintain");
  amount.value=String(initial.base[0]/100);document.getElementById("v15AllocationMode").value="maintain";
  undo.hidden=!rec?.undo;oneV15PreviewAllocation();
 }catch(error){
  document.getElementById("v15AllocationPreview").textContent=error.message;document.getElementById("v15AllocationConfirm").disabled=true;undo.hidden=true;d.preview=null;
 }
}
function oneV15PreviewAllocation(){
 const d=oneV15AllocationDraft;if(!d)return;
 const slot=document.getElementById("v15AllocationPreview"),confirmBtn=document.getElementById("v15AllocationConfirm");
 d.preview=null;confirmBtn.disabled=true;
 try{
  const p=periodByKey(d.key),c=categoryById(document.getElementById("v15AllocationCategory").value);
  const parent=oneV15AllocationParent(p,c),rec=oneV15AllocationRecord(p,c),field=document.getElementById("v15AllocationAmount");
  const stale=oneV15QueryCore.allocationState(parent,rec).stale;
  if(stale&&d.reviewCategory!==c.id)throw Error("Revisá la distribución anterior antes de continuar.");
  if(field.value===""||!field.validity.valid)throw Error("Ingresá un monto válido.");
  const mode=document.getElementById("v15AllocationMode").value;
  if(stale&&mode!=="maintain")throw Error("Primero conservá el presupuesto vigente.");
  const preview=oneV15QueryCore.allocationPreview(parent,stale?null:rec,Number(document.getElementById("v15AllocationWeek").value),Number(field.value),mode);
  d.preview={categoryId:c.id,...preview};
  slot.innerHTML=preview.weeks.map((w,i)=>'<div class="r8-budget-row"><span>'+safe(dateLabel(w.start)+" – "+dateLabel(w.end))+'</span><strong>'+safe(originalMoney(preview.next[i]/100,preview.currency))+'</strong></div>').join("")+'<div class="r8-section"><div class="r8-section-heading"><span>Total anterior</span><strong>'+safe(originalMoney(preview.oldTotal/100,preview.currency))+'</strong></div><div class="r8-section-heading"><span>Nuevo total</span><strong>'+safe(originalMoney(preview.total/100,preview.currency))+'</strong></div></div>';
  confirmBtn.disabled=false;
 }catch(error){slot.textContent=error.message}
}
function oneV15PersistAllocation(undo=false){
 const d=oneV15AllocationDraft;if(!d)return false;
 try{
  if(JSON.stringify(data)!==d.ledger)throw Error("Los datos cambiaron. Cerrá y volvé a abrir la distribución.");
  oneStorageAssertCurrent();
  const cid=document.getElementById("v15AllocationCategory").value,p=periodByKey(d.key),c=categoryById(cid),parent=oneV15AllocationParent(p,c),rec=oneV15AllocationRecord(p,c);
  const state=oneV15QueryCore.allocationState(parent,rec);
  if(state.stale&&(undo||d.reviewCategory!==cid))throw Error("El presupuesto original cambió.");
  const staged=clone(data),target=staged.periods.find(x=>periodKey(x)===d.key);
  const rows=Array.isArray(staged.v15WeeklyAllocations)?staged.v15WeeklyAllocations:[];
  staged.v15WeeklyAllocations=rows.filter(x=>!(x.periodKey===d.key&&x.categoryId===cid));
  if(undo){
   if(!rec?.undo||typeof rec.undo.hadAmount!=="boolean")throw Error("No hay una distribución válida para revertir.");
   const amount=rec.undo.amount;
   if(!Number.isFinite(amount)||amount<0||!Number.isSafeInteger(Math.round(amount*100))||Math.abs(amount*100-Math.round(amount*100))>1e-5||(!rec.undo.hadAmount&&amount!==0))throw Error("El respaldo de distribución requiere revisión.");
   if(rec.undo.previous&&(rec.undo.previous.periodKey!==d.key||rec.undo.previous.categoryId!==cid))throw Error("El respaldo de distribución no corresponde a esta categoría.");
   if(rec.undo.hadAmount)target.categoryBudgets[cid]=amount;else delete target.categoryBudgets[cid];
   if(rec.undo.previous)staged.v15WeeklyAllocations.push(rec.undo.previous);
  }else{
   oneV15PreviewAllocation();const v=d.preview;if(!v||v.categoryId!==cid)throw Error("Revisá la vista previa.");
   const previous=rec?{...rec}:null;if(previous)delete previous.undo;
   staged.v15WeeklyAllocations.push({periodKey:d.key,categoryId:cid,start:v.start,end:v.end,currency:v.currency,parentMinor:v.total,amounts:v.next,createdAt:new Date().toISOString(),undo:{hadAmount:Object.prototype.hasOwnProperty.call(p.categoryBudgets||{},cid),amount:parent.amount,previous}});
   if(v.total!==v.oldTotal)target.categoryBudgets[cid]=v.total/100;
  }
  // Commit all changes in one checked write; never mutate live state on a failed save.
  oneStoragePersist(JSON.stringify(staged));data=staged;
  document.getElementById("v15AllocationDialog").close();oneV15AllocationDraft=null;
  renderPlan();renderDashboard();renderReports();
  const detail=[...document.querySelectorAll("[data-v15-week-detail]")].find(x=>x.dataset.v15WeekDetail===d.key);if(detail)detail.open=true;
  return true;
 }catch(error){document.getElementById("v15AllocationPreview").textContent=error.message;return false}
}
function oneV15BindAllocation(){
 const dialog=document.getElementById("v15AllocationDialog");
 document.getElementById("v15AllocationCancel").addEventListener("click",()=>dialog.close());
 document.getElementById("v15AllocationCategory").addEventListener("change",oneV15ResetAllocationFields);
 document.getElementById("v15AllocationReview").addEventListener("click",()=>{
  const d=oneV15AllocationDraft,p=d&&periodByKey(d.key),c=categoryById(document.getElementById("v15AllocationCategory").value);
  try{
   if(!d||JSON.stringify(data)!==d.ledger)throw Error("Los datos cambiaron. Volvé a abrir la distribución.");
   const parent=oneV15AllocationParent(p,c),rec=oneV15AllocationRecord(p,c),state=oneV15QueryCore.allocationState(parent,rec);
   if(!state.stale)return;
   d.reviewCategory=c.id;
   const week=document.getElementById("v15AllocationWeek");
   week.replaceChildren(...state.weeks.map((w,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=dateLabel(w.start)+" – "+dateLabel(w.end);return o}));
   document.getElementById("v15AllocationCurrency").textContent=parent.currency;
   document.getElementById("v15AllocationAmount").value=String(Math.ceil(state.total/state.weeks.length)/100);
   document.getElementById("v15AllocationMode").value="maintain";
   document.getElementById("v15AllocationReview").hidden=true;
   oneV15PreviewAllocation();
  }catch(error){document.getElementById("v15AllocationPreview").textContent=error.message;}
 });
 document.getElementById("v15AllocationWeek").addEventListener("change",()=>{
  const d=oneV15AllocationDraft,p=d&&periodByKey(d.key),c=categoryById(document.getElementById("v15AllocationCategory").value);
  try{
   const parent=oneV15AllocationParent(p,c),rec=oneV15AllocationRecord(p,c),state=oneV15QueryCore.allocationState(parent,rec),base=state.amounts||oneV15QueryCore.allocationPreview(parent,state.stale&&d.reviewCategory===c.id?null:rec,0,Math.ceil(state.total/state.weeks.length)/100,"maintain").base;
   document.getElementById("v15AllocationAmount").value=String(base[Number(document.getElementById("v15AllocationWeek").value)]/100);
  }catch{}
  oneV15PreviewAllocation();
 });
 for(const id of ["v15AllocationAmount","v15AllocationMode"])document.getElementById(id).addEventListener("input",oneV15PreviewAllocation);
 document.getElementById("v15AllocationForm").addEventListener("submit",e=>{e.preventDefault();oneV15PersistAllocation(false)});
 document.getElementById("v15AllocationUndo").addEventListener("click",()=>{if(confirm("¿Revertir la última distribución y restaurar su presupuesto anterior?"))oneV15PersistAllocation(true)});
}

function oneV15WeekDetail(p){
 const key=periodKey(p);let breakdown;
 try{breakdown=oneV15QueryCore.weeklyBreakdown(p.date,periodEndDate(p),oneV15WeekEvents(p))}
 catch{return '<div class="r8-empty-row">Desglose pendiente de revisión</div>'}
 const renderEvents=events=>{
  const grouped=new Map();
  for(const e of events){const id=e.categoryId;grouped.set(id,(grouped.get(id)||0)+e.amountCRC);}
  return sortedCategories((data.categories||[]).filter(c=>grouped.has(c.id))).map(c=>'<div class="r8-budget-row"><span class="r8-budget-row-label"><span>'+safe(c.name)+'</span></span><strong>'+safe(money(grouped.get(c.id)))+'</strong></div>').join("")||'<div class="r8-empty-row">Sin registros</div>';
 };
 const sections=breakdown.weeks.map((w,index)=>{
  const label=dateLabel(w.start)+" – "+dateLabel(w.end);
  const income=w.events.filter(e=>e.type==="Ingreso").reduce((s,e)=>s+e.amountCRC,0);
  const out=w.events.filter(e=>e.type!=="Ingreso").reduce((s,e)=>s+e.amountCRC,0);
  return '<details class="r8-unused" data-v15-week-start="'+safe(w.start)+'" data-v15-week-end="'+safe(w.end)+'"><summary>'+safe(label)+'</summary><div class="r8-section"><div class="r8-section-heading"><span>Ingresos registrados</span><strong>'+safe(money(income))+'</strong></div><div class="r8-section-heading"><span>Egresos registrados</span><strong>'+safe(money(out))+'</strong></div>'+renderEvents(w.events)+'</div>'+oneV15AllocationRows(p,w,index)+'</details>';
 }).join("");
 const outside=breakdown.outside.length?'<details class="r8-unused" data-v15-week-outside><summary>Registros fuera de fecha asignados a esta quincena</summary>'+renderEvents(breakdown.outside)+'</details>':"";
 const records=Array.isArray(data.v15WeeklyAllocations)?data.v15WeeklyAllocations.filter(x=>x?.periodKey===key):[];
 const review=records.some(rec=>{try{return oneV15QueryCore.allocationState(oneV15AllocationParent(p,categoryById(rec.categoryId)),rec).stale}catch{return true}});
 const label=review?"Actividad registrada · distribuciones en revisión":records.length?"Actividad registrada · asignaciones semanales":"Actividad registrada · presupuesto sin distribución semanal";
 return '<details class="r8-unused" data-v15-week-detail="'+safe(key)+'"><summary>Semanas</summary><div class="r8-card-dates">'+label+'</div>'+sections+outside+'<button type="button" class="btn secondary small" data-v15-allocate="'+safe(key)+'">Distribuir presupuesto</button></details>';
}

function renderPlan(){
  const {level,value}=hierarchicalSelection("plan");
  if(["week","custom"].includes(level)){oneV15RenderDatePlan(level,value);return}
  oneV15SyncDateControls(level);
  const allRows=allAdaptiveProjectedRows(),staticRows=allProjectedRows();
  const rows=allRows.filter(r=>oneV15PlanMatches(r,level,value));
  const months=[...new Set(rows.map(r=>r.budgetMonth))];
  const today=todayIso();
  const live=allRows.find(p=>p.date<=today&&today<=periodEndDate(p));
  const operation=actualBalanceAt(today);
  const obligations=live?remainingBudgetForCurrentPeriod(live,today):0;
  const closing=live?live.ending:operation;
  const firstOpening=rows[0]?.openingCalc||0;
  const income=rows.reduce((sum,r)=>sum+num(r.incomeCRC)+num(r.otherIncomeCRC),0);
  const expenses=rows.reduce((sum,r)=>sum+num(r.expenses),0);
  const finalClosing=rows.at(-1)?.ending??firstOpening;
  const oldRows=staticRows.filter(r=>oneV15PlanMatches(r,level,value));
  const staticClosing=oldRows.at(-1)?.ending??firstOpening;
  const rawTitle=level==="month"?monthLabel(value):level==="fortnight"&&rows[0]?fortnightLabel(rows[0]):selectedLabel(level,value);
  const title=rawTitle?rawTitle[0].toUpperCase()+rawTitle.slice(1):"Presupuesto";
  document.getElementById("planTitle").textContent=title;
  document.getElementById("r8PlanEyebrow").textContent=`PLAN FINANCIERO · ${(rows[0]?.planningQuarter||"").replace("-"," ")}`;
  document.getElementById("planSub").textContent="Planificación y control por períodos financieros.";
  document.getElementById("planClosingTitle").textContent="Cierre proyectado del periodo";
  const extended=level==="half"||level==="year";
  const possible=extended?oneV15PlanGroups(level):level==="quarter"?planningQuarters():level==="month"?availableBudgetMonths():[...data.periods].sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(p=>periodKey(p));
  const selector=document.getElementById("planLevel");
  const preference={level,quarter:document.getElementById("planQuarter").value,month:document.getElementById("planMonth").value,fortnight:document.getElementById("planFortnight").value};
  if(selector&&JSON.stringify(uiState.v15PlanSelection)!==JSON.stringify(preference)){uiState.v15PlanSelection=preference;saveUiState()}
  const pos=possible.indexOf(value);
  document.querySelectorAll("[data-r8-period-shift]").forEach(b=>{
    b.disabled=pos<0||pos+Number(b.dataset.r8PeriodShift)<0||pos+Number(b.dataset.r8PeriodShift)>=possible.length;
  });
  const items=[
    ["Saldo operativo hoy",money(operation),""],
    ["Compromisos pendientes",money(obligations),""],
    ["Cierre actual estimado",money(closing),closing<0?"negative":"positive"]
  ];
  document.getElementById("planQuarterSummary").innerHTML=items.map(([label,amount,tone])=>
    `<div class="summary-box"><div class="summary-label">${label}</div><div class="summary-value ${tone}">${amount}</div></div>`
  ).join("");
  document.getElementById("planMonths").innerHTML=months.length?months.map((month)=>{
    const monthRows=rows.filter(r=>r.budgetMonth===month).sort((a,b)=>a.date.localeCompare(b.date));
    const monthIncome=monthRows.reduce((sum,r)=>sum+num(r.incomeCRC)+num(r.otherIncomeCRC),0);
    const monthExpenses=monthRows.reduce((sum,r)=>sum+num(r.expenses),0);
    const flow=monthIncome-monthExpenses;
    const cards=monthRows.map(r=>{
      const key=periodKey(r);
      const end=periodEndDate(r);
      const current=r.date<=today&&today<=end;
      const past=end<today;
      const status=current?"Actual":past?"Cerrada":"Próxima";
      const statusClass=current?" current":"";
      const tone=r.ending<0?"negative":current?"positive":"";
      const first=getQuarterPeriods(r.planningQuarter)[0];
      const canEditOpening=first&&periodKey(first)===key;
      const openingEdit=canEditOpening
        ? `<div class="money-input"><input class="editable" type="number" step="0.01" data-plan="${key}|opening" value="${num(r.opening)}"><select class="editable" data-plan-currency="${key}|openingCurrency"><option value="CRC" ${normalizeCurrency(r.openingCurrency)==="CRC"?"selected":""}>CRC</option><option value="USD" ${normalizeCurrency(r.openingCurrency)==="USD"?"selected":""}>USD</option></select></div>`
        : `<strong>${money(r.openingCalc)}</strong>`;
      const open=!!uiState.r8Details?.[key];
      const incomeState=budgetCategories("Ingreso",r).filter(c=>Math.abs(num(r.categoryBudgets?.[c.id]))>.0001).map(c=>
        `<div class="r8-detail-income"><span>${safe(c.name)}</span>${incomeBudgetStatusHtml(c,r)}</div>`
      ).join("");
      return `<article class="r8-fortnight-card ${current?"current":""}">
        <div class="r8-card-main">
          <div class="r8-fortnight-heading"><h3>${safe(oneV15PeriodCaption(r))}</h3><span class="r8-chip${statusClass}">${status}</span></div>
          <div class="r8-card-dates">${dateLabel(r.date)} → ${dateLabel(oneV15IsFlexiblePeriod(r)?end:oneShiftDate(end,1))}</div>
          <div class="r8-card-closing-label">Cierre proyectado</div>
          <div class="r8-card-closing ${tone}">${money(r.ending)}</div>
          ${r8BudgetSection("Ingreso","Ingresos",r)}
          ${r8BudgetSection(["Gasto","Pago deuda"],"Gastos, deudas y ahorro",r)}
          ${oneV15PeriodIntelligence(r,today)}
          ${oneV15IsFlexiblePeriod(r)&&r.frequency==="weekly"?"":oneV15WeekDetail(r)}
        </div>
        <div class="r8-card-footer">
          <button type="button" data-r8-add-category="${key}" title="Crear una categoría presupuestable">+ Agregar categoría</button>
          <button type="button" data-r8-card-details="${key}" aria-expanded="${String(open)}">Detalles ${open?"−":"···"}</button>
        </div>
        <div class="r8-card-details" data-r8-technical="${key}" ${open?"":"hidden"}>
          <div class="r8-detail-grid">
            <div class="r8-detail-item"><label>Fecha de referencia</label><input class="editable" type="date" data-plan="${key}|date" value="${r.date}" ${oneV15IsFlexiblePeriod(r)?"disabled":""}></div>
            <div class="r8-detail-item"><label>Saldo base utilizado</label>${openingEdit}</div>
            <div class="r8-detail-item"><label>Ingresos presupuestados</label><strong>${money(num(r.incomeCRC)+num(r.otherIncomeCRC))}</strong></div>
            <div class="r8-detail-item"><label>Disponible antes de compromisos</label><strong>${money(r.available)}</strong></div>
            <div class="r8-detail-item"><label>Origen de proyección</label><strong>${safe(r.projectionSource)}</strong></div>
            <div class="r8-detail-item"><label>Gastos presupuestados</label><strong>${money(r.expenses)}</strong></div>
            ${incomeState?`<div class="r8-detail-sources"><strong>Planificación de ingresos</strong>${incomeState}</div>`:""}
          </div>
        </div>
      </article>`;
    }).join("");
    return `<section class="r8-month plan-month" data-plan-month="${month}">
      <div class="r8-month-heading">
        <h2>${monthLabel(month)}</h2>
        <div class="r8-month-actions">
          <span class="r8-month-flow">Flujo previsto: <strong class="${flow<0?"negative":""}">${flow>=0?"+":""}${money(flow)}</strong></span>
          ${oneCanCopyBudgetMonth(month)?`<button type="button" class="r8-month-copy" data-copy-budget-month="${month}" title="Copiar la planificación del mes anterior">Copiar mes anterior</button>`:""}
          <button class="r8-month-toggle plan-month-toggle" type="button" data-toggle-plan-month="${month}" aria-expanded="true">Ocultar detalle</button>
        </div>
      </div>
      <div class="plan-month-body">${level==="fortnight"?"":oneV15MonthCategoryTotals(month)}<div class="r8-fortnight-grid">${cards}</div></div>
    </section>`;
  }).join(""):`<div class="r8-plan-empty">Todavía no hay quincenas configuradas para este período.</div>`;
  const firstV8Open=!uiState.r8BudgetInitialized;
  if(firstV8Open){uiState.r8BudgetInitialized=true;saveUiState()}
  document.querySelectorAll("#planMonths .plan-month").forEach(section=>{
    setPlanMonthOpen(section,firstV8Open?true:planMonthOpenPreference(section.dataset.planMonth),false);
  });
  document.getElementById("planSummary").textContent=`Cierre ${money(finalClosing)}, variación vs. plan original ${money(finalClosing-staticClosing)}.`;
  oneRenderGoalBudgetPreview(level,value);
  document.getElementById("planClosing").innerHTML=`<div class="month-kpi"><div class="summary-label">Saldo inicial</div><div class="summary-value">${money(firstOpening)}</div></div>
    <div class="month-kpi"><div class="summary-label">Ingresos</div><div class="summary-value">${money(income)}</div></div>
    <div class="month-kpi"><div class="summary-label">Egresos</div><div class="summary-value">${money(expenses)}</div></div>
    <div class="month-kpi"><div class="summary-label">Saldo final</div><div class="summary-value">${money(finalClosing)}</div></div>`;
}

function initR8(){
  const copyDialog=document.getElementById("copyBudgetDialog");
  document.getElementById("closeCopyBudgetDialog")?.addEventListener("click",()=>copyDialog.close());
  document.getElementById("cancelCopyBudget")?.addEventListener("click",()=>copyDialog.close());
  document.getElementById("copyBudgetForm")?.addEventListener("submit",e=>{
    e.preventDefault();
    if(oneApplyCopyBudgetMonth(copyDialog?.dataset.targetMonth||""))copyDialog.close();
  });
  updateMovementFields();
  oneV15BindAllocation();
  const start=document.getElementById("v15PlanStart"),end=document.getElementById("v15PlanEnd");
  for(const field of [start,end])field.addEventListener("change",()=>{
    start.setCustomValidity("");end.setCustomValidity("");
    if(!restoreValidDate(start.value)||!restoreValidDate(end.value)||end.value<start.value){
      field.setCustomValidity("Elegí fechas válidas y en orden.");field.reportValidity();return;
    }
    oneV15SaveDateRange("custom",{start:start.value,end:end.value});renderPlan();
  });
  document.querySelectorAll("[data-r8-period-shift]").forEach(b=>b.addEventListener("click",()=>{
    const shift=Number(b.dataset.r8PeriodShift)||0;
    const {level,value}=hierarchicalSelection("plan");
    if(level==="week"){
      const r=oneV15DateRange("week");oneV15SaveDateRange("week",{start:oneShiftDate(r.start,shift*7)});renderPlan();return;
    }
    if(level==="custom")return;
    if(level==="half"||level==="year"){
      const groups=oneV15PlanGroups(level),target=groups[groups.indexOf(value)+shift];
      const month=target&&availableBudgetMonths().find(m=>oneV15FinancialGroup(m,level)===target);
      if(month){document.getElementById("planMonth").value=month;document.getElementById("planQuarter").value=budgetQuarterFromMonth(month);syncHierarchicalFilter("plan",false)}
    }else if(level==="quarter"){
      const qs=planningQuarters(),i=qs.indexOf(value),target=qs[i+shift];
      if(target)document.getElementById("planQuarter").value=target;
    }else if(level==="month"){
      const ms=availableBudgetMonths(),i=ms.indexOf(value),target=ms[i+shift];
      if(target){
        document.getElementById("planMonth").value=target;
        const quarter=budgetQuarterFromMonth(target);
        document.getElementById("planQuarter").value=quarter;
      }
    }else{
      const ps=[...data.periods].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      const i=ps.findIndex(p=>periodKey(p)===value),p=ps[i+shift];
      if(p){
        document.getElementById("planMonth").value=p.budgetMonth;
        syncHierarchicalFilter("plan");
        document.getElementById("planFortnight").value=oneV15PeriodOption(p);
      }
    }
    renderPlan();
  }));
  document.getElementById("planMonths")?.addEventListener("click",(event)=>{
    const allocation=event.target.closest("[data-v15-allocate]");if(allocation){oneV15OpenAllocation(allocation.dataset.v15Allocate);return}
    const copy=event.target.closest("[data-copy-budget-month]");
    if(copy){oneOpenCopyBudgetMonth(copy.dataset.copyBudgetMonth);return}
    const edit=event.target.closest("[data-r8-edit-budget]");
    if(edit){
      const cell=edit.closest(".r8-budget-row")?.querySelector(".r8-edit-cell"),controls=cell?.querySelector(".r8-edit-controls");
      if(!controls)return;
      const valueButton=cell.querySelector(".r8-value-button");
      if(valueButton)valueButton.hidden=true;
      if(edit!==valueButton)edit.hidden=true;
      controls.hidden=false;
      const input=controls.querySelector("input");input?.focus();input?.select();
      return;
    }
    const detail=event.target.closest("[data-r8-card-details]");
    if(detail){
      const key=detail.dataset.r8CardDetails;
      const target=[...document.querySelectorAll("[data-r8-technical]")].find(x=>x.dataset.r8Technical===key);
      if(!target)return;
      const next=target.hidden;
      target.hidden=!next;detail.setAttribute("aria-expanded",String(next));
      detail.textContent=next?"Detalles −":"Detalles ···";
      uiState.r8Details=uiState.r8Details||{};
      uiState.r8Details[key]=next;saveUiState();
      return;
    }
    const add=event.target.closest("[data-r8-add-category]");
    if(add){openCategory();}
  });
  document.getElementById("planMonths")?.addEventListener("keydown",(event)=>{
    if(!event.target.matches(".r8-edit-controls input"))return;
    if(event.key==="Enter"){
      event.preventDefault();
      if(event.target.value!==event.target.defaultValue)
        event.target.dispatchEvent(new Event("change",{bubbles:true}));
      else renderPlan();
    }
    if(event.key==="Escape"){
      event.preventDefault();
      event.target.value=event.target.defaultValue;
      renderPlan();
    }
  });
}

function renderMovements(){
  const level=document.getElementById("movementLevel").value;
  const value=document.getElementById("movementPeriod").value;
  const type=document.getElementById("movementTypeFilter").value;
  const rows=selectedMovements(level,value).filter(m=>!type||m.type===type).sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById("movementCount").textContent=`${rows.length} movimientos`;
  document.getElementById("movementTable").innerHTML=`<thead><tr><th>Fecha</th><th>Mes presupuestario</th><th>Quincena</th><th>Tipo</th><th>Categoría</th><th>Deuda</th><th>Cuenta</th><th>Descripción</th><th>Monto</th><th></th></tr></thead><tbody>${
    rows.length?rows.map(m=>{const p=movementPeriod(m);return `<tr><td>${dateLabel(m.date)}</td><td>${p?monthLabel(p.budgetMonth):""}</td><td class="center">${p?(oneV15IsFlexiblePeriod(p)?safe(oneV15PeriodCaption(p)):p.fortnight===1?"1.ª":"2.ª"):""}</td><td><span class="pill">${m.type}</span></td><td>${safe(movementCategoryName(m))}</td><td>${safe(movementDebtName(m))}</td><td>${safe(m.account||"")}</td><td>${safe(m.description||"")}</td><td class="num">${money(movementAmountCRC(m))}${originalHint(m.amount,m.currency)}</td><td><button class="btn danger small" data-delete-movement="${safe(m.id)}">Eliminar</button></td></tr>`}).join(""):`<tr><td colspan="10" class="empty">Aún no hay movimientos en este periodo.</td></tr>`
  }</tbody>`;
}
function renderDebts(){
  const filter=document.getElementById("debtStatusFilter")?.value||"active";
  const active=activeDebts(), archived=data.debts.filter(d=>debtStatus(d)==="archived");
  const rows=data.debts.filter(d=>filter==="all"||debtStatus(d)===filter).sort((a,b)=>{
    if(debtStatus(a)!==debtStatus(b))return debtStatus(a)==="active"?-1:1;
    return num(a.priority)-num(b.priority);
  });
  const total=activeDebtTotal(), minimum=activeDebtMinimumTotal();
  document.getElementById("debtTotal").textContent=`Activas: ${active.length} · saldo estimado ${money(total)} · mínimos ${money(minimum)} · archivadas ${archived.length}`;
  document.getElementById("debtTable").innerHTML=`<thead><tr><th>Estado</th><th>Prioridad</th><th>Deuda</th><th>Tipo</th><th>Saldo base equiv.</th><th title="Suma de movimientos tipo Pago deuda vinculados a esta deuda">Pagado registrado</th><th>Saldo restante estimado</th><th>Utilización</th><th>Pago mínimo</th><th>Día pago</th><th>Meta / cierre</th><th>Acciones</th></tr></thead><tbody>${
    rows.length?rows.map(d=>{
      const archivedDebt=debtStatus(d)==="archived";
      const status=archivedDebt?`<span class="pill">Pagada / archivada</span>`:`<span class="pill">Activa</span>`;
      const closure=archivedDebt?`${d.closedAt?dateLabel(d.closedAt):"Fecha no indicada"}${d.closedReason?` · ${d.closedReason}`:""}`:(d.goal||"");
      const actions=archivedDebt
        ? `<button class="btn secondary small" data-reactivate-debt="${safe(d.id)}">Reactivar</button><button class="btn secondary small" data-edit-debt="${safe(d.id)}">Editar</button>`
        : `<button class="btn small" data-pay-debt="${safe(d.id)}">Registrar pago</button><button class="btn secondary small" data-edit-debt="${safe(d.id)}">Editar</button><button class="btn secondary small" data-archive-debt="${safe(d.id)}">Cerrar / archivar</button>`;
      return `<tr class="${archivedDebt?"archived-row":""}">
      <td>${status}</td><td class="center">${safe(d.priority)}</td><td><strong>${safe(d.name)}</strong><br><small class="muted">${safe(d.notes||"")}</small></td><td>${safe(d.type)}</td>
      <td class="num">${money(debtEquivalent(d))}<span class="original-money">Base: ${d.usd?originalMoney(d.usd,"USD"):""}${d.usd&&d.crc?" + ":""}${d.crc?originalMoney(d.crc,"CRC"):""}</span></td><td class="num">${money(debtPayments(d))}</td><td class="num">${money(debtOutstanding(d))}</td>
      <td>${d.limit?`<div class="progress"><span style="width:${Math.min(100,debtUtil(d)*100)}%"></span></div><small>${(debtUtil(d)*100).toFixed(1)}%</small>`:"—"}</td>
      <td class="num">${money(debtMinimumCRC(d))}${originalHint(d.minimum,d.minimumCurrency)}</td><td class="center">${d.payDay||""}</td><td>${safe(closure||"")}</td>
      <td><div class="actions">${actions}</div></td>
    </tr>`}).join(""):`<tr><td colspan="12" class="empty">No hay deudas en esta vista.</td></tr>`
  }</tbody>`;
}

