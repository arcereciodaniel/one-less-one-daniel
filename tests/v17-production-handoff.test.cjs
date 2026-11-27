"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),H=require("../src/experimental/v17-production-handoff.cjs"),M=require("../src/experimental/v17-migration-rehearsal.cjs"),B=require("../scripts/build-v17-production-handoff.cjs");
test("handoff requires legacy disconnected, exact original bytes and a private V17 ledger",()=>{
 const source=JSON.stringify({version:6.2,periods:[],movements:[],debts:[],categories:[],settings:{}}),rows=new Map([[H.LEGACY,source]]),io={read:k=>rows.get(k)??null};
 rows.set(H.PREFS,"{}");assert.throws(()=>H.source(io),/Desvinculá/);rows.delete(H.PREFS);assert.equal(H.source(io),source);
 assert.throws(()=>H.assertActive(io,M),/activá/);rows.set(H.SOURCE,source);rows.set(H.ACTIVE,JSON.stringify({...JSON.parse(source),[M.FIELD]:{format:"v17-private-lab-v1",importDate:"2026-11-26"}}));assert(H.assertActive(io,M));
 rows.set(H.LEGACY,source+" ");assert.throws(()=>H.assertActive(io,M),/cambió/);rows.set(H.LEGACY,source);rows.set(H.PREFS,"{}");assert.throws(()=>H.assertActive(io,M),/Desvinculá/);
});
test("production candidate uses distinct key and exact origin, never automatically syncs",()=>{
 assert(H.locationAllowed(H.ORIGIN,H.PATH));assert(!H.locationAllowed(H.ORIGIN,"/one-less-one-daniel/"));assert(!H.locationAllowed("https://evil.invalid",H.PATH));
 const h=B.buildCandidate();assert(h.includes(H.ORIGIN));assert(h.includes(H.PATH));assert(h.includes(H.PREFIX));assert(h.includes(B.ENDPOINT));assert(!h.includes("one-less-one-mobile-v17-staging.one-less-one-rastro.workers.dev"));assert(h.includes("v17ProductionMobileReceipts"));
 const {JSDOM}=require("jsdom"),d=new JSDOM(h,{url:"https://evil.invalid/",runScripts:"dangerously"});try{assert.equal(d.window.localStorage.length,0);assert.match(d.window.document.body.textContent,/Ruta de activación no autorizada/)}finally{d.window.close()}
});
