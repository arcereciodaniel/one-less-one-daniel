
const ONE_DEFAULT_PAY_DAYS={first:14,second:28};
"use strict";
const STORAGE_KEY = "daniel_finanzas_local_v1";
const INTEGRITY_SNAPSHOT_KEY=STORAGE_KEY+"_pre_integrity_fix_v813";
let oneStorageSnapshot=null;
let oneStorageConflict=false;
var storageReadError=false,storageHasSavedData=false;
const UI_STORAGE_KEY = "daniel_finanzas_ui_v1";
const RECEIVABLE_CLEAN_START_KEY = "rastro_receivables_clean_start_v57";
function loadUiState(){
  try{
    const saved=localStorage.getItem(UI_STORAGE_KEY);
    const parsed=saved?JSON.parse(saved):{};
    return parsed&&typeof parsed==="object"?parsed:{};
  }catch{return {}}
}
let uiState=loadUiState();
function saveUiState(){
  try{localStorage.setItem(UI_STORAGE_KEY,JSON.stringify(uiState))}catch{}
}
const ONE_DEFAULT_SHOW_COBROS=true;
const ONE_OPTIONAL_MODULES=new Set(["debts","shared","capital","projects","future"]);
function oneModuleEnabled(name){
  if(!ONE_OPTIONAL_MODULES.has(name))return true;
  if(typeof uiState.modules?.[name]==="boolean")return uiState.modules[name];
  if(name==="debts")return !!((data.debts||[]).length||(data.movements||[]).some(m=>m.type==="Pago deuda"));
  if(name==="capital")return !!((data.reserves||[]).length||(data.reserveMovements||[]).length);
  if(name==="projects")return !!((data.projects||[]).length);
  if(name==="future")return false;
  return ONE_DEFAULT_SHOW_COBROS||!!((data.sharedCharges||[]).length||(data.sharedChargeGroups||[]).length||(data.receivableRecurring||[]).length);
}
function oneRefreshModuleVisibility(){
  for(const name of ONE_OPTIONAL_MODULES){
    const btn=document.querySelector(`#nav [data-optional-module="${name}"]`);
    if(btn)btn.hidden=!oneModuleEnabled(name);
  }
  const debt=document.getElementById("dashboardDebtCommitmentsCard");
  if(debt)debt.hidden=!oneModuleEnabled("debts");
  document.querySelector("#view-dashboard .v7-bottom-grid")?.classList.toggle("one-single-column",!oneModuleEnabled("debts"));
  const debtInput=document.getElementById("moduleDebtsToggle"),cobrosInput=document.getElementById("moduleCollectionsToggle");
  if(debtInput)debtInput.checked=oneModuleEnabled("debts");
  if(cobrosInput)cobrosInput.checked=oneModuleEnabled("shared");
  const goalsInput=document.getElementById("moduleGoalsToggle");
  if(goalsInput)goalsInput.checked=oneModuleEnabled("capital");
  const projectsInput=document.getElementById("moduleProjectsToggle");
  if(projectsInput)projectsInput.checked=oneModuleEnabled("projects");
  const futureInput=document.getElementById("moduleFutureToggle");
  if(futureInput)futureInput.checked=oneModuleEnabled("future");
  const current=document.querySelector(".view.active")?.id?.replace("view-","");
  if(ONE_OPTIONAL_MODULES.has(current)&&!oneModuleEnabled(current))navigate("dashboard");
}
function oneSetModuleEnabled(name,value){
  if(!ONE_OPTIONAL_MODULES.has(name))return;
  uiState.modules={...(uiState.modules||{}),[name]:!!value};saveUiState();
  oneRefreshModuleVisibility();
  if(document.getElementById("view-dashboard")?.classList.contains("active"))renderDashboard();
  if(document.getElementById("view-plan")?.classList.contains("active"))renderPlan();
  if(document.getElementById("view-movements")?.classList.contains("active"))renderMovements();
}
function initModulesBeta(){
  oneRefreshModuleVisibility();
  const addButton=document.getElementById("manageModulesBtn"),modal=document.getElementById("modulesDialog");
  addButton?.addEventListener("click",()=>{
    oneRefreshModuleVisibility();
    if(!modal?.open){modal?.showModal();addButton.setAttribute("aria-expanded","true")}
  });
  modal?.addEventListener("close",()=>{addButton?.setAttribute("aria-expanded","false");addButton?.focus()});
  document.getElementById("moduleDebtsToggle")?.addEventListener("change",e=>oneSetModuleEnabled("debts",e.target.checked));
  document.getElementById("moduleCollectionsToggle")?.addEventListener("change",e=>oneSetModuleEnabled("shared",e.target.checked));
  document.getElementById("moduleGoalsToggle")?.addEventListener("change",e=>oneSetModuleEnabled("capital",e.target.checked));
  document.getElementById("moduleProjectsToggle")?.addEventListener("change",e=>oneSetModuleEnabled("projects",e.target.checked));
  document.getElementById("moduleFutureToggle")?.addEventListener("change",e=>oneSetModuleEnabled("future",e.target.checked));
  document.getElementById("closeModulesBtn")?.addEventListener("click",()=>document.getElementById("modulesDialog")?.close());
  document.getElementById("openCollectionsFromHome")?.addEventListener("click",()=>navigate("shared"));
}
function planMonthOpenPreference(month){
  return uiState.planMonths?.[month]!==false;
}
function rememberPlanMonthOpen(month,open){
  if(!month)return;
  uiState.planMonths=uiState.planMonths||{};
  uiState.planMonths[month]=!!open;
  saveUiState();
}

const CATEGORY_TYPES = ["Ingreso","Gasto","Pago deuda","Movimiento patrimonial"];
const DEFAULT_CATEGORIES = [
  {id:"cat-income-daniel",name:"Ingreso principal",type:"Ingreso",group:"Trabajo",budgetable:true,active:true,sort:10},
  {id:"cat-income-otros",name:"Otros ingresos",type:"Ingreso",group:"Ingresos",budgetable:true,active:true,sort:20},
  {id:"cat-exp-comida",name:"Supermercado",type:"Gasto",group:"Necesidades",budgetable:true,active:true,sort:30},
  {id:"cat-exp-transporte",name:"Transporte",type:"Gasto",group:"Necesidades",budgetable:true,active:true,sort:40},
  {id:"cat-exp-salud",name:"Salud",type:"Gasto",group:"Bienestar",budgetable:true,active:true,sort:50},
  {id:"cat-exp-suscripciones",name:"Suscripciones",type:"Gasto",group:"Servicios",budgetable:true,active:true,sort:60},
  {id:"cat-exp-ocio",name:"Entretenimiento",type:"Gasto",group:"Estilo de vida",budgetable:true,active:true,sort:70},
  {id:"cat-exp-otros",name:"Otros gastos",type:"Gasto",group:"Otros",budgetable:true,active:true,sort:80},
  {id:"cat-debt-cards",name:"Pago de deuda",type:"Pago deuda",group:"Deudas",budgetable:true,active:true,sort:90},
  {id:"cat-asset-sale",name:"Venta de activo",type:"Movimiento patrimonial",group:"Patrimonio",budgetable:false,active:true,sort:100}
];
const MOVEMENT_TYPES = [...CATEGORY_TYPES];
const ACCOUNTS = ["Cuenta bancaria","Efectivo","MultiMoney","Otra cuenta"];
const RESERVE_TX_TYPES = ["Aporte","Retiro a operación","Uso objetivo","Rendimiento","Ajuste"];

