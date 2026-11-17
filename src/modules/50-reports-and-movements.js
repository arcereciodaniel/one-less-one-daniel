function reportPct(v,digits=0){return Number.isFinite(Number(v))?`${(Number(v)*100).toFixed(digits)}%`:"—"}
function reportShortMonth(month){if(!month)return "";const [y,m]=month.split("-").map(Number);return new Intl.DateTimeFormat("es-CR",{month:"short",year:"2-digit",timeZone:"UTC"}).format(new Date(Date.UTC(y,m-1,1))).replace(".","")}
function reportDaysBetween(a,b){const A=new Date(a+"T00:00:00Z"),B=new Date(b+"T00:00:00Z");return Math.round((B-A)/86400000)}
function liquidityHistorySeries(maxMonths=6){
  // Evolución REAL: usa exactamente el cálculo operativo del dashboard.
  // No usamos el cierre presupuestado ni inventamos puntos para meses sin historia.
  const today=todayIso();
  const signals=[
    ...(data.movements||[]).filter(m=>m.date&&m.date<=today&&
      (m.type==="Ingreso"||m.type==="Gasto"||m.type==="Pago deuda"||oneIsCobroReimbursement(m))).map(m=>m.date),
    ...(data.reconciliations||[]).filter(r=>r.date&&r.date<=today).map(r=>r.date),
    ...(data.reserveMovements||[]).filter(t=>t.date&&t.date<=today).map(t=>t.date),
    ...(data.periods||[]).filter(p=>p.opening!==null&&p.opening!==undefined&&p.opening!=="")
      .map(p=>p.date).filter(d=>d&&d<=today)
  ];
  const start=signals.sort()[0];
  if(!start){
    const balance=actualBalanceAt(today);
    return Number.isFinite(balance)&&balance!==0?[{date:today,month:today.slice(0,7),label:"Hoy",balance}]:[];
  }
  const [year,month]=today.slice(0,7).split("-").map(Number);
  const points=[];
  for(let offset=Math.max(1,maxMonths)-1;offset>=0;offset--){
    const marker=new Date(Date.UTC(year,month-1-offset,1));
    const key=marker.toISOString().slice(0,7);
    const monthEnd=new Date(Date.UTC(marker.getUTCFullYear(),marker.getUTCMonth()+1,0)).toISOString().slice(0,10);
    const asOf=monthEnd<today?monthEnd:today;
    if(asOf<start)continue;
    const balance=actualBalanceAt(asOf);
    if(!Number.isFinite(balance))continue;
    points.push({date:asOf,month:key,label:key===today.slice(0,7)?"Hoy":reportShortMonth(key),balance});
  }
  return points;
}
function reportMonthlySeries(){
  const rows=allActualRows(), months=availableBudgetMonths();
  return months.map(month=>{
    const monthRows=rows.filter(r=>r.budgetMonth===month),moves=data.movements.filter(m=>movementBudgetMonth(m)===month);
    const plannedIncome=monthRows.reduce((s,r)=>s+num(r.incomeCRC)+num(r.otherIncomeCRC),0),plannedExpense=monthRows.reduce((s,r)=>s+num(r.expenses),0);
    const actualIncome=moves.filter(m=>m.type==="Ingreso").reduce((s,m)=>s+movementAmountCRC(m),0),actualExpense=moves.filter(m=>m.type==="Gasto"||m.type==="Pago deuda").reduce((s,m)=>s+movementAmountCRC(m),0);
    const realRows=monthRows.filter(r=>r.actualBalance!==null&&r.actualBalance!==undefined),actualBalance=realRows.length?realRows.at(-1).actualBalance:null,projectedBalance=monthRows.length?monthRows.at(-1).ending:null;
    return {month,plannedIncome,plannedExpense,actualIncome,actualExpense,netActual:actualIncome-actualExpense,savingsRate:actualIncome?(actualIncome-actualExpense)/actualIncome:null,actualBalance,projectedBalance};
  });
}
function reportHistorySeries(){
  const limit=num(document.getElementById("reportHistoryRange")?.value)||6,current=todayIso().slice(0,7);
  return reportMonthlySeries().filter(r=>r.month<=current).slice(-limit);
}
function reportFutureRows(){
  const today=todayIso();return allAdaptiveProjectedRows().filter(r=>periodEndDate(r)>=today).slice(0,16);
}
function reportCurrentRow(){
  const today=todayIso(),rows=allActualRows();return rows.find(r=>r.date<=today&&today<=periodEndDate(r))||null;
}
function reportCategoryRows(level,value){
  const rows=categoryReportFiltered(level,value),total=rows.reduce((s,r)=>s+r.actual,0);
  return rows.map(r=>({...r,share:total?r.actual/total:0,overrun:r.actual-r.budget}));
}
function reportKpiHtml(label,value,sub="",tone=""){
  return `<div class="report-kpi ${tone}"><div class="report-kpi-label">${label}</div><div class="report-kpi-value">${value}</div>${sub?`<div class="report-kpi-sub">${sub}</div>`:""}</div>`;
}
function reportMiniHtml(label,value){return `<div class="report-mini"><span>${label}</span><strong>${value}</strong></div>`}
function reportInsightHtml(label,title,body,tone=""){
  return `<div class="report-insight ${tone}"><div class="report-insight-label">${label}</div><strong>${title}</strong><p>${body}</p></div>`;
}
function renderReportInsights(summary,cats,future){
  const realFlow=summary.realIncome-summary.realExpense,usage=summary.plannedExpense?summary.realExpense/summary.plannedExpense:null;
  const overruns=cats.filter(c=>c.actual>c.budget&&c.actual>0).sort((a,b)=>b.overrun-a.overrun),top=overruns[0];
  const firstNegative=future.find(r=>r.ending<0),lowest=future.length?[...future].sort((a,b)=>a.ending-b.ending)[0]:null;
  const cashTone=realFlow>0?"good":realFlow<0?"bad":"warn";
  const cashTitle=realFlow>0?`Flujo positivo de ${money(realFlow)}`:realFlow<0?`Flujo negativo de ${money(Math.abs(realFlow))}`:"Flujo real en equilibrio";
  const cashBody=summary.realIncome||summary.realExpense?`Ingresaste ${money(summary.realIncome)} y registraste ${money(summary.realExpense)} en egresos dentro del periodo seleccionado.`:"Todavía no hay suficientes movimientos reales en este periodo para evaluar el flujo.";
  let budgetTitle="Presupuesto todavía sin señal",budgetBody="Registra egresos o define presupuesto para medir la ejecución.",budgetTone="warn";
  if(usage!==null){budgetTone=usage<=.85?"good":usage<=1?"warn":"bad";budgetTitle=usage<=1?`${reportPct(usage)} del presupuesto utilizado`:`Exceso de ${money(summary.realExpense-summary.plannedExpense)}`;budgetBody=top?`${safe(top.category)} es la mayor desviación: ${money(top.actual)} real frente a ${money(top.budget)} presupuestado.`:"No hay una categoría con sobregasto relevante dentro de esta selección."}
  let futureTitle="Sin proyección futura",futureBody="Crea próximos periodos en Presupuesto para analizar liquidez futura.",futureTone="warn";
  if(future.length){if(firstNegative){futureTone="bad";futureTitle=`Riesgo de saldo negativo`;futureBody=`La proyección cae a ${money(firstNegative.ending)} en ${fortnightLabel(firstNegative)}. Revisa ingresos esperados o compromisos antes de llegar a ese periodo.`}else{futureTone="good";futureTitle=`Proyección permanece positiva`;futureBody=`El punto más bajo del horizonte configurado es ${money(lowest?.ending||0)} en ${lowest?fortnightLabel(lowest):"el horizonte futuro"}.`}}
  document.getElementById("reportInsights").innerHTML=reportInsightHtml("Flujo real",cashTitle,cashBody,cashTone)+reportInsightHtml("Disciplina presupuestaria",budgetTitle,budgetBody,budgetTone)+reportInsightHtml("Liquidez futura",futureTitle,futureBody,futureTone);
}
function reportCategoryTable(rows){
  const total=rows.reduce((s,r)=>s+r.actual,0);
  return `<thead><tr><th>Categoría</th><th>Tipo</th><th>Presupuesto</th><th>Real</th><th>Variación</th><th>Uso</th><th>Peso del gasto</th><th>Lectura</th></tr></thead><tbody>${rows.length?rows.map(r=>{
    const used=r.budget?r.actual/r.budget:0,share=total?r.actual/total:0,variance=r.budget-r.actual;
    const signal=!r.budget&&r.actual>0?["Sin presupuesto","warn"]:r.actual>r.budget?["Sobre presupuesto","bad"]:used>=.8?["Cerca del límite","warn"]:["Dentro del plan","good"];
    return `<tr><td><button class="report-category-name" data-edit-category="${r.categoryId}">${safe(r.category)}</button></td><td>${categoryTypeLabel(r.type)}</td><td class="num">${money(r.budget)}</td><td class="num">${money(r.actual)}</td><td class="num ${variance<0?"negative":"positive"}">${money(variance)}</td><td>${r.budget?reportPct(used):"—"}</td><td>${reportPct(share)}</td><td><span class="status-badge ${signal[1]==="good"?"active":""}">${signal[0]}</span></td></tr>`;
  }).join(""):`<tr><td colspan="8" class="empty">No hay categorías con información en este periodo.</td></tr>`}</tbody>`;
}
function renderReportPast(history){
  document.getElementById("reportPastCount").textContent=`${history.length} meses`;
  document.getElementById("reportPastTable").innerHTML=`<thead><tr><th>Mes</th><th>Ingresos reales</th><th>Egresos reales</th><th>Flujo neto</th><th>Tasa de ahorro</th><th>Saldo al cierre</th></tr></thead><tbody>${history.length?history.map(r=>`<tr><td><strong>${monthLabel(r.month)}</strong></td><td class="num">${money(r.actualIncome)}</td><td class="num">${money(r.actualExpense)}</td><td class="num ${r.netActual>=0?"positive":"negative"}">${money(r.netActual)}</td><td>${r.savingsRate===null?"—":reportPct(r.savingsRate)}</td><td class="num">${r.actualBalance===null?"—":money(r.actualBalance)}</td></tr>`).join(""):`<tr><td colspan="6" class="empty">Aún no hay historial mensual suficiente.</td></tr>`}</tbody>`;
}
function renderReportPresent(current){
  const health=document.getElementById("reportPresentHealth"),summaryBox=document.getElementById("reportCurrentSummary"),pace=document.getElementById("reportBudgetPace"),txTable=document.getElementById("reportCurrentTransactions");
  if(!current){health.innerHTML="";summaryBox.innerHTML=`<div class="empty">No existe un periodo configurado para hoy.</div>`;pace.innerHTML="";txTable.innerHTML=`<tbody><tr><td class="empty">Sin periodo actual.</td></tr></tbody>`;return}
  const today=todayIso(),end=periodEndDate(current),start=current.date,totalDays=Math.max(1,reportDaysBetween(start,end)+1),elapsed=Math.min(totalDays,Math.max(0,reportDaysBetween(start,today)+1)),timePct=elapsed/totalDays;
  const ms=periodMovements(current,today),income=ms.filter(m=>m.type==="Ingreso").reduce((s,m)=>s+movementAmountCRC(m),0),expense=ms.filter(m=>m.type==="Gasto"||m.type==="Pago deuda").reduce((s,m)=>s+movementAmountCRC(m),0),budget=num(current.expenses),budgetPct=budget?expense/budget:0,balance=actualBalanceAt(today),remaining=Math.max(0,budget-expense);
  const paceTone=!budget?"warn":budgetPct<=timePct+.08?"good":budgetPct<=1?"warn":"bad";
  health.innerHTML=`<span class="report-health-dot ${paceTone}"></span><strong>${fortnightLabel(current)}</strong><span class="muted">· termina ${dateLabel(end)}</span>`;
  summaryBox.innerHTML=reportMiniHtml("Saldo operativo hoy",money(balance))+reportMiniHtml("Ingresos recibidos",money(income))+reportMiniHtml("Egresos registrados",money(expense))+reportMiniHtml("Presupuesto restante",money(remaining))+reportMiniHtml("Días restantes",Math.max(0,reportDaysBetween(today,end)));
  const cappedBudget=Math.min(1.25,budgetPct),cappedTime=Math.min(1,timePct);
  pace.innerHTML=`<div class="report-progress-row"><span>Tiempo transcurrido</span><div class="report-progress-track"><span style="width:${Math.min(100,cappedTime*100)}%"></span></div><strong>${reportPct(timePct)}</strong></div><div class="report-progress-row"><span>Presupuesto consumido</span><div class="report-progress-track ${paceTone}"><span style="width:${Math.min(100,cappedBudget*100)}%"></span></div><strong>${budget?reportPct(budgetPct):"—"}</strong></div><div class="note" style="margin:14px 0 0">${!budget?"Este periodo no tiene egresos presupuestados, por lo que no es posible medir el ritmo de consumo.":budgetPct>1?`Ya superaste el presupuesto del periodo por ${money(expense-budget)}.`:budgetPct>timePct+.08?"El gasto está avanzando más rápido que el tiempo del periodo. Conviene revisar las categorías con mayor consumo.":"El ritmo de gasto está alineado o por debajo del avance del periodo."}</div>`;
  const tx=[...ms].sort((a,b)=>b.date.localeCompare(a.date)||num(b.seq)-num(a.seq)).slice(0,12);
  txTable.innerHTML=`<thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Monto</th></tr></thead><tbody>${tx.length?tx.map(m=>`<tr><td>${dateLabel(m.date)}</td><td>${m.type}</td><td><button class="report-category-name" data-edit-category="${m.categoryId||""}">${safe(movementCategoryName(m))}</button></td><td>${safe(m.description||"—")}</td><td class="num ${m.type==="Ingreso"?"positive":""}">${m.type==="Ingreso"?"+":"−"}${money(movementAmountCRC(m))}</td></tr>`).join(""):`<tr><td colspan="5" class="empty">Aún no hay movimientos en el periodo actual.</td></tr>`}</tbody>`;
}
function renderReportFuture(future){
  const min=future.length?[...future].sort((a,b)=>a.ending-b.ending)[0]:null,firstNegative=future.find(r=>r.ending<0),income=future.reduce((s,r)=>s+num(r.incomeCRC)+num(r.otherIncomeCRC),0),expense=future.reduce((s,r)=>s+num(r.expenses),0),end=future.at(-1)?.ending??0;
  document.getElementById("reportFutureSummary").innerHTML=reportMiniHtml("Ingresos proyectados",money(income))+reportMiniHtml("Compromisos presupuestados",money(expense))+reportMiniHtml("Cierre del horizonte",future.length?money(end):"—")+reportMiniHtml("Punto mínimo",min?money(min.ending):"—")+reportMiniHtml("Primer déficit",firstNegative?fortnightLabel(firstNegative):"No previsto");
  document.getElementById("reportFutureCount").textContent=`${future.length} periodos`;
  document.getElementById("reportFutureTable").innerHTML=`<thead><tr><th>Periodo</th><th>Fecha ref.</th><th>Ingreso plan</th><th>Egreso plan</th><th>Saldo proyectado</th><th>Origen de proyección</th><th>Señal</th></tr></thead><tbody>${future.length?future.map(r=>{
    const tone=r.ending<0?"negative":"positive",signal=r.ending<0?"Déficit":r.ending<num(r.expenses)*.25?"Margen bajo":"Positivo";
    return `<tr><td><strong>${fortnightLabel(r)}</strong></td><td>${dateLabel(r.date)}</td><td class="num">${money(num(r.incomeCRC)+num(r.otherIncomeCRC))}</td><td class="num">${money(r.expenses)}</td><td class="num ${tone}">${money(r.ending)}</td><td>${safe(r.projectionSource||"Plan")}</td><td>${signal}</td></tr>`
  }).join(""):`<tr><td colspan="7" class="empty">No hay periodos futuros configurados. Crea un nuevo trimestre en Presupuesto para extender la proyección.</td></tr>`}</tbody>`;
}
function renderReports(){
  const level=document.getElementById("reportLevel").value,value=document.getElementById("reportPeriod").value,summary=selectedSummary(level,value),cats=reportCategoryRows(level,value),history=reportHistorySeries(),future=reportFutureRows(),current=reportCurrentRow();
  const reserves=reserveTotals(todayIso()),operating=actualBalanceAt(todayIso()),debt=activeDebtTotal(),net=operating+reserves.total-debt,realFlow=summary.realIncome-summary.realExpense,savings=summary.realIncome?realFlow/summary.realIncome:null,usage=summary.plannedExpense?summary.realExpense/summary.plannedExpense:null;
  document.getElementById("reportKpis").innerHTML=
    reportKpiHtml("Saldo operativo hoy",money(operating),latestReconciliation(todayIso())?`Última conciliación: ${dateLabel(latestReconciliation(todayIso()).date)}`:"Sin conciliación reciente",operating>=0?"good":"bad")+
    reportKpiHtml("Flujo real del periodo",money(realFlow),`${money(summary.realIncome)} ingresos · ${money(summary.realExpense)} egresos`,realFlow>=0?"good":"bad")+
    reportKpiHtml("Tasa de ahorro",savings===null?"—":reportPct(savings),savings===null?"Requiere ingresos reales registrados":"Flujo neto / ingresos reales",savings===null?"":savings>=.1?"good":savings>=0?"warn":"bad")+
    reportKpiHtml("Ejecución de egresos",usage===null?"—":reportPct(usage),usage===null?"Sin presupuesto de egresos":"Real / presupuesto",usage===null?"":usage<=.85?"good":usage<=1?"warn":"bad")+
    reportKpiHtml("Deuda activa",money(debt),`${activeDebts().length} obligaciones activas`,debt?"warn":"good")+
    reportKpiHtml("Posición líquida neta",money(net),`Operación + reservas − deuda`,net>=0?"good":"bad");
  renderReportInsights(summary,cats,future);
  document.querySelectorAll("[data-report-panel]").forEach(p=>p.hidden=p.dataset.reportPanel!==reportActiveTab);
  document.querySelectorAll("[data-report-tab]").forEach(b=>b.classList.toggle("active",b.dataset.reportTab===reportActiveTab));
  document.getElementById("reportPeriodTitle").textContent=`Detalle · ${selectedLabel(level,value)}`;
  document.getElementById("periodReportTable").innerHTML=`<thead><tr><th>Periodo</th><th>Fecha</th><th>Ingresos plan</th><th>Ingresos reales</th><th>Egresos plan</th><th>Egresos reales</th><th>Variación</th><th>Saldo proyectado</th><th>Saldo real</th></tr></thead><tbody>${summary.rows.length?summary.rows.map(r=>`<tr><td>${monthLabel(r.budgetMonth)} · ${r.fortnight===1?"1.ª":"2.ª"}</td><td>${dateLabel(r.date)}</td><td class="num">${money(num(r.incomeCRC)+num(r.otherIncomeCRC))}</td><td class="num">${money(r.actualIncome)}</td><td class="num">${money(r.expenses)}</td><td class="num">${money(r.actualExpenses)}</td><td class="num ${r.expenses-r.actualExpenses<0?"negative":"positive"}">${money(r.expenses-r.actualExpenses)}</td><td class="num">${money(r.ending)}</td><td class="num">${r.actualBalance===null?"—":money(r.actualBalance)}</td></tr>`).join(""):`<tr><td colspan="9" class="empty">No hay periodos configurados para esta selección.</td></tr>`}</tbody>`;
  document.getElementById("categoryReportTable").innerHTML=reportCategoryTable(cats);
  renderReportPast(history);renderReportPresent(current);renderReportFuture(future);
  requestAnimationFrame(()=>drawActiveReportCharts({summary,cats,history,future,current}));
}
function reportCanvasBase(canvas,height=300){
  if(!canvas)return null;const rect=canvas.getBoundingClientRect();if(rect.width<20)return null;const dpr=window.devicePixelRatio||1,w=rect.width,h=height;canvas.width=Math.max(300,Math.round(w*dpr));canvas.height=Math.round(h*dpr);canvas.style.height=`${height}px`;const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const css=getComputedStyle(document.documentElement);return {ctx,w,h,p:{l:58,r:18,t:22,b:42},text:css.getPropertyValue("--muted").trim()||"#787774",grid:css.getPropertyValue("--border").trim()||"#e3e2df",surface:css.getPropertyValue("--surface").trim()||"#fff"};
}
function reportMoneyShort(v){const n=Math.abs(Number(v)||0),sign=Number(v)<0?"−":"";if(displayCurrency()==="USD"){const x=fromCRC(n,"USD");return `${sign}$${x>=1000?(x/1000).toFixed(1)+"k":x.toFixed(0)}`}return `${sign}₡${n>=1000000?(n/1000000).toFixed(1)+"M":n>=1000?(n/1000).toFixed(0)+"k":n.toFixed(0)}`}
function reportChartPalette(){return ["#4dab7a","#5ca6e8","#d9a441","#eb6864","#a78bfa","#2dd4bf","#f59e0b","#94a3b8"]}
function drawReportGroupedBars(canvas,labels,a,b,colors=["#4dab7a","#eb6864"]){
  const base=reportCanvasBase(canvas);if(!base)return;const {ctx,w,h,p,text,grid}=base,vals=[...a,...b].map(Number),max=Math.max(1,...vals),plotW=w-p.l-p.r,plotH=h-p.t-p.b,group=plotW/Math.max(1,labels.length);ctx.font="11px system-ui";ctx.strokeStyle=grid;ctx.fillStyle=text;
  for(let i=0;i<=4;i++){const y=p.t+plotH*i/4;ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(w-p.r,y);ctx.stroke();ctx.textAlign="right";ctx.fillText(reportMoneyShort(max*(1-i/4)),p.l-8,y+4)}
  labels.forEach((l,i)=>{const bw=Math.min(24,group*.28),x=p.l+i*group+group/2,ah=(num(a[i])/max)*plotH,bh=(num(b[i])/max)*plotH;ctx.fillStyle=colors[0];ctx.fillRect(x-bw-2,p.t+plotH-ah,bw,ah);ctx.fillStyle=colors[1];ctx.fillRect(x+2,p.t+plotH-bh,bw,bh);ctx.fillStyle=text;ctx.textAlign="center";ctx.fillText(l,x,h-16)});ctx.textAlign="left";
}
function drawReportLine(canvas,labels,series){
  const base=reportCanvasBase(canvas);if(!base)return;const {ctx,w,h,p,text,grid}=base,all=series.flatMap(s=>s.values.filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number));if(!all.length){ctx.fillStyle=text;ctx.textAlign="center";ctx.fillText("Sin datos suficientes",w/2,h/2);return}const min=Math.min(0,...all),max=Math.max(1,...all),span=max-min||1,plotW=w-p.l-p.r,plotH=h-p.t-p.b;ctx.font="11px system-ui";ctx.strokeStyle=grid;ctx.fillStyle=text;
  for(let i=0;i<=4;i++){const y=p.t+plotH*i/4;ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(w-p.r,y);ctx.stroke();ctx.textAlign="right";ctx.fillText(reportMoneyShort(max-span*i/4),p.l-8,y+4)}
  series.forEach(s=>{ctx.save();ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=2.4;ctx.setLineDash(s.dashed?[6,5]:[]);ctx.beginPath();let started=false;s.values.forEach((v,i)=>{if(v===null||v===undefined||!Number.isFinite(Number(v)))return;const x=p.l+(labels.length===1?plotW/2:i*plotW/(labels.length-1)),y=p.t+(max-Number(v))/span*plotH;if(started)ctx.lineTo(x,y);else{ctx.moveTo(x,y);started=true}});ctx.stroke();ctx.setLineDash([]);s.values.forEach((v,i)=>{if(v===null||v===undefined||!Number.isFinite(Number(v)))return;const x=p.l+(labels.length===1?plotW/2:i*plotW/(labels.length-1)),y=p.t+(max-Number(v))/span*plotH;ctx.beginPath();ctx.arc(x,y,3.2,0,Math.PI*2);ctx.fill()});ctx.restore()});
  labels.forEach((l,i)=>{if(labels.length>9&&i%2===1)return;const x=p.l+(labels.length===1?plotW/2:i*plotW/(labels.length-1));ctx.fillStyle=text;ctx.textAlign="center";ctx.fillText(l,x,h-16)});ctx.textAlign="left";
}
function drawReportHorizontalBars(canvas,labels,a,b){
  const height=Math.max(280,70+labels.length*42),base=reportCanvasBase(canvas,height);if(!base)return;const {ctx,w,h,p,text,grid}=base,max=Math.max(1,...a,...b),left=Math.min(Math.max(112,w*.26),180),plotLeft=left,plotW=w-plotLeft-25,rowH=(h-42)/Math.max(1,labels.length);ctx.font="11px system-ui";
  labels.forEach((label,i)=>{const y=22+i*rowH;ctx.fillStyle=text;ctx.textAlign="right";ctx.fillText(label.length>22?label.slice(0,21)+"…":label,plotLeft-10,y+13);ctx.fillStyle=grid;ctx.fillRect(plotLeft,y,plotW,1);const bh=Math.min(11,rowH*.28),aw=(num(a[i])/max)*plotW,bw=(num(b[i])/max)*plotW;ctx.fillStyle="#5ca6e8";ctx.fillRect(plotLeft,y+5,aw,bh);ctx.fillStyle="#eb6864";ctx.fillRect(plotLeft,y+8+bh,bw,bh)});ctx.textAlign="left";
}
function drawReportDonut(canvas,labels,values){
  const base=reportCanvasBase(canvas);if(!base)return;const {ctx,w,h,text}=base,total=values.reduce((s,v)=>s+num(v),0);if(!total){ctx.fillStyle=text;ctx.textAlign="center";ctx.font="12px system-ui";ctx.fillText("Aún no hay egresos reales para esta selección",w/2,h/2);return}const palette=reportChartPalette(),cx=Math.min(w*.36,150),cy=h/2,r=Math.min(92,h*.34),inner=r*.62;let start=-Math.PI/2;values.forEach((v,i)=>{const angle=(num(v)/total)*Math.PI*2;ctx.beginPath();ctx.arc(cx,cy,r,start,start+angle);ctx.arc(cx,cy,inner,start+angle,start,true);ctx.closePath();ctx.fillStyle=palette[i%palette.length];ctx.fill();start+=angle});ctx.fillStyle=text;ctx.textAlign="center";ctx.font="700 12px system-ui";ctx.fillText("Gasto real",cx,cy-4);ctx.font="700 13px system-ui";ctx.fillText(reportMoneyShort(total),cx,cy+16);ctx.textAlign="left";ctx.font="11px system-ui";const x=Math.min(w*.56,cx+r+34),top=Math.max(28,cy-values.length*16);labels.forEach((l,i)=>{const y=top+i*31;ctx.fillStyle=palette[i%palette.length];ctx.fillRect(x,y,9,9);ctx.fillStyle=text;ctx.fillText(l.length>20?l.slice(0,19)+"…":l,x+15,y+9);ctx.fillText(reportPct(num(values[i])/total),x+15,y+23)})
}
function drawReportWaterfall(canvas,items){
  const base=reportCanvasBase(canvas);if(!base)return;const {ctx,w,h,p,text,grid}=base;const closing=items[0]+items[1]-items[2],vals=[items[0],items[1],-items[2],closing],labels=["Saldo inicial","Ingresos","Egresos","Saldo actual"],cum=[0,items[0],items[0]+items[1],0],tops=[items[0],items[0]+items[1],closing,closing],all=[0,...cum,...tops],min=Math.min(0,...all),max=Math.max(1,...all),span=max-min||1,plotW=w-p.l-p.r,plotH=h-p.t-p.b,group=plotW/4,bw=Math.min(58,group*.56);ctx.font="11px system-ui";ctx.strokeStyle=grid;ctx.fillStyle=text;
  for(let i=0;i<=4;i++){const y=p.t+plotH*i/4;ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(w-p.r,y);ctx.stroke();ctx.textAlign="right";ctx.fillText(reportMoneyShort(max-span*i/4),p.l-8,y+4)}
  function y(v){return p.t+(max-v)/span*plotH}vals.forEach((v,i)=>{const x=p.l+i*group+(group-bw)/2;let low,high,color;if(i===0||i===3){low=0;high=v;color=v>=0?"#5ca6e8":"#eb6864"}else{low=Math.min(cum[i],tops[i]);high=Math.max(cum[i],tops[i]);color=v>=0?"#4dab7a":"#eb6864"}const yy=y(high),hh=Math.max(2,y(low)-yy);ctx.fillStyle=color;ctx.fillRect(x,yy,bw,hh);ctx.fillStyle=text;ctx.textAlign="center";ctx.fillText(labels[i],x+bw/2,h-17)});ctx.textAlign="left";
}
function reportTopCategories(cats,max=7){
  const sorted=[...cats].filter(c=>c.actual>0||c.budget>0).sort((a,b)=>Math.max(b.actual,b.budget)-Math.max(a.actual,a.budget));return sorted.slice(0,max);
}
function reportDonutData(cats,max=6){
  const sorted=[...cats].filter(c=>c.actual>0).sort((a,b)=>b.actual-a.actual),head=sorted.slice(0,max),rest=sorted.slice(max).reduce((s,r)=>s+r.actual,0);const labels=head.map(r=>r.category),values=head.map(r=>r.actual);if(rest>0){labels.push("Otros");values.push(rest)}return {labels,values};
}
function drawActiveReportCharts(ctxData){
  const {cats,history,future,current}=ctxData,tab=reportActiveTab,labels=history.map(r=>reportShortMonth(r.month));
  if(tab==="overview"){
    drawReportGroupedBars(document.getElementById("reportOverviewFlowChart"),labels,history.map(r=>r.actualIncome),history.map(r=>r.actualExpense));
    const timeline=allActualRows().slice(-12),tl=timeline.map(r=>`${reportShortMonth(r.budgetMonth).split(" ")[0]} ${r.fortnight}Q`);drawReportLine(document.getElementById("reportOverviewBalanceChart"),tl,[{values:timeline.map(r=>r.ending),color:"#5ca6e8"},{values:timeline.map(r=>r.actualBalance),color:"#4dab7a",dashed:true}]);
    const top=reportTopCategories(cats);drawReportHorizontalBars(document.getElementById("reportOverviewCategoryChart"),top.map(r=>r.category),top.map(r=>r.budget),top.map(r=>r.actual));const donut=reportDonutData(cats);drawReportDonut(document.getElementById("reportOverviewDonutChart"),donut.labels,donut.values);
  }else if(tab==="past"){
    drawReportGroupedBars(document.getElementById("reportPastFlowChart"),labels,history.map(r=>r.actualIncome),history.map(r=>r.actualExpense));drawReportLine(document.getElementById("reportPastNetChart"),labels,[{values:history.map(r=>r.netActual),color:"#5ca6e8"}]);
  }else if(tab==="present"){
    if(current){const ms=periodMovements(current,todayIso()),income=ms.filter(m=>m.type==="Ingreso").reduce((s,m)=>s+movementAmountCRC(m),0),expense=ms.filter(m=>m.type==="Gasto"||m.type==="Pago deuda").reduce((s,m)=>s+movementAmountCRC(m),0);drawReportWaterfall(document.getElementById("reportPresentWaterfallChart"),[num(current.openingCalc),income,expense])}
  }else if(tab==="future"){
    const fl=future.map(r=>`${reportShortMonth(r.budgetMonth).split(" ")[0]} ${r.fortnight}Q`);drawReportLine(document.getElementById("reportFutureBalanceChart"),fl,[{values:future.map(r=>r.ending),color:"#5ca6e8"}]);drawReportGroupedBars(document.getElementById("reportFutureFlowChart"),fl,future.map(r=>num(r.incomeCRC)+num(r.otherIncomeCRC)),future.map(r=>num(r.expenses)),["#4dab7a","#d9a441"]);
  }else if(tab==="categories"){
    const top=reportTopCategories(cats,9);drawReportHorizontalBars(document.getElementById("reportCategoryBarChart"),top.map(r=>r.category),top.map(r=>r.budget),top.map(r=>r.actual));const donut=reportDonutData(cats,7);drawReportDonut(document.getElementById("reportCategoryDonutChart"),donut.labels,donut.values);
  }
}
function drawBase(canvas,requestedHeight=280){
  const dpr=window.devicePixelRatio||1,rect=canvas.getBoundingClientRect();
  // La altura del gráfico del Inicio sigue a la tabla; otros gráficos mantienen 280px.
  const h=requestedHeight===null?Math.max(280,Math.round(rect.height)):requestedHeight;
  canvas.width=Math.max(300,Math.round(rect.width*dpr));canvas.height=Math.round(h*dpr);
  const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);ctx.clearRect(0,0,rect.width,h);
  return {ctx,w:rect.width,h,p:{l:48,r:16,t:20,b:38}};
}
function drawBarChart(canvas,labels,a,b){
  if(!canvas||canvas.getBoundingClientRect().width<40)return; // No dibujar con el panel cerrado.
  const {ctx,w,h,p}=drawBase(canvas,null);
  const theme=getComputedStyle(document.documentElement);
  const budgetColor=theme.getPropertyValue("--one-chart-budget").trim()||"#77818b";
  const realColor=theme.getPropertyValue("--one-chart-real").trim()||"#dce0df";
  const gridColor=theme.getPropertyValue("--border").trim()||"#3b3b3b";
  const labelColor=theme.getPropertyValue("--muted").trim()||"#9b9b98";
  const max=Math.max(1,...a.map(v=>Number(v)||0),...b.map(v=>Number(v)||0));
  const plotW=w-p.l-p.r,plotH=h-p.t-p.b,group=plotW/Math.max(1,labels.length);
  ctx.strokeStyle=gridColor;ctx.fillStyle=labelColor;ctx.font="12px system-ui";
  for(let i=0;i<=4;i++){
    const y=p.t+plotH*i/4;
    ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(w-p.r,y);ctx.stroke();
    ctx.textAlign="left";ctx.fillText(reportMoneyShort(max*(1-i/4)),4,y+4);
  }
  labels.forEach((label,i)=>{
    const bw=labels.length===1?Math.min(44,Math.max(26,group*.09)):Math.max(7,Math.min(26,group*.28));
    const x=p.l+i*group+group/2;
    const ah=Math.max(0,(Number(a[i])||0)/max*plotH),bh=Math.max(0,(Number(b[i])||0)/max*plotH);
    // Presupuesto: izquierda. Real: derecha. Coincide con la leyenda visible.
    ctx.fillStyle=budgetColor;ctx.fillRect(x-bw-2,p.t+plotH-ah,bw,ah);
    ctx.fillStyle=realColor;ctx.fillRect(x+2,p.t+plotH-bh,bw,bh);
    ctx.fillStyle=labelColor;ctx.textAlign="center";ctx.fillText(label,x,h-14);
  });
  ctx.textAlign="left";
}
function drawLineChart(canvas,labels,a,b){
  const valid=[...a,...b].filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);
  const {ctx,w,h,p}=drawBase(canvas), min=Math.min(0,...valid), max=Math.max(1,...valid), span=max-min||1, plotW=w-p.l-p.r,plotH=h-p.t-p.b;
  ctx.strokeStyle="#d0d5dd";ctx.fillStyle="#667085";ctx.font="12px system-ui";
  for(let i=0;i<=4;i++){const y=p.t+plotH*i/4;ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(w-p.r,y);ctx.stroke();ctx.fillText(money(max-span*i/4).replace("CRC","").trim(),2,y+4)}
  function line(vals,color,dashed=false){
    ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2.5;ctx.setLineDash(dashed?[7,5]:[]);ctx.beginPath();let started=false;
    vals.forEach((v,i)=>{if(v===null||v===undefined)return;const x=p.l+(labels.length===1?0:i*plotW/(labels.length-1)),y=p.t+(max-Number(v))/span*plotH;if(started)ctx.lineTo(x,y);else{ctx.moveTo(x,y);started=true}});
    ctx.stroke();ctx.setLineDash([]);
    vals.forEach((v,i)=>{if(v===null||v===undefined)return;const x=p.l+(labels.length===1?0:i*plotW/(labels.length-1)),y=p.t+(max-Number(v))/span*plotH;ctx.beginPath();ctx.arc(x,y,dashed?4:3.5,0,Math.PI*2);dashed?ctx.stroke():ctx.fill()});
    ctx.restore()
  }
  line(a,"#7c3aed",false);line(b,"#059669",true);labels.forEach((l,i)=>{const x=p.l+(labels.length===1?0:i*plotW/(labels.length-1));ctx.fillStyle="#667085";ctx.textAlign="center";ctx.fillText(l,x,h-14)});ctx.textAlign="left";
}


