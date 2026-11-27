
// Local-only audit; the user can share the text deliberately without exporting the entire ledger.
const auditDialog=document.createElement("dialog");
auditDialog.id="rc-transitionAudit";auditDialog.className="one-split-dialog";
auditDialog.innerHTML='<div class="dialog-head"><h2>Conciliar presupuesto y movimientos</h2><button type="button" class="btn secondary small" id="rc-closeTransitionAudit">Cerrar</button></div><p class="muted">Comparación por categoría del mes financiero anterior y el calendario. Solo lectura.</p><label for="rc-transitionMonth">Mes</label><select id="rc-transitionMonth"></select><div id="rc-transitionResults"></div><details class="olo-related"><summary>Informe para compartir</summary><p>Contiene montos y fechas por categoría, no claves ni descripciones privadas. Copialo solo si querés compartirlo.</p><textarea id="rc-transitionText" readonly rows="9" style="width:100%"></textarea><button class="btn secondary small" type="button" id="rc-transitionCopy">Copiar informe</button></details>';
document.body.append(auditDialog);
const aq=id=>document.getElementById("rc-"+id);
aq("closeTransitionAudit").onclick=()=>auditDialog.close();
function renderTransitionAudit(){
 const month=aq("transitionMonth").value;
 const a=oneV17TransitionAudit.inspect(model,month,F),out=aq("transitionResults"),lines=[longMonth(month),"Comparación por moneda: presupuesto anterior / presupuesto calendario / real anterior / real calendario / diferencia / real conciliado."];
 const oldDates=a.periods.map(p=>datesText(p)).join(" · ");
 out.innerHTML='<p class="muted">Anterior: '+esc(oldDates||"Sin períodos históricos")+'<br>Calendario: '+esc(datesText(a))+'</p>';
 const root=document.createElement("div");
 for(const r of a.rows){
  const detail=document.createElement("details");detail.className="olo-related";detail.style.marginBottom="8px";
  const heading=document.createElement("summary");heading.textContent=r.name+" · "+r.currency+" · "+(r.reconciledActual!==r.oldActual?"Diferencia conciliada "+f(r.reconciledActual-r.oldActual,r.currency):"Conciliado");detail.append(heading);
  const summary=document.createElement("div");
  const values=[["Presupuesto anterior",r.oldPlan],["Presupuesto calendario",r.newPlan],["Real anterior",r.oldActual],["Real calendario",r.newActual],["Solo en período anterior",r.onlyOld],["Solo en calendario",r.onlyNew],["Real conciliado",r.reconciledActual],["Arrastre incluido",r.carryMinor],["Restante conciliado",r.remaining]];
  for(const [label,n] of values){const line=document.createElement("div");line.className="olo-detail-line";const l=document.createElement("span"),num=document.createElement("strong");l.textContent=label;num.textContent=n===null?"—":f(n,r.currency);line.append(l,num);summary.append(line)}
  if(r.relatedPlan){const p=document.createElement("p");p.textContent="Presupuesto relacionado no incluido: "+f(r.relatedPlan,r.currency);summary.append(p)}
  detail.append(summary);
  lines.push(r.name+" ("+r.type+", "+r.currency+"): "+[r.oldPlan,r.newPlan,r.oldActual,r.newActual,r.delta,r.reconciledActual].map(n=>f(n,r.currency)).join(" | "));
  for(const x of r.items){const line=document.createElement("div");line.className="olo-detail-line";const l=document.createElement("span"),n=document.createElement("strong"),status={both:"Ambas vistas",onlyOld:"Solo período anterior",onlyNew:"Solo calendario"}[x.status];l.textContent=x.date+" · "+x.type+" · "+status+(x.month?" · Vinculado a "+longMonth(x.month):" · Sin vínculo");n.textContent=f(x.minor,r.currency);line.append(l,n);detail.append(line);if(x.status!=="both")lines.push("  "+l.textContent+" | "+n.textContent)}
  root.append(detail);
 }
 out.append(root);aq("transitionText").value=lines.join("\n");
}
aq("transitionMonth").onchange=renderTransitionAudit;
aq("transitionCopy").onclick=async()=>{const input=aq("transitionText");input.select();try{await navigator.clipboard.writeText(input.value)}catch{input.focus()}};
function openTransitionAudit(){
 if(nativeBlocked)return;
 const months=new Set([state.month,"2026-11","2026-12",...model.periods.map(p=>p.financialMonth),...model.actuals.map(a=>a.date.slice(0,7))]);
 const picker=aq("transitionMonth");picker.replaceChildren(...[...months].filter(m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m)).sort().map(m=>{const o=document.createElement("option");o.value=m;o.textContent=longMonth(m);return o}));picker.value=state.month;renderTransitionAudit();auditDialog.showModal();
}
const auditButton=document.createElement("button");auditButton.type="button";auditButton.className="btn secondary small";auditButton.textContent="Conciliar presupuesto";auditButton.onclick=openTransitionAudit;
const priorBudgetRender=renderFlexibleBudget;
renderFlexibleBudget=function(){priorBudgetRender();const panel=el("content").querySelector(".olo-budget-shell");const key=document.createElement("div");key.className="olo-detail-line";key.innerHTML='<small class="muted">Real / Presupuesto</small>';key.append(auditButton);panel.querySelector(".olo-budget-tools").after(key)};
