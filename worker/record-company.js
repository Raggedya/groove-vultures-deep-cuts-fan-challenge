import {
  ANALYTICS_EVENTS,JOB_STAGES,LINK_TYPES,PUBLICATION_CONFIDENCE,canonicalDomain,
  safeSlug,validHttpsUrl,validateQuiz
} from "../record-company/schemas.js";

const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const AI_MODEL="@cf/meta/llama-4-scout-17b-16e-instruct";
const ROBOTS_CACHE=new Map();
const ROSTER_TERMS=/\b(artists?|roster|bands?|acts?|talent|our\s+music|catalogue)\b/i;
const NON_ARTIST_TERMS=/\b(news|release|album|single|shop|store|merch|contact|about|privacy|terms|licen[cs]|publish|distribution|playlist|event|tour|login|sign|cart|search|staff|team)\b/i;
const COMPANY_EVIDENCE_TERMS=/\b(about|our[\s-]+story|history|who[\s-]+we[\s-]+are|mission|philosophy|values)\b/i;
const WIX_NON_ARTIST_PAGES=new Set([
  "about","artists","catalogue","contact","events","fullscreen-page","home","licensing","mailing-list",
  "news","playlists","privacy","search","search-results","search-results-page","shop","store","submit-music",
  "sync","terms"
]);
const PLATFORM_RULES=[
  ["spotify",/open\.spotify\.com\/artist\//i,"Listen on Spotify"],
  ["apple_music",/music\.apple\.com\/.+\/artist\//i,"Apple Music"],
  ["bandcamp",/bandcamp\.com/i,"Bandcamp"],
  ["youtube",/(youtube\.com\/(@|channel\/|c\/|user\/|watch\?)|youtu\.be\/)/i,"Watch on YouTube"],
  ["instagram",/instagram\.com\/(?!p\/|reel\/|share)/i,"Instagram"],
  ["facebook",/facebook\.com\/(?!share|sharer|login)/i,"Facebook"],
  ["tiktok",/tiktok\.com\/@/i,"TikTok"],
  ["soundcloud",/soundcloud\.com\/[^/]+\/?$/i,"SoundCloud"]
];

export async function handleRecordCompany(request,env,ctx,url){
  const parts=url.pathname.split("/").filter(Boolean).slice(2);
  if(parts[0]==="jobs"&&request.method==="POST"&&parts.length===1)return launchJob(request,env,ctx);
  if(parts[0]==="jobs"&&parts[1]&&request.method==="GET"&&parts.length===2)return jobStatus(request,env,ctx,parts[1]);
  if(parts[0]==="jobs"&&parts[1]&&parts[2]==="stage"&&request.method==="POST")return recordExternalStage(request,env,parts[1]);
  if(parts[0]==="jobs"&&parts[1]&&parts[2]==="export"&&request.method==="GET")return exportJob(request,env,parts[1]);
  if(parts[0]==="jobs"&&parts[1]&&parts[2]==="delivery"&&request.method==="POST")return recordDelivery(request,env,parts[1]);
  if(parts[0]==="reports"&&parts[1]&&request.method==="GET")return reportingExport(request,env,parts[1],url);
  if(parts[0]==="public"&&parts[1]&&parts[2]==="artists"&&parts[3]&&request.method==="GET")return publicArtist(env,parts[1],parts[3]);
  if(parts[0]==="public"&&parts[1]&&request.method==="GET")return publicCompany(env,parts[1]);
  if(parts[0]==="events"&&request.method==="POST")return recordEvent(request,env);
  return json({ok:false,error:"Record-company route not found"},404);
}

export async function handleRecordCompanyQr(request,env,ctx,url){
  const tracking=cleanId(url.pathname.split("/").filter(Boolean)[2]);
  if(!tracking)return new Response("Unknown Deep Cuts collection",{status:404});
  const qr=await env.DB.prepare("SELECT record_company_id,entity_type,entity_id,destination_url FROM record_company_qr_codes WHERE tracking_code=?1 AND verification_status='verified'").bind(tracking).first();
  if(!qr)return new Response("Unknown Deep Cuts collection",{status:404});
  ctx.waitUntil(insertAnalytics(env,analyticsEvent(request,{record_company_id:qr.record_company_id,artist_id:qr.entity_type==="artist"?qr.entity_id:null,event_type:"qr_scan",event_metadata:{tracking_code:tracking}})));
  return Response.redirect(new URL(qr.destination_url,url.origin).toString(),302);
}

export async function processRecordCompanyJobs(env){
  const row=await env.DB.prepare("SELECT job_id FROM record_company_jobs WHERE status NOT IN ('completed','completed_with_exceptions','failed','ready_for_delivery','generating_master_qr_image','sending_completion_email') ORDER BY updated_at LIMIT 1").first();
  if(row?.job_id)await processJobSlice(row.job_id,env);
  else await checkOneStaleLink(env);
}

async function launchJob(request,env,ctx){
  if(!authorized(request,env))return json({ok:false,error:"Unauthorized"},401);
  const body=await safeJson(request);
  if(!validHttpsUrl(body?.recordCompanyUrl))return json({ok:false,error:"Enter a valid public HTTPS record-company URL."},400);
  const jobId=`rcj_${crypto.randomUUID().replaceAll("-","").slice(0,20)}`;
  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO record_company_jobs
    (job_id,source_url,notification_email,project_name,settings_json,status,current_stage,started_at,updated_at)
    VALUES (?1,?2,?3,?4,?5,'queued','queued',?6,?6)`)
    .bind(jobId,normalizeUrl(body.recordCompanyUrl),cleanText(body.notificationEmail,254)||null,cleanText(body.projectName,120)||null,JSON.stringify(safeSettings(body)),now).run();
  ctx.waitUntil(processJobSlice(jobId,env));
  return json({ok:true,jobId,status:"queued"},202);
}

async function jobStatus(request,env,ctx,jobId){
  if(!authorized(request,env))return json({ok:false,error:"Unauthorized"},401);
  const id=cleanId(jobId);
  const row=await env.DB.prepare(`SELECT job_id,record_company_id,source_url,status,current_stage,progress_completed,progress_total,
    started_at,completed_at,updated_at,error_summary,notification_email_status FROM record_company_jobs WHERE job_id=?1`).bind(id).first();
  if(!row)return json({ok:false,error:"Job not found"},404);
  if(!["completed","completed_with_exceptions","failed","ready_for_delivery","generating_master_qr_image","sending_completion_email"].includes(row.status))ctx.waitUntil(processJobSlice(id,env));
  return json({ok:true,...row});
}

async function processJobSlice(jobId,env){
  const now=Date.now(),leaseUntil=new Date(now+45000).toISOString();
  const claimed=await env.DB.prepare(`UPDATE record_company_jobs SET lease_until=?1,updated_at=?2
    WHERE job_id=?3 AND (lease_until IS NULL OR lease_until<?2) AND status NOT IN ('completed','completed_with_exceptions','failed','ready_for_delivery')`)
    .bind(leaseUntil,new Date(now).toISOString(),jobId).run();
  if(Number(claimed.meta?.changes||0)!==1)return;
  try{
    const job=await env.DB.prepare("SELECT * FROM record_company_jobs WHERE job_id=?1").bind(jobId).first();
    if(!job)return;
    const checkpoint=parseJson(job.checkpoint_json,{});
    if(["queued","validating"].includes(job.current_stage))await validateAndDiscoverCompany(job,checkpoint,env);
    else if(job.current_stage==="discovering_company")await discoverRoster(job,checkpoint,env);
    else if(job.current_stage==="discovering_roster")await persistRoster(job,checkpoint,env);
    else if(job.current_stage==="researching_artists")await researchNextArtist(job,checkpoint,env);
    else if(["generating_quizzes","generating_pages","generating_qr_codes","validating_output","generating_reports"].includes(job.current_stage))await finalizeBuild(job,env);
  }catch(error){
    console.error("record-company-job-error",jobId,error);
    await failJob(env,jobId,safeError(error));
  }finally{
    await env.DB.prepare("UPDATE record_company_jobs SET lease_until=NULL WHERE job_id=?1").bind(jobId).run().catch(()=>{});
  }
}

async function validateAndDiscoverCompany(job,checkpoint,env){
  await setStage(env,job.job_id,"validating");
  const page=await fetchOfficial(job.source_url,job.source_url);
  const profile=extractCompanyProfile(page.html,page.url);
  const settings=parseJson(job.settings_json,{});
  if(validHttpsUrl(settings.recordCompanyLogo))profile.logoUrl=settings.recordCompanyLogo;
  if(profile.confidenceScore<PUBLICATION_CONFIDENCE)throw new Error("The record-company identity could not be verified to 98% confidence.");
  const companyId=`rc_${hashId(profile.canonicalDomain)}`;
  const companyEvidence=await collectCompanyEvidence(page,env);
  const companyQuiz=await generateQuiz(env,{entityType:"record_company",name:profile.name,description:profile.description,pageText:companyEvidence.text,sourceUrl:companyEvidence.primaryUrl});
  if(!validateQuiz(companyQuiz))throw new Error("Five verified record-company quiz questions could not be generated.");
  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO record_companies
    (record_company_id,name,slug,official_url,canonical_domain,description,logo_url,brand_palette_json,hero_asset,location,genres_json,source_evidence_json,confidence_score,status,created_at,updated_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,'building',?14,?14)
    ON CONFLICT(record_company_id) DO UPDATE SET name=excluded.name,slug=excluded.slug,official_url=excluded.official_url,canonical_domain=excluded.canonical_domain,
    description=excluded.description,logo_url=excluded.logo_url,brand_palette_json=excluded.brand_palette_json,hero_asset=excluded.hero_asset,
    source_evidence_json=excluded.source_evidence_json,confidence_score=excluded.confidence_score,status='building',updated_at=excluded.updated_at`)
    .bind(companyId,profile.name,profile.slug,page.url,profile.canonicalDomain,profile.description,profile.logoUrl||null,JSON.stringify(profile.brandPalette),profile.heroAsset||null,profile.location||null,JSON.stringify(profile.genres),JSON.stringify(profile.evidence),profile.confidenceScore,now).run();
  await saveQuiz(env,companyId,companyId,"record_company",companyQuiz);
  await replaceLinks(env,companyId,null,await validateOfficialLinks(extractLinks(page.html,page.url,"company")));
  await saveSources(env,companyId,null,"record_company",companyId,profile.evidence);
  await env.DB.prepare("UPDATE record_company_jobs SET record_company_id=?1,status='discovering_company',current_stage='discovering_company',checkpoint_json=?2,updated_at=?3 WHERE job_id=?4")
    .bind(companyId,JSON.stringify({...checkpoint,companyPage:{url:page.url,html:page.html.slice(0,500000)},companySlug:profile.slug}),now,job.job_id).run();
}

async function collectCompanyEvidence(home,env){
  const urls=companyEvidenceUrls(home.html,home.url).slice(0,4);
  const pages=[{url:home.url,text:home.text}];
  for(const url of urls){
    if(url===home.url)continue;
    try{
      const page=await fetchOfficial(url,home.url);
      if(page.text.length>=120)pages.push({url:page.url,text:page.text});
    }catch(error){
      console.warn("record-company-evidence-page-skipped",url,safeError(error));
    }
    await delay(100);
  }
  const detailed=pages.find(page=>page.url!==home.url&&page.text.length>=400);
  return{
    primaryUrl:detailed?.url||home.url,
    text:pages.map(page=>`OFFICIAL SOURCE: ${page.url}\n${page.text}`).join("\n\n").slice(0,30000)
  };
}

function companyEvidenceUrls(html,base){
  const urls=[];
  for(const link of extractAnchors(html,base)){
    if(sameDomain(link.url,base)&&COMPANY_EVIDENCE_TERMS.test(`${link.text} ${new URL(link.url).pathname}`))urls.push(link.url);
  }
  for(const match of String(html||"").matchAll(/"pageUriSEO"\s*:\s*"([^"]+)"/g)){
    const pagePath=decodeJsonString(match[1]).replace(/^\/+/,"");
    if(COMPANY_EVIDENCE_TERMS.test(pagePath)){
      const url=absoluteUrl(pagePath,base);
      if(url&&sameDomain(url,base))urls.push(normalizeUrl(url));
    }
  }
  return [...new Set(urls)];
}

