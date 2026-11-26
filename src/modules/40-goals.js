function oneGoalBudgetCategory(r){
  if(!r)return "";
  return Object.prototype.hasOwnProperty.call(r,"budgetCategoryId")?r.budgetCategoryId||"":oneSuggestedSavingsCategoryId();
}
function oneSavingsBudgetPlanned(rows){
  const linked=new Set((data.reserves||[]).filter(r=>r.type==="goal").map(oneGoalBudgetCategory).filter(Boolean));
  const suggested=oneSuggestedSavingsCategoryId();if(suggested)linked.add(suggested);
  return rows.reduce((sum,p)=>sum+[...linked].reduce((acc,cid)=>acc+periodCategoryBudgetCRC(p,cid,"pay"),0),0);
}
function oneContributionCategory(t){
  return Object.prototype.hasOwnProperty.call(t,"budgetCategoryId")?t.budgetCategoryId||"":
    oneGoalBudgetCategory((data.reserves||[]).find(r=>r.id===t.reserveId));
}
function oneBudgetSavingsActual(p,cid,throughDate=""){
  if(!cid)return 0;
  return (data.reserveMovements||[]).filter(t=>t.type==="Aporte"&&oneContributionCategory(t)===cid&&
    periodKey(periodForDate(t.date)||{})===periodKey(p)&&(!throughDate||t.date<=throughDate))
    .reduce((sum,t)=>sum+reserveTxnHistoricalCRC(t,"pay"),0);
}
function oneFillGoalBudgetCategory(id,selected=null){
  const el=document.getElementById(id);if(!el)return;
  const choices=[{value:"",label:"Sin categoría vinculada"},...oneSavingsCategories().map(c=>({value:c.id,label:c.name}))];
  fillObjectSelect(el,choices,selected===null?oneSuggestedSavingsCategoryId():selected);
}
function oneGoalMonthsLeft(r,asOf=todayIso()){
  if(!r?.targetDate||!restoreValidDate(r.targetDate)||r.targetDate<=asOf)return 0;
  const end=Date.parse(r.targetDate+"T00:00:00Z"),start=Date.parse(asOf+"T00:00:00Z");
  return Math.max(1,Math.ceil((end-start)/(86400000*30.436875)));
}
function oneGoalMonthlySuggestion(r,asOf=todayIso()){
  if(r?.type!=="goal"||reserveStatus(r)!=="active")return 0;
  const months=oneGoalMonthsLeft(r,asOf),remaining=Math.max(0,reserveTargetCRC(r)-reserveBalanceAt(r,asOf));
  return months&&reserveTargetCRC(r)>0?remaining/months:0;
}
function oneGoalTxnEligibility(r,candidate=null,editingId=""){
  if(!r)return {ok:false,error:"No se encontró el fondo."};
  if(!["goal","protected"].includes(r.type))return {ok:false,error:"El tipo de fondo no es válido."};
  if(candidate&&reserveStatus(r)==="archived")return {ok:false,error:"Reactivá el fondo antes de registrar un movimiento."};
  if(candidate&&!["Aporte","Retiro a operación","Uso objetivo","Rendimiento","Ajuste"].includes(candidate.type))
    return {ok:false,error:"Tipo de operación desconocido."};
  if(candidate&&(!restoreValidDate(candidate.date)||!Number.isFinite(Number(candidate.amount))||Number(candidate.amount)<=0))
    return {ok:false,error:"Ingresá una fecha válida y un monto mayor que cero."};
  if(candidate&&r.openingDate&&candidate.date<r.openingDate)
    return {ok:false,error:"La operación no puede ser anterior a la fecha de inicio del fondo."};
  const original=editingId||r.id;
  const transactions=[...(data.reserveMovements||[]).filter(t=>t.reserveId===original)];
  if(candidate)transactions.push(candidate);
  const opening=r.openingDate&&restoreValidDate(r.openingDate)?r.openingDate:"0000-01-01";
  let balance=0;
  const events=[
    {date:opening,delta:currentToCRC(r.openingAmount,r.openingCurrency||"CRC","receive"),positive:true},
    ...transactions.map(t=>({date:t.date,delta:reserveTxnDelta(t),positive:reserveTxnDelta(t)>=0}))
  ].sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(b.positive)-Number(a.positive));
  for(const event of events){
    if(!restoreValidDate(event.date)&&event.date!=="0000-01-01")
      return {ok:false,error:"Hay operaciones anteriores con fechas inválidas."};
    balance+=event.delta;
    if(balance<-.005)return {ok:false,error:"Esta operación dejaría el fondo con saldo negativo. Revisá el saldo disponible y los movimientos posteriores."};
  }
  return {ok:true};
}
function oneGoalSelectedTransactions(level,value){
  return (data.reserveMovements||[]).filter(t=>{
    const p=periodForDate(t.date);
    return p&&oneV15PlanMatches(p,level,value);
  }).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
function oneRenderGoalCards(){
  const summary=document.getElementById("goalSummary"),grid=document.getElementById("goalCardGrid");
  if(!summary||!grid)return;
  const today=todayIso(),goals=(data.reserves||[]).filter(r=>r.type==="goal");
  const active=goals.filter(r=>reserveStatus(r)==="active"),saved=goals.reduce((sum,r)=>sum+reserveBalanceAt(r,today),0);
  summary.innerHTML='<div class="one-goal-total"><span>AHORRADO EN METAS</span><strong>'+money(saved)+'</strong><small>Incluye metas archivadas con saldo</small></div>'+
    '<div class="one-goal-total"><span>METAS ACTIVAS</span><strong>'+active.length+'</strong><small>Objetivos de ahorro en marcha</small></div>';
  const filter=document.getElementById("goalStatusFilter")?.value||"active";
  const visible=goals.filter(r=>filter==="all"||reserveStatus(r)===filter);
  grid.innerHTML=visible.length?visible.map(r=>{
    const balance=reserveBalanceAt(r,today),target=reserveTargetCRC(r),remaining=Math.max(0,target-balance);
    const pct=target>0?Math.min(100,Math.max(0,balance/target*100)):0;
    const archived=reserveStatus(r)==="archived",completed=archived&&r.closedReason==="Meta cumplida",monthly=oneGoalMonthlySuggestion(r,today);
    const achieved=target>.005&&balance>=target-.005;
    const dateInfo=r.targetDate?(restoreValidDate(r.targetDate)?(r.targetDate<today?"Fecha objetivo pasada · "+dateLabel(r.targetDate):
      "Objetivo: "+dateLabel(r.targetDate)):"Revisá la fecha objetivo"):"Sin fecha límite";
    const hint=completed?"Meta cumplida. El saldo sigue apartado; si querés utilizarlo, reactivá la meta y registrá un Uso objetivo.":target<=0?"Definí un monto objetivo para ver tu avance.":
      remaining<=.005?"¡Monto objetivo alcanzado!":
      archived?"La meta está archivada. Conservamos su historial.":
      r.targetDate&&r.targetDate<=today?"Fecha cumplida: revisá el plazo de tu meta.":
      monthly>0?"Aporte orientativo: "+money(monthly)+" al mes":
      "Agregá una fecha objetivo para calcular un aporte mensual.";
    const history=(data.reserveMovements||[]).filter(t=>t.reserveId===r.id)
      .sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0,5);
    const status=archived?'<span class="one-goal-state'+(completed?' completed':'')+'">'+(completed?'Cumplida':'Archivada')+'</span>':"";
    const linkedBudget=categoryById(oneGoalBudgetCategory(r))?.name||"Sin vincular";
    const budgetSnapshot=!archived?oneV15CurrentBudget(today):null;
    const linkedRow=budgetSnapshot?.rows.find(x=>x.id===oneGoalBudgetCategory(r)&&x.type==="Gasto");
    const linkedContext=linkedRow&&linkedRow.plannedCRC>0?'<div class="one-goal-linked"><span>Disponible en categoría · período actual</span><strong>'+safe(money(linkedRow.remainingCRC))+'</strong></div><small class="muted">Importe compartido por la categoría, no reservado para esta meta.</small>':"";
    const ops=history.map(t=>'<div class="one-goal-history-row"><span>'+dateLabel(t.date)+' · '+safe(t.type)+'</span><strong>'+originalMoney(t.amount,t.currency||"CRC")+'</strong></div>').join("");
    return '<article class="one-goal-card">'+
      '<div class="one-goal-card-top"><div><span class="one-goal-eyebrow">META</span><h3>'+safe(r.name)+'</h3></div>'+status+'</div>'+
      '<div class="one-goal-amount"><strong>'+money(balance)+'</strong><span>'+ (target>0?'de '+money(target):'Ahorrado')+'</span></div>'+
      (target>0?'<div class="one-goal-bar" role="progressbar" aria-label="Progreso de '+safe(r.name)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(pct)+'"><span style="width:'+pct.toFixed(1)+'%"></span></div>':'')+
      '<div class="one-goal-stats"><span>'+(target>0?Math.round(pct)+'% completado · Faltan '+money(remaining):'Sin monto objetivo')+'</span><span>'+safe(dateInfo)+'</span></div>'+
      '<p class="one-goal-hint">'+safe(hint)+'</p>'+
      '<div class="one-goal-linked"><span>Presupuesto</span><strong>'+safe(linkedBudget)+'</strong></div>'+linkedContext+
      '<div class="one-goal-actions">'+(archived?'':
        '<button class="btn small" type="button" data-goal-txn="'+safe(r.id)+'" data-goal-type="Aporte">+ Aportar</button>')+
        '<button class="btn secondary small" type="button" data-edit-reserve="'+safe(r.id)+'">Editar</button></div>'+
      '<details class="one-goal-card-details"><summary>Detalle e historial</summary><div class="one-goal-history">'+
      (history.length?ops:'<p class="muted">Todavía no hay aportes ni retiros registrados.</p>')+
      '<div class="one-goal-card-more">'+
      (archived?'<button type="button" class="btn secondary small" data-reactivate-reserve="'+safe(r.id)+'">Reactivar</button>':
        '<button type="button" class="btn secondary small" data-goal-txn="'+safe(r.id)+'" data-goal-type="Retiro a operación">Retirar</button>'+
        '<button type="button" class="btn secondary small" data-goal-txn="'+safe(r.id)+'" data-goal-type="Uso objetivo">Usar objetivo</button>'+
        (achieved?'<button type="button" class="btn secondary small" data-complete-goal="'+safe(r.id)+'">Marcar cumplida</button>':'')+
        '<button type="button" class="btn secondary small" data-archive-reserve="'+safe(r.id)+'">Archivar</button>')+
      '</div></div></details></article>';
  }).join(""):'<div class="one-goal-empty">No hay metas en esta vista. Podés crear tu primera meta sin salir de One Less One.</div>';
  const activity=document.getElementById("oneGoalActivityList");
  if(activity){
    const names=new Map(goals.map(r=>[r.id,r.name]));
    const recent=(data.reserveMovements||[]).filter(t=>names.has(t.reserveId))
      .sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,8);
    activity.innerHTML=recent.length?recent.map(t=>'<div class="one-goal-activity-row"><span><strong>'+safe(names.get(t.reserveId))+'</strong><small>'+dateLabel(t.date)+' · '+safe(t.type)+'</small></span><b>'+originalMoney(t.amount,t.currency||"CRC")+'</b></div>').join(""):'<p class="one-goal-activity-empty">Tus aportes aparecerán aquí.</p>';
  }
}
function oneGoalOpenTransaction(reserveId,type="Aporte"){
  const r=(data.reserves||[]).find(x=>x.id===reserveId);
  if(!r||r.type!=="goal"||reserveStatus(r)!=="active")return;
  navigate("capital");
  m2OpenComposer();
  oneCentralOpenGoal({reserveId,type});
}
function oneRenderGoalBudgetPreview(level,value){
  const slot=document.getElementById("goalBudgetPreview");if(!slot)return;
  const active=(data.reserves||[]).filter(r=>r.type==="goal"&&reserveStatus(r)==="active");
  if(!oneModuleEnabled("capital")||!active.length){slot.hidden=true;return;}
  slot.hidden=false;
  const monthly=active.reduce((sum,r)=>sum+oneGoalMonthlySuggestion(r),0);
  const transfers=oneGoalSelectedTransactions(level,value).filter(t=>t.type==="Aporte"&&active.some(r=>r.id===t.reserveId));
  const actual=transfers.reduce((sum,t)=>sum+reserveTxnHistoricalCRC(t,"pay"),0);
  slot.innerHTML='<div><strong>Ahorro para metas</strong><p>Orientación, no un gasto ni una obligación del presupuesto.</p></div>'+
    '<div class="one-goal-context-metrics"><span>Sugerido al mes · hoy<strong>'+money(monthly)+'</strong></span>'+
    '<span>Aportado en este período<strong>'+money(actual)+'</strong></span></div>'+
    '<button type="button" class="one-goal-context-link" data-open-goals>Ver metas</button>';
}
function oneRenderGoalMovementPreview(level,value){
  const slot=document.getElementById("goalMovementPreview");if(!slot)return;
  if(!oneModuleEnabled("capital")||!(data.reserves||[]).length){slot.hidden=true;return;}
  const transactions=oneGoalSelectedTransactions(level,value)
    .filter(t=>(data.reserves||[]).some(r=>r.id===t.reserveId)).slice(0,4);
  if(!transactions.length){slot.hidden=true;return;}
  slot.hidden=false;
  slot.innerHTML='<div><strong>Actividad de tus fondos</strong><p>Estas transferencias ya están reflejadas en tu saldo operativo y no se suman otra vez como ingresos o gastos.</p></div>'+
    '<div class="one-goal-context-rows">'+transactions.map(t=>{
      const r=data.reserves.find(x=>x.id===t.reserveId);
      return '<div><span>'+dateLabel(t.date)+' · '+safe(r?.name||"Fondo")+' · '+safe(t.type)+'</span>'+
        '<strong>'+originalMoney(t.amount,t.currency||"CRC")+'</strong></div>';
    }).join("")+'</div><button type="button" class="one-goal-context-link" data-open-goals>Ver metas</button>';
}
function initGoalsBeta(){
  document.addEventListener("click",e=>{
    const tx=e.target.closest("[data-goal-txn]");
    if(tx){oneGoalOpenTransaction(tx.dataset.goalTxn,tx.dataset.goalType||"Aporte");return;}
    if(e.target.closest("[data-open-goals]"))navigate("capital");
  });
}

function renderCapital(){
  // Vista moderna: solo metas. Fondos antiguos quedan en el respaldo y en los cálculos históricos.
  oneRenderGoalCards();
  refreshReserveSelect();
}

let reportActiveTab="overview";
