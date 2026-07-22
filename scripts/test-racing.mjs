import assert from "node:assert/strict";
import {analyseRace,RACING_MODEL_VERSION} from "../racing/engine.js";
import {handleRacingRequest,__test} from "../worker/racing.js";

const race=fixtureRace();
delete race.runners.at(-1).factors.track;
const result=analyseRace(race,{now:"2026-07-20T00:00:00.000Z"});
assert.equal(result.modelVersion,RACING_MODEL_VERSION);
assert.equal(result.status,"selection");
assert.equal(result.fullField.length,6);
assert.equal(result.topThree.length,3);
assert.ok(Math.abs(result.fullField.reduce((sum,r)=>sum+r.winProbability,0)-100)<=2,"Rounded win probabilities should total approximately 100%.");
assert.ok(result.fullField.every(r=>Number.isInteger(r.winProbability)&&Number.isInteger(r.topThreeProbability)),"Probabilities must avoid false precision.");
assert.ok(result.fullField.every(r=>r.topThreeProbability>=r.winProbability),"Top-three probability cannot be lower than win probability.");
assert.equal(result.tipsters.uniqueTipsters,3,"Syndicated duplicate tipster opinions must be counted once.");
assert.ok(result.dataAudit.considered>0&&result.dataAudit.potential>result.dataAudit.considered,"Data audit must distinguish usable and unavailable evidence.");
assert.ok(result.verdict.includes(result.selection.horseName));
assert.ok(result.risks.length>=3,"A selection must disclose at least three genuine risks.");

const uncertain=analyseRace({...race,raceId:"race-uncertain",scratchingsUnresolved:true});
assert.equal(uncertain.status,"no_clear_selection");
assert.equal(uncertain.selection,null);
assert.match(uncertain.verdict,/NO CLEAR SELECTION/);
const tie=analyseRace({...race,raceId:"race-tie",runners:race.runners.map(r=>({...r,factors:{recent_form:{value:.2,label:"Equivalent recent evidence"}}}))});
assert.equal(tie.status,"no_clear_selection");

assert.deepEqual(__test.validateInput({date:"2026-07-25",location:"Flemington",raceNumber:4}),{date:"2026-07-25",location:"Flemington",raceNumber:4});
assert.equal(__test.validateInput({date:"tomorrow",location:"Flemington",raceNumber:4}),null);
const providerResponse=await handleRacingRequest(new Request("https://deep-cuts.test/api/racing/analyse",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({date:"2026-07-25",location:"Flemington",raceNumber:4})}),{},new URL("https://deep-cuts.test/api/racing/analyse"));
assert.equal(providerResponse.status,503);
const providerBody=await providerResponse.json();assert.equal(providerBody.code,"RACING_PROVIDER_NOT_CONFIGURED");assert.equal(providerBody.noClearSelection,true);
console.log("Deep Cuts Racing analysis tests passed.");

function fixtureRace(){
  const source={name:"Official Test Authority",url:"https://official.example.test/race/1",retrievedAt:"2026-07-20T00:00:00Z",type:"official_field",official:true};
  const runner=(id,name,n,base,odds)=>({runnerId:id,runnerNumber:n,horseName:name,barrier:n,jockey:`Jockey ${n}`,trainer:`Trainer ${n}`,weightKg:56+n/10,currentOdds:odds,expectedPosition:n<3?"on pace":"midfield",scratched:false,factors:{recent_form:{value:base,label:base>.5?"Strong recent class-adjusted form":"Competitive recent form",actualValue:`index ${Math.round(base*100)}`,sourceName:source.name,sourceURL:source.url,retrievedAt:source.retrievedAt},distance:{value:base-.08,label:"Proven near the race distance",actualValue:"2 wins from 5",sourceName:source.name},track:{value:base-.14,label:"Course profile",sourceName:source.name},condition:{value:base-.1,label:"Track-condition record",sourceName:source.name},class:{value:base-.12,label:"Competitive in this class",actualValue:"Benchmark comparison",sourceName:source.name},barrier_pace:{value:.55-n*.08,label:n<3?"Favourable on-pace map":"May settle behind the speed",actualValue:`barrier ${n}`,sourceName:source.name},weight:{value:base-.2,label:"Weight comparison",sourceName:source.name},jockey:{value:base-.16,label:"Jockey evidence",sourceName:source.name},trainer:{value:base-.18,label:"Stable evidence",sourceName:source.name},sectionals:{value:base-.03,label:"Recent closing-speed evidence",actualValue:`rating ${Math.round((base-.03)*100)}`,sourceName:source.name},official_reports:{value:base-.12,label:"Official report evidence",sourceName:source.name},market:{value:(1/odds)-.15,label:"Market-implied probability after normalization",actualValue:odds,sourceName:"Regulated test market"}}});
  return{raceId:"official-race-1",date:"2026-07-25",location:"Flemington",raceNumber:4,raceName:"Deep Cuts Test Handicap",scheduledTime:"2026-07-25T04:20:00Z",distanceMetres:1600,raceClass:"BM84",trackCondition:"Good 4",lastUpdated:"2026-07-20T00:00:00Z",runners:[runner("h1","Evidence First",1,.82,3.4),runner("h2","Main Danger",2,.58,4.2),runner("h3","Place Profile",3,.42,6),runner("h4","Late Closer",4,.24,9),runner("h5","Wide Risk",5,.02,13),runner("h6","Class Query",6,-.18,21)],sources:[source,{name:"Bureau Test Weather",url:"https://weather.example.test",retrievedAt:"2026-07-20T00:00:00Z",type:"weather",official:true}],tipsters:[{tipsterName:"Analyst A",outlet:"Race Media",firstSelectionId:"h1",firstSelection:"Evidence First",sourceURL:"https://media.example.test/a"},{tipsterName:"Analyst A",outlet:"Race Media",firstSelectionId:"h1",firstSelection:"Evidence First",sourceURL:"https://syndicated.example.test/a"},{tipsterName:"Analyst B",outlet:"Form Desk",firstSelectionId:"h2",firstSelection:"Main Danger",sourceURL:"https://media.example.test/b"},{tipsterName:"Analyst C",outlet:"Official Preview",firstSelectionId:"h1",firstSelection:"Evidence First",sourceURL:"https://media.example.test/c"}]};
}
