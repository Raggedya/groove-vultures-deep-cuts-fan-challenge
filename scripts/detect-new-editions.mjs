import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

const current=JSON.parse(fs.readFileSync('platform.json','utf8'));
const before=process.env.GITHUB_EVENT_BEFORE||'';
let previous=current;
if(before&&!/^0+$/.test(before))try{previous=JSON.parse(execFileSync('git',['show',`${before}:platform.json`],{encoding:'utf8'}))}catch{previous=current}
const previousIds=new Set(previous.editions.map(item=>item.editionId));
const slugs=current.editions.filter(item=>item.active&&!previousIds.has(item.editionId)).map(item=>item.slug);
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`slugs=${slugs.join(' ')}\n`);
console.log(slugs.join(' '));

