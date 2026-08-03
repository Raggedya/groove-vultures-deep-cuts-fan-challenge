const state={
  token:"",
  productTypes:[],
  legacyProductTypes:[],
  aggitsOptions:[],
  aggitsJukeboxIcons:[],
  project:null,
  previewUrl:"",
  handoffUrl:"",
  recognition:null,
  toastTimer:null
};

const $=selector=>document.querySelector(selector);
const els={
  form:$("#studio-form"),
  name:$("#project-name"),
  nameLabel:$("#project-name-label"),
  type:$("#project-type"),
  typeDescription:$("#type-description"),
  wheelChoice:$("#wheel-choice"),
  wheelChoices:[...document.querySelectorAll('input[name="addWheel"]')],
  aggitsStep:$("#aggits-step"),
  aggits:$("#aggits-option"),
  aggitsPolicy:$("#aggits-policy"),
  aggitsThumbnail:$("#aggits-thumbnail"),
  sourceLabels:[$("#source-label-1"),$("#source-label-2"),$("#source-label-3"),$("#source-label-4"),$("#source-label-5")],
  sources:[$("#source-url-1"),$("#source-url-2"),$("#source-url-3"),$("#source-url-4"),$("#source-url-5")],
  sourceStack:document.querySelector(".url-stack"),
  barRows:[...document.querySelectorAll(".bar-only-row")],
  contentIntro:$("#content-intro"),
  youtube:$("#youtube-url"),
  brief:$("#project-brief"),
  briefField:$("#brief-field"),
  barTickerField:$("#bar-ticker-field"),
  barTicker:$("#bar-ticker"),
  barAboutField:$("#bar-about-field"),
  barAbout:$("#bar-about"),
  barVideoField:$("#bar-video-field"),
  mp4:$("#mp4-file"),
  videoState:$("#video-state"),
  removeVideo:$("#remove-video"),
  aggitsJukeboxActions:$("#aggits-jukebox-actions"),
  aggitsActionRows:[...document.querySelectorAll(".aggits-jukebox-action")],
  aggitsVideoGuide:$("#aggits-video-guide"),
  posterHeading:$("#poster-heading"),
  optionalFields:$("#optional-fields"),
  logo:$("#logo-file"),
  logoState:$("#logo-state"),
  removeLogo:$("#remove-logo"),
  mp3:$("#mp3-file"),
  audioState:$("#audio-state"),
  removeAudio:$("#remove-audio"),
  localNote:$("#local-note"),
  runLabel:$("#run-label"),
  runDescription:$("#run-description"),
  runButton:$("#studio-form .run-button"),
  savePublish:$("#save-publish-venue"),
  publishLabel:$("#direct-publish-label"),
  publishDetail:$("#direct-publish-detail"),
  publishStatus:$("#direct-publish-status"),
  publishMessage:$("#direct-publish-message"),
  publishLive:$("#direct-publish-live"),
  publishQr:$("#direct-publish-qr"),
  projectVersion:$("#project-version"),
  recent:$("#recent-projects"),
  preview:$("#mobile-preview"),
  refresh:$("#refresh-preview"),
  openPreview:$("#open-preview"),
  emptyOutput:$("#empty-output"),
  readyOutput:$("#ready-output"),
  outputTitle:$("#output-title"),
  outputStatus:$("#output-status"),
  qr:$("#qr-code"),
  poster:$("#poster-canvas"),
  qrOutputTitle:$("#qr-output-title"),
  qrName:$("#qr-project-name"),
  downloadPoster:$("#download-poster"),
  downloadQr:$("#download-qr"),
  downloadHandoff:$("#download-handoff"),
  revision:$("#revision-text"),
  applyRevision:$("#apply-revision"),
  revisionMessage:$("#revision-message"),
  dictate:$("#dictate"),
  gateList:$("#gate-list"),
  researchResult:$("#research-result"),
  gateTitle:$("#gate-title"),
  gateCopy:$("#gate-copy"),
  qrWarning:$("#qr-warning"),
  toast:$("#toast")
};

init().catch(error=>showError(error.message));

async function init(){
  const result=await api("/api/studio/bootstrap",null,{method:"GET",requiresToken:false});
  state.token=result.token;
  state.productTypes=result.productTypes;
  state.legacyProductTypes=result.legacyProductTypes||[];
  state.aggitsOptions=result.aggitsOptions;
  state.aggitsJukeboxIcons=result.aggitsJukeboxIcons||[];
  renderTypeOptions();
  renderAggitsJukeboxIconOptions();
  renderRecent(result.projects);
  setEmptyPreview();
  configureDictation();
  bindEvents();
  updateTypePolicy();
  const requestedProject=new URLSearchParams(window.location.search).get("project");
  if(/^studio_[a-f0-9]{12}$/.test(requestedProject||""))await loadProject(requestedProject);
}

function bindEvents(){
  els.form.addEventListener("submit",runProject);
  els.savePublish.addEventListener("click",()=>els.type.value==="aggits_jukebox"?publishAggitsJukebox():saveVenueAndPublish());
  els.type.addEventListener("change",updateTypePolicy);
  els.name.addEventListener("input",updateTypePolicy);
  els.aggitsActionRows.forEach(row=>row.addEventListener("change",()=>updateAggitsActionRow(row)));
  els.aggits.addEventListener("change",renderAggitsThumbnail);
  els.refresh.addEventListener("click",refreshPreview);
  els.openPreview.addEventListener("click",()=>state.previewUrl&&window.open(state.previewUrl,"_blank","noopener,noreferrer"));
  els.downloadPoster.addEventListener("click",downloadPoster);
  els.downloadQr.addEventListener("click",downloadQr);
  els.downloadHandoff.addEventListener("click",()=>state.handoffUrl&&window.open(state.handoffUrl,"_blank","noopener,noreferrer"));
  els.applyRevision.addEventListener("click",reviseProject);
  els.revision.addEventListener("input",()=>{els.applyRevision.disabled=!state.project||!els.revision.value.trim()});
  els.removeLogo.addEventListener("click",removeLogo);
  els.removeAudio.addEventListener("click",removeAudio);
  els.removeVideo.addEventListener("click",removeVideo);
  els.recent.addEventListener("change",()=>els.recent.value&&loadProject(els.recent.value));
  $("#new-project").addEventListener("click",resetProject);
}

