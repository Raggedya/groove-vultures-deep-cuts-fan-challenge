import crypto from "node:crypto";
import {
  STUDIO_JOOKBOX_RESEARCH_SCHEMA,
  researchFingerprint
} from "./studio-jookbox-research.mjs";

export const STUDIO_SCHEMA_VERSION="deep-cuts-studio-project/1";

export const PRODUCT_TYPES=Object.freeze([
  {id:"bar_jukebox",label:"Bar Edition",description:"A static venue JookBox with a local welcome video, five administrator-supplied links, About Us and one Share bar.",aggitsPolicy:"forbidden",workflow:"bar-jukebox-static",automaticResearch:false},
  {id:"jookbox",label:"JookBox Band",description:"A verified band JookBox built from a band name and artist-controlled URL.",aggitsPolicy:"forbidden",workflow:"jookbox-factory",automaticResearch:true},
  {id:"business",label:"Business",description:"Company discovery, services, story and verified customer actions.",aggitsPolicy:"required",workflow:"factory"},
  {id:"recruitment",label:"Recruitment",description:"Employer discovery, verified vacancies and candidate pathways.",aggitsPolicy:"required",workflow:"factory"},
  {id:"individual_band",label:"Individual Band",description:"A focused music-discovery edition for one verified band or artist.",aggitsPolicy:"required",workflow:"factory"},
  {id:"restaurant",label:"Restaurants",description:"Restaurant discovery using verified menus, bookings, location and story.",aggitsPolicy:"required",workflow:"factory"},
  {id:"tourist_attraction",label:"Tourist Attractions",description:"Visitor discovery using verified highlights, planning and official information.",aggitsPolicy:"required",workflow:"factory"},
  {id:"town",label:"Towns",description:"A place-discovery edition for a town, its character and verified visitor destinations.",aggitsPolicy:"required",workflow:"factory"}
]);

export const LEGACY_PRODUCT_TYPES=Object.freeze([
  {id:"music",label:"Legacy Artist / Band",description:"Existing Studio draft retained for backward compatibility.",aggitsPolicy:"required",workflow:"factory"},
  {id:"car",label:"Legacy Car / Model",description:"Existing Studio draft retained for backward compatibility.",aggitsPolicy:"required",workflow:"factory"},
  {id:"club",label:"Legacy Club",description:"Existing Studio draft retained for backward compatibility.",aggitsPolicy:"required",workflow:"factory"},
  {id:"school",label:"Legacy School Discovery",description:"Existing Studio draft retained for backward compatibility.",aggitsPolicy:"forbidden",workflow:"factory"},
  {id:"laneway",label:"Legacy Laneway Artist",description:"Existing Studio draft retained for backward compatibility.",aggitsPolicy:"forbidden",workflow:"factory"},
  {id:"indie_wheel",label:"Legacy Independent Label Wheel",description:"Existing Studio draft retained for backward compatibility.",aggitsPolicy:"forbidden",workflow:"indie-label"},
  {id:"record_company",label:"Legacy Record Company",description:"Existing Studio draft retained for backward compatibility.",aggitsPolicy:"forbidden",workflow:"record-company"}
]);

export const AGGITS_OPTIONS=Object.freeze([
  {
    id:"aggits-original",
    label:"Original Aggits",
    costume:"Black Aggits T-shirt",
    description:"The immutable approved Deep Cuts master.",
    assetPath:"/assets/aggits-original-cutout-v4.png",
    integrityProtected:true
  },
  {
    id:"hgm-owner-supplied",
    label:"HGM Aggits",
    costume:"Orange hi-vis workwear",
    description:"Owner-supplied artwork locked exclusively to High Grade Mechanical.",
    assetPath:"/assets/hgm-aggits-owner-supplied.jpg",
    integrityProtected:true,
    allowedProject:"High Grade Mechanical"
  },
  {
    id:"none",
    label:"No Aggits",
    costume:"Edition contract",
    description:"Used where the selected product contract forbids character artwork.",
    assetPath:"",
    integrityProtected:true
  }
]);

const TYPE_BY_ID=new Map([...PRODUCT_TYPES,...LEGACY_PRODUCT_TYPES].map(item=>[item.id,item]));
const AGGITS_BY_ID=new Map(AGGITS_OPTIONS.map(item=>[item.id,item]));
const TYPE_ALIASES=new Map([
  ["bar edition","bar_jukebox"],["bar jukebox","bar_jukebox"],["venue jukebox","bar_jukebox"],["venue","bar_jukebox"],
  ["jookbox","jookbox"],["jukebox","jookbox"],["jook box","jookbox"],["band jookbox","jookbox"],
  ["artist","individual_band"],["band","individual_band"],["individual band","individual_band"],["music","individual_band"],
  ["car","car"],["automotive","car"],["vehicle","car"],
  ["club","club"],["sporting club","club"],
  ["business","business"],["company","business"],
  ["recruitment","recruitment"],["jobs","recruitment"],["employment","recruitment"],
  ["restaurant","restaurant"],["restaurants","restaurant"],["dining","restaurant"],
  ["tourist attraction","tourist_attraction"],["tourist attractions","tourist_attraction"],["attraction","tourist_attraction"],["visitor attraction","tourist_attraction"],
  ["town","town"],["towns","town"],["destination town","town"],
  ["school","school"],["school discovery","school"],
  ["laneway","laneway"],["laneway artist","laneway"],
  ["label","indie_wheel"],["record label","indie_wheel"],["indie wheel","indie_wheel"],["independent label","indie_wheel"],
  ["record company","record_company"],["record company edition","record_company"]
]);

export function createProject(input={},now=new Date()){
  const id=`studio_${crypto.randomBytes(6).toString("hex")}`;
  const normalized=normalizeProjectInput(input);
  const timestamp=now.toISOString();
  return finalize({
    schemaVersion:STUDIO_SCHEMA_VERSION,
    id,
    revision:1,
    status:"preview_ready",
    createdAt:timestamp,
    updatedAt:timestamp,
    input:normalized,
    logo:null,
    mp3:null,
    mp4:null,
    research:null,
    revisionHistory:[]
  });
}

export function updateProject(project,input={},now=new Date()){
  assertProject(project);
  const normalized=normalizeProjectInput(input,project.input);
  const keepResearch=normalized.type==="jookbox"
    && project.input.type==="jookbox"
    && project.research?.inputFingerprint===researchFingerprint(normalized);
  return finalize({
    ...project,
    revision:Number(project.revision||0)+1,
    updatedAt:now.toISOString(),
    input:normalized,
    research:keepResearch?project.research:null
  });
}

export function attachJookBoxResearch(project,research,now=new Date()){
  assertProject(project);
  if(project.input.type!=="jookbox")throw new StudioValidationError("Automated JookBox research is available only for JookBox Band projects.","wrong_research_type");
  if(!research||research.schemaVersion!==STUDIO_JOOKBOX_RESEARCH_SCHEMA)throw new StudioValidationError("Studio received an unsupported JookBox research result.","invalid_research_result");
  if(research.inputFingerprint!==researchFingerprint(project.input))throw new StudioValidationError("The project changed while research was running. Run the verification again.","stale_research_result");
  return finalize({
    ...project,
    revision:Number(project.revision||0)+1,
    updatedAt:now.toISOString(),
    research
  });
}

export function attachMp3(project,{fileName,sizeBytes,sha256},now=new Date()){
  assertProject(project);
  return finalize({
    ...project,
    revision:Number(project.revision||0)+1,
    updatedAt:now.toISOString(),
    mp3:{
      fileName:clean(fileName,160),
      sizeBytes:Number(sizeBytes),
      sha256:String(sha256||""),
      uploadedAt:now.toISOString()
    }
  });
}

export function attachLogo(project,{fileName,sizeBytes,sha256,mimeType,extension},now=new Date()){
  assertProject(project);
  return finalize({
    ...project,
    revision:Number(project.revision||0)+1,
    updatedAt:now.toISOString(),
    logo:{
      fileName:clean(fileName,160),
      sizeBytes:Number(sizeBytes),
      sha256:String(sha256||""),
      mimeType:String(mimeType||""),
      extension:String(extension||""),
      uploadedAt:now.toISOString()
    }
  });
}

export function removeLogo(project,now=new Date()){
  assertProject(project);
  return finalize({
    ...project,
    revision:Number(project.revision||0)+1,
    updatedAt:now.toISOString(),
    logo:null
  });
}

export function removeMp3(project,now=new Date()){
  assertProject(project);
  return finalize({
    ...project,
    revision:Number(project.revision||0)+1,
    updatedAt:now.toISOString(),
    mp3:null
  });
}

