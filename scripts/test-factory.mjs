import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const skill=await fs.readFile('.agents/skills/deep-cuts-factory/SKILL.md','utf8');
const skillUI=await fs.readFile('.agents/skills/deep-cuts-factory/agents/openai.yaml','utf8');
assert.match(skill,/^---\r?\nname: deep-cuts-factory\r?\ndescription: .+\r?\n---/,'Factory skill requires valid name and description frontmatter.');
assert.match(skillUI,/default_prompt: "[^"]*\$deep-cuts-factory[^"]*"/,'Factory UI prompt must invoke the skill explicitly.');
assert.match(skill,/otherwise merge through the authorised GitHub connector only after the head SHA and green checks are re-confirmed/,'The zero-interaction merge fallback must remain explicit.');

const root=await fs.mkdtemp(path.join(os.tmpdir(),'deep-cuts-factory-'));
const platform={platformName:'Deep Cuts',publicBaseURL:'https://deep-cuts.example.workers.dev',defaultEdition:'',editions:[]};
await fs.writeFile(path.join(root,'platform.json'),JSON.stringify(platform,null,2));
const start=path.resolve('scripts/start-edition.mjs');
const create=path.resolve('scripts/create-edition.mjs');
const env={...process.env,DEEP_CUTS_ROOT:root};
const job=JSON.parse(execFileSync(process.execPath,[start,'Test Artist'],{encoding:'utf8',env}));
const verifiedAt=new Date().toISOString();
const input={bandName:'Test Artist',bio:'Verified independent rock with melodic hooks.',links:{spotify:'https://open.spotify.com/artist/test',bandcamp:'https://testartist.bandcamp.com/'},sources:[
  {destination:'spotify',url:'https://open.spotify.com/artist/test',sourceType:'official artist profile',identityVerified:true,verifiedAt,evidence:'Artist name and catalogue match.'},
  {destination:'bandcamp',url:'https://testartist.bandcamp.com/',sourceType:'official artist store',identityVerified:true,verifiedAt,evidence:'Artist-controlled catalogue and identity match.'}
]};
const inputPath=path.join(root,'input.json');await fs.writeFile(inputPath,JSON.stringify(input));
const created=JSON.parse(execFileSync(process.execPath,[create,inputPath],{encoding:'utf8',env}));
const updated=JSON.parse(await fs.readFile(path.join(root,'platform.json'),'utf8'));
const config=JSON.parse(await fs.readFile(path.join(root,'editions','test-artist','edition.json'),'utf8'));
const research=JSON.parse(await fs.readFile(path.join(root,'editions','test-artist','research.json'),'utf8'));
assert.equal(created.jobId,job.jobId);assert.match(created.editionId,/^dc_[a-f0-9]{10}$/);
assert.equal(updated.editions[0].canonicalPath,`/e/${created.editionId}`);
assert.ok(!config.publicURL.includes('test-artist'));assert.equal(config.production.submittedAt,job.submittedAt);
assert.equal(research.sources.length,2);assert.equal(config.links.facebook,'');assert.ok(!Object.hasOwn(config.links,'tip'));

execFileSync(process.execPath,[start,'Video Missing'],{encoding:'utf8',env});
const invalid={...input,bandName:'Video Missing',links:{youtube:'https://www.youtube.com/@videomissing'},sources:[
  {destination:'youtube',url:'https://www.youtube.com/@videomissing',sourceType:'official artist channel',identityVerified:true,verifiedAt,evidence:'Official channel identity match.'},
  {destination:'spotify',url:'https://open.spotify.com/artist/video-missing',sourceType:'official artist profile',identityVerified:true,verifiedAt,evidence:'Identity match.'}
]};
const invalidPath=path.join(root,'invalid.json');await fs.writeFile(invalidPath,JSON.stringify(invalid));
const rejected=spawnSync(process.execPath,[create,invalidPath],{encoding:'utf8',env});
assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/most-viewed official featured video/);
await fs.rm(root,{recursive:true,force:true});
console.log('One-prompt factory tests passed: clock, evidence, opaque route, verified destinations and featured-video safety.');

