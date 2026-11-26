
// Shared V15 read-only query core: same implementation in browser and Node.
const oneV15QueryCore=(()=>{
// V15.1/2: pure experimental query core; no persistence, DOM, FX, or projection side effects.
function validDate(s){return typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s}

function shiftDate(s,n){if(!validDate(s))throw Error("Invalid date");const d=new Date(s+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}

function validMonth(s){return typeof s==="string"&&/^\d{4}-(0[1-9]|1[0-2])$/.test(s)&&validDate(s+"-01")}

function shiftMonth(s,n){if(!validMonth(s))throw Error("Invalid budget month");const d=new Date(s+"-01T00:00:00Z");d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7)}

function financialMonths(month,mode){if(!validMonth(month))throw Error("Invalid budget month");const m=Number(month.slice(5)),n={month:1,quarter:3,half:6,year:12}[mode];if(!n)throw Error("Invalid financial mode");const start=shiftMonth(month,-((m-1)%n));return Array.from({length:n},(_,i)=>shiftMonth(start,i))}

function calendarRange(anchor,mode,end){if(!validDate(anchor))throw Error("Invalid anchor");if(mode==="custom"){if(!validDate(end)||end<anchor)throw Error("Invalid range");return {start:anchor,end}}if(mode==="week"){const d=new Date(anchor+"T00:00:00Z"),start=shiftDate(anchor,-((d.getUTCDay()+6)%7));return {start,end:shiftDate(start,6)}}const months=financialMonths(anchor.slice(0,7),mode);return {start:months[0]+"-01",end:shiftDate(shiftMonth(months.at(-1),1)+"-01",-1)}}

function minor(value){if(typeof value!=="number"||!Number.isFinite(value)||value<0||!Number.isSafeInteger(Math.round(value*100))||Math.abs(value*100-Math.round(value*100))>1e-5)throw Error("Invalid amount; review source");return Math.round(value*100)}

function keyFor(p){return p.key||((p.quarter&&p.n)?`${p.quarter}-${p.n}`:"")}

function auditLedger(raw){if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("Invalid ledger");const names=["periods","movements","categories","debts","reserves","reserveMovements","sharedCharges","sharedChargeGroups","reconciliations","projects","projectLinks","projectPlans","flexBudgets","livingBudgets"],counts={},issues=[];for(const name of names){const rows=raw[name];counts[name]=Array.isArray(rows)?rows.length:0;if(rows!==undefined&&!Array.isArray(rows))issues.push({code:"invalid-list",field:name});if(["flexBudgets","livingBudgets"].includes(name))continue;const seen=new Set();for(const r of Array.isArray(rows)?rows:[]){const k=r&&typeof r==="object"?(name==="periods"?keyFor(r):r.id):null;if(!k){issues.push({code:"missing-id",field:name});continue}if(seen.has(k))issues.push({code:"duplicate-id",field:name,id:k});seen.add(k)}}const slots=new Set(),categories=new Set((Array.isArray(raw.categories)?raw.categories:[]).map(c=>c?.id));for(const p of Array.isArray(raw.periods)?raw.periods:[]){if(!p||typeof p!=="object")continue;const k=keyFor(p),slot=`${p.budgetMonth}|${p.fortnight}`;if(!validMonth(p.budgetMonth)||![1,2].includes(Number(p.fortnight))||!validDate(p.date))issues.push({code:"invalid-period",id:k});if(slots.has(slot))issues.push({code:"duplicate-slot",id:k});slots.add(slot);for(const [cid,amount] of Object.entries(p.categoryBudgets||{})){if(!categories.has(cid))issues.push({code:"unknown-category",id:k,categoryId:cid});try{minor(amount)}catch{issues.push({code:"invalid-budget-amount",id:k,categoryId:cid})}const currency=p.categoryBudgetCurrencies?.[cid]||"CRC";if(!["CRC","USD"].includes(currency))issues.push({code:"invalid-currency",id:k,categoryId:cid})}}return {counts,issues,requiresReconciliation:counts.flexBudgets>0||counts.livingBudgets>0,legacyOnly: true}}

function queryBudget(raw,scope,endFor){if(!scope||!["financial","calendar"].includes(scope.basis)||typeof endFor!=="function")throw Error("Explicit basis and original period end resolver required");const audit=auditLedger(raw);if(audit.issues.some(x=>["periods","categories"].includes(x.field)||["invalid-period","duplicate-slot","unknown-category","invalid-budget-amount","invalid-currency"].includes(x.code)))throw Error("Review invalid budget records before querying");const rows=(raw.periods||[]).map(p=>{const end=endFor(p);if(!validDate(end)||end<p.date)throw Error("Invalid original period end");return {p,key:keyFor(p),start:p.date,end}}).sort((a,b)=>a.start.localeCompare(b.start));for(let i=1;i<rows.length;i++)if(rows[i].start<=rows[i-1].end)throw Error("Overlapping original periods");let selected=[],range=null,missingSlots=[];if(scope.basis==="financial"){if(scope.mode==="fortnight"){selected=rows.filter(r=>r.key===scope.key);if(selected.length!==1)throw Error("Unknown financial period")}else{const months=financialMonths(scope.month,scope.mode);selected=rows.filter(r=>months.includes(r.p.budgetMonth));for(const m of months)for(const q of [1,2])if(!selected.some(r=>r.p.budgetMonth===m&&Number(r.p.fortnight)===q))missingSlots.push(`${m}-Q${q}`)}if(selected.length)range={start:selected[0].start,end:selected.at(-1).end}}else{range=calendarRange(scope.anchor,scope.mode,scope.end);selected=rows.filter(r=>r.start<=range.end&&r.end>=range.start)}const whole=selected.filter(r=>scope.basis==="financial"||r.start>=range.start&&r.end<=range.end),partial=selected.filter(r=>!whole.includes(r));let gaps=[];if(range){let cursor=range.start;for(const r of selected){const start=r.start<range.start?range.start:r.start,end=r.end>range.end?range.end:r.end;if(start>cursor)gaps.push({start:cursor,end:shiftDate(start,-1)});if(end>=cursor)cursor=shiftDate(end,1)}if(cursor<=range.end)gaps.push({start:cursor,end:range.end})}const byCategory=new Map();for(const r of whole)for(const [cid,amount] of Object.entries(r.p.categoryBudgets||{})){const currency=r.p.categoryBudgetCurrencies?.[cid]||"CRC",k=JSON.stringify([cid,currency]);const cents=(byCategory.get(k)?.minor||0)+minor(amount);if(!Number.isSafeInteger(cents))throw Error("Unsafe aggregate");byCategory.set(k,{categoryId:cid,currency,minor:cents})}const knownSubtotal=[...byCategory.values()].sort((a,b)=>a.categoryId.localeCompare(b.categoryId)||a.currency.localeCompare(b.currency));const complete=selected.length>0&&!partial.length&&!missingSlots.length&&!gaps.length;return {basis:scope.basis,mode:scope.mode,range,coverage:complete?"complete":"partial",periodKeys:selected.map(r=>r.key),partialPeriods:partial.map(({key,start,end})=>({key,start,end})),missingSlots,gaps,knownSubtotal,totals:complete?knownSubtotal.map(x=>({...x})):null,requiresReconciliation:audit.requiresReconciliation}}
// V15.4: partition a parent's inclusive dates without creating budget allocations.
function weeklyBreakdown(start,end,events){
 if(!validDate(start)||!validDate(end)||end<start||!Array.isArray(events))throw Error("Invalid weekly breakdown");
 const weeks=[];
 for(let cursor=start;cursor<=end;){
  const week=calendarRange(cursor,"week"),last=week.end<end?week.end:end;
  weeks.push({start:cursor,end:last,planned:null,events:[]});
  if(weeks.length>530)throw Error("Unexpectedly long original period");
  cursor=shiftDate(last,1);
 }
 const outside=[];
 for(const event of events){
  if(!event||!Number.isFinite(event.amountCRC))throw Error("Invalid actual event");
  const target=validDate(event.date)?weeks.find(w=>w.start<=event.date&&event.date<=w.end):null;
  (target?target.events:outside).push({...event});
 }
 return {weeks,outside};
}
// V15.5: allocations are integer minor units, scoped to an original parent.
function allocateWeighted(total,weights){
 if(!Number.isSafeInteger(total)||total<0||!weights.length||weights.some(w=>!Number.isSafeInteger(w)||w<0))throw Error("Invalid allocation");
 const sum=weights.reduce((s,w)=>s+BigInt(w),0n),den=sum||BigInt(weights.length);
 const rows=weights.map((w,i)=>{const n=BigInt(total)*(sum?BigInt(w):1n);return {i,value:Number(n/den),remainder:n%den}});
 let left=total-rows.reduce((s,r)=>s+r.value,0);
 for(const r of [...rows].sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1)){if(left<=0)break;r.value++;left--}
 return rows.map(r=>r.value);
}
function allocationState(parent,record){
 if(!parent||!["CRC","USD"].includes(parent.currency))throw Error("Invalid parent currency");
 const total=minor(parent.amount),weeks=weeklyBreakdown(parent.start,parent.end,[]).weeks.map(w=>({start:w.start,end:w.end}));
 if(weeks.length<2||weeks.length>8)throw Error("Unexpected weekly allocation span");
 if(record){
  const valid=record.start===parent.start&&record.end===parent.end&&record.currency===parent.currency&&record.parentMinor===total&&Array.isArray(record.amounts)&&record.amounts.length===weeks.length&&record.amounts.every(v=>Number.isSafeInteger(v)&&v>=0)&&record.amounts.reduce((s,v)=>s+v,0)===total;
  if(!valid)return {weeks,total,stale:true,amounts:null};
  return {weeks,total,stale:false,amounts:record.amounts.slice()};
 }
 return {weeks,total,stale:false,amounts:null};
}
function allocationPreview(parent,record,index,amount,mode){
 const state=allocationState(parent,record);
 if(state.stale)throw Error("Parent changed; review before replacing allocation");
 if(!Number.isInteger(index)||index<0||index>=state.weeks.length||!["maintain","increase"].includes(mode))throw Error("Invalid allocation choice");
 const base=state.amounts||allocateWeighted(state.total,state.weeks.map(()=>1)),target=minor(amount),next=base.slice();
 if(mode==="maintain"){
  if(target>state.total)throw Error("Amount exceeds parent budget");
  const other=allocateWeighted(state.total-target,base.filter((_,i)=>i!==index));
  let j=0;for(let i=0;i<next.length;i++)next[i]=i===index?target:other[j++];
 }else{
  if(target<base[index])throw Error("Increase cannot reduce total");
  next[index]=target;
 }
 const total=next.reduce((s,n)=>s+n,0);
 if(!Number.isSafeInteger(total))throw Error("Unsafe total");
 return {weeks:state.weeks,base,next,oldTotal:state.total,total,currency:parent.currency,start:parent.start,end:parent.end};
}
return {auditLedger,queryBudget,calendarRange,weeklyBreakdown,allocationState,allocationPreview};

})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV15QueryCore;
