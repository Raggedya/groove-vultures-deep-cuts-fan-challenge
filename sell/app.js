import {SALES_SECTION_ORDER} from "./schemas.js";
import {buildBanjoStrategyBrief,estimateDuration,fileNameForBrief,validateBanjoStrategyBrief,wordCount} from "./banjo-brief.js";

const state={matches:[],business:null,offering:{},myCompanyUrl:"",targetCompanyUrl:"",demo:false,report:null,currentSection:null,briefingId:null,banjoBrief:null,lastResearchRequest:null,sessionId:sessionStorage.getItem("dc-sales-session")||crypto.randomUUID()};
sessionStorage.setItem("dc-sales-session",state.sessionId);

const screens=Object.fromEntries([...document.querySelectorAll("[data-screen]")].map(node=>[node.dataset.screen,node]));
const $=selector=>document.querySelector(selector);

document.addEventListener("click",event=>{
  const action=event.target.closest("[data-action]")?.dataset.action;
  if(!action)return;
  const actions={
    demo:runDemo,"back-search":()=>show("search"),home:()=>state.report?show("menu"):show("search"),
    "new-search":reset,"edit-companies":editCompanies,save:savePrivate,export:exportPdf,
    "copy-section":copySection,retry:retry,"create-banjo":createBanjoBrief,"back-menu":()=>show("menu"),
    "download-banjo":downloadBanjoBrief,"copy-banjo":copyBanjoScript
  };
  actions[action]?.();
});

$("#banjo-script").addEventListener("input",()=>{if(state.banjoBrief){state.banjoBrief.script=$("#banjo-script").value;state.banjoBrief.estimatedDurationSeconds=estimateDuration(state.banjoBrief.script);state.banjoBrief.manualEdits=true;renderBanjoStats()}});

$("#company-form").addEventListener("submit",event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  submitCompanies(data.get("myCompanyUrl"),data.get("targetCompanyUrl"));
});

function runDemo(){
  state.demo=true;
  $("#my-company-url").value="https://www.accessworkwear.com.au";
  $("#target-company-url").value="https://www.telstra.com.au";
  submitCompanies("https://www.accessworkwear.com.au","https://www.telstra.com.au");
}

async function submitCompanies(myCompany,targetCompany){
  const myUrl=normaliseCompanyUrl(myCompany),targetUrl=normaliseCompanyUrl(targetCompany);
  if(!myUrl)return toast("Enter a valid My Company website");
  if(!targetUrl)return toast("Enter a valid Target Company website");
  if(new URL(myUrl).hostname===new URL(targetUrl).hostname)return toast("Use two different company websites");
  if(!(myUrl==="https://www.accessworkwear.com.au/"&&targetUrl==="https://www.telstra.com.au/"&&state.demo))state.demo=false;
  state.myCompanyUrl=myUrl;state.targetCompanyUrl=targetUrl;
  state.offering={website:myUrl,businessName:companyNameFromUrl(myUrl),description:""};
  track("business_searched");show("progress");
  $("#progress-company").textContent="Confirming the target company";
  $("#progress-current").textContent="Checking the official website and company identity...";
  $("#progress-stages").replaceChildren();
  try{
    const result=await api("/api/sell/identify",{query:companyNameFromUrl(targetUrl),website:targetUrl,targetWebsite:targetUrl,sellerWebsite:myUrl,demo:state.demo});
    state.matches=result.matches||[];renderMatches();show("confirm");
  }catch(error){showError(error.message)}
}

function renderMatches(){
  const list=$("#matches");list.replaceChildren();
  $("#confirm-relationship").textContent=`${displayHost(state.myCompanyUrl)}  â†’  ${displayHost(state.targetCompanyUrl)}`;
  $("#match-empty").classList.toggle("hidden",state.matches.length>0);
  for(const business of state.matches){
    const button=el("button","match-card");button.type="button";
    button.append(el("b","",business.matchConfidence==="high"?"Verified target":"Check this target"),el("strong","",business.officialName),el("span","",[business.tradingName,business.industry,business.location,business.publicStatus].filter(Boolean).join(" Â· ")),el("span","",business.website));
    button.addEventListener("click",()=>confirmBusiness(business));list.append(button);
  }
}

function confirmBusiness(business){
  state.business=business;track("business_confirmed");research();
}

