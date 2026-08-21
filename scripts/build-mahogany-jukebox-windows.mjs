import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const require = createRequire(import.meta.url),
  packagerModule = require("@electron/packager"),
  packager =
    packagerModule.packager || packagerModule.default || packagerModule,
  { zip } = require("cross-zip"),
  electronPackage = require("electron/package.json"),
  electronChecksums = require("electron/checksums.json"),
  execFileAsync = promisify(execFile),
  zipAsync = promisify(zip);

function runBoundedSmokeTest(application, args, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const child = spawn(application, args, {
      windowsHide: true,
      stdio: "ignore",
      env: { ...process.env, ELECTRON_DISABLE_CRASH_REPORTER: "1" },
    });
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => {
      execFile(
        path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe"),
        ["/PID", String(child.pid), "/T", "/F"],
        { windowsHide: true },
        () => finish(new Error("The bounded packaged-app smoke test timed out.")),
      );
    }, timeoutMs);
    child.once("error", finish);
    child.once("exit", (code) =>
      finish(code === 0 ? null : new Error(`The packaged-app smoke test exited with code ${code}.`)),
    );
  });
}
const root = process.cwd(),
  product = JSON.parse(
    await fs.readFile(path.join(root, "mahogany-product.json"), "utf8"),
  ),
  version = product.version,
  productName = product.productName,
  executableName = "mahogany-jukebox",
  electronVersion = String(electronPackage.version),
  electronZipName = `electron-v${electronVersion}-win32-x64.zip`,
  expectedElectronHash = String(
    electronChecksums[electronZipName] || "",
  ).toLowerCase(),
  outputDirectory = path.join(
    root,
    "output",
    `Mahogany-Jukebox-Windows-${version}`,
  ),
  temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "mahogany-jukebox-windows-"),
  ),
  sourceDirectory = path.join(temporaryRoot, "source"),
  packagedDirectory = path.join(temporaryRoot, "packaged");
const runtimeFiles = [
  "studio/mahogany-desktop-main.mjs",
  "mahogany-studio/index.html",
  "mahogany-studio/styles.css",
  "mahogany-studio/app.js",
  "scripts/mahogany-studio-server.mjs",
  "scripts/mahogany-jukebox-model.mjs",
  "scripts/mahogany-jukebox-layout.mjs",
  "scripts/mahogany-jukebox-skin-schema.mjs",
  "scripts/mahogany-band-candidates.mjs",
  "scripts/studio-jookbox-research.mjs",
  "scripts/mahogany-jukebox-publication.mjs",
  "scripts/aggits-jukebox-preview.mjs",
  "scripts/aggits-jukebox-icons.mjs",
  "scripts/aggits-jukebox-qr-artwork.mjs",
  "scripts/bar-edition-publication.mjs",
  "scripts/venue-qr-artwork.mjs",
  "scripts/vendor/qrcode.min.js",
  "assets/aggits-jukebox-master-v1.jpg",
  "assets/aggits-jukebox-illuminated-master-v3.png",
  "assets/aggits-coin-gold-v1.png",
  "assets/aggits-jukebox-icons-master-v1.jpg",
  "assets/aggits-jukebox-icons-oval-v6.LICENSE.txt",
  "assets/aggits-jukebox-integrity.json",
  "assets/aggits-jukebox-qr-master-v1.png",
  "assets/audio/jukebox-real-coin-insert-cc0.mp3",
  "assets/audio/jukebox-real-coin-insert-cc0.LICENSE.txt",
  "assets/audio/jukebox-mechanical-button-clunk-public-domain.ogg",
  "assets/audio/jukebox-mechanical-button-clunk-public-domain.LICENSE.txt",
  "assets/js/jookbox-coin-audio.js",
  "mahogany-product.json",
];
const log = (text) => console.log(`[Mahogany Jukebox] ${text}`);
const sha256 = async (file) =>
  crypto
    .createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");
