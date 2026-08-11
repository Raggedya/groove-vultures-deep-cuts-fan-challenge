import fs from "node:fs/promises";
import path from "node:path";

export const MAHOGANY_LIBRARY_CLEAN_SLATE_VERSION = "1.7.6";

export async function applyMahoganyLibraryCleanSlate({
  dataDir,
  appVersion,
  enabled = true,
} = {}) {
  const root = path.resolve(String(dataDir || ""));
  if (!enabled || appVersion !== MAHOGANY_LIBRARY_CLEAN_SLATE_VERSION)
    return { applied: false, reason: "not_target_version" };
  if (!String(dataDir || "").trim())
    throw new Error("The Mahogany Jukebox data directory is required.");
  const migrationRoot = path.join(root, "migrations"),
    marker = path.join(
      migrationRoot,
      `library-clean-slate-${MAHOGANY_LIBRARY_CLEAN_SLATE_VERSION}.json`,
    );
  try {
    const existing = JSON.parse(await fs.readFile(marker, "utf8"));
    return { applied: false, reason: "already_applied", ...existing };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const projectRoot = path.join(root, "projects"),
    entries = await fs
      .readdir(projectRoot, { withFileTypes: true })
      .catch((error) => (error.code === "ENOENT" ? [] : Promise.reject(error))),
    projectCount = entries.filter(
      (entry) => entry.isDirectory() && /^studio_[a-f0-9]{12}$/.test(entry.name),
    ).length;
  let archivePath = "";
  if (entries.length) {
    const archiveRoot = path.join(root, "archive", "clean-slate"),
      stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.mkdir(archiveRoot, { recursive: true });
    archivePath = path.join(
      archiveRoot,
      `before-${MAHOGANY_LIBRARY_CLEAN_SLATE_VERSION}-${stamp}`,
    );
    await fs.rename(projectRoot, archivePath);
  }
  await fs.mkdir(projectRoot, { recursive: true });
  await fs.mkdir(migrationRoot, { recursive: true });
  const record = {
      version: MAHOGANY_LIBRARY_CLEAN_SLATE_VERSION,
      appliedAt: new Date().toISOString(),
      projectCount,
      archivePath,
    },
    temporary = `${marker}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await fs.rename(temporary, marker);
  return { applied: true, ...record };
}
