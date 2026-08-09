const state = { types: [], projects: [], project: null, selectedType: "wedding", autosave: 0, dirty: false, authentication: null, libraryFilter: "all", youtubeApi: null };
const $ = (id) => document.getElementById(id);
const els = Object.fromEntries(["createView","libraryView","typePicker","newInvitation","invitationForm","title","hostNames","tickerText","eventDate","eventTime","venue","address","message","youtubeUrl","youtubeField","youtubeStatus","youtubeProbe","mp4Field","mp4File","mp4Status","actionFields","save","saveState","publish","publishProgress","publicationResult","liveLink","qrImage","emailLink","preview","editorContext","librarySearch","libraryFilters","libraryGroups","authStatus","activationDialog","startActivation","activationCode","completeActivation","activationMessage","toast"].map((id) => [id, $(id)]));

async function api(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options, headers: { ...(options.body && typeof options.body === "string" ? { "content-type": "application/json" } : {}), ...(options.headers || {}) } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) throw Object.assign(new Error(result.error || `Request failed (${response.status}).`), { code: result.code });
  return result;
}

async function boot() {
  const data = await api("/api/invitations/bootstrap");
  state.types = data.types; state.projects = data.projects; state.authentication = data.authentication;
  renderTypes(); renderAuth(); renderLibraryFilters();
  if (state.projects.length) selectProject(state.projects[0]); else await createProject("wedding");
  renderLibrary();
}

function renderTypes() {
  const counts = Object.fromEntries(state.types.map((type) => [type.id, state.projects.filter((project) => project.invitationType === type.id).length]));
  els.typePicker.innerHTML = state.types.map((type) => `<button type="button" class="type-card ${type.id === state.selectedType ? "active" : ""}" data-type="${type.id}"><img src="/assets/invitation-jukebox/${type.cabinetAsset}" alt=""><span><strong>${escapeHtml(type.label)}</strong><small>${escapeHtml(type.description)}</small></span><b class="count">${counts[type.id]}</b></button>`).join("");
}

async function createProject(type = state.selectedType) {
  await flushAutosave();
  const data = await api("/api/invitations/projects", { method: "POST", body: JSON.stringify({ invitationType: type }) });
  state.projects.unshift(data.project); selectProject(data.project); renderLibrary(); toast(`${typeLabel(type)} invitation created.`);
}

function selectProject(project) {
  state.project = structuredClone(project); state.selectedType = project.invitationType; state.dirty = false;
  fillForm(); renderTypes(); renderPublication(); refreshPreview();
  els.editorContext.textContent = `${typeLabel(project.invitationType)} library · ${project.status}`;
}

function fillForm() {
  const p = state.project; if (!p) return;
  els.title.value = p.title || ""; els.hostNames.value = p.hostNames || ""; els.tickerText.value = p.tickerText || "";
  els.eventDate.value = p.event?.date || ""; els.eventTime.value = p.event?.time || ""; els.venue.value = p.event?.venue || ""; els.address.value = p.event?.address || ""; els.message.value = p.message || "";
  document.querySelector(`input[name=videoKind][value=${p.video.kind}]`).checked = true; els.youtubeUrl.value = p.video.youtubeUrl || "";
  els.mp4Status.textContent = p.video.fileName ? `${p.video.fileName} · ${(p.video.sizeBytes / 1024 / 1024).toFixed(1)} MiB` : "No MP4 selected.";
  renderVideoKind();
  els.actionFields.innerHTML = p.actions.map((item, index) => `<div class="action-row" data-index="${index}"><strong>Key ${index + 1} · ${escapeHtml(item.iconId.replaceAll("_", " "))}</strong><input class="action-label" maxlength="22" value="${escapeHtml(item.label)}" aria-label="Key ${index + 1} label"><input class="action-href href" maxlength="500" value="${escapeHtml(item.href)}" placeholder="https://… or mailto:…" aria-label="Key ${index + 1} destination"></div>`).join("");
  els.saveState.textContent = "Saved";
}