export function applyRevision(project,instruction,now=new Date()){
  assertProject(project);
  const original=cleanMultiline(instruction,1600);
  if(!original)throw new StudioValidationError("Enter a revision before applying it.","revision_required");
  const next=structuredClone(project.input);
  const changes=[];
  const clauses=original.split(/\n+|(?<=[.!?])\s+(?=(?:change|set|replace|remove|add|use)\b)/i).map(value=>value.trim()).filter(Boolean);

  for(const clause of clauses){
    let match;
    if((match=clause.match(/^(?:change|set)\s+(?:the\s+)?(?:project\s+|version\s+)?name\s+to\s+(.+?)[.!]?$/i))){
      next.name=clean(match[1],120);changes.push(`Name changed to “${next.name}”.`);continue;
    }
    if((match=clause.match(/^(?:change|set)\s+(?:the\s+)?type\s+to\s+(.+?)[.!]?$/i))){
      const type=typeFromText(match[1]);
      if(type){next.type=type;changes.push(`Type changed to ${TYPE_BY_ID.get(type).label}.`)}
      continue;
    }
    if(/^(?:add|enable|include|use)\s+(?:the\s+|a\s+)?(?:spinning\s+)?wheel[.!]?$/i.test(clause)){
      next.addWheel=true;changes.push("Spinning wheel enabled.");continue;
    }
    if(/^(?:remove|disable|exclude|hide)\s+(?:the\s+)?(?:spinning\s+)?wheel[.!]?$/i.test(clause)){
      next.addWheel=false;changes.push("Spinning wheel disabled.");continue;
    }
    if((match=clause.match(/^(?:change|set)\s+(?:the\s+)?(?:spinning\s+)?wheel\s+(?:to\s+)?(yes|no|on|off|true|false)[.!]?$/i))){
      next.addWheel=/^(?:yes|on|true)$/i.test(match[1]);
      changes.push(`Spinning wheel ${next.addWheel?"enabled":"disabled"}.`);continue;
    }
    if(/^(?:remove|clear)\s+(?:the\s+)?youtube(?:\s+link|\s+video)?[.!]?$/i.test(clause)){
      next.youtubeUrl="";changes.push("YouTube link removed.");continue;
    }
    if((match=clause.match(/^(?:change|set|replace|use)\s+(?:the\s+)?youtube(?:\s+link|\s+video)?(?:\s+to|\s+with)?\s+(https?:\/\/\S+)[.!]?$/i))){
      next.youtubeUrl=match[1].replace(/[.,!?]+$/,"");changes.push("YouTube link updated.");continue;
    }
    if((match=clause.match(/^(?:replace|change|set)\s+(?:source\s+)?(?:url|website)\s*(1|2|3|4|5|one|two|three|four|five)\s+(?:to|with)\s+(https?:\/\/\S+)[.!]?$/i))){
      const index=wordNumber(match[1])-1;
      next.sourceUrls[index]=match[2].replace(/[.,!?]+$/,"");
      changes.push(`Source URL ${index+1} updated.`);continue;
    }
    if((match=clause.match(/^(?:change|set|replace)\s+(?:button|label)\s*(1|2|3|4|5|one|two|three|four|five)\s+(?:to|with)\s+(.+?)[.!]?$/i))){
      const index=wordNumber(match[1])-1;
      next.sourceLabels[index]=clean(match[2],42);
      changes.push(`Button ${index+1} changed to “${next.sourceLabels[index]}”.`);continue;
    }
    if((match=clause.match(/^(?:remove|clear)\s+(?:source\s+)?(?:url|website)\s*(1|2|3|4|5|one|two|three|four|five)[.!]?$/i))){
      const index=wordNumber(match[1])-1;
      next.sourceUrls.splice(index,1);
      next.sourceLabels.splice(index,1);
      changes.push(`Source URL ${index+1} removed.`);continue;
    }
    if((match=clause.match(/^(?:add|use)\s+(?:source\s+)?(?:url|website)\s+(https?:\/\/\S+)[.!]?$/i))){
      const maximum=next.type==="bar_jukebox"?5:3;
      if(next.sourceUrls.length<maximum){
        next.sourceUrls.push(match[1].replace(/[.,!?]+$/,""));
        next.sourceLabels.push("");
        changes.push(`Source URL ${next.sourceUrls.length} added.`);
      }
      continue;
    }
    if((match=clause.match(/^(?:change|set|replace)\s+(?:the\s+)?ticker(?:\s+text|\s+copy)?\s+(?:to|with)\s+([\s\S]+)$/i))){
      next.tickerText=cleanMultiline(match[1].replace(/[.!]?$/,""),500);
      changes.push("Ticker text updated.");continue;
    }
    if((match=clause.match(/^(?:change|set|replace)\s+(?:the\s+)?(?:about(?:\s+us)?|about\s+venue|venue\s+(?:description|story)|about\s+(?:text|copy))\s+(?:to|with)\s+([\s\S]+)$/i))){
      next.aboutText=cleanMultiline(match[1].replace(/[.!]?$/,""),1200);
      changes.push("About Us copy updated.");continue;
    }
    if((match=clause.match(/^(?:change|set|replace)\s+(?:the\s+)?(?:brief|description|information|copy)\s+(?:to|with)\s+([\s\S]+)$/i))){
      next.brief=cleanMultiline(match[1].replace(/[.!]?$/,""),1200);
      changes.push("Project brief updated.");continue;
    }
    if((match=clause.match(/^(?:change|set|replace)\s+(?:the\s+)?(?:poster\s+)?heading\s+(?:to|with)\s+([\s\S]+)$/i))){
      next.posterHeading=clean(match[1].replace(/[.!]?$/,""),90);
      changes.push("QR poster heading updated.");continue;
    }
  }

  const normalized=normalizeProjectInput(next,project.input);
  const entry={
    id:crypto.randomUUID(),
    instruction:original,
    applied:changes.length>0,
    changes,
    createdAt:now.toISOString()
  };
  const revised=finalize({
    ...project,
    revision:Number(project.revision||0)+1,
    updatedAt:now.toISOString(),
    input:normalized,
    revisionHistory:[entry,...(project.revisionHistory||[])].slice(0,25)
  });
  return{project:revised,entry};
}

export function normalizeProjectInput(input={},fallback={}){
  const type=TYPE_BY_ID.has(input.type)?input.type:TYPE_BY_ID.has(fallback.type)?fallback.type:"business";
  const typeConfig=TYPE_BY_ID.get(type);
  const name=clean(input.name??fallback.name,120);
  let aggitsOption=AGGITS_BY_ID.has(input.aggitsOption)?input.aggitsOption:AGGITS_BY_ID.has(fallback.aggitsOption)?fallback.aggitsOption:"aggits-original";
  if(typeConfig.aggitsPolicy==="forbidden")aggitsOption="none";
  if(typeConfig.aggitsPolicy==="required"){
    const hgmAllowed=["business","recruitment"].includes(type)&&name.toLowerCase()==="high grade mechanical"&&aggitsOption==="hgm-owner-supplied";
    if(!hgmAllowed)aggitsOption="aggits-original";
  }
  const urls=Array.isArray(input.sourceUrls)?input.sourceUrls:Array.isArray(fallback.sourceUrls)?fallback.sourceUrls:[];
  const labels=Array.isArray(input.sourceLabels)?input.sourceLabels:Array.isArray(fallback.sourceLabels)?fallback.sourceLabels:[];
  const pairs=[];
  const maximumSources=type==="bar_jukebox"?5:3;
  for(let index=0;index<urls.length&&pairs.length<maximumSources;index++){
    const url=normalizeHttpsUrl(urls[index]);
    if(!url||pairs.some(item=>item.url===url))continue;
    pairs.push({url,label:clean(labels[index],42)});
  }
  const youtubeUrl=type==="bar_jukebox"?"":normalizeYouTubeUrl(input.youtubeUrl??fallback.youtubeUrl??"");
  const addWheel=["jookbox","bar_jukebox"].includes(type)?false:booleanValue(input.addWheel??fallback.addWheel,false);
  return{
    name,
    type,
    aggitsOption,
    brief:cleanMultiline(input.brief??fallback.brief,1200),
    sourceUrls:pairs.map(item=>item.url),
    sourceLabels:pairs.map(item=>item.label),
    youtubeUrl,
    tickerText:cleanMultiline(input.tickerText??fallback.tickerText,500),
    aboutText:cleanMultiline(input.aboutText??fallback.aboutText,1200),
    posterHeading:clean(input.posterHeading??fallback.posterHeading,90),
    addWheel
  };
}

export function projectSummary(project){
  assertProject(project);
  return{
    id:project.id,
    name:project.input.name||"Untitled version",
    type:project.input.type,
    revision:project.revision,
    status:project.status,
    updatedAt:project.updatedAt
  };
}

