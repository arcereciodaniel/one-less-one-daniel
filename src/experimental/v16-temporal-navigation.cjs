"use strict";
// Prototype: one calendar partition, one selection, no ledger writes.
const oneV16Temporal=(()=>{
 const valid=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
 const iso=d=>d.toISOString().slice(0,10);
 const shift=(d,n)=>{if(!valid(d))throw Error("Fecha inválida");const x=new Date(d+"T00:00:00Z");x.setUTCDate(x.getUTCDate()+n);return iso(x)};
 const monthShift=(m,n)=>{if(!valid(m+"-01"))throw Error("Mes inválido");const x=new Date(m+"-01T00:00:00Z");x.setUTCMonth(x.getUTCMonth()+n);return iso(x).slice(0,7)};
 const endMonth=m=>shift(monthShift(m,1)+"-01",-1);
 const contains=(r,d)=>r.start<=d&&d<=r.end;
 const levels=["week","fortnight","month","quarter","half","year"];
 function partitions(month,level){
  if(!valid(month+"-01")||!levels.includes(level))throw Error("Período inválido");
  const first=month+"-01",last=endMonth(month),out=[];
  const add=(start,end)=>out.push({start,end,key:start+"/"+end});
  if(level==="week"){for(let d=first;d<=last;){const wd=new Date(d+"T00:00:00Z").getUTCDay(),sun=shift(d,(7-wd)%7),end=sun<last?sun:last;add(d,end);d=shift(end,1)}}
  else if(level==="fortnight"){add(first,month+"-15");add(month+"-16",last)}
  else{const span={month:1,quarter:3,half:6,year:12}[level],index=Number(month.slice(5))-1,m=monthShift(month,-index%span);add(m+"-01",endMonth(monthShift(m,span-1)))}
  return out;
 }
 function select(state){
  const ranges=partitions(state.month,state.level);
  if(state.scope==="all")return ranges;
  if(state.scope!=="single")throw Error("Vista inválida");
  const chosen=ranges.find(r=>contains(r,state.anchor));return [chosen||ranges[0]];
 }
 function current(level,today){if(!valid(today))throw Error("Fecha inválida");return {month:today.slice(0,7),level,scope:"single",anchor:today}}
 function changeLevel(s,level){if(!levels.includes(level))throw Error("Vista inválida");return {...s,level}}
 function changeMonth(s,month){const rs=partitions(month,s.level),day=Number(s.anchor.slice(8)),anchor=month+"-"+String(Math.min(day,Number(endMonth(month).slice(8)))).padStart(2,"0");return {...s,month,anchor}}
 function navigate(s,step){
  if(![-1,1].includes(step))throw Error("Dirección inválida");
  const rs=partitions(s.month,s.level);
  if(s.scope==="single"&&rs.length>1){const i=rs.findIndex(r=>contains(r,s.anchor)),target=rs[i+step];if(target)return {...s,anchor:target.start};const month=monthShift(s.month,step),next=partitions(month,s.level);return {...s,month,anchor:(step<0?next.at(-1):next[0]).start}}
  const span=s.scope==="all"||["week","fortnight","month"].includes(s.level)?1:{quarter:3,half:6,year:12}[s.level];return changeMonth(s,monthShift(s.month,step*span));
 }
 function project(ledger,range){
  const cats=new Map(ledger.categories.map(c=>[c.id,c])),rows=new Map(),pending=[];
  const row=id=>{if(!cats.has(id))throw Error("Categoría desconocida");if(!rows.has(id))rows.set(id,{...cats.get(id),planned:0,actual:0});return rows.get(id)};
  const checked=new Set();for(const a of ledger.allocations){if(checked.has(a.id)||!Number.isSafeInteger(a.amount)||a.amount<0)throw Error("Asignación inválida");checked.add(a.id);if(a.date&&valid(a.date)){if(contains(range,a.date))row(a.categoryId).planned+=a.amount}else if(!a.date&&valid(a.start)&&valid(a.end)&&a.start<=a.end){if(a.start>=range.start&&a.end<=range.end)row(a.categoryId).planned+=a.amount;else if(a.start<=range.end&&a.end>=range.start)pending.push({...a})}else throw Error("Fecha de asignación inválida")}
  const movements=ledger.movements.filter(m=>contains(range,m.date));const seen=new Set();
  for(const m of movements){if(seen.has(m.id)||!Number.isSafeInteger(m.amount)||m.amount<0)throw Error("Movimiento inválido");seen.add(m.id);row(m.categoryId).actual+=m.amount}
  const all=[...rows.values()].filter(r=>r.planned||r.actual).map(r=>({...r,remaining:r.planned-r.actual,unplanned:r.planned===0&&r.actual>0&&!pending.some(a=>a.categoryId===r.id)}));
  const total=kind=>all.filter(r=>(r.type==="Ingreso")===(kind==="income")).reduce((s,r)=>({planned:s.planned+r.planned,actual:s.actual+r.actual}),{planned:0,actual:0});
  return {rows:all,movements,pending,income:total("income"),outflow:total("outflow")};
 }
 return {levels,partitions,contains,select,current,changeLevel,changeMonth,navigate,project,monthShift};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV16Temporal;
