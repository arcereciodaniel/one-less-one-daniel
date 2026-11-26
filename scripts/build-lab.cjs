"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const {buildApp} = require("./build-app.cjs");
const SOURCE = path.join(ROOT, "index.html");
const OUT = path.join(ROOT, "lab", "index.html");
const MANIFEST = path.join(ROOT, "site.webmanifest");
const LAB_MANIFEST = path.join(ROOT, "lab", "site.webmanifest");

const REPLACEMENTS = [
  ['<small class="brand-version">v16.0.0</small>', '<small class="brand-version">v16.0.0 LAB</small>'],
  ['<footer>One Less One · by rastro. · v16.0.0 · CRC/USD · Datos locales · No envía información a ningún servidor.</footer>', '<footer>One Less One · by rastro. · v16.0.0 LAB · CRC/USD · Datos locales · No envía información a ningún servidor.</footer>'],
  ['const STORAGE_KEY = "daniel_finanzas_local_v1";', 'const STORAGE_KEY = "rastro_lab_v7_1_data_v1";'],
  ['const UI_STORAGE_KEY = "daniel_finanzas_ui_v1";', 'const UI_STORAGE_KEY = "rastro_lab_v7_1_ui_v1";'],
  ['const RECEIVABLE_CLEAN_START_KEY = "rastro_receivables_clean_start_v57";', 'const RECEIVABLE_CLEAN_START_KEY = "rastro_lab_v7_1_receivables_v1";'],
  ['const ONE_DEFAULT_SHOW_COBROS=true;', 'const ONE_DEFAULT_SHOW_COBROS=false;'],
  ['const UI_PREFS_KEY="rastro-ui-v6";', 'const UI_PREFS_KEY="rastro_lab_v7_1_prefs_v1";'],
  ['href="mobile-pilot/desktop.css"', 'href="../mobile-pilot/desktop.css"'],
  ['src="mobile-pilot/public/split-fare.js"', 'src="../mobile-pilot/public/split-fare.js"'],
  ['src="mobile-pilot/desktop.js"', 'src="../mobile-pilot/desktop.js"']
];

function replaceExactlyOnce(text, oldText, newText) {
  const found = text.indexOf(oldText);
  if (found === -1 || text.indexOf(oldText, found + oldText.length) !== -1) {
    throw new Error("No se encontró una sola coincidencia del ajuste de Lab: " + oldText);
  }
  return text.slice(0, found) + newText + text.slice(found + oldText.length);
}

function labFromDaniel(daniel) {
  let html = daniel;
  for (const [before, after] of REPLACEMENTS) html = replaceExactlyOnce(html, before, after);
  return html;
}

function labManifestFromDaniel(manifest) {
  const m = JSON.parse(manifest);
  assert.equal(m.name, "One Less One", "Manifiesto principal inesperado");
  return JSON.stringify({...m, name: "One Less One · Lab", short_name: "One Less One Lab"}, null, 2) + "\n";
}

function main() {
  const daniel = buildApp();
  const html = labFromDaniel(daniel);
  const manifest = labManifestFromDaniel(fs.readFileSync(MANIFEST, "utf8"));
  if (process.argv.includes("--check")) {
    assert.equal(fs.readFileSync(SOURCE, "utf8"), daniel, "Daniel desactualizado: ejecutá node scripts/build-lab.cjs");
    assert.equal(fs.readFileSync(OUT, "utf8"), html, "Lab desactualizado: ejecutá node scripts/build-lab.cjs");
    assert.equal(fs.readFileSync(LAB_MANIFEST, "utf8"), manifest, "Manifest de Lab desactualizado");
    console.log("Lab y Daniel sincronizados, con almacenamiento independiente.");
  } else {
    fs.writeFileSync(SOURCE, daniel);
    fs.mkdirSync(path.dirname(OUT), {recursive: true});
    fs.writeFileSync(OUT, html);
    fs.writeFileSync(LAB_MANIFEST, manifest);
    console.log("Lab generado desde Daniel.");
  }
}
if (require.main === module) main();
module.exports = {labFromDaniel, labManifestFromDaniel, REPLACEMENTS};