export function readinessFor(project){
  const blockers=[];
  if(!project.input.name)blockers.push("Add a version or company name.");
  if(project.input.type==="bar_jukebox"){
    if(project.input.sourceUrls.length!==5)blockers.push("Add all five venue destinations; About Us is the fixed sixth key.");
    if(project.input.sourceLabels.length!==5||project.input.sourceLabels.some(label=>!label))blockers.push("Give each of the five venue destinations a short button label.");
    const hasReservedShareLabel=project.input.sourceLabels.some(label=>/^share$/i.test(label));
    if(hasReservedShareLabel)blockers.push("Use the long Share bar for sharing; replace the external button labelled Share.");
    if(!project.input.tickerText)blockers.push("Add the administrator-supplied scrolling ticker text.");
    if(!project.input.aboutText)blockers.push("Add the administrator-approved About Us copy.");
    if(!project.mp4)blockers.push("Select the local MP4 welcome video.");
    const handoffReady=Boolean(
      project.input.name
      &&project.input.sourceUrls.length===5
      &&project.input.sourceLabels.length===5
      &&project.input.sourceLabels.every(Boolean)
      &&!hasReservedShareLabel
      &&project.input.tickerText
      &&project.input.aboutText
      &&project.mp4
    );
    if(handoffReady)blockers.push("Export the Bar Edition handoff, then run the existing isolation, deployment and live-verification checks.");
    return{
      previewReady:Boolean(project.input.name),
      handoffReady,
      productionReady:false,
      blockers,
      nextWorkflow:TYPE_BY_ID.get(project.input.type).workflow,
      staticAdministratorContent:true,
      webLookupAllowed:false
    };
  }
  if(project.input.type==="jookbox"){
    const currentResearch=project.research?.inputFingerprint===researchFingerprint(project.input)?project.research:null;
    if(!currentResearch)blockers.push("Run the automatic identity and destination research.");
    else if(currentResearch.status==="running")blockers.push("JookBox research is still running.");
    else blockers.push(...(currentResearch.blockers||[]));
    if(currentResearch?.passed)blockers.push("Create the permanent opaque URL and scan-tested QR through the existing JookBox factory.");
    return{
      previewReady:Boolean(project.input.name),
      researchReady:Boolean(currentResearch?.passed&&currentResearch.confidence>=98),
      productionReady:false,
      blockers,
      nextWorkflow:TYPE_BY_ID.get(project.input.type).workflow,
      confidenceGate:98,
      confidence:Number(currentResearch?.confidence||0)
    };
  }
  if(project.input.sourceUrls.length===0)blockers.push("Add at least one official source URL.");
  if(!project.input.brief)blockers.push("Add a short brief so the preview has meaningful copy.");
  if(["business","recruitment","restaurant","tourist_attraction","town","laneway","indie_wheel","record_company"].includes(project.input.type)&&!project.logo)blockers.push("Add an approved official logo or confirm a text-only brand treatment.");
  if(project.input.addWheel)blockers.push("Define and verify every spinning-wheel option before publication.");
  blockers.push("Verify identity, destinations and evidence through the existing Deep Cuts production workflow.");
  if(project.input.youtubeUrl)blockers.push("Verify ownership, relevance and embeddability of the YouTube video.");
  if(project.mp3)blockers.push("Confirm permission to use the supplied MP3 before publication.");
  return{
    previewReady:Boolean(project.input.name&&project.input.sourceUrls.length),
    productionReady:false,
    blockers,
    nextWorkflow:TYPE_BY_ID.get(project.input.type).workflow,
    confidenceGate:98
  };
}

export function renderStudioPreview(project,{audioUrl="",logoUrl="",videoUrl="",scriptNonce=""}={}){
  assertProject(project);
  if(project.input.type==="bar_jukebox")return renderBarJookBoxStudioPreview(project,{videoUrl,scriptNonce});
  if(project.input.type==="jookbox")return renderJookBoxStudioPreview(project,{scriptNonce});
  const input=project.input;
  const type=TYPE_BY_ID.get(input.type);
  const aggits=AGGITS_BY_ID.get(input.aggitsOption);
  const videoId=youtubeId(input.youtubeUrl);
  const links=input.sourceUrls.map((url,index)=>`<a class="preview-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer"><span class="preview-diamond"><i></i></span><span class="preview-link-copy"><strong>${escapeHtml(input.sourceLabels[index]||linkLabel(url,index))}</strong><small>${escapeHtml(displayHost(url))}</small></span><b aria-hidden="true">&gt;</b></a>`).join("");
  const logo=project.logo&&logoUrl?`<img class="preview-logo" src="${escapeAttribute(logoUrl)}" alt="${escapeAttribute(input.name||"Project")} logo">`:`<div class="preview-wordmark">${escapeHtml(input.name||"DEEP CUTS")}</div>`;
  const showStandaloneAggits=Boolean(aggits?.assetPath&&!["business"].includes(input.type));
  const artwork=showStandaloneAggits?`<img class="preview-aggits" src="${escapeAttribute(aggits.assetPath)}" alt="Aggits presenting ${escapeAttribute(input.name||"this Deep Cuts version")}">`:"";
  const video=videoId?`<section class="preview-video"><div class="preview-kicker">FEATURED VIDEO</div><div class="preview-video-frame"><iframe title="YouTube video for ${escapeAttribute(input.name||"this project")}" src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></section>`:"";
  const audio=project.mp3&&audioUrl?`<section class="preview-audio"><div class="preview-kicker">SUPPLIED AUDIO</div><audio controls preload="metadata" src="${escapeAttribute(audioUrl)}"></audio><small>${escapeHtml(project.mp3.fileName)}</small></section>`:"";
  const wheel=input.addWheel?`<section class="preview-wheel" aria-label="Optional spinning wheel preview"><div class="preview-kicker">OPTIONAL DISCOVERY WHEEL</div><div class="wheel-pointer" aria-hidden="true"></div><div class="wheel-disc" aria-hidden="true"><span>SPIN</span></div><strong>SPIN TO EXPLORE</strong><small>Final wheel options are added and verified during production.</small></section>`:"";
  const brief=input.brief||"Add a short project brief in Studio to shape this introduction.";
  return`<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#020b18">
  <title>${escapeHtml(input.name||"Deep Cuts Studio Preview")}</title>
  <style>
    :root{color-scheme:dark;--ink:#f4f8fc;--muted:#93a9bf;--blue:#28a9f1;--cyan:#92ddff;--panel:#07182b;--line:rgba(116,190,238,.33)}
    *{box-sizing:border-box}html{background:#020812}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 8%,#0c2947 0,#051425 34%,#020812 78%);color:var(--ink);font-family:Arial,Helvetica,sans-serif}
    main{width:min(100%,430px);margin:auto;padding:20px 24px 42px;text-align:center}.preview-mark{display:flex;justify-content:space-between;align-items:center;color:#7ca5c7;font-size:9px;font-weight:900;letter-spacing:.18em}.draft{border:1px solid rgba(146,221,255,.38);border-radius:999px;padding:5px 8px;color:var(--cyan)}
    .preview-logo{display:block;width:min(82%,330px);max-height:112px;object-fit:contain;margin:24px auto 15px}.preview-wordmark{margin:28px auto 16px;color:white;font-size:clamp(28px,10vw,44px);font-weight:950;font-style:italic;letter-spacing:-.05em;text-transform:uppercase}.preview-aggits{display:block;width:min(72%,280px);max-height:390px;object-fit:contain;margin:3px auto -30px;filter:drop-shadow(0 22px 32px rgba(0,0,0,.52))}.preview-type{margin:17px 0 8px;color:#f29a62;font-size:10px;font-weight:900;letter-spacing:.22em;text-transform:uppercase}
    h1{margin:0;font-size:clamp(28px,9vw,44px);line-height:.95;letter-spacing:-.045em;text-transform:uppercase}p{margin:14px auto 12px;color:#c6d5e2;font-size:14px;line-height:1.55}
    .wave{height:34px;margin:10px 0 16px;background:repeating-linear-gradient(90deg,transparent 0 4px,rgba(99,194,250,.68) 4px 6px,transparent 6px 10px);mask:linear-gradient(transparent 12%,#000 38% 62%,transparent 88%);animation:wave 8s ease-in-out infinite}
    @keyframes wave{0%,100%{opacity:.45;transform:scaleY(.55)}8%{opacity:1;transform:scaleY(1)}}.preview-links{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.preview-link{min-height:88px;display:grid;grid-template-columns:30px 1fr 13px;align-items:center;border:1px solid rgba(115,165,210,.42);border-radius:17px;background:linear-gradient(145deg,rgba(24,48,77,.98),rgba(8,22,40,.98));color:white;text-decoration:none;text-align:center;box-shadow:inset 0 1px rgba(255,255,255,.05),0 14px 30px rgba(0,0,0,.2)}
    .preview-link:last-child:nth-child(odd){grid-column:1/-1}.preview-diamond{width:17px;height:17px;display:grid;place-items:center;margin-left:8px;border:2px solid #d7e7f2;border-radius:3px;transform:rotate(45deg)}.preview-diamond i{width:7px;height:7px;border-radius:1px;background:#f37635}.preview-link-copy{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}.preview-link strong{font-size:12px;line-height:1.08;text-transform:uppercase}.preview-link small{color:#8ea6bb;font-size:9px;line-height:1.15}.preview-link b{color:#f28a4d;font-size:18px}.preview-video,.preview-audio{margin:20px 0;padding:12px;border:1px solid var(--line);border-radius:18px;background:#061427;text-align:left}.preview-kicker{padding:2px 2px 10px;color:#f29a62;font-size:9px;font-weight:900;letter-spacing:.19em}
    .preview-video-frame{position:relative;padding-top:56.25%;overflow:hidden;border-radius:11px;background:#000}.preview-video-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.preview-audio audio{width:100%;height:42px}.preview-audio small{display:block;padding:8px 3px 0;color:var(--muted);overflow-wrap:anywhere}
    .preview-wheel{position:relative;margin:20px 0;padding:13px 14px 18px;border:1px solid var(--line);border-radius:18px;background:#061427;text-align:center}.preview-wheel .preview-kicker{text-align:left}.wheel-pointer{position:absolute;z-index:2;top:49px;left:50%;width:0;height:0;transform:translateX(-50%);border-left:12px solid transparent;border-right:12px solid transparent;border-top:24px solid #f37635;filter:drop-shadow(0 0 7px rgba(243,118,53,.7))}.wheel-disc{width:190px;height:190px;display:grid;place-items:center;margin:18px auto 12px;border:3px solid #d8eefb;border-radius:50%;background:repeating-conic-gradient(#122c45 0 22.5deg,#07111e 22.5deg 45deg);box-shadow:0 12px 30px rgba(0,0,0,.45),0 0 20px rgba(40,169,241,.16)}.wheel-disc span{width:70px;height:70px;display:grid;place-items:center;border:3px solid #d8eefb;border-radius:50%;background:#030a12;color:white;font-size:16px;font-weight:900;box-shadow:0 0 0 5px rgba(243,118,53,.65)}.preview-wheel>strong{display:block;font-size:14px;letter-spacing:.08em}.preview-wheel>small{display:block;margin-top:5px;color:var(--muted);font-size:9px;line-height:1.4}
    .verify-note{margin-top:20px;padding:12px;border-top:1px solid rgba(146,221,255,.2);border-bottom:1px solid rgba(146,221,255,.2);color:#7893aa;font-size:9px;font-weight:800;letter-spacing:.09em;line-height:1.55;text-transform:uppercase}
    footer{padding:34px 0 0;color:#6d8da8;font-size:10px;line-height:1.8;letter-spacing:.08em}footer strong{color:#91b8d8;letter-spacing:.14em}
    @media(prefers-reduced-motion:reduce){.wave{animation:none;transform:none;opacity:.7}}
  </style>
</head>
<body>
  <main>
    <div class="preview-mark"><span>DEEP CUTS STUDIO</span><span class="draft">DRAFT PREVIEW</span></div>
    ${logo}
    ${artwork}
    <div class="preview-type">${escapeHtml(type.label)}</div>
    <h1>${escapeHtml(input.name||"Untitled version")}</h1>
    <p>${escapeHtml(brief)}</p>
    <div class="wave" aria-hidden="true"></div>
    ${wheel}
    ${video}
    ${audio}
    <nav class="preview-links" aria-label="Supplied source links">${links||'<div class="verify-note">Add up to three official source URLs in Studio.</div>'}</nav>
    <div class="verify-note">Studio preview only · every public destination requires identity and evidence verification</div>
    <footer aria-label="Deep Cuts platform"><strong>Deep Cuts</strong><br>Copyright Clearlight Creative</footer>
  </main>
</body>
</html>`;
}

