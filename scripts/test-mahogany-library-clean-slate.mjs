import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  applyMahoganyLibraryCleanSlate,
  MAHOGANY_LIBRARY_CLEAN_SLATE_VERSION,
} from "./mahogany-library-clean-slate.mjs";

const temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "mahogany-clean-slate-test-"),
  ),
  dataDir = path.join(temporaryRoot, "mahogany-jukebox"),
  projectRoot = path.join(dataDir, "projects"),
  oldId = "studio_012345abcdef";
try {
  await fs.mkdir(path.join(projectRoot, oldId), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, oldId, "project.json"),
    JSON.stringify({ id: oldId }),
  );
  const untouched = await applyMahoganyLibraryCleanSlate({
    dataDir,
    appVersion: "1.7.5",
  });
  assert.equal(untouched.applied, false);
  assert.equal((await fs.readdir(projectRoot)).length, 1);

  const first = await applyMahoganyLibraryCleanSlate({
    dataDir,
    appVersion: MAHOGANY_LIBRARY_CLEAN_SLATE_VERSION,
  });
  assert.equal(first.applied, true);
  assert.equal(first.projectCount, 1);
  assert.equal((await fs.readdir(projectRoot)).length, 0);
  assert.equal(
    JSON.parse(
      await fs.readFile(path.join(first.archivePath, oldId, "project.json"), "utf8"),
    ).id,
    oldId,
  );

  await fs.mkdir(path.join(projectRoot, "studio_fedcba654321"));
  const second = await applyMahoganyLibraryCleanSlate({
    dataDir,
    appVersion: MAHOGANY_LIBRARY_CLEAN_SLATE_VERSION,
  });
  assert.equal(second.applied, false);
  assert.equal(second.reason, "already_applied");
  assert.equal((await fs.readdir(projectRoot)).length, 1);
  console.log("Mahogany Jukebox one-time clean library migration passed.");
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
