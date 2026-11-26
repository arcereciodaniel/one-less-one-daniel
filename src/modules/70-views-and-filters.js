function refreshDebtSelect(selected=""){
  const el=document.getElementById("mDebt");if(!el)return;
  const current=selected||el.value;
  fillObjectSelect(el,[{value:"",label:"Seleccioná una deuda"},...activeDebts().map(d=>({value:d.id,label:d.name}))],current);
}


// ==========================================================
// Rastro v6 UI preferences: Light / Dark theme
// ==========================================================
const UI_PREFS_KEY="rastro-ui-v6";
let uiPrefs=(()=>{
  try{
    const saved=JSON.parse(localStorage.getItem(UI_PREFS_KEY)||"{}");
    return {theme:saved.theme==="light"?"light":"dark",sidebarCollapsed:!!saved.sidebarCollapsed};
  }catch{return {theme:"dark",sidebarCollapsed:false}}
})();
function applyTheme(){
 document.documentElement.dataset.theme=uiPrefs.theme;
 document.documentElement.dataset.sidebar=uiPrefs.sidebarCollapsed?"collapsed":"open";
 document.querySelectorAll('[data-theme-choice]').forEach(b=>b.classList.toggle('active',b.dataset.themeChoice===uiPrefs.theme));
 const sideBtn=document.getElementById("sidebarToggle");
 if(sideBtn){
   const collapsed=!!uiPrefs.sidebarCollapsed;
   sideBtn.textContent=collapsed?"»":"«";
   sideBtn.title=collapsed?"Mostrar menú lateral":"Ocultar menú lateral";
   sideBtn.setAttribute("aria-label",sideBtn.title);
 }
 const themeMeta=document.querySelector('meta[name="theme-color"]');
 if(themeMeta)themeMeta.content=uiPrefs.theme==='dark'?'#191919':'#f7f7f5';
}
function saveUiPrefs(){localStorage.setItem(UI_PREFS_KEY,JSON.stringify(uiPrefs))}
function initUiPreferences(){
 document.documentElement.lang='es';
 document.querySelectorAll('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>{
   uiPrefs.theme=b.dataset.themeChoice;
   saveUiPrefs();
   applyTheme();
   // Canvas se pinta en JS: al cambiar de tema hay que redibujarlo.
   requestAnimationFrame(()=>{
     if(document.getElementById("view-dashboard")?.classList.contains("active"))renderDashboard();
     else if(document.getElementById("view-reports")?.classList.contains("active"))renderReports();
   });
 }));
 const sidebarToggle=document.getElementById('sidebarToggle');
 if(sidebarToggle){sidebarToggle.addEventListener('click',()=>{uiPrefs.sidebarCollapsed=!uiPrefs.sidebarCollapsed;saveUiPrefs();applyTheme()})}
 document.querySelectorAll('.dialog-close').forEach(b=>b.addEventListener('click',()=>b.closest('dialog')?.close()));
 applyTheme();
}

// ==========================================================
// Rastro v7 · Minimal UI renderers
// Conservan el mismo STORAGE_KEY y el mismo modelo de datos.
// ==========================================================
function v7IsoDateOffset(days){
  const d=new Date(todayIso()+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)
}
function v7MonthKey(date){return String(date||"").slice(0,7)}
function v7SignedMoney(value){return `${value>=0?"+":"−"}${money(Math.abs(value))}`}
function v7Kpi(icon,tone,label,value,meta="",metaTone=""){
  return `<div class="v7-kpi"><div class="v7-kpi-icon ${tone}">${icon}</div><div><div class="v7-kpi-label">${label}</div><div class="v7-kpi-value">${value}</div>${meta?`<div class="v7-kpi-meta ${metaTone}">${meta}</div>`:""}</div></div>`
}
function v7NextPayDate(d){
  let day=parseInt(String(d?.payDay||"").match(/\d+/)?.[0]||"",10);if(!day||day<1)return "";
  const now=new Date(todayIso()+"T00:00:00Z");
  const make=(y,m)=>{const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return new Date(Date.UTC(y,m,Math.min(day,last)))};
  let candidate=make(now.getUTCFullYear(),now.getUTCMonth());
  if(candidate<now)candidate=make(now.getUTCFullYear(),now.getUTCMonth()+1);
  return candidate.toISOString().slice(0,10)
}
function v7DaysUntil(date){
  if(!date)return null;const a=new Date(todayIso()+"T00:00:00Z"),b=new Date(date+"T00:00:00Z");return Math.round((b-a)/86400000)
}
function v7DateGroupLabel(date){
  const diff=v7DaysUntil(date);
  if(diff===0)return "Hoy";
  if(diff===-1)return "Ayer";
  if(diff!==null&&diff<0&&diff>=-7)return "Esta semana";
  return dateLabel(date)
}
function v7MovementIcon(m){
  if(m.type==="Ingreso"||oneIsCobroReimbursement(m))return "↗";
  if(m.type==="Pago deuda")return "▭";
  if(m.type==="Movimiento patrimonial")return "◇";
  return "↘"
}
function v7SafeText(v){return safe(String(v||""))}


const liquidityInteraction={points:[],color:"",activeIndex:-1};
function liquidityPointCoordinates(index,width){
  const values=liquidityInteraction.points.map(p=>Number(p.balance));
  const min=Math.min(0,...values),max=Math.max(1,...values),span=max-min||1;
  const plot={l:58,r:18,t:22,b:42},height=300;
  const plotWidth=Math.max(0,width-plot.l-plot.r);
  const x=plot.l+(values.length===1?plotWidth/2:index*plotWidth/(values.length-1));
  const y=plot.t+(max-values[index])/span*(height-plot.t-plot.b);
  return {x,y,top:plot.t,bottom:height-plot.b};
}
function drawInteractiveLiquidityChart(){
  const canvas=document.getElementById("cashChart");
  const tip=document.getElementById("cashChartTooltip");
  const points=liquidityInteraction.points;
  if(!canvas||canvas.hidden||!canvas.isConnected||!points.length||!document.getElementById("view-dashboard")?.classList.contains("active"))return;
  const width=canvas.getBoundingClientRect().width;
  if(width<40)return;
  drawReportLine(canvas,points.map(p=>p.label),[{values:points.map(p=>p.balance),color:liquidityInteraction.color}]);
  const index=liquidityInteraction.activeIndex;
  if(!tip)return;
  if(index<0||index>=points.length){tip.hidden=true;return;}
  const {x,y,top,bottom}=liquidityPointCoordinates(index,width);
  const ctx=canvas.getContext("2d"),css=getComputedStyle(document.documentElement);
  ctx.save();
  ctx.globalAlpha=.65;
  ctx.strokeStyle=css.getPropertyValue("--muted").trim()||"#888";
  ctx.lineWidth=1;
  ctx.setLineDash([4,5]);
  ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.fillStyle=css.getPropertyValue("--surface").trim()||"#fff";
  ctx.strokeStyle=liquidityInteraction.color;
  ctx.lineWidth=2.6;
  ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=liquidityInteraction.color;
  ctx.beginPath();ctx.arc(x,y,3.2,0,Math.PI*2);ctx.fill();
  ctx.restore();
  const point=points[index];
  document.getElementById("cashChartTooltipDate").textContent=(point.label==="Hoy"?"Hoy":"Cierre mensual")+" · "+dateLabel(point.date);
  document.getElementById("cashChartTooltipAmount").textContent=money(point.balance);
  tip.hidden=false;
  const tipWidth=tip.offsetWidth,tipHeight=tip.offsetHeight;
  const center=Math.max(tipWidth/2+8,Math.min(width-tipWidth/2-8,x));
  tip.style.left=center+"px";
  tip.style.top=(y-tipHeight-15>=0?y-tipHeight-15:y+15)+"px";
}
function setLiquidityActiveIndex(index){
  const points=liquidityInteraction.points;
  const target=Number.isInteger(index)&&index>=0&&index<points.length?index:-1;
  if(liquidityInteraction.activeIndex===target)return;
  liquidityInteraction.activeIndex=target;
  drawInteractiveLiquidityChart();
}
function initLiquidityChartInteraction(){
  const canvas=document.getElementById("cashChart");
  if(!canvas||canvas.dataset.interactiveBound==="true")return;
  canvas.dataset.interactiveBound="true";
  const selectByPointer=event=>{
    const count=liquidityInteraction.points.length;
    if(!count)return;
    const rect=canvas.getBoundingClientRect();
    if(rect.width<40)return;
    const position=event.clientX-rect.left;
    const fraction=(position-58)/Math.max(1,rect.width-58-18);
    const index=count===1?0:Math.round(Math.max(0,Math.min(1,fraction))*(count-1));
    setLiquidityActiveIndex(index);
  };
  canvas.addEventListener("pointermove",selectByPointer);
  canvas.addEventListener("pointerdown",selectByPointer);
  canvas.addEventListener("pointerleave",event=>{
    if(event.pointerType==="mouse"||event.pointerType==="pen")setLiquidityActiveIndex(-1);
  });
  canvas.addEventListener("focus",()=>{
    if(liquidityInteraction.points.length)setLiquidityActiveIndex(liquidityInteraction.points.length-1);
  });
  canvas.addEventListener("blur",()=>setLiquidityActiveIndex(-1));
  canvas.addEventListener("keydown",event=>{
    const count=liquidityInteraction.points.length;
    if(!count)return;
    let next=liquidityInteraction.activeIndex;
    if(event.key==="ArrowLeft")next=Math.max(0,(next<0?count-1:next)-1);
    else if(event.key==="ArrowRight")next=Math.min(count-1,next<0?0:next+1);
    else if(event.key==="Home")next=0;
    else if(event.key==="End")next=count-1;
    else if(event.key==="Escape")next=-1;
    else return;
    event.preventDefault();
    setLiquidityActiveIndex(next);
  });
  document.addEventListener("pointerdown",event=>{
    if(event.pointerType==="touch"&&!document.getElementById("cashChartPlot")?.contains(event.target))setLiquidityActiveIndex(-1);
  });
}


