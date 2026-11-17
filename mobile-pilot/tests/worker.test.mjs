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


test("D1: un split USD llega como un único registro idempotente con cobros individuales",async()=>{
 const {env,req,rows}=fixture();
 await req("/api/catalog","PUT",env.DESKTOP_SYNC_KEY,{categories:[],debts:[],goals:[]});
 const today=new Date().toISOString().slice(0,10);
 const movement={type:"Cobro dividido",date:today,amount:328,currency:"USD",
  groupName:"Hotel con amigos",description:"Reserva de hotel",dueDate:"",
  splitMode:"equal",selfShares:1,participants:[
   {person:"Charlie",shares:2},{person:"Ana",shares:1}]};
 const id="split-hotel-abcdefgh123456";
 const first=await req("/api/inbox","POST",env.MOBILE_WRITE_KEY,{id,movement});
 assert.equal(first.response.status,200,JSON.stringify(first.json));
 const retry=await req("/api/inbox","POST",env.MOBILE_WRITE_KEY,{id,movement});
 assert.equal(retry.response.status,200);
 assert.equal(rows.size,1,"No crear lotes duplicados por reintentar");
 const inbox=await req("/api/inbox","GET",env.DESKTOP_SYNC_KEY);
 const p=inbox.json.items[0].movement;
 assert.equal(p.type,"Cobro dividido");assert.equal(p.currency,"USD");
 assert.equal(p.selfAmount,82);assert.equal(p.participants[0].amount,164);
 assert.equal(p.participants[1].amount,82);
 await req("/api/ack","POST",env.DESKTOP_SYNC_KEY,{id});
 assert.equal((await req("/api/inbox","GET",env.DESKTOP_SYNC_KEY)).json.items.length,0);
});

test("D1: Cobro simple puede ser USD, pero gastos e ingresos móviles continúan CRC",async()=>{
 const {env,req}=fixture();
 await req("/api/catalog","PUT",env.DESKTOP_SYNC_KEY,{categories:[{id:"g1",name:"Alimentación",type:"Gasto"}],debts:[],goals:[]});
 const day=new Date().toISOString().slice(0,10);
 const cobro=await req("/api/inbox","POST",env.MOBILE_WRITE_KEY,
  {id:"simple-usd-abcdefgh123456",movement:{type:"Cobro",date:day,amount:50.5,currency:"USD",person:"Charlie",description:"Cena"}});
 assert.equal(cobro.response.status,200);
 const gasto=await req("/api/inbox","POST",env.MOBILE_WRITE_KEY,
  {id:"gasto-usd-abcdefgh123456",movement:{type:"Gasto",date:day,amount:50,currency:"USD",categoryId:"g1"}});
 assert.equal(gasto.response.status,400);
});
test("D1: no admite repartos personalizados que no cierren",async()=>{
 const {env,req,rows}=fixture();
 await req("/api/catalog","PUT",env.DESKTOP_SYNC_KEY,{categories:[],debts:[],goals:[]});
 const today=new Date().toISOString().slice(0,10);
 const bad=await req("/api/inbox","POST",env.MOBILE_WRITE_KEY,{
  id:"split-invalid-abcdefgh123456",movement:{type:"Cobro dividido",date:today,amount:328,
    currency:"USD",groupName:"Hotel",splitMode:"amount",selfAmount:82,selfShares:1,
    participants:[{person:"Charlie",amount:100,shares:2}]}});
 assert.equal(bad.response.status,400);
 assert.equal(rows.size,0);
});


test("Catálogo del iPhone incluye grupos y personas pero nunca importes",async()=>{
 const {env,req}=fixture();
 const groupId="santa-teresa-2026-11";
 const catalog={categories:[],debts:[],goals:[],groups:[{
  id:groupId,name:"Viaje a Santa Teresa",amount:50000,notes:"Privadas",
  people:["Charlie","Cardona","Joshua","charlie"]}]};
 const put=await req("/api/catalog","PUT",env.DESKTOP_SYNC_KEY,catalog);
 assert.equal(put.response.status,200);
 const r=(await req("/api/catalog","GET",env.MOBILE_WRITE_KEY)).json.catalog;
 assert.equal(r.groups[0].id,groupId);
 assert.equal(r.groups[0].name,"Viaje a Santa Teresa");
 assert(!JSON.stringify(r).includes("50000"));
 assert(!JSON.stringify(r).includes("Privadas"));
 assert.equal(r.groups[0].people.length,4);
});
test("iPhone agrega una cena al grupo existente sin crear otro grupo, excluye a Joshua",async()=>{
 const {env,req,rows}=fixture();
 const groupId="santa-teresa-2026-11";
 await req("/api/catalog","PUT",env.DESKTOP_SYNC_KEY,{
  categories:[],debts:[],goals:[],
  groups:[{id:groupId,name:"Viaje a Santa Teresa",people:["Charlie","Cardona","Joshua"]}]});
 const date=new Date().toISOString().slice(0,10);
 const entry={id:"cena-santa-teresa-abc12345",movement:{
  type:"Cobro dividido",groupId,groupName:"",description:"Cena del viernes",
  date,dueDate:"",amount:60,currency:"USD",
  splitMode:"equal",selfShares:1,participants:[{person:"Charlie",shares:1},{person:"Cardona",shares:1}]
 }};
 const first=await req("/api/inbox","POST",env.MOBILE_WRITE_KEY,entry);
 assert.equal(first.response.status,200,JSON.stringify(first.json));
 await req("/api/inbox","POST",env.MOBILE_WRITE_KEY,entry);
 assert.equal(rows.size,1);
 const r=(await req("/api/inbox","GET",env.DESKTOP_SYNC_KEY)).json.items[0].movement;
 assert.equal(r.groupId,groupId);
 assert.deepEqual(r.participants.map(p=>p.person),["Charlie","Cardona"]);
 assert.deepEqual(r.participants.map(p=>p.amount),[20,20]);
 assert.equal(r.selfAmount,20);
});
test("D1 impide relacionar cobros con grupos desconocidos y admite cobro simple agrupado",async()=>{
 const {env,req}=fixture();
 const groupId="santa-teresa-2026-11";
 await req("/api/catalog","PUT",env.DESKTOP_SYNC_KEY,{
  categories:[],debts:[],goals:[],groups:[{id:groupId,name:"Santa Teresa",people:["Charlie"]}]});
 const date=new Date().toISOString().slice(0,10);
 const missing=await req("/api/inbox","POST",env.MOBILE_WRITE_KEY,{
  id:"cena-grupo-inexistente-abc1",movement:{type:"Cobro dividido",groupId:"grupo-archivado",
   groupName:"",description:"Cena",date,amount:30,currency:"USD",splitMode:"equal",selfShares:1,
   participants:[{person:"Charlie",shares:1}]}});
 assert.equal(missing.response.status,409);
 const simple=await req("/api/inbox","POST",env.MOBILE_WRITE_KEY,{
  id:"cobro-simple-grupo-abc1234",movement:{type:"Cobro",groupId,person:"Charlie",
   description:"Taxi",date,amount:10,currency:"USD"}});
 assert.equal(simple.response.status,200);
 const found=(await req("/api/inbox","GET",env.DESKTOP_SYNC_KEY)).json.items[0].movement;
 assert.equal(found.groupId,groupId);
});
