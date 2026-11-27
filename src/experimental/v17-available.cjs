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
  const groups=new Map();
  for(const a of model.allocations.filter(a=>!a.parentKey&&(a.date||a.source==="range")&&cats.get(a.categoryId)?.type!=="Ingreso")){
   const from=a.date||a.start,to=a.date||a.end;
   const slots=model.periods.filter(p=>p.start<=from&&to<=p.end);
   if(slots.length!==1){
    if(to>=periods.map(p=>p.start).sort()[0]&&from<=native.horizon)return fail("Hay presupuesto de un intervalo que cruza períodos de pago; falta determinar su efecto en el disponible.");
    continue;
   }
   if(!periods.some(p=>p.key===slots[0].key))continue;
   if(!["Gasto","Pago deuda"].includes(cats.get(a.categoryId)?.type)||!["CRC","USD"].includes(a.currency)||!Number.isSafeInteger(a.minor)||a.minor<0)return fail("Asignación por revisar");
   const fx=a.currency==="CRC"?1:rates.sell;
   if(!Number.isFinite(fx)||fx<=0)return fail("Tipo de cambio pendiente");
   const k=JSON.stringify([slots[0].key,a.categoryId]),g=groups.get(k)||{periodKey:slots[0].key,categoryId:a.categoryId,minor:0};
   g.minor=add(g.minor,cents(a.minor*fx/100));groups.set(k,g);
  }
  if(!native.hasPlan&&!groups.size)return fail("Sin presupuesto vigente");
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
   const total=add(pending,increment);
   return {ready:true,availableMinor:add(balance,-total),pendingMinor:total,incrementMinor:increment,horizon:native.horizon,reason:null};
  }catch{return fail("Importes por revisar")}
 }
 return {calculate};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17Available;
