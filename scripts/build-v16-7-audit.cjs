"use strict";
const fs=require("node:fs"),path=require("node:path"),{buildReleaseAudit}=require("./build-v15-release-preview.cjs");
function buildAudit(){return buildReleaseAudit().replaceAll("Auditoría V15.9","Auditoría V16.7").replace("Este control no comprueba todos los cálculos ni reemplaza la conciliación bancaria.","Este control revisa el formato histórico V16.0; no valida la extensión experimental V17 ni reemplaza la conciliación bancaria.")}
if(require.main===module){const out=path.resolve(__dirname,"../preview-v16-7");fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"Auditoria-Local-V16.7.html"),buildAudit());fs.writeFileSync(path.join(out,"LEEME.txt"),"Auditoría local, solo lectura, de respaldo V16.0. No importés el respaldo en la demo. El informe contiene únicamente conteos y códigos. El motor de almacenamiento experimental se prueba con fixtures; no se ha activado en Daniel ni Lab reales. La demo visual sigue siendo V16.6.");}
module.exports={buildAudit};