async function discoverRoster(job,checkpoint,env){
  const home=checkpoint.companyPage;
  if(!home?.html)throw new Error("The company discovery checkpoint is incomplete.");
  const anchors=extractAnchors(home.html,home.url);
  const rosterPages=anchors.filter(link=>sameDomain(link.url,home.url)&&ROSTER_TERMS.test(`${link.text} ${link.url}`)).slice(0,10);
  const attempts=[],candidates=[],seen=new Set(),queue=[...(rosterPages.length?rosterPages:[{url:home.url,text:"Homepage"}])];
  while(queue.length&&seen.size<25){
    const source=queue.shift();
    if(seen.has(source.url))continue;
    seen.add(source.url);
    try{
      const page=source.url===home.url?{html:home.html,url:home.url}:await fetchOfficial(source.url,home.url);
      attempts.push({url:page.url,status:"read"});
      candidates.push(...extractArtistCandidates(page.html,page.url,home.url));
      for(const link of extractAnchors(page.html,page.url)){
        if(seen.has(link.url)||!sameDomain(link.url,home.url))continue;
        const value=`${link.text} ${link.url}`;
        if(/\b(next|older|more|page\s*\d+)\b|[?&](page|paged|offset)=\d+/i.test(value))queue.push(link);
      }
    }catch(error){attempts.push({url:source.url,status:"failed",reason:safeError(error)})}
    await delay(125);
  }
  const deduped=dedupeCandidates(candidates);
  if(!deduped.length){
    await env.DB.prepare("UPDATE record_company_jobs SET ingestion_report_json=?1 WHERE job_id=?2").bind(JSON.stringify({attemptedRosterLocations:attempts}),job.job_id).run();
    throw new Error("No official artist roster could be confidently extracted.");
  }
  await env.DB.prepare("UPDATE record_company_jobs SET status='discovering_roster',current_stage='discovering_roster',progress_total=?1,checkpoint_json=?2,ingestion_report_json=?3,updated_at=?4 WHERE job_id=?5")
    .bind(deduped.length,JSON.stringify({...checkpoint,candidates:deduped}),JSON.stringify({attemptedRosterLocations:attempts,rosterEntriesDiscovered:deduped.length}),new Date().toISOString(),job.job_id).run();
}

