function oneStorageGuardWarn(message){
 const banner=document.getElementById("oneStorageGuardBanner");
 const text=document.getElementById("oneStorageGuardMessage");
 if(text)text.textContent=message;
 if(banner)banner.hidden=false;
}
function oneStorageAssertCurrent(){
 if(storageReadError){
  const message="No se pudo leer el historial. No se permite sobrescribirlo: restaurá un respaldo JSON.";
  oneStorageGuardWarn(message);throw Error(message);
 }
 let latest;
 try{latest=localStorage.getItem(STORAGE_KEY)}
 catch(error){oneStorageGuardWarn("No se pudo acceder al almacenamiento. Conservá tus datos y revisá el navegador.");throw error}
 if(oneStorageConflict||latest!==oneStorageSnapshot){
  oneStorageConflict=true;
  const message="Los datos cambiaron en otra pestaña. Esta pestaña no guardará para proteger el historial. Recargá para ver los datos actuales.";
  oneStorageGuardWarn(message);throw Error(message);
 }
}
function oneStoragePersist(serialized){
 oneStorageAssertCurrent();
 try{
  localStorage.setItem(STORAGE_KEY,serialized);
  if(localStorage.getItem(STORAGE_KEY)!==serialized)throw Error("No se pudo verificar el guardado local.");
  oneStorageSnapshot=serialized;
  return true;
 }catch(error){
  oneStorageGuardWarn("No se pudo guardar o verificar el registro. No cerrés esta pestaña; revisá el almacenamiento y recuperá un respaldo si es necesario.");
  throw error;
 }
}
function oneStorageGuardInit(){
 const verify=()=>{
  if(oneStorageConflict)return;
  try{
   if(localStorage.getItem(STORAGE_KEY)!==oneStorageSnapshot){
    oneStorageConflict=true;
    oneStorageGuardWarn("Se detectó un cambio financiero en otra pestaña. Esta vista quedó protegida contra sobrescrituras. Recargá los datos actuales.");
   }
  }catch{oneStorageGuardWarn("No se puede comprobar el almacenamiento local en este momento.")}
 };
 window.addEventListener("storage",event=>{
  if(event.key===STORAGE_KEY||event.key===null)verify();
 });
 window.addEventListener("focus",verify);
 window.addEventListener("pageshow",verify);
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")verify()});
 document.getElementById("oneStorageReload")?.addEventListener("click",()=>location.reload());
 let last="";
 try{last=localStorage.getItem(STORAGE_KEY+"_last_backup_requested")||""}catch{}
 const btn=document.getElementById("exportBtn");
 if(btn&&last)btn.title="Guardar respaldo JSON · último respaldo solicitado: "+last;
}
// V10.9: diagnóstico conservador y de solo lectura; nunca repara ni modifica transacciones.
function oneHealthCheck(raw){
 const issues=[],rows=raw||{},get=key=>Array.isArray(rows[key])?rows[key]:[];
 const countIssue=(count,message)=>{if(count>0)issues.push({count,message})};
 for(const kind of ["periods","movements","categories","debts","reserves","reserveMovements","sharedCharges","sharedChargeGroups","reconciliations","projects","projectLinks","projectPlans"]){
  const seen=new Set();let duplicate=0;
  for(const item of get(kind)){
   const recordId=kind==="periods"?(item.key||""):item.id;
   if(!recordId)continue;
   if(seen.has(recordId))duplicate++;else seen.add(recordId);
  }
  countIssue(duplicate,"ID duplicado en "+kind+"; conviene revisar el respaldo antes de editar.");
 }
 const cats=new Set(get("categories").map(c=>c.id)),funds=new Set(get("reserves").map(r=>r.id)),
  groups=new Set(get("sharedChargeGroups").map(g=>g.id)),debts=new Set(get("debts").map(d=>d.id));
 let orphanCategory=0,orphanDebt=0,orphanGoal=0,orphanGroup=0,badAmount=0,badDate=0,missingUsdRate=0;
 for(const m of get("movements")){
  if(m.categoryId&&!cats.has(m.categoryId))orphanCategory++;
  for(const split of Array.isArray(m.splits)?m.splits:[]){if(split.categoryId&&!cats.has(split.categoryId))orphanCategory++}
  if(m.debtId&&!debts.has(m.debtId))orphanDebt++;
  if(!restoreValidDate(m.date))badDate++;
  if(!Number.isFinite(Number(m.amount))||Number(m.amount)<0)badAmount++;
  if(m.currency==="USD"&&!(Number(m.fxBuy)>0&&Number(m.fxSell)>0))missingUsdRate++;
 }
 for(const t of get("reserveMovements")){
  if(t.reserveId&&!funds.has(t.reserveId))orphanGoal++;
  if(!restoreValidDate(t.date))badDate++;
  if(!Number.isFinite(Number(t.amount))||Number(t.amount)<0)badAmount++;
 }
 for(const c of get("sharedCharges")){
  if(c.groupId&&!groups.has(c.groupId))orphanGroup++;
  if(!restoreValidDate(c.date))badDate++;
  if(!Number.isFinite(Number(c.amount))||Number(c.amount)<0)badAmount++;
 }
 countIssue(orphanCategory,"referencia(s) a categorías que ya no existen.");
 countIssue(orphanDebt,"referencia(s) a deudas inexistentes.");
 countIssue(orphanGoal,"movimiento(s) vinculados a metas inexistentes.");
 countIssue(orphanGroup,"cobro(s) vinculados a grupos inexistentes.");
 countIssue(badDate,"fecha(s) inválidas en movimientos, cobros o metas.");
 countIssue(badAmount,"monto(s) inválidos o negativos no esperados.");
 countIssue(missingUsdRate,"movimiento(s) USD antiguos sin tasas guardadas; revisá su valoración histórica.");
 const projectIds=new Set(get("projects").map(p=>p.id)),movementIds=new Set(get("movements").map(m=>m.id));
 const linkedIds=new Set();let badProjectLinks=0,duplicateProjectLinks=0;
 for(const link of get("projectLinks")){
  if(linkedIds.has(link.movementId))duplicateProjectLinks++;
  linkedIds.add(link.movementId);
  if(!projectIds.has(link.projectId)||!movementIds.has(link.movementId))badProjectLinks++;
 }
 countIssue(badProjectLinks,"vínculo(s) de proyecto con gasto o proyecto inexistente.");
 countIssue(duplicateProjectLinks,"gasto(s) asignados más de una vez a proyectos.");
 const plans=new Map(get("projectPlans").map(x=>[x.id,x]));
 const projectBuckets=new Map(get("projects").map(p=>[p.id,new Set((p.buckets||[]).map(b=>b.id))]));
 const obsoletePlannedBuckets=get("projectPlans").filter(p=>p.bucketId&&!projectBuckets.get(p.projectId)?.has(p.bucketId)).length;
 countIssue(obsoletePlannedBuckets,"previsión(es) con conceptos de proyecto que ya no existen.");
 let orphanReconciliations=0,wrongPlanBuckets=0;
 for(const link of get("projectLinks")){
  if(!link.planId)continue;
  const plan=plans.get(link.planId);
  if(!plan||plan.projectId!==link.projectId)orphanReconciliations++;
  else if(plan.bucketId&&plan.bucketId!==link.bucketId)wrongPlanBuckets++;
 }
 countIssue(orphanReconciliations,"conciliación(es) vinculadas a previsiones inexistentes o de otro proyecto.");
 countIssue(wrongPlanBuckets,"conciliación(es) cuyo concepto es distinto del previsto.");
 const goalIds=new Set(get("reserves").filter(r=>r.type==="goal").map(r=>r.id));
 const projectGroupIds=new Set(get("sharedChargeGroups").map(g=>g.id));
 const usedGoals=new Set(),usedProjectGroups=new Set();
 let orphanProjectGoals=0,orphanProjectGroups=0,repeatedProjectGoals=0,repeatedProjectGroups=0;
 for(const project of get("projects")){
  if(project.goalId){
   if(!goalIds.has(project.goalId))orphanProjectGoals++;
   if(usedGoals.has(project.goalId))repeatedProjectGoals++;
   usedGoals.add(project.goalId);
  }
  if(project.cobroGroupId){
   if(!projectGroupIds.has(project.cobroGroupId))orphanProjectGroups++;
   if(usedProjectGroups.has(project.cobroGroupId))repeatedProjectGroups++;
   usedProjectGroups.add(project.cobroGroupId);
  }
 }
 countIssue(orphanProjectGoals,"referencia(s) de Proyecto a Metas inexistentes.");
 countIssue(orphanProjectGroups,"referencia(s) de Proyecto a grupos de Cobros inexistentes.");
 countIssue(repeatedProjectGoals,"Meta(s) vinculadas a más de un Proyecto.");
 countIssue(repeatedProjectGroups,"grupo(s) de Cobros vinculados a más de un Proyecto.");
 return {issues,checked:get("movements").length+get("reserveMovements").length+get("sharedCharges").length};
}
function oneRenderDataHealth(){
 const slot=document.getElementById("oneDataHealthReport");
 if(!slot)return null;
 const report=oneHealthCheck(data),date=todayIso();
 const status=document.createElement("p");status.className="one-health-status";
 status.dataset.level=report.issues.length||oneStorageConflict||storageReadError?"review":"ok";
 status.textContent=storageReadError?"Historial no legible: guardado bloqueado":
  oneStorageConflict?"Otro cambio detectado: recargá antes de modificar":
  report.issues.length?report.issues.length+" tipo(s) de aviso para revisar":
  "Sin anomalías detectadas en esta comprobación básica";
 slot.replaceChildren(status);
 if(report.issues.length){
  const ul=document.createElement("ul");ul.className="one-health-issues";
  for(const item of report.issues.slice(0,10)){
   const li=document.createElement("li");li.textContent=item.count+" "+item.message;ul.append(li);
  }
  slot.append(ul);
 }
 const last=(()=>{
  try{return localStorage.getItem(STORAGE_KEY+"_last_backup_requested")||""}catch{return ""}
 })();
 const valid=restoreValidDate(last),days=valid?Math.max(0,Math.floor((Date.parse(date+"T00:00:00Z")-Date.parse(last+"T00:00:00Z"))/86400000)):null;
 const p=document.createElement("p");p.className="one-health-note";
 const age=days===null?"No consta una descarga solicitada en este navegador":
  days===0?"Se solicitó una descarga de respaldo hoy":
  "Última descarga solicitada: hace "+days+" día(s)";
 p.textContent=age+". "+(days===null||days>30?"Conviene solicitar y comprobar un respaldo JSON. ":"")+
  "La aplicación no puede verificar si guardaste el archivo descargado: comprobalo en Descargas y conservá otra copia fuera de este navegador. "+
  "Se revisaron "+report.checked+" registros. Esta verificación no sustituye un respaldo ni una conciliación real.";
 slot.append(p);
 return report;
}
function restoreSafely(raw){
  const prepared=restorePrepare(raw),serialized=JSON.stringify(prepared);
  oneStorageAssertCurrent();
  oneBackupBeforeReplace(RESTORE_SAFETY_KEY,"respaldo-previo-restauracion");
  return oneStoragePersist(serialized);
}
function load(){
  try{
    const saved=localStorage.getItem(STORAGE_KEY);
    storageHasSavedData=saved!==null;
    if(saved!==null){
      // Guardar una copia intacta antes de reinterpretar categorías/periodos.
      try{if(localStorage.getItem(INTEGRITY_SNAPSHOT_KEY)===null)localStorage.setItem(INTEGRITY_SNAPSHOT_KEY,saved)}
      catch(e){console.warn("No se pudo crear copia preventiva del historial",e)}
    }
    const result=migrateData(saved!==null?JSON.parse(saved):clone(initialData));
    oneStorageSnapshot=saved;
    return result;
  }catch(e){
    storageReadError=true;
    console.error("Error al leer datos locales; se bloquea el guardado.",e);
    return migrateData(clone(initialData));
  }
}
function initDataIntegrityNotice(){
  const note=document.getElementById("dataIntegrityNotice");
  if(!note)return;
  if(storageReadError){note.hidden=false;note.textContent="No se pudo leer el historial guardado. El guardado está bloqueado para protegerlo. Restaurá un respaldo JSON.";}
  else if(!storageHasSavedData){note.hidden=false;note.textContent="No se encontró historial guardado en este navegador y dirección. Si ya utilizabas la aplicación, comprobá la dirección original o restaurá tu respaldo; los datos iniciales no son tu historial.";}
}
function save(){
  oneStorageAssertCurrent();
  data.version=6.2;data.currencySchemaVersion=1;data.categorySchemaVersion=1;data.incomeSchemaVersion=1;
  return oneStoragePersist(JSON.stringify(data));
}
function num(v){return Number(v)||0}
function normalizeCurrency(v){return String(v||"").toUpperCase()==="USD"?"USD":"CRC"}
function currentRates(){
  const fallback=num(data?.settings?.fx)||460,buy=num(data?.settings?.fxBuy)||fallback,sell=num(data?.settings?.fxSell)||buy;
  return {buy,sell,ref:(buy+sell)/2,date:data?.settings?.fxDate||""};
}
function ratesFromRecord(rec){
  const current=currentRates(),buy=num(rec?.fxBuy)||current.buy,sell=num(rec?.fxSell)||current.sell,ref=num(rec?.fxRef)||((buy+sell)/2);
  return {buy,sell,ref,date:rec?.fxDate||current.date};
}
function rateByIntent(intent,rates=currentRates()){
  if(intent==="receive")return rates.buy;
  if(intent==="pay")return rates.sell;
  return rates.ref;
}
function toCRC(amount,currency="CRC",intent="neutral",rates=currentRates()){
  return normalizeCurrency(currency)==="USD"?num(amount)*rateByIntent(intent,rates):num(amount);
}
function fromCRC(amountCRC,currency=data?.settings?.displayCurrency||"CRC",rates=currentRates()){
  return normalizeCurrency(currency)==="USD"?(rates.ref?num(amountCRC)/rates.ref:0):num(amountCRC);
}
function displayCurrency(){return normalizeCurrency(data?.settings?.displayCurrency||"CRC")}
function money(vCRC){
  const currency=displayCurrency(),value=fromCRC(vCRC,currency);
  return new Intl.NumberFormat(currency==="USD"?"en-US":"es-CR",{style:"currency",currency,maximumFractionDigits:currency==="USD"?2:0,minimumFractionDigits:currency==="USD"?2:0}).format(value);
}
function originalMoney(amount,currency){
  currency=normalizeCurrency(currency);return new Intl.NumberFormat(currency==="USD"?"en-US":"es-CR",{style:"currency",currency,maximumFractionDigits:currency==="USD"?2:0,minimumFractionDigits:currency==="USD"?2:0}).format(num(amount));
}
function originalHint(amount,currency){currency=normalizeCurrency(currency);return currency===displayCurrency()?"":`<span class="original-money">Original: ${originalMoney(amount,currency)}</span>`}
function currentFxSnapshot(){const r=currentRates();return {fxBuy:r.buy,fxSell:r.sell,fxRef:r.ref,fxDate:r.date||todayIso()}}
function recordToCRC(rec,intent="neutral"){return toCRC(rec?.amount,rec?.currency||"CRC",intent,ratesFromRecord(rec))}
function currentToCRC(amount,currency,intent="neutral"){return toCRC(amount,currency,intent,currentRates())}
function dateLabel(s){if(!s)return"";return new Intl.DateTimeFormat("es-CR",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(s+"T00:00:00Z"))}
function csvEscape(v){
 const raw=String(v??"");
 const s=typeof v==="string"&&/^[\s\u0000-\u001f\uFEFF]*[=+\-@]/.test(raw)?"'"+raw:raw;
 return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;
}
function download(name,text,type="text/plain"){
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)
}
function renderFxHistory(){
  const box=document.getElementById("fxHistoryList");if(!box)return;
  const rows=[...(data.settings.fxHistory||[])].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7);
  box.innerHTML=rows.length?`<table><thead><tr><th>Fecha</th><th>Compra</th><th>Venta</th><th>Referencia</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${dateLabel(x.date)}</td><td class="num">₡${num(x.buy).toLocaleString("es-CR",{maximumFractionDigits:2})}</td><td class="num">₡${num(x.sell).toLocaleString("es-CR",{maximumFractionDigits:2})}</td><td class="num">₡${((num(x.buy)+num(x.sell))/2).toLocaleString("es-CR",{maximumFractionDigits:2})}</td></tr>`).join("")}</tbody></table>`:`<div class="empty" style="padding:12px">Aún no hay historial de tipos de cambio.</div>`;
}
function updateCurrencyHeader(){
  const c=displayCurrency();
  document.querySelectorAll("[data-display-currency]").forEach(b=>b.classList.toggle("active",b.dataset.displayCurrency===c));
  const r=currentRates(),btn=document.getElementById("fxBtn");
  if(!btn)return;
  const confirmed=!!data.settings.fxDate&&num(data.settings.fxBuy)>0&&num(data.settings.fxSell)>0;
  const source=data.settings.fxSource==="hacienda"?" · Hacienda":data.settings.fxSource==="bccr_mirror"?" · BCCR":data.settings.fxSource==="manual"?" · Manual":"";
  btn.textContent=confirmed?"TC "+data.settings.fxDate.slice(5)+" · C ₡"+r.buy.toFixed(2)+" / V ₡"+r.sell.toFixed(2)+source:"TC aprox. ₡"+r.ref.toFixed(2)+" · sin confirmar";
  btn.title=confirmed?"Compra y venta en CRC/USD · "+(data.settings.fxSource==="hacienda"?"referencia de Hacienda":data.settings.fxSource==="bccr_mirror"?"referencia BCCR por fuente alternativa":"tasa registrada manualmente")+". Presioná para consultar o editar.":"Se utilizará el último dato disponible; presioná para configurarlo.";
}

function openFxDialog(forceToday=true){
  const dialog=document.getElementById("fxDialog"),r=currentRates();
  document.getElementById("fxDate").value=forceToday?todayIso():(data.settings.fxDate||todayIso());
  document.getElementById("fxBuy").value=r.buy||"";document.getElementById("fxSell").value=r.sell||"";
  const useLast=document.getElementById("useLastFxBtn");if(useLast)useLast.disabled=!(r.buy>0&&r.sell>0);
  renderFxHistory();if(typeof dialog?.showModal==="function")dialog.showModal();
}
function saveFxRate(date,buy,sell,source="manual",checkedOn=todayIso()){
  if(!(buy>0&&sell>0)||!restoreValidDate(date))return false;
  if(sell<buy){alert("El tipo de cambio de venta normalmente debe ser igual o mayor que el de compra. Revisá los valores.");return false;}
  data.settings.fxBuy=buy;data.settings.fxSell=sell;data.settings.fx=(buy+sell)/2;data.settings.fxDate=date;
  data.settings.fxSource=["hacienda","bccr_mirror"].includes(source)?source:"manual";
  data.settings.fxCheckedOn=checkedOn;
  data.settings.fxHistory=Array.isArray(data.settings.fxHistory)?data.settings.fxHistory:[];
  const i=data.settings.fxHistory.findIndex(x=>x.date===date),row={date,buy,sell,source:data.settings.fxSource};
  if(i>=0)data.settings.fxHistory[i]=row;else data.settings.fxHistory.push(row);
  save();updateCurrencyHeader();return true;
}
// La fuente pública no necesita credenciales ni servicios intermedios. Nunca modifica conversiones históricas.
let oneFxPending=null;
function oneFxStatus(message){
  const slot=document.getElementById("fxAutoStatus");
  if(slot)slot.textContent=message;
}
async function oneFxAutoUpdate(force=false){
  const today=todayIso(),existing=data.settings;
  if(!force&&(existing.fxCheckedOn===today||(existing.fxSource==="manual"&&existing.fxDate===today)))return true;
  if(oneFxPending)return oneFxPending;
  oneFxStatus("Consultando compra y venta en Hacienda…");
  const task=(async()=>{
    let timer=null;
    try{
      if(typeof fetch!=="function")throw Error("Servicio de red no disponible");
      const controller=typeof AbortController==="function"?new AbortController():null;
      if(controller)timer=setTimeout(()=>controller.abort(),8000);
      const providers=[
        {source:"hacienda",url:"https://api.hacienda.go.cr/indicadores/tc/dolar"},
        // Solo ante un fallo de Hacienda: espejo BCCR con CORS público y sin credenciales.
        {source:"bccr_mirror",url:"https://tipodecambio.paginasweb.cr/api"}
      ];
      let quote=null,lastError="";
      for(const provider of providers){
        try{
          const response=await fetch(provider.url,{
            method:"GET",cache:"no-store",headers:{"Accept":"application/json"},
            ...(controller?{signal:controller.signal}:{})
          });
          if(!response.ok)throw Error("Respuesta HTTP "+response.status);
          const payload=await response.json();
          let buy,sell,date;
          if(provider.source==="hacienda"){
            buy=Number(payload?.compra?.valor);sell=Number(payload?.venta?.valor);
            date=payload?.compra?.fecha;
            if(date!==payload?.venta?.fecha)throw Error("Fechas de compra y venta no coinciden");
          }else{
            buy=Number(payload?.compra);sell=Number(payload?.venta);
            const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(payload?.fecha||""));
            date=match?match[3]+"-"+match[2]+"-"+match[1]:"";
          }
          const earliest=oneShiftDate(today,-7);
          if(!restoreValidDate(date)||date>today||date<earliest||
            !Number.isFinite(buy)||!Number.isFinite(sell)||buy<100||buy>2000||sell<buy||sell>2100)
            throw Error("Datos de cambio no válidos o desactualizados");
          quote={buy,sell,date,source:provider.source};
          break;
        }catch(error){lastError=String(error?.message||error);}
      }
      if(!quote)throw Error(lastError||"Fuentes no disponibles");
      const {buy,sell,date,source}=quote;
      // Si el usuario introdujo su tasa del día mientras consultábamos, no sustituirla.
      if(!force&&data.settings.fxSource==="manual"&&
        data.settings.fxCheckedOn===today){oneFxStatus("Se conserva la tasa manual seleccionada para hoy.");return true;}
      if(!saveFxRate(date,buy,sell,source,today))throw Error("No se pudieron guardar las tasas");
      oneFxStatus((source==="hacienda"?"Referencia Hacienda":"Referencia BCCR (fuente alternativa)")+" del "+date+" · compra ₡"+buy.toFixed(2)+" · venta ₡"+sell.toFixed(2)+". Podés editarla manualmente si utilizás la cotización de tu banco.");
      const dialog=document.getElementById("fxDialog");
      if(dialog?.open){
        if(force){document.getElementById("fxDate").value=date;document.getElementById("fxBuy").value=buy;document.getElementById("fxSell").value=sell;}
        renderFxHistory();
      }else renderActiveView();
      return true;
    }catch(error){
      oneFxStatus("No se pudo consultar Hacienda ni la fuente alternativa. Se conserva la última tasa registrada; podés introducirla manualmente.");
      updateCurrencyHeader();
      if(!data.settings.fxDate&&!document.getElementById("fxDialog")?.open)openFxDialog(true);
      return false;
    }finally{if(timer!==null)clearTimeout(timer);}
  })();
  oneFxPending=task;
  try{return await task;}finally{oneFxPending=null;}
}

function needsDailyFx(){const r=currentRates();return data.settings.fxDate!==todayIso()||!(r.buy>0&&r.sell>0)}
// Una tasa guardada continúa disponible al refrescar aunque la fecha sea anterior.
// La fecha sigue visible en el encabezado para actualizarla manualmente.
function needsInitialFx(){return !(num(data.settings.fxBuy)>0&&num(data.settings.fxSell)>0)}
function oneShouldPromptFxOnLaunch(){
  // sessionStorage sobrevive a un refresh y se limpia al cerrar la pestaña/app.
  // Una nueva sesión (o un nuevo día) vuelve a solicitar la revisión del TC.
  const key=STORAGE_KEY+"_fx_opened_on";
  const today=todayIso();
  try{
    if(sessionStorage.getItem(key)===today)return false;
    sessionStorage.setItem(key,today);
    return true;
  }catch(e){
    // Si el navegador no admite almacenamiento de sesión, evitar interrumpir recargas.
    return performance.getEntriesByType?.("navigation")?.[0]?.type!=="reload";
  }
}
function renderActiveView(){
  const active=document.querySelector(".view.active")?.id?.replace("view-","")||"dashboard";navigate(active);updateCurrencyHeader();
}

function periodKey(p){return p.key||`${p.quarter}-${p.n}`}
function periodForDateIn(periods,date){
  const candidates=[...periods].sort((a,b)=>a.date.localeCompare(b.date));let chosen=null;
  for(const p of candidates){if(p.date<=date)chosen=p;else break}
  return chosen;
}
function periodForDate(date){return periodForDateIn(data.periods,date)}
function periodByKey(key){return data.periods.find(p=>periodKey(p)===key)}
function budgetQuarter(p){return budgetQuarterFromMonth(p.budgetMonth||deriveBudgetMeta(p).budgetMonth)}
function planningQuartersFrom(periods){return [...new Set(periods.map(p=>budgetQuarterFromMonth(p.budgetMonth||deriveBudgetMeta(p).budgetMonth)).filter(Boolean))].sort()}
function planningQuarters(){return planningQuartersFrom(data.periods)}
function periodOpeningCRC(p){return p.opening!==null&&p.opening!==undefined?currentToCRC(p.opening,p.openingCurrency||"CRC","receive"):null}
function safe(value){return String(value??"").replace(/[&<>\"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[ch]))}
function categoryById(cid){return (data.categories||[]).find(c=>c.id===cid)||null}
function categoryNameById(cid,fallback=""){return categoryById(cid)?.name||fallback||"Sin categoría"}
function categoryClass(type){return type==="Ingreso"?"income":type==="Gasto"?"expense":type==="Pago deuda"?"debt":"asset"}
function categoryTypeLabel(type){return type==="Pago deuda"?"Pago de deuda":type}
function categoryIsActive(c){return c?.active!==false}
function sortedCategories(rows){return [...rows].sort((a,b)=>num(a.sort)-num(b.sort)||String(a.name).localeCompare(String(b.name),"es"))}
function categoriesOfType(types,includeArchived=false){const wanted=new Set(Array.isArray(types)?types:[types]);return sortedCategories((data.categories||[]).filter(c=>wanted.has(c.type)&&(includeArchived||categoryIsActive(c))))}
function budgetCategories(types,p=null){return sortedCategories((data.categories||[]).filter(c=>{
  if(!(Array.isArray(types)?types:[types]).includes(c.type)||c.budgetable===false)return false;
  return categoryIsActive(c)||(p&&num(p.categoryBudgets?.[c.id])!==0);
}))}
function incomeFrequencyLabel(v){return v==="semimonthly"?"Quincenal":v==="monthly"?"Mensual":v==="biweekly"?"Cada 2 semanas":v==="weekly"?"Semanal":v==="once"?"Una vez":"Irregular"}
function incomeBehaviorLabel(v){return v==="fixed"?"Fijo":"Variable"}
function incomeConfigFor(c){if(!c||c.type!=="Ingreso")return null;c.incomeConfig=normalizeIncomeConfig(c.incomeConfig||{});return c.incomeConfig}
function incomePlanSummary(c){
  const cfg=incomeConfigFor(c);if(!cfg)return "—";
  const amount=cfg.expectedAmount>0?originalMoney(cfg.expectedAmount,cfg.expectedCurrency):"Sin monto habitual";
  const auto=cfg.projectAutomatically?"Proyección automática":"Presupuesto manual";
  return `<div class="category-plan-summary"><strong>${safe(cfg.subtype)}</strong> · ${incomeBehaviorLabel(cfg.behavior)}<br>${incomeFrequencyLabel(cfg.frequency)} · ${amount} por pago<br>${auto}</div>`;
}
function scheduledIncomeForPeriod(c,p){return incomeOccurrencesForData(data,c).get(periodKey(p))||null}
function incomeBudgetStatusHtml(c,p){
  const cfg=incomeConfigFor(c),source=p.categoryBudgetSources?.[c.id]||"manual",scheduled=cfg?.projectAutomatically?scheduledIncomeForPeriod(c,p):null;
  if(source==="auto"){
    const dates=(p.categoryBudgetScheduledDates?.[c.id]||scheduled?.dates||[]).map(d=>dateLabel(d)).join(" · ");
    return `<span class="budget-source auto" title="${safe(dates||"Generado desde la configuración del ingreso")}">Programado</span>`;
  }
  if(cfg?.projectAutomatically&&scheduled){return `<span class="budget-source manual">Modificado</span><button type="button" class="reset-income-budget" data-reset-income-budget="${periodKey(p)}|${c.id}">Usar programado</button>`}
  return `<span class="budget-source">Manual</span>`;
}
function periodIncomeScheduleText(p){
  const dates=[];for(const c of budgetCategories("Ingreso",p)){const scheduled=scheduledIncomeForPeriod(c,p);if(scheduled?.dates)dates.push(...scheduled.dates)}
  const unique=[...new Set(dates)].sort();return unique.length?`Ingresos programados: ${unique.map(dateLabel).join(" · ")}`:"Periodo financiero del mes";
}
function setIncomeBudgetToScheduled(p,cid){
  const c=categoryById(cid);if(!p||!c)return;const cfg=incomeConfigFor(c),scheduled=scheduledIncomeForPeriod(c,p);p.categoryBudgets=p.categoryBudgets||{};p.categoryBudgetCurrencies=p.categoryBudgetCurrencies||{};p.categoryBudgetSources=p.categoryBudgetSources||{};p.categoryBudgetScheduledDates=p.categoryBudgetScheduledDates||{};
  p.categoryBudgets[cid]=scheduled?.amount||0;p.categoryBudgetCurrencies[cid]=cfg?.expectedCurrency||"CRC";p.categoryBudgetSources[cid]="auto";if(scheduled?.dates?.length)p.categoryBudgetScheduledDates[cid]=scheduled.dates;else delete p.categoryBudgetScheduledDates[cid];save();
}
function movementCategoryName(m){return categoryNameById(m.categoryId,m.category)}
function movementMatchesCategory(m,c){
  if(Array.isArray(m.splits)&&m.splits.length)return m.splits.some(x=>x.categoryId===c.id);
  return m.categoryId?m.categoryId===c.id:movementCategoryName(m)===c.name;
}
function movementCategoryAmountCRC(m,c){
  if(!Array.isArray(m.splits)||!m.splits.length)return movementMatchesCategory(m,c)?movementAmountCRC(m):0;
  if(!(num(m.amount)>0))return 0;
  const part=m.splits.filter(x=>x.categoryId===c.id).reduce((sum,x)=>sum+num(x.amount),0);
  return movementAmountCRC(m)*part/num(m.amount);
}
function movementDisplayCategory(m){
  return (m.splits||[]).length>1?`${m.splits.length} categorías`:movementCategoryName(m);
}
function periodCategoryBudgetCRC(p,cid,intent="pay"){return currentToCRC(p?.categoryBudgets?.[cid],p?.categoryBudgetCurrencies?.[cid]||"CRC",intent)}
function periodIncomeTotalCRC(p){return budgetCategories("Ingreso",p).reduce((s,c)=>s+periodCategoryBudgetCRC(p,c.id,"receive"),0)}
function periodExpenseTotalCRC(p){return budgetCategories(["Gasto","Pago deuda"],p).reduce((s,c)=>s+periodCategoryBudgetCRC(p,c.id,"pay"),0)}
function allProjectedRows(){
  const periods=[...data.periods].sort((a,b)=>a.date.localeCompare(b.date)||Number(a.fortnight)-Number(b.fortnight));
  let prior=null;
  return periods.map(p=>{
    const explicitOpening=periodOpeningCRC(p),opening=explicitOpening!==null?explicitOpening:(prior??0);
    const incomeCRC=periodIncomeTotalCRC(p),otherIncomeCRC=0;
    const expenses=periodExpenseTotalCRC(p);
    const available=opening+incomeCRC;
    const ending=available-expenses;prior=ending;
    return {...p,planningQuarter:budgetQuarter(p),openingCalc:opening,incomeCRC,otherIncomeCRC,expenses,available,ending,projectionSource:"Plan original"};
  });
}
function getStaticQuarterPeriods(q){return allProjectedRows().filter(p=>p.planningQuarter===q)}
function todayIso(){const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`}
function addDaysIso(date,days){
  const d=new Date(date+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)
}
function periodEndDate(p,periods=null,settings=null){
  const rows=periods||data.periods,config=settings||data.settings;
  const next=(rows||[]).map(x=>x.date).filter(d=>d>p.date).sort()[0]||
    (Number(p.fortnight)===1?canonicalPaymentDate(p.budgetMonth,2,config):canonicalPaymentDate(oneMonthShift(p.budgetMonth,1),1,config));
  return oneShiftDate(next,-1);
}
function movementAmountCRC(m){
  const intent=m.type==="Ingreso"||oneIsCobroReimbursement(m)?"receive":(m.type==="Gasto"||m.type==="Pago deuda")?"pay":"neutral";
  return recordToCRC(m,intent);
}
function oneIsFinancedCardExpense(m){return m?.type==="Gasto"&&!!m.financedDebtId}
function signedMovement(m){
  if(m.type==="Ingreso"||oneIsCobroReimbursement(m))return movementAmountCRC(m);
  if(oneIsFinancedCardExpense(m))return 0; // El gasto es real, pero no salió efectivo.
  if(m.type==="Gasto"||m.type==="Pago deuda")return -movementAmountCRC(m);
  return 0;
}
function reserveTxnCurrentValueCRC(t){return currentToCRC(t.amount,t.currency||"CRC","receive")}
function reserveTxnHistoricalCRC(t,intent){return recordToCRC(t,intent)}
function reserveTxnDelta(t){
  if(t.type==="Aporte"||t.type==="Rendimiento"||t.type==="Ajuste")return reserveTxnCurrentValueCRC(t);
  if(t.type==="Retiro a operación"||t.type==="Uso objetivo")return -reserveTxnCurrentValueCRC(t);
  return 0;
}
function reserveOperatingDelta(t){
  if(t.type==="Aporte")return -reserveTxnHistoricalCRC(t,"pay");
  if(t.type==="Retiro a operación")return reserveTxnHistoricalCRC(t,"receive");
  return 0;
}
function reserveTargetCRC(r){return currentToCRC(r.target,r.targetCurrency||"CRC","pay")}
function reserveBalanceAt(r,asOfDate=todayIso()){
  let balance=r.openingDate<=asOfDate?currentToCRC(r.openingAmount,r.openingCurrency||"CRC","receive"):0;
  balance+=(data.reserveMovements||[]).filter(t=>t.reserveId===r.id&&t.date<=asOfDate).reduce((sum,t)=>sum+reserveTxnDelta(t),0);
  return Math.max(0,balance);
}
function reserveTotals(asOfDate=todayIso()){
  const protectedTotal=data.reserves.filter(r=>r.type==="protected").reduce((s,r)=>s+reserveBalanceAt(r,asOfDate),0);
  const goalTotal=data.reserves.filter(r=>r.type==="goal").reduce((s,r)=>s+reserveBalanceAt(r,asOfDate),0);
  return {protectedTotal,goalTotal,total:protectedTotal+goalTotal};
}
function reconciliationAmountCRC(r){return recordToCRC(r,"receive")}
function eventAfterReconciliation(createdAt,date,rec){
  if(date>rec.date)return true;
  // Sin marca de tiempo de conciliación no se puede demostrar que una transferencia
  // del mismo día haya ocurrido después: se evita sumarla dos veces.
  return date===rec.date&&!!rec.createdAt&&!!createdAt&&String(createdAt)>String(rec.createdAt);
}
function movementAfterReconciliation(m,rec){
  if(m.date>rec.date)return true;
  if(m.date!==rec.date)return false;
  if(rec.afterSeq!==undefined&&rec.afterSeq!==null&&Number.isFinite(Number(rec.afterSeq)))
    return num(m.seq)>Number(rec.afterSeq);
  // Respaldos previos sin afterSeq: usar marcas de creación sólo si existen ambas.
  return !!rec.createdAt&&!!m.createdAt&&String(m.createdAt)>String(rec.createdAt);
}
function latestReconciliation(asOfDate=todayIso()){
  return [...(data.reconciliations||[])]
    .filter(r=>r.date<=asOfDate)
    .sort((a,b)=>a.date.localeCompare(b.date)||String(a.createdAt).localeCompare(String(b.createdAt)))
    .at(-1)||null;
}
function reconciliationForPeriod(p){
  return [...(data.reconciliations||[])]
    .filter(r=>periodKey(periodForDate(r.date)||{})===periodKey(p))
    .sort((a,b)=>a.date.localeCompare(b.date)||String(a.createdAt).localeCompare(String(b.createdAt)))
    .at(-1)||null;
}
function actualBalanceAt(asOfDate){
  const baseRows=allProjectedRows();
  if(!baseRows.length)return 0;
  const rec=latestReconciliation(asOfDate);
  if(rec){
    const movementDelta=data.movements
      .filter(m=>m.date<=asOfDate&&movementAfterReconciliation(m,rec))
      .reduce((s,m)=>s+signedMovement(m),0);
    const reserveDelta=(data.reserveMovements||[])
      .filter(t=>t.date<=asOfDate&&eventAfterReconciliation(t.createdAt,t.date,rec))
      .reduce((s,t)=>s+reserveOperatingDelta(t),0);
    return reconciliationAmountCRC(rec)+movementDelta+reserveDelta;
  }
  const firstDate=baseRows[0].date;
  const base=num(baseRows[0].openingCalc);
  const movementDelta=data.movements.filter(m=>m.date>=firstDate&&m.date<=asOfDate).reduce((s,m)=>s+signedMovement(m),0);
  const reserveDelta=(data.reserveMovements||[]).filter(t=>t.date>=firstDate&&t.date<=asOfDate).reduce((s,t)=>s+reserveOperatingDelta(t),0);
  return base+movementDelta+reserveDelta;
}
function periodMovements(p,throughDate=null){
  return data.movements.filter(m=>m.period===periodKey(p)&&(!throughDate||m.date<=throughDate));
}
function periodHasRealSignal(p){
  return periodMovements(p).length>0 || !!reconciliationForPeriod(p) || (data.reserveMovements||[]).some(t=>t.type==="Aporte"&&periodKey(periodForDate(t.date)||{})===periodKey(p));
}
function remainingBudgetForCurrentPeriod(p,throughDate){
  const ms=periodMovements(p,throughDate).filter(m=>m.type==="Gasto"||m.type==="Pago deuda");
  return budgetCategories(["Gasto","Pago deuda"],p).reduce((sum,c)=>{
    const spent=ms.reduce((s,m)=>s+movementCategoryAmountCRC(m,c),0)+oneBudgetSavingsActual(p,c.id,throughDate);
    return sum+Math.max(0,periodCategoryBudgetCRC(p,c.id,"pay")-spent);
  },0);
}
function pendingIncomeForCurrentPeriod(p,asOfDate){
  // Solo ingresos con pago programado después del saldo calculado a hoy.
  return budgetCategories("Ingreso",p).reduce((sum,c)=>{
    const planned=periodCategoryBudgetCRC(p,c.id,"receive");
    const dates=(p.categoryBudgetScheduledDates?.[c.id]||[]).filter(Boolean);
    if(!planned||!dates.length)return sum;
    const future=dates.filter(date=>date>asOfDate&&date<=periodEndDate(p)).length;
    return sum+planned*(future/dates.length);
  },0);
}
function allAdaptiveProjectedRows(){
  const base=allProjectedRows(),today=todayIso();let prior=null;
  return base.map((p,index)=>{
    const end=periodEndDate(p);
    let opening=index===0?num(p.openingCalc):(prior??num(p.openingCalc));
    let available=opening+num(p.incomeCRC)+num(p.otherIncomeCRC);
    let ending=available-num(p.expenses);
    let source=index===0?"Plan inicial":"Arrastre del plan";
    const isPast=end<today,isCurrent=p.date<=today&&today<=end;
    const periodRec=reconciliationForPeriod(p);
    if(isPast&&periodHasRealSignal(p)){
      ending=actualBalanceAt(end);
      source=periodRec?"Cierre conciliado":"Resultado real registrado";
    }else if(isCurrent){
      opening=actualBalanceAt(today);
      const pendingIncome=pendingIncomeForCurrentPeriod(p,today);
      const pendingExpenses=remainingBudgetForCurrentPeriod(p,today);
      available=opening+pendingIncome;
      ending=available-pendingExpenses;
      source=latestReconciliation(today)?"Saldo operativo actualizado":"Saldo operativo calculado hoy";
    }else if(index>0){
      opening=prior;
      available=opening+num(p.incomeCRC)+num(p.otherIncomeCRC);
      ending=available-num(p.expenses);
      source="Arrastre actualizado";
    }
    prior=ending;
    return {...p,openingCalc:opening,available,ending,projectionSource:source};
  });
}
function getQuarterPeriods(q){return allAdaptiveProjectedRows().filter(p=>p.planningQuarter===q)}
function getOpeningAndBalances(q){return getQuarterPeriods(q)}
function movementPeriod(m){return periodByKey(m.period)||periodForDate(m.date)}
function movementBudgetMonth(m){return movementPeriod(m)?.budgetMonth||deriveBudgetMeta({date:m.date}).budgetMonth}
function movementBudgetQuarter(m){return budgetQuarterFromMonth(movementBudgetMonth(m))}
function movementDebtName(m){
  return data.debts.find(d=>d.id===m.debtId)?.name||m.debt||"";
}
function allActualRows(){
  const rows=allAdaptiveProjectedRows(), today=todayIso();
  return rows.map(p=>{
    const ms=periodMovements(p);
    const actualIncome=ms.filter(m=>m.type==="Ingreso").reduce((s,m)=>s+movementAmountCRC(m),0);
    const actualExpenses=ms.filter(m=>m.type==="Gasto"||m.type==="Pago deuda").reduce((s,m)=>s+movementAmountCRC(m),0)
      +oneSavingsCategories().reduce((sum,c)=>sum+oneBudgetSavingsActual(p,c.id),0);
    const end=periodEndDate(p);
    const actualBalance=p.date<=today?actualBalanceAt(end<today?end:today):null;
    return {...p,actualIncome,actualExpenses,actualBalance};
  });
}
function actualPeriodRows(q){return allActualRows().filter(r=>r.planningQuarter===q)}
function monthKey(date){return String(date||"").slice(0,7)}
function monthLabel(key){
  if(!key)return "";
  const [year,month]=key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1)));
}
function fortnightLabel(p){return `${p.fortnight===1?"1.ª":"2.ª"} quincena de ${monthLabel(p.budgetMonth)}`}
function filterOptions(level){
  if(level==="fortnight"){
    return allProjectedRows().map(p=>({
      value:periodKey(p),
      label:`${fortnightLabel(p)} · ingreso ${dateLabel(p.date)}`
    }));
  }
  if(level==="month"){
    const months=[...new Set([
      ...data.periods.map(p=>p.budgetMonth||deriveBudgetMeta(p).budgetMonth),
      ...data.movements.map(m=>movementBudgetMonth(m))
    ].filter(Boolean))].sort();
    return months.map(m=>({value:m,label:monthLabel(m)}));
  }
  return planningQuarters().map(q=>({value:q,label:q}));
}
function selectedRows(level,value){
  const rows=allActualRows();
  if(level==="fortnight")return rows.filter(r=>periodKey(r)===value);
  if(level==="month")return rows.filter(r=>r.budgetMonth===value);
  return rows.filter(r=>r.planningQuarter===value);
}
function selectedMovements(level,value){
  if(level==="fortnight")return data.movements.filter(m=>m.period===value);
  if(level==="month")return data.movements.filter(m=>movementBudgetMonth(m)===value);
  return data.movements.filter(m=>movementBudgetQuarter(m)===value);
}
function selectedLabel(level,value){
  return filterOptions(level).find(x=>x.value===value)?.label||value||"";
}
function categoryReportFiltered(level,value){
  const rows=selectedRows(level,value),movements=selectedMovements(level,value);
  const categories=sortedCategories((data.categories||[]).filter(c=>["Gasto","Pago deuda"].includes(c.type)));
  // Mostrar solo categorías con presupuesto o egresos reales en el período seleccionado.
  // Evaluar por período y movimiento para respetar ajustes que se compensan en el total.
  return categories.flatMap(c=>{
    const planned=rows.map(p=>periodCategoryBudgetCRC(p,c.id,"pay"));
    const spent=movements
      .filter(m=>(m.type==="Gasto"||m.type==="Pago deuda")&&movementMatchesCategory(m,c))
      .map(m=>movementCategoryAmountCRC(m,c));
    for(const p of rows){const saved=oneBudgetSavingsActual(p,c.id);if(saved>.005)spent.push(saved)}
    if(!planned.some(v=>Math.abs(v)>0.0001)&&!spent.some(v=>Math.abs(v)>0.0001))return [];
    const budget=planned.reduce((sum,v)=>sum+v,0);
    const actual=spent.reduce((sum,v)=>sum+v,0);
    return [{category:c.name,categoryId:c.id,type:c.type,budget,actual,variance:budget-actual,used:budget?actual/budget:0,includesSavings:rows.some(p=>oneBudgetSavingsActual(p,c.id)>.005)}];
  });
}
function selectedSummary(level,value){
  const rows=selectedRows(level,value), movements=selectedMovements(level,value);
  const opening=rows[0]?.openingCalc||0;
  const plannedIncome=rows.reduce((s,r)=>s+num(r.incomeCRC)+num(r.otherIncomeCRC),0);
  const realIncome=movements.filter(m=>m.type==="Ingreso").reduce((s,m)=>s+movementAmountCRC(m),0);
  const plannedExpense=rows.reduce((s,r)=>s+num(r.expenses),0);
  const realExpense=movements.filter(m=>m.type==="Gasto"||m.type==="Pago deuda").reduce((s,m)=>s+movementAmountCRC(m),0);
  const projected=rows.length?(rows.at(-1)?.ending??(opening+plannedIncome-plannedExpense)):opening;
  const actualRows=rows.filter(r=>r.actualBalance!==null&&r.actualBalance!==undefined);
  const actual=actualRows.length?actualRows.at(-1).actualBalance:(opening+realIncome-realExpense);
  return {rows,movements,opening,plannedIncome,realIncome,plannedExpense,realExpense,projected,actual};
}
function debtLinkedPayments(d){
  return data.movements.filter(m=>m.type==="Pago deuda"&&(m.debtId?m.debtId===d.id:m.debt===d.name));
}
function debtPayments(d){
  return debtLinkedPayments(d).reduce((s,m)=>s+movementAmountCRC(m),0);
}
function debtPaymentsSinceAdjustment(d,a){
  // Un pago anterior a la fecha del saldo real ya está absorbido por la
  // conciliación, incluso si fue registrado tardíamente en Movimientos.
  const linked=debtLinkedPayments(d).filter(m=>String(m.date||"")>=String(a.date||""));
  // También ignorar las modificaciones de pagos ya existentes al conciliar.
  if(a.afterSeq!==undefined&&a.afterSeq!==null&&Number.isFinite(Number(a.afterSeq))){
    return linked.filter(m=>num(m.seq)>num(a.afterSeq)).reduce((sum,m)=>sum+movementAmountCRC(m),0);
  }
  // Compatibilidad con conciliaciones previas sin afterSeq.
  if(a.createdAt){
    return linked.filter(m=>String(m.createdAt||"")>String(a.createdAt))
      .reduce((sum,m)=>sum+movementAmountCRC(m),0);
  }
  return Math.max(0,debtPayments(d)-num(a.paidAtAdjustment));
}
// V12.1: el total pagado y el capital aplicado no siempre son iguales.
function debtPrincipalPaymentCRC(m){
 if(m?.type!=="Pago deuda")return 0;
 const original=Number(m.principalAmount);
 const hasVerified=m.principalAmount!==undefined&&m.principalAmount!==null&&m.principalAmount!==""&&
   Number.isFinite(original)&&original>=0&&original<=num(m.amount);
 return hasVerified?recordToCRC({...m,amount:original},"pay"):movementAmountCRC(m);
}
function debtPrincipalPayments(d){return debtLinkedPayments(d).reduce((s,m)=>s+debtPrincipalPaymentCRC(m),0)}
function debtPrincipalPaymentsSinceAdjustment(d,a){
 const linked=debtLinkedPayments(d).filter(m=>String(m.date||"")>=String(a.date||""));
 if(a.afterSeq!==undefined&&a.afterSeq!==null&&Number.isFinite(Number(a.afterSeq)))
   return linked.filter(m=>num(m.seq)>num(a.afterSeq)).reduce((s,m)=>s+debtPrincipalPaymentCRC(m),0);
 if(a.createdAt)return linked.filter(m=>String(m.createdAt||"")>String(a.createdAt))
   .reduce((s,m)=>s+debtPrincipalPaymentCRC(m),0);
 return Math.max(0,debtPrincipalPayments(d)-num(a.paidAtAdjustment));
}
function debtFinancedPurchases(d,a=null){
 return (data.movements||[]).filter(m=>oneIsFinancedCardExpense(m)&&m.financedDebtId===d.id&&
   (!a||movementAfterReconciliation(m,a)))
   .reduce((s,m)=>s+movementAmountCRC(m),0);
}
function debtPaymentsNeedReconciliation(d){
 return debtLinkedPayments(d).some(m=>m.principalAmount===undefined||m.principalAmount===null||m.principalAmount==="");
}
function debtEquivalent(d){return currentToCRC(d.usd,"USD","pay")+num(d.crc)}
function debtLatestAdjustment(d){const a=d?.balanceAdjustments;return Array.isArray(a)&&a.length?a[a.length-1]:null}
function debtOutstanding(d){
 const a=debtLatestAdjustment(d),opening=a?currentToCRC(num(a.amount),normalizeCurrency(a.currency||"CRC"),"pay"):debtEquivalent(d);
 const charges=debtFinancedPurchases(d,a),principal=a?debtPrincipalPaymentsSinceAdjustment(d,a):debtPrincipalPayments(d);
 return Math.max(0,opening+charges-principal);
}
function debtProgressPercent(d){
 const base=debtEquivalent(d);
 return debtLatestAdjustment(d)||debtFinancedPurchases(d)>0?null:base?
   Math.max(0,Math.min(100,debtPrincipalPayments(d)/base*100)):0;
}
function debtLimitCRC(d){return currentToCRC(d.limit,d.limitCurrency||"USD","pay")}
function debtMinimumCRC(d){return currentToCRC(d.minimum,d.minimumCurrency||"CRC","pay")}
function debtUtil(d){const limit=debtLimitCRC(d);return limit?debtOutstanding(d)/limit:0}
function debtStatus(d){return d?.status==="archived"?"archived":"active"}
function activeDebts(){return data.debts.filter(d=>debtStatus(d)==="active")}
function activeDebtTotal(){return activeDebts().reduce((s,d)=>s+debtOutstanding(d),0)}
function activeDebtMinimumTotal(){return activeDebts().reduce((s,d)=>s+debtMinimumCRC(d),0)}
function debtNature(d){
  const type=String(d?.type||"").toLowerCase();
  if(type.includes("tarjeta"))return "revolving";
  if(type.includes("préstamo")||type.includes("prestamo")||type.includes("familiar"))return "structured";
  return "other";
}
function activeDebtBreakdown(){
  return activeDebts().reduce((acc,d)=>{const k=debtNature(d);acc[k]+=debtOutstanding(d);acc.total+=debtOutstanding(d);return acc},{structured:0,revolving:0,other:0,total:0});
}
function debtPayDayNumber(d){
  const match=String(d?.payDay||"").match(/\d{1,2}/);if(!match)return null;const day=parseInt(match[0],10);return day>=1&&day<=31?day:null;
}
function nextDebtDueIso(d,fromIso=todayIso()){
  const day=debtPayDayNumber(d);if(!day)return "";
  const base=new Date(`${fromIso}T12:00:00`);
  const make=(y,m)=>{const last=new Date(y,m+1,0).getDate();const dt=new Date(y,m,Math.min(day,last),12,0,0);return dt};
  let due=make(base.getFullYear(),base.getMonth());
  if(due<base)due=make(base.getMonth()===11?base.getFullYear()+1:base.getFullYear(),(base.getMonth()+1)%12);
  const y=due.getFullYear(),m=String(due.getMonth()+1).padStart(2,"0"),dd=String(due.getDate()).padStart(2,"0");return `${y}-${m}-${dd}`;
}
function debtCommitmentsNextDays(days=30){
  // Un mismo calendario para la vista de Deudas y el cálculo de Inicio.
  const asOf=todayIso(),end=addDaysIso(asOf,Math.max(0,days));
  const entries=oneDebtUpcomingEntries(asOf);
  const due=entries.filter(x=>x.date&&x.minimum>0&&x.date<=end);
  return {total:due.reduce((sum,x)=>sum+x.minimum,0),count:due.length,
    unknown:entries.filter(x=>!x.date||!(x.minimum>0)).length,days};
}

