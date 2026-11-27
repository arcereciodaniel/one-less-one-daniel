// Reuse the original V16 header and home DOM, CSS, canvas renderers and native handlers.
// Financial selection and allocations are still owned by the V17 model.
const nativeHost=document.getElementById("v17NativeHost"),nativeHeader=nativeHost.querySelector("header"),nativeHome=document.getElementById("view-dashboard"),experimentalHeader=document.querySelector(".demo-header");
if(!nativeHeader||!nativeHome||!experimentalHeader)throw Error("Interfaz original no disponible");
nativeHeader.classList.add("olo-original-header");experimentalHeader.before(nativeHeader);experimentalHeader.hidden=true;
nativeHeader.querySelector(".brand-version").textContent="v17.0.0";
el("content").after(nativeHome);nativeHome.classList.add("olo-original-home");
const nativeFilters=nativeHome.querySelector(".rastro-category-spotlight-filters");if(nativeFilters)nativeFilters.hidden=true;
const nativeHeaderMap={dashboard:"home",plan:"budget",movements:"moves",debts:"debts",shared:"collections",capital:"goals",projects:"projects",future:"future"};
const reverseHeaderMap=Object.fromEntries(Object.entries(nativeHeaderMap).map(([k,v])=>[v,k]));
// Use the existing V17 visual preference; switching display never rewrites the ledger.
displayCurrency=function(){return display};
const originalRender=render,originalDashboard=renderDashboard;
function showModule(id){if(id==="home"||id==="budget"||id==="moves"||enabledModules.has(id)){moduleName=id;render()}}
nativeHeader.addEventListener("click",e=>{
 const b=e.target.closest("button");if(!b)return;
 const view=nativeHeaderMap[b.dataset.view],themeChoice=b.dataset.themeChoice,currencyChoice=b.dataset.displayCurrency;
 if(!view&&!themeChoice&&!currencyChoice&&b.id!=="manageModulesBtn"&&b.id!=="oneSettingsBtn")return;
 e.preventDefault();e.stopImmediatePropagation();
 if(view)showModule(view);
 else if(themeChoice){theme(themeChoice);render()}
 else if(currencyChoice){display=currencyChoice==="USD"?"USD":"CRC";saveVisual({currency:display});el("displayCurrency").value=display;render()}
 else if(b.id==="manageModulesBtn"){moduleChoices();el("modulesDialog").showModal()}
 else el("integrity").click();
},true);
nativeHome.addEventListener("click",e=>{
 if(e.target.closest("#openCollectionsFromHome")){e.preventDefault();e.stopImmediatePropagation();showModule("collections")}
},true);
function nativeHeaderSync(){
 for(const b of nativeHeader.querySelectorAll("[data-view]")){
  const id=nativeHeaderMap[b.dataset.view];b.hidden=optionalModules.some(([key])=>key===id)&&!enabledModules.has(id);
  b.classList.toggle("active",id===moduleName);b.setAttribute("aria-current",id===moduleName?"page":"false");
 }
 for(const b of nativeHeader.querySelectorAll("[data-theme-choice]"))b.classList.toggle("active",b.dataset.themeChoice===document.documentElement.dataset.theme);
 for(const b of nativeHeader.querySelectorAll("[data-display-currency]"))b.classList.toggle("active",b.dataset.displayCurrency===display);
}
function designHome(){
 const rs=T.select(state),range=agg(rs),p=query(range);
 // Keep the V16 visual components, with V17's exact operating and available calculations.
 const rates=currentRates(),operating=model.operating.minor;
 const fmtCRC=n=>n===null?"—":f(Math.round(n/(display==="USD"?rates.ref:1)),display);
 document.getElementById("dashboardHeroValue").textContent=fmtCRC(operating);
 let info;
 try{info=V.calculate(model,TODAY,oneEstimatedAvailable(TODAY),Object.fromEntries((data.periods||[]).map(p=>[periodKey(p),oneV15PeriodBudgetRows(p,TODAY)])),rates)}
 catch{info={ready:false,reason:"Datos pendientes de revisión"}}
 document.getElementById("dashboardHeroNote").innerHTML='<div class="one-available-kicker">Disponible estimado</div><strong data-v17-native-available class="one-available-value '+(info.ready&&info.availableMinor<0?"negative":"")+'">'+fmtCRC(info.ready?info.availableMinor:null)+'</strong><span class="one-available-caption">'+(info.ready?(info.rangePendingMinor?"Después de reservar presupuestos vigentes.":"Después de cubrir los egresos previstos hasta "+esc(short(info.horizon))+"."):esc(info.reason))+'</span>'+(info.ready?'<details class="one-available-details"><summary>Ver cálculo</summary><div class="one-available-math"><div><span>Saldo operativo hoy</span><strong>'+fmtCRC(operating)+'</strong></div><div><span>Egresos aún presupuestados</span><strong>− '+fmtCRC(info.pendingMinor)+'</strong></div><p>No incluye ingresos futuros ni obligaciones sin presupuesto.</p>'+(info.rangePendingMinor?'<div><span>Incluye reserva de intervalos</span><strong>'+fmtCRC(info.rangePendingMinor)+'</strong></div>'+(info.rangeConservative?'<p>Reserva prudente: incluye el monto pendiente de intervalos que se cruzan con otros períodos.</p>':""):"")+'</div></details>':"");
 // Use the new calendar query for the original chart and category table. Undated
 // blocks remain pending, never allocated artificially to a week.
 const totals=B.totals(p,rates,"CRC");
 const amount=(items,kind,planned)=>B.value(items.filter(a=>cat(a.categoryId)?.type===kind),rates,"CRC",planned,id=>cat(id)?.type);
 const grid=document.getElementById("kpiGrid");grid.innerHTML=[
  v7Kpi("↑","green","Ingresos reales",fmtCRC(amount(p.actuals,"Ingreso",false)),"Plan conocido: "+fmtCRC(amount(p.planned,"Ingreso",true)),"good"),
  v7Kpi("↓","red","Gastos reales",fmtCRC(amount(p.actuals,"Gasto",false)),"Plan conocido: "+fmtCRC(amount(p.planned,"Gasto",true))),
  oneMonthlyCloseCard(TODAY)
 ].join("");
 const chart=rs.map(r=>({range:r,p:query(r)})).map(({range,p})=>({label:label(range),...B.totals(p,rates,"CRC")}));
 const budgetCard=document.getElementById("oneBudgetChartTitle").closest(".v7-card");
 budgetCard.querySelector(".v7-card-head p").textContent=(chart.some(x=>x.pending)?"Presupuesto conocido y egresos reales · hay asignaciones pendientes de distribuir.":"Gastos, cuotas y aportes a metas comparados con el presupuesto seleccionado.")+(chart.some(x=>x.missing)?" Hay importes sin tipo de cambio verificado.":"");
 const canvas=document.getElementById("expenseChart");
 if(chart.some(x=>x.missing)){canvas.hidden=true;let msg=document.getElementById("v17ChartMissing");if(!msg){msg=document.createElement("p");msg.id="v17ChartMissing";msg.className="muted";canvas.after(msg)}msg.textContent="No se dibujan totales incompletos por tipo de cambio.";msg.hidden=false}
 else{canvas.hidden=false;const msg=document.getElementById("v17ChartMissing");if(msg)msg.hidden=true;drawBarChart(canvas,chart.map(x=>x.label),chart.map(x=>x.planned/100),chart.map(x=>x.actual/100))}
 const rows=p.rows.filter(r=>r.type!=="Ingreso");
 document.getElementById("dashboardCategories").innerHTML='<table><thead><tr><th>Categoría</th><th>Presupuesto</th><th>Real</th><th>Disponible</th><th>Uso</th></tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr><td>'+esc(r.name)+(r.pendingMinor?'<small class="one-saving-category-label">Pendiente de distribuir</small>':'')+'</td><td class="num">'+(r.pendingMinor&&!r.plannedMinor?"—":f(r.plannedMinor,r.currency))+'</td><td class="num">'+f(r.actualMinor,r.currency)+'</td><td class="num '+(r.remainingMinor===null?"":r.remainingMinor<0?"negative":"positive")+'">'+(r.remainingMinor===null?"—":f(r.remainingMinor,r.currency))+'</td><td>'+(r.plannedMinor?'<div class="progress"><span style="width:'+Math.min(100,r.actualMinor/r.plannedMinor*100)+'%"></span></div><small>'+Math.round(r.actualMinor/r.plannedMinor*100)+'%</small>':'—')+'</td></tr>').join(""):'<tr><td colspan="5" class="empty">Sin registros para este período.</td></tr>')+'</tbody></table>';
 const insight=document.getElementById("dashboardInsight"),signals=B.categoryRows({...p,actuals:p.actuals.filter(a=>a.date<=TODAY)},rates,"CRC").filter(r=>r.type!=="Ingreso"&&!r.pending&&!r.missing&&r.actualMinor>r.plannedMinor);
 insight.innerHTML='<div class="v7-insight-icon">▥</div><h3>'+ (signals.length?"Revisá tu presupuesto":"Dentro del presupuesto conocido")+'</h3><p>'+ (signals.length?signals.length+" categoría(s) por revisar.":p.pending.length?"Hay asignaciones sin fecha exacta; el presupuesto no está completo.":"No se detectan excesos en el período seleccionado.")+'</p>'+(totals.remaining!==null?'<span class="v7-status-pill">Restante: '+fmtCRC(totals.remaining)+'</span>':"");
}
renderDashboard=function(){originalDashboard();if(moduleName==="home"&&!nativeHome.hidden)designHome()};

