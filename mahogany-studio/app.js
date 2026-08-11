import {
  analysePresenterAudio,
  normalizeDuckingSettings,
} from "/mahogany-studio/audio-ducking.js";

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
  discoveryJob: null,
  discoveryTimer: null,
};
const els = {
  builderView: $("builderView"),
  legacyCandidateLaunch: $("legacyCandidateLaunch"),
  discoveryView: $("discoveryView"),
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
  masterMedia: $("masterMedia"),
  vuMedia: $("vuMedia"),
  music: $("musicFile"),
  chooseMusic: $("chooseMusic"),
  musicFileName: $("musicFileName"),
  musicTrackName: $("musicTrackName"),
  character: $("characterFile"),
  chooseCharacter: $("chooseCharacter"),
  characterFileName: $("characterFileName"),
  removeMusic: $("removeMusic"),
  removeCharacter: $("removeCharacter"),
  retryAnalysis: $("retryAnalysis"),
  speechAnalysisStatus: $("speechAnalysisStatus"),
  duckingEnabled: $("duckingEnabled"),
  speakingLevel: $("speakingLevel"),
  speakingLevelValue: $("speakingLevelValue"),
  attackMs: $("attackMs"),
  attackMsValue: $("attackMsValue"),
  releaseMs: $("releaseMs"),
  releaseMsValue: $("releaseMsValue"),
  speechSensitivity: $("speechSensitivity"),
  speechSensitivityValue: $("speechSensitivityValue"),
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
  libraryList: $("libraryList"),
  libraryEmpty: $("libraryEmpty"),
  librarySearch: $("librarySearch"),
  activation: $("activationPanel"),
  activationMessage: $("activationMessage"),
  activationCode: $("activationCode"),
  toast: $("toast"),
  addTwentyBands: $("addTwentyBands"),
  candidateProgress: $("candidateProgress"),
  discoveryLocation: $("discoveryLocation"),
  findBands: $("findBands"),
  cancelBandDiscovery: $("cancelBandDiscovery"),
  bandDiscoveryProgress: $("bandDiscoveryProgress"),
  bandDiscoveryResults: $("bandDiscoveryResults"),
  bandDiscoveryCount: $("bandDiscoveryCount"),
  bandDiscoveryRows: $("bandDiscoveryRows"),
  addSelectedBands: $("addSelectedBands"),
  addGoodBands: $("addGoodBands"),
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
  state.projects.unshift(data.project);
  fillForm();
  renderLibrary();
}
function fillForm() {
  const p = state.project;
  els.name.value = p.name;
  els.ticker.value = p.tickerText;
  els.tickerCount.textContent = p.tickerText.length;
  const appearance = p.appearance || "mahogany-master";
  document.querySelector(
    `input[name=appearance][value=${appearance}]`,
  ).checked = true;
  renderAppearance();
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
      : "MP4/H.264 · 1804 × 1436 px · maximum 24 MiB";
  els.musicFileName.textContent = p.vu?.music?.fileName
    ? `${p.vu.music.fileName} · ${(p.vu.music.sizeBytes / 1048576).toFixed(1)} MiB`
    : "No music selected";
  els.musicTrackName.value =
    p.vu?.music?.trackName || p.candidate?.trackName || "";
  els.characterFileName.textContent = p.vu?.character?.fileName
    ? `${p.vu.character.fileName} · ${(p.vu.character.sizeBytes / 1048576).toFixed(1)} MiB`
    : "Empty character layer";
  const ducking = normalizeDuckingSettings(p.vu?.ducking);
  els.duckingEnabled.checked = ducking.enabled;
  els.speakingLevel.value = Math.round(ducking.speakingLevel * 100);
  els.attackMs.value = ducking.attackMs;
  els.releaseMs.value = ducking.releaseMs;
  els.speechSensitivity.value = Math.round(ducking.sensitivity * 100);
  renderDuckingValues();
  renderAnalysisStatus();
  renderActions();
  refreshPreview();
  renderPrepared();
  els.previewStatus.textContent = p.status;
  renderPublishState();
  renderPublicationProgress(p);
}
function formProject() {
  const kind = document.querySelector("input[name=videoKind]:checked").value;
  const appearance = document.querySelector(
    "input[name=appearance]:checked",
  ).value;
  const youtubeUrl = els.youtube.value.trim();
  const checkedVideo = state.project.video || {};
  const keepEmbedCheck =
    kind === "youtube" && checkedVideo.youtubeUrl === youtubeUrl;
  return {
    ...state.project,
    name: els.name.value,
    tickerText: els.ticker.value,
    appearance,
    video: {
      ...state.project.video,
      kind,
      youtubeUrl,
      embedStatus: keepEmbedCheck ? checkedVideo.embedStatus : "",
      embedVideoId: keepEmbedCheck ? checkedVideo.embedVideoId : "",
      embedCheckedAt: keepEmbedCheck ? checkedVideo.embedCheckedAt : "",
    },
    vu: {
      ...state.project.vu,
      music: {
        ...state.project.vu?.music,
        trackName: els.musicTrackName.value.trim(),
      },
      ducking: {
        ...state.project.vu?.ducking,
        enabled: els.duckingEnabled.checked,
        speakingLevel: Number(els.speakingLevel.value) / 100,
        attackMs: Number(els.attackMs.value),
        releaseMs: Number(els.releaseMs.value),
        sensitivity: Number(els.speechSensitivity.value) / 100,
      },
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
function renderDuckingValues() {
  els.speakingLevelValue.textContent = `${els.speakingLevel.value}%`;
  els.attackMsValue.textContent = `${els.attackMs.value} ms`;
  els.releaseMsValue.textContent = `${els.releaseMs.value} ms`;
  const sensitivity = Number(els.speechSensitivity.value);
  els.speechSensitivityValue.textContent =
    sensitivity < 40 ? "Low" : sensitivity > 70 ? "High" : "Recommended";
}
function renderAnalysisStatus(override = "") {
  const hasCharacter = Boolean(state.project?.vu?.character?.fileName),
    analysis = state.project?.vu?.ducking?.analysis || {},
    status = override || analysis.status || "none";
  els.removeMusic.hidden = !state.project?.vu?.music?.fileName;
  els.removeCharacter.hidden = !hasCharacter;
  els.retryAnalysis.hidden = !hasCharacter || status !== "failed";
  els.speechAnalysisStatus.className = `analysis-status is-${status}`;
  els.speechAnalysisStatus.textContent =
    status === "analysing" || status === "pending"
      ? "Analysing speech…"
      : status === "complete"
        ? `Speech analysis complete · ${(analysis.regions || []).length} speaking section${(analysis.regions || []).length === 1 ? "" : "s"}`
        : status === "failed"
          ? `Speech analysis failed · ${analysis.error || "choose Retry analysis"}`
          : hasCharacter
            ? "Presenter stored · analysis required"
            : "No presenter to analyse";
}
async function save({ quiet = false } = {}) {
  const projectId = state.project.id,
    snapshot = formProject(),
    data = await api(`/api/mahogany/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(snapshot),
  });
  replaceProject(data.project);
  if (state.project?.id !== projectId) return data;
  state.project = data.project;
  if (!quiet) message("Draft saved.");
  els.validation.textContent = data.readiness.ready
    ? "All production inputs are ready."
    : data.readiness.errors.join(" ");
  els.validation.classList.toggle("is-success", data.readiness.ready);
  refreshPreview();
  return data;
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
        return `<div class="action-row" data-icon="${escapeHtml(action.iconId)}"><span class="slot-number">${index + 1}</span><button class="icon-picker" type="button" data-slot="${index}" aria-label="Choose icon for key ${index + 1}"><span class="icon-picker-art"><img src="${escapeHtml(assetPath)}" alt=""></span></button><input class="action-label" maxlength="22" value="${escapeHtml(action.label)}" placeholder="Accessible button name (not displayed)"><input class="action-url" value="${escapeHtml(action.href)}" placeholder="https://your-destination.com"></div>`;
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
function renderIcons(query = "") {
  const needle = query.trim().toLowerCase();
  els.iconGrid.innerHTML = state.icons
    .filter((icon) => !needle || icon.label.toLowerCase().includes(needle))
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
  els.publish.disabled = false;
  const isVu =
    (state.project.appearance || "mahogany-master") === "mahogany-vu";
  els.publish.textContent = isVu
    ? "SAVE TO LIBRARY · PUBLISH · EMAIL LINK"
    : state.project.publication?.editionId
      ? "UPDATE, PUBLISH & EMAIL"
      : "CREATE, PUBLISH & EMAIL";
}
function renderAppearance() {
  const appearance =
    document.querySelector("input[name=appearance]:checked")?.value ||
    "mahogany-master";
  const isVu = appearance === "mahogany-vu";
  els.masterMedia.hidden = isVu;
  els.vuMedia.hidden = !isVu;
  if (state.project) state.project.appearance = appearance;
  renderPublishState();
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
    state.isPublishing = true;
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
    busy(els.publish, true, "CHECKING & SAVING...");
    const appearance = document.querySelector(
      "input[name=appearance]:checked",
    ).value;
    const videoKind = document.querySelector(
      "input[name=videoKind]:checked",
    ).value;
    if (appearance !== "mahogany-vu" && videoKind === "youtube") {
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
    if (data.identityRepair?.restoredProject) {
      const restored = data.identityRepair.restoredProject,
        restoredIndex = state.projects.findIndex((item) => item.id === restored.id);
      if (restoredIndex >= 0) state.projects[restoredIndex] = structuredClone(restored);
      else state.projects.push(structuredClone(restored));
    }
    state.project = data.project;
    replaceProject();
    fillForm();
    message(
      data.identityRepair
        ? `${data.identityRepair.newTitle} was separated from ${data.identityRepair.previousTitle}, saved as a new Library item, published, verified and emailed to andrewharris501@gmail.com.`
        : appearance === "mahogany-vu"
        ? "Saved to the Library, published, verified and emailed to andrewharris501@gmail.com."
        : "Created, published, verified and emailed to andrewharris501@gmail.com.",
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
        if (p.candidate?.source === "bandcamp_discovery")
          return renderBandcampLibraryItem(p);
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
    const grade = ["gold", "silver"].includes(p.candidate?.grade)
      ? p.candidate.grade
      : "";
    if (grade) {
      item.classList.add(`grade-${grade}`);
      const badge = item.querySelector(".candidate-badge");
      if (badge)
        badge.textContent =
          grade === "gold"
            ? "Gold · 4 platforms + embeddable YouTube"
            : "Silver · 4 platforms · video required";
    }
    const deleteButton = document.createElement("button");
    deleteButton.className = "quiet-button delete-jukebox";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete Jukebox";
    const identityProtected = Boolean(
      ["published", "unpublished"].includes(p.status) ||
        p.publication?.editionId ||
        p.prepared?.editionId,
    );
    deleteButton.disabled = identityProtected;
    deleteButton.title = identityProtected
      ? "Published identities are permanent and cannot be deleted."
      : "Archive this unpublished jukebox.";
    item.querySelector(".library-actions").append(deleteButton);
    deleteButton.addEventListener("click", async () => {
      if (
        !window.confirm(
          `Delete ${p.name || "this jukebox"} from the active library? It will be archived and will not be published.`,
        )
      )
        return;
      deleteButton.disabled = true;
      try {
        await api(`/api/mahogany/projects/${p.id}`, { method: "DELETE" });
        state.projects = state.projects.filter((project) => project.id !== p.id);
        if (state.project?.id === p.id) {
          state.project = state.projects[0] || null;
          if (state.project) fillForm();
        }
        renderLibrary();
        message("Unpublished jukebox removed from the library and archived.");
      } catch (error) {
        failure(error);
        deleteButton.disabled = false;
      }
    });
    item.querySelector(".edit").addEventListener("click", () => {
      loadProject(p);
      showView("builder");
    });
    item.querySelector(".attach-track")?.addEventListener("click", () => {
      loadProject(p);
      showView("builder");
      els.music.click();
    });
    const toggle = item.querySelector("input[type=checkbox]");
    if (!toggle) return;
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
function renderBandcampLibraryItem(project) {
  const band = project.candidate,
    links = [
      ["Bandcamp", band.bandcampUrl],
      ["Store", band.bandcampStoreUrl],
      ["Facebook", band.facebookUrl],
      ["Spotify", band.spotifyUrl],
    ]
      .map(([label, url]) =>
        url
          ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
          : `<span>${label} · unavailable</span>`,
      )
      .join(""),
    audioStatus = project.vu?.music?.fileName
      ? `Track attached · ${project.vu.music.fileName}`
      : "Audio: Not Added";
  return `<article class="library-item bandcamp-discovery-item" data-id="${project.id}"><div><h3>${escapeHtml(project.name || "Untitled band")}</h3><p><span class="candidate-badge">Bandcamp discovery · ${Number(band.linkScore) || 1}/4</span> · ${escapeHtml(band.location || "Location not confirmed")}</p><small>${escapeHtml(audioStatus)} · Purchase: ${escapeHtml(band.purchaseStatus || "Not Purchased")} · Discovered ${band.dateDiscovered ? new Date(band.dateDiscovered).toLocaleDateString() : "recently"}</small></div><div class="band-links">${links}</div><div class="library-actions bandcamp-library-actions"><a class="quiet-button" href="${escapeHtml(band.bandcampUrl)}" target="_blank" rel="noopener noreferrer">Buy / Get Track</a><button class="quiet-button attach-track" type="button">Attach MP3</button><button class="quiet-button edit" type="button">Edit Jukebox</button></div></article>`;
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
  els.addTwentyBands.disabled = job.status === "running";
  els.addTwentyBands.querySelector("strong").textContent =
    job.status === "running" ? "RESEARCHING BANDS…" : "ADD 20 BANDS";
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
        `${count} qualified Linktree band${count === 1 ? "" : "s"} ${count === 1 ? "was" : "were"} added as unpublished gold or silver drafts. Nothing was published.`,
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
async function addTwentyBands() {
  try {
    renderCandidateProgress({
      status: "running",
      message: "Starting the fail-closed 20-band Linktree research batch…",
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
function renderBandDiscovery(job) {
  state.discoveryJob = job;
  const running = job?.status === "running";
  els.findBands.disabled = running;
  els.cancelBandDiscovery.hidden = !running;
  els.bandDiscoveryProgress.hidden = !job;
  if (!job) {
    els.bandDiscoveryResults.hidden = true;
    return;
  }
  els.bandDiscoveryProgress.innerHTML = `<strong>${escapeHtml(job.message || "Searching Bandcamp...")}</strong><br>${Number(job.found) || 0} / ${Number(job.requested) || 20} bands found · ${Number(job.reviewed) || 0} Bandcamp candidates checked`;
  const results = job.result?.results || [];
  if (results.length) renderBandDiscoveryResults(results);
}
function renderBandDiscoveryResults(results) {
  els.bandDiscoveryResults.hidden = false;
  els.bandDiscoveryCount.textContent = `${results.length} band${results.length === 1 ? "" : "s"} discovered`;
  els.bandDiscoveryRows.innerHTML = results
    .map((band) => {
      const libraryStatus = band.libraryStatus || "",
        rowClass = `is-${String(band.status || "partial").toLowerCase().replaceAll(" ", "-")}${libraryStatus ? ` is-${libraryStatus}` : ""}`;
      return `<tr class="${rowClass}" data-id="${escapeHtml(band.id)}"><td><input class="discovery-select" type="checkbox" aria-label="Select ${escapeHtml(band.bandName)}" ${libraryStatus ? "disabled" : ""}></td><td><span class="discovery-band-name">${escapeHtml(band.bandName)}</span></td><td>${escapeHtml(band.location || "—")}</td>${["bandcamp", "store", "facebook", "spotify"].map((kind) => discoveryLinkCell(band.links?.[kind], kind)).join("")}<td><span class="discovery-score">${Number(band.linkScore) || 1}/4</span></td><td><span class="discovery-state ${escapeHtml(band.status)}">${escapeHtml(band.status)}</span></td><td><button class="quiet-button to-library" type="button" ${libraryStatus ? "disabled" : ""}>${libraryStatus === "added" ? "In Library" : libraryStatus === "duplicate" ? "Already in Library" : "To Library"}</button></td></tr>`;
    })
    .join("");
  els.bandDiscoveryRows.querySelectorAll(".to-library").forEach((button) =>
    button.addEventListener("click", () =>
      addDiscoveriesToLibrary([button.closest("tr").dataset.id]),
    ),
  );
}
function discoveryLinkCell(link, kind) {
  const label =
    kind === "bandcamp"
      ? "Bandcamp"
      : kind === "store"
        ? "Bandcamp Store"
        : platformLabel(kind);
  if (link?.status === "confirmed")
    return `<td><a class="link-status is-confirmed" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(label)} confirmed">✓</a></td>`;
  if (link?.status === "possible")
    return `<td><a class="link-status is-possible" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" title="Possible ${escapeHtml(label)} · not saved">?</a></td>`;
  return `<td><span class="link-status" title="${escapeHtml(label)} not found">—</span></td>`;
}
async function startBandDiscovery() {
  try {
    renderBandDiscovery({
      status: "running",
      message: "Searching Bandcamp...",
      found: 0,
      requested: 20,
      reviewed: 0,
    });
    const data = await api("/api/mahogany/band-discovery", {
      method: "POST",
      body: JSON.stringify({ location: els.discoveryLocation.value.trim() }),
    });
    renderBandDiscovery(data.job);
    clearInterval(state.discoveryTimer);
    state.discoveryTimer = setInterval(pollBandDiscovery, 1000);
    await pollBandDiscovery();
  } catch (error) {
    renderBandDiscovery(null);
    failure(error);
  }
}
async function pollBandDiscovery() {
  if (!state.discoveryJob?.id) return;
  try {
    const data = await api(`/api/mahogany/band-discovery/${state.discoveryJob.id}`);
    renderBandDiscovery(data.job);
    if (data.job.status === "running") return;
    clearInterval(state.discoveryTimer);
    state.discoveryTimer = null;
    if (data.job.status === "failed")
      failure(new Error(data.job.error || "Band discovery failed."));
    else
      message(
        `${data.job.result?.found || 0} genuine Bandcamp band${data.job.result?.found === 1 ? "" : "s"} ready for review. Nothing has been added yet.`,
      );
  } catch (error) {
    clearInterval(state.discoveryTimer);
    state.discoveryTimer = null;
    failure(error);
  }
}
async function cancelBandDiscovery() {
  if (!state.discoveryJob?.id) return;
  try {
    const data = await api(
      `/api/mahogany/band-discovery/${state.discoveryJob.id}/cancel`,
      { method: "POST", body: "{}" },
    );
    renderBandDiscovery(data.job);
  } catch (error) {
    failure(error);
  }
}
async function addDiscoveriesToLibrary(ids) {
  if (!state.discoveryJob?.id || !ids.length) {
    message("Select at least one band first.");
    return;
  }
  try {
    const data = await api(
      `/api/mahogany/band-discovery/${state.discoveryJob.id}/to-library`,
      { method: "POST", body: JSON.stringify({ ids }) },
    );
    renderBandDiscovery(data.job);
    await refreshLibraryProjects();
    message(
      `${data.added.length} band${data.added.length === 1 ? "" : "s"} added to the Band Library.${data.duplicates.length ? ` ${data.duplicates.length} already in Library.` : ""}`,
    );
  } catch (error) {
    failure(error);
  }
}
function loadProject(project) {
  state.project = structuredClone(project);
  fillForm();
}
function replaceProject(project = state.project) {
  const index = state.projects.findIndex((p) => p.id === project.id);
  if (index >= 0) state.projects[index] = structuredClone(project);
  else state.projects.unshift(structuredClone(project));
  renderLibrary();
}
function showView(name) {
  els.legacyCandidateLaunch.hidden = name !== "builder";
  els.builderView.hidden = name !== "builder";
  els.discoveryView.hidden = name !== "discovery";
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
els.chooseMusic.addEventListener("click", () => els.music.click());
els.music.addEventListener("change", async () => {
  const file = els.music.files[0];
  if (!file) return;
  try {
    const bytes = await file.arrayBuffer(),
      data = await api(`/api/mahogany/projects/${state.project.id}/music`, {
        method: "PUT",
        body: bytes,
        headers: {
          "content-type": file.name.toLowerCase().endsWith(".wav")
            ? "audio/wav"
            : "audio/mpeg",
          "x-file-name": encodeURIComponent(file.name),
        },
      });
    state.project = data.project;
    replaceProject();
    fillForm();
    message("Music stored. The VU needles will respond to this track.");
  } catch (error) {
    failure(error);
  }
});
els.chooseCharacter.addEventListener("click", () => els.character.click());
async function analyseAndStorePresenter(file, bytes) {
  renderAnalysisStatus("analysing");
  let context;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext)
      throw new Error("Audio analysis is unavailable in this browser.");
    context = new AudioContext();
    const decoded = await context.decodeAudioData(bytes.slice(0)),
      settings = normalizeDuckingSettings({
        enabled: els.duckingEnabled.checked,
        speakingLevel: Number(els.speakingLevel.value) / 100,
        attackMs: Number(els.attackMs.value),
        releaseMs: Number(els.releaseMs.value),
        sensitivity: Number(els.speechSensitivity.value) / 100,
      }),
      envelope = analysePresenterAudio(decoded, settings),
      data = await api(`/api/mahogany/projects/${state.project.id}/analysis`, {
        method: "PUT",
        body: JSON.stringify({
          settings,
          analysis: {
            status: "complete",
            sourceSha256: state.project.vu.character.sha256,
            durationSeconds: envelope.durationSeconds,
            regions: envelope.regions,
          },
        }),
      });
    state.project = data.project;
    replaceProject();
    fillForm();
    message(
      envelope.regions.length
        ? `Speech analysis complete. ${envelope.regions.length} speaking section${envelope.regions.length === 1 ? "" : "s"} detected.`
        : "Speech analysis complete. No meaningful speech was detected, so music will not duck.",
    );
  } catch (error) {
    console.error("Presenter speech analysis failed", error);
    const data = await api(`/api/mahogany/projects/${state.project.id}/analysis`, {
      method: "PUT",
      body: JSON.stringify({
        settings: state.project.vu.ducking,
        analysis: {
          status: "failed",
          sourceSha256: state.project.vu.character.sha256,
          error: error.message,
        },
      }),
    }).catch(() => null);
    if (data?.project) {
      state.project = data.project;
      replaceProject();
    }
    renderAnalysisStatus("failed");
    message(
      "Presenter stored, but speech analysis failed. Playback remains safe; choose Retry analysis to try again.",
    );
  } finally {
    if (context) await context.close().catch(() => {});
  }
}
els.character.addEventListener("change", async () => {
  const file = els.character.files[0];
  if (!file) return;
  try {
    const bytes = await file.arrayBuffer(),
      data = await api(
        `/api/mahogany/projects/${state.project.id}/character`,
        {
          method: "PUT",
          body: bytes,
          headers: {
            "content-type": "video/mp4",
            "x-file-name": encodeURIComponent(file.name),
          },
        },
      );
    state.project = data.project;
    replaceProject();
    fillForm();
    await analyseAndStorePresenter(file, bytes);
  } catch (error) {
    failure(error);
  }
});
els.retryAnalysis.addEventListener("click", () => els.character.click());
els.removeMusic.addEventListener("click", async () => {
  try {
    const data = await api(`/api/mahogany/projects/${state.project.id}/music`, {
      method: "DELETE",
    });
    state.project = data.project;
    replaceProject();
    fillForm();
    message("Music removed. A presenter can still play on its own.");
  } catch (error) {
    failure(error);
  }
});
els.removeCharacter.addEventListener("click", async () => {
  try {
    const data = await api(
      `/api/mahogany/projects/${state.project.id}/character`,
      { method: "DELETE" },
    );
    state.project = data.project;
    replaceProject();
    fillForm();
    message("Presenter removed. Music will play at its normal level.");
  } catch (error) {
    failure(error);
  }
});
for (const control of [
  els.speakingLevel,
  els.attackMs,
  els.releaseMs,
  els.speechSensitivity,
])
  control.addEventListener("input", renderDuckingValues);
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
document.querySelectorAll('input[name="appearance"]').forEach((radio) =>
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    renderAppearance();
    refreshPreview();
  }),
);
els.iconSearch.addEventListener("input", () =>
  renderIcons(els.iconSearch.value),
);
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
els.addTwentyBands.addEventListener("click", addTwentyBands);
els.findBands.addEventListener("click", startBandDiscovery);
els.cancelBandDiscovery.addEventListener("click", cancelBandDiscovery);
els.addSelectedBands.addEventListener("click", () =>
  addDiscoveriesToLibrary(
    [...els.bandDiscoveryRows.querySelectorAll(".discovery-select:checked")].map(
      (checkbox) => checkbox.closest("tr").dataset.id,
    ),
  ),
);
els.addGoodBands.addEventListener("click", () =>
  addDiscoveriesToLibrary(
    (state.discoveryJob?.result?.results || [])
      .filter(
        (band) =>
          ["GOOD", "COMPLETE"].includes(band.status) && !band.libraryStatus,
      )
      .map((band) => band.id),
  ),
);
bootstrap().catch(failure);
