import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
const slug=process.argv[2]||platform.defaultEdition;
const entry=platform.editions.find(edition=>edition.slug===slug&&edition.active);
assert.ok(entry,`Unknown active edition: ${slug}`);
const config=JSON.parse(await fs.readFile(entry.config,'utf8'));
const questions=JSON.parse(await fs.readFile(config.questionFile,'utf8'));
await import(pathToFileURL(path.resolve('js/engine.js')));
const E=globalThis.DeepCutsEngine;
assert.ok(E,'DeepCutsEngine must be exposed.');
assert.equal(config.secondsPerQuestion,15);
assert.equal(config.feedbackMilliseconds,10000);

const bank=new E.FreshQuestionBank(questions,config.questionMix,()=>.42);
const rounds=[bank.nextRound(),bank.nextRound(),bank.nextRound()];
const cycle=rounds.flat();
assert.equal(new Set(cycle.map(question=>question.id)).size,36,'The first three games must use all 36 questions without a repeat.');
for(const round of rounds){
  assert.equal(round.length,12);
  assert.deepEqual(round.reduce((counts,question)=>({...counts,[question.difficulty]:counts[question.difficulty]+1}),{easy:0,medium:0,hard:0}),{easy:3,medium:6,hard:3});
  assert.deepEqual(round.reduce((counts,question)=>({...counts,[question.category]:counts[question.category]+1}),{'Album Deep Cuts':0,'Song / Recording Deep Cuts':0,'Band Member':0,'Touring / Live':0,'Behind the Scenes':0}),{'Album Deep Cuts':3,'Song / Recording Deep Cuts':3,'Band Member':2,'Touring / Live':2,'Behind the Scenes':2});
}
assert.equal(bank.nextRound().length,12,'A new cycle must begin after all 36 questions are used.');
const expectedRankings=new Map([[0,'Curious Listener'],[3,'Curious Listener'],[4,'Proper Fan'],[6,'Proper Fan'],[7,'Deep Cut Disciple'],[9,'Deep Cut Disciple'],[10,'Band Historian'],[11,'Band Historian'],[12,'How Did You Know That?!']]);
for(const[score,label]of expectedRankings)assert.equal(E.classificationFor(score,config.classifications,config.bandName).label,label);
const stats=E.calculateStats([{correct:true,unanswered:false,responseSeconds:2},{correct:false,unanswered:false,responseSeconds:4},{correct:false,unanswered:true,responseSeconds:15}],3);
assert.deepEqual({correct:stats.correct,incorrect:stats.incorrect,unanswered:stats.unanswered},{correct:1,incorrect:1,unanswered:1});
assert.equal(stats.averageResponseTime,3);
console.log(`${config.bandName}: engine tests passed for three fresh games, cycle reset, rankings and statistics.`);
