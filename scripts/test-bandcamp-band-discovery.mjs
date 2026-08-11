import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  addBandcampDiscoveriesToLibrary,
  BANDCAMP_LINK_ORDER,
  projectFromBandcampDiscovery,
  runBandcampDiscoveryBatch,
  __test,
} from "./bandcamp-band-discovery.mjs";
import {
  listMahoganyProjects,
  removeMahoganyVuMedia,
  storeMahoganyVuMusic,
} from "./mahogany-jukebox-model.mjs";
import { createMahoganyStudioServer } from "./mahogany-studio-server.mjs";

const now = new Date().toISOString();
function confirmed(url) {
  return { url, status: "confirmed", reason: "Fixture confirmation." };
}
function fixtureResult(index, score = 4) {
  const slug = `melbourne-band-${String(index).padStart(2, "0")}`,
    spotifyId = String(index).padStart(22, "0");
  const links = {
    bandcamp: confirmed(`https://${slug}.bandcamp.com/`),
    store: confirmed(`https://${slug}.bandcamp.com/merch`),
    facebook: confirmed(`https://www.facebook.com/${slug}`),
    spotify: confirmed(`https://open.spotify.com/artist/${spotifyId}`),
  };
  for (const kind of BANDCAMP_LINK_ORDER.slice(score))
    links[kind] = { url: "", status: "not_found", reason: "Not found." };
  return {
    id: `band_${String(index).padStart(12, "0")}`,
    bandId: `bc_${String(index).padStart(16, "0")}`,
    bandName: `Melbourne Band ${String(index).padStart(2, "0")}`,
    location: "Melbourne, Australia",
    links,
    linkScore: score,
    status: score === 4 ? "COMPLETE" : score === 3 ? "GOOD" : score === 2 ? "PARTIAL" : "BANDCAMP ONLY",
    dateDiscovered: now,
    discoverySource: "Bandcamp",
  };
}

const fakeDiscovery = {
  async discoverSeeds() {
    return Array.from({ length: 20 }, (_, index) => ({
      url: `https://melbourne-band-${String(index + 1).padStart(2, "0")}.bandcamp.com/album/test-release`,
      title: `Test Release | Melbourne Band ${String(index + 1).padStart(2, "0")}`,
      description: "Melbourne independent band",
    }));
  },
  async inspect(url) {
    if (url.endsWith("/merch"))
      return { ok: true, finalURL: url, title: "Merch", body: '<div class="merch-item"></div>' };
    const slug = new URL(url).hostname.split(".")[0],
      name = slug
        .split("-")
        .map((word) => word.replace(/^./, (letter) => letter.toUpperCase()))
        .join(" ");
    return {
      ok: true,
      finalURL: url,
      title: `Test Release | ${name}`,
      body: `{"artist":"${name}","location":"Melbourne, Australia"}<a href="https://${slug}.bandcamp.com/merch">Merch</a>`,
    };
  },
  async findPlatform({ kind, bandName }) {
    const slug = bandName.toLowerCase().replaceAll(" ", "-");
    return kind === "facebook"
      ? confirmed(`https://www.facebook.com/${slug}`)
      : confirmed(`https://open.spotify.com/artist/${slug.replaceAll("-", "").padEnd(22, "0").slice(0, 22)}`);
  },
};

const discovered = await runBandcampDiscoveryBatch({
  location: "Melbourne, Australia",
  discovery: fakeDiscovery,
});
assert.equal(discovered.found, 20);
assert.equal(discovered.results.every((band) => band.linkScore === 4), true);
assert.equal(discovered.results.every((band) => band.status === "COMPLETE"), true);
assert.equal(discovered.results.every((band) => band.links.bandcamp.status === "confirmed"), true);
assert.equal(discovered.results.every((band) => band.links.store.url.endsWith("/merch")), true);

assert.equal(__test.cleanBandcampURL("https://realband.bandcamp.com/album/one"), "https://realband.bandcamp.com/album/one");
assert.equal(__test.cleanBandcampURL("https://daily.bandcamp.com/story"), "");
assert.equal(__test.directPlatformURL("spotify", "https://open.spotify.com/artist/1234567890123456789012?si=x"), "https://open.spotify.com/artist/1234567890123456789012");
assert.equal(__test.directPlatformURL("facebook", "https://www.facebook.com/realband/"), "https://www.facebook.com/realband");
assert.equal(__test.scoreStatus(3), "GOOD");
assert.equal(__test.sameArtistIdentity("King Gizzard & The Lizard Wizard with Mild High Club", "King Gizzard & The Lizard Wizard"), true);
assert.equal(__test.sameArtistIdentity("Jock Cheese", "TISM"), false);

