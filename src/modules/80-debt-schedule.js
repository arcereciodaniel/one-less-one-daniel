function oneDebtMonthlyDueIso(d,month){
  const day=debtPayDayNumber(d);
  if(!day||!/^[0-9]{4}-[0-9]{2}$/.test(month))return "";
  const [year,number]=month.split("-").map(Number);
  if(number<1||number>12)return "";
  const last=new Date(Date.UTC(year,number,0)).getUTCDate();
  return month+"-"+String(Math.min(day,last)).padStart(2,"0");
}
function oneDebtShiftMonth(month,shift=1){
  const [year,number]=month.split("-").map(Number);
  return new Date(Date.UTC(year,number-1+shift,1)).toISOString().slice(0,7);
}
// Un pago anterior al vencimiento cubre su ciclo aunque se registre en el mes previo.
function oneDebtRegisteredForCycle(d,due,asOf=todayIso()){
  if(!due)return 0;
  const month=due.slice(0,7),previous=oneDebtMonthlyDueIso(d,oneDebtShiftMonth(month,-1));
  if(!previous)return 0;
  return (data.movements||[]).filter(m=>m.type==="Pago deuda"&&m.date>previous&&m.date<=asOf&&
    (m.debtId?m.debtId===d.id:m.debt===d.name))
    .reduce((sum,m)=>sum+movementAmountCRC(m),0);
}
function oneDebtDueEntry(d,asOf=todayIso()){
  const outstanding=debtOutstanding(d);
  if(debtStatus(d)!=="active"||outstanding<=.005)return null;
  const minimum=Math.min(Math.max(0,debtMinimumCRC(d)),outstanding);
  const month=asOf.slice(0,7);
  let due=oneDebtMonthlyDueIso(d,month);
  if(!due)return {debt:d,date:"",minimum,state:"undated",paid:0,coveredThisMonth:false};
  if(minimum<=0)return {debt:d,date:due,minimum:0,state:"no-minimum",paid:0,coveredThisMonth:false};
  let coveredThisMonth=false;
  for(let offset=0;offset<12;offset++){
    const paid=oneDebtRegisteredForCycle(d,due,asOf);
    const remaining=Math.max(0,minimum-paid);
    if(remaining<=.005){
      if(offset===0)coveredThisMonth=true;
      due=oneDebtMonthlyDueIso(d,oneDebtShiftMonth(due.slice(0,7),1));
      continue;
    }
    const state=paid>0?(due<asOf?"review":"partial"):(due<asOf?"past":due===asOf?"today":"upcoming");
    return {debt:d,date:due,minimum:remaining,fullMinimum:minimum,state,paid,coveredThisMonth};
  }
  return {debt:d,date:due,minimum,fullMinimum:minimum,state:"upcoming",paid:0,coveredThisMonth};
}

