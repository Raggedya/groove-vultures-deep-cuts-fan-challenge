import { aggitsJukeboxIconAsset } from "./aggits-jukebox-icons.mjs";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

function balancedTitleLines(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (String(value || "").length <= 25 || words.length < 2)
    return [String(value || "")];
  let bestIndex = 1,
    bestDifference = Infinity;
  for (let index = 1; index < words.length; index++) {
    const difference = Math.abs(
      words.slice(0, index).join(" ").length -
        words.slice(index).join(" ").length,
    );
    if (difference < bestDifference) {
      bestDifference = difference;
      bestIndex = index;
    }
  }
  return [
    words.slice(0, bestIndex).join(" "),
    words.slice(bestIndex).join(" "),
  ];
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
  const title = (input.name || "EDITION NAME").toUpperCase();
  const titleLines = balancedTitleLines(title);
  const titleMarkup =
    titleLines.length === 1
      ? `<text id="titleText" data-lines="1" x="500" y="122">${esc(titleLines[0])}</text>`
      : `<text id="titleText" data-lines="2"><tspan x="500" y="72">${esc(titleLines[0])}</tspan><tspan x="500" y="148">${esc(titleLines[1])}</tspan></text>`;
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
    const content = icon ? `<img src="${esc(icon)}" alt="">` : "";
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
  <style>
    *{box-sizing:border-box}[hidden]{display:none!important}html{background:#030201}body{margin:0;min-height:100vh;background:#030201;color:#f4d99c;font-family:Georgia,"Times New Roman",serif}button,a{font:inherit}.marquee svg{display:block;width:100%;height:72%;overflow:visible}.marquee text{fill:#bd8240;font:900 140px Georgia,serif;letter-spacing:.105em;text-anchor:middle;paint-order:stroke;stroke:#2c1606;stroke-width:2px;filter:drop-shadow(0 1px 0 #f0c274) drop-shadow(0 3px 1px #2c1606)}
    main{width:min(100%,466px);margin:auto;padding:0 0 34px}.draft{display:flex;justify-content:space-between;gap:10px;padding:9px 13px;background:#090504;color:#b58b4b;font:800 8px/1.2 Arial,sans-serif;letter-spacing:.13em}.draft b{color:${project.readiness.handoffReady ? "#d9edb7" : "#ffd37b"}}
    .machine{position:relative;width:100%;aspect-ratio:1320/2390;overflow:hidden;background-color:rgba(0,0,0,.54);background-image:url("/assets/aggits-jukebox-master-v1.jpg");background-position:center;background-size:100% 100%;background-repeat:no-repeat;background-blend-mode:multiply;transition:background-color .65s ease}.machine:after{position:absolute;z-index:1;inset:0;content:"";pointer-events:none;background:radial-gradient(ellipse 80% 48% at 50% 6%,rgba(255,190,91,.14),transparent 64%),linear-gradient(90deg,rgba(111,12,7,.08),transparent 16% 84%,rgba(111,12,7,.08));mix-blend-mode:screen;opacity:.12;transition:opacity .7s}.machine.is-awake,.machine.is-powering{background-color:rgba(0,0,0,0)}.machine.is-awake:after,.machine.is-powering:after{opacity:.52}.machine.is-paused .ticker span{animation-play-state:paused}
    .marquee{position:absolute;z-index:3;top:7.25%;left:12.7%;width:74.6%;height:10.3%;display:grid;align-content:center;justify-items:center;padding:2.5% 5% 0;overflow:hidden;border-radius:50% 50% 10% 10%/78% 78% 18% 18%;background:radial-gradient(ellipse at 50% 85%,#130c07 0,#070504 68%,#020201 100%);box-shadow:inset 0 -2px 5px #000}.marquee strong{display:block;max-width:100%;color:#bd8240;font:900 clamp(25px,9.5vw,53px)/.9 Georgia,serif;letter-spacing:.105em;text-align:center;text-shadow:0 1px 0 #f0c274,0 3px 1px #2c1606,0 0 5px rgba(239,164,68,.28);white-space:nowrap}.marquee:after{width:70%;height:1px;margin-top:4%;content:"";background:linear-gradient(90deg,transparent,#b98b4f 18% 46%,transparent 46% 54%,#b98b4f 54% 82%,transparent)}
    .ticker{position:absolute;z-index:3;top:18.55%;left:12.8%;width:74.45%;height:8.45%;display:flex;align-items:center;overflow:hidden;border-radius:7%;background:#030201;box-shadow:inset 0 0 20px #000;filter:brightness(.34);transition:filter .45s}.ticker:before{flex:none;margin-left:2.3%;content:"★";color:#f7ca59;font-size:clamp(14px,4vw,22px);text-shadow:0 0 6px rgba(255,199,65,.72)}.ticker span{display:block;width:max-content;padding-left:100%;color:#ffda62;font:900 clamp(12px,3.8vw,20px)/1 "Courier New",monospace;letter-spacing:.035em;text-shadow:0 0 2px #fff3a6,0 0 7px #ffb52d;white-space:nowrap;animation:ticker 31s linear infinite;animation-play-state:paused}.machine.is-ticker-on .ticker{filter:brightness(1.12)}.machine.is-ticker-on .ticker span{animation-play-state:running}
    .video{position:absolute;z-index:3;top:29.707113%;left:29.393939%;width:58.333333%;height:36.820084%;overflow:hidden;border:0;background:#000;box-shadow:none}.video:after{position:absolute;z-index:4;inset:0;content:"";pointer-events:none;background:#010101;opacity:.82;transition:opacity .45s}.machine.is-screen-on .video:after{opacity:0}.video video,.video iframe{display:block;width:100%;height:100%;border:0;border-radius:0;background:#000;object-fit:cover;object-position:center;filter:brightness(.26) saturate(.44);transition:filter .45s}.machine.is-screen-on .video video,.machine.is-screen-on .video iframe{filter:none}.video-wait{height:100%;display:grid;align-content:center;justify-items:center;padding:12%;color:#9d7840;text-align:center}.video-wait strong{font:900 12px/1 Arial,sans-serif;letter-spacing:.1em}.video-wait span{margin-top:8px;color:#765a35;font:10px/1.45 Arial,sans-serif}
    .coin-control{position:absolute;z-index:6;top:47.4%;left:12.35%;width:14.85%;height:12.6%;padding:0;border:0;border-radius:50%;outline:0;background:transparent;color:transparent;cursor:pointer;touch-action:manipulation}.coin-control:before{position:absolute;left:3%;bottom:3%;width:94%;aspect-ratio:1;display:grid;place-items:center;border:3px solid #f6cc69;border-radius:50%;content:"$";color:#6e3d08;background:radial-gradient(circle at 31% 24%,#fff8bd 0 7%,#f9dc73 12%,#eeb640 36%,#c98219 67%,#7b4008 88%,#e8ad39 100%);font:900 clamp(20px,6.5vw,36px)/1 Georgia,serif;text-shadow:0 1px 0 #fff0a0,0 -1px 0 #6b3305;box-shadow:inset 0 0 0 2px #8c4d0b,inset 0 0 0 5px rgba(255,236,146,.54),inset -8px -10px 12px rgba(91,42,2,.42),inset 7px 7px 11px rgba(255,245,171,.5),0 3px 6px rgba(0,0,0,.78);animation:coinCall 2.8s ease-in-out infinite}.coin-control:focus-visible:before{box-shadow:inset 0 0 0 2px #8c4d0b,inset 0 0 0 5px rgba(255,236,146,.54),inset -8px -10px 12px rgba(91,42,2,.42),inset 7px 7px 11px rgba(255,245,171,.5),0 0 0 3px #ffe19a,0 0 12px rgba(255,218,122,.66),0 3px 6px rgba(0,0,0,.78)}.machine.is-accepting .coin-control:before{animation:coinInsert .62s cubic-bezier(.34,.02,.75,.34) forwards}.machine.is-awake .coin-control{pointer-events:none}.machine.is-awake .coin-control:before{animation:none;opacity:0}
    .actions{position:absolute;z-index:4;top:66.72%;left:11.1%;width:77.8%;height:13.65%;display:grid;grid-template-columns:repeat(4,1fr);gap:1.25%;padding:1.1% .4% .3%;overflow:hidden;background:radial-gradient(ellipse at 50% 38%,rgba(30,18,10,.98),rgba(3,2,1,.995) 72%);box-shadow:inset 0 0 22px #000}.action{position:relative;display:grid;place-items:center;min-width:0;padding:0;border:0;background:transparent;color:#d5a355;text-decoration:none;text-align:center;filter:brightness(.35) saturate(.52);opacity:.6;pointer-events:none;transition:filter .3s ease,opacity .3s ease,transform .12s}.action img{display:block;width:min(64%,70px);aspect-ratio:1;object-fit:contain;border-radius:50%;filter:drop-shadow(0 2px 3px #000)}.machine.is-buttons-ready .action[data-enabled="true"]{filter:brightness(.92) saturate(.8);opacity:1;pointer-events:auto}.action:focus-visible{outline:2px solid #ffe9ae;outline-offset:-2px;border-radius:12px}.action:active{transform:translateY(2px)}.action.is-disabled{filter:brightness(.2) saturate(.25);opacity:.2}
    .share{position:absolute;z-index:5;top:81.42%;left:11.1%;width:77.8%;height:8.05%;border:0;background:transparent;color:transparent;cursor:pointer;pointer-events:none}.share:focus-visible{outline:3px solid #ffe6a0;outline-offset:-5px}.machine.is-awake .share{pointer-events:auto}.status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
    .gate{padding:16px 20px 5px;color:#9b7b55;text-align:center;font:9px/1.55 Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase}.gate strong{display:block;margin-bottom:6px;color:${project.readiness.handoffReady ? "#d7e8aa" : "#ffd37b"};font-size:11px}.gate code{display:block;margin-top:7px;color:#d5b47a;font-family:inherit}.footer{padding:22px 0 0;color:#806b5d;font:9px/1.8 Arial,sans-serif;letter-spacing:.08em;text-align:center}.footer strong{color:#b89a7d;letter-spacing:.15em}
    @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-100%)}}@keyframes coinCall{0%,63%,100%{filter:brightness(.95)}78%{filter:brightness(1.08)}}@keyframes coinInsert{0%{transform:none;opacity:1}65%{transform:translateY(-175%) scale(.82);opacity:1}100%{transform:translateY(-285%) scale(.55);opacity:0}}
    @media(max-width:340px){.actions{height:13.8%}}
    @media(prefers-reduced-motion:reduce){.machine,.machine:after,.ticker,.video:after,.video video,.action{transition:none}.coin-control:before{animation:none}.ticker span{width:100%;padding:0 3%;overflow:hidden;text-overflow:ellipsis;animation:none}.machine.is-ticker-on .ticker span{animation:none}.machine.is-buttons-ready .action[data-enabled="true"]{filter:brightness(.92) saturate(.8);opacity:1}}
  </style>
</head>
<body>
  <main>
    ${publicMode ? "" : `<div class="draft"><span>MAHOGANY JUKEBOX</span><b>${project.readiness.handoffReady ? "CONFIGURATION READY" : "DRAFT"}</b></div>`}
    <section id="machine" class="machine" aria-label="${esc(input.name || "Edition")} Mahogany Jukebox preview">
      <header class="marquee"><svg viewBox="0 0 1000 170" role="img" aria-label="${esc(title)}">${titleMarkup}</svg></header>
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
  <script src="/assets/js/jookbox-coin-audio.js"></script>
  <script${scriptNonce ? ` nonce="${esc(scriptNonce)}"` : ""}>
    (()=>{const machine=document.getElementById("machine"),coin=document.getElementById("coinButton"),video=document.getElementById("welcomeVideo"),frame=document.getElementById("welcomeFrame"),sound=window.DeepCutsJookBoxCoinAudio?.create("/assets/audio/jukebox-real-coin-insert-cc0.mp3",{volume:1,gain:1.15}),status=document.getElementById("status"),share=document.getElementById("shareButton"),actions=[...document.querySelectorAll('.action[data-enabled="true"]')],title=document.getElementById("titleText"),sessionKey=${JSON.stringify(sessionKey)},shareUrl=${JSON.stringify(canonicalUrl || "")};let state="sleeping",timers=[];
      const later=(callback,delay)=>{const timer=setTimeout(()=>{timers=timers.filter(value=>value!==timer);callback()},delay);timers.push(timer)};
      const clearTimers=()=>{timers.forEach(clearTimeout);timers=[]};
      const unlock=()=>{actions.forEach(action=>{action.href=action.dataset.href;if(action.dataset.newTab==="true"){action.target="_blank";action.rel="noopener noreferrer"}action.removeAttribute("aria-disabled");action.tabIndex=0});share.removeAttribute("aria-disabled")};
      const enableActions=()=>{machine.classList.add("is-buttons-ready");unlock()};
      const awaken=(restore=false)=>{if(state!=="sleeping")return;state=restore?"awake":"acceptingCoin";machine.classList.add(restore?"is-awake":"is-accepting");if(!restore){const startVideo=()=>{if(video){video.currentTime=0;const playback=video.play();playback?.catch?.(()=>{status.textContent="Coin accepted — press Play to start the video."})}if(frame)frame.contentWindow?.postMessage(JSON.stringify({event:"command",func:"playVideo",args:[]}),"https://www.youtube-nocookie.com")};const coinPlayback=sound?.play();if(coinPlayback?.then)coinPlayback.then(startVideo).catch(error=>{console.warn("Coin recording could not be played.",error);startVideo()});else startVideo();try{sessionStorage.setItem(sessionKey,"true")}catch{}later(()=>machine.classList.add("is-powering"),180);later(()=>machine.classList.add("is-screen-on"),780);later(()=>machine.classList.add("is-ticker-on"),1280);later(()=>{machine.classList.add("is-awake");state="awake";status.textContent="Coin accepted — Jukebox is live."},1800);later(enableActions,2600)}else{machine.classList.add("is-screen-on","is-ticker-on","is-buttons-ready");unlock();status.textContent="Jukebox restored for this session.";if(video){video.pause();video.currentTime=0}}};
      coin.addEventListener("click",()=>awaken());coin.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();awaken()}});actions.forEach(action=>action.addEventListener("click",event=>{if(state!=="awake")event.preventDefault()}));share.addEventListener("click",async()=>{if(state!=="awake"){coin.focus();return}const url=shareUrl||location.href,data={title:document.title,text:"Open "+title.textContent+" Jukebox",url};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(url);status.textContent="Jukebox link copied."}}catch(error){if(error?.name!=="AbortError")status.textContent="Copy the browser address to share this Jukebox."}});video?.addEventListener("ended",()=>{status.textContent="Video completed. Choose an action or play it again."});document.addEventListener("visibilitychange",()=>{machine.classList.toggle("is-paused",document.hidden)});addEventListener("pagehide",clearTimers,{once:true});
      const fit=()=>{const spans=[...title.querySelectorAll("tspan")],twoLines=spans.length===2;title.style.fontSize=(twoLines?90:140)+"px";title.style.letterSpacing=twoLines?".055em":".105em";const measured=()=>Math.max(...(spans.length?spans:[title]).map(node=>node.getComputedTextLength()));let length=measured(),size=parseFloat(title.style.fontSize);if(length>840){size=Math.max(twoLines?48:36,size*840/length);title.style.fontSize=size+"px";length=measured()}if(length>840){title.style.letterSpacing=".02em";length=measured();if(length>840)title.style.fontSize=Math.max(twoLines?44:32,parseFloat(title.style.fontSize)*840/length)+"px"}};new ResizeObserver(fit).observe(title.ownerSVGElement);document.fonts?.ready?.then(fit).catch(()=>{});fit();try{if(sessionStorage.getItem(sessionKey)==="true")awaken(true)}catch{}
    })();
  </script>
</body>
</html>`;
}
