"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto"),cp=require("node:child_process"),{buildCandidate}=require("./build-v17-production-handoff.cjs");
const root=path.resolve(__dirname,".."),stable="4bf80c986ee0a88d88a70a57adc45888365cc0b1";
const files=["index.html","site.webmanifest","index-lab.html","lab/index.html","lab/site.webmanifest","mobile-pilot/desktop.js","mobile-pilot/desktop.css","mobile-pilot/public/split-fare.js"];
function build(dir){
 fs.mkdirSync(dir,{recursive:true});
 const manifest={stable,files:{}};
 for(const rel of files){
  const current=fs.readFileSync(path.join(root,rel)),original=cp.execFileSync("git",["show",stable+":"+rel],{cwd:root,maxBuffer:20*1024*1024});
  assert(current.equals(original),"Stable asset changed: "+rel);
  fs.mkdirSync(path.dirname(path.join(dir,rel)),{recursive:true});fs.writeFileSync(path.join(dir,rel),current);
  manifest.files[rel]=crypto.createHash("sha256").update(current).digest("hex");
 }
 // This release only adds V17. Keep stable entrypoints byte-identical.
 const v17=buildCandidate();fs.mkdirSync(path.join(dir,"v17"),{recursive:true});fs.writeFileSync(path.join(dir,"v17/index.html"),v17);
 manifest.files["v17/index.html"]=crypto.createHash("sha256").update(v17).digest("hex");
 fs.writeFileSync(path.join(dir,".nojekyll"),"");
 const actual=[];function walk(d){for(const item of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,item.name);if(item.isDirectory())walk(p);else actual.push(path.relative(dir,p))}}walk(dir);
 assert.deepEqual(actual.sort(),[...files,"v17/index.html",".nojekyll"].sort(),"Unexpected publication files");
 return manifest;
}
if(require.main===module){
 const dir=path.resolve(root,process.argv[2]||"preview-v17-production-site");
 assert(!fs.existsSync(dir)||fs.readdirSync(dir).length===0,"Output directory must be empty");
 console.log(JSON.stringify(build(dir),null,2));
}
module.exports={build,files,stable};