function renderTypeOptions(){
  els.type.replaceChildren(...state.productTypes.map(type=>option(type.id,type.label)));
  renderAggitsOptions();
}

function updateTypePolicy(){
  const type=typeConfig(els.type.value)||state.productTypes[0];
  const jookBox=type?.id==="jookbox";
  const bar=type?.id==="bar_jukebox";
  const aggitsJukebox=type?.id==="aggits_jukebox";
  const jukeboxProduct=jookBox||bar||aggitsJukebox;
  document.body.classList.toggle("jookbox-mode",jukeboxProduct);
  document.body.classList.toggle("bar-jukebox-mode",bar);
  document.body.classList.toggle("aggits-jukebox-mode",aggitsJukebox);
  els.nameLabel.textContent=aggitsJukebox?"Display title":bar?"Venue name":jookBox?"Band name":"Name";
  els.name.placeholder=aggitsJukebox?"Business, artist, venue or edition name":bar?"e.g. Shotkickers":jookBox?"Enter the exact band name":"Company, band or place";
  els.aggitsStep.hidden=jukeboxProduct;
  els.typeDescription.textContent=type?.description||"";
  els.wheelChoice.hidden=jukeboxProduct;
  if(jukeboxProduct)els.wheelChoices.forEach(field=>{field.checked=field.value==="no"});
  els.barRows.forEach(row=>{row.hidden=!bar});
  els.barTickerField.hidden=!(bar||aggitsJukebox);
  els.barTicker.required=bar||aggitsJukebox;
  els.barAboutField.hidden=!bar;
  els.barAbout.required=bar;
  els.barVideoField.hidden=!(bar||aggitsJukebox);
  els.briefField.hidden=bar||aggitsJukebox;
  els.optionalFields.hidden=bar||aggitsJukebox;
  els.aggitsJukeboxActions.hidden=!aggitsJukebox;
  els.aggitsVideoGuide.hidden=!aggitsJukebox;
  els.sourceStack.hidden=aggitsJukebox;
  els.savePublish.hidden=!(bar||aggitsJukebox);
  els.publishStatus.hidden=!(bar||aggitsJukebox);
  els.publishLabel.textContent=aggitsJukebox?"SAVE + PUBLISH JUKEBOX":"SAVE VENUE + PUBLISH";
  els.publishDetail.textContent=aggitsJukebox?"One step: permanent URL, fitted QR and delivery email":"One step: save to Venue Library, validate and publish";
  els.sourceLabels.forEach(field=>{
    field.hidden=jookBox||aggitsJukebox;
    field.required=bar;
    field.closest("label")?.classList.toggle("jookbox-source",jookBox);
  });
  els.sources.forEach((field,index)=>{
    field.required=bar;
    if(bar){
      field.placeholder=["https://venue.com/gigs","https://venue.com/menu","https://venue.com/contact","https://instagram.com/venue","https://facebook.com/venue"][index];
    }
  });
  els.contentIntro.textContent=aggitsJukebox
    ?"Configure the immutable four-button Aggits cabinet with a title, ticker, local MP4 and up to four physical actions. No web research is performed."
    :bar
    ?"Add exactly five button labels and HTTPS destinations. About Us is the permanent sixth key; the long bar is the sole Share control. Nothing is searched or inferred."
    :jookBox
    ?"Enter the band name and preferably one artist-controlled website, Linktree or social URL. Studio will find other destinations, independently verify them and omit anything below 98% confidence."
    :"Add up to three official pages. Studio treats these as research leads—not verified facts.";
  if(!bar)els.sources[0].placeholder=jookBox?"https://official-site-or-linktr.ee/band":"https://official-website.com";
  els.sourceLabels[0].placeholder=jookBox?"Optional source note":"Button label";
  els.localNote.innerHTML=aggitsJukebox
    ?'<span aria-hidden="true">●</span> The approved cabinet and icon masters are locked. Only title, ticker, MP4 and button assignments vary.'
    :bar
    ?'<span aria-hidden="true">●</span> The MP4, ticker, About Us copy and venue links remain local and private until you export the handoff.'
    :'<span aria-hidden="true">●</span> Drafts and supplied media remain in this computer’s private Studio workspace.';
  els.gateTitle.textContent=bar||aggitsJukebox?"Static content gate":"98% verification gate";
  els.outputTitle.textContent=bar?"Version & Publishing":aggitsJukebox?"Aggits Jukebox Version":"Version & QR";
  els.gateCopy.textContent=bar
    ?"Studio never overwrites a completed edition. A permanent Bar Edition still passes isolation, asset, link, deployment and live-verification checks."
    :"Studio never overwrites a completed edition. A permanent version still passes the existing factory, evidence, link and QR checks.";
  els.qrWarning.textContent=bar
    ?"This private preview has no public QR. Export the handoff; production creates the permanent live URL and scan-tested QR after deployment."
    :"This QR opens the preview on this computer. The permanent QR is created only after the verified production gate.";
  updateRunCopy();
  const forbidden=type?.aggitsPolicy==="forbidden";
  const previous=els.aggits.value;
  renderAggitsOptions();
  const available=[...els.aggits.options].map(item=>item.value);
  els.aggits.value=available.includes(previous)?previous:forbidden?"none":"aggits-original";
  els.aggits.disabled=available.length<2;
  const hgmAvailable=available.includes("hgm-owner-supplied");
  els.aggitsPolicy.textContent=forbidden
    ?"This product contract excludes Aggits. Studio has selected No Aggits automatically."
    :hgmAvailable
      ?"Choose Original Aggits or the owner-supplied HGM orange hi-vis artwork. The HGM artwork cannot be used by another project."
      :"Original Aggits is the approved immutable artwork. Edition-owned costumes appear only for their exact authorised project.";
  renderAggitsThumbnail();
  els.aggitsActionRows.forEach(updateAggitsActionRow);
}