function oneCobroDueDate(c){return c.dueDate||""}
function onePendingCobros(){
  return [...(data.sharedCharges||[])].filter(c=>cobroRemainingOriginal(c)>.005).sort((a,b)=>
    (oneCobroDueDate(a)||"9999-12-31").localeCompare(oneCobroDueDate(b)||"9999-12-31")||String(a.person||"").localeCompare(String(b.person||""),"es"));
}
function renderCobrosReminderWidget(){
  const card=document.getElementById("dashboardCollectionsCard");
  if(!card)return;
  const active=oneModuleEnabled("shared");
  card.hidden=!active;
  if(!active)return;
  if((data.receivableRecurring||[]).length)ensureRecurringChargesForMonth(todayIso().slice(0,7));
  const today=todayIso(),upTo=addDaysIso(today,7),pending=onePendingCobros();
  const overdue=pending.filter(c=>oneCobroDueDate(c)&&oneCobroDueDate(c)<today),dueSoon=pending.filter(c=>oneCobroDueDate(c)&&oneCobroDueDate(c)<=upTo);
  const actionable=pending.filter(c=>cobroReminderStart(c)<=today);
  const visible=actionable.slice(0,5),total=pending.reduce((sum,c)=>sum+cobroRemainingCRC(c),0);
  document.getElementById("dashboardCollectionsSummary").innerHTML=
    `<span>Pendiente total: <strong>${money(total)}</strong></span><span>${overdue.length} vencidos</span><span>${actionable.length} recordatorios activos · ${dueSoon.length} próximos/vencidos</span>`;
  document.getElementById("dashboardCollectionsList").innerHTML=visible.length?visible.map(c=>{
    const date=oneCobroDueDate(c),days=Math.round((Date.parse(date+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/86400000);
    const status=!date?"Sin fecha prevista":days<0?"Vencido":days===0?"Cobrar hoy":days===1?"Mañana":`Recordar ${dateLabel(date)}`;
    const group=sharedGroupById(c.groupId),person=c.person||group?.person||"Sin persona";
    return `<div class="one-collections-row"><div><strong>${safe(person)} · ${safe(c.description||c.kind)}</strong><small class="${days<=0?"one-collections-overdue":""}">${safe(status)}${group?` · ${safe(group.name)}`:""}</small></div><span class="one-collections-amount">${money(cobroRemainingCRC(c))}</span><button type="button" class="btn secondary small" data-snooze-cobro="${safe(c.id)}" aria-label="Posponer recordatorio de ${safe(c.description)} tres días">Posponer 3 días</button></div>`;
  }).join(""):`<div class="empty">${pending.length?"No hay recordatorios pendientes de atención. Los cobros sin fecha siguen disponibles en Cobros.":"Todavía no hay cobros pendientes. Podés agregar el primero desde Cobros."}</div>`;
}


/* Dinero disponible estimado: horizonte del mes financiero, sin doble cargo por pagos registrados. */
function oneEstimatedAvailable(today=todayIso()){
  const current=periodForDate(today);
  const month=current?.budgetMonth||deriveBudgetMeta(current||{}).budgetMonth;
  const periods=(data.periods||[]).filter(p=>{
    const meta=deriveBudgetMeta(p);
    return meta.budgetMonth===month&&periodEndDate(p)>=today;
  }).sort((a,b)=>a.date.localeCompare(b.date));
  const balance=actualBalanceAt(today);
  const hasBalance=!!latestReconciliation(today)||
    (data.periods||[]).some(p=>p.date<=today&&p.opening!==null&&p.opening!==undefined&&p.opening!=="")||
    (data.movements||[]).some(m=>m.date<=today&&(["Ingreso","Gasto","Pago deuda"].includes(m.type)||oneIsCobroReimbursement(m)))||
    (data.reserveMovements||[]).some(t=>t.date<=today);
  const hasPlan=periods.some(p=>budgetCategories(["Gasto","Pago deuda"],p)
    .some(c=>num(p.categoryBudgets?.[c.id])>0));
  const pending=periods.reduce((sum,p)=>sum+remainingBudgetForCurrentPeriod(p,today),0);
  const horizon=periods.length?periods.reduce((d,p)=>periodEndDate(p)>d?periodEndDate(p):d,""):"";
  return {month,horizon,balance,pending,available:balance-pending,hasBalance,hasPlan,ready:!!(hasBalance&&hasPlan&&periods.length)};
}
function oneRenderEstimatedAvailable(today=todayIso()){
  const slot=document.getElementById("dashboardHeroNote");if(!slot)return;
  const info=oneEstimatedAvailable(today);
  if(!info.ready){
    const hint=!info.hasBalance?
      "Registrá un saldo inicial o actualizá tu saldo real desde Conciliación.":
      "Asigná gastos o cuotas en el presupuesto del mes financiero actual.";
    slot.innerHTML=`<div class="one-available-kicker">Disponible estimado</div>
      <strong class="one-available-value">—</strong>
      <span class="one-available-caption">Necesitamos el saldo operativo y un presupuesto vigente para calcularlo.</span>
      <span class="one-available-help">${hint}</span>`;
    return;
  }
  const negative=info.available<0;
  slot.innerHTML=`<div class="one-available-kicker">Disponible estimado</div>
    <strong class="one-available-value ${negative?"negative":""}">${money(info.available)}</strong>
    <span class="one-available-caption">Después de cubrir los egresos previstos hasta ${dateLabel(info.horizon)}.</span>
    <details class="one-available-details">
      <summary>Ver cálculo</summary>
      <div class="one-available-math">
        <div><span>Saldo operativo hoy</span><strong>${money(info.balance)}</strong></div>
        <div><span>Gastos y cuotas aún presupuestados</span><strong>− ${money(info.pending)}</strong></div>
        <p>No incluye ingresos futuros ni gastos o cuotas sin presupuestar. No equivale a un saldo bancario confirmado.</p>
      </div>
    </details>`;
}

/* Resumen de meses financieros completos, derivado del historial sin mutarlo. */
function oneMonthlyCloseData(month,asOf=todayIso()){
  const periods=(data.periods||[]).filter(p=>(p.budgetMonth||deriveBudgetMeta(p).budgetMonth)===month);
  if(periods.length!==2||new Set(periods.map(p=>Number(p.fortnight))).size!==2||
     !periods.some(p=>Number(p.fortnight)===1)||!periods.some(p=>Number(p.fortnight)===2)||
     periods.some(p=>periodEndDate(p)>=asOf))return null;
  const movements=selectedMovements("month",month).filter(m=>m.date<=asOf&&
    ["Ingreso","Gasto","Pago deuda"].includes(m.type));
  const sumType=type=>movements.filter(m=>m.type===type).reduce((sum,m)=>sum+movementAmountCRC(m),0);
  const income=sumType("Ingreso"),expenses=sumType("Gasto"),debtPayments=sumType("Pago deuda");
  const expenseMovements=movements.filter(m=>m.type==="Gasto");
  const categories=(data.categories||[]).filter(c=>c.type==="Gasto").map(c=>{
    const budget=periods.reduce((sum,p)=>sum+periodCategoryBudgetCRC(p,c.id,"pay"),0);
    const spent=expenseMovements.reduce((sum,m)=>sum+movementCategoryAmountCRC(m,c),0);
    return {name:c.name,budget,spent};
  });
  const planned=categories.filter(c=>c.budget>.005);
  const within=planned.filter(c=>c.spent<=c.budget+.005).length;
  const over=planned.filter(c=>c.spent>c.budget+.005).length;
  const unplanned=categories.filter(c=>c.budget<=.005&&c.spent>.005).length;
  const top=categories.filter(c=>c.spent>.005).sort((a,b)=>b.spent-a.spent)[0]||null;
  return {month,income,expenses,debtPayments,outflows:expenses+debtPayments,
    movements:movements.length,planned:planned.length,within,over,unplanned,top};
}
function oneMonthlyCloseSelection(asOf=todayIso()){
  const selected=hierarchicalSelection("dashboard");
  if(selected.level==="month")return {month:selected.value,scope:"Mes financiero cerrado"};
  if(selected.level==="fortnight")return {month:periodByKey(selected.value)?.budgetMonth||"",scope:"Resumen del mes completo"};
  const months=[...new Set((data.periods||[])
    .map(p=>p.budgetMonth||deriveBudgetMeta(p).budgetMonth)
    .filter(m=>m&&budgetQuarterFromMonth(m)===selected.value))].sort().reverse();
  const month=months.find(m=>oneMonthlyCloseData(m,asOf)!==null)||"";
  return {month,scope:"Último mes cerrado del trimestre"};
}

function oneMonthlyCloseCard(asOf=todayIso()){
  const selected=oneMonthlyCloseSelection(asOf);
  const summary=selected.month?oneMonthlyCloseData(selected.month,asOf):null;
  const title=summary?monthLabel(summary.month):"Cierre pendiente";
  const heading=`<div class="one-month-close-top">
    <span class="one-month-close-icon" aria-hidden="true">◷</span>
    <div class="one-month-close-headings">
      <div class="one-month-close-eyebrow">TU MES EN UN VISTAZO</div>
      <h3>${safe(title)}</h3>
    </div>
  </div>`;
  let content="";
  if(!summary){
    content='<p class="one-month-close-empty">El resumen aparecerá cuando termine un mes financiero de la vista seleccionada.</p>';
  }else{
    const findings=[];
    if(!summary.movements)findings.push("Aún no hay movimientos registrados para este mes.");
    else{
      if(summary.over>0)findings.push(`<strong>${summary.over} ${summary.over===1?"categoría superó":"categorías superaron"}</strong> el presupuesto asignado.`);
      else if(summary.unplanned>0)findings.push(`<strong>${summary.unplanned} ${summary.unplanned===1?"categoría tuvo":"categorías tuvieron"}</strong> gastos sin presupuesto.`);
      else if(summary.planned>0)findings.push(`<strong>${summary.within} de ${summary.planned} categorías</strong> se mantuvieron dentro del presupuesto.`);
      if(summary.top)findings.push(`<strong>${safe(summary.top.name)}</strong> fue la categoría de mayor gasto (${money(summary.top.spent)}).`);
      if(!findings.length)findings.push("No se registraron gastos por categoría en este mes.");
    }
    content=`<div class="one-month-close-totals">
      <div><span>Ingresos reales</span><strong>${money(summary.income)}</strong></div>
      <div><span>Salidas reales · incluye deudas</span><strong>${money(summary.outflows)}</strong></div>
    </div>
    <div class="one-month-close-findings">
      ${findings.slice(0,2).map(message=>`<p>${message}</p>`).join("")}
    </div>`;
  }
  return `<section id="dashboardMonthlyClose" class="v7-kpi v7-insight-card one-month-close" aria-label="Tu mes en un vistazo">
    ${heading}${content}
  </section>`;
}

const renderDashboardLegacy=renderDashboard;
function oneCanCompareHistoricalBalance(asOf){
  // Un saldo inicial futuro no prueba cuál era el saldo antes de abrir el historial.
  const first=[...(data.periods||[])].filter(p=>p.date).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(!first||asOf<first.date)return false;
  if(first.opening!==null&&first.opening!==undefined&&first.opening!=="")return true;
  return (data.movements||[]).some(m=>m.date>=first.date&&m.date<=asOf)||
    (data.reconciliations||[]).some(r=>r.date>=first.date&&r.date<=asOf)||
    (data.reserveMovements||[]).some(t=>t.date>=first.date&&t.date<=asOf);
}

renderDashboard=function(){
  const {level,value}=hierarchicalSelection("dashboard");
  const summary=selectedSummary(level,value);
  const operating=actualBalanceAt(todayIso());
  const comparisonDate=v7IsoDateOffset(-30);
  const previous=oneCanCompareHistoricalBalance(comparisonDate)?actualBalanceAt(comparisonDate):null;
  const delta=previous===null?0:operating-previous;
  const periodMovs=selectedMovements(level,value);
  const realIncome=periodMovs.filter(m=>m.type==="Ingreso").reduce((s,m)=>s+movementAmountCRC(m),0);
  const realExpenses=periodMovs.filter(m=>m.type==="Gasto").reduce((s,m)=>s+movementAmountCRC(m),0);
  const debtPaid=periodMovs.filter(m=>m.type==="Pago deuda").reduce((s,m)=>s+movementAmountCRC(m),0);
  const operatingFlow=realIncome-realExpenses-debtPaid;
  const plannedExpensesOnly=summary.rows.reduce((sum,p)=>sum+
    budgetCategories("Gasto",p).reduce((part,c)=>part+periodCategoryBudgetCRC(p,c.id,"pay"),0),0);

  document.getElementById("dashboardHeroValue").textContent=money(operating);
  const deltaEl=document.getElementById("dashboardHeroDelta");
  if(previous===null){
    deltaEl.textContent="Sin historial suficiente para comparar hace 30 días";
    deltaEl.className="v7-hero-delta";
  }else if(previous>0){
    const pct=Math.abs(delta/previous)*100;
    deltaEl.textContent=`Saldo operativo: ${delta>=0?"↑":"↓"} ${pct.toFixed(0)}% vs. hace 30 días`;
    deltaEl.className="v7-hero-delta";
  }else{
    // Con una base cero o negativa, el cambio porcentual no representa
    // apropiadamente la mejora o caída del saldo disponible.
    deltaEl.textContent=`Saldo operativo hace 30 días: ${money(previous)} · variación ${delta>=0?"+":"−"}${money(Math.abs(delta))}`;
    deltaEl.className="v7-hero-delta";
  }
  deltaEl.title="Comparación del saldo operativo, no del gasto. Incluye ingresos, egresos, aportes a metas y ajustes de conciliación.";
  oneRenderEstimatedAvailable(todayIso());

  document.getElementById("kpiGrid").innerHTML=[
    v7Kpi("↑","green","Ingresos reales",money(realIncome),realIncome?"Registrados · plan: "+money(summary.plannedIncome):"Sin ingresos registrados · plan: "+money(summary.plannedIncome),realIncome?"good":""),
    v7Kpi("↓","red","Gastos reales",money(realExpenses),realExpenses?"Registrados · plan: "+money(plannedExpensesOnly):"Sin gastos registrados · plan: "+money(plannedExpensesOnly),""),
    oneMonthlyCloseCard(todayIso())
  ].join("");

  const hist=liquidityHistorySeries(6);
  const liquidityColor=getComputedStyle(document.documentElement).getPropertyValue("--one-chart-liquidity").trim()||"#c8cfcd";
  const cashCanvas=document.getElementById("cashChart"),emptyChart=document.getElementById("cashChartEmpty");
  liquidityInteraction.points=hist;
  liquidityInteraction.color=liquidityColor;
  if(liquidityInteraction.activeIndex>=hist.length)liquidityInteraction.activeIndex=-1;
  if(cashCanvas)cashCanvas.hidden=!hist.length;
  if(emptyChart){
    emptyChart.hidden=!!hist.length;
    if(!hist.length)emptyChart.textContent="Aún no hay saldos operativos reales hasta hoy. El presupuesto es una proyección; para iniciar este historial, registrá un movimiento real o actualizá tu saldo en Conciliación de saldo.";
  }
  if(!hist.length){
    const tooltip=document.getElementById("cashChartTooltip");
    if(tooltip)tooltip.hidden=true;
  }else if(cashCanvas&&typeof drawReportLine==="function"){
    requestAnimationFrame(drawInteractiveLiquidityChart);
  }
  document.getElementById("dashboardChartMeta").textContent=
    hist.length>1?`${hist[0].label} – Hoy · saldo operativo real`:
    hist.length===1?`Saldo operativo de hoy: ${money(hist[0].balance)} · historial en formación`:
    "Aún no hay saldos operativos reales registrados";

  const spendPlan=Math.max(0,summary.plannedExpense-oneSavingsBudgetPlanned(summary.rows));
  const usage=spendPlan?summary.realExpense/spendPlan:null;
  const insight=document.getElementById("dashboardInsight");
  if(usage===null){
    insight.innerHTML=`<div class="v7-insight-icon">↗</div><h3>Tu lectura está lista para crecer</h3><p>Definí presupuesto y registrá movimientos reales para que One Less One pueda comparar ritmo, desviaciones y proyección.</p><span class="v7-status-pill">○ Faltan datos reales</span>`;
  }else if(usage<=.85){
    insight.innerHTML=`<div class="v7-insight-icon">▥</div><h3>Vas dentro de tu ritmo de gasto</h3><p>Has utilizado ${(usage*100).toFixed(0)}% del presupuesto de egresos del período seleccionado. No es una comparación con el tiempo transcurrido.</p><span class="v7-status-pill">✓ Dentro del presupuesto</span>`;
  }else if(usage<=1){
    insight.innerHTML=`<div class="v7-insight-icon">◔</div><h3>Estás cerca del límite planeado</h3><p>Has utilizado ${(usage*100).toFixed(0)}% del presupuesto. Vale la pena cuidar los gastos discrecionales del resto del periodo.</p><span class="v7-status-pill">○ Revisar ritmo</span>`;
  }else{
    insight.innerHTML=`<div class="v7-insight-icon">!</div><h3>El gasto superó el plan</h3><p>Los gastos reales están ${money(summary.realExpense-spendPlan)} por encima del presupuesto de gastos, sin contar el ahorro apartado.</p><span class="v7-status-pill">○ Requiere atención</span>`;
  }

  const debts=activeDebts().map(d=>({...d,nextDate:v7NextPayDate(d)})).filter(d=>d.nextDate).sort((a,b)=>a.nextDate.localeCompare(b.nextDate)).slice(0,3);
  document.getElementById("dashboardCommitments").innerHTML=debts.length?debts.map(d=>{
    const days=v7DaysUntil(d.nextDate);
    return `<div class="v7-list-row"><div class="v7-list-icon">▭</div><div class="v7-list-main"><strong>${v7SafeText(d.name)}</strong><span>${days===0?"Hoy":days===1?"Mañana":`En ${days} días`} · ${dateLabel(d.nextDate)}</span></div><div class="v7-list-amount">${money(debtMinimumCRC(d))}</div></div>`
  }).join(""):`<div class="empty">No hay vencimientos de deuda con fecha configurada.</div>`;

  const recent=[...(data.movements||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))||num(b.seq)-num(a.seq)).slice(0,4);
  document.getElementById("dashboardActivity").innerHTML=recent.length?recent.map(m=>{
    const amt=movementAmountCRC(m),positive=m.type==="Ingreso"||oneIsCobroReimbursement(m);
    return `<div class="v7-list-row"><div class="v7-list-icon">${v7MovementIcon(m)}</div><div class="v7-list-main"><strong>${v7SafeText(m.description||movementCategoryName(m)||m.type)}</strong><span>${v7SafeText(movementCategoryName(m))} · ${dateLabel(m.date)}</span></div><div class="v7-list-amount ${positive?"positive":""}">${positive?"+":"−"} ${money(amt)}</div></div>`
  }).join(""):`<div class="empty">Todavía no hay actividad registrada.</div>`;

  renderReconciliationStatus();
  const cat=categoryReportFiltered(level,value),rows=summary.rows;
  document.getElementById("dashboardCategories").innerHTML=categoryTable(cat);
  const expCanvas=document.getElementById("expenseChart");
  renderCobrosReminderWidget();
  if(expCanvas){
    const chartLabels=rows.map(r=>level==="quarter"?`${monthLabel(r.budgetMonth).slice(0,3)} ${r.fortnight}Q`:level==="month"?`${r.fortnight}.ª`:dateLabel(r.date).replace(/ de /g," "));
    drawBarChart(expCanvas,chartLabels.length?chartLabels:["Sin datos"],chartLabels.length?rows.map(r=>r.expenses):[0],chartLabels.length?rows.map(r=>r.actualExpenses):[0]);
  }
};

const renderPlanLegacy=renderPlan;
renderPlan=function(){
  renderPlanLegacy();
  const {level,value}=hierarchicalSelection("plan");
  const label=value?selectedLabel(level,value):"Sin periodo";
  document.getElementById("planTitle").textContent="Presupuesto";
  document.getElementById("planSub").textContent=`Tu plan de lo que entra, lo que sale y lo que te queda. · ${label}`;
  document.querySelectorAll("#planMonths .plan-month").forEach((section,index)=>{
    const month=section.dataset.planMonth;
    const hasPreference=Object.prototype.hasOwnProperty.call(uiState.planMonths||{},month);
    if(!hasPreference)setPlanMonthOpen(section,index===0,true);
  });
};



function m2SyncMovementPeriod(reset=false){
  syncHierarchicalFilter("movement",reset);
  const {level,value}=hierarchicalSelection("movement");
  syncPeriodFilter("movement",value);
  const select=document.getElementById("movementPeriod");
  if(value&&Array.from(select.options).some(o=>o.value===value))select.value=value;
  const fortnight=document.getElementById("movementFortnight");
  if(fortnight)Array.from(fortnight.options).forEach(o=>o.textContent=o.value==="1"?"Primera quincena":"Segunda quincena");
  document.querySelectorAll("[data-one-move-level]").forEach(b=>{
    const active=b.dataset.oneMoveLevel===level;
    b.classList.toggle("active",active);
    b.setAttribute("aria-pressed",String(active));
  });
}
function m2RefreshMovementToolbar(level,value){
  const label=document.getElementById("movementPeriodHeading");if(label)label.textContent=selectedLabel(level,value)||"Sin períodos";
  const opts=filterOptions(level),i=opts.findIndex(o=>o.value===value);
  document.getElementById("movementPreviousPeriod").disabled=i<=0;
  document.getElementById("movementNextPeriod").disabled=i<0||i>=opts.length-1;
  const fields=["movementTypeFilter","movementCategoryFilter","movementCurrencyFilter","movementDateFrom","movementDateTo"];
  const count=fields.filter(id=>!!document.getElementById(id)?.value).length;
  const badge=document.getElementById("movementFiltersCount");badge.hidden=count===0;badge.textContent=String(count);
}
renderMovements=function(){
  const {level,value,scope,rows}=m2FilteredMovementRows();
  document.getElementById("movementCount").textContent=`${rows.length} movimientos`;

  m2RefreshMovementToolbar(level,value);
  const income=rows.filter(m=>m.type==="Ingreso").reduce((s,m)=>s+movementAmountCRC(m),0);
  const expense=rows.filter(m=>m.type==="Gasto").reduce((s,m)=>s+movementAmountCRC(m),0);
  const debt=rows.filter(m=>m.type==="Pago deuda").reduce((s,m)=>s+movementAmountCRC(m),0);
  const reimbursements=rows.filter(oneIsCobroReimbursement).reduce((sum,m)=>sum+movementAmountCRC(m),0);
  const outflows=expense+debt,net=income+reimbursements-outflows;
  document.getElementById("movementSummary").innerHTML=[
    v7Kpi("↑","green","Ingresos",money(income),`${rows.filter(m=>m.type==="Ingreso").length} movimientos`,"good"),
    v7Kpi("↓","red","Salidas",money(outflows),`${rows.filter(m=>m.type==="Gasto"||m.type==="Pago deuda").length} movimientos · incluye deudas`,""),
    v7Kpi("↗","blue","Neto",v7SignedMoney(net),reimbursements?`Incluye ${money(reimbursements)} en reembolsos`:`${rows.length} movimientos`,net>=0?"good":"bad")
  ].join("");

  const groups=[];
  rows.forEach(m=>{
    let g=groups.find(x=>x.date===m.date);
    if(!g){g={date:m.date,rows:[]};groups.push(g)}
    g.rows.push(m)
  });
  document.getElementById("movementFeed").innerHTML=groups.length?groups.map(g=>`<div class="v7-feed-group">
    <div class="v7-feed-date"><strong>${v7DateGroupLabel(g.date)}</strong><span>${dateLabel(g.date)}</span></div>
    ${g.rows.map(m=>{
      const amt=movementAmountCRC(m),positive=m.type==="Ingreso"||oneIsCobroReimbursement(m),label=m.description||movementCategoryName(m)||m.type;
      return `<div class="v7-transaction-row m2-row">
        <div class="v7-transaction-icon">${v7MovementIcon(m)}</div>
        <div class="v7-transaction-main"><strong>${v7SafeText(label)}</strong><span>${v7SafeText(oneIsCobroReimbursement(m)?"Reembolso · Cobros":oneIsLinkedCobroMovement(m)?"Ingreso · Cobros":m.account||m.type)}${m.paymentMethod?` · ${v7SafeText(m.paymentMethod)}`:""}${movementDebtName(m)?` · ${v7SafeText(movementDebtName(m))}`:""}</span></div>
        <div class="v7-category-chip">${v7SafeText(movementDisplayCategory(m)||m.type)}</div>
        <div class="v7-transaction-amount ${positive?"income":""}">${positive?"+":"−"} ${money(amt)}${originalHint(m.amount,m.currency)}</div>
        <div class="m2-feed-actions">
          ${oneIsLinkedCobroMovement(m)?
          `<button type="button" data-open-linked-cobro="${safe(m.receivableChargeId)}" title="Este movimiento se modifica desde Cobros">Ver en Cobros</button>`:
          `<button type="button" data-m2-edit="${safe(m.id)}" title="Editar movimiento">Editar</button>
          <button type="button" data-m2-repeat="${safe(m.id)}" title="Duplicar como nuevo movimiento">Repetir</button>
          <details class="one-move-row-more"><summary title="Más acciones" aria-label="Más acciones">···</summary><div class="one-move-row-menu"><button type="button" data-m2-schedule="${safe(m.id)}">Programar</button><button type="button" data-delete-movement="${safe(m.id)}">Eliminar</button></div></details>`}
         </div>
      </div>`
    }).join("")}
  </div>`).join(""):`<div class="empty">No hay movimientos que coincidan con esta vista.</div>`;

  const expenseRows=rows.filter(m=>m.type==="Gasto"),tot=expenseRows.reduce((s,m)=>s+movementAmountCRC(m),0),byCat={};
  expenseRows.forEach(m=>{
    if((m.splits||[]).length){
      const original=num(m.amount);
      (m.splits||[]).forEach(split=>{const name=categoryNameById(split.categoryId,"Otros");byCat[name]=(byCat[name]||0)+(original?movementAmountCRC(m)*num(split.amount)/original:0)});
    }else{const k=movementCategoryName(m)||"Otros";byCat[k]=(byCat[k]||0)+movementAmountCRC(m)}
  });
  const ranked=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5),topPct=tot&&ranked.length?Math.round(ranked[0][1]/tot*100):0;
  document.getElementById("movementQuick").innerHTML=`<div class="one-move-insight-period">${v7SafeText(selectedLabel(level,value))}</div>
    <div class="v7-donut-placeholder" style="--v7-pct:${topPct}%"><div class="v7-donut-center"><strong>${money(expense)}</strong><span>Gastos</span></div></div>
    <div class="v7-mini-bars">${ranked.length?ranked.map(([name,val])=>`<div class="v7-mini-bar"><div><div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px"><span>${v7SafeText(name)}</span><span>${tot?Math.round(val/tot*100):0}%</span></div><div class="v7-mini-bar-track"><span style="width:${tot?Math.min(100,val/tot*100):0}%"></span></div></div><strong style="font-size:.66rem;text-align:right">${money(val)}</strong></div>`).join(""):`<div class="muted" style="font-size:.72rem">Todavía no hay gastos reales en este periodo.</div>`}</div>`;
  m2RenderAccountSummary(rows);m2RenderTemplates();m2RenderAudit();
  oneRenderGoalMovementPreview(level,value);
};

