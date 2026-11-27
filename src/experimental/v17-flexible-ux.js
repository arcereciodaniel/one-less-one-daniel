
// V17.1: compact native-style views backed by the same V17 financial projection.
const names={week:"Semana",fortnight:"Quincena",month:"Mes",quarter:"Trimestre",half:"Semestre",year:"Año"};
const uxq=id=>document.getElementById("olo-"+id);
const longMonth=m=>new Intl.DateTimeFormat("es-CR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(m+"-01T12:00:00Z")).replace(/^./,x=>x.toUpperCase());
const datesText=r=>r.start.slice(0,7)===r.end.slice(0,7)?Number(r.start.slice(8))+" – "+short(r.end):short(r.start)+" – "+short(r.end);
function naturalPeriod(s){
 const r=agg(T.select(s)),m=longMonth(s.month);
 if(s.level==="month")return m;
 if(s.level==="year")return r.start.slice(0,4);
 if(s.level==="fortnight")return (r.start.endsWith("-01")?"1.ª":"2.ª")+" quincena · "+m;
 if(s.level==="week")return datesText(r)+" · "+r.start.slice(0,4);
 if(s.level==="quarter")return Math.ceil(Number(r.start.slice(5,7))/3)+".° trimestre · "+r.start.slice(0,4);
 return (Number(r.start.slice(5,7))===1?"1.er":"2.°")+" semestre · "+r.start.slice(0,4);
}
const filter=document.querySelector(".demo-filter");
for(const n of filter.children)n.classList.add("olo-old-period");
const newFilter=document.createElement("div");newFilter.className="olo-period";
newFilter.innerHTML='<select id="olo-period-level" aria-label="Intervalo financiero">'+Object.entries(names).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join("")+'</select><div class="olo-period-nav"><button type="button" id="olo-prev" aria-label="Período anterior">‹</button><button type="button" id="olo-period-label" aria-label="Elegir período" aria-expanded="false"></button><button type="button" id="olo-next" aria-label="Período siguiente">›</button></div><button type="button" id="olo-today">Hoy</button><div id="olo-period-picker" class="olo-period-picker" hidden><label>Mes<select id="olo-month-choice" aria-label="Mes"></select></label><label id="olo-slot-wrap">Período<select id="olo-slot-choice" aria-label="Semana o quincena"></select></label></div>';
filter.append(newFilter);
state=T.current("month",TODAY);
const dateModules=new Set(["home","budget","moves","future","collections"]);
const toolbarState=()=>moduleName==="collections"?{level:"month",month:state.month,scope:"single",anchor:state.month+"-01"}:state;
function refreshPeriod(){
 filter.hidden=!dateModules.has(moduleName);
 const s=toolbarState(),level=uxq("period-level");
 level.value=s.level;level.hidden=moduleName==="collections";
 uxq("period-label").textContent=naturalPeriod(s);
 const choice=uxq("month-choice"),months=new Set([s.month,TODAY.slice(0,7),...model.periods.map(p=>p.start.slice(0,7)),...model.allocations.flatMap(a=>[a.date||a.start,a.date||a.end].filter(Boolean).map(d=>d.slice(0,7)))]);
 for(let i=-18;i<=18;i++)months.add(T.monthShift(s.month,i));
 choice.replaceChildren(...[...months].sort().map(m=>{const o=document.createElement("option");o.value=m;o.textContent=longMonth(m);return o}));choice.value=s.month;
 const ranges=T.partitions(s.month,s.level),slot=uxq("slot-choice");
 uxq("slot-wrap").hidden=ranges.length===1;
 slot.replaceChildren(...ranges.map((r,i)=>{const o=document.createElement("option");o.value=r.start;o.textContent=s.level==="fortnight"?(i===0?"Primera quincena":"Segunda quincena"):datesText(r);return o}));
 slot.value=(ranges.find(r=>T.contains(r,s.anchor))||ranges[0]).start;
 el("periodCaption").hidden=true;
}
function closePicker(){uxq("period-picker").hidden=true;uxq("period-label").setAttribute("aria-expanded","false")}
function updatePeriod(next){state=next;closePicker();render()}
uxq("period-level").onchange=e=>updatePeriod({...T.changeLevel(state,e.target.value),scope:"single"});
uxq("prev").onclick=()=>updatePeriod(moduleName==="collections"?T.changeMonth(state,T.monthShift(state.month,-1)):T.navigate(state,-1));
uxq("next").onclick=()=>updatePeriod(moduleName==="collections"?T.changeMonth(state,T.monthShift(state.month,1)):T.navigate(state,1));
uxq("today").onclick=()=>updatePeriod(T.current(state.level,TODAY));
uxq("period-label").onclick=()=>{const p=uxq("period-picker");p.hidden=!p.hidden;uxq("period-label").setAttribute("aria-expanded",String(!p.hidden))};
uxq("month-choice").onchange=e=>{state=T.changeMonth(state,e.target.value);render();if(["week","fortnight"].includes(state.level)&&moduleName!=="collections"){uxq("period-picker").hidden=false;uxq("period-label").setAttribute("aria-expanded","true")}};
uxq("slot-choice").onchange=e=>updatePeriod({...state,anchor:e.target.value,scope:"single"});
document.addEventListener("click",e=>{if(!newFilter.contains(e.target))closePicker()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closePicker()});
const budgetGroups=[["Gasto","Gastos"],["Ingreso","Ingresos"],["Pago deuda","Deudas"]];
let budgetGroup="Gasto";
const groupRows=(p,g)=>B.categoryRows(p,currentRates(),display).filter(r=>r.type===g);
function groupTotals(p,g){return B.totals(p,currentRates(),display,g)}
const fmt=n=>n===null?"—":f(n,display);
function periodAssignmentLabel(a){return a.date?short(a.date):datesText(a)}
function historicalEditor(a){return a.source==="legacy-scheduled-income"?"":a.source==="range"||a.date||a.originalDate?'<button class="demo-add" data-edit="'+esc(a.id)+'">Editar</button>':'<button class="demo-add" data-distribute="'+esc(a.id)+'">Asignar fechas</button>';}
function compactRow(r,p,range,editable){
 const known=p.planned.filter(a=>a.categoryId===r.id),hasKnown=r.hasPlan,over=!r.pending&&!r.missing&&r.type!=="Ingreso"&&r.actualMinor>r.plannedMinor,percent=hasKnown&&!r.missing&&r.plannedMinor>0?Math.min(100,Math.max(0,r.actualMinor/r.plannedMinor*100)):0;
 const button=editable&&!r.synthetic&&r.active!==false&&r.budgetable!==false?'<button class="olo-row-add" type="button" data-add="'+esc(r.id)+'" data-unit="'+r.currency+'" data-range="'+range.key+'" aria-label="Asignar a '+esc(r.name)+'">+</button>':"";
 const list=editable&&known.length?'<details class="olo-row-details"><summary>Editar presupuesto</summary>'+known.map(a=>'<div class="olo-detail-line"><span>'+esc(periodAssignmentLabel(a))+' · '+f(a.minor,a.currency)+'</span>'+historicalEditor(a)+'</div>').join("")+'</details>':"";
 return '<div class="olo-budget-row" data-category="'+esc(r.id)+'"><div class="olo-row-top"><span class="olo-row-name">'+esc(r.name)+'</span><span class="olo-row-amount '+(over?"negative":"")+'">'+fmt(r.actualMinor)+' <small>/ '+(hasKnown?fmt(r.plannedMinor):"—")+'</small></span>'+button+'</div>'+(hasKnown&&!r.missing?'<div class="olo-track"><i class="'+(over?"is-over":"")+'" style="width:'+percent+'%"></i></div>':"")+(r.missing?'<small class="olo-row-note">Tipo de cambio por revisar</small>':!hasKnown&&r.actualMinor?'<small class="olo-row-note">'+(r.pending?"Presupuesto de otro período":"Sin presupuesto")+'</small>':"")+list+'</div>';
}
function relatedBudgets(p,editable,g){
 const pending=p.pending.filter(a=>!g||cat(a.categoryId)?.type===g);
 if(!pending.length)return "";
 const groups=new Map();for(const a of pending){const k=JSON.stringify([a.categoryId,a.start,a.end]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(a)}
 return '<details class="olo-related"><summary>Presupuestos relacionados <span>'+groups.size+'</span></summary><p>Estos presupuestos pertenecen a intervalos diferentes. No se suman al presupuesto seleccionado.</p>'+[...groups.values()].map(items=>{
  const a=items[0],r=F.budgetProject(model,{basis:"calendar",start:a.start,end:a.end}),rates=currentRates(),typeFor=id=>cat(id)?.type;
  const used=B.value(r.actuals.filter(x=>x.categoryId===a.categoryId),rates,display,false,typeFor),plan=B.value(r.planned.filter(x=>x.categoryId===a.categoryId),rates,display,true,typeFor);
  return '<div class="olo-detail-line"><span>'+esc(cat(a.categoryId)?.name||"Categoría")+' · '+esc(datesText(a))+'</span><strong>'+fmt(used)+' / '+fmt(plan)+'</strong>'+ (editable?items.map(x=>historicalEditor(x)).join(""):"")+'</div>'
 }).join("")+'</details>';
}
function consolidatedIntelligence(range,editable){
 const p=query(range),rates=currentRates(),typeFor=id=>cat(id)?.type;
 const asOf={...p,actuals:p.actuals.filter(a=>a.date<=TODAY)},rows=B.categoryRows(asOf,rates,display).filter(r=>r.type!=="Ingreso"&&!r.pending&&!r.missing&&r.actualMinor>r.plannedMinor);
 if(!rows.length)return "";
 return '<details class="demo-alloc-list demo-intelligence"><summary>Revisar presupuesto · '+rows.length+'</summary>'+rows.map(r=>{
  const single=new Set([...p.planned,...p.actuals].filter(a=>a.categoryId===r.id).map(a=>a.currency));
  const transfer=editable&&single.size===1&&single.has(display)&&I.donors(model,range,TODAY,F,{categoryId:r.id,currency:display,date:TODAY}).length;
  return '<div class="demo-alloc"><span>'+esc(r.name)+' · '+(r.hasPlan?"Exceso":"Sin presupuesto")+'</span><strong>'+fmt(r.actualMinor-r.plannedMinor)+'</strong>'+(transfer?'<button class="demo-add" data-transfer="'+esc(r.id)+'" data-unit="'+display+'" data-range="'+range.key+'">Redistribuir</button>':"")+'</div>'
 }).join("")+'</details>';
}
function renderFlexibleBudget(){
 const range=agg(T.select(state)),p=query(range),t=groupTotals(p,budgetGroup),rows=groupRows(p,budgetGroup).filter(r=>r.plannedMinor||r.actualMinor||r.missing);
 const summary=[["Presupuesto",t.pending&&t.planned===0?null:t.planned],["Real",t.actual],[budgetGroup==="Ingreso"?"Por recibir":"Restante",t.remaining]];
 el("content").innerHTML='<section class="olo-budget-shell"><div class="olo-budget-summary">'+summary.map(([n,v],i)=>'<div><small>'+n+'</small><strong data-budget-total="'+i+'" class="'+(i===2&&v!==null&&v<0&&budgetGroup!=="Ingreso"?"negative":"")+'">'+fmt(v)+'</strong></div>').join("")+'</div>'+(t.pending?'<p class="olo-compact-hint">Hay presupuestos de otros períodos. El restante de este intervalo no está definido.</p>':"")+'<div class="olo-budget-panel"><div class="olo-budget-tools"><div class="olo-segment" role="group" aria-label="Tipo de presupuesto">'+budgetGroups.map(([id,name])=>'<button type="button" data-budget-group="'+id+'" aria-pressed="'+(id===budgetGroup)+'">'+name+'</button>').join("")+'</div><button type="button" class="btn secondary small" data-add="" data-range="'+range.key+'" data-group="'+budgetGroup+'">＋ Asignar</button></div>'+(rows.length?rows.map(r=>compactRow(r,p,range,true)).join(""):'<p class="olo-empty">No hay registros en este período.</p>')+'</div>'+relatedBudgets(p,true,budgetGroup)+consolidatedIntelligence(range,true)+'</section>';
}
el("content").addEventListener("click",e=>{const b=e.target.closest("[data-budget-group]");if(b){budgetGroup=b.dataset.budgetGroup;renderFlexibleBudget()}});
const baseEditor=openEditor,baseReview=review,dateInput=el("date"),dateLabelNode=el("edit").querySelector('label[for="rc-date"]');
const mode=document.createElement("div");mode.className="olo-assignment-mode";mode.innerHTML='<label for="olo-assignment-mode">Asignar a</label><select id="olo-assignment-mode"><option value="range">Todo el período</option><option value="date">Una fecha específica</option></select><p id="olo-assignment-context" class="muted"></p>';
dateLabelNode.before(mode);
const modeChoice=uxq("assignment-mode"),rangeContext=uxq("assignment-context");
function editorMode(){
 const isRange=modeChoice.value==="range"&&!mode.hidden;
 dateInput.hidden=isRange;dateInput.disabled=isRange;dateInput.required=!isRange;dateLabelNode.hidden=isRange;
 el("repeatFields").hidden=isRange||editing?.kind!=="create";
 rangeContext.hidden=!isRange;invalidate();
}
modeChoice.onchange=editorMode;
openEditor=function(kind,b){
 const target=kind==="edit"?model.allocations.find(a=>a.id===b.dataset.edit):null;
 if(target?.source==="range"){
  const pseudo=document.createElement("button");pseudo.dataset.add=target.categoryId;pseudo.dataset.unit=target.currency;pseudo.dataset.range=target.start+"/"+target.end;
  baseEditor("create",pseudo);editing.kind="edit-range";editing.id=target.id;editing.target=target;editing.range=[target.start,target.end];el("editorTitle").textContent="Editar presupuesto";el("amount").value=String(target.minor/100);el("currency").disabled=true;el("deleteAssignment").hidden=false;
  mode.hidden=false;modeChoice.value="range";modeChoice.disabled=true;rangeContext.textContent=datesText(target);editorMode();return;
 }
 baseEditor(kind,b);mode.hidden=kind!=="create";modeChoice.disabled=false;modeChoice.value=kind==="create"?"range":"date";
 if(kind==="create"){
  rangeContext.textContent=datesText({start:editing.range[0],end:editing.range[1]});
  if(b.dataset.group&&!b.dataset.add){const option=[...el("category").options].find(o=>cat(o.value)?.type===b.dataset.group);if(option)el("category").value=option.value}
  editorMode();
 }else {dateInput.hidden=false;dateLabelNode.hidden=false;dateInput.required=kind!=="distribute";if(kind==="edit"&&target?.parentKey&&model.calendarSlots?.[target.parentKey]){const slot=model.calendarSlots[target.parentKey];dateInput.min=slot.start;dateInput.max=slot.end;if(!T.contains(slot,dateInput.value))dateInput.value=slot.start}}
};
review=function(kind){
 if(kind==="create"&&modeChoice.value==="range"||kind==="edit-range"){
  invalidate();try{
   const [start,end]=editing.range,cmd={kind:kind==="edit-range"?"edit-range":"create-range",id:editing.id,categoryId:el("category").value,currency:el("currency").value,start,end,amount:Number(el("amount").value),transactionId:editing.transactionId};
   staged=E.stage(model,cmd);el("preview").innerHTML='<div class="olo-detail-line"><span>'+esc(datesText({start,end}))+'</span><strong>'+f(staged.created[0].minor,cmd.currency)+'</strong></div>';el("preview").hidden=false;el("confirm").disabled=false;
  }catch(e){el("error").textContent=e.message}return;
 }
 baseReview(kind);
};
const nativeDesignDashboard=renderDashboard;
renderDashboard=function(){
 nativeDesignDashboard();
 if(moduleName!=="home"||nativeHome.hidden)return;
 const range=agg(T.select(state)),p=query(range),wrap=document.getElementById("dashboardCategories");
 wrap.classList.remove("table-wrap");wrap.classList.add("olo-home-category-list");
 const rows=B.categoryRows(p,currentRates(),display).filter(r=>r.type!=="Ingreso"&&(r.actualMinor||r.plannedMinor||r.missing));
 wrap.innerHTML='<table class="olo-category-table"><thead><tr><th scope="col">Categoría</th><th scope="col">Presupuesto</th><th scope="col">Real</th><th scope="col">Restante</th></tr></thead><tbody>'+(rows.length?rows.map(r=>{
  const known=r.hasPlan,over=!r.pending&&!r.missing&&r.actualMinor>r.plannedMinor,percent=known&&!r.missing&&r.plannedMinor>0?Math.max(0,r.actualMinor/r.plannedMinor*100):null;
  const progress=percent===null?"":'<div class="olo-category-usage" aria-label="'+Math.round(percent)+' % ejecutado"><span class="olo-category-meter"><i style="width:'+Math.min(100,percent)+'%" class="'+(over?"is-over":"")+'"></i></span><small>'+Math.round(percent)+'%</small></div>';
  return '<tr data-category="'+esc(r.id)+'"><th scope="row">'+esc(r.name)+progress+'</th><td data-label="Presupuesto">'+(known?fmt(r.plannedMinor):"—")+'</td><td data-label="Real">'+fmt(r.actualMinor)+'</td><td data-label="Restante" class="'+(r.remainingMinor!==null&&r.remainingMinor<0?"negative":"")+'">'+(known?fmt(r.remainingMinor):"—")+'</td></tr>'
 }).join(""):'<tr><td colspan="4" class="olo-empty">Sin actividad en este período.</td></tr>')+'</tbody></table>';
 document.getElementById("dashboardCategoryTitle").closest(".v7-card-head").querySelector("p").textContent="";
 const insight=document.getElementById("dashboardInsight");
 if(p.pending.length)insight.innerHTML='<div class="v7-insight-icon">▥</div><h3>Tu presupuesto</h3><p>Consultá los períodos relacionados.</p><button type="button" class="btn secondary small" id="olo-see-budget">Ver presupuesto</button>';
 document.getElementById("olo-see-budget")?.addEventListener("click",()=>showModule("budget"));
};
const oldGoalSelection=oneGoalSelectedTransactions;
oneGoalSelectedTransactions=function(level,value){if(moduleName!=="moves")return oldGoalSelection(level,value);const range=agg(T.select(state));return (data.reserveMovements||[]).filter(t=>T.contains(range,t.date)).sort((a,b)=>b.date.localeCompare(a.date))};
const nativeDesignRender=render;
render=function(){
 nativeDesignRender();refreshPeriod();closePicker();
 if(moduleName==="budget"&&!nativeBlocked)renderFlexibleBudget();
 if(moduleName==="moves"&&!nativeBlocked){
  const g=document.getElementById("goalMovementPreview");
  if(g){const heading=g.querySelector("strong");if(heading?.textContent==="Actividad de tus fondos")heading.textContent="Transferencias de metas";let d=document.getElementById("olo-goal-movement-detail");if(!d){d=document.createElement("details");d.id="olo-goal-movement-detail";d.className="v7-card olo-related";d.innerHTML="<summary>Aportes y retiros de metas</summary>";g.after(d);d.append(g)}d.hidden=g.hidden; }
 }
};
document.title="One Less One";
nativeHeader.querySelector(".brand-version").hidden=true;

// Restore access to the native FX settings and daily public quote. Only the
// active private ledger may request a quote or write the FX settings.
const fxSetting=document.createElement("details");fxSetting.className="demo-alloc-list";
fxSetting.innerHTML='<summary>Tipo de cambio</summary><div class="olo-detail-line"><span id="olo-fx-status"></span><button type="button" class="btn secondary small" id="olo-fx-open">Consultar o editar</button></div>';
el("integrityReport").before(fxSetting);
function fxStatus(){const r=currentRates();uxq("fx-status").textContent=r.date?short(r.date)+" · Compra ₡"+r.buy.toFixed(2)+" · Venta ₡"+r.sell.toFixed(2):"Sin confirmar"}
saveFxRate=function(date,buy,sell,source="manual",checkedOn=todayIso()){
 if(nativeBlocked||!M.isPrivate(data))return false;
 handoffGuard();oneStorageAssertCurrent();
 // Persist only the rate settings on the exact stored ledger; do not rewrite historical records.
 if(!(Number.isFinite(buy)&&Number.isFinite(sell)&&buy>0&&sell>=buy&&restoreValidDate(date)))return false;
 const disk=JSON.parse(oneStorageSnapshot),settings={...disk.settings},history=Array.isArray(settings.fxHistory)?settings.fxHistory.slice():[],row={date,buy,sell,source:["hacienda","bccr_mirror"].includes(source)?source:"manual"};
 const i=history.findIndex(x=>x.date===date);if(i>=0)history[i]=row;else history.push(row);
 const patch={fxBuy:buy,fxSell:sell,fx:(buy+sell)/2,fxDate:date,fxSource:row.source,fxCheckedOn:checkedOn,fxHistory:history};
 oneStoragePersist(JSON.stringify({...disk,settings:{...settings,...patch}}));Object.assign(data.settings,patch);updateCurrencyHeader();fxStatus();refreshNative();return true;
};
uxq("fx-open").onclick=()=>{if(nativeBlocked||!M.isPrivate(data))return;el("integrityDialog").close();nativeDialog("fxDialog");openFxDialog(true)};
let fxAttemptDay="";
function dailyFx(){
 if(nativeBlocked||!M.isPrivate(data)||document.visibilityState!=="visible")return;
 const today=todayIso();if(data.settings.fxCheckedOn===today||fxAttemptDay===today)return;
 try{handoffGuard();oneStorageAssertCurrent()}catch{return}
 fxAttemptDay=today;void oneFxAutoUpdate().then(()=>{fxStatus();refreshNative()}).catch(()=>{});
}
const renderBeforeFx=render;
render=function(){renderBeforeFx();fxStatus();queueMicrotask(dailyFx)};
window.addEventListener("focus",dailyFx);
document.addEventListener("visibilitychange",dailyFx);
