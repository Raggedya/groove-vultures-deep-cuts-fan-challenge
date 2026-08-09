import { aggitsJukeboxIconAsset } from "./aggits-jukebox-icons.mjs";

export const INVITATION_RENDERER_VERSION = "invitation-jukebox/2026-08-09-v1";
export const INVITATION_CABINET_ASSETS = Object.freeze({
  wedding: "/assets/invitation-jukebox/wedding-cabinet.png",
  birthday: "/assets/invitation-jukebox/birthday-cabinet.png",
  corporate: "/assets/invitation-jukebox/corporate-cabinet.png",
  seasonal: "/assets/invitation-jukebox/seasonal-cabinet.png",
  group_trip: "/assets/invitation-jukebox/group-trip-cabinet.png",
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
  const when = eventDate(project.event);
  const location = [project.event?.venue, project.event?.address].filter(Boolean).join(" · ");
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
    *{box-sizing:border-box}html{background:#050403}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 0,#24180f,#050403 55%);color:#f6ddb0;font-family:Georgia,"Times New Roman",serif}button,a{font:inherit}main{width:min(100%,570px);margin:auto;padding-bottom:28px}.draft{display:flex;justify-content:space-between;padding:10px 14px;background:#0b0806;color:#a98b67;font:800 9px/1.2 Arial,sans-serif;letter-spacing:.14em}.machine{position:relative;width:100%;aspect-ratio:953/1688;background:url("${cabinet}") center/100% 100% no-repeat;filter:drop-shadow(0 18px 30px #000);overflow:hidden}.ticker{position:absolute;top:15.2%;left:16%;width:68%;height:5.6%;display:flex;align-items:center;overflow:hidden;border-radius:40px;color:#ffe2a2;text-shadow:0 0 8px #dd8d28;font:900 clamp(10px,3vw,18px)/1.05 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase}.ticker span{display:block;width:max-content;min-width:100%;padding-left:100%;white-space:nowrap;animation:scroll 24s linear infinite}.display{position:absolute;top:22.2%;left:23.2%;width:61.7%;height:36.1%;overflow:hidden;background:#080604}.display:after{position:absolute;inset:0;content:"";pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.18) 42%,rgba(0,0,0,.9))}.display video,.display iframe{width:100%;height:100%;border:0;object-fit:cover}.media-placeholder{width:100%;height:100%;background:radial-gradient(circle at 50% 30%,rgba(188,132,64,.23),transparent 55%),linear-gradient(145deg,#16100b,#030202)}.invite-copy{position:absolute;z-index:2;left:7%;right:7%;bottom:6%;text-align:center;text-shadow:0 2px 8px #000}.invite-copy .kind{display:block;color:#d8ab62;font:800 clamp(8px,2.1vw,12px)/1.2 Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase}.invite-copy h1{margin:5px 0 4px;color:#fff1cf;font-size:clamp(22px,7vw,42px);line-height:.94}.invite-copy .hosts{margin:0;color:#e1b970;font:italic clamp(13px,3.8vw,22px)/1.1 Georgia,serif}.invite-copy .details{margin:8px 0 0;color:#f6e6c9;font:700 clamp(8px,2.2vw,12px)/1.35 Arial,sans-serif;letter-spacing:.06em}.invite-copy .message{display:-webkit-box;margin:7px auto 0;max-width:90%;overflow:hidden;color:#d8c7ad;font:clamp(8px,2vw,11px)/1.35 Arial,sans-serif;-webkit-line-clamp:2;-webkit-box-orient:vertical}.actions{position:absolute;top:60.3%;left:13.2%;width:73.7%;height:17.2%;display:grid;grid-template-columns:repeat(4,1fr);gap:1.4%}.action{display:flex;min-width:0;flex-direction:column;align-items:center;justify-content:center;padding:15% 8% 10%;border-radius:50%;color:#eec773;text-align:center;text-decoration:none;text-shadow:0 2px 4px #000;transition:filter .16s,transform .16s}.action:hover,.action:focus-visible{outline:none;filter:brightness(1.35);transform:translateY(-2%)}.action img{width:51%;height:45%;object-fit:contain;filter:sepia(1) saturate(.7) brightness(1.4) drop-shadow(0 2px 3px #000)}.action span{display:block;margin-top:7%;font:800 clamp(6px,1.8vw,10px)/1.05 Arial,sans-serif;letter-spacing:.02em;text-transform:uppercase}.action.disabled{opacity:.35}.share{position:absolute;top:78.1%;left:14.2%;width:71.6%;height:5.2%;border:0;background:transparent;color:#e9bd70;cursor:pointer;font:900 clamp(9px,2.8vw,16px)/1 Arial,sans-serif;letter-spacing:.08em;text-shadow:0 2px 4px #000;text-transform:uppercase}.share:focus-visible{outline:2px solid #ffe09b}.copyright-plaque{position:absolute;z-index:4;bottom:1.05%;left:24%;width:52%;height:2.35%;display:flex;align-items:center;justify-content:center;border:1px solid #a87936;border-radius:999px;background:linear-gradient(180deg,rgba(91,55,22,.96),rgba(25,15,8,.98));box-shadow:inset 0 0 0 1px rgba(242,197,116,.22),0 2px 5px #000;color:#e1bb79;text-align:center;text-shadow:0 1px 2px #000;font:700 clamp(6px,1.65vw,9px)/1 Georgia,"Times New Roman",serif;letter-spacing:.025em;white-space:nowrap}.status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.footer{padding:24px 0;color:#82705e;text-align:center;font:9px/1.7 Arial,sans-serif;letter-spacing:.08em}.footer strong{color:#b99a78;letter-spacing:.15em}@keyframes scroll{to{transform:translateX(-100%)}}@media(prefers-reduced-motion:reduce){.ticker span{width:100%;padding:0 3%;overflow:hidden;text-overflow:ellipsis;animation:none}}
  </style>
</head>
<body>
  <main>
    ${publicMode ? "" : `<div class="draft"><span>INVITATION JUKEBOX</span><b>${project.readiness?.ready ? "READY" : "DRAFT"}</b></div>`}
    <section class="machine" aria-label="${esc(project.title || "Invitation")} jukebox">
      <div class="ticker"><span>${esc((project.tickerText || "YOUR INVITATION MESSAGE").toUpperCase())}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
      <div class="display">${media}<div class="invite-copy"><span class="kind">${esc(type.replace("_", " "))} invitation</span><h1>${esc(project.title || "Your Event")}</h1><p class="hosts">${esc(project.hostNames || "Your names")}</p><p class="details">${esc(when)}${when && location ? " · " : ""}${esc(location)}</p><p class="message">${esc(project.message)}</p></div></div>
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

function eventDate(event = {}) {
  if (!event.date) return "";
  const date = new Date(`${event.date}T${event.time || "12:00"}:00`);
  if (!Number.isFinite(date.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(date);
  return `${formatted}${event.time ? ` · ${event.time}` : ""}`;
}
function youtubeVideoId(value) {
  const text = String(value || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  try { const url = new URL(text); const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.pathname === "/watch" ? url.searchParams.get("v") : (url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/) || [])[1]; return /^[A-Za-z0-9_-]{11}$/.test(String(id || "")) ? String(id) : ""; } catch { return ""; }
}
