import {ANALYTICS_EVENTS,validateQuiz} from "./schemas.js";

const app=document.getElementById("recordCompanyApp");
const quizDialog=document.getElementById("quizDialog");
const quizContent=document.getElementById("quizContent");
const ding=document.getElementById("quizDing");
const route=parseRoute(location.pathname);
const state={company:null,artist:null,quiz:null,index:0,score:0,timer:null,time:15,timerDeadline:0,locked:true,session:sessionId(),audioContext:null,dingBuffer:null,dingSource:null,quizStartedAt:0,questionStartedAt:0,quizCompleted:false};

prepareAudio();
boot().catch(()=>renderError("This discovery collection is temporarily unavailable."));

async function boot(){
  if(!route.companySlug)return renderError("This record-company collection could not be found.");
  const endpoint=route.artistSlug
    ?`/api/record-company/public/${encodeURIComponent(route.companySlug)}/artists/${encodeURIComponent(route.artistSlug)}`
    :`/api/record-company/public/${encodeURIComponent(route.companySlug)}`;
  const response=await fetch(endpoint,{headers:{accept:"application/json"}});
  if(!response.ok)throw new Error("Public collection unavailable");
  const payload=await response.json();
  state.company=payload.company;state.artist=payload.artist||null;
  applyPalette(state.company.brandPalette);
  if(state.artist)renderArtist(payload);else renderCompany(payload);
  track(state.artist?"artist_page_view":"company_page_view",{artist_id:state.artist?.id});
}

function renderCompany({company,artists}){
  document.title=`${company.name} — Deep Cuts`;
  app.innerHTML=`${header(company)}
    ${company.heroAsset?`<figure class="rc-hero"><img src="${escapeAttr(company.heroAsset)}" alt="${escapeAttr(company.name)}" loading="eager"></figure>`:""}
    <p class="rc-section-label">Start discovering</p>
    <div class="rc-actions">
      <button class="rc-button rc-primary" id="discoverArtist"><span><strong>Discover Our Bands &amp; Artists</strong><small>${artists.length} verified artist${artists.length===1?"":"s"} in this collection</small></span></button>
      <button class="rc-button rc-wide" id="companyQuiz"><span><strong>Discover ${escapeHtml(company.name)}</strong><small>Take the five-question quiz</small></span></button>
      ${linksMarkup(company.links)}
    </div>${footer(company)}`;
  document.getElementById("discoverArtist")?.addEventListener("click",()=>discoverArtist(artists));
  document.getElementById("companyQuiz")?.addEventListener("click",()=>openQuiz(company.quiz,"company"));
  wireOutbound();
}