/* Movimientos 2.0: cuentas configurables y filtros comunes al listado y exportación. */
function m2Accounts(){
  return [...new Set([...ACCOUNTS,...(data.accounts||[]),...(data.movements||[]).map(m=>m.account).filter(Boolean),...(data.movementTemplates||[]).map(t=>t.account).filter(Boolean)].filter(Boolean))];
}
function m2RefreshAccounts(selected){
  const options=m2Accounts();
  ["mAccount","mtAccount"].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const prior=id==="mAccount"&&selected!==undefined?selected:el.value;
    el.innerHTML='<option value="">Sin especificar</option>'+
      options.map(name=>`<option value="${safe(name)}">${safe(name)}</option>`).join("");
    el.value=options.includes(prior)||!prior?prior:"";
  });
}
function m2FilteredMovementRows(){
  const level=document.getElementById("movementLevel")?.value||"quarter";
  const value=document.getElementById("movementPeriod")?.value||"";
  const type=document.getElementById("movementTypeFilter")?.value||"";
  const category=document.getElementById("movementCategoryFilter")?.value||"";
  const currency=document.getElementById("movementCurrencyFilter")?.value||"";
  const from=document.getElementById("movementDateFrom")?.value||"";
  const to=document.getElementById("movementDateTo")?.value||"";
  const query=(document.getElementById("movementSearch")?.value||"").trim().toLocaleLowerCase("es");
  const scope=selectedMovements(level,value).sort((a,b)=>String(b.date).localeCompare(String(a.date))||num(b.seq)-num(a.seq));
  const rows=scope.filter(m=>{
    if(type&&m.type!==type)return false;
    if(category&&!(m.splits||[]).some(x=>x.categoryId===category)&&m.categoryId!==category)return false;
    if(currency&&normalizeCurrency(m.currency)!==currency)return false;
    if(from&&m.date<from||to&&m.date>to)return false;
    if(query){
      const splitCategories=(m.splits||[]).map(x=>categoryNameById(x.categoryId,"")).join(" ");
      const hay=[m.description,movementCategoryName(m),splitCategories,movementDebtName(m),m.account,m.paymentMethod,m.type,m.currency,m.amount].join(" ").toLocaleLowerCase("es");
      if(!hay.includes(query))return false;
    }
    return true;
  });
  return {level,value,scope,rows};
}
function m2SameMovement(a,b){
  return a.date===b.date&&a.type===b.type&&a.categoryId===b.categoryId&&
    normalizeCurrency(a.currency)===normalizeCurrency(b.currency)&&Math.abs(num(a.amount)-num(b.amount))<.005&&
    (a.account||"")===(b.account||"")&&(a.debtId||"")===(b.debtId||"");
}
function m2Audit(action,m,before=null){
  data.movementAudit=Array.isArray(data.movementAudit)?data.movementAudit:[];
  data.movementAudit.push({id:id(),action,movementId:m.id,at:new Date().toISOString(),previous:before?clone(before):null});
}
function m2RenderAudit(){
  const list=document.getElementById("movementAuditList");if(!list)return;
  const entries=[...(data.movementAudit||[])].slice(-30).reverse();
  const labels={create:"Creado",edit:"Modificado",delete:"Eliminado"};
  list.innerHTML=entries.length?entries.map(e=>{
    const current=(data.movements||[]).find(m=>m.id===e.movementId);
    const m=current||e.previous,when=e.at?new Date(e.at).toLocaleString("es-CR"):"";
    return `<div class="m2-audit-row"><span><strong>${labels[e.action]||"Cambio"}</strong> · ${safe(m?.description||movementCategoryName(m||{})||"Movimiento")}${m?` · ${dateLabel(m.date)}`:""}</span><span>${safe(when)}</span></div>`;
  }).join(""):'<div class="empty">No hay cambios registrados desde la actualización.</div>';
}

