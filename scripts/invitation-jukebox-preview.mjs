import { aggitsJukeboxIconAsset } from "./aggits-jukebox-icons.mjs";

export const INVITATION_RENDERER_VERSION = "invitation-jukebox/2026-08-09-v2";
export const INVITATION_CABINET_ASSETS = Object.freeze({
  wedding: "/assets/invitation-jukebox/wedding-cabinet.png",
  birthday: "/assets/invitation-jukebox/birthday-cabinet.png",
  corporate: "/assets/invitation-jukebox/corporate-cabinet.png",
  seasonal: "/assets/invitation-jukebox/seasonal-cabinet.png",
  group_trip: "/assets/invitation-jukebox/group-trip-cabinet.png",
});

// Every cabinet type uses this one interaction map. The media rectangle is
// deliberately inset from the coin mechanism so an MP4 can never cover it.
export const INVITATION_LAYOUT = Object.freeze({
  machineAspectRatio: "953 / 1650",
  brand: Object.freeze({ top: "5.2%", left: "19%", width: "62%", height: "8.2%" }),
  ticker: Object.freeze({ top: "15.7%", left: "17.5%", width: "65%", height: "5.3%" }),
  media: Object.freeze({ top: "25.3%", left: "26.4%", width: "57.1%", height: "31.6%" }),
  actions: Object.freeze({ top: "60.2%", left: "13.2%", width: "73.7%", height: "16.9%" }),
  share: Object.freeze({ top: "78.1%", left: "14.2%", width: "71.6%", height: "5.2%" }),
});

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

