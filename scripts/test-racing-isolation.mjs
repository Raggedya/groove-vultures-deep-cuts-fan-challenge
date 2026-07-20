import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";

function git(...args){return execFileSync("git",args,{encoding:"utf8"})}
function exists(ref){try{git("rev-parse","--verify",ref);return true}catch{return false}}

const requestedBase=process.env.DEEP_CUTS_ISOLATION_BASE;
const githubBase=process.env.GITHUB_BASE_REF?`origin/${process.env.GITHUB_BASE_REF}`:"";
const base=[requestedBase,githubBase,"main","HEAD^"].find(ref=>ref&&exists(ref));
assert.ok(base,"Racing isolation needs a reachable base revision.");

const changed=git("diff","--name-only",`${base}...HEAD`).trim().split(/\r?\n/).filter(Boolean);
for(const file of changed)assert.ok(!file.startsWith("editions/"),`Racing must not modify a completed edition: ${file}`);
for(const file of ["index.html","styles.css","js/app.js","js/school-quiz.js","platform.json","assets/aggits.png"]){if(!fs.existsSync(file))continue;const before=git("show",`${base}:${file}`).replaceAll("\r\n","\n");const after=fs.readFileSync(file,"utf8").replaceAll("\r\n","\n");assert.equal(after,before,`Protected existing product file changed: ${file}`)}
const contracts=JSON.parse(fs.readFileSync("edition-contracts.json","utf8"));assert.deepEqual(contracts.editionTypes.racing.exclusiveConfig,["racing"]);
assert.match(fs.readFileSync("scripts/build-cloudflare.mjs","utf8"),/'racing'/);
const worker=fs.readFileSync("worker/index.js","utf8");assert.equal((worker.match(/startsWith\("\/api\/racing\/"\)/g)||[]).length,1,"Racing must have one isolated Worker entry point.");
const migration=fs.readFileSync("migrations/0002_racing_v1.sql","utf8");for(const table of ["racing_races","racing_runners","racing_predictions","racing_tipsters","racing_results","racing_post_race_reviews"])assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
console.log("Deep Cuts Racing isolation tests passed; completed editions are unchanged.");
