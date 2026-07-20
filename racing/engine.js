export const RACING_MODEL_VERSION="deep-cuts-racing-v1";

const FACTORS={
  recent_form:1.35,distance:1.05,track:0.72,condition:0.88,class:1.05,
  barrier_pace:0.76,weight:0.58,jockey:0.62,trainer:0.62,sectionals:1.18,
  official_reports:0.72,market:0.72
};

export function analyseRace(race,{now=new Date().toISOString()}={}){
  validateRace(race);
  const active=race.runners.filter(runner=>!runner.scratched);
  const sources=uniqueSources(race);
  const conflicts=Number(race.materialConflicts||0);
  const unresolved=Boolean(race.scratchingsUnresolved||race.trackHighlyUncertain);
  const scored=active.map(runner=>scoreRunner(runner));
  const strengths=scored.map(item=>Math.exp(item.score*1.15));
  const win=normalise(strengths);
  const place=plackettLuceTopThree(strengths);
  const ranked=scored.map((item,index)=>({...item,winProbability:round(win[index]*100),topThreeProbability:round(place[index]*100)}))
    .sort((a,b)=>b.winProbability-a.winProbability||b.coverage-a.coverage);
  ranked.forEach((item,index)=>item.rank=index+1);
  const leader=ranked[0];
  const runnerUp=ranked[1];
  const gap=(leader?.winProbability||0)-(runnerUp?.winProbability||0);
  const evidenceCoverage=ranked.length?ranked.reduce((sum,item)=>sum+item.coverage,0)/ranked.length:0;
  const sourceQuality=sourceScore(sources);
  const confidenceScore=Math.max(0,Math.min(1,evidenceCoverage*.55+sourceQuality*.3+Math.min(gap/12,1)*.15-conflicts*.12));
  const confidence=confidenceScore>=.74?"High":confidenceScore>=.5?"Moderate":"Low";
  const abstainReasons=[];
  if(active.length<4)abstainReasons.push("The confirmed field is too small or incomplete.");
  if(evidenceCoverage<.42)abstainReasons.push("Too little verified runner evidence is available.");
  if(unresolved)abstainReasons.push("Scratchings or track conditions remain materially uncertain.");
  if(conflicts>1)abstainReasons.push("Material sources conflict.");
  if(gap<2)abstainReasons.push("The leading contenders are statistically too close.");
  if(confidence==="Low")abstainReasons.push("Overall analysis confidence is low.");
  const status=abstainReasons.length?"no_clear_selection":"selection";
  const tips=tipsterConsensus(race.tipsters||[],active);
  const marketFavourite=[...ranked].filter(item=>Number.isFinite(item.runner.currentOdds)&&item.runner.currentOdds>1).sort((a,b)=>a.runner.currentOdds-b.runner.currentOdds)[0]||null;
  const dataPoints=[...raceDataPoints(race),...scored.flatMap(item=>item.dataPoints),...tips.opinions.map(tip=>({category:"tipsters_media",label:`${tip.tipsterName} (${tip.outlet}) selected ${tip.firstSelection||"no recorded first selection"}`,value:tip.publishedAt||"publication time unavailable",sourceName:tip.outlet,sourceURL:tip.sourceURL||""}))];
  const potential=active.length*Object.keys(FACTORS).length+7+tips.uniqueTipsters;
  return {
    modelVersion:RACING_MODEL_VERSION,analysedAt:now,status,abstainReasons,
    race:publicRace(race),confidence,evidenceQuality:qualityLabel(evidenceCoverage),
    selection:status==="selection"?presentRunner(leader):null,
    topThree:ranked.slice(0,3).map(presentRunner),strongestPlace:presentRunner([...ranked].sort((a,b)=>b.topThreeProbability-a.topThreeProbability)[0]),
    mainDanger:ranked[1]?presentRunner(ranked[1]):null,
    fullField:ranked.map(presentRunner),
    market:{favourite:marketFavourite?presentRunner(marketFavourite):null,comparison:marketComparison(leader,marketFavourite)},
    tipsters:tips,
    verdict:status==="selection"?verdict(leader,race):`NO CLEAR SELECTION — ${[...new Set(abstainReasons)].join(" ")}`,
    supportingFactors:leader?leader.strengths.slice(0,5):[],risks:leader?leader.risks.slice(0,4):[],
    dataAudit:{
      considered:dataPoints.length,potential,
      unavailable:Math.max(0,potential-dataPoints.length),
      sourcesConsulted:sources.length,tipstersReviewed:tips.uniqueTipsters,
      calculations:["weighted evidence score","Plackett–Luce win and top-three probabilities","evidence coverage and source-quality confidence"],
      materialUncertainties:[...new Set([...abstainReasons,...(race.uncertainties||[])])],
      sections:groupDataPoints(dataPoints)
    },
    sources
  };
}

