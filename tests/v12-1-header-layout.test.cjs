"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM}=require("jsdom");
const css=fs.readFileSync("src/styles/app.css","utf8");
const source=fs.readFileSync("src/app-shell.html","utf8");
const daniel=fs.readFileSync("index.html","utf8");
const lab=fs.readFileSync("lab/index.html","utf8");
const block=css.slice(css.indexOf("/* V12.1.1 · Hotfix estructural del encabezado."));
assert(block.length>500,"No aparece el CSS del hotfix");
test("V12.1.1: marca, navegación y utilidades tienen filas CSS Grid separadas",()=>{
 assert.match(block,/header \.topbar\s*\{\s*display:grid!important/);
 assert.match(block,/grid-template-areas:\s*"brand utilities"\s*"nav nav"/);
 assert.match(block,/header \.topbar>nav#nav\s*\{[\s\S]*?flex-wrap:wrap!important/);
 assert.match(block,/header \.topbar>nav#nav>button\s*\{\s*flex:0 0 auto!important/);
 assert.match(block,/header \.topbar>\.header-actions\.one-utility-bar\s*\{\s*grid-area:utilities/);
});
test("V12.1.1: los breakpoints reordenan sin colisionar ni ocultar módulos",()=>{
 assert.match(block,/@media\(max-width:1400px\)\s*\{[\s\S]*?"brand nav"\s*"utilities utilities"/);
 assert.match(block,/@media\(max-width:980px\)\s*\{[\s\S]*?"brand"\s*"nav"\s*"utilities"/);
 assert.match(block,/@media\(max-width:580px\)/);
 assert.doesNotMatch(block,/display:none!important/);
 assert.doesNotMatch(block,/overflow-x:hidden/);
});
test("V12.1.1: los nueve botones siguen disponibles al activar todas las herramientas",()=>{
 for(const [name,html] of [["Daniel",daniel],["Lab",lab]]){
  const doc=new JSDOM(html).window.document,nav=doc.getElementById("nav");
  assert(nav,name+" no tiene menú");
  const expected=["dashboard","plan","movements","debts","shared","capital","projects","future"];
  const actual=Array.from(nav.querySelectorAll("button[data-view]")).map(x=>x.dataset.view);
  assert.deepEqual(actual,expected,name+" tiene módulos incorrectos");
  assert(nav.querySelector("#manageModulesBtn"));
  for(const element of nav.querySelectorAll("[data-optional-module]"))element.hidden=false;
  assert.equal(nav.querySelectorAll('button:not([hidden])').length,9);
  assert.equal(doc.querySelectorAll(".header-actions.one-utility-bar").length,1);
  assert.equal(doc.querySelectorAll("#fxBtn,#oneSettingsBtn,#exportBtn,#importBtn").length,4);
  assert(doc.querySelector(".brand"));
  assert(html.includes('<small class="brand-version">v12.1.1'+(name==="Lab"?" LAB":"")+'</small>'));
 }
 assert.match(source,/id="nav"/);
});
test("V12.1.1: el mismo CSS se usa en Daniel y Lab, sin mover claves financieras",()=>{
 assert(daniel.includes(block.trim()));
 assert(lab.includes(block.trim()));
 assert(daniel.includes('const STORAGE_KEY = "daniel_finanzas_local_v1";'));
 assert(lab.includes('const STORAGE_KEY = "rastro_lab_v7_1_data_v1";'));
});
