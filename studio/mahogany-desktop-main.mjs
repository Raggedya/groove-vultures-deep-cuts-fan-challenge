import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, Menu, safeStorage, shell } from "electron";
import { createMahoganyStudioServer } from "../scripts/mahogany-studio-server.mjs";

const smoke =
  process.argv.includes("--mahogany-bounded-smoke-test") ||
  app.commandLine.hasSwitch("mahogany-bounded-smoke-test");
let server = null,
  origin = "",
  window = null;
if (smoke) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
  app.commandLine.appendSwitch("disable-crash-reporter");
}
app.enableSandbox();
const webPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
};

async function start() {
  const root = app.getAppPath(),
    dataDir = path.join(app.getPath("userData"), "mahogany-jukebox"),
    sharedCredential = path.join(
      app.getPath("appData"),
      "Deep Cuts Studio",
      "studio",
      "publisher-credential.json",
    ),
    credentialStore = createCredentialStore(sharedCredential);
  server = createMahoganyStudioServer({
    root,
    dataDir,
    credentialStore,
    appVersion: app.getVersion(),
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
}
async function open() {
  if (!origin) await start();
  window = new BrowserWindow({
    title: "Mahogany Jukebox",
    width: 1500,
    height: 950,
    minWidth: 1100,
    minHeight: 760,
    show: false,
    backgroundColor: "#080503",
    autoHideMenuBar: true,
    webPreferences,
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${origin}/`)) return { action: "allow" };
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(`${origin}/`)) return;
    event.preventDefault();
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
  });
  window.once("ready-to-show", () => window?.show());
  window.on("closed", () => (window = null));
  await window.loadURL(`${origin}/mahogany-studio/`);
}
async function bounded() {
  if (!origin) await start();
  const [page, bootstrap] = await Promise.all([
      fetch(`${origin}/mahogany-studio/`),
      fetch(`${origin}/api/mahogany/bootstrap`),
    ]),
    [html, json] = await Promise.all([page.text(), bootstrap.json()]);
  if (
    !page.ok ||
    !bootstrap.ok ||
    !html.includes("Mahogany Jukebox") ||
    !html.includes("Four physical action keys") ||
    !Array.isArray(json.icons) ||
    json.icons.length !== 111
  )
    throw new Error("The packaged Mahogany Jukebox smoke test failed.");
}
async function stop() {
  if (!server) return;
  const closing = server;
  server = null;
  await new Promise((resolve) => {
    closing.close(resolve);
    closing.closeAllConnections?.();
  });
}
function createCredentialStore(file) {
  async function read() {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw error;
    }
  }
  async function write(value) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await fs.rename(temporary, file);
  }
  async function getInstallationId() {
    const record = await read();
    if (/^studio_[a-f0-9]{32}$/.test(String(record.installationId || "")))
      return record.installationId;
    record.installationId = `studio_${crypto.randomBytes(16).toString("hex")}`;
    record.createdAt = new Date().toISOString();
    await write(record);
    return record.installationId;
  }
  async function getToken() {
    const record = await read();
    if (!record.encryptedToken) return "";
    if (!safeStorage.isEncryptionAvailable())
      throw new Error("Windows secure credential storage is unavailable.");
    try {
      return safeStorage.decryptString(
        Buffer.from(record.encryptedToken, "base64"),
      );
    } catch {
      return "";
    }
  }
  async function setToken(token) {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error("Windows secure credential storage is unavailable.");
    const record = await read();
    record.installationId = await getInstallationId();
    record.encryptedToken = safeStorage
      .encryptString(String(token))
      .toString("base64");
    record.activatedAt = new Date().toISOString();
    await write(record);
  }
  async function clearToken() {
    const record = await read();
    delete record.encryptedToken;
    delete record.activatedAt;
    await write(record);
  }
  return {
    activationSupported: true,
    getInstallationId,
    getToken,
    setToken,
    clearToken,
  };
}

if (!app.requestSingleInstanceLock() && !smoke) app.quit();
else
  app
    .whenReady()
    .then(async () => {
      if (process.platform !== "darwin") Menu.setApplicationMenu(null);
      if (smoke) {
        await bounded();
        await stop();
        app.exit(0);
        return;
      }
      await open();
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) void open();
      });
    })
    .catch((error) => {
      console.error("[Mahogany Jukebox]", error);
      app.exit(1);
    });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  void stop();
});