function renderAggitsJukeboxIconOptions(){
  const defaults=["call","book_now","gigs","menu"];
  els.aggitsActionRows.forEach((row,index)=>{
    const select=row.querySelector('[data-action-field="iconId"]');
    select.replaceChildren(...state.aggitsJukeboxIcons.map(icon=>option(icon.id,icon.label)));
    if([...select.options].some(item=>item.value===defaults[index]))select.value=defaults[index];
    updateAggitsActionRow(row);
  });
}

function updateAggitsActionRow(row){
  const enabled=row.querySelector('[data-action-field="enabled"]').checked;
  const type=row.querySelector('[data-action-field="actionType"]').value;
  const value=row.querySelector('[data-action-field="value"]');
  const newTab=row.querySelector('[data-action-field="openInNewTab"]');
  row.classList.toggle("is-disabled",!enabled);
  value.placeholder=type==="tel"?"e.g. +61 3 9000 0000":type==="email"?"e.g. bookings@example.com":type==="map"?"Paste the HTTPS map or directions URL":"https://…";
  newTab.disabled=!enabled||["tel","email"].includes(type);
}

function renderAggitsOptions(){
  const type=typeConfig(els.type.value)||state.productTypes[0];
  const name=els.name.value.trim().toLowerCase();
  const options=state.aggitsOptions.filter(item=>{
    if(type?.aggitsPolicy==="forbidden")return item.id==="none";
    if(item.id==="none")return false;
    if(item.allowedProject)return["business","recruitment"].includes(type?.id)&&name===item.allowedProject.toLowerCase();
    return true;
  });
  els.aggits.replaceChildren(...options.map(item=>option(item.id,`${item.label} · ${item.costume}`)));
}

function renderAggitsThumbnail(){
  const selected=state.aggitsOptions.find(item=>item.id===els.aggits.value);
  els.aggitsThumbnail.classList.toggle("none",!selected?.assetPath);
  els.aggitsThumbnail.style.backgroundImage=selected?.assetPath?`url("${selected.assetPath}")`:"";
}

async function runProject(event){
  event.preventDefault();
  setBusy(true,"BUILDING PREVIEW");
  try{
    let result=await persistProjectFromForm();
    if(state.project.input.type==="jookbox"){
      setBusy(true,"RESEARCHING & VERIFYING");
      els.outputStatus.textContent="RESEARCHING";
      els.outputStatus.className="output-status waiting";
      els.researchResult.className="research-result running";
      els.researchResult.innerHTML="<strong>VERIFYING SOURCES</strong><span>Checking identity, direct destinations, biography and the official featured video. This can take a minute.</span>";
      result=await api(`/api/studio/projects/${state.project.id}/research`,{}, {method:"POST"});
      setProject(result);
      renderProject();
    }
    await refreshRecent();
    showToast(state.project.research?.passed
      ?`JookBox research passed at ${state.project.research.confidence}% confidence.`
      :state.project.input.type==="jookbox"
        ?"Studio stopped safely below 98%. Review the listed evidence gaps."
        :state.project.input.type==="bar_jukebox"
          ?"Bar Edition preview created. Export the handoff when ready for its permanent live URL and QR."
          :"Deep Cuts preview and local QR created.");
  }catch(error){showError(error.message)}
  finally{setBusy(false)}
}

async function persistProjectFromForm(){
  const body={input:formInput()};
  let result=state.project?await api(`/api/studio/projects/${state.project.id}`,body,{method:"PUT"}):await api("/api/studio/projects",body,{method:"POST"});
  setProject(result);
  if(els.logo.files[0]){result=await uploadLogo(els.logo.files[0]);els.logo.value="";setProject(result)}
  if(els.mp3.files[0]){result=await uploadAudio(els.mp3.files[0]);els.mp3.value="";setProject(result)}
  if(els.mp4.files[0]){result=await uploadVideo(els.mp4.files[0]);els.mp4.value="";setProject(result)}
  renderProject();return result;
}

async function saveVenueAndPublish(){
  if(els.type.value!=="bar_jukebox")return;
  setBusy(true,"SAVING VENUE");els.savePublish.disabled=true;els.publishLive.hidden=true;els.publishStatus.className="direct-publish-status";els.publishMessage.textContent="Saving this Bar Edition to Venue Library and starting protected publication…";
  try{
    await persistProjectFromForm();
    if(!state.project.readiness.handoffReady)throw new Error(state.project.readiness.blockers.join(" ")||"Complete the venue before publishing.");
    const queued=await api(`/api/studio/projects/${state.project.id}/save-publish`,{}, {method:"POST"});
    els.publishMessage.textContent="Venue saved. Protected publication is running…";
    const job=await waitForPublication(queued.job.id);
    if(job.status!=="published")throw new Error(job.error||"Publication stopped safely.");
    els.publishStatus.classList.add("is-success");els.publishMessage.textContent="Saved to Venue Library and published successfully.";els.publishLive.href=job.liveUrl;els.publishLive.hidden=false;
    showToast("Venue saved to Library and published.");await refreshRecent();
  }catch(error){els.publishStatus.classList.add("is-error");els.publishMessage.textContent=error.message;showError(error.message)}
  finally{setBusy(false);els.savePublish.disabled=false}
}

