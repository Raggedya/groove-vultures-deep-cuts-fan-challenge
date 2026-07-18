import {DESTINATIONS,isDirectDestination,isAuthenticationWall,confidenceFor,reason} from './policy.mjs';
import {extractLinks} from './network.mjs';

export async function verifyArtist(row,network,{offline=false}={}){
  const evidence={};const errors=[...row.inputErrors];const pages=[];
  for(const key of ['website','bandcamp','buyMusic','merchandise','newsReviews']){
    if(!row[key]||!isDirectDestination(key,row[key]))continue;
    const page=offline?synthetic(row[key]):await network.inspect(row[key]);pages.push({key,...page});
  }
  const discovered=pages.flatMap(page=>extractLinks(page.body,page.finalURL));
  const officialDiscovered=pages.filter(page=>page.key!=='newsReviews').flatMap(page=>extractLinks(page.body,page.finalURL));
  const resolved={...row};
  for(const key of DESTINATIONS){
    if(!isDirectDestination(key,resolved[key])){
      const candidate=discovered.find(url=>isDirectDestination(key,url));
      if(candidate)resolved[key]=candidate;
    }
  }
  let popularSelection=null;
  if(isDirectDestination('youtube',resolved.youtube)){
    popularSelection=offline?{url:resolved.featuredVideo,verified:false}:await resolvePopularVideo(resolved.youtube,network);
    if(popularSelection?.url)resolved.featuredVideo=popularSelection.url;
  }
  for(const key of DESTINATIONS){
    const url=resolved[key];
    if(!isDirectDestination(key,url)){errors.push(reason('DIRECT_DESTINATION_UNRESOLVED',`${key} did not resolve to a direct destination.`));continue;}
    const page=offline?synthetic(url):await network.inspect(url);
    if(!page.ok){errors.push(reason('DESTINATION_UNREACHABLE',`${key} failed after automatic retries (${page.status||page.error}).`));continue;}
    const inspectedURL=page.finalURL||url;
    const evidenceURL=['instagram','facebook'].includes(key)&&isAuthenticationWall(inspectedURL)?url:inspectedURL;
    const evidencePage={...page,finalURL:evidenceURL};
    const sourceHost=host(evidenceURL);const officialSource=key!=='newsReviews';
    const popularityVerified=key!=='featuredVideo'||popularSelection?.verified===true;
    const identityVerified=key==='featuredVideo'
      ? popularityVerified&&evidence.youtube?.identityVerified===true
      : popularityVerified&&identityMatch(row,evidencePage,key,officialDiscovered);
    if(key==='featuredVideo'&&!popularityVerified)errors.push(reason('FEATURED_VIDEO_POPULARITY_UNVERIFIED','The most-viewed official video could not be proved from the official channel Popular ordering.'));
    if(!identityVerified)errors.push(reason('IDENTITY_CONFIDENCE_FAILED',`${key} could not be tied to ${row.artist} with sufficient evidence.`));
    evidence[key]={url:evidenceURL,sourceHost,officialSource,identityVerified,verifiedAt:page.checkedAt,status:page.status,evidence:identityVerified?identitySentence(row,key,evidencePage):'Insufficient identity evidence.'};
  }
  const confidence=confidenceFor(row,evidence);
  if(confidence<98)errors.push(reason('CONFIDENCE_BELOW_98',`Confidence score ${confidence}% is below the mandatory 98% gate.`));
  return{row:resolved,evidence,confidence,errors:dedupe(errors),sourceCount:new Set(Object.values(evidence).map(item=>item.sourceHost)).size};
}

async function resolvePopularVideo(channelURL,network){
  let url;try{url=new URL(channelURL)}catch{return null}
  if(url.hostname.replace(/^www\./,'')!=='youtube.com'||url.pathname==='/watch')return null;
  url.pathname=`${url.pathname.replace(/\/$/,'')}/videos`;url.search='?view=0&sort=p&flow=grid';
  const page=await network.inspect(url.href,{cache:false});if(!page.ok)return null;
  const marker=page.body.match(/"videoId":"([A-Za-z0-9_-]{6,})"/);
  return marker?{url:`https://www.youtube.com/watch?v=${marker[1]}`,verified:true,sourceURL:url.href,checkedAt:page.checkedAt}:null;
}

function identityMatch(row,page,key,discovered){
  if(key==='featuredVideo')return isOfficialYoutubeEvidence(row,page,discovered);
  if(['instagram','facebook'].includes(key))return discovered.some(url=>sameURL(url,page.finalURL));
  const haystack=decode(`${page.finalURL} ${page.body.slice(0,350000)}`).toLowerCase();
  const tokens=row.artist.toLowerCase().split(/[^a-z0-9]+/).filter(token=>token.length>2&&!['the','and','band'].includes(token));
  const tokenMatch=tokens.length&&tokens.every(token=>haystack.includes(token));
  if(tokenMatch)return true;
  const normalized=row.slug.replaceAll('-','');const compact=haystack.replace(/[^a-z0-9]/g,'');if(normalized.length>4&&compact.includes(normalized))return true;
  if(['spotify','youtube','instagram','facebook'].includes(key))return discovered.some(url=>sameURL(url,page.finalURL));
  return false;
}
function isOfficialYoutubeEvidence(row,page,discovered){return identityMatch(row,page,'youtube',discovered)||discovered.some(url=>sameURL(url,page.finalURL))}
function identitySentence(row,key,page){return `${key} resolved directly and the destination metadata or an official artist-controlled cross-link matched ${row.artist}; HTTP ${page.status}.`}
function synthetic(url){return{ok:true,status:200,requestedURL:url,finalURL:url,body:url,checkedAt:new Date().toISOString()}}
function host(value){try{return new URL(value).hostname.replace(/^www\./,'')}catch{return''}}
function sameURL(a,b){try{const x=new URL(a),y=new URL(b);return x.hostname===y.hostname&&x.pathname.replace(/\/$/,'')===y.pathname.replace(/\/$/,'')}catch{return false}}
function decode(value){return String(value).replace(/%([0-9a-f]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)))}
function dedupe(items){const seen=new Set();return items.filter(item=>{const key=`${item.code}:${item.message}`;if(seen.has(key))return false;seen.add(key);return true})}
