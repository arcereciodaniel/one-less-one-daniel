"use strict";
/* One Less One — Split fare V10.5. Shared by iPhone, Worker and desktop. */
(function(root){
 const moneyCents=(value,label)=>{
  const n=Number(value);
  if(!Number.isFinite(n)||n<0||n>1e9||Math.abs(n*100-Math.round(n*100))>1e-5)
   throw Error(label+" debe ser un monto válido con máximo dos decimales.");
  return Math.round(n*100);
 };
 const integer=(value,label,min,max)=>{
  const n=Number(value);
  if(!Number.isInteger(n)||n<min||n>max)throw Error(label+" debe estar entre "+min+" y "+max+".");
  return n;
 };
 const short=(value,max)=>typeof value==="string"?value.trim().slice(0,max):"";
 function normalize(input){
  if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Datos incompletos del reparto.");
  const groupName=short(input.groupName,120),description=short(input.description,200);
  const date=short(input.date,10),dueDate=short(input.dueDate,10);
  const currency=input.currency==="USD"?"USD":input.currency==="CRC"?"CRC":null;
  const splitMode=input.splitMode==="amount"?"amount":input.splitMode==="equal"?"equal":null;
  const cents=moneyCents(input.amount,"El total");
  if(!groupName)throw Error("Escribí un nombre para el grupo.");
  if(!currency)throw Error("Moneda no válida.");
  if(!splitMode)throw Error("Elegí repartir por partes o por montos.");
  if(cents<=0)throw Error("Ingresá un total mayor que cero.");
  const raw=input.participants;
  if(!Array.isArray(raw)||raw.length<1||raw.length>20)throw Error("Agregá entre 1 y 20 personas que te deben.");
  const seen=new Set();
  const participants=raw.map(row=>{
   const person=short(row?.person,120),shares=integer(row?.shares??1,"Partes de la persona",1,20);
   if(!person)throw Error("Cada persona necesita un nombre.");
   const key=person.toLocaleLowerCase("es");
   if(seen.has(key))throw Error("No repitás a "+person+"; asignale varias partes en una sola fila.");
   seen.add(key);
   return {person,shares,amount:row?.amount};
  });
  const selfShares=integer(input.selfShares??1,"Tus partes",0,20);
  const totalShares=selfShares+participants.reduce((sum,p)=>sum+p.shares,0);
  if(totalShares>40||totalShares<1)throw Error("Se permiten entre 1 y 40 partes en total.");
  let selfAmountCents=0;
  if(splitMode==="equal"){
   const unit=Math.floor(cents/totalShares),remainder=cents%totalShares;
   let position=0;
   const shareValue=shares=>{
    const before=position;position+=shares;
    return shares*unit+Math.max(0,Math.min(position,remainder)-Math.min(before,remainder));
   };
   selfAmountCents=shareValue(selfShares);
   for(const row of participants)row.amount=shareValue(row.shares)/100;
  }else{
   selfAmountCents=moneyCents(input.selfAmount??0,"Tu parte");
   for(const row of participants)row.amount=moneyCents(row.amount,"El monto de "+row.person)/100;
  }
  const receivableCents=participants.reduce((sum,row)=>sum+moneyCents(row.amount,"Monto individual"),0);
  if(selfAmountCents+receivableCents!==cents)
   throw Error("El total no cierra: tu parte más los cobros deben sumar el importe pagado.");
  if(participants.some(row=>row.amount<=0))throw Error("Cada persona debe tener un monto mayor que cero.");
  return {type:"Cobro dividido",groupName,description,date,dueDate,currency,amount:cents/100,
   splitMode,selfShares,selfAmount:selfAmountCents/100,totalShares,
   participants:participants.map(p=>({person:p.person,shares:p.shares,amount:p.amount}))};
 }
 root.OneSplitFare=Object.freeze({normalize});
})(globalThis);
