"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {labFromDaniel, labManifestFromDaniel, REPLACEMENTS} = require("../scripts/build-lab.cjs");
const root = path.resolve(__dirname, "..");
const daniel = fs.readFileSync(path.join(root, "index.html"), "utf8");
const lab = fs.readFileSync(path.join(root, "lab/index.html"), "utf8");
const manifest = fs.readFileSync(path.join(root, "site.webmanifest"), "utf8");
const labManifest = fs.readFileSync(path.join(root, "lab/site.webmanifest"), "utf8");

test("Lab es generado únicamente a partir del código de Daniel", () => {
  assert.equal(labFromDaniel(daniel), lab);
  assert.equal(labManifestFromDaniel(manifest), labManifest);
  assert.equal(REPLACEMENTS.length, 9);
});

test("Daniel y Lab tienen claves distintas; no comparten registros locales", () => {
  const identifiers = [
    ["STORAGE_KEY", "daniel_finanzas_local_v1", "rastro_lab_v7_1_data_v1"],
    ["UI_STORAGE_KEY", "daniel_finanzas_ui_v1", "rastro_lab_v7_1_ui_v1"],
    ["RECEIVABLE_CLEAN_START_KEY", "rastro_receivables_clean_start_v57", "rastro_lab_v7_1_receivables_v1"],
    ["UI_PREFS_KEY", "rastro-ui-v6", "rastro_lab_v7_1_prefs_v1"]
  ];
  for (const [variable, danielKey, labKey] of identifiers) {
    assert.match(daniel, new RegExp("const " + variable + "\\\\s*=\\\\s*[\\"']" + danielKey));
    assert.match(lab, new RegExp("const " + variable + "\\\\s*=\\\\s*[\\"']" + labKey));
    assert.doesNotMatch(lab, new RegExp("const " + variable + "\\\\s*=\\\\s*[\\"']" + danielKey));
  }
  assert.match(lab, /ONE_DEFAULT_SHOW_COBROS=false/);
  assert.match(daniel, /ONE_DEFAULT_SHOW_COBROS=true/);
});

test("Lab usa assets y manifest correctos desde su subcarpeta", () => {
  assert.match(lab, /href="\\.\\/site\\.webmanifest\\?v=812"/);
  assert.match(lab, /href="\\.\\.\\/mobile-pilot\\/desktop\\.css"/);
  assert.match(lab, /src="\\.\\.\\/mobile-pilot\\/desktop\\.js"/);
  assert.equal(JSON.parse(labManifest).start_url, "./");
  assert.equal(JSON.parse(labManifest).scope, "./");
  assert.equal(JSON.parse(labManifest).name, "One Less One · Lab");
});

test("La unificación no crea perfiles compartidos, ni implica migración", () => {
  assert(!lab.includes('gloriana_one_less_one_data_v2'));
  assert(!daniel.includes('gloriana_one_less_one_data_v2'));
  assert(!lab.includes('const STORAGE_KEY = "daniel_finanzas_local_v1";'));
});