// La agenda es una vista derivada: nunca altera deudas, movimientos ni cuotas históricas.

/* V13.0 beta: vistas flexibles sin migración destructiva */
function oneFlexConfig(raw={},legacy={first:14,second:28}){
  raw=raw&&typeof raw==="object"?raw:{};
  const int=(v,lo,hi,f)=>v!==null&&v!==""&&Number.isInteger(Number(v))&&Number(v)>=lo&&Number(v)<=hi?Number(v):f;
  const first=int(raw.first,1,27,int(legacy.first,1,27,14));
  return {enabled:raw.enabled===true,mode:["week","fortnight","month","quarter"].includes(raw.mode)?raw.mode:"fortnight",first,second:int(raw.second,first+1,31,Math.max(first+1,int(legacy.second,2,31,28))),weekday:int(raw.weekday,0,6,1),day:int(raw.day,1,31,1),quarterMonth:int(raw.quarterMonth,0,2,0)};
}

function oneFlexRange(date,raw,override){
  const c=oneFlexConfig(raw),mode=override||c.mode,d=new Date(date+"T00:00:00Z"),iso=t=>t.toISOString().slice(0,10),shift=(t,n)=>new Date(t.getTime()+n*86400000);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(d.getTime())||iso(d)!==date)throw Error("Fecha inválida");
  const result=(s,n)=>({start:iso(s),end:iso(shift(n,-1)),next:iso(n)});
  if(mode==="week"){const s=shift(d,-((d.getUTCDay()-c.weekday+7)%7));return result(s,shift(s,7))}
  const at=(y,m,day)=>{const b=new Date(Date.UTC(y,m,1));return new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth(),Math.min(day,new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth()+1,0)).getUTCDate())))};
  const starts=[];for(let i=-4;i<=4;i++){const y=d.getUTCFullYear(),m=d.getUTCMonth()+i;if(mode==="fortnight")starts.push(at(y,m,c.first),at(y,m,c.second));else if(mode==="month"||mode==="quarter"&&((m-c.quarterMonth)%3+3)%3===0)starts.push(at(y,m,c.day))}
  starts.sort((a,b)=>a-b);const i=starts.findIndex(t=>t>d)-1;if(i<0||!starts[i+1])throw Error("Período inválido");return result(starts[i],starts[i+1]);
}

function oneFlexPlanCoverage(periods,start,end,endFor){
  const overlap=periods.map(p=>({p,start:p.date,end:endFor(p)})).filter(x=>x.start<=end&&x.end>=start).sort((a,b)=>a.start.localeCompare(b.start));
  const full=overlap.filter(x=>x.start>=start&&x.end<=end);
  const next=d=>new Date(Date.parse(d+"T00:00:00Z")+86400000).toISOString().slice(0,10);
  return {rows:full.map(x=>x.p),complete:full.length>0&&full.length===overlap.length&&full[0].start===start&&full.at(-1).end===end&&full.every((x,i)=>!i||x.start===next(full[i-1].end))};
}

function oneFlexIncomeDates(cfg,start,end){
 const dates=[],iso=d=>d.toISOString().slice(0,10),lo=new Date(start+"T00:00:00Z"),hi=new Date(end+"T00:00:00Z");
 if(!cfg?.projectAutomatically||!(Number(cfg.expectedAmount)>0)||!Number.isFinite(lo.getTime())||!Number.isFinite(hi.getTime())||hi<lo)return dates;
 const add=d=>{if(d>=lo&&d<=hi)dates.push(iso(d))};
 const at=(y,m,day)=>new Date(Date.UTC(y,m,Math.min(Math.max(1,Number(day)||1),new Date(Date.UTC(y,m+1,0)).getUTCDate())));
 if(["semimonthly","monthly"].includes(cfg.frequency)){
  for(let d=new Date(Date.UTC(lo.getUTCFullYear(),lo.getUTCMonth(),1));d<=hi;d=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1))){
   const y=d.getUTCFullYear(),m=d.getUTCMonth();
   if(cfg.frequency==="monthly")add(at(y,m,cfg.monthlyDay));else{add(at(y,m,cfg.day1));add(at(y,m,cfg.day2))}
  }
 }else if(cfg.frequency==="weekly"||cfg.frequency==="biweekly"){
  let d=new Date(lo);const step=cfg.frequency==="weekly"?7:14;
  if(step===7){const w=Number(cfg.weekday);if(!Number.isInteger(w)||w<0||w>6)return dates;d.setUTCDate(d.getUTCDate()+(w-d.getUTCDay()+7)%7)}
  else{const ref=new Date(String(cfg.biweeklyStart||"")+"T00:00:00Z");if(!Number.isFinite(ref.getTime()))return dates;const delta=Math.round((lo-ref)/86400000);d.setUTCDate(d.getUTCDate()+(((-delta%14)+14)%14))}
  for(;d<=hi;d.setUTCDate(d.getUTCDate()+step))add(d);
 }else if(cfg.frequency==="once"){const d=new Date(String(cfg.onceDate||"")+"T00:00:00Z");if(Number.isFinite(d.getTime()))add(d)}
 return dates.sort();
}