function m2RenderAccountSummary(scope){
  const box=document.getElementById("movementAccountsSummary");if(!box)return;
  const byAccount=new Map();
  scope.filter(m=>m.type==="Ingreso"||m.type==="Gasto"||m.type==="Pago deuda").forEach(m=>{
    const name=m.account||"Sin cuenta",before=byAccount.get(name)||{count:0,net:0};
    before.count++;before.net+=signedMovement(m);byAccount.set(name,before);
  });
  const rows=[...byAccount.entries()].sort((a,b)=>Math.abs(b[1].net)-Math.abs(a[1].net));
  box.hidden=rows.length===0;
  box.innerHTML=`<div class="v7-card-head"><div><h2>Actividad por cuenta</h2><p>No representa el saldo bancario conciliado.</p></div></div>`+
    (rows.length?rows.map(([name,r])=>`<div class="m2-balance-row"><span>${safe(name)} <small>· ${r.count} mov.</small></span><strong>${r.net>=0?"+":"−"}${money(Math.abs(r.net))}</strong></div>`).join(""):'<div class="empty">Sin actividad por cuenta.</div>');
}

/* División contable: las líneas son asignaciones del mismo cargo, no nuevos cargos. */
function m2AddSplitRow(categoryId="",amount=""){
  const box=document.getElementById("movementSplitRows");if(!box)return;
  const choices=categoriesOfType("Gasto"),selected=categoryId||"";
  const opts=[...choices];
  if(selected&&!opts.some(c=>c.id===selected)){const historic=categoryById(selected);if(historic)opts.push(historic)}
  const row=document.createElement("div");row.className="m2-split-row";
  row.innerHTML=`<select class="m2-split-category" aria-label="Categoría del gasto"><option value="" disabled>Seleccioná una categoría</option>${opts.map(c=>`<option value="${safe(c.id)}">${safe(c.name)}</option>`).join("")}</select>
    <input class="m2-split-amount" type="number" min="0.01" step="0.01" placeholder="Monto" aria-label="Monto en moneda original" value="${amount!==""?String(amount):""}">
    <button type="button" class="btn secondary small" data-m2-remove-split title="Quitar línea">×</button>`;
  box.appendChild(row);row.querySelector("select").value=selected;
  m2SplitMessage();
}
function m2GetSplits(){
  const box=document.getElementById("movementSplitRows");
  if(!m2IsSplitMode())return {splits:[],error:""};
  if(!box?.children.length)return {splits:[],error:"Agregá al menos dos categorías o cerrá la opción de división."};
  const splits=[...box.querySelectorAll(".m2-split-row")].map(row=>({
    categoryId:row.querySelector(".m2-split-category").value,
    amount:Number(row.querySelector(".m2-split-amount").value)
  }));
  if(splits.length<2)return {splits:[],error:"Para dividir, agregá dos o más categorías."};
  if(splits.some(x=>!x.categoryId||!Number.isFinite(x.amount)||x.amount<=0))return {splits:[],error:"Cada línea necesita una categoría y un monto positivo."};
  if(new Set(splits.map(x=>x.categoryId)).size!==splits.length)return {splits:[],error:"No repitás categorías; sumá los importes en una sola línea."};
  const total=Number(document.getElementById("mAmount")?.value);
  const allocated=Math.round(splits.reduce((sum,x)=>sum+x.amount,0)*100)/100;
  if(!Number.isFinite(total)||Math.abs(total-allocated)>.005)return {splits:[],error:`La distribución suma ${allocated.toFixed(2)} y el movimiento es ${(total||0).toFixed(2)}. Deben coincidir.`};
  return {splits,error:""};
}
function m2SplitMessage(){
  const el=document.getElementById("movementSplitStatus");if(!el)return;
  const box=document.getElementById("movementSplitRows");
  if(!box?.children.length){el.textContent="Agregá al menos dos categorías para dividir el gasto.";el.className="m2-status is-pending";return}
  const allocated=[...box.querySelectorAll(".m2-split-amount")].reduce((sum,input)=>sum+num(input.value),0);
  const amountInput=document.getElementById("mAmount");
  const total=num(amountInput?.value),difference=Math.round((total-allocated)*100)/100;
  if(!amountInput?.value||total<=0){el.textContent="Ingresá el monto total y asigná cuánto corresponde a cada categoría.";el.className="m2-status is-pending";return}
  const fmt=n=>Number(n).toLocaleString("es-CR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const complete=total>0&&Math.abs(difference)<.005&&box.children.length>=2;
  el.className="m2-status "+(complete?"is-complete":"is-pending");
  el.textContent=complete?`✓ Distribución completa · ${fmt(allocated)} de ${fmt(total)}`:
    `Asignado: ${fmt(allocated)} de ${fmt(total)} · ${difference>=0?"Faltan":"Excede"} ${fmt(Math.abs(difference))}`;
}
/* El formulario tiene exactamente un modo de categorización activo. */
function m2IsSplitMode(){
  return document.getElementById("mType")?.value==="Gasto"&&
    document.getElementById("movementSplitToggle")?.getAttribute("aria-pressed")==="true";
}
function m2SetSplitMode(enabled,{createRows=true}={}){
  const toggle=document.getElementById("movementSplitToggle");
  const panel=document.getElementById("movementSplitDetails");
  const box=document.getElementById("movementSplitRows");
  const active=!!enabled&&document.getElementById("mType")?.value==="Gasto";
  if(active&&createRows&&!box.children.length){
    const categories=categoriesOfType("Gasto");
    if(categories.length<2){alert("Necesitás al menos dos categorías de gasto activas para dividir un movimiento.");return}
    m2AddSplitRow();
    m2AddSplitRow();
  }
  toggle.setAttribute("aria-pressed",String(active));
  toggle.textContent=active?"✓ Dividiendo entre categorías":"＋ Dividir entre categorías";
  panel.hidden=!active;
  updateMovementFields();
  m2SplitMessage();
}
function m2ResetComposer(close=true){
  const form=document.getElementById("movementForm");form?.reset();
  document.getElementById("mEditId").value="";
  document.getElementById("mScheduledId").value="";
  document.getElementById("movementComposerTitle").textContent="Nuevo movimiento";
  document.getElementById("movementSubmitBtn").textContent="Registrar";
  document.getElementById("movementCancelEdit").hidden=true;
  document.getElementById("movementSplitRows").innerHTML="";
  m2SetSplitMode(false,{createRows:false});
  document.getElementById("mDate").value=todayIso();
  document.getElementById("mType").value="Gasto";
  document.getElementById("mCurrency").value=displayCurrency();
  refreshMovementCategorySelect();refreshDebtSelect();m2RefreshAccounts("");updateMovementFields();m2RefreshQuickTypes();
  oneCentralRestoreMovementForm();
  document.getElementById("oneCentralGoalForm").reset();
  if(close){const dialog=document.getElementById("movementComposerDialog");if(dialog?.open)dialog.close();document.getElementById("movementComposer").hidden=true;}
}
function m2OpenComposer(m=null,{repeat=false,scheduledId=""}={}){
  m2ResetComposer(false);
  const original=m&&!(repeat||scheduledId);
  document.getElementById("mEditId").value=original?m.id:"";
  document.getElementById("mScheduledId").value=scheduledId;
  document.getElementById("movementComposerTitle").textContent=original?"Editar movimiento":repeat?"Repetir movimiento":scheduledId?"Confirmar programado":"Nuevo movimiento";
  document.getElementById("movementSubmitBtn").textContent=original?"Guardar cambios":"Registrar";
  document.getElementById("movementCancelEdit").hidden=!original&&!repeat&&!scheduledId;
  if(m){
    document.getElementById("mType").value=m.type||"Gasto";
    document.getElementById("mDate").value=repeat?todayIso():m.date||todayIso();
    refreshMovementCategorySelect(m.categoryId);
    const category=document.getElementById("mCategory");
    if(m.categoryId&&!Array.from(category.options).some(o=>o.value===m.categoryId)){
      const past=categoryById(m.categoryId);
      if(past){const option=document.createElement("option");option.value=past.id;option.textContent=past.name+" (archivada)";category.appendChild(option)}
    }
    if(m.categoryId)category.value=m.categoryId;
    refreshDebtSelect(m.debtId||"");
    document.getElementById("mDebt").value=m.debtId||"";
    m2RefreshAccounts(m.account||"");
    document.getElementById("mDescription").value=m.description||"";
    document.getElementById("mAmount").value=m.amount;
    document.getElementById("mCurrency").value=normalizeCurrency(m.currency);
    document.getElementById("mPaymentMethod").value=m.paymentMethod||"";
    if((m.splits||[]).length){
      m.splits.forEach(x=>m2AddSplitRow(x.categoryId,x.amount));
      m2SetSplitMode(true,{createRows:false});
    }
  }
  updateMovementFields();m2RefreshQuickTypes();
  document.getElementById("movementComposer").hidden=false;
  const dialog=document.getElementById("movementComposerDialog");if(dialog&&!dialog.open)dialog.showModal();
  document.getElementById("mAmount").focus({preventScroll:true});
  if(repeat)document.getElementById("mAmount").select();
}


/* Programados: se crean plantillas, jamás movimientos reales sin confirmación. */
function m2NextScheduledDate(date,frequency,anchorDay=0){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||""))return "";
  if(frequency==="weekly")return addDaysIso(date,7);
  if(frequency==="fortnightly")return addDaysIso(date,14);
  const [year,month,day]=date.split("-").map(Number),targetDay=anchorDay||day;
  const delta=frequency==="yearly"?12:1;
  const target=new Date(Date.UTC(year,month-1+delta,1));
  const y=target.getUTCFullYear(),m=target.getUTCMonth()+1;
  const last=lastDayOfMonth(y,m);
  return `${y}-${String(m).padStart(2,"0")}-${String(Math.min(targetDay,last)).padStart(2,"0")}`;
}
function m2TemplateCategoryOptions(selected=""){
  const type=document.getElementById("mtType")?.value||"Gasto",el=document.getElementById("mtCategory");
  if(!el)return;
  const rows=[...categoriesOfType(type)];
  if(selected&&!rows.some(c=>c.id===selected)){const previous=categoryById(selected);if(previous)rows.push(previous)}
  el.innerHTML=rows.map(c=>`<option value="${safe(c.id)}">${safe(c.name)}</option>`).join("");
  if(selected&&rows.some(c=>c.id===selected))el.value=selected;
  const debt=document.getElementById("mtDebt");
  if(debt)debt.innerHTML='<option value="">Seleccionar deuda</option>'+activeDebts().map(d=>`<option value="${safe(d.id)}">${safe(d.name)}</option>`).join("");
  const debtField=document.getElementById("mtDebtField");
  if(debtField)debtField.hidden=type!=="Pago deuda";
}
function m2OpenTemplate(source=null){
  const fromTemplate=source&&Object.prototype.hasOwnProperty.call(source,"frequency");
  if(source?.splits?.length>1&&!fromTemplate)return alert("Para repetir un gasto dividido, usá «Repetir» desde su movimiento. Las plantillas frecuentes con divisiones se incorporarán posteriormente.");
  document.getElementById("movementTemplateForm").reset();
  document.getElementById("movementTemplateTitle").textContent=fromTemplate?"Editar programación":"Programar movimiento";
  document.getElementById("mtId").value=fromTemplate?source.id:"";
  document.getElementById("mtName").value=source?.name||source?.description||"";
  document.getElementById("mtType").value=source?.type||"Gasto";
  document.getElementById("mtFrequency").value=source?.frequency||"monthly";
  document.getElementById("mtNextDate").value=fromTemplate?source.nextDate:todayIso();
  m2TemplateCategoryOptions(source?.categoryId||"");
  document.getElementById("mtDebt").value=source?.debtId||"";
  document.getElementById("mtAmount").value=source?.amount||"";
  document.getElementById("mtCurrency").value=normalizeCurrency(source?.currency||displayCurrency());
  document.getElementById("mtDescription").value=source?.description||"";
  m2RefreshAccounts();
  document.getElementById("mtAccount").value=source?.account||"";
  document.getElementById("movementTemplateDialog").showModal();
}
function m2LastRepeatable(){
  return [...(data.movements||[])].filter(m=>{
      const cat=categoryById(m.categoryId);
      return ["Gasto","Ingreso","Pago deuda"].includes(m.type)&&!oneIsLinkedCobroMovement(m)&&
        !!cat&&categoryIsActive(cat)&&
        (m.type!=="Pago deuda"||activeDebts().some(d=>d.id===m.debtId));
    })
    .sort((a,b)=>num(b.seq)-num(a.seq)||String(b.createdAt||"").localeCompare(String(a.createdAt||"")))[0]||null;
}
function m2RenderTemplates(){
  const repeat=document.getElementById("oneRepeatLastMovement"),last=m2LastRepeatable();
  if(repeat){repeat.hidden=!last;repeat.title=last?"Preparar "+last.type.toLowerCase()+" sin guardarlo hasta confirmar":"No hay movimientos repetibles";}
  const box=document.getElementById("movementTemplatesList");if(!box)return;
  const items=[...(data.movementTemplates||[])].sort((a,b)=>Number(b.active)-Number(a.active)||String(a.nextDate).localeCompare(String(b.nextDate)));
  const card=document.getElementById("movementTemplatesCard");if(card)card.hidden=items.length===0;
  const heading=document.getElementById("movementScheduledTitle");if(heading){const due=items.filter(t=>t.active&&t.nextDate<=todayIso()).length;heading.textContent=due?`Programados · ${due} por confirmar`:`Programados · ${items.length}`;}
  const freq={weekly:"Semanal",fortnightly:"Cada 14 días",monthly:"Mensual",yearly:"Anual"};
  box.innerHTML=items.length?items.map(t=>{
    const isDue=t.active&&t.nextDate<=todayIso(),cls=t.active?(isDue?" · Por confirmar":" · Próximo"):" · Pausado";
    return `<div class="m2-template-card">
       <div><strong>${safe(t.name||t.description||"Movimiento programado")}</strong><small>${safe(freq[t.frequency]||"Mensual")}${cls} · ${dateLabel(t.nextDate)} · ${originalMoney(t.amount,t.currency)}</small></div>
       <div class="actions">
       ${t.active?`<button class="btn ${isDue?"small":"secondary small"}" type="button" data-m2-post-template="${safe(t.id)}">${isDue?"Revisar y registrar":"Preparar"}</button>`:""}
       <button class="btn secondary small" type="button" data-m2-edit-template="${safe(t.id)}">Editar</button>
       <button class="btn secondary small" type="button" data-m2-toggle-template="${safe(t.id)}">${t.active?"Pausar":"Reactivar"}</button>
       </div></div>`;
  }).join(""):'<div class="empty">Todavía no tenés movimientos programados. Podés crear un recordatorio recurrente para registrarlo cuando corresponda.</div>';
}
function m2PrepareScheduled(t){
  if(!t?.active)return;
  if(!periodForDate(t.nextDate))return alert("La próxima fecha está fuera de los trimestres configurados. Agregá ese trimestre en Presupuesto o editá la programación.");
  if(!categoryById(t.categoryId)||!categoryIsActive(categoryById(t.categoryId)))return alert("La categoría de este programado está archivada. Editá la programación antes de registrar.");
  if(t.type==="Pago deuda"&&!activeDebts().some(d=>d.id===t.debtId))return alert("Seleccioná una deuda activa en la programación.");
  m2OpenComposer({...t,date:t.nextDate},{scheduledId:t.id});
}
function m2SaveTemplate(){
  const tid=document.getElementById("mtId").value,old=(data.movementTemplates||[]).find(t=>t.id===tid)||null;
  const type=document.getElementById("mtType").value,categoryId=document.getElementById("mtCategory").value;
  const c=categoryById(categoryId),debtId=document.getElementById("mtDebt").value;
  const date=document.getElementById("mtNextDate").value,amount=Number(document.getElementById("mtAmount").value);
  const name=document.getElementById("mtName").value.trim();
  if(!name||!c||c.type!==type||!categoryIsActive(c))return alert("Completá un nombre y una categoría activa del tipo seleccionado.");
  if(type==="Pago deuda"&&!activeDebts().some(d=>d.id===debtId))return alert("Seleccioná una deuda activa.");
  if(!date||!Number.isFinite(amount)||amount<=0)return alert("Ingresá una fecha y un monto válidos.");
  const obj={...old,id:old?.id||id(),name,type,categoryId,debtId:type==="Pago deuda"?debtId:"",
    frequency:document.getElementById("mtFrequency").value,nextDate:date,anchorDay:Number(date.slice(8,10)),
    amount,currency:normalizeCurrency(document.getElementById("mtCurrency").value),
    description:document.getElementById("mtDescription").value.trim(),account:document.getElementById("mtAccount").value,
    active:old?old.active!==false:true,createdAt:old?.createdAt||new Date().toISOString()};
  data.movementTemplates=data.movementTemplates||[];
  const index=data.movementTemplates.findIndex(t=>t.id===obj.id);
  if(index<0)data.movementTemplates.push(obj);else data.movementTemplates[index]=obj;
  save();document.getElementById("movementTemplateDialog").close();m2RenderTemplates();
  oneActionSaved(old?"Programación actualizada":"Movimiento frecuente guardado",
    obj.name+" · "+originalMoney(obj.amount,obj.currency)+"\nSe registrará únicamente cuando lo confirmés.");
}