const partial = fixtureResult(91, 2),
  partialProject = projectFromBandcampDiscovery(partial);
assert.equal(partialProject.appearance, "mahogany-vu");
assert.deepEqual(partialProject.actions.map((action) => action.label), [
  "Bandcamp",
  "Store",
  "Facebook",
  "Spotify",
]);
assert.equal(partialProject.actions[2].href, "");
assert.equal(partialProject.actions[3].href, "");
assert.equal(partialProject.candidate.discoverySource, "Bandcamp");
assert.equal(partialProject.candidate.audioStatus, "Not Added");
assert.equal(partialProject.candidate.purchaseStatus, "Not Purchased");

const root = await fs.mkdtemp(path.join(os.tmpdir(), "bandcamp-discovery-test-"));
try {
  const projectRoot = path.join(root, "projects");
  let outcome = await addBandcampDiscoveriesToLibrary({
    projectRoot,
    discoveries: discovered.results,
    selectedIds: [discovered.results[0].id],
  });
  assert.equal(outcome.added.length, 1);
  let projects = await listMahoganyProjects(projectRoot);
  assert.equal(projects.length, 1);

  outcome = await addBandcampDiscoveriesToLibrary({
    projectRoot,
    discoveries: discovered.results,
    selectedIds: [discovered.results[0].id],
    existingProjects: projects,
  });
  assert.equal(outcome.added.length, 0);
  assert.equal(outcome.duplicates.length, 1);

  outcome = await addBandcampDiscoveriesToLibrary({
    projectRoot,
    discoveries: discovered.results,
    selectedIds: discovered.results.slice(1, 4).map((band) => band.id),
    existingProjects: projects,
  });
  assert.equal(outcome.added.length, 3);
  projects = await listMahoganyProjects(projectRoot);
  assert.equal(projects.length, 4);

  const mp3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0]);
  let withAudio = await storeMahoganyVuMusic(
    projectRoot,
    projects[0],
    mp3,
    "purchased-track.mp3",
  );
  assert.equal(withAudio.candidate.audioStatus, "Added");
  assert.equal(withAudio.candidate.audioFile, "purchased-track.mp3");
  withAudio = await removeMahoganyVuMedia(projectRoot, withAudio, "music");
  assert.equal(withAudio.candidate.audioStatus, "Not Added");

  const apiRoot = path.join(root, "api");
  const server = createMahoganyStudioServer({
    root: process.cwd(),
    dataDir: apiRoot,
    bandDiscoveryRunner: async ({ onProgress }) => {
      onProgress({ stage: "ready", message: "20 bands ready", found: 20, requested: 20, reviewed: 20 });
      return { ...discovered, results: Array.from({ length: 20 }, (_, index) => fixtureResult(index + 101)) };
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    let response = await fetch(`${origin}/api/mahogany/band-discovery`, {
      method: "POST",
      body: JSON.stringify({ location: "Melbourne, Australia" }),
    }).then((item) => item.json());
    const jobId = response.job.id;
    for (let attempt = 0; attempt < 30 && response.job.status === "running"; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      response = await fetch(`${origin}/api/mahogany/band-discovery/${jobId}`).then((item) => item.json());
    }
    assert.equal(response.job.result.results.length, 20);
    const firstId = response.job.result.results[0].id;
    response = await fetch(`${origin}/api/mahogany/band-discovery/${jobId}/to-library`, {
      method: "POST",
      body: JSON.stringify({ ids: [firstId] }),
    }).then((item) => item.json());
    assert.equal(response.added.length, 1);
    assert.equal(response.job.result.results[0].libraryStatus, "added");
    response = await fetch(`${origin}/api/mahogany/band-discovery/${jobId}/to-library`, {
      method: "POST",
      body: JSON.stringify({ ids: [firstId] }),
    }).then((item) => item.json());
    assert.equal(response.duplicates.length, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

const studioHtml = await fs.readFile("mahogany-studio/index.html", "utf8"),
  studioApp = await fs.readFile("mahogany-studio/app.js", "utf8");
assert.match(studioHtml, /Find Bands/);
assert.match(studioHtml, /FIND &amp; ADD 20 BANDS/);
assert.match(studioHtml, /<th>Store<\/th>/);
assert.match(studioApp, /Already in Library/);
assert.match(studioApp, /Buy \/ Get Track/);
assert.match(studioHtml, /Add selected to library/i);

console.log("Bandcamp-first discovery tests passed: 20 results, partial-link retention, store/FB/Spotify status, individual and bulk library adds, duplicate protection, MP3 attachment and four-button mapping are intact.");
