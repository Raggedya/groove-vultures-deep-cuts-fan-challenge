import {analyseRace} from "../racing/engine.js";
import {retrieveRace,retrieveResult,RacingProviderError} from "./racing-provider.js";

const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const COURSES=["Flemington","Caulfield","Caulfield Heath","Moonee Valley","Sandown","Randwick","Rosehill Gardens","Warwick Farm","Eagle Farm","Doomben","Morphettville","Ascot","Belmont Park","Hobart","Launceston","Darwin"];

export async function handleRacingRequest(request,env,url){
  try{
    if(url.pathname==="/api/racing/courses"&&request.method==="GET")return json({ok:true,courses:COURSES.filter(name=>name.toLowerCase().includes((url.searchParams.get("q")||"").toLowerCase())).slice(0,12)});
    if(url.pathname==="/api/racing/analyse"&&request.method==="POST")return await analyse(request,env);
    if(url.pathname==="/api/racing/dashboard"&&request.method==="GET")return await dashboard(request,env);
    if(url.pathname==="/api/racing/export.csv"&&request.method==="GET")return await exportCsv(request,env);
    if(url.pathname==="/api/racing/results/sync"&&request.method==="POST")return await syncResults(request,env);
    return json({ok:false,error:"Unknown Racing endpoint"},404);
  }catch(error){
    if(error instanceof RacingProviderError)return json({ok:false,code:error.code,error:error.message,noClearSelection:true},error.status);
    console.error("deep-cuts-racing-error",error);
    return json({ok:false,error:"Racing analysis could not be completed safely",noClearSelection:true},500);
  }
}

async function analyse(request,env){
  const body=await safeJson(request);const input=validateInput(body);
  if(!input)return json({ok:false,error:"Choose a valid race date, location and race number.",noClearSelection:true},400);
  const race=await retrieveRace(env,input);const result=analyseRace(race);await storeAnalysis(env,race,result);return json({ok:true,...result});
}

