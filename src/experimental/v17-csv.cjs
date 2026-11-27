"use strict";
const oneV17Csv=(()=>{
 // Protect spreadsheet readers against formula injection. Numeric financial cells remain numeric.
 function cell(v){
  if(v===null||v===undefined)return "";
  if(typeof v==="number"){if(!Number.isFinite(v))throw Error("Monto inválido");return String(v)}
  let s=String(v);if(/^[\s\u0000-\u001f]*[=+\-@]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
 }
 const encode=rows=>"\ufeff"+rows.map(row=>row.map(cell).join(",")).join("\r\n")+"\r\n";
 const amount=n=>{if(!Number.isSafeInteger(n))throw Error("Monto fuera de rango");return n/100};
 const optional=n=>n===null?null:amount(n);
 const valid=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
 function rangeCheck(r){if(!r||!valid(r.start)||!valid(r.end)||r.start>r.end)throw Error("Intervalo inválido")}
 function budget(p,r){
  rangeCheck(r);
  const rows=[["Desde","Hasta","Categoría ID","Categoría","Tipo","Moneda","Plan dentro del intervalo (incluye bloques completos)","Ejecutado","Pendiente de distribuir (intervalo superpuesto; no sumar entre períodos)","Restante (solo si definido)","Estado","Incidencias del modelo"]];
  for(const x of p.rows){
   rows.push([r.start,r.end,x.id,x.name,x.type,x.currency,amount(x.plannedMinor),amount(x.actualMinor),amount(x.pendingMinor),optional(x.remainingMinor),x.status,p.issues.length]);
  }
  return encode(rows);
 }
 function movements(items,r){
  rangeCheck(r);
  const rows=[["Desde","Hasta","ID","Fecha","Tipo","Categoría ID","Categoría","Descripción","Moneda original","Monto original","Período salarial original","Cuenta","Tipo cambio compra histórico","Tipo cambio venta histórico","Fecha TC histórico","División contable (JSON, no sumar como nuevos movimientos)"]];
  for(const m of items){
   if(!valid(m.date)||m.date<r.start||m.date>r.end||!["CRC","USD"].includes(m.currency||"CRC")||!Number.isFinite(m.amount)||m.amount<0)throw Error("Movimiento inválido");
   rows.push([r.start,r.end,m.id,m.date,m.type,m.categoryId||"",m.category||"",m.description||"",m.currency||"CRC",m.amount,m.period||"",m.account||"",m.fxBuy>0?m.fxBuy:null,m.fxSell>0?m.fxSell:null,m.fxDate||"",Array.isArray(m.splits)&&m.splits.length?JSON.stringify(m.splits):""]);
  }
  return encode(rows);
 }
 return {budget,movements};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=oneV17Csv;
