import crypto from "node:crypto";
import fs from "node:fs/promises";
import {createVenueQrArtwork} from "./venue-qr-artwork.mjs";

export const BAR_PUBLIC_VIDEO_MAX_BYTES=24*1024*1024;
export const BAR_PUBLICATION_SCHEMA="deep-cuts-bar-publication/2";
export const DEFAULT_BAR_PUBLISHER_URL="https://deep-cuts.andrewharris501.workers.dev";

const LOCKED_CABINET_SHA="ee1f3b869c2b8e9b7ac747e33d62de20a7904b3ed6fcacf7e87bbfeec61bdfb3";
const LOCKED_COIN_SHA="3fd636fe3763b95a09bc8f6be470361ddf0a49e7772464d1a5292fa7c7674e8a";

export function publicationReadiness(venue,{videoPath="",videoSizeBytes=venue?.admin?.customVideo?.sizeBytes||0}={}){
  const errors=[],csv=venue?.csv||{},admin=venue?.admin||{},ticker=effectiveTicker(venue),about=effectiveAbout(venue);
  if(!venue?.masterId)errors.push("The venue requires its immutable Master ID.");
  if(!String(csv.venueName||"").trim())errors.push("The venue name is required.");
  if(admin.publicationState==="archived")errors.push("An archived venue cannot be published until it is returned to Draft.");
  const destinations=publicationActions(venue);
  if(destinations.length!==5)errors.push("Gigs, Menu, Contact Us, Instagram and Facebook all require complete HTTPS destinations.");
  if(!ticker)errors.push("Ticker copy is required.");else if(ticker.length>500)errors.push("The live ticker must contain no more than 500 characters.");
  if(!about)errors.push("About Us copy is required.");else if(about.length>1200)errors.push("The live About Us copy must contain no more than 1,200 characters.");
  if(!admin.customVideo)errors.push("A local MP4 welcome video is required.");
  if(!videoPath)errors.push("The stored welcome-video file could not be located.");
  if(Number(videoSizeBytes)>BAR_PUBLIC_VIDEO_MAX_BYTES)errors.push(`The live MP4 must be 24 MiB or smaller. This file is ${formatMiB(videoSizeBytes)} MiB.`);
  if(admin.customVideo&&!/^[a-f0-9]{64}$/i.test(String(admin.customVideo.sha256||"")))errors.push("The welcome video requires a valid SHA-256 identity.");
  return{ready:errors.length===0,errors,isUpdate:Boolean(admin.publicEditionUrl),videoLimitBytes:BAR_PUBLIC_VIDEO_MAX_BYTES,tickerLength:ticker.length,aboutLength:about.length,actions:destinations};
}

export async function inspectStoredVideo(venue,videoPath){
  let stat;try{stat=await fs.stat(videoPath)}catch{return publicationReadiness(venue,{videoPath:"",videoSizeBytes:0})}
  const readiness=publicationReadiness(venue,{videoPath,videoSizeBytes:stat.size});if(!readiness.ready)return readiness;
  const bytes=await fs.readFile(videoPath),digest=crypto.createHash("sha256").update(bytes).digest("hex");
  if(digest!==venue.admin.customVideo.sha256)return{...readiness,ready:false,errors:[...readiness.errors,"The stored MP4 does not match its recorded SHA-256 identity."]};
  return{...readiness,videoSizeBytes:bytes.length,videoSha256:digest};
}

export function buildPublicationManifest(venue){
  const csv=venue?.csv||{},video=venue?.admin?.customVideo||{};
  return{
    schemaVersion:BAR_PUBLICATION_SCHEMA,masterId:venue.masterId,venueName:clean(csv.venueName,120),tickerText:effectiveTicker(venue),aboutText:effectiveAbout(venue),
    address:[csv.streetAddress,csv.suburb,csv.state,csv.postcode].filter(Boolean).join(", "),actions:publicationActions(venue),
    video:{fileName:clean(video.fileName,180),sizeBytes:Number(video.sizeBytes||0),sha256:String(video.sha256||"").toLowerCase()}
  };
}