function oneFlexBudgetOverlap(plans,start,end,ignore=""){
 return (plans||[]).some(p=>p.id!==ignore&&p.start<=end&&p.end>=start);
}

function oneFlexValidateBudgets(plans){
 if(plans===undefined)return;
 if(!Array.isArray(plans))throw Error("Los presupuestos flexibles no tienen un formato válido.");
 const validDate=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
 const ids=new Set(),sorted=[...plans].sort((a,b)=>String(a?.start).localeCompare(String(b?.start)));
 for(const [i,p] of sorted.entries()){
  if(!p||typeof p.id!=="string"||!p.id||ids.has(p.id)||!validDate(p.start)||!validDate(p.end)||p.end<p.start||!["week","fortnight","month","quarter"].includes(p.mode)||(i&&sorted[i-1].end>=p.start)||!Array.isArray(p.entries))throw Error("Hay presupuestos flexibles inválidos o superpuestos.");
  ids.add(p.id);const categories=new Set();
  for(const e of p.entries){if(!e||typeof e.categoryId!=="string"||!e.categoryId||categories.has(e.categoryId)||typeof e.amount!=="number"||!Number.isFinite(e.amount)||e.amount<0||!["CRC","USD"].includes(e.currency))throw Error("Hay categorías o montos inválidos en un presupuesto flexible.");categories.add(e.categoryId)}
 }
}

function oneFlexBudgetCoverage(legacy,native,start,end,endFor){
 const overlap=(a,b,c,d)=>a<=d&&b>=c;
 const rows=(legacy||[]).filter(p=>!(native||[]).some(n=>overlap(p.date,endFor(p),n.start,n.end))).map(p=>({date:p.date,end:endFor(p),legacy:p}));
 for(const p of native||[])rows.push({date:p.start,end:p.end,native:p});
 return oneFlexPlanCoverage(rows,start,end,p=>p.end);
}

function oneFlexDateRows(rows,r,through=""){
 return (rows||[]).filter(x=>x.date>=r.start&&x.date<=r.end&&(!through||x.date<=through));
}

function oneFlexRemaining(entries,actualFor){
 return entries.reduce((sum,e)=>sum+Math.max(0,e.planned-actualFor(e)),0);
}

function oneFlexMetrics(r,through=""){
 const coverage=oneFlexBudgetCoverage(data.periods||[],data.flexBudgets||[],r.start,r.end,p=>periodEndDate(p));
 const movements=oneFlexDateRows(data.movements,r,through);
 const savings=oneFlexDateRows(data.reserveMovements,r,through).filter(t=>t.type==="Aporte");
 const cats=sortedCategories((data.categories||[]).filter(c=>["Ingreso","Gasto","Pago deuda"].includes(c.type)));
 const planFor=(row,c)=>{const intent=c.type==="Ingreso"?"receive":"pay";if(row.legacy)return periodCategoryBudgetCRC(row.legacy,c.id,intent);const e=row.native.entries.find(x=>x.categoryId===c.id);return e?currentToCRC(e.amount,e.currency,intent):0};
 const actualFor=(c,rs=movements,ss=savings)=>rs.filter(m=>m.type===c.type&&!oneIsCobroReimbursement(m)).reduce((s,m)=>s+movementCategoryAmountCRC(m,c),0)+(c.type==="Gasto"?ss.filter(t=>oneContributionCategory(t)===c.id).reduce((s,t)=>s+reserveTxnHistoricalCRC(t,"pay"),0):0);
 const categories=cats.map(c=>({c,p:coverage.complete?coverage.rows.reduce((s,p)=>s+planFor(p,c),0):null,a:actualFor(c),includesSavings:savings.some(t=>oneContributionCategory(t)===c.id)}));
 const total=type=>movements.filter(m=>m.type===type&&!oneIsCobroReimbursement(m)).reduce((s,m)=>s+movementAmountCRC(m),0);
 const income=total("Ingreso"),expense=total("Gasto"),debt=total("Pago deuda"),reimbursements=movements.filter(oneIsCobroReimbursement).reduce((s,m)=>s+movementAmountCRC(m),0);
 const plannedIncome=coverage.complete?categories.filter(x=>x.c.type==="Ingreso").reduce((s,x)=>s+x.p,0):null;
 const plannedOut=coverage.complete?categories.filter(x=>x.c.type!=="Ingreso").reduce((s,x)=>s+x.p,0):null;
 const actualSpend=expense+debt,actualOut=actualSpend+savings.reduce((s,t)=>s+reserveTxnHistoricalCRC(t,"pay"),0);
 const pending=coverage.complete?coverage.rows.filter(p=>!through||p.end>=through).reduce((s,p)=>{
   const rs=oneFlexDateRows(movements,{start:p.date,end:p.end},through),ss=oneFlexDateRows(savings,{start:p.date,end:p.end},through);
   return s+oneFlexRemaining(cats.filter(c=>c.type!=="Ingreso").map(c=>({c,planned:planFor(p,c)})),e=>actualFor(e.c,rs,ss));
 },0):null;
 return {coverage,categories,movements,savings,income,expense,debt,reimbursements,plannedIncome,plannedOut,actualSpend,actualOut,pending};
}

function oneFlexDashboard(r,activeRange,label,universal=false){
 const get=id=>document.getElementById(id),today=todayIso(),m=universal?oneUniversalMetrics(r,today):oneFlexMetrics(r,today),current=universal?oneUniversalMetrics(activeRange,today):oneFlexMetrics(activeRange,today);
 const planText=v=>v===null?"Sin plan completo":"Plan: "+money(v);
 const balance=actualBalanceAt(today);
 const knownBalance=!!latestReconciliation(today)||(data.periods||[]).some(p=>p.date<=today&&p.opening!==null&&p.opening!==undefined&&p.opening!=="")||(data.movements||[]).some(x=>x.date<=today)||(data.reserveMovements||[]).some(x=>x.date<=today);
 const ready=(universal?oneLivingBalanceKnown(today):knownBalance)&&current.coverage.complete&&current.pending!==null;
 const livingLiquidity=universal?oneLivingLiquidity(balance,current.pending,oneLivingBalanceKnown(today),current.coverage.complete):null;
 get("dashboardHeroNote").innerHTML='<div class="one-available-kicker">Disponible estimado</div><strong class="one-available-value '+(ready&&balance-current.pending<0?"negative":"")+'">'+(ready?money(balance-current.pending):"—")+'</strong><span class="one-available-caption">'+safe(ready?"Después de compromisos presupuestados hasta "+dateLabel(activeRange.end):"Necesitamos un saldo y un presupuesto completo del período vigente.")+'</span>'+(ready?'<details class="one-available-details"><summary>Ver cálculo</summary><div class="one-available-math"><div><span>Saldo operativo hoy</span><strong>'+money(balance)+'</strong></div><div><span>Compromisos pendientes</span><strong>− '+money(current.pending)+'</strong></div><p>No incluye ingresos futuros ni gastos sin presupuestar.</p></div></details>':"");
 get("kpiGrid").innerHTML=[
  v7Kpi("↑","green","Ingresos reales",money(m.income),planText(m.plannedIncome),m.income?"good":""),
  v7Kpi("↓","red","Salidas y aportes",money(m.actualOut),planText(m.plannedOut),""),
  '<section id="dashboardMonthlyClose" class="v7-kpi v7-insight-card one-month-close"><div class="one-month-close-eyebrow">TU PERÍODO EN UN VISTAZO</div><h3>'+safe(label(r))+'</h3><div class="one-month-close-totals"><div><span>Ingresos reales</span><strong>'+money(m.income)+'</strong></div><div><span>Gastos y pagos</span><strong>'+money(m.actualSpend)+'</strong></div></div><p class="muted">'+(r.end<today?"Período cerrado":"Actividad registrada hasta hoy")+'</p></section>'
 ].join("");
 const list=m.categories.filter(x=>x.c.type!=="Ingreso"&&(x.p>0||x.a>0));
 get("dashboardCategories").innerHTML=m.coverage.complete?categoryTable(list.map(x=>({category:x.c.name,budget:x.p,actual:x.a,variance:x.p-x.a,used:x.p?x.a/x.p:0,includesSavings:x.includesSavings}))):
 '<p class="muted">Este rango no tiene un presupuesto completo. Los gastos reales se muestran sin estimar importes faltantes.</p><table><thead><tr><th>Categoría</th><th>Real</th></tr></thead><tbody>'+list.map(x=>'<tr><td>'+safe(x.c.name)+'</td><td class="num">'+money(x.a)+'</td></tr>').join("")+'</tbody></table>';
 const usage=m.plannedOut>0?m.actualOut/m.plannedOut:null;
 const title=usage===null?"Todavía falta un plan comparable":usage<=.85?"Vas dentro de tu presupuesto":usage<=1?"Estás cerca del límite planeado":"Las salidas superaron el plan";
 const description=usage===null?"Creá un presupuesto para este período o elegí un rango cubierto por planes completos.":'Has utilizado '+(usage*100).toFixed(0)+'% del presupuesto de gastos, pagos y aportes a metas.';
 get("dashboardInsight").innerHTML='<div class="v7-insight-icon">↗</div><h3>'+safe(title)+'</h3><p>'+safe(description)+'</p>';
 if(universal){
  const context=oneLivingContextReport(r,m,oneFlexConfig(data.settings.financialPeriods,onePayDays(data.settings)),today);
  const states=list.map(x=>context.statuses.get(x.c.id)?.code),count=keys=>states.filter(k=>keys.includes(k)).length;
  const review=count(["excess","local","unassigned"]),comp=count(["compensated"]),temp=count(["temporary"]),unknown=count(["unknown"]);
  const headline=context.future?"Planificación futura":review?"Revisá "+review+" categoría(s)":comp?"Hay desviaciones compensadas":temp?"Hay desviaciones temporales":unknown||!m.coverage.complete?"Presupuesto con cobertura parcial":"Categorías comparables dentro del plan";
  const note=context.future?"Todavía no hay ejecución real en este intervalo.":"Contexto "+label(context.parent)+" · "+comp+" compensada(s), "+temp+" temporal(es), "+unknown+" sin cobertura completa. No cambia tu presupuesto.";
  get("dashboardInsight").innerHTML='<div class="v7-insight-icon">↗</div><h3>'+safe(headline)+'</h3><p>'+safe(note)+'</p>';
  if(livingLiquidity?.shortfall>.005)get("dashboardHeroNote").insertAdjacentHTML("beforeend",'<p class="one-living-liquidity">Faltante frente a compromisos del período vigente: '+safe(money(livingLiquidity.shortfall))+'. No considera ingresos futuros; no es una proyección de insolvencia.</p>');
 }
 const canvas=get("expenseChart"),legend=get("expenseChartLegend"),note=get("oneFlexChartNote");
 if(note){note.hidden=m.coverage.complete;note.textContent="Sin presupuesto completo para comparar este rango."}
 if(canvas){canvas.hidden=!m.coverage.complete;if(m.coverage.complete)drawBarChart(canvas,[label(r)],[m.plannedOut],[m.actualOut])}
 if(legend)legend.hidden=!m.coverage.complete;
}

function oneUniversalRange(date,config,mode){
 if(!["half","year"].includes(mode))return oneFlexRange(date,config,mode);
 const d=new Date(date+"T00:00:00Z");
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)throw Error("Fecha inválida");
 const y=d.getUTCFullYear(),month=mode==="year"?0:Math.floor(d.getUTCMonth()/6)*6;
 const start=new Date(Date.UTC(y,month,1)),next=new Date(Date.UTC(y,month+(mode==="year"?12:6),1));
 return {start:start.toISOString().slice(0,10),end:new Date(next.getTime()-86400000).toISOString().slice(0,10),next:next.toISOString().slice(0,10)};
}

function oneUniversalCustom(start,end){
 const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
 if(!valid(start)||!valid(end)||end<start||(Date.parse(end)-Date.parse(start))/86400000>3660)throw Error("Elegí fechas válidas, en orden y dentro de diez años.");
 return {start,end,next:new Date(Date.parse(end+"T00:00:00Z")+86400000).toISOString().slice(0,10)};
}

function oneUniversalSlice(amount,source,r){
 const day=s=>Date.parse(s+"T00:00:00Z")/86400000;
 const a=day(source.start),b=day(source.end),lo=Math.max(a,day(r.start)),hi=Math.min(b,day(r.end));
 if(hi<lo)return 0;
 const cents=Math.round(amount*100),n=b-a+1;
 return (Math.round(cents*(hi-a+1)/n)-Math.round(cents*(lo-a)/n))/100;
}

function oneUniversalSources(legacy,native,endFor,r){
 const original=(legacy||[]).filter(p=>p.date).map(p=>({start:p.date,end:endFor(p),legacy:p}));
 const fresh=(native||[]).map(p=>({start:p.start,end:p.end,native:p}));
 const overlap=(a,b)=>a.start<=b.end&&a.end>=b.start;
 const rows=[...original.filter(p=>!fresh.some(n=>overlap(p,n))),...fresh].filter(p=>overlap(p,r)).sort((a,b)=>a.start.localeCompare(b.start));
 let cursor=Date.parse(r.start),finish=Date.parse(r.end)+86400000,complete=true;
 for(const p of rows){const a=Math.max(Date.parse(p.start),Date.parse(r.start)),b=Math.min(Date.parse(p.end)+86400000,finish);if(a!==cursor)complete=false;cursor=Math.max(cursor,b)}
 return {rows,complete:complete&&cursor===finish};
}