function readForm() {
  const p = state.project, checkedKind = document.querySelector("input[name=videoKind]:checked").value;
  const oldUrl = p.video.youtubeUrl;
  p.title = els.title.value; p.hostNames = els.hostNames.value; p.tickerText = els.tickerText.value;
  p.event = { ...p.event, date: els.eventDate.value, time: els.eventTime.value, venue: els.venue.value, address: els.address.value };
  p.message = els.message.value; p.video.kind = checkedKind; p.video.youtubeUrl = els.youtubeUrl.value.trim();
  if (oldUrl !== p.video.youtubeUrl) { p.video.embedStatus = ""; p.video.embedVideoId = ""; p.video.embedCheckedAt = ""; }
  [...els.actionFields.querySelectorAll(".action-row")].forEach((row, index) => { p.actions[index].label = row.querySelector(".action-label").value; p.actions[index].href = row.querySelector(".action-href").value.trim(); });
  return p;
}

function scheduleSave() { if (!state.project) return; state.dirty = true; els.saveState.textContent = "Unsaved"; clearTimeout(state.autosave); state.autosave = setTimeout(() => saveProject().catch(showError), 700); refreshPreviewDebounced(); }
async function saveProject() {
  clearTimeout(state.autosave); state.autosave = 0; if (!state.project || !state.dirty) return state.project;
  readForm(); els.saveState.textContent = "Saving…";
  const data = await api(`/api/invitations/projects/${state.project.id}`, { method: "PUT", body: JSON.stringify(state.project) });
  state.project = data.project; state.dirty = false; els.saveState.textContent = "Saved"; replaceProject(); renderTypes(); renderLibrary(); refreshPreview(); return state.project;
}
async function flushAutosave() { if (state.autosave) { clearTimeout(state.autosave); state.autosave = 0; } if (state.dirty) await saveProject(); }
function replaceProject() { const index = state.projects.findIndex((item) => item.id === state.project.id); if (index >= 0) state.projects[index] = structuredClone(state.project); else state.projects.unshift(structuredClone(state.project)); }

let previewTimer;
function refreshPreviewDebounced() { clearTimeout(previewTimer); previewTimer = setTimeout(async () => { try { await saveProject(); } catch {} }, 900); }
function refreshPreview() { if (state.project) els.preview.src = `/api/invitations/projects/${state.project.id}/preview?revision=${Date.now()}`; }

function renderVideoKind() { const kind = document.querySelector("input[name=videoKind]:checked").value; els.youtubeField.hidden = kind !== "youtube"; els.mp4Field.hidden = kind !== "mp4"; }
async function uploadMp4(file) {
  if (!file) return; if (file.size > 24 * 1024 * 1024) throw new Error("The public MP4 must be 24 MiB or smaller.");
  els.mp4Status.textContent = "Uploading…";
  const response = await fetch(`/api/invitations/projects/${state.project.id}/video`, { method: "PUT", headers: { "content-type": "video/mp4", "x-file-name": encodeURIComponent(file.name) }, body: file });
  const result = await response.json(); if (!response.ok || result.ok === false) throw new Error(result.error || "MP4 upload failed.");
  state.project = result.project; replaceProject(); fillForm(); refreshPreview(); renderLibrary(); toast("MP4 stored with this invitation.");
}

