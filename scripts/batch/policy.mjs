export const HEADERS={
  artist:'Artist Name',location:'Location',genre:'Genre',followers:'Follower Count (approx.)',followerPlatform:'Follower Platform',
  buyMusic:'Buy Music URL',spotify:'Spotify URL',bandcamp:'Bandcamp URL',youtube:'YouTube URL',instagram:'Instagram URL',facebook:'Facebook URL',
  website:'Official Website / Link Hub',merchandise:'Merch URL',newsReviews:'News / Review URL',featuredVideo:'Featured Video URL'
};
export const REQUIRED=Object.values(HEADERS);
export const DESTINATIONS=['buyMusic','spotify','bandcamp','youtube','instagram','facebook','website','merchandise','newsReviews','featuredVideo'];

export function normalizeRow(row){
  const result={rowNumber:row.rowNumber};for(const[key,header]of Object.entries(HEADERS))result[key]=clean(row[header]);
  result.slug=slugify(result.artist);result.followerCount=parseFollowerCount(result.followers);return result;
}

export function validateInput(rawRows){
  const missing=REQUIRED.filter(header=>rawRows.length&&!Object.hasOwn(rawRows[0],header));
  if(missing.length)throw new Error(`Missing required CSV columns: ${missing.join(', ')}`);
  const seen=new Map();
  return rawRows.map(raw=>{
    const row=normalizeRow(raw);const errors=[];
    if(!row.artist)errors.push(reason('MISSING_ARTIST_NAME','Artist name is blank.'));
    if(!row.slug)errors.push(reason('INVALID_ARTIST_NAME','Artist name cannot produce a safe identifier.'));
    if(seen.has(row.slug))errors.push(reason('DUPLICATE_ARTIST',`Duplicates CSV row ${seen.get(row.slug)}.`));else seen.set(row.slug,row.rowNumber);
    if(!Number.isFinite(row.followerCount))errors.push(reason('FOLLOWER_COUNT_INVALID','Follower count is not a number.'));
    else if(row.followerCount<=2000||row.followerCount>50000)errors.push(reason('FOLLOWER_RANGE_FAILED','Follower count must be above 2,000 and no more than 50,000.'));
    if(!row.followerPlatform)errors.push(reason('FOLLOWER_PLATFORM_MISSING','Follower platform is blank.'));
    for(const key of DESTINATIONS)if(!row[key])errors.push(reason('MANDATORY_PRESENCE_MISSING',`${key} is blank.`));
    return{...row,inputErrors:errors};
  });
}

export function isDirectDestination(key,value){
  let url;try{url=new URL(value)}catch{return false}if(url.protocol!=='https:')return false;
  const host=url.hostname.replace(/^www\./,'').toLowerCase();const path=url.pathname.toLowerCase();
  if(key==='spotify')return host==='open.spotify.com'&&/^\/artist\/[a-z0-9]+/i.test(path);
  if(key==='youtube')return ['youtube.com','youtu.be'].includes(host)&&!path.startsWith('/results')&&!path.startsWith('/search');
  if(key==='featuredVideo')return (host==='youtu.be'&&path.length>1)||(host==='youtube.com'&&path==='/watch'&&url.searchParams.has('v'));
  if(key==='instagram')return host==='instagram.com'&&path.split('/').filter(Boolean).length>=1&&!path.startsWith('/explore');
  if(key==='facebook')return (host==='facebook.com'||host==='m.facebook.com')&&path!=='/'&&!path.startsWith('/search');
  if(key==='bandcamp')return host.endsWith('bandcamp.com')&&!path.startsWith('/search');
  if(key==='newsReviews')return !isSearch(url)&&!['facebook.com','instagram.com','youtube.com'].includes(host);
  return !isSearch(url);
}

export function confidenceFor(row,evidence){
  const mandatory=DESTINATIONS.map(key=>evidence[key]);
  if(row.inputErrors.length||mandatory.some(item=>!item?.identityVerified))return Math.min(97,Math.round(100*mandatory.filter(item=>item?.identityVerified).length/mandatory.length));
  const independent=new Set(mandatory.map(item=>item.sourceHost).filter(Boolean));
  const official=mandatory.filter(item=>item.officialSource).length;
  if(independent.size<2||official<8)return 97;
  return 100;
}

export function reason(code,message){return{code,message}}
export function slugify(value){return clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
export function parseFollowerCount(value){const number=Number(clean(value).replace(/[^0-9.]/g,''));return Number.isFinite(number)&&number>0?Math.round(number):NaN}
export function clean(value){return String(value??'').trim().replace(/\s+/g,' ')}
function isSearch(url){return /(^|\/)(search|results)(\/|$)/i.test(url.pathname)||url.searchParams.has('search_query')||url.searchParams.has('q')&&/search/i.test(url.pathname)}
