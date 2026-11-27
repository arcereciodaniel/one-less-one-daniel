"use strict";
// Extend the original available estimate, never the actual operating balance.
// All new budget assignments are mapped to a unique original salary period for this calculation only.
const oneV17Available=(()=>{
 const cents=n=>{if(!Number.isFinite(n)||!Number.isSafeInteger(Math.round(n*100)))throw Error("Monto inválido");return Math.round(n*100)};
 const add=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))throw Error("Monto fuera de rango");return n};
 function calculate(model,asOf,native,rowsByPeriod,rates){
  const fail=reason=>({ready:false,reason,availableMinor:null,pendingMinor:null,incrementMinor:null,horizon:native?.horizon||null});
  if(!native?.hasBalance||!native.horizon||!native.month||model.issues?.length)return fail("Datos pendientes de revisión");
  const periods=model.periods.filter(p=>p.financialMonth===native.month&&p.end>=asOf);
  if(!periods.length||periods.filter(p=>p.start<=asOf&&asOf<=p.end).length!==1||periods.map(p=>p.end).sort().at(-1)!==native.horizon)return fail("Período financiero sin conciliar");
  const cats=new Map(model.categories.map(c=>[c.id,c]));
  const groups=new Map(),ranges=[];
  for(const a of model.allocations.filter(a=>!a.parentKey&&(a.date||a.source==="range")&&cats.get(a.categoryId)?.type!=="Ingreso")){
   if(a.source==="range"){
    if(a.start<=native.horizon&&a.end>=asOf)ranges.push(a);
    continue;
   }
   const from=a.date,to=a.date;
   const slots=model.periods.filter(p=>p.start<=from&&to<=p.end);
   if(slots.length!==1){
    if(to>=periods.map(p=>p.start).sort()[0]&&from<=native.horizon)return fail("Asignación sin período financiero único");
    continue;
   }
   if(!periods.some(p=>p.key===slots[0].key))continue;
   if(!["Gasto","Pago deuda"].includes(cats.get(a.categoryId)?.type)||!["CRC","USD"].includes(a.currency)||!Number.isSafeInteger(a.minor)||a.minor<0)return fail("Asignación por revisar");
   const fx=a.currency==="CRC"?1:rates.sell;
   if(!Number.isFinite(fx)||fx<=0)return fail("Tipo de cambio pendiente");
   const k=JSON.stringify([slots[0].key,a.categoryId]),g=groups.get(k)||{periodKey:slots[0].key,categoryId:a.categoryId,minor:0};
   g.minor=add(g.minor,cents(a.minor*fx/100));groups.set(k,g);
  }
  if(!native.hasPlan&&!groups.size&&!ranges.length)return fail("Sin presupuesto vigente");
  try{
   const pending=cents(native.pending),balance=cents(native.balance);
   if(model.operating?.asOf!==asOf||model.operating.minor!==balance||pending<0)return fail("Saldo original por revisar");
   const rows=periods.flatMap(p=>(rowsByPeriod[p.key]||[]).map(r=>({...r,periodKey:p.key})));
   const expected=rows.reduce((s,r)=>s+r.remainingCRC,0);
   if(cents(expected)!==pending)return fail("Presupuesto original por revisar");
   let increment=0;
   for(const g of groups.values()){
    const matches=rows.filter(r=>r.periodKey===g.periodKey&&r.id===g.categoryId);
    if(matches.length!==1)return fail("Categoría sin conciliación");
    const r=matches[0],planned=cents(r.plannedCRC),used=add(cents(r.spentCRC),cents(r.savingsCRC));
    if(planned<0||used<0)return fail("Importes originales por revisar");
    // Apply original execution once to the combined plan. Historical distributions do not change the parent total.
    const prior=Math.max(0,planned-used),combined=Math.max(0,add(planned,g.minor)-used);
    increment=add(increment,combined-prior);
   }
   // A flexible interval is an envelope, not a scheduled payment. Reserve the
   // outstanding amount if it overlaps the remaining salary horizon, even if it
   // ends later. Never allocate it to an arbitrary date or spend the same actual twice.
   let rangePendingMinor=0,rangeConservative=false;
   for(const a of ranges){
    if(!["Gasto","Pago deuda"].includes(cats.get(a.categoryId)?.type)||!["CRC","USD"].includes(a.currency)||!Number.isSafeInteger(a.minor)||a.minor<=0||!Array.isArray(model.actuals))return fail("Asignación por revisar");
    const fx=a.currency==="CRC"?1:rates.sell;if(!Number.isFinite(fx)||fx<=0)return fail("Tipo de cambio pendiente");
    let used=0;
    for(const x of model.actuals.filter(x=>x.categoryId===a.categoryId&&x.currency===a.currency&&x.date>=a.start&&x.date<=a.end&&x.date<=asOf)){
     const slot=periods.find(p=>p.key===x.parentKey||p.start<=x.date&&x.date<=p.end);
     const original=slot&&rows.find(r=>r.periodKey===slot.key&&r.id===a.categoryId);
     const dated=slot&&groups.get(JSON.stringify([slot.key,a.categoryId]));
     if(slot&&(original?.plannedCRC>0||dated?.minor>0)){rangeConservative=true;continue}
     if(!Number.isSafeInteger(x.minor)||x.minor<0)return fail("Importes por revisar");
     used=add(used,x.minor);
    }
    if(a.end>native.horizon)rangeConservative=true;
    rangePendingMinor=add(rangePendingMinor,cents(Math.max(0,a.minor-used)*fx/100));
   }
   increment=add(increment,rangePendingMinor);
   const total=add(pending,increment);
   return {ready:true,availableMinor:add(balance,-total),pendingMinor:total,incrementMinor:increment,rangePendingMinor,rangeConservative,horizon:native.horizon,reason:null};
  }catch{return fail("Importes por revisar")}
 }
 return {calculate};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17Available;
