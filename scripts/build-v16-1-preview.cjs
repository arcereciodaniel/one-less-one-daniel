"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"..");
const {demoLedger}=require("../src/experimental/v16-demo-data.cjs");
function buildPreview(){
 const core=fs.readFileSync(path.join(root,"src/experimental/v16-temporal-navigation.cjs"),"utf8"),css=fs.readFileSync(path.join(root,"src/styles/app.css"),"utf8"),shell=fs.readFileSync(path.join(root,"src/experimental/v16-flexible-preview.html"),"utf8");
 assert(!/<\/script/i.test(core));assert(!/<\/style/i.test(css));
 return shell.replace("/* OLO_NATIVE_CSS */",()=>css).replace("/* OLO_TEMPORAL_CORE */",()=>core).replace("/* OLO_DEMO_LEDGER */",()=>JSON.stringify(demoLedger()).replace(/</g,"\\u003c"));
}
if(require.main===module){const out=path.join(root,"preview-v16-1");fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"One-Less-One-V16.1-DEMO.html"),buildPreview());fs.writeFileSync(path.join(out,"LEEME.txt"),"V16.1 · prototipo aislado. Abrí el HTML en un navegador. Fecha actual simulada: 19/12/2026. Usa datos ficticios, no almacenamiento, red ni conexión móvil. Probá Semana, Quincena, Mes, Trimestre, Semestre y Año, navegación entre meses, Actual/Todos y cambio de módulos. Los cambios de asignación son únicamente en memoria y se pierden al recargar. No es producción; no importés datos reales.");}
module.exports={buildPreview};