async function waitForPublication(jobId){
  for(let attempt=0;attempt<400;attempt++){
    const result=await api(`/api/studio/venue-publications/${jobId}`,null,{method:"GET"}),job=result.job;
    els.publishMessage.textContent=job.message||`Publishing: ${job.stage||"working"}`;
    if(["published","failed","interrupted"].includes(job.status))return job;
    await new Promise(resolve=>setTimeout(resolve,750));
  }
  throw new Error("Publication is still running. Open Venue Library to see its status.");
}

async function publishAggitsJukebox(){
  if(els.type.value!=="aggits_jukebox")return;
  setBusy(true,"PUBLISHING JUKEBOX");els.savePublish.disabled=true;els.publishLive.hidden=true;els.publishQr.hidden=true;els.publishStatus.className="direct-publish-status";els.publishMessage.textContent="Saving this edition and allocating its permanent identity…";
  try{
    await persistProjectFromForm();
    if(!state.project.readiness.handoffReady)throw new Error(state.project.readiness.blockers.filter(item=>!/protected publishing workflow/i.test(item)).join(" ")||"Complete the Jukebox before publishing.");
    await api(`/api/studio/projects/${state.project.id}/publish`,{}, {method:"POST"});
    let publication;
    for(let attempt=0;attempt<400;attempt++){
      publication=(await api(`/api/studio/projects/${state.project.id}/publication`,null,{method:"GET"})).publication;
      els.publishMessage.textContent=publication?.message||`Publishing: ${publication?.stage||"working"}`;
      if(["published","failed"].includes(publication?.status))break;
      await new Promise(resolve=>setTimeout(resolve,750));
    }
    if(publication?.status!=="published")throw new Error(publication?.error||"Protected publication is still running or stopped safely.");
    els.publishStatus.classList.add("is-success");els.publishMessage.textContent="Published. Permanent URL, scan-tested QR and delivery email confirmed.";
    els.publishLive.href=publication.liveUrl;els.publishLive.textContent="OPEN LIVE JUKEBOX";els.publishLive.hidden=false;
    els.publishQr.href=publication.qrImageUrl;els.publishQr.hidden=false;showToast("Jukebox published and emailed.");await refreshRecent();
  }catch(error){els.publishStatus.classList.add("is-error");els.publishMessage.textContent=error.message;showError(error.message)}
  finally{setBusy(false);els.savePublish.disabled=false}
}

async function uploadLogo(file){
  if(file.size>6*1024*1024)throw new Error("The selected logo exceeds the 6 MB Studio limit.");
  return api(`/api/studio/projects/${state.project.id}/logo`,file,{
    method:"POST",
    headers:{"content-type":file.type||"application/octet-stream","x-studio-file-name":encodeURIComponent(file.name)},
    raw:true
  });
}

async function uploadAudio(file){
  if(file.size>25*1024*1024)throw new Error("The selected MP3 exceeds the 25 MB Studio limit.");
  return api(`/api/studio/projects/${state.project.id}/audio`,file,{
    method:"POST",
    headers:{"content-type":"audio/mpeg","x-studio-file-name":encodeURIComponent(file.name)},
    raw:true
  });
}

async function uploadVideo(file){
  if(file.size>500*1024*1024)throw new Error("The selected MP4 exceeds the 500 MB Studio limit.");
  return api(`/api/studio/projects/${state.project.id}/video`,file,{
    method:"POST",
    headers:{"content-type":"video/mp4","x-studio-file-name":encodeURIComponent(file.name)},
    raw:true
  });
}

async function removeLogo(){
  if(!state.project)return;
  try{
    const result=await api(`/api/studio/projects/${state.project.id}/logo`,null,{method:"DELETE"});
    setProject(result);els.logo.value="";renderProject();showToast("Logo removed from this local Studio draft.");
  }catch(error){showError(error.message)}
}

async function removeAudio(){
  if(!state.project)return;
  try{
    const result=await api(`/api/studio/projects/${state.project.id}/audio`,null,{method:"DELETE"});
    setProject(result);els.mp3.value="";renderProject();showToast("MP3 removed from this local Studio draft.");
  }catch(error){showError(error.message)}
}

async function removeVideo(){
  if(!state.project)return;
  try{
    const result=await api(`/api/studio/projects/${state.project.id}/video`,null,{method:"DELETE"});
    setProject(result);els.mp4.value="";renderProject();showToast("Welcome video removed from this local Bar Edition draft.");
  }catch(error){showError(error.message)}
}

async function reviseProject(){
  const instruction=els.revision.value.trim();
  if(!state.project||!instruction)return;
  els.applyRevision.disabled=true;
  els.revisionMessage.className="revision-message";
  els.revisionMessage.textContent="Applying revision and re-creating the preview…";
  try{
    const result=await api(`/api/studio/projects/${state.project.id}/revise`,{instruction},{method:"POST"});
    setProject(result);
    fillForm(state.project.input);
    renderProject();
    els.revision.value="";
    if(result.revisionResult.applied){
      els.revisionMessage.classList.add("success");
      els.revisionMessage.textContent=result.revisionResult.changes.join(" ");
    }else{
      els.revisionMessage.classList.add("warn");
      els.revisionMessage.textContent="The note was saved, but no safe structured edit was recognised. Edit the fields directly, then press Run Deep Cuts.";
    }
    await refreshRecent();
    showToast("Revision saved. Preview re-created.");
  }catch(error){
    els.revisionMessage.classList.add("warn");els.revisionMessage.textContent=error.message;showError(error.message);
  }finally{els.applyRevision.disabled=!els.revision.value.trim()}
}

async function loadProject(id){
  try{
    const result=await api(`/api/studio/projects/${id}`,null,{method:"GET"});
    setProject(result);fillForm(state.project.input);renderProject();showToast(`Opened ${state.project.input.name||"Studio draft"}.`);
  }catch(error){showError(error.message)}
}

function setProject(result){
  state.project=result.project;
  state.previewUrl=result.previewUrl;
  state.handoffUrl=result.handoffUrl;
}

