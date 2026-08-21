import { aggitsJukeboxIconAsset } from "./aggits-jukebox-icons.mjs";
import {
  MAHOGANY_LEGACY_LAYOUT_ID,
  MAHOGANY_LOCKED_TIMING,
  mahoganyLayoutCssVariables,
  resolveMahoganyLayoutProfile,
} from "./mahogany-jukebox-layout.mjs";
import { MAHOGANY_SECRET_SCREEN_TRANSITIONS } from "./mahogany-secret-screen-state.mjs";

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
  "mahogany-jukebox/2026-08-21-v16-concealed-screen-toggle";
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
export const MAHOGANY_SECRET_OPEN_MOTOR_ASSET =
  "/assets/audio/jukebox-screen-motor-open-original.wav";
export const MAHOGANY_SECRET_CLOSE_MOTOR_ASSET =
  "/assets/audio/jukebox-screen-motor-close-original.wav";
export const MAHOGANY_AGGITS_COIN_ASSET =
  "/assets/aggits-coin-gold-v1.png";
export const MAHOGANY_AGGITS_COIN_SHA256 =
  "a98943dec001c831ea8709eb260f87062782009cfd3a6665247be8585c3f87e1";
export const MAHOGANY_BUTTON_CLUNK_SHA256 =
  "d45c44c7cf8d700216c7f56182a430183df64880fe6aab834552daa6af6d5919";
