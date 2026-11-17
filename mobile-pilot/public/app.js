"use strict";
const KEY="one_one_mobile_v1_key",DRAFT="one_one_mobile_v1_draft";
const TYPES=["Gasto","Ingreso","Cobro"];
const LABELS={Gasto:"Registrar gasto",Ingreso:"Registrar ingreso",Cobro:"Crear cobro"};
const NEW_GROUP="__new__";
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
function mobileGroup(){
 return (catalog?.groups||[]).find(g=>g.id===$("cobroGroup").value)||null;
}
function fillCobroGroups(){
 const choice=$("cobroGroup"),previous=choice.value;
 fill("cobroGroup",catalog?.groups||[]);
 choice.options[0].textContent="Sin grupo";
 const option=document.createElement("option");option.value=NEW_GROUP;option.textContent="+ Crear grupo nuevo";
 choice.insertBefore(option,choice.options[1]||null);
 if(previous===NEW_GROUP)choice.value=NEW_GROUP;
 syncGroupSuggestions();
}
function syncGroupSuggestions(){
 const group=mobileGroup(),names=Array.isArray(group?.people)?group.people:[];
 const list=$("cobroPersonSuggestions");list.replaceChildren();
 for(const name of names){
  const option=document.createElement("option");option.value=name;list.append(option);
 }
 const box=$("splitMembers");box.replaceChildren();
 const active=kind==="Cobro"&&$("splitToggle").checked&&names.length;
 box.hidden=!active;
 if(!active)return;
 const caption=document.createElement("small");
 caption.textContent="Personas habituales · elegí solo quienes participaron";
 box.append(caption);
 for(const name of names){
  const used=[...$("splitRows").querySelectorAll(".split-person")].
    some(x=>x.value.trim().toLocaleLowerCase("es")===name.trim().toLocaleLowerCase("es"));
  const button=document.createElement("button");
  button.type="button";button.textContent=name;button.disabled=used||!!pending;
  button.addEventListener("click",()=>{
   const blank=[...$("splitRows").querySelectorAll(".split-person")].find(x=>!x.value.trim());
   if(blank){blank.value=name;blank.dispatchEvent(new Event("input",{bubbles:true}))}
   else splitAddRow(name,1);
   syncGroupSuggestions();
  });
  box.append(button);
 }
}
async function refresh(){
 try{
  const result=await api("catalog");
  if(!result.catalog)throw Error("Primero vinculá el piloto desde One Less One Daniel");
  catalog=result.catalog;options();fillCobroGroups();showCapture(true);if(!pending)status("");return true;
 }catch(e){showCapture(false);status(e.message,"error");return false;}
}
function setType(type){
 if(!TYPES.includes(type))return false;
 kind=type;
 for(const b of document.querySelectorAll("[data-type]")){const active=b.dataset.type===type;b.classList.toggle("selected",active);b.setAttribute("aria-pressed",String(active));}
 const ordinary=type!=="Cobro",cobro=!ordinary;
 $("categoryField").hidden=!ordinary;$("dueField").hidden=!cobro;
 $("currencyField").hidden=false;$("splitToggleField").hidden=!cobro;$("cobroGroupField").hidden=!cobro;
 $("personField").hidden=!cobro||$("splitToggle").checked;
 syncSplitMode();
 $("categoryId").required=ordinary;$("person").required=cobro&&!$("splitToggle").checked;
 $("descriptionLabel").innerHTML=cobro?'Concepto <span class="optional">(opcional)</span>':'Detalle <span class="optional">(opcional)</span>';
 $("description").placeholder=cobro?"¿Qué te deben?":type==="Ingreso"?"¿De dónde viene?":"¿En qué fue?";
 $("submit").textContent=LABELS[type];$("moneySymbol").textContent=$("currency").value==="USD"?"$":"₡";$("currencyHint").hidden=$("currency").value!=="USD";options();return true;
}
function freeze(locked){
 for(const field of $("entryForm").querySelectorAll("input,select"))field.disabled=locked;
 for(const b of document.querySelectorAll("[data-type]"))b.disabled=locked;
 $("splitAdd").disabled=locked;
 $("splitRows").querySelectorAll(".split-remove").forEach(b=>b.disabled=locked);
 $("splitMembers").querySelectorAll("button").forEach(b=>b.disabled=locked);
 $("todayButton").disabled=locked;$("submit").textContent=locked?"Reintentar envío":LABELS[kind];
 $("discardDraft").hidden=!pending;$("discardDraft").disabled=submitting;
}
function restoreDraft(){
 try{
  const saved=JSON.parse(localStorage.getItem(DRAFT)||"null");if(!saved?.id||!saved?.movement)return;
  pending=saved;const p=saved.movement,old=!TYPES.includes(p.type);
  setType(old?"Gasto":p.type);
  for(const id of ["date","amount","categoryId","person","description","dueDate","currency"]){
   if($(id)&&p[id]!==undefined)$(id).value=p[id];
  }
  if(p.type==="Cobro dividido"){
   $("cobroGroup").value=p.groupId||NEW_GROUP;
   $("splitToggle").checked=true;$("splitGroupName").value=p.groupName||"";
   $("splitMode").value=p.splitMode||"equal";$("splitSelfShares").value=p.selfShares??1;
   $("splitSelfAmount").value=p.selfAmount??0;$("splitRows").replaceChildren();
   for(const person of p.participants||[])splitAddRow(person.person,person.shares,person.amount);
   setType("Cobro");
  }
  if(p.type==="Cobro"){
   $("cobroGroup").value=p.groupId||(p.groupName?NEW_GROUP:"");
   $("splitGroupName").value=p.groupName||"";
  }
  syncSplitMode();syncDateDisplays();freeze(true);
  status(old?"Hay un envío anterior de "+p.type+" sin confirmar. Podés reintentarlo sin duplicarlo o descartarlo.":"El último envío no fue confirmado. Tocá Reintentar para evitar duplicados.","error");
 }catch{}
}

