import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_UNAVAILABLE_NOTE='Codex did not expose reliable per-build billing or token-usage data.';

function bool(value,fallback){
  if(value===undefined||value===null||value==='')return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function iso(value){return (value instanceof Date?value:new Date(value)).toISOString()}
function round(value,places=8){const factor=10**places;return Math.round((value+Number.EPSILON)*factor)/factor}
function safeSlug(value){return String(value).trim().toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,24)||'UNTITLED'}

export function formatDuration(totalSeconds){
  const seconds=Math.max(0,Math.floor(totalSeconds));
  const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;
  return `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
}

export function formatDurationWords(totalSeconds){
  const seconds=Math.max(0,Math.floor(totalSeconds));
  const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;
  const parts=[];
  if(h)parts.push(`${h} hour${h===1?'':'s'}`);
  if(m||h)parts.push(`${m} minute${m===1?'':'s'}`);
  parts.push(`${s} second${s===1?'':'s'}`);
  return parts.join(' ');
}

export async function loadTrackingConfig(root=process.cwd(),env=process.env){
  const configPath=path.join(root,'config','build-tracking.json');
  const base=JSON.parse(await fs.readFile(configPath,'utf8'));
  return {
    ...base,
    reporting_currency:env.DEEP_CUTS_REPORTING_CURRENCY||base.reporting_currency||'AUD',
    email_recipient:env.DEEP_CUTS_EMAIL_RECIPIENT||base.email_recipient,
    detailed_usage_in_email:bool(env.DEEP_CUTS_DETAILED_USAGE_EMAIL,base.detailed_usage_in_email),
    include_failed_builds:bool(env.DEEP_CUTS_LOG_FAILED_BUILDS,base.include_failed_builds),
    pricing_table:env.DEEP_CUTS_PRICING_FILE||base.pricing_table,
    aud_exchange_rate:env.DEEP_CUTS_AUD_EXCHANGE_RATE?Number(env.DEEP_CUTS_AUD_EXCHANGE_RATE):null,
    exchange_rate_date:env.DEEP_CUTS_EXCHANGE_RATE_DATE||null,
    exchange_rate_source:env.DEEP_CUTS_EXCHANGE_RATE_SOURCE||base.exchange_rate_source||null
  };
}

async function pathsFor(root){
  const records=path.join(root,'build-records');
  const active=path.join(records,'in-progress');
  await fs.mkdir(active,{recursive:true});
  return {records,active,log:path.join(records,'builds.jsonl')};
}

async function readLog(log){
  try{return (await fs.readFile(log,'utf8')).split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line))}
  catch(error){if(error.code==='ENOENT')return [];throw error}
}

export async function startBuild({slug,artist,quizName=`Deep Cuts - ${artist}`,root=process.cwd(),now=new Date(),buildId,parentBuildId=null,env=process.env}={}){
  if(!slug||!artist)throw new Error('startBuild requires slug and artist.');
  const {active,log}=await pathsFor(root);
  const date=iso(now).slice(0,10).replaceAll('-','');
  const prefix=`DC-${safeSlug(artist)}-${date}-`;
  const existing=[...(await readLog(log))];
  for(const name of await fs.readdir(active)){if(name.endsWith('.json'))existing.push(JSON.parse(await fs.readFile(path.join(active,name),'utf8')))}
  const sequence=existing.filter(item=>String(item.build_id||'').startsWith(prefix)).length+1;
  const id=buildId||env.DEEP_CUTS_BUILD_ID||`${prefix}${String(sequence).padStart(3,'0')}`;
  const record={
    build_id:id,quiz_slug:slug,quiz_name:quizName,artist,parent_build_id:parentBuildId,
    started_at:iso(now),completed_at:null,production_seconds:0,production_time_display:'00h 00m 00s',
    ai_cost_original_currency:null,ai_cost_original_currency_code:'USD',aud_exchange_rate:null,
    aud_exchange_rate_date:null,aud_exchange_rate_source:null,ai_cost_aud:null,cost_method:'unavailable',
    cost_notes:DEFAULT_UNAVAILABLE_NOTE,status:'in progress',deployment_url:'',git_commit:'',failure_reason:'',
    usage:{ai_calls:0,input_tokens:0,cached_input_tokens:0,output_tokens:0,reasoning_tokens:0,models:[],service_charges:[]}
  };
  await fs.writeFile(path.join(active,`${id}.json`),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  return record;
}

export async function findActiveBuild(slug,{root=process.cwd()}={}){
  const {active}=await pathsFor(root);const matches=[];
  for(const name of await fs.readdir(active)){
    if(!name.endsWith('.json'))continue;
    const record=JSON.parse(await fs.readFile(path.join(active,name),'utf8'));
    if(record.quiz_slug===slug&&record.status==='in progress')matches.push(record);
  }
  return matches.sort((a,b)=>b.started_at.localeCompare(a.started_at))[0]||null;
}

export async function recordUsage(buildId,event,{root=process.cwd()}={}){
  const {active}=await pathsFor(root);const file=path.join(active,`${buildId}.json`);
  const record=JSON.parse(await fs.readFile(file,'utf8'));
  const usage=record.usage;
  const normal={
    provider:event.provider||'unknown',model:event.model||'unknown',calls:Number(event.calls||1),
    input_tokens:Number(event.input_tokens||0),cached_input_tokens:Number(event.cached_input_tokens||0),
    output_tokens:Number(event.output_tokens||0),reasoning_tokens:Number(event.reasoning_tokens||0),
    actual_cost:event.actual_cost===undefined?null:Number(event.actual_cost),currency:event.currency||'USD',
    method:event.method||null,notes:event.notes||''
  };
  usage.ai_calls+=normal.calls;usage.input_tokens+=normal.input_tokens;usage.cached_input_tokens+=normal.cached_input_tokens;
  usage.output_tokens+=normal.output_tokens;usage.reasoning_tokens+=normal.reasoning_tokens;usage.models.push(normal);
  if(Array.isArray(event.service_charges))usage.service_charges.push(...event.service_charges);
  await fs.writeFile(file,JSON.stringify(record,null,2)+'\n');return record;
}

export function calculateUsageCost(record,pricing,exchangeRate){
  let usd=0,measured=0,unknown=0,hasActual=false,hasCalculated=false,hasEstimated=false;
  for(const call of record.usage.models){
    if(Number.isFinite(call.actual_cost)){
      if(call.currency!=='USD'){unknown++;continue}usd+=call.actual_cost;measured++;hasActual=call.method!=='estimated'||hasActual;hasEstimated=call.method==='estimated'||hasEstimated;continue;
    }
    const rate=pricing.models?.[call.model];
    if(!rate){unknown++;continue}
    usd+=(call.input_tokens/1e6)*Number(rate.input_per_million||0);
    usd+=(call.cached_input_tokens/1e6)*Number(rate.cached_input_per_million||0);
    usd+=(call.output_tokens/1e6)*Number(rate.output_per_million||0);
    usd+=(call.reasoning_tokens/1e6)*Number(rate.reasoning_per_million||0);
    measured++;hasCalculated=true;
  }
  for(const charge of record.usage.service_charges){
    if(charge.currency!=='USD'||!Number.isFinite(Number(charge.amount))){unknown++;continue}
    usd+=Number(charge.amount);measured++;hasActual=charge.method!=='estimated'||hasActual;hasEstimated=charge.method==='estimated'||hasEstimated;
  }
  if(measured===0)return {original:null,aud:null,method:'unavailable',notes:DEFAULT_UNAVAILABLE_NOTE};
  if(!Number.isFinite(exchangeRate)||exchangeRate<=0)return {original:round(usd),aud:null,method:'unavailable',notes:'Measurable USD usage exists, but no reliable USD-to-AUD exchange rate was available.'};
  const method=unknown||hasEstimated?'estimated':hasCalculated?'calculated':hasActual?'actual':'unavailable';
  const notes=unknown?'Some AI usage lacked a measurable price; the reported total is necessarily incomplete.':method==='actual'?'Obtained directly from recorded provider or service charges.':method==='calculated'?'Calculated from recorded usage and the configured official pricing table.':'Based on incomplete but reasonable recorded usage.';
  return {original:round(usd),aud:round(usd*exchangeRate),method,notes};
}

async function resolveExchangeRate(config,fetchImpl=globalThis.fetch){
  if(Number.isFinite(config.aud_exchange_rate)&&config.aud_exchange_rate>0)return {rate:config.aud_exchange_rate,date:config.exchange_rate_date||new Date().toISOString().slice(0,10),source:config.exchange_rate_source||'Configured environment value'};
  if(!config.exchange_rate_url||typeof fetchImpl!=='function')return {rate:null,date:null,source:null};
  try{
    const response=await fetchImpl(config.exchange_rate_url);if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();const rate=Number(data.rates?.AUD);
    return Number.isFinite(rate)&&rate>0?{rate,date:data.date||new Date().toISOString().slice(0,10),source:config.exchange_rate_source||config.exchange_rate_url}:{rate:null,date:null,source:null};
  }catch{return {rate:null,date:null,source:null}}
}

export async function finishBuild(buildId,{root=process.cwd(),now=new Date(),status='completed',failureReason='',deploymentURL='',gitCommit='',env=process.env,fetchImpl=globalThis.fetch,persist=true}={}){
  const {active,log}=await pathsFor(root);const file=path.join(active,`${buildId}.json`);
  const record=JSON.parse(await fs.readFile(file,'utf8'));const config=await loadTrackingConfig(root,env);
  const pricing=JSON.parse(await fs.readFile(path.resolve(root,config.pricing_table),'utf8'));
  const measurable=record.usage.models.some(call=>Number.isFinite(call.actual_cost)||pricing.models?.[call.model])||record.usage.service_charges.some(charge=>charge.currency==='USD'&&Number.isFinite(Number(charge.amount)));
  const exchange=measurable?await resolveExchangeRate(config,fetchImpl):{rate:null,date:null,…4643 tokens truncated…n, deployment or email requirements.
- Make safe, in-scope assumptions and continue.
- Ask only when identity is genuinely ambiguous or publication would target the wrong artist.
- Prefer deterministic repository scripts over retyping transformations.
- Do not duplicate the engine or edition application.
- When a repeated step remains, add it to the highest appropriate roadmap item and automate it when practical.

## Quality lock

Reject shallow trivia. Every question must make the artist or a serious fan plausibly ask, “How did they know that?” Preserve the exact Aggits character, locked timing/audio behaviour, blue-black design, 36-question model and automatic delivery outputs.
