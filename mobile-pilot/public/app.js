"use strict";
const KEY="one_one_mobile_v1_key",DRAFT="one_one_mobile_v1_draft";
const TYPES=["Gasto","Ingreso","Cobro"];
const LABELS={Gasto:"Registrar gasto",Ingreso:"Registrar ingreso",Cobro:"Crear cobro"};
const $=id=>document.getElementById(id);
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
let catalog=null,kind="Gasto",pending=null,submitting=false;
function formatLocalDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||""))return "Seleccioná una fecha";
 const date=new Date(value+"T12:00:00");
 if(Number.isNaN(date.getTime()))return "Seleccioná una fecha";
 return new Intl.DateTimeFormat("es-CR",{day:"numeric",month:"short",year:"numeric"}).format(date);
}
function syncDateDisplays(){
 $("dateDisplay").textContent=formatLocalDate($("date").value);
 $("dueDateDisplay").textContent=formatLocalDate($("dueDate").value);
}
function status(message="",tone=""){const e=$("status");e.textContent=message;e.className="status"+(tone?" "+tone:"");}
function auth(){return {"Authorization":"Bearer "+(localStorage.getItem(KEY)||"")};}
async function api(path,{method="GET",data}={}){
 const response=await fetch("/api/"+path,{method,cache:"no-store",headers:{...auth(),...(data?{"Content-Type":"application/json"}:{})},...(data?{body:JSON.stringify(data)}:{})});
 let result;try{result=await response.json();}catch{throw Error("No se recibió una respuesta válida");}
 if(!response.ok)throw Error(result.error||"No se pudo conectar");return result;
}
function showCapture(connected){$("setup").hidden=connected;$("capture").hidden=!connected;$("connectedFooter").hidden=!connected;}
function fill(id,rows){
 const select=$(id),previous=select.value;select.replaceChildren();
 const empty=document.createElement("option");empty.value="";empty.textContent="Seleccioná una opción";select.append(empty);
 for(const row of rows){const o=document.createElement("option");o.value=row.id;o.textContent=row.name;select.append(o);}
 if(rows.some(row=>row.id===previous))select.value=previous;
}
function options(){fill("categoryId",(catalog?.categories||[]).filter(c=>c.type===kind));}
async function refresh(){
 try{
  const result=await api("catalog");
  if(!result.catalog)throw Error("Primero vinculá el piloto desde One Less One Daniel");
  catalog=result.catalog;options();showCapture(true);if(!pending)status("");return true;
 }catch(e){showCapture(false);status(e.message,"error");return false;}
}
function setType(type){
 if(!TYPES.includes(type))return false;
 kind=type;
 for(const b of document.querySelectorAll("[data-type]")){const active=b.dataset.type===type;b.classList.toggle("selected",active);b.setAttribute("aria-pressed",String(active));}
 const ordinary=type!=="Cobro",cobro=!ordinary;
 $("categoryField").hidden=!ordinary;$("personField").hidden=!cobro;$("dueField").hidden=!cobro;
 $("categoryId").required=ordinary;$("person").required=cobro;
 $("descriptionLabel").innerHTML=cobro?'Concepto <span class="optional">(opcional)</span>':'Detalle <span class="optional">(opcional)</span>';
 $("description").placeholder=cobro?"¿Qué te deben?":type==="Ingreso"?"¿De dónde viene?":"¿En qué fue?";
 $("submit").textContent=LABELS[type];options();return true;
}
function freeze(locked){
 for(const field of $("entryForm").querySelectorAll("input,select"))field.disabled=locked;
 for(const b of document.querySelectorAll("[data-type]"))b.disabled=locked;
 $("todayButton").disabled=locked;$("submit").textContent=locked?"Reintentar envío":LABELS[kind];
 $("discardDraft").hidden=!pending;$("discardDraft").disabled=submitting;
}
function restoreDraft(){
 try{
  const saved=JSON.parse(localStorage.getItem(DRAFT)||"null");if(!saved?.id||!saved?.movement)return;
  pending=saved;const p=saved.movement,old=!TYPES.includes(p.type);
  setType(old?"Gasto":p.type);
  for(const id of ["date","amount","categoryId","person","description","dueDate"]){if($(id)&&p[id]!==undefined)$(id).value=p[id];}
  syncDateDisplays();freeze(true);
  status(old?"Hay un envío anterior de "+p.type+" sin confirmar. Podés reintentarlo sin duplicarlo o descartarlo.":"El último envío no fue confirmado. Tocá Reintentar para evitar duplicados.","error");
 }catch{}
}
function movement(){
 const m={type:kind,date:$("date").value,amount:Number($("amount").value),currency:"CRC",description:$("description").value.trim()};
 if(kind!=="Cobro")m.categoryId=$("categoryId").value;
 else {m.person=$("person").value.trim();m.dueDate=$("dueDate").value;}
 return m;
}
async function send(event){
 event.preventDefault();if(submitting)return;
 if(!pending){
  const m=movement();if(!Number.isFinite(m.amount)||m.amount<=0)return status("Ingresá un monto mayor que cero.","error");
  pending={id:crypto.randomUUID(),movement:m};localStorage.setItem(DRAFT,JSON.stringify(pending));
 }
 submitting=true;freeze(true);$("submit").disabled=true;status("Enviando a One Less One…");
 try{
  const result=await api("inbox",{method:"POST",data:pending});
  if(result.id!==pending.id||result.received!==true)throw Error("No se confirmó la recepción");
  localStorage.removeItem(DRAFT);pending=null;$("entryForm").reset();$("date").value=today();
  setType("Gasto");syncDateDisplays();freeze(false);status("Recibido ✓ Se incorporará cuando One Less One Daniel sincronice.","ok");
 }catch(e){status("No confirmado: "+e.message+". Reintentá sin crear otro movimiento.","error");}
 finally{submitting=false;$("submit").disabled=false;freeze(!!pending);}
}
$("date").value=today();$("date").max=today();syncDateDisplays();
showCapture(!!localStorage.getItem(KEY));
$("setupForm").addEventListener("submit",async e=>{e.preventDefault();const key=$("mobileKey").value.trim();if(key.length<32)return;localStorage.setItem(KEY,key);if(await refresh())restoreDraft();});
$("entryForm").addEventListener("submit",send);
for(const b of document.querySelectorAll("[data-type]"))b.addEventListener("click",()=>{if(!pending)setType(b.dataset.type);});
$("todayButton").addEventListener("click",()=>{$("date").value=today();syncDateDisplays();});
$("date").addEventListener("input",syncDateDisplays);
$("date").addEventListener("change",syncDateDisplays);
$("dueDate").addEventListener("input",syncDateDisplays);
$("dueDate").addEventListener("change",syncDateDisplays);
$("refreshCatalog").addEventListener("click",refresh);
$("discardDraft").addEventListener("click",()=>{
 if(!pending||submitting)return;
 if(!confirm("Este envío podría haber llegado al servidor. Descartarlo no cancela un registro recibido. ¿Descartar el borrador local?"))return;
 localStorage.removeItem(DRAFT);pending=null;$("entryForm").reset();$("date").value=today();
 setType("Gasto");syncDateDisplays();freeze(false);
 status("Borrador local descartado. Si el servidor recibió el movimiento, podría aparecer en Daniel.");
});
$("disconnect").addEventListener("click",()=>{
 if(!confirm("¿Desvincular este iPhone? Los registros ya recibidos permanecerán en Cloudflare."))return;
 localStorage.removeItem(KEY);showCapture(false);status("");
});
setType("Gasto");
if(localStorage.getItem(KEY))refresh().then(ok=>{if(ok)restoreDraft();});
