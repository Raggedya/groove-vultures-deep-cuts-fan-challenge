import fs from 'node:fs/promises';

const questions=JSON.parse(await fs.readFile('data/questions.json','utf8'));
const active=questions.filter(question=>question.active);
const errors=[];
const required=['id','roundGroup','question','options','correctAnswer','difficulty','category','explanation','sourceName','sourceURL','active'];
const expectedDifficulty={easy:3,medium:6,hard:3};
const expectedCategories={
  'Album Deep Cuts':3,
  'Song / Recording Deep Cuts':3,
  'Band Member':2,
  'Touring / Live':2,
  'Behind the Scenes':2
};
const totalDifficulty={easy:0,medium:0,hard:0};
const totalCategories=Object.fromEntries(Object.keys(expectedCategories).map(category=>[category,0]));
const ids=new Set();
const texts=new Set();

if(active.length!==36)errors.push(`Expected exactly 36 active questions; found ${active.length}.`);

for(const question of active){
  for(const field of required){
    if(question[field]===undefined||question[field]==='')errors.push(`${question.id||'unknown'} missing ${field}.`);
  }
  if(ids.has(question.id))errors.push(`Duplicate ID: ${question.id}`);
  ids.add(question.id);
  const normalized=question.question.toLowerCase().replace(/[^a-z0-9]/g,'');
  if(texts.has(normalized))errors.push(`Duplicate question: ${question.question}`);
  texts.add(normalized);
  if(!Array.isArray(question.options)||question.options.length!==4){
    errors.push(`${question.id} must have four options.`);
  }else{
    const normalizedOptions=question.options.map(option=>String(option).trim().toLowerCase());
    if(new Set(normalizedOptions).size!==4)errors.push(`${question.id} has duplicate options.`);
    if(question.options.some(option=>!String(option).trim()))errors.push(`${question.id} has an empty option.`);
    if(!question.options.includes(question.correctAnswer))errors.push(`${question.id} correct answer is not an option.`);
  }
  if(!(question.difficulty in expectedDifficulty))errors.push(`${question.id} has invalid difficulty.`);
  else totalDifficulty[question.difficulty]+=1;
  if(!(question.category in expectedCategories))errors.push(`${question.id} has invalid category: ${question.category}.`);
  else totalCategories[question.category]+=1;
  if(![1,2,3].includes(question.roundGroup))errors.push(`${question.id} has invalid roundGroup.`);
  const explanationWords=String(question.explanation).trim().split(/\s+/).filter(Boolean).length;
  if(explanationWords<15||explanationWords>40)errors.push(`${question.id} explanation must contain 15–40 words; found ${explanationWords}.`);
  if(!/^https:\/\//.test(question.sourceURL))errors.push(`${question.id} sourceURL must be an HTTPS URL.`);
  if(question.active!==true)errors.push(`${question.id} active must be true.`);
}

for(const group of [1,2,3]){
  const questions=active.filter(question=>question.roundGroup===group);
  const difficultyCounts={easy:0,medium:0,hard:0};
  const categoryCounts=Object.fromEntries(Object.keys(expectedCategories).map(category=>[category,0]));
  for(const question of questions){difficultyCounts[question.difficulty]+=1;categoryCounts[question.category]+=1}
  if(questions.length!==12)errors.push(`Round group ${group} must contain 12 questions; found ${questions.length}.`);
  for(const[difficulty,expected]of Object.entries(expectedDifficulty))if(difficultyCounts[difficulty]!==expected)errors.push(`Round group ${group}: expected ${expected} ${difficulty}; found ${difficultyCounts[difficulty]}.`);
  for(const[category,expected]of Object.entries(expectedCategories))if(categoryCounts[category]!==expected)errors.push(`Round group ${group}: expected ${expected} ${category}; found ${categoryCounts[category]}.`);
}

if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`Deep Cuts validation passed: ${active.length} questions in three balanced, non-repeating 12-question groups; total difficulty ${JSON.stringify(totalDifficulty)}; total categories ${JSON.stringify(totalCategories)}.`);
