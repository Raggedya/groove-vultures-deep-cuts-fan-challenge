import fs from "node:fs/promises";
import path from "node:path";

export class Network {
  constructor({
    cacheDir = ".deep-cuts/batch-cache",
    timeoutMs = 18000,
    retries = 3,
    minDelayMs = 350,
    fetchImpl = globalThis.fetch
  } = {}) {
    this.cacheDir = cacheDir;
    this.timeoutMs = timeoutMs;
    this.retries = retries;
    this.minDelayMs = minDelayMs;
    this.fetchImpl = fetchImpl;
    this.memory = new Map();
    this.inflight = new Map();
    this.originLastStarted = new Map();
    this.originReservations = new Map();
    this.cacheDirectoryReady = null;
  }

  async inspect(value, { cache = true } = {}) {
    const url = String(value);
    const key = Buffer.from(url).toString("base64url");
    const file = path.join(this.cacheDir, `${key}.json`);
    if (!cache) return this.#requestAndCache(url, file);
    if (this.memory.has(key)) return this.memory.get(key);
    if (this.inflight.has(key)) return this.inflight.get(key);

    const pending = this.#inspectCached(url, key, file);
    this.inflight.set(key, pending);
    try {
      return await pending;
    } finally {
      if (this.inflight.get(key) === pending) this.inflight.delete(key);
    }
  }

  async #inspectCached(url, key, file) {
    try {
      const cached = JSON.parse(await fs.readFile(file, "utf8"));
      this.memory.set(key, cached);
      return cached;
    } catch {
      const result = await this.#requestAndCache(url, file);
      if (result.status !== 0) this.memory.set(key, result);
      return result;
    }
  }

  async #requestAndCache(url, file) {
    let lastError;
    for (let attempt = 1; attempt <= this.retries; attempt += 1) {
      try {
        await this.#reserveOrigin(url);
        const response = await this.fetchImpl(url, {
          redirect: "follow",
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: {
            "user-agent": "Mozilla/5.0 (compatible; DeepCutsVerification/1.0)",
            accept: "text/html,application/xhtml+xml"
          }
        });
        const contentType = response.headers.get("content-type") || "";
        const body = contentType.includes("text") ? (await response.text()).slice(0, 2_000_000) : "";
        const result = {
          ok: response.ok || [401, 403, 429].includes(response.status),
          status: response.status,
          requestedURL: url,
          finalURL: response.url,
          contentType,
          body,
          checkedAt: new Date().toISOString()
        };
        await this.#writeCache(file, result);
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < this.retries) await delay(500 * 2 ** (attempt - 1));
      }
    }
    return {
      ok: false,
      status: 0,
      requestedURL: url,
      finalURL: url,
      body: "",
      error: lastError?.message || "Network request failed",
      checkedAt: new Date().toISOString()
    };
  }

  async #reserveOrigin(value) {
    let origin = "invalid-origin";
    try {
      origin = new URL(value).origin;
    } catch {}
    const previous = this.originReservations.get(origin) || Promise.resolve();
    const reservation = previous.catch(() => {}).then(async () => {
      const lastStarted = this.originLastStarted.get(origin) || 0;
      const wait = Math.max(0, this.minDelayMs - (Date.now() - lastStarted));
      if (wait) await delay(wait);
      this.originLastStarted.set(origin, Date.now());
    });
    this.originReservations.set(origin, reservation);
    await reservation;
    if (this.originReservations.get(origin) === reservation) this.originReservations.delete(origin);
  }

  async #writeCache(file, result) {
    this.cacheDirectoryReady ||= fs.mkdir(this.cacheDir, { recursive: true });
    await this.cacheDirectoryReady;
    await fs.writeFile(file, JSON.stringify(result));
  }
}

export function extractLinks(page, base) {
  const values = [];
  const regex = /\bhref\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(page || ""))) {
    try {
      const url = new URL(match[1].replaceAll("&amp;", "&"), base);
      if (url.protocol === "https:") values.push(url.href);
    } catch {}
  }
  return [...new Set(values)];
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