async function persistRoster(job,checkpoint,env){
  const candidates=checkpoint.candidates||[];
  const settings=parseJson(job.settings_json,{});
  const now=new Date().toISOString();
  if(settings.refreshExisting){
    await env.DB.prepare("UPDATE record_company_artists SET publication_status='removed_from_current_roster',updated_at=?1 WHERE record_company_id=?2").bind(now,job.record_company_id).run();
  }
  for(const candidate of candidates){
    const id=`rca_${hashId(`${job.record_company_id}:${candidate.url}`)}`;
    await env.DB.prepare(`INSERT INTO record_company_artists
      (artist_id,record_company_id,name,slug,official_label_profile_url,source_evidence_json,confidence_score,publication_status,created_at,updated_at)
      VALUES (?1,?2,?3,?4,?5,?6,?7,'pending',?8,?8)
      ON CONFLICT(artist_id) DO UPDATE SET name=excluded.name,official_label_profile_url=excluded.official_label_profile_url,
      publication_status=CASE WHEN ?9=1 OR record_company_artists.publication_status='removed_from_current_roster' THEN 'pending' ELSE record_company_artists.publication_status END,
      failure_reason=CASE WHEN ?9=1 THEN NULL ELSE record_company_artists.failure_reason END,updated_at=excluded.updated_at`)
      .bind(id,job.record_company_id,candidate.name,uniqueSlug(candidate.name,candidate.url),candidate.url,JSON.stringify([{fieldName:"roster_membership",sourceUrl:candidate.sourceUrl,summary:`Listed as ${candidate.name} on the official roster.`,confidenceScore:candidate.confidenceScore,checkedAt:now}]),candidate.confidenceScore,now,settings.refreshExisting?1:0).run();
  }
  await env.DB.prepare("UPDATE record_company_jobs SET status='researching_artists',current_stage='researching_artists',checkpoint_json=?1,updated_at=?2 WHERE job_id=?3")
    .bind(JSON.stringify({...checkpoint,candidates:undefined}),now,job.job_id).run();
}

async function researchNextArtist(job,checkpoint,env){
  const artist=await env.DB.prepare("SELECT * FROM record_company_artists WHERE record_company_id=?1 AND publication_status='pending' ORDER BY name LIMIT 1").bind(job.record_company_id).first();
  if(!artist){
    await setStage(env,job.job_id,"generating_quizzes");
    return;
  }
  try{
    const page=await fetchOfficial(artist.official_label_profile_url,job.source_url);
    const profile=await generateArtistProfile(env,{name:artist.name,pageText:page.text,sourceUrl:page.url,companyDomain:canonicalDomain(job.source_url)});
    const officialHero=absoluteUrl(meta(page.html,"og:image")||meta(page.html,"twitter:image")||"",page.url);
    if(validHttpsUrl(officialHero))profile.heroAsset=officialHero;
    const evidenceConfidence=Math.min(Number(artist.confidence_score),Number(profile.confidenceScore||0));
    if(evidenceConfidence<PUBLICATION_CONFIDENCE)throw new Error(`Identity confidence ${Math.round(evidenceConfidence*100)}% is below 98%.`);
    const quiz=await generateQuiz(env,{entityType:"artist",name:artist.name,description:profile.biography,pageText:page.text,sourceUrl:page.url});
    if(!validateQuiz(quiz))throw new Error("Five excellent verified quiz questions were not available.");
    const directLinks=await validateOfficialLinks(extractLinks(page.html,page.url,"artist"));
    const now=new Date().toISOString();
    await env.DB.prepare(`UPDATE record_company_artists SET official_website_url=?1,biography=?2,genres_json=?3,location=?4,hero_asset=?5,
      source_evidence_json=?6,confidence_score=?7,publication_status='published',failure_reason=NULL,updated_at=?8 WHERE artist_id=?9`)
      .bind(profile.officialWebsiteUrl||null,profile.biography,JSON.stringify(profile.genres||[]),profile.location||null,profile.heroAsset||null,JSON.stringify(profile.evidence||[]),evidenceConfidence,now,artist.artist_id).run();
    await saveQuiz(env,job.record_company_id,artist.artist_id,"artist",quiz);
    await replaceLinks(env,job.record_company_id,artist.artist_id,directLinks);
    await saveSources(env,job.record_company_id,artist.artist_id,"artist",artist.artist_id,profile.evidence||[]);
  }catch(error){
    const reason=safeError(error),now=new Date().toISOString();
    await env.DB.prepare("UPDATE record_company_artists SET publication_status='skipped',failure_reason=?1,updated_at=?2 WHERE artist_id=?3").bind(reason,now,artist.artist_id).run();
    await appendException(env,job.job_id,{artist:artist.name,sourceUrl:artist.official_label_profile_url,reason});
  }
  await env.DB.prepare("UPDATE record_company_jobs SET progress_completed=progress_completed+1,updated_at=?1 WHERE job_id=?2").bind(new Date().toISOString(),job.job_id).run();
}

async function finalizeBuild(job,env){
  const stage=job.current_stage;
  if(stage==="generating_quizzes")return setStage(env,job.job_id,"generating_pages");
  if(stage==="generating_pages"){
    const counts=await env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN publication_status='published' THEN 1 ELSE 0 END) published FROM record_company_artists WHERE record_company_id=?1").bind(job.record_company_id).first();
    if(!Number(counts?.published||0))throw new Error("No artist met the 98% identity and five-question quality gates.");
    await env.DB.prepare("UPDATE record_companies SET status='active',updated_at=?1 WHERE record_company_id=?2").bind(new Date().toISOString(),job.record_company_id).run();
    return setStage(env,job.job_id,"generating_qr_codes");
  }
  if(stage==="generating_qr_codes"){
    const company=await env.DB.prepare("SELECT * FROM record_companies WHERE record_company_id=?1").bind(job.record_company_id).first();
    const artists=await env.DB.prepare("SELECT artist_id,slug FROM record_company_artists WHERE record_company_id=?1 AND publication_status='published'").bind(job.record_company_id).all();
    await upsertQr(env,job.record_company_id,"record_company",job.record_company_id,`/record-company/${company.slug}`);
    for(const artist of artists.results||[])await upsertQr(env,job.record_company_id,"artist",artist.artist_id,`/record-company/${company.slug}/artists/${artist.slug}`);
    return setStage(env,job.job_id,"validating_output");
  }
  if(stage==="validating_output"){
    const reconciliation=await reconciliationReport(env,job.record_company_id);
    if(!reconciliation.valid)throw new Error(`Output reconciliation failed: ${reconciliation.errors.join("; ")}`);
    return setStage(env,job.job_id,"generating_reports");
  }
  if(stage==="generating_reports"){
    await env.DB.prepare("UPDATE record_company_jobs SET status='ready_for_delivery',current_stage='ready_for_delivery',lease_until=NULL,updated_at=?1 WHERE job_id=?2").bind(new Date().toISOString(),job.job_id).run();
  }
}

async function publicCompany(env,slug){
  const company=await env.DB.prepare("SELECT * FROM record_companies WHERE slug=?1 AND status='active'").bind(cleanSlug(slug)).first();
  if(!company)return json({ok:false,error:"Collection not found"},404);
  const artists=await env.DB.prepare("SELECT artist_id id,name,slug,publication_status publicationStatus FROM record_company_artists WHERE record_company_id=?1 AND publication_status='published' ORDER BY name").bind(company.record_company_id).all();
  return json({ok:true,company:await hydrateCompany(env,company),artists:artists.results||[]});
}

async function publicArtist(env,companySlug,artistSlug){
  const company=await env.DB.prepare("SELECT * FROM record_companies WHERE slug=?1 AND status='active'").bind(cleanSlug(companySlug)).first();
  if(!company)return json({ok:false,error:"Collection not found"},404);
  const artist=await env.DB.prepare("SELECT * FROM record_company_artists WHERE record_company_id=?1 AND slug=?2 AND publication_status='published'").bind(company.record_company_id,cleanSlug(artistSlug)).first();
  if(!artist)return json({ok:false,error:"Artist not found"},404);
  const artists=await env.DB.prepare("SELECT artist_id id,name,slug,publication_status publicationStatus FROM record_company_artists WHERE record_company_id=?1 AND publication_status='published' ORDER BY name").bind(company.record_company_id).all();
  return json({ok:true,company:await hydrateCompany(env,company),artist:await hydrateArtist(env,artist),artists:artists.results||[]});
}

