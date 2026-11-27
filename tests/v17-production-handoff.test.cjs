"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),H=require("../src/experimental/v17-production-handoff.cjs"),M=require("../src/experimental/v17-migration-rehearsal.cjs"),B=require("../scripts/build-v17-production-handoff.cjs");
test("handoff requires legacy disconnected, exact original bytes and a private V17 ledger",()=>{
 const source=JSON.stringify({version:6.2,periods:[],movements:[],debts:[],categories:[],settings:{}}),rows=new Map([[H.LEGACY,source]]),io={read:k=>rows.get(k)??null};
 rows.set(H.PREFS,"{}");assert.throws(()=>H.source(io),/Desvinculá/);rows.delete(H.PREFS);assert.equal(H.source(io),source);
 assert.throws(()=>H.assertActive(io,M),/activá/);rows.set(H.SOURCE,source);rows.set(H.ACTIVE,JSON.stringify({...JSON.parse(source),[M.FIELD]:{format:"v17-private-lab-v1",importDate:"2026-11-26"}}));assert(H.assertActive(io,M));
 rows.set(H.LEGACY,source+" ");assert.throws(()=>H.assertActive(io,M),/cambió/);rows.set(H.LEGACY,source);rows.set(H.PREFS,"{}");assert.throws(()=>H.assertActive(io,M),/Desvinculá/);
});
test("production candidate uses distinct key and exact origin, never automatically syncs",()=>{
 assert(H.locationAllowed(H.ORIGIN,H.PATH));assert(!H.locationAllowed(H.ORIGIN,"/one-less-one-daniel/"));assert(!H.locationAllowed("https://evil.invalid",H.PATH));
 const h=B.buildCandidate();assert(h.includes(H.ORIGIN));assert(h.includes(H.PATH));assert(h.includes(H.PREFIX));assert(h.includes(B.ENDPOINT));assert(!h.includes("one-less-one-mobile-v17-staging.one-less-one-rastro.workers.dev"));assert(h.includes("v17ProductionMobileReceipts"));
 const {JSDOM}=require("jsdom"),d=new JSDOM(h,{url:"https://evil.invalid/",runScripts:"dangerously"});try{assert.equal(d.window.localStorage.length,0);assert.match(d.window.document.body.textContent,/Ruta de activación no autorizada/)}finally{d.window.close()}
});

