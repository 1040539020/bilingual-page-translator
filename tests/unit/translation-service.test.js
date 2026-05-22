const {
  TranslationEngine,
  TranslationService,
  TranslationCache,
  DeepSeekService,
  buildCacheKey,
  md5,
  getStoredApiKeys,
  saveStoredApiKeys
} = require("../../services/translation-service.js");

class FakeService extends TranslationService {
  constructor(name, behavior) {
    super("test-key");
    this.name = name;
    this.behavior = behavior;
    this.calls = 0;
    this.maxObservedConcurrent = 0;
    this.currentConcurrent = 0;
  }

  getServiceName() {
    return this.name;
  }

  async translate(text, sourceLang, targetLang) {
    this.calls += 1;
    this.currentConcurrent += 1;
    this.maxObservedConcurrent = Math.max(this.maxObservedConcurrent, this.currentConcurrent);
    try {
      return await this.behavior(text, sourceLang, targetLang, this.calls);
    } finally {
      this.currentConcurrent -= 1;
    }
  }
}

function createStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async get(key) {
      if (typeof key === "string") {
        return { [key]: data[key] };
      }
      return { ...key, ...data };
    },
    async set(value) {
      Object.assign(data, value);
    }
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("md5 creates stable cache keys", () => {
  expect(md5("hello")).toBe("5d41402abc4b2a76b9719d911017c592");
  expect(buildCacheKey("hello", "en", "zh", "mock")).toHaveLength(32);
});

test("deduplicates identical in-flight requests", async () => {
  const service = new FakeService("primary", async (text) => {
    await sleep(10);
    return `translated:${text}`;
  });
  const engine = new TranslationEngine([service], { debounceMs: 0, retryBaseDelayMs: 1, storage: createStorage() });

  const [first, second] = await Promise.all([
    engine.translate("hello", "en", "zh"),
    engine.translate("hello", "en", "zh")
  ]);

  expect(first).toBe("translated:hello");
  expect(second).toBe("translated:hello");
  expect(service.calls).toBe(1);
});

test("limits concurrent translation requests", async () => {
  const service = new FakeService("primary", async (text) => {
    await sleep(20);
    return text;
  });
  const engine = new TranslationEngine([service], { maxConcurrent: 2, debounceMs: 0, storage: createStorage() });

  await Promise.all(Array.from({ length: 8 }, (_, index) => engine.translate(`text-${index}`, "en", "zh")));

  expect(service.maxObservedConcurrent).toBe(2);
});

test("retries and falls back to secondary service", async () => {
  const primary = new FakeService("primary", async () => {
    throw new Error("down");
  });
  const secondary = new FakeService("secondary", async (text) => `fallback:${text}`);
  const engine = new TranslationEngine([primary, secondary], {
    debounceMs: 0,
    maxRetries: 0,
    storage: createStorage(),
    logger: { warn() {}, debug() {} }
  });

  await expect(engine.translate("hello", "en", "zh")).resolves.toBe("fallback:hello");
  expect(primary.calls).toBe(1);
  expect(secondary.calls).toBe(1);
});

test("uses persistent cache and secure API key storage helpers", async () => {
  const storage = createStorage();
  const cache = new TranslationCache({ storage, ttlMs: 1000, maxEntries: 2 });
  await cache.set("a", "A");
  await cache.set("b", "B");
  await cache.set("c", "C");

  expect(await cache.get("a")).toBeUndefined();
  expect(await cache.get("b")).toBe("B");

  await saveStoredApiKeys({ openai: "sk-test" }, storage);
  await expect(getStoredApiKeys(storage)).resolves.toEqual({ openai: "sk-test" });
});

test("deepseek service sends chat completions request and parses response", async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [
          {
            message: {
              content: "你好"
            }
          }
        ]
      };
    }
  }));

  const service = new DeepSeekService("deepseek-key");
  const result = await service.translate("Hello", "en", "zh");

  expect(result).toBe("你好");
  expect(service.getServiceName()).toBe("deepseek");
  expect(global.fetch).toHaveBeenCalledTimes(1);

  const [url, init] = global.fetch.mock.calls[0];
  expect(url).toBe("https://api.deepseek.com/chat/completions");
  expect(init.method).toBe("POST");
  expect(init.headers.authorization).toBe("Bearer deepseek-key");
  expect(init.headers["content-type"]).toBe("application/json");

  const body = JSON.parse(init.body);
  expect(body.model).toBe("deepseek-chat");
  expect(body.messages[0].role).toBe("system");
  expect(body.messages[1].content).toContain("Source language: en");
  expect(body.messages[1].content).toContain("Target language: zh");
  expect(body.messages[1].content).toContain("Hello");
});

test("deepseek service requires an API key", async () => {
  const service = new DeepSeekService("");
  await expect(service.translate("Hello", "en", "zh")).rejects.toThrow("deepseek API key is missing");
});