async function hydrateCompany(env,row){
  return {
    id:row.record_company_id,name:row.name,slug:row.slug,officialUrl:row.official_url,canonicalDomain:row.canonical_domain,
    description:row.description,logoUrl:row.logo_url,brandPalette:parseJson(row.brand_palette_json,{}),heroAsset:row.hero_asset,
    location:row.location,genres:parseJson(row.genres_json,[]),confidenceScore:row.confidence_score,updatedAt:row.updated_at,
    links:await publicLinks(env,row.record_company_id,null),quiz:await publicQuiz(env,"record_company",row.record_company_id)
  };
}
async function hydrateArtist(env,row){
  const links=await publicLinks(env,row.record_company_id,row.artist_id);
  const youtube=links.find(link=>link.type==="youtube");
  return {
    id:row.artist_id,recordCompanyId:row.record_company_id,name:row.name,slug:row.slug,officialLabelProfileUrl:row.official_label_profile_url,
    officialWebsiteUrl:row.official_website_url,biography:row.biography,description:row.biography,genres:parseJson(row.genres_json,[]),
    location:row.location,heroAsset:row.hero_asset,confidenceScore:row.confidence_score,publicationStatus:row.publication_status,updatedAt:row.updated_at,
    featuredVideo:youtube?youtubeVideo(youtube.url,row.name):null,links,quiz:await publicQuiz(env,"artist",row.artist_id)
  };
}
async function publicLinks(env,companyId,artistId){
  const query=artistId
    ?env.DB.prepare("SELECT link_type type,label,url FROM record_company_links WHERE record_company_id=?1 AND artist_id=?2 AND validation_status='verified' ORDER BY label").bind(companyId,artistId)
    :env.DB.prepare("SELECT link_type type,label,url FROM record_company_links WHERE record_company_id=?1 AND artist_id IS NULL AND validation_status='verified' ORDER BY label").bind(companyId);
  const result=await query.all();return (result.results||[]).map(link=>({...link,description:linkDescription(link.type)}));
}
async function publicQuiz(env,type,id){const row=await env.DB.prepare("SELECT quiz_id,title,questions_json FROM record_company_quizzes WHERE entity_type=?1 AND entity_id=?2 AND status='active'").bind(type,id).first();return row?{id:row.quiz_id,title:row.title,questions:parseJson(row.questions_json,[])}:null}

async function recordEvent(request,env){
  const body=await safeJson(request);
  const companyId=cleanId(body?.record_company_id),artistId=cleanId(body?.artist_id)||null;
  if(!companyId||!ANALYTICS_EVENTS.includes(body?.event_type))return json({ok:false,error:"Invalid event"},400);
  const entity=artistId
    ?await env.DB.prepare("SELECT 1 found FROM record_company_artists WHERE artist_id=?1 AND record_company_id=?2 AND publication_status='published'").bind(artistId,companyId).first()
    :await env.DB.prepare("SELECT 1 found FROM record_companies WHERE record_company_id=?1 AND status='active'").bind(companyId).first();
  if(!entity?.found)return json({ok:false,error:"Analytics entity not found"},404);
  const event=analyticsEvent(request,body);await insertAnalytics(env,event);return json({ok:true});
}
function analyticsEvent(request,body){
  const cf=request.cf||{};
  return {event_id:cleanText(body.event_id,100)||crypto.randomUUID(),record_company_id:cleanId(body.record_company_id),artist_id:cleanId(body.artist_id)||null,
    session_id:cleanText(body.session_id,100)||null,event_type:body.event_type,event_metadata_json:JSON.stringify(safeEventMetadata(body.event_metadata)),
    referring_source:cleanText(body.referring_source,300)||null,device_category:cleanText(body.device_category,20)||null,country_code:cleanText(cf.country,8)||null,
    region_code:cleanText(cf.regionCode,16)||null,occurred_at:validDate(body.timestamp),received_at:new Date().toISOString()};
}
async function insertAnalytics(env,event){await env.DB.prepare(`INSERT OR IGNORE INTO record_company_analytics
  (event_id,record_company_id,artist_id,session_id,event_type,event_metadata_json,referring_source,device_category,country_code,region_code,occurred_at,received_at)
  VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`).bind(event.event_id,event.record_company_id,event.artist_id,event.session_id,event.event_type,event.event_metadata_json,event.referring_source,event.device_category,event.country_code,event.region_code,event.occurred_at,event.received_at).run()}

async function exportJob(request,env,jobId){
  if(!authorized(request,env))return json({ok:false,error:"Unauthorized"},401);
  const job=await env.DB.prepare("SELECT * FROM record_company_jobs WHERE job_id=?1").bind(cleanId(jobId)).first();
  if(!job||job.status!=="ready_for_delivery")return json({ok:false,error:"Build is not ready for delivery"},409);
  const company=await env.DB.prepare("SELECT * FROM record_companies WHERE record_company_id=?1").bind(job.record_company_id).first();
  const artists=await env.DB.prepare("SELECT * FROM record_company_artists WHERE record_company_id=?1 ORDER BY name").bind(job.record_company_id).all();
  const links=await env.DB.prepare("SELECT * FROM record_company_links WHERE record_company_id=?1 ORDER BY artist_id,label").bind(job.record_company_id).all();
  const quizzes=await env.DB.prepare("SELECT * FROM record_company_quizzes WHERE record_company_id=?1 ORDER BY entity_type,entity_id").bind(job.record_company_id).all();
  const qrs=await env.DB.prepare("SELECT * FROM record_company_qr_codes WHERE record_company_id=?1 ORDER BY entity_type,entity_id").bind(job.record_company_id).all();
  const sources=await env.DB.prepare("SELECT * FROM record_company_sources WHERE record_company_id=?1 ORDER BY entity_type,entity_id,field_name").bind(job.record_company_id).all();
  const reconciliation=await reconciliationReport(env,job.record_company_id);
  return json({version:1,generatedAt:new Date().toISOString(),job,company,artists:artists.results||[],links:links.results||[],quizzes:quizzes.results||[],qrs:qrs.results||[],sources:sources.results||[],exceptions:parseJson(job.exception_report_json,[]),reconciliation});
}

async function recordExternalStage(request,env,jobId){
  if(!authorized(request,env))return json({ok:false,error:"Unauthorized"},401);
  const body=await safeJson(request),id=cleanId(jobId),stage=cleanText(body?.stage,60);
  if(!["generating_master_qr_image","sending_completion_email"].includes(stage))return json({ok:false,error:"Invalid external delivery stage"},400);
  const allowed=stage==="generating_master_qr_image"
    ?["ready_for_delivery","generating_master_qr_image"]
    :["ready_for_delivery","generating_master_qr_image","sending_completion_email"];
  const placeholders=allowed.map((_,index)=>`?${index+2}`).join(",");
  const result=await env.DB.prepare(`UPDATE record_company_jobs SET status=?1,current_stage=?1,updated_at=?${allowed.length+2} WHERE job_id=?${allowed.length+3} AND status IN (${placeholders})`)
    .bind(stage,...allowed,new Date().toISOString(),id).run();
  if(Number(result.meta?.changes||0)!==1)return json({ok:false,error:"Job is not ready for this delivery stage"},409);
  return json({ok:true,status:stage});
}