test("local migration rehearses actual UI and blocks production transport on changed V16",async()=>{
 const {JSDOM,VirtualConsole}=require("jsdom"),pre=require("../scripts/build-v17-prerelease.cjs"),calls=[],errors=[];
 const tick=()=>new Promise(r=>setTimeout(r,60));let lockAvailable=true;
 const boot=(html,entries={})=>{
  const vc=new VirtualConsole();vc.on("jsdomError",e=>{if(!/navigation \(except hash changes\)/.test(e.message))errors.push(e.message)});vc.on("error",e=>errors.push(String(e)));
  return new JSDOM(html,{url:H.ORIGIN+H.PATH,runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};
   w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(_,k)=>k==="measureText"?()=>({width:80}):()=>{}});
   const schedule=w.setTimeout.bind(w);w.setTimeout=(fn,delay,...args)=>delay===400?0:schedule(fn,delay,...args); // Focus is triggered explicitly; isolate initial background poll from assertion timing.
   w.confirm=()=>true;w.alert=x=>errors.push(String(x));w.prompt=()=>null;Object.defineProperty(w.navigator,"locks",{value:{request:async(name,opts,callback)=>{assert.equal(name,"olo-v17-daniel-mobile-sync");assert.equal(opts.ifAvailable,true);return callback(lockAvailable?{}:null)}}});
   w.fetch=async(url,opt)=>{calls.push({url,method:opt?.method});return {ok:true,json:async()=>url.endsWith("/api/health")?{ok:true,service:"One Less One Mobile",version:1}:url.endsWith("/api/inbox")?{items:[]}:{ok:true}}};
   for(const [k,v] of Object.entries(entries))w.localStorage.setItem(k,v);
  }});
 };
 const fixture=boot(pre.buildCandidate());let source;
 try{const raw=JSON.parse(fixture.window.localStorage.getItem("rastro_lab_v17_prerelease_data_v1"));const [g,p]=raw.movements;const expense=g.categoryId,debt=p.categoryId;g.categoryId=debt;g.category=p.category;p.categoryId=expense;p.category="Supermercado";raw.movements.push({...g,id:"legacy-cross-third",seq:3,amount:125});raw.movementSeq=3;source=JSON.stringify(raw);assert(source)}finally{await tick();fixture.window.close()}
 const first=boot(B.buildInner(),{[H.LEGACY]:source,[H.PREFS]:"{}"});let active;
 try{
  const w=first.window,g=id=>w.document.getElementById(id);g("rc-integrity").click();g("rc-handoffRead").click();
  assert.match(g("rc-migrationStatus").textContent,/Desvinculá/);assert(g("rc-migrationConfirm").disabled);
  w.localStorage.removeItem(H.PREFS);const bad=JSON.parse(source);bad.movements[0].period="unlinked";w.localStorage.setItem(H.LEGACY,JSON.stringify(bad));const before=w.localStorage.getItem(H.ACTIVE);g("rc-handoffRead").click();assert.match(g("rc-migrationStatus").textContent,/missing-period-link \(1\)/);assert(g("rc-migrationConfirm").disabled);assert.equal(w.localStorage.getItem(H.ACTIVE),before);assert.equal(w.localStorage.getItem(H.SOURCE),null);w.localStorage.setItem(H.LEGACY,source);g("rc-handoffRead").click();assert(!g("rc-migrationConfirm").disabled,g("rc-migrationStatus").textContent);
  g("rc-migrationConfirm").click();active=w.localStorage.getItem(H.ACTIVE);assert(M.isPrivate(JSON.parse(active)));assert.deepEqual(JSON.parse(active).movements,JSON.parse(source).movements);assert.deepEqual(JSON.parse(active).debts,JSON.parse(source).debts);assert.deepEqual(JSON.parse(active).periods,JSON.parse(source).periods);assert.equal(w.localStorage.getItem(H.SOURCE),source);assert.equal(w.localStorage.getItem(H.LEGACY),source);
  assert.equal(calls.length,0);
 }finally{await tick();first.window.close()}
 const second=boot(B.buildInner(),{[H.LEGACY]:source,[H.SOURCE]:source,[H.ACTIVE]:active});
 try{
  const w=second.window,g=id=>w.document.getElementById(id);
  assert.equal(g("view-dashboard").hidden,false);assert(!g("view-dashboard").closest("#v17NativeHost"));assert(!g("expenseChart").closest("#v17NativeHost"));assert(!g("cashChart").closest("#v17NativeHost"));
  assert.equal(w.document.querySelector(".demo-header").hidden,true);assert(w.document.querySelector(".olo-original-header #nav"));assert.equal(g("rc-content").hidden,true);
  const exact=w.localStorage.getItem(H.ACTIVE);
  w.document.querySelector('.olo-original-header [data-view="plan"]').click();assert(g("view-dashboard").hidden);assert(!g("rc-content").hidden);assert.equal(g("rc-title").textContent,"Presupuesto");
  w.document.querySelector('.olo-original-header [data-view="movements"]').click();assert(!g("view-movements").hidden);assert(g("rc-content").hidden);w.document.querySelector('.olo-original-header [data-view="dashboard"]').click();assert(!g("view-dashboard").hidden);
  w.document.querySelector('.olo-original-header [data-theme-choice="light"]').click();assert.equal(w.document.documentElement.dataset.theme,"light");
  w.document.querySelector('.olo-original-header [data-display-currency="USD"]').click();assert.equal(g("rc-displayCurrency").value,"USD");assert.equal(w.localStorage.getItem(H.ACTIVE),exact);
  w.document.querySelector('.olo-original-header [data-display-currency="CRC"]').click();
  g("rc-integrity").click();
  w.localStorage.setItem(H.LEGACY,source+" ");g("rc-mobileStagingKey").value="x".repeat(40);await g("rc-mobileStagingSync").onclick();
  assert.match(g("rc-mobileStagingStatus").textContent,/V16 cambió/);assert.equal(calls.length,0);
  w.localStorage.setItem(H.LEGACY,source);g("rc-mobileStagingKey").value="x".repeat(40);await g("rc-mobileStagingSync").onclick();
  assert.equal(calls.length,3);assert(calls.every(x=>x.url.startsWith(B.ENDPOINT+"/")));assert.equal(w.localStorage.getItem(H.ACTIVE+"_mobile_auto_v1"),null);assert.match(g("rc-mobileStagingStatus").textContent,/0 pendiente/);
  const autoKey=H.ACTIVE+"_mobile_auto_v1";
  g("rc-mobileAuto").checked=true;g("rc-mobileStagingKey").value="x".repeat(40);await g("rc-mobileStagingSync").onclick();
  assert.equal(calls.length,6);assert.equal(w.localStorage.getItem(autoKey),"x".repeat(40));assert.equal(w.localStorage.getItem(H.PREFS),null);
  lockAvailable=false;w.dispatchEvent(new w.Event("focus"));await tick();assert.equal(calls.length,6);
  lockAvailable=true;w.dispatchEvent(new w.Event("focus"));await tick();assert.equal(calls.length,9);
  w.localStorage.setItem(H.LEGACY,source+" ");w.dispatchEvent(new w.Event("focus"));await tick();assert.equal(calls.length,9);
  w.localStorage.setItem(H.LEGACY,source);g("rc-mobileForget").click();assert.equal(w.localStorage.getItem(autoKey),null);assert.equal(g("rc-mobileAuto").checked,false);
  w.dispatchEvent(new w.Event("focus"));await tick();assert.equal(calls.length,9);
  assert.equal(w.localStorage.getItem(H.LEGACY),source);assert.equal(w.localStorage.getItem(H.ACTIVE),exact);assert.deepEqual(errors,[]);
 }finally{await tick();second.window.close()}
});

