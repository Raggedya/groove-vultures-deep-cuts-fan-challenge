import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const slug=process.argv[2]||JSON.parse(fs.readFileSync('platform.json','utf8')).defaultEdition;
const python=process.env.DEEP_CUTS_PYTHON||(process.platform==='win32'?'python':'python3');
process.env.DEEP_CUTS_NODE=process.execPath;
function run(command,args){const result=spawnSync(command,args,{stdio:'inherit',shell:false,env:process.env});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1)}
run(process.execPath,['scripts/validate-platform.mjs']);
run(process.execPath,['scripts/test-discovery.mjs']);
run(process.execPath,['scripts/test-analytics.mjs']);
run(process.execPath,['--check','js/app.js']);
run(python,['scripts/ensure-python-deps.py']);
run(python,['scripts/generate-social-assets.py',slug]);
console.log(`${slug}: Deep Cuts discovery build complete.`);
