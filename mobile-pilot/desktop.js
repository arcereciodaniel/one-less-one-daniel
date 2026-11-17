"use strict";
/* One Less One Mobile Pilot — optional, scoped to this browser's private STORAGE_KEY. */
(function(){
  // El piloto móvil de Cloudflare pertenece únicamente al perfil Daniel.
  if(STORAGE_KEY!=="daniel_finanzas_local_v1")return;
  const PREFS_KEY=STORAGE_KEY+"_iphone_pilot_v1";
  const $=id=>document.getElementById(id);
  const status=(message,tone="")=>{const el=$("oneMobileStatus");if(el){el.textContent=message;el.dataset.tone=tone;}};
  const prefs=()=>{try{return JSON.parse(localStorage.getItem(PREFS_KEY)||"{}")}catch{return {}}};
  function validConfig(c){return !!c&&/^https:\/\/[^/]+$/i.test(c.url||"")&&typeof c.key==="string"&&c.key.length>=32;}
  const html='<details class="one-mobile-settings" id="oneMobilePilot"><summary><strong>Registro desde iPhone</strong><small> Piloto · solo para Daniel</small></summary>'+
    '<div class="one-mobile-settings-body"><p>Recibí los movimientos registrados desde el iPhone. No se transmite todo tu historial financiero.</p>'+
    '<div class="one-mobile-fields"><label>URL de Cloudflare Workers<input id="oneMobileUrl" type="url" inputmode="url" spellcheck="false" autocomplete="off" placeholder="https://tu-piloto.workers.dev"></label>'+
    '<label>Clave privada de sincronización<input id="oneMobileKey" type="password" spellcheck="false" autocomplete="off" placeholder="Clave de Cloudflare" minlength="32"></label></div>'+
    '<div class="one-mobile-actions"><button id="oneMobileConnect" class="btn secondary small" type="button">Guardar conexión</button>'+
    '<button id="oneMobileSync" class="btn secondary small" type="button">Sincronizar ahora</button>'+
    '<button id="oneMobileForget" class="btn secondary small" type="button">Desvincular</button></div>'+
    '<p id="oneMobileStatus" role="status" aria-live="polite">La bandeja móvil es opcional. Tus datos siguen guardados en este navegador.</p>'+
    '<p class="one-mobile-caution">La clave queda en este navegador, separada del respaldo JSON. Usá únicamente tu dispositivo personal.</p></div></details>';
  const view=$("view-movements"),head=view?.querySelector(".v7-page-head");
  if(!view||!head)return;
  head.insertAdjacentHTML("afterend",html);
  const config=prefs();$("oneMobileUrl").value=config.url||"";$("oneMobileKey").value=config.key||"";
  if(validConfig(config))status("Conectado · los movimientos del teléfono se importan cuando abrís One Less One.");
  let busy=null;
  async function api(path,method="GET",payload=null,c=null){
    const cfg=c||prefs();
    if(!validConfig(cfg))throw Error("Configurá primero la URL y la clave de sincronización.");
    const response=await fetch(cfg.url+path,{
      method,cache:"no-store",
      headers:{"Authorization":"Bearer "+cfg.key,...(payload?{"Content-Type":"application/json"}:{})},
      ...(payload?{body:JSON.stringify(payload)}:{})
    });
    const body=await response.json().catch(()=>({error:"Respuesta inválida"}));
    if(!response.ok)throw Error(body.error||"Error de conexión ("+response.status+")");
    return body;
  }
  function catalog(){
    // El teléfono conoce solo identificadores, nombres de grupos y participantes,
    // sin importes, saldos, notas, respaldos ni historiales.
    const groups=[];let nameBudget=2600;
    for(const g of activeSharedGroups().slice(0,100)){
      const people=new Map();
      for(const c of data.sharedCharges||[]){
        if(c.groupId!==g.id)continue;
        const name=String(c.person||"").trim().slice(0,120);
        if(name&&!people.has(name.toLocaleLowerCase("es")))people.set(name.toLocaleLowerCase("es"),name);
      }
      const item={id:g.id,name:g.name,people:[...people.values()].slice(0,12)};
      const used=JSON.stringify(item).length;
      if(used>nameBudget)continue;
      groups.push(item);nameBudget-=used;
    }
    return {
      categories:(data.categories||[]).filter(c=>categoryIsActive(c)&&["Ingreso","Gasto"].includes(c.type))
        .map(c=>({id:c.id,name:c.name,type:c.type})),
      debts:(data.debts||[]).filter(d=>debtStatus(d)==="active")
        .map(d=>({id:d.id,name:d.name})),
      goals:(data.reserves||[]).filter(r=>r.type==="goal"&&reserveStatus(r)==="active")
        .map(r=>({id:r.id,name:r.name})),
      groups
    };
  }
  function alreadyImported(id){
    return (data.movements||[]).some(m=>m.mobilePilotId===id)||
      (data.reserveMovements||[]).some(m=>m.mobilePilotId===id)||
      (data.sharedCharges||[]).some(m=>m.mobilePilotId===id)||
      (data.sharedChargeGroups||[]).some(g=>g.mobilePilotId===id);
  }
  function validDate(date){return restoreValidDate(date)&&date<=todayIso();}
  function apply(item){
    const id=String(item?.id||""),p=item?.movement;
    if(!/^[a-zA-Z0-9_-]{16,80}$/.test(id)||!p||typeof p!=="object")throw Error("Registro remoto mal formado.");
    if(alreadyImported(id))return "already";
    const amount=Number(p.amount),date=p.date;
    if(!validDate(date)||!Number.isFinite(amount)||amount<=0||amount>1e9||
      !["CRC","USD"].includes(p.currency)||
      (p.currency==="USD"&&p.type!=="Cobro"&&p.type!=="Cobro dividido"))
      throw Error("Fecha, moneda o monto inválidos.");
    if(p.type==="Cobro dividido"){
      // Un envío equivale a un grupo completo. save() persiste todas las filas juntas.
      const result=oneCreateSplitFare(p,{sourceId:id});
      return result.already?"already":"inserted";
    }
    const common={id,createdAt:new Date().toISOString(),date,amount,currency:p.currency,mobilePilotId:id,
      mobilePilotSource:"iphone",description:String(p.description||"").slice(0,200),...currentFxSnapshot()};
    if(["Gasto","Ingreso","Pago deuda"].includes(p.type)){
      const period=periodForDate(date);
      if(!period||date>periodEndDate(period))throw Error("Este día no tiene período presupuestario. Configurá el trimestre primero.");
      const debt=p.type==="Pago deuda"?data.debts.find(d=>d.id===p.debtId&&debtStatus(d)==="active"):null;
      if(p.type==="Pago deuda"&&!debt)throw Error("Deuda no disponible.");
      const categoryId=debt?suggestDebtCategoryId(debt):p.categoryId;
      const cat=categoryById(categoryId);
      if(!cat||!categoryIsActive(cat)||cat.type!==p.type)
        throw Error("Categoría inactiva o distinta del tipo de movimiento.");
      data.movementSeq=num(data.movementSeq)+1;
      const movement={...common,seq:data.movementSeq,type:p.type,categoryId:cat.id,category:cat.name,
        debtId:debt?.id||"",debt:debt?.name||"",splits:[],account:"",paymentMethod:"",
        period:periodKey(period),quarter:budgetQuarter(period)};
      data.movements.push(movement);m2Audit("create",movement);return "inserted";
    }
    if(p.type==="Cobro"){
      const person=String(p.person||"").trim().slice(0,120);
      if(!person)throw Error("El cobro no tiene persona.");
      const dueDate=String(p.dueDate||"");
      if(dueDate&&!restoreValidDate(dueDate))throw Error("Fecha de cobro inválida.");
      const groupId=String(p.groupId||"").trim();
      if(groupId&&!activeSharedGroups().some(g=>g.id===groupId))
        throw Error("Grupo inexistente o archivado. Actualizá la lista en el iPhone.");
      data.sharedCharges.push({...common,groupId,person,dueDate,chargeMonth:monthKey(date),
        kind:"Uso / consumo",notes:"",payments:[],status:"pending",paidAt:"",
        remindBeforeDays:3,snoozedUntil:"",sourceRecurringId:""});
      return "inserted";
    }
    if(p.type==="Aporte"){
      const fund=data.reserves.find(r=>r.id===p.reserveId&&r.type==="goal"&&reserveStatus(r)==="active");
      if(!fund)throw Error("Meta inactiva o inexistente.");
      const entry={...common,reserveId:fund.id,type:"Aporte",budgetCategoryId:oneGoalBudgetCategory(fund)};
      const validation=oneGoalTxnEligibility(fund,entry);
      if(!validation.ok)throw Error(validation.error);
      data.reserveMovements.push(entry);return "inserted";
    }
    throw Error("Tipo de operación no reconocido.");
  }
  async function fetchAndImport(config){
    await api("/api/catalog","PUT",catalog(),config);
    const response=await api("/api/inbox","GET",null,config);
    if(!Array.isArray(response.items))throw Error("No se recibió una bandeja válida.");
    let imported=0,duplicates=0,issues=0,confirmed=0;
    for(const item of response.items){
      const snapshot=JSON.stringify(data),id=item.id;
      try{
        const outcome=apply(item);
        if(outcome==="inserted"){
          if(storageReadError)throw Error("El almacenamiento local está bloqueado.");
          save();
          // No confirmar ante el servidor hasta verificar el registro persistido.
          const persisted=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
          const found=!!persisted&&[...(persisted.movements||[]),...(persisted.reserveMovements||[]),
             ...(persisted.sharedCharges||[]),...(persisted.sharedChargeGroups||[])]
             .some(x=>x.mobilePilotId===id);
          if(!found)throw Error("No se verificó el guardado local.");
          imported++;
        }else duplicates++;
      }catch(error){
        data=JSON.parse(snapshot);issues++;continue;
      }
      try{await api("/api/ack","POST",{id},config);confirmed++;}catch{}
    }
    if(imported){
      refreshV7MovementCategoryFilter();renderMovements();renderDashboard();renderPlan();renderDebts();
      renderCapital();renderSharedCharges();renderReports();
    }
    const note=imported+" importado(s), "+duplicates+" repetido(s), "+issues+" por revisar."+
      (confirmed<imported+duplicates?" Algunas confirmaciones están pendientes; se reintentará.":"");
    status(note,issues?"warning":"ok");
    return {imported,duplicates,issues,confirmed};
  }
  function sync(force=false){
    if(busy)return busy;
    const c=prefs();if(!validConfig(c)){if(force)status("Primero completá URL y clave.");return Promise.resolve(null)}
    status("Sincronizando catálogo y registros…");
    busy=fetchAndImport(c).catch(error=>{status("No se pudo sincronizar: "+error.message,"warning");return null})
      .finally(()=>{busy=null});
    return busy;
  }
  $("oneMobileConnect").addEventListener("click",()=>{
    const url=$("oneMobileUrl").value.trim().replace(/\/+$/,""),key=$("oneMobileKey").value.trim();
    if(!validConfig({url,key}))return status("Ingresá una URL HTTPS sin ruta y una clave privada de al menos 32 caracteres.","warning");
    localStorage.setItem(PREFS_KEY,JSON.stringify({url,key}));
    status("Conexión guardada solamente en este navegador. Sincronizando…");
    sync(true);
  });
  $("oneMobileSync").addEventListener("click",()=>sync(true));
  $("oneMobileForget").addEventListener("click",()=>{
    if(!confirm("¿Desvincular este navegador del piloto móvil? Los movimientos ya importados no se eliminarán."))return;
    localStorage.removeItem(PREFS_KEY);$("oneMobileUrl").value="";$("oneMobileKey").value="";
    status("Desvinculado. Se conservó el historial.");
  });
  if(validConfig(config)){
    setTimeout(()=>sync(),350);
    window.addEventListener("focus",()=>sync());
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")sync()});
    setInterval(()=>{if(document.visibilityState==="visible")sync()},90000);
  }
})();
