export class RacingProviderError extends Error{
  constructor(code,message,status=503){super(message);this.name="RacingProviderError";this.code=code;this.status=status}
}

export async function retrieveRace(env,{date,location,raceNumber}){
  if(!env.RACING_DATA_API_URL||!env.RACING_DATA_API_KEY)throw new RacingProviderError("RACING_PROVIDER_NOT_CONFIGURED","Live official race data is not yet connected.");
  const endpoint=new URL("race",ensureTrailingSlash(env.RACING_DATA_API_URL));
  endpoint.searchParams.set("date",date);endpoint.searchParams.set("location",location);endpoint.searchParams.set("race_number",String(raceNumber));
  const response=await fetch(endpoint,{headers:{authorization:`Bearer ${env.RACING_DATA_API_KEY}`,accept:"application/json"}});
  if(response.status===404)throw new RacingProviderError("RACE_NOT_FOUND","The selected date, location and race number do not identify one valid race.",404);
  if(!response.ok)throw new RacingProviderError("RACING_PROVIDER_UNAVAILABLE","The licensed race-data provider is temporarily unavailable.",503);
  const body=await response.json();
  if(!body?.raceId||!Array.isArray(body.runners))throw new RacingProviderError("INVALID_PROVIDER_RESPONSE","The race-data provider returned incomplete information.",502);
  return body;
}

export async function retrieveResult(env,race){
  if(!env.RACING_DATA_API_URL||!env.RACING_DATA_API_KEY)return null;
  const endpoint=new URL(`result/${encodeURIComponent(race.race_id)}`,ensureTrailingSlash(env.RACING_DATA_API_URL));
  const response=await fetch(endpoint,{headers:{authorization:`Bearer ${env.RACING_DATA_API_KEY}`,accept:"application/json"}});
  if(response.status===404)return null;
  if(!response.ok)throw new RacingProviderError("RESULT_PROVIDER_UNAVAILABLE","Official result retrieval is temporarily unavailable.",503);
  return response.json();
}
function ensureTrailingSlash(value){return String(value).endsWith("/")?String(value):`${value}/`}
