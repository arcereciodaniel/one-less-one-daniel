"use strict";
// V16.2: normalized read-only assignments, exact original minor units, explicit date or unresolved interval.
const oneV16Finance=(()=>{
 const valid=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
 const money=(v)=>{if(typeof v!=="number"||!Number.isFinite(v)||v<0||!Number.isSafeInteger(Math.round(v*100))||Math.abs(v*100-Math.round(v*100))>1e-5)throw Error("Monto inválido");return Math.round(v*100)};
 const currency=c=>{if(!["CRC","USD"].includes(c))throw Error("Moneda inválida");return c};
 const add=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))throw Error("Monto fuera de rango");return n};
 const key=p=>p.key||((p.quarter&&p.n)?p.quarter+"-"+p.n:"");
 const inside=(r,d)=>r.start<=d&&d<=r.end;
 const validRange=r=>r&&valid(r.start)&&valid(r.end)&&r.start<=r.end;
 const overlaps=(a,b)=>a.start<=b.end&&b.start<=a.end;
 const included=(a,b)=>b.start<=a.start&&a.end<=b.end;
 const kinds=["Ingreso","Gasto","Pago deuda"];
 // Production calendar-budget policy: original period keys and ledger dates remain authoritative
 // for audit and cash flows. Only the budget interpretation is normalized.
 let normalizeLegacyQuincenas=false,novemberTransition=false;
 function enableCalendarQuincenas(){normalizeLegacyQuincenas=true}
 function enableNovemberTransition(){novemberTransition=true}
 function calendarSlot(p){
  if(p.periodKind==="flexible"||![1,2].includes(Number(p.fortnight))||!valid(p.budgetMonth+"-01"))return null;
  const m=p.budgetMonth,last=new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5)),0)).toISOString().slice(0,10);
  return {start:m+(Number(p.fortnight)===1?"-01":"-16"),end:Number(p.fortnight)===1?m+"-15":last};
 }
 function budgetAllocation(model,a){
  const r=model.calendarSlots?.[a.parentKey];if(!r)return a;
  if(a.date?inside(r,a.date):a.source==="legacy"?a.start===r.start&&a.end===r.end:included(a,r))return a;
  // Never invent a date. A historical block or scheduled amount outside the new
  // fortnight becomes a budget envelope in that fortnight; source dates stay intact.
  const {date,start,end,...rest}=a;
  return {...rest,start:r.start,end:r.end,calendarMapped:true,...(date?{originalDate:date}:{originalStart:start,originalEnd:end})};
 }
 function budgetBounds(model,a){
  const b=budgetAllocation(model,a);return b.date?{start:b.date,end:b.date}:{start:b.start,end:b.end};
 }
 // The opening bridge belongs to November's first budget slot, not to a
 // fabricated transaction date. Only the budget projection uses this anchor.
 // December onward and all other actuals continue to use their real dates.
 function budgetActualDate(model,a){
  if(!model.novemberTransition||a.financialMonth!=="2026-11"||a.date>="2026-11-01"||model.calendarSlots?.[a.parentKey]?.start!=="2026-11-01")return a.date;
  const original=model.periods.find(p=>p.key===a.parentKey);
  return original&&original.financialMonth==="2026-11"&&inside(original,a.date)?"2026-11-01":a.date;
 }
 function budgetProject(model,scope){
  if(scope.basis!=="calendar")return project(model,scope);
  const actuals=scope.actualBasis==="date"?model.actuals:model.actuals.map(a=>{const budgetDate=budgetActualDate(model,a);return budgetDate===a.date?a:{...a,budgetDate,transitionCarry:true}});
  return project({...model,allocations:model.allocations.map(a=>budgetAllocation(model,a)),actuals},scope);
 }
 function budgetOverlaps(model,a,b){
  if(a.categoryId!==b.categoryId||a.currency!==b.currency)return false;
  return overlaps(budgetBounds(model,a),budgetBounds(model,b));
 }
 function createAssignment(categories,{id,categoryId,date,amount,currency:unit}){
  const c=categories.find(c=>c.id===categoryId);
  if(typeof id!=="string"||!id||!c||c.active===false||c.budgetable===false||!kinds.includes(c.type)||!valid(date))throw Error("Asignación inválida");
  return {id,categoryId,date,minor:money(amount),currency:currency(unit),source:"dated"};
 }
 function adaptLegacy(raw,{endFor,allocationState,contributionCategory}){
  if(!raw||typeof endFor!=="function"||typeof allocationState!=="function"||typeof contributionCategory!=="function")throw Error("Adaptadores requeridos");
  const list=k=>{if(raw[k]===undefined)return [];if(!Array.isArray(raw[k]))throw Error("Lista inválida: "+k);return raw[k]};
  const unique=(arr,get)=>{const seen=new Set();for(const a of arr){const id=get(a);if(typeof id!=="string"||!id||seen.has(id))throw Error("Identificador inválido o duplicado");seen.add(id)}};
  const cats=list("categories");unique(cats,c=>c.id);const categories=cats.map(c=>({id:c.id,name:c.name,type:c.type,active:c.active!==false,budgetable:c.budgetable!==false}));
  const cat=new Map(categories.map(c=>[c.id,c]));
  const periods=list("periods").map(p=>({p,key:key(p),start:p.date,end:endFor(p),financialMonth:p.budgetMonth})).sort((a,b)=>a.start.localeCompare(b.start));
  unique(periods,p=>p.key);for(let i=0;i<periods.length;i++){const p=periods[i];if(!validRange(p)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.financialMonth)||i&&overlaps(periods[i-1],p))throw Error("Períodos históricos inválidos")}
  const byKey=new Map(periods.map(p=>[p.key,p])),weeks=list("v15WeeklyAllocations"),issues=[],allocations=[],actuals=[];
  const issue=(code,ref)=>issues.push({code,ref});
  if(list("flexBudgets").length||list("livingBudgets").length)issue("legacy-adjustments-require-reconciliation","V13/V14");
  const checkedWeekRecords=new Set();
  for(const parent of periods){
   const {p,key:periodKey,start,end,financialMonth}=parent;
   for(const [categoryId,amount] of Object.entries(p.categoryBudgets||{})){
    const c=cat.get(categoryId);if(!c||!kinds.includes(c.type))throw Error("Categoría de presupuesto inválida");
    const minor=money(amount),unit=currency(p.categoryBudgetCurrencies?.[categoryId]||"CRC");
    const matches=weeks.filter(w=>w?.periodKey===periodKey&&w.categoryId===categoryId);
    matches.forEach(w=>checkedWeekRecords.add(w));
    const base={categoryId,currency:unit,parentKey:periodKey,financialMonth,source:"legacy",id:JSON.stringify([periodKey,categoryId])};
    if(matches.length){
     let state=null;try{if(matches.length===1&&c.type==="Gasto"&&c.budgetable)state=allocationState({start,end,amount,currency:unit},matches[0])}catch{}
     if(state&&!state.stale&&Array.isArray(state.amounts)&&state.amounts.length===state.weeks.length&&state.amounts.reduce(add,0)===minor&&state.weeks.every(w=>validRange(w)&&included(w,parent))){
      state.weeks.forEach((w,i)=>{if(state.amounts[i])allocations.push({...base,id:JSON.stringify([base.id,i]),start:w.start,end:w.end,minor:state.amounts[i],source:"legacy-week-block"})});continue;
     }
     issue("weekly-distribution-review",base.id);
     if(minor)allocations.push({...base,start,end,minor});continue;
    }
    if(!minor)continue;
    const dates=p.categoryBudgetScheduledDates?.[categoryId];
    // The old app stores dates for automatic income, not amounts per occurrence.
    // Only one unambiguous stored date can carry the entire amount.
    if(c.type==="Ingreso"&&p.categoryBudgetSources?.[categoryId]==="auto"&&Array.isArray(dates)&&dates.length===1&&valid(dates[0])&&inside(parent,dates[0]))allocations.push({...base,date:dates[0],minor,source:"legacy-scheduled-income"});
    else{if(dates!==undefined&&(!Array.isArray(dates)||dates.length!==1||!valid(dates[0])||!inside(parent,dates[0])))issue("scheduled-amount-not-resolved",base.id);allocations.push({...base,start,end,minor})}
   }
  }
  for(const w of weeks)if(!checkedWeekRecords.has(w))issue("orphan-week-distribution",JSON.stringify([w?.periodKey,w?.categoryId]));
  const movementRows=list("movements");unique(movementRows,m=>m.id);
  const reserves=list("reserveMovements");unique(reserves,m=>m.id);
  const synthetic=(id,name,type)=>{if(cat.has(id)){if(!cat.get(id).synthetic)throw Error("ID de categoría reservado");return id}const c={id,name,type,synthetic:true};cat.set(id,c);categories.push(c);return id};
  // Historical V16 can contain an explicitly linked expense in a debt-payment category, or vice versa.
  // Preserve the original category ID AND movement type: both are outflows, not an income conversion.
  // Missing IDs, ambiguous names and income/outflow mismatches remain review blockers.
  const categoryFor=(m,type)=>{if(m.categoryId){const existing=cat.get(m.categoryId);const outflow=k=>k==="Gasto"||k==="Pago deuda";if(existing&&!existing.synthetic&&(existing.type===type||outflow(existing.type)&&outflow(type)))return m.categoryId;}if(!m.categoryId){const matches=categories.filter(c=>!c.synthetic&&c.name===m.category&&c.type===type);if(matches.length===1)return matches[0].id}issue("movement-category-review",m.id);return synthetic("@v16:uncategorized:"+type,"Sin categoría",type)};
  const snapshot=m=>({fxBuy:m.fxBuy,fxSell:m.fxSell,fxDate:m.fxDate});
  for(const m of movementRows){
   if(!kinds.includes(m.type))continue; // e.g. cobro: not budget income or expense.
   if(!valid(m.date))throw Error("Fecha de movimiento inválida");
   const unit=currency(m.currency||"CRC"),minor=money(m.amount),parent=byKey.get(m.period);
   if(!parent)issue("movement-period-review",m.id);
   const base={date:m.date,currency:unit,type:m.type,source:"movement",sourceId:m.id,parentKey:parent?.key||null,financialMonth:parent?.financialMonth||null,financed:!!m.financedDebtId,...snapshot(m)};
   if(unit==="USD"&&!(Number.isFinite(m.type==="Ingreso"?m.fxBuy:m.fxSell)&&(m.type==="Ingreso"?m.fxBuy:m.fxSell)>0))issue("historical-fx-review",m.id);
   if(Array.isArray(m.splits)&&m.splits.length){
    const split=m.splits.map(s=>({categoryId:categoryFor({...m,categoryId:s.categoryId,category:null},m.type),minor:money(s.amount)}));
    if(split.reduce((sum,s)=>add(sum,s.minor),0)!==minor)throw Error("División no coincide con el movimiento");
    split.forEach((s,i)=>actuals.push({...base,...s,id:JSON.stringify(["movement",m.id,i])}));
   }else actuals.push({...base,id:JSON.stringify(["movement",m.id]),categoryId:categoryFor(m,m.type),minor});
  }
  for(const t of reserves){
   if(t.type!=="Aporte")continue;
   if(!valid(t.date))throw Error("Fecha de aporte inválida");
   const c=contributionCategory(t),categoryId=cat.get(c)?.type==="Gasto"?c:synthetic("@v16:unlinked-savings","Ahorro sin categoría","Gasto");
   if(c&&!cat.has(c))issue("savings-category-review",t.id);
   const parent=periods.find(p=>inside(p,t.date)),unit=currency(t.currency||"CRC");
   if(unit==="USD"&&!(Number.isFinite(t.fxSell)&&t.fxSell>0))issue("historical-fx-review",t.id);
   actuals.push({id:JSON.stringify(["saving",t.id]),sourceId:t.id,source:"saving",categoryId,date:t.date,currency:unit,minor:money(t.amount),type:"Gasto",parentKey:parent?.key||null,financialMonth:parent?.financialMonth||null,...snapshot(t)});
  }
  return {categories,allocations,actuals,periods:periods.map(({p,...rest})=>rest),issues,...(normalizeLegacyQuincenas?{calendarSlots:Object.fromEntries(periods.flatMap(({p,key})=>{const slot=calendarSlot(p);return slot?[[key,slot]]:[]}))}:{}),...(novemberTransition?{novemberTransition:true}:{})};
 }
 function project(model,scope){
  const calendar=scope.basis==="calendar",financial=scope.basis==="financial";
  if(calendar&&!validRange(scope)||financial&&(!Array.isArray(scope.parentKeys)||new Set(scope.parentKeys).size!==scope.parentKeys.length||scope.parentKeys.some(k=>!model.periods.some(p=>p.key===k)))||!calendar&&!financial)throw Error("Consulta inválida");
  const keys=new Set(scope.parentKeys||[]),cats=new Map(model.categories.map(c=>[c.id,c])),rows=new Map(),pending=[],planned=[],actuals=[];
  const row=(id,unit)=>{if(!cats.has(id))throw Error("Categoría desconocida");const k=JSON.stringify([id,unit]);if(!rows.has(k))rows.set(k,{...cats.get(id),currency:unit,plannedMinor:0,actualMinor:0,savingsMinor:0,pendingMinor:0});return rows.get(k)};
  const ids=new Set();
  for(const a of model.allocations){
   if(ids.has(a.id)||!Number.isSafeInteger(a.minor)||a.minor<0||!cats.has(a.categoryId))throw Error("Asignación inválida o duplicada");ids.add(a.id);currency(a.currency);
   if(a.date?!valid(a.date):!validRange(a))throw Error("Asignación sin fecha válida");
   const known=financial?keys.has(a.parentKey):a.date?inside(scope,a.date):included(a,scope);
   if(known){const r=row(a.categoryId,a.currency);r.plannedMinor=add(r.plannedMinor,a.minor);planned.push(a)}
   else if(calendar&&!a.date&&overlaps(a,scope)){const r=row(a.categoryId,a.currency);r.pendingMinor=add(r.pendingMinor,a.minor);pending.push(a)}
  }
  const actualIds=new Set();for(const a of model.actuals){
   if(actualIds.has(a.id)||!valid(a.date)||!Number.isSafeInteger(a.minor)||a.minor<0)throw Error("Movimiento inválido o duplicado");actualIds.add(a.id);currency(a.currency);
   if(financial?!keys.has(a.parentKey):!inside(scope,a.budgetDate||a.date))continue;
   const r=row(a.categoryId,a.currency);r.actualMinor=add(r.actualMinor,a.minor);if(a.source==="saving")r.savingsMinor=add(r.savingsMinor,a.minor);actuals.push(a);
  }
  const result=[...rows.values()].filter(r=>r.plannedMinor||r.actualMinor||r.pendingMinor).map(r=>({...r,remainingMinor:r.pendingMinor?null:r.plannedMinor-r.actualMinor,status:r.pendingMinor?"pending":!r.plannedMinor&&r.actualMinor?"unplanned":"defined"}));
  const totals={};for(const r of result){const t=totals[r.currency]??={income:{plannedMinor:0,actualMinor:0,pendingMinor:0},outflow:{plannedMinor:0,actualMinor:0,pendingMinor:0}};const bucket=r.type==="Ingreso"?t.income:t.outflow;for(const field of ["plannedMinor","actualMinor","pendingMinor"])bucket[field]=add(bucket[field],r[field])}
  return {rows:result,totals,planned,actuals,pending,complete:pending.length===0&&!model.issues.length,issues:[...model.issues]};
 }
 // Explicit rate for planned valuation; original rate snapshots for actuals. No silent historical fallback.
 function valueCRC(result,rates){
  const rate=(type,r)=>type==="Ingreso"?r.fxBuy:r.fxSell,convert=(a,r)=>{if(a.currency==="CRC")return a.minor;const fx=rate(a.type||result.rows.find(x=>x.id===a.categoryId)?.type,r);if(!Number.isFinite(fx)||fx<=0)return null;const value=Math.round(a.minor*fx);if(!Number.isSafeInteger(value))throw Error("Conversión fuera de rango");return value};
  const values={plannedMinor:0,actualMinor:0,missing:[]};
  for(const [kind,items] of [["plannedMinor",result.planned],["actualMinor",result.actuals]])for(const a of items){const v=convert(a,kind==="plannedMinor"?rates:a);if(v===null)values.missing.push(a.id);else values[kind]=add(values[kind],v)}
  return values;
 }
 return {createAssignment,adaptLegacy,project,valueCRC,enableCalendarQuincenas,enableNovemberTransition,budgetAllocation,budgetBounds,budgetProject,budgetActualDate,budgetOverlaps};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV16Finance;
