"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("mobile-pilot/public/index.html","utf8");
const script=fs.readFileSync("mobile-pilot/public/app.js","utf8");
const helper=fs.readFileSync("mobile-pilot/public/split-fare.js","utf8");
const groupId="santa-teresa-2026-11";
function boot(){
 const errors=[],vc=new VirtualConsole();
 vc.on("jsdomError",e=>errors.push(String(e.stack||e)));
 const dom=new JSDOM(html,{url:"https://pilot.example.workers.dev/",runScripts:"outside-only",
  pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window,doc=w.document,submitted=[];
 w.localStorage.setItem("one_one_mobile_v1_key","m".repeat(40));
 let n=0;
 Object.defineProperty(w.crypto,"randomUUID",{configurable:true,value:()=> "test-group-entry-abcdefgh123"+n++});
 w.fetch=async(path,opts={})=>{
  if(path==="/api/catalog")return {ok:true,json:async()=>({catalog:{
    categories:[{id:"cat-g",name:"Supermercado",type:"Gasto"},{id:"cat-i",name:"Ingresos extras",type:"Ingreso"}],debts:[],goals:[],
    groups:[{id:groupId,name:"Viaje a Santa Teresa",people:["Charlie","Cardona","Joshua"]}]
  }})};
  if(path==="/api/inbox"&&opts.method==="POST"){
   const entry=JSON.parse(opts.body);submitted.push(entry);
   return {ok:true,json:async()=>({received:true,id:entry.id})};
  }
  throw Error("Unexpected API "+path);
 };
 w.eval(helper+"\n"+script);
 return {w,doc,submitted,errors,close:()=>w.close()};
}
test("iPhone propone participantes habituales y manda solo a Charlie y Cardona",async()=>{
 const x=boot();try{
  const {w,doc,submitted}=x;
  await new Promise(resolve=>setTimeout(resolve,20));
  doc.querySelector('[data-type="Cobro"]').click();
  doc.getElementById("splitToggle").checked=true;
  doc.getElementById("splitToggle").dispatchEvent(new w.Event("change",{bubbles:true}));
  doc.getElementById("cobroGroup").value=groupId;
  doc.getElementById("cobroGroup").dispatchEvent(new w.Event("change",{bubbles:true}));
  assert.equal(doc.getElementById("splitGroupNameField").hidden,true);
  const choices=[...doc.querySelectorAll("#splitMembers button")].map(b=>b.textContent);
  assert.deepEqual(choices,["Charlie","Cardona","Joshua"]);
  [...doc.querySelectorAll("#splitMembers button")].find(b=>b.textContent==="Charlie").click();
  [...doc.querySelectorAll("#splitMembers button")].find(b=>b.textContent==="Cardona").click();
  const names=[...doc.querySelectorAll("#splitRows .split-person")].map(e=>e.value);
  assert.deepEqual(names,["Charlie","Cardona"]);
  doc.getElementById("description").value="Cena";
  doc.getElementById("amount").value="60";
  doc.getElementById("currency").value="USD";
  doc.getElementById("currency").dispatchEvent(new w.Event("change",{bubbles:true}));
  doc.getElementById("amount").dispatchEvent(new w.Event("input",{bubbles:true}));
  assert.match(doc.getElementById("splitPreview").textContent,/\$20\.00/);
  doc.getElementById("entryForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(submitted.length,1);
  const p=submitted[0].movement;
  assert.equal(p.type,"Cobro dividido");assert.equal(p.groupId,groupId);
  assert.equal(p.groupName,"");
  assert.equal(p.amount,60);assert.equal(p.currency,"USD");
  assert.deepEqual(p.participants.map(p=>p.person),["Charlie","Cardona"]);
  assert.deepEqual(p.participants.map(p=>p.amount),[20,20]);
  assert.equal(p.selfAmount,20);
  assert.equal(x.errors.length,0);
 }finally{x.close()}
});
test("iPhone permite cobro individual en un grupo sin duplicar otras personas",async()=>{
 const x=boot();try{
  const {w,doc,submitted}=x;
  await new Promise(resolve=>setTimeout(resolve,20));
  doc.querySelector('[data-type="Cobro"]').click();
  doc.getElementById("cobroGroup").value=groupId;
  doc.getElementById("cobroGroup").dispatchEvent(new w.Event("change",{bubbles:true}));
  assert.equal(doc.querySelectorAll("#cobroPersonSuggestions option").length,3);
  doc.getElementById("person").value="Charlie";
  doc.getElementById("description").value="Taxi";
  doc.getElementById("amount").value="15";
  doc.getElementById("currency").value="USD";
  doc.getElementById("entryForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(submitted.length,1);
  assert.equal(submitted[0].movement.type,"Cobro");
  assert.equal(submitted[0].movement.groupId,groupId);
  assert.equal(submitted[0].movement.person,"Charlie");
  assert.equal(submitted[0].movement.amount,15);
  assert.equal(x.errors.length,0);
 }finally{x.close()}
});

test("V10.7: iPhone crea grupo y cobro individual sin repartir",async()=>{
 const x=boot();try{
  const {w,doc,submitted}=x;await new Promise(r=>setTimeout(r,20));
  doc.querySelector('[data-type="Cobro"]').click();
  doc.getElementById("cobroGroup").value="__new__";
  doc.getElementById("cobroGroup").dispatchEvent(new w.Event("change",{bubbles:true}));
  assert.equal(doc.getElementById("splitGroupNameField").hidden,false);
  assert.equal(doc.getElementById("splitFields").hidden,true);
  doc.getElementById("splitGroupName").value="Mamá";
  doc.getElementById("person").value="Mamá";
  doc.getElementById("amount").value="8500";
  doc.getElementById("description").value="Supermercado";
  doc.getElementById("entryForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  await new Promise(r=>setTimeout(r,30));
  assert.equal(submitted.length,1);
  assert.equal(submitted[0].movement.type,"Cobro");
  assert.equal(submitted[0].movement.groupName,"Mamá");
  assert.equal(submitted[0].movement.groupId,"");
  assert.equal(submitted[0].movement.person,"Mamá");
  assert.equal(submitted[0].movement.amount,8500);
  assert.equal(x.errors.length,0);
 }finally{x.close()}
});
test("V10.7: Ingreso y Gasto envían USD sin convertir",async()=>{
 const x=boot();try{
  const {w,doc,submitted}=x;await new Promise(r=>setTimeout(r,20));
  for(const [type,category,amount] of [["Ingreso","cat-i",120],["Gasto","cat-g",19.75]]){
   doc.querySelector('[data-type="'+type+'"]').click();
   assert.equal(doc.getElementById("currencyField").hidden,false);
   doc.getElementById("currency").value="USD";
   doc.getElementById("currency").dispatchEvent(new w.Event("change",{bubbles:true}));
   assert.equal(doc.getElementById("moneySymbol").textContent,"$");
   doc.getElementById("categoryId").value=category;
   doc.getElementById("amount").value=String(amount);
   doc.getElementById("entryForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
   await new Promise(r=>setTimeout(r,30));
  }
  assert.equal(submitted.length,2);
  assert.equal(submitted[0].movement.currency,"USD");
  assert.equal(submitted[0].movement.amount,120);
  assert.equal(submitted[1].movement.currency,"USD");
  assert.equal(submitted[1].movement.amount,19.75);
  assert.equal(x.errors.length,0);
 }finally{x.close()}
});


test("V10.8: interfaz USD presenta explicación sin agregar campos y conserva fecha Safari",async()=>{
 const x=boot();try{
  const {w,doc}=x;await new Promise(r=>setTimeout(r,20));
  const hint=doc.getElementById("currencyHint");
  assert.equal(hint.hidden,true);
  doc.getElementById("currency").value="USD";
  doc.getElementById("currency").dispatchEvent(new w.Event("change",{bubbles:true}));
  assert.equal(hint.hidden,false);
  assert.match(hint.textContent,/tipo de cambio histórico/i);
  assert.equal(doc.getElementById("moneySymbol").textContent,"$");
  const date=doc.getElementById("date");
  assert.equal(date.type,"date");
  const prior=date.value;
  doc.dispatchEvent(new w.Event("visibilitychange"));
  assert.equal(date.value,prior,"Volver a Safari no modifica la fecha introducida");
  assert.match(date.max,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(x.errors.length,0);
 }finally{x.close()}
});
test("V10.8: tras falla de conexión, reintentar conserva mismo ID y no pierde el borrador",async()=>{
 const x=boot();try{
  const {w,doc,submitted}=x;await new Promise(r=>setTimeout(r,20));
  let attempts=0;
  w.fetch=async (path,opts={})=>{
   if(path==="/api/inbox"&&opts.method==="POST"){
    attempts++;
    if(attempts===1)throw Error("Sin conexión");
    const payload=JSON.parse(opts.body);submitted.push(payload);
    return {ok:true,json:async()=>({received:true,id:payload.id})};
   }
   throw Error("Ruta inesperada "+path);
  };
  doc.getElementById("categoryId").value="cat-g";
  doc.getElementById("amount").value="7500";
  doc.getElementById("description").value="Compra sin red";
  const submit=()=>doc.getElementById("entryForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  submit();await new Promise(r=>setTimeout(r,35));
  const draft=w.localStorage.getItem("one_one_mobile_v1_draft");
  assert(draft,"El borrador debe mantenerse después de un error");
  const draftId=JSON.parse(draft).id;
  assert.match(doc.getElementById("status").textContent,/No confirmado/);
  submit();await new Promise(r=>setTimeout(r,35));
  assert.equal(attempts,2);
  assert.equal(submitted.length,1);
  assert.equal(submitted[0].id,draftId);
  assert.equal(w.localStorage.getItem("one_one_mobile_v1_draft"),null);
  assert.equal(x.errors.length,0);
 }finally{x.close()}
});