function renderProject(){
  if(!state.project)return;
  const bar=state.project.input.type==="bar_jukebox",aggitsJukebox=state.project.input.type==="aggits_jukebox",publicationType=bar||aggitsJukebox;
  els.projectVersion.textContent=`REV ${state.project.revision}`;
  els.projectVersion.classList.add("live");
  updateRunCopy();
  els.outputStatus.textContent="PREVIEW READY";
  els.outputStatus.className="output-status ready";
  els.emptyOutput.classList.add("hidden");
  els.readyOutput.classList.remove("hidden");
  els.qrName.textContent=state.project.input.name||"Untitled version";
  els.refresh.disabled=false;els.openPreview.disabled=false;
  els.applyRevision.disabled=!els.revision.value.trim();
  els.preview.removeAttribute("srcdoc");
  els.preview.src=`${state.previewUrl}?revision=${state.project.revision}`;
  els.qr.hidden=publicationType;
  els.downloadPoster.hidden=publicationType;
  els.downloadQr.hidden=publicationType;
  els.downloadHandoff.textContent=bar?"EXPORT FOR PUBLISHING":"EXPORT HANDOFF";
  els.qrOutputTitle.textContent=publicationType?"PERMANENT QR CREATED AFTER PUBLISHING":"1080 × 1080 QR POSTER";
  els.poster.setAttribute("aria-label",publicationType?"Protected publication status":"Deep Cuts QR poster preview");
  if(publicationType){
    els.qr.replaceChildren();
    renderPublicationPendingPoster();
    renderStoredPublication();
  }else{
    renderQr();
    renderPoster().catch(error=>showError(`Poster preview: ${error.message}`));
  }
  renderLogo();
  renderAudio();
  renderVideo();
  renderGate();
}

function refreshPreview(){
  if(!state.previewUrl)return;
  els.preview.removeAttribute("srcdoc");
  els.preview.src=`${state.previewUrl}?revision=${state.project?.revision||Date.now()}`;
}

function renderQr(){
  els.qr.replaceChildren();
  new QRCode(els.qr,{text:state.previewUrl,width:460,height:460,colorDark:"#02070d",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H});
}

function renderPublicationPendingPoster(){
  const project=state.project;
  if(!project||!["bar_jukebox","aggits_jukebox"].includes(project.input.type))return;
  const canvas=els.poster,context=canvas.getContext("2d");
  const width=canvas.width,height=canvas.height;
  const background=context.createLinearGradient(0,0,width,height);
  background.addColorStop(0,"#132f48");
  background.addColorStop(.5,"#07131f");
  background.addColorStop(1,"#25130d");
  context.fillStyle=background;
  context.fillRect(0,0,width,height);
  const glow=context.createRadialGradient(width/2,430,10,width/2,430,430);
  glow.addColorStop(0,"rgba(37,150,213,.22)");
  glow.addColorStop(1,"rgba(0,0,0,0)");
  context.fillStyle=glow;
  context.fillRect(0,0,width,height);
  context.textAlign="center";
  context.fillStyle="#ffffff";
  context.font="900 82px Arial";
  context.fillText((project.input.name||"JUKEBOX EDITION").toUpperCase(),width/2,160,920);
  context.fillStyle="#f39a61";
  context.font="900 22px Arial";
  context.fillText("D E E P   C U T S   S T U D I O",width/2,215);
  roundedRect(context,205,305,670,430,34);
  context.fillStyle="rgba(2,8,14,.8)";
  context.fill();
  context.lineWidth=5;
  context.strokeStyle="#69cfff";
  context.stroke();
  context.fillStyle="#9de7ff";
  context.font="900 86px Arial";
  context.fillText("PRIVATE",width/2,430);
  context.fillStyle="#ffffff";
  context.font="900 46px Arial";
  context.fillText("STUDIO PREVIEW",width/2,505);
  context.fillStyle="#f3a76f";
  context.font="900 34px Arial";
  context.fillText("PUBLIC QR CREATED",width/2,605);
  context.fillText("AFTER PUBLISHING",width/2,654);
  context.fillStyle="#adc4d5";
  context.font="700 25px Arial";
  context.fillText("Export for publishing to create the live URL",width/2,805);
  context.fillText("and permanent scan-tested QR code.",width/2,842);
  context.fillStyle="#ffffff";
  context.font="900 39px Arial";
  context.fillText("DEEP CUTS",width/2,970);
  context.fillStyle="#a8bdcf";
  context.font="700 23px Arial";
  context.fillText("Copyright Clearlight Creative",width/2,1012);
}

function renderStoredPublication(){
  const publication=state.project?.publication;
  if(state.project?.input?.type!=="aggits_jukebox"||publication?.status!=="published")return;
  els.publishStatus.className="direct-publish-status published";
  els.publishMessage.textContent="Published, scan-tested and delivered by email.";
  if(publication.liveUrl){
    els.publishLive.href=publication.liveUrl;
    els.publishLive.textContent="OPEN LIVE JUKEBOX";
    els.publishLive.hidden=false;
  }
  if(publication.qrImageUrl){
    els.publishQr.href=publication.qrImageUrl;
    els.publishQr.hidden=false;
  }
}

function renderLogo(){
  const logo=state.project?.logo;
  els.logoState.textContent=logo?`${logo.fileName} · ${formatBytes(logo.sizeBytes)}`:"PNG, JPEG or WebP · maximum 6 MB";
  els.removeLogo.classList.toggle("hidden",!logo);
}

function renderAudio(){
  const mp3=state.project?.mp3;
  els.audioState.textContent=mp3?`${mp3.fileName} · ${formatBytes(mp3.sizeBytes)}`:"Optional · maximum 25 MB";
  els.removeAudio.classList.toggle("hidden",!mp3);
}

