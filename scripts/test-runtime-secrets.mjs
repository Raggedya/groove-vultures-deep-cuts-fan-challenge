import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/deploy-cloudflare.yml','utf8');
const requiredSecrets={
  ADMIN_TOKEN:'DEEP_CUTS_ADMIN_TOKEN',
  RESEND_API_KEY:'RESEND_API_KEY',
  REPORT_RECIPIENT:'REPORT_RECIPIENT',
  REPORT_FROM_EMAIL:'REPORT_FROM_EMAIL'
};
for(const [name,githubName] of Object.entries(requiredSecrets)){
  assert.match(workflow,new RegExp(`put_required_secret ${name} `),`${name} must be installed as a required Cloudflare Worker secret.`);
  assert.match(workflow,new RegExp(`${githubName}: \\\${\\{ secrets\\.${githubName} \\}\\}`),`${name} must come from an encrypted GitHub secret.`);
}
assert.match(workflow,/put_optional_secret RESEND_WEBHOOK_SECRET /,'The verified delivery webhook secret must be installed when configured.');
assert.doesNotMatch(workflow,/echo\s+["']?\$\{?(?:RESEND_API_KEY|DEEP_CUTS_ADMIN_TOKEN)/,'Runtime secret values must never be printed.');

console.log('Cloudflare runtime-secret wiring tests passed.');
