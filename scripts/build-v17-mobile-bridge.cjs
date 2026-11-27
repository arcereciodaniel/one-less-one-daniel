"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{buildCandidate:pre}=require("./build-v17-prerelease.cjs"),{buildStaging}=require("./build-v17-staging.cjs");
const root=path.resolve(__dirname,".."),ENDPOINT="https://one-less-one-mobile-v17-staging.one-less-one-rastro.workers.dev";
function buildCandidate(){
 let h=pre(),desktop=fs.readFileSync(path.join(root,"mobile-pilot/desktop.js"),"utf8");
 const start=desktop.indexOf("  function catalog(){"),end=desktop.indexOf("  async function fetchAndImport(");
 assert(start>0&&end>start);
 const native=desktop.slice(start,end),read=p=>fs.readFileSync(path.join(root,p),"utf8");
 const replace=(a,b)=>{assert.equal(h.split(a).length,2,"Marker "+a);h=h.replace(a,()=>b)};
 replace("connect-src 'none'","connect-src "+ENDPOINT);
 replace('<div id="rc-integrityReport"></div>','<details class="demo-alloc-list" id="rc-mobileStaging"><summary>Registro desde iPhone · Prueba</summary><small class="muted">Solo datos ficticios. Conexión manual, sin guardar la clave.</small><label for="rc-mobileStagingKey">Clave de sincronización de pruebas</label><input id="rc-mobileStagingKey" type="password" autocomplete="off" minlength="32"><button type="button" class="btn secondary" id="rc-mobileStagingSync">Sincronizar prueba</button><p id="rc-mobileStagingStatus" role="status"></p></details><div id="rc-integrityReport"></div>');
 replace('el("migrationFile").disabled=active||nativeBlocked;el("sessionFile").disabled=active||nativeBlocked;','el("migrationFile").disabled=true;el("sessionFile").disabled=true;el("migrationDetails").hidden=true;');
 for(const marker of ['el("sessionFile").onchange=async()=>{','el("migrationFile").onchange=async()=>{','el("sessionConfirm").onclick=()=>{','el("migrationConfirm").onclick=()=>{'])replace(marker,marker+'return;');
 const hook='theme(initialVisual.theme==="light"?"light":"dark");updateMigrationControls();render();';
 replace(hook,read("src/experimental/v17-mobile-bridge.cjs")+'\n(function(){\n'+native+'\n'+read("src/experimental/v17-mobile-bridge-ui.js")+'\n})();\n'+hook);
 assert(!/<script\s+src=/i.test(h));return h;
}
if(require.main===module)buildStaging(path.join(root,"preview-v17-mobile-bridge"),{candidate:buildCandidate(),mobile:true});
module.exports={buildCandidate,ENDPOINT};