test("three historical cross-outflow category links retain original category, type, date, money and FX; income mismatch still blocks",()=>{
 const F=require("../src/experimental/v16-financial-assignments.cjs");
 const categories=[{id:"card",name:"Tarjetas de Crédito",type:"Pago deuda"},{id:"other",name:"Otros",type:"Gasto"},{id:"salary",name:"Salario",type:"Ingreso"}];
 const raw={categories,periods:[{key:"P1",date:"2026-08-01",budgetMonth:"2026-08",categoryBudgets:{other:1000,card:100}}],movements:[
  {id:"one",date:"2026-08-03",type:"Gasto",categoryId:"card",category:"Tarjetas de Crédito",amount:25,currency:"USD",fxBuy:490,fxSell:500,fxDate:"2026-08-03",period:"P1",financedDebtId:"card-debt"},
  {id:"two",date:"2026-08-03",type:"Gasto",categoryId:"card",category:"Tarjetas de Crédito",amount:1500,currency:"CRC",period:"P1"},
  {id:"three",date:"2026-08-14",type:"Pago deuda",categoryId:"other",category:"Otros",amount:4000,currency:"CRC",period:"P1",debtId:"loan"}
 ]};
 const before=JSON.stringify(raw),adapter={endFor:()=>"2026-08-31",allocationState:()=>null,contributionCategory:()=>null};
 const m=F.adaptLegacy(raw,adapter);
 assert.deepEqual(m.issues,[]);assert.equal(JSON.stringify(raw),before);
 assert.deepEqual(m.actuals.map(a=>[a.sourceId,a.type,a.categoryId,a.date,a.currency,a.minor]),raw.movements.map(a=>[a.id,a.type,a.categoryId,a.date,a.currency,a.amount*100]));
 assert.equal(m.actuals[0].fxSell,500);assert.equal(m.actuals[0].financed,true);
 const q=F.project(m,{basis:"financial",parentKeys:["P1"]});
 assert.equal(q.totals.CRC.outflow.actualMinor,550000);assert.equal(q.totals.USD.outflow.actualMinor,2500);
 assert.equal(q.totals.CRC.income.actualMinor,0);assert.equal(F.valueCRC(q,{fxBuy:490,fxSell:510}).actualMinor,1800000);
 assert.equal(q.rows.find(r=>r.id==="other").actualMinor,400000);
 const invalid=JSON.parse(before);invalid.movements[0].categoryId="salary";assert(F.adaptLegacy(invalid,adapter).issues.some(x=>x.code==="movement-category-review"));
 invalid.movements[0].categoryId="unknown";assert(F.adaptLegacy(invalid,adapter).issues.some(x=>x.code==="movement-category-review"));
});