function renderBarJookBoxStudioIcon(label){
  const identity=String(label||"").toLowerCase();
  const type=/instagram/.test(identity)?"instagram":/facebook/.test(identity)?"facebook":/contact|phone/.test(identity)?"contact":/menu|drink|food/.test(identity)?"menu":/gig|show|event/.test(identity)?"gigs":/about|information/.test(identity)?"about":"ornament";
  const paths={
    gigs:'<path d="M10 9c24-3 42 3 58 18L51 43C41 32 29 27 10 28Z"/><path d="M58 37c7 3 11 8 11 15M65 51H41v17h37V51h-9M34 68h51M29 74h61"/><circle cx="57" cy="49" r="5"/><path d="M16 16h31M16 22h23"/>',
    menu:'<path d="M7 43c13 0 17-8 21-19 5 4 8 9 10 16 3-10 8-17 12-23 4 6 9 13 12 23 2-7 5-12 10-16 4 11 8 19 21 19-13 0-17 8-21 19-5-4-8-9-10-16-3 10-8 17-12 23-4-6-9-13-12-23-2 7-5 12-10 16C24 51 20 43 7 43Z"/><path d="M18 43h64M31 32c5 4 8 7 9 11-1 4-4 7-9 11M69 32c-5 4-8 7-9 11 1 4 4 7 9 11"/><circle cx="50" cy="43" r="4"/>',
    contact:'<path d="M15 30c0-15 13-23 35-23s35 8 35 23v7H68V27H32v10H15Z"/><path d="M25 40h50l10 12v23H15V52Z"/><circle cx="50" cy="58" r="13"/><circle cx="50" cy="58" r="5"/><path d="M50 45v5M50 66v5M37 58h5M58 58h5M41 49l4 4M55 63l4 4M59 49l-4 4M45 63l-4 4"/>',
    instagram:'<rect x="12" y="5" width="76" height="76" rx="20"/><circle cx="50" cy="43" r="19"/><circle cx="74" cy="19" r="4" class="fill"/>',
    facebook:'<path class="fill" d="M57 81V49h12l2-14H57v-9c0-6 3-10 11-10h7V4c-4-1-10-2-16-2-15 0-25 9-25 26v7H21v14h13v32Z"/>',
    about:'<circle cx="50" cy="43" r="36"/><path d="M50 37v29"/><circle cx="50" cy="24" r="4" class="fill"/>',
    ornament:'<path d="M7 43c14-2 23-10 29-30 5 9 9 16 14 30 5-14 9-21 14-30 6 20 15 28 29 30-14 2-23 10-29 30-5-9-9-16-14-30-5 14-9 21-14 30C30 53 21 45 7 43Z"/>'
  };
  return`<svg class="key-icon key-icon-${type}" viewBox="0 0 100 86" aria-hidden="true"><g>${paths[type]}</g></svg>`;
}

function renderBarStudioShareHand(side){
  return`<svg class="share-hand share-hand-${side}" viewBox="0 0 190 80" aria-hidden="true"><path class="share-hand-ink" d="M5 18H39V62H5ZM39 24h13c8 0 14 2 21 7l15 11h19L94 29c-6-6-5-14 1-18 6-4 13-2 19 4l24 26h37c7 0 11 4 11 10s-4 10-11 10h-50l-20 8c-10 4-20 4-31 0L52 60H39Z"/><path class="share-hand-detail" d="M12 26h20M12 34h20M12 42h20M12 50h20M12 58h20M55 35l12 9M56 59l14 6M107 42l18 19M128 42l-9 19M145 42l-5 19"/></svg>`;
}

