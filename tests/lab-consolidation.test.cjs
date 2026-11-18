"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {labFromDaniel, labManifestFromDaniel, REPLACEMENTS} = require("../scripts/build-lab.cjs");
const root = path.resolve(__dirname, "..");
const daniel = fs.readFileSync(path.join(root, "index.html"), "utf8");
const lab = fs.readFileSync(path.join(root, "lab/index.html"), "utf8");
const mainManifest = fs.readFileSync(path.join(root, "site.webmanifest"), "utf8");
const labManifest = fs.readFileSync(path.join(root, "lab/site.webmanifest"), "utf8");

test("Lab se genera desde una sola fuente de Daniel", () => {
  assert.equal(labFromDaniel(daniel), lab);
  assert.equal(labManifestFromDaniel(mainManifest), labManifest);
  assert.equal(REPLACEMENTS.length, 10);
});

test("Datos y preferencias de Daniel y Lab quedan separados", () => {
  const pairs = [
    ["STORAGE_KEY", "daniel_finanzas_local_v1", "rastro_lab_v7_1_data_v1"],
    ["UI_STORAGE_KEY", "daniel_finanzas_ui_v1", "rastro_lab_v7_1_ui_v1"],
    ["RECEIVABLE_CLEAN_START_KEY", "rastro_receivables_clean_start_v57", "rastro_lab_v7_1_receivables_v1"],
    ["UI_PREFS_KEY", "rastro-ui-v6", "rastro_lab_v7_1_prefs_v1"]
  ];
  for (const [variable, danielKey, labKey] of pairs) {
    assert(daniel.includes(`const ${variable} = "${danielKey}";`) || daniel.includes(`const ${variable}="${danielKey}";`));
    assert(lab.includes(`const ${variable} = "${labKey}";`) || lab.includes(`const ${variable}="${labKey}";`));
    assert(!lab.includes(`const ${variable} = "${danielKey}";`));
  }
  assert(lab.includes("ONE_DEFAULT_SHOW_COBROS=false"));
  assert(daniel.includes("ONE_DEFAULT_SHOW_COBROS=true"));
});

test("Lab enlaza correctamente sus recursos compartidos", () => {
  assert(lab.includes('href="./site.webmanifest?v=1200"'));
  assert(lab.includes('href="../mobile-pilot/desktop.css"'));
  assert(lab.includes('src="../mobile-pilot/desktop.js"'));
  assert.equal(JSON.parse(labManifest).start_url, "./");
  assert.equal(JSON.parse(labManifest).scope, "./");
  assert.equal(JSON.parse(labManifest).name, "One Less One · Lab");
});

test("No se mezcla la información con Gloriana", () => {
  assert(!lab.includes("gloriana_one_less_one_data_v2"));
  assert(!daniel.includes("gloriana_one_less_one_data_v2"));
  assert(!lab.includes('const STORAGE_KEY = "daniel_finanzas_local_v1";'));
});
