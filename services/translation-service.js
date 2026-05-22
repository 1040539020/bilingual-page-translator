const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_CACHE_ENTRIES = 1000;
const DEFAULT_MAX_CONCURRENT = 5;
const DEFAULT_DEBOUNCE_MS = 50;
const DEFAULT_MAX_RETRIES = 3;
const STORAGE_CACHE_KEY = "translationCache";

class TranslationService {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.options = options;
    this.endpoint = options.endpoint || "";
  }

  async translate() {
    throw new Error(`${this.getServiceName()} must implement translate().`);
  }

  getServiceName() {
    return "base";
  }

  async healthCheck() {
    if (!this.endpoint) {
      return { ok: true, service: this.getServiceName(), status: "not_configured" };
    }

    try {
      const response = await fetch(this.endpoint, {
        method: "HEAD",
        credentials: "omit",
        referrerPolicy: "no-referrer"
      });

      return {
        ok: response.ok,
        service: this.getServiceName(),
        status: response.status
      };
    } catch (error) {
      return {
        ok: false,
        service: this.getServiceName(),
        error: getErrorMessage(error)
      };
    }
  }

  assertApiKey() {
    if (!this.apiKey) {
      throw new Error(`${this.getServiceName()} API key is missing.`);
    }
  }
}

class GoogleTranslateService extends TranslationService {
  constructor(apiKey, options = {}) {
    super(apiKey, {
      endpoint: "https://translation.googleapis.com/language/translate/v2",
      ...options
    });
  }

  getServiceName() {
    return "google";
  }

  async translate(text, sourceLang, targetLang) {
    this.assertApiKey();
    const url = new URL(this.endpoint);
    url.searchParams.set("key", this.apiKey);

    const body = {
      q: text,
      target: targetLang,
      format: "text"
    };

    if (sourceLang && sourceLang !== "auto") {
      body.source = sourceLang;
    }

    const data = await postJson(url.toString(), body);
    const translatedText = data?.data?.translations?.[0]?.translatedText;
    if (typeof translatedText !== "string") {
      throw new Error("Google Translate returned an invalid response.");
    }

    return translatedText;
  }
}

class DeepLService extends TranslationService {
  constructor(apiKey, options = {}) {
    super(apiKey, {
      endpoint: "https://api-free.deepl.com/v2/translate",
      ...options
    });
  }

  getServiceName() {
    return "deepl";
  }