function renderVideo(){
  const mp4=state.project?.mp4;
  const guide=state.project?.input.type==="aggits_jukebox"?" · target 1120 × 1280 (7:8)":"";
  els.videoState.textContent=mp4?`${mp4.fileName} · ${formatBytes(mp4.sizeBytes)}${guide}`:`Local MP4 · maximum 500 MB${guide}`;
  els.removeVideo.classList.toggle("hidden",!mp4);
}

function renderGate(){
  const readiness=state.project.readiness;
  els.gateList.replaceChildren(...readiness.blockers.map(message=>{
    const item=document.createElement("li");item.textContent=message;return item;
  }));
  const research=state.project.research;
  if(state.project.input.type==="aggits_jukebox"){
    els.researchResult.className=`research-result ${state.project.readiness.handoffReady?"passed":"waiting"}`;
    els.researchResult.innerHTML=state.project.readiness.handoffReady
      ?"<strong>AGGITS JUKEBOX READY</strong><span>The title, ticker, MP4 and enabled physical actions are complete. No web lookup was performed.</span>"
      :"<strong>ADMINISTRATOR INPUT ONLY</strong><span>Add a display title, ticker, local MP4 and complete every enabled action button.</span>";
    return;
  }
  if(state.project.input.type==="bar_jukebox"){
    els.researchResult.className=`research-result ${state.project.readiness.handoffReady?"passed":"waiting"}`;
    els.researchResult.innerHTML=state.project.readiness.handoffReady
      ?"<strong>STATIC HANDOFF READY</strong><span>Five labelled URLs, ticker copy, About Us copy and the local MP4 are present. No web lookup was performed.</span>"
      :"<strong>ADMINISTRATOR INPUT ONLY</strong><span>Complete the five labelled destinations, ticker, About Us copy and local MP4. Bar Edition never performs automatic research.</span>";
    return;
  }
  if(state.project.input.type!=="jookbox"){
    els.researchResult.className="research-result waiting";
    els.researchResult.innerHTML="<strong>FACTORY VERIFICATION REQUIRED</strong><span>Inputs remain research leads until the matching production workflow verifies them.</span>";
    return;
  }
  if(!research){
    els.researchResult.className="research-result waiting";
    els.researchResult.innerHTML="<strong>RESEARCH NOT RUN</strong><span>Press Research & Create JookBox to begin the independent checks.</span>";
    return;
  }
  els.researchResult.className=`research-result ${research.passed?"passed":"failed"}`;
  const verifiedCount=research.displaySelectionIds?.length||0;
  els.researchResult.innerHTML=`<strong>${research.confidence}% · ${research.passed?"VERIFIED":"NEEDS REVIEW"}</strong><span>${research.passed?`${verifiedCount} verified JookBox keys are ready for the factory handoff.`:"Uncertain destinations were omitted. Add a stronger official source and run again."}</span>`;
}

function fillForm(input){
  els.name.value=input.name||"";
  const selectedType=input.type||"business";
  if(![...els.type.options].some(item=>item.value===selectedType)){
    const legacy=state.legacyProductTypes.find(item=>item.id===selectedType);
    if(legacy)els.type.append(option(legacy.id,legacy.label));
  }
  els.type.value=selectedType;
  updateTypePolicy();
  els.aggits.value=input.aggitsOption||els.aggits.value;
  renderAggitsThumbnail();
  els.sources.forEach((field,index)=>field.value=input.sourceUrls[index]||"");
  els.sourceLabels.forEach((field,index)=>field.value=input.sourceLabels?.[index]||"");
  els.barTicker.value=input.tickerText||"";
  els.barAbout.value=input.aboutText||"";
  els.youtube.value=input.youtubeUrl||"";
  els.brief.value=input.brief||"";
  els.posterHeading.value=input.posterHeading||"";
  if(input.type==="aggits_jukebox"){
    els.aggitsActionRows.forEach((row,index)=>{
      const action=input.actionButtons?.[index]||{};
      for(const field of row.querySelectorAll("[data-action-field]")){
        const key=field.dataset.actionField;
        if(field.type==="checkbox")field.checked=action[key]??field.checked;
        else if(action[key]!==undefined)field.value=action[key];
      }
      updateAggitsActionRow(row);
    });
  }
  els.optionalFields.open=input.type!=="bar_jukebox"&&Boolean(input.youtubeUrl||input.posterHeading||state.project?.logo||state.project?.mp3);
  const wheelValue=input.addWheel?"yes":"no";
  els.wheelChoices.forEach(field=>{field.checked=field.value===wheelValue});
}

function formInput(){
  const sourceEntries=els.sources.map((field,index)=>({url:field.value.trim(),label:els.sourceLabels[index].value.trim()})).filter(item=>item.url);
  return{
    name:els.name.value,
    type:els.type.value,
    aggitsOption:els.aggits.value,
    sourceUrls:sourceEntries.map(item=>item.url),
    sourceLabels:sourceEntries.map(item=>item.label),
    youtubeUrl:els.youtube.value,
    tickerText:els.barTicker.value,
    aboutText:els.barAbout.value,
    brief:els.brief.value,
    posterHeading:els.posterHeading.value,
    addWheel:els.wheelChoices.find(field=>field.checked)?.value==="yes",
    actionButtons:els.aggitsActionRows.map(row=>Object.fromEntries([...row.querySelectorAll("[data-action-field]")].map(field=>[field.dataset.actionField,field.type==="checkbox"?field.checked:field.value.trim()])))
  };
}

