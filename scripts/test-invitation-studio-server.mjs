import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInvitationStudioServer } from "./invitation-studio-server.mjs";

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "invitation-studio-server-test-"));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = createInvitationStudioServer({ root, dataDir });
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  const page = await fetch(`${origin}/invitation-studio/`), html = await page.text();
  assert.equal(page.ok, true); assert.ok(html.includes("Invitation libraries"));
  const bootstrap = await fetch(`${origin}/api/invitations/bootstrap`).then((response) => response.json());
  assert.equal(bootstrap.types.length, 5); assert.ok(bootstrap.types.some((type) => type.id === "birthday"));
  const created = await fetch(`${origin}/api/invitations/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ invitationType: "birthday" }) }).then((response) => response.json());
  assert.equal(created.project.invitationType, "birthday");
  const updated = { ...created.project, title: "Ruby turns 40", hostNames: "Ruby", tickerText: "Come celebrate", message: "Dinner and dancing", event: { date: "2026-10-25", time: "19:30", timezone: "Australia/Sydney", venue: "The Ballroom", address: "Melbourne" } };
  const saved = await fetch(`${origin}/api/invitations/projects/${created.project.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(updated) }).then((response) => response.json());
  assert.equal(saved.project.title, "Ruby turns 40");
  const preview = await fetch(`${origin}/api/invitations/projects/${created.project.id}/preview`), previewHtml = await preview.text();
  assert.equal(preview.ok, true); assert.ok(previewHtml.includes("birthday-cabinet.png")); assert.ok(previewHtml.includes("Copyright Clearlight Creative 2026"));
  const library = await fetch(`${origin}/api/invitations/bootstrap?type=birthday`).then((response) => response.json());
  assert.equal(library.projects.length, 1);
  const weddingLibrary = await fetch(`${origin}/api/invitations/bootstrap?type=wedding`).then((response) => response.json());
  assert.equal(weddingLibrary.projects.length, 0);
  console.log("Invitation Studio HTTP workspace, Birthday library, preview and plaque passed.");
} finally {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(dataDir, { recursive: true, force: true });
}
