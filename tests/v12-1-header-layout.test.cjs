"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {JSDOM}=require("jsdom");
const css=fs.readFileSync("src/styles/app.css","utf8");
const shell=fs.readFileSync("src/app-shell.html","utf8");
const daniel=fs.readFileSync("index.html","utf8"),lab=fs.readFileSync("lab/index.html","utf8");
const marker="/* V12.1.3 · Navegación centrada y expansiva en escritorio.";
const block=css.slice(css.indexOf(marker));
assert(block.length>1000,"No está el hotfix minimalista");
test("V12.1.3: escritorio tiene marca, navegación y controles en la misma fila",()=>{
 assert.match(block,/grid-template-columns:max-content minmax\(0,1fr\) max-content/);
 assert.match(block,/grid-template-areas:"brand nav utilities"/);
 assert.match(block,/justify-content:safe center!important/,"Los módulos deben centrarse en el espacio disponible");
 assert.match(block,/@media\(min-width:1300px\)/,"Falta el centrado simétrico de escritorio");
 assert.match(block,/grid-template-columns:minmax\(205px,1fr\) minmax\(0,max-content\) minmax\(205px,1fr\)/);
 assert.match(block,/justify-self:center/);
 assert.match(block,/justify-content:center!important/);
 assert.match(block,/header \.topbar>nav#nav\s*\{[\s\S]*?flex-wrap:nowrap!important/);
 assert.match(block,/overflow-x:auto!important/);
 assert.match(block,/header \.topbar>nav#nav \.one-beta-tag\{display:none!important\}/);
 assert.match(block,/@media\(max-width:800px\)/);
 assert.match(block, /"brand utilities" "nav nav"/);
});
test("V12.1.3: menú completo, preferencias y configuración sin herramientas extra en barra",()=>{
 for(const [name,html] of [["Daniel",daniel],["Lab",lab]]){
  const doc=new JSDOM(html).window.document;
  const nav=doc.getElementById("nav"),bar=doc.querySelector("header .one-utility-bar");
  const all=["dashboard","plan","movements","debts","shared","capital","projects","future"];
  assert.deepEqual([...nav.querySelectorAll("button[data-view]")].map(b=>b.dataset.view),all);
  for(const el of nav.querySelectorAll("[data-optional-module]"))el.hidden=false;
  assert.equal(nav.querySelectorAll('button:not([hidden])').length,9);
  assert.equal(nav.lastElementChild.id,"manageModulesBtn","El botón + debe conservarse al final de los módulos");
  assert.equal(nav.querySelectorAll("button[data-view]:not([hidden])").length,8);
  assert.equal(bar.querySelectorAll("button").length,5);
  assert(bar.querySelector(".one-minimal-settings-btn svg"));
  assert.equal(bar.querySelectorAll("[data-theme-choice]").length,2);
  assert.equal(bar.querySelectorAll("[data-display-currency]").length,2);
  for(const id of ["fxBtn","exportBtn","importBtn","importFile","oneBackupNotice"]){
   assert(doc.getElementById(id));
   assert(doc.getElementById("oneSettingsDialog").contains(doc.getElementById(id)));
   assert(!bar.contains(doc.getElementById(id)));
  }
  assert(html.includes('<small class="brand-version">v16.0.0-rc.1'+(name==="Lab"?" LAB":"")+'</small>'));
 }
});
test("V12.1.3: compilación de Daniel y Lab comparte CSS y mantiene aislamiento",()=>{
 assert(shell.includes("id=\"oneSettingsFxDetail\""));
 assert(daniel.includes(block.trim())&&lab.includes(block.trim()));
 assert(daniel.includes('const STORAGE_KEY = "daniel_finanzas_local_v1";'));
 assert(lab.includes('const STORAGE_KEY = "rastro_lab_v7_1_data_v1";'));
});
