import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { validationCommands } from "./validation-plan.mjs";

const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));
const [ci, deploy, delivery, runner, artworkBuilder, artworkVerifier, build, sync, smoke, deployedQr] = await Promise.all([
  fs.readFile(".github/workflows/deep-cuts-ci.yml", "utf8"),
  fs.readFile(".github/workflows/deploy-cloudflare.yml", "utf8"),
  fs.readFile(".github/workflows/deep-cuts-delivery-assets.yml", "utf8"),
  fs.readFile("scripts/run-validation.mjs", "utf8"),
  fs.readFile("scripts/build-delivery-assets.mjs", "utf8"),
  fs.readFile("scripts/verify-delivery-assets.py", "utf8"),
  fs.readFile("scripts/build-cloudflare.mjs", "utf8"),
  fs.readFile("scripts/sync-editions.mjs", "utf8"),
  fs.readFile("scripts/smoke-live.mjs", "utf8"),
  fs.readFile("scripts/verify-deployed-qr.mjs", "utf8")
]);

assert.equal(packageJson.scripts.validate, "node scripts/run-validation.mjs");
assert.equal(packageJson.scripts["build:artwork"], "node scripts/build-delivery-assets.mjs");
assert.equal(new Set(validationCommands.map(step => step.args.join(" "))).size, validationCommands.length, "Validation commands must remain unique.");
assert.ok(validationCommands.length >= 56, "The optimized runner must preserve every original validation command.");
assert.match(runner, /DEEP_CUTS_VALIDATION_JOBS/);
assert.match(runner, /failureSeen/);
assert.match(runner, /profile/);
assert.match(runner, /estimatedMs/);

assert.doesNotMatch(ci, /\n  push:/, "Main deployment already calls validation; a second push workflow would duplicate it.");
assert.match(ci, /pull_request:/);
assert.match(ci, /workflow_call:/);
assert.match(ci, /verify-delivery-assets\.py --slug/);

for (const workflow of [deploy, delivery]) {
  assert.match(workflow, /actions\/cache@v4/);
  assert.match(workflow, /deep-cuts-artwork-v1-/);
  assert.match(workflow, /build-delivery-assets\.mjs --validated --dependencies-ready --jobs 2/);
  assert.match(workflow, /verify-delivery-assets\.py/);
  assert.doesNotMatch(workflow, /while read slug/, "Active editions must use the bounded parallel renderer, not a repeated sequential build.");
}
assert.match(deploy, /actions\/upload-artifact@v4/);
assert.match(deploy, /name: deep-cuts-delivery-assets/);
assert.doesNotMatch(delivery, /\n  push:/, "The deploy workflow now preserves the automatic delivery package without rendering it twice.");

assert.match(artworkBuilder, /Deep Cuts delivery artwork:/);
assert.match(artworkBuilder, /Complete artwork integrity and scan-back verification/);
assert.match(artworkVerifier, /zxingcpp\.read_barcode/);
assert.match(artworkVerifier, /hashlib\.sha256/);
assert.match(artworkVerifier, /reduced_size = \(960, 540\) if image\.width > image\.height else \(540, 540\)/);
assert.match(build, /Promise\.all/);
for(const deploymentCheck of [sync,smoke,deployedQr]){
  assert.match(deploymentCheck, /mapLimit/);
  assert.match(deploymentCheck, /DEEP_CUTS_DEPLOY_JOBS/);
}
assert.equal((smoke.match(/fetch\(`\$\{base\}\/platform\.json`/g)||[]).length,1,"Live smoke testing must fetch the registry once.");

console.log("Performance-pipeline tests passed: full validation, bounded artwork rendering, exact-input caching, QR scan-back and automatic artifacts remain fail-closed.");
