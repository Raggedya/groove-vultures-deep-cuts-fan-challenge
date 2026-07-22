import {SALES_SECTION_ORDER} from "./schemas.js";

const state={matches:[],business:null,offering:{},report:null,currentSection:null,briefingId:null,lastResearchRequest:null,sessionId:sessionStorage.getItem("dc-sales-session")||crypto.randomUUID()};
sessionStorage.setItem("dc-sales-session",state.sessionId);

const screens=Object.fromEntries([...document.querySelectorAll("[data-screen]")].map(node=>[node.dataset.screen,node]));
const $=selector=>document.querySelector(selector);

document.addEventListener("click",event=>{
  const action=event.target.closest("[data-action]")?.dataset.action;
  if(!action)return;
  const actions={
    demo:()=>submitSearch("Telstra"),"back-search":()=>show("search"),"back-confirm":()=>show("confirm"),
    home:()=>state.report?show("menu"):show("search"),"new-search":reset,"edit-offering":editOffering,
    save:savePrivate,export:exportPdf,"copy-section":copySection,retry:retry
  };
  actions[action]?.();
});

$("#search-form").addEventListener("submit",event=>{event.preventDefault();const data=new FormData(event.currentTarget);submitSearch(data.get("query"),data.get("website"),data.get("location"))});
$("#offering-form").addEventListener("submit",event=>{event.preventDefault();state.offering=Object.fromEntries(new FormData(event.currentTarget));research()});

async function submitSearch(query,website="",location=""){
  const cleaned=String(query||"").trim();
  if(cleaned.length<2)return toast("Enter a business name");
  track("business_searched");
  show("progress");
  $("#progress-company").textContent=`Finding ${cleaned}`;
  $("#progress-current").textContent="Confirming the business…";
  $("#progress-stages").replaceChildren();
  try{
    const result=await api("/api/sell/identify",{query:cleaned,website,location});
    state.matches=result.matches||[];
    renderMatches();
    show("confirm");
  }catch(error){showError(error.message)}
}

function renderMatches(){
  const list=$("#matches");list.replaceChildren();
  $("#match-empty").classList.toggle("hidden",state.matches.length>0);
  for(const business of state.matches){
    const button=el("button","match-card");button.type="button";
    button.append(el("b","",business.matchConfidence==="high"?"High-confidence match":"Check this match"),el("strong","",business.officialName),el("span","",[business.tradingName,business.industry,business.location,business.publicStatus].filter(Boolean).join(" · ")),el("span","",business.website));
    button.addEventListener("click",()=>confirmBusiness(business));list.append(button);
  }
}

function confirmBusiness(business){
  state.business=business;track("business_confirmed");
  $("#confirmed-company").textContent=`${business.officialName} · ${business.location}`;
  show("offering");
}

async function research(){
  track("offering_entered",{result:state.offering.description?"tailored":"general"});track("research_started");
  state.lastResearchRequest={business:state.business,offering:state.offering};show("progress");
  $("#progress-company").textContent=state.business.officialName;
  $("#progress-current").textContent="Requesting a verified evidence package…";
  $("#progress-stages").replaceChildren();
  try{
    const result=await api("/api/sell/research",state.lastResearchRequest);
    state.report=result.report;state.briefingId=null;
    $("#progress-current").textContent="Evidence checks completed.";
    const stageList=$("#progress-stages");
    for(const stage of state.report.stagesCompleted||[])stageList.append(el("li","",stage));
    track("research_completed");
    if(Object.values(state.report.sections).some(section=>(section.items||[]).some(item=>item.confidence==="Low confidence")))track("low_confidence_result");
    renderMenu();setTimeout(()=>show("menu"),250);
  }catch(error){track("research_failure",{result:error.code||"failed"});showError(error.message)}
}

function renderMenu(){
  const report=state.report;if(!report)return;
  $("#menu-company").textContent=report.business.officialName;
  $("#menu-meta").textContent=`${report.business.industry} · ${report.business.location} · Research cut-off ${formatDate(report.researchCutoff)}`;
  $("#menu-offer").textContent=report.offering?.description?`Tailored to: ${report.offering.description}`:"General sell-to-company analysis";
  $("#report-notice").textContent=report.notice;
  const menu=$("#section-menu");menu.replaceChildren();
  SALES_SECTION_ORDER.forEach(([key,label],index)=>{
    if(key==="executives"&&!report.sections.executives?.people?.length)return;
    const button=el("button","section-button");button.type="button";button.append(el("span","number",String(index+1).padStart(2,"0")),el("strong","",label),el("span","arrow","›"));
    button.addEventListener("click",()=>openSection(key));menu.append(button);
  });
  buildPrintReport();
}