async function recordDelivery(request,env,jobId){
  if(!authorized(request,env))return json({ok:false,error:"Unauthorized"},401);
  const body=await safeJson(request),id=cleanId(jobId);
  if(!body?.masterQrVerified||!body?.reportsReconciled||!body?.emailProviderId||!Array.isArray(body.verifiedCodes))return json({ok:false,error:"Delivery verification is incomplete"},400);
  const job=await env.DB.prepare("SELECT exception_report_json FROM record_company_jobs WHERE job_id=?1 AND status IN ('ready_for_delivery','sending_completion_email')").bind(id).first();
  if(!job)return json({ok:false,error:"Job is not ready for delivery"},409);
  const expected=await env.DB.prepare("SELECT qr_id,entity_id,tracking_code,destination_url FROM record_company_qr_codes WHERE record_company_id=(SELECT record_company_id FROM record_company_jobs WHERE job_id=?1)").bind(id).all();
  const verified=new Map(body.verifiedCodes.filter(item=>item?.verified).map(item=>[item.entityId,item]));
  if((expected.results||[]).length!==verified.size)return json({ok:false,error:"Verified QR count does not match the published collection."},400);
  for(const qr of expected.results||[]){
    const item=verified.get(qr.entity_id);
    if(!item||!String(item.trackingUrl||"").endsWith(`/record-company/q/${qr.tracking_code}`))return json({ok:false,error:`QR verification mismatch for ${qr.entity_id}.`},400);
  }
  const finalStatus=parseJson(job.exception_report_json,[]).length?"completed_with_exceptions":"completed";
  const now=new Date().toISOString();
  await env.DB.prepare("UPDATE record_company_jobs SET status=?1,current_stage=?1,completed_at=?2,updated_at=?2,notification_email_status='accepted',email_provider_id=?3 WHERE job_id=?4")
    .bind(finalStatus,now,cleanText(body.emailProviderId,120),id).run();
  for(const qr of expected.results||[]){
    const item=verified.get(qr.entity_id);
    await env.DB.prepare("UPDATE record_company_qr_codes SET verification_status='verified',verified_destination=?1,png_path=?2,svg_path=?3,updated_at=?4 WHERE qr_id=?5")
      .bind(item.trackingUrl,cleanText(item.png,300),cleanText(item.svg,300),now,qr.qr_id).run();
  }
  return json({ok:true,status:finalStatus});
}