async function research(){
  track("offering_entered",{result:"website_comparison"});track("research_started");
  state.lastResearchRequest={business:state.business,offering:state.offering,seller:{website:state.myCompanyUrl},target:{website:state.targetCompanyUrl},demo:state.demo};
  show("progress");
  $("#progress-company").textContent=`Reading ${state.business.officialName}`;
  $("#progress-current").textContent="Comparing public evidence from both companies...";
  $("#progress-stages").replaceChildren();
  try{
    const result=await api("/api/sell/research",state.lastResearchRequest);
    state.report=result.report;state.briefingId=null;
    $("#progress-current").textContent="Commercial briefing ready.";
    const stageList=$("#progress-stages");
    for(const stage of state.report.stagesCompleted||[])stageList.append(el("li","",stage));
    track("research_completed");
    if(Object.values(state.report.sections).some(section=>(section.items||[]).some(item=>item.confidence==="Low confidence")))track("low_confidence_result");
    renderMenu();setTimeout(()=>show("menu"),280);
  }catch(error){track("research_failure",{result:error.code||"failed"});showError(error.message)}
}

function renderMenu(){
  const report=state.report;if(!report)return;
  state.myCompanyUrl=report.offering?.website||state.myCompanyUrl;
  state.targetCompanyUrl=report.business.website||state.targetCompanyUrl;
  $("#menu-company").textContent=report.business.tradingName||report.business.officialName;
  $("#menu-meta").textContent=`${report.business.industry} Â· ${report.business.location} Â· Updated ${formatDate(report.researchCutoff)}`;
  $("#menu-relationship").innerHTML=`<strong>${escapeHtml(displayHost(state.myCompanyUrl)||"My Company")}</strong> &nbsp;â†’&nbsp; <strong>${escapeHtml(report.business.tradingName||report.business.officialName)}</strong>`;
  $("#report-notice").textContent=report.notice;
  const menu=$("#section-menu");menu.replaceChildren();
  const visible=SALES_SECTION_ORDER.filter(([key])=>key!=="executives"||report.sections.executives?.people?.length);
  visible.forEach(([key,label],index)=>{
    const button=el("button","section-button");button.type="button";
    if(index===0||index===visible.length-1)button.classList.add("wide");
    button.append(el("strong","",label),el("span","arrow",">"));
    button.addEventListener("click",()=>openSection(key));menu.append(button);
  });
  buildPrintReport();
}

function openSection(key){
  state.currentSection=key;
  const section=state.report.sections[key],root=$("#section-content");
  root.replaceChildren(el("p","eyebrow section-kicker","COMMERCIAL INSTINCT Â· "+(state.report.business.tradingName||state.report.business.officialName).toUpperCase()),el("h2","",section.title),el("p","lead","The straight commercial read â€” concise advice, with evidence available when you need it."));
  for(const item of section.items||[])root.append(renderInsight(item));
  if(key==="executives")renderPeople(root,section.people||[]);
  if(key==="evidence")renderSources(root,state.report.sources);
  show("section");
  const event=key==="executives"?"executive_section_opened":key==="approach"?"strategy_viewed":key==="tomorrow"?"meeting_briefing_viewed":"section_opened";
  track(event,{sectionId:key});
}

function renderInsight(item){
  const card=el("article","panel insight-card"),badges=el("div","status-row");
  badges.append(el("span",`badge ${statusClass(item.status)}`,statusLabel(item.status)),el("span","badge confidence",item.confidence));
  card.append(badges,el("h3","",item.title),el("p","straight-read",joinThought(item.meaning,item.relevance)));
  const advice=el("div","advice-box");advice.append(el("strong","","My advice"),el("p","",item.action));card.append(advice);
  const question=el("div","question-box");question.append(el("strong","","Ask them"),el("p","",item.question));card.append(question);
  const detail=el("details","evidence-detail"),summary=el("summary","","Why I think this");detail.append(summary,el("p","",item.found));
  if(item.alternativeExplanation)detail.append(el("p","",`Another reasonable explanation: ${item.alternativeExplanation}`));
  const evidence=el("div","evidence-links");
  for(const id of item.sourceIds||[]){const source=state.report.sources.find(entry=>entry.id===id);if(source)evidence.append(sourceLink(source))}
  detail.append(evidence);card.append(detail);return card;
}