function splitAddRow(person="",shares=1,amount=""){
 if($("splitRows").children.length>=20)return status("Se permiten hasta 20 personas.","error");
 const row=document.createElement("div");row.className="split-row";
 row.innerHTML='<input class="split-person" type="text" maxlength="120" placeholder="Nombre" aria-label="Persona que debe" required>'+
  '<input class="split-shares" type="number" min="1" max="20" step="1" aria-label="Cantidad de partes" required>'+
  '<input class="split-amount" type="number" min="0.01" step="0.01" aria-label="Monto a cobrar" hidden>'+
  '<button type="button" class="split-remove" aria-label="Quitar persona">×</button>';
 row.querySelector(".split-person").value=person;
 row.querySelector(".split-shares").value=shares;
 if(amount!=="")row.querySelector(".split-amount").value=amount;
 row.querySelector(".split-remove").addEventListener("click",()=>{row.remove();splitPreview();syncGroupSuggestions();});
 row.addEventListener("input",()=>{splitPreview();syncGroupSuggestions()});
 $("splitRows").append(row);syncSplitMode();
}
function syncSplitMode(){
 const cobro=kind==="Cobro",split=cobro&&$("splitToggle").checked,custom=$("splitMode").value==="amount";
 if(split&&!$("cobroGroup").value)$("cobroGroup").value=NEW_GROUP;
 const newGroup=cobro&&$("cobroGroup").value===NEW_GROUP;
 $("splitFields").hidden=!split;$("personField").hidden=!cobro||split;
 $("splitGroupNameField").hidden=!newGroup;
 $("splitGroupName").required=newGroup;$("person").required=cobro&&!split;
 $("splitSelfSharesField").hidden=!split||custom;$("splitSelfAmountField").hidden=!split||!custom;
 for(const row of $("splitRows").children){
  row.querySelector(".split-person").disabled=!split;
  row.querySelector(".split-shares").hidden=custom;row.querySelector(".split-shares").disabled=!split||custom;
  row.querySelector(".split-amount").hidden=!custom;row.querySelector(".split-amount").disabled=!split||!custom;
 }
 if(split&&!$("splitRows").children.length)splitAddRow("",1);
 if(split)splitPreview();
 syncGroupSuggestions();
}
function splitPayload(){
 return globalThis.OneSplitFare.normalize({type:"Cobro dividido",groupId:mobileGroup()?.id||"",amount:Number($("amount").value),
  currency:$("currency").value,date:$("date").value,dueDate:$("dueDate").value,
  description:$("description").value.trim(),groupName:$("cobroGroup").value===NEW_GROUP?$("splitGroupName").value.trim():"",
  splitMode:$("splitMode").value,selfShares:Number($("splitSelfShares").value),
  selfAmount:Number($("splitSelfAmount").value),
  participants:[...$("splitRows").children].map(row=>({
   person:row.querySelector(".split-person").value.trim(),
   shares:Number(row.querySelector(".split-shares").value),
   amount:Number(row.querySelector(".split-amount").value)
  }))});
}
function splitPreview(){
 if(kind!=="Cobro"||!$("splitToggle").checked)return;
 try{
  const p=splitPayload(),sym=p.currency==="USD"?"$":"₡",fmt=n=>sym+n.toFixed(2);
  $("splitPreview").textContent="Tu parte: "+fmt(p.selfAmount)+" · Por cobrar: "+
   fmt(p.participants.reduce((s,row)=>s+row.amount,0))+" · "+
   p.participants.map(row=>row.person+": "+fmt(row.amount)+(p.splitMode==="equal"?" ("+row.shares+" partes)":"")).join(" · ");
  $("splitPreview").dataset.valid="true";
 }catch(error){$("splitPreview").textContent=error.message;$("splitPreview").dataset.valid="false";}
}