function m2RefreshQuickTypes(){
  const type=document.getElementById("mType")?.value;
  document.querySelectorAll("[data-m2-type]").forEach(b=>{const active=b.dataset.m2Type===type;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));b.hidden=b.dataset.m2Type==="Pago deuda"&&!oneModuleEnabled("debts")&&type!=="Pago deuda";});
  document.querySelectorAll("[data-one-action]").forEach(b=>{b.hidden=!!document.getElementById("mEditId")?.value||!!document.getElementById("mScheduledId")?.value;});
  const toggle=document.getElementById("movementSplitToggle");
  if(toggle)toggle.hidden=type!=="Gasto";
  if(type!=="Gasto")m2SetSplitMode(false,{createRows:false});
  else updateMovementFields();
}

function updateMovementFields(){
  const type=document.getElementById("mType")?.value||"";
  const payment=type==="Pago deuda";
  const categoryField=document.getElementById("mCategoryField"),debtField=document.getElementById("mDebtField");
  const debtSelect=document.getElementById("mDebt"),categorySelect=document.getElementById("mCategory");
  const split=m2IsSplitMode();
  if(categoryField)categoryField.hidden=payment||split;
  if(categorySelect)categorySelect.required=!payment&&!split;
  if(debtField)debtField.hidden=!payment;
  if(debtSelect)debtSelect.required=payment;
  const description=document.getElementById("mDescription");
  if(description)description.placeholder=payment?"¿Querés agregar un detalle?":type==="Ingreso"?"¿De dónde recibiste el dinero?":"¿En qué gastaste?";
  if(payment){
    const d=(data.debts||[]).find(x=>x.id===debtSelect?.value);
    const suggested=suggestDebtCategoryId(d);
    if(suggested&&categorySelect&&!document.getElementById("mEditId")?.value&&!document.getElementById("mScheduledId")?.value)categorySelect.value=suggested;
  }else if(debtSelect){debtSelect.value="";}
}
function refreshMovementCategorySelect(selected=""){
  const el=document.getElementById("mCategory");if(!el)return;
  const type=document.getElementById("mType")?.value||"Gasto";
  const editing=!!document.getElementById("mEditId")?.value;
  const current=selected||(editing?el.value:"");
  const rows=categoriesOfType(type);
  el.innerHTML='<option value="" disabled>Seleccioná una categoría</option>'+
    rows.map(c=>'<option value="'+safe(c.id)+'">'+safe(c.name)+'</option>').join("");
  el.value=rows.some(c=>c.id===current)?current:"";
}
function suggestDebtCategoryId(d){
  const rows=categoriesOfType("Pago deuda");if(!rows.length)return "";
  const needle=d?.type==="Préstamo"?/pr[eé]stamo/i:d?.type==="Tarjeta"?/tarjeta/i:null;
  return (needle?rows.find(c=>needle.test(c.name)):null)?.id||rows[0].id;
}
function categoryUsageCount(c){return (data.movements||[]).filter(m=>movementMatchesCategory(m,c)).length}
function categoryBudgetUsage(c){return (data.periods||[]).filter(p=>num(p.categoryBudgets?.[c.id])!==0).length}
function renderCategories(){
  const status=document.getElementById("categoryStatusFilter")?.value||"active",type=document.getElementById("categoryTypeFilter")?.value||"";
  const all=sortedCategories(data.categories||[]),active=all.filter(categoryIsActive),archived=all.filter(c=>!categoryIsActive(c));
  const rows=all.filter(c=>(status==="all"||(status==="active"?categoryIsActive(c):!categoryIsActive(c)))&&(!type||c.type===type));
  const budgetable=active.filter(c=>c.budgetable!==false&&c.type!=="Movimiento patrimonial").length;
  document.getElementById("categoryKpis").innerHTML=[
    ["Categorías activas",active.length],["En presupuesto",budgetable],["Ingresos",active.filter(c=>c.type==="Ingreso").length],["Gastos / deuda",active.filter(c=>["Gasto","Pago deuda"].includes(c.type)).length]
  ].map(([l,v])=>`<div class="card kpi"><div class="label">${l}</div><div class="value">${v}</div></div>`).join("");
  document.getElementById("categoryCount").textContent=`${rows.length} visibles · ${archived.length} archivadas`;
  document.getElementById("categoryTable").innerHTML=`<thead><tr><th>Estado</th><th>Nombre</th><th>Tipo financiero</th><th>Grupo</th><th>Presupuesto</th><th>Planificación</th><th>Uso histórico</th><th>Acciones</th></tr></thead><tbody>${rows.length?rows.map(c=>`<tr><td><span class="status-badge ${categoryIsActive(c)?"active":"archived"}">${categoryIsActive(c)?"Activa":"Archivada"}</span></td><td><strong class="${categoryIsActive(c)?"":"category-name-archived"}">${safe(c.name)}</strong></td><td><span class="category-type ${categoryClass(c.type)}">${categoryTypeLabel(c.type)}</span></td><td>${safe(c.group||"—")}</td><td>${c.budgetable!==false&&c.type!=="Movimiento patrimonial"?"Sí":"No"}</td><td>${c.type==="Ingreso"?incomePlanSummary(c):"—"}</td><td>${categoryUsageCount(c)} mov. · ${categoryBudgetUsage(c)} presup.</td><td><div class="actions"><button class="btn secondary small" data-edit-category="${safe(c.id)}">Editar</button>${categoryIsActive(c)?`<button class="btn secondary small" data-archive-category="${safe(c.id)}">Archivar</button>`:`<button class="btn small" data-reactivate-category="${safe(c.id)}">Reactivar</button>`}</div></td></tr>`).join(""):`<tr><td colspan="8" class="empty">No hay categorías en esta vista.</td></tr>`}</tbody>`;
}
function updateIncomeConfigVisibility(){
  const isIncome=document.getElementById("cType")?.value==="Ingreso",panel=document.getElementById("incomeConfigFields");if(panel)panel.hidden=!isIncome;if(!isIncome)return;
  const frequency=document.getElementById("cIncomeFrequency").value;
  ["Semimonthly","Monthly","Weekly","Biweekly","Once","Irregular"].forEach(name=>{const el=document.getElementById("incomeSchedule"+name);if(el)el.hidden=true});
  const map={semimonthly:"Semimonthly",monthly:"Monthly",weekly:"Weekly",biweekly:"Biweekly",once:"Once",irregular:"Irregular"};const target=document.getElementById("incomeSchedule"+map[frequency]);if(target)target.hidden=false;
  const auto=document.getElementById("cIncomeAuto");if(auto){auto.disabled=frequency==="irregular";if(frequency==="irregular")auto.checked=false}
}
function fillIncomeConfigForm(c){
  const cfg=normalizeIncomeConfig(c?.incomeConfig||defaultIncomeConfigForCategory(data,c||{id:"",name:document.getElementById("cName")?.value||"",type:"Ingreso"}));
  document.getElementById("cIncomeSubtype").value=cfg.subtype;document.getElementById("cIncomeBehavior").value=cfg.behavior;document.getElementById("cIncomeFrequency").value=cfg.frequency;document.getElementById("cIncomeAmount").value=cfg.expectedAmount||"";document.getElementById("cIncomeCurrency").value=cfg.expectedCurrency;document.getElementById("cIncomeAccount").value=cfg.account;document.getElementById("cIncomeAuto").checked=cfg.projectAutomatically;
  document.getElementById("cIncomeDay1").value=cfg.day1;document.getElementById("cIncomeDay2").value=cfg.day2;document.getElementById("cIncomeAssign1").value=cfg.assignment1;document.getElementById("cIncomeAssign2").value=cfg.assignment2;document.getElementById("cIncomeMonthlyDay").value=cfg.monthlyDay;document.getElementById("cIncomeWeekday").value=String(cfg.weekday);document.getElementById("cIncomeBiweeklyStart").value=cfg.biweeklyStart;document.getElementById("cIncomeOnceDate").value=cfg.onceDate;updateIncomeConfigVisibility();
}
function readIncomeConfigForm(){
  const frequency=document.getElementById("cIncomeFrequency").value;
  return normalizeIncomeConfig({subtype:document.getElementById("cIncomeSubtype").value,behavior:document.getElementById("cIncomeBehavior").value,frequency,expectedAmount:num(document.getElementById("cIncomeAmount").value),expectedCurrency:document.getElementById("cIncomeCurrency").value,account:document.getElementById("cIncomeAccount").value,projectAutomatically:frequency!=="irregular"&&document.getElementById("cIncomeAuto").checked,day1:document.getElementById("cIncomeDay1").value,day2:document.getElementById("cIncomeDay2").value,assignment1:document.getElementById("cIncomeAssign1").value,assignment2:document.getElementById("cIncomeAssign2").value,monthlyDay:document.getElementById("cIncomeMonthlyDay").value,weekday:document.getElementById("cIncomeWeekday").value,biweeklyStart:document.getElementById("cIncomeBiweeklyStart").value,onceDate:document.getElementById("cIncomeOnceDate").value});
}
function validateIncomeConfig(cfg){
  if(!cfg)return true;if(cfg.projectAutomatically&&cfg.expectedAmount<=0){alert("Para proyectar automáticamente, indica un monto esperado por pago.");return false}if(cfg.frequency==="biweekly"&&cfg.projectAutomatically&&!cfg.biweeklyStart){alert("Indica una fecha de referencia para el ingreso de cada 2 semanas.");return false}if(cfg.frequency==="once"&&cfg.projectAutomatically&&!cfg.onceDate){alert("Indica la fecha esperada para este ingreso de una sola vez.");return false}return true;
}
function openCategory(c=null){
  document.getElementById("categoryDialogTitle").textContent=c?"Editar categoría":"Nueva categoría";
  document.getElementById("cId").value=c?.id||"";document.getElementById("cName").value=c?.name||"";document.getElementById("cType").value=c?.type||"Gasto";document.getElementById("cGroup").value=c?.group||"";document.getElementById("cBudgetable").checked=c?c.budgetable!==false:true;
  fillIncomeConfigForm(c?.type==="Ingreso"?c:null);updateIncomeConfigVisibility();document.getElementById("categoryDialog").showModal();
}

