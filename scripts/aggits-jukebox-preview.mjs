import { aggitsJukeboxIconAsset } from "./aggits-jukebox-icons.mjs";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

export const MAHOGANY_FIXED_MARQUEE = "AGGITS";
export const MAHOGANY_RENDERER_VERSION =
  "mahogany-jukebox/2026-08-08-v7";
export const MAHOGANY_FIXED_MARQUEE_ASSET =
  "/assets/aggits-marquee-reference-v1.jpg";
export const MAHOGANY_FIXED_MARQUEE_SHA256 =
  "534ff813039151e01b1734dd2b1fb638d5228f226b6b1de6e9a5c5f4f91cdf21";
export const MAHOGANY_OVAL_CABINET_ASSET =
  "/assets/aggits-jukebox-illuminated-master-v3.png";
export const MAHOGANY_OVAL_CABINET_SHA256 =
  "c42731d8f90b7c53ddbf44ee65a16930c8315c170fb5fa68cd9a81db7d7c9262";
export const MAHOGANY_BUTTON_CLUNK_ASSET =
  "/assets/audio/jukebox-mechanical-button-clunk-public-domain.ogg";
export const MAHOGANY_AGGITS_COIN_ASSET =
  "/assets/aggits-coin-gold-v1.png";
export const MAHOGANY_AGGITS_COIN_SHA256 =
  "a98943dec001c831ea8709eb260f87062782009cfd3a6665247be8585c3f87e1";
export const MAHOGANY_BUTTON_CLUNK_SHA256 =
  "d45c44c7cf8d700216c7f56182a430183df64880fe6aab834552daa6af6d5919";
export const MAHOGANY_BUTTON_LINK_DELAY_MS = 500;
export const MAHOGANY_BUTTON_ATTENTION_START_SECONDS = 45.14;
export const MAHOGANY_BUTTON_ATTENTION_FLASH_SECONDS = 0.5;
export const MAHOGANY_BUTTON_ATTENTION_BUTTON_COUNT = 4;
export const MAHOGANY_BUTTON_ATTENTION_CYCLES = 3;
export const MAHOGANY_BUTTON_ATTENTION_END_SECONDS =
  Number(
    (
      MAHOGANY_BUTTON_ATTENTION_START_SECONDS +
      MAHOGANY_BUTTON_ATTENTION_FLASH_SECONDS *
        MAHOGANY_BUTTON_ATTENTION_BUTTON_COUNT *
        MAHOGANY_BUTTON_ATTENTION_CYCLES
    ).toFixed(3),
  );

export function mahoganyButtonAttentionIndex(mediaTime) {
  const time = Number(mediaTime);
  if (
    !Number.isFinite(time) ||
    time < MAHOGANY_BUTTON_ATTENTION_START_SECONDS ||
    time >= MAHOGANY_BUTTON_ATTENTION_END_SECONDS
  )
    return -1;
  return (
    Math.floor(
      (time - MAHOGANY_BUTTON_ATTENTION_START_SECONDS + Number.EPSILON * 64) /
        MAHOGANY_BUTTON_ATTENTION_FLASH_SECONDS,
    ) % MAHOGANY_BUTTON_ATTENTION_BUTTON_COUNT
  );
}

export function isMahoganyButtonAttentionTime(mediaTime) {
  return mahoganyButtonAttentionIndex(mediaTime) >= 0;
}

function youtubeVideoId(value) {
  const text = String(value || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.hostname === "youtu.be")
      return /^[A-Za-z0-9_-]{11}$/.test(url.pathname.slice(1))
        ? url.pathname.slice(1)
        : "";
    if (!/(^|\.)youtube\.com$/.test(url.hostname)) return "";
    const candidate =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : (url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/) || [])[1];
    return /^[A-Za-z0-9_-]{11}$/.test(String(candidate || "")) ? candidate : "";
  } catch {
    return "";
  }
}

