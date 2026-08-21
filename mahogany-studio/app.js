const $ = (id) => document.getElementById(id);
const state = {
  project: null,
  projects: [],
  icons: [],
  activeSlot: 0,
  authentication: null,
  isPublishing: false,
  autosaveTimer: null,
  candidateJob: null,
  candidateTimer: null,
  skinUploadError: "",
};
const els = {
  builderView: $("builderView"),
  libraryView: $("libraryView"),
  form: $("projectForm"),
  name: $("name"),
  ticker: $("tickerText"),
  tickerCount: $("tickerCount"),
  youtube: $("youtubeUrl"),
  youtubeStatus: $("youtubeStatus"),
  youtubeProbe: $("youtubeProbe"),
  mp4: $("mp4File"),
  chooseMp4: $("chooseMp4"),
  videoFileName: $("videoFileName"),
  secretVideoFile: $("secretVideoFile"),
  chooseSecretVideo: $("chooseSecretVideo"),
  removeSecretVideo: $("removeSecretVideo"),
  secretVideoStatus: $("secretVideoStatus"),
  secretVideoMetadata: $("secretVideoMetadata"),
  secretVideoProgress: $("secretVideoProgress"),
  secretVideoPreview: $("secretVideoPreview"),
  secretVideoLoop: $("secretVideoLoop"),
  secretVideoMessage: $("secretVideoMessage"),
  chooseSkin: $("chooseSkin"),
  restoreSkin: $("restoreSkin"),
  skinFile: $("skinFile"),
  skinFileName: $("skinFileName"),
  skinStatus: $("skinStatus"),
  skinPreview: $("skinPreview"),
  actions: $("actionRows"),
  preview: $("jukeboxPreview"),
  previewStatus: $("previewStatus"),
  qr: $("qrPreview"),
  qrEmpty: $("qrEmpty"),
  validation: $("validation"),
  publish: $("publishJukebox"),
  publishProgress: $("publishProgress"),
  iconDialog: $("iconDialog"),
  iconGrid: $("iconGrid"),
  iconSearch: $("iconSearch"),
  iconCategory: $("iconCategory"),
  iconCatalogCount: $("iconCatalogCount"),
  libraryList: $("libraryList"),
  libraryEmpty: $("libraryEmpty"),
  librarySearch: $("librarySearch"),
  activation: $("activationPanel"),
  activationMessage: $("activationMessage"),
  activationCode: $("activationCode"),
  toast: $("toast"),
  addTenBands: $("addTenBands"),
  addTenBusinesses: $("addTenBusinesses"),
  candidateProgress: $("candidateProgress"),
};
async function api(url, options = {}) {
  const response = await fetch(url, {
      cache: "no-store",
      ...options,
      headers: {
        ...(options.body && typeof options.body === "string"
          ? { "content-type": "application/json" }
          : {}),
        ...(options.headers || {}),
      },
    }),
    data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false)
    throw Object.assign(
      new Error(data.error || `Request failed (${response.status}).`),
      { code: data.code },
    );
  return data;
}
async function bootstrap() {
  const data = await api("/api/mahogany/bootstrap");
  state.projects = data.projects;
  state.icons = data.icons;
  state.authentication = data.authentication;
  renderIconFilters();
  renderIcons();
  renderLibrary();
  showActivation();
  if (state.projects[0]) loadProject(state.projects[0]);
  else await createNew();
}
async function createNew() {
  const data = await api("/api/mahogany/projects", {
    method: "POST",
    body: "{}",
  });
  state.project = data.project;
  state.skinUploadError = "";
  state.projects.unshift(data.project);
  fillForm();
  renderLibrary();
}
function fillForm() {
  const p = state.project;
  els.name.value = p.name;
  els.ticker.value = p.tickerText;
  els.tickerCount.textContent = p.tickerText.length;
  els.youtube.value = p.video.kind === "youtube" ? p.video.youtubeUrl : "";
  renderYouTubeStatus(
    p.video.kind === "youtube" && p.video.embedStatus === "playable"
      ? "playable"
      : "idle",
  );
  document.querySelector(
    `input[name=videoKind][value=${p.video.kind}]`,
  ).checked = true;
  els.videoFileName.textContent =
    p.video.kind === "mp4"
      ? `${p.video.fileName} · ${(p.video.sizeBytes / 1048576).toFixed(1)} MiB`
      : "MP4/H.264 · 1890 × 1800 px · maximum 24 MiB";
  const hasSecretVideo = Boolean(p.secretVideo?.sha256);
  els.secretVideoStatus.textContent = hasSecretVideo
    ? "Active secret video"
    : "No secret video configured";
  els.secretVideoMetadata.textContent = hasSecretVideo
    ? `${p.secretVideo.fileName} · ${p.secretVideo.mimeType} · ${(p.secretVideo.sizeBytes / 1048576).toFixed(1)} MiB`
    : "MP4/H.264 · maximum 24 MiB";
  els.chooseSecretVideo.textContent = hasSecretVideo
    ? "Replace video"
    : "Select video";
  els.removeSecretVideo.hidden = !hasSecretVideo;
  els.secretVideoLoop.checked = p.secretVideo?.loop === true;
  els.secretVideoPreview.hidden = !hasSecretVideo;
  if (hasSecretVideo)
    els.secretVideoPreview.src = `/api/mahogany/projects/${p.id}/secret-video?v=${p.secretVideo.sha256.slice(0, 12)}`;
  else els.secretVideoPreview.removeAttribute("src");
  const customSkin = p.skin?.kind === "custom";
  els.skinStatus.textContent = customSkin
    ? "Custom cabinet skin"
    : "Mahogany Master";
  els.skinFileName.textContent = customSkin
    ? `${p.skin.fileName} · ${p.skin.width} × ${p.skin.height} · ${(p.skin.sizeBytes / 1048576).toFixed(1)} MiB`
    : "Default locked cabinet · all functionality preserved";
  els.restoreSkin.hidden = !customSkin;
  els.skinPreview.hidden = !customSkin;
  if (customSkin)
    els.skinPreview.src = `/api/mahogany/projects/${p.id}/skin?v=${p.skin.sha256.slice(0, 12)}`;
  else els.skinPreview.removeAttribute("src");
  renderActions();
  refreshPreview();
  renderPrepared();
  els.previewStatus.textContent = p.status;
  renderPublishState();
  renderPublicationProgress(p);
}
function formProject() {
  const kind = document.querySelector("input[name=videoKind]:checked").value;
  const youtubeUrl = els.youtube.value.trim();
  const checkedVideo = state.project.video || {};
  const keepEmbedCheck =
    kind === "youtube" && checkedVideo.youtubeUrl === youtubeUrl;
  return {
    ...state.project,
    name: els.name.value,
    tickerText: els.ticker.value,
    video: {
      ...state.project.video,
      kind,
      youtubeUrl,
      embedStatus: keepEmbedCheck ? checkedVideo.embedStatus : "",
      embedVideoId: keepEmbedCheck ? checkedVideo.embedVideoId : "",
      embedCheckedAt: keepEmbedCheck ? checkedVideo.embedCheckedAt : "",
    },
    actions: [...document.querySelectorAll(".action-row")].map(
      (row, index) => ({
        slot: index + 1,
        iconId: row.dataset.icon,
        label: row.querySelector(".action-label").value,
        href: row.querySelector(".action-url").value,
        openInNewTab: true,
      }),
    ),
  };
}
async function save({ quiet = false } = {}) {
  const data = await api(`/api/mahogany/projects/${state.project.id}`, {
    method: "PUT",
    body: JSON.stringify(formProject()),
  });
  state.project = data.project;
  replaceProject();
  if (!quiet) message("Draft saved.");
  els.validation.textContent = data.readiness.ready
    ? "All production inputs are ready."
    : data.readiness.errors.join(" ");
  els.validation.classList.toggle("is-success", data.readiness.ready);
  refreshPreview();
  return data;
}
function uploadWithProgress(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.responseType = "json";
    request.setRequestHeader("content-type", "video/mp4");
    request.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      const data = request.response || {};
      if (request.status >= 200 && request.status < 300 && data.ok !== false)
        resolve(data);
      else reject(new Error(data.error || `Upload failed (${request.status}).`));
    });
    request.addEventListener("error", () =>
      reject(new Error("The upload connection failed.")),
    );
    request.addEventListener("abort", () =>
      reject(new Error("The upload was interrupted.")),
    );
    request.send(file);
  });
}
function scheduleAutosave() {
  if (!state.project || state.isPublishing) return;
  clearTimeout(state.autosaveTimer);
  state.autosaveTimer = setTimeout(() => {
    state.autosaveTimer = null;
    save({ quiet: true }).catch(failure);
  }, 700);
}
async function flushAutosave() {
  clearTimeout(state.autosaveTimer);
  state.autosaveTimer = null;
  return save({ quiet: true });
}
function renderActions() {
  els.actions.innerHTML = state.project.actions
    .map(
      (action, index) => {
        const assetPath =
          state.icons.find((icon) => icon.id === action.iconId)?.assetPath || "";
        return `<div class="action-row" data-icon="${escapeHtml(action.iconId)}"><span class="slot-number">${index + 1}</span><button class="icon-picker" type="button" data-slot="${index}" aria-label="Choose icon for key ${index + 1}"><span class="icon-picker-art"><img src="${escapeHtml(assetPath)}" alt=""></span></button><input class="action-label" maxlength="22" value="${escapeHtml(action.label)}" placeholder="Accessible name (not displayed)"><input class="action-url" value="${escapeHtml(action.href)}" placeholder="https://your-destination.com"></div>`;
      },
    )
    .join("");
  els.actions.querySelectorAll(".icon-picker").forEach((button) =>
    button.addEventListener("click", () => {
      state.activeSlot = Number(button.dataset.slot);
      els.iconDialog.showModal();
      els.iconSearch.focus();
    }),
  );
}
function renderIconFilters() {
  const categories = [...new Set(state.icons.map((icon) => icon.category).filter(Boolean))].sort();
  els.iconCatalogCount.textContent = `${state.icons.length} approved icons`;
  els.iconCategory.innerHTML = [
    '<option value="">All categories</option>',
    ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`),
  ].join("");
}
function renderIcons(query = els.iconSearch.value) {
  const needle = query.trim().toLowerCase();
  const category = els.iconCategory.value;
  els.iconGrid.innerHTML = state.icons
    .filter((icon) => !category || icon.category === category)
    .filter((icon) => {
      const haystack = `${icon.label} ${icon.category || ""} ${icon.keywords || ""}`.toLowerCase();
      return !needle || haystack.includes(needle);
    })
    .map(
      (icon) =>
        `<button class="icon-option" type="button" data-icon="${icon.id}" aria-label="${escapeHtml(icon.label)}" title="${escapeHtml(icon.label)}"><span class="icon-option-art"><img src="${icon.assetPath}" alt=""></span></button>`,
    )
    .join("");
  els.iconGrid.querySelectorAll(".icon-option").forEach((button) =>
    button.addEventListener("click", () => {
      const row = els.actions.children[state.activeSlot],
        icon = state.icons.find((item) => item.id === button.dataset.icon);
      row.dataset.icon = icon.id;
      row.querySelector("img").src = icon.assetPath;
      if (!row.querySelector(".action-label").value)
        row.querySelector(".action-label").value = icon.label;
      els.iconDialog.close();
      scheduleAutosave();
    }),
  );
}
function refreshPreview() {
  if (!state.project) return;
  els.preview.src = `/api/mahogany/projects/${state.project.id}/preview?revision=${Date.now()}`;
}
function renderPrepared() {
  const has = Boolean(state.project.prepared || state.project.publication);
  els.qr.hidden = !has;
  els.qrEmpty.hidden = has;
  if (has)
    els.qr.src = state.project.prepared
      ? `/api/mahogany/projects/${state.project.id}/qr?revision=${Date.now()}`
      : state.project.publication.qrImageUrl;
}

let youtubeApiPromise;
function youtubeVideoId(value) {
  const text = String(value || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];
    if (!/(^|\.)youtube\.com$/.test(url.hostname)) return "";
    return url.pathname === "/watch"
      ? url.searchParams.get("v") || ""
      : (url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/) || [])[1] || "";
  } catch {
    return "";
  }
}
function renderYouTubeStatus(status, text = "") {
  els.youtubeStatus.className = `video-check-status${status === "idle" ? "" : ` is-${status}`}`;
  els.youtubeStatus.textContent =
    text ||
    ({
      idle: "Not checked",
      checking: "Checking…",
      playable: "Embedding allowed",
      blocked: "Unavailable",
    }[status] || "Not checked");
}
function loadYouTubePlayerApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            "YouTube did not respond. Check the internet connection and try again.",
          ),
        ),
      15000,
    );
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      clearTimeout(timer);
      reject(
        new Error(
          "YouTube could not be reached. Check the internet connection and try again.",
        ),
      );
    };
    document.head.append(script);
  }).catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });
  return youtubeApiPromise;
}
async function verifyYouTubeEmbed(value) {
  const videoId = youtubeVideoId(value);
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    renderYouTubeStatus("blocked", "Invalid YouTube URL");
    throw new Error("Enter a valid direct YouTube video URL.");
  }
  renderYouTubeStatus("checking", "Checking YouTube embedding…");
  try {
    const YT = await loadYouTubePlayerApi();
    return await new Promise((resolve, reject) => {
      els.youtubeProbe.replaceChildren();
      const mount = document.createElement("div");
      mount.id = `youtubeProbePlayer-${Date.now()}`;
      els.youtubeProbe.append(mount);
      let settled = false;
      let player;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        try {
          player?.destroy();
        } catch {}
        els.youtubeProbe.replaceChildren();
        if (error) reject(error);
        else resolve({ videoId });
      };
      const timeout = setTimeout(
        () =>
          finish(
            new Error(
              "YouTube could not confirm embedded playback. Try another official video.",
            ),
          ),
        16000,
      );
      player = new YT.Player(mount.id, {
        width: 320,
        height: 200,
        videoId,
        playerVars: {
          controls: 0,
          playsinline: 1,
          rel: 0,
          origin: location.origin,
          widget_referrer: location.href,
        },
        events: {
          onReady: (event) => event.target.cueVideoById(videoId),
          onStateChange: (event) => {
            if (
              [
                YT.PlayerState.CUED,
                YT.PlayerState.PLAYING,
                YT.PlayerState.PAUSED,
              ].includes(event.data)
            )
              finish();
          },
          onError: (event) => {
            const blocked = event.data === 101 || event.data === 150;
            finish(
              new Error(
                blocked
                  ? "This video’s owner blocks playback inside websites. Choose another official YouTube video."
                  : `YouTube cannot embed this video (error ${event.data}). Choose another video.`,
              ),
            );
          },
        },
      });
    });
  } catch (error) {
    renderYouTubeStatus("blocked", error.message);
    throw error;
  }
}
function renderPublishState() {
  if (!state.project || state.isPublishing) return;
  els.publish.disabled = Boolean(state.skinUploadError);
  els.publish.textContent = state.project.publication?.editionId
    ? "UPDATE, PUBLISH & EMAIL"
    : "CREATE, PUBLISH & EMAIL";
  if (state.skinUploadError) els.publish.textContent = "CUSTOM SKIN NEEDS ATTENTION";
}
function renderPublicationProgress(project = state.project) {
  const progress = project?.publicationProgress;
  els.publishProgress.hidden = !progress?.message;
  if (progress?.message) els.publishProgress.textContent = progress.message;
}
async function readPublicationProgress() {
  try {
    const data = await api(`/api/mahogany/projects/${state.project.id}`);
    if (data.project.id !== state.project.id) return;
    state.project.status = data.project.status;
    state.project.prepared = data.project.prepared;
    state.project.publicationProgress = data.project.publicationProgress;
    els.previewStatus.textContent = data.project.status;
    renderPublicationProgress(data.project);
    renderPrepared();
  } catch {}
}
async function publishProduction() {
  let progressTimer;
  try {
    if (state.skinUploadError)
      throw new Error(
        "The selected custom skin was not stored. Choose it again or restore the Mahogany Master before publishing.",
      );
    state.isPublishing = true;
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
    busy(els.publish, true, "CHECKING & SAVING...");
    const videoKind = document.querySelector(
      "input[name=videoKind]:checked",
    ).value;
    if (videoKind === "youtube") {
      busy(els.publish, true, "CHECKING VIDEO...");
      const result = await verifyYouTubeEmbed(els.youtube.value);
      state.project.video = {
        ...state.project.video,
        kind: "youtube",
        youtubeUrl: els.youtube.value.trim(),
        embedStatus: "playable",
        embedVideoId: result.videoId,
        embedCheckedAt: new Date().toISOString(),
      };
      renderYouTubeStatus("playable", "Embedding allowed");
    }
    await flushAutosave();
    busy(els.publish, true, "CREATING & PUBLISHING...");
    els.publishProgress.hidden = false;
    els.publishProgress.textContent =
      "Creating the permanent Jukebox, QR poster and delivery email...";
    const request = api(
      `/api/mahogany/projects/${state.project.id}/publish`,
      { method: "POST", body: "{}" },
    );
    progressTimer = setInterval(readPublicationProgress, 1000);
    const data = await request;
    state.project = data.project;
    replaceProject();
    fillForm();
    message(
      "Created, published, verified and emailed to andrewharris501@gmail.com.",
    );
  } catch (error) {
    failure(error);
  } finally {
    clearInterval(progressTimer);
    state.isPublishing = false;
    renderPublishState();
  }
}
function renderLibrary() {
  const needle = els.librarySearch.value.trim().toLowerCase(),
    items = state.projects.filter(
      (p) => !needle || `${p.name} ${p.status}`.toLowerCase().includes(needle),
    );
  els.libraryEmpty.hidden = items.length > 0;
  els.libraryList.innerHTML = items
    .map(
      (p) => {
        const candidate = ["verified", "manual_review"].includes(p.candidate?.status);
        const manualReview = p.candidate?.status === "manual_review";
        const platformSummary = Array.isArray(p.candidate?.platformOrder)
          ? p.candidate.platformOrder.map(platformLabel).join(" → ")
          : "Bandcamp → Instagram → Facebook → Spotify";
        const missing = (p.candidate?.missingPlatforms || []).map(platformLabel).join(", ");
        return `<article class="library-item" data-id="${p.id}"><div><h3>${escapeHtml(p.name || "Untitled Jukebox")}</h3><p>${candidate ? `<span class="candidate-badge">${manualReview ? "Manual review required" : "Fully verified band candidate"}</span> · ` : ""}${escapeHtml(p.status)} · ${new Date(p.updatedAt).toLocaleString()}</p>${candidate ? `<small>${manualReview ? "Intake confidence" : "Verified confidence"}: ${escapeHtml(p.candidate.confidence)}% · ${escapeHtml(platformSummary)}${missing ? ` · Complete: ${escapeHtml(missing)}` : ""}</small>` : ""}</div><label class="toggle"><input type="checkbox" ${p.status === "published" ? "checked" : ""} ${p.publication?.editionId ? "" : "disabled"}>Published</label><a class="library-url" href="${escapeHtml(p.publication?.liveUrl || "")}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.publication?.liveUrl || (candidate ? "Unpublished candidate · review before publishing" : "Permanent URL created when published"))}</a><div class="library-actions"><button class="quiet-button edit" type="button">Edit</button>${p.publication?.qrImageUrl ? `<a class="quiet-button" href="${escapeHtml(p.publication.qrImageUrl)}" target="_blank" rel="noopener noreferrer">QR</a>` : ""}</div></article>`;
      },
    )
    .join("");
  els.libraryList.querySelectorAll(".library-item").forEach((item) => {
    const p = state.projects.find((x) => x.id === item.dataset.id);
    item.querySelector(".edit").addEventListener("click", () => {
      loadProject(p);
      showView("builder");
    });
    const toggle = item.querySelector("input[type=checkbox]");
    toggle.addEventListener("change", async () => {
      toggle.disabled = true;
      try {
        const data = await api(`/api/mahogany/projects/${p.id}/state`, {
          method: "PUT",
          body: JSON.stringify({ published: toggle.checked }),
        });
        Object.assign(p, data.project);
        message(
          toggle.checked
            ? "Published with the same permanent URL and QR."
            : "Unpublished. Permanent URL and QR preserved.",
        );
      } catch (error) {
        toggle.checked = !toggle.checked;
        failure(error);
      } finally {
        toggle.disabled = false;
        renderLibrary();
      }
    });
  });
}
function platformLabel(value) {
  return value === "bandcamp"
    ? "Bandcamp"
    : value === "youtube"
      ? "YouTube"
      : String(value || "").replace(/^./, (letter) => letter.toUpperCase());
}
function renderCandidateProgress(job) {
  state.candidateJob = job;
  els.candidateProgress.hidden = !job;
  if (!job) return;
  const reasons = (job.rejectionReasons || job.result?.rejectionReasons || [])
    .slice(0, 5)
    .map((item) => `${escapeHtml(item.reason)}: ${Number(item.count) || 0}`)
    .join(" · ");
  els.candidateProgress.innerHTML = `<strong>${escapeHtml(job.message || "Researching bands…")}</strong><br>Reviewed ${Number(job.reviewed) || 0} · Qualified ${Number(job.qualified) || 0} · Rejected ${Number(job.rejected) || 0}${reasons ? `<br><small>Most common exclusions: ${reasons}</small>` : ""}`;
  els.addTenBands.disabled = job.status === "running";
  els.addTenBands.querySelector("strong").textContent =
    job.status === "running" ? "RESEARCHING BANDS…" : "ADD 10 BANDS";
}
async function refreshLibraryProjects() {
  const data = await api("/api/mahogany/bootstrap");
  state.projects = data.projects;
  state.authentication = data.authentication;
  renderLibrary();
  showActivation();
}
async function pollCandidateJob() {
  if (!state.candidateJob?.id) return;
  try {
    const data = await api(
      `/api/mahogany/candidate-batches/${state.candidateJob.id}`,
    );
    renderCandidateProgress(data.job);
    if (data.job.status === "running") return;
    clearInterval(state.candidateTimer);
    state.candidateTimer = null;
    await refreshLibraryProjects();
    showView("library");
    if (data.job.status === "completed") {
      const count = data.job.result?.qualified || 0;
      message(
        `${count} direct Bandcamp lead${count === 1 ? "" : "s"} ${count === 1 ? "was" : "were"} added as ${count === 1 ? "an unpublished manual-review draft" : "unpublished manual-review drafts"}. Complete or correct any blank fields before publishing.`,
      );
    } else failure(new Error(data.job.error || "Band discovery failed."));
  } catch (error) {
    clearInterval(state.candidateTimer);
    state.candidateTimer = null;
    renderCandidateProgress({
      ...state.candidateJob,
      status: "failed",
      message: error.message,
    });
    failure(error);
  }
}
async function addTenBands() {
  try {
    renderCandidateProgress({
      status: "running",
      message: "Starting the fail-closed 10-band research batch…",
      reviewed: 0,
      qualified: 0,
      rejected: 0,
    });
    const data = await api("/api/mahogany/candidate-batches/bands", {
      method: "POST",
      body: "{}",
    });
    renderCandidateProgress(data.job);
    clearInterval(state.candidateTimer);
    state.candidateTimer = setInterval(pollCandidateJob, 1200);
    await pollCandidateJob();
  } catch (error) {
    renderCandidateProgress(null);
    failure(error);
  }
}
function loadProject(project) {
  state.project = structuredClone(project);
  state.skinUploadError = "";
  fillForm();
}
function replaceProject() {
  const index = state.projects.findIndex((p) => p.id === state.project.id);
  if (index >= 0) state.projects[index] = structuredClone(state.project);
  else state.projects.unshift(structuredClone(state.project));
  renderLibrary();
}
function showView(name) {
  els.builderView.hidden = name !== "builder";
  els.libraryView.hidden = name !== "library";
  document
    .querySelectorAll(".nav-button")
    .forEach((button) =>
      button.classList.toggle("is-active", button.dataset.view === name),
    );
}
function showActivation() {
  els.activation.hidden = state.authentication?.available === true;
  els.activationMessage.textContent =
    state.authentication?.reason || "Activate secure publishing once.";
}
function message(text) {
  els.toast.textContent = text;
  els.toast.hidden = false;
  clearTimeout(message.timer);
  message.timer = setTimeout(() => (els.toast.hidden = true), 5000);
}
function failure(error) {
  els.validation.textContent = error.message;
  els.validation.classList.remove("is-success");
  message(error.message);
}
function busy(button, on, label) {
  button.disabled = on;
  button.textContent = label;
}
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  publishProduction();
});
els.form.addEventListener("input", scheduleAutosave);
els.form.addEventListener("change", scheduleAutosave);
els.chooseMp4.addEventListener("click", () => els.mp4.click());
els.chooseSkin.addEventListener("click", () => els.skinFile.click());
els.skinFile.addEventListener("change", async () => {
  const file = els.skinFile.files[0];
  if (!file) return;
  state.skinUploadError = "The selected custom skin has not been stored.";
  renderPublishState();
  try {
    const bytes = await file.arrayBuffer(),
      data = await api(`/api/mahogany/projects/${state.project.id}/skin`, {
        method: "PUT",
        body: bytes,
        headers: {
          "content-type": file.type || "application/octet-stream",
          "x-file-name": encodeURIComponent(file.name),
        },
      });
    state.project = data.project;
    state.skinUploadError = "";
    replaceProject();
    fillForm();
    message(
      `Custom cabinet skin validated at ${state.project.skin.width} × ${state.project.skin.height}. Mahogany geometry and functionality are unchanged.`,
    );
  } catch (error) {
    // A large image can finish writing even if the desktop webview loses the
    // final JSON response. Re-read the project before presenting a blocking
    // error so a successfully stored, validated skin never becomes stranded.
    try {
      const recovered = await api(
        `/api/mahogany/projects/${state.project.id}`,
      );
      if (
        recovered.project?.skin?.kind === "custom" &&
        recovered.project.skin.fileName === file.name &&
        recovered.project.skin.sizeBytes === file.size
      ) {
        state.project = recovered.project;
        state.skinUploadError = "";
        replaceProject();
        fillForm();
        message(
          `Custom cabinet skin validated at ${state.project.skin.width} × ${state.project.skin.height}.`,
        );
        return;
      }
    } catch {}
    state.skinUploadError = error.message;
    renderPublishState();
    failure(error);
  } finally {
    els.skinFile.value = "";
  }
});
els.restoreSkin.addEventListener("click", async () => {
  try {
    const data = await api(`/api/mahogany/projects/${state.project.id}/skin`, {
      method: "DELETE",
    });
    state.project = data.project;
    state.skinUploadError = "";
    replaceProject();
    fillForm();
    message("Mahogany Master cabinet restored.");
  } catch (error) {
    failure(error);
  }
});
els.chooseSecretVideo.addEventListener("click", () =>
  els.secretVideoFile.click(),
);
els.secretVideoFile.addEventListener("change", async () => {
  const file = els.secretVideoFile.files[0];
  if (!file) return;
  const isMp4 = file.type === "video/mp4" || /\.mp4$/i.test(file.name);
  if (!isMp4 || file.size < 64 || file.size > 24 * 1024 * 1024) {
    failure(
      new Error("Choose a valid, non-empty MP4/H.264 file no larger than 24 MiB."),
    );
    els.secretVideoFile.value = "";
    return;
  }
  els.secretVideoProgress.hidden = false;
  els.secretVideoProgress.value = 0;
  els.secretVideoMessage.textContent = "Uploading secret video…";
  els.chooseSecretVideo.disabled = true;
  try {
    const data = await uploadWithProgress(
      `/api/mahogany/projects/${state.project.id}/secret-video`,
      file,
      (progress) => {
        els.secretVideoProgress.value = progress;
        els.secretVideoMessage.textContent = `Uploading secret video… ${progress}%`;
      },
    );
    state.project = data.project;
    replaceProject();
    fillForm();
    els.secretVideoMessage.textContent = "Secret video uploaded and active.";
    message("Secret video uploaded and active.");
  } catch (error) {
    els.secretVideoMessage.textContent = error.message;
    failure(error);
  } finally {
    els.chooseSecretVideo.disabled = false;
    els.secretVideoProgress.hidden = true;
    els.secretVideoFile.value = "";
  }
});
els.removeSecretVideo.addEventListener("click", async () => {
  if (!confirm("Remove the active secret video from this Jukebox?")) return;
  try {
    const data = await api(
      `/api/mahogany/projects/${state.project.id}/secret-video`,
      { method: "DELETE" },
    );
    state.project = data.project;
    replaceProject();
    fillForm();
    els.secretVideoMessage.textContent = "Secret video removed.";
    message("Secret video removed.");
  } catch (error) {
    failure(error);
  }
});
els.secretVideoLoop.addEventListener("change", () => {
  state.project.secretVideo = {
    ...state.project.secretVideo,
    loop: els.secretVideoLoop.checked,
  };
  scheduleAutosave();
});
els.mp4.addEventListener("change", async () => {
  const file = els.mp4.files[0];
  if (!file) return;
  try {
    const bytes = await file.arrayBuffer(),
      data = await api(`/api/mahogany/projects/${state.project.id}/video`, {
        method: "PUT",
        body: bytes,
        headers: {
          "content-type": "video/mp4",
          "x-file-name": encodeURIComponent(file.name),
        },
      });
    state.project = data.project;
    document.querySelector("input[name=videoKind][value=mp4]").checked = true;
    replaceProject();
    fillForm();
    message("MP4 stored in this Mahogany Jukebox project.");
  } catch (error) {
    failure(error);
  }
});
els.ticker.addEventListener(
  "input",
  () => (els.tickerCount.textContent = els.ticker.value.length),
);
els.youtube.addEventListener("input", () => {
  state.project.video.embedStatus = "";
  state.project.video.embedVideoId = "";
  state.project.video.embedCheckedAt = "";
  renderYouTubeStatus("idle");
});
document.querySelectorAll('input[name="videoKind"]').forEach((radio) =>
  radio.addEventListener("change", () => {
    if (radio.checked && radio.value === "youtube")
      renderYouTubeStatus(
        state.project.video.embedStatus === "playable" ? "playable" : "idle",
      );
  }),
);
els.iconSearch.addEventListener("input", () =>
  renderIcons(els.iconSearch.value),
);
els.iconCategory.addEventListener("change", () => renderIcons());
els.librarySearch.addEventListener("input", renderLibrary);
document
  .querySelectorAll(".nav-button")
  .forEach((button) =>
    button.addEventListener("click", () => showView(button.dataset.view)),
  );
$("newProject").addEventListener("click", () =>
  createNew()
    .then(() => showView("builder"))
    .catch(failure),
);
$("libraryNew").addEventListener("click", () =>
  createNew()
    .then(() => showView("builder"))
    .catch(failure),
);
$("startActivation").addEventListener("click", async () => {
  try {
    const data = await api("/api/mahogany/activation/start", {
      method: "POST",
      body: "{}",
    });
    els.activationMessage.textContent = `Code emailed to ${data.recipientHint || "the owner"}.`;
  } catch (error) {
    failure(error);
  }
});
$("completeActivation").addEventListener("click", async () => {
  try {
    const data = await api("/api/mahogany/activation/complete", {
      method: "POST",
      body: JSON.stringify({ code: els.activationCode.value }),
    });
    state.authentication = data.authentication;
    showActivation();
    message("Secure publishing activated.");
  } catch (error) {
    failure(error);
  }
});
els.addTenBands.addEventListener("click", addTenBands);
els.addTenBusinesses.addEventListener("click", () =>
  message(
    "The business intake control is reserved for the next staged model. The verified band pilot is active now.",
  ),
);
bootstrap().catch(failure);