function fillSelect(el,values,current){
  // textContent protege los selectores aunque una categoría tenga caracteres HTML.
  const options=values.map(v=>{
    const option=document.createElement("option");
    option.value=String(v);option.textContent=String(v);option.selected=v===current;
    return option;
  });
  el.replaceChildren(...options);
}
function fillObjectSelect(el,values,current){
  const options=values.map(v=>{
    const option=document.createElement("option");
    option.value=String(v.value);option.textContent=String(v.label);
    option.selected=v.value===current;
    return option;
  });
  el.replaceChildren(...options);
}
function syncPeriodFilter(prefix,preferred){
  const levelEl=document.getElementById(prefix+"Level"), periodEl=document.getElementById(prefix+"Period");
  if(!levelEl||!periodEl)return;
  const level=levelEl.value||"quarter", options=filterOptions(level), current=preferred||periodEl.value;
  let chosen=options.some(o=>o.value===current)?current:null;
  if(!chosen){
    const nowMonth=todayIso().slice(0,7), nowQuarter=budgetQuarterFromMonth(nowMonth), active=periodForDate(todayIso());
    const desired=level==="quarter"?nowQuarter:level==="month"?nowMonth:active?periodKey(active):"";
    chosen=options.find(o=>o.value===desired)?.value||options.at(-1)?.value||"";
  }
  fillObjectSelect(periodEl,options,chosen);
}
function availableBudgetMonths(){
  return [...new Set([
    ...data.periods.map(p=>p.budgetMonth||deriveBudgetMeta(p).budgetMonth),
    ...data.movements.map(m=>movementBudgetMonth(m))
  ].filter(Boolean))].sort();
}
function nearestValue(values,target){
  if(!values.length)return "";
  if(values.includes(target))return target;
  const before=values.filter(v=>v<=target);return before.at(-1)||values[0];
}
function currentFinancialContext(){
  const today=todayIso();
  const active=periodForDate(today);
  const calendarMonth=today.slice(0,7);
  const financialMonth=active?.budgetMonth||nearestValue(availableBudgetMonths(),calendarMonth);
  const financialQuarter=budgetQuarterFromMonth(financialMonth||calendarMonth);
  return {today,active,financialMonth,financialQuarter,fortnight:String(active?.fortnight||1)};
}
function currentFilterDefaults(level){
  const ctx=currentFinancialContext();
  if(level==="quarter")return {quarter:nearestValue(planningQuarters(),ctx.financialQuarter)};
  if(level==="month")return {month:nearestValue(availableBudgetMonths(),ctx.financialMonth)};
  return {month:nearestValue(availableBudgetMonths(),ctx.financialMonth),fortnight:ctx.fortnight};
}
function syncHierarchicalFilter(prefix,resetCurrent=false){
  const levelEl=document.getElementById(prefix+"Level");if(!levelEl)return;
  const level=levelEl.value||"quarter", qEl=document.getElementById(prefix+"Quarter"), mEl=document.getElementById(prefix+"Month"), fEl=document.getElementById(prefix+"Fortnight");
  const qWrap=document.getElementById(prefix+"QuarterWrap"),mWrap=document.getElementById(prefix+"MonthWrap"),fWrap=document.getElementById(prefix+"FortnightWrap");
  const defaults=currentFilterDefaults(level), quarters=planningQuarters(), months=availableBudgetMonths(), ctx=currentFinancialContext();
  const qCurrent=!resetCurrent&&quarters.includes(qEl?.value)?qEl.value:(defaults.quarter||nearestValue(quarters,ctx.financialQuarter));
  const mCurrent=!resetCurrent&&months.includes(mEl?.value)?mEl.value:(defaults.month||nearestValue(months,ctx.financialMonth));
  if(qEl)fillSelect(qEl,quarters,qCurrent);
  if(mEl)fillObjectSelect(mEl,months.map(m=>({value:m,label:monthLabel(m)})),mCurrent);
  if(fEl){
    const available=data.periods.filter(p=>(p.budgetMonth||deriveBudgetMeta(p).budgetMonth)===(mEl?.value||mCurrent)).map(p=>String(p.fortnight));
    const desired=!resetCurrent&&available.includes(fEl.value)?fEl.value:(defaults.fortnight||available[0]||"1");
    fillObjectSelect(fEl,[{value:"1",label:"Quincena 1"},{value:"2",label:"Quincena 2"}].filter(x=>available.includes(x.value)),desired);
  }
  if(qWrap)qWrap.hidden=level!=="quarter";
  if(mWrap)mWrap.hidden=level==="quarter";
  if(fWrap)fWrap.hidden=level!=="fortnight";
}
function hierarchicalSelection(prefix){
  const level=document.getElementById(prefix+"Level")?.value||"quarter";
  if(level==="quarter")return {level,value:document.getElementById(prefix+"Quarter")?.value||""};
  const month=document.getElementById(prefix+"Month")?.value||"";
  if(level==="month")return {level,value:month};
  const fortnight=Number(document.getElementById(prefix+"Fortnight")?.value||1);
  const p=data.periods.find(r=>(r.budgetMonth||deriveBudgetMeta(r).budgetMonth)===month&&Number(r.fortnight)===fortnight);
  return {level,value:p?periodKey(p):"",month,fortnight};
}
function selectionQuarter(prefix){
  const s=hierarchicalSelection(prefix);if(s.level==="quarter")return s.value;
  const month=s.level==="month"?s.value:s.month;return budgetQuarterFromMonth(month);
}
function syncQuarterSelectors(){
  const quarters=planningQuarters();data.quarters=quarters;
  syncHierarchicalFilter("dashboard");
  syncHierarchicalFilter("plan");
  m2SyncMovementPeriod();
}
function navigate(view){
  if(ONE_OPTIONAL_MODULES.has(view)&&!oneModuleEnabled(view))view="dashboard";
  if(!["dashboard","plan","movements","debts","shared","capital","projects","future"].includes(view))view="dashboard";
  uiState.activeView=view;
  saveUiState();
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${view}`));
  document.querySelectorAll("#nav button[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  if(view==="dashboard")renderDashboard();
  if(view==="plan")renderPlan();
  if(view==="movements")renderMovements();
  if(view==="debts")renderDebts();
  if(view==="shared")renderSharedCharges();
  if(view==="capital")renderCapital();
  if(view==="projects")renderProjects();
  if(view==="future")renderFuture();
  if(view==="reports")return navigate("dashboard");
  if(view==="categories")renderCategories();
}