function openSection(key){
  state.currentSection=key;
  const section=state.report.sections[key];
  const root=$("#section-content");root.replaceChildren(el("p","eyebrow",state.report.business.officialName.toUpperCase()),el("h2","",section.title));
  const intro=el("p","lead","Facts, interpretation and practical action are kept separate.");root.append(intro);
  for(const item of section.items||[])root.append(renderInsight(item));
  if(key==="executives")renderPeople(root,section.people||[]);
  if(key==="evidence")renderSources(root,state.report.sources);
  show("section");
  const event=key==="executives"?"executive_section_opened":key==="approach"?"strategy_viewed":key==="tomorrow"?"meeting_briefing_viewed":"section_opened";
  track(event,{sectionId:key});
}

function renderInsight(item){
  const card=el("article","panel insight-card");
  const badges=el("div","status-row");badges.append(el("span",`badge ${statusClass(item.status)}`,statusLabel(item.status)),el("span","badge confidence",item.confidence));
  card.append(badges,el("h3","",item.title));
  const list=el("dl");
  addDefinition(list,"What we found",item.found);addDefinition(list,"What it may mean",item.meaning);addDefinition(list,"Why it matters to you",item.relevance);addDefinition(list,"What I would do",item.action);addDefinition(list,"What to ask",item.question);
  if(item.alternativeExplanation)addDefinition(list,"Alternative explanation",item.alternativeExplanation);
  const evidence=el("div","evidence-links");
  for(const id of item.sourceIds||[]){const source=state.report.sources.find(entry=>entry.id===id);if(source)evidence.append(sourceLink(source))}
  const wrap=el("div");wrap.append(el("dt","","Evidence"),evidence);list.append(wrap);card.append(list);return card;
}

function renderPeople(root,people){
  root.append(el("h3","","Current publicly verified people"));const grid=el("div","people-grid");
  for(const person of people){const source=state.report.sources.find(item=>item.id===person.sourceId);const card=el("article","panel person-card");card.append(el("h3","",person.name),el("strong","",person.title),el("p","",person.why),el("p","",`Best legitimate approach: ${person.approach}`),el("small","",`Verified ${formatDate(person.verifiedAt)} · ${person.confidence}`));if(source)card.append(sourceLink(source));grid.append(card)}
  root.append(grid);
}

function renderSources(root,sources){
  const register=el("div","source-register");
  for(const source of sources){const card=el("article","panel source-record");const link=el("a","",source.title);link.href=source.url;link.target="_blank";link.rel="noopener noreferrer";link.addEventListener("click",()=>track("source_opened",{sectionId:"evidence",sourceId:source.id}));card.append(link,el("p","source-meta",[source.publisher,source.publishedAt?formatDate(source.publishedAt):"Publication date not stated",source.sourceType.replaceAll("_"," ")].join(" · ")),el("p","",source.relevance),el("p","",`Accessed ${formatDate(source.accessedAt)}`));register.append(card)}
  root.append(register);
}

function sourceLink(source){const link=el("a","source-link",source.publisher);link.href=source.url;link.target="_blank";link.rel="noopener noreferrer";link.title=source.title;link.addEventListener("click",()=>track("source_opened",{sectionId:state.currentSection,sourceId:source.id}));return link}

async function savePrivate(){
  if(!state.report)return;
  try{
    const saved=await api("/api/sell/briefings",{report:state.report});state.briefingId=saved.briefingId;
    const url=new URL(location.href);url.search="";url.hash=new URLSearchParams({brief:saved.briefingId,token:saved.accessToken}).toString();
    await navigator.clipboard.writeText(url.toString());track("briefing_saved",{briefingId:saved.briefingId});track("private_share_created",{briefingId:saved.briefingId});
    toast("Private link copied. It expires in 30 days.");
  }catch(error){toast(error.message)}
}