async function loadYouTubeApi() {
  if (window.YT?.Player) return window.YT;
  if (state.youtubeApi) return state.youtubeApi;
  state.youtubeApi = new Promise((resolve, reject) => { const previous = window.onYouTubeIframeAPIReady, script = document.createElement("script"), timer = setTimeout(() => reject(new Error("YouTube could not be reached.")), 16000); window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); previous?.(); resolve(window.YT); }; script.src = "https://www.youtube.com/iframe_api"; script.onerror = () => { clearTimeout(timer); reject(new Error("YouTube could not be reached.")); }; document.head.append(script); });
  return state.youtubeApi;
}
async function verifyYouTubeEmbed(value) {
  const id = youtubeVideoId(value); if (!id) throw new Error("Enter a valid YouTube video URL.");
  els.youtubeStatus.textContent = "Checking embedded playback…"; const YT = await loadYouTubeApi();
  return new Promise((resolve, reject) => { els.youtubeProbe.replaceChildren(); const mount = document.createElement("div"); mount.id = `yt-${Date.now()}`; els.youtubeProbe.append(mount); let done = false, player; const finish = (error) => { if (done) return; done = true; clearTimeout(timer); try { player?.destroy(); } catch {} els.youtubeProbe.replaceChildren(); error ? reject(error) : resolve(id); }; const timer = setTimeout(() => finish(new Error("YouTube could not confirm embedded playback.")), 16000); player = new YT.Player(mount.id, { videoId: id, playerVars: { controls: 0, playsinline: 1, origin: location.origin }, events: { onReady: (event) => event.target.cueVideoById(id), onStateChange: (event) => { if ([YT.PlayerState.CUED, YT.PlayerState.PLAYING, YT.PlayerState.PAUSED].includes(event.data)) finish(); }, onError: () => finish(new Error("This YouTube video cannot be embedded. Choose another video.")) } }); });
}

async function publish() {
  let poll;
  try {
    if (!state.authentication?.available) { els.activationDialog.showModal(); return; }
    setBusy(true); readForm();
    if (state.project.video.kind === "youtube") { const id = await verifyYouTubeEmbed(els.youtubeUrl.value); state.project.video = { ...state.project.video, youtubeUrl: els.youtubeUrl.value.trim(), embedStatus: "playable", embedVideoId: id, embedCheckedAt: new Date().toISOString() }; els.youtubeStatus.textContent = "Embedding allowed."; state.dirty = true; }
    await saveProject(); els.publishProgress.hidden = false; els.publishProgress.textContent = "Creating the permanent invitation, QR image and delivery email…";
    poll = setInterval(readProgress, 1000);
    const data = await api(`/api/invitations/projects/${state.project.id}/publish`, { method: "POST", body: "{}" });
    state.project = data.project; replaceProject(); renderPublication(); renderLibrary(); refreshPreview(); toast("Invitation published and emailed.");
  } catch (error) { showError(error); } finally { clearInterval(poll); setBusy(false); }
}
async function readProgress() { try { const data = await api(`/api/invitations/projects/${state.project.id}`); if (data.project.id !== state.project.id) return; state.project.publicationProgress = data.project.publicationProgress; state.project.status = data.project.status; renderPublication(); } catch {} }
function renderPublication() {
  const p = state.project, progress = p?.publicationProgress;
  els.publishProgress.hidden = !progress?.message; if (progress?.message) els.publishProgress.textContent = progress.message;
  const live = p?.publication?.liveUrl; els.publicationResult.hidden = !live;
  if (live) { els.liveLink.href = live; els.liveLink.textContent = live; els.qrImage.src = `/api/invitations/projects/${p.id}/qr?revision=${Date.now()}`; }
  els.publish.textContent = p?.publication?.editionId ? "Update, publish & email" : "Create, publish & email";
}
function setBusy(value) { els.publish.disabled = value; els.save.disabled = value; }

function renderAuth() {
  const auth = state.authentication;
  els.authStatus.textContent = auth?.available ? "Protected publishing active" : "Publishing activation required";
  els.authStatus.style.color = auth?.available ? "var(--green)" : "var(--gold)";
  if (!auth?.available) els.authStatus.onclick = () => els.activationDialog.showModal(); else els.authStatus.onclick = null;
}
async function startActivation() { try { const data = await api("/api/invitations/activation/start", { method: "POST", body: "{}" }); els.activationMessage.textContent = data.message || "Activation code requested."; } catch (error) { els.activationMessage.textContent = error.message; } }
async function completeActivation() { try { const data = await api("/api/invitations/activation/complete", { method: "POST", body: JSON.stringify({ code: els.activationCode.value.trim() }) }); state.authentication = data.authentication; renderAuth(); els.activationDialog.close(); toast("Protected publishing activated."); } catch (error) { els.activationMessage.textContent = error.message; } }

