"use strict";
const oneV17Operations=(()=>{
 function movements(raw,range){return (raw.movements||[]).filter(m=>m.date>=range.start&&m.date<=range.end).slice().sort((a,b)=>b.date.localeCompare(a.date)||(b.seq||0)-(a.seq||0))}
 // Explicitly partial cash forecast. The native debt scheduler already nets recorded future payments.
 // Do not include any budgeted debt or project/receivable commitments a second time.
 function liquidity(scenario,baseMinor,debtItems,asOf,end){
  if(scenario.netMinor===null)return null;
  if(!Number.isSafeInteger(baseMinor))throw Error("Saldo inválido");
  const events=scenario.events.slice();
  for(const [i,d] of debtItems.entries())if(d.kind==="debt"&&d.date>asOf&&d.date<=end&&Number.isFinite(d.amount)&&d.amount<0)events.push({id:"native-debt:"+i,date:d.date,minor:Math.round(d.amount*100),kind:"debt"});
  events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  let balance=baseMinor,lowest=baseMinor;const byDate=new Map();for(const e of events)byDate.set(e.date,(byDate.get(e.date)||0)+e.minor);
  const points=[{date:asOf,balance}];for(const [date,delta] of byDate){balance+=delta;if(!Number.isSafeInteger(balance))throw Error("Saldo fuera de rango");lowest=Math.min(lowest,balance);points.push({date,balance})}
  return {partial:true,balance,lowest,points,events,netMinor:balance-baseMinor};
 }
 return {movements,liquidity};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17Operations;
