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
export const MAHOGANY_FIXED_MARQUEE_ASSET =
  "/assets/aggits-marquee-reference-v1.jpg";
export const MAHOGANY_FIXED_MARQUEE_SHA256 =
  "534ff813039151e01b1734dd2b1fb638d5228f226b6b1de6e9a5c5f4f91cdf21";
export const MAHOGANY_OVAL_CABINET_ASSET =
  "/assets/aggits-jukebox-oval-master-v2.jpg";
export const MAHOGANY_OVAL_CABINET_SHA256 =
  "7cbb93d3df3966c621ae943196001a2402de16d5ea64ff2d02bf975449046546";
export const MAHOGANY_BUTTON_CLUNK_ASSET =
  "/assets/audio/jukebox-mechanical-button-clunk-public-domain.ogg";
export const MAHOGANY_BUTTON_CLUNK_SHA256 =
  "d45c44c7cf8d700216c7f56182a430183df64880fe6aab834552daa6af6d5919";
export const MAHOGANY_BUTTON_LINK_DELAY_MS = 500;

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
    }`;
    if (!enabled)
      return `<span class="action is-disabled" data-slot="${index + 1}" aria-hidden="true">${content}</span>`;
    const external = /^https:/i.test(action.href) && action.openInNewTab;
    return `<a class="action" data-slot="${index + 1}" data-enabled="true" data-href="${esc(action.href)}" ${external ? 'data-new-tab="true"' : ""} aria-disabled="true" tabindex="-1" aria-label="${esc(action.label)}${external ? " (opens in a new tab)" : ""}">${content}</a>`;
  }).join("");
  const youtubeId = youtubeVideoId(
    youtubeUrl || input.youtubeUrl || project.youtubeUrl,
  );
  const video = youtubeId
    ? `<iframe id="welcomeFrame" src="https://www.youtube-nocookie.com/embed/${youtubeId}?enablejsapi=1&amp;rel=0&amp;playsinline=1" title="${esc(input.name || "Mahogany Jukebox")} video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
    : project.mp4 && videoUrl
      ? `<video id="welcomeVideo" controls playsinline webkit-playsinline preload="metadata" src="${esc(videoUrl)}" aria-label="${esc(input.name || "Mahogany Jukebox")} video"></video>`
      : `<div class="video-wait"><strong>VIDEO REQUIRED</strong><span>Add a YouTube URL or choose an MP4.</span></div>`;
  const sessionKey = publicMode
    ? `aggitsJukeboxActivated:${project.editionId || project.id}`
    : `deepCutsStudioAggitsJukeboxActivated:${project.id}`;
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#080402">
  <title>${esc(input.name || "Aggits Jukebox")} Studio Preview</title>
  <link rel="preload" href="${MAHOGANY_OVAL_CABINET_ASSET}" as="image">
  <style>
    *{box-sizing:border-box}[hidden]{display:none!important}html{background:#030201}body{margin:0;min-height:100vh;background:#030201;color:#f4d99c;font-family:Georgia,"Times New Roman",serif}button,a{font:inherit}
    main{width:min(100%,466px);margin:auto;padding:0 0 34px}.draft{display:flex;justify-content:space-between;gap:10px;padding:9px 13px;background:#090504;color:#b58b4b;font:800 8px/1.2 Arial,sans-serif;letter-spacing:.13em}.draft b{color:${project.readiness.handoffReady ? "#d9edb7" : "#ffd37b"}}
    .machine{position:relative;width:100%;aspect-ratio:720/1280;overflow:hidden;background-color:rgba(0,0,0,.56);background-image:url("${MAHOGANY_OVAL_CABINET_ASSET}");background-position:center;background-size:100% 100%;background-repeat:no-repeat;background-blend-mode:multiply;transition:background-color .65s ease}.machine:before{position:absolute;z-index:2;top:1.8%;left:9%;width:82%;height:17%;content:"";pointer-events:none;background:radial-gradient(ellipse at 50% 54%,rgba(255,183,76,.26),rgba(203,104,23,.08) 44%,transparent 72%);mix-blend-mode:screen;opacity:0;transition:opacity 1.05s ease}.machine:after{position:absolute;z-index:1;inset:0;content:"";pointer-events:none;background:radial-gradient(ellipse 80% 48% at 50% 6%,rgba(255,190,91,.14),transparent 64%),linear-gradient(90deg,rgba(111,12,7,.08),transparent 16% 84%,rgba(111,12,7,.08));mix-blend-mode:screen;opacity:.12;transition:opacity .7s}.machine.is-awake,.machine.is-powering{background-color:rgba(0,0,0,0)}.machine.is-awake:before,.machine.is-powering:before{opacity:.36}.machine.is-awake:after,.machine.is-powering:after{opacity:.46}.machine.is-paused .ticker span{animation-play-state:paused}
    .ticker{position:absolute;z-index:3;top:18.88%;left:13.2%;width:73.6%;height:5.65%;display:flex;align-items:center;overflow:hidden;border-radius:6%;background:#030201;box-shadow:inset 0 0 13px #000;filter:brightness(.34);transition:filter .45s}.ticker:before{flex:none;margin-left:2.7%;content:"★";color:#f7ca59;font-size:clamp(13px,4vw,21px);text-shadow:0 0 6px rgba(255,199,65,.72)}.ticker span{display:block;width:max-content;padding-left:100%;color:#ffda62;font:900 clamp(11px,3.55vw,19px)/1 "Courier New",monospace;letter-spacing:.035em;text-shadow:0 0 2px #fff3a6,0 0 7px #ffb52d;white-space:nowrap;animation:ticker 31s linear infinite;animation-play-state:paused}.machine.is-ticker-on .ticker{filter:brightness(1.12)}.machine.is-ticker-on .ticker span{animation-play-state:running}
    .video{position:absolute;z-index:3;top:26.18%;left:24.55%;width:62.65%;height:28.05%;overflow:hidden;border:0;background:#000;box-shadow:none}.video:after{position:absolute;z-index:4;inset:0;content:"";pointer-events:none;background:#010101;opacity:.82;transition:opacity .45s}.machine.is-screen-on .video:after{opacity:0}.video video,.video iframe{display:block;width:100%;height:100%;border:0;border-radius:0;background:#000;object-fit:cover;object-position:center;filter:brightness(.26) saturate(.44);transition:filter .45s}.machine.is-screen-on .video video,.machine.is-screen-on .video iframe{filter:none}.video-wait{height:100%;display:grid;align-content:center;justify-items:center;padding:12%;color:#9d7840;text-align:center}.video-wait strong{font:900 12px/1 Arial,sans-serif;letter-spacing:.1em}.video-wait span{margin-top:8px;color:#765a35;font:10px/1.45 Arial,sans-serif}
    .coin-control{position:absolute;z-index:6;top:43.9%;left:8.6%;width:15.6%;height:12.4%;padding:0;border:0;outline:0;background:transparent;color:transparent;cursor:pointer;touch-action:manipulation}.coin-control:before{position:absolute;left:35%;bottom:1%;width:30%;height:72%;display:grid;place-items:center;border:2px solid #ffd875;border-radius:48%;content:"$";color:#5d3108;background:linear-gradient(90deg,#6a3306 0,#d28a20 9%,#fff0a0 31%,#d68d20 53%,#fff2a5 72%,#a9600d 90%,#542604 100%);font:900 clamp(12px,3.6vw,20px)/1 Georgia,serif;text-shadow:0 1px 0 #fff0a0,0 -1px 0 #5c2c04;box-shadow:inset 1px 0 0 #fff0a0,inset -2px 0 4px #6b3104,0 2px 5px rgba(0,0,0,.82);transform:perspective(100px) rotateY(48deg);transform-origin:50% 50%;animation:coinCall 2.8s ease-in-out infinite}.coin-control:focus-visible:before{box-shadow:inset 1px 0 0 #fff0a0,inset -2px 0 4px #6b3104,0 0 0 3px #ffe19a,0 0 12px rgba(255,218,122,.66),0 2px 5px rgba(0,0,0,.82)}.machine.is-accepting .coin-control:before{animation:coinInsert .62s cubic-bezier(.34,.02,.75,.34) forwards}.machine.is-awake .coin-control{pointer-events:none}.machine.is-awake .coin-control:before{animation:none;opacity:0}
    .actions{position:absolute;z-index:4;top:56.45%;left:11.1%;width:78.9%;height:16.9%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.25%;padding:.3% 0 0;overflow:visible;background:#070402}.actions:before{content:"";position:absolute;z-index:0;left:0;right:0;top:-6%;height:7%;background:#070402;pointer-events:none}.action{position:relative;z-index:1;display:grid;place-items:center;min-width:0;min-height:0;padding:8%;overflow:hidden;border:0;border-radius:50%;background:radial-gradient(ellipse at 47% 28%,#3a2514 0,#130c07 48%,#030201 82%);color:#d5a355;text-decoration:none;filter:brightness(.35) saturate(.55);opacity:.7;pointer-events:none;box-shadow:inset 0 0 0 clamp(1px,.35vw,2px) #241407,inset 0 0 0 clamp(3px,.75vw,5px) #9b682f,inset 0 0 0 clamp(5px,1.15vw,8px) #3b220d,inset 0 clamp(3px,1.25vw,8px) clamp(3px,1.1vw,7px) rgba(242,198,120,.34),inset 0 clamp(-18px,-3vw,-8px) clamp(12px,3.6vw,23px) #000;transition:filter .3s ease,opacity .3s ease,transform .14s cubic-bezier(.2,.7,.2,1),box-shadow .14s ease}.action-icon{position:relative;display:block;width:84%;aspect-ratio:1;overflow:visible}.action-icon img{position:absolute;top:50%;left:50%;display:block;width:100%;height:100%;max-width:none;object-fit:contain;transform:translate(-50%,-50%)}.machine.is-buttons-ready .action[data-enabled="true"]{filter:brightness(.96) saturate(.9);opacity:1;pointer-events:auto}.action:focus-visible{outline:0;box-shadow:inset 0 0 0 clamp(2px,.55vw,4px) #ffe9ae,inset 0 0 0 clamp(4px,1vw,7px) #8b5725,inset 0 clamp(3px,1.25vw,8px) clamp(3px,1.1vw,7px) rgba(255,222,151,.38),inset 0 clamp(-18px,-3vw,-8px) clamp(12px,3.6vw,23px) #000}.action.is-depressed{transform:perspective(180px) translateY(4.5%) scale(.955) rotateX(-3deg);filter:brightness(.7) saturate(.75)!important;box-shadow:inset 0 0 0 clamp(2px,.55vw,4px) #3b220d,inset 0 12px 18px #000,inset 0 -2px 5px rgba(182,115,42,.11)}.action.is-depressed .action-icon{transform:translateY(2px)}.action.is-disabled{filter:brightness(.2) saturate(.25);opacity:.2}
    .share{position:absolute;z-index:5;top:74%;left:12.8%;width:74.3%;height:8.2%;border:0;background:transparent;color:transparent;cursor:pointer;pointer-events:none}.share:focus-visible{outline:3px solid #ffe6a0;outline-offset:-5px}.machine.is-awake .share{pointer-events:auto}.status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
    .gate{padding:16px 20px 5px;color:#9b7b55;text-align:center;font:9px/1.55 Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase}.gate strong{display:block;margin-bottom:6px;color:${project.readiness.handoffReady ? "#d7e8aa" : "#ffd37b"};font-size:11px}.gate code{display:block;margin-top:7px;color:#d5b47a;font-family:inherit}.footer{padding:22px 0 0;color:#806b5d;font:9px/1.8 Arial,sans-serif;letter-spacing:.08em;text-align:center}.footer strong{color:#b89a7d;letter-spacing:.15em}
    @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-100%)}}@keyframes coinCall{0%,63%,100%{filter:brightness(.95)}78%{filter:brightness(1.12)}}@keyframes coinInsert{0%{transform:perspective(100px) rotateY(48deg);opacity:1}62%{transform:perspective(100px) translateY(-170%) rotateY(67deg) scale(.83);opacity:1}100%{transform:perspective(100px) translateY(-275%) rotateY(78deg) scale(.5);opacity:0}}
    @media(prefers-reduced-motion:reduce){.machine,.machine:before,.machine:after,.ticker,.video:after,.video video,.action{transition:none}.coin-control:before{animation:none}.machine.is-accepting .coin-control:before{animation:coinInsertReduced .18s linear forwards}.ticker span{width:100%;padding:0 3%;overflow:hidden;text-overflow:ellipsis;animation:none}.machine.is-ticker-on .ticker span{animation:none}.machine.is-buttons-ready .action[data-enabled="true"]{filter:brightness(.96) saturate(.9);opacity:1}}@keyframes coinInsertReduced{to{transform:translateY(-55%) rotateY(72deg);opacity:0}}
  </style>
</head>
<body>
  <main>
    ${publicMode ? "" : `<div class="draft"><span>MAHOGANY JUKEBOX</span><b>${project.readiness.handoffReady ? "CONFIGURATION READY" : "DRAFT"}</b></div>`}
    <section id="machine" class="machine" aria-label="${esc(input.name || "Edition")} Mahogany Jukebox preview">
      <div class="ticker" role="status" aria-label="Edition ticker"><span>${esc(ticker)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
      <div class="video">${video}</div>
      <button id="coinButton" class="coin-control" type="button" aria-label="Insert coin and start the Mahogany Jukebox"></button>
      <nav id="actions" class="actions" aria-label="Edition actions">${buttons}</nav>
      <button id="shareButton" class="share" type="button" aria-label="Share ${esc(input.name || "this Aggits Jukebox")}" aria-disabled="true"></button>
      <p id="status" class="status" aria-live="polite">Insert the coin to start.</p>
    </section>
    ${publicMode ? "" : `<div class="gate"><strong>${project.readiness.handoffReady ? "CONFIGURATION COMPLETE" : "ADMINISTRATOR INPUT REQUIRED"}</strong>The title, ticker, selected video and four action slots are stored with this isolated project.<code>MP4 OPTION: 7:8 · 1120 × 1280 px · H.264 · fill canvas · no black padding</code></div>`}
    <footer class="footer" aria-label="Deep Cuts platform"><strong>Deep Cuts</strong><br>Copyright Clearlight Creative</footer>
  </main>
  <link rel="preload" href="/assets/audio/jukebox-real-coin-insert-cc0.mp3" as="audio" type="audio/mpeg">
  <link rel="preload" href="${MAHOGANY_BUTTON_CLUNK_ASSET}" as="audio" type="audio/ogg">
  <audio id="buttonClunk" preload="auto" src="${MAHOGANY_BUTTON_CLUNK_ASSET}"></audio>
  <script src="/assets/js/jookbox-coin-audio.js"></script>
  <script${scriptNonce ? ` nonce="${esc(scriptNonce)}"` : ""}>
    (()=>{const machine=document.getElementById("machine"),coin=document.getElementById("coinButton"),video=document.getElementById("welcomeVideo"),frame=document.getElementById("welcomeFrame"),sound=window.DeepCutsJookBoxCoinAudio?.create("/assets/audio/jukebox-real-coin-insert-cc0.mp3",{volume:1,gain:1.15}),buttonClunk=document.getElementById("buttonClunk"),status=document.getElementById("status"),share=document.getElementById("shareButton"),actions=[...document.querySelectorAll('.action[data-enabled="true"]')],sessionKey=${JSON.stringify(sessionKey)},shareUrl=${JSON.stringify(canonicalUrl || "")},projectTitle=${JSON.stringify(input.name || "Mahogany Jukebox")};let state="sleeping",timers=[],launchTimer=0;
      const later=(callback,delay)=>{const timer=setTimeout(()=>{timers=timers.filter(value=>value!==timer);callback()},delay);timers.push(timer)};
      const clearTimers=()=>{timers.forEach(clearTimeout);timers=[]};
      const unlock=()=>{actions.forEach(action=>{action.href=action.dataset.href;if(action.dataset.newTab==="true"){action.target="_blank";action.rel="noopener noreferrer"}action.removeAttribute("aria-disabled");action.tabIndex=0});share.removeAttribute("aria-disabled")};
      const enableActions=()=>{machine.classList.add("is-buttons-ready");unlock()};
      const awaken=(restore=false)=>{if(state!=="sleeping")return;state=restore?"awake":"acceptingCoin";machine.classList.add(restore?"is-awake":"is-accepting");if(!restore){const startVideo=()=>{if(video){video.currentTime=0;const playback=video.play();playback?.catch?.(()=>{status.textContent="Coin accepted — press Play to start the video."})}if(frame)frame.contentWindow?.postMessage(JSON.stringify({event:"command",func:"playVideo",args:[]}),"https://www.youtube-nocookie.com")};const coinPlayback=sound?.play();if(coinPlayback?.then)coinPlayback.then(startVideo).catch(error=>{console.warn("Coin recording could not be played.",error);startVideo()});else startVideo();try{sessionStorage.setItem(sessionKey,"true")}catch{}later(()=>machine.classList.add("is-powering"),180);later(()=>machine.classList.add("is-screen-on"),780);later(()=>machine.classList.add("is-ticker-on"),1280);later(()=>{machine.classList.add("is-awake");state="awake";status.textContent="Coin accepted — Jukebox is live."},1800);later(enableActions,2600)}else{machine.classList.add("is-screen-on","is-ticker-on","is-buttons-ready");unlock();status.textContent="Jukebox restored for this session.";if(video){video.pause();video.currentTime=0}}};
      const openAfterClunk=action=>{const href=action.dataset.href,newTab=action.dataset.newTab==="true";clearTimeout(launchTimer);launchTimer=setTimeout(()=>{if(newTab){const outbound=document.createElement("a");outbound.href=href;outbound.target="_blank";outbound.rel="noopener noreferrer";outbound.style.display="none";document.body.append(outbound);outbound.click();outbound.remove()}else location.href=href},${MAHOGANY_BUTTON_LINK_DELAY_MS})};
      const pressAction=(event,action)=>{event.preventDefault();if(state!=="awake")return;actions.forEach(candidate=>candidate.classList.toggle("is-depressed",candidate===action));if(buttonClunk){buttonClunk.pause();buttonClunk.currentTime=0;buttonClunk.volume=.88;buttonClunk.play().catch(error=>console.warn("Mechanical button sound could not be played.",error))}status.textContent=action.getAttribute("aria-label")+" selected. Mechanical linkage engaged.";openAfterClunk(action)};
      coin.addEventListener("click",()=>awaken());coin.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();awaken()}});actions.forEach(action=>action.addEventListener("click",event=>pressAction(event,action)));share.addEventListener("click",async()=>{if(state!=="awake"){coin.focus();return}const url=shareUrl||location.href,data={title:document.title,text:"Open "+projectTitle+" Jukebox",url};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(url);status.textContent="Jukebox link copied."}}catch(error){if(error?.name!=="AbortError")status.textContent="Copy the browser address to share this Jukebox."}});video?.addEventListener("ended",()=>{status.textContent="Video completed. Choose an action or play it again."});document.addEventListener("visibilitychange",()=>{machine.classList.toggle("is-paused",document.hidden)});addEventListener("pagehide",()=>{clearTimers();clearTimeout(launchTimer)},{once:true});
      try{if(sessionStorage.getItem(sessionKey)==="true")awaken(true)}catch{}
    })();
  </script>
</body>
</html>`;
}
