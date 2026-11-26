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
  if(periods.some(oneV15IsFlexiblePeriod)){
    if(periods.some(p=>!oneV15IsFlexiblePeriod(p)))return null;
    const ordered=[...periods].sort((a,b)=>a.date.localeCompare(b.date));
    const first=month+"-01",last=oneShiftDate(oneMonthShift(month,1)+"-01",-1);
    if(ordered[0]?.date!==first||ordered.at(-1)?.endDate!==last||
       ordered.some((p,i)=>periodEndDate(p)>=asOf||(i>0&&p.date!==oneShiftDate(ordered[i-1].endDate,1))))return null;
  }else if(periods.length!==2||new Set(periods.map(p=>Number(p.fortnight))).size!==2||
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

  const snapshot=oneV15CurrentBudget(todayIso()),insight=document.getElementById("dashboardInsight"),a=snapshot?.analysis;
  const title=!a?"Presupuesto pendiente de revisión":a.over.length||a.unbudgeted.length?"Revisá tu presupuesto":a.ahead.length?"Gasto por encima del ritmo de referencia":snapshot.hasPlan?"Dentro del presupuesto":"Definí tu presupuesto";
  const label=snapshot?dateLabel(snapshot.p.date)+" – "+dateLabel(periodEndDate(snapshot.p)):"Sin período vigente";
  const text=a?(a.over.length||a.unbudgeted.length?
    a.over.length+" categoría(s) con exceso · "+a.unbudgeted.length+" sin presupuesto.":
    a.ahead.length?a.ahead.length+" categoría(s) por encima del ritmo lineal por días.":
    snapshot.hasPlan?"No hay excesos ni gastos sin asignación en el período actual.":"Asigná montos para comenzar la comparación."):
    "No hay un período vigente con información verificable.";
  insight.innerHTML='<div class="v7-insight-icon">▥</div><h3>'+safe(title)+'</h3><p>'+safe(label)+' · '+safe(text)+'</p>'+
    (a&&snapshot.hasPlan?'<span class="v7-status-pill">Pendiente: '+safe(money(a.remaining/100))+'</span>':"");

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
    const chartLabels=rows.map(r=>oneV15IsFlexiblePeriod(r)?dateLabel(r.date):level==="quarter"?`${monthLabel(r.budgetMonth).slice(0,3)} ${r.fortnight}Q`:level==="month"?`${r.fortnight}.ª`:dateLabel(r.date).replace(/ de /g," "));
    drawBarChart(expCanvas,chartLabels.length?chartLabels:["Sin datos"],chartLabels.length?rows.map(r=>r.expenses):[0],chartLabels.length?rows.map(r=>r.actualExpenses):[0]);
  }
};

const renderPlanLegacy=renderPlan;
renderPlan=function(){
  renderPlanLegacy();
  const {level,value}=hierarchicalSelection("plan");
  if(["week","custom"].includes(level))return;
  const label=value?selectedLabel(level,value):"Sin periodo";
  document.getElementById("planTitle").textContent="Presupuesto";
  const extended=level==="half"||level==="year";
  const slots=new Set(data.periods.filter(p=>oneV15PlanMatches(p,level,value)).map(p=>p.budgetMonth+"|"+p.fortnight));
  const mixed=data.periods.some(p=>oneV15IsFlexiblePeriod(p)&&oneV15PlanMatches(p,level,value));
  const partial=extended&&!mixed&&slots.size!==(level==="half"?12:24);
  document.getElementById("planSub").textContent=`Tu plan de lo que entra, lo que sale y lo que te queda. · ${label}${mixed&&extended?" · Agrupación por mes de referencia":partial?" · Período incompleto":""}`;
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
  if(fortnight)Array.from(fortnight.options).forEach(o=>{if(o.value==="1"||o.value==="2")o.textContent=o.value==="1"?"Primera quincena":"Segunda quincena"});
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
  // Context is the current financial period, never the filtered feed.
  const currentBudget=oneV15CurrentBudget(todayIso());
  if(currentBudget){
    const html=oneV15IntelligenceHtml(currentBudget.rows,currentBudget.p.date,periodEndDate(currentBudget.p),todayIso());
    if(html)document.getElementById("movementQuick").insertAdjacentHTML("beforeend",'<div class="r8-card-dates">Presupuesto vigente · '+safe(dateLabel(currentBudget.p.date))+' – '+safe(dateLabel(periodEndDate(currentBudget.p)))+' (todos los movimientos del período)</div>'+html);
  }
  m2RenderAccountSummary(rows);m2RenderTemplates();m2RenderAudit();
  oneRenderGoalMovementPreview(level,value);
};

// La agenda es una vista derivada: nunca altera deudas, movimientos ni cuotas históricas.
