import test from "node:test";
import assert from "node:assert/strict";
import catalogue from "../data/archive-catalogue.js";
import { ArchiveService } from "../src/archive-service.js";
import mediaManifest from "../data/media-manifest.js";
import { readFile } from "node:fs/promises";

const required = ["id","title","shortTitle","mediaType","category","sourceArchive","sourcePageUrl","mediaUrl","description","tickerText","licence","approved"];

test("catalogue contains exactly 50 curated approved records", () => {
  assert.equal(catalogue.length, 50);
  assert.equal(catalogue.filter(record => record.approved).length, 50);
  assert.ok(catalogue.filter(record => record.mediaType === "audio").length >= 20);
  assert.ok(catalogue.filter(record => record.mediaType === "video").length >= 20);
});

test("every approved record has provenance, context and a direct HTTPS media URL", () => {
  const ids = new Set();
  for (const record of catalogue) {
    for (const field of required) assert.ok(record[field] !== undefined && record[field] !== "", `${record.id || "record"} missing ${field}`);
    assert.match(record.sourcePageUrl, /^https:\/\//);
    assert.match(record.mediaUrl, /^https:\/\//);
    assert.ok(record.tickerText.length >= 70, `${record.id} ticker is not contextual`);
    assert.ok(!ids.has(record.id), `duplicate id ${record.id}`); ids.add(record.id);
  }
});

test("every curated record has a resolved browser-compatible media route", () => {
  assert.equal(Object.keys(mediaManifest).length, catalogue.length);
  for (const record of catalogue) {
    assert.match(mediaManifest[record.id], /^https:\/\/upload\.wikimedia\.org\//, `${record.id} is not resolved`);
    if (record.mediaType === "audio") assert.match(mediaManifest[record.id], /\.mp3(?:$|\?)/, `${record.id} does not use MP3`);
    if (record.mediaType === "video") assert.match(mediaManifest[record.id], /\.webm(?:$|\?)/, `${record.id} does not use WebM`);
  }
});

test("service filters by category and media type and excludes recent items", () => {
  const service = new ArchiveService(catalogue);
  const audio = service.getRandom({ mediaType:"audio", category:"SPACE" });
  assert.equal(audio.mediaType,"audio"); assert.equal(audio.category,"SPACE");
  const next = service.getRandom({ mediaType:"audio", category:"SPACE", excludeIds:[audio.id] });
  assert.notEqual(next.id,audio.id);
  assert.equal(service.getRandom({ mediaType:"video", category:"NOT REAL" }),null);
});

test("four main keys remain locked in mandatory order", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const order = [...html.matchAll(/data-action="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(order,["video","audio","surprise","category"]);
});

test("copyrighted filler and forbidden generic effects are absent", () => {
  const text = JSON.stringify(catalogue).toLowerCase();
  for (const forbidden of ["boing","whoosh","ringtone","sound-effect pack","stock footage","stock music"]) assert.ok(!text.includes(forbidden));
});
