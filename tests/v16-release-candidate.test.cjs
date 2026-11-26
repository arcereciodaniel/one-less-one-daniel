"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),{test}=require("node:test");
const {buildCandidatePreview,buildCandidateAudit}=require("../scripts/build-v16-release-candidate.cjs");
const {releaseAudit}=require("../src/experimental/v15-financial-query.cjs");
test("V16 RC demo remains isolated and includes linked synthetic examples",()=>{
 const html=buildCandidatePreview();
 assert.match(html,/V16\.0 RC1 · DEMO/);assert.match(html,/rastro_lab_v16_rc1_preview_data_v1/);
 assert.match(html,/connect-src 'none'/);assert.doesNotMatch(html,/<script\s+src=|daniel_finanzas_local_v1|rastro_lab_v7_1_data_v1|rastro_lab_v15_9_preview_/);
 const demo=JSON.parse(html.match(/const demo=(\{[^\n]+\});demo\.settings\.fxCheckedOn=todayIso\(\)/)[1]);
 assert.equal(demo.projects[0].goalId,demo.reserves[0].id);
 assert.equal(demo.projectLinks[0].movementId,"g3");
 assert.equal(demo.projectPlans[0].id,demo.projectLinks[0].planId);
 assert.equal(demo.movements.filter(m=>m.id==="g3").length,1);
 assert.equal(demo.reserveMovements[0].budgetCategoryId,"demo-save");
 const report=releaseAudit(demo);assert.equal(report.ready,true,JSON.stringify(report.issues));
});
test("V16 standalone audit and publishing safeguards",()=>{
 const html=buildCandidateAudit(),pages=fs.readFileSync(".github/workflows/pages-gated.yml","utf8"),mobile=fs.readFileSync(".github/workflows/mobile-cloudflare-deploy.yml","utf8");
 assert.match(html,/Auditoría V16\.0 RC1/);assert.match(html,/connect-src 'none'/);assert.doesNotMatch(html,/localStorage|sessionStorage|<script\s+src=|fetch\(/);
 assert.match(pages,/publicar:\n    if: github.ref == 'refs\/heads\/main'/);
 assert.match(pages,/tests\/v15-\*\.test\.cjs tests\/v16-release-candidate\.test\.cjs/);
 assert.match(pages,/Solo una version estable puede publicarse/);
 assert.match(mobile,/branches: \[main\]/);
});
