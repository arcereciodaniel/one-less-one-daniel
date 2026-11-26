"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{buildCandidate:rc3}=require("./build-v17-rc3.cjs");
const root=path.resolve(__dirname,"..");
function buildCandidate(){
 let h=rc3().replaceAll("rastro_lab_v17_rc3_preview_","rastro_lab_v17_rc4_preview_").replaceAll("_pre_v17_rc3","_pre_v17_rc4").replaceAll("_before_rc3_restore","_before_rc4_restore").replaceAll("V17.0 RC3","V17.0 RC4").replaceAll("RC3","RC4").replaceAll("v17-rc3-test-backup","v17-rc4-test-backup");
 const rep=(a,b)=>{assert.equal(h.split(a).length,2,"Marker: "+a);h=h.replace(a,()=>b)};
 rep('const A=oneV17Audit,O=oneV17Operations;',fs.readFileSync(path.join(root,"src/experimental/v17-reconciled-forecast.cjs"),"utf8")+'\nconst Q=oneV17Forecast,A=oneV17Audit,O=oneV17Operations;');
 rep('function confirmedFlows(){return [...(data.movements||[]).map(m=>({id:"m:"+m.id,date:m.date,minor:Math.round(signedMovement(m)*100)})),...(data.reserveMovements||[]).map(t=>({id:"r:"+t.id,date:t.date,minor:Math.round(reserveOperatingDelta(t)*100)}))]}',`
function confirmedFlows(){
 const missing=(m)=>(m.currency==="USD"&&!(Number(m.fxBuy)>0&&Number(m.fxSell)>0));
 return [...(data.movements||[]).map(m=>({id:"m:"+m.id,date:m.date,minor:Math.round(signedMovement(m)*100),missingFX:missing(m)})),...(data.reserveMovements||[]).map(t=>({id:"r:"+t.id,date:t.date,minor:Math.round(reserveOperatingDelta(t)*100),missingFX:missing(t)}))];
}
`);
 rep('const a=v.future,scenario=B.scenario(model,TODAY,v.range.end,confirmedFlows(),currentRates(),F,S),liquidity=O.liquidity(scenario,v.operating.minor,oneFutureForecast(TODAY,90).items,TODAY,v.range.end);','const a=v.future,liquidity=Q.forecast(model,TODAY,v.range.end,confirmedFlows(),oneFutureForecast(TODAY,90).items,currentRates(),F);');
 rep('(liquidity===null?"—":f(liquidity.netMinor,"CRC"))','(liquidity.netMinor===null?"—":f(liquidity.netMinor,"CRC"))');
 rep('(liquidity===null?"—":f(liquidity.balance,"CRC"))','(liquidity.balance===null?"—":f(liquidity.balance,"CRC"))');
 rep('<small class="muted">Escenario parcial: cuotas nativas hasta 90 días, sin presupuesto de deuda adicional, proyectos ni cobros pendientes.</small>','<div class="demo-alloc"><span>Mínimo del escenario</span><strong>\'+(liquidity.lowest===null?"—":f(liquidity.lowest,"CRC"))+\'</strong></div><small class="muted">Parcial · hasta \'+short(liquidity.end)+\' · \'+liquidity.counts.pending+\' partidas por revisar</small><details class="demo-alloc-list"><summary>Qué falta conciliar</summary>\'+liquidity.reasons.map(code=>\'<div class="demo-alloc">\'+esc(({ "not-full-liquidity-forecast":"No es saldo garantizado","no-future-range":"Elegí un período futuro","horizon-limited":"Cuotas limitadas a 90 días","undated-budget":"Presupuesto sin fecha","project-review":"Previsiones de proyectos","collection-review":"Cobros pendientes","undated-debt":"Deudas sin fecha","historical-review":"Historial por revisar","confirmed-fx-review":"Movimiento sin tipo de cambio histórico","debt-review":"Cuota inválida","debt-budget-review":"Presupuesto de deuda pendiente de vincular","date-matching-review":"Asignaciones y ejecución en fechas o monedas distintas","planned-fx-review":"Tipo de cambio del presupuesto","category-review":"Categoría por revisar"})[code]||code)+\'</div>\').join("")+\'</details>');
 rep('const r=A.reconcile(base,model,F,state.month),lines=','const r=A.reconcile(base,model,F,state.month),mapped=Q.financialComparison(model,state.month,F),lines=');
 rep('el("basisReport").innerHTML=','el("basisReport").innerHTML=');
 rep('Pendientes de distribuir: \'+r.counts.pending+\'.</p>\';','Pendientes de distribuir: \'+r.counts.pending+\'.</p><div class="demo-section"><h3>Simulación salarial por fecha</h3>\'+Object.entries(mapped.comparison.totals).map(([c,t])=>\'<div class="demo-alloc"><span>Egresos · \'+c+\'</span><strong>\'+f(t.outflow.plannedMinor,c)+\'</strong></div>\').join("")+\'<small class="muted">\'+mapped.assignments.length+\' asignaciones nuevas coinciden por fecha con este mes salarial. \'+mapped.unmapped.length+\' sin período. Solo comparación: no cambia el histórico.</small></div>\';');
 assert(!h.includes("rastro_lab_v17_rc3_preview_"));return h;
}
if(require.main===module){const out=path.join(root,"preview-v17-rc4");fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"One-Less-One-V17.0-RC4-TECNICA.html"),buildCandidate());fs.writeFileSync(path.join(out,"LEEME.txt"),"RC4 técnica aislada. Solo datos ficticios. Futuro: escenario parcial hasta 90 días, partidas pendientes separadas; Configuración: comparación salarial por fecha sin alterar históricos. No importés respaldos reales ni de otras candidatas. No publicable.");}
module.exports={buildCandidate};