function renderBarJookBoxStudioPreview(project,{videoUrl="",scriptNonce=""}={}){
  const input=project.input;
  const ticker=input.tickerText||"ADD THE VENUE TICKER TEXT IN DEEP CUTS STUDIO.";
  const aboutText=input.aboutText||"Add administrator-approved About Us copy in Studio, including the verified venue location, what visitors can expect and an optional approved review excerpt.";
  const aboutParagraphs=aboutText.split(/\n+/).map(value=>value.trim()).filter(Boolean).map(paragraph=>`<p>${escapeHtml(paragraph)}</p>`).join("");
  const supplied=input.sourceUrls.map((url,index)=>({
    url,
    label:input.sourceLabels[index]||`BUTTON ${index+1}`
  })).slice(0,5);
  const keys=Array.from({length:5},(_,index)=>{
    const item=supplied[index];
    const identity=String(item?.label||"").toLowerCase();
    return item
      ?`<a class="key" href="${escapeAttribute(item.url)}" target="_blank" rel="noopener noreferrer" aria-disabled="true" tabindex="-1"><span class="key-icon-frame">${renderBarJookBoxStudioIcon(item.label)}</span><strong>${escapeHtml(item.label)}</strong></a>`
      :`<span class="key is-placeholder" aria-hidden="true"><strong>BUTTON ${index+1}</strong></span>`;
  });
  keys.push(`<button id="aboutKey" class="key is-about" type="button" aria-disabled="true" disabled><span class="key-icon-frame">${renderBarJookBoxStudioIcon("About Us")}</span><strong>ABOUT US</strong></button>`);
  const video=project.mp4&&videoUrl
    ?`<video id="welcomeVideo" controls playsinline webkit-playsinline preload="auto" src="${escapeAttribute(videoUrl)}"></video>`
    :`<div class="video-wait"><strong>LOCAL MP4 REQUIRED</strong><span>Select the venue welcome video in Studio.</span></div>`;
  const sessionKey=`deepCutsStudioBarActivated:${project.id}`;
  return`<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#120705">
  <title>${escapeHtml(input.name||"Bar Edition")} Studio Preview</title>
  <style>
    *{box-sizing:border-box}[hidden]{display:none!important}html{background:#050201}body{margin:0;min-height:100vh;background:#050201;color:#fff;font-family:Arial,Helvetica,sans-serif}
    button,a{font:inherit}main{width:100%;max-width:430px;margin:auto;padding:0 0 34px}.draft-bar{display:flex;justify-content:space-between;gap:12px;padding:9px 13px;background:#0b0705;color:#d7a654;font-size:8px;font-weight:900;letter-spacing:.13em}.draft-bar b{color:${project.readiness.handoffReady?"#9ff1bd":"#ffd37b"}}
    .machine{position:relative;width:100%;aspect-ratio:948/1659;overflow:hidden;background:url("/assets/jookbox-bar-heritage-brass-v1.png") center/100% 100% no-repeat;filter:brightness(.38) saturate(.48);transition:filter .48s ease}
    .machine:after{position:absolute;z-index:1;inset:0;content:"";pointer-events:none;background:radial-gradient(ellipse 72% 12% at 50% 5%,rgba(255,210,116,.2),transparent 76%),linear-gradient(90deg,rgba(132,22,12,.12),transparent 13% 87%,rgba(132,22,12,.12));mix-blend-mode:screen;opacity:0}
    .machine.is-powering:after{animation:neonFlicker .52s steps(1,end) .16s both}.machine.is-neon-on{filter:brightness(.88) saturate(.9)}.machine.is-neon-on:after{opacity:.58}.machine.is-awake{filter:none}
    .title{position:absolute;z-index:3;top:6.15%;left:6%;width:88%;height:12.7%;overflow:visible;color:#d8b36c;filter:brightness(.82) saturate(.78);transition:filter .45s}.machine.is-neon-on .title{filter:brightness(1.04) saturate(.92)}.title h1{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}.title svg{display:block;width:100%;height:100%;overflow:visible}.title-curve{fill:#d7b77b;stroke:rgba(45,23,9,.76);stroke-width:1.15;paint-order:stroke fill;font:800 82px/1 Georgia,serif;letter-spacing:.04em;filter:drop-shadow(0 2px 0 #271206) drop-shadow(0 0 3px rgba(255,225,164,.3))}.title-model{fill:#d4b272;stroke:rgba(45,23,9,.68);stroke-width:.7;paint-order:stroke fill;font:800 26px/1 Georgia,serif;letter-spacing:5.5px;filter:drop-shadow(0 1px 0 #2b1508)}.title-ornament{fill:none;stroke:#aa8049;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;opacity:.86;filter:drop-shadow(0 1px 0 #251006)}
    .ticker{position:absolute;z-index:3;top:20.25%;left:13.1%;width:74.5%;height:8.35%;display:flex;align-items:center;overflow:hidden;border:0;background:transparent;box-shadow:none;filter:brightness(.25);transition:filter .35s}
    .ticker span{display:block;width:max-content;padding-left:100%;color:#ffe36f;font:900 clamp(13px,3.55vw,18px)/1 "Courier New",monospace;letter-spacing:.015em;text-shadow:0 0 2px #fff8bd,0 0 7px #ffc53f,0 0 13px rgba(255,190,45,.92);white-space:nowrap;animation:ticker 31s linear infinite;animation-play-state:paused}.machine.is-ticker-on .ticker{filter:brightness(1.3) saturate(1.08)}.machine.is-ticker-on .ticker span{animation-play-state:running}
    .coin-console{position:absolute;z-index:5;top:29.75%;left:12.05%;width:16.75%;height:35.55%;display:grid;place-items:center;border:0;background:transparent;box-shadow:none;transition:filter .3s}.coin-button{position:relative;width:100%;height:100%;padding:0;border:0;background:transparent;color:#d9b46c;cursor:grab;touch-action:none}.coin-button:focus-visible{outline:3px solid #fff0a0;outline-offset:-5px}.coin-button:active{cursor:grabbing}.coin-slot{display:none}.coin{position:absolute;top:78%;left:50%;display:grid;width:57%;aspect-ratio:1;place-items:center;border:2px solid #d8b36a;border-radius:50%;color:#2e190a;background:radial-gradient(circle at 34% 26%,#e7ce8c,#b68038 48%,#654017 76%,#251308);box-shadow:0 2px 6px rgba(0,0,0,.8),0 0 7px rgba(218,171,83,.25);transform:translate(-50%,-50%) rotate(5deg);animation:coinAttention 2.65s ease-in-out infinite;will-change:transform}.coin b{font-family:Georgia,serif;font-size:clamp(9px,2.5vw,13px)}.coin-label{position:absolute;left:8%;right:8%;top:5.5%;font:800 clamp(7px,1.95vw,10px)/1.4 Georgia,serif;letter-spacing:.055em;text-align:center;text-transform:uppercase}.machine.is-accepting .coin{animation:coinInsert .58s cubic-bezier(.34,.02,.75,.34) forwards}.machine.is-awake .coin{animation:none!important;opacity:0;filter:none;box-shadow:none}.machine.is-awake .coin-button{animation:none!important;text-shadow:none}
    .screen{position:absolute;z-index:3;top:29.75%;left:31.1%;width:57.5%;height:35.55%;padding:0;overflow:hidden;border:0;border-radius:5px;background:transparent;box-shadow:none}.screen:after{position:absolute;z-index:4;inset:0;content:"";pointer-events:none;background:#010101;opacity:.84;transition:opacity .42s}.machine.is-screen-on .screen:after{opacity:0}.screen video{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 50%;background:transparent;pointer-events:none;filter:brightness(.28) saturate(.42);transition:filter .42s}.machine.is-screen-on .screen video{pointer-events:auto;filter:none}.video-wait{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px;color:#b99558;text-align:center}.video-wait strong{font-size:12px;letter-spacing:.08em}.video-wait span{max-width:230px;margin-top:7px;color:#806c52;font-size:8px;line-height:1.4}
    .keys{position:absolute;z-index:4;top:66.15%;left:11.85%;width:76.85%;height:21.05%;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:4.35% 2.15%}.key{position:relative;isolation:isolate;min-width:0;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;align-items:stretch;justify-items:stretch;row-gap:2.5%;padding:7% 5.5% 7.5%;overflow:hidden;border:0;border-radius:4%;background:transparent;color:#2b180c;text-decoration:none;text-align:center;box-shadow:none;filter:brightness(.3) saturate(.34);opacity:.34;pointer-events:none;transition:filter .42s,opacity .42s,transform .1s}.key:before{content:"";position:absolute;z-index:0;inset:6.5% 5.5% 8%;border-radius:3%;pointer-events:none;opacity:0;background:radial-gradient(ellipse 88% 82% at 50% 42%,rgba(255,253,226,.84),rgba(255,226,158,.45) 54%,rgba(185,102,38,.12) 79%,transparent 82%);box-shadow:inset 0 2px 4px rgba(255,255,239,.7),inset 0 0 16px rgba(255,236,181,.74),inset 0 -7px 11px rgba(126,61,21,.2);transition:opacity .42s ease}.key-icon-frame{position:relative;z-index:1;grid-column:1;grid-row:1;display:grid;width:100%;height:100%;min-height:0;place-items:center}.key-icon{width:min(56%,54px);height:60%;max-width:100%;overflow:visible;color:inherit;filter:drop-shadow(0 1px 0 rgba(255,235,188,.34))}.key-icon g{fill:none;stroke:currentColor;stroke-width:3.6;stroke-linecap:round;stroke-linejoin:round}.key-icon .fill{fill:currentColor;stroke:none}.key strong{position:relative;z-index:1;grid-column:1;grid-row:2;display:grid;min-height:1.72em;place-items:center;font:800 clamp(9px,2.35vw,12px)/.88 Georgia,serif;letter-spacing:.005em;overflow-wrap:normal;word-break:normal;text-wrap:balance;text-transform:uppercase}.key.is-placeholder{opacity:.18}.machine.is-buttons-on .key:not(.is-placeholder){color:#2a180c;filter:brightness(.98) saturate(.84);opacity:1;pointer-events:auto}.machine.is-buttons-on .key.is-current{color:#211108;background:transparent;filter:brightness(1.08) saturate(.88);box-shadow:none;animation:none}.machine.is-buttons-on .key.is-current:before{opacity:.95;animation:keyFaceGlow 1100ms ease-in-out both}.machine.is-buttons-on .key:focus-visible{outline:2px solid #fff1bd;outline-offset:-3px}.machine.is-buttons-on .key:active{transform:translateY(2px)}
    @keyframes keyFaceGlow{0%,100%{opacity:.55}45%,62%{opacity:1}}
    .support{position:absolute;z-index:4;top:87.7%;left:12.05%;width:76.55%;height:7.75%;display:grid;place-content:center;padding:1% 19%;overflow:hidden;border:0;border-radius:2%;background:linear-gradient(180deg,rgba(255,240,199,.018),rgba(103,54,21,.025));color:#28160b;font:inherit;text-align:center;box-shadow:inset 0 1px rgba(255,245,215,.045),inset 0 -3px rgba(50,24,8,.045);filter:brightness(.28) saturate(.38);opacity:.48;pointer-events:none;transition:filter .3s,opacity .3s,box-shadow .3s,transform .1s}.share-hand{position:absolute;top:50%;display:block;width:18.5%;height:auto;overflow:visible;fill:none;stroke:#29170b;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px rgba(255,239,193,.28));transform-origin:50% 50%}.share-hand .share-hand-ink{fill:rgba(90,51,24,.1);stroke:#29170b;stroke-width:5;stroke-linejoin:round}.share-hand .share-hand-detail{fill:none;stroke:#29170b;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}.share-hand-left{left:2.5%;transform:translateY(-50%)}.share-hand-right{right:2.5%;transform:translateY(-50%) scaleX(-1)}.support strong{display:grid;gap:0;place-items:center;color:#28160b;font:800 clamp(11px,3.2vw,15px)/.86 Georgia,serif;letter-spacing:.015em;text-transform:uppercase;text-wrap:balance}.support strong span:last-child{display:flex;width:100%;align-items:center;justify-content:center;gap:4%;font-size:.72em;line-height:.92;letter-spacing:.045em;white-space:nowrap}.support strong span:last-child:before,.support strong span:last-child:after{width:12%;height:1px;content:"";background:linear-gradient(90deg,transparent,#5e3518)}.support strong span:last-child:after{background:linear-gradient(90deg,#5e3518,transparent)}.machine.is-buttons-on .support{filter:brightness(.98) saturate(.78);opacity:1;pointer-events:auto;cursor:pointer;box-shadow:inset 0 0 14px rgba(255,235,185,.13),inset 0 -3px rgba(66,31,9,.08)}.machine.is-buttons-on .support:focus-visible{outline:2px solid #fff0b0;outline-offset:-4px;filter:brightness(1.08)}.machine.is-buttons-on .support:active{transform:translateY(2px)}
    .support strong .share-word:only-child{display:block;font-size:1.16em;line-height:1;letter-spacing:.08em;white-space:nowrap}.support strong .share-word:only-child:before,.support strong .share-word:only-child:after{content:none}.status{display:none}.copyright{position:absolute;z-index:4;top:96.05%;left:31%;display:grid;width:38%;height:2.7%;padding:0 2%;place-items:center;overflow:hidden;border:1px solid #633919;border-radius:5%;color:#2c180c;background:linear-gradient(145deg,#c69d58,#87602f 48%,#c29a56);box-shadow:inset 0 1px rgba(255,238,184,.45),inset 0 -2px 5px rgba(55,27,7,.38),0 2px 5px rgba(0,0,0,.76);font:700 clamp(6px,1.45vw,9px)/1.05 Georgia,serif;letter-spacing:.025em;text-align:center}
    .gate{padding:16px 20px 5px;color:#aa8b6c;text-align:center;font-size:9px;line-height:1.5;letter-spacing:.06em;text-transform:uppercase}.gate strong{display:block;margin-bottom:5px;color:${project.readiness.handoffReady?"#9ff1bd":"#ffd37b"};font-size:11px}
    .about-screen{width:100%;min-height:calc(100vh - 36px);padding:18px 16px 30px;background:radial-gradient(circle at 50% 0,rgba(125,47,17,.2),transparent 38%),linear-gradient(#080302,#030101)}.about-back{width:100%;min-height:48px;padding:11px 15px;border:1px solid #76583a;border-radius:8px;background:linear-gradient(#23150e,#0a0604);color:#ffe4ac;font-weight:900;letter-spacing:.05em;text-align:left;box-shadow:inset 0 1px rgba(255,255,255,.08),0 8px 20px rgba(0,0,0,.28)}.about-back:focus-visible{outline:3px solid #fff0a0;outline-offset:3px}.about-card{margin-top:16px;padding:24px 20px 26px;border:1px solid #8e6638;border-radius:12px;background:linear-gradient(145deg,rgba(39,20,13,.98),rgba(8,4,3,.99));box-shadow:inset 0 1px rgba(255,244,204,.1),inset 0 0 28px rgba(0,0,0,.72),0 18px 35px rgba(0,0,0,.38)}.about-kicker{margin:0 0 9px;color:#e2ad59;font-size:9px;font-weight:900;letter-spacing:.2em;text-transform:uppercase}.about-card h1{margin:0;color:#fff0bd;font:900 clamp(27px,8vw,39px)/.98 Georgia,serif;letter-spacing:.05em;text-shadow:0 0 12px rgba(255,169,54,.35);text-transform:uppercase}.about-copy{margin-top:19px;padding-top:17px;border-top:1px solid rgba(222,168,84,.3)}.about-copy p{margin:0 0 14px;color:#eadfce;font-size:15px;line-height:1.65}.about-copy p:last-child{margin-bottom:0}
    footer{padding:22px 0 0;color:#806b5d;font-size:9px;line-height:1.8;letter-spacing:.08em;text-align:center}footer strong{color:#b89a7d;letter-spacing:.15em}
    @keyframes coinAttention{0%,58%,100%{filter:brightness(.65);box-shadow:0 3px 7px #000,0 0 5px rgba(255,207,76,.22)}74%{filter:brightness(1.12);box-shadow:0 3px 7px #000,0 0 16px rgba(255,207,76,.72)}}@keyframes coinInsert{0%{transform:translate(-50%,-50%) rotate(5deg);opacity:1}58%{transform:translate(-50%,-145%) rotate(12deg) scale(.84);opacity:1}100%{transform:translate(-50%,-235%) rotate(18deg) scale(.58);opacity:0}}@keyframes neonFlicker{0%{opacity:0}18%{opacity:.88}31%{opacity:.08}49%{opacity:.62}63%{opacity:.16}79%{opacity:.94}100%{opacity:.8}}@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-100%)}}@keyframes keyGlow{0%,100%{filter:brightness(1.02) saturate(.79);box-shadow:inset 0 0 11px rgba(255,246,205,.32),0 0 3px rgba(255,199,91,.16)}38%,68%{filter:brightness(1.14) saturate(.84);box-shadow:inset 0 0 19px rgba(255,252,224,.59),0 0 8px rgba(255,207,104,.31)}}
    @media(max-width:340px){.key-icon{width:min(48%,44px);height:50%}}
    @media(prefers-reduced-motion:reduce){.coin{animation:none}.machine.is-powering:after{animation:none}.ticker span{width:100%;padding:0 4%;overflow:hidden;text-overflow:ellipsis;animation:none}.machine.is-ticker-on .ticker span{animation:none}.key{transition:none}.machine.is-buttons-on .key:not(.is-placeholder),.machine.is-buttons-on .key.is-current{background:radial-gradient(ellipse at 50% 42%,rgba(255,242,196,.12),rgba(255,220,145,.035) 65%,transparent 82%);box-shadow:inset 0 0 10px rgba(255,242,198,.2);filter:brightness(.98) saturate(.8);animation:none}}
  </style>
</head>
<body>
  <main>
    <div class="draft-bar"><span>DEEP CUTS STUDIO · BAR EDITION</span><b>${project.readiness.handoffReady?"HANDOFF READY":"DRAFT"}</b></div>
    <section id="machine" class="machine" aria-label="${escapeAttribute(input.name||"Venue")} Bar Edition preview">
      <div class="title">
        <h1>${escapeHtml(input.name||"VENUE NAME")}</h1>
        <svg viewBox="0 0 720 222" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs><path id="studioBarTitlePath" d="M48 148Q360 43 672 148"/></defs>
          <text class="title-curve"><textPath id="barTitle" href="#studioBarTitlePath" startOffset="50%" text-anchor="middle">${escapeHtml((input.name||"VENUE NAME").toUpperCase())}</textPath></text>
          <g class="title-ornament"><path d="M132 171H255M465 171H588"/><path d="M255 171c14 0 18-12 28-12 9 0 12 12 23 12-11 0-14 12-23 12-10 0-14-12-28-12ZM465 171c-14 0-18-12-28-12-9 0-12 12-23 12 11 0 14 12 23 12 10 0 14-12 28-12Z"/><path d="M270 194h50c9 0 13-7 20-7 8 0 12 7 20 7s12-7 20-7c7 0 11 7 20 7h50"/></g>
          <text class="title-model" x="360" y="177" text-anchor="middle">JOOKBOX</text>
        </svg>
      </div>
      <div class="ticker" role="status" aria-label="Venue ticker"><span>${escapeHtml(ticker)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
      <div class="coin-console">
        <button id="coinButton" class="coin-button" type="button" aria-label="Drag the coin upward into the slot, or press Enter, to start the Bar Edition">
          <span class="coin-slot" aria-hidden="true"></span><span id="coin" class="coin" aria-hidden="true"><b>$1</b></span><span class="coin-label">INSERT COIN</span>
        </button>
      </div>
      <div class="screen">${video}</div>
      <nav id="keys" class="keys" aria-label="Venue destinations">${keys.join("")}</nav>
      <button id="sharePanel" class="support" type="button" aria-label="Share ${escapeAttribute(input.name||"this venue")}" aria-disabled="true" disabled>${renderBarStudioShareHand("left")}<strong><span class="share-word">SHARE</span></strong>${renderBarStudioShareHand("right")}</button>
      <div id="status" class="status" aria-live="polite">Waiting for coin</div>
      <div class="copyright">Copyright Clearlight Creative 2026.</div>
    </section>
    <section id="aboutScreen" class="about-screen" aria-labelledby="aboutTitle" hidden>
      <button id="aboutBack" class="about-back" type="button">&larr; Back to JookBox</button>
      <article class="about-card">
        <p class="about-kicker">About the venue</p>
        <h1 id="aboutTitle" tabindex="-1">${escapeHtml(input.name||"Venue")}</h1>
        <div class="about-copy">${aboutParagraphs}</div>
      </article>
    </section>
    <div id="previewGate" class="gate"><strong>${project.readiness.handoffReady?"STATIC CONTENT COMPLETE":"ADMINISTRATOR INPUT REQUIRED"}</strong>No web lookup runs for Bar Edition. The five labels, five URLs, ticker, About Us copy and MP4 come only from this local Studio project.</div>
    <footer aria-label="Deep Cuts platform"><strong>Deep Cuts</strong><br>Copyright Clearlight Creative</footer>
  </main>
  <audio id="coinSound" preload="auto" src="/assets/audio/jukebox-real-coin-insert-cc0.mp3"></audio>
  <script${scriptNonce?` nonce="${escapeAttribute(scriptNonce)}"`:""}>
    (()=>{const machine=document.getElementById("machine"),coinButton=document.getElementById("coinButton"),coin=document.getElementById("coin"),video=document.getElementById("welcomeVideo"),status=document.getElementById("status"),keys=[...document.querySelectorAll(".key:not(.is-placeholder)")],aboutKey=document.getElementById("aboutKey"),aboutScreen=document.getElementById("aboutScreen"),aboutBack=document.getElementById("aboutBack"),aboutTitle=document.getElementById("aboutTitle"),previewGate=document.getElementById("previewGate"),sharePanel=document.getElementById("sharePanel"),sound=document.getElementById("coinSound");let state="sleeping",drag=null,keyTimer=0,keyIndex=-1;
    const unlock=()=>{keys.forEach(key=>{if(key.tagName==="A"){key.removeAttribute("aria-disabled");key.tabIndex=0}else{key.disabled=false;key.removeAttribute("aria-disabled")}});sharePanel.disabled=false;sharePanel.removeAttribute("aria-disabled")};
    const sequence=()=>{clearTimeout(keyTimer);keys.forEach(key=>key.classList.remove("is-current"));if(document.hidden||!machine.classList.contains("is-buttons-on")||matchMedia("(prefers-reduced-motion: reduce)").matches||!keys.length)return;keyIndex=(keyIndex+1)%keys.length;keys[keyIndex].classList.add("is-current");keyTimer=setTimeout(sequence,1100)};
    const awaken=(restore=false)=>{if(state!=="sleeping")return;state="starting";machine.classList.add("is-accepting");status.textContent="Coin accepted — Bar Edition is powering up";if(!restore){sound.volume=.56;sound.play().catch(()=>{});if(video){video.currentTime=0;video.play().catch(()=>{status.textContent="Coin accepted — press play for the welcome video"})}try{sessionStorage.setItem("${sessionKey}","true")}catch{}}setTimeout(()=>machine.classList.add("is-powering"),120);setTimeout(()=>machine.classList.add("is-neon-on"),800);setTimeout(()=>machine.classList.add("is-screen-on"),1200);setTimeout(()=>{machine.classList.add("is-buttons-on");unlock();sequence()},1600);setTimeout(()=>{machine.classList.add("is-ticker-on","is-awake");machine.classList.remove("is-powering","is-accepting");state="awake";status.textContent="Coin accepted — JookBox is live"},2000)};
    coinButton.addEventListener("click",event=>{if(state!=="sleeping")return;if(event.detail===0||!drag)awaken()});coinButton.addEventListener("pointerdown",event=>{if(state!=="sleeping"||event.button!==0)return;event.preventDefault();coinButton.setPointerCapture?.(event.pointerId);drag={id:event.pointerId,y:event.clientY,progress:0}});coinButton.addEventListener("pointermove",event=>{if(!drag||drag.id!==event.pointerId)return;event.preventDefault();drag.progress=Math.max(0,Math.min(1,(drag.y-event.clientY)/70));coin.style.transform="translate(-50%,calc(-50% - "+Math.round(drag.progress*118)+"%)) rotate("+Math.round(5+drag.progress*12)+"deg)"});const finish=event=>{if(!drag||drag.id!==event.pointerId)return;const accepted=drag.progress>=.5;drag=null;coin.style.removeProperty("transform");if(accepted)awaken()};coinButton.addEventListener("pointerup",finish);coinButton.addEventListener("pointercancel",finish);
    document.querySelectorAll(".key").forEach(key=>key.addEventListener("click",event=>{if(state!=="awake"){event.preventDefault();coinButton.focus()}}));aboutKey.addEventListener("click",()=>{if(state!=="awake"){coinButton.focus();return}machine.hidden=true;previewGate.hidden=true;aboutScreen.hidden=false;aboutTitle.focus();scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})});aboutBack.addEventListener("click",()=>{aboutScreen.hidden=true;machine.hidden=false;previewGate.hidden=false;aboutKey.focus();scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})});const previewShare=async()=>{if(state!=="awake"){coinButton.focus();return}status.textContent="Public sharing activates after deployment";};sharePanel.addEventListener("click",previewShare);
    document.addEventListener("visibilitychange",()=>{if(document.hidden)clearTimeout(keyTimer);else if(state==="awake")sequence()});try{if(sessionStorage.getItem("${sessionKey}")==="true"){machine.classList.add("is-neon-on","is-screen-on","is-buttons-on","is-ticker-on","is-awake");state="awake";status.textContent="Coin accepted — JookBox is live";unlock();sequence();if(video){video.pause();video.currentTime=0}}}catch{}
    const title=document.getElementById("barTitle"),frame=title?.closest(".title");let pending=0;const fit=()=>{pending=0;const characters=String(title.textContent||"").trim().length;title.removeAttribute("textLength");title.removeAttribute("lengthAdjust");title.style.letterSpacing=characters>22?".012em":characters>18?".018em":characters>14?".026em":".04em";title.style.fontSize="82px";const target=610,measured=Math.max(1,title.getComputedTextLength?.()||target);let size=Math.max(20,Math.min(82,82*target/measured*.965));title.style.fontSize=size.toFixed(2)+"px";let finalWidth=Math.max(1,title.getComputedTextLength?.()||target);for(let pass=0;pass<8&&finalWidth>target&&size>20;pass+=1){size=Math.max(20,size*target/finalWidth*.985);title.style.fontSize=size.toFixed(2)+"px";finalWidth=Math.max(1,title.getComputedTextLength?.()||target)}title.dataset.fittedSize=size.toFixed(2);title.dataset.fittedWidth=finalWidth.toFixed(2)};const schedule=()=>{cancelAnimationFrame(pending);pending=requestAnimationFrame(fit)};new ResizeObserver(schedule).observe(frame);document.fonts?.ready?.then(schedule).catch(()=>{});schedule()})();
  </script>
</body>
</html>`;
}

