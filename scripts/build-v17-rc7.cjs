"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{buildCandidate:rc6}=require("./build-v17-rc6.cjs");
const root=path.resolve(__dirname,"..");
function buildCandidate(){
 let h=rc6().replaceAll("rastro_lab_v17_rc6_preview_","rastro_lab_v17_rc7_preview_").replaceAll("_pre_v17_rc6","_pre_v17_rc7").replaceAll("_before_rc6_restore","_before_rc7_restore").replaceAll("RC6","RC7").replaceAll("v17-rc6-test-backup","v17-rc7-test-backup");
 const rep=(a,b)=>{assert.equal(h.split(a).length,2,"Marker: "+a);h=h.replace(a,()=>b)};
 rep('const C=oneV17Commitments,L=oneV17Links,Q=oneV17Forecast,A=oneV17Audit,O=oneV17Operations;',fs.readFileSync(path.join(root,"src/experimental/v17-available.cjs"),"utf8")+'\nconst V=oneV17Available,C=oneV17Commitments,L=oneV17Links,Q=oneV17Forecast,A=oneV17Audit,O=oneV17Operations;');
 rep('function moduleActions(v){',`
function availableCard(){
 let info;
 try{
  const native=oneEstimatedAvailable(TODAY),rows=Object.fromEntries((data.periods||[]).map(p=>[periodKey(p),oneV15PeriodBudgetRows(p,TODAY)]));
  info=V.calculate(model,TODAY,native,rows,currentRates());
 }catch{info={ready:false,reason:"Datos pendientes de revisión"}}
 return '<div class="demo-alloc"><div><small class="muted">Disponible estimado</small><h2 data-available-value>'+ (info.ready?f(info.availableMinor,"CRC"):"—")+'</h2><small class="muted">'+(info.ready?"Egresos previstos hasta "+short(info.horizon):esc(info.reason))+'</small></div><button class="demo-add" data-native-action="reconcile">Conciliar</button></div><details class="demo-alloc-list"><summary>Ver cálculo</summary>'+(info.ready?'<div class="demo-alloc"><span>Presupuesto pendiente</span><strong>'+f(info.pendingMinor,"CRC")+'</strong></div>':'')+'<small class="muted">Mes salarial actual. No incluye ingresos futuros ni obligaciones sin presupuesto; no equivale a saldo bancario.</small></details>';
}
function moduleActions(v){`);
 rep('f(v.operating.minor,"CRC")+\'</h2></div>\'+kpis(p)','f(v.operating.minor,"CRC")+\'</h2>\'+availableCard()+\'</div>\'+kpis(p)');
 rep('"debtBalanceDialog","oneSplitFareDialog"]','"debtBalanceDialog","oneSplitFareDialog","reconcileDialog","categoryManagerDialog","categoryDialog","oneDebtTypesDialog","fxDialog"]');
 rep('if(action==="movement"){openMovement();return}',`if(action==="reconcile"){openReconcile();document.getElementById("rDate").value=TODAY;document.getElementById("rDate").dispatchEvent(new Event("change",{bubbles:true}));return}
 if(action==="debt-balance"||action==="debt-archive"||action==="goal-archive"){const b=document.createElement("button");b.dataset[({ "debt-balance":"adjustDebt","debt-archive":"archiveDebt","goal-archive":"archiveReserve"})[action]]=id;document.body.appendChild(b);try{b.click()}finally{b.remove()}return}
 if(action==="project-bucket"){if(find("projects")){oneProjectSelect(id);oneProjectOpenBucket()}return}
 if(action==="movement"){openMovement();return}`);
 rep('actionButton("debt","Editar",d.id)','\'<details class="demo-alloc-list"><summary>Acciones</summary>\'+actionButton("debt","Editar",d.id)+actionButton("debt-balance","Actualizar saldo",d.id)+actionButton("debt-archive","Archivar",d.id)+\'</details>\'');
 rep('actionButton("goal","Editar",g.id)+actionButton("contribution","Aportar",g.id)','actionButton("contribution","Aportar",g.id)+\'<details class="demo-alloc-list"><summary>Acciones</summary>\'+actionButton("goal","Editar",g.id)+actionButton("goal-archive","Archivar",g.id)+\'</details>\'');
 rep('actionButton("project","Editar",p.id)+actionButton("project-plan","Prever gasto",p.id)','actionButton("project-plan","Prever gasto",p.id)+\'<details class="demo-alloc-list"><summary>Acciones</summary>\'+actionButton("project","Editar",p.id)+actionButton("project-bucket","Nuevo concepto",p.id)+\'</details>\'');
 rep('<div id="rc-integrityReport"></div>','<div class="demo-native-actions"><button type="button" class="demo-add" id="rc-categorySettings">Categorías</button><button type="button" class="demo-add" id="rc-debtSettings">Tipos de deuda</button><button type="button" class="demo-add" id="rc-fxSettings">Tipo de cambio</button></div><div id="rc-integrityReport"></div>');
 rep('el("integrity").onclick=',`
el("categorySettings").onclick=()=>{el("integrityDialog").close();renderCategories();document.getElementById("categoryManagerDialog").showModal()};
el("debtSettings").onclick=()=>{el("integrityDialog").close();oneDebtTypeFormReset();oneDebtTypesRender();document.getElementById("oneDebtTypesDialog").showModal()};
el("fxSettings").onclick=()=>{el("integrityDialog").close();openFxDialog(true)};
el("integrity").onclick=`);
 // Surface controls only when they are needed; no additional temporal selector.
 rep('#v17NativeHost{display:none!important}', '#v17NativeHost{display:none!important}.olo-demo [data-available-value]{font-size:1.35rem;margin:4px 0}.olo-demo #rc-integrityDialog .demo-native-actions{justify-content:flex-start;flex-wrap:wrap}');
 assert(!h.includes("rastro_lab_v17_rc6_preview_"));return h;
}
if(require.main===module){const out=path.join(root,"preview-v17-rc7");fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"One-Less-One-V17.0-RC7-TECNICA.html"),buildCandidate());fs.writeFileSync(path.join(out,"LEEME.txt"),"RC7 técnica aislada. Datos ficticios. Inicio: disponible estimado del mes salarial, conciliación nativa. Configuración: categorías, deuda y tipo de cambio. No importés datos reales. La proyección permanece parcial. No publicar.");}
module.exports={buildCandidate};