function renderPeople(root,people){
  if(!people.length)return;root.append(el("h3","","Current publicly verified people"));const grid=el("div","people-grid");
  for(const person of people){const source=state.report.sources.find(item=>item.id===person.sourceId),card=el("article","panel person-card");card.append(el("h3","",person.name),el("strong","",person.title),el("p","",person.why),el("p","",`Best legitimate approach: ${person.approach}`),el("small","",`Verified ${formatDate(person.verifiedAt)} Â· ${person.confidence}`));if(source)card.append(sourceLink(source));grid.append(card)}
  root.append(grid);
}

function renderSources(root,sources){
  const register=el("div","source-register");
  for(const source of sources){const card=el("article","panel source-record"),link=el("a","",source.title);link.href=source.url;link.target="_blank";link.rel="noopener noreferrer";link.addEventListener("click",()=>track("source_opened",{sectionId:"evidence",sourceId:source.id}));card.append(link,el("p","source-meta",[source.publisher,source.publishedAt?formatDate(source.publishedAt):"Publication date not stated",source.sourceType.replaceAll("_"," ")].join(" Â· ")),el("p","",source.relevance),el("p","",`Accessed ${formatDate(source.accessedAt)}`));register.append(card)}
  root.append(register);
}

function sourceLink(source){const link=el("a","source-link",source.publisher);link.href=source.url;link.target="_blank";link.rel="noopener noreferrer";link.title=source.title;link.addEventListener("click",()=>track("source_opened",{sectionId:state.currentSection,sourceId:source.id}));return link}

async function savePrivate(){
  if(!state.report)return;
  try{const saved=await api("/api/sell/briefings",{report:state.report});state.briefingId=saved.briefingId;const url=new URL(location.href);url.search="";url.hash=new URLSearchParams({brief:saved.briefingId,token:saved.accessToken}).toString();await navigator.clipboard.writeText(url.toString());track("briefing_saved",{briefingId:saved.briefingId});track("private_share_created",{briefingId:saved.briefingId});toast("Private link copied. It expires in 30 days.")}catch(error){toast(error.message)}
}

function exportPdf(){if(!state.report)return;track("report_exported",{briefingId:state.briefingId,result:"print_pdf"});window.print()}

function createBanjoBrief(){
  if(!state.report)return;state.banjoBrief=buildBanjoStrategyBrief(state.report);
  $("#banjo-relationship").textContent=`${state.banjoBrief.seller.name} â†’ ${state.banjoBrief.target.name}`;
  $("#banjo-script").value=state.banjoBrief.script;$("#banjo-consent").checked=false;renderBanjoStats();show("banjo");track("banjo_brief_created");
}
function renderBanjoStats(){const brief=state.banjoBrief;if(brief)$("#banjo-stats").textContent=`${wordCount(brief.script)} words Â· approximately ${estimateDuration(brief.script)} seconds Â· maximum ${brief.maximumDurationSeconds} seconds`}
function downloadBanjoBrief(){
  if(!state.banjoBrief)return;state.banjoBrief.script=$("#banjo-script").value.trim();state.banjoBrief.estimatedDurationSeconds=estimateDuration(state.banjoBrief.script);
  if(!$("#banjo-consent").checked)return toast("Confirm that you are using your own voice");
  state.banjoBrief.voice.consentConfirmedAt=new Date().toISOString();const errors=validateBanjoStrategyBrief(state.banjoBrief);if(errors.length)return toast(errors[0]);
  const blob=new Blob([JSON.stringify(state.banjoBrief,null,2)],{type:"application/json"}),link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=fileNameForBrief(state.banjoBrief);link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);track("banjo_brief_exported");toast("Banjo Brief downloaded. Import it into Andy's Lip Sync Engine.");
}
async function copyBanjoScript(){if(state.banjoBrief){await navigator.clipboard.writeText($("#banjo-script").value);toast("Banjo script copied")}}

async function copySection(){
  if(!state.currentSection)return;const section=state.report.sections[state.currentSection];
  const text=[section.title,...(section.items||[]).flatMap(item=>["",item.title,joinThought(item.meaning,item.relevance),`My advice: ${item.action}`,`Ask them: ${item.question}`,`Confidence: ${item.confidence}`,`Evidence: ${item.found}`])].join("\n");
  await navigator.clipboard.writeText(text);toast("Section copied");
}