function resetProject(){
  state.project=null;state.previewUrl="";state.handoffUrl="";
  els.form.reset();
  els.optionalFields.open=false;
  renderTypeOptions();
  els.type.value=state.productTypes[0]?.id||"jookbox";
  updateTypePolicy();
  els.projectVersion.textContent="NEW";els.projectVersion.classList.remove("live");
  updateRunCopy();
  els.outputStatus.textContent="WAITING";els.outputStatus.className="output-status waiting";
  els.emptyOutput.classList.remove("hidden");els.readyOutput.classList.add("hidden");
  els.refresh.disabled=true;els.openPreview.disabled=true;els.applyRevision.disabled=true;
  els.logoState.textContent="PNG, JPEG or WebP · maximum 6 MB";els.removeLogo.classList.add("hidden");
  els.audioState.textContent="Optional · maximum 25 MB";els.removeAudio.classList.add("hidden");
  els.videoState.textContent="Local MP4 · maximum 500 MB";els.removeVideo.classList.add("hidden");els.mp4.value="";
  els.revision.value="";els.revisionMessage.className="revision-message";
  els.publishStatus.className="direct-publish-status";els.publishMessage.textContent="Ready to save and publish.";els.publishLive.hidden=true;els.publishQr.hidden=true;
  els.revisionMessage.textContent="Typed and dictated changes are kept in the project revision history.";
  els.gateList.replaceChildren(listItem("Run a preview to see production requirements."));
  els.researchResult.className="research-result waiting";
  els.researchResult.innerHTML=els.type.value==="bar_jukebox"
    ?"<strong>ADMINISTRATOR INPUT ONLY</strong><span>Bar Edition performs no web lookup.</span>"
    :"<strong>RESEARCH NOT RUN</strong><span>Studio will show the confidence result here.</span>";
  els.recent.value="";
  setEmptyPreview();
  els.name.focus();
}

function setEmptyPreview(){
  els.preview.removeAttribute("src");
  els.preview.srcdoc=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px;background:radial-gradient(circle at 50% 15%,#123552,#061425 40%,#020812 82%);color:#8ba7bc;font-family:Arial,sans-serif;text-align:center}.mark{width:120px;height:120px;display:grid;place-items:center;margin:auto;border:1px solid #31536d;border-radius:50%;box-shadow:inset 0 0 32px #071a2d}.mark:before{content:"DC";font-size:34px;font-weight:900;font-style:italic;color:#dff5ff}.eyebrow{margin-top:25px;color:#8fddff;font-size:10px;font-weight:900;letter-spacing:.2em}h1{margin:8px 0;font-size:29px;line-height:1;text-transform:uppercase;color:#f5f9fd}p{font-size:13px;line-height:1.5}footer{position:absolute;bottom:30px;color:#53718a;font-size:10px;line-height:1.8;letter-spacing:.08em}footer strong{color:#7698b2;letter-spacing:.15em}</style></head><body><main><div class="mark"></div><div class="eyebrow">DEEP CUTS STUDIO</div><h1>Your mobile preview</h1><p>Enter the project details and press<br>Run Deep Cuts.</p></main><footer><strong>Deep Cuts</strong><br>Copyright Clearlight Creative</footer></body></html>`;
}

function configureDictation(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){
    els.dictate.disabled=true;
    els.dictate.title="Dictation is not available in this browser. You can type the revision.";
    return;
  }
  state.recognition=new Recognition();
  state.recognition.lang="en-AU";
  state.recognition.interimResults=true;
  state.recognition.continuous=false;
  let finalText="";
  state.recognition.onstart=()=>{finalText="";els.dictate.classList.add("listening");els.dictate.innerHTML='<span aria-hidden="true">●</span> LISTENING'};
  state.recognition.onresult=event=>{
    let interim="";
    for(let index=event.resultIndex;index<event.results.length;index++){
      const text=event.results[index][0].transcript;
      if(event.results[index].isFinal)finalText+=text;else interim+=text;
    }
    els.revision.value=`${finalText}${interim}`.trim();
    els.applyRevision.disabled=!state.project||!els.revision.value;
  };
  state.recognition.onerror=event=>{els.revisionMessage.className="revision-message warn";els.revisionMessage.textContent=`Dictation stopped: ${event.error}. You can type the revision instead.`};
  state.recognition.onend=()=>{els.dictate.classList.remove("listening");els.dictate.innerHTML='<span aria-hidden="true">●</span> DICTATE'};
  els.dictate.addEventListener("click",()=>state.recognition.start());
}

function downloadQr(){
  if(state.project?.input.type==="bar_jukebox")return showError("The permanent Bar Edition QR is created only after deployment.");
  const canvas=els.qr.querySelector("canvas");
  if(!canvas)return showError("The QR image is not ready yet.");
  const link=document.createElement("a");
  link.download=`${slugify(state.project?.input.name||"deep-cuts")}-studio-preview-qr.png`;
  link.href=canvas.toDataURL("image/png");
  link.click();
}

function downloadPoster(){
  if(!state.project)return;
  if(state.project.input.type==="bar_jukebox")return showError("The permanent Bar Edition QR poster is created only after deployment.");
  const link=document.createElement("a");
  link.download=`${slugify(state.project.input.name||"deep-cuts")}-studio-preview-poster.png`;
  link.href=els.poster.toDataURL("image/png");
  link.click();
}