async function storeAnalysis(env,race,result){
  const now=result.analysedAt;const predictionId=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO racing_races (race_id,race_date,location,race_number,race_name,scheduled_time,distance_metres,race_class,track_condition,field_size,status,source_name,source_url,source_retrieved_at,created_at,updated_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?15)
    ON CONFLICT(race_id) DO UPDATE SET race_name=excluded.race_name,scheduled_time=excluded.scheduled_time,distance_metres=excluded.distance_metres,race_class=excluded.race_class,track_condition=excluded.track_condition,field_size=excluded.field_size,status=excluded.status,source_name=excluded.source_name,source_url=excluded.source_url,source_retrieved_at=excluded.source_retrieved_at,updated_at=excluded.updated_at`)
    .bind(race.raceId,race.date,race.location,race.raceNumber,race.raceName,race.scheduledTime||null,race.distanceMetres||null,race.raceClass||null,race.trackCondition||null,result.race.fieldSize,race.status||"scheduled",race.sources?.[0]?.name||"Licensed provider",race.sources?.[0]?.url||null,race.lastUpdated||now,now).run();
  for(const runner of race.runners)await env.DB.prepare(`INSERT INTO racing_runners (race_id,runner_id,runner_number,horse_name,barrier,jockey,trainer,weight_kg,current_odds,scratched,normalized_json) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
    ON CONFLICT(race_id,runner_id) DO UPDATE SET runner_number=excluded.runner_number,horse_name=excluded.horse_name,barrier=excluded.barrier,jockey=excluded.jockey,trainer=excluded.trainer,weight_kg=excluded.weight_kg,current_odds=excluded.current_odds,scratched=excluded.scratched,normalized_json=excluded.normalized_json`)
    .bind(race.raceId,runner.runnerId,runner.runnerNumber||null,runner.horseName,runner.barrier||null,runner.jockey||null,runner.trainer||null,runner.weightKg||null,runner.currentOdds||null,runner.scratched?1:0,JSON.stringify(runner)).run();
  await env.DB.prepare(`INSERT INTO racing_predictions (prediction_id,race_id,analysed_at,model_version,status,predicted_winner_id,predicted_top_three_json,market_favourite_id,tipster_consensus_id,confidence,verdict,risks_json,data_points_used,source_summary_json,prediction_json) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)`)
    .bind(predictionId,race.raceId,now,result.modelVersion,result.status,result.selection?.runnerId||null,JSON.stringify(result.topThree.map(item=>item.runnerId)),result.market.favourite?.runnerId||null,result.tipsters.consensusRunnerId||null,result.confidence,result.verdict,JSON.stringify(result.risks),result.dataAudit.considered,JSON.stringify(result.sources),JSON.stringify(result)).run();
  for(const tip of result.tipsters.opinions)await env.DB.prepare(`INSERT OR IGNORE INTO racing_tipsters (prediction_id,opinion_id,tipster_name,outlet,first_selection,second_selection,third_selection,reasoning,published_at,source_url) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`).bind(predictionId,stableOpinionId(tip),tip.tipsterName,tip.outlet,tip.firstSelection||null,tip.secondSelection||null,tip.thirdSelection||null,tip.reasoning||null,tip.publishedAt||null,tip.sourceURL).run();
  result.predictionId=predictionId;
}

async function dashboard(request,env){
  if(!authorized(request,env))return json({ok:false,error:"Unauthorized"},401);
  const summary=await env.DB.prepare(`SELECT COUNT(*) total_races,
    SUM(CASE WHEN r.predicted_winner_won=1 THEN 1 ELSE 0 END) correct_winners,
    SUM(CASE WHEN r.predicted_winner_top_three=1 THEN 1 ELSE 0 END) winner_top_three,
    SUM(COALESCE(r.predicted_top_three_hits,0)) top_three_hits,
    ROUND(AVG(r.actual_winner_probability),1) average_probability_actual_winner
    FROM racing_predictions p LEFT JOIN racing_post_race_reviews r ON r.prediction_id=p.prediction_id`).first();
  const history=await env.DB.prepare(`SELECT rr.race_date,rr.location,rr.race_number,rr.race_name,p.analysed_at,p.status,p.confidence,p.predicted_winner_id,r.winner_id,r.predicted_winner_won,r.predicted_top_three_hits FROM racing_predictions p JOIN racing_races rr ON rr.race_id=p.race_id LEFT JOIN racing_post_race_reviews r ON r.prediction_id=p.prediction_id ORDER BY p.analysed_at DESC LIMIT 100`).all();
  const byTrack=await env.DB.prepare(`SELECT rr.location,COUNT(*) races,SUM(COALESCE(pr.predicted_winner_won,0)) wins FROM racing_predictions p JOIN racing_races rr ON rr.race_id=p.race_id LEFT JOIN racing_post_race_reviews pr ON pr.prediction_id=p.prediction_id GROUP BY rr.location ORDER BY races DESC`).all();
  const byDistance=await env.DB.prepare(`SELECT rr.distance_metres,COUNT(*) races,SUM(COALESCE(pr.predicted_winner_won,0)) wins FROM racing_predictions p JOIN racing_races rr ON rr.race_id=p.race_id LEFT JOIN racing_post_race_reviews pr ON pr.prediction_id=p.prediction_id GROUP BY rr.distance_metres ORDER BY rr.distance_metres`).all();
  const byCondition=await env.DB.prepare(`SELECT rr.track_condition,COUNT(*) races,SUM(COALESCE(pr.predicted_winner_won,0)) wins FROM racing_predictions p JOIN racing_races rr ON rr.race_id=p.race_id LEFT JOIN racing_post_race_reviews pr ON pr.prediction_id=p.prediction_id GROUP BY rr.track_condition ORDER BY races DESC`).all();
  const comparisons=await env.DB.prepare(`SELECT SUM(CASE WHEN p.predicted_winner_id=p.market_favourite_id THEN 1 ELSE 0 END) agrees_market,SUM(CASE WHEN p.predicted_winner_id=p.tipster_consensus_id THEN 1 ELSE 0 END) agrees_media,COUNT(*) predictions FROM racing_predictions p`).all();
  const total=Number(summary?.total_races||0),wins=Number(summary?.correct_winners||0),places=Number(summary?.winner_top_three||0);
  return json({ok:true,summary:{...summary,winner_strike_rate:total?round1(wins/total*100):0,predicted_winner_top_three_rate:total?round1(places/total*100):0},breakdowns:{by_track:byTrack.results||[],by_distance:byDistance.results||[],by_track_condition:byCondition.results||[],market_and_media:comparisons.results||[]},history:history.results||[]});
}

async function exportCsv(request,env){
  if(!authorized(request,env))return json({ok:false,error:"Unauthorized"},401);
  const rows=(await env.DB.prepare(`SELECT rr.race_date,rr.location,rr.race_number,rr.race_name,p.analysed_at,p.status,p.confidence,p.predicted_winner_id,p.predicted_top_three_json,p.market_favourite_id,p.tipster_consensus_id,p.data_points_used,r.winner_id,r.second_id,r.third_id,pr.predicted_winner_won,pr.predicted_winner_top_three,pr.predicted_top_three_hits,pr.actual_winner_probability FROM racing_predictions p JOIN racing_races rr ON rr.race_id=p.race_id LEFT JOIN racing_results r ON r.race_id=p.race_id LEFT JOIN racing_post_race_reviews pr ON pr.prediction_id=p.prediction_id ORDER BY p.analysed_at DESC`).all()).results||[];
  const columns=["race_date","location","race_number","race_name","analysed_at","status","confidence","predicted_winner_id","predicted_top_three_json","market_favourite_id","tipster_consensus_id","data_points_used","winner_id","second_id","third_id","predicted_winner_won","predicted_winner_top_three","predicted_top_three_hits","actual_winner_probability"];
  const csv=[columns.join(","),...rows.map(row=>columns.map(key=>quote(row[key])).join(","))].join("\r\n")+"\r\n";
  return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":"attachment; filename=deep-cuts-racing-performance.csv","cache-control":"no-store"}});
}

async function syncResults(request,env){if(!authorized(request,env))return json({ok:false,error:"Unauthorized"},401);return json(await reconcilePendingResults(env))}
export async function reconcilePendingResults(env){
  const pending=(await env.DB.prepare(`SELECT rr.* FROM racing_races rr LEFT JOIN racing_results r ON r.race_id=rr.race_id WHERE r.race_id IS NULL AND rr.scheduled_time IS NOT NULL AND rr.scheduled_time<?1 ORDER BY rr.scheduled_time LIMIT 20`).bind(new Date().toISOString()).all()).results||[];
  let updated=0;for(const race of pending){const result=await retrieveResult(env,race);if(!result)continue;await storeResult(env,race,result);updated++}return{ok:true,checked:pending.length,updated};
}
async function storeResult(env,race,result){
  const retrieved=result.retrievedAt||new Date().toISOString();
  await env.DB.prepare(`INSERT OR REPLACE INTO racing_results (race_id,official_at,winner_id,second_id,third_id,finishing_order_json,margins_json,scratchings_json,track_condition,source_name,source_url,source_retrieved_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`).bind(race.race_id,result.officialAt||retrieved,result.winnerId||null,result.secondId||null,result.thirdId||null,JSON.stringify(result.finishingOrder||[]),JSON.stringify(result.margins||[]),JSON.stringify(result.scratchings||[]),result.trackCondition||null,result.sourceName||"Official result",result.sourceURL||null,retrieved).run();
  const predictions=(await env.DB.prepare("SELECT prediction_id,predicted_winner_id,predicted_top_three_json,prediction_json FROM racing_predictions WHERE race_id=?1").bind(race.race_id).all()).results||[];
  for(const p of predictions){const top=JSON.parse(p.predicted_top_three_json||"[]"),actual=[result.winnerId,result.secondId,result.thirdId];const prediction=JSON.parse(p.prediction_json||"{}");const actualWinner=prediction.fullField?.find(item=>item.runnerId===result.winnerId);await env.DB.prepare(`INSERT OR REPLACE INTO racing_post_race_reviews (prediction_id,race_id,predicted_winner_won,predicted_winner_top_three,predicted_top_three_hits,actual_winner_probability,late_change,review_note,reviewed_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`).bind(p.prediction_id,race.race_id,p.predicted_winner_id===result.winnerId?1:0,actual.includes(p.predicted_winner_id)?1:0,top.filter(id=>actual.includes(id)).length,actualWinner?.winProbability??null,result.significantLateChange?1:0,result.reviewNote||null,retrieved).run()}
}

function validateInput(body){const date=String(body?.date||""),location=String(body?.location||"").trim(),raceNumber=Number(body?.raceNumber);return /^\d{4}-\d{2}-\d{2}$/.test(date)&&location.length>=2&&location.length<=80&&Number.isInteger(raceNumber)&&raceNumber>=1&&raceNumber<=20?{date,location,raceNumber}:null}
function authorized(request,env){return Boolean(env.ADMIN_TOKEN)&&(request.headers.get("authorization")||"")===`Bearer ${env.ADMIN_TOKEN}`}
function stableOpinionId(tip){return `${tip.tipsterName}|${tip.outlet}|${tip.publishedAt||""}`.toLowerCase().replace(/[^a-z0-9|:-]+/g,"-").slice(0,160)}
function quote(value){return`"${String(value??"").replaceAll('"','""')}"`}
function round1(value){return Math.round(value*10)/10}
async function safeJson(request){try{return await request.json()}catch{return null}}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:JSON_HEADERS})}

export const __test={validateInput};