async function reportingExport(request,env,slug,url){
  if(!authorized(request,env))return json({ok:false,error:"Unauthorized"},401);
  const company=await env.DB.prepare("SELECT record_company_id,name,slug,official_url,created_at,updated_at FROM record_companies WHERE slug=?1").bind(cleanSlug(slug)).first();
  if(!company)return json({ok:false,error:"Collection not found"},404);
  const totals=await env.DB.prepare(`SELECT
    SUM(CASE WHEN event_type='company_page_view' THEN 1 ELSE 0 END) company_page_views,
    SUM(CASE WHEN event_type='artist_page_view' THEN 1 ELSE 0 END) artist_page_views,
    SUM(CASE WHEN event_type='discover_artist' THEN 1 ELSE 0 END) discovery_selections,
    SUM(CASE WHEN event_type='recommended_artist' THEN 1 ELSE 0 END) recommendation_selections,
    SUM(CASE WHEN event_type='back_to_company' THEN 1 ELSE 0 END) back_to_company,
    SUM(CASE WHEN event_type='outbound_click' THEN 1 ELSE 0 END) outbound_clicks,
    SUM(CASE WHEN event_type LIKE '%quiz_started' THEN 1 ELSE 0 END) quiz_starts,
    SUM(CASE WHEN event_type='quiz_completed' THEN 1 ELSE 0 END) quiz_completions,
    SUM(CASE WHEN event_type='quiz_abandoned' THEN 1 ELSE 0 END) quiz_abandonments,
    ROUND(AVG(CASE WHEN event_type='quiz_completed' THEN CAST(json_extract(event_metadata_json,'$.final_score') AS REAL) END),2) average_quiz_score,
    ROUND(AVG(CASE WHEN event_type='quiz_response' THEN CAST(json_extract(event_metadata_json,'$.response_seconds') AS REAL) END),2) average_response_seconds,
    COUNT(DISTINCT session_id) unique_sessions
    FROM record_company_analytics WHERE record_company_id=?1`).bind(company.record_company_id).first();
  const artists=await env.DB.prepare(`SELECT a.name,a.slug,a.publication_status,a.confidence_score,
    SUM(CASE WHEN e.event_type='artist_page_view' THEN 1 ELSE 0 END) page_views,
    SUM(CASE WHEN e.event_type='outbound_click' THEN 1 ELSE 0 END) outbound_clicks,
    SUM(CASE WHEN e.event_type='quiz_completed' THEN 1 ELSE 0 END) quiz_completions
    FROM record_company_artists a LEFT JOIN record_company_analytics e ON e.artist_id=a.artist_id
    WHERE a.record_company_id=?1 GROUP BY a.artist_id ORDER BY a.name`).bind(company.record_company_id).all();
  const report={generatedAt:new Date().toISOString(),company,totals,artists:artists.results||[]};
  if(url.searchParams.get("format")==="csv"){
    const rows=[{scope:"record_company",name:company.name,...totals},...(artists.results||[]).map(row=>({scope:"artist",...row}))];
    return new Response(toCsv(rows),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="${company.slug}-record-company-report.csv"`,"cache-control":"no-store"}});
  }
  return json(report);
}

async function checkOneStaleLink(env){
  const cutoff=new Date(Date.now()-7*86400000).toISOString();
  const link=await env.DB.prepare("SELECT link_id,url FROM record_company_links WHERE last_checked_at<?1 ORDER BY last_checked_at LIMIT 1").bind(cutoff).first();
  if(!link||!validHttpsUrl(link.url))return;
  let status=0,redirect="";
  try{
    const response=await fetch(link.url,{method:"HEAD",redirect:"follow",signal:AbortSignal.timeout(8000),headers:{"user-agent":"DeepCutsLinkHealth/1.0"}});
    status=response.status;redirect=response.url;
  }catch{}
  await env.DB.prepare("UPDATE record_company_links SET http_status=?1,redirect_url=?2,validation_status=?3,last_checked_at=?4 WHERE link_id=?5")
    .bind(status,cleanText(redirect,500)||null,status>=200&&status<400?"verified":"broken",new Date().toISOString(),link.link_id).run();
}

async function reconciliationReport(env,companyId){
  const counts=await env.DB.prepare(`SELECT
    (SELECT COUNT(*) FROM record_company_artists WHERE record_company_id=?1 AND publication_status='published') published,
    (SELECT COUNT(*) FROM record_company_quizzes WHERE record_company_id=?1 AND status='active' AND entity_type='artist') artist_quizzes,
    (SELECT COUNT(*) FROM record_company_qr_codes WHERE record_company_id=?1 AND entity_type='artist') artist_qrs,
    (SELECT COUNT(*) FROM record_company_quizzes WHERE record_company_id=?1 AND status='active' AND entity_type='record_company') company_quizzes,
    (SELECT COUNT(*) FROM record_company_qr_codes WHERE record_company_id=?1 AND entity_type='record_company') company_qrs`).bind(companyId).first();
  const errors=[];
  if(Number(counts?.published)!==Number(counts?.artist_quizzes))errors.push("published artists do not match artist quizzes");
  if(Number(counts?.published)!==Number(counts?.artist_qrs))errors.push("published artists do not match artist QR records");
  if(Number(counts?.company_quizzes)!==1)errors.push("company quiz missing");
  if(Number(counts?.company_qrs)!==1)errors.push("company QR record missing");
  return{valid:errors.length===0,counts,errors};
}

async function generateArtistProfile(env,input){
  const result=await structuredAI(env,`You are creating a positive, factual artist discovery profile. Use only the supplied official record-company artist page text. Never invent.
Return JSON with keys biography (40-90 words), genres (array), location (string or empty), officialWebsiteUrl (HTTPS URL explicitly present or empty),
heroAsset (HTTPS image URL explicitly present or empty), confidenceScore (0 to 1), evidence (array of fieldName, sourceUrl, summary, confidenceScore).
The artist is ${input.name}. Official source: ${input.sourceUrl}. Text:\n${input.pageText.slice(0,24000)}`);
  return{...result,confidenceScore:Math.min(Number(result.confidenceScore||0),1),evidence:(result.evidence||[]).map(item=>({...item,sourceUrl:input.sourceUrl,checkedAt:new Date().toISOString()}))};
}

async function generateQuiz(env,input){
  const prompt=`Create exactly five positive, intelligent, surprising multiple-choice questions about this ${input.entityType}.
Use only facts explicitly supported by the official source text. Each question must have one unambiguous answer, four unique plausible choices, a concise informative explanation,
the supplied HTTPS source URL, and confidenceScore at least 0.98 only when truly supported. Avoid negative framing, gossip, failure, generic trivia and substantial song lyrics.
Return JSON: {"title":"...","questions":[{"id":"q1","displayOrder":1,"question":"...","options":["...","...","...","..."],"correctAnswer":"...","explanation":"...","sourceUrl":"${input.sourceUrl}","evidence":"short supporting fact","confidenceScore":0.99}, ...]}.
Name: ${input.name}. Description: ${input.description||""}. Official source text:\n${input.pageText.slice(0,30000)}`;
  let quiz={id:`quiz_${hashId(`${input.entityType}:${input.name}`)}`,title:`Discover ${input.name}`,questions:[]};
  for(let attempt=0;attempt<3;attempt++){
    const response=await structuredAI(env,`${prompt}${attempt?`\nA previous draft failed the strict five-question evidence gate. Regenerate all five questions and ensure every answer is directly supported, every confidenceScore is at least 0.98, every question has four unique options, and each correct answer exactly matches one option.`:""}`);
    quiz={id:quiz.id,title:cleanText(response.title,160)||`Discover ${input.name}`,questions:(response.questions||[]).map((question,index)=>({
      id:cleanText(question.id,60)||`q${index+1}`,displayOrder:index+1,question:cleanText(question.question,220),options:(question.options||[]).map(item=>cleanText(item,140)),
      correctAnswer:cleanText(question.correctAnswer,140),explanation:cleanText(question.explanation,500),sourceUrl:input.sourceUrl,evidence:cleanText(question.evidence,500),
      confidenceScore:Number(question.confidenceScore||0)
    }))};
    if(validateQuiz(quiz))return quiz;
  }
  return quiz;
}

async function structuredAI(env,prompt){
  if(env.RECORD_COMPANY_RESEARCH_PROVIDER?.analyse)return parseStructuredAIResult(await env.RECORD_COMPANY_RESEARCH_PROVIDER.analyse(prompt));
  if(!env.AI?.run)throw new Error("The configured research provider is unavailable.");
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const output=await env.AI.run(env.RECORD_COMPANY_AI_MODEL||AI_MODEL,{messages:[
        {role:"system",content:"Return one strict JSON object only. Do not use Markdown. Facts must come only from the supplied official source."},
        {role:"user",content:prompt}
      ],response_format:{type:"json_object"},temperature:0,max_tokens:4200});
      return parseStructuredAIResult(output);
    }catch(error){
      lastError=error;
      if(attempt<2)await delay(250*(2**attempt));
    }
  }
  throw new Error(`The research provider returned invalid structured evidence after three attempts${lastError?.message?`: ${cleanText(lastError.message,180)}`:"."}`);
}

function parseStructuredAIResult(output){
  const candidate=output?.response??output?.result?.response??output;
  if(candidate&&typeof candidate==="object"&&!Array.isArray(candidate))return candidate;
  const text=String(candidate||"").trim()
    .replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();
  if(!text)throw new Error("The research provider returned an empty response.");
  try{return JSON.parse(text)}catch{}
  const start=text.indexOf("{"),end=text.lastIndexOf("}");
  if(start>=0&&end>start){
    try{return JSON.parse(text.slice(start,end+1))}catch{}
  }
  throw new Error("The research provider returned malformed JSON.");
}

async function fetchOfficial(target,root){
  if(!validHttpsUrl(target))throw new Error("Blocked or invalid URL.");
  if(root&&!sameDomain(target,root))throw new Error("Roster crawling cannot leave the official company domain.");
  if(!(await robotsAllows(target)))throw new Error("The official site robots.txt does not permit this page to be read.");
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(target,{redirect:"follow",signal:controller.signal,headers:{"user-agent":"DeepCutsDiscovery/1.0 (+https://deep-cuts.andrewharris501.workers.dev)","accept":"text/html,application/xhtml+xml"}});
      if((response.status===429||response.status>=500)&&attempt<2){await delay(300*(2**attempt));continue}
      if(!response.ok)throw new Error(`Official page returned HTTP ${response.status}.`);
      if(!String(response.headers.get("content-type")||"").includes("text/html"))throw new Error("Official URL is not an HTML page.");
      if(root&&!sameDomain(response.url,root))throw new Error("Official page redirected outside the company domain.");
      const html=(await response.text()).slice(0,750000);
      return{url:normalizeUrl(response.url),html,text:htmlToText(html)};
    }catch(error){
      lastError=error;
      if(attempt<2)await delay(300*(2**attempt));
    }finally{clearTimeout(timeout)}
  }
  throw lastError||new Error("Official page could not be read.");
}

async function validateOfficialLinks(links){
  const verified=[];
  for(const link of links){
    let status=0,finalUrl="";
    try{
      let response=await fetch(link.url,{method:"HEAD",redirect:"follow",signal:AbortSignal.timeout(8000),headers:{"user-agent":"DeepCutsLinkHealth/1.0"}});
      if(response.status===405)response=await fetch(link.url,{method:"GET",redirect:"follow",signal:AbortSignal.timeout(8000),headers:{"user-agent":"DeepCutsLinkHealth/1.0","range":"bytes=0-1024"}});
      status=response.status;finalUrl=response.url;
    }catch{}
    if(status>=200&&status<400&&destinationAllowed(link.type,finalUrl||link.url)){
      verified.push({...link,url:normalizeUrl(finalUrl||link.url),httpStatus:status,validationStatus:"verified",lastCheckedAt:new Date().toISOString()});
    }
    await delay(100);
  }
  return verified;
}

function destinationAllowed(type,value){
  if(!validHttpsUrl(value))return false;
  const url=new URL(value),path=url.pathname.replace(/\/+$/,"").toLowerCase();
  if(["facebook","instagram"].includes(type)&&(path===""||/^\/(login|accounts\/login|share|sharer)/.test(path)))return false;
  return true;
}

async function robotsAllows(target){
  const url=new URL(target),cacheKey=url.origin;
  let rules=ROBOTS_CACHE.get(cacheKey);
  if(!rules){
    try{
      const response=await fetch(`${url.origin}/robots.txt`,{redirect:"follow",signal:AbortSignal.timeout(5000),headers:{"user-agent":"DeepCutsDiscovery/1.0"}});
      rules=response.ok?await response.text():"";
    }catch{rules=""}
    ROBOTS_CACHE.set(cacheKey,rules);
  }
  return robotsAllowsPath(rules,url.pathname+url.search);
}

function robotsAllowsPath(text,path){
  if(!text)return true;
  const applicable=[];let active=false;
  for(const rawLine of String(text).split(/\r?\n/)){
    const line=rawLine.replace(/#.*$/,"").trim();
    if(!line)continue;
    const separator=line.indexOf(":");if(separator<0)continue;
    const key=line.slice(0,separator).trim().toLowerCase(),value=line.slice(separator+1).trim();
    if(key==="user-agent"){active=value==="*"||/deepcutsdiscovery/i.test(value);continue}
    if(active&&(key==="allow"||key==="disallow")&&value)applicable.push({allow:key==="allow",path:value});
  }
  const matches=applicable.filter(rule=>path.startsWith(rule.path)).sort((a,b)=>b.path.length-a.path.length);
  return matches.length?matches[0].allow:true;
}

function extractCompanyProfile(html,url){
  const domain=canonicalDomain(url),title=decodeEntities(meta(html,"og:site_name")||tagText(html,"title")||domain);
  const name=cleanCompanyName(title,domain),description=decodeEntities(meta(html,"description")||meta(html,"og:description")||"");
  const logo=absoluteUrl(meta(html,"og:logo")||findLogo(html),url),hero=absoluteUrl(meta(html,"og:image")||"",url);
  const palette=extractPalette(html);const now=new Date().toISOString();
  const evidence=[{fieldName:"identity",sourceUrl:url,summary:`Official domain ${domain} identifies ${name}.`,confidenceScore:0.99,checkedAt:now}];
  if(description)evidence.push({fieldName:"description",sourceUrl:url,summary:description.slice(0,400),confidenceScore:0.98,checkedAt:now});
  return{name,slug:safeSlug(name),canonicalDomain:domain,description,logoUrl:validHttpsUrl(logo)?logo:"",heroAsset:validHttpsUrl(hero)?hero:"",brandPalette:palette,location:"",genres:[],evidence,confidenceScore:name&&domain?0.99:0};
}

function extractArtistCandidates(html,pageUrl,rootUrl){
  const linked=extractAnchors(html,pageUrl).filter(link=>{
    if(!sameDomain(link.url,rootUrl)||link.url===pageUrl)return false;
    const name=cleanText(link.text,160),path=new URL(link.url).pathname;
    return name.length>=2&&name.length<=100&&!NON_ARTIST_TERMS.test(name)&&!/\.(jpg|png|svg|pdf|mp3|mp4)$/i.test(path)&&
      (/\/(artists?|roster|bands?|acts?|talent)\//i.test(path)||ROSTER_TERMS.test(new URL(pageUrl).pathname));
  }).map(link=>({name:link.text.trim(),url:link.url,sourceUrl:pageUrl,confidenceScore:0.99}));
  return [...linked,...extractWixPageCandidates(html,pageUrl,rootUrl)];
}
function extractWixPageCandidates(html,pageUrl,rootUrl){
  if(!sameDomain(pageUrl,rootUrl))return[];
  const candidates=[];
  const pagePattern=/"title":"((?:\\.|[^"\\])*)","pageUriSEO":"((?:\\.|[^"\\])*)"/g;
  for(const match of String(html||"").matchAll(pagePattern)){
    const name=cleanText(decodeJsonString(match[1]),160);
    const uri=decodeJsonString(match[2]).replace(/^\/+|\/+$/g,"");
    const pageKey=safeSlug(uri),nameKey=safeSlug(name);
    if(!nameKey||name.length<2||name.length>100||!pageKey)continue;
    if(WIX_NON_ARTIST_PAGES.has(pageKey)||WIX_NON_ARTIST_PAGES.has(nameKey)||NON_ARTIST_TERMS.test(name))continue;
    if(/\.(jpg|png|svg|pdf|mp3|mp4)$/i.test(uri))continue;
    const url=absoluteUrl(`/${uri}`,rootUrl);
    if(!validHttpsUrl(url)||!sameDomain(url,rootUrl)||normalizeUrl(url)===normalizeUrl(pageUrl))continue;
    candidates.push({name,url:normalizeUrl(url),sourceUrl:pageUrl,confidenceScore:0.99});
  }
  return candidates;
}
function dedupeCandidates(items){const seen=new Set();return items.filter(item=>{const key=`${safeSlug(item.name)}|${normalizeUrl(item.url)}`;if(!safeSlug(item.name)||seen.has(key))return false;seen.add(key);return true}).sort((a,b)=>a.name.localeCompare(b.name))}
function extractAnchors(html,base){
  const anchors=[];for(const match of html.matchAll(/<a\b([^>]*?)href\s*=\s*["']([^"'#]+)["']([^>]*)>([\s\S]*?)<\/a>/gi)){
    const url=absoluteUrl(match[2],base),text=htmlToText(match[4]).trim();if(validHttpsUrl(url)&&text)anchors.push({url:normalizeUrl(url),text:cleanText(text,160)});
  }return anchors;
}
function extractLinks(html,base,entityType){
  const links=[],seen=new Set();
  for(const anchor of extractAnchors(html,base)){
    let type="",label="";
    for(const rule of PLATFORM_RULES)if(rule[1].test(anchor.url)){[type,,label]=rule;break}
    if(!type&&sameDomain(anchor.url,base)){
      const combined=`${anchor.text} ${anchor.url}`;
      const internal=[["about",/\babout\b/i,"About"],["artists",/\b(artists?|roster)\b/i,"Artists"],["latest_releases",/\b(releases?|new music)\b/i,"Latest Releases"],["news",/\bnews\b/i,"News"],["events",/\b(events?|tour)\b/i,"Events"],["store",/\b(shop|store|merch)\b/i,"Store"],["contact",/\bcontact\b/i,"Contact"],["submit_music",/\bsubmit\b/i,"Submit Music"],["licensing",/\blicen[cs]/i,"Licensing"],["mailing_list",/\b(newsletter|mailing)\b/i,"Mailing List"]];
      for(const rule of internal)if(rule[1].test(combined)){[type,,label]=rule;break}
      if(entityType==="artist"&&!type&&/\b(official|website|home)\b/i.test(combined)){type="website";label="Official Website"}
    }
    if(!type||!LINK_TYPES.includes(type)||seen.has(type))continue;
    seen.add(type);links.push({type,label,url:anchor.url,sourceUrl:base,confidenceScore:0.99,validationStatus:"verified",lastCheckedAt:new Date().toISOString()});
  }return links;
}

async function saveQuiz(env,companyId,entityId,type,quiz){
  const now=new Date().toISOString();await env.DB.prepare(`INSERT INTO record_company_quizzes
    (quiz_id,record_company_id,entity_type,entity_id,title,status,quality_score,questions_json,created_at,updated_at)
    VALUES (?1,?2,?3,?4,?5,'active',?6,?7,?8,?8)
    ON CONFLICT(entity_type,entity_id) DO UPDATE SET title=excluded.title,status=excluded.status,quality_score=excluded.quality_score,questions_json=excluded.questions_json,updated_at=excluded.updated_at`)
    .bind(quiz.id,companyId,type,entityId,quiz.title,Math.min(...quiz.questions.map(question=>question.confidenceScore)),JSON.stringify(quiz.questions),now).run();
}
async function replaceLinks(env,companyId,artistId,links){
  const deleteQuery=artistId?env.DB.prepare("DELETE FROM record_company_links WHERE record_company_id=?1 AND artist_id=?2").bind(companyId,artistId):env.DB.prepare("DELETE FROM record_company_links WHERE record_company_id=?1 AND artist_id IS NULL").bind(companyId);
  await deleteQuery.run();
  for(const link of links)await env.DB.prepare(`INSERT INTO record_company_links
    (link_id,record_company_id,artist_id,link_type,label,url,source_url,confidence_score,validation_status,http_status,redirect_url,last_checked_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`).bind(`rcl_${hashId(`${companyId}:${artistId||"company"}:${link.type}:${link.url}`)}`,companyId,artistId,link.type,link.label,link.url,link.sourceUrl,link.confidenceScore,link.validationStatus,Number(link.httpStatus||0)||null,link.url,link.lastCheckedAt).run();
}
async function saveSources(env,companyId,artistId,type,entityId,evidence){
  for(const item of evidence)if(validHttpsUrl(item.sourceUrl))await env.DB.prepare(`INSERT OR REPLACE INTO record_company_sources
    (source_id,record_company_id,artist_id,entity_type,entity_id,field_name,source_url,source_title,extracted_summary,confidence_score,checked_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`).bind(`rcs_${hashId(`${entityId}:${item.fieldName}:${item.sourceUrl}`)}`,companyId,artistId,type,entityId,cleanText(item.fieldName,100),item.sourceUrl,cleanText(item.sourceTitle,200)||null,cleanText(item.summary,1000),Number(item.confidenceScore||0),validDate(item.checkedAt)).run();
}
async function upsertQr(env,companyId,type,entityId,destination){
  const tracking=`rcq_${hashId(`${companyId}:${type}:${entityId}`).slice(0,18)}`,now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO record_company_qr_codes
    (qr_id,record_company_id,entity_type,entity_id,destination_url,tracking_code,verification_status,created_at,updated_at)
    VALUES (?1,?2,?3,?4,?5,?6,'pending',?7,?7)
    ON CONFLICT(entity_type,entity_id) DO UPDATE SET destination_url=excluded.destination_url,updated_at=excluded.updated_at`)
    .bind(`qr_${hashId(`${type}:${entityId}`)}`,companyId,type,entityId,destination,tracking,now).run();
}
async function setStage(env,jobId,stage){if(!JOB_STAGES.includes(stage))throw new Error("Invalid job stage.");await env.DB.prepare("UPDATE record_company_jobs SET status=?1,current_stage=?1,updated_at=?2 WHERE job_id=?3").bind(stage,new Date().toISOString(),jobId).run()}
async function failJob(env,jobId,message){await env.DB.prepare("UPDATE record_company_jobs SET status='failed',current_stage='failed',error_summary=?1,lease_until=NULL,updated_at=?2 WHERE job_id=?3").bind(cleanText(message,800),new Date().toISOString(),jobId).run()}
async function appendException(env,jobId,exception){const row=await env.DB.prepare("SELECT exception_report_json FROM record_company_jobs WHERE job_id=?1").bind(jobId).first();const items=parseJson(row?.exception_report_json,[]);items.push({...exception,recordedAt:new Date().toISOString()});await env.DB.prepare("UPDATE record_company_jobs SET exception_report_json=?1 WHERE job_id=?2").bind(JSON.stringify(items),jobId).run()}

function extractPalette(html){const values=[...html.matchAll(/#[0-9a-f]{6}\b/gi)].map(match=>match[0].toLowerCase()).filter(hex=>contrast(hex,"#ffffff")>=3);const unique=[...new Set(values)];return{primary:unique[0]||"#172a46",secondary:unique[1]||"#0b1424",accent:unique.find(hex=>contrast(hex,"#05070b")>=4.5)||"#61a9ff",surface:"#080b12",text:"#f7f9fc"}}
function contrast(a,b){const lum=hex=>{const parts=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*parts[0]+.7152*parts[1]+.0722*parts[2]};const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function htmlToText(html){return decodeEntities(String(html||"").replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi," ").replace(/<br\s*\/?>/gi,"\n").replace(/<\/(p|li|h[1-6]|div)>/gi,"\n").replace(/<[^>]+>/g," ").replace(/[ \t]+/g," ").replace(/\n\s*\n+/g,"\n").trim())}
function meta(html,name){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");const patterns=[new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,"i"),new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,"i")];for(const pattern of patterns){const match=html.match(pattern);if(match)return match[1]}return""}
function tagText(html,tag){return html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,"i"))?.[1]?.replace(/<[^>]+>/g," ").trim()||""}
function findLogo(html){return html.match(/<img[^>]+(?:class|id)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1]||html.match(/<img[^>]+src=["']([^"']+)["'][^>]+(?:class|id)=["'][^"']*logo/i)?.[1]||""}
function cleanCompanyName(title,domain){const domainWord=domain.split(".")[0].replace(/[-_]/g," ");return cleanText(String(title||domainWord).split(/\s[|–—-]\s/)[0].replace(/\b(home|official site|website)\b/ig,"").trim(),120)}
function normalizeUrl(value){const url=new URL(value);url.hash="";if(url.pathname!=="/")url.pathname=url.pathname.replace(/\/+$/,"");return url.toString()}
function absoluteUrl(value,base){try{const url=new URL(decodeEntities(value),base);return url.protocol==="https:"?url.toString():""}catch{return""}}
function sameDomain(left,right){return canonicalDomain(left)===canonicalDomain(right)}
function uniqueSlug(name,url){const base=safeSlug(name)||"artist";return`${base}-${hashId(url).slice(0,6)}`}
function youtubeVideo(url,name){let id="";try{const parsed=new URL(url);id=parsed.hostname==="youtu.be"?parsed.pathname.slice(1):parsed.searchParams.get("v")||""}catch{}return/^[A-Za-z0-9_-]{11}$/.test(id)?{title:`${name} featured video`,embedUrl:`https://www.youtube-nocookie.com/embed/${id}`} :null}
function linkDescription(type){return({spotify:"Listen on Spotify",apple_music:"Open Apple Music",bandcamp:"Listen or buy directly",youtube:"Official video destination",instagram:"Official updates",facebook:"Official Facebook",tiktok:"Official TikTok",soundcloud:"Official SoundCloud",website:"Official website",store:"Official store",latest_releases:"Latest releases",new_music:"New music",news:"Latest label news",events:"Shows and events",contact:"Official contact",artists:"Explore the roster",about:"The label story",submit_music:"Official submission information",licensing:"Licensing information",mailing_list:"Join the mailing list"}[type]||"Official destination")}
function hashId(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}return(hash>>>0).toString(16).padStart(8,"0")}
function cleanId(value){const text=String(value||"").trim();return/^[A-Za-z0-9_-]{4,80}$/.test(text)?text:""}
function cleanSlug(value){const text=String(value||"").trim();return/^[a-z0-9-]{1,100}$/.test(text)?text:""}
function cleanText(value,max=200){return String(value||"").replace(/\s+/g," ").trim().slice(0,max)}
function validDate(value){const date=new Date(value||Date.now());return Number.isNaN(date.getTime())?new Date().toISOString():date.toISOString()}
function parseJson(value,fallback){try{return JSON.parse(value)}catch{return fallback}}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function safeSettings(body){return{refreshExisting:Boolean(body?.refreshExisting),analyticsEnabled:body?.analyticsEnabled!==false,sendCompletionEmail:body?.sendCompletionEmail!==false,preferredDeploymentTarget:cleanText(body?.preferredDeploymentTarget,80)||"deep-cuts-production",recordCompanyLogo:validHttpsUrl(body?.recordCompanyLogo)?body.recordCompanyLogo:null}}
function safeEventMetadata(value){if(!value||typeof value!=="object")return{};return Object.fromEntries(Object.entries(value).slice(0,12).map(([key,item])=>[cleanText(key,60),cleanText(item,200)]))}
function safeError(error){return cleanText(error?.message||"Record-company processing failed.",800)}
function decodeEntities(value){return String(value||"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,number)=>String.fromCharCode(Number(number)))}
function decodeJsonString(value){try{return JSON.parse(`"${value}"`)}catch{return String(value||"").replaceAll("\\/","/")}}
function authorized(request,env){return Boolean(env.ADMIN_TOKEN)&&request.headers.get("authorization")===`Bearer ${env.ADMIN_TOKEN}`}
async function safeJson(request){try{return await request.json()}catch{return null}}
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:JSON_HEADERS})}
function toCsv(rows){const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];return[columns.join(","),...rows.map(row=>columns.map(key=>`"${String(row[key]??"").replaceAll('"','""')}"`).join(","))].join("\r\n")+"\r\n"}

export const __test={
  extractCompanyProfile,extractArtistCandidates,extractWixPageCandidates,dedupeCandidates,extractLinks,extractPalette,
  normalizeUrl,sameDomain,reconciliationReport,generateQuiz,structuredAI,parseStructuredAIResult,companyEvidenceUrls,hashId,destinationAllowed,robotsAllowsPath
};
