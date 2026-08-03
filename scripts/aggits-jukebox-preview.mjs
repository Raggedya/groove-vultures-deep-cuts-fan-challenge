import {aggitsJukeboxIconAsset} from "./aggits-jukebox-icons.mjs";

const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

function balancedTitleLines(value){
  const words=String(value||"").trim().split(/\s+/).filter(Boolean);
  if(String(value||"").length<=25||words.length<2)return[String(value||"")];
  let bestIndex=1,bestDifference=Infinity;
  for(let index=1;index<words.length;index++){
    const difference=Math.abs(words.slice(0,index).join(" ").length-words.slice(index).join(" ").length);
    if(difference<bestDifference){bestDifference=difference;bestIndex=index}
  }
  return[words.slice(0,bestIndex).join(" "),words.slice(bestIndex).join(" ")];
}

export function renderAggitsJukeboxStudioPreview(project,{videoUrl="",scriptNonce="",publicMode=false,canonicalUrl=""}={}){
  const input=project.input;
  const title=(input.name||"EDITION NAME").toUpperCase();
  const titleLines=balancedTitleLines(title);
  const titleMarkup=titleLines.length===1
    ?`<text id="titleText" data-lines="1" x="500" y="122">${esc(titleLines[0])}</text>`
    :`<text id="titleText" data-lines="2"><tspan x="500" y="72">${esc(titleLines[0])}</tspan><tspan x="500" y="148">${esc(titleLines[1])}</tspan></text>`;
  const ticker=(input.tickerText||"ADD THE EDITION TICKER MESSAGE IN DEEP CUTS STUDIO.").toUpperCase();
  const actions=(Array.isArray(input.actionButtons)?input.actionButtons:[]).slice(0,4);
  const buttons=Array.from({length:4},(_,index)=>{
    const action=actions[index]||{};
    const enabled=action.enabled&&action.href&&action.label;
    const icon=aggitsJukeboxIconAsset(action.iconId);
    const content=`${icon?`<img src="${esc(icon)}" alt="">`:""}<strong>${esc(enabled?action.label:"")}</strong>`;
    if(!enabled)return`<span class="action is-disabled" data-slot="${index+1}" aria-hidden="true">${content}</span>`;
    const external=/^https:/i.test(action.href)&&action.openInNewTab;
    return`<a class="action" data-slot="${index+1}" data-enabled="true" data-href="${esc(action.href)}" ${external?'data-new-tab="true"':""} aria-disabled="true" tabindex="-1" aria-label="${esc(action.label)}${external?" (opens in a new tab)":""}">${content}</a>`;
  }).join("");
  const video=project.mp4&&videoUrl
    ?`<video id="welcomeVideo" controls playsinline webkit-playsinline preload="metadata" src="${esc(videoUrl)}" aria-label="${esc(input.name||"Aggits Jukebox")} video"></video>`
    :`<div class="video-wait"><strong>LOCAL MP4 REQUIRED</strong><span>Choose the edition video in Studio.</span></div>`;
  const sessionKey=publicMode?`aggitsJukeboxActivated:${project.editionId||project.id}`:`deepCutsStudioAggitsJukeboxActivated:${project.id}`;
  return`<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#080402">
  <title>${esc(input.name||"Aggits Jukebox")} Studio Preview</title>
  <style>
    *{box-sizing:border-box}[hidden]{display:none!important}html{background:#030201}body{margin:0;min-height:100vh;background:#030201;color:#f4d99c;font-family:Georgia,"Times New Roman",serif}button,a{font:inherit}.marquee svg{display:block;width:100%;height:72%;overflow:visible}.marquee text{fill:#bd8240;font:900 140px Georgia,serif;letter-spacing:.105em;text-anchor:middle;paint-order:stroke;stroke:#2c1606;stroke-width:2px;filter:drop-shadow(0 1px 0 #f0c274) drop-shadow(0 3px 1px #2c1606)}
    main{width:min(100%,466px);margin:auto;padding:0 0 34px}.draft{display:flex;justify-content:space-between;gap:10px;padding:9px 13px;background:#090504;color:#b58b4b;font:800 8px/1.2 Arial,sans-serif;letter-spacing:.13em}.draft b{color:${project.readiness.handoffReady?"#d9edb7":"#ffd37b"}}
    .machine{position:relative;width:100%;aspect-ratio:1320/2390;overflow:hidden;background:url("/assets/aggits-jukebox-master-v1.jpg") center/100% 100% no-repeat;filter:brightness(.48) saturate(.6);transition:filter .65s ease}.machine:after{position:absolute;z-index:1;inset:0;content:"";pointer-events:none;background:radial-gradient(ellipse 80% 48% at 50% 6%,rgba(255,190,91,.14),transparent 64%),linear-gradient(90deg,rgba(111,12,7,.08),transparent 16% 84%,rgba(111,12,7,.08));mix-blend-mode:screen;opacity:.12;transition:opacity .7s}.machine.is-awake,.machine.is-powering{filter:none}.machine.is-awake:after,.machine.is-powering:after{opacity:.52}.machine.is-paused .ticker span{animation-play-state:paused}
    .marquee{position:absolute;z-index:3;top:7.25%;left:12.7%;width:74.6%;height:10.3%;display:grid;align-content:center;justify-items:center;padding:2.5% 5% 0;overflow:hidden;border-radius:50% 50% 10% 10%/78% 78% 18% 18%;background:radial-gradient(ellipse at 50% 85%,#130c07 0,#070504 68%,#020201 100%);box-shadow:inset 0 -2px 5px #000}.marquee strong{display:block;max-width:100%;color:#bd8240;font:900 clamp(25px,9.5vw,53px)/.9 Georgia,serif;letter-spacing:.105em;text-align:center;text-shadow:0 1px 0 #f0c274,0 3px 1px #2c1606,0 0 5px rgba(239,164,68,.28);white-space:nowrap}.marquee:after{width:70%;height:1px;margin-top:4%;content:"";background:linear-gradient(90deg,transparent,#b98b4f 18% 46%,transparent 46% 54%,#b98b4f 54% 82%,transparent)}
    .ticker{position:absolute;z-index:3;top:18.55%;left:12.8%;width:74.45%;height:8.45%;display:flex;align-items:center;overflow:hidden;border-radius:7%;background:#030201;box-shadow:inset 0 0 20px #000;filter:brightness(.34);transition:filter .45s}.ticker:before{flex:none;margin-left:2.3%;content:"★";color:#f7ca59;font-size:clamp(14px,4vw,22px);text-shadow:0 0 6px rgba(255,199,65,.72)}.ticker span{display:block;width:max-content;padding-left:100%;color:#ffda62;font:900 clamp(12px,3.8vw,20px)/1 "Courier New",monospace;letter-spacing:.035em;text-shadow:0 0 2px #fff3a6,0 0 7px #ffb52d;white-space:nowrap;animation:ticker 31s linear infinite;animation-play-state:paused}.machine.is-ticker-on .ticker{filter:brightness(1.12)}.machine.is-ticker-on .ticker span{animation-play-state:running}
    .video{position:absolute;z-index:3;top:29.707113%;left:29.393939%;width:58.333333%;height:36.820084%;overflow:hidden;border:0;background:#000;box-shadow:none}.video:after{position:absolute;z-index:4;inset:0;content:"";pointer-events:none;background:#010101;opacity:.82;transition:opacity .45s}.machine.is-screen-on .video:after{opacity:0}.video video{display:block;width:100%;height:100%;border:0;border-radius:0;background:#000;object-fit:cover;object-position:center;filter:brightness(.26) saturate(.44);transition:filter .45s}.machine.is-screen-on .video video{filter:none}.video-wait{height:100%;display:grid;align-content:center;justify-items:center;padding:12%;color:#9d7840;text-align:center}.video-wait strong{font:900 12px/1 Arial,sans-serif;letter-spacing:.1em}.video-wait span{margin-top:8px;color:#765a35;font:10px/1.45 Arial,sans-serif}
    .coin-control{position:absolute;z-index:6;top:47.4%;left:12.35%;width:14.85%;height:12.6%;padding:0;border:0;border-radius:50%;background:transparent;color:transparent;cursor:pointer;touch-action:manipulation}.coin-control:focus-visible{outline:3px solid #ffe19a;outline-offset:3px}.coin-control:before{position:absolute;inset:12%;display:grid;place-items:center;border:2px solid rgba(205,145,63,.78);border-radius:50%;content:"$";color:#b87931;background:radial-gradient(circle at 35% 30%,rgba(237,188,99,.24),rgba(29,16,8,.16) 66%);font:900 clamp(20px,6.5vw,36px)/1 Georgia,serif;text-shadow:0 1px 0 #e5b76d;box-shadow:0 0 0 rgba(255,189,75,0);animation:coinCall 2.8s ease-in-out infinite}.machine.is-accepting .coin-control:before{animation:coinInsert .62s cubic-bezier(.34,.02,.75,.34) forwards}.machine.is-awake .coin-control{pointer-events:none}.machine.is-awake .coin-control:before{animation:none;opacity:0}
    .actions{position:absolute;z-index:4;top:66.72%;left:11.1%;width:77.8%;height:13.65%;display:grid;grid-template-columns:repeat(4,1fr);gap:1.25%;padding:1.1% .4% .3%;overflow:hidden;background:radial-gradient(ellipse at 50% 38%,rgba(30,18,10,.98),rgba(3,2,1,.995) 72%);box-shadow:inset 0 0 22px #000}.action{position:relative;display:grid;grid-template-rows:minmax(0,1fr) 2.2em;align-items:center;justify-items:center;min-width:0;padding:0 1%;border:0;background:transparent;color:#d5a355;text-decoration:none;text-align:center;filter:brightness(.35) saturate(.52);opacity:.6;pointer-events:none;transition:filter .45s ease,opacity .45s ease,transform .12s}.action img{display:block;width:min(94%,104px);aspect-ratio:1;object-fit:contain;border-radius:50%;filter:drop-shadow(0 2px 3px #000)}.action strong{align-self:start;max-width:100%;font:800 clamp(7px,2.05vw,11px)/.9 Georgia,serif;letter-spacing:.015em;text-transform:uppercase;text-wrap:balance}.machine.is-buttons-ready .action[data-enabled="true"]{filter:brightness(.78) saturate(.76);opacity:.93;pointer-events:auto}.machine.is-buttons-ready .action.is-lighting{filter:brightness(1.35) saturate(1.02);opacity:1}.machine.is-buttons-ready .action.is-lighting img{filter:drop-shadow(0 -2px 7px rgba(255,213,126,.44)) drop-shadow(0 3px 3px #000)}.machine.is-buttons-ready .action.is-lit{filter:brightness(.99) saturate(.86);opacity:1}.action:focus-visible{outline:2px solid #ffe9ae;outline-offset:-2px;border-radius:12px}.action:active{transform:translateY(2px)}.action.is-disabled{filter:brightness(.2) saturate(.25);opacity:.2}
    .share{position:absolute;z-index:5;top:81.42%;left:11.1%;width:77.8%;height:8.05%;border:0;background:transparent;color:transparent;cursor:pointer;pointer-events:none}.share:focus-visible{outline:3px solid #ffe6a0;outline-offset:-5px}.machine.is-awake .share{pointer-events:auto}.status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
    .gate{padding:16px 20px 5px;color:#9b7b55;text-align:center;font:9px/1.55 Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase}.gate strong{display:block;margin-bottom:6px;color:${project.readiness.handoffReady?"#d7e8aa":"#ffd37b"};font-size:11px}.gate code{display:block;margin-top:7px;color:#d5b47a;font-family:inherit}.footer{padding:22px 0 0;color:#806b5d;font:9px/1.8 Arial,sans-serif;letter-spacing:.08em;text-align:center}.footer strong{color:#b89a7d;letter-spacing:.15em}
    @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-100%)}}@keyframes coinCall{0%,63%,100%{filter:brightness(.66);box-shadow:0 0 0 rgba(255,189,75,0)}78%{filter:brightness(1.14);box-shadow:0 0 15px rgba(255,189,75,.54)}}@keyframes coinInsert{0%{transform:none;opacity:1}65%{transform:translateY(-175%) scale(.82);opacity:1}100%{transform:translateY(-285%) scale(.55);opacity:0}}
    @media(max-width:340px){.action strong{font-size:6.5px}.actions{height:13.8%}}
    @media(prefers-reduced-motion:reduce){.machine,.machine:after,.ticker,.video:after,.video video,.action{transition:none}.coin-control:before{animation:none}.ticker span{width:100%;padding:0 3%;overflow:hidden;text-overflow:ellipsis;animation:none}.machine.is-ticker-on .ticker span{animation:none}.machine.is-buttons-ready .action[data-enabled="true"]{filter:brightness(.98) saturate(.82);opacity:1}}
  </style>
</head>
<body>
  <main>
    ${publicMode?"":`<div class="draft"><span>DEEP CUTS STUDIO · AGGITS JUKEBOX</span><b>${project.readiness.handoffReady?"CONFIGURATION READY":"DRAFT"}</b></div>`}
    <section id="machine" class="machine" aria-label="${esc(input.name||"Edition")} Aggits Jukebox preview">
      <header class="marquee"><svg viewBox="0 0 1000 170" role="img" aria-label="${esc(title)}">${titleMarkup}</svg></header>
      <div class="ticker" role="status" aria-label="Edition ticker"><span>${esc(ticker)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
      <div class="video">${video}</div>
      <button id="coinButton" class="coin-control" type="button" aria-label="Insert coin and start the Aggits Jukebox"></button>
      <nav id="actions" class="actions" aria-label="Edition actions">${buttons}</nav>
      <button id="shareButton" class="share" type="button" aria-label="Share ${esc(input.name||"this Aggits Jukebox")}" aria-disabled="true"></button>
      <p id="status" class="status" aria-live="polite">Insert the coin to start.</p>
    </section>
    ${publicMode?"":`<div class="gate"><strong>${project.readiness.handoffReady?"STATIC CONTENT COMPLETE":"ADMINISTRATOR INPUT REQUIRED"}</strong>The title, ticker, local MP4 and four action slots are stored with this isolated project.<code>CAMTASIA: 7:8 · 1120 × 1280 px · MP4/H.264 · Fill canvas · no black padding</code></div>`}
    <footer class="footer" aria-label="Deep Cuts platform"><strong>Deep Cuts</strong><br>Copyright Clearlight Creative</footer>
  </main>
  <audio id="coinSound" preload="auto" src="/assets/audio/jukebox-real-coin-insert-cc0.mp3"></audio>
  <script${scriptNonce?` nonce="${esc(scriptNonce)}"`:""}>
    (()=>{const machine=document.getElementById("machine"),coin=document.getElementById("coinButton"),video=document.getElementById("welcomeVideo"),sound=document.getElementById("coinSound"),status=document.getElementById("status"),share=document.getElementById("shareButton"),actions=[...document.querySelectorAll('.action[data-enabled="true"]')],title=document.getElementById("titleText"),sessionKey=${JSON.stringify(sessionKey)},shareUrl=${JSON.stringify(canonicalUrl||"")};let state="sleeping",timers=[],sequence=[],sequenceIndex=0;
      const later=(callback,delay)=>{const timer=setTimeout(()=>{timers=timers.filter(value=>value!==timer);callback()},delay);timers.push(timer)};
      const clearTimers=()=>{timers.forEach(clearTimeout);timers=[]};
      const shuffle=items=>{const result=[...items];for(let index=result.length-1;index>0;index--){const target=Math.floor(Math.random()*(index+1));[result[index],result[target]]=[result[target],result[index]]}return result};
      const unlock=()=>{actions.forEach(action=>{action.href=action.dataset.href;if(action.dataset.newTab==="true"){action.target="_blank";action.rel="noopener noreferrer"}action.removeAttribute("aria-disabled");action.tabIndex=0});share.removeAttribute("aria-disabled")};
      const finishLights=()=>{actions.forEach(action=>action.classList.remove("is-lighting"));actions.forEach(action=>action.classList.add("is-lit"))};
      const lightNext=()=>{actions.forEach(action=>action.classList.remove("is-lighting"));if(sequenceIndex>=sequence.length){finishLights();return}sequence[sequenceIndex++].classList.add("is-lighting");later(lightNext,620)};
      const beginLights=()=>{machine.classList.add("is-buttons-ready");unlock();if(matchMedia("(prefers-reduced-motion: reduce)").matches){finishLights();return}sequence=shuffle(actions);sequenceIndex=0;lightNext()};
      const awaken=(restore=false)=>{if(state!=="sleeping")return;state=restore?"awake":"acceptingCoin";machine.classList.add(restore?"is-awake":"is-accepting");if(!restore){sound.volume=.56;sound.currentTime=0;sound.play().catch(error=>console.warn("Coin recording unavailable; visual startup continues.",error));if(video){video.currentTime=0;const playback=video.play();playback?.catch?.(()=>{status.textContent="Coin accepted — press Play to start the video."})}try{sessionStorage.setItem(sessionKey,"true")}catch{}later(()=>machine.classList.add("is-powering"),180);later(()=>machine.classList.add("is-screen-on"),780);later(()=>machine.classList.add("is-ticker-on"),1280);later(()=>{machine.classList.add("is-awake");state="awake";status.textContent="Coin accepted — Jukebox is live."},1800);later(beginLights,2600)}else{machine.classList.add("is-screen-on","is-ticker-on","is-buttons-ready");unlock();finishLights();status.textContent="Jukebox restored for this session.";if(video){video.pause();video.currentTime=0}}};
      coin.addEventListener("click",()=>awaken());coin.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();awaken()}});actions.forEach(action=>action.addEventListener("click",event=>{if(state!=="awake")event.preventDefault()}));share.addEventListener("click",async()=>{if(state!=="awake"){coin.focus();return}const url=shareUrl||location.href,data={title:document.title,text:"Open "+title.textContent+" Jukebox",url};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(url);status.textContent="Jukebox link copied."}}catch(error){if(error?.name!=="AbortError")status.textContent="Copy the browser address to share this Jukebox."}});video?.addEventListener("ended",()=>{status.textContent="Video completed. Choose an action or play it again."});document.addEventListener("visibilitychange",()=>{machine.classList.toggle("is-paused",document.hidden)});addEventListener("pagehide",clearTimers,{once:true});
      const fit=()=>{const spans=[...title.querySelectorAll("tspan")],twoLines=spans.length===2;title.style.fontSize=(twoLines?90:140)+"px";title.style.letterSpacing=twoLines?".055em":".105em";const measured=()=>Math.max(...(spans.length?spans:[title]).map(node=>node.getComputedTextLength()));let length=measured(),size=parseFloat(title.style.fontSize);if(length>840){size=Math.max(twoLines?48:36,size*840/length);title.style.fontSize=size+"px";length=measured()}if(length>840){title.style.letterSpacing=".02em";length=measured();if(length>840)title.style.fontSize=Math.max(twoLines?44:32,parseFloat(title.style.fontSize)*840/length)+"px"}};new ResizeObserver(fit).observe(title.ownerSVGElement);document.fonts?.ready?.then(fit).catch(()=>{});fit();try{if(sessionStorage.getItem(sessionKey)==="true")awaken(true)}catch{}
    })();
  </script>
</body>
</html>`;
}
