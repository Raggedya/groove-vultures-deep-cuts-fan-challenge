import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildInvitationManifest, invitationTypeCatalog, listInvitationProjects,
  loadInvitationProject, newInvitationProject, normalizeInvitationProject,
  saveInvitationProject, validateInvitationProject,
} from "./invitation-jukebox-model.mjs";
import { INVITATION_CABINET_ASSETS, INVITATION_RENDERER_VERSION, renderInvitationJukeboxPreview } from "./invitation-jukebox-preview.mjs";
import { __test as workerTest } from "../worker/aggits-jukebox-publisher.js";

const types = invitationTypeCatalog();
assert.deepEqual(types.map((type) => type.id), ["wedding", "birthday", "corporate", "seasonal", "group_trip"]);
assert.equal(new Set(types.map((type) => type.cabinetAsset)).size, 5);
for (const type of types) assert.equal(newInvitationProject(type.id).actions.length, 4);

const project = normalizeInvitationProject({
  ...newInvitationProject("birthday"),
  title: "Ruby turns 40", hostNames: "Ruby", tickerText: "Come celebrate",
  event: { date: "2026-10-25", time: "19:30", timezone: "Australia/Sydney", venue: "The Ballroom", address: "123 Collins Street, Melbourne" },
  message: "Dinner, dancing and very good company.",
  video: { kind: "youtube", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", embedStatus: "playable", embedVideoId: "dQw4w9WgXcQ", embedCheckedAt: new Date().toISOString() },
  actions: newInvitationProject("birthday").actions.map((action, index) => ({ ...action, href: index === 3 ? "mailto:rsvp@example.com" : `https://example.com/${index}` })),
});
const readiness = validateInvitationProject(project);
assert.equal(readiness.ready, true, readiness.errors.join(" "));
const manifest = buildInvitationManifest(project);
assert.equal(manifest.product, "invitation_jukebox");
assert.equal(manifest.invitationType, "birthday");
assert.equal(manifest.actions.length, 4);
const accepted = workerTest.validateManifest(manifest);
assert.equal(accepted.ok, true, accepted.error);
const publicConfig = workerTest.buildConfig({ job_id: "ajjob_test", edition_id: "dc_1234567890", slug: "invitation-test", base_url: "https://deep-cuts.example", created_at: new Date().toISOString() }, accepted.value);
assert.equal(publicConfig.editionType, "invitation_jukebox");
assert.equal(publicConfig.invitationJukebox.invitationType, "birthday");
assert.equal(publicConfig.invitationJukebox.copyrightPlaque, "Copyright Clearlight Creative 2026");

const root = await fs.mkdtemp(path.join(os.tmpdir(), "invitation-jukebox-test-"));
try {
  await saveInvitationProject(root, project);
  assert.equal((await loadInvitationProject(root, project.id)).invitationType, "birthday");
  assert.equal((await listInvitationProjects(root, "birthday")).length, 1);
  assert.equal((await listInvitationProjects(root, "wedding")).length, 0);
} finally { await fs.rm(root, { recursive: true, force: true }); }

const html = renderInvitationJukeboxPreview({ ...project, readiness });
assert.ok(html.includes(INVITATION_RENDERER_VERSION));
assert.ok(html.includes(INVITATION_CABINET_ASSETS.birthday));
assert.ok(html.includes("Copyright Clearlight Creative 2026"));
assert.ok(html.includes("Ruby turns 40"));
assert.ok(!html.includes("AGGITS"));

const sourceChecks = await Promise.all([
  fs.readFile(new URL("../mahogany-studio/index.html", import.meta.url), "utf8"),
  fs.readFile(new URL("../scripts/mahogany-jukebox-model.mjs", import.meta.url), "utf8"),
]);
assert.ok(sourceChecks[0].includes("Mahogany Jukebox"));
assert.ok(sourceChecks[1].includes("mahogany-jukebox-project/1"));
console.log("Invitation Jukebox model, libraries, renderer, plaque and legacy isolation passed.");
