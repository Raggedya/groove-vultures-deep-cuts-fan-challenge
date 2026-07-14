import fs from 'node:fs/promises';

const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
const slug=process.argv[2]||platform.defaultEdition;
const entry=platform.editions.find(edition=>edition.slug===slug&&edition.active);
if(!entry)throw new Error(`Unknown active edition: ${slug}`);
const config=JSON.parse(await fs.readFile(entry.config,'utf8'));
const questions=JSON.parse(await fs.readFile(config.questionFile,'utf8'));
const active=questions.filter(question=>question.active);
const errors=[];

if(config.productType==='business'){
  const ids=new Set();
  if(active.length!==10)errors.push(`Expected exactly 10 active business questions; found ${active.length}.`);
  if(config.numberOfQuestions!==10)errors.push('Business editions must present exactly 10 questions.');
  if(config.business?.splashMilliseconds!==3000)errors.push('Business splash must display for exactly 3000 milliseconds.');
  if(!config.businessName||!config.business?.location||!config.business?.promise)errors.push('Business editions require a name, location and compelling promise.');
  if(!config.reward?.title||!config.reward?.instructions)errors.push('Business editions require reward title and redemption instructions.');
  if(/\[date\]|pending business approval/i.test(`${config.reward?.title||''} ${config.reward?.instructions||''}`))errors.push('Business reward wording contains an unresolved approval or date placeholder.');
  if(!Object.values(config.links||{}).some(Boolean))errors.push('Business editions require at least one verified official destination.');
  for(const question of active){
    for(const field of ['id','question','options','correctAnswer','difficulty','category','explanation','sourceName','sourceURL','active'])if(question[field]===undefined||question[field]==='')errors.push(`${question.id||'unknown'} missing ${field}.`);
    if(ids.has(question.id))errors.push(`Duplicate ID: ${question.id}`);ids.add(question.id);
    if(!Array.isArray(question.options)||question.options.length!==4||new Set(question.options.map(String)).size!==4)errors.push(`${question.id} must have four unique options.`);
    if(!question.options?.includes(question.correctAnswer))errors.push(`${question.id} correct answer is not an option.`);
    if(!/^https:\/\//.test(question.sourceURL||''))errors.push(`${question.id} sourceURL must be an HTTPS URL.`);
  }
  if(errors.length){console.error(errors.join('\n'));process.exit(1)}
  console.log(`${config.businessName}: 10-question Deep Cuts Business validation passed.`);
  process.exit(0);
}
const required=['id','roundGroup','question','options','correctAnswer','difficulty','category','explanation','sourceName','sourceURL','active'];
const expectedDifficulty={easy:3,medium:6,hard:3};
const expectedCategories={'Album Deep Cuts':3,'Song / Recording Deep Cuts':3,'Band Member':2,'Touring / Live':2,'Behind the Scenes':2};
const ids=new Set();
const texts=new Set();

if(active.length!==36)errors.push(`Expected exactly 36 active questions; found ${active.length}.`);
if(config.secondsPerQuestion!==15)errors.push('Countdown must be exactly 15 seconds.');
if(config.feedbackMilliseconds!==10000)errors.push('Feedback must display for exactly 10000 milliseconds.');
if(config.slug!==slug)errors.push(`Configuration slug must be ${slug}.`);
if(!/^https:\/\//.test(config.publicURL||''))errors.push('Edition publicURL must be an HTTPS URL.');

for(const question of active){
  for(const field of required)if(question[field]===undefined||question[field]==='')errors.push(`${question.id||'unknown'} missing ${field}.`);
  if(ids.has(question.id))errors.push(`Duplicate ID: ${question.id}`);ids.add(question.id);
  const normalized=question.question.toLowerCase().replace(/[^a-z0-9]/g,'');
  if(texts.has(normalized))errors.push(`Duplicate question: ${question.question}`);texts.add(normalized);
  if(!Array.isArray(question.options)||question.options.length!==4)errors.push(`${question.id} must have four options.`);
  else{
    const options=question.options.map(option=>String(option).trim().toLowerCase());
    if(new Set(options).size!==4)errors.push(`${question.id} has duplicate options.`);
    if(question.options.some(option=>!String(option).trim()))errors.push(`${question.id} has an empty option.`);
    if(!question.options.includes(question.correctAnswer))errors.push(`${question.id} correct answer is not an option.`);
  }
  if(!(question.difficulty in expectedDifficulty))errors.push(`${question.id} has invalid difficulty.`);
  if(!(question.category in expectedCategories))errors.push(`${question.id} has invalid category: ${question.category}.`);
  if(![1,2,3].includes(question.roundGroup))errors.push(`${question.id} has invalid roundGroup.`);
  const words=String(question.explanation).trim().split(/\s+/).filter(Boolean).length;
  if(words<15||words>40)errors.push(`${question.id} explanation must contain 15â€“40 words; found ${words}.`);
  if(!/^https:\/\//.test(question.sourceURL))errors.push(`${question.id} sourceURL must be an HTTPS URL.`);
}

for(const group of [1,2,3]){
  const round=active.filter(question=>question.roundGroup===group);
  const difficultyCounts={easy:0,medium:0,hard:0};
  const categoryCounts=Object.fromEntries(Object.keys(expectedCategories).map(category=>[category,0]));
  for(const question of round){if(question.difficulty in difficultyCounts)difficultyCounts[question.difficulty]+=1;if(question.category in categoryCounts)categoryCounts[question.category]+=1}
  if(round.length!==12)errors.push(`Round group ${group} must contain 12 questions; found ${round.length}.`);
  for(const[difficulty,expected]of Object.entries(expectedDifficulty))if(difficultyCounts[difficulty]!==expected)errors.push(`Round group ${group}: expected ${expected} ${difficulty}; found ${difficultyCounts[difficulty]}.`);
  for(const[category,expected]of Object.entries(expectedCategories))if(categoryCounts[category]!==expected)errors.push(`Round group ${group}: expected ${expected} ${category}; found ${categoryCounts[category]}.`);
}

if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`${config.bandName}: 36-question Deep Cuts validation passed across three balanced, non-repeating games.`);