function renderLibraryFilters() { els.libraryFilters.innerHTML = `<button class="library-filter active" data-filter="all">All</button>${state.types.map((type) => `<button class="library-filter" data-filter="${type.id}">${escapeHtml(type.label)}</button>`).join("")}`; }
function renderLibrary() {
  renderTypes(); const search = (els.librarySearch.value || "").trim().toLowerCase();
  const typeIds = state.libraryFilter === "all" ? state.types.map((type) => type.id) : [state.libraryFilter];
  els.libraryGroups.innerHTML = typeIds.map((typeId) => { const type = state.types.find((item) => item.id === typeId), projects = state.projects.filter((project) => project.invitationType === typeId && (!search || `${project.title} ${project.hostNames} ${project.event?.venue}`.toLowerCase().includes(search))); if (!projects.length && search) return ""; return `<section class="library-group"><h3>${escapeHtml(type.label)} <small>${projects.length}</small></h3><div class="library-grid">${projects.length ? projects.map((project) => `<article class="project-card" data-project="${project.id}"><img src="/assets/invitation-jukebox/${type.cabinetAsset}" alt=""><div><h4>${escapeHtml(project.title || "Untitled invitation")}</h4><p>${escapeHtml(project.hostNames || "Names not added")}</p><p>${escapeHtml(project.event?.date || "Date not set")} · ${escapeHtml(project.event?.venue || "Venue not set")}</p><span class="status">${escapeHtml(project.status)}</span></div></article>`).join("") : `<p class="field-note">No ${escapeHtml(type.label.toLowerCase())} invitations yet.</p>`}</div></section>`; }).join("");
}
function switchView(name) { document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.view === name)); els.createView.hidden = name !== "create"; els.libraryView.hidden = name !== "library"; if (name === "library") renderLibrary(); }
function emailCurrent() { const live = state.project?.publication?.liveUrl; if (!live) return; const subject = encodeURIComponent(`You're invited: ${state.project.title}`), body = encodeURIComponent(`You're invited to ${state.project.title}.\n\nOpen the invitation: ${live}`); location.href = `mailto:?subject=${subject}&body=${body}`; }
function typeLabel(id) { return state.types.find((type) => type.id === id)?.label || id; }
function youtubeVideoId(value) { const text = String(value || "").trim(); if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text; try { const url = new URL(text), id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.pathname === "/watch" ? url.searchParams.get("v") : (url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/) || [])[1]; return /^[A-Za-z0-9_-]{11}$/.test(String(id || "")) ? String(id) : ""; } catch { return ""; } }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
let toastTimer; function toast(message) { clearTimeout(toastTimer); els.toast.textContent = message; els.toast.classList.add("show"); toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2800); }
function showError(error) { console.error(error); toast(error.message || "Something went wrong."); }

document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
els.typePicker.addEventListener("click", (event) => { const button = event.target.closest("[data-type]"); if (button && button.dataset.type !== state.project?.invitationType) createProject(button.dataset.type).catch(showError); });
els.newInvitation.addEventListener("click", () => createProject().catch(showError));
els.invitationForm.addEventListener("input", scheduleSave);
document.querySelectorAll("input[name=videoKind]").forEach((input) => input.addEventListener("change", () => { renderVideoKind(); scheduleSave(); }));
els.mp4File.addEventListener("change", () => uploadMp4(els.mp4File.files[0]).catch(showError));
els.save.addEventListener("click", () => saveProject().then(() => toast("Draft saved.")).catch(showError));
els.publish.addEventListener("click", publish); els.emailLink.addEventListener("click", emailCurrent);
els.librarySearch.addEventListener("input", renderLibrary);
els.libraryFilters.addEventListener("click", (event) => { const button = event.target.closest("[data-filter]"); if (!button) return; state.libraryFilter = button.dataset.filter; els.libraryFilters.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button)); renderLibrary(); });
els.libraryGroups.addEventListener("click", (event) => { const card = event.target.closest("[data-project]"); if (!card) return; const project = state.projects.find((item) => item.id === card.dataset.project); if (project) { selectProject(project); switchView("create"); } });
els.startActivation.addEventListener("click", startActivation); els.completeActivation.addEventListener("click", completeActivation);
boot().catch(showError);