function buildPrintReport(){
  document.querySelector(".print-report")?.remove();const root=el("div","print-report print-only");root.append(el("h2","","Commercial Instinct â€” complete briefing"));
  for(const [key,label] of SALES_SECTION_ORDER){const section=state.report.sections[key];root.append(el("h2","",label));for(const item of section.items||[])root.append(renderInsight(item));if(key==="evidence")renderSources(root,state.report.sources)}screens.menu.append(root);
}

function editCompanies(){
  $("#my-company-url").value=state.myCompanyUrl;$("#target-company-url").value=state.targetCompanyUrl;show("search");
}
function retry(){state.myCompanyUrl&&state.targetCompanyUrl?submitCompanies(state.myCompanyUrl,state.targetCompanyUrl):show("search")}
function reset(){state.matches=[];state.business=null;state.offering={};state.myCompanyUrl="";state.targetCompanyUrl="";state.demo=false;state.report=null;state.currentSection=null;state.briefingId=null;state.banjoBrief=null;history.replaceState(null,"",location.pathname);track("new_search_started");$("#company-form").reset();show("search")}
function show(name){for(const [key,node] of Object.entries(screens))node.classList.toggle("active",key===name);const hasReport=Boolean(state.report);document.querySelectorAll('[data-action="new-search"],[data-action="edit-companies"]').forEach(node=>node.classList.toggle("hidden",!hasReport));scrollTo({top:0,behavior:"instant"})}
function showError(message){$("#error-message").textContent=message;show("error")}

async function restorePrivate(){
  const params=new URLSearchParams(location.hash.slice(1)),id=params.get("brief"),token=params.get("token");if(!id||!token)return;
  show("progress");$("#progress-company").textContent="Opening Commercial Instinct";$("#progress-current").textContent="Checking private access...";
  try{const response=await fetch(`/api/sell/briefings/${encodeURIComponent(id)}`,{headers:{authorization:`Bearer ${token}`}}),result=await response.json();if(!response.ok)throw new Error(result.error||"Private briefing could not be opened");state.report=result.report;state.business=result.report.business;state.offering=result.report.offering||{};state.myCompanyUrl=state.offering.website||"";state.targetCompanyUrl=state.business.website||"";state.briefingId=id;renderMenu();show("menu")}catch(error){showError(error.message)}
}

async function api(path,body){const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}),result=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(result.error||"The request could not be completed");error.code=result.code;throw error}return result}
function track(eventName,extra={}){fetch("/api/sell/events",{method:"POST",headers:{"content-type":"application/json"},keepalive:true,body:JSON.stringify({eventId:crypto.randomUUID(),eventName,timestamp:new Date().toISOString(),sessionId:state.sessionId,briefingId:extra.briefingId||state.briefingId,sectionId:extra.sectionId,sourceId:extra.sourceId,result:extra.result,deviceCategory:innerWidth<600?"mobile":innerWidth<1000?"tablet":"desktop"})}).catch(()=>{})}
function normaliseCompanyUrl(value){try{const raw=String(value||"").trim(),url=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);if(url.protocol!=="https:"||!url.hostname.includes("."))return "";url.hash="";return url.toString()}catch{return ""}}
function displayHost(value){try{return new URL(value).hostname.replace(/^www\./,"")}catch{return ""}}
function companyNameFromUrl(value){return displayHost(value).split(".")[0].replace(/[-_]+/g," ").replace(/\b\w/g,char=>char.toUpperCase())}
function joinThought(meaning,relevance){return [meaning,relevance].filter(Boolean).join(" ")}
function el(tag,className="",text=""){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined&&text!==null)node.textContent=text;return node}
function formatDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?"date unavailable":new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short",year:"numeric"}).format(date)}
function statusClass(status){return status==="confirmed_fact"?"fact":status.includes("interpretation")?"interpretation":"unknown"}
function statusLabel(status){return ({confirmed_fact:"Confirmed",strong_interpretation:"Strong read",possible_interpretation:"Possible read",unknown:"Unknown",unable_to_verify:"Unable to verify"})[status]||status}
function escapeHtml(value){return String(value||"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char])}
let toastTimer;function toast(message){const node=$("#toast");node.textContent=message;node.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove("show"),2600)}

restorePrivate();

