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
  // Native load normalizes legacy records in memory. Persist only the overlay on
  // the exact on-disk ledger, not incidental normalization of original records.
  const disk=JSON.parse(expected);
  if(!disk||typeof disk!=="object"||Array.isArray(disk)||JSON.stringify(disk[P.FIELD])!==JSON.stringify(raw[P.FIELD]))throw Error("La copia guardada cambió; recargá antes de continuar.");
  const nextDisk={...disk,[P.FIELD]:clone(next[P.FIELD])};
  const stored=P.persist(io,expected,nextDisk);
  return {raw:clone(next),stored};
 }
 // Value in the original app's canonical CRC, using historical buy/sell
 // for actuals and today's buy/sell for plans. Presentation in USD uses the
 // current reference rate, exactly as V16 did. Round only after aggregation.
 function value(items,rates,display,planned,typeFor){
  if(!["CRC","USD"].includes(display))throw Error("Moneda inválida");
  const divisor=display==="USD"?(rates.buy+rates.sell)/2:1;
  if(!Number.isFinite(divisor)||divisor<=0)return null;
  let total=0;for(const a of items){
   const type=planned?typeFor(a.categoryId):a.type;
   const fx=a.currency==="CRC"?1:planned?(type==="Ingreso"?rates.buy:rates.sell):(type==="Ingreso"?a.fxBuy:a.fxSell);
   if(!Number.isFinite(fx)||fx<=0)return null;
   total+=a.minor*fx;
  }
  const v=Math.round(total/divisor);if(!safe(v))throw Error("Monto fuera de rango");return v;
 }
 function categoryRows(p,rates,display){
  const categories=new Map(p.rows.map(r=>[r.id,r])),typeFor=id=>categories.get(id)?.type;
  return [...categories.values()].map(c=>{
   const match=a=>a.categoryId===c.id,plans=p.planned.filter(match),actuals=p.actuals.filter(match),pending=p.pending.filter(match);
   const plannedMinor=value(plans,rates,display,true,typeFor),actualMinor=value(actuals,rates,display,false,typeFor),pendingMinor=value(pending,rates,display,true,typeFor);
   return {...c,currency:display,plannedMinor,actualMinor,pendingMinor,pending:pending.length>0,missing:[plannedMinor,actualMinor,pendingMinor].some(n=>n===null),remainingMinor:pending.length||p.issues.length||plannedMinor===null||actualMinor===null?null:plannedMinor-actualMinor,hasPlan:plans.some(a=>a.minor>0)};
  });
 }
 function totals(p,rates,display,kind){
  const typeFor=id=>p.rows.find(r=>r.id===id)?.type,match=a=>kind?typeFor(a.categoryId)===kind:typeFor(a.categoryId)!=="Ingreso";
  const planned=value(p.planned.filter(match),rates,display,true,typeFor),actual=value(p.actuals.filter(match),rates,display,false,typeFor),pending=p.pending.some(match)||p.issues.length>0,missing=planned===null||actual===null;
  return {planned,actual,pending,missing,remaining:pending||missing?null:planned-actual};
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
 return {snapshot,commit,totals,scenario,value,categoryRows};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17Bridge;
