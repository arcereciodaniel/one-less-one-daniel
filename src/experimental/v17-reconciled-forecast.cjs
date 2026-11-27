"use strict";
// Explicit dated cash scenario. Never silently match different dates or currencies.
const oneV17Forecast=(()=>{
 const valid=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
 const shift=(d,n)=>new Date(Date.parse(d+"T00:00:00Z")+n*86400000).toISOString().slice(0,10);
 const last=m=>new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5)),0)).toISOString().slice(0,10);
 const add=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))throw Error("Monto fuera de rango");return n};
 const inside=(r,d)=>r.start<=d&&d<=r.end;
 const currencyOK=c=>c==="CRC"||c==="USD";
 // New plans are assigned to a financial period only for comparison, never by mutating historical data.
 function financialComparison(model,month,F){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error("Mes inválido");
  const parentKeys=model.periods.filter(p=>p.financialMonth===month).map(p=>p.key);
  const keys=new Set(parentKeys),assignments=[],unmapped=[];
  for(const a of model.allocations.filter(a=>!a.parentKey&&a.date)){
   const p=model.periods.filter(p=>inside(p,a.date));
   if(p.length!==1){if(a.date.slice(0,7)===month)unmapped.push(a);continue}
   if(keys.has(p[0].key))assignments.push({...a,parentKey:p[0].key});
  }
  const legacy=F.project(model,{basis:"financial",parentKeys});
  const comparison=F.project({...model,allocations:[...model.allocations.filter(a=>a.parentKey),...assignments]},{basis:"financial",parentKeys});
  return {legacy,comparison,assignments,unmapped};
 }
 function forecast(model,asOf,requestedEnd,confirmed,nativeDebt,rates,F){
  if(!valid(asOf)||!valid(requestedEnd))throw Error("Fecha inválida");
  if(requestedEnd<=asOf)return {end:requestedEnd,requestedEnd,partial:true,balance:null,lowest:null,netMinor:null,events:[],points:[],reasons:["no-future-range"],counts:{included:0,pending:0}};
  const end=requestedEnd>shift(asOf,90)?shift(asOf,90):requestedEnd,range={start:shift(asOf,1),end};
  const reasons=new Set(["not-full-liquidity-forecast"]),pending=new Set(),events=[],seen=new Set();
  const mark=(a,code)=>{pending.add(a.id);reasons.add(code)};
  if(end!==requestedEnd)reasons.add("horizon-limited");
  const p=F.project(model,{basis:"calendar",...range});
  const cats=new Map(model.categories.map(c=>[c.id,c]));
  for(const a of [...p.pending,...p.planned.filter(a=>!a.date)])mark(a,"undated-budget");
  const modules=model.modules||{};
  for(const [name,code] of [["projectPlans","project-review"],["collections","collection-review"],["debts","undated-debt"]]){
   for(const x of modules[name]||[]){
    const outstanding=name==="projectPlans"?x.remainingMinor:x.minor;
    if(outstanding>0&&(!x.date||x.date<=end)&&(name!=="debts"||!x.date))mark({id:name+":"+x.id},code);
   }
  }
  if(model.issues.length)reasons.add("historical-review");
  const push=e=>{if(seen.has(e.id)||!Number.isSafeInteger(e.minor)||!valid(e.date)||!inside(range,e.date))throw Error("Flujo inválido o duplicado");seen.add(e.id);if(e.minor)events.push(e)};
  let invalidCash=false;
  for(const c of confirmed){if(!valid(c.date)){invalidCash=true;continue}if(!inside(range,c.date))continue;if(c.missingFX||!Number.isSafeInteger(c.minor)){invalidCash=true;mark(c,"confirmed-fx-review");continue}push({...c,id:"confirmed:"+c.id,kind:"confirmed"})}
  for(const [i,d] of nativeDebt.entries()){if(d.kind!=="debt"||!inside(range,d.date))continue;if(!Number.isFinite(d.amount)||d.amount>=0){invalidCash=true;reasons.add("debt-review");continue}push({id:"debt:"+i,date:d.date,minor:Math.round(d.amount*100),kind:"debt",...(d.debtId&&d.due?{debtId:d.debtId,due:d.due}:{})})}
  const cache=new Map();
  for(const a of p.planned.filter(a=>a.date)){
   const cat=cats.get(a.categoryId),month=a.date.slice(0,7),key=JSON.stringify([a.categoryId,a.currency,month]);
   if(cat?.type==="Pago deuda"){mark(a,"debt-budget-review");continue}
   if(!cache.has(key)){
    const m=F.project(model,{basis:"calendar",start:month+"-01",end:last(month)}),match=x=>x.categoryId===a.categoryId&&x.currency===a.currency;
    const plans=m.planned.filter(x=>match(x)&&x.date),actual=m.actuals.filter(match);
    const planByDate=new Map(),actualByDate=new Map();
    for(const x of plans)planByDate.set(x.date,add(planByDate.get(x.date)||0,x.minor));
    for(const x of actual)actualByDate.set(x.date,add(actualByDate.get(x.date)||0,x.minor));
    // Cross-date and cross-currency matching is not authorized. Withhold uncertain residuals.
    const otherCurrency=m.actuals.some(x=>x.categoryId===a.categoryId&&x.currency!==a.currency&&!m.planned.some(q=>q.categoryId===x.categoryId&&q.currency===x.currency&&q.date===x.date));
    const ambiguous=m.pending.some(match)||m.planned.some(x=>match(x)&&!x.date)||m.issues.length>0||otherCurrency||[...actualByDate].some(([date,v])=>v>(planByDate.get(date)||0));
    const left=new Map(),used=new Map(actualByDate);
    for(const x of plans.sort((x,y)=>x.date.localeCompare(y.date)||x.id.localeCompare(y.id))){const applied=Math.min(x.minor,used.get(x.date)||0);used.set(x.date,(used.get(x.date)||0)-applied);left.set(x.id,x.minor-applied)}
    cache.set(key,{ambiguous,left});
   }
   const row=cache.get(key);
   if(row.ambiguous){mark(a,"date-matching-review");continue}
   const remaining=row.left.get(a.id)||0;if(!remaining)continue;
   if(!cat||!currencyOK(a.currency)||!["Ingreso","Gasto"].includes(cat.type)){mark(a,"category-review");continue}
   const fx=a.currency==="CRC"?1:cat.type==="Ingreso"?rates.buy:rates.sell;
   if(!Number.isFinite(fx)||fx<=0){mark(a,"planned-fx-review");continue}
   push({id:"plan:"+a.id,date:a.date,minor:Math.round(remaining*fx)*(cat.type==="Ingreso"?1:-1),kind:"planned"});
  }
  events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const base=model.operating?.asOf===asOf?model.operating.minor:null;
  if(!Number.isSafeInteger(base))invalidCash=true;
  if(invalidCash||model.issues.length)return {end,requestedEnd,partial:true,balance:null,lowest:null,netMinor:null,events,points:[],reasons:[...reasons],counts:{included:events.length,pending:pending.size}};
  let balance=base,lowest=base,netMinor=0;const points=[{date:asOf,balance}];const grouped=new Map();
  for(const e of events){grouped.set(e.date,add(grouped.get(e.date)||0,e.minor));netMinor=add(netMinor,e.minor)}
  for(const [date,delta] of grouped){balance=add(balance,delta);lowest=Math.min(lowest,balance);points.push({date,balance})}
  return {end,requestedEnd,partial:true,balance,lowest,netMinor,events,points,reasons:[...reasons],counts:{included:events.length,pending:pending.size}};
 }
 return {forecast,financialComparison};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17Forecast;
