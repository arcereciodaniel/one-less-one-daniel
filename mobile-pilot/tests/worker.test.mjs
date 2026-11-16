import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

function fixture(){
 const rows=new Map();let catalog=null;
 const env={
  MOBILE_WRITE_KEY:"m".repeat(40),
  DESKTOP_SYNC_KEY:"d".repeat(40),
  ALLOWED_DESKTOP_ORIGINS:"https://daniel.example.com",
  DB:{prepare(sql){
   let args=[];
   return {bind(...v){args=v;return this},
    async first(){
     if(sql.includes("pilot_catalog"))return catalog?{payload:JSON.stringify(catalog)}:null;
     return null;
    },
    async all(){
     if(sql.includes("pilot_inbox"))return {results:[...rows.values()].filter(x=>x.status==="pending").map(x=>({id:x.id,payload:x.payload,created_at:x.created_at}))};
     return {results:[]};
    },
    async run(){
     if(sql.includes("INSERT INTO pilot_catalog"))catalog=JSON.parse(args[0]);
     else if(sql.includes("INSERT OR IGNORE INTO pilot_inbox")&&!rows.has(args[0]))
      rows.set(args[0],{id:args[0],payload:args[1],created_at:"2026-11-16 13:00:00",status:"pending"});
     else if(sql.includes("UPDATE pilot_inbox")&&rows.has(args[0]))rows.get(args[0]).status="imported";
     return {success:true};
    }};
  }},
  ASSETS:{fetch:async()=>new Response("ok",{status:200,headers:{"Content-Type":"text/html"}})}
 };
 const req=async(path,method,token,payload,origin)=>{
  const url="https://pilot.example.workers.dev"+path;
  const headers={...(token?{Authorization:"Bearer "+token}:{}),...(payload?{"Content-Type":"application/json"}:{}),...(origin?{Origin:origin}:{})};
  const response=await worker.fetch(new Request(url,{method,headers,...(payload?{body:JSON.stringify(payload)}:{})}),env);
  return {response,json:await response.json()};
 };
 return {env,req,rows};
}
test("D1: solamente claves independientes acceden a su operación",async()=>{
 const {env,req}=fixture();
 const unauthorized=await req("/api/inbox","GET",env.MOBILE_WRITE_KEY,null,"https://daniel.example.com");
 assert.equal(unauthorized.response.status,401);
 const unauthorizedOrigin=await req("/api/inbox","GET",env.DESKTOP_SYNC_KEY,null,"https://intruso.example");
 assert.equal(unauthorizedOrigin.response.status,403);
 const allowed=await req("/api/inbox","GET",env.DESKTOP_SYNC_KEY,null,"https://daniel.example.com");
 assert.equal(allowed.response.status,200);
 assert.equal(allowed.response.headers.get("Access-Control-Allow-Origin"),"https://daniel.example.com");
});
test("D1: recibe, valida, evita duplicados y confirma solamente después del guardado",async()=>{
 const {env,req,rows}=fixture();
 const catalog={categories:[{id:"cat1",name:"Supermercado",type:"Gasto"}],debts:[],goals:[]};
 assert.equal((await req("/api/catalog","PUT",env.DESKTOP_SYNC_KEY,catalog)).response.status,200);
 const phoneCatalog=await req("/api/catalog","GET",env.MOBILE_WRITE_KEY);
 assert.equal(phoneCatalog.json.catalog.categories[0].id,"cat1");
 const id="mobile-entry-abcdefgh123456789";
 const today=new Date().toISOString().slice(0,10);
 const payload={id,movement:{type:"Gasto",date:today,amount:18500.29,currency:"CRC",categoryId:"cat1",description:"Supermercado"}};
 const one=await req("/api/inbox","POST",env.MOBILE_WRITE_KEY,payload);
 assert.equal(one.response.status,200);
 const two=await req("/api/inbox","POST",env.MOBILE_WRITE_KEY,payload);
 assert.equal(two.response.status,200);
 assert.equal(rows.size,1,"La repetición por red no debe duplicar el gasto");
 const before=await req("/api/inbox","GET",env.DESKTOP_SYNC_KEY);
 assert.equal(before.json.items.length,1);
 const bad=await req("/api/inbox","POST",env.MOBILE_WRITE_KEY,{id:"mobile-entry-bad-abcdefgh123",movement:{...payload.movement,amount:-1}});
 assert.equal(bad.response.status,400);
 const wrongCat=await req("/api/inbox","POST",env.MOBILE_WRITE_KEY,{id:"mobile-entry-badcat-abcdefgh",movement:{...payload.movement,categoryId:"otro"}});
 assert.equal(wrongCat.response.status,409);
 await req("/api/ack","POST",env.DESKTOP_SYNC_KEY,{id});
 assert.equal((await req("/api/inbox","GET",env.DESKTOP_SYNC_KEY)).json.items.length,0);
});
test("D1: no expone la interfaz a escritura con permisos de escritorio",async()=>{
 const {env,req}=fixture();
 const p={id:"mobile-entry-abcdefghijklmn",movement:{type:"Cobro",date:new Date().toISOString().slice(0,10),amount:20000,currency:"CRC",person:"Ana"}};
 assert.equal((await req("/api/inbox","POST",env.DESKTOP_SYNC_KEY,p)).response.status,401);
 const res=await worker.fetch(new Request("https://pilot.example.workers.dev/"),env);
 assert.equal(res.status,200);
 assert.match(res.headers.get("Content-Security-Policy"),/script-src 'self'/);
});
