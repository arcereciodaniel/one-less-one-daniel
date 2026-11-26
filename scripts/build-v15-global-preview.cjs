"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {buildIntelligencePreview}=require("./build-v15-intelligence-preview.cjs");
function buildGlobalPreview(){
 const html=buildIntelligencePreview().replaceAll("rastro_lab_v15_7_preview_","rastro_lab_v15_8_preview_").replaceAll("V15.7 LAB · DEMO","V15.8 LAB · DEMO");
 assert(!html.includes("rastro_lab_v15_7_preview_"));assert(!html.includes("daniel_finanzas_local_v1"));return html;
}
if(require.main===module){const dest=path.resolve(__dirname,"../preview-v15-8");fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,"One-Less-One-V15.8-Lab.html"),buildGlobalPreview());fs.writeFileSync(path.join(dest,"LEEME.txt"),"V15.8 DEMO aislada. Datos ficticios. Revisá Inicio, Presupuesto y Movimientos. No importés respaldos reales. No es producción.");}
module.exports={buildGlobalPreview};