function openDebt(d=null){
  const dialog=document.getElementById("debtDialog");
  document.getElementById("debtDialogTitle").textContent=d?"Editar deuda":"Agregar deuda";
  ["Id","Type","Name","Status","Usd","Crc","Limit","Minimum","PayDay","Rate","Priority","Goal","Notes"].forEach(k=>{
    const el=document.getElementById("d"+k);if(!el)return;
    const map={Id:"id",Type:"type",Name:"name",Status:"status",Usd:"usd",Crc:"crc",Limit:"limit",Minimum:"minimum",PayDay:"payDay",Rate:"rate",Priority:"priority",Goal:"goal",Notes:"notes"};
    el.value=d?.[map[k]]??({Status:"active",Usd:0,Crc:0,Limit:0,Minimum:0,Priority:activeDebts().length+1}[k]??"")
  });
  document.getElementById("dLimitCurrency").value=normalizeCurrency(d?.limitCurrency||"USD");
  document.getElementById("dMinimumCurrency").value=normalizeCurrency(d?.minimumCurrency||"CRC");
  const rates=currentRates();document.getElementById("dFxPreview").value=`Venta actual: ₡${rates.sell.toFixed(2)}`;
  dialog.showModal();
}


// Reportería suspendida temporalmente: el historial queda preservado.
renderReports=function(){};
function bindReportStudio(){}