export function buildBarEditionPublication({venue,platform,videoBytes,now=new Date(),randomBytes=crypto.randomBytes}={}){
  if(!platform||!Array.isArray(platform.editions)||!/^https:\/\//.test(String(platform.publicBaseURL||"")))throw new Error("The production platform registry is invalid.");
  const video=Buffer.isBuffer(videoBytes)?videoBytes:Buffer.from(videoBytes||[]),readiness=publicationReadiness(venue,{videoPath:"stored-video.mp4",videoSizeBytes:video.length});
  if(!readiness.ready)throw publicationError(readiness.errors.join(" "),"publication_not_ready");
  const actualSha=crypto.createHash("sha256").update(video).digest("hex");if(String(venue.admin.customVideo.sha256||"")!==actualSha)throw publicationError("The stored MP4 failed its SHA-256 identity check.","video_identity_mismatch");
  const slug=stableVenueSlug(venue.masterId),existing=platform.editions.find(item=>item.slug===slug),editionId=existing?.editionId||uniqueEditionId(platform,randomBytes),canonicalPath=`/e/${editionId}`;
  if(existing&&existing.canonicalPath!==canonicalPath)throw publicationError("The existing Bar Edition has an invalid canonical route.","existing_edition_invalid");
  const timestamp=now.toISOString(),name=clean(venue.csv.venueName,120),manifest=buildPublicationManifest(venue),assetDirectory=`assets/editions/${slug}`,configPath=`editions/${slug}/edition.json`,videoPath=`${assetDirectory}/welcome.mp4`,jobId=`dcjob_${crypto.randomUUID()}`;
  const config=barEditionConfig({manifest,editionId,slug,jobId,baseUrl:String(platform.publicBaseURL).replace(/\/$/,""),videoPath,createdAt:existing?.createdAt||timestamp,updatedAt:timestamp});
  const nextPlatform=structuredClone(platform),entry={slug,editionId,canonicalPath,name,config:configPath,active:true},index=nextPlatform.editions.findIndex(item=>item.slug===slug);
  if(index>=0)nextPlatform.editions[index]={...nextPlatform.editions[index],...entry};else nextPlatform.editions.push(entry);
  const files=[{path:configPath,content:Buffer.from(`${JSON.stringify(config,null,2)}\n`)},{path:videoPath,content:video}];
  if(JSON.stringify(nextPlatform)!==JSON.stringify(platform))files.push({path:"platform.json",content:Buffer.from(`${JSON.stringify(nextPlatform,null,2)}\n`)});
  return{schemaVersion:BAR_PUBLICATION_SCHEMA,slug,editionId,canonicalPath,configPath,videoPath,isUpdate:Boolean(existing),config,platform:nextPlatform,files,liveUrl:config.publicURL,qrImageUrl:`${String(platform.publicBaseURL).replace(/\/$/,"")}/output/${encodeURIComponent(slug)}/instagram-qr.png`,jobId};
}

export function createDirectVenuePublisher({
  serviceUrl=process.env.DEEP_CUTS_PUBLISHER_URL||DEFAULT_BAR_PUBLISHER_URL,
  credentialStore=createEnvironmentCredentialStore(),fetchImpl=fetch,sleep=delay,root=process.cwd(),appVersion="3.4.0",pollMs=2500,maxPolls=300
}={}){
  const baseUrl=assertServiceUrl(serviceUrl);
  async function identity(){const installationId=await credentialStore.getInstallationId();return{installationId,token:await credentialStore.getToken()}}
  async function authentication(){
    const current=await identity();
    if(!current.token)return{available:false,activationSupported:credentialStore.activationSupported!==false,state:"not_activated",reason:"Activate secure publishing once. No GitHub account is required."};
    try{await remoteJson(fetchImpl,`${baseUrl}/api/bar-publisher/session`,{method:"GET",identity:current});return{available:true,activationSupported:true,state:"active",reason:"Automatic publishing is securely activated."}}
    catch(error){if(error.status===401){await credentialStore.clearToken();return{available:false,activationSupported:true,state:"not_activated",reason:"Secure publishing needs to be activated again."}}throw error}
  }
  async function startActivation(){
    if(credentialStore.activationSupported===false)throw publicationError("Secure activation is available in the installed Windows application.","activation_unavailable");
    const {installationId}=await identity();
    return remoteJson(fetchImpl,`${baseUrl}/api/bar-publisher/activation/start`,{method:"POST",body:{installation_id:installationId,app_version:appVersion}});
  }
  async function completeActivation(code){
    const {installationId}=await identity(),result=await remoteJson(fetchImpl,`${baseUrl}/api/bar-publisher/activation/complete`,{method:"POST",body:{installation_id:installationId,app_version:appVersion,code:String(code||"").trim()}});
    if(!/^bpub_[A-Za-z0-9_-]{43}$/.test(String(result.token||"")))throw publicationError("The publishing service returned an invalid activation credential.","activation_response_invalid");
    await credentialStore.setToken(result.token);return authentication();
  }
  async function publish({venue,videoPath,onProgress=async()=>{}}={}){
    const current=await identity();if(!current.token)throw publicationError("Activate secure publishing before publishing a venue.","publisher_activation_required");
    const inspected=await inspectStoredVideo(venue,videoPath);if(!inspected.ready)throw publicationError(inspected.errors.join(" "),"publication_not_ready");
    const manifest=buildPublicationManifest(venue);
    await onProgress("validating","Validating the isolated Bar Edition locally and in Cloudflare");
    const prepared=await remoteJson(fetchImpl,`${baseUrl}/api/bar-publisher/publications`,{method:"POST",identity:current,body:manifest});
    const remoteJob=prepared.job;if(!remoteJob?.id||!prepared.qrPayload)throw publicationError("The publishing service did not prepare an edition.","publisher_prepare_invalid");
    try{
      await onProgress("uploading","Uploading the SHA-256 verified welcome video",publicationFields(remoteJob));
      const videoBytes=await fs.readFile(videoPath);
      await remoteBytes(fetchImpl,`${baseUrl}/api/bar-publisher/publications/${remoteJob.id}/video`,{method:"PUT",identity:current,bytes:videoBytes,headers:{"content-type":"video/mp4","x-content-sha256":manifest.video.sha256}});
      await onProgress("qr","Generating and scan-testing the permanent QR artwork",publicationFields(remoteJob));
      const qr=await createVenueQrArtwork({root,venueName:manifest.venueName,destination:prepared.qrPayload});
      await remoteBytes(fetchImpl,`${baseUrl}/api/bar-publisher/publications/${remoteJob.id}/qr`,{method:"PUT",identity:current,bytes:qr.bytes,headers:{"content-type":"image/png","x-content-sha256":qr.sha256,"x-deep-cuts-qr-payload":qr.destination,"x-deep-cuts-qr-scan-proof":qr.scanProof}});
      await onProgress("publishing","Activating the validated edition and requesting completion email",publicationFields(remoteJob));
      await remoteJson(fetchImpl,`${baseUrl}/api/bar-publisher/publications/${remoteJob.id}/commit`,{method:"POST",identity:current,body:{}});
      let job=remoteJob;
      for(let attempt=0;attempt<maxPolls;attempt++){
        const status=await remoteJson(fetchImpl,`${baseUrl}/api/bar-publisher/publications/${remoteJob.id}`,{method:"GET",identity:current});job=status.job;
        if(job.status==="published")break;
        if(job.status==="failed")throw publicationError(job.error||"Automatic publication failed safely.",job.errorCode||"publication_failed");
        await onProgress("delivery","Waiting for confirmed email delivery",publicationFields(job));await sleep(pollMs);
      }
      if(job.status!=="published")throw publicationError("Email delivery was not confirmed within the secure publication window.","delivery_timeout");
      await onProgress("verifying","Verifying the live venue, MP4 and permanent QR",publicationFields(job));
      await verifyPublicEdition(fetchImpl,job,manifest.venueName);
      await onProgress("delivered","Live page, QR and completion email are confirmed",publicationFields(job));
      return{schemaVersion:BAR_PUBLICATION_SCHEMA,editionId:job.editionId,slug:job.slug,liveUrl:job.liveUrl,qrImageUrl:job.qrImageUrl,jobId:job.id,deploymentUrl:baseUrl};
    }catch(error){await remoteJson(fetchImpl,`${baseUrl}/api/bar-publisher/publications/${remoteJob.id}/rollback`,{method:"POST",identity:current,body:{}}).catch(()=>{});throw normalizeRemoteError(error)}
  }
  return{authentication,startActivation,completeActivation,publish};
}

export function createEnvironmentCredentialStore({token=process.env.DEEP_CUTS_PUBLISHER_TOKEN||"",installationId=process.env.DEEP_CUTS_PUBLISHER_INSTALLATION_ID||`studio_${crypto.randomBytes(16).toString("hex")}`}={}){
  let currentToken=token;return{activationSupported:false,getInstallationId:async()=>installationId,getToken:async()=>currentToken,setToken:async value=>{currentToken=value},clearToken:async()=>{currentToken=""}};
}

export async function verifyPublicEdition(fetchImpl,job,venueName){
  const [page,config,qr,video]=await Promise.all([
    fetchImpl(`${job.liveUrl}?publication=${encodeURIComponent(job.id)}`,{redirect:"follow",cache:"no-store"}),
    fetchImpl(`${new URL(job.liveUrl).origin}/api/bar-editions/${job.editionId}/config`,{cache:"no-store"}),
    fetchImpl(job.qrImageUrl,{headers:{accept:"image/png"},cache:"no-store"}),
    fetchImpl(`${new URL(job.liveUrl).origin}/api/bar-assets/${job.editionId}/video`,{method:"HEAD",cache:"no-store"})
  ]);
  const [html,configJson,qrBytes]=await Promise.all([page.text(),config.json().catch(()=>null),qr.arrayBuffer()]);
  const png=new Uint8Array(qrBytes);
  if(!page.ok||!html.includes("Deep Cuts"))throw publicationError("The deployed venue page did not pass live verification.","live_verification_failed");
  if(!config.ok||configJson?.editionType!=="bar_jukebox"||configJson?.bandName!==venueName)throw publicationError("The live Bar Edition configuration did not match the venue.","config_verification_failed");
  if(!qr.ok||!(qr.headers.get("content-type")||"").includes("image/png")||png.length<10000||png[0]!==0x89||png[1]!==0x50||png[2]!==0x4e||png[3]!==0x47)throw publicationError("The deployed QR artwork did not pass live verification.","qr_verification_failed");
  if(!video.ok||!(video.headers.get("content-type")||"").includes("video/mp4"))throw publicationError("The live welcome video did not pass verification.","video_verification_failed");
}

function barEditionConfig({manifest,editionId,slug,jobId,baseUrl,videoPath,createdAt,updatedAt}){const name=manifest.venueName,about=manifest.aboutText;return{
  brandName:"Bar Edition",editionType:"bar_jukebox",bandName:name,editionTitle:name,description:about.slice(0,190),discovery:{bio:about.slice(0,190),newsLabel:""},mode:"discovery",slug,publicURL:`${baseUrl}/e/${editionId}`,characterArtwork:"",backgroundArtwork:"",social:{copyright:"copyright Clearlight Creative",instagramImage:`output/${slug}/instagram-discovery.png`,qrImage:`output/${slug}/instagram-qr.png`},theme:{accent:"#55D9FF",accentSecondary:"#FF6640",gold:"#FFD66B",surface:"#091321"},links:{},analytics:{editionId,pageIdentifier:`${editionId}:bar-jukebox-v1`},production:{jobId,submittedAt:updatedAt,researchCompletedAt:updatedAt,editionCreatedAt:createdAt,updatedAt},barJookBox:{modelVersion:"bar-jukebox/1",layoutVersion:"coin-awakening/1",appearanceVariant:"atlas-reference-cabinet/1",keyBankFormat:"bar-six-key/1",contentMode:"administrator-static",webLookupAllowed:false,sourceMasterId:manifest.masterId,venueName:name,tickerText:manifest.tickerText,aboutText:about,localWelcomeVideo:videoPath,localWelcomeVideoSha256:manifest.video.sha256,actions:manifest.actions,cabinetArtwork:"assets/jookbox-atlas-reference-v1.webp",cabinetArtworkSha256:LOCKED_CABINET_SHA,coinSound:"assets/audio/jukebox-real-coin-insert-cc0.mp3",coinSoundSha256:LOCKED_COIN_SHA,coinSoundSource:"https://freesound.org/s/696745/",coinSoundLicense:"CC0-1.0",sessionStorageKey:`barJookBoxActivated:${editionId}`,tickerDurationSeconds:34,buttonLightDurationMs:1100,autoplayDelayMs:0,startupTimingsMs:{mechanism:120,neonOn:800,screenOn:1200,buttonsOn:1600,tickerOn:2000},lightSequence:true,lightSequenceMode:"single-key",coinStart:true,cabinetCopyright:"Copyright Clearlight Creative 2026.",contentStatus:"administrator-approved",venueDescription:about,address:manifest.address,supportAction:{action:"share",label:"SHARE",detail:"",kind:"share",icon:"",detailIcon:""}}
}}
function publicationActions(venue){const csv=venue?.csv||{},inputs=[["gigs","Gigs",csv.gigsUrl],["menu","Menu",csv.menuUrl],["contact","Contact Us",csv.contactUrl],["instagram","Instagram",csv.instagramUrl],["facebook","Facebook",csv.facebookUrl]];return inputs.flatMap(([id,label,value])=>{const url=safeHttps(value);return url?[{id,label,url,detail:`Open ${label}`}]:[]})}
function effectiveTicker(venue){return cleanMultiline(venue?.automated?.generatedTicker?.tickerText||venue?.admin?.tickerOverride||`${String(venue?.csv?.venueName||"").toUpperCase()} — ${[venue?.csv?.location,venue?.csv?.venueType].filter(Boolean).join(" — ").toUpperCase()}`,5000)}
function effectiveAbout(venue){const csv=venue?.csv||{},address=[csv.streetAddress,csv.suburb,csv.state,csv.postcode].filter(Boolean).join(", ");return cleanMultiline(venue?.admin?.aboutOverride||[`${csv.venueName}${csv.venueType?` is listed as a ${csv.venueType}`:""}${csv.location?` in ${csv.location}`:""}.`,address?`Address: ${address}.`:"",csv.verificationNotes].filter(Boolean).join(" "),5000)}
function stableVenueSlug(masterId){const value=String(masterId||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,28);if(!value)throw publicationError("A valid venue Master ID is required.","invalid_master_id");return`bar-${value}`}
function uniqueEditionId(platform,randomBytes){let id;do{id=`dc_${randomBytes(5).toString("hex")}`}while(platform.editions.some(item=>item.editionId===id));return id}
function safeHttps(value){try{const url=new URL(String(value||""));if(url.protocol!=="https:"||url.username||url.password||isBlockedHost(url.hostname))return"";url.hash="";return url.href}catch{return""}}
function isBlockedHost(host){const value=String(host||"").toLowerCase();return value==="localhost"||value.endsWith(".local")||value.startsWith("127.")||value.startsWith("10.")||value.startsWith("192.168.")||/^172\.(?:1[6-9]|2\d|3[01])\./.test(value)}
function assertServiceUrl(value){let url;try{url=new URL(String(value||""))}catch{throw publicationError("The automatic publishing service URL is invalid.","publisher_url_invalid")}if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/")throw publicationError("The automatic publisher requires a secure HTTPS service URL.","publisher_url_invalid");return url.origin}
async function remoteJson(fetchImpl,url,{method="GET",identity,body}={}){const response=await fetchImpl(url,{method,headers:remoteHeaders(identity,body!==undefined?{"content-type":"application/json"}:{}),body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});const result=await response.json().catch(()=>({}));if(!response.ok||result.ok===false)throw Object.assign(publicationError(result.error||`Publishing service returned ${response.status}.`,result.code||"publisher_request_failed"),{status:response.status});return result}
async function remoteBytes(fetchImpl,url,{method="PUT",identity,bytes,headers={}}={}){const response=await fetchImpl(url,{method,headers:remoteHeaders(identity,{...headers,"content-length":String(bytes.length)}),body:bytes});const result=await response.json().catch(()=>({}));if(!response.ok||result.ok===false)throw Object.assign(publicationError(result.error||`Publishing upload returned ${response.status}.`,result.code||"publisher_upload_failed"),{status:response.status});return result}
function remoteHeaders(identity,extra={}){const headers={...extra};if(identity?.token){headers.authorization=`Bearer ${identity.token}`;headers["x-deep-cuts-installation-id"]=identity.installationId}return headers}
function publicationFields(job){return{editionId:job.editionId,slug:job.slug,liveUrl:job.liveUrl,qrImageUrl:job.qrImageUrl,deploymentUrl:new URL(job.liveUrl).origin,remoteJobId:job.id}}
function normalizeRemoteError(error){if(error?.name==="BarEditionPublicationError")return error;return publicationError(error?.message||"Automatic publication failed safely.",error?.code||"publication_failed")}
function clean(value,max){return String(value||"").trim().replace(/\s+/g," ").slice(0,max)}
function cleanMultiline(value,max){return String(value||"").trim().replace(/\r\n?/g,"\n").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").slice(0,max)}
function formatMiB(value){return(Number(value||0)/1024/1024).toFixed(1)}
function publicationError(message,code){return Object.assign(new Error(message),{name:"BarEditionPublicationError",code})}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
