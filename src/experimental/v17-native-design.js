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
 document.getElementById("dashboardHeroNote").innerHTML='<div class="one-available-kicker">Disponible estimado</div><strong data-v17-native-available class="one-available-value '+(info.ready&&info.availableMinor<0?"negative":"")+'">'+fmtCRC(info.ready?info.availableMinor:null)+'</strong><span class="one-available-caption">'+(info.ready?"Después de cubrir los egresos previstos hasta "+esc(short(info.horizon))+".":esc(info.reason))+'</span>'+(info.ready?'<details class="one-available-details"><summary>Ver cálculo</summary><div class="one-available-math"><div><span>Saldo operativo hoy</span><strong>'+fmtCRC(operating)+'</strong></div><div><span>Egresos aún presupuestados</span><strong>− '+fmtCRC(info.pendingMinor)+'</strong></div><p>No incluye ingresos futuros ni obligaciones sin presupuesto.</p></div></details>':"");
 // Use the new calendar query for the original chart and category table. Undated
 // blocks remain pending, never allocated artificially to a week.
 const totals=B.totals(p,rates,"CRC");
 const amount=(items,kind,planned)=>{let n=0;for(const a of items){const type=planned?cat(a.categoryId)?.type:a.type;if(type!==kind)continue;const fx=a.currency==="CRC"?1:planned?(type==="Ingreso"?rates.buy:rates.sell):(type==="Ingreso"?a.fxBuy:a.fxSell);if(!Number.isFinite(fx)||fx<=0)return null;n+=a.minor*fx}return Math.round(n)};
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
 const insight=document.getElementById("dashboardInsight"),analysis=I.analyze(model,range,TODAY,F),signals=analysis.rows.filter(r=>["unplanned","over","ahead"].includes(r.signal));
 insight.innerHTML='<div class="v7-insight-icon">▥</div><h3>'+ (signals.length?"Revisá tu presupuesto":"Dentro del presupuesto conocido")+'</h3><p>'+ (signals.length?signals.length+" categoría(s) por revisar.":p.pending.length?"Hay asignaciones sin fecha exacta; el presupuesto no está completo.":"No se detectan excesos en el período seleccionado.")+'</p>'+(totals.remaining!==null?'<span class="v7-status-pill">Restante: '+fmtCRC(totals.remaining)+'</span>':"");
}
renderDashboard=function(){originalDashboard();if(moduleName==="home"&&!nativeHome.hidden)designHome()};
render=function(){
 originalRender();
 const home=moduleName==="home"&&!nativeBlocked;
 nativeHome.hidden=!home;nativeHome.classList.toggle("active",home);el("content").hidden=home;
 nativeHeaderSync();
 // Native chart layout needs the real visible canvas, not its former hidden container.
 if(home)renderDashboard();
};
navigate=function(view){showModule(nativeHeaderMap[view]||"home")};
// Persist only if the already-activated V17 ledger and original source still match.
const nativePersist=oneStoragePersist;
oneStoragePersist=function(serialized){if(M.isPrivate(JSON.parse(oneStorageSnapshot||"null")))handoffGuard();return nativePersist(serialized)};