export const MAHOGANY_BUTTON_LINK_DELAY_MS =
  MAHOGANY_LOCKED_TIMING.outboundDelayMs;

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
    secretVideoUrl = "",
    skinUrl = "",
    scriptNonce = "",
    publicMode = false,
    canonicalUrl = "",
  } = {},
) {
  const input = project.input;
  const customSkin = input?.cabinetSkin?.kind === "custom";
  const layout = resolveMahoganyLayoutProfile({
    layoutProfile: input?.layoutProfile || input?.cabinetSkin?.layoutProfile,
    skin: input?.cabinetSkin,
  });
  const fixedActionLayout = layout.id !== MAHOGANY_LEGACY_LAYOUT_ID;
  const layoutVariables = mahoganyLayoutCssVariables(layout);
  const cabinetAsset =
    customSkin &&
    /^\/[A-Za-z0-9_./?=&%-]+$/.test(String(skinUrl || ""))
      ? String(skinUrl)
      : MAHOGANY_OVAL_CABINET_ASSET;
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
  const secretVideoSource =
    project.secretVideo &&
    /^\/[A-Za-z0-9_./?=&%-]+$/.test(String(secretVideoUrl || ""))
      ? String(secretVideoUrl)
      : "";
  const sessionKey = publicMode
    ? `aggitsJukeboxActivated:${project.editionId || project.id}`
    : `deepCutsStudioAggitsJukeboxActivated:${project.id}`;
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#080402">
  <meta name="deep-cuts-renderer" content="${MAHOGANY_RENDERER_VERSION}">
  <title>${esc(input.name || "Aggits Jukebox")} Studio Preview</title>
  <link rel="preload" href="${cabinetAsset}" as="image">
  <style>
    *{box-sizing:border-box}[hidden]{display:none!important}html{background:#030201}body{margin:0;min-height:100vh;background:#030201;color:#f4d99c;font-family:Georgia,"Times New Roman",serif}button,a{font:inherit}
    main{width:min(100%,466px);margin:auto;padding:0 0 34px}.draft{display:flex;justify-content:space-between;gap:10px;padding:9px 13px;background:#090504;color:#b58b4b;font:800 8px/1.2 Arial,sans-serif;letter-spacing:.13em}.draft b{color:${project.readiness.handoffReady ? "#d9edb7" : "#ffd37b"}}
    .machine{position:relative;width:100%;aspect-ratio:var(--machine-aspect);overflow:hidden;background-color:rgba(0,0,0,.58);background-image:url("${cabinetAsset}");background-position:center;background-size:100% 100%;background-repeat:no-repeat;background-blend-mode:multiply;transition:background-color .65s ease}.machine:before{position:absolute;z-index:2;top:3.6%;left:12%;width:76%;height:15.5%;content:"";pointer-events:none;background:radial-gradient(ellipse at 50% 54%,rgba(255,183,76,.24),rgba(203,104,23,.07) 44%,transparent 72%);mix-blend-mode:screen;opacity:0;transition:opacity 1.05s ease}.machine:after{position:absolute;z-index:1;inset:0;content:"";pointer-events:none;background:radial-gradient(ellipse 80% 45% at 50% 7%,rgba(255,190,91,.12),transparent 64%),linear-gradient(90deg,rgba(111,12,7,.07),transparent 16% 84%,rgba(111,12,7,.07));mix-blend-mode:screen;opacity:.1;transition:opacity .7s}.machine.is-awake,.machine.is-powering{background-color:rgba(0,0,0,0)}.machine.is-neon-starting:before{animation:neonStartup ${MAHOGANY_LOCKED_TIMING.neonStartupMs}ms linear both}.machine.is-neon-starting:after{animation:neonCabinetStartup ${MAHOGANY_LOCKED_TIMING.neonStartupMs}ms linear both}.machine.is-neon-illuminated:before{opacity:.3}.machine.is-neon-illuminated:after{opacity:.4}.machine.is-paused .ticker span{animation-play-state:paused}
    .ticker{position:absolute;z-index:3;top:var(--ticker-top);left:var(--ticker-left);width:var(--ticker-width);height:var(--ticker-height);display:flex;align-items:center;overflow:hidden;border-radius:var(--ticker-radius);background:#030201;box-shadow:inset 0 0 13px #000;filter:brightness(.32);transition:filter .45s}.ticker:before{flex:none;margin-left:2.8%;content:"★";color:#f2d38a;font-size:clamp(13px,4vw,21px);text-shadow:0 0 4px #d99a32,0 0 8px rgba(122,63,18,.48)}.ticker span{display:block;width:max-content;padding-left:100%;color:#f2d38a;font:900 clamp(11px,3.45vw,19px)/1 "Courier New",monospace;letter-spacing:.055em;text-shadow:0 0 2px #fff0b8,0 0 6px #d99a32,0 0 10px rgba(122,63,18,.42);white-space:nowrap;animation:ticker 31s linear infinite;animation-play-state:paused}.machine.is-ticker-on .ticker{filter:brightness(1.08)}.machine.is-ticker-on .ticker span{animation-play-state:running}
    .video{position:absolute;z-index:3;top:var(--video-top);left:var(--video-left);width:var(--video-width);height:var(--video-height);overflow:hidden;border:0;border-radius:var(--video-radius);clip-path:inset(0 round var(--video-radius));isolation:isolate;background:#000;box-shadow:none}.video:after{position:absolute;z-index:4;inset:0;content:"";pointer-events:none;background:#010101;opacity:.82;transition:opacity .45s}.machine.is-screen-on .video:after{opacity:0}.screen-assembly,.secret-compartment{position:absolute;inset:0;width:100%;height:100%}.screen-assembly{z-index:2;background:#000;transform:translateY(0);transition:transform ${MAHOGANY_LOCKED_TIMING.secretScreenTravelMs}ms cubic-bezier(.42,0,.2,1);will-change:transform}.secret-compartment{z-index:1;display:grid;place-items:center;background:#010101;pointer-events:none}.machine.is-secret-open .secret-compartment{pointer-events:auto}.video video,.video iframe,.secret-compartment video{display:block;width:100%;height:100%;border:0;border-radius:inherit;background:#000;object-fit:cover;object-position:center}.screen-assembly>video,.screen-assembly>iframe{filter:brightness(.26) saturate(.44);transition:filter .45s}.machine.is-screen-on .screen-assembly>video,.machine.is-screen-on .screen-assembly>iframe{filter:none}.machine.is-secret-opening .screen-assembly,.machine.is-secret-open .screen-assembly{transform:translateY(-102%)}.machine.is-secret-closing .screen-assembly{transform:translateY(0)}.video-wait{height:100%;display:grid;align-content:center;justify-items:center;padding:12%;color:#9d7840;text-align:center}.video-wait strong{font:900 12px/1 Arial,sans-serif;letter-spacing:.1em}.video-wait span{margin-top:8px;color:#765a35;font:10px/1.45 Arial,sans-serif}
    .coin-control{position:absolute;z-index:6;top:var(--coin-top);left:var(--coin-left);width:var(--coin-width);aspect-ratio:1;height:auto;padding:0;border:0;outline:0;background:transparent;cursor:pointer;touch-action:manipulation;perspective:160px}.coin-art{display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,.88)) brightness(.94);transform:translateX(0) rotateY(0deg);transform-origin:8% 50%;animation:coinCall 2.8s ease-in-out infinite}.coin-control:focus-visible{filter:drop-shadow(0 0 2px #fff1ba) drop-shadow(0 0 8px rgba(255,208,92,.84))}.machine.is-accepting .coin-art{animation:coinInsert ${MAHOGANY_LOCKED_TIMING.coinInsertMs}ms cubic-bezier(.34,.02,.75,.34) forwards}.machine.is-awake .coin-control{pointer-events:none}.machine.is-awake .coin-art{animation:none;opacity:0}
    .actions{position:absolute;z-index:4;top:var(--actions-top);left:var(--actions-left);width:var(--actions-width);height:var(--actions-height);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--actions-gap);padding:var(--actions-padding);overflow:visible;background:transparent}.action{position:relative;z-index:1;display:grid;place-items:center;min-width:0;min-height:0;padding:12%;overflow:hidden;border:0;border-radius:50%;background:transparent;color:#d5a355;text-decoration:none;filter:brightness(.62) saturate(.72);opacity:.86;pointer-events:none;transform:scale(1);box-shadow:none;transition:filter .3s ease,opacity .3s ease,transform .14s cubic-bezier(.2,.7,.2,1),box-shadow .14s ease}.action-icon{position:absolute;z-index:1;display:block;top:50%;left:50%;width:40%;height:34%;overflow:visible;transform:translate(-50%,-50%);transform-origin:center}.action-icon img{position:absolute;inset:0;display:block;width:100%;height:100%;max-width:none;object-fit:contain;object-position:50% 50%;filter:drop-shadow(0 2px 2px rgba(0,0,0,.8))}.machine.is-buttons-ready .action[data-enabled="true"]{filter:brightness(.98) saturate(.94);opacity:1;pointer-events:auto}.action:focus-visible{outline:0;box-shadow:inset 0 0 0 clamp(2px,.55vw,4px) #ffe9ae,inset 0 0 0 clamp(4px,1vw,7px) #8b5725}.action.is-depressed{background:rgba(2,1,0,.44);transform:perspective(180px) translateY(4.5%) scale(.955) rotateX(-3deg);filter:brightness(.7) saturate(.75)!important;box-shadow:inset 0 12px 18px #000,inset 0 -2px 5px rgba(182,115,42,.11)}.action.is-depressed .action-icon{transform:translate(-50%,calc(-50% + 2px))}.action.is-disabled{filter:brightness(.18) saturate(.22);opacity:.18}
    .machine.is-fixed-action-layout .actions{display:block;padding:0}
    .machine.is-fixed-action-layout .action-icon{top:47.55%}
    .machine.is-fixed-action-layout .action.is-depressed .action-icon{transform:translate(-50%,-50%)}
    .machine.is-fixed-action-layout .action{position:absolute;padding:0}
    .machine.is-fixed-action-layout .action:nth-child(1){top:var(--action-1-top);left:var(--action-1-left);width:var(--action-1-width);height:var(--action-1-height)}
    .machine.is-fixed-action-layout .action:nth-child(2){top:var(--action-2-top);left:var(--action-2-left);width:var(--action-2-width);height:var(--action-2-height)}
    .machine.is-fixed-action-layout .action:nth-child(3){top:var(--action-3-top);left:var(--action-3-left);width:var(--action-3-width);height:var(--action-3-height)}
    .machine.is-fixed-action-layout .action:nth-child(4){top:var(--action-4-top);left:var(--action-4-left);width:var(--action-4-width);height:var(--action-4-height)}
    .share{position:absolute;z-index:5;top:var(--share-top);left:var(--share-left);width:var(--share-width);height:var(--share-height);border:0;background:transparent;color:transparent;cursor:pointer;pointer-events:none}.share:focus-visible{outline:3px solid #ffe6a0;outline-offset:-5px}.machine.is-awake .share{pointer-events:auto}.status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
    .secret-control{position:absolute;z-index:7;top:var(--main-play-top);left:var(--main-play-left);width:var(--main-play-width);height:var(--main-play-height);padding:0;border:0;border-radius:50%;background:transparent;cursor:pointer;touch-action:manipulation}.secret-control:focus-visible{outline:3px solid #ffe6a0;outline-offset:-5px}.secret-control:disabled,.secret-control[aria-disabled="true"]{cursor:not-allowed}
    .gate{padding:16px 20px 5px;color:#9b7b55;text-align:center;font:9px/1.55 Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase}.gate strong{display:block;margin-bottom:6px;color:${project.readiness.handoffReady ? "#d7e8aa" : "#ffd37b"};font-size:11px}.gate code{display:block;margin-top:7px;color:#d5b47a;font-family:inherit}.footer{padding:22px 0 0;color:#806b5d;font:9px/1.8 Arial,sans-serif;letter-spacing:.08em;text-align:center}.footer strong{color:#b89a7d;letter-spacing:.15em}
    @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-100%)}}@keyframes coinCall{0%,63%,100%{filter:drop-shadow(0 2px 4px rgba(0,0,0,.88)) brightness(.94)}78%{filter:drop-shadow(0 2px 5px rgba(0,0,0,.92)) brightness(1.08)}}@keyframes coinInsert{0%{transform:translateX(0) rotateY(0deg);opacity:1}62%{transform:translateX(-38%) rotateY(66deg) scale(.9);opacity:1}100%{transform:translateX(-56%) rotateY(88deg) scale(.82);opacity:0}}@keyframes neonStartup{0%{opacity:.03}7%{opacity:.62}12%{opacity:.05}19%{opacity:.78}25%{opacity:.12}34%{opacity:.66}39%{opacity:.04}49%{opacity:.86}55%{opacity:.18}66%,76%{opacity:1}100%{opacity:.3}}@keyframes neonCabinetStartup{0%{opacity:.06}7%{opacity:.58}12%{opacity:.09}19%{opacity:.7}25%{opacity:.15}34%{opacity:.62}39%{opacity:.08}49%{opacity:.78}55%{opacity:.2}66%,76%{opacity:.9}100%{opacity:.4}}
    @media(prefers-reduced-motion:reduce){.machine,.machine:before,.machine:after,.ticker,.video:after,.screen-assembly>video,.action{transition:none}.screen-assembly{transition-duration:${MAHOGANY_LOCKED_TIMING.reducedSecretScreenTravelMs}ms;transition-timing-function:linear}.machine.is-neon-starting:before,.machine.is-neon-starting:after{animation:none;opacity:.3}.coin-art{animation:none}.machine.is-accepting .coin-art{animation:coinInsertReduced ${MAHOGANY_LOCKED_TIMING.reducedCoinInsertMs}ms linear forwards}.ticker span{width:100%;padding:0 3%;overflow:hidden;text-overflow:ellipsis;animation:none}.machine.is-ticker-on .ticker span{animation:none}.machine.is-buttons-ready .action[data-enabled="true"]{filter:brightness(.98) saturate(.94);opacity:1}}@keyframes coinInsertReduced{to{transform:translateX(-56%) rotateY(88deg) scale(.82);opacity:0}}
  </style>
</head>
<body>
  <main>
    ${publicMode ? "" : `<div class="draft"><span>MAHOGANY JUKEBOX</span><b>${project.readiness.handoffReady ? "CONFIGURATION READY" : "DRAFT"}</b></div>`}
    <section id="machine" class="machine${fixedActionLayout ? " is-fixed-action-layout" : ""}" style="${esc(layoutVariables)}" data-renderer-version="${MAHOGANY_RENDERER_VERSION}" data-skin-profile="${esc(layout.id)}" aria-label="${esc(input.name || "Edition")} Mahogany Jukebox preview">
      <div class="ticker" role="status" aria-label="Edition ticker"><span>${esc(ticker)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
      <div class="video"><div id="secretCompartment" class="secret-compartment" aria-hidden="true" inert>${secretVideoSource ? `<video id="secretVideo" controls preload="metadata" playsinline webkit-playsinline src="${esc(secretVideoSource)}"${project.secretVideo?.loop ? " loop" : ""} aria-label="Concealed Jukebox video"></video>` : ""}</div><div id="screenAssembly" class="screen-assembly">${video}</div></div>
      <button id="coinButton" class="coin-control" type="button" aria-label="Insert the gold Aggits coin and start the Mahogany Jukebox"><img class="coin-art" src="${MAHOGANY_AGGITS_COIN_ASSET}" alt=""></button>
      <nav id="actions" class="actions" aria-label="Edition actions">${buttons}</nav>
      <button id="shareButton" class="share" type="button" aria-label="Share ${esc(input.name || "this Aggits Jukebox")}" aria-disabled="true"></button>
      <button id="secretControl" class="secret-control" type="button" aria-label="Open the concealed video compartment" aria-expanded="false" aria-busy="false" aria-disabled="${secretVideoSource ? "false" : "true"}"${secretVideoSource ? "" : " disabled"}></button>
      <p id="status" class="status" aria-live="polite">Insert the coin to start.</p>
    </section>
    ${publicMode ? "" : `<div class="gate"><strong>${project.readiness.handoffReady ? "CONFIGURATION COMPLETE" : "ADMINISTRATOR INPUT REQUIRED"}</strong>The title, ticker, selected video and four action slots are stored with this isolated project.<code>MP4 OPTION: 1890 × 1800 px · H.264 · 21:20 · fill canvas · no black padding</code></div>`}
    <footer class="footer" aria-label="Deep Cuts platform"><strong>Deep Cuts</strong><br>Copyright Clearlight Creative</footer>
  </main>
  <link rel="preload" href="/assets/audio/jukebox-real-coin-insert-cc0.mp3" as="audio" type="audio/mpeg">
  <link rel="preload" href="${MAHOGANY_BUTTON_CLUNK_ASSET}" as="audio" type="audio/ogg">
  <link rel="preload" href="${MAHOGANY_SECRET_OPEN_MOTOR_ASSET}" as="audio" type="audio/wav">
  <link rel="preload" href="${MAHOGANY_SECRET_CLOSE_MOTOR_ASSET}" as="audio" type="audio/wav">
  <audio id="buttonClunk" preload="auto" src="${MAHOGANY_BUTTON_CLUNK_ASSET}"></audio>
  <audio id="secretOpenMotor" preload="auto" src="${MAHOGANY_SECRET_OPEN_MOTOR_ASSET}"></audio>
  <audio id="secretCloseMotor" preload="auto" src="${MAHOGANY_SECRET_CLOSE_MOTOR_ASSET}"></audio>
  <audio id="secretOpenLatch" preload="auto" src="${MAHOGANY_BUTTON_CLUNK_ASSET}"></audio>
  <audio id="secretClosedLock" preload="auto" src="${MAHOGANY_BUTTON_CLUNK_ASSET}"></audio>
  <script src="/assets/js/jookbox-coin-audio.js"></script>
  <script${scriptNonce ? ` nonce="${esc(scriptNonce)}"` : ""}>
    (()=>{const machine=document.getElementById("machine"),coin=document.getElementById("coinButton"),video=document.getElementById("welcomeVideo"),frame=document.getElementById("welcomeFrame"),screenAssembly=document.getElementById("screenAssembly"),secretControl=document.getElementById("secretControl"),secretVideo=document.getElementById("secretVideo"),secretCompartment=document.getElementById("secretCompartment"),sound=window.DeepCutsJookBoxCoinAudio?.create("/assets/audio/jukebox-real-coin-insert-cc0.mp3",{volume:1,gain:1.15}),buttonClunk=document.getElementById("buttonClunk"),secretOpenMotor=document.getElementById("secretOpenMotor"),secretCloseMotor=document.getElementById("secretCloseMotor"),secretOpenLatch=document.getElementById("secretOpenLatch"),secretClosedLock=document.getElementById("secretClosedLock"),status=document.getElementById("status"),share=document.getElementById("shareButton"),actions=[...document.querySelectorAll('.action[data-enabled="true"]')],sessionKey=${JSON.stringify(sessionKey)},shareUrl=${JSON.stringify(canonicalUrl || "")},projectTitle=${JSON.stringify(input.name || "Mahogany Jukebox")},youtubeOrigin="https://www.youtube-nocookie.com",reducedMotion=matchMedia("(prefers-reduced-motion: reduce)").matches,secretTransitions=${JSON.stringify(MAHOGANY_SECRET_SCREEN_TRANSITIONS)},secretTravelMs=reducedMotion?${MAHOGANY_LOCKED_TIMING.reducedSecretScreenTravelMs}:${MAHOGANY_LOCKED_TIMING.secretScreenTravelMs};let state="sleeping",neonState="inactive",secretState="closed",timers=[],launchTimer=0,secretTransitionTimer=0,secretStallTimer=0,secretTransitionToken=0,closeAfterOpening=false,mainWasPlaying=false,secretAvailable=Boolean(secretVideo);
      const later=(callback,delay)=>{const timer=setTimeout(()=>{timers=timers.filter(value=>value!==timer);callback()},delay);timers.push(timer)};
      const clearTimers=()=>{timers.forEach(clearTimeout);timers=[]};
      const setNeonState=next=>{neonState=next;machine.dataset.neonState=next;machine.classList.toggle("is-neon-starting",next==="starting");machine.classList.toggle("is-neon-illuminated",next==="illuminated")};
      const setSecretState=next=>{secretState=next;machine.dataset.secretState=next;["opening","open","closing"].forEach(value=>machine.classList.toggle("is-secret-"+value,next===value));const moving=next==="opening"||next==="closing",expanded=next!=="closed";secretControl.setAttribute("aria-expanded",String(expanded));secretControl.setAttribute("aria-busy",String(moving));secretControl.setAttribute("aria-disabled",String(moving||!secretAvailable));secretControl.disabled=moving||!secretAvailable;secretControl.setAttribute("aria-label",next==="closed"?"Open the concealed video compartment":next==="open"?"Close the concealed video compartment":next==="opening"?"Concealed video compartment is opening":"Concealed video compartment is closing");secretCompartment?.setAttribute("aria-hidden",String(next!=="open"));if(secretCompartment)secretCompartment.inert=next!=="open"};
      const postYouTube=(func,args=[])=>{if(!frame?.contentWindow)return;frame.contentWindow.postMessage(JSON.stringify({event:"command",func,args,id:"welcomeFrame"}),youtubeOrigin)};
      const connectYouTube=()=>{if(!frame?.contentWindow)return;frame.contentWindow.postMessage(JSON.stringify({event:"listening",id:"welcomeFrame"}),youtubeOrigin)};
      const unlock=()=>{actions.forEach(action=>{action.href=action.dataset.href;if(action.dataset.newTab==="true"){action.target="_blank";action.rel="noopener noreferrer"}action.removeAttribute("aria-disabled");action.tabIndex=0});share.removeAttribute("aria-disabled")};
      const enableActions=()=>{machine.classList.add("is-buttons-ready");unlock()};
      const awaken=(restore=false)=>{if(state!=="sleeping")return;state=restore?"awake":"acceptingCoin";machine.classList.add(restore?"is-awake":"is-accepting");if(!restore){setNeonState("starting");if(frame)connectYouTube();const startVideo=()=>{if(video){video.currentTime=0;const playback=video.play();playback?.catch?.(()=>{status.textContent="Coin accepted — press Play to start the video."})}if(frame){connectYouTube();postYouTube("playVideo")}};const coinPlayback=sound?.play();if(coinPlayback?.then)coinPlayback.then(startVideo).catch(error=>{console.warn("Coin recording could not be played.",error);startVideo()});else startVideo();try{sessionStorage.setItem(sessionKey,"true")}catch{}later(()=>machine.classList.add("is-powering"),${MAHOGANY_LOCKED_TIMING.powerUpMs.cabinet});later(()=>setNeonState("illuminated"),reducedMotion?180:${MAHOGANY_LOCKED_TIMING.neonStartupMs});later(()=>machine.classList.add("is-screen-on"),${MAHOGANY_LOCKED_TIMING.powerUpMs.screen});later(()=>machine.classList.add("is-ticker-on"),${MAHOGANY_LOCKED_TIMING.powerUpMs.ticker});later(()=>{machine.classList.add("is-awake");state="awake";status.textContent="Coin accepted — Jukebox is live."},${MAHOGANY_LOCKED_TIMING.powerUpMs.awake});later(enableActions,${MAHOGANY_LOCKED_TIMING.powerUpMs.actions})}else{setNeonState("illuminated");machine.classList.add("is-screen-on","is-ticker-on","is-buttons-ready");unlock();status.textContent="Jukebox restored for this session.";if(video){video.pause();video.currentTime=0}if(frame)connectYouTube()}};
      const stopMechanicalSound=audio=>{if(!audio)return;audio.pause();audio.currentTime=0};
      const playMechanicalSound=(audio,rate=1,volume=.72)=>{if(!audio)return;stopMechanicalSound(audio);audio.volume=volume;audio.playbackRate=rate;audio.play().catch(error=>console.warn("Mechanical compartment sound could not be played.",error))};
      const stopSecretSounds=()=>[secretOpenMotor,secretCloseMotor,secretOpenLatch,secretClosedLock].forEach(stopMechanicalSound);
      const clearSecretTransition=()=>{clearTimeout(secretTransitionTimer);clearTimeout(secretStallTimer);secretTransitionTimer=0;secretStallTimer=0};
      const restoreMainMedia=()=>{if(video&&mainWasPlaying)video.play().catch(()=>{});if(frame&&mainWasPlaying)postYouTube("playVideo")};
      const startSecretPlayback=()=>{if(secretState!=="open"||!secretVideo)return;secretVideo.currentTime=0;const playback=secretVideo.play();if(playback?.catch)playback.catch(()=>{status.textContent="Concealed video ready — press Play to begin."});status.textContent="Concealed video playing."};
      const finishSecretTransition=token=>{if(token!==secretTransitionToken)return;clearTimeout(secretTransitionTimer);secretTransitionTimer=0;const next=secretTransitions[secretState]?.ARRIVE||secretState;if(secretState==="opening"&&next==="open"){stopMechanicalSound(secretOpenMotor);setSecretState("open");playMechanicalSound(secretOpenLatch,1,.76);status.textContent="Concealed video compartment open.";startSecretPlayback();if(closeAfterOpening||document.hidden){closeAfterOpening=false;queueMicrotask(()=>requestSecretClose("Concealed video closed while this page is hidden."))}}else if(secretState==="closing"&&next==="closed"){stopMechanicalSound(secretCloseMotor);if(secretVideo){secretVideo.pause();secretVideo.currentTime=0}setSecretState("closed");playMechanicalSound(secretClosedLock,.84,.78);restoreMainMedia();status.textContent="Concealed video compartment closed."}};
      const beginSecretTransition=next=>{if(next!=="opening"&&next!=="closing")return;clearSecretTransition();stopSecretSounds();secretTransitionToken+=1;const token=secretTransitionToken;setSecretState(next);if(next==="opening"){status.textContent="Opening concealed video compartment.";if(!reducedMotion)playMechanicalSound(secretOpenMotor,1,.64)}else{if(secretVideo)secretVideo.pause();status.textContent="Closing concealed video compartment.";if(!reducedMotion)playMechanicalSound(secretCloseMotor,1,.64)}secretTransitionTimer=setTimeout(()=>finishSecretTransition(token),secretTravelMs+${MAHOGANY_LOCKED_TIMING.secretScreenFallbackPaddingMs})};
      const requestSecretClose=(reason="")=>{if(secretState==="opening"){closeAfterOpening=true;if(reason)status.textContent=reason;return}if(secretState!=="open")return;closeAfterOpening=false;if(reason)status.textContent=reason;const next=secretTransitions[secretState]?.TOGGLE||secretState;if(next==="closing")beginSecretTransition(next)};
      const toggleSecret=()=>{if(secretState==="opening"||secretState==="closing")return;if(state!=="awake"){status.textContent="Insert the coin before opening the concealed compartment.";coin.focus();return}if(!secretAvailable||!secretVideo){status.textContent="No concealed video is configured for this Jukebox.";return}if(secretState==="closed"){mainWasPlaying=Boolean(video&&!video.paused);video?.pause();if(frame){mainWasPlaying=true;postYouTube("pauseVideo")}closeAfterOpening=false;beginSecretTransition(secretTransitions.closed.TOGGLE)}else if(secretState==="open")requestSecretClose()};
      const resetSecretImmediately=()=>{secretTransitionToken+=1;clearSecretTransition();stopSecretSounds();closeAfterOpening=false;if(secretVideo){secretVideo.pause();secretVideo.currentTime=0}setSecretState("closed")};
      const openAfterClunk=action=>{const href=action.dataset.href;clearTimeout(launchTimer);const outboundWindow=window.open("about:blank","_blank");if(outboundWindow){try{outboundWindow.opener=null;outboundWindow.document.title="Opening destination"}catch{}launchTimer=setTimeout(()=>{if(outboundWindow.closed)return;try{const outbound=outboundWindow.document.createElement("a");outbound.href=href;outbound.target="_self";outbound.rel="noopener noreferrer";outboundWindow.document.body.append(outbound);outbound.click()}catch{try{outboundWindow.location.replace(href)}catch{}}},${MAHOGANY_BUTTON_LINK_DELAY_MS});return}const outbound=document.createElement("a");outbound.href=href;outbound.target="_blank";outbound.rel="noopener noreferrer";outbound.style.display="none";document.body.append(outbound);outbound.click();outbound.remove()};
      const pressAction=(event,action)=>{event.preventDefault();if(state!=="awake")return;actions.forEach(candidate=>candidate.classList.toggle("is-depressed",candidate===action));if(buttonClunk){buttonClunk.pause();buttonClunk.currentTime=0;buttonClunk.volume=.88;buttonClunk.play().catch(error=>console.warn("Mechanical button sound could not be played.",error))}status.textContent=action.getAttribute("aria-label")+" selected. Mechanical linkage engaged.";openAfterClunk(action)};
      coin.addEventListener("click",()=>awaken());coin.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();if(!event.repeat)awaken()}});secretControl.addEventListener("click",toggleSecret);secretControl.addEventListener("keydown",event=>{if(event.key!=="Enter"&&event.key!==" ")return;event.preventDefault();if(!event.repeat)toggleSecret()});screenAssembly?.addEventListener("transitionend",event=>{if(event.target===screenAssembly&&event.propertyName==="transform"&&(secretState==="opening"||secretState==="closing"))finishSecretTransition(secretTransitionToken)});actions.forEach(action=>action.addEventListener("click",event=>pressAction(event,action)));share.addEventListener("click",async()=>{if(state!=="awake"){coin.focus();return}const url=shareUrl||location.href,data={title:document.title,text:"Open "+projectTitle+" Jukebox",url};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(url);status.textContent="Jukebox link copied."}}catch(error){if(error?.name!=="AbortError")status.textContent="Copy the browser address to share this Jukebox."}});video?.addEventListener("ended",()=>{status.textContent="Video completed. Choose an action or play it again."});secretVideo?.addEventListener("ended",()=>requestSecretClose("Concealed video completed. Closing compartment."));secretVideo?.addEventListener("error",()=>{secretAvailable=false;requestSecretClose("Concealed video failed to load. Closing compartment safely.");if(secretState==="closed")setSecretState("closed")});secretVideo?.addEventListener("stalled",()=>{clearTimeout(secretStallTimer);secretStallTimer=setTimeout(()=>requestSecretClose("Concealed video stalled. Closing compartment safely."),12000)});secretVideo?.addEventListener("playing",()=>{clearTimeout(secretStallTimer);secretStallTimer=0});frame?.addEventListener("load",connectYouTube);document.addEventListener("visibilitychange",()=>{machine.classList.toggle("is-paused",document.hidden);if(document.hidden&&secretState!=="closed")requestSecretClose("Concealed video closing while this page is hidden.")});addEventListener("pagehide",()=>{clearTimers();clearTimeout(launchTimer);resetSecretImmediately()},{once:true});
      try{if(sessionStorage.getItem(sessionKey)==="true")awaken(true)}catch{}
    })();
  </script>
</body>
</html>`;
}