const INCOME_SUBTYPES=["Salario","Negocio","Freelance","Pensión","Renta","Comisión","Otro"];
const INCOME_FREQUENCIES=new Set(["semimonthly","monthly","biweekly","weekly","irregular","once"]);
const INCOME_ASSIGNMENTS=new Set(["current-1","current-2","next-1","next-2"]);
function clampDay(v,fallback=1){return Math.max(1,Math.min(31,Math.round(num(v)||fallback)))}
function normalizeIncomeConfig(cfg={}){
  cfg=cfg&&typeof cfg==="object"?cfg:{};
  const frequency=INCOME_FREQUENCIES.has(cfg.frequency)?cfg.frequency:"irregular";
  const subtype=INCOME_SUBTYPES.includes(cfg.subtype)?cfg.subtype:"Otro";
  const behavior=cfg.behavior==="fixed"?"fixed":"variable";
  const out={
    subtype,behavior,frequency,
    expectedAmount:num(cfg.expectedAmount),expectedCurrency:normalizeCurrency(cfg.expectedCurrency||"CRC"),
    projectAutomatically:cfg.projectAutomatically===true&&frequency!=="irregular",
    account:ACCOUNTS.includes(cfg.account)?cfg.account:"Cuenta bancaria",
    day1:clampDay(cfg.day1,ONE_DEFAULT_PAY_DAYS.first),day2:clampDay(cfg.day2,ONE_DEFAULT_PAY_DAYS.second),
    assignment1:INCOME_ASSIGNMENTS.has(cfg.assignment1)?cfg.assignment1:"current-2",
    assignment2:INCOME_ASSIGNMENTS.has(cfg.assignment2)?cfg.assignment2:"next-1",
    monthlyDay:clampDay(cfg.monthlyDay,30),weekday:Math.max(0,Math.min(6,Math.round(num(cfg.weekday)||5))),
    biweeklyStart:String(cfg.biweeklyStart||""),onceDate:String(cfg.onceDate||"")
  };
  return out;
}
function inferIncomeAmount(raw,cid){
  const samples=[];
  for(const p of raw.periods||[]){const amount=num(p.categoryBudgets?.[cid]);if(amount>0)samples.push({amount,currency:normalizeCurrency(p.categoryBudgetCurrencies?.[cid]||"CRC"),date:p.date||""})}
  if(!samples.length){for(const m of raw.movements||[]){if(m.type==="Ingreso"&&m.categoryId===cid&&num(m.amount)>0)samples.push({amount:num(m.amount),currency:normalizeCurrency(m.currency||"CRC"),date:m.date||""})}}
  if(!samples.length)return {amount:0,currency:"CRC"};
  const currencies={};samples.forEach(s=>currencies[s.currency]=(currencies[s.currency]||0)+1);const currency=Object.entries(currencies).sort((a,b)=>b[1]-a[1])[0][0];
  const values=samples.filter(s=>s.currency===currency).map(s=>s.amount).sort((a,b)=>a-b);const mid=Math.floor(values.length/2),amount=values.length%2?values[mid]:(values[mid-1]+values[mid])/2;
  return {amount,currency};
}
function defaultIncomeConfigForCategory(raw,c){
  const inferred=inferIncomeAmount(raw,c.id),name=String(c.name||"").toLocaleLowerCase("es");
  const isPrimary=c.id==="cat-income-daniel";
  const subtype=c.id==="cat-income-filtro"||name.includes("filtro")?"Negocio":c.id==="cat-income-freelance"||name.includes("freelance")?"Freelance":isPrimary?"Salario":"Otro";
  return normalizeIncomeConfig({subtype,behavior:isPrimary?"fixed":"variable",frequency:isPrimary?"semimonthly":"irregular",expectedAmount:inferred.amount,expectedCurrency:inferred.currency,projectAutomatically:isPrimary&&inferred.amount>0,account:"Cuenta bancaria",day1:onePayDays(raw.settings).first,day2:onePayDays(raw.settings).second,assignment1:"current-2",assignment2:"next-1"});
}
function dateForMonthDay(year,monthIndex,day){const last=new Date(Date.UTC(year,monthIndex+1,0)).getUTCDate();return new Date(Date.UTC(year,monthIndex,Math.min(clampDay(day),last))).toISOString().slice(0,10)}
function shiftMonth(monthKeyValue,delta){const [y,m]=String(monthKeyValue).split("-").map(Number),d=new Date(Date.UTC(y,m-1+delta,1));return d.toISOString().slice(0,7)}
function targetPeriodByAssignment(raw,date,assignment){
  const month=date.slice(0,7),isNext=String(assignment).startsWith("next-"),targetMonth=isNext?shiftMonth(month,1):month,fortnight=String(assignment).endsWith("-2")?2:1;
  return (raw.periods||[]).find(p=>p.budgetMonth===targetMonth&&Number(p.fortnight)===fortnight)||null;
}
function incomeOccurrencesForData(raw,c){
  const cfg=normalizeIncomeConfig(c?.incomeConfig||{}),result=new Map();
  if(!c||c.type!=="Ingreso"||c.active===false||c.budgetable===false||!cfg.projectAutomatically||cfg.expectedAmount<=0||cfg.frequency==="irregular")return result;
  const periods=[...(raw.periods||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date)));if(!periods.length)return result;
  const minDate=periods[0].date,maxDate=periodEndDate(periods.at(-1),periods,raw.settings);
  const addOccurrence=(date,target=null)=>{if(!date||date<minDate||date>maxDate)return;const p=target||periodForDateIn(raw.periods,date);if(!p)return;const key=periodKey(p),cur=result.get(key)||{amount:0,currency:cfg.expectedCurrency,dates:[]};cur.amount+=cfg.expectedAmount;cur.dates.push(date);result.set(key,cur)};
  const min=new Date(minDate+"T00:00:00Z"),max=new Date(maxDate+"T00:00:00Z");
  if(cfg.frequency==="semimonthly"||cfg.frequency==="monthly"){
    for(let cursor=new Date(Date.UTC(min.getUTCFullYear(),min.getUTCMonth(),1));cursor<=max;cursor=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1))){
      const y=cursor.getUTCFullYear(),m=cursor.getUTCMonth();
      if(cfg.frequency==="semimonthly"){
        const d1=dateForMonthDay(y,m,cfg.day1),d2=dateForMonthDay(y,m,cfg.day2);addOccurrence(d1,targetPeriodByAssignment(raw,d1,cfg.assignment1));addOccurrence(d2,targetPeriodByAssignment(raw,d2,cfg.assignment2));
      }else addOccurrence(dateForMonthDay(y,m,cfg.monthlyDay));
    }
  }else if(cfg.frequency==="weekly"){
    let d=new Date(min);while(d.getUTCDay()!==cfg.weekday)d.setUTCDate(d.getUTCDate()+1);for(;d<=max;d.setUTCDate(d.getUTCDate()+7))addOccurrence(d.toISOString().slice(0,10));
  }else if(cfg.frequency==="biweekly"){
    let d=new Date((cfg.biweeklyStart||minDate)+"T00:00:00Z");if(Number.isNaN(d.getTime()))d=new Date(min);while(d>min)d.setUTCDate(d.getUTCDate()-14);while(d<min)d.setUTCDate(d.getUTCDate()+14);for(;d<=max;d.setUTCDate(d.getUTCDate()+14))addOccurrence(d.toISOString().slice(0,10));
  }else if(cfg.frequency==="once")addOccurrence(cfg.onceDate);
  return result;
}
function syncIncomeProjectionsForData(raw,{categoryId="",adoptExisting=false}={}){
  const today=todayIso();
  for(const c of (raw.categories||[]).filter(x=>x.type==="Ingreso"&&(!categoryId||x.id===categoryId))){
    c.incomeConfig=normalizeIncomeConfig(c.incomeConfig||{});const cfg=c.incomeConfig,scheduled=incomeOccurrencesForData(raw,c);
    for(const p of raw.periods||[]){
      p.categoryBudgets=p.categoryBudgets||{};p.categoryBudgetCurrencies=p.categoryBudgetCurrencies||{};p.categoryBudgetSources=p.categoryBudgetSources&&typeof p.categoryBudgetSources==="object"?p.categoryBudgetSources:{};p.categoryBudgetScheduledDates=p.categoryBudgetScheduledDates&&typeof p.categoryBudgetScheduledDates==="object"?p.categoryBudgetScheduledDates:{};
      if(periodEndDate(p,raw.periods,raw.settings)<today)continue;
      const key=periodKey(p),target=scheduled.get(key),hasSource=Object.prototype.hasOwnProperty.call(p.categoryBudgetSources,c.id),hasBudget=Object.prototype.hasOwnProperty.call(p.categoryBudgets,c.id),source=hasSource?p.categoryBudgetSources[c.id]:(hasBudget?"manual":"auto"),existing=num(p.categoryBudgets[c.id]),sameTarget=target&&Math.abs(existing-target.amount)<0.0001&&normalizeCurrency(p.categoryBudgetCurrencies[c.id]||cfg.expectedCurrency)===cfg.expectedCurrency;
      if(!cfg.projectAutomatically||c.active===false||c.budgetable===false){if(source==="auto"){p.categoryBudgets[c.id]=0;delete p.categoryBudgetSources[c.id];delete p.categoryBudgetScheduledDates[c.id]}continue}
      if(adoptExisting&&source==="manual"&&(existing===0||sameTarget)){p.categoryBudgetSources[c.id]="auto"}
      if((p.categoryBudgetSources[c.id]||source)!=="manual"){
        p.categoryBudgets[c.id]=target?target.amount:0;p.categoryBudgetCurrencies[c.id]=cfg.expectedCurrency;p.categoryBudgetSources[c.id]="auto";
        if(target?.dates?.length)p.categoryBudgetScheduledDates[c.id]=target.dates;else delete p.categoryBudgetScheduledDates[c.id];
      }
    }
  }
}