function oneDebtUpcomingEntries(asOf=todayIso()){
  return activeDebts().map(d=>oneDebtDueEntry(d,asOf)).filter(Boolean)
    .sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999")||num(a.debt.priority)-num(b.debt.priority));
}
function oneDebtClassificationWarnings(){
  const byId=new Map((data.categories||[]).map(c=>[c.id,c]));
  const mismatch=(data.movements||[]).filter(m=>{
    const type=byId.get(m.categoryId)?.type;
    return type&&["Gasto","Pago deuda"].includes(m.type)&&type!==m.type;
  }).length;
  const orphan=(data.movements||[]).filter(m=>m.type==="Pago deuda"&&
    !(data.debts||[]).some(d=>m.debtId?d.id===m.debtId:d.name===m.debt)).length;
  return {mismatch,orphan};
}
function oneDebtDueWhen(date,asOf=todayIso()){
  if(!date)return "Sin día configurado";
  const days=Math.round((Date.parse(date+"T00:00:00Z")-Date.parse(asOf+"T00:00:00Z"))/86400000);
  return days===0?"Vence hoy":days<0?"Venció hace "+Math.abs(days)+" día(s)":"En "+days+" día(s)";
}
function oneDebtRenderDueSchedule(asOf=todayIso()){
  const summary=document.getElementById("debtDueSummary"),list=document.getElementById("debtDueList");
  if(!summary||!list)return;
  const entries=oneDebtUpcomingEntries(asOf),upper=addDaysIso(asOf,30);
  const relevant=entries.filter(x=>x.date&&x.minimum>0&&x.date<=upper);
  const total=relevant.reduce((sum,x)=>sum+x.minimum,0);
  const unknown=entries.filter(x=>!x.date||!x.minimum).length;
  summary.innerHTML="<span>Cuotas estimadas de los próximos 30 días y diferencias por verificar"+
    (unknown?" · "+unknown+" sin datos completos":"")+"</span><strong>"+money(total)+"</strong>";
  const visible=entries.filter(x=>x.date&&x.minimum>0).slice(0,5);
  list.innerHTML=visible.length?visible.map(x=>{
    const payment=x.paid>0?"Abonos vinculados: "+money(x.paid)+" · ":"";
    const when=oneDebtDueWhen(x.date,asOf),scheduled=" · "+dateLabel(x.date);
    const meta=x.state==="review"?when+scheduled+" · "+payment+"Diferencia estimada: "+money(x.minimum)+" · verificá con el banco":
      x.state==="partial"?when+scheduled+" · "+payment+"Faltante estimado: "+money(x.minimum):
      x.state==="past"?when+scheduled+" · sin pago vinculado; revisá el banco":
      x.state==="today"?"Vence hoy"+scheduled:
      x.coveredThisMonth?"Cuota anterior cubierta · próximo vencimiento "+dateLabel(x.date):
      "Vencimiento estimado"+scheduled+" · "+when;
    const label=x.state==="review"?"Por verificar":x.state==="partial"?"Saldo estimado":"Cuota / mínimo";
    return '<div class="one-debt-due-row"><div><div class="one-due-name">'+v7SafeText(x.debt.name)+
      '</div><div class="one-due-meta">'+meta+'</div></div><div class="one-due-amount">'+money(x.minimum)+
      '<small>'+label+'</small></div></div>';
  }).join(""):'<p class="one-debt-due-note">'+(entries.length?
    "No hay cuotas pendientes con fecha y mínimo configurados.":"Todavía no tenés deudas activas.")+"</p>";
  if(unknown)list.insertAdjacentHTML("beforeend",'<p class="one-debt-due-note">Revisá el día de pago y mínimo de las deudas sin información completa.</p>');
  if(visible.some(x=>x.paid>0||["past","review"].includes(x.state)))
    list.insertAdjacentHTML("beforeend",'<p class="one-debt-due-note">Los abonos se asignan al ciclo estimado según su fecha. Un pago tardío o un cambio del mínimo puede requerir verificar el estado de cuenta. No se modifica el historial.</p>');
  const quality=oneDebtClassificationWarnings();
  if(quality.mismatch||quality.orphan)list.insertAdjacentHTML("beforeend",
    '<p class="one-debt-due-note">Revisión de historial: '+quality.mismatch+
    ' movimiento(s) con categoría distinta de su tipo y '+quality.orphan+
    ' pago(s) sin deuda vinculada. No se modificaron registros.</p>');
}

