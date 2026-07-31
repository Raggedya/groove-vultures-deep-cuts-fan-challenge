import assert from "node:assert/strict";
import fs from "node:fs/promises";

await import("../js/interactions.js?external-link-policy-test");

const {
  isExternalDomain,
  secureExternalLink,
  applyExternalLinkPolicy,
} = globalThis.DeepCutsInteractions;

const productionPage = "https://deep-cuts.andrewharris501.workers.dev/e/dc_e22f1cb651";

function anchor(href, text = "Spotify") {
  const attributes = new Map();
  if (href !== undefined) attributes.set("href", href);
  return {
    textContent: text,
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    matches(selector) {
      return selector === "a[href]" && attributes.has("href");
    },
    querySelectorAll() {
      return [];
    },
    attributes,
  };
}

assert.equal(isExternalDomain("https://open.spotify.com/artist/example", productionPage), true);
assert.equal(isExternalDomain("https://deep-cuts.andrewharris501.workers.dev/e/internal", productionPage), false);
assert.equal(isExternalDomain("/e/internal", productionPage), false);
assert.equal(isExternalDomain("#biography", productionPage), false);
assert.equal(isExternalDomain("mailto:band@example.com", productionPage), false);
assert.equal(isExternalDomain("not a valid URL", productionPage), false);

const external = anchor("https://theatlasband.bandcamp.com/", "Bandcamp");
assert.equal(secureExternalLink(external, undefined, productionPage), true);
assert.equal(external.getAttribute("target"), "_blank");
assert.equal(external.getAttribute("rel"), "noopener noreferrer");
assert.equal(external.getAttribute("aria-label"), "Bandcamp (opens in a new tab)");

const labelledExternal = anchor("https://www.instagram.com/theatlasband/", "Instagram");
labelledExternal.setAttribute("aria-label", "Official ATLAS Instagram");
assert.equal(secureExternalLink(labelledExternal, undefined, productionPage), true);
assert.equal(labelledExternal.getAttribute("aria-label"), "Official ATLAS Instagram");

const internal = anchor("/e/dc_e22f1cb651", "JookBox home");
internal.setAttribute("target", "_self");
internal.setAttribute("rel", "author");
assert.equal(secureExternalLink(internal, undefined, productionPage), false);
assert.equal(internal.getAttribute("target"), "_self", "The policy must not rewrite an internal target.");
assert.equal(internal.getAttribute("rel"), "author", "The policy must not rewrite an internal relationship.");

const policyExternal = anchor("https://www.facebook.com/example", "Facebook");
const policyInternal = anchor("/e/dc_e22f1cb651", "Current edition");
const root = {
  matches() {
    return false;
  },
  querySelectorAll() {
    return [policyExternal, policyInternal];
  },
};
assert.equal(applyExternalLinkPolicy(root, productionPage), 1);
assert.equal(policyExternal.getAttribute("target"), "_blank");
assert.equal(policyExternal.getAttribute("rel"), "noopener noreferrer");
assert.equal(policyInternal.getAttribute("target"), null);
assert.equal(policyInternal.getAttribute("rel"), null);

const platform = JSON.parse(await fs.readFile("platform.json", "utf8"));
const jookBoxEditions = [];
for (const entry of platform.editions) {
  const config = JSON.parse(await fs.readFile(entry.config, "utf8"));
  if (config.editionType !== "jukebox") continue;
  jookBoxEditions.push({ entry, config });
}
assert.ok(jookBoxEditions.length >= 2, "The secured policy must cover every completed JookBox edition.");

for (const { entry, config } of jookBoxEditions) {
  const selectionById = new Map((config.jookBox?.selections || []).map((selection) => [selection.id, selection]));
  const destinations = (config.jookBox?.displaySelectionIds || [])
    .map((id) => selectionById.get(id)?.url)
    .filter(Boolean);
  const biographySource = config.jookBox?.biography?.sourceURL;
  if (biographySource) destinations.push(biographySource);
  for (const url of destinations) {
    const link = anchor(url, `${config.bandName} destination`);
    assert.equal(secureExternalLink(link, url, new URL(entry.canonicalPath, productionPage).href), true, `${url} must be detected as external.`);
    assert.equal(link.getAttribute("target"), "_blank", `${url} must preserve the JookBox in its original tab.`);
    assert.equal(link.getAttribute("rel"), "noopener noreferrer", `${url} must isolate the external tab.`);
  }
}

const [app, html] = await Promise.all([
  fs.readFile("js/app.js", "utf8"),
  fs.readFile("index.html", "utf8"),
]);
assert.match(app, /DeepCutsInteractions\.secureExternalLink\(element,safeURL,location\.href\)/);
assert.match(app, /DeepCutsInteractions\.secureExternalLink\(els\.jookBoxBioSource,source,location\.href\)/);
assert.match(app, /DeepCutsInteractions\.applyExternalLinkPolicy\(document,location\.href\)/);
assert.match(html, /interactions\.js\?v=20260731-jookbox-19/);
assert.match(html, /app\.js\?v=20260731-bar-jookbox-3/);
assert.doesNotMatch(html, /id="jookBoxBioSource"[^>]*target="_blank"/, "The biography link must use the same origin-aware helper as every other JookBox link.");

console.log("External-link policy passed: every verified JookBox destination opens securely in a new tab, while internal links remain unchanged.");
