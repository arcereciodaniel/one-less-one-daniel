import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import worker,{HOST,DESKTOP} from "./worker.mjs";
import {build} from "./build.mjs";
function setup(){
 const db=new DatabaseSync(":memory:");
 db.exec(fs.readFileSync(new URL("./schema.sql",import.meta.url),"utf8"));
 db.exec("CREATE TABLE pilot_inbox(id TEXT PRIMARY KEY, payload TEXT); INSERT INTO pilot_inbox VALUES('production-sentinel','private'); CREATE TABLE pilot_catalog(id INTEGER PRIMARY KEY, payload TEXT); INSERT INTO pilot_catalog VALUES(1,'private');");
 const queries=[];
 const D1={prepare(sql){queries.push(sql);const stmt=db.prepare(sql);let args=[];return {bind(...v){args=v;return this},async first(){return stmt.get(...args)??null},async all(){return {results:stmt.all(...args)}},async run(){stmt.run(...args);return {success:true}}}}};
 const env={V17_STAGING_MODE:"synthetic-only",V17_STAGING_DB:D1,V17_STAGING_MOBILE_WRITE_KEY:"a".repeat(40),V17_STAGING_DESKTOP_SYNC_KEY:"b".repeat(40),MOBILE_WRITE_KEY:"p".repeat(40),DESKTOP_SYNC_KEY:"q".repeat(40),ASSETS:{fetch:async()=>new Response("V17 Staging")}};
 const req=(route,method="GET",key="",body,origin=DESKTOP,host=HOST,override=env)=>worker.fetch(new Request("https://"+host+route,{method,headers:{...(origin?{Origin:origin}:{}),...(key?{Authorization:"Bearer "+key}:{}),...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})}),override);
 return {db,queries,env,req};
}
test("staging blocks wrong host, production origin, missing marker, reused role key and production credentials",async()=>{
 const {db,queries,env,req}=setup();
 try{
  assert.equal((await req("/api/health","GET","",null,DESKTOP,"one-less-one-mobile-daniel.one-less-one-rastro.workers.dev")).status,403);
  assert.equal((await req("/api/inbox","GET",env.V17_STAGING_DESKTOP_SYNC_KEY,null,"https://arcereciodaniel.github.io")).status,403);
  assert.equal(queries.length,0);
  assert.equal((await req("/api/inbox","GET",env.DESKTOP_SYNC_KEY)).status,401);
  assert.equal((await req("/api/inbox","GET",env.V17_STAGING_MOBILE_WRITE_KEY)).status,401);
  assert.equal((await req("/api/health","GET","",null,DESKTOP,HOST,{...env,V17_STAGING_DESKTOP_SYNC_KEY:env.V17_STAGING_MOBILE_WRITE_KEY})).status,503);
  db.exec("DELETE FROM v17_staging_identity");
  assert.equal((await req("/api/inbox","GET",env.V17_STAGING_DESKTOP_SYNC_KEY)).status,503);
  assert(!queries.some(q=>/\bpilot_(inbox|catalog)\b/.test(q)));
 }finally{db.close()}
});
test("staging D1 captures synthetic CRC/USD movements, simple and split collections; retries and ack never touch production tables",async()=>{
 const {db,queries,env,req}=setup(),d=env.V17_STAGING_DESKTOP_SYNC_KEY,p=env.V17_STAGING_MOBILE_WRITE_KEY,date=new Date().toISOString().slice(0,10);
 try{
  assert.equal((await req("/api/catalog","PUT",d,{categories:[{id:"g",name:"Prueba",type:"Gasto",amount:999},{id:"i",name:"Prueba",type:"Ingreso"}],debts:[],goals:[]})).status,200);
  const cat=await (await req("/api/catalog","GET",p,null,"https://"+HOST)).json();assert(!JSON.stringify(cat).includes("999"));
  const records=[{type:"Gasto",currency:"CRC",categoryId:"g",amount:2500},{type:"Ingreso",currency:"USD",categoryId:"i",amount:42},{type:"Cobro",currency:"USD",person:"Prueba A",amount:15},{type:"Cobro dividido",currency:"USD",groupName:"Prueba",amount:30,splitMode:"equal",selfShares:1,participants:[{person:"Prueba B",shares:1}]}];
  for(let i=0;i<records.length;i++){
   const payload={id:"staging-test-unique-"+i,movement:{...records[i],date}};
   const a=await req("/api/inbox","POST",p,payload,"https://"+HOST);assert.equal(a.status,200,await a.text());
   assert.equal((await req("/api/inbox","POST",p,payload,"https://"+HOST)).status,200);
  }
  assert.equal((await req("/api/inbox","POST",p,{id:"staging-reject-debt",movement:{type:"Pago deuda",date,currency:"CRC",amount:1,debtId:"d"}})).status,400);
  const inbox=await (await req("/api/inbox","GET",d)).json();assert.equal(inbox.items.length,4);
  assert.equal((await req("/api/ack","POST",p,{id:inbox.items[0].id})).status,401);
  for(const item of inbox.items)assert.equal((await req("/api/ack","POST",d,{id:item.id})).status,200);
  assert.equal((await (await req("/api/inbox","GET",d)).json()).items.length,0);
  assert.equal(db.prepare("SELECT payload FROM pilot_inbox").get().payload,"private");
  assert.equal(db.prepare("SELECT payload FROM pilot_catalog").get().payload,"private");
  assert(!queries.some(q=>/\bpilot_(inbox|catalog)\b/.test(q)));
 }finally{db.close()}
});
test("staging bundle is separately named and cannot deploy with placeholder D1; mobile assets retain independent storage",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"olo-mobile-stg-"));
 try{const c=build(dir);assert.equal(c.name,"one-less-one-mobile-v17-staging");assert.equal(c.d1_databases[0].binding,"V17_STAGING_DB");assert.match(c.d1_databases[0].database_id,/REQUIRES_NEW/);
 const app=fs.readFileSync(path.join(dir,"public/app.js"),"utf8");assert(app.includes("olo_v17_staging_mobile_"));assert(!app.includes("one_one_mobile_v1_"));assert(!app.includes("One Less One Daniel"));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
