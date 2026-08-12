import catalogue from "../data/archive-catalogue.js";
import mediaManifest from "../data/media-manifest.js";
import { ArchiveService } from "./archive-service.js";

const service = new ArchiveService(catalogue);
const $ = id => document.getElementById(id);
const ui = {
  categoryName: $("categoryName"), categoryPanel: $("categoryPanel"), categoryGrid: $("categoryGrid"),
  video: $("videoPlayer"), audio: $("audioPlayer"), mediaBay: $("mediaBay"),
  loading: $("loadingMessage"), complete: $("completeMessage"), error: $("errorMessage"),
  status: $("statusLabel"), title: $("recordTitle"), meta: $("recordMeta"), ticker: $("tickerText"),
  controls: $("playbackControls"), rights: $("rightsDialog"), rightsTitle: $("rightsTitle"),
  rightsDetails: $("rightsDetails"), sourceLink: $("sourceLink")
};
const state = { category: localStorage.getItem("clearlight.archive.category") || "ALL ARCHIVES", record:null, mediaType:null, recent:[], audioContext:null, analyser:null, animation:null, autoClose:null, retrying:false };

function show(el, yes = true) { el.hidden = !yes; }
function setCategory(category) {
  state.category = category;
  localStorage.setItem("clearlight.archive.category", category);
  ui.categoryName.textContent = category;
  document.querySelectorAll(".category-grid button").forEach(button => button.classList.toggle("active", button.dataset.category === category));
  closeCategories();
}
function renderCategories() {
  ui.categoryGrid.replaceChildren(...service.getCategories().map(category => {
    const button = document.createElement("button");
    button.textContent = category; button.dataset.category = category;
    button.addEventListener("click", () => setCategory(category));
    return button;
  }));
  setCategory(state.category);
}
function openCategories() { ui.categoryPanel.classList.add("open"); ui.categoryPanel.setAttribute("aria-hidden","false"); }
function closeCategories() { ui.categoryPanel.classList.remove("open"); ui.categoryPanel.setAttribute("aria-hidden","true"); }

function stopMedia({ reset = true } = {}) {
  clearTimeout(state.autoClose);
  [ui.audio, ui.video].forEach(media => { media.pause(); if (reset) { media.removeAttribute("src"); media.load(); } });
  document.body.classList.remove("audio-active"); ui.mediaBay.classList.remove("paused");
  ui.mediaBay.classList.remove("video");
  cancelAnimationFrame(state.animation); settleMeters();
}
function updateRecord(record) {
  state.record = record;
  const mode = record.mediaType === "video" ? "NOW SHOWING" : "NOW PLAYING";
  ui.status.textContent = mode;
  ui.title.textContent = record.shortTitle || record.title;
  ui.meta.textContent = [record.year,record.location,record.sourceArchive].filter(Boolean).join(" • ");
  ui.ticker.textContent = record.tickerText;
  ui.rightsTitle.textContent = record.title;
  const fields = [["Archive",record.sourceArchive],["Creator",record.creator],["Year",record.year],["Location",record.location],["Licence",record.licence],["Attribution",record.attribution || "Not required"]];
  ui.rightsDetails.innerHTML = fields.filter(([,v])=>v).map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join("");
  ui.sourceLink.href = record.sourcePageUrl;
}
function choose(mediaType) {
  const record = service.getRandom({ mediaType, category:state.category, excludeIds:state.recent });
  if (!record) { friendlyError(`No approved ${mediaType} records are available in ${state.category}. Choose another category.`); return; }
  playRecord(record);
}
async function playRecord(record) {
  stopMedia(); state.mediaType = record.mediaType; updateRecord(record);
  state.recent = [record.id,...state.recent.filter(id=>id!==record.id)].slice(0,8);
  show(ui.complete,false); show(ui.error,false); show(ui.loading,true); show(ui.controls,true);
  ui.mediaBay.classList.remove("idle");
  const media = record.mediaType === "video" ? ui.video : ui.audio;
  if (record.mediaType === "video") ui.mediaBay.classList.add("video"); else document.body.classList.add("audio-active");
  media.src = mediaManifest[record.id] || record.mediaUrl;
  try {
    await media.play();
    show(ui.loading,false); ui.mediaBay.classList.remove("paused"); setToggleLabel(false);
    if (record.mediaType === "audio") startMeters();
  } catch (error) {
    handleMediaFailure(error);
  }
}
function friendlyError(message) { show(ui.loading,false); ui.error.textContent=message; show(ui.error,true); }
function handleMediaFailure(error) {
  console.warn("Archive media failed",state.record?.id,error); stopMedia({reset:false});
  friendlyError("This archive recording could not be opened. Finding another…");
  if (!state.retrying) { state.retrying=true; setTimeout(()=>{ state.retrying=false; choose(state.mediaType); },1500); }
}
function home() {
  stopMedia(); state.record=null; state.mediaType=null; ui.mediaBay.classList.add("idle");
  show(ui.controls,false); show(ui.loading,false); show(ui.complete,false); show(ui.error,false);
  ui.status.textContent="ARCHIVE READY"; ui.title.textContent="RANDOM HISTORY AWAITS";
  ui.meta.textContent=`${catalogue.filter(r=>r.approved).length} CURATED RECORDS · RIGHTS CHECKED`;
  ui.ticker.textContent="CHOOSE VIDEO, AUDIO, SURPRISE ME OR SELECT CATEGORY TO BEGIN YOUR JOURNEY THROUGH RECORDED HISTORY.";
}
function next() { if (state.mediaType) choose(state.mediaType); }
function togglePlayback() {
  const media = state.mediaType === "video" ? ui.video : ui.audio;
  if (!state.mediaType) return;
  if (media.paused) media.play().then(()=>{ ui.mediaBay.classList.remove("paused"); setToggleLabel(false); if(state.mediaType==="audio") startMeters(); }).catch(handleMediaFailure);
  else { media.pause(); ui.mediaBay.classList.add("paused"); setToggleLabel(true); cancelAnimationFrame(state.animation); settleMeters(); }
}
function setToggleLabel(paused) { document.querySelector('[data-playback="toggle"]').textContent = paused ? "▶ PLAY" : "Ⅱ PAUSE"; }
function ended() {
  cancelAnimationFrame(state.animation); settleMeters(); show(ui.complete,true); setToggleLabel(true);
  if (state.mediaType === "video") state.autoClose=setTimeout(home,7000);
}
function mute() { const media=state.mediaType==="video"?ui.video:ui.audio; media.muted=!media.muted; document.querySelector('[data-playback="mute"]').textContent=media.muted?"×":"◖"; }

