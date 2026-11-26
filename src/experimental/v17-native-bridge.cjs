"use strict";
// Native integration contract: original records remain authoritative, overlays are only planning data.
const oneV17Bridge=(()=>{
 const clone=x=>JSON.parse(JSON.stringify(x));
 const safe=n=>Number.isSafeInteger(n);
 const valid=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
 function snapshot(raw,api,asOf,F,S,P){const base=S.nativeSnapshot(raw,api,asOf,F);return {base,model:P.hydrate(raw,base,F)}}
 function commit({raw,api,asOf,staged,F,S,P,E,io,expected}){
  const {base,model}=snapshot(raw,api,asOf,F,S,P);
  // Revalidate the reviewed transaction against fresh native records and preserve every non-overlay field.
  E.commit(model,staged);
  const prepared=P.prepare(raw,base,staged.command,F,E),next=P.commit(raw,base,prepared,F,E);
  const stored=P.persist(io,expected,next);
  return {raw:clone(next),stored};
 }
 function totals(p,rates,display){
  if(!["CRC","USD"].includes(display))throw Error("Moneda inválida");
  const missing=new Set(),rate=(a,planned)=>a.currency==="CRC"?1:planned?(p.rows.find(r=>r.id===a.categoryId)?.type==="Ingreso"?rates.buy:rates.sell):(a.type==="Ingreso"?a.fxBuy:a.fxSell);
  const divisor=display==="USD"?(rates.buy+rates.sell)/2:1;
  const out={planned:0,actual:0,pending:false,missing:false};
  if(!Number.isFinite(divisor)||divisor<=0)return {...out,planned:null,actual:null,remaining:null,missing:true};
  for(const [field,items,planned] of [["planned",p.planned,true],["actual",p.actuals,false]]){
   let total=0;for(const a of items){if(p.rows.find(r=>r.id===a.categoryId)?.type==="Ingreso")continue;const fx=rate(a,planned);if(!Number.isFinite(fx)||fx<=0){missing.add(field);continue}total+=a.minor*fx}
   out[field]=missing.has(field)?null:Math.round(total/divisor);
   if(out[field]!==null&&!safe(out[field]))throw Error("Monto fuera de rango");
  }
  out.pending=p.rows.some(r=>r.type!=="Ingreso"&&r.pendingMinor>0)||p.issues.length>0;
  out.missing=missing.size>0;
  out.remaining=out.pending||out.planned===null||out.actual===null?null:out.planned-out.actual;
  return out;
 }
 // A conservative dated scenario, not the native complete liquidity forecast.
 // Confirmed cash flows are taken from native signedMovement/reserveOperatingDelta.
 // Debt/project/receivable commitments and undated plans are never added a second time.
 function scenario(model,asOf,end,confirmed,rates,F,S){
  if(!valid(asOf)||!valid(end)||end<=asOf)return {events:[],partial:true,reasons:["no-future-range"],netMinor:null};
  const range={start:new Date(Date.parse(asOf+"T00:00:00Z")+86400000).toISOString().slice(0,10),end};
  const plan=S.view(model,range,asOf,F).future,reasons=new Set(["not-full-liquidity-forecast"]),events=[];
  if(plan.unresolved.length||plan.undated.length)reasons.add("undated-commitments");
  if(plan.debtCommitments.length||plan.projectPlans.length||plan.receivables.length)reasons.add("separate-commitments");
  for(const e of confirmed){if(valid(e.date)&&e.date>asOf&&e.date<=end&&safe(e.minor)&&e.minor!==0)events.push({...e,kind:"confirmed"})}
  for(const a of plan.next){
   if(a.type==="Pago deuda"){reasons.add("debt-excluded");continue}
   if(a.type==="Ingreso"){
    // Do not guess which of several expected payments an earlier real income covered.
    const month=a.date.slice(0,7),sameMonth=model.actuals.some(x=>x.categoryId===a.categoryId&&x.currency===a.currency&&x.date.slice(0,7)===month);
    if(sameMonth){reasons.add("income-matching-review");continue}
   }
   const fx=a.currency==="CRC"?1:a.type==="Ingreso"?rates.buy:rates.sell;
   if(!Number.isFinite(fx)||fx<=0){reasons.add("missing-fx");continue}
   const minor=Math.round(a.remainingMinor*fx)*(a.type==="Ingreso"?1:-1);
   if(!safe(minor))throw Error("Monto fuera de rango");
   events.push({id:a.id,date:a.date,minor,kind:"planned"});
  }
  events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));const netMinor=events.reduce((s,e)=>{const n=s+e.minor;if(!safe(n))throw Error("Monto fuera de rango");return n},0);
  return {events,partial:true,reasons:[...reasons],netMinor};
 }
 return {snapshot,commit,totals,scenario};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17Bridge;