renderDebts=function(){
  const filter=document.getElementById("debtStatusFilter")?.value||"active";
  const active=activeDebts(),archived=data.debts.filter(d=>debtStatus(d)==="archived");
  const rows=data.debts.filter(d=>filter==="all"||debtStatus(d)===filter).sort((a,b)=>{
    if(debtStatus(a)!==debtStatus(b))return debtStatus(a)==="active"?-1:1;
    return num(a.priority)-num(b.priority);
  });
  const total=activeDebtTotal(),minimum=activeDebtMinimumTotal(),allPayments=active.reduce((s,d)=>s+debtPayments(d),0);
  document.getElementById("debtHeroValue").textContent=money(total);
  document.getElementById("debtHeroDelta").textContent=allPayments?`${money(allPayments)} registrados como pagos acumulados`:"Todavía no hay pagos vinculados registrados";
  document.getElementById("debtHeroDelta").className=`v7-hero-delta ${allPayments?"good":""}`;
  document.getElementById("debtHeroNote").innerHTML=total>0
    ? `<strong>${active.length} compromiso${active.length===1?"":"s"} activo${active.length===1?"":"s"} · mínimo mensual aproximado ${money(minimum)}.</strong><span>El saldo pendiente total refleja obligaciones de largo plazo; no es dinero que debas pagar todo hoy. Revisá las cuotas y próximas fechas de pago.</span>`
    : `<strong>No tenés deuda activa registrada.</strong><span>Las deudas archivadas conservan su historial y no suman al saldo pendiente.</span>`;

  const currentMonth=todayIso().slice(0,7);
  const paidMonth=(data.movements||[]).filter(m=>m.type==="Pago deuda"&&v7MonthKey(m.date)===currentMonth).reduce((s,m)=>s+movementAmountCRC(m),0);
  const upcoming=oneDebtUpcomingEntries().find(x=>x.date>=todayIso()&&x.minimum>0);
  const structured=active.filter(d=>debtNature(d)==="structured").reduce((sum,d)=>sum+debtOutstanding(d),0);
  const revolving=active.filter(d=>debtNature(d)==="revolving").reduce((sum,d)=>sum+debtOutstanding(d),0);
  document.getElementById("debtKpis").innerHTML=[
    v7Kpi("↑","green","Pagado este mes",money(paidMonth),paidMonth?"Registrado en Movimientos":"Sin pagos este mes",paidMonth?"good":""),
    v7Kpi("◫","purple","Próxima cuota",upcoming?dateLabel(upcoming.date):"—",upcoming?`${v7SafeText(upcoming.debt.name)} · ${money(upcoming.minimum)}`:"Sin cuotas con fecha pendiente",""),
    v7Kpi("▥","blue","Préstamos y acuerdos",money(structured),"Saldo estimado; pagos según calendario",""),
    v7Kpi("◧","red","Tarjetas",money(revolving),`${money(minimum)} en mínimos de todas las deudas`,"")
  ].join("");

  oneDebtRenderDueSchedule();
  document.getElementById("debtProgress").innerHTML=active.length?active.slice(0,6).map(d=>{
    const base=debtEquivalent(d),paid=debtPayments(d),pct=debtProgressPercent(d)??0;
    return `<div class="v7-debt-progress-row"><div class="name">${v7SafeText(d.name)}</div><div class="v7-debt-track"><span style="width:${pct}%"></span></div><div class="pct">${debtLatestAdjustment(d)?"Saldo conciliado":`${pct.toFixed(0)}% pagado`}</div></div>`
  }).join(""):`<div class="empty">No hay deuda activa para graficar.</div>`;

  const rated=active.map(d=>({d,rate:oneDebtEffectiveRate(d)??0})).sort((a,b)=>b.rate-a.rate||num(a.d.priority)-num(b.d.priority));
  const priority=rated[0]?.d||active.slice().sort((a,b)=>num(a.priority)-num(b.priority))[0];
  document.getElementById("debtStrategy").innerHTML=priority
    ? `<div class="v7-insight-icon">◎</div><div class="v7-eyebrow" style="margin-bottom:8px;color:var(--success)">PRIORIDAD SUGERIDA</div><h3>Enfocate primero en ${v7SafeText(priority.name)}</h3><p>${oneDebtEffectiveRate(priority)!==null?`La tasa anual correspondiente es ${oneDebtEffectiveRate(priority)}% y el saldo estimado es ${money(debtOutstanding(priority))}.`:`Es la deuda con mayor prioridad configurada y mantiene un saldo estimado de ${money(debtOutstanding(priority))}.`} Un pago adicional ahí puede acelerar tu estrategia.</p>`
    : `<div class="v7-insight-icon">✓</div><h3>Sin estrategia pendiente</h3><p>No hay deudas activas para priorizar.</p>`;

  document.getElementById("debtTotal").textContent=`Activas: ${active.length} · saldo estimado ${money(total)} · archivadas ${archived.length}`;
  document.getElementById("debtList").innerHTML=rows.length?rows.map(d=>{
    const archivedDebt=debtStatus(d)==="archived",base=debtEquivalent(d),paid=debtPayments(d),out=debtOutstanding(d),actualPct=debtProgressPercent(d),pct=actualPct??0,next=oneDebtDueEntry(d);
    const financed=debtFinancedPurchases(d),needsCheck=debtPaymentsNeedReconciliation(d);
    const actions=archivedDebt
      ? `<button class="btn secondary small" data-reactivate-debt="${safe(d.id)}">Reactivar</button><button class="btn secondary small" data-edit-debt="${safe(d.id)}">Editar</button>`
      : `<button class="btn secondary small" data-pay-debt="${safe(d.id)}">Registrar pago</button><button class="btn secondary small" data-adjust-debt="${safe(d.id)}">Actualizar saldo real</button><button class="btn secondary small" data-simulate-debt="${safe(d.id)}">Simular</button><button class="btn secondary small" data-edit-debt="${safe(d.id)}">Editar</button><button class="btn secondary small" data-archive-debt="${safe(d.id)}">Archivar</button>`;
    return `<div class="v7-debt-card ${archivedDebt?"archived":""}">
      <div class="v7-debt-name"><div class="icon">▭</div><div><strong>${v7SafeText(d.name)}</strong><span>${v7SafeText(oneDebtTypeName(d))}${archivedDebt?" · archivada":""}</span></div></div>
      <div class="v7-debt-cell"><span>Saldo pendiente estimado</span><strong>${money(out)}</strong>${financed?'<span>Compras con tarjeta: '+money(financed)+'</span>':""}${needsCheck?'<span>Cuotas sin capital desglosado · verificá con el banco</span>':""}</div>
      <div class="v7-debt-cell">${debtLatestAdjustment(d)?`<span>Saldo conciliado · ${debtLatestAdjustment(d).date}</span><strong>${money(out)}</strong><span>Pagos históricos: ${money(paid)}</span>`:`<span>${actualPct===null?"Saldo variable · conciliar con el banco":pct.toFixed(0)+"% de capital amortizado"}</span>${actualPct===null?"":`<div class="progress"><span style="width:${pct}%"></span></div>`}<span>Pagos registrados: ${money(paid)} · base: ${money(base)}</span>`}</div>
      <div class="v7-debt-cell"><span>Fecha de cuota estimada</span><strong>${next?.date?dateLabel(next.date):"—"}</strong></div>
      <div class="v7-debt-cell"><span>Pago mínimo</span><strong>${money(debtMinimumCRC(d))}</strong></div>
      <div class="v7-debt-actions">${actions}</div>
    </div>`
  }).join(""):`<div class="empty">No hay deudas en esta vista.</div>`;
};