const ONE_DEBT_TYPE_PRESETS = Object.freeze([
 {id:"olo-debt-card",name:"Tarjeta de crédito",shape:"card",active:true,builtin:true},
 {id:"olo-debt-loan",name:"Préstamo",shape:"loan",active:true,builtin:true},
 {id:"olo-debt-installments",name:"Compra en cuotas",shape:"installments",active:true,builtin:true},
 {id:"olo-debt-family",name:"Préstamo familiar",shape:"family",active:true,builtin:true},
 {id:"olo-debt-other",name:"Otra deuda",shape:"other",active:true,builtin:true}
]);
const ONE_DEBT_SHAPES={card:"Tarjeta",loan:"Préstamo",installments:"Préstamo",family:"Familiar",other:"Otra"};
function oneNormalizeDebtTypes(rows){
 const seen=new Set(),result=[];
 (Array.isArray(rows)?rows:[]).forEach(t=>{
  if(!t||typeof t.id!=="string"||seen.has(t.id))return;
  const shape=Object.hasOwn(ONE_DEBT_SHAPES,t.shape)?t.shape:"other";
  const name=String(t.name||"").trim().slice(0,70);
  if(!name)return;
  seen.add(t.id);result.push({id:t.id,name,shape,active:t.active!==false,builtin:ONE_DEBT_TYPE_PRESETS.some(p=>p.id===t.id)});
 });
 ONE_DEBT_TYPE_PRESETS.forEach(p=>{if(!seen.has(p.id))result.push({...p})});
 return result;
}
const initialData = {
  settings:{fx:460,fxBuy:0,fxSell:0,fxDate:"",fxHistory:[],displayCurrency:"CRC"},
  quarters:["2026-T3","2026-T4","2027-T1"],
  periods:[...makeQuarter("2026-T3"),...makeQuarter("2026-T4"),...makeQuarter("2027-T1")],
  movements:[],
  reconciliations:[],
  reserves:[],
  reserveMovements:[],
  sharedChargeGroups:[],
  sharedCharges:[],
  receivableRecurring:[],
  categories:clone(DEFAULT_CATEGORIES),
  movementSeq:0,
  movementTemplates:[],
  movementAudit:[],
  accounts:[...ACCOUNTS],
  debts:[],
  debtTypes:clone(ONE_DEBT_TYPE_PRESETS),
  projects:[],projectLinks:[],projectPlans:[]
};

/* Calendario de salario configurable: la siguiente fecha de pago cierra el ciclo anterior. */

function onePayDays(settings=null){
  const x=settings?.payDays||ONE_DEFAULT_PAY_DAYS,first=Number(x.first)||ONE_DEFAULT_PAY_DAYS.first,second=Number(x.second)||ONE_DEFAULT_PAY_DAYS.second;
  return first>=1&&first<=27&&second>first&&second<=31?{first,second}:{...ONE_DEFAULT_PAY_DAYS};
}
function oneMonthShift(month,offset){
  const [y,m]=month.split("-").map(Number);
  return new Date(Date.UTC(y,m-1+offset,1)).toISOString().slice(0,7);
}
function oneDateMonthDay(month,day){
  const [y,m]=month.split("-").map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate();
  return month+"-"+String(Math.min(last,day)).padStart(2,"0");
}
function oneShiftDate(date,delta){return new Date(Date.parse(date+"T00:00:00Z")+delta*86400000).toISOString().slice(0,10)}
function oneAlignMovementPeriods(raw,fromMonth){
  for(const m of raw.movements||[]){
    if(!m.date||m.date<fromMonth+"-01")continue;
    const target=periodForDateIn(raw.periods,m.date);
    if(!target||target.budgetMonth<fromMonth||m.period===periodKey(target))continue;
    if(!m.originalPayPeriod)m.originalPayPeriod=m.period||"";
    m.period=periodKey(target);
    m.quarter=budgetQuarterFromMonth(target.budgetMonth);
  }
}
function oneUpdatePaydayPeriods(fromMonth){
  for(const p of data.periods){
    if(p.budgetMonth>=fromMonth)p.date=canonicalPaymentDate(p.budgetMonth,p.fortnight,data.settings);
  }
  oneAlignMovementPeriods(data,fromMonth);
}
function makeQuarter(q){
  const match=/^(\d{4})-T([1-4])$/.exec(q);
  if(!match)return [];
  const year=Number(match[1]), quarter=Number(match[2]), startMonth=(quarter-1)*3+1;
  const rows=[];let n=1;
  for(let offset=0;offset<3;offset++){
    const month=startMonth+offset;
    const budgetMonth=`${year}-${String(month).padStart(2,"0")}`;
    const q1Date=canonicalPaymentDate(budgetMonth,1);
    const q2Date=canonicalPaymentDate(budgetMonth,2);
    rows.push({key:`${budgetMonth}-Q1`,quarter:q,n:n++,budgetMonth,fortnight:1,date:q1Date,opening:null,openingCurrency:"CRC",income:0,incomeCurrency:"CRC",otherIncome:0,otherIncomeCurrency:"CRC",budgets:{},budgetCurrencies:{},categoryBudgets:{},categoryBudgetCurrencies:{}});
    rows.push({key:`${budgetMonth}-Q2`,quarter:q,n:n++,budgetMonth,fortnight:2,date:q2Date,opening:null,openingCurrency:"CRC",income:0,incomeCurrency:"CRC",otherIncome:0,otherIncomeCurrency:"CRC",budgets:{},budgetCurrencies:{},categoryBudgets:{},categoryBudgetCurrencies:{}});
  }
  return rows;
}
function id(){return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)+Date.now()}
function clone(x){return JSON.parse(JSON.stringify(x))}
let data = load();

