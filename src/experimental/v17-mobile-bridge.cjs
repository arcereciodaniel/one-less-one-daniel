"use strict";
const oneV17MobileBridge=(()=>{
 const FIELD="v17StagingMobileReceipts",types=new Set(["Gasto","Ingreso","Cobro","Cobro dividido"]),idOK=id=>typeof id==="string"&&/^[a-zA-Z0-9_-]{16,80}$/.test(id);
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
  if(p.type==="Cobro dividido")splitPayload(p);
 }
 function splitPayload(p){
  if(!globalThis.OneSplitFare?.normalize)throw Error("Normalizador de reparto no disponible");
  const n=globalThis.OneSplitFare.normalize(p);
  if(n.groupId&&n.groupName)throw Error("Elegí o creá un grupo, no ambos");
  if(p.selfAmount!==undefined&&p.selfAmount!==n.selfAmount||p.totalShares!==undefined&&p.totalShares!==n.totalShares||p.participants.some((x,i)=>x.amount!==undefined&&x.amount!==n.participants[i].amount))throw Error("El reparto recibido no coincide");
  return n;
 }
 function verifyFx(x,p){
  if(p.currency==="USD"&&(!x.fxDate||x.fxDate>p.date||Date.parse(p.date+"T00:00:00Z")-Date.parse(x.fxDate+"T00:00:00Z")>7*86400000||!Number.isFinite(x.fxBuy)||!Number.isFinite(x.fxSell)||!(x.fxBuy>0)||!(x.fxSell>=x.fxBuy)))throw Error("Tipo de cambio no verificado");
 }
 function verifySplit(raw,item,rows){
  const p=splitPayload(item.movement),charges=rows.filter(r=>r.k==="sharedCharges").map(r=>r.x),groups=rows.filter(r=>r.k==="sharedChargeGroups").map(r=>r.x);
  if(rows.length!==charges.length+groups.length||charges.length!==p.participants.length||groups.length!==(p.groupId?0:1))throw Error("Lote de cobros incompleto");
  const groupId=p.groupId||groups[0]?.id,group=(raw.sharedChargeGroups||[]).find(g=>g.id===groupId);
  if(!group||!groupId||(!p.groupId&&(group.mobilePilotId!==item.id||group.name!==p.groupName||group.splitFare?.totalAmount!==p.amount||group.splitFare?.selfAmount!==p.selfAmount||group.splitFare?.currency!==p.currency||group.splitFare?.totalShares!==p.totalShares||group.splitFare?.mode!==p.splitMode||group.splitFare?.date!==p.date)))throw Error("Grupo del reparto no verificado");
  const batch=charges[0]?.splitFareExpenseId;
  if(!batch||new Set(charges.map(c=>c.id)).size!==charges.length||(raw.sharedCharges||[]).filter(c=>c.splitFareExpenseId===batch).length!==charges.length)throw Error("Identidad del lote inválida");
  for(const part of p.participants){
   const matches=charges.filter(c=>c.person===part.person);
   if(matches.length!==1)throw Error("Participante no verificado");
   const c=matches[0];
   if(c.mobilePilotId!==item.id||c.groupId!==groupId||c.splitFareExpenseId!==batch||c.amount!==part.amount||c.splitFareShares!==part.shares||c.currency!==p.currency||c.date!==p.date||(c.dueDate||"")!==p.dueDate)throw Error("Monto o vínculo del reparto no coincide");
   verifyFx(c,p);
   if(p.currency==="USD"&&(c.fxDate!==charges[0].fxDate||c.fxBuy!==charges[0].fxBuy||c.fxSell!==charges[0].fxSell))throw Error("Tasas distintas en un mismo reparto");
  }
  const sum=charges.reduce((a,c)=>a+Math.round(c.amount*100),Math.round(p.selfAmount*100));
  if(sum!==Math.round(p.amount*100))throw Error("El reparto no cierra");
  return true;
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
  const p=item.movement,rows=matches(raw,item.id);
  if(p.type==="Cobro dividido")return verifySplit(raw,item,rows);
  const ordinary=p.type!=="Cobro",main=rows.filter(r=>r.k===(ordinary?"movements":"sharedCharges"));
  if(main.length!==1||rows.some(r=>r.k!==(ordinary?"movements":"sharedCharges")&&!(p.groupName&&r.k==="sharedChargeGroups")))throw Error("Filas no verificadas");
  const x=main[0].x;
  if(x.mobilePilotId!==item.id||x.amount!==p.amount||x.currency!==p.currency||x.date!==p.date)throw Error("Registro no coincide");
  if(ordinary&&(x.type!==p.type||x.categoryId!==p.categoryId||!x.period))throw Error("Movimiento no coincide");
  if(!ordinary&&(x.person!==String(p.person||"").trim().slice(0,120)||(p.groupId&&x.groupId!==p.groupId)))throw Error("Cobro no coincide");
  if(p.groupName){const g=rows.filter(r=>r.k==="sharedChargeGroups");if(g.length!==1||g[0].x.id!==x.groupId||g[0].x.name!==p.groupName)throw Error("Grupo no verificado")}
  if(p.projectId&&!(raw.projectLinks||[]).some(l=>l.movementId===x.id&&l.projectId===p.projectId&&(l.bucketId||"")===(p.projectBucketId||"")))throw Error("Vínculo no persistido");
  verifyFx(x,p);
  return true;
 }
 // Persist only append-only native changes on the exact disk ledger, not incidental
 // normalization that happened at startup. Reject any unexpected native side effect.
 function appendPatch(disk,before,after){
  const lists=new Set(["movements","movementAudit","sharedCharges","sharedChargeGroups","projectLinks",FIELD]);
  const same=(a,b)=>signature(a)===signature(b);
  const out={...disk};
  for(const k of new Set([...Object.keys(before),...Object.keys(after)])){
   if(same(before[k],after[k]))continue;
   if(k==="movementSeq"){
    if(!Number.isSafeInteger(after[k])||after[k]!==Number(before[k]||0)+1)throw Error("Secuencia no verificada");
    out[k]=after[k];continue;
   }
   if(!lists.has(k))throw Error("Cambio no permitido al importar: "+k);
   const prev=before[k]??[],next=after[k],stored=disk[k]??[];
   if(!Array.isArray(prev)||!Array.isArray(next)||!Array.isArray(stored)||stored.length!==prev.length||next.length<prev.length||
    prev.some((x,i)=>!same(x,next[i])||!x?.id||x.id!==stored[i]?.id))throw Error("Historial no verificable: "+k);
   const appended=next.slice(prev.length),ids=new Set(stored.map(x=>x.id));
   for(const row of appended){if(!row?.id||ids.has(row.id))throw Error("Fila duplicada: "+k);ids.add(row.id)}
   out[k]=[...stored,...appended];
  }
  return out;
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
 return {FIELD,check,mark,verify,appendPatch,drain};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17MobileBridge;