function scoreRunner(runner){
  let weighted=0,weightUsed=0;
  const dataPoints=[],strengths=[],risks=[];
  for(const[key,weight]of Object.entries(FACTORS)){
    const factor=runner.factors?.[key];
    if(!factor||!Number.isFinite(factor.value))continue;
    const value=Math.max(-1,Math.min(1,factor.value));
    const reliability=Math.max(.2,Math.min(1,Number(factor.reliability||.7)));
    weighted+=value*weight*reliability;weightUsed+=weight*reliability;
    const label=factor.label||key.replaceAll("_"," ");
    dataPoints.push({runnerId:runner.runnerId,horseName:runner.horseName,category:key,value:factor.actualValue??value,label,sourceName:factor.sourceName||"Provider",sourceURL:factor.sourceURL||"",retrievedAt:factor.retrievedAt||""});
    if(value>=.28)strengths.push({label,effect:value});
    if(value<=-.22)risks.push({label,effect:value});
  }
  const fallbackRisks=[
    "Late scratchings or a changed official track rating could alter the comparison",
    "A different race tempo or settling position could reduce the expected advantage",
    "Late jockey, gear or market changes may not be reflected in the retrieved evidence"
  ];
  for(const label of fallbackRisks)if(risks.length<3&&!risks.some(item=>item.label===label))risks.push({label,effect:0});
  return {runner,score:weightUsed?weighted/weightUsed:-1,coverage:weightUsed/Object.values(FACTORS).reduce((a,b)=>a+b,0),dataPoints,
    strengths:strengths.sort((a,b)=>b.effect-a.effect).map(item=>item.label),risks:risks.sort((a,b)=>a.effect-b.effect).map(item=>item.label)};
}