export function renderInvitationJukeboxPreview(project, {
  videoUrl = "", youtubeUrl = "", publicMode = false, canonicalUrl = "", scriptNonce = "",
} = {}) {
  const type = INVITATION_CABINET_ASSETS[project.invitationType] ? project.invitationType : "wedding";
  const cabinet = INVITATION_CABINET_ASSETS[type];
  const actions = Array.from({ length: 4 }, (_, index) => project.actions?.[index] || {});
  const youtubeId = youtubeVideoId(youtubeUrl || project.video?.youtubeUrl);
  const media = youtubeId
    ? `<iframe id="eventFrame" src="https://www.youtube-nocookie.com/embed/${youtubeId}?enablejsapi=1&amp;rel=0&amp;playsinline=1" title="${esc(project.title || "Invitation")} video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
    : project.video?.kind === "mp4" && videoUrl
      ? `<video id="eventVideo" controls playsinline preload="metadata" src="${esc(videoUrl)}"></video>`
      : `<div class="media-placeholder" aria-hidden="true"></div>`;
  const actionMarkup = actions.map((item, index) => {
    const enabled = item.href && item.label;
    const icon = aggitsJukeboxIconAsset(item.iconId);
    const inner = `${icon ? `<img src="${esc(icon)}" alt="">` : ""}<span>${esc(item.label || `Key ${index + 1}`)}</span>`;
    return enabled
      ? `<a class="action" href="${esc(item.href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(item.label)}">${inner}</a>`
      : `<span class="action disabled" aria-hidden="true">${inner}</span>`;
  }).join("");
  const shareUrl = canonicalUrl || "";
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#070504">
  <meta name="deep-cuts-renderer" content="${INVITATION_RENDERER_VERSION}">
  <title>${esc(project.title || "Invitation Jukebox")}</title>
  <link rel="preload" href="${cabinet}" as="image">
  <style>
    *{box-sizing:border-box}
    html{background:#050403}
    body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 0,#24180f,#050403 55%);color:#f6ddb0;font-family:Georgia,"Times New Roman",serif}
    button,a{font:inherit}
    main{width:min(100%,570px);margin:auto;padding-bottom:28px}
    .draft{display:flex;justify-content:space-between;padding:10px 14px;background:#0b0806;color:#a98b67;font:800 9px/1.2 Arial,sans-serif;letter-spacing:.14em}
    .machine{--leather-hi:#75604c;--leather-mid:#4b392d;--leather-low:#241a14;position:relative;width:100%;aspect-ratio:${INVITATION_LAYOUT.machineAspectRatio};background:url("${cabinet}") center/100% 100% no-repeat;filter:drop-shadow(0 18px 30px #000);overflow:hidden}
    .type-wedding{--leather-hi:#806c57;--leather-mid:#514237;--leather-low:#2b211b}
    .type-birthday{--leather-hi:#795d69;--leather-mid:#4d3544;--leather-low:#271923}
    .type-corporate{--leather-hi:#5e6570;--leather-mid:#353b45;--leather-low:#191d24}
    .type-seasonal{--leather-hi:#695b44;--leather-mid:#403427;--leather-low:#211912}
    .type-group_trip{--leather-hi:#765642;--leather-mid:#493124;--leather-low:#241711}
    .brand{position:absolute;z-index:3;top:${INVITATION_LAYOUT.brand.top};left:${INVITATION_LAYOUT.brand.left};width:${INVITATION_LAYOUT.brand.width};height:${INVITATION_LAYOUT.brand.height};display:flex;align-items:center;justify-content:center;color:#d3a35b;font:900 clamp(31px,10.8vw,62px)/.9 Copperplate,"Copperplate Gothic Light","Palatino Linotype",Georgia,serif;letter-spacing:.075em;text-align:center;text-transform:uppercase;-webkit-text-stroke:clamp(.6px,.22vw,1.25px) #f1cd85;text-shadow:0 1px 0 #fff0bd,0 3px 0 #7a491e,0 5px 7px #000,0 0 13px rgba(231,163,66,.45)}
    .ticker{position:absolute;top:${INVITATION_LAYOUT.ticker.top};left:${INVITATION_LAYOUT.ticker.left};width:${INVITATION_LAYOUT.ticker.width};height:${INVITATION_LAYOUT.ticker.height};display:flex;align-items:center;overflow:hidden;border-radius:40px;color:#ffe2a2;text-shadow:0 0 8px #dd8d28;font:900 clamp(10px,3vw,18px)/1.05 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase}
    .ticker span{display:block;width:max-content;min-width:100%;padding-left:100%;white-space:nowrap;animation:scroll 24s linear infinite}
    .display{position:absolute;z-index:2;top:${INVITATION_LAYOUT.media.top};left:${INVITATION_LAYOUT.media.left};width:${INVITATION_LAYOUT.media.width};height:${INVITATION_LAYOUT.media.height};overflow:hidden;border:clamp(1px,.3vw,2px) solid rgba(190,137,69,.78);border-radius:1.2%;background:#020202;box-shadow:0 0 0 clamp(2px,.65vw,4px) rgba(9,6,4,.9),inset 0 0 18px #000,0 3px 7px #000}
    .display video,.display iframe{display:block;width:100%;height:100%;border:0;background:#000;object-fit:cover}
    .media-placeholder{width:100%;height:100%;background:#020202}
    .actions{position:absolute;z-index:3;top:${INVITATION_LAYOUT.actions.top};left:${INVITATION_LAYOUT.actions.left};width:${INVITATION_LAYOUT.actions.width};height:${INVITATION_LAYOUT.actions.height};display:grid;grid-template-columns:repeat(4,1fr);gap:1.4%}
    .action{position:relative;display:flex;min-width:0;flex-direction:column;align-items:center;justify-content:center;padding:15% 8% 10%;overflow:hidden;border:clamp(1px,.3vw,2px) solid rgba(214,170,104,.62);border-radius:50%;background:radial-gradient(circle at 25% 18%,rgba(255,255,255,.16),transparent 30%),repeating-radial-gradient(ellipse at 45% 40%,rgba(255,255,255,.025) 0 1px,rgba(0,0,0,.035) 1px 3px),linear-gradient(145deg,var(--leather-hi),var(--leather-mid) 48%,var(--leather-low));box-shadow:inset 0 3px 4px rgba(255,235,201,.27),inset 0 -9px 13px rgba(0,0,0,.62),inset 3px 0 7px rgba(255,255,255,.06),0 5px 9px rgba(0,0,0,.8),0 0 0 clamp(2px,.65vw,4px) rgba(21,13,8,.72);color:#f0cc86;text-align:center;text-decoration:none;text-shadow:0 2px 4px #000;transition:filter .16s,transform .16s}
    .action:before{position:absolute;inset:3%;border:1px solid rgba(244,207,145,.13);border-radius:50%;content:"";pointer-events:none}
    .action:hover,.action:focus-visible{outline:none;filter:brightness(1.16);transform:translateY(-2%)}
    .action img,.action span{position:relative;z-index:1}
    .action img{width:49%;height:43%;object-fit:contain;filter:sepia(1) saturate(.65) brightness(1.52) drop-shadow(0 2px 3px #000)}
    .action span{display:block;margin-top:7%;font:800 clamp(6px,1.8vw,10px)/1.05 Arial,sans-serif;letter-spacing:.02em;text-transform:uppercase}
    .action.disabled{opacity:.58}
    .share{position:absolute;top:${INVITATION_LAYOUT.share.top};left:${INVITATION_LAYOUT.share.left};width:${INVITATION_LAYOUT.share.width};height:${INVITATION_LAYOUT.share.height};border:0;background:transparent;color:#e9bd70;cursor:pointer;font:900 clamp(9px,2.8vw,16px)/1 Arial,sans-serif;letter-spacing:.08em;text-shadow:0 2px 4px #000;text-transform:uppercase}
    .share:focus-visible{outline:2px solid #ffe09b}
    .copyright-plaque{position:absolute;z-index:4;bottom:1.05%;left:24%;width:52%;height:2.35%;display:flex;align-items:center;justify-content:center;border:1px solid #a87936;border-radius:999px;background:linear-gradient(180deg,rgba(91,55,22,.96),rgba(25,15,8,.98));box-shadow:inset 0 0 0 1px rgba(242,197,116,.22),0 2px 5px #000;color:#e1bb79;text-align:center;text-shadow:0 1px 2px #000;font:700 clamp(6px,1.65vw,9px)/1 Georgia,"Times New Roman",serif;letter-spacing:.025em;white-space:nowrap}
    .status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
    .footer{padding:24px 0;color:#82705e;text-align:center;font:9px/1.7 Arial,sans-serif;letter-spacing:.08em}
    .footer strong{color:#b99a78;letter-spacing:.15em}
    @keyframes scroll{to{transform:translateX(-100%)}}
    @media(prefers-reduced-motion:reduce){.ticker span{width:100%;padding:0 3%;overflow:hidden;text-overflow:ellipsis;animation:none}}
  </style>
</head>
<body>
  <main>
    ${publicMode ? "" : `<div class="draft"><span>INVITATION JUKEBOX</span><b>${project.readiness?.ready ? "READY" : "DRAFT"}</b></div>`}
    <section class="machine type-${type}" aria-label="${esc(project.title || "Invitation")} jukebox">
      <div class="brand" aria-label="AGGITS">AGGITS</div>
      <div class="ticker"><span>${esc((project.tickerText || "YOUR INVITATION MESSAGE").toUpperCase())}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
      <div class="display" aria-label="Invitation video">${media}</div>
      <nav class="actions" aria-label="Invitation actions">${actionMarkup}</nav>
      <button id="share" class="share" type="button">Share this invitation</button>
      <div class="copyright-plaque" aria-label="Copyright Clearlight Creative 2026">Copyright Clearlight Creative 2026</div>
      <p id="status" class="status" aria-live="polite"></p>
    </section>
    <footer class="footer"><strong>Deep Cuts</strong><br>Copyright Clearlight Creative</footer>
  </main>
  <script${scriptNonce ? ` nonce="${esc(scriptNonce)}"` : ""}>document.getElementById("share").addEventListener("click",async()=>{const status=document.getElementById("status"),url=${JSON.stringify(shareUrl)}||location.href,data={title:${JSON.stringify(project.title || "Invitation")},text:"You're invited",url};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(url);status.textContent="Invitation link copied."}}catch(error){if(error?.name!=="AbortError")status.textContent="Copy the browser address to share."}});</script>
</body>
</html>`;
}

function youtubeVideoId(value) {
  const text = String(value || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text);
    const id = url.hostname === "youtu.be"
      ? url.pathname.slice(1)
      : url.pathname === "/watch"
        ? url.searchParams.get("v")
        : (url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/) || [])[1];
    return /^[A-Za-z0-9_-]{11}$/.test(String(id || "")) ? String(id) : "";
  } catch {
    return "";
  }
}

