import crypto from "node:crypto";
import {
  STUDIO_JOOKBOX_RESEARCH_SCHEMA,
  researchFingerprint
} from "./studio-jookbox-research.mjs";

export const STUDIO_SCHEMA_VERSION="deep-cuts-studio-project/1";

export const PRODUCT_TYPES=Object.freeze([
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
    if((match=clause.match(/^(?:replace|change|set)\s+(?:source\s+)?(?:url|website)\s*(1|2|3|one|two|three)\s+(?:to|with)\s+(https?:\/\/\S+)[.!]?$/i))){
      const index=wordNumber(match[1])-1;
      next.sourceUrls[index]=match[2].replace(/[.,!?]+$/,"");
      changes.push(`Source URL ${index+1} updated.`);continue;
    }
    if((match=clause.match(/^(?:change|set|replace)\s+(?:button|label)\s*(1|2|3|one|two|three)\s+(?:to|with)\s+(.+?)[.!]?$/i))){
      const index=wordNumber(match[1])-1;
      next.sourceLabels[index]=clean(match[2],42);
      changes.push(`Button ${index+1} changed to “${next.sourceLabels[index]}”.`);continue;
    }
    if((match=clause.match(/^(?:remove|clear)\s+(?:source\s+)?(?:url|website)\s*(1|2|3|one|two|three)[.!]?$/i))){
      const index=wordNumber(match[1])-1;
      next.sourceUrls.splice(index,1);
      next.sourceLabels.splice(index,1);
      changes.push(`Source URL ${index+1} removed.`);continue;
    }
    if((match=clause.match(/^(?:add|use)\s+(?:source\s+)?(?:url|website)\s+(https?:\/\/\S+)[.!]?$/i))){
      if(next.sourceUrls.length<3){
        next.sourceUrls.push(match[1].replace(/[.,!?]+$/,""));
        next.sourceLabels.push("");
        changes.push(`Source URL ${next.sourceUrls.length} added.`);
      }
      continue;
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
  for(let index=0;index<urls.length&&pairs.length<3;index++){
    const url=normalizeHttpsUrl(urls[index]);
    if(!url||pairs.some(item=>item.url===url))continue;
    pairs.push({url,label:clean(labels[index],42)});
  }
  const youtubeUrl=normalizeYouTubeUrl(input.youtubeUrl??fallback.youtubeUrl??"");
  const addWheel=type==="jookbox"?false:booleanValue(input.addWheel??fallback.addWheel,false);
  return{
    name,
    type,
    aggitsOption,
    brief:cleanMultiline(input.brief??fallback.brief,1200),
    sourceUrls:pairs.map(item=>item.url),
    sourceLabels:pairs.map(item=>item.label),
    youtubeUrl,
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

export function renderStudioPreview(project,{audioUrl="",logoUrl=""}={}){
  assertProject(project);
  if(project.input.type==="jookbox")return renderJookBoxStudioPreview(project);
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

function renderJookBoxStudioPreview(project){
  const input=project.input;
  const research=project.research?.inputFingerprint===researchFingerprint(input)?project.research:null;
  const verified=Boolean(research?.passed&&research.confidence>=98);
  const selections=(verified?research.selections:[]).filter(item=>research.displaySelectionIds.includes(item.id)).slice(0,8);
  const videoId=youtubeId(verified?research.featuredVideo?.youtubeURL:"");
  const ticker=verified?research.biography?.tickerBio:"INSERT THE BAND NAME AND AN OFFICIAL URL, THEN RUN VERIFIED RESEARCH.";
  const video=videoId
    ?`<iframe title="${escapeAttribute(research.featuredVideo.title||`${input.name} featured video`)}" src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    :`<div class="jb-screen-wait"><strong>${verified?"VIDEO OMITTED":"AWAITING VERIFIED VIDEO"}</strong><span>${verified?"No playable official video passed the gate.":"Research must prove the official channel and its Popular selection."}</span></div>`;
  const keys=selections.map(item=>`<a href="${escapeAttribute(item.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></a>`).join("");
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
    .jb{position:relative;width:100%;aspect-ratio:762/1280;overflow:hidden;background:url("/assets/jookbox-cabinet-photoreal-v1.webp") center/100% 100% no-repeat;filter:${verified?"none":"brightness(.48) saturate(.58)"};transition:filter .4s ease}
    .jb-title{position:absolute;z-index:2;top:7.8%;left:18%;width:64%;color:#ffe9a8;font-family:Georgia,serif;font-size:clamp(20px,7vw,34px);font-weight:900;line-height:.9;letter-spacing:.055em;text-align:center;text-shadow:0 0 5px #fff2b9,0 0 14px #ff9f22;text-transform:uppercase}
    .jb-title small{display:block;margin-top:8px;color:#ffe0a0;font:800 clamp(7px,2.4vw,11px) Arial,sans-serif;letter-spacing:.28em}
    .ticker{position:absolute;z-index:3;top:16.7%;left:16.5%;width:67%;height:5.7%;display:flex;align-items:center;overflow:hidden;border:1px solid #b77c35;border-radius:3px;background:#080402;box-shadow:inset 0 0 16px #000,0 0 9px rgba(255,169,47,.4)}
    .ticker span{display:block;width:max-content;padding-left:100%;color:#ffc44b;font:900 clamp(10px,3vw,14px)/1.05 "Courier New",monospace;letter-spacing:.03em;text-shadow:0 0 5px #ffb530;white-space:nowrap;animation:scroll 25s linear infinite}
    @keyframes scroll{to{transform:translateX(-100%)}}.screen{position:absolute;z-index:3;top:22.5%;left:17.1%;width:65.8%;aspect-ratio:16/9;overflow:hidden;border:2px solid #c9a16b;border-radius:5px;background:#020202;box-shadow:0 0 13px rgba(255,177,70,.25),inset 0 0 12px #000}.screen iframe{width:100%;height:100%;border:0}
    .jb-screen-wait{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px;color:#b99558;text-align:center}.jb-screen-wait strong{font-size:12px;letter-spacing:.08em}.jb-screen-wait span{max-width:230px;margin-top:7px;color:#806c52;font-size:8px;line-height:1.4}
    .coin{position:absolute;z-index:4;top:45.1%;left:39%;width:22%;height:5.3%;display:grid;place-items:center;border:1px solid #caa56a;border-radius:7px;background:linear-gradient(#302219,#090604);color:#ffe6a8;font-size:8px;font-weight:900;letter-spacing:.08em;text-align:center;box-shadow:inset 0 0 10px #000,0 0 9px rgba(255,191,76,.28)}
    .keys{position:absolute;z-index:4;top:58.1%;left:25.1%;width:49.8%;height:20.7%;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(4,1fr);gap:1.6% 2.6%}.keys a,.key-empty{min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3px;border:1px solid #bd873c;border-radius:4px;background:linear-gradient(#402113,#130c08);color:#fff2d2;text-decoration:none;text-align:center;box-shadow:inset 0 0 8px #000,0 0 7px rgba(255,155,52,.25)}.keys strong{font-size:clamp(7px,2vw,10px);line-height:1.05;text-transform:uppercase}.keys small{display:none}.key-empty{opacity:.2}
    .gate{padding:18px 20px 6px;color:#aa8b6c;text-align:center;font-size:9px;line-height:1.5;letter-spacing:.06em;text-transform:uppercase}.gate strong{display:block;margin-bottom:5px;color:${verified?"#9ff1bd":"#ffd37b"};font-size:11px}
    footer{padding:24px 0 0;color:#806b5d;font-size:9px;line-height:1.8;letter-spacing:.08em;text-align:center}footer strong{color:#b89a7d;letter-spacing:.15em}
    @media(prefers-reduced-motion:reduce){.ticker span{width:100%;padding:0 4%;overflow:hidden;text-overflow:ellipsis;animation:none}}
  </style>
</head>
<body>
  <main>
    <div class="draft-bar"><span>DEEP CUTS STUDIO · JOOKBOX DRAFT</span><b>${escapeHtml(confidence)}</b></div>
    <section class="jb" aria-label="${escapeAttribute(input.name||"Band")} JookBox preview">
      <div class="jb-title">${escapeHtml(input.name||"BAND NAME")}<small>JOOKBOX</small></div>
      <div class="ticker"><span>${escapeHtml(ticker)}</span></div>
      <div class="screen">${video}</div>
      <div class="coin">${verified?"INSERT COIN TO PLAY":"RESEARCH FIRST"}</div>
      <nav class="keys" aria-label="Verified JookBox keys">${keys}${Array.from({length:Math.max(0,8-selections.length)},()=>'<span class="key-empty" aria-hidden="true"></span>').join("")}</nav>
    </section>
    <div class="gate"><strong>${escapeHtml(confidence)}</strong>${verified?"Only the independently verified destinations shown above would enter the factory handoff.":"No destination will be published until identity, biography, video and every displayed key pass the 98% gate."}</div>
    <footer aria-label="Deep Cuts platform"><strong>Deep Cuts</strong><br>Copyright Clearlight Creative</footer>
  </main>
</body>
</html>`;
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
function wordNumber(value){return{one:1,two:2,three:3}[String(value).toLowerCase()]||Number(value)}
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