export function renderAggitsJukeboxStudioPreview(
  project,
  {
    videoUrl = "",
    youtubeUrl = "",
    scriptNonce = "",
    publicMode = false,
    canonicalUrl = "",
  } = {},
) {
  const input = project.input;
  const ticker = (
    input.tickerText || "ADD THE EDITION TICKER MESSAGE IN DEEP CUTS STUDIO."
  ).toUpperCase();
  const actions = (
    Array.isArray(input.actionButtons) ? input.actionButtons : []
  ).slice(0, 4);
  const buttons = Array.from({ length: 4 }, (_, index) => {
    const action = actions[index] || {};
    const enabled = action.enabled && action.href && action.label;
    const icon = aggitsJukeboxIconAsset(action.iconId);
    const content = `${
      icon
        ? `<span class="action-icon" aria-hidden="true"><img src="${esc(icon)}" alt=""></span>`
        : ""
    }<span class="attention-flash-border" aria-hidden="true"></span>`;
    if (!enabled)
      return `<span class="action is-disabled" data-slot="${index + 1}" aria-hidden="true">${content}</span>`;
    return `<a class="action" data-slot="${index + 1}" data-enabled="true" data-href="${esc(action.href)}" data-new-tab="true" aria-disabled="true" tabindex="-1" aria-label="${esc(action.label)} (opens in a new tab)">${content}</a>`;
  }).join("");
  const youtubeId = youtubeVideoId(
    youtubeUrl || input.youtubeUrl || project.youtubeUrl,
  );
  const youtubeOrigin = (() => {
    try {
      const origin = new URL(canonicalUrl || "").origin;
      return /^https?:\/\//i.test(origin) ? origin : "";
    } catch {
      return "";
    }
  })();
  const youtubeOriginQuery = youtubeOrigin
    ? `&amp;origin=${encodeURIComponent(youtubeOrigin)}`
    : "";
  const video = youtubeId
    ? `<iframe id="welcomeFrame" src="https://www.youtube-nocookie.com/embed/${youtubeId}?enablejsapi=1&amp;rel=0&amp;playsinline=1${youtubeOriginQuery}" title="${esc(input.name || "Mahogany Jukebox")} video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
    : project.mp4 && videoUrl
      ? `<video id="welcomeVideo" controls playsinline webkit-playsinline preload="metadata" src="${esc(videoUrl)}" aria-label="${esc(input.name || "Mahogany Jukebox")} video"></video>`
      : `<div class="video-wait"><strong>VIDEO REQUIRED</strong><span>Add a YouTube URL or choose an MP4.</span></div>`;
  const sessionKey = publicMode
    ? `aggitsJukeboxActivated:${project.editionId || project.id}`
    : `deepCutsStudioAggitsJukeboxActivated:${project.id}`;
  const bassPulseMode = input.bassPulseMode === "ripple" ? "ripple" : "together";
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#080402">
  <meta name="deep-cuts-renderer" content="${MAHOGANY_RENDERER_VERSION}">
  <title>${esc(input.name || "Aggits Jukebox")} Studio Preview</title>
  <link rel="preload" href="${MAHOGANY_OVAL_CABINET_ASSET}" as="image">
  <style>
    *{box-sizing:border-box}[hidden]{display:none!important}html{background:#030201}body{margin:0;min-height:100vh;background:#030201;color:#f4d99c;font-family:Georgia,"Times New Roman",serif}button,a{font:inherit}
    main{width:min(100%,466px);margin:auto;padding:0 0 34px}.draft{display:flex;justify-content:space-between;gap:10px;padding:9px 13px;background:#090504;color:#b58b4b;font:800 8px/1.2 Arial,sans-serif;letter-spacing:.13em}.draft b{color:${project.readiness.handoffReady ? "#d9edb7" : "#ffd37b"}}
    .machine{position:relative;width:100%;aspect-ratio:864/1536;overflow:hidden;background-color:rgba(0,0,0,.58);background-image:url("${MAHOGANY_OVAL_CABINET_ASSET}");background-position:center;background-size:100% 100%;background-repeat:no-repeat;background-blend-mode:multiply;transition:background-color .65s ease}.machine:before{position:absolute;z-index:2;top:3.6%;left:12%;width:76%;height:15.5%;content:"";pointer-events:none;background:radial-gradient(ellipse at 50% 54%,rgba(255,183,76,.24),rgba(203,104,23,.07) 44%,transparent 72%);mix-blend-mode:screen;opacity:0;transition:opacity 1.05s ease}.machine:after{position:absolute;z-index:1;inset:0;content:"";pointer-events:none;background:radial-gradient(ellipse 80% 45% at 50% 7%,rgba(255,190,91,.12),transparent 64%),linear-gradient(90deg,rgba(111,12,7,.07),transparent 16% 84%,rgba(111,12,7,.07));mix-blend-mode:screen;opacity:.1;transition:opacity .7s}.machine.is-awake,.machine.is-powering{background-color:rgba(0,0,0,0)}.machine.is-awake:before,.machine.is-powering:before{opacity:.3}.machine.is-awake:after,.machine.is-powering:after{opacity:.4}.machine.is-paused .ticker span{animation-play-state:paused}
    .ticker{position:absolute;z-index:3;top:19.02%;left:13.65%;width:72.65%;height:5.05%;display:flex;align-items:center;overflow:hidden;border-radius:8%;background:#030201;box-shadow:inset 0 0 13px #000;filter:brightness(.32);transition:filter .45s}.ticker:before{flex:none;margin-left:2.8%;content:"★";color:#f2d38a;font-size:clamp(13px,4vw,21px);text-shadow:0 0 4px #d99a32,0 0 8px rgba(122,63,18,.48)}.ticker span{display:block;width:max-content;padding-left:100%;color:#f2d38a;font:900 clamp(11px,3.45vw,19px)/1 "Courier New",monospace;letter-spacing:.055em;text-shadow:0 0 2px #fff0b8,0 0 6px #d99a32,0 0 10px rgba(122,63,18,.42);white-space:nowrap;animation:ticker 31s linear infinite;animation-play-state:paused}.machine.is-ticker-on .ticker{filter:brightness(1.08)}.machine.is-ticker-on .ticker span{animation-play-state:running}
    .video{position:absolute;z-index:3;top:25.84%;left:23.55%;width:64.78%;height:29.3%;overflow:hidden;border:0;background:#000;box-shadow:none}.video:after{position:absolute;z-index:4;inset:0;content:"";pointer-events:none;background:#010101;opacity:.82;transition:opacity .45s}.machine.is-screen-on .video:after{opacity:0}.video video,.video iframe{display:block;width:100%;height:100%;border:0;border-radius:0;background:#000;object-fit:cover;object-position:center;filter:brightness(.26) saturate(.44);transition:filter .45s}.machine.is-screen-on .video video,.machine.is-screen-on .video iframe{filter:none}.video-wait{height:100%;display:grid;align-content:center;justify-items:center;padding:12%;color:#9d7840;text-align:center}.video-wait strong{font:900 12px/1 Arial,sans-serif;letter-spacing:.1em}.video-wait span{margin-top:8px;color:#765a35;font:10px/1.45 Arial,sans-serif}
    .coin-control{position:absolute;z-index:6;top:34.15%;left:16.7%;width:9.4%;aspect-ratio:1;height:auto;padding:0;border:0;outline:0;background:transparent;cursor:pointer;touch-action:manipulation;perspective:160px}.coin-art{display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,.88)) brightness(.94);transform:translateX(0) rotateY(0deg);transform-origin:8% 50%;animation:coinCall 2.8s ease-in-out infinite}.coin-control:focus-visible{filter:drop-shadow(0 0 2px #fff1ba) drop-shadow(0 0 8px rgba(255,208,92,.84))}.machine.is-accepting .coin-art{animation:coinInsert .62s cubic-bezier(.34,.02,.75,.34) forwards}.machine.is-awake .coin-control{pointer-events:none}.machine.is-awake .coin-art{animation:none;opacity:0}
    .actions{position:absolute;z-index:4;top:55.9%;left:12.05%;width:73.5%;height:18.2%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.45%;padding:.5% .25%;overflow:visible;background:transparent}.action{--bass-level:0;--bass-scale:1;position:relative;z-index:1;display:grid;place-items:center;min-width:0;min-height:0;padding:12%;overflow:hidden;border:0;border-radius:50%;background:transparent;color:#d5a355;text-decoration:none;filter:brightness(.34) saturate(.5);opacity:.68;pointer-events:none;transform:scale(var(--bass-scale));box-shadow:none;transition:filter .3s ease,opacity .3s ease,transform .14s cubic-bezier(.2,.7,.2,1),box-shadow .14s ease}.action:after{position:absolute;z-index:0;inset:4.5% 5.5%;content:"";pointer-events:none;border-radius:50%;background:radial-gradient(ellipse at 50% 43%,rgba(255,213,132,.24),rgba(230,143,42,.09) 48%,transparent 72%);box-shadow:inset 0 0 clamp(7px,2vw,14px) rgba(255,186,73,.62),inset 0 0 0 clamp(1px,.35vw,2px) rgba(255,222,147,.68);opacity:calc(var(--bass-level) * .82);transition:opacity 70ms linear}.action-icon{position:relative;z-index:1;display:block;width:68%;aspect-ratio:1;overflow:visible}.action-icon img{position:absolute;top:50%;left:50%;display:block;width:100%;height:100%;max-width:none;object-fit:contain;transform:translate(-50%,-50%);filter:drop-shadow(0 2px 2px rgba(0,0,0,.8))}.machine.is-buttons-ready .action[data-enabled="true"]{filter:brightness(calc(.98 + var(--bass-level) * .18)) saturate(calc(.94 + var(--bass-level) * .12));opacity:1;pointer-events:auto}.action:focus-visible{outline:0;box-shadow:inset 0 0 0 clamp(2px,.55vw,4px) #ffe9ae,inset 0 0 0 clamp(4px,1vw,7px) #8b5725}.action.is-depressed{background:rgba(2,1,0,.44);transform:perspective(180px) translateY(4.5%) scale(.955) rotateX(-3deg);filter:brightness(.7) saturate(.75)!important;box-shadow:inset 0 12px 18px #000,inset 0 -2px 5px rgba(182,115,42,.11)}.action.is-depressed:after{opacity:0}.action.is-depressed .action-icon{transform:translateY(2px)}.action.is-disabled{filter:brightness(.18) saturate(.22);opacity:.18}
    .attention-flash-border{position:absolute;z-index:3;inset:2.8% 3.6%;display:block;overflow:hidden;border:clamp(2px,.65vw,4px) solid #ffd36a;border-radius:50%;background:transparent;box-shadow:inset 0 0 clamp(4px,1.3vw,9px) #ffb000,inset 0 0 clamp(10px,2.5vw,18px) rgba(255,176,0,.82),0 0 clamp(5px,1.45vw,10px) #ffb000,0 0 clamp(12px,3vw,22px) rgba(255,176,0,.72);opacity:0;pointer-events:none}.action.is-attention-flash .attention-flash-border{opacity:1}
    .share{position:absolute;z-index:5;top:77.15%;left:13.35%;width:73.3%;height:5.95%;border:0;background:transparent;color:transparent;cursor:pointer;pointer-events:none}.share:focus-visible{outline:3px solid #ffe6a0;outline-offset:-5px}.machine.is-awake .share{pointer-events:auto}.status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
    .gate{padding:16px 20px 5px;color:#9b7b55;text-align:center;font:9px/1.55 Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase}.gate strong{display:block;margin-bottom:6px;color:${project.readiness.handoffReady ? "#d7e8aa" : "#ffd37b"};font-size:11px}.gate code{display:block;margin-top:7px;color:#d5b47a;font-family:inherit}.footer{padding:22px 0 0;color:#806b5d;font:9px/1.8 Arial,sans-serif;letter-spacing:.08em;text-align:center}.footer strong{color:#b89a7d;letter-spacing:.15em}
    @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-100%)}}@keyframes coinCall{0%,63%,100%{filter:drop-shadow(0 2px 4px rgba(0,0,0,.88)) brightness(.94)}78%{filter:drop-shadow(0 2px 5px rgba(0,0,0,.92)) brightness(1.08)}}@keyframes coinInsert{0%{transform:translateX(0) rotateY(0deg);opacity:1}62%{transform:translateX(-38%) rotateY(66deg) scale(.9);opacity:1}100%{transform:translateX(-56%) rotateY(88deg) scale(.82);opacity:0}}
    @media(prefers-reduced-motion:reduce){.machine,.machine:before,.machine:after,.ticker,.video:after,.video video,.action{transition:none}.coin-art{animation:none}.machine.is-accepting .coin-art{animation:coinInsertReduced .18s linear forwards}.ticker span{width:100%;padding:0 3%;overflow:hidden;text-overflow:ellipsis;animation:none}.machine.is-ticker-on .ticker span{animation:none}.machine.is-buttons-ready .action[data-enabled="true"]{--bass-scale:1!important;filter:brightness(calc(.96 + var(--bass-level) * .22)) saturate(calc(.9 + var(--bass-level) * .16));opacity:1}}@keyframes coinInsertReduced{to{transform:translateX(-56%) rotateY(88deg) scale(.82);opacity:0}}
  </style>
</head>
<body>
  <main>
    ${publicMode ? "" : `<div class="draft"><span>MAHOGANY JUKEBOX</span><b>${project.readiness.handoffReady ? "CONFIGURATION READY" : "DRAFT"}</b></div>`}
    <section id="machine" class="machine" data-renderer-version="${MAHOGANY_RENDERER_VERSION}" aria-label="${esc(input.name || "Edition")} Mahogany Jukebox preview">
      <div class="ticker" role="status" aria-label="Edition ticker"><span>${esc(ticker)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
      <div class="video">${video}</div>
      <button id="coinButton" class="coin-control" type="button" aria-label="Insert the gold Aggits coin and start the Mahogany Jukebox"><img class="coin-art" src="${MAHOGANY_AGGITS_COIN_ASSET}" alt=""></button>
      <nav id="actions" class="actions" aria-label="Edition actions">${buttons}</nav>
      <button id="shareButton" class="share" type="button" aria-label="Share ${esc(input.name || "this Aggits Jukebox")}" aria-disabled="true"></button>
      <p id="status" class="status" aria-live="polite">Insert the coin to start.</p>
    </section>
    ${publicMode ? "" : `<div class="gate"><strong>${project.readiness.handoffReady ? "CONFIGURATION COMPLETE" : "ADMINISTRATOR INPUT REQUIRED"}</strong>The title, ticker, selected video and four action slots are stored with this isolated project.<code>MP4 OPTION: 1804 × 1436 px · H.264 · fill canvas · no black padding</code></div>`}
    <footer class="footer" aria-label="Deep Cuts platform"><strong>Deep Cuts</strong><br>Copyright Clearlight Creative</footer>
  </main>
  <link rel="preload" href="/assets/audio/jukebox-real-coin-insert-cc0.mp3" as="audio" type="audio/mpeg">
  <link rel="preload" href="${MAHOGANY_BUTTON_CLUNK_ASSET}" as="audio" type="audio/ogg">
  <audio id="buttonClunk" preload="auto" src="${MAHOGANY_BUTTON_CLUNK_ASSET}"></audio>
  <script src="/assets/js/jookbox-coin-audio.js"></script>
  <script${scriptNonce ? ` nonce="${esc(scriptNonce)}"` : ""}>
    (()=>{const machine=document.getElementById("machine"),coin=document.getElementById("coinButton"),video=document.getElementById("welcomeVideo"),frame=document.getElementById("welcomeFrame"),sound=window.DeepCutsJookBoxCoinAudio?.create("/assets/audio/jukebox-real-coin-insert-cc0.mp3",{volume:1,gain:1.15}),buttonClunk=document.getElementById("buttonClunk"),status=document.getElementById("status"),share=document.getElementById("shareButton"),buttonKeys=[...document.querySelectorAll(".action")],actions=[...document.querySelectorAll('.action[data-enabled="true"]')],sessionKey=${JSON.stringify(sessionKey)},shareUrl=${JSON.stringify(canonicalUrl || "")},projectTitle=${JSON.stringify(input.name || "Mahogany Jukebox")},bassMode=${JSON.stringify(bassPulseMode)},reducedMotion=matchMedia("(prefers-reduced-motion: reduce)").matches,attentionStart=${MAHOGANY_BUTTON_ATTENTION_START_SECONDS},attentionFlash=${MAHOGANY_BUTTON_ATTENTION_FLASH_SECONDS},attentionButtonCount=${MAHOGANY_BUTTON_ATTENTION_BUTTON_COUNT},attentionEnd=${MAHOGANY_BUTTON_ATTENTION_END_SECONDS},youtubeOrigin="https://www.youtube-nocookie.com",youtubeMessageOrigins=new Set(["https://www.youtube-nocookie.com","https://www.youtube.com"]);let state="sleeping",timers=[],launchTimer=0,audioContext=null,analyser=null,frequencyData=null,mediaSource=null,bassFrame=0,bassRunning=false,bassFallback=Boolean(frame),youtubePlaying=false,youtubeClockTimer=0,adaptiveBass=.08,smoothedBass=0,rippleHistory=[0,0,0,0,0,0,0,0,0,0,0,0],attentionFrame=0,attentionFrameKind="",attentionWatchdog=0,attentionActive=-1,attentionSource="";
      const later=(callback,delay)=>{const timer=setTimeout(()=>{timers=timers.filter(value=>value!==timer);callback()},delay);timers.push(timer)};
      const clearTimers=()=>{timers.forEach(clearTimeout);timers=[]};
      const applyBassLevels=levels=>{actions.forEach((action,index)=>{const level=Math.max(0,Math.min(.82,Number(levels[index]??levels[0])||0));action.style.setProperty("--bass-level",level.toFixed(3));action.style.setProperty("--bass-scale",reducedMotion?"1":String(1+level*.015))})};
      const clearBass=()=>{cancelAnimationFrame(bassFrame);bassFrame=0;bassRunning=false;smoothedBass=0;applyBassLevels([0])};
      const setAttentionFlash=index=>{const next=Number.isInteger(index)?index:-1;if(attentionActive===next)return;attentionActive=next;buttonKeys.forEach((key,keyIndex)=>key.classList.toggle("is-attention-flash",keyIndex===next))};
      const resetAttentionFlash=source=>{attentionSource=String(source||"");setAttentionFlash(-1)};
      const syncAttentionFlash=(mediaTime,source)=>{const time=Number(mediaTime),nextSource=String(source||"");if(!Number.isFinite(time))return;if(nextSource&&nextSource!==attentionSource)resetAttentionFlash(nextSource);const index=time>=attentionStart&&time<attentionEnd?Math.floor((time-attentionStart+Number.EPSILON*64)/attentionFlash)%attentionButtonCount:-1;setAttentionFlash(index)};
      const stopAttentionMonitor=()=>{if(attentionFrame){if(attentionFrameKind==="video")video?.cancelVideoFrameCallback?.(attentionFrame);else cancelAnimationFrame(attentionFrame)}clearInterval(attentionWatchdog);attentionFrame=0;attentionFrameKind="";attentionWatchdog=0};
      const attentionTick=(now,metadata)=>{attentionFrame=0;attentionFrameKind="";if(!video)return;syncAttentionFlash(Number.isFinite(metadata?.mediaTime)?metadata.mediaTime:video.currentTime,video.currentSrc||video.src);if(video.paused||video.ended||document.hidden)return;if(typeof video.requestVideoFrameCallback==="function"){attentionFrameKind="video";attentionFrame=video.requestVideoFrameCallback(attentionTick)}else{attentionFrameKind="animation";attentionFrame=requestAnimationFrame(attentionTick)}};
      const startAttentionMonitor=()=>{if(!video||video.paused||video.ended||document.hidden)return;if(!attentionFrame){if(typeof video.requestVideoFrameCallback==="function"){attentionFrameKind="video";attentionFrame=video.requestVideoFrameCallback(attentionTick)}else{attentionFrameKind="animation";attentionFrame=requestAnimationFrame(attentionTick)}}if(!attentionWatchdog)attentionWatchdog=setInterval(()=>syncAttentionFlash(video.currentTime,video.currentSrc||video.src),50)};
      const postYouTube=(func,args=[])=>{if(!frame?.contentWindow)return;frame.contentWindow.postMessage(JSON.stringify({event:"command",func,args,id:"welcomeFrame"}),youtubeOrigin)};
      const requestYouTubeTime=()=>{if(!document.hidden)postYouTube("getCurrentTime")};
      const stopYouTubeClock=()=>{clearInterval(youtubeClockTimer);youtubeClockTimer=0};
      const startYouTubeClock=()=>{if(!frame||youtubeClockTimer||document.hidden)return;requestYouTubeTime();youtubeClockTimer=setInterval(requestYouTubeTime,80)};
      const connectYouTube=()=>{if(!frame?.contentWindow)return;frame.contentWindow.postMessage(JSON.stringify({event:"listening",id:"welcomeFrame"}),youtubeOrigin);postYouTube("addEventListener",["onStateChange"]);postYouTube("getCurrentTime")};
      const mediaIsPlaying=()=>state==="awake"&&!document.hidden&&(video?!video.paused&&!video.ended&&!video.muted&&video.volume>0:youtubePlaying);
      const measuredBass=()=>{if(!analyser||!frequencyData)return 0;analyser.getByteFrequencyData(frequencyData);const binHz=audioContext.sampleRate/analyser.fftSize,low=Math.max(1,Math.ceil(40/binHz)),high=Math.min(frequencyData.length-1,Math.floor(180/binHz));let total=0;for(let index=low;index<=high;index+=1)total+=frequencyData[index];const raw=total/Math.max(1,high-low+1)/255;adaptiveBass=adaptiveBass*.94+raw*.06;const threshold=Math.max(.08,adaptiveBass+.035);return raw>threshold?Math.min(.82,.16+(raw-threshold)*5.2):0};
      const simulatedBass=now=>{const phase=(now%620)/620;return phase<.24?Math.min(.46,Math.pow(1-phase/.24,2)*.46):0};
      const bassTick=now=>{if(!mediaIsPlaying()){clearBass();return}const target=bassFallback?simulatedBass(now):measuredBass();smoothedBass+=(target-smoothedBass)*(target>smoothedBass?.38:.12);if(bassMode==="ripple"){rippleHistory.unshift(smoothedBass);rippleHistory.length=12;applyBassLevels(actions.map((_,index)=>rippleHistory[index*3]||0))}else applyBassLevels([smoothedBass]);bassFrame=requestAnimationFrame(bassTick)};
      const startBass=()=>{if(bassRunning||!mediaIsPlaying())return;bassRunning=true;bassFrame=requestAnimationFrame(bassTick)};
      const prepareBass=async()=>{if(!video||analyser)return Boolean(analyser);try{const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)throw new Error("Web Audio is unavailable.");audioContext=audioContext||new AudioContext();mediaSource=mediaSource||audioContext.createMediaElementSource(video);analyser=audioContext.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.72;frequencyData=new Uint8Array(analyser.frequencyBinCount);mediaSource.connect(analyser);analyser.connect(audioContext.destination);await audioContext.resume();bassFallback=false;return true}catch(error){bassFallback=true;console.warn("Real bass analysis is unavailable; using the restrained timing fallback.",error);return false}};
      const unlock=()=>{actions.forEach(action=>{action.href=action.dataset.href;if(action.dataset.newTab==="true"){action.target="_blank";action.rel="noopener noreferrer"}action.removeAttribute("aria-disabled");action.tabIndex=0});share.removeAttribute("aria-disabled")};
      const enableActions=()=>{machine.classList.add("is-buttons-ready");unlock()};
      const awaken=(restore=false)=>{if(state!=="sleeping")return;state=restore?"awake":"acceptingCoin";machine.classList.add(restore?"is-awake":"is-accepting");if(!restore){if(video)prepareBass();if(frame)connectYouTube();const startVideo=()=>{if(video){resetAttentionFlash(video.currentSrc||video.src);video.currentTime=0;const playback=video.play();playback?.catch?.(()=>{status.textContent="Coin accepted — press Play to start the video."})}if(frame){resetAttentionFlash(frame.src);connectYouTube();startYouTubeClock();postYouTube("playVideo")}};const coinPlayback=sound?.play();if(coinPlayback?.then)coinPlayback.then(startVideo).catch(error=>{console.warn("Coin recording could not be played.",error);startVideo()});else startVideo();try{sessionStorage.setItem(sessionKey,"true")}catch{}later(()=>machine.classList.add("is-powering"),180);later(()=>machine.classList.add("is-screen-on"),780);later(()=>machine.classList.add("is-ticker-on"),1280);later(()=>{machine.classList.add("is-awake");state="awake";status.textContent="Coin accepted — Jukebox is live.";startBass();startAttentionMonitor();startYouTubeClock()},1800);later(enableActions,2600)}else{machine.classList.add("is-screen-on","is-ticker-on","is-buttons-ready");unlock();status.textContent="Jukebox restored for this session.";if(video){video.pause();video.currentTime=0;resetAttentionFlash(video.currentSrc||video.src)}if(frame){connectYouTube();resetAttentionFlash(frame.src);startYouTubeClock()}}};
      const openAfterClunk=action=>{const href=action.dataset.href;clearTimeout(launchTimer);const outboundWindow=window.open("about:blank","_blank");if(outboundWindow){try{outboundWindow.opener=null;outboundWindow.document.title="Opening destination"}catch{}launchTimer=setTimeout(()=>{if(outboundWindow.closed)return;try{const outbound=outboundWindow.document.createElement("a");outbound.href=href;outbound.target="_self";outbound.rel="noopener noreferrer";outboundWindow.document.body.append(outbound);outbound.click()}catch{try{outboundWindow.location.replace(href)}catch{}}},${MAHOGANY_BUTTON_LINK_DELAY_MS});return}const outbound=document.createElement("a");outbound.href=href;outbound.target="_blank";outbound.rel="noopener noreferrer";outbound.style.display="none";document.body.append(outbound);outbound.click();outbound.remove()};
      const pressAction=(event,action)=>{event.preventDefault();if(state!=="awake")return;actions.forEach(candidate=>candidate.classList.toggle("is-depressed",candidate===action));if(buttonClunk){buttonClunk.pause();buttonClunk.currentTime=0;buttonClunk.volume=.88;buttonClunk.play().catch(error=>console.warn("Mechanical button sound could not be played.",error))}status.textContent=action.getAttribute("aria-label")+" selected. Mechanical linkage engaged.";openAfterClunk(action)};
      coin.addEventListener("click",()=>awaken());coin.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();awaken()}});actions.forEach(action=>action.addEventListener("click",event=>pressAction(event,action)));share.addEventListener("click",async()=>{if(state!=="awake"){coin.focus();return}const url=shareUrl||location.href,data={title:document.title,text:"Open "+projectTitle+" Jukebox",url};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(url);status.textContent="Jukebox link copied."}}catch(error){if(error?.name!=="AbortError")status.textContent="Copy the browser address to share this Jukebox."}});video?.addEventListener("loadstart",()=>resetAttentionFlash(video.currentSrc||video.src));video?.addEventListener("loadedmetadata",()=>{resetAttentionFlash(video.currentSrc||video.src);syncAttentionFlash(video.currentTime,video.currentSrc||video.src)});video?.addEventListener("play",()=>{syncAttentionFlash(video.currentTime,video.currentSrc||video.src);startAttentionMonitor()});video?.addEventListener("playing",()=>{prepareBass().finally(startBass);startAttentionMonitor()});video?.addEventListener("timeupdate",()=>syncAttentionFlash(video.currentTime,video.currentSrc||video.src));video?.addEventListener("seeking",()=>syncAttentionFlash(video.currentTime,video.currentSrc||video.src));video?.addEventListener("seeked",()=>{syncAttentionFlash(video.currentTime,video.currentSrc||video.src);startAttentionMonitor()});video?.addEventListener("pause",()=>{clearBass();stopAttentionMonitor();syncAttentionFlash(video.currentTime,video.currentSrc||video.src)});video?.addEventListener("ended",()=>{clearBass();stopAttentionMonitor();setAttentionFlash(-1);status.textContent="Video completed. Choose an action or play it again."});video?.addEventListener("volumechange",()=>{if(video.muted||video.volume===0)clearBass();else startBass()});frame?.addEventListener("load",()=>{connectYouTube();startYouTubeClock()});addEventListener("message",event=>{if(!frame||event.source!==frame.contentWindow||!youtubeMessageOrigins.has(event.origin))return;let message=event.data;try{if(typeof message==="string")message=JSON.parse(message)}catch{return}if(message?.event==="onReady"){connectYouTube();startYouTubeClock();return}if(message?.event==="infoDelivery"&&Number.isFinite(Number(message.info?.currentTime)))syncAttentionFlash(Number(message.info.currentTime),frame.src);if(message?.event!=="onStateChange")return;youtubePlaying=Number(message.info)===1;if(youtubePlaying){startBass();startYouTubeClock()}else clearBass()});document.addEventListener("visibilitychange",()=>{machine.classList.toggle("is-paused",document.hidden);if(document.hidden){clearBass();stopAttentionMonitor();stopYouTubeClock()}else{startBass();startAttentionMonitor();startYouTubeClock()}});addEventListener("pagehide",()=>{clearTimers();clearTimeout(launchTimer);clearBass();stopAttentionMonitor();stopYouTubeClock();setAttentionFlash(-1);audioContext?.close?.()},{once:true});
      try{if(sessionStorage.getItem(sessionKey)==="true")awaken(true)}catch{}
    })();
  </script>
</body>
</html>`;
}