async function copy(relative) {
  const source = path.join(root, relative),
    destination = path.join(sourceDirectory, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}
async function find(directory, name, depth = 4) {
  if (!directory || depth < 0) return "";
  try {
    const direct = path.join(directory, name);
    if ((await fs.stat(direct).catch(() => null))?.isFile()) return direct;
    for (const entry of await fs.readdir(directory, { withFileTypes: true }))
      if (entry.isDirectory()) {
        const found = await find(
          path.join(directory, entry.name),
          name,
          depth - 1,
        );
        if (found) return found;
      }
  } catch {}
  return "";
}
async function electronZip() {
  for (const directory of [
    process.env.DEEP_CUTS_ELECTRON_ZIP_DIR,
    path.join(root, ".tools", "localappdata", "electron", "Cache"),
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "electron", "Cache")
      : "",
    path.join(os.homedir(), "AppData", "Local", "electron", "Cache"),
  ].filter(Boolean)) {
    const found = await find(directory, electronZipName);
    if (found) return found;
  }
  return "";
}
async function installer(appDirectory) {
  const portableName = `Mahogany-Jukebox-${version}-Windows-x64.zip`,
    portable = path.join(outputDirectory, portableName),
    setup = path.join(outputDirectory, `${productName}-${version} Setup.exe`),
    bootstrap = path.join(temporaryRoot, "installer");
  await fs.mkdir(bootstrap, { recursive: true });
  await zipAsync(appDirectory, portable);
  await fs.copyFile(portable, path.join(bootstrap, portableName));
  const ps = [
    "param([Parameter(Mandatory=$true)][string]$Archive)",
    "$ErrorActionPreference='Stop'",
    `$installDirectory=if([string]::IsNullOrWhiteSpace($env:MAHOGANY_TEST_INSTALL_ROOT)){Join-Path $env:LOCALAPPDATA 'Programs\\${productName}'}else{$env:MAHOGANY_TEST_INSTALL_ROOT}`,
    "New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null",
    "Expand-Archive -LiteralPath $Archive -DestinationPath $installDirectory -Force",
    `$application=Join-Path $installDirectory '${executableName}.exe'`,
    "if(-not (Test-Path -LiteralPath $application)){throw 'Mahogany Jukebox executable was not installed.'}",
    "if($env:MAHOGANY_INSTALL_TEST_MODE -eq '1'){exit 0}",
    "$shell=New-Object -ComObject WScript.Shell",
    "function Set-Shortcut([string]$where){$shortcut=$shell.CreateShortcut($where);$shortcut.TargetPath=$application;$shortcut.WorkingDirectory=$installDirectory;$shortcut.Description='Mahogany Jukebox';$shortcut.Save()}",
    `Set-Shortcut (Join-Path ([Environment]::GetFolderPath('Desktop')) '${productName}.lnk')`,
    "$menu=Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\Mahogany Jukebox'",
    "New-Item -ItemType Directory -Force -Path $menu | Out-Null",
    `Set-Shortcut (Join-Path $menu '${productName}.lnk')`,
    "Start-Process -FilePath $application",
  ].join("\r\n");
  await fs.writeFile(path.join(bootstrap, "install.ps1"), ps, "utf8");
  await fs.writeFile(
    path.join(bootstrap, "install.cmd"),
    `@ECHO OFF\r\npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Archive "%~dp0${portableName}"\r\nEXIT /B %ERRORLEVEL%\r\n`,
    "utf8",
  );
  const sed = [
      "[Version]",
      "Class=IEXPRESS",
      "SEDVersion=3",
      "[Options]",
      "PackagePurpose=InstallApp",
      "ShowInstallProgramWindow=1",
      "HideExtractAnimation=0",
      "UseLongFileName=1",
      "InsideCompressed=0",
      "CAB_FixedSize=0",
      "CAB_ResvCodeSigning=0",
      "RebootMode=N",
      "InstallPrompt=",
      "DisplayLicense=",
      "FinishMessage=",
      `TargetName=${setup}`,
      `FriendlyName=${productName} ${version}`,
      "AppLaunched=install.cmd",
      "PostInstallCmd=<None>",
      "AdminQuietInstCmd=install.cmd",
      "UserQuietInstCmd=install.cmd",
      "SourceFiles=SourceFiles",
      "[Strings]",
      `FILE0="${portableName}"`,
      'FILE1="install.cmd"',
      'FILE2="install.ps1"',
      "[SourceFiles]",
      `SourceFiles0=${bootstrap}${path.sep}`,
      "[SourceFiles0]",
      "%FILE0%=",
      "%FILE1%=",
      "%FILE2%=",
    ].join("\r\n"),
    sedPath = path.join(bootstrap, "installer.sed");
  await fs.writeFile(sedPath, sed, "utf8");
  await execFileAsync(
    path.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32",
      "iexpress.exe",
    ),
    ["/N", "/Q", sedPath],
    { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
  );
  if (!(await fs.stat(setup).catch(() => null))?.isFile())
    throw new Error("Windows Setup executable was not created.");
  return { portable, setup };
}