test("public entrypoint redirects to V17; original V16 stays byte-identical in archive",()=>{
 const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),P=require("../scripts/build-v17-production-site.cjs"),dir=fs.mkdtempSync(path.join(os.tmpdir(),"olo-native-entry-"));
 try{P.build(dir);assert.match(fs.readFileSync(path.join(dir,"index.html"),"utf8"),/location\.replace\(new URL\("\.\/v17\/"/);assert(fs.readFileSync(path.join(dir,"v16.html")).equals(fs.readFileSync(path.join(__dirname,"../index.html"))));assert(fs.readFileSync(path.join(dir,"lab/index.html")).equals(fs.readFileSync(path.join(__dirname,"../lab/index.html"))))}finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("V17.1 interval budgets persist in the original overlay without invented dates or double counting",()=>{
 const E=require("../src/experimental/v16-assignment-editor.cjs"),P=require("../src/experimental/v16-storage-overlay.cjs"),F=require("../src/experimental/v16-financial-assignments.cjs");
 const raw={movements:[],periods:[],categories:[]},base={categories:[{id:"food",name:"Supermercado",type:"Gasto",active:true,budgetable:true}],allocations:[],actuals:[],issues:[],periods:[]};
 const cmd={kind:"create-range",categoryId:"food",start:"2026-11-01",end:"2026-11-30",amount:100000,currency:"CRC",transactionId:"monthly"};
 const stored=P.commit(raw,base,P.prepare(raw,base,cmd,F,E),F,E),model=P.hydrate(stored,base,F);
 assert.deepEqual(P.bare(stored),raw);assert.equal(model.allocations[0].date,undefined);
 assert.equal(F.project(model,{basis:"calendar",start:"2026-11-01",end:"2026-11-30"}).totals.CRC.outflow.plannedMinor,10000000);
 const week=F.project(model,{basis:"calendar",start:"2026-11-23",end:"2026-11-29"});assert.equal(week.totals.CRC.outflow.plannedMinor,0);assert.equal(week.pending[0].minor,10000000);assert.equal(week.rows[0].remainingMinor,null);
 assert.throws(()=>E.stage(model,{...cmd,start:"2026-11-23",end:"2026-11-29",transactionId:"overlap"}),/Ya existe/);
 const edited=E.stage(model,{...cmd,kind:"edit-range",id:model.allocations[0].id,amount:120000});assert.equal(E.commit(model,edited).allocations[0].minor,12000000);
 assert.equal(E.commit(model,E.stage(model,{kind:"delete",id:model.allocations[0].id,transactionId:"delete"})).allocations.length,0);
});

test("Flexible interval reserve uses actual execution inside its own dates and does not invent a payment date",()=>{
 const V=require("../src/experimental/v17-available.cjs");
 const today="2026-11-26",model={issues:[],operating:{asOf:today,minor:15000000},categories:[{id:"food",type:"Gasto"}],periods:[{key:"P",start:"2026-11-14",end:"2026-11-27",financialMonth:"2026-11"}],allocations:[{source:"range",categoryId:"food",currency:"CRC",start:"2026-11-01",end:"2026-11-30",minor:10000000}],actuals:[{categoryId:"food",currency:"CRC",date:"2026-11-20",parentKey:"P",minor:2000000}]};
 const native={month:"2026-11",horizon:"2026-11-27",balance:150000,pending:0,hasBalance:true,hasPlan:false},rows={P:[{id:"food",plannedCRC:0,spentCRC:20000,savingsCRC:0,remainingCRC:0}]};
 const result=V.calculate(model,today,native,rows,{sell:500});
 assert(result.ready);assert.equal(result.rangePendingMinor,8000000);assert.equal(result.availableMinor,7000000);assert.equal(result.rangeConservative,true);
 rows.P[0].plannedCRC=20000;native.hasPlan=true;assert.equal(V.calculate(model,today,native,rows,{sell:500}).rangePendingMinor,10000000);
 model.allocations[0].end="2026-11-25";assert.equal(V.calculate(model,today,native,rows,{sell:500}).rangePendingMinor,0);
});

test("production remaps both historical quincenas to the reference month with no ledger writes",()=>{
 const F=require("../src/experimental/v16-financial-assignments.cjs"),E=require("../src/experimental/v16-assignment-editor.cjs"),P=require("../src/experimental/v16-storage-overlay.cjs");
 const raw={categories:[{id:"food",name:"Supermercado",type:"Gasto"},{id:"salary",name:"Salario",type:"Ingreso"}],periods:[
 {key:"N1",budgetMonth:"2026-11",fortnight:1,date:"2026-10-28",categoryBudgets:{food:100000,salary:300000},categoryBudgetSources:{salary:"auto"},categoryBudgetScheduledDates:{salary:["2026-10-28"]}},
 {key:"N2",budgetMonth:"2026-11",fortnight:2,date:"2026-11-14",categoryBudgets:{food:150000}},
 {key:"D1",budgetMonth:"2026-12",fortnight:1,date:"2026-11-28",categoryBudgets:{food:99999}},
 {key:"F2",budgetMonth:"2027-02",fortnight:2,date:"2027-02-14",categoryBudgets:{food:50},categoryBudgetCurrencies:{food:"USD"}}
 ],movements:[{id:"m1",period:"N1",date:"2026-10-29",type:"Gasto",categoryId:"food",amount:1000,currency:"CRC"},{id:"m2",period:"N2",date:"2026-11-14",type:"Gasto",categoryId:"food",amount:2000,currency:"CRC"},{id:"m3",period:"D1",date:"2026-11-28",type:"Gasto",categoryId:"food",amount:3000,currency:"CRC"}]};
 const before=JSON.stringify(raw),ends={N1:"2026-11-13",N2:"2026-11-27",D1:"2026-12-13",F2:"2027-02-27"},adapter={endFor:p=>ends[p.key],allocationState:()=>null,contributionCategory:()=>null};
 F.enableCalendarQuincenas();const model=F.adaptLegacy(raw,adapter);
 const q=(start,end,m=model)=>F.budgetProject(m,{basis:"calendar",start,end});
 const a=q("2026-11-01","2026-11-15"),b=q("2026-11-16","2026-11-30"),m=q("2026-11-01","2026-11-30");
 assert.equal(a.totals.CRC.outflow.plannedMinor,10000000);assert.equal(b.totals.CRC.outflow.plannedMinor,15000000);assert.equal(m.totals.CRC.outflow.plannedMinor,25000000);assert.equal(m.pending.length,0);
 assert.equal(a.totals.CRC.income.plannedMinor,30000000);assert.equal(a.totals.CRC.outflow.actualMinor,200000);assert.equal(b.totals.CRC.outflow.actualMinor,300000);
 assert.equal(q("2026-12-01","2026-12-31").totals.CRC.outflow.plannedMinor,9999900);
 assert.equal(q("2027-02-16","2027-02-28").totals.USD.outflow.plannedMinor,5000);
 assert.equal(q("2026-11-23","2026-11-29").pending[0].minor,15000000);
 assert.equal(model.actuals[0].date,"2026-10-29");assert.equal(model.allocations.find(x=>x.source==="legacy-scheduled-income").date,"2026-10-28");
 assert.equal(F.project(model,{basis:"financial",parentKeys:["N1","N2"]}).totals.CRC.outflow.plannedMinor,25000000);
 const historical=model.allocations.find(x=>x.parentKey==="N2"&&x.categoryId==="food");
 const cmd={kind:"distribute",id:historical.id,transactionId:"calendar-distribute",parts:[{date:"2026-11-30",amount:150000}]};
 const stored=P.commit(raw,model,P.prepare(raw,model,cmd,F,E),F,E),hydrated=P.hydrate(stored,model,F);
 assert.deepEqual(P.bare(stored),raw);assert.equal(q("2026-11-16","2026-11-30",hydrated).totals.CRC.outflow.plannedMinor,15000000);
 assert.equal(q("2026-11-28","2026-11-30",hydrated).totals.CRC.outflow.plannedMinor,15000000);
 assert.throws(()=>E.stage(model,{kind:"create-range",categoryId:"food",currency:"CRC",amount:5,start:"2026-11-28",end:"2026-11-30",transactionId:"overlap"}),/histórico|Ya existe/);
 assert.equal(JSON.stringify(raw),before);
});

test("transition audit reconciles every category, month boundary, debt and split without rewriting the ledger",()=>{
 const A=require("../src/experimental/v17-transition-audit.cjs"),F=require("../src/experimental/v16-financial-assignments.cjs");
 const categories=[{id:"food",name:"Supermercado",type:"Gasto"},{id:"loan",name:"Préstamo",type:"Pago deuda"},{id:"card",name:"Tarjetas de crédito",type:"Pago deuda"}],periods=[{key:"N",financialMonth:"2026-11",start:"2026-10-28",end:"2026-11-27"},{key:"D",financialMonth:"2026-12",start:"2026-11-28",end:"2026-12-27"}];
 const item=(id,categoryId,minor,date,parentKey,financialMonth,type="Gasto")=>({id,sourceId:id,categoryId,minor,date,parentKey,financialMonth,type,currency:"CRC",source:"movement"});
 const model={categories,periods,issues:[],calendarSlots:{N:{start:"2026-11-01",end:"2026-11-30"}},allocations:[{id:"p",categoryId:"food",currency:"CRC",minor:10000000,parentKey:"N",source:"legacy",start:"2026-10-28",end:"2026-11-27"}],actuals:[item("f1","food",1000000,"2026-10-29","N","2026-11"),item("f2","food",8525000,"2026-11-15","N","2026-11"),item("f3","food",200000,"2026-11-29","D","2026-12"),item("l","loan",5000000,"2026-10-29","N","2026-11","Pago deuda"),item("c","card",1900000,"2026-11-05","N","2026-11","Pago deuda")]};
 const before=JSON.stringify(model),r=A.inspect(model,"2026-11",F),food=r.rows.find(x=>x.id==="food"),loan=r.rows.find(x=>x.id==="loan");
 assert.equal(food.oldPlan,10000000);assert.equal(food.newPlan,10000000);assert.equal(food.oldActual,9525000);assert.equal(food.newActual,8725000);assert.equal(food.onlyOld,1000000);assert.equal(food.onlyNew,200000);assert.equal(loan.newActual,0);assert.equal(loan.oldActual,5000000);
 const dec=A.inspect(model,"2026-12",F);assert.equal(dec.rows.find(x=>x.id==="food").onlyOld,200000);assert.equal(JSON.stringify(model),before);
});

test("November opening bridge preserves the original linked outflows and income, avoids double count, and leaves December calendar-only",()=>{
 const F=require("../src/experimental/v16-financial-assignments.cjs"),A=require("../src/experimental/v17-transition-audit.cjs");
 const categories=[{id:"food",name:"Food",type:"Gasto"},{id:"loan",name:"Loan",type:"Pago deuda"},{id:"income",name:"Income",type:"Ingreso"}],periods=[
 {key:"N1",financialMonth:"2026-11",start:"2026-10-28",end:"2026-11-13"},{key:"N2",financialMonth:"2026-11",start:"2026-11-14",end:"2026-11-27"},{key:"D1",financialMonth:"2026-12",start:"2026-11-28",end:"2026-12-13"},{key:"J1",financialMonth:"2027-01",start:"2026-12-28",end:"2027-01-13"}];
 const m=(id,categoryId,minor,date,parentKey,financialMonth,currency="CRC")=>({id,sourceId:id,categoryId,minor,date,parentKey,financialMonth,type:categories.find(x=>x.id===categoryId).type,currency,source:"movement",...(currency==="USD"?{fxBuy:490,fxSell:500}:{})});
 const model={novemberTransition:true,calendarSlots:{N1:{start:"2026-11-01",end:"2026-11-15"},N2:{start:"2026-11-16",end:"2026-11-30"},D1:{start:"2026-12-01",end:"2026-12-15"},J1:{start:"2027-01-01",end:"2027-01-15"}},categories,periods,issues:[],allocations:[{id:"p",categoryId:"food",currency:"CRC",minor:12000000,parentKey:"N1",source:"legacy",start:"2026-10-28",end:"2026-11-13"}],actuals:[m("f1","food",1200000,"2026-10-30","N1","2026-11"),m("l1","loan",1500000,"2026-10-29","N1","2026-11"),m("l2","loan",3500,"2026-10-29","N1","2026-11","USD"),m("i1","income",2000000,"2026-10-28","N1","2026-11"),m("f2","food",550000,"2026-11-05","N1","2026-11"),m("f3","food",250000,"2026-11-29","D1","2026-12"),m("f4","food",900000,"2026-12-29","J1","2027-01")]};
 const before=JSON.stringify(model),q=(start,end,actualBasis)=>F.budgetProject(model,{basis:"calendar",start,end,actualBasis}),nov=q("2026-11-01","2026-11-30");
 assert.equal(nov.rows.find(r=>r.id==="food").actualMinor,2000000);
 assert.equal(nov.rows.find(r=>r.id==="food").plannedMinor,12000000);
 assert.equal(nov.actuals.filter(a=>a.transitionCarry).length,4);
 assert.equal(nov.actuals.find(a=>a.id==="f1").date,"2026-10-30");
 assert.equal(nov.actuals.find(a=>a.id==="l2").fxSell,500);
 assert.equal(q("2026-10-01","2026-10-31").actuals.length,0);
 assert.equal(q("2026-10-01","2026-10-31","date").actuals.length,4);
 assert.equal(q("2026-11-01","2026-11-15").actuals.length+q("2026-11-16","2026-11-30").actuals.length,nov.actuals.length);
 assert.equal(q("2026-12-01","2026-12-31").actuals[0].id,"f4");
 assert.equal(q("2027-01-01","2027-01-31").actuals.length,0);
 assert.equal(q("2026-10-01","2026-12-31").actuals.length,model.actuals.length);
 const report=A.inspect(model,"2026-11",F),food=report.rows.find(r=>r.id==="food");assert.equal(food.oldActual,1750000);assert.equal(food.newActual,800000);assert.equal(food.reconciledActual,2000000);assert.equal(food.carryMinor,1200000);assert.equal(JSON.stringify(model),before);
});
