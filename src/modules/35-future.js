/* V11.3 · Futuro Beta 1.0.
   Proyección de solo lectura: parte del saldo operativo real estimado y NO crea,
   edita ni duplica Movimientos, Presupuesto, Deudas, Metas o Proyectos. */
const ONE_FUTURE_WINDOWS=[30,60,90];
let oneFutureWindow=30;
function oneFutureDates(start,end){
 const result=[];for(let date=start;date<=end;date=addDaysIso(date,1))result.push(date);
 return result;
}
function oneFutureForecast(asOf=todayIso(),days=90){
 if(!restoreValidDate(asOf)||!ONE_FUTURE_WINDOWS.includes(days))throw Error("Ventana de proyección inválida.");
 const until=addDaysIso(asOf,days),tomorrow=addDaysIso(asOf,1);
 const dates=oneFutureDates(tomorrow,until),items=[],warnings=[];
 const events=new Map(dates.map(date=>[date,[]]));
 const add=(date,amount,kind,label,source)=>{
  if(date<=asOf||date>until||!Number.isFinite(amount)||Math.abs(amount)<.005||!events.has(date))return;
  const item={date,amount,kind,label,source};events.get(date).push(item);items.push(item);
 };
 const base=actualBalanceAt(asOf);
 const lastReconciliation=latestReconciliation(asOf);
 const futureMovements=(data.movements||[]).filter(m=>m.date>asOf&&m.date<=until);
 for(const m of futureMovements){
  const amount=signedMovement(m);
  if(amount)add(m.date,amount,"confirmed",m.description||movementCategoryName(m),"Movimiento ya registrado");
 }
 const futureReserves=(data.reserveMovements||[]).filter(t=>t.date>asOf&&t.date<=until);
 for(const t of futureReserves){
  const amount=reserveOperatingDelta(t);
  if(amount)add(t.date,amount,"confirmed",(data.reserves||[]).find(r=>r.id===t.reserveId)?.name||"Meta / fondo","Transferencia ya registrada");
 }
 // Un vencimiento es un estimado; pago mínimo actual, sin simular nuevos intereses.
 // Pagos de deuda ya registrados con fecha futura se incluyen arriba como reales
 // y reducen la cuota a proyectar en ese ciclo.
 const dueDates=[];
 let undatedDebts=0,overdueDebts=0;
 for(const d of activeDebts()){
  const first=oneDebtDueEntry(d,asOf),fullMin=Math.max(0,debtMinimumCRC(d));
  if(!first||!(fullMin>0)||!first.date){if(debtOutstanding(d)>.005)undatedDebts++;continue}
  let due=first.date,remainingBalance=Math.max(0,debtOutstanding(d)),cycle=0;
  while(due&&cycle<5&&remainingBalance>.005){
   const debitDate=due<=asOf?tomorrow:due;
   if(debitDate>until)break;
   if(due<=asOf)overdueDebts++;
   const prior=oneDebtMonthlyDueIso(d,oneDebtShiftMonth(due.slice(0,7),-1));
   const known=(data.movements||[]).filter(m=>m.type==="Pago deuda"&&m.date>asOf&&m.date>prior&&m.date<=due&&
     (m.debtId?m.debtId===d.id:m.debt===d.name))
     .reduce((sum,m)=>sum+movementAmountCRC(m),0);
   const expected=cycle===0?num(first.minimum):fullMin;
   const unpaid=Math.max(0,Math.min(remainingBalance,expected-known));
   if(unpaid>.005){
    add(debitDate,-unpaid,"debt",(due<=asOf?"Vencida · ":"")+d.name,"Cuota mínima estimada");
    dueDates.push({date:debitDate,amount:unpaid,debtId:d.id});
    remainingBalance-=unpaid;
   }
   due=oneDebtMonthlyDueIso(d,oneDebtShiftMonth(due.slice(0,7),1));
   cycle++;
  }
 }
 const periods=[...(data.periods||[])].filter(p=>p?.date).sort((a,b)=>a.date.localeCompare(b.date));
 let daysWithoutBudget=0,manualIncomeGroups=0,undatedIncomeGroups=0;
 const coverage=new Set();
 for(const p of periods){
  const end=periodEndDate(p),rangeStart=p.date>tomorrow?p.date:tomorrow;
  if(end<rangeStart||p.date>until)continue;
  const wholeDates=oneFutureDates(rangeStart,end);
  wholeDates.filter(date=>date<=until).forEach(date=>coverage.add(date));
  const count=wholeDates.length;if(!count)continue;
  const movements=(data.movements||[]).filter(m=>m.period===periodKey(p)&&m.date<=end);
  // Ingresos: únicamente los presupuestados que poseen fechas de pago conocidas.
  // Los ingresos manuales sin fecha NO se inventan ni se distribuyen.
  for(const c of budgetCategories("Ingreso",p)){
   const budget=Math.max(0,periodCategoryBudgetCRC(p,c.id,"receive"));
   if(!(budget>0))continue;
   const cfg=incomeConfigFor(c);
   const occurrences=(p.categoryBudgetScheduledDates?.[c.id]||scheduledIncomeForPeriod(c,p)?.dates||[])
     .filter(date=>restoreValidDate(date)&&date>=p.date&&date<=end);
   const unique=[...new Set(occurrences)].sort();
   if(!cfg?.projectAutomatically){manualIncomeGroups++;continue}
   if(!unique.length){undatedIncomeGroups++;continue}
   const daily=budget/unique.length;
   for(const date of unique){
    const registered=movements.filter(m=>m.type==="Ingreso"&&m.date===date&&movementMatchesCategory(m,c))
      .reduce((sum,m)=>sum+movementCategoryAmountCRC(m,c),0);
    add(date,Math.max(0,daily-registered),"income",c.name,"Ingreso programado");
   }
  }
  // Gastos ordinarios: lo que falta para completar el presupuesto del período,
  // después de descontar gastos efectivos (incluidos futuros ya registrados)
  // y transferencias a metas vinculadas. Se prorratean, NO son vencimientos.
  let ordinary=0,plannedSavings=0;
  const savingsCategoryIds=new Set([
   ...oneSavingsCategories().map(c=>c.id),
   ...(data.reserves||[]).filter(r=>r.type==="goal").map(oneGoalBudgetCategory).filter(Boolean)
  ]);
  for(const c of budgetCategories("Gasto",p)){
   const amount=Math.max(0,periodCategoryBudgetCRC(p,c.id,"pay"));
   const paid=movements.filter(m=>m.type==="Gasto").reduce((sum,m)=>sum+movementCategoryAmountCRC(m,c),0);
   const goals=oneBudgetSavingsActual(p,c.id,end);
   const remaining=Math.max(0,amount-paid-goals);
   if(savingsCategoryIds.has(c.id))plannedSavings+=remaining;else ordinary+=remaining;
  }
  if(ordinary>.005){
   const daily=-ordinary/count;
   for(const date of wholeDates)add(date,daily,"budget","Gastos presupuestados","Presupuesto distribuido");
  }
  if(plannedSavings>.005){
   const daily=-plannedSavings/count;
   for(const date of wholeDates)add(date,daily,"budget-savings","Ahorro presupuestado","Presupuesto distribuido");
  }
  // Deudas: cuota programada primero. Si el presupuesto de Pago deuda es mayor,
  // solo se proyecta la diferencia, nunca la misma cuota dos veces.
  const debtBudget=budgetCategories("Pago deuda",p).reduce((sum,c)=>{
   const budget=Math.max(0,periodCategoryBudgetCRC(p,c.id,"pay"));
   const paid=movements.filter(m=>m.type==="Pago deuda")
     .reduce((total,m)=>total+movementCategoryAmountCRC(m,c),0);
   return sum+Math.max(0,budget-paid);
  },0);
  const scheduled=dueDates.filter(x=>x.date>=rangeStart&&x.date<=end).reduce((sum,x)=>sum+x.amount,0);
  const extra=Math.max(0,debtBudget-scheduled);
  if(extra>.005){
   for(const date of wholeDates)add(date,-extra/count,"budget-debt","Pagos de deuda adicionales","Excedente de presupuesto");
  }
 }
 daysWithoutBudget=dates.filter(date=>!coverage.has(date)).length;
 if(!lastReconciliation)warnings.push("El saldo de partida no tiene conciliación reciente: puede ser aproximado.");
 if(daysWithoutBudget)warnings.push(daysWithoutBudget+" día(s) sin período presupuestario: pueden faltar ingresos y gastos previstos.");
 if(manualIncomeGroups)warnings.push("Hay ingresos presupuestados sin automatización; no se anticipan sin fecha.");
 if(undatedIncomeGroups)warnings.push("Algunos ingresos configurados no tienen fecha válida dentro del período.");
 if(undatedDebts)warnings.push(undatedDebts+" deuda(s) activas sin día de pago o cuota válida no se pueden fechar.");
 if(overdueDebts)warnings.push("Las cuotas vencidas se colocan provisionalmente en el día siguiente, no en su fecha real.");
 const points=[{date:asOf,balance:base,delta:0,income:0,outgo:0}];
 let balance=base,lowest=base,lowestDate=asOf,income=0,outgo=0;
 for(const date of dates){
  const rows=events.get(date),positive=rows.reduce((sum,x)=>sum+Math.max(0,x.amount),0),
    negative=rows.reduce((sum,x)=>sum+Math.max(0,-x.amount),0);
  balance+=positive-negative;income+=positive;outgo+=negative;
  points.push({date,balance,delta:positive-negative,income:positive,outgo:negative});
  if(balance<lowest){lowest=balance;lowestDate=date}
 }
 const byKind=kind=>items.filter(item=>item.kind===kind).reduce((s,item)=>s+Math.abs(item.amount),0);
 return {asOf,until,days,base,balance,lowest,lowestDate,income,outgo,
  points,items:items.sort((a,b)=>a.date.localeCompare(b.date)),warnings,
  coverageDays:days-daysWithoutBudget,daysWithoutBudget,hasReconciliation:!!lastReconciliation,
  recurringIncome:byKind("income"),scheduledDebt:byKind("debt"),
  budgetExpense:byKind("budget")+byKind("budget-savings")+byKind("budget-debt")};
}
function oneFutureChart(points){
 const width=760,height=245,pad={left:110,right:18,top:20,bottom:40};
 const values=points.map(p=>p.balance),min=Math.min(...values,0),max=Math.max(...values,0),
  gap=max-min||1,lo=min-gap*.12,hi=max+gap*.12;
 const x=i=>pad.left+i*(width-pad.left-pad.right)/Math.max(1,points.length-1);
 const y=v=>pad.top+(hi-v)/(hi-lo)*(height-pad.top-pad.bottom);
 const sample=points.map((p,i)=>[x(i).toFixed(2),y(p.balance).toFixed(2)].join(",")).join(" ");
 const lines=[min,(min+max)/2,max].map(v=>'<line x1="'+pad.left+'" x2="'+(width-pad.right)+
  '" y1="'+y(v).toFixed(2)+'" y2="'+y(v).toFixed(2)+'" class="one-future-gridline"/>'+
  '<text x="'+(pad.left-9)+'" y="'+(y(v)+4).toFixed(2)+'" class="one-future-tick" text-anchor="end">'+
  safe(money(v))+'</text>').join("");
 const baseline= y(0).toFixed(2);
 const end=points.length-1,marks=[0,Math.round(end/2),end];
 const labels=marks.map(i=>'<text class="one-future-tick" x="'+x(i).toFixed(2)+'" y="'+(height-13)+'" text-anchor="middle">'+
  safe(i===0?"Hoy":dateLabel(points[i].date))+'</text>').join("");
 const vertices=[0,Math.round(end/2),end].map(i=>'<circle cx="'+x(i).toFixed(2)+'" cy="'+y(points[i].balance).toFixed(2)+'" r="4" class="one-future-dot"/>').join("");
 return '<svg class="one-future-chart" role="img" aria-label="Proyección diaria del saldo operativo, sin equivalencia a estados bancarios" viewBox="0 0 760 245" xmlns="http://www.w3.org/2000/svg">'+
  lines+'<line x1="'+pad.left+'" x2="'+(width-pad.right)+'" y1="'+baseline+'" y2="'+baseline+'" class="one-future-zero"/>'+
  '<polyline class="one-future-line" points="'+sample+'"/>'+vertices+labels+'</svg>';
}
function renderFuture(){
 const root=document.getElementById("view-future");if(!root)return;
 const horizon=ONE_FUTURE_WINDOWS.includes(oneFutureWindow)?oneFutureWindow:30;
 const forecast=oneFutureForecast(todayIso(),horizon);
 document.querySelectorAll("[data-one-future-days]").forEach(button=>{
  const active=Number(button.dataset.oneFutureDays)===horizon;
  button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));
 });
 const q=id=>document.getElementById(id);
 q("oneFutureAsOf").textContent="Desde "+dateLabel(forecast.asOf)+" hasta "+dateLabel(forecast.until);
 q("oneFutureNumbers").innerHTML=[
  ["Saldo operativo de hoy",forecast.base],
  ["Saldo estimado al final",forecast.balance],
  ["Ingreso previsto",forecast.income],
  ["Salidas previstas",forecast.outgo]
 ].map(([name,value])=>'<div class="one-future-stat"><span>'+safe(name)+'</span><strong>'+safe(money(value))+
  '</strong></div>').join("");
 q("oneFutureChart").innerHTML=oneFutureChart(forecast.points);
 q("oneFutureMinimum").textContent="Mínimo previsto: "+money(forecast.lowest)+" · "+dateLabel(forecast.lowestDate)+
  (forecast.lowest<0?" · El saldo podría quedar negativo.":"");
 q("oneFutureBreakdown").innerHTML=[
  ["Ingresos con calendario",forecast.recurringIncome],
  ["Cuotas de deuda estimadas",-forecast.scheduledDebt],
  ["Gastos y pagos distribuidos",-forecast.budgetExpense]
 ].map(([name,amount])=>'<div class="one-future-breakdown-row"><span>'+safe(name)+'</span><strong>'+safe(money(amount))+'</strong></div>').join("");
 const relevant=forecast.items.filter(x=>x.kind==="income"||x.kind==="debt"||
   (x.kind==="confirmed"&&Math.abs(x.amount)>.005)).slice(0,9);
 q("oneFutureMilestones").innerHTML=relevant.length?relevant.map(x=>
  '<div class="one-future-milestone"><div><strong>'+safe(x.label)+'</strong><small>'+
   safe(dateLabel(x.date))+' · '+safe(x.source)+'</small></div><strong>'+
   safe((x.amount>0?"+":"")+money(x.amount))+'</strong></div>').join(""):
  '<p class="muted">No hay ingresos ni vencimientos fechados dentro del intervalo.</p>';
 const status=q("oneFutureStatus");
 status.textContent=forecast.warnings.length?
  "Proyección parcial: verificá las suposiciones antes de tomar decisiones.":
  "Proyección basada en datos configurados; no es un saldo bancario garantizado.";
 status.dataset.level=forecast.warnings.length?"review":"ok";
 const warnings=q("oneFutureWarnings");warnings.replaceChildren();
 for(const message of forecast.warnings){
  const li=document.createElement("li");li.textContent=message;warnings.appendChild(li);
 }
 q("oneFutureCoverage").textContent=forecast.coverageDays+" de "+horizon+" días tienen períodos de presupuesto.";
 oneScenarioRender(forecast);
}
function oneFutureInit(){
 document.querySelectorAll("[data-one-future-days]").forEach(button=>button.addEventListener("click",()=>{
  const next=Number(button.dataset.oneFutureDays);
  if(!ONE_FUTURE_WINDOWS.includes(next))return;
  oneFutureWindow=next;
  if(document.getElementById("view-future")?.classList.contains("active"))renderFuture();
 }));
}
