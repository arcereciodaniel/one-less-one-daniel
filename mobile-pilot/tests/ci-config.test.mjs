import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildDeployConfig} from "../scripts/prepare-ci-config.mjs";

const template=JSON.parse(readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8"));
const SAMPLE="12345678-1234-1234-1234-123456789abc";

test("CI: reutiliza el Worker y la base D1 existentes",()=>{
 const original=structuredClone(template);
 const ready=buildDeployConfig(template,SAMPLE);
 assert.equal(ready.name,"one-less-one-mobile-daniel");
 assert.equal(ready.d1_databases[0].database_name,"one-less-one-mobile-daniel");
 assert.equal(ready.d1_databases[0].database_id,SAMPLE);
 assert.equal(ready.assets.directory,"./public");
 assert.equal(ready.assets.binding,"ASSETS");
 assert.equal(ready.assets.run_worker_first,true);
 assert.equal(ready.vars.ALLOWED_DESKTOP_ORIGINS,"https://arcereciodaniel.github.io");
 assert.deepEqual(ready.secrets.required,["MOBILE_WRITE_KEY","DESKTOP_SYNC_KEY"]);
 assert.deepEqual(template,original);
});

test("CI: rechaza IDs de ejemplo, configuración equivocada y dominio no permitido",()=>{
 assert.throws(()=>buildDeployConfig(template,"REEMPLAZAR_CON_DATABASE_ID"),/UUID/);
 assert.throws(()=>buildDeployConfig(template,""),/UUID/);
 assert.throws(()=>buildDeployConfig({...template,name:"one-less-one-mobile-lab"},SAMPLE),/Daniel/);
 assert.throws(()=>buildDeployConfig({...template,vars:{ALLOWED_DESKTOP_ORIGINS:"https://otro.example"}},SAMPLE),/origen autorizado/);
});

test("CI: archivos privados fuera de Git",()=>{
 const ignore=readFileSync(new URL("../.gitignore",import.meta.url),"utf8");
 assert.match(ignore,/wrangler\.ci\.jsonc/);
 assert.match(ignore,/\.dev\.vars\*/);
 assert.match(ignore,/\.env\*/);
 assert.match(ignore,/wrangler\.jsonc\.backup\*/);
});
