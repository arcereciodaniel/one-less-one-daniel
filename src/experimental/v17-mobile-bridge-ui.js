// Inserted inside the isolated V17 shell; native catalog and apply are scoped to this closure.
 const ENDPOINT="https://one-less-one-mobile-v17-staging.one-less-one-rastro.workers.dev",status=el("mobileStagingStatus"),btn=el("mobileStagingSync"),key=el("mobileStagingKey");
 let busy=false;
 function guard(){
  if(nativeBlocked||M.isPrivate(data)||migrationIO.readSource()!==null)throw Error("Solo datos ficticios");
  oneStorageAssertCurrent();
  if(M.isPrivate(JSON.parse(oneStorageSnapshot)))throw Error("Solo datos ficticios");
 }
 function disk(){return JSON.parse(localStorage.getItem(STORAGE_KEY))}
 function verify(item){
  guard();const stored=disk();
  oneV17MobileBridge.verify(stored,item);
  if(["Gasto","Ingreso"].includes(item.movement.type)){
   const p=periodForDate(item.movement.date),row=stored.movements.find(x=>x.mobilePilotId===item.id);
   if(!p||item.movement.date>periodEndDate(p)||row.period!==periodKey(p))throw Error("Período no verificado");
  }
 }
 function importItem(item){
  guard();
  const before=rawNow(),expected=oneStorageSnapshot;
  const verdict=oneV17MobileBridge.check(before,item);
  if(verdict==="duplicate"){verify(item);return "duplicate"}
  try{
   // oneCreateSplitFare only stages native receivables; it does not save or add an expense.
   if(apply(item)!=="inserted")throw Error("Identificador ya existente sin recibo V17");
   oneV17MobileBridge.mark(data,item);
   oneV17MobileBridge.verify(data,item);
   getModel();
   const next=oneV17MobileBridge.appendPatch(JSON.parse(expected),before,rawNow());
   oneV17MobileBridge.verify(next,item);
   oneStoragePersist(JSON.stringify(next));
   verify(item);
   refreshNative();
   return "inserted";
  }catch(error){
   if(oneStorageSnapshot===expected&&localStorage.getItem(STORAGE_KEY)===expected)data=before;
   else blockNative(Error("Revisá la persistencia antes de reintentar"));
   throw error;
  }
 }
 async function call(path,method,token,payload){
  guard();
  const r=await fetch(ENDPOINT+path,{method,redirect:"error",credentials:"omit",cache:"no-store",headers:{Authorization:"Bearer "+token,...(payload?{"Content-Type":"application/json"}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
  if(!r.ok)throw Error("Respuesta del piloto: "+r.status);
  const result=await r.json();guard();return result;
 }
 btn.onclick=async()=>{
  if(busy)return;let token=key.value.trim();key.value="";
  if(token.length<32){status.textContent="Ingresá la clave de pruebas.";return}
  busy=true;btn.disabled=true;status.textContent="Sincronizando prueba…";
  try{
   guard();
   const health=await call("/api/health","GET",token);
   if(health.service!=="One Less One Mobile V17 Staging"||health.mode!=="synthetic-only")throw Error("Piloto incorrecto");
   await call("/api/catalog","PUT",token,catalog());
   const inbox=await call("/api/inbox","GET",token);
   if(!Array.isArray(inbox.items)||inbox.items.length>100)throw Error("Bandeja inválida");
   const result=await oneV17MobileBridge.drain(inbox.items,{importItem,verify,ack:async item=>{const r=await call("/api/ack","POST",token,{id:item.id});if(r.ok!==true)throw Error("Confirmación inválida")}});
   refreshNative();status.textContent=result.inserted+" importado(s), "+result.duplicates+" repetido(s), "+result.pending+" pendiente(s), "+result.confirmed+" confirmado(s).";
  }catch(error){status.textContent="No se pudo sincronizar: "+error.message}
  finally{token="";busy=false;btn.disabled=nativeBlocked}
 };
