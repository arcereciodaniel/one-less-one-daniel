/* V11.7 · Futuro Beta 1.2: simulación de amortización de una deuda.
   Solo lectura, sin guardar escenarios ni crear movimientos. Tasas nominales anuales
   constantes y cuotas mensuales fijas; NO reproduce estados bancarios. */
const ONE_DEBT_SIM_MAX_MONTHS=600;
const ONE_DEBT_SIM_MAX_EXTRA=100000000;
let oneDebtSimState={debtId:"",currency:"CRC",onceCRC:0,monthlyCRC:0};
function oneDebtSimRound(value){return Math.round((value+Number.EPSILON)*100)/100}
function oneDebtAmortize({balance,minimum,annualRate,once=0,monthlyExtra=0,maxMonths=ONE_DEBT_SIM_MAX_MONTHS}={}){
  const inputs=[balance,minimum,annualRate,once,monthlyExtra].map(Number);
  if(inputs.some(x=>!Number.isFinite(x)||x<0)||!Number.isInteger(maxMonths)||maxMonths<1||maxMonths>600||
     annualRate>200||balance>1000000000000||minimum>1000000000000)
    throw Error("Datos inválidos para simular la amortización.");
  const principal=oneDebtSimRound(balance),upfront=Math.min(principal,oneDebtSimRound(once));
  const monthlyRate=annualRate/1200;
  const run=(initial,quota)=>{
    let outstanding=oneDebtSimRound(initial),interestTotal=0,totalPaid=0;
    const rows=[];
    if(outstanding<=.005)return {status:"paid",months:0,interest:0,total:0,remaining:0,rows:[]};
    for(let month=1;month<=maxMonths;month++){
      const interest=oneDebtSimRound(outstanding*monthlyRate);
      if(!Number.isFinite(interest)||interest>1000000000000)return {status:"horizon",months:month-1,interest:interestTotal,total:totalPaid,remaining:outstanding,rows};
      const due=oneDebtSimRound(outstanding+interest);
      const paid=oneDebtSimRound(Math.min(due,quota));
      if(paid<=interest+.005)
        return {status:"insufficient",months:month-1,interest:interestTotal,total:totalPaid,remaining:outstanding,rows};
      outstanding=oneDebtSimRound(Math.max(0,due-paid));
      interestTotal=oneDebtSimRound(interestTotal+interest);
      totalPaid=oneDebtSimRound(totalPaid+paid);
      rows.push({month,interest,payment:paid,principal:oneDebtSimRound(paid-interest),balance:outstanding});
      if(outstanding<=.005)return {status:"paid",months:month,interest:interestTotal,total:totalPaid,remaining:0,rows};
    }
    return {status:"horizon",months:maxMonths,interest:interestTotal,total:totalPaid,remaining:outstanding,rows};
  };
  const baseline=run(principal,oneDebtSimRound(minimum));
  const accelerated=run(oneDebtSimRound(principal-upfront),oneDebtSimRound(minimum+monthlyExtra));
  const comparable=baseline.status==="paid"&&accelerated.status==="paid";
  return {principal,upfront,baseline,accelerated,comparable,
    monthsSaved:comparable?baseline.months-accelerated.months:null,
    interestSaved:comparable?oneDebtSimRound(Math.max(0,baseline.interest-accelerated.interest)):null};
}
function oneDebtSimReadRate(d){
  const raw=String(d?.rate??"").trim().replace(",",".");
  if(!/^\d+(?:\.\d+)?$/.test(raw))return null;
  const value=Number(raw);
  return Number.isFinite(value)&&value>=0&&value<=200?value:null;
}
function oneDebtSimPayoffDate(d,months,asOf=todayIso()){
  if(months===0)return asOf;
  let month=asOf.slice(0,7),due=oneDebtMonthlyDueIso(d,month);
  if(!due)return "";
  if(due<=asOf){month=oneDebtShiftMonth(month,1);due=oneDebtMonthlyDueIso(d,month)}
  return oneDebtMonthlyDueIso(d,oneDebtShiftMonth(month,months-1));
}
function oneDebtSimulate(d,options={},asOf=todayIso()){
  const warnings=[],rate=oneDebtSimReadRate(d);
  if(!d||debtStatus(d)!=="active")return {valid:false,warnings:["Elegí una deuda activa para simular."]};
  const balance=debtOutstanding(d),minimum=debtMinimumCRC(d);
  if(balance<=.005)return {valid:false,warnings:["Esta deuda no tiene saldo estimado pendiente."]};
  if(num(d.usd)>.005&&num(d.crc)>.005)
    return {valid:false,warnings:["La deuda combina saldos en CRC y USD con una sola tasa. Separá las condiciones por moneda para una simulación confiable."]};
  if(rate===null)return {valid:false,warnings:["Falta una tasa anual válida (0 a 200%). Completala en Editar deuda antes de estimar intereses o ahorros."]};
  if(!(minimum>.005))return {valid:false,warnings:["Falta la cuota o pago mínimo mensual. Configuralo en Editar deuda."]};
  const once=Number(options.onceCRC??0),monthly=Number(options.monthlyCRC??0);
  if(!Number.isFinite(once)||!Number.isFinite(monthly)||once<0||monthly<0||once>ONE_DEBT_SIM_MAX_EXTRA||monthly>ONE_DEBT_SIM_MAX_EXTRA)
    return {valid:false,warnings:["Revisá los pagos extra: deben ser montos válidos, no negativos y dentro del límite permitido."]};
  const projection=oneDebtAmortize({balance,minimum,annualRate:rate,once,monthlyExtra:monthly});
  const kind=oneDebtTypeForDebt(d)?.shape||"other";
  warnings.push("Supuesto: tasa anual nominal fija de "+rate+"%, capitalización mensual y cuota constante de "+money(minimum)+". No incluye seguros, comisiones ni cargos adicionales.");
  if(!debtPayDayNumber(d))warnings.push("Sin día de pago: se estiman meses, pero no una fecha de cancelación.");
  if(kind==="card")warnings.push("En tarjetas el mínimo y los intereses pueden variar. Se supone que no realizás nuevas compras y mantenés fija la cuota registrada.");
  if(kind==="loan"||kind==="installments")warnings.push("El acreedor podría reducir la cuota en vez del plazo, aplicar comisiones o restringir abonos extraordinarios.");
  if(num(d.usd)>.005)warnings.push("Deuda en USD convertida a CRC con el tipo de cambio de venta actual para comparar. No se predice el tipo de cambio futuro.");
  if(!debtLatestAdjustment(d))warnings.push("El saldo parte de la base menos los pagos vinculados; puede no incluir intereses devengados. Verificá el estado de cuenta.");
  if(projection.baseline.status==="insufficient")warnings.push("La cuota base no cubre los intereses del primer mes: no se puede calcular una fecha base de cancelación ni un ahorro total.");
  else if(projection.baseline.status==="horizon")warnings.push("La cuota base no cancela la deuda dentro del máximo de 600 meses. No se calcula ahorro comparativo.");
  if(projection.accelerated.status==="insufficient")warnings.push("Con los extras ingresados, el pago mensual aún no cubre intereses: aumentá la cuota o verificá los datos.");
  else if(projection.accelerated.status==="horizon")warnings.push("El escenario no cancela la deuda dentro de 600 meses.");
  return {valid:true,debt:d,rate,minimum,balance,projection,warnings,asOf,
    baselineDate:projection.baseline.status==="paid"?oneDebtSimPayoffDate(d,projection.baseline.months,asOf):"",
    acceleratedDate:projection.accelerated.status==="paid"?oneDebtSimPayoffDate(d,projection.accelerated.months,asOf):""};
}
function oneDebtSimFormat(crc,currency){
  const rate=currentRates().sell;
  const converted=currency==="USD"?(rate>0?crc/rate:0):crc;
  return String(Number(converted.toFixed(currency==="USD"?2:0)));
}
function oneDebtSimRender(syncInputs=false){
  const q=id=>document.getElementById(id),select=q("oneDebtSimDebt");
  if(!select)return;
  const rows=activeDebts();
  if(!rows.some(d=>d.id===oneDebtSimState.debtId))oneDebtSimState.debtId=rows[0]?.id||"";
  select.innerHTML=rows.length?rows.map(d=>'<option value="'+safe(d.id)+'">'+safe(d.name)+'</option>').join(""):'<option value="">Sin deudas activas</option>';
  select.value=oneDebtSimState.debtId;
  q("oneDebtSimCurrency").value=oneDebtSimState.currency;
  if(syncInputs){
    q("oneDebtSimOnce").value=oneDebtSimFormat(oneDebtSimState.onceCRC,oneDebtSimState.currency);
    q("oneDebtSimMonthly").value=oneDebtSimFormat(oneDebtSimState.monthlyCRC,oneDebtSimState.currency);
  }
  q("oneDebtSimReset").disabled=!(oneDebtSimState.onceCRC||oneDebtSimState.monthlyCRC);
  q("oneDebtSimEdit").disabled=!oneDebtSimState.debtId;
  const d=rows.find(row=>row.id===oneDebtSimState.debtId),result=oneDebtSimulate(d,oneDebtSimState);
  q("oneDebtSimSettings").textContent=d?
    "Saldo aproximado: "+money(debtOutstanding(d))+" · cuota: "+money(debtMinimumCRC(d))+
    " · tasa anual: "+(oneDebtSimReadRate(d)===null?"sin configurar":oneDebtSimReadRate(d)+"%"):
    "Agregá una deuda desde Deudas para comparar escenarios.";
  const warnings=q("oneDebtSimWarnings");warnings.replaceChildren();
  result.warnings.forEach(message=>{const li=document.createElement("li");li.textContent=message;warnings.appendChild(li)});
  if(!result.valid){
    q("oneDebtSimSummary").innerHTML='<p class="muted">Faltan datos para realizar una estimación responsable.</p>';
    q("oneDebtSimCompare").innerHTML="";
    q("oneDebtSimSchedule").innerHTML="";
    return;
  }
  const p=result.projection,fmt=run=>run.status==="paid"?run.months+" mes(es)":"No calculable",
    base=p.baseline,extra=p.accelerated;
  q("oneDebtSimSummary").innerHTML=[
    ["Sin abonos extra",fmt(base)],["Con abonos extra",fmt(extra)],
    ["Intereses base",base.status==="paid"?money(base.interest):"No calculable"],
    ["Ahorro posible de intereses",p.comparable?money(p.interestSaved):"No calculable"]
  ].map(([label,value])=>'<div class="one-future-stat"><span>'+safe(label)+'</span><strong>'+safe(value)+'</strong></div>').join("");
  const maxMonths=Math.max(1,base.months,extra.months),bar=(title,run,when)=>
    '<div class="one-debt-sim-row"><div><strong>'+title+'</strong><small>'+
    (run.status==="paid"?(when?dateLabel(when):"Fecha no disponible"):"Plazo sin calcular")+'</small></div>'+
    '<div class="one-debt-sim-track"><span style="width:'+
    Math.min(100,100*run.months/maxMonths).toFixed(2)+'%"></span></div>'+
    '<strong>'+(run.status==="paid"?run.months+" m":"—")+'</strong></div>';
  q("oneDebtSimCompare").innerHTML=bar("Cuota actual",base,result.baselineDate)+
    bar("Con extras",extra,result.acceleratedDate)+
    '<p class="muted">'+(p.comparable?
      "Reducirías aproximadamente "+p.monthsSaved+" mes(es) y "+money(p.interestSaved)+" en intereses. El abono único se aplicaría hoy.":"La comparación de ahorro y plazo no está disponible con los datos actuales.")+'</p>';
  const view=extra.rows.slice(0,12);
  q("oneDebtSimSchedule").innerHTML=view.length?
    '<div class="one-debt-sim-table-wrap"><table class="one-debt-sim-table"><thead><tr><th>Mes</th><th>Interés</th><th>Pago</th><th>Saldo</th></tr></thead><tbody>'+
    view.map(x=>'<tr><td>'+x.month+'</td><td>'+safe(money(x.interest))+'</td><td>'+
      safe(money(x.payment))+'</td><td>'+safe(money(x.balance))+'</td></tr>').join("")+
    '</tbody></table></div><p class="muted">Primeros '+view.length+' meses del escenario con extras. Todos los montos son aproximados.</p>':
    '<p class="muted">El abono único cubriría el saldo registrado hoy.</p>';
}
function oneDebtSimOpen(debtId){
  if(!activeDebts().some(d=>d.id===debtId))return;
  oneDebtSimState.debtId=debtId;
  oneDebtSimState.onceCRC=0;oneDebtSimState.monthlyCRC=0;
  if(!oneModuleEnabled("future"))oneSetModuleEnabled("future",true);
  navigate("future");
  const panel=document.getElementById("oneDebtSimulatorPanel");
  if(panel)panel.open=true;
  oneDebtSimRender(true);
}
function oneDebtSimInit(){
  const q=id=>document.getElementById(id);
  if(!q("oneDebtSimulatorPanel"))return;
  oneDebtSimState.currency=displayCurrency();
  q("oneDebtSimDebt").addEventListener("change",()=>{
    oneDebtSimState.debtId=q("oneDebtSimDebt").value;
    oneDebtSimState.onceCRC=0;oneDebtSimState.monthlyCRC=0;oneDebtSimRender(true);
  });
  q("oneDebtSimCurrency").addEventListener("change",()=>{
    oneDebtSimState.currency=normalizeCurrency(q("oneDebtSimCurrency").value);oneDebtSimRender(true);
  });
  const update=(field,key)=>{
    q(field).addEventListener("input",()=>{
      const raw=Number(q(field).value),amount=Number.isFinite(raw)?Math.max(0,raw):0;
      oneDebtSimState[key]=Math.min(ONE_DEBT_SIM_MAX_EXTRA,toCRC(amount,oneDebtSimState.currency,"pay"));
      oneDebtSimRender();
    });
  };
  update("oneDebtSimOnce","onceCRC");
  update("oneDebtSimMonthly","monthlyCRC");
  q("oneDebtSimReset").addEventListener("click",()=>{
    oneDebtSimState.onceCRC=0;oneDebtSimState.monthlyCRC=0;oneDebtSimRender(true);
  });
  q("oneDebtSimEdit").addEventListener("click",()=>{
    const d=activeDebts().find(x=>x.id===oneDebtSimState.debtId);
    if(d){navigate("debts");openDebt(d)}
  });
  document.addEventListener("click",e=>{
    const button=e.target.closest("[data-simulate-debt]");
    if(button)oneDebtSimOpen(button.dataset.simulateDebt);
  });
  oneDebtSimRender(true);
}