function oneLivingDays(r){
 const valid=oneUniversalCustom(r.start,r.end),days=[];
 for(let t=Date.parse(valid.start);t<=Date.parse(valid.end);t+=86400000)days.push(new Date(t).toISOString().slice(0,10));
 return days;
}

function oneLivingValidate(rows){
 if(rows===undefined)return;
 if(!Array.isArray(rows)||rows.length>200000)throw Error("Asignaciones de presupuesto inválidas.");
 const seen=new Set();
 for(const e of rows){
  if(!e||typeof e.categoryId!=="string"||!e.categoryId.trim()||typeof e.date!=="string"||!Number.isFinite(e.amount)||e.amount<0||e.amount>1e12||!["CRC","USD"].includes(e.currency))throw Error("Asignación de presupuesto inválida.");
  oneUniversalCustom(e.date,e.date);
  const key=JSON.stringify([e.categoryId,e.date]);if(seen.has(key))throw Error("Asignaciones duplicadas.");seen.add(key);
 }
}

function oneLivingReplace(rows,categoryId,r,amount,currency){
 if(!Number.isFinite(amount)||amount<0||amount>1e12||!["CRC","USD"].includes(currency))throw Error("Monto o moneda inválidos.");
 const days=oneLivingDays(r),cents=Math.round(amount*100),n=days.length;
 const next=(rows||[]).filter(e=>e.categoryId!==categoryId||e.date<r.start||e.date>r.end);
 days.forEach((date,i)=>next.push({categoryId,date,amount:(Math.round(cents*(i+1)/n)-Math.round(cents*i/n))/100,currency}));
 oneLivingValidate(next);return next;
}

function oneLivingSum(category,r,sources,overrides,baseSlice,toCRC){
 const relevant=(overrides||[]).filter(e=>e.categoryId===category.id&&e.date>=r.start&&e.date<=r.end);
 let amount=sources.reduce((s,p)=>s+baseSlice(p,category,r),0);
 for(const e of relevant){
  const day={start:e.date,end:e.date};
  amount-=sources.reduce((s,p)=>s+baseSlice(p,category,day),0);
  amount+=toCRC(e.amount,e.currency,category.type==="Ingreso"?"receive":"pay");
 }
 return Math.round(amount*100)/100;
}

function oneUniversalMetrics(r,through="",overrideRows=data.livingBudgets||[]){
 const base=oneFlexMetrics(r,through),coverage=oneUniversalSources(data.periods,data.flexBudgets,p=>periodEndDate(p),r);
 const slice=(s,c,scope=r)=>{
  const intent=c.type==="Ingreso"?"receive":"pay",entry=s.native?s.native.entries.find(e=>e.categoryId===c.id):null;
  const amount=s.native?(entry?.amount||0):num(s.legacy.categoryBudgets?.[c.id]);
  const currency=normalizeCurrency(s.native?entry?.currency:s.legacy.categoryBudgetCurrencies?.[c.id]);
  if(c.type==="Ingreso"){
   const cfg=normalizeIncomeConfig(c.incomeConfig||{});
   const dates=(s.native?oneFlexIncomeDates(cfg,s.start,s.end):(s.legacy.categoryBudgetScheduledDates?.[c.id]||oneFlexIncomeDates(cfg,s.start,s.end))).filter(d=>d>=s.start&&d<=s.end);
   if(dates.length){const cents=Math.round(amount*100),n=dates.length;return currentToCRC(dates.reduce((sum,d,i)=>sum+(d>=scope.start&&d<=scope.end?Math.round(cents*(i+1)/n)-Math.round(cents*i/n):0),0)/100,currency,intent)}
   return scope.start<=s.start&&scope.end>=s.end?currentToCRC(amount,currency,intent):0;
  }
  return currentToCRC(oneUniversalSlice(amount,s,scope),currency,intent);
 };
 const overrides=overrideRows;
 const categories=base.categories.map(x=>{
  const hasOverride=overrides.some(e=>e.categoryId===x.c.id&&e.date>=r.start&&e.date<=r.end);
  const known=x.c.type==="Ingreso"?coverage.rows.reduce((sum,s)=>sum+slice(s,x.c),0):oneLivingSum(x.c,r,coverage.rows,overrides,slice,currentToCRC);
  const complete=coverage.complete||(x.c.type!=="Ingreso"&&hasOverride&&oneLivingCategoryComplete(r,coverage.rows,overrides,x.c.id));
  return {...x,p:complete||hasOverride||known!==0?known:null,partial:!complete,hasOverride};
 });
 const plannedIncome=coverage.complete?categories.filter(x=>x.c.type==="Ingreso").reduce((s,x)=>s+x.p,0):null;
 const plannedOut=coverage.complete?categories.filter(x=>x.c.type!=="Ingreso").reduce((s,x)=>s+x.p,0):null;
 return {...base,coverage,categories,plannedIncome,plannedOut,pending:coverage.complete?categories.filter(x=>x.c.type!=="Ingreso").reduce((s,x)=>s+Math.max(0,x.p-x.a),0):null};
}

function oneLivingPartition(range,config,mode){
 if(!["week","fortnight","month","quarter","half","year"].includes(mode))throw Error("Escala inválida.");
 const parent=oneUniversalCustom(range.start,range.end),out=[];
 let cursor=parent.start;
 while(cursor<=parent.end){
  const whole=oneUniversalRange(cursor,config,mode),end=whole.end<parent.end?whole.end:parent.end;
  const part=oneUniversalCustom(cursor,end);
  out.push({...part,partial:cursor!==whole.start||end!==whole.end});
  cursor=part.next;
 }
 return out;
}

function oneLivingRedistribute(values,index,total){
 if(!Array.isArray(values)||values.length<2||!Number.isInteger(index)||index<0||index>=values.length||!Number.isFinite(total)||total<0||values.some(v=>!Number.isFinite(v)||v<0))throw Error("Montos inválidos.");
 const target=Math.round(total*100),fixed=Math.round(values[index]*100);
 if(fixed>target)throw Error("El importe seleccionado supera el presupuesto total.");
 const rest=target-fixed,others=values.map((v,i)=>({i,weight:i===index?0:Math.round(v*100)})).filter(x=>x.i!==index);
 const sum=others.reduce((a,b)=>a+b.weight,0);
 let cursor=0,previous=0;
 const next=values.slice();next[index]=fixed/100;
 for(const x of others){
  cursor+=sum?x.weight:1;
  const end=Math.round(rest*cursor/(sum||others.length));
  next[x.i]=(end-previous)/100;previous=end;
 }
 return next;
}

function oneLivingDistributionChanges(rows,categoryId,parts,original,values,currency){
 if(parts.length!==values.length||original.length!==values.length||values.some(v=>!Number.isFinite(v)||v<0||v>1e12))throw Error("Revisá los montos.");
 let next=rows||[];
 for(let i=0;i<parts.length;i++){
  if(original[i]!==null&&Math.round(original[i]*100)===Math.round(values[i]*100))continue;
  if(original[i]===null&&values[i]===0)continue;
  next=oneLivingReplace(next,categoryId,parts[i],values[i],currency);
 }
 return next;
}

function oneLivingCategoryComplete(r,sources,overrides,categoryId){
 const dates=new Set((overrides||[]).filter(e=>e.categoryId===categoryId&&e.date>=r.start&&e.date<=r.end).map(e=>e.date));
 if(!dates.size)return false;
 return oneLivingDays(r).every(date=>dates.has(date)||sources.filter(p=>p.start<=date&&p.end>=date).length===1);
}

function oneLivingContextParent(r,config){
 const n=(Date.parse(r.end)-Date.parse(r.start))/86400000+1;
 const fortnight=oneFlexRange(r.start,config,"fortnight");
 if(n<=7&&r.end<=fortnight.end&&(r.start!==fortnight.start||r.end!==fortnight.end))return fortnight;
 if(n<=31){
  const a=oneFlexRange(r.start,{day:1},"month"),b=oneFlexRange(r.end,{day:1},"month");
  return {start:a.start,end:b.end,next:b.next};
 }
 return {...r};
}

function oneLivingStatus(item,parent,elapsed,{future=false,closed=false,childOver=false}={}){
 const known=x=>!!x&&!x.partial&&Number.isFinite(x.p)&&Number.isFinite(x.a);
 const excess=x=>Math.max(0,Math.round((x.a-x.p)*100)/100);
 const result=(code,label,amount=0)=>({code,label,amount});
 if(future)return result("future","Plan futuro");
 if(!known(item))return result("unknown","Cobertura incompleta");
 if(item.p<=.005&&item.a>.005)return result("unassigned","Sin asignación",item.a);
 const over=excess(item)>.005,context=known(parent);
 if(over||childOver){
  if(context&&excess(parent)>.005)return result("excess","Exceso acumulado",excess(parent));
  if(context&&parent.p>.005){
   if(closed||known(elapsed)&&elapsed.a<=elapsed.p+.005)return result("compensated",closed?"Desviación compensada":"Compensada al corte",over?excess(item):0);
   return result("temporary","Desviación temporal",over?excess(item):0);
  }
  return result("local","Exceso del intervalo",over?excess(item):0);
 }
 if(item.p>.005&&item.a>=item.p-.005)return result("used","Presupuesto utilizado");
 if(!closed&&item.p>.005&&item.a/item.p>=.85)return result("near","Cerca del límite");
 return result("ok",item.p<=.005?"Sin actividad":"Dentro del plan");
}

function oneLivingLiquidity(balance,pending,known,complete){
 if(!known||!complete||!Number.isFinite(balance)||!Number.isFinite(pending)||pending<0)return null;
 const available=Math.round((balance-pending)*100)/100;
 return {available,shortfall:Math.max(0,-available),pending};
}

function oneLivingContextReport(r,m,config,today){
 const parent=oneLivingContextParent(r,config),same=parent.start===r.start&&parent.end===r.end;
 const outer=same?m:oneUniversalMetrics(parent,today),future=r.start>today;
 const elapsed=parent.start>today?null:parent.end<=today?outer:oneUniversalMetrics({start:parent.start,end:today},today);
 const children=same&&!future&&(Date.parse(r.end)-Date.parse(r.start))/86400000<=61?
   oneLivingPartition(r,config,"week").filter(p=>p.end<today&&(p.start!==r.start||p.end!==r.end)).map(p=>oneUniversalMetrics(p,today)):[];
 const outerMap=new Map(outer.categories.map(x=>[x.c.id,x])),elapsedMap=new Map((elapsed?.categories||[]).map(x=>[x.c.id,x]));
 const childOvers=new Set(children.flatMap(x=>x.categories.filter(c=>!c.partial&&c.p!==null&&c.a>c.p+.005).map(c=>c.c.id)));
 const statuses=new Map();
 for(const x of m.categories.filter(x=>x.c.type!=="Ingreso")){
  const a=outerMap.get(x.c.id),b=elapsedMap.get(x.c.id);
  const status=oneLivingStatus(x,a,b,{future,closed:parent.end<today,childOver:childOvers.has(x.c.id)});
  statuses.set(x.c.id,{...status,parentPlan:a?.partial?null:a?.p??null,parentActual:a?.a??null});
 }
 return {parent,statuses,future};
}

function oneLivingBalanceKnown(today){
 const first=allProjectedRows()[0];
 return !!latestReconciliation(today)||!!first&&first.date<=today&&first.opening!==null&&first.opening!==undefined&&first.opening!=="";
}

function oneLivingAdjustmentMessage(next,activeRange,today){
 const before=oneUniversalMetrics(activeRange,today),after=oneUniversalMetrics(activeRange,today,next);
 if(!before.coverage.complete||!after.coverage.complete||before.pending===null||after.pending===null)return "\nDisponibilidad: falta cobertura completa del período vigente.";
 const delta=Math.round((after.pending-before.pending)*100)/100;
 const scope=dateLabel(activeRange.start)+" – "+dateLabel(activeRange.end);
 const balance=actualBalanceAt(today),known=oneLivingBalanceKnown(today);
 const a=oneLivingLiquidity(balance,before.pending,known,true),b=oneLivingLiquidity(balance,after.pending,known,true);
 return "\nCompromisos pendientes ("+scope+"): "+money(before.pending)+" → "+money(after.pending)+
   (a&&b?"\nDisponible estimado, sin ingresos futuros: "+money(a.available)+" → "+money(b.available):"\nSaldo de partida sin confirmar.")+
   (Math.abs(delta)<.005?"\nSin cambio en compromisos del período vigente.":"");
}

