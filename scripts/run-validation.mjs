import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { validationCommands } from "./validation-plan.mjs";

const options = parseOptions(process.argv.slice(2));
const jobs = boundedJobs(options.jobs);
const startedAt = new Date();
const started = performance.now();
const results = new Array(validationCommands.length);
const scheduledCommands = validationCommands
  .map((step, index) => ({ step, index }))
  .sort((left, right) => right.step.estimatedMs - left.step.estimatedMs || left.index - right.index);
let cursor = 0;
let completed = 0;
let failureSeen = false;

console.log(`Deep Cuts validation: ${validationCommands.length} checks across ${jobs} parallel worker(s).`);

await Promise.all(Array.from({ length: Math.min(jobs, validationCommands.length) }, runWorker));

const durationMs = round(performance.now() - started);
const report = {
  schemaVersion: 1,
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs,
  jobs,
  passed: !failureSeen && results.filter(Boolean).length === validationCommands.length,
  steps: results.filter(Boolean)
};

if (options.profile) {
  const destination = path.resolve(options.profile);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Validation timing profile: ${path.relative(process.cwd(), destination) || destination}`);
}

if (!report.passed) {
  console.error(`Deep Cuts validation failed after ${formatDuration(durationMs)}.`);
  process.exitCode = 1;
} else {
  console.log(`Deep Cuts validation passed in ${formatDuration(durationMs)}.`);
}

async function runWorker() {
  while (!failureSeen && cursor < scheduledCommands.length) {
    const {step,index} = scheduledCommands[cursor++];
    const result = await runStep(step, index);
    results[index] = result;
    completed += 1;
    const status = result.exitCode === 0 ? "PASS" : "FAIL";
    console.log(`[${completed}/${validationCommands.length}] ${status} ${formatDuration(result.durationMs)} — ${step.label}`);
    if (result.stdout) console.log(indent(result.stdout));
    if (result.stderr) console.error(indent(result.stderr));
    if (result.exitCode !== 0) failureSeen = true;
  }
}

function runStep(step, index) {
  return new Promise(resolve => {
    const stepStarted = performance.now();
    const child = spawn(process.execPath, step.args, {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let spawnError = null;
    child.stdout.on("data", chunk => {
      stdout += chunk;
    });
    child.stderr.on("data", chunk => {
      stderr += chunk;
    });
    child.once("error", error => {
      spawnError = error;
    });
    child.once("close", code => {
      resolve({
        index,
        label: step.label,
        command: commandText(step.args),
        durationMs: round(performance.now() - stepStarted),
        exitCode: spawnError ? 1 : Number(code ?? 1),
        stdout: stdout.trim(),
        stderr: [stderr.trim(), spawnError?.message || ""].filter(Boolean).join("\n")
      });
    });
  });
}

function boundedJobs(value) {
  const requested = Number(value || process.env.DEEP_CUTS_VALIDATION_JOBS);
  if (Number.isFinite(requested)) return Math.max(1, Math.min(8, Math.floor(requested)));
  const available = os.availableParallelism?.() || os.cpus().length || 2;
  return Math.max(1, Math.min(6, available + 2));
}

function parseOptions(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    if (!args[index].startsWith("--")) continue;
    const key = args[index].slice(2);
    parsed[key] = args[index + 1] && !args[index + 1].startsWith("--") ? args[++index] : true;
  }
  return parsed;
}

function commandText(args) {
  return ["node", ...args].join(" ");
}

function indent(value) {
  return String(value).split(/\r?\n/).map(line => `  ${line}`).join("\n");
}

function formatDuration(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
