import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const html=read("../public/index.html"),css=read("../public/style.css"),script=read("../public/app.js");
test("V10.1: solo Gasto, Ingreso y Cobro visibles",()=>{
 assert.deepEqual([...html.matchAll(/data-type="([^"]+)"/g)].map(x=>x[1]),["Gasto","Ingreso","Cobro"]);
 assert.equal(html.includes('id="debtField"'),false);
 assert.equal(html.includes('id="goalField"'),false);
 assert.match(html,/id="personField"/);
 assert.match(html,/id="dueField"/);
 assert.match(script,/const TYPES=\["Gasto","Ingreso","Cobro"\]/);
});
test("V10.1: campos consistentes y monto legible",()=>{
 assert.match(css,/color-scheme:dark/);
 assert.match(css,/\.field input,\.field select/);
 assert.match(css,/height:54px/);
 assert.match(css,/\.field input\[type="date"\]/);
 assert.match(css,/-webkit-date-and-time-value/);
 assert.match(css,/-webkit-text-fill-color:var\(--text\)!important/);
 assert.match(html,/id="todayButton"/);
 assert.match(html,/id="discardDraft"/);
});
test("V10.1: JavaScript válido y conserva claves y reintentos",()=>{
 new vm.Script(script);
 assert.match(script,/one_one_mobile_v1_key/);
 assert.match(script,/one_one_mobile_v1_draft/);
 assert.match(script,/crypto\.randomUUID\(\)/);
 assert.match(script,/localStorage\.removeItem\(DRAFT\)/);
 assert.match(script,/if\(!pending\)setType/);
});

test("V10.2: marca oficial y fecha robusta para Safari",()=>{
 assert.match(html,/>One Less One<\/div>/);
 assert.doesNotMatch(html,/one <span>−<\/span> one/);
 assert.match(html,/id="dateDisplay"/);
 assert.match(html,/id="dueDateDisplay"/);
 assert.match(css,/\.date-control\s*\{/);
 assert.match(css,/\.date-control \.date-native\s*\{/);
 assert.match(css,/opacity:\s*0/);
 assert.match(script,/function syncDateDisplays\(\)/);
 assert.match(script,/new Intl\.DateTimeFormat\("es-CR"/);
 assert.match(script,/addEventListener\("change",syncDateDisplays\)/);
 assert.doesNotMatch(html,/CRC · Colones costarricenses/);
 assert.doesNotMatch(html,/Un registro menos por recordar/);
});
