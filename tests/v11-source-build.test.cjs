"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {buildApp,PARTS,CSS_TOKEN,SCRIPT_TOKEN} = require("../scripts/build-app.cjs");
const {labFromDaniel} = require("../scripts/build-lab.cjs");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root,file),"utf8");

test("V12: los trece módulos componen exactamente el archivo de Daniel",()=>{
 assert.equal(PARTS.length,15);
 const generated=buildApp();
 assert.equal(generated,read("index.html"));
 assert.equal(labFromDaniel(generated),read("lab/index.html"));
 const inline=generated.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
 assert(inline,"El script financiero sigue presente");
 assert.doesNotThrow(()=>new vm.Script(inline),"La composición mantiene JavaScript válido");
});

test("V12: las fuentes están aisladas de los archivos públicos y no son runtime externos",()=>{
 const template=read("src/app-shell.html");
 assert.equal(template.split(CSS_TOKEN).length,2);
 assert.equal(template.split(SCRIPT_TOKEN).length,2);
 const generated=buildApp();
 assert(!generated.includes(CSS_TOKEN)&&!generated.includes(SCRIPT_TOKEN));
 assert(!generated.includes('src/modules/'));
 assert(!generated.includes('src/styles/'));
 for(const part of PARTS)assert(fs.statSync(path.join(root,"src/modules",part)).size>0);
 const publish=read(".github/workflows/pages-gated.yml");
 assert(!publish.includes("cp -r src")&&!publish.includes("cp -R src"));
 assert(publish.includes("node scripts/build-app.cjs --check"));
});

test("V12: claves de datos intactas, Lab separado y móvil sin migración",()=>{
 const main=buildApp(),lab=labFromDaniel(main);
 assert(main.includes('const STORAGE_KEY = "daniel_finanzas_local_v1";'));
 assert(lab.includes('const STORAGE_KEY = "rastro_lab_v7_1_data_v1";'));
 assert(main.includes('const UI_STORAGE_KEY = "daniel_finanzas_ui_v1";'));
 assert(lab.includes('const UI_STORAGE_KEY = "rastro_lab_v7_1_ui_v1";'));
 assert(main.includes('src="mobile-pilot/desktop.js"'));
 assert(lab.includes('src="../mobile-pilot/desktop.js"'));
 assert(main.includes('<small class="brand-version">v16.0.0</small>'));
 assert(lab.includes('<small class="brand-version">v16.0.0 LAB</small>'));
});
