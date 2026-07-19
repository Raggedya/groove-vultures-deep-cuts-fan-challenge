import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const directive=await fs.readFile('PLATFORM_ARCHITECTURE_DIRECTIVE.md','utf8');
assert.match(directive,/permanent, governing and non-negotiable/i);
assert.match(directive,/Every edition is an independent product/i);
assert.match(directive,/Backward compatibility is mandatory/i);
assert.match(directive,/Edition isolation is mandatory/i);

const contracts=JSON.parse(await fs.readFile('edition-contracts.json','utf8'));
const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
const app=await fs.readFile('js/app.js','utf8');
const knownTypes=new Set(Object.keys(contracts.editionTypes));
const exclusiveFields=new Set(Object.values(contracts.editionTypes).flatMap(contract=>contract.exclusiveConfig));

for(const entry of platform.editions){
  const config=JSON.parse(await fs.readFile(entry.config,'utf8'));
  const editionType=config.editionType||'music';
  assert.ok(knownTypes.has(editionType),`${entry.slug} uses unregistered edition type ${editionType}. Add a separate contract before publishing it.`);
  const contract=contracts.editionTypes[editionType];
  assert.ok(contract.brandNames.includes(config.brandName),`${entry.slug} must retain an approved ${editionType} brand contract.`);
  for(const key of Object.keys(config.links||{}))assert.ok(contract.allowedLinks.includes(key),`${entry.slug} leaks ${key} into the ${editionType} edition contract.`);
  for(const field of exclusiveFields){
    const owner=Object.entries(contracts.editionTypes).find(([,candidate])=>candidate.exclusiveConfig.includes(field))?.[0];
    if(field in config)assert.equal(editionType,owner,`${entry.slug} contains ${owner}-only configuration ${field}.`);
  }
}

for(const[type,contract]of Object.entries(contracts.editionTypes)){
  for(const key of contract.renderedLinks)assert.ok(app.includes(`key:"${key}"`),`${type} contract destination ${key} is not represented by its renderer.`);
}

console.log(`Edition isolation passed: ${platform.editions.length} completed editions remain within ${knownTypes.size} independent contracts.`);