function deriveBudgetMeta(p){
  if(p.budgetMonth&&p.fortnight)return {budgetMonth:p.budgetMonth,fortnight:Number(p.fortnight)};
  const d=new Date((p.date||"")+"T00:00:00Z");
  if(Number.isNaN(d.getTime()))return {budgetMonth:"",fortnight:1};
  const day=d.getUTCDate();
  if(day>=25){
    const next=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1));
    return {budgetMonth:next.toISOString().slice(0,7),fortnight:1};
  }
  if(day<=5)return {budgetMonth:d.toISOString().slice(0,7),fortnight:1};
  return {budgetMonth:d.toISOString().slice(0,7),fortnight:2};
}
function budgetQuarterFromMonth(month){
  if(!month)return "";
  const [year,m]=month.split("-").map(Number);
  return `${year}-T${Math.floor((m-1)/3)+1}`;
}
function canonicalPaymentDate(budgetMonth,fortnight,settings=null){
  const d=onePayDays(settings);
  return Number(fortnight)===1?oneDateMonthDay(oneMonthShift(budgetMonth,-1),d.second):oneDateMonthDay(budgetMonth,d.first);
}
function restoreValidDateSafeFxCheck(value){return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)}
function migrateData(raw){
  raw=raw&&typeof raw==="object"?raw:clone(initialData);
  const incomingVersion=num(raw.version);
  raw.settings=raw.settings&&typeof raw.settings==="object"?raw.settings:{};
  const legacyFx=num(raw.settings.fx)||460;
  raw.settings.fx=legacyFx;
  raw.settings.fxBuy=num(raw.settings.fxBuy)||legacyFx;
  raw.settings.fxSell=num(raw.settings.fxSell)||legacyFx;
  raw.settings.fxDate=raw.settings.fxDate||"";
  raw.settings.fxSource=["hacienda","bccr_mirror"].includes(raw.settings.fxSource)?raw.settings.fxSource:"manual";
  raw.settings.fxCheckedOn=restoreValidDateSafeFxCheck(raw.settings.fxCheckedOn)?raw.settings.fxCheckedOn:"";
  raw.settings.fxHistory=Array.isArray(raw.settings.fxHistory)?raw.settings.fxHistory.filter(x=>x&&x.date).map(x=>({date:x.date,buy:num(x.buy),sell:num(x.sell)})):[];
  raw.settings.displayCurrency=normalizeCurrency(raw.settings.displayCurrency||"CRC");
  raw.settings.payDays=onePayDays(raw.settings);
  raw.periods=Array.isArray(raw.periods)?raw.periods:[];
  raw.movements=Array.isArray(raw.movements)?raw.movements:[];
  raw.movementTemplates=Array.isArray(raw.movementTemplates)?raw.movementTemplates:[];
  raw.movementAudit=Array.isArray(raw.movementAudit)?raw.movementAudit:[];
  raw.accounts=Array.isArray(raw.accounts)?raw.accounts.filter(a=>typeof a==="string"&&a.trim()):[...ACCOUNTS];
  raw.accounts=[...new Set([...ACCOUNTS,...raw.accounts,...raw.movements.map(m=>m.account).filter(Boolean)])];
  raw.movementTemplates.forEach(t=>{t.id=t.id||id();t.active=t.active!==false;t.frequency=["weekly","fortnightly","monthly","yearly"].includes(t.frequency)?t.frequency:"monthly";t.nextDate=t.nextDate||todayIso();t.amount=num(t.amount);t.currency=normalizeCurrency(t.currency||"CRC")});
  raw.reconciliations=Array.isArray(raw.reconciliations)?raw.reconciliations:[];
  raw.debts=Array.isArray(raw.debts)?raw.debts:[];
  raw.debtTypes=oneNormalizeDebtTypes(raw.debtTypes);
  // Proyectos V11.2: solo referencias a movimientos; no se migran ni duplican gastos.
  raw.projects=Array.isArray(raw.projects)?raw.projects:[];
  raw.projectLinks=Array.isArray(raw.projectLinks)?raw.projectLinks:[];
  raw.projectPlans=Array.isArray(raw.projectPlans)?raw.projectPlans:[];
  raw.projects.forEach(p=>{
    if(!p||typeof p!=="object")return;
    p.status=p.status==="archived"?"archived":"active";
    p.currency=normalizeCurrency(p.currency||"CRC");
    p.buckets=Array.isArray(p.buckets)?p.buckets:[];
    p.goalId=typeof p.goalId==="string"?p.goalId:"";
    p.cobroGroupId=typeof p.cobroGroupId==="string"?p.cobroGroupId:"";
    p.budget=Number.isFinite(Number(p.budget))?Math.max(0,Number(p.budget)):0;
  });
  raw.reserves=Array.isArray(raw.reserves)?raw.reserves:[];
  raw.reserveMovements=Array.isArray(raw.reserveMovements)?raw.reserveMovements:[];
  raw.sharedChargeGroups=Array.isArray(raw.sharedChargeGroups)?raw.sharedChargeGroups:[];
  raw.sharedCharges=Array.isArray(raw.sharedCharges)?raw.sharedCharges:[];
  raw.receivableRecurring=Array.isArray(raw.receivableRecurring)?raw.receivableRecurring:[];
  raw.categories=Array.isArray(raw.categories)?raw.categories:[];
  // Datos recientes usan IDs: no reconstruir nombres de campos heredados.
  const modernCategorySchema=num(raw.categorySchemaVersion)>=1 ||
    (raw.categories.length>0&&raw.periods.some(p=>Object.keys(p.categoryBudgets||{}).length>0));
  const importLegacyCategories=!modernCategorySchema;

  // Ciclo de vida de fondos objetivo (v5.4): archivar conserva saldo e historial,
  // pero evita nuevos aportes hasta reactivar el fondo.
  raw.reserves.forEach(r=>{
    r.status=(r.status==="archived"||r.archived===true)?"archived":"active";
    r.closedAt=r.status==="archived"?(r.closedAt||""):"";
    r.closedReason=r.status==="archived"?(r.closedReason||"Meta finalizada"):"";
    delete r.archived;
  });
  raw.sharedChargeGroups.forEach(g=>{
    g.id=g.id||id();g.name=g.name||"Grupo";g.person=g.person||"";g.notes=g.notes||"";
    g.status=(g.status==="archived"||g.archived===true)?"archived":"active";
    g.closedAt=g.status==="archived"?(g.closedAt||""):"";
    g.closedReason=g.status==="archived"?(g.closedReason||"Grupo finalizado"):"";
    delete g.archived;
  });
  raw.sharedCharges.forEach(c=>{c.id=c.id||id();c.groupId=c.groupId||"";c.person=c.person||"";c.date=c.date||todayIso();c.dueDate=c.dueDate===undefined||c.dueDate===null?c.date:c.dueDate;c.payments=Array.isArray(c.payments)?c.payments:[];c.payments.forEach(p=>{p.id=p.id||id();p.date=p.date||c.date;p.amount=Math.max(0,num(p.amount));p.note=p.note||""});c.remindBeforeDays=Math.max(0,Math.min(30,num(c.remindBeforeDays??3)));c.snoozedUntil=c.snoozedUntil||"";c.chargeMonth=c.chargeMonth||monthKey(c.date);c.kind=c.kind||"Uso / consumo";c.description=c.description||"";c.amount=num(c.amount);c.currency=normalizeCurrency(c.currency||"CRC");c.fxBuy=num(c.fxBuy);c.fxSell=num(c.fxSell);c.fxRef=num(c.fxRef);c.fxDate=c.fxDate||"";c.status=c.status==="paid"?"paid":"pending";c.paidAt=c.status==="paid"?(c.paidAt||c.date):"";c.notes=c.notes||"";c.sourceRecurringId=c.sourceRecurringId||""});
  raw.receivableRecurring.forEach(t=>{t.id=t.id||id();t.groupId=t.groupId||"";t.person=t.person||"";t.startMonth=t.startMonth||todayIso().slice(0,7);t.endMonth=t.endMonth||"";t.day=Math.max(1,Math.min(31,num(t.day)||1));t.reminderDay=Math.max(1,Math.min(31,num(t.reminderDay)||t.day));t.remindBeforeDays=Math.max(0,Math.min(30,num(t.remindBeforeDays??3)));t.kind=t.kind||"Suscripción";t.description=t.description||"";t.amount=num(t.amount);t.currency=normalizeCurrency(t.currency||"CRC");t.notes=t.notes||""});

  // Ciclo de vida de deudas (v5.1): una deuda archivada conserva su historial,
  // pero deja de sumar en deuda activa y deja de aparecer para nuevos pagos.
  raw.debts.forEach(d=>{
    d.status=(d.status==="archived"||d.archived===true)?"archived":"active";
    d.closedAt=d.status==="archived"?(d.closedAt||""):"";
    d.closedReason=d.status==="archived"?(d.closedReason||"Pagada / finalizada"):"";
    d.limitCurrency=normalizeCurrency(d.limitCurrency||"USD");
    d.minimumCurrency=normalizeCurrency(d.minimumCurrency||"CRC");
    delete d.archived;
  });

  raw.periods.forEach((p,index)=>{
    const meta=deriveBudgetMeta(p);
    p.budgetMonth=meta.budgetMonth;p.fortnight=meta.fortnight;
    p.key=p.key||`${p.quarter||budgetQuarterFromMonth(meta.budgetMonth)}-${p.n||index+1}`;
    p.quarter=budgetQuarterFromMonth(p.budgetMonth);
    // No sobreescribir fechas personalizadas válidas al recargar un presupuesto.
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(p.date||"")))p.date=canonicalPaymentDate(p.budgetMonth,p.fortnight,raw.settings);
    p.budgets=p.budgets||{};
    p.budgetCurrencies=p.budgetCurrencies&&typeof p.budgetCurrencies==="object"?p.budgetCurrencies:{};
    p.categoryBudgets=p.categoryBudgets&&typeof p.categoryBudgets==="object"?p.categoryBudgets:{};
    p.categoryBudgetCurrencies=p.categoryBudgetCurrencies&&typeof p.categoryBudgetCurrencies==="object"?p.categoryBudgetCurrencies:{};
    p.categoryBudgetSources=p.categoryBudgetSources&&typeof p.categoryBudgetSources==="object"?p.categoryBudgetSources:{};
    p.categoryBudgetScheduledDates=p.categoryBudgetScheduledDates&&typeof p.categoryBudgetScheduledDates==="object"?p.categoryBudgetScheduledDates:{};
    p.openingCurrency=normalizeCurrency(p.openingCurrency||"CRC");
    p.incomeCurrency=normalizeCurrency(p.incomeCurrency||"CRC");
    p.otherIncomeCurrency=normalizeCurrency(p.otherIncomeCurrency||"CRC");
    // v6.2.0: migración del antiguo campo personal “Ayuda mamá” a “Otros ingresos”.
    // Conserva el valor aunque el respaldo antiguo lo tenga en una moneda distinta.
    const legacyMomHelp=num(p.momHelp), legacyMomCurrency=normalizeCurrency(p.momHelpCurrency||"CRC");
    if(legacyMomHelp){
      const buy=num(raw.settings.fxBuy)||num(raw.settings.fx)||460;
      let migratedAmount=legacyMomHelp;
      if(legacyMomCurrency!==p.otherIncomeCurrency){
        if(legacyMomCurrency==="USD"&&p.otherIncomeCurrency==="CRC")migratedAmount=legacyMomHelp*buy;
        else if(legacyMomCurrency==="CRC"&&p.otherIncomeCurrency==="USD")migratedAmount=buy?legacyMomHelp/buy:0;
      }
      p.otherIncome=num(p.otherIncome)+migratedAmount;
    }
    delete p.momHelp;delete p.momHelpCurrency;
    Object.keys(p.budgets).forEach(c=>p.budgetCurrencies[c]=normalizeCurrency(p.budgetCurrencies[c]||"CRC"));
    if(num(p.budgets["Saldo vencido teléfono"])){
      p.budgets["Teléfonos"]=num(p.budgets["Teléfonos"])+num(p.budgets["Saldo vencido teléfono"]);
      p.budgetCurrencies["Teléfonos"]=p.budgetCurrencies["Teléfonos"]||p.budgetCurrencies["Saldo vencido teléfono"]||"CRC";
      delete p.budgets["Saldo vencido teléfono"];
      delete p.budgetCurrencies["Saldo vencido teléfono"];
    }
    p.income=num(p.income);p.otherIncome=num(p.otherIncome);
  });



  const remap=new Map(), merged=[], byAccountingPeriod=new Map();
  [...raw.periods].sort((a,b)=>a.date.localeCompare(b.date)).forEach(p=>{
    const accountingKey=`${p.budgetMonth}|${p.fortnight}`;
    const existing=byAccountingPeriod.get(accountingKey);
    if(!existing){byAccountingPeriod.set(accountingKey,p);merged.push(p);return;}
    remap.set(periodKey(p),periodKey(existing));
    existing.income+=num(p.income);existing.otherIncome+=num(p.otherIncome);
    if((existing.opening===null||existing.opening===undefined)&&p.opening!==null&&p.opening!==undefined)existing.opening=num(p.opening);
    for(const [category,amount] of Object.entries(p.budgets||{}))existing.budgets[category]=num(existing.budgets[category])+num(amount);
  });
  raw.periods=merged.sort((a,b)=>a.date.localeCompare(b.date));

  const debtByName=new Map(raw.debts.map(d=>[d.name,d]));
  let maxSeq=num(raw.movementSeq);
  raw.movements.forEach((m,index)=>{
    if(!Number.isFinite(Number(m.seq))||Number(m.seq)<=0)m.seq=++maxSeq; else maxSeq=Math.max(maxSeq,Number(m.seq));
    m.createdAt=m.createdAt||`${m.date||"2000-01-01"}T12:00:00`;
    m.splits=Array.isArray(m.splits)?m.splits.filter(x=>x&&x.categoryId&&num(x.amount)>0).map(x=>({categoryId:String(x.categoryId),amount:num(x.amount)})):[];m.paymentMethod=m.paymentMethod||"";
    m.currency=normalizeCurrency(m.currency||"CRC");m.fxBuy=num(m.fxBuy);m.fxSell=num(m.fxSell);m.fxRef=num(m.fxRef);m.fxDate=m.fxDate||"";
    if(m.category==="Saldo vencido teléfono")m.category="Teléfonos";
    const desc=String(m.description||"").toLowerCase();
    if(m.type==="Ingreso" && (m.category==="Ayuda mamá"||/ayuda.*(mami|mamá|mama)|ayuda mensual de mi mamá/.test(desc)))m.category="Otros ingresos";
    if(m.type==="Ingreso" && /venta de veh[ií]culo/.test(desc)){
      m.type="Movimiento patrimonial";m.category="Venta de activo";m.affectsOperating=false;
    }
  });
  raw.movementSeq=maxSeq;

  // v6.1: categorías como entidades estables. Conserva la personalización actual,
  // pero separa el nombre visible del tipo financiero y del ID interno.
  const allowedCategoryTypes=new Set(CATEGORY_TYPES);
  const cleanName=v=>String(v||"").trim();
  const categoryKey=(name,type)=>`${cleanName(name).toLocaleLowerCase("es")}||${type}`;
  const categoryMap=new Map();
  const normalizedCategories=[];
  function addMigratedCategory(candidate){
    if(!candidate)return null;
    const name=cleanName(candidate.name);if(!name)return null;
    const type=allowedCategoryTypes.has(candidate.type)?candidate.type:"Gasto";
    if(candidate.id){const sameId=normalizedCategories.find(c=>c.id===candidate.id);if(sameId)return sameId}
    const key=categoryKey(name,type);
    if(categoryMap.has(key))return categoryMap.get(key);
    const row={id:candidate.id||id(),name,type,group:cleanName(candidate.group),budgetable:candidate.budgetable!==false&&type!=="Movimiento patrimonial",active:candidate.active!==false,sort:num(candidate.sort)||((normalizedCategories.length+1)*10),createdAt:candidate.createdAt||new Date().toISOString()};
    if(type==="Ingreso"&&candidate.incomeConfig)row.incomeConfig=normalizeIncomeConfig(candidate.incomeConfig);
    normalizedCategories.push(row);categoryMap.set(key,row);return row;
  }
  // La lista del usuario es autoritativa; no volver a agregar defaults renombrados o eliminados.
  raw.categories.forEach(c=>addMigratedCategory(c));
  if(importLegacyCategories){
    if(!raw.categories.length)DEFAULT_CATEGORIES.forEach(c=>addMigratedCategory(clone(c)));
    raw.movements.forEach(m=>{
      if(m.categoryId&&normalizedCategories.some(c=>c.id===m.categoryId))return;
      const name=cleanName(m.category||"Otros");
      if(!normalizedCategories.some(c=>cleanName(c.name).toLocaleLowerCase("es")===name.toLocaleLowerCase("es")))
        addMigratedCategory({name,type:allowedCategoryTypes.has(m.type)?m.type:"Gasto",budgetable:m.type!=="Movimiento patrimonial",active:true});
    });
    raw.periods.forEach(p=>Object.keys(p.budgets||{}).forEach(name=>{
      const defaultType=DEFAULT_CATEGORIES.find(c=>c.name===name)?.type||"Gasto";
      addMigratedCategory({name,type:defaultType,budgetable:true,active:true});
    }));
  }
  raw.categories=normalizedCategories.sort((a,b)=>num(a.sort)-num(b.sort)||a.name.localeCompare(b.name,"es"));
  const findCat=(name,type)=>categoryMap.get(categoryKey(name,type))||raw.categories.find(c=>cleanName(c.name).toLocaleLowerCase("es")===cleanName(name).toLocaleLowerCase("es"));
  const primaryIncome=findCat("Ingreso Daniel","Ingreso")||normalizedCategories.find(c=>c.id==="cat-income-daniel");
  const otherIncomeCat=findCat("Otros ingresos","Ingreso");
  raw.periods.forEach(p=>{
    p.categoryBudgets=p.categoryBudgets&&typeof p.categoryBudgets==="object"?p.categoryBudgets:{};
    p.categoryBudgetCurrencies=p.categoryBudgetCurrencies&&typeof p.categoryBudgetCurrencies==="object"?p.categoryBudgetCurrencies:{};
    if(importLegacyCategories){
      if(primaryIncome && p.categoryBudgets[primaryIncome.id]===undefined){p.categoryBudgets[primaryIncome.id]=num(p.income);p.categoryBudgetCurrencies[primaryIncome.id]=normalizeCurrency(p.incomeCurrency||"CRC")}
      if(otherIncomeCat && p.categoryBudgets[otherIncomeCat.id]===undefined){p.categoryBudgets[otherIncomeCat.id]=num(p.otherIncome);p.categoryBudgetCurrencies[otherIncomeCat.id]=normalizeCurrency(p.otherIncomeCurrency||"CRC")}
      Object.entries(p.budgets||{}).forEach(([name,amount])=>{
        const inferred=DEFAULT_CATEGORIES.find(c=>c.name===name)?.type||"Gasto",cat=findCat(name,inferred)||findCat(name,"Gasto");if(!cat)return;
        if(p.categoryBudgets[cat.id]===undefined)p.categoryBudgets[cat.id]=num(amount);
        if(!p.categoryBudgetCurrencies[cat.id])p.categoryBudgetCurrencies[cat.id]=normalizeCurrency(p.budgetCurrencies?.[name]||"CRC");
      });
    }
    Object.keys(p.categoryBudgets).forEach(cid=>{p.categoryBudgetCurrencies[cid]=normalizeCurrency(p.categoryBudgetCurrencies[cid]||"CRC");if(!p.categoryBudgetSources[cid])p.categoryBudgetSources[cid]="manual"});
  });
  const incomingIncomeSchema=num(raw.incomeSchemaVersion);
  raw.categories.filter(c=>c.type==="Ingreso").forEach(c=>{c.incomeConfig=c.incomeConfig?normalizeIncomeConfig(c.incomeConfig):defaultIncomeConfigForCategory(raw,c)});
  syncIncomeProjectionsForData(raw,{adoptExisting:incomingIncomeSchema<1});
  raw.incomeSchemaVersion=1;
  raw.movements.forEach(m=>{
    if(m.receivableChargeId&&m.receivablePaymentId&&m.cashFlowKind==="cobro_reembolso")return;
    let cat=m.categoryId?raw.categories.find(c=>c.id===m.categoryId):null;
    if(!cat)cat=findCat(m.category,m.type)||findCat(m.category,"Gasto");
    if(cat){m.categoryId=cat.id;m.category=cat.name}
  });

  // Capital del vehículo: se conserva como patrimonio protegido, fuera del flujo operativo.
  const vehicleSale=raw.movements.find(m=>m.type==="Movimiento patrimonial"&&m.category==="Venta de activo"&&/veh[ií]culo/i.test(m.description||""));
  if(vehicleSale && !raw.reserves.some(r=>r.sourceMovementId===vehicleSale.id || r.name==="Capital protegido - venta de activo")){
    raw.reserves.push({id:id(),name:"Capital protegido - venta de activo",type:"protected",target:0,targetCurrency:"CRC",openingAmount:num(vehicleSale.amount),openingCurrency:normalizeCurrency(vehicleSale.currency||"CRC"),openingDate:vehicleSale.date,location:"Por definir",rate:0,notes:"Capital protegido. No usar para cubrir el presupuesto operativo.",sourceMovementId:vehicleSale.id});
  }

  // Los respaldos v4 conciliaban el saldo total. Al separar capital, convertir esas conciliaciones a saldo operativo.
  if(incomingVersion<5){
    raw.reconciliations.forEach(r=>{
      const protectedAtDate=raw.reserves.filter(x=>x.type==="protected"&&x.openingDate<=r.date).reduce((sum,x)=>sum+num(x.openingAmount),0);
      r.legacyTotalAmount=num(r.amount);
      r.amount=Math.max(0,num(r.amount)-protectedAtDate);
      if(Number.isFinite(Number(r.calculatedBefore)))r.calculatedBefore=num(r.calculatedBefore)-protectedAtDate;
      r.scope="operating";
    });
  }
  raw.reconciliations.forEach((r,index)=>{
    r.id=r.id||id();r.date=r.date||todayIso();r.amount=num(r.amount);r.currency=normalizeCurrency(r.currency||"CRC");r.fxBuy=num(r.fxBuy);r.fxSell=num(r.fxSell);r.fxRef=num(r.fxRef);r.fxDate=r.fxDate||"";
    r.afterSeq=Number.isFinite(Number(r.afterSeq))?Number(r.afterSeq):maxSeq;
    r.calculatedBefore=Number.isFinite(Number(r.calculatedBefore))?Number(r.calculatedBefore):null;
    r.note=r.note||"";r.scope="operating";
    r.createdAt=r.createdAt||`${r.date}T23:59:${String(index).padStart(2,"0")}`;
  });

  raw.reserves.forEach(r=>{r.target=num(r.target);r.targetCurrency=normalizeCurrency(r.targetCurrency||"CRC");r.openingAmount=num(r.openingAmount);r.openingCurrency=normalizeCurrency(r.openingCurrency||"CRC");});
  raw.reserveMovements.forEach((t,index)=>{
    t.id=t.id||id();t.date=t.date||todayIso();t.amount=num(t.amount);t.currency=normalizeCurrency(t.currency||"CRC");t.fxBuy=num(t.fxBuy);t.fxSell=num(t.fxSell);t.fxRef=num(t.fxRef);t.fxDate=t.fxDate||"";t.createdAt=t.createdAt||`${t.date}T20:00:${String(index).padStart(2,"0")}`;
  });

  raw.movements.forEach(m=>{
    if(remap.has(m.period))m.period=remap.get(m.period);
    if(!m.debtId&&m.debt&&debtByName.has(m.debt))m.debtId=debtByName.get(m.debt).id;
    if(!m.period&&m.date){const p=periodForDateIn(raw.periods,m.date);if(p){m.period=periodKey(p);m.quarter=budgetQuarter(p)}}
    const linked=raw.periods.find(p=>periodKey(p)===m.period);if(linked)m.quarter=budgetQuarter(linked);
  });
  raw.quarters=planningQuartersFrom(raw.periods);
  raw.categorySchemaVersion=1;
  raw.version=6.2;
  return raw;
}
const RESTORE_SAFETY_KEY=STORAGE_KEY+"_pre_restore_v1";
const RESET_SAFETY_KEY=STORAGE_KEY+"_pre_reset_v1";
const RESTORE_MAX_BYTES=25*1024*1024;
function restoreIsRecord(v){return v!==null&&typeof v==="object"&&!Array.isArray(v)}
function restoreValidDate(value){
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const time=new Date(value+"T00:00:00Z");
  return !Number.isNaN(time.getTime())&&time.toISOString().slice(0,10)===value;
}
function restoreValidMoney(value){
  return (typeof value==="number"||typeof value==="string")&&String(value).trim()!==""&&Number.isFinite(Number(value));
}
function restoreValidate(raw){
  if(!restoreIsRecord(raw))throw Error("El archivo no contiene un respaldo válido de One Less One.");
  for(const key of ["periods","movements","debts"]){
    if(!Array.isArray(raw[key])||!raw[key].every(restoreIsRecord))
      throw Error("La lista "+key+" no existe o tiene elementos inválidos.");
  }
  if(!raw.periods.length)throw Error("El respaldo no contiene períodos financieros.");
  const optional=["reconciliations","reserves","reserveMovements","sharedCharges","sharedChargeGroups",
    "receivableRecurring","categories","movementTemplates","movementAudit","projects","projectLinks","projectPlans"];
  for(const key of optional){
    if(raw[key]!==undefined&&(!Array.isArray(raw[key])||!raw[key].every(restoreIsRecord)))
      throw Error("La lista "+key+" no tiene el formato esperado.");
  }
  if(raw.settings!==undefined&&!restoreIsRecord(raw.settings))
    throw Error("La configuración financiera no es válida.");
  if(raw.settings?.fxHistory!==undefined&&!Array.isArray(raw.settings.fxHistory))
    throw Error("El historial de tipos de cambio es inválido.");
  const seen=new Set();
  for(const p of raw.periods){
    const hasKey=typeof p.key==="string"&&p.key.trim().length>0;
    const hasMonth=typeof p.budgetMonth==="string"&&/^\d{4}-\d{2}$/.test(p.budgetMonth)&&
      [1,2].includes(Number(p.fortnight));
    const hasLegacy=/^\d{4}-T[1-4]$/.test(String(p.quarter||""))&&Number(p.n)>0;
    if(!restoreValidDate(p.date)||!(hasKey||hasMonth||hasLegacy))
      throw Error("Hay períodos financieros incompletos o con fechas incorrectas.");
    if(hasKey){if(seen.has(p.key))throw Error("Existen períodos duplicados.");seen.add(p.key);}
    for(const field of ["budgets","categoryBudgets","budgetCurrencies","categoryBudgetCurrencies"]){
      if(p[field]!==undefined&&!restoreIsRecord(p[field]))
        throw Error("Un período tiene presupuestos o monedas con estructura incorrecta.");
    }
    if(p.opening!==undefined&&p.opening!==null&&!restoreValidMoney(p.opening))
      throw Error("Un período tiene un saldo inicial inválido.");
    for(const field of ["budgets","categoryBudgets"]){
      if(p[field]&&Object.values(p[field]).some(v=>!restoreValidMoney(v)))
        throw Error("Un período contiene montos presupuestados inválidos.");
    }
  }
  for(const m of raw.movements){
    if(!restoreValidDate(m.date)||typeof m.type!=="string"||!m.type.trim()||
      !restoreValidMoney(m.amount)||Number(m.amount)<0)
      throw Error("Hay movimientos sin fecha, tipo o monto válidos.");
    if(m.currency!==undefined&&!["CRC","USD"].includes(String(m.currency).toUpperCase()))
      throw Error("Un movimiento tiene una moneda inválida.");
  }
  for(const d of raw.debts){
    if(typeof d.name!=="string"||!d.name.trim())
      throw Error("Hay deudas sin nombre identificable.");
    for(const field of ["usd","crc","minimum","limit"]){
      if(d[field]!==undefined&&!restoreValidMoney(d[field]))
        throw Error("Una deuda contiene montos inválidos.");
    }
    if(d.balanceAdjustments!==undefined&&(!Array.isArray(d.balanceAdjustments)||
      d.balanceAdjustments.some(a=>!restoreIsRecord(a)||!restoreValidDate(a.date)||!restoreValidMoney(a.amount))))
      throw Error("Una deuda contiene conciliaciones incompletas.");
  }
  for(const r of raw.reconciliations||[]){
    if(!restoreValidDate(r.date)||!restoreValidMoney(r.amount))
      throw Error("Hay conciliaciones de saldo sin fecha o monto válidos.");
  }
  for(const charge of raw.sharedCharges||[]){
    if(charge.amount!==undefined&&!restoreValidMoney(charge.amount))
      throw Error("Hay cobros con importes inválidos.");
    if(charge.payments!==undefined&&(!Array.isArray(charge.payments)||
       charge.payments.some(p=>!restoreIsRecord(p)||!restoreValidMoney(p.amount)||Number(p.amount)<0)))
      throw Error("Hay abonos de Cobros incompletos.");
  }
  for(const tx of raw.reserveMovements||[]){
    if(!restoreValidDate(tx.date)||!restoreValidMoney(tx.amount))
      throw Error("Hay movimientos de fondos con fechas o importes inválidos.");
  }
  for(const cat of raw.categories||[]){
    if(typeof cat.name!=="string"||!cat.name.trim()||typeof cat.type!=="string"||!cat.type.trim())
      throw Error("Hay categorías incompletas.");
  }
  const projectIds=new Set(),projectGoals=new Set(),projectCobroGroups=new Set();
  for(const p of raw.projects||[]){
    if(typeof p.id!=="string"||!p.id.trim()||projectIds.has(p.id)||
      typeof p.name!=="string"||!p.name.trim()||!restoreValidMoney(p.budget)||Number(p.budget)<0||
      !["CRC","USD"].includes(p.currency))
      throw Error("Hay proyectos con datos incompletos o identificadores duplicados.");
    if((p.startDate&&!restoreValidDate(p.startDate))||(p.endDate&&!restoreValidDate(p.endDate))||
      (p.startDate&&p.endDate&&p.endDate<p.startDate))throw Error("Hay fechas de proyecto inválidas.");
    if(p.goalId!==undefined&&typeof p.goalId!=="string")throw Error("Una referencia a Meta en Proyectos es inválida.");
    if(p.cobroGroupId!==undefined&&typeof p.cobroGroupId!=="string")throw Error("Una referencia a Cobros en Proyectos es inválida.");
    if(p.goalId){if(projectGoals.has(p.goalId))throw Error("Una Meta está vinculada a varios proyectos.");projectGoals.add(p.goalId);}
    if(p.cobroGroupId){if(projectCobroGroups.has(p.cobroGroupId))throw Error("Un grupo de Cobros está vinculado a varios proyectos.");projectCobroGroups.add(p.cobroGroupId);}
    if(p.buckets!==undefined&&(!Array.isArray(p.buckets)||p.buckets.some(b=>!restoreIsRecord(b)||
       !b.id||typeof b.name!=="string"||!b.name.trim()||!restoreValidMoney(b.budget)||Number(b.budget)<0)))
      throw Error("Hay conceptos de presupuesto de proyecto inválidos.");
    projectIds.add(p.id);
  }
  const linkedMoves=new Set(),realMoves=new Set(raw.movements.filter(m=>m.type==="Gasto").map(m=>m.id));
  for(const link of raw.projectLinks||[]){
    if(!link.id||!projectIds.has(link.projectId)||!realMoves.has(link.movementId)||linkedMoves.has(link.movementId))
      throw Error("Hay vínculos duplicados o inexistentes entre proyectos y gastos.");
    linkedMoves.add(link.movementId);
    const project=raw.projects.find(p=>p.id===link.projectId);
    if(link.bucketId&&!(project.buckets||[]).some(b=>b.id===link.bucketId))
      throw Error("Un gasto está vinculado a un concepto de proyecto inexistente.");
  }
  const planIds=new Set();
  for(const plan of raw.projectPlans||[]){
    if(!plan.id||planIds.has(plan.id)||!projectIds.has(plan.projectId)||typeof plan.name!=="string"||!plan.name.trim()||
       !restoreValidMoney(plan.amount)||Number(plan.amount)<=0||
       (plan.dueDate&&!restoreValidDate(plan.dueDate)))
      throw Error("Hay gastos previstos inválidos.");
    planIds.add(plan.id);
  }
  // V11.6: cada vínculo puede señalar una previsión del MISMO proyecto.
  // No se permite utilizar el mismo movimiento en varias previsiones.
  for(const link of raw.projectLinks||[]){
    if(!link.planId)continue; // Los respaldos anteriores no necesitan migración.
    const plan=(raw.projectPlans||[]).find(x=>x.id===link.planId);
    if(!plan||plan.projectId!==link.projectId)
      throw Error("Hay una conciliación de Proyecto que apunta a una previsión inexistente o ajena.");
    if(plan.bucketId&&plan.bucketId!==link.bucketId)
      throw Error("La conciliación usa un concepto distinto al de la previsión.");
  }
  return raw;
}
function restoreDetailsHtml(raw,file){
 const safeFile=String(file||"respaldo.json").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const groups=[["Períodos",raw.periods.length],["Movimientos",raw.movements.length],["Deudas",raw.debts.length],["Categorías",raw.categories?.length||0],["Cobros",raw.sharedCharges?.length||0],["Proyectos",raw.projects?.length||0],["Conciliaciones",raw.reconciliations?.length||0]];
 return '<p><strong>Archivo:</strong> '+safeFile+'</p><div class="one-restore-counts">'+groups.map(([n,v])=>'<div><span>'+n+'</span><strong>'+v+'</strong></div>').join("")+'</div>';
}
function restorePrepare(raw){
 const valid=restoreValidate(raw),migrated=migrateData(clone(valid));
 for(const field of ["periods","movements","debts","reconciliations","reserves","reserveMovements","sharedCharges","sharedChargeGroups","receivableRecurring","projects","projectLinks","projectPlans"]){
  if(Array.isArray(valid[field])&&migrated[field].length!==valid[field].length)
    throw Error("La conversión no conservó todos los registros de "+field+".");
 }
 migrated.version=6.2;migrated.currencySchemaVersion=1;migrated.categorySchemaVersion=1;migrated.incomeSchemaVersion=1;
 return migrated;
}
function oneBackupBeforeReplace(snapshotKey,prefix){
  const previous=localStorage.getItem(STORAGE_KEY);
  if(previous!==null){
    // Si falla la copia local, no cambiar la información financiera original.
    localStorage.setItem(snapshotKey,previous);
    download(prefix+"-"+todayIso()+".json",previous,"application/json");
  }
  return previous;
}
// V10.3: bloqueo conservador ante conflictos de escritura entre pestañas.
