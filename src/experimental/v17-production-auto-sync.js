
// Production-only opt-in auto sync: same verified bridge, no second importer.
// The separate V17 key is local to this browser; V16's connection stays disabled.
 const AUTO_KEY=STORAGE_KEY+"_mobile_auto_v1",enableAuto=el("mobileAuto"),forgetAuto=el("mobileForget");
 let generation=0;
 function autoToken(){try{const raw=localStorage.getItem(AUTO_KEY);return typeof raw==="string"&&raw.length>=32?raw:""}catch{return ""}}
 function autoControls(){enableAuto.checked=!!autoToken();forgetAuto.disabled=!autoToken()}
 async function runAutomatic(){if(document.visibilityState!=="visible"||busy||!autoToken()||!navigator.locks||!M.isPrivate(data))return;await syncNow(false)}
 async function syncNow(manual){
  if(busy)return;
  const supplied=manual?key.value.trim():"",saved=autoToken(),token=supplied||saved;
  if(manual)key.value="";
  if(token.length<32){if(manual)status.textContent="Ingresá la clave de sincronización de Daniel.";return}
  if(!manual&&!navigator.locks)return;
  busy=true;btn.disabled=true;const epoch=generation;
  try{
   guard();
   const perform=async()=>{
    if(epoch!==generation)throw Error("Conexión desvinculada");
    // Never call a second importer: execute the guarded V17 receipt and ACK flow.
    await runSync(token,epoch);
    if(manual&&enableAuto.checked){if(!navigator.locks)throw Error("Este navegador no admite sincronización automática segura");if(epoch!==generation)throw Error("Conexión desvinculada");localStorage.setItem(AUTO_KEY,token)}
   };
   if(navigator.locks)await navigator.locks.request("olo-v17-daniel-mobile-sync",{ifAvailable:true},async lock=>{if(lock)await perform();else if(manual)status.textContent="Otra pestaña está sincronizando."});
   else await perform();
  }catch(e){status.textContent="No se pudo sincronizar: "+e.message}
  finally{busy=false;btn.disabled=nativeBlocked;autoControls()}
 }
 btn.onclick=()=>syncNow(true);
 forgetAuto.onclick=()=>{generation++;localStorage.removeItem(AUTO_KEY);key.value="";autoControls();status.textContent="Sincronización automática desvinculada."};
 autoControls();
 window.addEventListener("storage",e=>{if(e.key===AUTO_KEY){generation++;autoControls()}});
 window.addEventListener("focus",()=>{void runAutomatic()});
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")void runAutomatic()});
 setTimeout(()=>{void runAutomatic()},400);setInterval(()=>{void runAutomatic()},90000);
