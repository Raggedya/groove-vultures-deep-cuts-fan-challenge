import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const config=JSON.parse(await fs.readFile('editions/kerrimuir-primary-school/edition.json','utf8'));
const questions=JSON.parse(await fs.readFile(config.schoolChallenge.questionFile,'utf8'));
const quizSource=await fs.readFile('js/school-quiz.js','utf8');
await import(pathToFileURL(path.resolve('js/engine.js')));
const E=globalThis.DeepCutsEngine;

assert.equal(config.editionType,'school');
assert.equal(config.schoolChallenge.numberOfQuestions,6);
assert.equal(config.schoolChallenge.secondsPerQuestion,15);
assert.equal(config.schoolChallenge.feedbackMilliseconds,10000);
assert.equal(config.schoolChallenge.dingSound,'assets/ding.mp3');
assert.equal(questions.length,6);
assert.equal(new Set(questions.map(question=>question.id)).size,6);
assert.equal(new Set(questions.map(question=>question.question.toLowerCase())).size,6);
for(const question of questions){
  assert.equal(question.options.length,4);
  assert.ok(question.options.includes(question.correctAnswer));
  assert.match(question.sourceURL,/^https:\/\//);
  assert.ok(question.explanation.length>=50,'Every school answer should reveal a useful positive fact.');
}
const prepared=E.prepareQuestions(questions,6,()=>.42);
assert.equal(prepared.length,6);
assert.equal(new Set(prepared.map(question=>question.id)).size,6);
const expected=new Map([[0,'Curious Explorer'],[1,'Curious Explorer'],[2,'Keen School Learner'],[3,'Keen School Learner'],[4,'School Champion'],[5,'School Champion'],[6,'School Discovery Wizard']]);
for(const[score,label]of expected)assert.equal(E.classificationFor(score,config.schoolChallenge.classifications,config.bandName).label,label);
assert.match(quizSource,/if\(timedOut\)\{els\.timer\.textContent="0";playDing\(\)\}/,'The bell must play only when the timer reaches zero.');
assert.match(quizSource,/history\.pushState/,'The challenge must preserve browser Back navigation to School Home.');
assert.match(quizSource,/target="_blank"|feedbackSource/,'School sources must open without replacing the discovery page.');
console.log('Schools Edition challenge tests passed: six sourced questions, 15-second timer, positive feedback, ratings and School Home return.');
