
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
const groupRows=(p,g)=>p.rows.filter(r=>r.type===g);
function groupTotals(p,g){
 const rows=groupRows(p,g),rates=currentRates(),divisor=display==="USD"?(rates.buy+rates.sell)/2:1;
 const total=(items,planned)=>{let n=0;for(const a of items.filter(a=>cat(a.categoryId)?.type===g)){const type=planned?cat(a.categoryId)?.type:a.type,fx=a.currency==="CRC"?1:planned?(type==="Ingreso"?rates.buy:rates.sell):(type==="Ingreso"?a.fxBuy:a.fxSell);if(!Number.isFinite(fx)||fx<=0||!Number.isFinite(divisor)||divisor<=0)return null;n+=a.minor*fx}return Math.round(n/divisor)};
 const planned=total(p.planned,true),actual=total(p.actuals,false),pending=rows.some(r=>r.pendingMinor>0)||p.issues.length>0;
 return {planned,actual,pending,remaining:pending||planned===null||actual===null?null:planned-actual};
}
const fmt=n=>n===null?"—":f(n,display);
function periodAssignmentLabel(a){return a.date?short(a.date):datesText(a)}
function compactRow(r,p,range,editable){
 const known=p.planned.filter(a=>a.categoryId===r.id&&a.currency===r.currency),hasKnown=r.plannedMinor>0,over=!r.pendingMinor&&r.type!=="Ingreso"&&r.actualMinor>r.plannedMinor,percent=hasKnown?Math.min(100,Math.max(0,r.actualMinor/r.plannedMinor*100)):0;
 const button=editable&&!r.synthetic&&r.active!==false&&r.budgetable!==false?'<button class="olo-row-add" type="button" data-add="'+esc(r.id)+'" data-unit="'+r.currency+'" data-range="'+range.key+'" aria-label="Asignar a '+esc(r.name)+'">+</button>':"";
 const list=editable&&known.length?'<details class="olo-row-details"><summary>Editar presupuesto</summary>'+known.map(a=>'<div class="olo-detail-line"><span>'+esc(periodAssignmentLabel(a))+' · '+f(a.minor,a.currency)+'</span>'+(a.date&&a.source!=="legacy-scheduled-income"||a.source==="range"?'<button class="demo-add" data-edit="'+esc(a.id)+'">Editar</button>':!a.date?'<button class="demo-add" data-distribute="'+esc(a.id)+'">Asignar fechas</button>':"")+'</div>').join("")+'</details>':"";
 return '<div class="olo-budget-row" data-category="'+esc(r.id)+'"><div class="olo-row-top"><span class="olo-row-name">'+esc(r.name)+'</span><span class="olo-row-amount '+(over?"negative":"")+'">'+f(r.actualMinor,r.currency)+' <small>/ '+(hasKnown?f(r.plannedMinor,r.currency):"—")+'</small></span>'+button+'</div>'+(hasKnown?'<div class="olo-track"><i class="'+(over?"is-over":"")+'" style="width:'+percent+'%"></i></div>':"")+(!hasKnown&&r.actualMinor?'<small class="olo-row-note">'+(r.pendingMinor?"Presupuesto de otro período":"Sin presupuesto")+'</small>':"")+list+'</div>';
}
function relatedBudgets(p,editable,g){
 const pending=p.pending.filter(a=>!g||cat(a.categoryId)?.type===g);
 if(!pending.length)return "";
 return '<details class="olo-related"><summary>Presupuestos relacionados <span>'+pending.length+'</span></summary><p>Estos presupuestos pertenecen a intervalos diferentes. No se suman al presupuesto seleccionado.</p>'+pending.map(a=>{
  const used=model.actuals.filter(x=>x.categoryId===a.categoryId&&x.currency===a.currency&&x.date>=a.start&&x.date<=a.end).reduce((n,x)=>n+x.minor,0);
  return '<div class="olo-detail-line"><span>'+esc(cat(a.categoryId)?.name||"Categoría")+' · '+esc(datesText(a))+'</span><strong>'+f(used,a.currency)+' / '+f(a.minor,a.currency)+'</strong>'+(editable?(a.source==="range"?'<button class="demo-add" data-edit="'+esc(a.id)+'">Editar</button>':'<button class="demo-add" data-distribute="'+esc(a.id)+'">Asignar fechas</button>'):"")+'</div>'
 }).join("")+'</details>';
}
function renderFlexibleBudget(){
 const range=agg(T.select(state)),p=query(range),t=groupTotals(p,budgetGroup),rows=groupRows(p,budgetGroup).filter(r=>r.plannedMinor||r.actualMinor);
 const summary=[["Presupuesto",t.pending&&t.planned===0?null:t.planned],["Real",t.actual],[budgetGroup==="Ingreso"?"Por recibir":"Restante",t.remaining]];
 el("content").innerHTML='<section class="olo-budget-shell"><div class="olo-budget-summary">'+summary.map(([n,v],i)=>'<div><small>'+n+'</small><strong data-budget-total="'+i+'" class="'+(i===2&&v!==null&&v<0&&budgetGroup!=="Ingreso"?"negative":"")+'">'+fmt(v)+'</strong></div>').join("")+'</div>'+(t.pending?'<p class="olo-compact-hint">Hay presupuestos de otros períodos. El restante de este intervalo no está definido.</p>':"")+'<div class="olo-budget-panel"><div class="olo-budget-tools"><div class="olo-segment" role="group" aria-label="Tipo de presupuesto">'+budgetGroups.map(([id,name])=>'<button type="button" data-budget-group="'+id+'" aria-pressed="'+(id===budgetGroup)+'">'+name+'</button>').join("")+'</div><button type="button" class="btn secondary small" data-add="" data-range="'+range.key+'" data-group="'+budgetGroup+'">＋ Asignar</button></div>'+(rows.length?rows.map(r=>compactRow(r,p,range,true)).join(""):'<p class="olo-empty">No hay registros en este período.</p>')+'</div>'+relatedBudgets(p,true,budgetGroup)+intelligence(range,true)+'</section>';
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
 }else {dateInput.hidden=false;dateLabelNode.hidden=false;dateInput.required=kind!=="distribute"}
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
 const rows=p.rows.filter(r=>r.type!=="Ingreso"&&(r.actualMinor||r.plannedMinor));
 wrap.innerHTML=rows.length?rows.map(r=>compactRow(r,p,range,false)).join(""):'<p class="olo-empty">Sin actividad en este período.</p>';
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
nativeHeader.querySelector(".brand-version").textContent="v17.1.0";
