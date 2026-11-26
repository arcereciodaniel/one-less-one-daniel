"use strict";
function demoLedger(){
 const categories=[["salary","Salario","Ingreso"],["food","Supermercado","Gasto"],["phone","Celular","Gasto"],["fuel","Gasolina","Gasto"],["leisure","Ocio","Gasto"],["debt","Préstamo","Pago deuda"],["save","Ahorro para viaje","Ahorro"]].map(([id,name,type])=>({id,name,type}));
 const allocations=[],movements=[];
 for(const month of ["2026-10","2026-11","2026-12","2027-01","2027-02"]){
  const a=(categoryId,day,amount)=>allocations.push({id:month+"-"+categoryId+"-"+day,categoryId,date:month+"-"+String(day).padStart(2,"0"),amount});
  for(const d of [5,12,19,26])a("food",d,20000);
  for(const d of [14,28]){a("salary",d,300000);a("fuel",d,15000)}
  a("phone",18,20000);a("debt",25,30000);a("save",14,10000);
  if(month<="2026-12"){const m=(categoryId,day,amount,description)=>movements.push({id:month+"-m-"+categoryId+"-"+day,categoryId,date:month+"-"+String(day).padStart(2,"0"),amount,description});
   m("salary",14,300000,"Salario");m("food",5,18000,"Compra semanal");m("food",12,19500,"Compra semanal");m("food",17,15000,"Compra semanal");m("fuel",14,12000,"Combustible");m("phone",18,20000,"Factura celular");m("leisure",19,5000,"Café");m("save",14,10000,"Aporte a meta");}
 }
 // Historical budget without a date: preserve the whole amount, do not invent a weekly split.
 allocations.push({id:"legacy-unassigned",categoryId:"fuel",start:"2026-12-01",end:"2026-12-31",amount:12000});
 return {categories,allocations,movements};
}
module.exports={demoLedger};
