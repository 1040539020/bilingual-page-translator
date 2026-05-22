const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");

function loadApiModule() {
  const sourcePath = path.resolve(__dirname, "../../src/utils/api.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  });
  const module = { exports: {} };

  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    fetch: global.fetch,
    chrome: global.chrome,
    URLSearchParams,
    Error,
    JSON
  });

  return module.exports;
}

function createSettings(overrides = {}) {
  return {
    enabled: false,
    sourceLanguage: "auto",
    targetLanguage: "en",
    provider: "mock",
    renderMode: "dual",
    displayOrder: "original-first",
    autoTranslate: false,
    apiEndpoint: "",
    apiKey: "",
    serviceOrder: ["mock", "deepseek", "openai", "google", "deepl", "baidu", "custom"],
    appearance: {
      fontSize: 14,
      backgroundColor: "#2563eb",
      opacity: 0.08,
      borderRadius: 6,
      customCss: ""
    },
    advanced: {
      cacheEnabled: true,
      cacheTtlDays: 7,
      batchSize: 20,
      maxConcurrent: 5,
      debounceMs: 300
    },
    shortcuts: {
      toggle: "Ctrl/Cmd+Shift+T",
      retranslate: "Ctrl/Cmd+Shift+R",
      settings: "Ctrl/Cmd+Shift+S"
    },
    analytics: {
      enabled: false,
      endpoint: ""
    },
    remoteConfig: {
      enabled: false,
      url: ""
    },
    ...overrides
  };
}

test("deepseek provider sends chat completion request and parses translated text", async () => {
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

  const { translateText } = loadApiModule();
  const result = await translateText(
    { text: "Hello", sourceLanguage: "en", targetLanguage: "zh" },
    createSettings({ provider: "deepseek", apiKey: "deepseek-key" })
  );

  expect(result).toEqual({ translatedText: "你好" });
  expect(global.fetch).toHaveBeenCalledTimes(1);

  const [url, init] = global.fetch.mock.calls[0];
  expect(url).toBe("https://api.deepseek.com/chat/completions");
  expect(init.method).toBe("POST");
  expect(init.headers.authorization).toBe("Bearer deepseek-key");

  const body = JSON.parse(init.body);
  expect(body.model).toBe("deepseek-chat");
  expect(body.messages[1].content).toContain("Source language: en");
  expect(body.messages[1].content).toContain("Target language: zh");
  expect(body.messages[1].content).toContain("Hello");
});

test("deepseek provider requires an API key", async () => {
  const { translateText } = loadApiModule();

  await expect(
    translateText(
      { text: "Hello", sourceLanguage: "en", targetLanguage: "zh" },
      createSettings({ provider: "deepseek", apiKey: "" })
    )
  ).rejects.toThrow("DeepSeek API key is missing.");
});

test("unimplemented providers do not return original text as a fake translation", async () => {
  const { translateText } = loadApiModule();

  await expect(
    translateText(
      { text: "Hello", sourceLanguage: "en", targetLanguage: "zh" },
      createSettings({ provider: "openai", apiKey: "sk-test" })
    )
  ).rejects.toThrow("openai translation is not implemented yet.");
});
