"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {buildReleaseAudit,buildReleasePreview}=require("./build-v15-release-preview.cjs");
function buildCandidatePreview(){
 let html=buildReleasePreview().replaceAll("rastro_lab_v15_9_preview_","rastro_lab_v16_rc1_preview_").replaceAll("V15.9 LAB · DEMO","V16.0 RC1 · DEMO");
 const re=/const demo=(\{[^\n]+\});demo\.settings\.fxCheckedOn=todayIso\(\)/;
 assert.equal([...html.matchAll(new RegExp(re.source,"g"))].length,1);
 html=html.replace(re,(_,raw)=>{
  const demo=JSON.parse(raw);
  demo.categories.push({id:"demo-save",name:"Ahorro para viaje",type:"Gasto",group:"Gastos",budgetable:true,active:true,sort:6});
  demo.periods[0].categoryBudgets["demo-save"]=20000;
  demo.periods[0].categoryBudgetCurrencies["demo-save"]="CRC";
  demo.reserves.push({id:"demo-goal",name:"Viaje de ejemplo",type:"goal",status:"active",openingDate:"2026-11-01",openingAmount:30000,openingCurrency:"CRC",target:100000,targetCurrency:"CRC",targetDate:"2027-03-31",budgetCategoryId:"demo-save"});
  demo.reserveMovements.push({id:"demo-contribution",reserveId:"demo-goal",type:"Aporte",date:"2026-11-18",amount:5000,currency:"CRC",budgetCategoryId:"demo-save",createdAt:"2026-11-18T12:00:00.000Z"});
  demo.projects.push({id:"demo-project",name:"Viaje de ejemplo",status:"active",currency:"CRC",budget:80000,goalId:"demo-goal",cobroGroupId:"",buckets:[{id:"demo-transport",name:"Transporte",budget:30000}]});
  demo.projectLinks.push({id:"demo-link",projectId:"demo-project",movementId:"g3",bucketId:"demo-transport",planId:"demo-plan"});
  demo.projectPlans.push({id:"demo-plan",projectId:"demo-project",bucketId:"demo-transport",name:"Traslados",amount:20000,status:"pending",dueDate:"2026-12-15"});
  return "const demo="+JSON.stringify(demo).replace(/</g,"\\u003c")+";demo.settings.fxCheckedOn=todayIso()";
 });
 assert(!html.includes("rastro_lab_v15_9_preview_"));return html;
}
function buildCandidateAudit(){return buildReleaseAudit().replaceAll("Auditoría V15.9","Auditoría V16.0 RC1")}
if(require.main===module){const dest=path.resolve(__dirname,"../preview-v16-rc1");fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,"One-Less-One-V16.0-RC1-DEMO.html"),buildCandidatePreview());fs.writeFileSync(path.join(dest,"Auditoria-Local-V16.0-RC1.html"),buildCandidateAudit());fs.copyFileSync(path.resolve(__dirname,"../docs/v16-release-checklist.md"),path.join(dest,"Checklist-lanzamiento.md"));fs.writeFileSync(path.join(dest,"LEEME.txt"),"Candidata V16.0 RC1, NO publicada. DEMO: datos ficticios, sin red ni conexión móvil. Auditoria: seleccioná el respaldo exportado de tu app real; analiza en memoria sin importarlo. Compartí únicamente el resumen de incidencias. Consultá Checklist-lanzamiento.md.");}
module.exports={buildCandidatePreview,buildCandidateAudit};