function exportPdf(){if(!state.report)return;track("report_exported",{briefingId:state.briefingId,result:"print_pdf"});window.print()}

async function copySection(){
  if(!state.currentSection)return;const section=state.report.sections[state.currentSection];
  const text=[section.title,...(section.items||[]).flatMap(item=>["",item.title,`What we found: ${item.found}`,`What it may mean: ${item.meaning}`,`Why it matters to you: ${item.relevance}`,`What I would do: ${item.action}`,`What to ask: ${item.question}`,`Confidence: ${item.confidence}`])].join("\n");
  await navigator.clipboard.writeText(text);toast("Section copied");
}

function buildPrintReport(){
  document.querySelector(".print-report")?.remove();const root=el("div","print-report print-only");root.append(el("h2","","Complete briefing"));
  for(const [key,label] of SALES_SECTION_ORDER){const section=state.report.sections[key];root.append(el("h2","",label));for(const item of section.items||[])root.append(renderInsight(item));if(key==="evidence")renderSources(root,state.report.sources)}
  screens.menu.append(root);
}

function editOffering(){
  const form=$("#offering-form");for(const [key,value] of Object.entries(state.offering||{}))if(form.elements[key])form.elements[key].value=value;
  $("#confirmed-company").textContent=`${state.business.officialName} · ${state.business.location}`;show("offering");
}

function retry(){if(state.business)show("offering");else show("search")}
function reset(){state.matches=[];state.business=null;state.offering={};state.report=null;state.currentSection=null;state.briefingId=null;history.replaceState(null,"",location.pathname);track("new_search_started");$("#search-form").reset();$("#offering-form").reset();show("search")}

function show(name){for(const [key,node] of Object.entries(screens))node.classList.toggle("active",key===name);const hasReport=Boolean(state.report);document.querySelectorAll('[data-action="new-search"],[data-action="edit-offering"]').forEach(node=>node.classList.toggle("hidden",!hasReport));scrollTo({top:0,behavior:"instant"})}
function showError(message){$("#error-message").textContent=message;show("error")}

async function restorePrivate(){
  const params=new URLSearchParams(location.hash.slice(1));const id=params.get("brief"),token=params.get("token");if(!id||!token)return;
  show("progress");$("#progress-company").textContent="Opening private briefing";$("#progress-current").textContent="Checking private access…";
  try{const response=await fetch(`/api/sell/briefings/${encodeURIComponent(id)}`,{headers:{authorization:`Bearer ${token}`}});const result=await response.json();if(!response.ok)throw new Error(result.error||"Private briefing could not be opened");state.report=result.report;state.business=result.report.business;state.offering=result.report.offering||{};state.briefingId=id;renderMenu();show("menu")}catch(error){showError(error.message)}
}

async function api(path,body){
  const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const result=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(result.error||"The request could not be completed");error.code=result.code;throw error}return result;
}

function track(eventName,extra={}){fetch("/api/sell/events",{method:"POST",headers:{"content-type":"application/json"},keepalive:true,body:JSON.stringify({eventId:crypto.randomUUID(),eventName,timestamp:new Date().toISOString(),sessionId:state.sessionId,briefingId:extra.briefingId||state.briefingId,sectionId:extra.sectionId,sourceId:extra.sourceId,result:extra.result,deviceCategory:innerWidth<600?"mobile":innerWidth<1000?"tablet":"desktop"})}).catch(()=>{})}
function addDefinition(list,title,value){const wrap=el("div");wrap.append(el("dt","",title),el("dd","",value||"Not available"));list.append(wrap)}
function el(tag,className="",text=""){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined&&text!==null)node.textContent=text;return node}
function formatDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?"date unavailable":new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short",year:"numeric"}).format(date)}
function statusClass(status){return status==="confirmed_fact"?"fact":status.includes("interpretation")?"interpretation":"unknown"}
function statusLabel(status){return ({confirmed_fact:"Confirmed fact",strong_interpretation:"Strong interpretation",possible_interpretation:"Possible interpretation",unknown:"Unknown",unable_to_verify:"Unable to verify"})[status]||status}
let toastTimer;function toast(message){const node=$("#toast");node.textContent=message;node.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove("show"),2600)}

restorePrivate();
