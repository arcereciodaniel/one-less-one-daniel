"use strict";
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const AS_OF="2026-11-17";
function seed(){
 const periods=[
 ["2026-11-14","2026-11",2],
 ["2026-11-28","2026-12",1],
 ["2026-12-14","2026-12",2],
 ["2026-12-28","2027-01",1],
 ["2027-01-14","2027-01",2],
 ["2027-01-28","2027-02",1],
 ["2027-02-14","2027-02",2],
 ["2027-02-28","2027-03",1],
 ["2027-03-14","2027-03",2]
 ].map(([date,budgetMonth,fortnight],i)=>({
  key:"P"+i,date,budgetMonth,fortnight,
  quarter:date.slice(0,4)+"-T"+Math.floor((Number(date.slice(5,7))-1)/3+1),n:i+1,
  categoryBudgets:{"cat-exp":i===0?20000:0,"cat-debt":i===0?30000:0},
  categoryBudgetCurrencies:{"cat-exp":"CRC","cat-debt":"CRC"},
  categoryBudgetSources:{},categoryBudgetScheduledDates:{},budgets:{}
 }));
 const categories=[
  {id:"cat-exp",name:"Supermercado",type:"Gasto",group:"Gastos",active:true,budgetable:true,sort:1},
  {id:"cat-debt",name:"Préstamos",type:"Pago deuda",group:"Deudas",active:true,budgetable:true,sort:2},
  {id:"cat-salary",name:"Salario",type:"Ingreso",group:"Ingresos",active:true,budgetable:true,sort:3,
   incomeConfig:{subtype:"Salario",behavior:"fixed",frequency:"semimonthly",
    expectedAmount:100000,expectedCurrency:"CRC",projectAutomatically:true,
    day1:14,day2:28,assignment1:"current-2",assignment2:"next-1"}}
 ];
 return {version:6.2,categorySchemaVersion:1,incomeSchemaVersion:1,settings:{
   fx:500,fxBuy:495,fxSell:505,fxDate:AS_OF,fxCheckedOn:AS_OF,
   fxSource:"manual",fxHistory:[],displayCurrency:"CRC",payDays:{first:14,second:28}
  },periods,categories,
  movements:[
   {id:"g1",seq:1,type:"Gasto",date:"2026-11-16",amount:5000,currency:"CRC",categoryId:"cat-exp",category:"Supermercado",period:"P0"},
   {id:"d1",seq:2,type:"Pago deuda",date:"2026-11-15",amount:10000,currency:"CRC",categoryId:"cat-debt",category:"Préstamos",debtId:"debt1",debt:"Préstamo",period:"P0"}
  ],movementSeq:2,
  debts:[{id:"debt1",name:"Préstamo",type:"Préstamo",status:"active",crc:100000,usd:0,minimum:30000,minimumCurrency:"CRC",payDay:"25",rate:"",balanceAdjustments:[]}],
  reconciliations:[{id:"r1",date:AS_OF,amount:100000,currency:"CRC",fxBuy:495,fxSell:505,afterSeq:2,
    createdAt:AS_OF+"T09:00:00.000Z",scope:"operating"}],
  reserves:[],reserveMovements:[],sharedCharges:[],sharedChargeGroups:[],receivableRecurring:[],
  projects:[],projectLinks:[],projectPlans:[],movementTemplates:[],movementAudit:[]
 };
}

const root=path.resolve(__dirname,"..");
function buildPreview(){
 let html=fs.readFileSync(path.join(root,"lab/index.html"),"utf8");
 function replace(a,b){assert.equal(html.split(a).length,2,"Missing/duplicate preview marker: "+a);html=html.replace(a,()=>b)}
 for(const [oldKey,newKey] of [
 ["rastro_lab_v7_1_data_v1","rastro_lab_v15_6_preview_data_v1"],
 ["rastro_lab_v7_1_ui_v1","rastro_lab_v15_6_preview_ui_v1"],
 ["rastro_lab_v7_1_receivables_v1","rastro_lab_v15_6_preview_receivables_v1"],
 ["rastro_lab_v7_1_prefs_v1","rastro_lab_v15_6_preview_prefs_v1"]
 ])replace(oldKey,newKey);
 replace('<link rel="manifest" href="./site.webmanifest?v=1210">','<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; connect-src \'none\'; font-src data:; base-uri \'none\'; form-action \'none\'">');
 const css=fs.readFileSync(path.join(root,"mobile-pilot/desktop.css"),"utf8");
 replace('<link rel="stylesheet" href="../mobile-pilot/desktop.css">','<style>'+css+'</style>');
 const split=fs.readFileSync(path.join(root,"mobile-pilot/public/split-fare.js"),"utf8");
 assert(!/<\/script/i.test(split));
 replace('<script src="../mobile-pilot/public/split-fare.js"></script>','<script>'+split+'</script>');
 replace('<script src="../mobile-pilot/desktop.js"></script>','<script>document.getElementById("oneSettingsRestore").disabled=true;document.getElementById("importBtn").disabled=true;document.getElementById("importFile").disabled=true;</script>');
 replace('<small class="brand-version">v16.0.0 LAB</small>','<small class="brand-version">V15.6 LAB · DEMO</small>');
 replace('v16.0.0 LAB · CRC/USD · Datos locales · No envía información a ningún servidor.','V15.6 LAB · DEMO · Datos ficticios · Sin conexión móvil ni red.');
 const demo=seed();
 // Provide a little realistic, explicitly fictitious budget data for all visible cards.
 for(const p of demo.periods){
  p.categoryBudgets["cat-exp"]=80000;
  p.categoryBudgets["cat-debt"]=30000;
 }
 demo.periods[1].categoryBudgets["cat-debt"]=25;demo.periods[1].categoryBudgetCurrencies["cat-debt"]="USD";
 const init='if(localStorage.getItem(STORAGE_KEY)===null){const demo='+JSON.stringify(demo).replace(/</g,"\\u003c")+';demo.settings.fxCheckedOn=todayIso();localStorage.setItem(STORAGE_KEY,JSON.stringify(demo));}\n';
 replace('let data = load();',init+'let data = load();');
 assert(!/<script\s+src=/i.test(html));
 assert(!html.includes('rastro_lab_v7_1_data_v1'));
 assert(!html.includes('daniel_finanzas_local_v1'));
 return html;
}
if(require.main===module){const dest=path.join(root,"preview");fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,"One-Less-One-V15.6-Lab.html"),buildPreview());fs.writeFileSync(path.join(dest,"LEEME.txt"),"ONE LESS ONE — V15.6 LAB DEMO\n\nAbrí el HTML en el navegador desde el archivo descomprimido. Los datos son ficticios, la conexión móvil y la red están bloqueadas, y el almacenamiento está separado. No importés respaldos reales. Si el navegador bloquea almacenamiento en archivos locales, probá Chrome o Edge. Validá visualmente Presupuesto, Movimientos y Configuración. No es la versión de producción.\n");}
module.exports={buildPreview};
