"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{buildPreview:nativePreview}=require("./build-v15-preview.cjs"),{buildAudit}=require("./build-v16-7-audit.cjs");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
function buildCandidate(){
 let native=nativePreview().replaceAll("rastro_lab_v15_6_preview_","rastro_lab_v17_rc1_preview_").replaceAll("V15.6 LAB · DEMO","V17.0 RC1 · PRUEBA");
 let shell=read("src/experimental/v16-minimal-preview.html").replaceAll("V16.6 DEMO","V17.0 RC1").replaceAll("V16.6 · DEMO","V17.0 RC1");
 function rep(a,b){assert.equal(shell.split(a).length,2,"Missing marker: "+a);shell=shell.replace(a,()=>b)}
 rep("/* OLO_NATIVE_CSS */","");
 for(const [marker,file] of [["TEMPORAL","v16-temporal-navigation"],["FINANCE","v16-financial-assignments"],["INTELLIGENCE","v16-budget-intelligence"],["SYSTEM","v16-system-views"],["EDITOR","v16-assignment-editor"]])rep("/* OLO_"+marker+"_CORE */",read("src/experimental/"+file+".cjs"));
 rep("let model=/* OLO_DEMO_MODEL */,T=oneV16Temporal,F=oneV16Finance,E=oneV16Editor,I=oneV16Intelligence,S=oneV16System,TODAY=\"2026-12-19\",el=id=>document.getElementById(id);",read("src/experimental/v16-storage-overlay.cjs")+"\n"+read("src/experimental/v17-native-bridge.cjs")+`
const T=oneV16Temporal,F=oneV16Finance,E=oneV16Editor,I=oneV16Intelligence,S=oneV16System,P=oneV16Storage,B=oneV17Bridge,TODAY="2026-11-20",el=id=>document.getElementById("rc-"+id);
const api={endFor:p=>periodEndDate(p,data.periods,data.settings),allocationState:oneV15QueryCore.allocationState,contributionCategory:oneContributionCategory,projectRows:oneProjectMovementRows,projectExpense:oneProjectExpenseValue,projectPlan:oneProjectPlanSummary,goalCategory:oneGoalBudgetCategory,goalTarget:reserveTargetCRC,goalBalance:reserveBalanceAt,debtEntries:oneDebtUpcomingEntries,cobroPerson,cobroRemaining:cobroRemainingOriginal,actualBalance:actualBalanceAt};
const rawNow=()=>JSON.parse(JSON.stringify(data));
const getModel=()=>B.snapshot(rawNow(),api,TODAY,F,S,P).model;
let model=getModel(),display="CRC";
function commitNative(staged){
 const next=B.commit({raw:rawNow(),api,asOf:TODAY,staged,F,S,P,E,expected:oneStorageSnapshot,io:{read:()=>localStorage.getItem(STORAGE_KEY),readBackup:()=>localStorage.getItem(STORAGE_KEY+"_pre_v17_rc1"),writeBackup:x=>localStorage.setItem(STORAGE_KEY+"_pre_v17_rc1",x),write:oneStoragePersist}});
 data=next.raw;return getModel();
}
function confirmedFlows(){return [...(data.movements||[]).map(m=>({id:"m:"+m.id,date:m.date,minor:Math.round(signedMovement(m)*100)})),...(data.reserveMovements||[]).map(t=>({id:"r:"+t.id,date:t.date,minor:Math.round(reserveOperatingDelta(t)*100)}))]}
`);
 rep('month:"2026-12",level:"week",scope:"all",anchor:TODAY','month:TODAY.slice(0,7),level:"week",scope:"all",anchor:TODAY');
 rep('transactionId:"demo-v16-3-"+(++seq)','transactionId:"rc-"+idForOperation()');
 rep('transactionId:"demo-transfer-"+(++seq)','transactionId:"rc-transfer-"+idForOperation()');
 rep('let transferDraft=null,transferStage=null;','function idForOperation(){return Date.now().toString(36)+"-"+Math.random().toString(36).slice(2)+"-"+(++seq)}\nlet transferDraft=null,transferStage=null;');
 rep('model=E.commit(model,staged);','model=commitNative(staged);');
 rep('model=E.commit(model,transferStage);','model=commitNative(transferStage);');
 rep('DEMO · Datos ficticios · Hoy: 19 dic. 2026 · Sin guardado ni conexión.','RC1 técnica · Datos ficticios · Hoy simulado: 20 nov. 2026 · Almacenamiento aislado · Sin red.');
 rep('<span class="demo-version">V17.0 RC1</span>','<select id="displayCurrency" aria-label="Moneda de totales"><option>CRC</option><option>USD</option></select><span class="demo-version">V17.0 RC1</span>');
 rep('function total(p,field){','function originalTotal(p,field){');
 rep('function kpis(p){','function total(p,field){const t=B.totals(p,currentRates(),display),v=field==="plannedMinor"?t.planned:field==="actualMinor"?t.actual:t.remaining;return v===null?"—":f(v,display)}\nfunction kpis(p){');
 rep('el("periodCaption").textContent=label(range)+','el("periodCaption").textContent="Calendario · Totales "+display+" · Detalle original · "+label(range)+');
 rep('else if(moduleName==="home")el("content").innerHTML=kpis(p)', 'else if(moduleName==="home")el("content").innerHTML=\'<div class="demo-card" style="margin-bottom:12px"><small class="muted">Saldo operativo · fecha simulada</small><h2 style="font-size:1.55rem">\'+f(v.operating.minor,"CRC")+\'</h2></div>\'+kpis(p)');
 rep('if(moduleName==="future"){const a=v.future;return ', 'if(moduleName==="future"){const a=v.future,scenario=B.scenario(model,TODAY,v.range.end,confirmedFlows(),currentRates(),F,S);return \'<section class="demo-card"><h2>Flujo fechado parcial</h2><div class="demo-alloc"><span>Variación incluida · desde hoy</span><strong>\'+(scenario.netMinor===null?"—":f(scenario.netMinor,"CRC"))+\'</strong></div><small class="muted">No es saldo futuro. Excluye obligaciones no conciliadas y presupuesto sin fecha.</small></section>\'+');
 rep('el("lightTheme").onclick=()=>theme("light");el("darkTheme").onclick=()=>theme("dark");','el("lightTheme").onclick=()=>theme("light");el("darkTheme").onclick=()=>theme("dark");el("displayCurrency").onchange=e=>{display=e.target.value;render()};');
 rep('theme("dark");render();','theme("dark");render();');
 // Keep the old DOM for native calculators and startup only. It is not a second user-facing budget.
 const css=shell.match(/<style>([\s\S]*?)<\/style>/)[1];
 let body=shell.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1];
 const split=body.indexOf("<script>");assert(split>0);
 let markup=body.slice(0,split),script=body.slice(split+8,body.lastIndexOf("</script>"));
 const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 for(const id of ids){markup=markup.replaceAll('id="'+id+'"','id="rc-'+id+'"').replaceAll('for="'+id+'"','for="rc-'+id+'"')}
 let localCSS=css;
 for(const id of ids)localCSS=localCSS.replace(new RegExp("#"+id+"(?![\\w-])","g"),"#rc-"+id);
 localCSS+="\n#v17NativeHost{display:none!important}.olo-demo .demo-utility select{width:auto;min-width:0;height:34px;font-size:.75rem}.olo-demo .demo-utility{flex-wrap:wrap}";
 assert(!/<\/script/i.test(script));
 native=native.replace(/<body([^>]*)>/,'<body class="olo-demo"><div id="v17NativeHost" hidden inert>');
 native=native.replace("</body>",()=>"</div><style>"+localCSS+"</style>"+markup+"<script>(function(){try{"+script+"}catch(error){document.getElementById('rc-content').textContent='No se pudo iniciar la candidata. Los registros de prueba no se sobrescribieron. '+error.message;console.error(error)}})();</script></body>");
 assert(!/<script\s+src=/i.test(native));assert(!native.includes("rastro_lab_v7_1_data_v1"));assert(!native.includes("daniel_finanzas_local_v1"));assert(native.includes("connect-src 'none'"));
 return native;
}
if(require.main===module){const out=path.join(root,"preview-v17-rc1");fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"One-Less-One-V17.0-RC1-TECNICA.html"),buildCandidate());fs.writeFileSync(path.join(out,"Auditoria-Local-V16.7.html"),buildAudit());fs.writeFileSync(path.join(out,"LEEME.txt"),"Candidata técnica aislada. Abrí en Chrome/Edge con almacenamiento local habilitado. Datos ficticios, guardado separado de Daniel y Lab. No importés respaldos reales. Probá distribución, asignaciones, recarga, filtros y moneda de totales. Los detalles conservan monedas originales. Futuro presenta solo flujo fechado parcial, no liquidez definitiva. Las pantallas nativas permanecen ocultas; registro/edición de movimientos y demás operaciones nativas no se ofrecen aún. No es apta para producción.");}
module.exports={buildCandidate};
