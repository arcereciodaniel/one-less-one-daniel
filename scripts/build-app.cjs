"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATE_PATH = path.join(ROOT, "src", "app-shell.html");
const CSS_PATH = path.join(ROOT, "src", "styles", "app.css");
const PARTS = Object.freeze([
  "00-model-and-setup.js",
  "10-persistence-and-currency.js",
  "20-dashboard-budget.js",
  "30-debts-and-collections.js",
  "40-goals.js",
  "50-reports-and-movements.js",
  "60-forms-and-events.js",
  "70-views-and-filters.js",
  "80-debt-schedule.js",
  "90-quick-actions-startup.js"
]);
const CSS_TOKEN = "<!-- ONE_LESS_ONE_STYLES -->";
const SCRIPT_TOKEN = "<!-- ONE_LESS_ONE_MAIN_SCRIPT -->";

function replaceExactlyOnce(source, token, content) {
  assert.equal(source.split(token).length, 2, "La plantilla debe contener exactamente una vez: " + token);
  // Un callback impide que `${...}`, $& o $$ en el código fuente se interpreten
  // como patrones especiales de String.replace al reconstruir JavaScript/CSS.
  return source.replace(token, () => content);
}

function buildApp() {
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const js = PARTS.map(name => fs.readFileSync(path.join(ROOT, "src", "modules", name), "utf8")).join("");
  const withStyles = replaceExactlyOnce(template, CSS_TOKEN, "<style>" + css + "</style>");
  const generated = replaceExactlyOnce(withStyles, SCRIPT_TOKEN, "<script>" + js + "</script>");
  assert(generated.includes('const STORAGE_KEY = "daniel_finanzas_local_v1";'), "No se encuentra la clave de datos Daniel");
  assert(generated.includes('<small class="brand-version">v11.1.0</small>'), "La versión principal es incorrecta");
  return generated;
}

function main() {
  const output = path.join(ROOT, "index.html");
  const generated = buildApp();
  if (process.argv.includes("--check")) {
    assert.equal(fs.readFileSync(output, "utf8"), generated,
      "index.html no coincide con los módulos. Ejecutá node scripts/build-lab.cjs");
    console.log("Fuente modular V11 y Daniel sincronizados.");
  } else {
    fs.writeFileSync(output, generated);
    console.log("Daniel generado desde los módulos V11.");
  }
}

if (require.main === module) main();
module.exports = {buildApp, PARTS, CSS_TOKEN, SCRIPT_TOKEN};