function oneFlexRuntime(){
  const get=id=>document.getElementById(id),cfg=()=>oneFlexConfig(data.settings.financialPeriods,onePayDays(data.settings));
  let anchor="",mode="",universal=cfg().enabled||(data.livingBudgets||[]).length>0||(data.flexBudgets||[]).length>0,legacyPlan=false,legacyMove=false,legacyHome=false,storedRange=null,editing=null,breakdownMode="week";
  const pref=uiState.oloBudgetView||{};
  let planMode=["week","fortnight","month","quarter","half","year","custom"].includes(pref.mode)?pref.mode:(data.settings.financialPeriods?.mode||"month");
  let planAnchor=restoreValidDate(pref.anchor)?pref.anchor:todayIso(),planCustom=null,planBreak=["week","fortnight","month","quarter","half","year"].includes(pref.breakdown)?pref.breakdown:"";
  if(planMode==="custom"){try{planCustom=oneUniversalCustom(pref.start,pref.end)}catch{planMode="month"}}
  const planRange=()=>planMode==="custom"&&planCustom?planCustom:oneUniversalRange(planAnchor,cfg(),planMode);
  const rememberPlan=()=>{uiState.oloBudgetView={mode:planMode,anchor:planAnchor,breakdown:planBreak,...(planMode==="custom"&&planCustom?{start:planCustom.start,end:planCustom.end}:{})};saveUiState()};
  const nativePlanHeader=get("oneBudgetHeader");
  const nativePlanBody=get("oneFlexPlan");
  const plans=()=>Array.isArray(data.flexBudgets)?data.flexBudgets:[];
  const range=()=>storedRange||oneUniversalRange(anchor||todayIso(),cfg(),mode==="custom"?cfg().mode:mode||cfg().mode),label=r=>dateLabel(r.start)+" – "+dateLabel(r.end);
  const actualRows=r=>oneFlexDateRows(data.movements,r);
  const enabled=()=>universal||cfg().enabled,activePlan=()=>enabled()&&!legacyPlan,activeMove=()=>enabled()&&!legacyMove;
  const labels={week:"Semana",fortnight:"Quincena",month:"Mes",quarter:"Trimestre",half:"Semestre",year:"Año",custom:"Personalizado"};
  const controls=(where,r,active=true)=>'<div class="one-budget-secondary-filter"><div class="r8-view-switch"><button class="r8-period-arrow" type="button" data-flex-step="-1" aria-label="Anterior" '+(mode==="custom"?"disabled":"")+'>‹</button><button class="r8-period-arrow" type="button" data-flex-step="1" aria-label="Siguiente" '+(mode==="custom"?"disabled":"")+'>›</button><select aria-label="Período" data-flex-mode="'+where+'">'+Object.entries(labels).map(([k,v])=>'<option value="'+k+'" '+(k===(mode||cfg().mode)?"selected":"")+'>'+v+'</option>').join("")+'</select><button type="button" data-flex-today>Hoy</button></div><small>'+safe(label(r))+'</small></div>'+(mode==="custom"?'<div class="one-budget-custom"><input aria-label="Desde" type="date" data-flex-start value="'+r.start+'"><input aria-label="Hasta" type="date" data-flex-end value="'+r.end+'"><button type="button" class="btn secondary small" data-flex-custom>Aplicar</button></div>':"");
  const hide=(el,v)=>{if(el)el.hidden=v};
  // One visible budget, using the original R8 cards and editable values.
  const planHeader=()=>{
    const r=planRange();
    return '<div class="r8-view-switch one-budget-native-switch"><button class="r8-period-arrow" type="button" data-olo-plan-step="-1" aria-label="Período anterior" '+(planMode==="custom"?"disabled":"")+'>‹</button><button class="r8-period-arrow" type="button" data-olo-plan-step="1" aria-label="Período siguiente" '+(planMode==="custom"?"disabled":"")+'>›</button><select aria-label="Período de presupuesto" id="oloPlanPeriod">'+Object.entries(labels).map(([k,v])=>'<option value="'+k+'" '+(planMode===k?"selected":"")+'>'+v+'</option>').join("")+'</select><button type="button" data-olo-plan-today>Hoy</button></div>'+(planMode==="custom"?'<div class="one-budget-custom"><input aria-label="Desde" type="date" id="oloPlanStart" value="'+r.start+'"><input aria-label="Hasta" type="date" id="oloPlanEnd" value="'+r.end+'"><button type="button" class="btn secondary small" data-olo-plan-custom>Aplicar</button></div>':"");
  };
  const budgetRow=(x,r,report)=>{
    const c=x.c,status=report.statuses.get(c.id);
    const caution=status&&["excess","local","unassigned","temporary","compensated"].includes(status.code)?'<small class="one-living-status '+safe(status.code)+'">'+safe(status.label)+(status.amount>.005?' · '+safe(money(status.amount)):"")+'</small>':"";
    const attrs=' data-olo-category="'+safe(c.id)+'" data-olo-start="'+r.start+'" data-olo-end="'+r.end+'"';
    return '<div class="r8-budget-row"><span class="r8-budget-row-label"><span>'+safe(c.name)+'</span>'+(x.a>.005?'<small class="muted">Real: '+safe(money(x.a))+'</small>':"")+caution+'</span><span class="r8-edit-cell"><button type="button" class="r8-value-button" '+attrs+' title="'+(c.type==="Ingreso"?"Configurar ingreso":"Editar importe")+'">'+(x.p===null?"—":safe(money(x.p))+(x.partial?" *":""))+'</button></span></div>';
  };
  const budgetSection=(heading,rows,r,report)=>{
    const known=rows.filter(x=>x.p!==null),total=known.reduce((a,x)=>a+x.p,0),partial=rows.some(x=>x.partial);
    const visible=rows.filter(x=>x.p>0||x.a>0||x.hasOverride),unused=rows.filter(x=>!visible.includes(x)&&x.c.active!==false&&x.c.budgetable!==false);
    return '<div class="r8-section"><div class="r8-section-heading"><span>'+heading+'</span><strong>'+(!known.length?"—":safe(money(total))+(partial?" *":""))+'</strong></div>'+(visible.length?visible.map(x=>budgetRow(x,r,report)).join(""):'<div class="r8-empty-row">Sin asignaciones</div>')+(unused.length?'<details class="r8-unused"><summary>'+unused.length+' sin monto</summary>'+unused.map(x=>budgetRow(x,r,report)).join("")+'</details>':"")+'</div>';
  };
  const budgetCard=(r,title,m,report,main=false)=>{
    const future=r.start>todayIso(),current=r.start<=todayIso()&&r.end>=todayIso();
    const income=m.categories.filter(x=>x.c.type==="Ingreso"),expenses=m.categories.filter(x=>x.c.type!=="Ingreso");
    const flow=m.plannedIncome===null||m.plannedOut===null?null:m.plannedIncome-m.plannedOut;
    return '<article class="r8-fortnight-card '+(current?"current":"")+'"><div class="r8-card-main"><div class="r8-fortnight-heading"><h3>'+safe(title)+'</h3><span class="r8-chip'+(current?" current":"")+'">'+(current?"Actual":future?"Próximo":"Cerrado")+'</span></div><div class="r8-card-dates">'+safe(label(r))+'</div><div class="r8-card-closing-label">Flujo previsto</div><div class="r8-card-closing '+(flow!==null&&flow<0?"negative":"")+'">'+(flow===null?"—":safe(money(flow)))+'</div>'+budgetSection("Ingresos",income,r,report)+budgetSection("Gastos, deudas y ahorro",expenses,r,report)+'</div><div class="r8-card-footer"><button type="button" data-olo-add-category>+ Agregar categoría</button><button type="button" data-olo-distribute data-olo-start="'+r.start+'" data-olo-end="'+r.end+'">Distribuir</button></div></article>';
  };
  const renderNativePlan=()=>{
    const r=planRange(),today=todayIso(),m=oneUniversalMetrics(r,today),report=oneLivingContextReport(r,m,cfg(),today);
    nativePlanHeader.innerHTML=planHeader();
    get("planTitle").textContent="Presupuesto";get("r8PlanEyebrow").textContent="PLAN FINANCIERO";get("planSub").textContent=label(r);
    const live=oneUniversalRange(today,cfg(),cfg().mode),current=oneUniversalMetrics(live,today),balance=actualBalanceAt(today),available=oneLivingLiquidity(balance,current.pending,oneLivingBalanceKnown(today),current.coverage.complete);
    get("planQuarterSummary").innerHTML=[["Saldo operativo hoy",oneLivingBalanceKnown(today)?money(balance):"—"],["Compromisos pendientes",current.pending===null?"—":money(current.pending)],["Disponible estimado",available?money(available.available):"—"]].map(([k,v])=>'<div class="summary-box"><div class="summary-label">'+k+'</div><div class="summary-value">'+safe(v)+'</div></div>').join("");
    const choices=planMode==="week"?[]:planMode==="fortnight"?["week"]:planMode==="month"?["fortnight","week"]:planMode==="quarter"?["month","fortnight","week"]:["quarter","month","fortnight","week"];
    if(!choices.includes(planBreak))planBreak="";
    const parts=planBreak?oneLivingPartition(r,cfg(),planBreak):[];
    const heading=planMode==="month"?monthLabel(r.start.slice(0,7)):labels[planMode]||"Período";
    nativePlanBody.innerHTML='<section class="r8-month one-budget-native"><div class="r8-month-heading"><h2>'+safe(heading)+'</h2><div class="r8-month-actions">'+(choices.length?'<select id="oloPlanBreakdown" aria-label="Desglose"><option value="">Sin desglose</option>'+choices.map(k=>'<option value="'+k+'" '+(k===planBreak?"selected":"")+'>'+labels[k]+'</option>').join("")+'</select>':"")+'<button type="button" class="r8-month-copy" data-olo-export>Exportar</button></div></div><div class="one-budget-card-grid">'+(parts.length&&parts.length<=80?parts.map(p=>{const sub=oneUniversalMetrics(p,today);return budgetCard(p,p.partial?labels[planBreak]+" parcial":labels[planBreak],sub,oneLivingContextReport(p,sub,cfg(),today))}).join(""):budgetCard(r,labels[planMode]||"Período",m,report,true))+'</div>'+(parts.length>80?'<small class="muted">Elegí un desglose más amplio.</small>':"")+(m.categories.some(x=>x.partial)?'<small class="muted">* Asignación parcial o sin cobertura.</small>':"")+'</section>';
    oneRenderGoalBudgetPreview("flex",r);
  };
  const livingStatusHtml=status=>status?'<span class="one-living-status '+safe(status.code)+'">'+safe(status.label)+(status.amount>.005?' · '+safe(money(status.amount)):"")+'</span>':"—";
  const renderLivingContext=(report,rows,m,r)=>{
    const visible=rows.filter(x=>x.c.type!=="Ingreso"),statuses=visible.map(x=>report.statuses.get(x.c.id)).filter(Boolean);
    const count=c=>statuses.filter(x=>c.includes(x.code)).length;
    const review=count(["excess","local","unassigned"]),temporary=count(["temporary"]),compensated=count(["compensated"]),unknown=count(["unknown"]);
    const text=report.future?"Período futuro: todavía no hay ejecución.":review?review+" categoría(s) requieren revisión del monto acumulado o de su asignación.":compensated?"Hay desviaciones compensadas por el comportamiento acumulado.":temporary?"Hay desviaciones temporales; todavía pueden compensarse.":unknown?"Falta cobertura para emitir una comparación completa.":"Las categorías comparables están dentro de sus asignaciones.";
    const details=visible.filter(x=>["excess","local","unassigned","temporary","compensated"].includes(report.statuses.get(x.c.id)?.code)).map(x=>{const t=report.statuses.get(x.c.id);return '<div class="one-living-line"><span>'+safe(x.c.name)+'</span><span>'+livingStatusHtml(t)+(t.parentPlan===null?"":'<small> Acumulado: '+safe(money(t.parentActual))+' / '+safe(money(t.parentPlan))+'</small>')+'</span></div>'}).join("");
    return '<section class="one-living-context"><h4>Lectura del presupuesto</h4><p>'+safe(text)+'</p><p class="muted">Contexto: '+safe(label(report.parent))+' · Ejecución hasta hoy. '+(unknown?unknown+' categoría(s) sin cobertura completa. ':"")+'La distribución diaria es una referencia estimada, no una obligación de gasto diario.</p>'+(details?'<details><summary>Ver desviaciones por categoría</summary>'+details+'</details>':"")+'</section>';
  };
  const scales=["week","fortnight","month","quarter","half","year"];
  const scaleOptions=selected=>scales.map(k=>'<option value="'+k+'" '+(selected===k?"selected":"")+'>'+labels[k]+'</option>').join("");
  const renderBreakdown=(r,parentMetrics)=>{
    if(r.start===r.end)return "";
    const parts=oneLivingPartition(r,cfg(),breakdownMode);
    const heading='<div class="one-flex-toolbar"><h3>Desglose por períodos</h3><label>Expandir por <select data-living-breakdown>'+scaleOptions(breakdownMode)+'</select></label></div>';
    if(parts.length>80)return '<section class="v7-card">'+heading+'<p class="muted">Elegí una escala más amplia para ver hasta 80 bloques.</p></section>';
    const today=todayIso(),parentElapsed=r.start>today?null:r.end<=today?parentMetrics:oneUniversalMetrics({start:r.start,end:today},today);
    const byId=new Map(parentMetrics.categories.map(x=>[x.c.id,x])),elapsedById=new Map((parentElapsed?.categories||[]).map(x=>[x.c.id,x]));
    const rows=parts.map(p=>{
      const m=oneUniversalMetrics(p,today),known=m.categories.filter(x=>x.c.type!=="Ingreso"&&x.p!==null),total=known.reduce((sum,x)=>sum+x.p,0);
      return '<details class="one-living-part"><summary><span><strong>'+safe(label(p))+'</strong>'+(p.partial?' <small>Parcial</small>':'')+'</span><strong>'+(known.length?money(total):"—")+(m.coverage.complete?"":" *")+'</strong></summary><div class="one-living-detail"><p class="muted">Gastos y aportes registrados: '+money(m.actualOut)+'</p>'+known.filter(x=>x.p>0||x.a>0||x.hasOverride).map(x=>'<div class="one-living-line"><span>'+safe(x.c.name)+'</span><span><strong>'+money(x.a)+' / '+money(x.p)+'</strong> '+livingStatusHtml(oneLivingStatus(x,byId.get(x.c.id),elapsedById.get(x.c.id),{future:p.start>today,closed:r.end<today}))+'</span></div>').join("")+'<button class="btn secondary small" type="button" data-living-part-start="'+p.start+'" data-living-part-end="'+p.end+'">Editar este intervalo</button></div></details>';
    }).join("");
    return '<section class="v7-card one-living-breakdown">'+heading+'<p class="muted">Los bloques no se superponen. Se recortan al límite de la vista. * Cobertura parcial.</p>'+rows+'</section>';
  };
  globalThis.oneFlexMovementRange=()=>activeMove()?range():null;
  globalThis.oneFlexMovementScope=()=>activeMove()?actualRows(range()):null;
  const oldPlan=renderPlan,oldMoves=renderMovements,oldHome=renderDashboard;
  const homeControls=document.createElement("div");homeControls.id="oneFlexHome";homeControls.className="one-flex-panel";homeControls.hidden=true;
  get("dashboardFilters").parentNode.appendChild(homeControls);
  const chartNote=document.createElement("p");chartNote.id="oneFlexChartNote";chartNote.className="muted";chartNote.hidden=true;get("expenseChart").parentNode.appendChild(chartNote);
  renderDashboard=function(){
    const active=enabled()&&!legacyHome;
    hide(get("expenseChart"),false);hide(get("expenseChartLegend"),false);hide(chartNote,true);
    oldHome();homeControls.hidden=!active;hide(get("dashboardFilters"),active);
    if(active){const r=range();homeControls.innerHTML=controls("home",r);oneFlexDashboard(r,oneFlexRange(todayIso(),cfg()),label,true)}
    else {homeControls.innerHTML="";const f=get("dashboardFilters");if(f&&!f.querySelector("[data-olo-enter]"))f.insertAdjacentHTML("beforeend",'<button class="btn secondary small" type="button" data-olo-enter="home">Más períodos</button>')}
  };
  renderPlan=function(){
    // Keep legacy render hooks for existing record/quarter maintenance; never show the old cards.
    oldPlan();if(!nativePlanBody||!nativePlanHeader)return;
    nativePlanBody.hidden=false;
    hide(get("oneLegacyBudgetHeader"),true);hide(get("r8PlanOptions"),true);hide(get("planMonths"),true);
    hide(get("planQuarterSummary"),false);renderNativePlan();
  };
  renderMovements=function(){
    oldMoves();const panel=get("oneFlexMoves");if(!panel)return;
    const active=activeMove();panel.hidden=!active;
    const original=document.querySelector("#view-movements .one-move-period-control");hide(original,active);
    if(active){const r=range();panel.innerHTML=controls("move",r);const insight=document.querySelector("#movementQuick .one-move-insight-period");if(insight)insight.textContent=label(r);oneRenderGoalMovementPreview("flex",r)}
    else {panel.innerHTML="";if(original&&!original.querySelector("[data-olo-enter]"))original.insertAdjacentHTML("beforeend",'<button class="btn secondary small" type="button" data-olo-enter="move">Más períodos</button>')}
  };
  const redraw=()=>{renderPlan();renderMovements();renderDashboard();if(get("view-future")?.classList.contains("active"))renderFuture()},form=get("oneFlexSettingsForm");
  const fields={first:"oneFlexFirst",second:"oneFlexSecond",weekday:"oneFlexWeekday",day:"oneFlexDay",quarterMonth:"oneFlexQuarterMonth"};
  const read=()=>({enabled:true,mode:get("oneFlexMode").value,...Object.fromEntries(Object.entries(fields).map(([k,id])=>[k,Number(get(id).value)]))});
  const valid=c=>Number.isInteger(c.first)&&Number.isInteger(c.second)&&c.first>=1&&c.first<=27&&c.second>c.first&&c.second<=31;
  const update=()=>{const c=read();form.querySelectorAll("[data-flex-fields]").forEach(el=>{el.hidden=!el.dataset.flexFields.split(" ").includes(c.mode);el.querySelectorAll("input,select").forEach(x=>x.disabled=el.hidden)});get("oneFlexPreview").textContent=c.mode==="fortnight"&&!valid(c)?"Ingresá dos días válidos y diferentes.":"Período actual: "+label(oneFlexRange(todayIso(),c))};
  const fill=()=>{const c=cfg();get("oneFlexEnabled").checked=true;get("oneFlexMode").value=c.mode;Object.entries(fields).forEach(([k,id])=>get(id).value=c[k]);update()};
  form.addEventListener("input",update);
  form.addEventListener("submit",e=>{e.preventDefault();const raw=read();if(raw.mode==="fortnight"&&!valid(raw))return alert("El segundo corte debe ser posterior al primero.");const prev=data.settings.financialPeriods;data.settings.financialPeriods=oneFlexConfig(raw,onePayDays(data.settings));try{save()}catch(err){if(prev===undefined)delete data.settings.financialPeriods;else data.settings.financialPeriods=prev;fill();return alert("No se pudo guardar. No se modificaron tus movimientos.")}anchor="";mode="";storedRange=null;universal=true;legacyPlan=legacyMove=legacyHome=false;planMode=raw.mode;planAnchor=todayIso();planCustom=null;planBreak="";rememberPlan();fill();redraw();get("oneFlexStatus").textContent="Guardado."});
  get("oneSettingsBtn").addEventListener("click",fill);
  document.addEventListener("change",e=>{if(e.target.matches("[data-living-breakdown]")&&scales.includes(e.target.value)){breakdownMode=e.target.value;renderPlan();return;}if(e.target.matches("[data-flex-mode]")&&labels[e.target.value]){
    const prior=range();if(storedRange)anchor=storedRange.start;mode=e.target.value;universal=true;legacyPlan=legacyMove=legacyHome=false;
    storedRange=mode==="custom"?oneUniversalCustom(prior.start,prior.end):null;redraw();
  }});
  document.addEventListener("click",e=>{const b=e.target.closest("[data-flex-custom]");if(!b)return;const panel=b.parentNode;try{storedRange=oneUniversalCustom(panel.querySelector("[data-flex-start]").value,panel.querySelector("[data-flex-end]").value);anchor=storedRange.start;redraw()}catch(err){alert(err.message)}});
  document.addEventListener("click",e=>{const b=e.target.closest("[data-flex-step],[data-flex-today],[data-flex-legacy],[data-olo-enter]");if(!b)return;if(b.hasAttribute("data-olo-enter")){universal=true;mode="month";anchor=todayIso();storedRange=null;legacyHome=legacyMove=false;redraw();return;}if(b.hasAttribute("data-flex-step")){const r=range();anchor=b.dataset.flexStep==="1"?r.next:addDaysIso(r.start,-1);storedRange=null}else if(b.hasAttribute("data-flex-today")){anchor=todayIso();if(mode==="custom")mode=cfg().mode;storedRange=null}else if(b.dataset.flexLegacy==="plan")legacyPlan=!legacyPlan;else if(b.dataset.flexLegacy==="move")legacyMove=!legacyMove;else if(b.dataset.flexLegacy==="home")legacyHome=!legacyHome;redraw()});

  // Distribution editor: draft only until explicit confirmation.
  const distDialog=document.createElement("dialog");distDialog.id="oneLivingDistributionDialog";distDialog.className="one-settings-dialog";document.body.appendChild(distDialog);
  let distribution=null;
  const distTotal=vs=>vs.reduce((sum,v)=>sum+Math.round((v||0)*100),0)/100;
  const distLabel=v=>"₡"+Number(v).toLocaleString("es-CR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const readDistribution=()=>{
    const d=distribution,parts=oneLivingPartition(d.r,cfg(),d.scale);
    if(parts.length>80)throw Error("Elegí una escala más amplia: máximo 80 bloques.");
    d.parts=parts;d.complete=true;d.original=parts.map(p=>{
      const x=oneUniversalMetrics(p,todayIso()).categories.find(x=>x.c.id===d.categoryId);
      if(!x||x.partial)d.complete=false;
      return x?.p===null||x?.p===undefined?null:Math.round(x.p*100)/100;
    });
    d.values=d.original.map(v=>v??0);d.initial=distTotal(d.values);d.last=-1;
  };
  const updateDistribution=()=>{
    const d=distribution,delta=Math.round((distTotal(d.values)-d.initial)*100)/100;
    distDialog.querySelector("[data-dist-total]").textContent=distLabel(distTotal(d.values));
    distDialog.querySelector("[data-dist-impact]").textContent=delta===0?"El total del período se mantiene.":"El total del período "+(delta>0?"aumenta ":"disminuye ")+distLabel(Math.abs(delta))+".";
    distDialog.querySelector("[data-dist-redistribute]").disabled=d.last<0||d.parts.length<2||!d.complete||d.original.some(v=>v===null);
  };
  const renderDistribution=()=>{
    const d=distribution;
    distDialog.innerHTML='<form id="oneLivingDistributionForm" class="dialog-body one-flex-settings"><div class="one-flex-toolbar"><h2>Distribuir presupuesto</h2><button class="btn secondary small" type="button" data-dist-close>Cerrar</button></div><p class="muted">'+safe(label(d.r))+' · CRC</p><div class="one-flex-toolbar"><label>Categoría <select data-dist-category>'+d.cats.map(c=>'<option value="'+safe(c.id)+'" '+(c.id===d.categoryId?"selected":"")+'>'+safe(c.name)+'</option>').join("")+'</select></label><label>Dividir por <select data-dist-scale>'+scaleOptions(d.scale)+'</select></label></div>'+d.parts.map((p,i)=>'<div class="one-flex-entry"><label>'+safe(label(p))+(p.partial?' <small>Bloque parcial</small>':'')+(d.original[i]===null?' <small>Sin importe conocido</small>':'')+'</label><input type="number" min="0" max="1000000000000" step="0.01" data-dist-index="'+i+'" value="'+safe(String(d.values[i]))+'" aria-label="Monto '+safe(label(p))+'"><small>CRC</small></div>').join("")+'<div class="one-living-line"><span>Total original conocido</span><strong>'+safe(distLabel(d.initial))+'</strong></div><div class="one-living-line"><span>Total actualizado</span><strong data-dist-total></strong></div><p class="muted" data-dist-impact aria-live="polite"></p><p class="muted">Mantener total ajusta los demás bloques.</p><div class="one-flex-toolbar"><button class="btn secondary" type="button" data-dist-redistribute>Mantener total</button><button class="btn secondary" type="button" data-dist-close>Cancelar</button><button class="btn" type="submit">Guardar distribución</button></div></form>';
    updateDistribution();
  };
  const openDistribution=(r,categoryId)=>{
    const cats=oneUniversalMetrics(r,todayIso()).categories.filter(x=>x.c.type!=="Ingreso"&&(x.c.active!==false&&x.c.budgetable!==false||x.p>0||x.hasOverride)).map(x=>x.c);
    if(!cats.length)return alert("No hay categorías de gasto o deuda para distribuir.");
    const days=oneLivingDays(r).length;
    distribution={r:{start:r.start,end:r.end},cats,categoryId:cats.some(c=>c.id===categoryId)?categoryId:cats[0].id,scale:days>2400?"quarter":days>540?"month":"week"};
    try{readDistribution();renderDistribution();distDialog.showModal()}catch(err){alert(err.message)}
  };
  distDialog.addEventListener("input",e=>{
    const input=e.target;if(!input.matches("[data-dist-index]"))return;
    const i=Number(input.dataset.distIndex),v=Number(input.value);
    if(input.value===""||!Number.isFinite(v)||v<0||v>1e12)return;
    distribution.values[i]=v;distribution.last=i;updateDistribution();
  });
  distDialog.addEventListener("change",e=>{
    const input=e.target;if(!input.matches("[data-dist-category],[data-dist-scale]"))return;
    const d=distribution,oldId=d.categoryId,oldScale=d.scale;
    if(d.values.some((v,i)=>Math.round(v*100)!==Math.round((d.original[i]||0)*100))&&!confirm("¿Descartar los cambios todavía no guardados?")){input.value=input.matches("[data-dist-category]")?oldId:oldScale;return}
    if(input.matches("[data-dist-category]"))d.categoryId=input.value;else d.scale=input.value;
    try{readDistribution();renderDistribution()}catch(err){d.categoryId=oldId;d.scale=oldScale;readDistribution();renderDistribution();alert(err.message)}
  });
  distDialog.addEventListener("click",e=>{
    if(e.target.closest("[data-dist-close]")){distDialog.close();return}
    if(!e.target.closest("[data-dist-redistribute]"))return;
    try{const d=distribution;d.values=oneLivingRedistribute(d.values,d.last,d.initial);renderDistribution()}catch(err){alert(err.message)}
  });
  distDialog.addEventListener("submit",e=>{
    if(e.target.id!=="oneLivingDistributionForm")return;e.preventDefault();
    const d=distribution,previous=data.livingBudgets;
    try{
      const inputs=[...distDialog.querySelectorAll("[data-dist-index]")];
      if(inputs.some(x=>x.value===""))throw Error("Completá los montos.");
      d.values=inputs.map(x=>Number(x.value));
      const next=oneLivingDistributionChanges(previous,d.categoryId,d.parts,d.original,d.values,"CRC");
      if(next===previous){distDialog.close();return}
      if(!confirm("¿Guardar distribución? Total conocido: "+distLabel(d.initial)+" → "+distLabel(distTotal(d.values))+". Los ajustes quedan en CRC. Los movimientos no cambiarán."+oneLivingAdjustmentMessage(next,oneFlexRange(todayIso(),cfg()),todayIso())))return;
      data.livingBudgets=next;save();
    }catch(err){if(previous===undefined)delete data.livingBudgets;else data.livingBudgets=previous;return alert("No se guardó la distribución. "+err.message)}
    distDialog.close();redraw();
  });

  // Dated replacements: one effective allocation per category and date.
  const livingDialog=document.createElement("dialog");livingDialog.className="one-settings-dialog";livingDialog.id="oneLivingBudgetDialog";document.body.appendChild(livingDialog);
  let livingEdit=null;
  const openLivingEditor=r=>{
    const metrics=oneUniversalMetrics(r,todayIso()),currency=displayCurrency();
    const cats=metrics.categories.filter(x=>["Gasto","Pago deuda"].includes(x.c.type)&&(x.c.active!==false&&x.c.budgetable!==false||x.p>0||x.hasOverride));
    livingEdit={r:{start:r.start,end:r.end},currency,cats};
    livingDialog.innerHTML='<form class="dialog-body one-flex-settings" id="oneLivingForm"><div class="one-flex-toolbar"><h2>Editar presupuesto</h2><button class="btn secondary small" type="button" data-living-close>Cerrar</button></div><p class="muted">'+safe(label(r))+' · '+safe(currency)+' · Modificá únicamente las categorías deseadas. El monto reemplaza lo asignado en estas fechas, no se suma como otro presupuesto. Las demás fechas se conservan.</p>'+cats.map(x=>{
      const v=x.p===null?"":String(Math.round((currency==="USD"?x.p/currentToCRC(1,"USD","pay"):x.p)*100)/100);
      return '<div class="one-flex-entry" data-living-category="'+safe(x.c.id)+'"><label>'+safe(x.c.name)+(x.partial?' <small>Importe conocido, cobertura parcial</small>':'')+'</label><input type="number" min="0" max="1000000000000" step="0.01" data-original="'+safe(v)+'" value="'+safe(v)+'" placeholder="Sin asignar" aria-label="Presupuesto de '+safe(x.c.name)+'"><small>'+safe(currency)+'</small></div>';
    }).join("")+'<p class="muted">Dejá sin cambios las categorías que no querés editar. Cero elimina el importe efectivo de este intervalo, sin borrar el plan original.</p><div class="one-flex-toolbar"><button class="btn secondary" type="button" data-living-close>Cancelar</button><button class="btn" type="submit">Guardar ajustes</button></div></form>';
    livingDialog.showModal();
  };
  livingDialog.addEventListener("click",e=>{if(e.target.closest("[data-living-close]"))livingDialog.close()});
  livingDialog.addEventListener("submit",e=>{
    if(e.target.id!=="oneLivingForm"||!livingEdit)return;e.preventDefault();
    const previous=data.livingBudgets,changes=[];
    try{
      let next=previous||[];
      for(const row of livingDialog.querySelectorAll("[data-living-category]")){
        const input=row.querySelector("input"),v=input.value;
        if(v===input.dataset.original||v==="")continue;
        const amount=Number(v),categoryId=row.dataset.livingCategory;
        const original=livingEdit.cats.find(x=>x.c.id===categoryId),previousCRC=original?.p??0;
        next=oneLivingReplace(next,categoryId,livingEdit.r,amount,livingEdit.currency);
        changes.push({categoryId,delta:currentToCRC(amount,livingEdit.currency,"pay")-previousCRC});
      }
      if(!changes.length){livingDialog.close();return}
      const delta=changes.reduce((s,x)=>s+x.delta,0);
      if(!confirm("¿Guardar "+changes.length+" ajuste(s) para "+label(livingEdit.r)+"? El presupuesto conocido "+(delta>=0?"aumentará ":"disminuirá ")+money(Math.abs(delta))+". No cambia ningún movimiento real."+oneLivingAdjustmentMessage(next,oneFlexRange(todayIso(),cfg()),todayIso())))return;
      data.livingBudgets=next;save();
    }catch(err){if(previous===undefined)delete data.livingBudgets;else data.livingBudgets=previous;return alert("No se guardaron los ajustes. "+(err.message||"Revisá los datos."))}
    livingDialog.close();livingEdit=null;redraw();
  });

  // Explicit range plans; old quincenal allocations stay untouched and never enter a native range twice.
  const dialog=document.createElement("dialog");dialog.className="one-settings-dialog";dialog.id="oneFlexBudgetDialog";
  document.body.appendChild(dialog);
  const seed=(r,c)=>{
    const cfg=c.type==="Ingreso"?normalizeIncomeConfig(c.incomeConfig||{}):null;
    const dates=cfg?oneFlexIncomeDates(cfg,r.start,r.end):[];
    if(cfg?.projectAutomatically)return {amount:Math.round(dates.length*cfg.expectedAmount*100)/100,currency:cfg.expectedCurrency,dates};
    const coverage=oneFlexPlanCoverage(data.periods||[],r.start,r.end,p=>periodEndDate(p));
    if(!coverage.complete)return {amount:"",currency:displayCurrency()};
    const entries=coverage.rows.filter(p=>num(p.categoryBudgets?.[c.id])!==0);
    if(!entries.length)return {amount:"",currency:displayCurrency()};
    const currencies=[...new Set(entries.map(p=>normalizeCurrency(p.categoryBudgetCurrencies?.[c.id])))];
    if(currencies.length===1)return {amount:Math.round(entries.reduce((s,p)=>s+num(p.categoryBudgets[c.id]),0)*100)/100,currency:currencies[0]};
    return {amount:Math.round(entries.reduce((s,p)=>s+periodCategoryBudgetCRC(p,c.id,c.type==="Ingreso"?"receive":"pay"),0)*100)/100,currency:"CRC"};
  };
  const openEditor=(r,existing=null)=>{
    if(!existing&&(r.end<todayIso()||oneFlexBudgetOverlap(plans(),r.start,r.end)))return;
    if(!existing&&!confirm("¿Crear un presupuesto propio para "+label(r)+"? El plan anterior se conservará sin cambios. Si coincide completamente, sugeriremos sus montos; los ingresos automáticos usarán las fechas de pago. No se inventarán repartos."))return;
    editing={range:{start:r.start,end:r.end},mode:existing?.mode||mode||cfg().mode,id:existing?.id||""};
    const cats=sortedCategories((data.categories||[]).filter(c=>["Ingreso","Gasto","Pago deuda"].includes(c.type)&&((c.active!==false&&c.budgetable!==false)||existing?.entries.some(e=>e.categoryId===c.id))));
    const known=new Set(cats.map(c=>c.id)),orphan=(existing?.entries||[]).filter(e=>!known.has(e.categoryId));
    editing.orphans=orphan;
    dialog.innerHTML='<form id="oneFlexBudgetForm" class="dialog-body one-flex-settings"><div class="one-flex-toolbar"><h2>'+safe(existing?"Editar presupuesto":"Nuevo presupuesto")+'</h2><button type="button" class="btn secondary small" data-flex-close>Cerrar</button></div><p class="muted">'+safe(label(r))+' · Los montos corresponden al período completo. Los ingresos sugeridos son editables.</p>'+["Ingreso","Gasto","Pago deuda"].map(type=>'<section><h3>'+safe(categoryTypeLabel(type))+'</h3>'+cats.filter(c=>c.type===type).map(c=>{
      const prior=existing?.entries.find(e=>e.categoryId===c.id),suggestion=existing?{amount:"",currency:displayCurrency()}:seed(r,c),e=prior||suggestion;
      return '<div class="one-flex-entry" data-flex-category="'+safe(c.id)+'"><label>'+safe(c.name)+(e.dates?.length?'<small>'+safe(e.dates.map(dateLabel).join(" · "))+'</small>':"")+'</label><input type="number" min="0" step="0.01" max="1000000000000" value="'+safe(String(e.amount))+'" aria-label="Monto de '+safe(c.name)+'" placeholder="Sin asignar"><select aria-label="Moneda de '+safe(c.name)+'"><option value="CRC" '+(e.currency==="CRC"?"selected":"")+'>CRC</option><option value="USD" '+(e.currency==="USD"?"selected":"")+'>USD</option></select></div>';
    }).join("")+'</section>').join("")+(orphan.length?'<p class="muted">Se conservarán también '+orphan.length+' asignaciones de categorías que ya no están disponibles.</p>':"")+'<div class="one-flex-toolbar"><button type="button" class="btn secondary" data-flex-close>Cancelar</button><button type="submit" class="btn">Guardar presupuesto</button></div></form>';
    dialog.showModal();
  };
  dialog.addEventListener("click",e=>{if(e.target.closest("[data-flex-close]"))dialog.close()});
  dialog.addEventListener("submit",e=>{
    if(e.target.id!=="oneFlexBudgetForm"||!editing)return;e.preventDefault();
    const entries=[...editing.orphans];
    for(const row of dialog.querySelectorAll("[data-flex-category]")){
      const v=row.querySelector("input").value;if(v==="")continue;
      const amount=Number(v),currency=row.querySelector("select").value;
      if(!Number.isFinite(amount)||amount<0||!["CRC","USD"].includes(currency))return alert("Revisá los montos y monedas.");
      entries.push({categoryId:row.dataset.flexCategory,amount,currency});
    }
    const {range:r,mode:cadence,id:priorId}=editing;
    if(oneFlexBudgetOverlap(plans(),r.start,r.end,priorId))return alert("Este rango se superpone con otro presupuesto flexible.");
    const previous=data.flexBudgets,prior=plans().find(p=>p.id===priorId);
    const candidate={id:priorId||id(),start:r.start,end:r.end,mode:cadence,entries,createdAt:prior?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    const next=[...plans().filter(p=>p.id!==priorId),candidate];
    try{oneFlexValidateBudgets(next);data.flexBudgets=next;save()}catch(err){if(previous===undefined)delete data.flexBudgets;else data.flexBudgets=previous;return alert("No se pudo guardar el presupuesto. Tus registros anteriores siguen intactos.")}
    dialog.close();editing=null;redraw();
  });
  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-flex-new],[data-flex-edit],[data-flex-open],[data-flex-export],[data-living-edit],[data-living-distribute],[data-living-part-start]");if(!b)return;
    if(b.hasAttribute("data-living-distribute")){openDistribution(range(),b.dataset.livingDistribute);return;}
    if(b.hasAttribute("data-living-part-start")){openLivingEditor(oneUniversalCustom(b.dataset.livingPartStart,b.dataset.livingPartEnd));return;}
    if(b.hasAttribute("data-living-edit")){openLivingEditor(range());return;}
    if(b.hasAttribute("data-flex-export")){
      const r=range(),m=universal?oneUniversalMetrics(r,todayIso()):oneFlexMetrics(r,todayIso()),currency=displayCurrency();
      const amount=v=>v===null?"":Math.round(fromCRC(v,currency)*100)/100;
      const rows=[["Desde","Hasta","Categoría","Tipo","Moneda de visualización","Presupuesto","Real hasta hoy","Diferencia favorable","Cobertura del plan"],...m.categories.filter(x=>x.p>0||x.a>0||x.hasOverride).map(x=>[r.start,r.end,x.c.name,x.c.type,currency,amount(x.p),amount(x.a),amount(x.p===null||x.partial||(!universal&&!m.coverage.complete)?null:x.c.type==="Ingreso"?x.a-x.p:x.p-x.a),(universal?!x.partial:m.coverage.complete)?"Completa":"Incompleta"])];
      download("presupuesto-"+r.start+"-"+r.end+".csv","\ufeff"+rows.map(row=>row.map(csvEscape).join(",")).join("\n"),"text/csv");return;
    }
    if(b.hasAttribute("data-flex-open")){
      const p=plans().find(x=>x.id===b.dataset.flexOpen);if(!p)return;
      mode=p.mode;anchor=p.start;storedRange={start:p.start,end:p.end,next:addDaysIso(p.end,1)};legacyPlan=false;universal=true;redraw();return;
    }
    const r=range(),p=plans().find(x=>x.start===r.start&&x.end===r.end);
    openEditor(r,b.hasAttribute("data-flex-edit")?p:null);
  });
  const editOne=(r,c)=>{
    if(c.type==="Ingreso"){openCategory(c);return}
    const x=oneUniversalMetrics(r,todayIso()).categories.find(x=>x.c.id===c.id);
    const currency=displayCurrency(),rate=currency==="USD"?currentToCRC(1,"USD","pay"):1;
    const initial=x?.p===null||x?.p===undefined?"":String(Math.round(x.p/rate*100)/100);
    livingDialog.classList.add("one-budget-edit-dialog");
    livingEdit={r,currency,cats:x?[x]:[]};
    livingDialog.innerHTML='<form id="oneLivingForm" class="dialog-body one-flex-settings"><div class="one-budget-edit-head"><h2>'+safe(c.name)+'</h2><button class="btn secondary small" type="button" data-living-close aria-label="Cerrar">×</button></div><p class="muted">'+safe(label(r))+'</p><div class="one-flex-entry" data-living-category="'+safe(c.id)+'"><label>Monto</label><input type="number" min="0" max="1000000000000" step="0.01" data-original="'+safe(initial)+'" value="'+safe(initial)+'" placeholder="0" aria-label="Monto"><small>'+currency+'</small></div><div class="one-budget-edit-actions"><button class="btn secondary" type="button" data-living-close>Cancelar</button><button class="btn" type="submit">Guardar</button></div></form>';
    livingDialog.showModal();livingDialog.querySelector("input")?.focus();livingDialog.querySelector("input")?.select();
  };
  nativePlanHeader.addEventListener("change",e=>{if(e.target.id!=="oloPlanPeriod")return;const prior=planRange();planAnchor=prior.start;planMode=e.target.value;planCustom=planMode==="custom"?oneUniversalCustom(prior.start,prior.end):null;planBreak="";rememberPlan();renderPlan()});
  nativePlanHeader.addEventListener("click",e=>{const b=e.target.closest("[data-olo-plan-step],[data-olo-plan-today],[data-olo-plan-custom]");if(!b)return;try{if(b.hasAttribute("data-olo-plan-today")){planAnchor=todayIso();if(planMode==="custom"){planMode="month";planCustom=null}}else if(b.hasAttribute("data-olo-plan-custom")){planCustom=oneUniversalCustom(get("oloPlanStart").value,get("oloPlanEnd").value);planAnchor=planCustom.start}else{const r=planRange();planAnchor=b.dataset.oloPlanStep==="1"?r.next:addDaysIso(r.start,-1)}rememberPlan();renderPlan()}catch(err){alert(err.message)}});
  nativePlanBody.addEventListener("change",e=>{if(e.target.id==="oloPlanBreakdown"){planBreak=e.target.value;rememberPlan();renderPlan()}});
  nativePlanBody.addEventListener("click",e=>{
    const b=e.target.closest("[data-olo-category],[data-olo-distribute],[data-olo-add-category],[data-olo-export]");if(!b)return;
    if(b.hasAttribute("data-olo-add-category")){openCategory();return}
    if(b.hasAttribute("data-olo-export")){const r=planRange(),m=oneUniversalMetrics(r,todayIso()),rows=[["Desde","Hasta","Categoría","Presupuesto CRC","Real CRC"],...m.categories.filter(x=>x.p>0||x.a>0||x.hasOverride).map(x=>[r.start,r.end,x.c.name,x.p??"",x.a])];download("presupuesto-"+r.start+"-"+r.end+".csv","\ufeff"+rows.map(x=>x.map(csvEscape).join(",")).join("\n"),"text/csv");return}
    const r=oneUniversalCustom(b.dataset.oloStart,b.dataset.oloEnd);
    if(b.hasAttribute("data-olo-distribute")){openDistribution(r,"");return}
    const c=categoryById(b.dataset.oloCategory);if(c)editOne(r,c);
  });
  document.querySelectorAll("[data-olo-maintenance]").forEach(b=>b.addEventListener("click",()=>get(b.dataset.oloMaintenance)?.click()));
  fill();redraw();
}