// Reattach the real original module DOM and its original event handlers.
// V17 date selection is the sole temporal control; V17 links remain contextual.
const nativeSections={},nativeRenderers={moves:renderMovements,debts:renderDebts,collections:renderSharedCharges,goals:renderCapital,projects:renderProjects};
for(const id of Object.keys(nativeRenderers)){
 const section=document.getElementById("view-"+reverseHeaderMap[id]);
 if(!section)throw Error("Vista original no disponible: "+id);
 nativeHome.after(section);section.classList.add("olo-original-module");section.hidden=true;section.classList.remove("active");
 nativeSections[id]=section;
 const heading=section.querySelector(".v7-page-head");if(heading){const title=heading.firstElementChild;if(title)title.hidden=true;}
}
for(const id of ["movementAccountsDialog","assignSharedGroupDialog"]){const d=nativeDialog(id);d.addEventListener("close",refreshNative)}
const moveFilters=nativeSections.moves.querySelector(".one-move-period-control");if(moveFilters)moveFilters.hidden=true;
const sharedNav=nativeSections.collections.querySelector(".month-navigator");if(sharedNav)sharedNav.hidden=true;
for(const id of ["sharedCurrentMonth","sharedPrevMonth","sharedNextMonth"]){const b=document.getElementById(id);if(b)b.hidden=true}
const originalFiltered=m2FilteredMovementRows;
m2FilteredMovementRows=function(){
 if(moduleName!=="moves")return originalFiltered();
 const originalSelected=selectedMovements;
 try{selectedMovements=()=>O.movements(data,agg(T.select(state)));return originalFiltered()}
 finally{selectedMovements=originalSelected}
};
const nativeExtras=document.createElement("details");nativeExtras.id="v17-contextual-actions";nativeExtras.className="v7-details";nativeExtras.hidden=true;
nativeExtras.innerHTML='<summary>Vínculos y planificación del período</summary><div class="v7-details-body"></div>';el("content").before(nativeExtras);
const futureChart=document.createElement("section");futureChart.className="v7-card one-future-panel";futureChart.hidden=true;el("content").before(futureChart);
function renderNativeExtras(id,range){
 const slot=nativeExtras.querySelector(".v7-details-body");slot.replaceChildren();
 const append=(labelText,button)=>{const line=document.createElement("div");line.className="one-future-breakdown-row";const name=document.createElement("span");name.textContent=labelText;line.append(name,button);slot.append(line)};
 function button(action,text,id){const b=document.createElement("button");b.className="btn secondary small";b.type="button";b.textContent=text;b.onclick=()=>{try{openNative(action,id)}catch(e){alert(e.message)}};return b}
 if(id==="debts")for(const x of nativeOccurrences().filter(x=>x.date>=range.start&&x.date<=range.end))append(x.name+" · "+short(x.date),button("link-debt","Vincular cuota",x.id));
 if(id==="projects")for(const p of model.modules.projects||[]){for(const x of (model.modules.projectPlans||[]).filter(x=>x.ownerId===p.id))append(p.name+" · "+x.name,button("link-project","Vincular presupuesto",x.id))}
 if(id==="collections"){
  for(const c of model.modules.collections||[])append(c.name,button("classify-collection","Clasificar",c.id));
  if((data.receivableRecurring||[]).length)append("Cobros recurrentes · "+state.month,button("recurring-collections","Preparar recurrentes",""));
 }
 nativeExtras.hidden=!slot.children.length;
}
function renderOriginalFuture(range){
 const rates=currentRates(),forecast=C.reconcile(rawNow(),model,L.reconcile(rawNow(),model,Q.forecast(model,TODAY,range.end,confirmedFlows(),oneFutureForecast(TODAY,90).items,rates,F),TODAY,rates),nativeOccurrences(),TODAY,rates);
 const points=forecast.points||[],fmt=n=>n===null||n===undefined?"—":money(n/100);
 futureChart.innerHTML='<div class="v7-card-head"><div><h2>Evolución de tu saldo operativo</h2><p>Escenario parcial · hasta '+esc(short(forecast.end))+' · sin distribuir importes pendientes de fecha.</p></div></div><div class="one-future-stats">'+[["Saldo operativo hoy",model.operating.minor],["Saldo estimado",forecast.balance],["Mínimo del escenario",forecast.lowest]].map(([n,v])=>'<div class="one-future-stat"><span>'+n+'</span><strong>'+fmt(v)+'</strong></div>').join("")+'</div><div class="one-future-chart-wrap">'+(points.length?oneFutureChart(points.map(p=>({date:p.date,balance:p.balance/100}))):'<p class="muted">No hay una proyección verificable para este intervalo.</p>')+'</div>';
}
function styleBudget(){
 const content=el("content");
 content.querySelectorAll(".demo-cards").forEach(n=>n.classList.add("r8-fortnight-grid"));
 content.querySelectorAll("article.demo-card").forEach(n=>n.classList.add("r8-fortnight-card"));
 content.querySelectorAll(".demo-card-head").forEach(n=>n.classList.add("r8-fortnight-heading"));
 content.querySelectorAll(".demo-row").forEach(n=>n.classList.add("r8-budget-row"));
 content.querySelectorAll(".demo-section").forEach(n=>n.classList.add("r8-section"));
 content.querySelectorAll(".demo-add").forEach(n=>n.classList.add("btn","secondary","small"));
}