function refreshV7MovementCategoryFilter(){
  const el=document.getElementById("movementCategoryFilter");if(!el)return;
  const current=el.value;
  const cats=sortedCategories((data.categories||[]).filter(c=>categoryIsActive(c)&&["Ingreso","Gasto","Pago deuda","Movimiento patrimonial"].includes(c.type)));
  el.innerHTML=`<option value="">Todas</option>${cats.map(c=>`<option value="${c.id}">${safe(c.name)}</option>`).join("")}`;
  if([...el.options].some(o=>o.value===current))el.value=current;
}


/* Acciones desde Movimientos reutilizan Cobros y reserveMovements; sin ingresos/gastos ficticios. */
let oneCentralCobroFromMovements=false;
function oneActionSaved(title,detail=""){
  // No altera data: invocarlo exclusivamente DESPUÉS de save()/persistencia verificada.
  const dialog=document.getElementById("oneActionSuccessDialog");
  if(!dialog)return;
  document.getElementById("oneActionSuccessTitle").textContent=String(title||"Acción completada");
  document.getElementById("oneActionSuccessDescription").textContent=String(detail||"Se guardó correctamente.");
  if(typeof dialog.showModal==="function"&&!dialog.open)dialog.showModal();
}
function oneActionSuccessInit(){
  const dialog=document.getElementById("oneActionSuccessDialog");
  document.getElementById("oneActionSuccessClose")?.addEventListener("click",()=>dialog?.close());
  dialog?.addEventListener("click",event=>{if(event.target===dialog)dialog.close()});
}
