import base from "../src/worker.js";
export const HOST="one-less-one-mobile-v17-staging.one-less-one-rastro.workers.dev";
export const DESKTOP="https://one-less-one-v17-daniel-staging.pages.dev";
const fail=(status=503)=>new Response(JSON.stringify({error:"Piloto V17 de pruebas no disponible"}),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
function stagingDB(db){
 return {prepare(sql){
  // Restrict the reused worker to its own table namespace, never native production tables.
  if(typeof sql!=="string"||!/\bpilot_(inbox|catalog)\b/.test(sql))throw Error("Consulta fuera del piloto");
  return db.prepare(sql.replace(/\bpilot_(inbox|catalog)\b/g,"v17_staging_$1"));
 }};
}
export default {async fetch(request,env){
 const url=new URL(request.url),origin=request.headers.get("Origin");
 if(url.protocol!=="https:"||url.host!==HOST)return fail(403);
 if(origin&&origin!==url.origin&&origin!==DESKTOP)return fail(403);
 const phone=env.V17_STAGING_MOBILE_WRITE_KEY,desktop=env.V17_STAGING_DESKTOP_SYNC_KEY;
 if(env.V17_STAGING_MODE!=="synthetic-only"||!env.V17_STAGING_DB||typeof phone!=="string"||typeof desktop!=="string"||phone.length<32||desktop.length<32||phone===desktop)return fail();
 try{
  const marker=await env.V17_STAGING_DB.prepare("SELECT purpose FROM v17_staging_identity WHERE id=1").first();
  if(marker?.purpose!=="olo-v17-staging-synthetic-v1")return fail();
 }catch{return fail()}
 const scoped={DB:stagingDB(env.V17_STAGING_DB),ASSETS:env.ASSETS,ALLOWED_DESKTOP_ORIGINS:DESKTOP,MOBILE_WRITE_KEY:phone,DESKTOP_SYNC_KEY:desktop};
 if(url.pathname==="/api/health"&&request.method==="GET"){
  return new Response(JSON.stringify({ok:true,service:"One Less One Mobile V17 Staging",mode:"synthetic-only"}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...(origin?{"Access-Control-Allow-Origin":origin,"Vary":"Origin"}:{})}});
 }
 // Enforce the mobile scope even if someone bypasses the UI. The base validates all financial fields.
 if(url.pathname==="/api/inbox"&&request.method==="POST"&&request.headers.get("Authorization")==="Bearer "+phone){
  try{
   if(Number(request.headers.get("Content-Length")||0)>8192)return fail(400);
   const text=await request.clone().text();if(text.length>8192)return fail(400);
   const p=JSON.parse(text);
   if(!["Gasto","Ingreso","Cobro","Cobro dividido"].includes(p?.movement?.type))return fail(400);
  }catch{return fail(400)}
 }
 return base.fetch(request,scoped);
}};
