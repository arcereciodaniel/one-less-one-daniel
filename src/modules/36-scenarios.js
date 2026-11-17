/* V11.5 · Escenarios Beta 1.0.
   Simulador sin escrituras: no modifica data, localStorage, Presupuesto,
   movimientos, cobros, metas, deuda ni importes originalmente registrados. */
const ONE_SCENARIO_MAX_MONTHLY_CRC=100000000;
let oneScenarioState={cutPercent:0,monthlySavingsCRC:0,monthlyDebtCRC:0,currency:"CRC"};
let oneScenarioLastForecast=null;
function oneScenarioNonNegative(value,max=ONE_SCENARIO_MAX_MONTHLY_CRC){
 const n=Number(value);
 return Number.isFinite(n)?Math.min(max,Math.max(0,n)):0;
}
function oneScenarioNormalize(raw={}){
 return {
  cutPercent:Math.round(oneScenarioNonNegative(raw.cutPercent,50)),
  monthlySavingsCRC:oneScenarioNonNegative(raw.monthlySavingsCRC),
  monthlyDebtCRC:oneScenarioNonNegative(raw.monthlyDebtCRC)
 };
}
function oneScenarioDates(forecast){
 const dates=[],day=onePayDays(data.settings).second;
 for(let month=forecast.asOf.slice(0,7);month<=forecast.until.slice(0,7);month=oneMonthShift(month,1)){
  const date=oneDateMonthDay(month,day);
  if(date>forecast.asOf&&date<=forecast.until)dates.push(date);
 }
 return dates;
}
function oneScenarioEvaluate(forecast,options={}){
 if(!forecast||!ONE_FUTURE_WINDOWS.includes(forecast.days))throw Error("Proyección de Futuro inválida.");
 const config=oneScenarioNormalize(options);
 const daily=new Map(forecast.points.slice(1).map(p=>[p.date,0]));
 const scheduled=[],warnings=[];
 let avoided=0,extraSavings=0,extraDebt=0,simulatedDebtBalance=Math.max(0,activeDebtTotal());
 // Solo gastos ordinarios AÚN NO registrados. No toca ahorro ya presupuestado,
 // cuotas mínimas, movimientos futuros confirmados ni transferencias reales.
 for(const item of forecast.items){
  if(item.kind!=="budget"||item.amount>=0)continue;
  const adjustment=(-item.amount)*config.cutPercent/100;
  if(adjustment>.00001&&daily.has(item.date)){
   daily.set(item.date,daily.get(item.date)+adjustment);
   avoided+=adjustment;
  }
 }
 for(const date of oneScenarioDates(forecast)){
  if(config.monthlySavingsCRC>.005){
   const amount=config.monthlySavingsCRC;
   daily.set(date,daily.get(date)-amount);
   extraSavings+=amount;
   scheduled.push({date,type:"goal",amount});
  }
  if(config.monthlyDebtCRC>.005){
   // Se descuentan las cuotas base fechadas hasta este día del saldo restante
   // estimado antes de calcular pagos adicionales. No se promete ahorro de
   // intereses ni se suprimen cuotas futuras de la proyección base.
   const baseDue=forecast.items.filter(x=>x.kind==="debt"&&x.date<=date)
    .reduce((sum,x)=>sum+Math.max(0,-x.amount),0);
   const debtCapacity=Math.max(0,simulatedDebtBalance-baseDue);
   const amount=Math.min(config.monthlyDebtCRC,debtCapacity);
   if(amount>.005){
    daily.set(date,daily.get(date)-amount);
    extraDebt+=amount;
    simulatedDebtBalance-=amount;
    scheduled.push({date,type:"debt",amount});
   }
  }
 }
 if(config.cutPercent>0&&avoided<=.005)
  warnings.push("No hay gastos ordinarios pendientes para aplicar este recorte. No se reducen aportes a metas ni cuotas de deuda.");
 if(config.monthlyDebtCRC>.005&&activeDebtTotal()<=.005)
  warnings.push("No hay saldo de deuda activo para simular abonos adicionales.");
 if(config.monthlyDebtCRC>.005&&extraDebt+.005<config.monthlyDebtCRC*oneScenarioDates(forecast).length)
  warnings.push("Los abonos extra se limitaron al saldo estimado de deuda; las cuotas futuras no se recalculan.");
 if(config.monthlyDebtCRC>.005)
  warnings.push("No se simulan intereses, penalizaciones, liquidaciones anticipadas ni cambios de cuota. Los pagos extra son hipotéticos y se mantienen las cuotas base.");
 if(extraSavings>.005)
  warnings.push("El aporte adicional se aparta hipotéticamente de la liquidez. No se suma a ninguna Meta hasta registrarlo realmente.");
 if(forecast.warnings.length)
  warnings.push("La comparación hereda las advertencias y períodos sin datos de Futuro.");
 const points=[];
 let difference=0,lowest=forecast.base,lowestDate=forecast.asOf;
 for(const p of forecast.points){
  if(p.date!==forecast.asOf)difference+=(daily.get(p.date)||0);
  const balance=p.balance+difference;
  points.push({date:p.date,balance,baseline:p.balance,change:difference});
  if(balance<lowest){lowest=balance;lowestDate=p.date}
 }
 return {
  ...config,baseline:forecast,balance:points.at(-1).balance,
  difference:points.at(-1).balance-forecast.balance,
  lowest,lowestDate,points,
  avoided,extraSavings,extraDebt,scheduled,warnings
 };
}
function oneScenarioChart(scenario){
 const width=760,height=245,pad={left:110,right:18,top:20,bottom:40};
 const rows=scenario.points,all=rows.flatMap(p=>[p.balance,p.baseline,0]);
 const min=Math.min(...all),max=Math.max(...all),gap=max-min||1,lo=min-gap*.12,hi=max+gap*.12;
 const x=i=>pad.left+i*(width-pad.left-pad.right)/Math.max(1,rows.length-1);
 const y=v=>pad.top+(hi-v)/(hi-lo)*(height-pad.top-pad.bottom);
 const line=field=>rows.map((p,i)=>x(i).toFixed(2)+","+y(p[field]).toFixed(2)).join(" ");
 const ticks=[min,(min+max)/2,max].map(value=>
  '<line class="one-future-gridline" x1="'+pad.left+'" x2="'+(width-pad.right)+
  '" y1="'+y(value).toFixed(2)+'" y2="'+y(value).toFixed(2)+'"/>'+
  '<text class="one-future-tick" x="'+(pad.left-9)+'" y="'+(y(value)+4).toFixed(2)+
  '" text-anchor="end">'+safe(money(value))+'</text>').join("");
 const last=rows.length-1,indices=[0,Math.round(last/2),last];
 const dates=indices.map(i=>'<text class="one-future-tick" x="'+x(i).toFixed(2)+
  '" y="'+(height-13)+'" text-anchor="middle">'+safe(i?" "+dateLabel(rows[i].date):"Hoy")+'</text>').join("");
 return '<svg class="one-future-chart" viewBox="0 0 760 245" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Comparación del saldo operativo base y el saldo simulado a lo largo del tiempo">'+
 ticks+'<line class="one-future-zero" x1="'+pad.left+'" x2="'+(width-pad.right)+
 '" y1="'+y(0).toFixed(2)+'" y2="'+y(0).toFixed(2)+'"/>'+
 '<polyline class="one-scenario-base-line" points="'+line("baseline")+'"/>'+
 '<polyline class="one-scenario-change-line" points="'+line("balance")+'"/>'+
 dates+'</svg>';
}
function oneScenarioFormatInput(crc,currency){
 const rates=currentRates(),n=currency==="USD"?(rates.sell>0?crc/rates.sell:0):crc;
 return String(Number(n.toFixed(currency==="USD"?2:0)));
}
function oneScenarioSyncControls(){
 const q=id=>document.getElementById(id),currency=oneScenarioState.currency;
 q("oneScenarioCurrency").value=currency;
 q("oneScenarioCut").value=oneScenarioState.cutPercent;
 q("oneScenarioSave").value=oneScenarioFormatInput(oneScenarioState.monthlySavingsCRC,currency);
 q("oneScenarioDebt").value=oneScenarioFormatInput(oneScenarioState.monthlyDebtCRC,currency);
 q("oneScenarioCutValue").textContent=oneScenarioState.cutPercent+"%";
 q("oneScenarioMoneyUnit").textContent=currency==="USD"?"dólares (USD)":"colones (CRC)";
}
function oneScenarioRender(forecast=null){
 const slot=document.getElementById("oneScenarioResults");if(!slot)return;
 oneScenarioLastForecast=forecast||oneScenarioLastForecast||oneFutureForecast(todayIso(),oneFutureWindow);
 const result=oneScenarioEvaluate(oneScenarioLastForecast,oneScenarioState);
 const q=id=>document.getElementById(id);
 const changed=result.cutPercent>0||result.monthlySavingsCRC>0||result.monthlyDebtCRC>0;
 q("oneScenarioChart").innerHTML=oneScenarioChart(result);
 q("oneScenarioSummary").innerHTML=[
  ["Saldo base",result.baseline.balance],
  ["Saldo simulado",result.balance],
  ["Diferencia",result.difference],
  ["Mínimo simulado",result.lowest]
 ].map(([name,value])=>'<div class="one-future-stat"><span>'+safe(name)+'</span><strong>'+
  safe(money(value))+'</strong></div>').join("");
 q("oneScenarioBreakdown").innerHTML=[
  ["Gasto ordinario que evitarías",result.avoided],
  ["Aporte adicional hipotético",-result.extraSavings],
  ["Pago anticipado hipotético",-result.extraDebt]
 ].map(([label,value])=>'<div class="one-future-breakdown-row"><span>'+safe(label)+'</span><strong>'+
  safe((value>0?"+":"")+money(value))+'</strong></div>').join("");
 q("oneScenarioSummaryText").textContent=changed?
  "Escenario hipotético · "+oneScenarioState.cutPercent+"% menos gastos ordinarios; "+
  money(result.extraSavings)+" en ahorro extra y "+money(result.extraDebt)+
  " en abonos adicionales durante "+result.baseline.days+" días.":
  "Mové un control para comparar con el plan actual. Sin cambios, las dos líneas coinciden.";
 q("oneScenarioBalanceNote").textContent="El saldo mínimo simulado sería "+money(result.lowest)+
  " el "+dateLabel(result.lowestDate)+
  (result.lowest<0?" y podría quedar negativo.":".");
 const warnings=q("oneScenarioWarnings");warnings.replaceChildren();
 for(const message of result.warnings){
  const item=document.createElement("li");item.textContent=message;warnings.appendChild(item);
 }
 q("oneScenarioReset").disabled=!changed;
}
function oneScenarioInit(){
 const q=id=>document.getElementById(id);
 oneScenarioState.currency=displayCurrency();
 oneScenarioSyncControls();
 const update=()=>{
  oneScenarioState.cutPercent=oneScenarioNonNegative(q("oneScenarioCut").value,50);
  oneScenarioState.monthlySavingsCRC=oneScenarioNonNegative(toCRC(q("oneScenarioSave").value,oneScenarioState.currency,"pay"));
  oneScenarioState.monthlyDebtCRC=oneScenarioNonNegative(toCRC(q("oneScenarioDebt").value,oneScenarioState.currency,"pay"));
  q("oneScenarioCutValue").textContent=oneScenarioState.cutPercent+"%";
  oneScenarioRender();
 };
 for(const name of ["oneScenarioCut","oneScenarioSave","oneScenarioDebt"])
  q(name).addEventListener("input",update);
 q("oneScenarioCurrency").addEventListener("change",()=>{
  oneScenarioState.currency=normalizeCurrency(q("oneScenarioCurrency").value);
  oneScenarioSyncControls();
  oneScenarioRender();
 });
 q("oneScenarioReset").addEventListener("click",()=>{
  oneScenarioState={cutPercent:0,monthlySavingsCRC:0,monthlyDebtCRC:0,currency:oneScenarioState.currency};
  oneScenarioSyncControls();oneScenarioRender();
 });
 q("oneScenarioPanel").addEventListener("toggle",()=>{
  if(q("oneScenarioPanel").open)oneScenarioRender();
 });
}