function normalise(values){const total=values.reduce((a,b)=>a+b,0)||1;return values.map(value=>value/total)}
function plackettLuceTopThree(s){
  const total=s.reduce((a,b)=>a+b,0)||1;
  return s.map((si,i)=>{
    let probability=si/total;
    for(let j=0;j<s.length;j++)if(j!==i){
      const pj=s[j]/total; probability+=pj*si/(total-s[j]);
      for(let k=0;k<s.length;k++)if(k!==i&&k!==j)probability+=pj*(s[k]/(total-s[j]))*(si/(total-s[j]-s[k]));
    }
    return Math.min(1,probability);
  });
}
function tipsterConsensus(tipsters,runners){
  const unique=new Map();
  for(const tip of tipsters){const key=`${String(tip.tipsterName||"").toLowerCase()}|${String(tip.outlet||"").toLowerCase()}`;if(key!=="|"&&!unique.has(key))unique.set(key,tip)}
  const counts=new Map(runners.map(runner=>[runner.runnerId,0]));
  for(const tip of unique.values())if(counts.has(tip.firstSelectionId))counts.set(tip.firstSelectionId,counts.get(tip.firstSelectionId)+1);
  const sorted=[...counts].sort((a,b)=>b[1]-a[1]);const [leaderId,leaderCount]=sorted[0]||[null,0];const n=unique.size;const percentage=n?round(leaderCount/n*100):0;
  const agreement=n<3?"insufficient information":percentage>=70?"strong consensus":percentage>=50?"moderate consensus":percentage>=35?"weak consensus":leaderCount>1?"divided opinion":"divided opinion";
  return {uniqueTipsters:n,consensusRunnerId:leaderId,consensusHorse:runners.find(r=>r.runnerId===leaderId)?.horseName||null,consensusPercentage:percentage,agreement,
    opinions:[...unique.values()].map(t=>({tipsterName:t.tipsterName,outlet:t.outlet,firstSelection:t.firstSelection,secondSelection:t.secondSelection,thirdSelection:t.thirdSelection,reasoning:t.reasoning||"",publishedAt:t.publishedAt||"",sourceURL:t.sourceURL}))};
}
function presentRunner(item){if(!item)return null;return {rank:item.rank,runnerId:item.runner.runnerId,runnerNumber:item.runner.runnerNumber,horseName:item.runner.horseName,barrier:item.runner.barrier,jockey:item.runner.jockey,trainer:item.runner.trainer,currentOdds:item.runner.currentOdds??null,winProbability:item.winProbability,topThreeProbability:item.topThreeProbability,keyStrength:item.strengths[0]||"No material verified advantage",keyRisk:item.risks[0]||"Late changes remain possible"}}
function publicRace(race){return {raceId:race.raceId,date:race.date,location:race.location,raceNumber:race.raceNumber,raceName:race.raceName,scheduledTime:race.scheduledTime,distanceMetres:race.distanceMetres,raceClass:race.raceClass,trackCondition:race.trackCondition,fieldSize:race.runners.filter(r=>!r.scratched).length,lastUpdated:race.lastUpdated}}
function verdict(leader,race){const strengths=leader.strengths.slice(0,3).join(", ")||"the strongest combined evidence";const risk=leader.risks[0]||"late changes to the field or conditions";return `${leader.runner.horseName} ranks first because of ${strengths}. The expected race shape and available evidence give it the strongest combined win profile in this field, not a certainty. Its estimated position is ${leader.runner.expectedPosition||"dependent on the final tempo"}. The main risk is ${risk}. Recheck scratchings, odds and the official track rating close to ${race.scheduledTime||"start time"}.`}
function marketComparison(leader,favourite){if(!favourite)return"Market comparison unavailable.";if(leader.runner.runnerId===favourite.runner.runnerId)return"The Deep Cuts selection is the current market favourite.";return`The Deep Cuts selection differs from the market favourite; the market favourite is ranked ${favourite.rank} by the model.`}
function uniqueSources(race){const map=new Map();for(const source of race.sources||[]){const key=source.url||`${source.name}|${source.retrievedAt}`;if(key&&!map.has(key))map.set(key,{name:source.name,url:source.url||"",retrievedAt:source.retrievedAt||race.lastUpdated||"",type:source.type||"other",official:Boolean(source.official),stale:Boolean(source.stale)})}return[...map.values()]}
function raceDataPoints(race){
  const source=race.sources?.[0]||{};const rows=[
    ["race_details","Race identity",`${race.location} R${race.raceNumber} — ${race.raceName}`],
    ["race_details","Scheduled time",race.scheduledTime],["distance","Race distance",race.distanceMetres?`${race.distanceMetres}m`:null],
    ["class","Race class",race.raceClass],["condition","Official track condition",race.trackCondition],
    ["pace","Expected race tempo",race.expectedTempo],["weather","Race-time weather",race.weather?.summary]
  ];
  return rows.filter(([, ,value])=>value!==undefined&&value!==null&&value!=="").map(([category,label,value])=>({category,label,value,sourceName:source.name||"Licensed provider",sourceURL:source.url||"",retrievedAt:race.lastUpdated||source.retrievedAt||""}));
}
function sourceScore(sources){if(!sources.length)return 0;return sources.reduce((sum,s)=>sum+(s.official?1:.65)-(s.stale?.35:0),0)/sources.length}
function groupDataPoints(points){const grouped={};for(const point of points)(grouped[point.category]??=[]).push(point);return grouped}
function qualityLabel(value){return value>=.74?"Strong":value>=.5?"Moderate":"Limited"}
function round(value){return Math.round(value)}
function validateRace(race){if(!race||!race.raceId||!race.date||!race.location||!Number.isInteger(race.raceNumber)||!Array.isArray(race.runners))throw new Error("A normalized, uniquely identified race is required.")}
