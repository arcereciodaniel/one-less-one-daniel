import test from "node:test";
import assert from "node:assert/strict";
import "../public/split-fare.js";
const normalize=globalThis.OneSplitFare.normalize;
const base={groupName:"Hotel con amigos",description:"Reserva",date:"2026-11-16",
 dueDate:"",currency:"USD",amount:328,splitMode:"equal",selfShares:1,
 participants:[{person:"Charlie",shares:2},{person:"Ana",shares:1}]};

test("Hotel USD 328: Charlie paga dos partes, el usuario una y Ana una",()=>{
 const r=normalize(base);
 assert.equal(r.amount,328);
 assert.equal(r.selfAmount,82);
 assert.deepEqual(r.participants.map(p=>({person:p.person,amount:p.amount,shares:p.shares})),[
  {person:"Charlie",amount:164,shares:2},
  {person:"Ana",amount:82,shares:1}
 ]);
 assert.equal(r.selfAmount+r.participants.reduce((s,p)=>s+p.amount,0),328);
});
test("Centavos no se pierden cuando un monto no se divide exacto",()=>{
 const r=normalize({...base,amount:100,participants:[{person:"Charlie",shares:2}]});
 assert.equal(r.selfAmount,33.34);
 assert.equal(r.participants[0].amount,66.66);
 assert.equal(Math.round((r.selfAmount+r.participants[0].amount)*100),10000);
});
test("Personalizado: cada persona puede pagar un monto diferente en dólares",()=>{
 const r=normalize({...base,splitMode:"amount",selfAmount:48,participants:[
  {person:"Charlie",shares:2,amount:200},{person:"Ana",shares:1,amount:80}]});
 assert.equal(r.selfAmount,48);assert.equal(r.participants[0].amount,200);
 assert.equal(r.participants[1].amount,80);
});
test("Rechaza valores inconsistentes, duplicados, centavos inválidos y monedas desconocidas",()=>{
 for(const payload of [
  {...base,splitMode:"amount",selfAmount:20,participants:[{person:"Charlie",amount:100,shares:2}]},
  {...base,participants:[{person:"Charlie",shares:1},{person:"charlie",shares:2}]},
  {...base,amount:328.123},
  {...base,amount:-1},
  {...base,currency:"BTC"},
  {...base,participants:[{person:"",shares:2}]},
  {...base,participants:[{person:"Charlie",shares:0}]}
 ])assert.throws(()=>normalize(payload));
});

test("Se puede reutilizar un grupo sin volver a crear el nombre",()=>{
 const r=normalize({...base,groupId:"santa-teresa-2026-11",groupName:"",
  amount:60,selfShares:1,participants:[{person:"Charlie",shares:1},{person:"Cardona",shares:1}]});
 assert.equal(r.groupId,"santa-teresa-2026-11");
 assert.equal(r.groupName,"");
 assert.equal(r.selfAmount,20);
 assert.equal(r.participants[0].amount,20);
 assert.equal(r.participants[1].amount,20);
});
test("No se aceptan identificadores de grupo malformados",()=>{
 assert.throws(()=>normalize({...base,groupId:"not an ID"}));
});
