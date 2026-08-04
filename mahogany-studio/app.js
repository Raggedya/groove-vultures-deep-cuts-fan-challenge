const $ = (id) => document.getElementById(id);
const state = {
  project: null,
  projects: [],
  icons: [],
  activeSlot: 0,
  authentication: null,
};
const els = {
  builderView: $("builderView"),
  libraryView: $("libraryView"),
  form: $("projectForm"),
  name: $("name"),
  ticker: $("tickerText"),
  tickerCount: $("tickerCount"),
  youtube: $("youtubeUrl"),
  mp4: $("mp4File"),
  chooseMp4: $("chooseMp4"),
  videoFileName: $("videoFileName"),
  actions: $("actionRows"),
  preview: $("jukeboxPreview"),
  previewStatus: $("previewStatus"),
  qr: $("qrPreview"),
  qrEmpty: $("qrEmpty"),
  validation: $("validation"),
  create: $("createJukebox"),
  accept: $("acceptJukebox"),
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
  els.youtube.value = p.video.kind === "youtube" ? p.video.youtubeUrl : "";
  document.querySelector(
    `input[name=videoKind][value=${p.video.kind}]`,
  ).checked = true;
  els.videoFileName.textContent =
    p.video.kind === "mp4"
      ? `${p.video.fileName} · ${(p.video.sizeBytes / 1048576).toFixed(1)} MiB`
      : "MP4/H.264 · 1120 × 1280 px · maximum 24 MiB";
  renderActions();
  refreshPreview();
  renderPrepared();
  els.previewStatus.textContent = p.status;
  els.accept.disabled = p.status !== "prepared";
}
function formProject() {
  return {
    ...state.project,
    name: els.name.value,
    tickerText: els.ticker.value,
    video: {
      ...state.project.video,
      kind: document.querySelector("input[name=videoKind]:checked").value,
      youtubeUrl: els.youtube.value,
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
function renderActions() {
  els.actions.innerHTML = state.project.actions
    .map(
      (action, index) =>
        `<div class="action-row" data-icon="${escapeHtml(action.iconId)}"><span class="slot-number">${index + 1}</span><button class="icon-picker" type="button" data-slot="${index}" aria-label="Choose icon for key ${index + 1}"><img src="/assets/aggits-jukebox-icons/${escapeHtml(action.iconId)}.webp" alt=""></button><input class="action-label" maxlength="32" value="${escapeHtml(action.label)}" placeholder="Button label"><input class="action-url" value="${escapeHtml(action.href)}" placeholder="https://your-destination.com"></div>`,
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
        `<button class="icon-option" type="button" data-icon="${icon.id}"><img src="${icon.assetPath}" alt=""><span>${escapeHtml(icon.label)}</span></button>`,
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
async function createProduction() {
  try {
    await save({ quiet: true });
    busy(els.create, true, "Creating…");
    const data = await api(
      `/api/mahogany/projects/${state.project.id}/create`,
      { method: "POST", body: "{}" },
    );
    state.project = data.project;
    replaceProject();
    fillForm();
    message(
      "Permanent URL reserved. Review both previews, then press Accept & publish.",
    );
  } catch (error) {
    failure(error);
  } finally {
    busy(els.create, false, "Create");
  }
}
async function acceptProduction() {
  try {
    busy(els.accept, true, "Publishing…");
    const data = await api(
      `/api/mahogany/projects/${state.project.id}/accept`,
      { method: "POST", body: "{}" },
    );
    state.project = data.project;
    replaceProject();
    fillForm();
    message("Published, verified and emailed to andrewharris501@gmail.com.");
  } catch (error) {
    failure(error);
  } finally {
    busy(els.accept, false, "Accept & publish");
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
      (p) =>
        `<article class="library-item" data-id="${p.id}"><div><h3>${escapeHtml(p.name || "Untitled Jukebox")}</h3><p>${escapeHtml(p.status)} · ${new Date(p.updatedAt).toLocaleString()}</p></div><label class="toggle"><input type="checkbox" ${p.status === "published" ? "checked" : ""} ${p.publication?.editionId ? "" : "disabled"}>Published</label><a class="library-url" href="${escapeHtml(p.publication?.liveUrl || "")}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.publication?.liveUrl || "Permanent URL created on Accept")}</a><div class="library-actions"><button class="quiet-button edit" type="button">Edit</button>${p.publication?.qrImageUrl ? `<a class="quiet-button" href="${escapeHtml(p.publication.qrImageUrl)}" target="_blank" rel="noopener noreferrer">QR</a>` : ""}</div></article>`,
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
function loadProject(project) {
  state.project = structuredClone(project);
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
  save().catch(failure);
});
els.create.addEventListener("click", createProduction);
els.accept.addEventListener("click", acceptProduction);
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
els.ticker.addEventListener(
  "input",
  () => (els.tickerCount.textContent = els.ticker.value.length),
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
bootstrap().catch(failure);
