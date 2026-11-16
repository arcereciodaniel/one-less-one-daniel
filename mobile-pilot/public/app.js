"use strict";
const KEY="one_one_mobile_v1_key",DRAFT="one_one_mobile_v1_draft";
const $=id=>document.getElementById(id);
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
let catalog=null,kind="Gasto",pending=null,submitting=false;
function status(message="",tone=""){const e=$("status");e.textContent=message;e.className="status "+tone;}
function auth(){return {"Authorization":"Bearer "+(localStorage.getItem(KEY)||"")};}
async function api(path,{method="GET",data}={}){
 const response=await fetch("/api/"+path,{method,cache:"no-store",headers:{...auth(),...(data?{"Content-Type":"application/json"}:{})},...(data?{body:JSON.stringify(data)}:{})});
 let payload;try{payload=await response.json();}catch{throw Error("No se recibió una respuesta válida");}
 if(!response.ok)throw Error(payload.error||"No se pudo conectar");
 return payload;
}
function fill(id,rows){const select=$(id);select.replaceChildren();const empty=document.createElement("option");empty.value="";empty.textContent="Seleccioná una opción";select.append(empty);for(const item of rows){const o=document.createElement("option");o.value=item.id;o.textContent=item.name;select.append(o);}}
function options(){
 const categories=(catalog?.categories||[]).filter(c=>c.type===kind);
 fill("categoryId",categories);fill("debtId",catalog?.debts||[]);fill("reserveId",catalog?.goals||[]);
}
async function refresh(){
 try{
  const result=await api("catalog");
  if(!result.catalog)throw Error("Primero vinculá el piloto desde One Less One Daniel");
  catalog=result.catalog;options();status("");
  $("setup").hidden=true;$("capture").hidden=false;
  return true;
 }catch(e){status(e.message,"error");return false;}
}
function setType(type){
 kind=type;for(const b of document.querySelectorAll("[data-type]")){const active=b.dataset.type===type;b.classList.toggle("selected",active);b.setAttribute("aria-pressed",String(active));}
 $("categoryField").hidden=!["Gasto","Ingreso"].includes(type);
 $("debtField").hidden=type!=="Pago deuda";$("goalField").hidden=type!=="Aporte";
 $("personField").hidden=type!=="Cobro";$("dueField").hidden=type!=="Cobro";
 $("categoryId").required=["Gasto","Ingreso"].includes(type);
 $("debtId").required=type==="Pago deuda";$("reserveId").required=type==="Aporte";
 $("person").required=type==="Cobro";
 $("submit").textContent=type==="Gasto"?"Registrar gasto":type==="Ingreso"?"Registrar ingreso":type==="Pago deuda"?"Registrar pago":type==="Cobro"?"Crear cobro":"Aportar a meta";
 options();
}
function restoreDraft(){
 try{
  const x=JSON.parse(localStorage.getItem(DRAFT)||"null");
  if(!x?.id||!x?.movement)return;
  pending=x;
  const p=x.movement;
  setType(p.type);for(const field of ["date","amount","categoryId","debtId","reserveId","person","description","dueDate"]){
   if($(field)&&p[field]!==undefined)$(field).value=p[field];
  }
  freeze(true);status("El último envío no fue confirmado. Tocá Reintentar para evitar duplicados.","error");
 }catch{}
}
function freeze(locked){
 for(const field of $("entryForm").querySelectorAll("input,select"))field.disabled=locked;
 for(const b of document.querySelectorAll("[data-type]"))b.disabled=locked;
 $("submit").textContent=locked?"Reintentar envío":kind==="Gasto"?"Registrar gasto":kind==="Ingreso"?"Registrar ingreso":kind==="Pago deuda"?"Registrar pago":kind==="Cobro"?"Crear cobro":"Aportar a meta";
}
function movement(){
 const out={type:kind,date:$("date").value,amount:Number($("amount").value),currency:"CRC",description:$("description").value.trim()};
 if(["Gasto","Ingreso"].includes(kind))out.categoryId=$("categoryId").value;
 if(kind==="Pago deuda")out.debtId=$("debtId").value;
 if(kind==="Aporte")out.reserveId=$("reserveId").value;
 if(kind==="Cobro"){out.person=$("person").value.trim();out.dueDate=$("dueDate").value;}
 return out;
}
async function send(event){
 event.preventDefault();if(submitting)return;
 if(!pending){
  const p=movement();
  if(!Number.isFinite(p.amount)||p.amount<=0)return status("Ingresá un monto mayor que cero.","error");
  pending={id:crypto.randomUUID(),movement:p};
  localStorage.setItem(DRAFT,JSON.stringify(pending));
 }
 submitting=true;freeze(true);$("submit").disabled=true;status("Enviando a One Less One…");
 try{
  const res=await api("inbox",{method:"POST",data:pending});
  if(res.id!==pending.id||res.received!==true)throw Error("No se confirmó la recepción");
  localStorage.removeItem(DRAFT);pending=null;
  $("entryForm").reset();$("date").value=today();setType("Gasto");freeze(false);
  status("Recibido ✓ Se incorporará cuando One Less One Daniel sincronice.","ok");
 }catch(e){status("No confirmado: "+e.message+". Reintentá sin crear otro movimiento.","error");}
 finally{submitting=false;$("submit").disabled=false;}
}
$("date").value=today();
$("setup").hidden=!!localStorage.getItem(KEY);
$("capture").hidden=!localStorage.getItem(KEY);
$("setupForm").addEventListener("submit",async e=>{
 e.preventDefault();const token=$("mobileKey").value.trim();
 if(token.length<32)return;
 localStorage.setItem(KEY,token);$("setup").hidden=true;$("capture").hidden=false;
 await refresh();restoreDraft();
});
$("entryForm").addEventListener("submit",send);
for(const b of document.querySelectorAll("[data-type]"))b.addEventListener("click",()=>setType(b.dataset.type));
$("refreshCatalog").addEventListener("click",refresh);
$("disconnect").addEventListener("click",()=>{
 if(!confirm("¿Desvincular este iPhone? Un envío no confirmado seguirá pendiente para reintentar después."))return;
 localStorage.removeItem(KEY);$("capture").hidden=true;$("setup").hidden=false;status("");
});
setType("Gasto");
if(localStorage.getItem(KEY)){refresh().then(()=>restoreDraft());}
