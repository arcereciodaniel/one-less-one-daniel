"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {buildCandidate}=require("./build-v17-prerelease.cjs");
const ROOT=path.resolve(__dirname,".."),HOST="one-less-one-v17-daniel-staging.pages.dev";
const PREFIX="rastro_lab_v17_staging_";
const CSP="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; worker-src 'none'";
function buildStaging(dir,{candidate=buildCandidate(),mobile=false}={}){
 const prefix=mobile?"rastro_lab_v17_mobile_staging_":PREFIX;
 const h=candidate.replaceAll("rastro_lab_v17_prerelease_",prefix).replaceAll("V17 Pre-release","V17 Staging").replaceAll("V17.0 PRE","V17.0 STG");
 assert(!h.includes("rastro_lab_v17_prerelease_"));assert(!h.includes("daniel_finanzas_local_v1"));assert(!h.includes("rastro_lab_v7_1_data_v1"));const connect=mobile?"connect-src https://one-less-one-mobile-v17-staging.one-less-one-rastro.workers.dev":"connect-src 'none'";assert(h.includes(connect));
 // The shell gates the app before any native script can access storage.
 const encoded=JSON.stringify(h).replace(/</g,"\\u003c");
 const shell='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>One Less One · Staging</title></head><body><p>Entorno de pruebas no autorizado.</p><script>(function(){const allowed=(location.protocol==="https:"&&location.hostname==="'+HOST+'")||(location.protocol==="http:"&&["127.0.0.1","localhost"].includes(location.hostname));if(!allowed)return;const html='+encoded+';document.open();document.write(html);document.close()})();</script></body></html>';
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,"index.html"),shell);
 fs.writeFileSync(path.join(dir,"_headers"),"/*\n  Content-Security-Policy: "+CSP.replace("connect-src 'none'",connect)+"\n  Cache-Control: no-store\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n");
 fs.writeFileSync(path.join(dir,"robots.txt"),"User-agent: *\nDisallow: /\n");
}
if(require.main===module)buildStaging(path.join(ROOT,"preview-v17-staging"));
module.exports={buildStaging,HOST,PREFIX,CSP};
