import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
import {DESKTOP} from "./worker.mjs";
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
export function build(dir){
 for(const sub of ["src","public","staging"])fs.mkdirSync(path.join(dir,sub),{recursive:true});
 for(const rel of ["src/worker.js","public/split-fare.js","public/style.css","staging/worker.mjs","staging/schema.sql","package.json"])fs.copyFileSync(path.join(source,rel),path.join(dir,rel));
 for(const rel of ["public/index.html","public/app.js"]){
  let content=fs.readFileSync(path.join(source,rel),"utf8").replaceAll("One Less One Daniel","One Less One V17 Staging").replaceAll("Daniel","Staging V17").replaceAll("one_one_mobile_v1_","olo_v17_staging_mobile_");
  if(rel.endsWith(".html")){
   assert(content.includes("<body>"));content=content.replace("<body>","<body><p role=\"status\">V17 Staging · Solo datos de prueba</p>");
  }
  fs.writeFileSync(path.join(dir,rel),content);
 }
 const config={name:"one-less-one-mobile-v17-staging",main:"staging/worker.mjs",compatibility_date:"2026-11-16",workers_dev:true,preview_urls:false,d1_databases:[{binding:"V17_STAGING_DB",database_name:"one-less-one-mobile-v17-staging",database_id:"REQUIRES_NEW_STAGING_D1_UUID"}],vars:{V17_STAGING_MODE:"synthetic-only",ALLOWED_DESKTOP_ORIGINS:DESKTOP},assets:{directory:"./public",binding:"ASSETS",run_worker_first:true}};
 fs.writeFileSync(path.join(dir,"wrangler.staging.jsonc"),JSON.stringify(config,null,2)+"\n");
 fs.writeFileSync(path.join(dir,"LEEME.txt"),"SOLO PRUEBAS. No desplegado. No usar D1, secretos, catálogo o datos reales de producción. El UUID es deliberadamente inválido. Crear y verificar una D1 independiente antes de aplicar staging/schema.sql. Usar secretos V17_STAGING_MOBILE_WRITE_KEY y V17_STAGING_DESKTOP_SYNC_KEY, distintos entre sí y de producción. El bridge web permanece desconectado. No usar wrangler deploy desde este paquete sin revisión explícita.");
 return config;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))build(path.resolve(source,"../preview-v17-mobile-staging"));