function renderJookBoxStudioPreview(project,{scriptNonce=""}={}){
  const input=project.input;
  const research=project.research?.inputFingerprint===researchFingerprint(input)?project.research:null;
  const verified=Boolean(research?.passed&&research.confidence>=98);
  const selections=(verified?research.selections:[]).filter(item=>research.displaySelectionIds.includes(item.id)).slice(0,6);
  const videoId=youtubeId(verified?research.featuredVideo?.youtubeURL:"");
  const ticker=verified?research.biography?.tickerBio:"INSERT THE BAND NAME AND AN OFFICIAL URL, THEN RUN VERIFIED RESEARCH.";
  const video=videoId
    ?`<iframe title="${escapeAttribute(research.featuredVideo.title||`${input.name} featured video`)}" src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    :`<div class="jb-screen-wait"><strong>${verified?"VIDEO OMITTED":"AWAITING VERIFIED VIDEO"}</strong><span>${verified?"No playable official video passed the gate.":"Research must prove the official channel and its Popular selection."}</span></div>`;
  const destinationKeys=selections.map(item=>`<a href="${escapeAttribute(item.url)}" target="_blank" rel="noopener noreferrer" data-kind="${escapeAttribute(item.kind||"website")}"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></a>`);
  const utilityKeys=[];
  if(verified&&destinationKeys.length<6&&research.biography?.paragraphs?.length)utilityKeys.push('<button type="button" data-kind="learn_more"><strong>Learn More</strong><small>Band biography</small></button>');
  if(verified&&destinationKeys.length+utilityKeys.length<6)utilityKeys.push('<button type="button" data-kind="share"><strong>Share</strong><small>Share this JookBox</small></button>');
  const keys=[...destinationKeys,...utilityKeys].join("");
  const confidence=research?`${research.confidence}% ${research.passed?"VERIFIED":"NEEDS REVIEW"}`:"RESEARCH NOT RUN";
  return`<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#120705">
  <title>${escapeHtml(input.name||"JookBox")} Studio Preview</title>
  <style>
    *{box-sizing:border-box}html{background:#050201}body{margin:0;min-height:100vh;background:#050201;color:#fff;font-family:Arial,Helvetica,sans-serif}
    main{width:min(100%,430px);margin:auto;padding:0 0 38px}.draft-bar{display:flex;justify-content:space-between;gap:12px;padding:10px 14px;background:#0b0705;color:#d7a654;font-size:8px;font-weight:900;letter-spacing:.13em}.draft-bar b{color:${verified?"#9ff1bd":"#ffd37b"}}
    .jb{position:relative;width:100%;aspect-ratio:887/1774;overflow:hidden;background:url("/assets/jookbox-atlas-reference-v1.webp") center/100% 100% no-repeat;filter:${verified?"none":"brightness(.48) saturate(.58)"};transition:filter .4s ease}
    .jb-title{position:absolute;z-index:2;top:4.15%;left:17%;width:66%;height:12.3%;display:grid;align-content:center;color:#ffe9a8;font-family:Georgia,serif;font-weight:900;line-height:.9;letter-spacing:.12em;text-align:center;text-shadow:0 0 3px #fff2b9,0 0 12px #ff9f22;text-transform:uppercase}
    .jb-title>strong{display:block;width:100%;overflow:hidden;font:inherit;font-size:clamp(22px,8vw,42px);line-height:.9;text-overflow:clip;white-space:nowrap}.jb-title>strong[data-fit-mode="multi-line"]{overflow-wrap:anywhere;text-wrap:balance;white-space:normal}
    .jb-title small{display:block;margin-top:8px;color:#ffe0a0;font:800 clamp(7px,2.3vw,12px) Arial,sans-serif;letter-spacing:.34em}
    .jb-title small:after{display:block;margin-top:5px;color:#ffb6cb;content:"NOW PLAYING";font-size:.82em;letter-spacing:.14em;text-shadow:0 0 7px rgba(255,67,135,.72)}
    .ticker{position:absolute;z-index:3;top:17.35%;left:7.2%;width:85.6%;height:8.15%;display:flex;align-items:center;overflow:hidden;border:1px solid #b77c35;border-radius:7px;background:#080402;box-shadow:inset 0 0 16px #000,0 0 9px rgba(255,169,47,.4)}
    .ticker span{display:block;width:max-content;padding-left:100%;color:#ffc44b;font:900 clamp(10px,3vw,14px)/1.05 "Courier New",monospace;letter-spacing:.03em;text-shadow:0 0 5px #ffb530;white-space:nowrap;animation:scroll 25s linear infinite}
    @keyframes scroll{to{transform:translateX(-100%)}}.screen{position:absolute;z-index:3;top:27.55%;left:27.3%;width:64.55%;height:29.05%;padding:5.2% 2% 7%;overflow:hidden;border:1px solid #60462e;border-radius:5px;background:#020202;box-shadow:0 0 13px rgba(255,77,140,.17),inset 0 0 12px #000}.screen iframe{width:100%;aspect-ratio:16/9;border:0}
    .jb-screen-wait{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px;color:#b99558;text-align:center}.jb-screen-wait strong{font-size:12px;letter-spacing:.08em}.jb-screen-wait span{max-width:230px;margin-top:7px;color:#806c52;font-size:8px;line-height:1.4}
    .coin{position:absolute;z-index:4;top:27.55%;left:7.2%;width:18%;height:29.05%;display:grid;place-items:center;padding:18% 10%;border:1px solid #caa56a;border-radius:7px;background:linear-gradient(#21130d,#090604);color:#ffe6a8;font-size:clamp(7px,2vw,10px);font-weight:900;letter-spacing:.08em;text-align:center;box-shadow:inset 0 0 10px #000,0 0 9px rgba(255,191,76,.28)}
    .keys{position:absolute;z-index:4;top:57.7%;left:7.15%;width:85.7%;height:20.8%;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:5.7% 3.05%}.keys a,.keys button,.key-empty{min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4%;border:1px solid #65c9ff;border-radius:7%;background:linear-gradient(#101315,#020304);color:#75d6ff;font:inherit;text-decoration:none;text-align:center;box-shadow:inset 0 1px rgba(255,255,255,.04),inset 0 -4px 8px #000,0 0 8px rgba(101,201,255,.25)}.keys strong{font-size:clamp(8px,2.5vw,12px);line-height:1.05;text-transform:uppercase}.keys small{display:none}.key-empty{opacity:.2}
    .support{position:absolute;z-index:4;top:79.55%;left:7.15%;width:85.7%;height:9.2%;display:grid;place-content:center;border:1px solid #ff5f78;border-radius:4%;background:rgba(20,1,5,.87);color:#ff9daf;text-align:center;box-shadow:inset 0 0 14px #000,0 0 10px rgba(255,45,89,.25)}.support strong{font-size:clamp(13px,4vw,21px);letter-spacing:.08em;text-transform:uppercase}.support small{margin-top:5px;font-size:clamp(7px,2vw,10px);letter-spacing:.1em;text-transform:uppercase}.copyright{position:absolute;z-index:4;top:91.1%;left:31%;width:38%;color:#d7a654;font-size:clamp(6px,1.8vw,9px);letter-spacing:.08em;text-align:center}
    .gate{padding:18px 20px 6px;color:#aa8b6c;text-align:center;font-size:9px;line-height:1.5;letter-spacing:.06em;text-transform:uppercase}.gate strong{display:block;margin-bottom:5px;color:${verified?"#9ff1bd":"#ffd37b"};font-size:11px}
    footer{padding:24px 0 0;color:#806b5d;font-size:9px;line-height:1.8;letter-spacing:.08em;text-align:center}footer strong{color:#b89a7d;letter-spacing:.15em}
    @media(prefers-reduced-motion:reduce){.ticker span{width:100%;padding:0 4%;overflow:hidden;text-overflow:ellipsis;animation:none}}
  </style>
</head>
<body>
  <main>
    <div class="draft-bar"><span>DEEP CUTS STUDIO · JOOKBOX DRAFT</span><b>${escapeHtml(confidence)}</b></div>
    <section class="jb" aria-label="${escapeAttribute(input.name||"Band")} JookBox preview">
      <div class="jb-title"><strong id="studioJookBoxTitle">${escapeHtml(input.name||"BAND NAME")}</strong><small>JOOKBOX</small></div>
      <div class="ticker"><span>${escapeHtml(ticker)}</span></div>
      <div class="screen">${video}</div>
      <div class="coin">${verified?"INSERT COIN TO PLAY":"RESEARCH FIRST"}</div>
      <nav class="keys" aria-label="Verified JookBox keys">${keys}${Array.from({length:Math.max(0,6-destinationKeys.length-utilityKeys.length)},()=>'<span class="key-empty" aria-hidden="true"></span>').join("")}</nav>
      <div class="support"><strong>Support Our Band</strong><small>Please share our JookBox ↗</small></div>
      <div class="copyright">Copyright Clearlight Creative 2026.</div>
    </section>
    <div class="gate"><strong>${escapeHtml(confidence)}</strong>${verified?"Only the independently verified destinations shown above would enter the factory handoff.":"No destination will be published until identity, biography, video and every displayed key pass the 98% gate."}</div>
    <footer aria-label="Deep Cuts platform"><strong>Deep Cuts</strong><br>Copyright Clearlight Creative</footer>
  </main>
  <script${scriptNonce?` nonce="${escapeAttribute(scriptNonce)}"`:""}>
    (()=>{const title=document.getElementById("studioJookBoxTitle");const frame=title?.parentElement;if(!title||!frame)return;let pending=0;const fit=()=>{pending=0;let multiline=false;title.dataset.fitMode="single-line";title.style.removeProperty("font-size");const maximum=parseFloat(getComputedStyle(title).fontSize);const available=Math.max(24,frame.clientHeight-(frame.querySelector("small")?.offsetHeight||0)-12);const apply=size=>{title.style.fontSize=size+"px";return title.scrollWidth<=title.clientWidth+1&&(!multiline||title.scrollHeight<=available+1)};if(apply(maximum)){title.style.removeProperty("font-size");return}let low=Math.min(maximum,12),high=maximum;if(!apply(low)){multiline=true;title.dataset.fitMode="multi-line";low=Math.min(maximum,7)}for(let index=0;index<12;index+=1){const candidate=(low+high)/2;if(apply(candidate))low=candidate;else high=candidate}title.style.fontSize=low.toFixed(2)+"px"};const schedule=()=>{cancelAnimationFrame(pending);pending=requestAnimationFrame(fit)};new ResizeObserver(schedule).observe(frame);if(document.fonts?.ready)document.fonts.ready.then(schedule).catch(()=>{});schedule()})();
  </script>
</body>
</html>`;
}

export function attachMp4(project,{fileName,sizeBytes,sha256},now=new Date()){
  assertProject(project);
  if(project.input.type!=="bar_jukebox")throw new StudioValidationError("Local MP4 welcome videos are available only for Bar Edition projects.","wrong_video_type");
  return finalize({
    ...project,
    revision:Number(project.revision||0)+1,
    updatedAt:now.toISOString(),
    mp4:{
      fileName:clean(fileName,160),
      sizeBytes:Number(sizeBytes),
      sha256:String(sha256||""),
      uploadedAt:now.toISOString()
    }
  });
}

export function removeMp4(project,now=new Date()){
  assertProject(project);
  return finalize({
    ...project,
    revision:Number(project.revision||0)+1,
    updatedAt:now.toISOString(),
    mp4:null
  });
}

export function youtubeId(value){
  if(!value)return"";
  try{
    const url=new URL(value);
    if(url.hostname==="youtu.be")return /^[A-Za-z0-9_-]{11}$/.test(url.pathname.slice(1))?url.pathname.slice(1):"";
    if(["youtube.com","www.youtube.com","m.youtube.com"].includes(url.hostname)){
      const id=url.pathname.startsWith("/shorts/")?url.pathname.split("/")[2]:url.pathname.startsWith("/embed/")?url.pathname.split("/")[2]:url.searchParams.get("v");
      return /^[A-Za-z0-9_-]{11}$/.test(id||"")?id:"";
    }
  }catch{}
  return"";
}

export function assertProjectId(value){
  if(!/^studio_[a-f0-9]{12}$/.test(String(value||"")))throw new StudioValidationError("Invalid Studio project identifier.","invalid_project_id");
  return String(value);
}

export class StudioValidationError extends Error{
  constructor(message,code="invalid_input"){super(message);this.name="StudioValidationError";this.code=code}
}

function finalize(project){
  return{...project,readiness:readinessFor(project)};
}
function booleanValue(value,fallback=false){
  if(typeof value==="boolean")return value;
  if(typeof value==="string"){
    if(/^(?:yes|true|on|1)$/i.test(value.trim()))return true;
    if(/^(?:no|false|off|0)$/i.test(value.trim()))return false;
  }
  return Boolean(fallback);
}
function assertProject(project){
  if(!project||project.schemaVersion!==STUDIO_SCHEMA_VERSION)throw new StudioValidationError("Unsupported Studio project file.","invalid_project");
  assertProjectId(project.id);
}
function normalizeHttpsUrl(value){
  const raw=String(value||"").trim();
  if(!raw)return"";
  try{
    const url=new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)?raw:`https://${raw}`);
    if(url.protocol!=="https:")throw new Error();
    url.hash="";
    return url.href;
  }catch{throw new StudioValidationError(`Use a complete HTTPS URL: ${raw}`,"invalid_url")}
}
function normalizeYouTubeUrl(value){
  const url=normalizeHttpsUrl(value);
  if(!url)return"";
  if(!youtubeId(url))throw new StudioValidationError("Use a direct YouTube watch, Shorts or youtu.be link.","invalid_youtube_url");
  return url;
}
function clean(value,max){return String(value??"").trim().replace(/\s+/g," ").slice(0,max)}
function cleanMultiline(value,max){return String(value??"").trim().replace(/\r\n?/g,"\n").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").slice(0,max)}
function typeFromText(value){
  const normalized=clean(value,80).toLowerCase().replace(/[.!]+$/,"");
  if(TYPE_BY_ID.has(normalized))return normalized;
  if(TYPE_ALIASES.has(normalized))return TYPE_ALIASES.get(normalized);
  return[...TYPE_ALIASES].find(([label])=>normalized.includes(label))?.[1]||"";
}
function wordNumber(value){return{one:1,two:2,three:3,four:4,five:5}[String(value).toLowerCase()]||Number(value)}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function escapeAttribute(value){return escapeHtml(value)}
function linkLabel(value,index){
  try{return new URL(value).hostname.replace(/^www\./,"").split(".")[0].replace(/[-_]+/g," ").toUpperCase()}
  catch{return`SOURCE ${index+1}`}
}
function displayHost(value){
  try{return new URL(value).hostname.replace(/^www\./,"")}
  catch{return""}
}