function renderArtist({company,artist,artists}){
  document.title=`${artist.name} — ${company.name} Deep Cuts`;
  app.innerHTML=`${header(company,artist)}
    ${artist.featuredVideo?.embedUrl?`<figure class="rc-hero rc-video"><iframe src="${escapeAttr(artist.featuredVideo.embedUrl)}" title="${escapeAttr(artist.featuredVideo.title||`${artist.name} featured video`)}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></figure>`:artist.heroAsset?`<figure class="rc-hero"><img src="${escapeAttr(artist.heroAsset)}" alt="${escapeAttr(artist.name)}" loading="eager"></figure>`:""}
    <p class="rc-section-label">Explore ${escapeHtml(artist.name)}</p>
    <div class="rc-actions">
      ${linksMarkup(artist.links)}
      <button class="rc-button rc-wide" id="artistQuiz"><span><strong>Artist Quiz</strong><small>Five positive deep-cut questions</small></span></button>
    </div>
    <div class="rc-utilities">
      <button class="rc-button" id="recommendedArtist"><span><strong>Recommended For You</strong><small>Another label artist</small></span></button>
      <a class="rc-button" id="backCompany" href="/record-company/${encodeURIComponent(company.slug)}"><span><strong>Back to ${escapeHtml(company.name)}</strong><small>Record-company home</small></span></a>
    </div>${footer(company)}`;
  document.getElementById("artistQuiz")?.addEventListener("click",()=>openQuiz(artist.quiz,"artist"));
  document.getElementById("recommendedArtist")?.addEventListener("click",()=>recommendArtist(artists,artist));
  document.getElementById("backCompany")?.addEventListener("click",()=>track("back_to_company",{artist_id:artist.id}));
  rememberViewed(artist.id);wireOutbound();
}

function header(company,artist=null){
  const entity=artist||company;
  return `<header class="rc-header">
    <span class="rc-mark">Deep Cuts</span>
    ${company.logoUrl?`<img class="rc-logo" src="${escapeAttr(company.logoUrl)}" alt="${escapeAttr(company.name)} logo">`:""}
    <p class="rc-context">${artist?`Part of ${escapeHtml(company.name)} — Deep Cuts`:"Record Company Discovery Collection"}</p>
    <h1 class="rc-title">${escapeHtml(entity.name)}</h1>
    <p class="rc-description">${escapeHtml(entity.description||entity.biography||"An independently verified record-company discovery collection.")}</p>
    ${tags(entity.genres,company.location)}
  </header>`;
}
function tags(genres=[],location=""){const values=[...(genres||[]),location].filter(Boolean).slice(0,5);return values.length?`<ul class="rc-tags">${values.map(item=>`<li>${escapeHtml(item)}</li>`).join("")}</ul>`:""}
function linksMarkup(links=[]){return (links||[]).map((link,index)=>`<a class="rc-button ${(links.length%2===1&&index===0)?"rc-wide":""}" href="${escapeAttr(link.url)}" target="_blank" rel="noopener noreferrer" data-outbound="${escapeAttr(link.type)}"><span><strong>${escapeHtml(link.label)}</strong><small>${escapeHtml(link.description||"Open official destination")}</small></span></a>`).join("")}
function footer(company){return `<footer class="rc-footer"><strong>Powered by Deep Cuts</strong><br><span>Independent discovery collection — no endorsement implied</span><br><a href="/record-company/terms.html">Terms</a><a href="/record-company/privacy.html">Privacy</a><span>Updated ${escapeHtml(formatDate(company.updatedAt))}</span></footer>`}

function discoverArtist(artists){const selected=selectFair(artists,null);if(!selected)return;track("discover_artist",{artist_id:selected.id});location.href=`/record-company/${encodeURIComponent(state.company.slug)}/artists/${encodeURIComponent(selected.slug)}`}
function recommendArtist(artists,current){const selected=selectFair(artists,current.id);if(!selected){document.getElementById("recommendedArtist").disabled=true;return}track("recommended_artist",{artist_id:selected.id,from_artist_id:current.id});location.href=`/record-company/${encodeURIComponent(state.company.slug)}/artists/${encodeURIComponent(selected.slug)}`}
function selectFair(artists,excludeId){
  const eligible=(artists||[]).filter(item=>item.id!==excludeId&&item.publicationStatus==="published");
  if(!eligible.length)return null;
  const viewed=new Set(JSON.parse(sessionStorage.getItem(viewKey())||"[]"));
  const unseen=eligible.filter(item=>!viewed.has(item.id));
  const pool=unseen.length?unseen:eligible;
  const last=sessionStorage.getItem(`${viewKey()}:last`);
  const withoutLast=pool.filter(item=>item.id!==last);
  const finalPool=withoutLast.length?withoutLast:pool;
  const selected=finalPool[Math.floor(Math.random()*finalPool.length)];
  sessionStorage.setItem(`${viewKey()}:last`,selected.id);return selected;
}
function rememberViewed(id){const viewed=new Set(JSON.parse(sessionStorage.getItem(viewKey())||"[]"));viewed.add(id);sessionStorage.setItem(viewKey(),JSON.stringify([...viewed]))}
function viewKey(){return `deep-cuts-record-company:${state.company?.id||route.companySlug}:viewed`}

function openQuiz(quiz,type){
  if(!validateQuiz(quiz))return renderError("This quiz is temporarily unavailable.");
  state.quiz=quiz;state.index=0;state.score=0;state.quizStartedAt=performance.now();state.quizCompleted=false;
  track(type==="company"?"company_quiz_started":"artist_quiz_started",{quiz_id:quiz.id});
  renderQuestion();quizDialog.showModal();
}
function renderQuestion(){
  clearInterval(state.timer);state.time=15;state.locked=true;
  const question=state.quiz.questions[state.index];
  quizContent.innerHTML=`<p class="rc-quiz-progress">Question ${state.index+1} of 5</p><h2 tabindex="-1">${escapeHtml(question.question)}</h2>
    <div class="rc-timer" aria-label="15 seconds remaining">15</div>
    <button class="rc-start" type="button">Start Timer</button>
    <div class="rc-answers">${question.options.map((option,index)=>`<button class="rc-answer" type="button" disabled data-answer="${escapeAttr(option)}">${String.fromCharCode(65+index)}. ${escapeHtml(option)}</button>`).join("")}</div>
    <div class="rc-feedback" hidden></div>`;
  quizContent.querySelector("h2").focus();
  quizContent.querySelector(".rc-start").addEventListener("click",startTimer,{once:true});
  quizContent.querySelectorAll(".rc-answer").forEach(button=>button.addEventListener("click",()=>answer(button)));
}
function startTimer(){
  if(!state.locked)return;state.locked=false;unlockAudio();const start=quizContent.querySelector(".rc-start");start.disabled=true;
  state.questionStartedAt=performance.now();
  quizContent.querySelectorAll(".rc-answer").forEach(button=>button.disabled=false);
  state.timerDeadline=performance.now()+15000;
  state.timer=setInterval(updateTimer,50);
}
function updateTimer(){
  if(state.locked)return;
  const timer=quizContent.querySelector(".rc-timer"),remainingMs=state.timerDeadline-performance.now();
  state.time=Math.max(0,Math.ceil(remainingMs/1000));timer.textContent=state.time;timer.setAttribute("aria-label",`${state.time} seconds remaining`);
  if(remainingMs<=0){clearInterval(state.timer);state.timer=null;playDing();finishAnswer(null)}
}
function answer(button){if(state.locked)return;button.classList.add("selected");finishAnswer(button.dataset.answer)}
function finishAnswer(selected){
  if(state.locked)return;state.locked=true;clearInterval(state.timer);state.timer=null;
  const question=state.quiz.questions[state.index],correct=selected===question.correctAnswer;
  if(correct)state.score+=1;
  quizContent.querySelectorAll(".rc-answer").forEach(button=>{button.disabled=true;if(button.dataset.answer===question.correctAnswer)button.classList.add("correct")});
  const feedback=quizContent.querySelector(".rc-feedback");feedback.hidden=false;
  feedback.innerHTML=`<strong>${correct?"Correct.":selected?"Good try.":"Time’s up."}</strong><p>${escapeHtml(question.explanation)}</p><a href="${escapeAttr(question.sourceUrl)}" target="_blank" rel="noopener noreferrer">Verified source</a><button class="rc-next" type="button">${state.index===4?"See Result":"Next Question"}</button>`;
  feedback.querySelector(".rc-next").addEventListener("click",nextQuestion);
  feedback.querySelector("a").addEventListener("click",()=>track("source_opened",{quiz_id:state.quiz.id,question_id:question.id}));
  track("quiz_response",{quiz_id:state.quiz.id,question_id:question.id,question_number:state.index+1,correct,answer_selected:Boolean(selected),response_seconds:Number(((performance.now()-state.questionStartedAt)/1000).toFixed(2))});
}
function nextQuestion(){state.index+=1;if(state.index<5)return renderQuestion();showResult()}
function showResult(){
  const label=state.score===5?"Deep Cuts Expert":state.score>=3?"Discovery Insider":"New Music Explorer";
  state.quizCompleted=true;
  quizContent.innerHTML=`<p class="rc-quiz-progress">Your result</p><h2>${state.score} / 5</h2><div class="rc-feedback"><strong>${label}</strong><p>Every answer opens another part of the story. Keep discovering this collection.</p></div><button class="rc-next" id="quizReplay">Play Again</button><button class="rc-next" id="quizReturn">Return to ${escapeHtml(state.artist?.name||state.company.name)}</button>`;
  track("quiz_completed",{quiz_id:state.quiz.id,final_score:state.score,question_count:5,completion_seconds:Math.round((performance.now()-state.quizStartedAt)/1000)});
  document.getElementById("quizReplay").addEventListener("click",()=>{track("quiz_replayed",{quiz_id:state.quiz.id});state.index=0;state.score=0;renderQuestion()});
  document.getElementById("quizReturn").addEventListener("click",()=>quizDialog.close());
}

quizDialog.addEventListener("close",()=>{clearInterval(state.timer);state.timer=null;stopDing();if(state.quiz&&!state.quizCompleted)track("quiz_abandoned",{quiz_id:state.quiz.id,abandonment_question:state.index+1})});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&state.timer){clearInterval(state.timer);state.timer=null;stopDing();renderQuestion()}});
window.addEventListener("beforeunload",()=>{clearInterval(state.timer);stopDing()});

function wireOutbound(){document.querySelectorAll("[data-outbound]").forEach(link=>link.addEventListener("click",()=>track("outbound_click",{artist_id:state.artist?.id,link_type:link.dataset.outbound})))}
function track(eventType,metadata={}){
  if(!ANALYTICS_EVENTS.includes(eventType))return;
  fetch("/api/record-company/events",{method:"POST",headers:{"content-type":"application/json"},keepalive:true,body:JSON.stringify({record_company_id:state.company?.id,artist_id:metadata.artist_id||state.artist?.id,session_id:state.session,event_type:eventType,event_metadata:metadata,referring_source:document.referrer,device_category:innerWidth<600?"mobile":innerWidth<1000?"tablet":"desktop",timestamp:new Date().toISOString()})}).catch(()=>{});
}
function prepareAudio(){
  ding.preload="auto";ding.playsInline=true;ding.load();
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)return;
  try{
    state.audioContext=new AudioContextClass();
    fetch("/assets/ding.mp3").then(response=>response.ok?response.arrayBuffer():null).then(buffer=>buffer&&state.audioContext.decodeAudioData(buffer)).then(decoded=>{state.dingBuffer=decoded||null}).catch(()=>{});
  }catch{state.audioContext=null}
}
function unlockAudio(){
  state.audioContext?.resume?.().catch(()=>{});
  const volume=ding.volume;ding.volume=.001;ding.currentTime=0;
  try{ding.play()?.then(()=>{ding.pause();ding.currentTime=0;ding.volume=volume}).catch(()=>{ding.volume=volume})}catch{ding.volume=volume}
}
function playDing(){
  stopDing();
  if(state.audioContext?.state==="running"&&state.dingBuffer){
    state.dingSource=state.audioContext.createBufferSource();state.dingSource.buffer=state.dingBuffer;state.dingSource.connect(state.audioContext.destination);state.dingSource.start();return;
  }
  try{ding.currentTime=0;ding.volume=1;ding.play()?.catch(()=>{})}catch{}
}
function stopDing(){
  if(state.dingSource){try{state.dingSource.stop()}catch{}state.dingSource=null}
  try{ding.pause();ding.currentTime=0}catch{}
}
function applyPalette(palette={}){for(const [key,value] of Object.entries({primary:palette.primary,secondary:palette.secondary,accent:palette.accent,surface:palette.surface,text:palette.text})){if(/^#[0-9a-f]{6}$/i.test(value||""))document.documentElement.style.setProperty(`--rc-${key}`,value)}}
function parseRoute(path){const parts=path.split("/").filter(Boolean);return{companySlug:parts[1]||"",artistSlug:parts[2]==="artists"?parts[3]||"":""}}
function sessionId(){const key="deep-cuts-rc-session";let id=sessionStorage.getItem(key);if(!id){id=crypto.randomUUID();sessionStorage.setItem(key,id)}return id}
function formatDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?"recently":new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short",year:"numeric"}).format(date)}
function renderError(message){app.innerHTML=`<section class="rc-error"><span class="rc-mark">Deep Cuts</span><h1>Discovery paused.</h1><p>${escapeHtml(message)}</p><a class="rc-button" href="/record-company/">Return to the collection</a></section>`}
function escapeHtml(value){return String(value||"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function escapeAttr(value){return escapeHtml(value).replace(/`/g,"&#96;")}
