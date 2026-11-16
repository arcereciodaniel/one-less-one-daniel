import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const scriptPath=fileURLToPath(import.meta.url);
const root=resolve(scriptPath,"../../");
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORIGIN="https://arcereciodaniel.github.io";
const NAME="one-less-one-mobile-daniel";

export function buildDeployConfig(template,d1Id){
 if(!uuid.test(String(d1Id||"")))throw new Error("CLOUDFLARE_D1_DATABASE_ID debe contener el UUID de la D1 existente.");
 if(!template || template.name!==NAME || template.main!=="src/worker.js")
  throw new Error("La configuración no pertenece al Worker móvil de Daniel.");
 if(!Array.isArray(template.d1_databases)||template.d1_databases.length!==1||
    template.d1_databases[0].binding!=="DB"||template.d1_databases[0].database_name!==NAME)
  throw new Error("La configuración de D1 no coincide con la base existente de Daniel.");
 if(template.vars?.ALLOWED_DESKTOP_ORIGINS!==ORIGIN)
  throw new Error("El origen autorizado debe ser https://arcereciodaniel.github.io sin rutas.");
 const prepared=structuredClone(template);
 prepared.d1_databases[0].database_id=d1Id;
 prepared.assets={directory:"./public",binding:"ASSETS",run_worker_first:true};
 prepared.secrets={required:["MOBILE_WRITE_KEY","DESKTOP_SYNC_KEY"]};
 return prepared;
}

if(process.argv[1] && resolve(process.argv[1])===scriptPath){
 const template=JSON.parse(readFileSync(resolve(root,"wrangler.jsonc"),"utf8"));
 const prepared=buildDeployConfig(template,process.env.CLOUDFLARE_D1_DATABASE_ID);
 writeFileSync(resolve(root,"wrangler.ci.jsonc"),JSON.stringify(prepared,null,2)+"\n",{mode:0o600});
 console.log("Configuración temporal creada sin revelar el identificador D1.");
}
