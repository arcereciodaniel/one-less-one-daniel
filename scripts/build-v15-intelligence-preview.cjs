"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {buildPreview}=require("./build-v15-preview.cjs");
function buildIntelligencePreview(){
 let html=buildPreview();
 html=html.replaceAll("rastro_lab_v15_6_preview_","rastro_lab_v15_7_preview_").replaceAll("V15.6 LAB · DEMO","V15.7 LAB · DEMO");
 const re=/const demo=(\{[^\n]+\});demo\.settings\.fxCheckedOn=todayIso\(\)/;
 assert.equal([...html.matchAll(new RegExp(re.source,"g"))].length,1);
 html=html.replace(re,(_,raw)=>{
  const demo=JSON.parse(raw);
  demo.categories.push({id:"cat-demo-extra",name:"Comida fuera",type:"Gasto",group:"Gastos",active:true,budgetable:true,sort:4});
  demo.movements.push({id:"g2",seq:3,type:"Gasto",date:"2026-11-16",amount:4000,currency:"CRC",categoryId:"cat-demo-extra",category:"Comida fuera",period:"P0"});
  demo.movementSeq=3;
  return "const demo="+JSON.stringify(demo).replace(/</g,"\\u003c")+";demo.settings.fxCheckedOn=todayIso()";
 });
 assert(!html.includes("rastro_lab_v15_6_preview_"));
 return html;
}
if(require.main===module){const dest=path.resolve(__dirname,"../preview-v15-7");fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,"One-Less-One-V15.7-Lab.html"),buildIntelligencePreview());fs.writeFileSync(path.join(dest,"LEEME.txt"),"V15.7 DEMO aislada. Datos ficticios. Abrí el HTML, elegí Presupuesto y desplegá Revisar presupuesto en noviembre 2026 (2.ª quincena). No importés respaldos reales. No es producción.");}
module.exports={buildIntelligencePreview};