function movement(){
 if(kind==="Cobro"&&$("splitToggle").checked)return splitPayload();
 const m={type:kind,date:$("date").value,amount:Number($("amount").value),
 currency:$("currency").value,description:$("description").value.trim()};
 if(kind!=="Cobro")m.categoryId=$("categoryId").value;
 else {
  m.person=$("person").value.trim();m.dueDate=$("dueDate").value;
  m.groupId=mobileGroup()?.id||"";
  if($("cobroGroup").value===NEW_GROUP)m.groupName=$("splitGroupName").value.trim();
 }
 return m;
}
function showMobileReceipt(entry){
 const dialog=$("entrySuccessDialog");if(!dialog)return;
 const label=entry.type==="Cobro dividido"?"Cobros compartidos":entry.type;
 const symbol=entry.currency==="USD"?"$":"₡";
 $("entrySuccessTitle").textContent="Registro recibido";
 $("entrySuccessDescription").textContent=label+" · "+symbol+Number(entry.amount).toLocaleString(entry.currency==="USD"?"en-US":"es-CR",{maximumFractionDigits:2})+
  (entry.description?" · "+entry.description:"")+
  "\nEstá en la bandeja móvil; se incorporará a Daniel cuando sincronice. Todavía no se ha contabilizado.";
 if(typeof dialog.showModal==="function")dialog.showModal();
 else dialog.setAttribute("open","");
}
function closeMobileReceipt(){
 const dialog=$("entrySuccessDialog");if(!dialog)return;
 if(typeof dialog.close==="function")dialog.close();else dialog.removeAttribute("open");
}
async function send(event){
 event.preventDefault();if(submitting)return;
 if(!pending){
  let m;try{m=movement()}catch(error){return status(error.message,"error")}
  if(!Number.isFinite(m.amount)||m.amount<=0)return status("Ingresá un monto mayor que cero.","error");
  pending={id:crypto.randomUUID(),movement:m};localStorage.setItem(DRAFT,JSON.stringify(pending));
 }
 submitting=true;freeze(true);$("submit").disabled=true;status("Enviando a One Less One…");
 try{
  const result=await api("inbox",{method:"POST",data:pending});
  if(result.id!==pending.id||result.received!==true)throw Error("No se confirmó la recepción");
  const received=pending.movement;
  localStorage.removeItem(DRAFT);pending=null;$("entryForm").reset();$("splitRows").replaceChildren();$("date").value=today();
  setType("Gasto");syncDateDisplays();freeze(false);status("Recibido ✓ Se incorporará cuando One Less One Daniel sincronice.","ok");
  showMobileReceipt(received);
 }catch(e){status("No confirmado: "+e.message+". Reintentá sin crear otro movimiento.","error");}
 finally{submitting=false;$("submit").disabled=false;freeze(!!pending);}
}
$("date").value=today();$("date").max=today();syncDateDisplays();
// Safari puede mantener el formulario abierto durante la noche; actualizar límite sin borrar lo escrito.
document.addEventListener("visibilitychange",()=>{
 if(document.visibilityState==="visible")$("date").max=today();
});
showCapture(!!localStorage.getItem(KEY));
$("setupForm").addEventListener("submit",async e=>{e.preventDefault();const key=$("mobileKey").value.trim();if(key.length<32)return;localStorage.setItem(KEY,key);if(await refresh())restoreDraft();});
$("entryForm").addEventListener("submit",send);
$("entrySuccessClose").addEventListener("click",closeMobileReceipt);
$("entrySuccessDialog").addEventListener("click",event=>{if(event.target===$("entrySuccessDialog"))closeMobileReceipt()});
for(const b of document.querySelectorAll("[data-type]"))b.addEventListener("click",()=>{if(!pending)setType(b.dataset.type);});
$("todayButton").addEventListener("click",()=>{$("date").value=today();syncDateDisplays();});
$("date").addEventListener("input",syncDateDisplays);
$("date").addEventListener("change",syncDateDisplays);
$("dueDate").addEventListener("input",syncDateDisplays);
$("dueDate").addEventListener("change",syncDateDisplays);
$("currency").addEventListener("change",()=>{setType(kind);splitPreview()});
$("splitToggle").addEventListener("change",syncSplitMode);
$("splitMode").addEventListener("change",syncSplitMode);
$("cobroGroup").addEventListener("change",()=>{
 if(kind==="Cobro"&&!$("splitToggle").checked){
  const people=mobileGroup()?.people||[];
  $("person").value=people.length===1?people[0]:"";
 }
 syncSplitMode();
});
$("splitAdd").addEventListener("click",()=>splitAddRow());
for(const id of ["splitGroupName","splitSelfShares","splitSelfAmount","amount"])$(id).addEventListener("input",splitPreview);
$("refreshCatalog").addEventListener("click",refresh);
$("discardDraft").addEventListener("click",()=>{
 if(!pending||submitting)return;
 if(!confirm("Este envío podría haber llegado al servidor. Descartarlo no cancela un registro recibido. ¿Descartar el borrador local?"))return;
 localStorage.removeItem(DRAFT);pending=null;$("entryForm").reset();$("splitRows").replaceChildren();$("date").value=today();
 setType("Gasto");syncDateDisplays();freeze(false);
 status("Borrador local descartado. Si el servidor recibió el movimiento, podría aparecer en Daniel.");
});
$("disconnect").addEventListener("click",()=>{
 if(!confirm("¿Desvincular este iPhone? Los registros ya recibidos permanecerán en Cloudflare."))return;
 localStorage.removeItem(KEY);showCapture(false);status("");
});
setType("Gasto");
if(localStorage.getItem(KEY))refresh().then(ok=>{if(ok)restoreDraft();});
