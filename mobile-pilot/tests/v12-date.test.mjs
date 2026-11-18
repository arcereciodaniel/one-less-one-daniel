import test from "node:test";
import assert from "node:assert/strict";
import {oneMobileValidCaptureDate} from "../src/worker.js";
test("V12: acepta mañana UTC cuando el iPhone está en Asia",()=>{
 const now=new Date("2026-11-19T15:30:00Z");
 assert.equal(oneMobileValidCaptureDate("2026-11-20",now),true);
 assert.equal(oneMobileValidCaptureDate("2026-11-21",now),false);
 assert.equal(oneMobileValidCaptureDate("2026-11-19",now),true);
});
test("V12: no acepta fechas imposibles o arbitrariamente futuras",()=>{
 const now=new Date("2026-11-19T15:30:00Z");
 for(const date of ["2026-02-30","2026-11-21","2027-01-01","2025-01-01"])
  assert.equal(oneMobileValidCaptureDate(date,now),false);
});
