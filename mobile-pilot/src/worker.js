/**
 * One Less One · Mobile Capture Pilot (Lab + Daniel)
 * Never embed secrets or real financial data in this repository.
 * POST /api/inbox: phone, GET /api/catalog: phone
 * GET /api/inbox, POST /api/ack, PUT /api/catalog: desktop
 */
const BASE_HEADERS={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const TYPES=new Set(["Gasto","Ingreso","Pago deuda","Cobro","Aporte"]);
const MAX_BODY=8192;
function json(body,status=200,extra={}){
 return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8",...BASE_HEADERS,...extra}});
}
function access(request,env){
 const origin=request.headers.get("Origin")||"";
 const allowed=String(env.ALLOWED_DESKTOP_ORIGINS||"").split(",").map(s=>s.trim()).filter(Boolean);
 const own=new URL(request.url).origin;
 if(!origin)return {};
 if(origin===own||allowed.includes(origin))return {"Access-Control-Allow-Origin":origin,"Vary":"Origin","Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Allow-Methods":"GET, POST, PUT, OPTIONS"};
 return null;
}
function permitted(request,env,role){
 const raw=request.headers.get("Authorization")||"";
 const expected=role==="phone"?env.MOBILE_WRITE_KEY:env.DESKTOP_SYNC_KEY;
 return typeof expected==="string"&&expected.length>=32&&raw===("Bearer "+expected);
}
function validDate(s){
 if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const date=new Date(s+"T00:00:00Z");
 return !Number.isNaN(+date)&&date.toISOString().slice(0,10)===s;
}
function validId(v){return typeof v==="string"&&/^[a-zA-Z0-9_-]{16,80}$/.test(v)}
function clean(v,max=160){return typeof v==="string"?v.trim().slice(0,max):""}
function checkPayload(p){
 if(!p||typeof p!=="object"||Array.isArray(p))throw Error("Datos incompletos");
 const type=clean(p.type,24),date=clean(p.date,10),amount=Number(p.amount);
 if(!TYPES.has(type)||!validDate(date)||!Number.isFinite(amount)||amount<=0||amount>1e9||Math.abs(Math.round(amount*100)-amount*100)>1e-5)
   throw Error("Tipo, fecha o monto inválidos");
 // La prueba piloto no permite USD: la cotización del día del gasto aún no está sincronizada.
 if(p.currency!=="CRC")throw Error("Piloto disponible solo para CRC");
 const now=new Date(),today=now.toISOString().slice(0,10),earliest=new Date(now.getTime()-366*864e5).toISOString().slice(0,10);
 if(date>today||date<earliest)throw Error("Fecha fuera del período permitido");
 const categoryId=clean(p.categoryId,80),debtId=clean(p.debtId,80),reserveId=clean(p.reserveId,80);
 const person=clean(p.person,120),description=clean(p.description,200);
 const dueDate=clean(p.dueDate,10);
 if((type==="Gasto"||type==="Ingreso")&&!categoryId)throw Error("Elegí una categoría");
 if(type==="Pago deuda"&&!debtId)throw Error("Elegí la deuda");
 if(type==="Aporte"&&!reserveId)throw Error("Elegí la meta");
 if(type==="Cobro"&&!person)throw Error("Indicá la persona");
 if(dueDate&&!validDate(dueDate))throw Error("Fecha esperada inválida");
 return {type,date,amount,currency:"CRC",categoryId,debtId,reserveId,person,description,dueDate};
}
async function body(request){
 const size=Number(request.headers.get("Content-Length")||0);
 if(size>MAX_BODY)throw Error("Solicitud demasiado grande");
 const text=await request.text();
 if(text.length>MAX_BODY)throw Error("Solicitud demasiado grande");
 return JSON.parse(text);
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname,headers=access(request,env);
  if(path.startsWith("/api/")){
   if(headers===null)return json({error:"Origen no autorizado"},403);
   if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{...headers,...BASE_HEADERS}});
   if(!env.DB)return json({error:"Falta la conexión D1"},503,headers);
   try{
    if(path==="/api/health"&&request.method==="GET")
      return json({ok:true,service:"One Less One Mobile",version:1},200,headers);
    if(path==="/api/catalog"&&request.method==="GET"){
     if(!permitted(request,env,"phone"))return json({error:"Acceso denegado"},401,headers);
     const row=await env.DB.prepare("SELECT payload FROM pilot_catalog WHERE id=1").first();
     return json({catalog:row?JSON.parse(row.payload):null},200,headers);
    }
    if(path==="/api/catalog"&&request.method==="PUT"){
     if(!permitted(request,env,"desktop"))return json({error:"Acceso denegado"},401,headers);
     const payload=await body(request);
     const groups=["categories","debts","goals"];
     if(!payload||groups.some(k=>!Array.isArray(payload[k])||payload[k].length>200))
       return json({error:"Catálogo inválido"},400,headers);
     const catalog={};
     for(const group of groups){
      catalog[group]=payload[group].map(x=>({id:clean(x.id,80),name:clean(x.name,120),...(group==="categories"?{type:clean(x.type,24)}:{})}))
       .filter(x=>x.id&&x.name);
     }
     await env.DB.prepare("INSERT INTO pilot_catalog(id,payload,updated_at) VALUES(1,?,datetime('now')) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at").bind(JSON.stringify(catalog)).run();
     return json({ok:true},200,headers);
    }
    if(path==="/api/inbox"&&request.method==="POST"){
     if(!permitted(request,env,"phone"))return json({error:"Acceso denegado"},401,headers);
     const submission=await body(request);
     if(!validId(submission?.id))return json({error:"Identificador inválido"},400,headers);
     let cleanPayload;
     try{cleanPayload=checkPayload(submission?.movement)}catch(e){return json({error:e.message},400,headers);}
     const catalogRow=await env.DB.prepare("SELECT payload FROM pilot_catalog WHERE id=1").first();
     if(!catalogRow)return json({error:"Configurá primero el piloto desde One Less One Daniel"},409,headers);
     const catalog=JSON.parse(catalogRow.payload);
     const type=cleanPayload.type;
     if((type==="Gasto"||type==="Ingreso")&&!catalog.categories.some(c=>c.id===cleanPayload.categoryId&&c.type===type))
       return json({error:"Categoría no disponible. Actualizá el catálogo desde Daniel"},409,headers);
     if(type==="Pago deuda"&&!catalog.debts.some(d=>d.id===cleanPayload.debtId))
       return json({error:"Deuda no disponible"},409,headers);
     if(type==="Aporte"&&!catalog.goals.some(g=>g.id===cleanPayload.reserveId))
       return json({error:"Meta no disponible"},409,headers);
     await env.DB.prepare("INSERT OR IGNORE INTO pilot_inbox(id,payload,created_at,status) VALUES(?,?,datetime('now'),'pending')").bind(submission.id,JSON.stringify(cleanPayload)).run();
     return json({ok:true,id:submission.id,received:true},200,headers);
    }
    if(path==="/api/inbox"&&request.method==="GET"){
     if(!permitted(request,env,"desktop"))return json({error:"Acceso denegado"},401,headers);
     // Los registros importados se eliminan después de 30 días; solo se ejecuta al sincronizar.
     await env.DB.prepare("DELETE FROM pilot_inbox WHERE status='imported' AND imported_at < datetime('now', '-30 days')").run();
     const res=await env.DB.prepare("SELECT id,payload,created_at FROM pilot_inbox WHERE status='pending' ORDER BY created_at,id LIMIT 100").all();
     return json({items:(res.results||[]).map(x=>({id:x.id,movement:JSON.parse(x.payload),receivedAt:x.created_at}))},200,headers);
    }
    if(path==="/api/ack"&&request.method==="POST"){
     if(!permitted(request,env,"desktop"))return json({error:"Acceso denegado"},401,headers);
     const payload=await body(request);
     if(!validId(payload?.id))return json({error:"ID inválido"},400,headers);
     await env.DB.prepare("UPDATE pilot_inbox SET status='imported',imported_at=datetime('now') WHERE id=?").bind(payload.id).run();
     return json({ok:true},200,headers);
    }
    return json({error:"Ruta no encontrada"},404,headers);
   }catch(error){
    return json({error:"Error de solicitud o almacenamiento"},500,headers);
   }
  }
  if(request.method!=="GET"&&request.method!=="HEAD")return json({error:"Método inválido"},405);
  if(env.ASSETS){const response=await env.ASSETS.fetch(request);
    const out=new Response(response.body,response);
    out.headers.set("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    out.headers.set("X-Content-Type-Options","nosniff");return out;}
  return json({error:"Faltan assets"},404);
 }
};
