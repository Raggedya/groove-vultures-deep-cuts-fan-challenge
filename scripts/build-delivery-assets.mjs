import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

const options = parseOptions(process.argv.slice(2));
const python = process.env.DEEP_CUTS_PYTHON || (process.platform === "win32" ? "python" : "python3");
const platform = JSON.parse(await fs.readFile("platform.json", "utf8"));
const activeEditions = platform.editions.filter(edition => edition.active);
const jobs = boundedJobs(options.jobs);
const startedAt = new Date();
const started = performance.now();
const stages = [];

console.log(`Deep Cuts delivery artwork: ${activeEditions.length} active edition(s), ${jobs} render worker(s).`);

if (!options.validated) {
  await timedStage("Full platform validation", () => run(process.execPath, ["scripts/run-validation.mjs"], { inherit: true }));
}
if (!options.dependenciesReady) {
  await timedStage("Python dependency verification", () => run(python, ["scripts/ensure-python-deps.py"], { inherit: true }));
}

const renderStarted = performance.now();
const renderResults = await renderEditions(activeEditions, jobs);
stages.push({
  name: "Parallel artwork rendering",
  durationMs: round(performance.now() - renderStarted),
  editions: renderResults
});

await timedStage("Complete artwork integrity and scan-back verification", () =>
  run(python, ["scripts/verify-delivery-assets.py"], { inherit: true })
);

const report = {
  schemaVersion: 1,
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: round(performance.now() - started),
  jobs,
  editionCount: activeEditions.length,
  stages
};

if (options.profile) {
  const destination = path.resolve(String(options.profile));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Artwork timing profile: ${path.relative(process.cwd(), destination) || destination}`);
}

console.log(`All ${activeEditions.length} scan-tested delivery packages completed in ${formatDuration(report.durationMs)}.`);

async function renderEditions(editions, workerCount) {
  const results = new Array(editions.length);
  let cursor = 0;
  let completed = 0;
  let failure = null;
  await Promise.all(Array.from({ length: Math.min(workerCount, editions.length) }, async () => {
    while (!failure && cursor < editions.length) {
      const index = cursor++;
      const edition = editions[index];
      const editionStarted = performance.now();
      try {
        await run(python, ["scripts/generate-social-assets.py", edition.slug]);
        const result = {
          slug: edition.slug,
          durationMs: round(performance.now() - editionStarted),
          ok: true
        };
        results[index] = result;
        completed += 1;
        console.log(`[${completed}/${editions.length}] PASS ${formatDuration(result.durationMs)} — ${edition.slug}`);
      } catch (error) {
        failure = new Error(`${edition.slug}: ${error.message}`);
        results[index] = {
          slug: edition.slug,
          durationMs: round(performance.now() - editionStarted),
          ok: false,
          error: error.message
        };
      }
    }
  }));
  if (failure) throw failure;
  return results;
}

async function timedStage(name, work) {
  const stageStarted = performance.now();
  await work();
  const durationMs = round(performance.now() - stageStarted);
  stages.push({ name, durationMs });
  console.log(`PASS ${formatDuration(durationMs)} — ${name}`);
}

function run(executable, args, { inherit = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      env: { ...process.env, DEEP_CUTS_NODE: process.execPath },
      shell: false,
      stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    if (!inherit) {
      child.stdout.on("data", chunk => {
        stdout += chunk;
      });
      child.stderr.on("data", chunk => {
        stderr += chunk;
      });
    }
    child.once("error", reject);
    child.once("close", code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || stdout.trim() || `${executable} exited with ${code}`));
    });
  });
}

function boundedJobs(value) {
  const requested = Number(value || process.env.DEEP_CUTS_ARTWORK_JOBS);
  if (Number.isFinite(requested)) return Math.max(1, Math.min(4, Math.floor(requested)));
  return Math.max(1, Math.min(2, os.availableParallelism?.() || os.cpus().length || 2));
}

function parseOptions(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    if (!args[index].startsWith("--")) continue;
    const raw = args[index].slice(2);
    const key = raw.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    parsed[key] = args[index + 1] && !args[index + 1].startsWith("--") ? args[++index] : true;
  }
  return parsed;
}

function formatDuration(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