  async translate(text, sourceLang, targetLang) {
    this.assertApiKey();
    const body = new URLSearchParams();
    body.set("text", text);
    body.set("target_lang", targetLang.toUpperCase());

    if (sourceLang && sourceLang !== "auto") {
      body.set("source_lang", sourceLang.toUpperCase());
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `DeepL-Auth-Key ${this.apiKey}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body,
      credentials: "omit",
      referrerPolicy: "no-referrer"
    });

    const data = await parseJsonResponse(response, "DeepL request failed");
    const translatedText = data?.translations?.[0]?.text;
    if (typeof translatedText !== "string") {
      throw new Error("DeepL returned an invalid response.");
    }

    return translatedText;
  }
}

class OpenAIService extends TranslationService {
  constructor(apiKey, options = {}) {
    super(apiKey, {
      endpoint: "https://api.openai.com/v1/responses",
      model: "gpt-4.1-mini",
      ...options
    });
  }

  getServiceName() {
    return "openai";
  }

  async translate(text, sourceLang, targetLang) {
    this.assertApiKey();
    const data = await postJson(
      this.endpoint,
      {
        model: this.options.model,
        input: [
          {
            role: "system",
            content:
              "Translate the user text only. Preserve meaning, tone, punctuation, and inline formatting. Return only the translation."
          },
          {
            role: "user",
            content: `Source language: ${sourceLang || "auto"}\nTarget language: ${targetLang}\n\n${text}`
          }
        ]
      },
      {
        authorization: `Bearer ${this.apiKey}`
      }
    );

    const translatedText = extractOpenAIText(data);
    if (!translatedText) {
      throw new Error("OpenAI returned an invalid response.");
    }

    return translatedText;
  }
}

class DeepSeekService extends TranslationService {
  constructor(apiKey, options = {}) {
    super(apiKey, {
      endpoint: "https://api.deepseek.com/chat/completions",
      model: "deepseek-chat",
      ...options
    });
  }

  getServiceName() {
    return "deepseek";
  }

  async translate(text, sourceLang, targetLang) {
    this.assertApiKey();
    const data = await postJson(
      this.endpoint,
      {
        model: this.options.model,
        messages: [
          {
            role: "system",
            content:
              "Translate the user text only. Preserve meaning, tone, punctuation, and inline formatting. Return only the translation."
          },
          {
            role: "user",
            content: `Source language: ${sourceLang || "auto"}\nTarget language: ${targetLang}\n\n${text}`
          }
        ],
        temperature: 0.2
      },
      {
        authorization: `Bearer ${this.apiKey}`
      }
    );

    const translatedText = data?.choices?.[0]?.message?.content;
    if (typeof translatedText !== "string" || !translatedText.trim()) {
      throw new Error("DeepSeek returned an invalid response.");
    }

    return translatedText.trim();
  }
}

class BaiduTranslateService extends TranslationService {
  constructor(apiKey, options = {}) {
    super(apiKey, {
      endpoint: "https://fanyi-api.baidu.com/api/trans/vip/translate",
      appId: options.appId || "",
      secretKey: options.secretKey || apiKey,
      ...options
    });
  }

  getServiceName() {
    return "baidu";
  }

  async translate(text, sourceLang, targetLang) {
    const appId = this.options.appId;
    const secretKey = this.options.secretKey || this.apiKey;
    if (!appId || !secretKey) {
      throw new Error("Baidu Translate appId and secretKey are required.");
    }

    const salt = `${Date.now()}`;
    const sign = md5(`${appId}${text}${salt}${secretKey}`);
    const body = new URLSearchParams();
    body.set("q", text);
    body.set("from", sourceLang && sourceLang !== "auto" ? sourceLang : "auto");
    body.set("to", targetLang);
    body.set("appid", appId);
    body.set("salt", salt);
    body.set("sign", sign);

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body,
      credentials: "omit",
      referrerPolicy: "no-referrer"
    });

    const data = await parseJsonResponse(response, "Baidu Translate request failed");
    const translatedText = data?.trans_result?.[0]?.dst;
    if (typeof translatedText !== "string") {
      throw new Error(data?.error_msg || "Baidu Translate returned an invalid response.");
    }

    return translatedText;
  }
}

class TranslationCache {
  constructor(options = {}) {
    this.maxEntries = options.maxEntries || DEFAULT_MAX_CACHE_ENTRIES;
    this.ttlMs = options.ttlMs || DEFAULT_TTL_MS;
    this.storage = options.storage || getChromeLocalStorage();
    this.memory = new Map();
    this.storageKey = options.storageKey || STORAGE_CACHE_KEY;
    this.loaded = false;
  }

  async load() {
    if (this.loaded || !this.storage) {
      this.loaded = true;
      return;
    }

    const stored = await storageGet(this.storage, this.storageKey);
    const entries = stored?.[this.storageKey] || {};
    const now = Date.now();

    Object.entries(entries).forEach(([key, value]) => {
      if (isFreshEntry(value, now, this.ttlMs)) {
        this.memory.set(key, value);
      }
    });

    this.prune();
    this.loaded = true;
  }

  async get(key) {
    await this.load();
    const entry = this.memory.get(key);
    if (!entry) {
      return undefined;
    }

    if (!isFreshEntry(entry, Date.now(), this.ttlMs)) {
      this.memory.delete(key);
      await this.persist();
      return undefined;
    }

    this.memory.delete(key);
    this.memory.set(key, entry);
    return entry.value;
  }

  async set(key, value) {
    await this.load();
    this.memory.set(key, {
      value,
      createdAt: Date.now()
    });
    this.prune();
    await this.persist();
  }

  async clear() {
    this.memory.clear();
    if (this.storage) {
      await storageSet(this.storage, { [this.storageKey]: {} });
    }
  }

  prune() {
    while (this.memory.size > this.maxEntries) {
      const oldestKey = this.memory.keys().next().value;
      this.memory.delete(oldestKey);
    }
  }

  async persist() {
    if (!this.storage) {
      return;
    }

    await storageSet(this.storage, {
      [this.storageKey]: Object.fromEntries(this.memory)
    });
  }
}

class TranslationEngine {
  constructor(services, options = {}) {
    if (!Array.isArray(services) || services.length === 0) {
      throw new Error("At least one translation service is required.");
    }

    this.services = services;
    this.maxConcurrent = options.maxConcurrent || DEFAULT_MAX_CONCURRENT;
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = options.retryBaseDelayMs || 250;
    this.logger = options.logger || console;
    this.cache =
      options.cache ||
      new TranslationCache({
        ttlMs: options.cacheTtlMs || DEFAULT_TTL_MS,
        maxEntries: options.maxCacheEntries || DEFAULT_MAX_CACHE_ENTRIES,
        storage: options.storage
      });

    this.activeCount = 0;
    this.queue = [];
    this.inFlight = new Map();
    this.debounceTimers = new Map();
  }

  async translate(text, sourceLang, targetLang, options = {}) {
    const service = options.service || this.services[0];
    const cacheKey = buildCacheKey(text, sourceLang, targetLang, service.getServiceName());
    const cached = await this.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const requestKey = `${cacheKey}:fallback:${options.allowFallback !== false}`;
    if (this.inFlight.has(requestKey)) {
      return this.inFlight.get(requestKey);
    }

    const promise = this.enqueueDebounced(requestKey, async () => {
      const translatedText = await this.translateWithFallback(text, sourceLang, targetLang, service, options);
      await this.cache.set(cacheKey, translatedText);
      return translatedText;
    }).finally(() => {
      this.inFlight.delete(requestKey);
    });

    this.inFlight.set(requestKey, promise);
    return promise;
  }

  async healthCheck() {
    const results = [];
    for (const service of this.services) {
      results.push(await service.healthCheck());
    }
    return results;
  }

  enqueueDebounced(key, task) {
    return new Promise((resolve, reject) => {
      const schedule = () => {
        this.queue.push({ task, resolve, reject });
        this.runNext();
      };

      if (this.debounceMs <= 0) {
        schedule();
        return;
      }

      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key));
      }

      const timer = setTimeout(() => {
        this.debounceTimers.delete(key);
        schedule();
      }, this.debounceMs);

      this.debounceTimers.set(key, timer);
    });
  }

  runNext() {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift();
      this.activeCount += 1;
      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
        .finally(() => {
          this.activeCount -= 1;
          this.runNext();
        });
    }
  }

  async translateWithFallback(text, sourceLang, targetLang, primaryService, options) {
    const services = [primaryService];
    if (options.allowFallback !== false) {
      services.push(...this.services.filter((service) => service !== primaryService));
    }

    const errors = [];
    for (const service of services) {
      try {
        return await this.retry(() => service.translate(text, sourceLang, targetLang), service);
      } catch (error) {
        const message = getErrorMessage(error);
        errors.push(`${service.getServiceName()}: ${message}`);
        this.logger.warn?.("Translation service failed", {
          service: service.getServiceName(),
          error: message
        });
      }
    }

    throw new Error(`All translation services failed. ${errors.join(" | ")}`);
  }

  async retry(task, service) {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await task();
      } catch (error) {
        lastError = error;
        if (attempt === this.maxRetries) {
          break;
        }

        const delayMs = this.retryBaseDelayMs * 2 ** attempt;
        this.logger.debug?.("Retrying translation request", {
          service: service.getServiceName(),
          attempt: attempt + 1,
          delayMs,
          error: getErrorMessage(error)
        });
        await delay(delayMs);
      }
    }

    throw lastError;
  }
}

async function getStoredApiKeys(storage = getChromeLocalStorage()) {
  if (!storage) {
    return {};
  }

  const stored = await storageGet(storage, "translationApiKeys");
  return stored?.translationApiKeys || {};
}

async function saveStoredApiKeys(apiKeys, storage = getChromeLocalStorage()) {
  if (!storage) {
    throw new Error("chrome.storage.local is not available.");
  }

  await storageSet(storage, { translationApiKeys: { ...apiKeys } });
}

function buildCacheKey(text, sourceLang, targetLang, serviceName) {
  return md5(`${text}${sourceLang}${targetLang}${serviceName}`);
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(body),
    credentials: "omit",
    referrerPolicy: "no-referrer"
  });

  return parseJsonResponse(response, "Translation request failed");
}

async function parseJsonResponse(response, message) {
  let data = {};
  try {
    data = await response.json();
  } catch (_error) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(`${message} with status ${response.status}.`);
  }

  return data;
}

function extractOpenAIText(data) {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  const content = data?.output?.flatMap((item) => item.content || []) || [];
  const textItem = content.find((item) => typeof item.text === "string");
  return textItem?.text || "";
}

function isFreshEntry(entry, now, ttlMs) {
  return entry && typeof entry.createdAt === "number" && now - entry.createdAt < ttlMs;
}

function getChromeLocalStorage() {
  return globalThis.chrome?.storage?.local;
}

function storageGet(storage, key) {
  return new Promise((resolve, reject) => {
    try {
      const result = storage.get(key);
      if (result && typeof result.then === "function") {
        result.then(resolve, reject);
        return;
      }

      storage.get(key, resolve);
    } catch (error) {
      reject(error);
    }
  });
}

function storageSet(storage, value) {
  return new Promise((resolve, reject) => {
    try {
      const result = storage.set(value);
      if (result && typeof result.then === "function") {
        result.then(resolve, reject);
        return;
      }

      storage.set(value, resolve);
    } catch (error) {
      reject(error);
    }
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function md5(input) {
  function rotateLeft(value, shift) {
    return (value << shift) | (value >>> (32 - shift));
  }

  function addUnsigned(x, y) {
    const x4 = x & 0x40000000;
    const y4 = y & 0x40000000;
    const x8 = x & 0x80000000;
    const y8 = y & 0x80000000;
    const result = (x & 0x3fffffff) + (y & 0x3fffffff);

    if (x4 & y4) {
      return result ^ 0x80000000 ^ x8 ^ y8;
    }

    if (x4 | y4) {
      if (result & 0x40000000) {
        return result ^ 0xc0000000 ^ x8 ^ y8;
      }
      return result ^ 0x40000000 ^ x8 ^ y8;
    }

    return result ^ x8 ^ y8;
  }

  function f(x, y, z) {
    return (x & y) | (~x & z);
  }

  function g(x, y, z) {
    return (x & z) | (y & ~z);
  }

  function h(x, y, z) {
    return x ^ y ^ z;
  }

  function i(x, y, z) {
    return y ^ (x | ~z);
  }

  function transform(fn, a, b, c, d, x, s, ac) {
    return addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, fn(b, c, d)), addUnsigned(x, ac)), s), b);
  }

  function utf8Encode(value) {
    return unescape(encodeURIComponent(value));
  }

  function toWordArray(value) {
    const messageLength = value.length;
    const numberOfWords = (((messageLength + 8) >>> 6) + 1) * 16;
    const words = new Array(numberOfWords).fill(0);

    for (let index = 0; index < messageLength; index += 1) {
      words[index >> 2] |= value.charCodeAt(index) << ((index % 4) * 8);
    }

    words[messageLength >> 2] |= 0x80 << ((messageLength % 4) * 8);
    words[numberOfWords - 2] = messageLength << 3;
    words[numberOfWords - 1] = messageLength >>> 29;

    return words;
  }

  function wordToHex(value) {
    let output = "";
    for (let count = 0; count <= 3; count += 1) {
      const byte = (value >>> (count * 8)) & 255;
      output += `0${byte.toString(16)}`.slice(-2);
    }
    return output;
  }

  const x = toWordArray(utf8Encode(input));
  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let k = 0; k < x.length; k += 16) {
    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;

    a = transform(f, a, b, c, d, x[k + 0], 7, 0xd76aa478);
    d = transform(f, d, a, b, c, x[k + 1], 12, 0xe8c7b756);
    c = transform(f, c, d, a, b, x[k + 2], 17, 0x242070db);
    b = transform(f, b, c, d, a, x[k + 3], 22, 0xc1bdceee);
    a = transform(f, a, b, c, d, x[k + 4], 7, 0xf57c0faf);
    d = transform(f, d, a, b, c, x[k + 5], 12, 0x4787c62a);
    c = transform(f, c, d, a, b, x[k + 6], 17, 0xa8304613);
    b = transform(f, b, c, d, a, x[k + 7], 22, 0xfd469501);
    a = transform(f, a, b, c, d, x[k + 8], 7, 0x698098d8);
    d = transform(f, d, a, b, c, x[k + 9], 12, 0x8b44f7af);
    c = transform(f, c, d, a, b, x[k + 10], 17, 0xffff5bb1);
    b = transform(f, b, c, d, a, x[k + 11], 22, 0x895cd7be);
    a = transform(f, a, b, c, d, x[k + 12], 7, 0x6b901122);
    d = transform(f, d, a, b, c, x[k + 13], 12, 0xfd987193);
    c = transform(f, c, d, a, b, x[k + 14], 17, 0xa679438e);
    b = transform(f, b, c, d, a, x[k + 15], 22, 0x49b40821);

    a = transform(g, a, b, c, d, x[k + 1], 5, 0xf61e2562);
    d = transform(g, d, a, b, c, x[k + 6], 9, 0xc040b340);
    c = transform(g, c, d, a, b, x[k + 11], 14, 0x265e5a51);
    b = transform(g, b, c, d, a, x[k + 0], 20, 0xe9b6c7aa);
    a = transform(g, a, b, c, d, x[k + 5], 5, 0xd62f105d);
    d = transform(g, d, a, b, c, x[k + 10], 9, 0x02441453);
    c = transform(g, c, d, a, b, x[k + 15], 14, 0xd8a1e681);
    b = transform(g, b, c, d, a, x[k + 4], 20, 0xe7d3fbc8);
    a = transform(g, a, b, c, d, x[k + 9], 5, 0x21e1cde6);
    d = transform(g, d, a, b, c, x[k + 14], 9, 0xc33707d6);
    c = transform(g, c, d, a, b, x[k + 3], 14, 0xf4d50d87);
    b = transform(g, b, c, d, a, x[k + 8], 20, 0x455a14ed);
    a = transform(g, a, b, c, d, x[k + 13], 5, 0xa9e3e905);
    d = transform(g, d, a, b, c, x[k + 2], 9, 0xfcefa3f8);
    c = transform(g, c, d, a, b, x[k + 7], 14, 0x676f02d9);
    b = transform(g, b, c, d, a, x[k + 12], 20, 0x8d2a4c8a);

    a = transform(h, a, b, c, d, x[k + 5], 4, 0xfffa3942);
    d = transform(h, d, a, b, c, x[k + 8], 11, 0x8771f681);
    c = transform(h, c, d, a, b, x[k + 11], 16, 0x6d9d6122);
    b = transform(h, b, c, d, a, x[k + 14], 23, 0xfde5380c);
    a = transform(h, a, b, c, d, x[k + 1], 4, 0xa4beea44);
    d = transform(h, d, a, b, c, x[k + 4], 11, 0x4bdecfa9);
    c = transform(h, c, d, a, b, x[k + 7], 16, 0xf6bb4b60);
    b = transform(h, b, c, d, a, x[k + 10], 23, 0xbebfbc70);
    a = transform(h, a, b, c, d, x[k + 13], 4, 0x289b7ec6);
    d = transform(h, d, a, b, c, x[k + 0], 11, 0xeaa127fa);
    c = transform(h, c, d, a, b, x[k + 3], 16, 0xd4ef3085);
    b = transform(h, b, c, d, a, x[k + 6], 23, 0x04881d05);
    a = transform(h, a, b, c, d, x[k + 9], 4, 0xd9d4d039);
    d = transform(h, d, a, b, c, x[k + 12], 11, 0xe6db99e5);
    c = transform(h, c, d, a, b, x[k + 15], 16, 0x1fa27cf8);
    b = transform(h, b, c, d, a, x[k + 2], 23, 0xc4ac5665);

    a = transform(i, a, b, c, d, x[k + 0], 6, 0xf4292244);
    d = transform(i, d, a, b, c, x[k + 7], 10, 0x432aff97);
    c = transform(i, c, d, a, b, x[k + 14], 15, 0xab9423a7);
    b = transform(i, b, c, d, a, x[k + 5], 21, 0xfc93a039);
    a = transform(i, a, b, c, d, x[k + 12], 6, 0x655b59c3);
    d = transform(i, d, a, b, c, x[k + 3], 10, 0x8f0ccc92);
    c = transform(i, c, d, a, b, x[k + 10], 15, 0xffeff47d);
    b = transform(i, b, c, d, a, x[k + 1], 21, 0x85845dd1);
    a = transform(i, a, b, c, d, x[k + 8], 6, 0x6fa87e4f);
    d = transform(i, d, a, b, c, x[k + 15], 10, 0xfe2ce6e0);
    c = transform(i, c, d, a, b, x[k + 6], 15, 0xa3014314);
    b = transform(i, b, c, d, a, x[k + 13], 21, 0x4e0811a1);
    a = transform(i, a, b, c, d, x[k + 4], 6, 0xf7537e82);
    d = transform(i, d, a, b, c, x[k + 11], 10, 0xbd3af235);
    c = transform(i, c, d, a, b, x[k + 2], 15, 0x2ad7d2bb);
    b = transform(i, b, c, d, a, x[k + 9], 21, 0xeb86d391);

    a = addUnsigned(a, aa);
    b = addUnsigned(b, bb);
    c = addUnsigned(c, cc);
    d = addUnsigned(d, dd);
  }

  return `${wordToHex(a)}${wordToHex(b)}${wordToHex(c)}${wordToHex(d)}`.toLowerCase();
}

module.exports = {
  TranslationService,
  GoogleTranslateService,
  DeepLService,
  OpenAIService,
  DeepSeekService,
  BaiduTranslateService,
  TranslationCache,
  TranslationEngine,
  buildCacheKey,
  getStoredApiKeys,
  saveStoredApiKeys,
  md5
};