async function renderPoster(){
  const project=state.project;
  if(!project)return;
  const canvas=els.poster,context=canvas.getContext("2d");
  const width=canvas.width,height=canvas.height;
  const background=context.createLinearGradient(0,0,width,height);
  background.addColorStop(0,"#123653");
  background.addColorStop(.52,"#061321");
  background.addColorStop(1,"#24150f");
  context.fillStyle=background;
  context.fillRect(0,0,width,height);
  const glow=context.createRadialGradient(790,400,20,790,400,520);
  glow.addColorStop(0,"rgba(23,124,188,.18)");
  glow.addColorStop(1,"rgba(0,0,0,0)");
  context.fillStyle=glow;
  context.fillRect(0,0,width,height);

  const name=project.input.name||"DEEP CUTS";
  if(project.logo){
    const logo=await loadImage(`/api/studio/projects/${project.id}/logo?revision=${project.revision}`);
    drawContained(context,logo,170,42,740,145);
  }else{
    context.fillStyle="#ffffff";
    context.font="italic 900 92px Arial";
    context.textAlign="center";
    context.fillText(name.toUpperCase(),width/2,138,880);
  }

  context.fillStyle="#ffffff";
  context.textAlign="center";
  context.font="800 48px Arial";
  const heading=(project.input.posterHeading||`SCAN TO EXPLORE ${name}`).toUpperCase();
  context.fillText(heading,width/2,235,1000);
  context.fillStyle="#f39a61";
  context.font="900 18px Arial";
  context.fillText("S T U D I O   P R E V I E W",width/2,270);

  const aggits=state.aggitsOptions.find(item=>item.id===project.input.aggitsOption);
  const hasAggits=Boolean(aggits?.assetPath);
  if(hasAggits){
    const character=await loadImage(aggits.assetPath);
    drawContained(context,character,38,316,385,570);
  }

  const qrCanvas=els.qr.querySelector("canvas");
  if(!qrCanvas)throw new Error("QR source is not ready.");
  const cardX=hasAggits?485:280,cardY=348,cardSize=520;
  roundedRect(context,cardX,cardY,cardSize,cardSize,24);
  context.fillStyle="#ffffff";
  context.fill();
  context.lineWidth=5;
  context.strokeStyle="#ef8042";
  context.stroke();
  context.imageSmoothingEnabled=false;
  context.drawImage(qrCanvas,cardX+34,cardY+34,cardSize-68,cardSize-68);
  context.imageSmoothingEnabled=true;

  context.fillStyle="#ffffff";
  context.textAlign="center";
  context.font="900 39px Arial";
  context.fillText("DEEP CUTS",width/2,970);
  context.fillStyle="#a8bdcf";
  context.font="700 23px Arial";
  context.fillText("Copyright Clearlight Creative",width/2,1012);
}

function loadImage(url){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error("An image could not be loaded."));
    image.src=url;
  });
}

function drawContained(context,image,x,y,width,height){
  const ratio=Math.min(width/image.naturalWidth,height/image.naturalHeight);
  const drawWidth=image.naturalWidth*ratio,drawHeight=image.naturalHeight*ratio;
  context.drawImage(image,x+(width-drawWidth)/2,y+(height-drawHeight)/2,drawWidth,drawHeight);
}

function roundedRect(context,x,y,width,height,radius){
  const right=x+width,bottom=y+height;
  context.beginPath();
  context.moveTo(x+radius,y);
  context.lineTo(right-radius,y);
  context.quadraticCurveTo(right,y,right,y+radius);
  context.lineTo(right,bottom-radius);
  context.quadraticCurveTo(right,bottom,right-radius,bottom);
  context.lineTo(x+radius,bottom);
  context.quadraticCurveTo(x,bottom,x,bottom-radius);
  context.lineTo(x,y+radius);
  context.quadraticCurveTo(x,y,x+radius,y);
  context.closePath();
}

async function refreshRecent(){
  const result=await api("/api/studio/projects",null,{method:"GET"});
  renderRecent(result.projects);
  els.recent.value=state.project?.id||"";
}

function renderRecent(projects){
  els.recent.replaceChildren(option("",projects.length?"Open a saved draft":"No saved drafts"),...projects.map(project=>option(project.id,`${project.name} · r${project.revision}`)));
}

async function api(url,body,{method="POST",requiresToken=true,headers={},raw=false}={}){
  const options={method,headers:{...headers}};
  if(requiresToken)options.headers["x-deep-cuts-studio-token"]=state.token;
  if(body!==null&&body!==undefined){
    if(raw)options.body=body;
    else{options.headers["content-type"]="application/json";options.body=JSON.stringify(body)}
  }
  const response=await fetch(url,options);
  const result=await response.json().catch(()=>({ok:false,error:`Studio returned ${response.status}.`}));
  if(!response.ok||result.ok===false)throw new Error(result.error||"Studio request failed.");
  return result;
}

function setBusy(busy,label=""){
  els.runButton.disabled=busy;
  if(["bar_jukebox","aggits_jukebox"].includes(els.type.value))els.savePublish.disabled=busy;
  if(busy)els.runLabel.textContent=label;
  else updateRunCopy();
}
function updateRunCopy(){
  const jookBox=els.type.value==="jookbox";
  const bar=els.type.value==="bar_jukebox";
  const aggitsJukebox=els.type.value==="aggits_jukebox";
  els.runLabel.textContent=aggitsJukebox?(state.project?"UPDATE AGGITS JUKEBOX":"CREATE AGGITS JUKEBOX"):bar?(state.project?"UPDATE BAR EDITION":"CREATE BAR EDITION"):jookBox?"RESEARCH & CREATE JOOKBOX":state.project?"UPDATE DEEP CUTS":"RUN DEEP CUTS";
  els.runDescription.textContent=aggitsJukebox?"Build the locked cabinet with the configured title, MP4, ticker and four actions":bar?"Build the local MP4 JookBox with five links, About Us and the Share bar":jookBox?"Find, cross-check and populate verified band destinations":"Create the preview and QR output";
}
function showError(message){
  els.outputStatus.textContent="CHECK INPUT";els.outputStatus.className="output-status error";showToast(message);
}
function showToast(message){
  clearTimeout(state.toastTimer);els.toast.textContent=message;els.toast.classList.add("show");
  state.toastTimer=setTimeout(()=>els.toast.classList.remove("show"),3600);
}
function option(value,label){const node=document.createElement("option");node.value=value;node.textContent=label;return node}
function typeConfig(value){return[...state.productTypes,...state.legacyProductTypes].find(item=>item.id===value)}
function listItem(text){const node=document.createElement("li");node.textContent=text;return node}
function formatBytes(value){return value<1024*1024?`${Math.round(value/1024)} KB`:`${(value/1024/1024).toFixed(1)} MB`}
function slugify(value){return String(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"deep-cuts"}
