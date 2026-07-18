import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
const generator=await fs.readFile('scripts/generate-social-assets.py','utf8');
const deploy=await fs.readFile('.github/workflows/deploy-cloudflare.yml','utf8');
const delivery=await fs.readFile('scripts/send-delivery.mjs','utf8');
const emailWorkflow=await fs.readFile('.github/workflows/verify-email-delivery.yml','utf8');

assert.equal(platform.publicBaseURL,'https://deep-cuts.andrewharris501.workers.dev');
assert.ok(!platform.publicBaseURL.includes('groove-vultures'),'The permanent base URL must not contain an artist name.');
assert.match(generator,/platform\.get\("publicBaseURL"/,'QR generation must default to the permanent platform URL.');
assert.match(generator,/\.example/,'Placeholder QR destinations must be rejected.');
assert.ok(generator.indexOf('canvas.alpha_composite(qr_image')<generator.indexOf('canvas.alpha_composite(foreground_hand)'),'The natural foreground fingers must be restored after the variable QR card is painted.');
assert.ok(deploy.indexOf('Generate scan-tested delivery artwork')<deploy.indexOf('npm run build'),'Delivery artwork must be generated before the static deployment bundle.');
assert.match(deploy,/Verify deployed QR artwork/,'Deployment must verify every public QR PNG.');
assert.match(delivery,/\/output\/\$\{encodeURIComponent\(slug\)\}\/instagram-qr\.png/,'Email must attach the public scan-tested QR PNG.');
assert.match(delivery,/\/api\/delivery/,'Email delivery must use the permanent authenticated delivery API.');
assert.match(delivery,/waitForDelivery\(jobId\)/,'Publishing must wait for confirmed email delivery.');
assert.match(emailWorkflow,/DEEP_CUTS_ADMIN_TOKEN: \$\{\{ secrets\.DEEP_CUTS_ADMIN_TOKEN \}\}/,'The email verification workflow must keep the admin token encrypted.');
console.log('Permanent QR and delivery workflow checks passed.');

