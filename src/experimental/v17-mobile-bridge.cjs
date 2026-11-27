"use strict";
const oneV17MobileBridge=(()=>{
 const FIELD="v17StagingMobileReceipts",types=new Set(["Gasto","Ingreso","Cobro"]),idOK=id=>typeof id==="string"&&/^[a-zA-Z0-9_-]{16,80}$/.test(id);
 function signature(x){
  if(x===null||typeof x!=="object")return JSON.stringify(x);
  if(Array.isArray(x))return "["+x.map(signature).join(",")+"]";
  return "{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+signature(x[k])).join(",")+"}";
 }
 function validate(item){
  if(!idOK(item?.id)||!item.movement||!types.has(item.movement.type))throw Error("Operación pendiente de validación V17");
  const p=item.movement;
  if(typeof p.amount!=="number"||!Number.isFinite(p.amount)||p.amount<=0||p.amount>1e9||Math.abs(p.amount*100-Math.round(p.amount*100))>1e-5||!["CRC","USD"].includes(p.currency))throw Error("Monto o moneda inválidos");
  if((p.projectId||p.projectBucketId)&&p.type!=="Gasto")throw Error("Proyecto inválido");
 }
 function receipts(raw){const list=raw[FIELD]??[];if(!Array.isArray(list)||list.some(x=>!idOK(x?.id)||typeof x.signature!=="string")||new Set(list.map(x=>x.id)).size!==list.length)throw Error("Recibos inválidos");return list}
 function matches(raw,id){return ["movements","sharedCharges","reserveMovements","sharedChargeGroups"].flatMap(k=>(raw[k]||[]).filter(x=>x.mobilePilotId===id||x.id===id).map(x=>({k,x})))}
 function check(raw,item){
  validate(item);const receipt=receipts(raw).find(x=>x.id===item.id);
  if(receipt){if(receipt.signature!==signature(item.movement))throw Error("ID reutilizado con otros datos");return "duplicate"}
  if(matches(raw,item.id).length)throw Error("ID existente sin recibo V17");
  return "new";
 }
 function mark(raw,item){validate(item);if(receipts(raw).some(x=>x.id===item.id))throw Error("Recibo duplicado");raw[FIELD]=[...receipts(raw),{id:item.id,signature:signature(item.movement)}]}
 function verify(raw,item){
  validate(item);
  if(!receipts(raw).some(x=>x.id===item.id&&x.signature===signature(item.movement)))throw Error("Recibo no persistido");
  const p=item.movement,rows=matches(raw,item.id),ordinary=p.type!=="Cobro",main=rows.filter(r=>r.k===(ordinary?"movements":"sharedCharges"));
  if(main.length!==1||rows.some(r=>r.k!==(ordinary?"movements":"sharedCharges")&&!(p.groupName&&r.k==="sharedChargeGroups")))throw Error("Filas no verificadas");
  const x=main[0].x;
  if(x.mobilePilotId!==item.id||x.amount!==p.amount||x.currency!==p.currency||x.date!==p.date)throw Error("Registro no coincide");
  if(ordinary&&(x.type!==p.type||x.categoryId!==p.categoryId||!x.period))throw Error("Movimiento no coincide");
  if(!ordinary&&(x.person!==String(p.person||"").trim().slice(0,120)||(p.groupId&&x.groupId!==p.groupId)))throw Error("Cobro no coincide");
  if(p.groupName){const g=rows.filter(r=>r.k==="sharedChargeGroups");if(g.length!==1||g[0].x.id!==x.groupId||g[0].x.name!==p.groupName)throw Error("Grupo no verificado")}
  if(p.projectId&&!(raw.projectLinks||[]).some(l=>l.movementId===x.id&&l.projectId===p.projectId&&(l.bucketId||"")===(p.projectBucketId||"")))throw Error("Vínculo no persistido");
  if(p.currency==="USD"&&(!x.fxDate||x.fxDate>p.date||!(x.fxBuy>0)||!(x.fxSell>=x.fxBuy)))throw Error("Tipo de cambio no verificado");
  return true;
 }
 async function drain(items,io){
  const result={inserted:0,duplicates:0,pending:0,confirmed:0};
  for(const item of items){
   try{
    const outcome=io.importItem(item);
    if(outcome==="inserted")result.inserted++;else if(outcome==="duplicate")result.duplicates++;else throw Error("Estado desconocido");
    io.verify(item);await io.ack(item);result.confirmed++;
   }catch{result.pending++}
  }
  return result;
 }
 return {FIELD,check,mark,verify,drain};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17MobileBridge;