async function verifyInstaller(setup, packagedApplication) {
  const installDirectory = path.join(temporaryRoot, "installer-smoke-install"),
    profileDirectory = path.join(temporaryRoot, "installer-smoke-profile"),
    installedApplication = path.join(
      installDirectory,
      `${executableName}.exe`,
    ),
    profileMarker = path.join(profileDirectory, "upgrade-user-data.json"),
    environment = {
      ...process.env,
      MAHOGANY_INSTALL_TEST_MODE: "1",
      MAHOGANY_TEST_INSTALL_ROOT: installDirectory,
    };
  const install = async (label) => {
    log(`Running the bounded ${label} installer test.`);
    await execFileAsync(setup, [], {
      windowsHide: true,
      timeout: 120000,
      env: environment,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (!(await fs.stat(installedApplication).catch(() => null))?.isFile())
      throw new Error(`The ${label} installer test did not install the application.`);
  };
  await install("clean-install");
  await fs.mkdir(profileDirectory, { recursive: true });
  await fs.writeFile(
    profileMarker,
    JSON.stringify({ version, preserved: true }),
    "utf8",
  );
  await runBoundedSmokeTest(installedApplication, [
    "--mahogany-bounded-smoke-test",
    `--user-data-dir=${profileDirectory}`,
  ]);
  await install("in-place-upgrade");
  const marker = JSON.parse(await fs.readFile(profileMarker, "utf8"));
  if (marker.version !== version || marker.preserved !== true)
    throw new Error("The installer upgrade did not preserve user data.");
  if ((await sha256(installedApplication)) !== (await sha256(packagedApplication)))
    throw new Error("The installed executable differs from the packaged executable.");
}

if (process.platform !== "win32")
  throw new Error("Build the Mahogany Jukebox installer on Windows.");
try {
  log("Staging the isolated application runtime.");
  await fs.mkdir(sourceDirectory, { recursive: true });
  for (const file of runtimeFiles) await copy(file);
  const iconDirectory = "assets/aggits-jukebox-icons-oval-v6",
    icons = (await fs.readdir(path.join(root, iconDirectory))).filter((file) =>
      file.endsWith(".svg"),
    );
  if (icons.length !== 173)
    throw new Error(`Expected 173 approved icons, found ${icons.length}.`);
  for (const icon of icons) await copy(path.join(iconDirectory, icon));
  await fs.writeFile(
    path.join(sourceDirectory, "package.json"),
    `${JSON.stringify({ name: "mahogany-jukebox", productName, type: "module", private: true, version, description: "Mahogany Jukebox creator, verified candidate intake and permanent publishing library.", main: "studio/mahogany-desktop-main.mjs", author: "Clearlight Creative", dependencies: { "electron-squirrel-startup": "^1.0.1", sharp: "0.35.2", yauzl: "2.10.0" } }, null, 2)}\n`,
  );
  await fs.mkdir(path.join(sourceDirectory, "node_modules"), {
    recursive: true,
  });
  for (const moduleName of [
    "electron-squirrel-startup",
    "sharp",
    "detect-libc",
    "semver",
    "@img/colour",
    "@img/sharp-win32-x64",
    "yauzl",
    "fd-slicer",
    "pend",
    "buffer-crc32",
  ]) {
    await fs.cp(
      path.join(root, "node_modules", ...moduleName.split("/")),
      path.join(sourceDirectory, "node_modules", ...moduleName.split("/")),
      { recursive: true },
    );
  }
  const cached = await electronZip();
  if (!cached) throw new Error(`Verified ${electronZipName} is not cached.`);
  if ((await sha256(cached)) !== expectedElectronHash)
    throw new Error("Cached Electron failed its official SHA-256 check.");
  const packaged = await packager({
    dir: sourceDirectory,
    out: packagedDirectory,
    platform: "win32",
    arch: "x64",
    electronVersion,
    electronZipDir: path.dirname(cached),
    asar: { unpack: "**/*.{node,dll}" },
    overwrite: true,
    prune: false,
    name: productName,
    executableName,
  });
  if (packaged.length !== 1)
    throw new Error("Packaging did not produce exactly one application.");
  const application = path.join(packaged[0], `${executableName}.exe`);
  log("Running the bounded clean-launch packaged-app smoke test.");
  const smokeProfile = path.join(temporaryRoot, "smoke-profile");
  await fs.mkdir(smokeProfile, { recursive: true });
  const smokeArgs = [
    "--mahogany-bounded-smoke-test",
    `--user-data-dir=${smokeProfile}`,
  ];
  await runBoundedSmokeTest(
    application,
    smokeArgs,
  );
  const preservationMarker = path.join(
    smokeProfile,
    "mahogany-upgrade-preservation-check.json",
  );
  await fs.writeFile(
    preservationMarker,
    JSON.stringify({ version, preserved: true }),
    "utf8",
  );
  log("Running the bounded in-place-upgrade packaged-app smoke test.");
  await runBoundedSmokeTest(application, smokeArgs);
  const preserved = JSON.parse(await fs.readFile(preservationMarker, "utf8"));
  if (preserved.version !== version || preserved.preserved !== true)
    throw new Error("The upgrade smoke test did not preserve user data.");
  await fs.rm(outputDirectory, { recursive: true, force: true });
  await fs.mkdir(outputDirectory, { recursive: true });
  const files = await installer(packaged[0]),
    hashes = [];
  await verifyInstaller(files.setup, application);
  for (const file of [files.setup, files.portable])
    hashes.push(`${await sha256(file)}  ${path.basename(file)}`);
  await fs.writeFile(
    path.join(outputDirectory, "SHA256SUMS.txt"),
    `${hashes.join("\r\n")}\r\n`,
  );
  await fs.writeFile(
    path.join(outputDirectory, "INSTALL ON WINDOWS.txt"),
    [
      `MAHOGANY JUKEBOX ${version} — WINDOWS`,
      "",
      `Double-click: ${path.basename(files.setup)}`,
      "",
      "If Windows displays a protection message, choose More info, then Run anyway.",
      "The app stores its projects separately in Windows application data.",
      "Existing Deep Cuts editions are not changed.",
      "",
      "Copyright Clearlight Creative 2026.",
    ].join("\r\n"),
  );
  log(`Installer ready: ${files.setup}`);
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
