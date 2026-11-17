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
    '<details class="one-mobile-issues" id="oneMobileIssues" hidden><summary id="oneMobileIssuesTitle">Registros por revisar</summary><ul id="oneMobileIssuesList"></ul><p>Los registros siguen pendientes en la bandeja; sincronizá de nuevo después de resolverlos.</p></details>'+
    '<p class="one-mobile-caution">La clave queda en este navegador, separada del respaldo JSON. Usá únicamente tu dispositivo personal.</p></div></details>';
  const view=$("view-movements"),head=view?.querySelector(".v7-page-head");
  if(!view||!head)return;
  head.insertAdjacentHTML("afterend",html);
  const config=prefs();$("oneMobileUrl").value=config.url||"";$("oneMobileKey").value=config.key||"";
  if(validConfig(config))status("Conectado · los movimientos del teléfono se importan cuando abrís One Less One.");
  let busy=null;
  function issueAction(reason){
    if(/tipo de cambio/i.test(reason))return {label:"Revisar tipo de cambio",action:"fx"};
    if(/período|presupuestario|trimestre/i.test(reason))return {label:"Revisar presupuesto",action:"plan"};
    if(/categoría/i.test(reason))return {label:"Revisar categorías",action:"categories"};
    if(/proyecto|concepto del proyecto/i.test(reason))return {label:"Revisar Proyectos",action:"projects"};
    if(/grupo/i.test(reason))return {label:"Revisar cobros",action:"shared"};
    return null;
  }
  function showIssues(issues){
    const panel=$("oneMobileIssues"),list=$("oneMobileIssuesList");
    if(!panel||!list)return;
    list.replaceChildren();
    panel.hidden=!issues.length;
    $("oneMobileIssuesTitle").textContent=issues.length===1?"1 registro pendiente de revisión":issues.length+" registros pendientes de revisión";
    if(!issues.length){panel.open=false;return}
    for(const issue of issues){
      const li=document.createElement("li");
      const context=document.createElement("strong");
      context.textContent=issue.type+" · "+issue.date+(issue.description?" · "+issue.description:"");
      li.append(context);
      const reason=document.createElement("span");reason.textContent=issue.reason;li.append(reason);
      const fix=issueAction(issue.reason);
      if(fix){
        const button=document.createElement("button");button.type="button";
        button.className="btn secondary small";button.textContent=fix.label;
        button.dataset.mobileFix=fix.action;
        button.addEventListener("click",()=>{
          if(fix.action==="fx"){
            openFxDialog(false);
            return;
          }
          if(fix.action==="categories"){
            document.querySelector("[data-manage-categories]")?.click();
            return;
          }
          navigate(fix.action);
        });
        li.append(button);
      }
      list.append(li);
    }
  }
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
    // Solo metadatos públicos mínimos. No se envía presupuesto, ejecución,
    // categorías financieras internas, notas ni saldos de un Proyecto.
    const projects=[];let projectNameBudget=3400;
    if(oneModuleEnabled("projects"))for(const p of (data.projects||[]).filter(oneProjectEnabled).slice(0,35)){
      const item={id:p.id,name:String(p.name||"").slice(0,100),buckets:(p.buckets||[]).slice(0,12)
        .map(b=>({id:b.id,name:String(b.name||"").slice(0,80)}))};
      const used=JSON.stringify(item).length;
      if(used>projectNameBudget)continue;
      projects.push(item);projectNameBudget-=used;
    }
    return {
      projects,
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
  // Solo tasas verificadas de la fecha del registro o de los siete días previos
  // (para fines de semana/feriados). Nunca usar una cotización posterior.
  function fxForMobileDate(date,currency){
    if(currency!=="USD")return currentFxSnapshot();
    const saved=data.settings||{},byDate=new Map();
    const add=row=>{
      const d=String(row?.date||""),buy=Number(row?.buy),sell=Number(row?.sell);
      if(restoreValidDate(d)&&d<=date&&Number.isFinite(buy)&&Number.isFinite(sell)&&
         buy>0&&sell>=buy)byDate.set(d,{date:d,buy,sell});
    };
    for(const row of saved.fxHistory||[])add(row);
    if(Number(saved.fxBuy)>0&&Number(saved.fxSell)>=Number(saved.fxBuy))
      add({date:saved.fxDate,buy:saved.fxBuy,sell:saved.fxSell});
    const eligible=[...byDate.values()]
      .filter(row=>(Date.parse(date+"T00:00:00Z")-Date.parse(row.date+"T00:00:00Z"))/86400000<=7)
      .sort((a,b)=>b.date.localeCompare(a.date));
    const rate=eligible[0];
    if(!rate)throw Error("Sin tipo de cambio histórico para "+date+" ni en los 7 días anteriores. Revisá las tasas verificables en Tipo de cambio; este registro sigue pendiente.");
    return {fxBuy:rate.buy,fxSell:rate.sell,fxRef:(rate.buy+rate.sell)/2,fxDate:rate.date};
  }
  const createMobileGroupId=()=>id();
  function apply(item){
    const id=String(item?.id||""),p=item?.movement;
    if(!/^[a-zA-Z0-9_-]{16,80}$/.test(id)||!p||typeof p!=="object")throw Error("Registro remoto mal formado.");
    if(alreadyImported(id))return "already";
    const amount=Number(p.amount),date=p.date;
    if(!validDate(date)||!Number.isFinite(amount)||amount<=0||amount>1e9||
      !["CRC","USD"].includes(p.currency)||
      (p.currency==="USD"&&!["Gasto","Ingreso","Cobro","Cobro dividido"].includes(p.type)))
      throw Error("Fecha, moneda o monto inválidos.");
    const fxSnapshot=fxForMobileDate(date,p.currency);
    if(p.type==="Cobro dividido"){
      // Un envío equivale a un grupo completo. save() persiste todas las filas juntas.
      const result=oneCreateSplitFare(p,{sourceId:id,fxSnapshot});
      return result.already?"already":"inserted";
    }
    const common={id,createdAt:new Date().toISOString(),date,amount,currency:p.currency,mobilePilotId:id,
      mobilePilotSource:"iphone",description:String(p.description||"").slice(0,200),...fxSnapshot};
    if(["Gasto","Ingreso","Pago deuda"].includes(p.type)){
      const period=periodForDate(date);
      if(!period||date>periodEndDate(period))throw Error("Este día no tiene período presupuestario. Configurá el trimestre primero.");
      const debt=p.type==="Pago deuda"?data.debts.find(d=>d.id===p.debtId&&debtStatus(d)==="active"):null;
      if(p.type==="Pago deuda"&&!debt)throw Error("Deuda no disponible.");
      // Revalidar frente a datos locales al importar, no confiar solo en
      // el catálogo D1 que pudo quedar obsoleto después de archivar.
      const projectId=String(p.projectId||"").trim(),bucketId=String(p.projectBucketId||"").trim();
      if(projectId||bucketId){
        if(p.type!=="Gasto"||!projectId)throw Error("Proyecto inválido para este tipo de movimiento.");
        const project=oneProjectById(projectId);
        if(!oneModuleEnabled("projects")||!project||!oneProjectEnabled(project))
          throw Error("El proyecto ya no está activo en Daniel. Revisá Proyectos y actualizá el catálogo del iPhone.");
        if(bucketId&&!(project.buckets||[]).some(b=>b.id===bucketId))
          throw Error("El concepto del proyecto ya no existe. Actualizá el catálogo del iPhone.");
      }
      const categoryId=debt?suggestDebtCategoryId(debt):p.categoryId;
      const cat=categoryById(categoryId);
      if(!cat||!categoryIsActive(cat)||cat.type!==p.type)
        throw Error("Categoría inactiva o distinta del tipo de movimiento.");
      data.movementSeq=num(data.movementSeq)+1;
      const movement={...common,seq:data.movementSeq,type:p.type,categoryId:cat.id,category:cat.name,
        debtId:debt?.id||"",debt:debt?.name||"",splits:[],account:"",paymentMethod:"",
        period:periodKey(period),quarter:budgetQuarter(period)};
      data.movements.push(movement);
      if(projectId)oneProjectAssignMovement(movement.id,projectId,bucketId);
      m2Audit("create",movement);return "inserted";
    }
    if(p.type==="Cobro"){
      const person=String(p.person||"").trim().slice(0,120);
      if(!person)throw Error("El cobro no tiene persona.");
      const dueDate=String(p.dueDate||"");
      if(dueDate&&!restoreValidDate(dueDate))throw Error("Fecha de cobro inválida.");
      let groupId=String(p.groupId||"").trim();
      const groupName=String(p.groupName||"").trim().slice(0,120);
      if(groupId&&groupName)throw Error("No podés elegir y crear un grupo al mismo tiempo.");
      if(groupId&&!activeSharedGroups().some(g=>g.id===groupId))
        throw Error("Grupo inexistente o archivado. Actualizá la lista en el iPhone.");
      if(!groupId&&groupName){
        if(activeSharedGroups().some(g=>g.name.toLocaleLowerCase("es")===groupName.toLocaleLowerCase("es")))
          throw Error("Ya existe un grupo con ese nombre. Actualizá el catálogo del iPhone.");
        const group={id:createMobileGroupId(),name:groupName,person,notes:"",cutDay:0,status:"active",
          closedAt:"",closedReason:"",createdAt:common.createdAt,mobilePilotId:id};
        data.sharedChargeGroups.push(group);groupId=group.id;
      }
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
    let imported=0,duplicates=0,confirmed=0,priorFx=0;
    const issues=[];
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
          if(item.movement?.projectId){
            const linked=(persisted.projectLinks||[]).some(link=>link.movementId===id&&
              link.projectId===item.movement.projectId&&
              (link.bucketId||"")===(item.movement.projectBucketId||""));
            if(!linked)throw Error("No se verificó el enlace al proyecto. El registro sigue pendiente.");
          }
          const importedRow=[...(persisted.movements||[]),...(persisted.reserveMovements||[]),
            ...(persisted.sharedCharges||[])].find(x=>x.mobilePilotId===id);
          if(item.movement?.currency==="USD"&&importedRow?.fxDate&&importedRow.fxDate<item.movement.date)priorFx++;
          imported++;
        }else duplicates++;
      }catch(error){
        data=JSON.parse(snapshot);
        const p=item?.movement||{};
        issues.push({
          type:String(p.type||"Registro"),date:String(p.date||"Sin fecha"),
          description:String(p.description||p.groupName||p.person||"").slice(0,120),
          reason:String(error?.message||"Error al importar").slice(0,400)
        });
        continue;
      }
      try{await api("/api/ack","POST",{id},config);confirmed++;}catch{}
    }
    if(imported){
      refreshV7MovementCategoryFilter();renderMovements();renderDashboard();renderPlan();renderDebts();
      renderCapital();renderSharedCharges();renderReports();
      if(oneModuleEnabled("projects"))renderProjects();
    }
    showIssues(issues);
    const note=imported+" importado(s), "+duplicates+" repetido(s), "+issues.length+" por revisar."+
      (priorFx?" "+priorFx+" registro(s) USD usaron una tasa anterior a su fecha; revisá la fecha del TC guardado.":"")+
      (confirmed<imported+duplicates?" Algunas confirmaciones están pendientes; se reintentará.":"")+
      (issues.length?" Abrí el detalle de registros por revisar en Movimientos.":"");
    status(note,issues.length?"warning":"ok");
    return {imported,duplicates,issues:issues.length,confirmed,priorFx};
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