function ensureAudioAnalysis() {
  if (state.analyser) return state.analyser;
  const Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx) return null;
  try { state.audioContext=new Ctx(); const source=state.audioContext.createMediaElementSource(ui.audio); state.analyser=state.audioContext.createAnalyser(); state.analyser.fftSize=256; source.connect(state.analyser); state.analyser.connect(state.audioContext.destination); } catch { return null; }
  return state.analyser;
}
function startMeters() {
  const analyser=ensureAudioAnalysis(); if(state.audioContext?.state==="suspended") state.audioContext.resume();
  const data=new Uint8Array(analyser?.frequencyBinCount||64); let phase=0;
  const frame=()=>{ if(ui.audio.paused||ui.audio.ended)return; let level=.42+Math.sin(phase)*.12; if(analyser){analyser.getByteFrequencyData(data); level=data.reduce((a,b)=>a+b,0)/(data.length*255);} phase+=.17; setMeters(level); state.animation=requestAnimationFrame(frame); };
  frame();
}
function setMeters(level) { const root=document.documentElement; root.style.setProperty("--vu-left",`${-37+Math.min(1,level*1.75)*55}deg`); root.style.setProperty("--vu-right",`${-37+Math.min(1,level*1.64+.04)*55}deg`); }
function settleMeters(){ setMeters(0); }

document.querySelectorAll(".archive-keys button").forEach(button=>button.addEventListener("click",()=>{
  const action=button.dataset.action; if(action==="category")openCategories(); else if(action==="surprise")choose(Math.random()<.5?"audio":"video"); else choose(action);
}));
document.querySelectorAll("[data-playback]").forEach(button=>button.addEventListener("click",()=>({home,toggle:togglePlayback,next,mute}[button.dataset.playback]?.())));
[$("closeCategories")].forEach(button=>button.addEventListener("click",closeCategories));
[$("audioPlayer"),$("videoPlayer")].forEach(media=>{ media.addEventListener("ended",ended); media.addEventListener("error",()=>{if(media.src)handleMediaFailure(media.error);}); media.addEventListener("waiting",()=>show(ui.loading,true)); media.addEventListener("playing",()=>show(ui.loading,false)); });
$("rightsButton").addEventListener("click",()=>ui.rights.showModal()); $("closeRights").addEventListener("click",()=>ui.rights.close());
renderCategories(); home();
