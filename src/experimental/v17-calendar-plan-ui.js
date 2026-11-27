// Preview-only, deliberately no activation until the income rules and overlays are verified.
 const calendarFrequency=el("calendarFrequency"),calendarDays=el("calendarDays"),calendarStatus=el("calendarStatus"),calendarRows=el("calendarRows");
 function previewSalaryCalendar(){
  calendarRows.replaceChildren();
  try{
   oneStorageAssertCurrent();
   const raw=JSON.parse(oneStorageSnapshot),memory=rawNow(),before=localStorage.getItem(STORAGE_KEY);
   const p=oneV17CalendarPlan.preview(raw,TODAY,calendarFrequency.value,Number(calendarDays.value),oneV15QueryCore,x=>periodEndDate(x,raw.periods,raw.settings));
   if(localStorage.getItem(STORAGE_KEY)!==before||JSON.stringify(rawNow())!==JSON.stringify(memory))throw Error("Cambio inesperado");
   calendarStatus.textContent=p.ready?"Vista previa · desde "+p.proposal.start+" · "+p.periods.length+" períodos. No genera ingresos ni modifica datos.":"Revisión necesaria: "+p.issues.map(x=>({"future-records":"Hay registros posteriores al horizonte","existing-transition":"Ya existe una transición","assigned-future-movements":"Movimientos futuros asignados","legacy-overlap":"Períodos superpuestos","transition-gap":"Intervalo sin cubrir","not-future":"Fecha no futura"})[x]||x).join(" · ");
   for(const x of p.periods){const row=document.createElement("div");row.className="demo-alloc";row.textContent=x.start+" – "+x.end;calendarRows.append(row)}
  }catch(e){calendarStatus.textContent=e.message}
 }
 el("calendarPreview").onclick=previewSalaryCalendar;
 for(const input of [calendarFrequency,calendarDays])input.onchange=()=>{calendarRows.replaceChildren();calendarStatus.textContent=""};