render=function(){
 originalRender();
 const home=moduleName==="home"&&!nativeBlocked;
 nativeHome.hidden=!home;nativeHome.classList.toggle("active",home);const native=!nativeBlocked?nativeSections[moduleName]:null;el("content").hidden=home||!!native;
 for(const section of Object.values(nativeSections)){section.hidden=section!==native;section.classList.toggle("active",section===native)}
 nativeExtras.hidden=true;futureChart.hidden=true;nativeHeaderSync();
 if(native){const range=agg(T.select(state));if(moduleName==="collections")document.getElementById("sharedStatementMonth").value=state.month;nativeRenderers[moduleName]();native.after(nativeExtras);renderNativeExtras(moduleName,range)}
 if(moduleName==="budget"&&!nativeBlocked)styleBudget();
 if(moduleName==="future"&&!nativeBlocked){futureChart.hidden=false;renderOriginalFuture(agg(T.select(state)))}
 // Native chart layout needs the real visible canvas, not its former hidden container.
 if(home)renderDashboard();
};
navigate=function(view){showModule(nativeHeaderMap[view]||"home")};
// Persist only if the already-activated V17 ledger and original source still match.
const nativePersist=oneStoragePersist;
oneStoragePersist=function(serialized){if(M.isPrivate(JSON.parse(oneStorageSnapshot||"null")))handoffGuard();return nativePersist(serialized)};
