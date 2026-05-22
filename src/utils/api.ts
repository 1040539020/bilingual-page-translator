import type { TranslateRequest, TranslateResponse, TranslationProvider, TranslatorSettings } from "../types";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

export const DEFAULT_SETTINGS: TranslatorSettings = {
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
  }
};

export async function getSettings(): Promise<TranslatorSettings> {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const secrets = await chrome.storage.local.get({ translatorApiKey: "", serviceApiKeys: {} });
  const merged = { ...DEFAULT_SETTINGS, ...stored } as TranslatorSettings;
  return {
    ...merged,
    appearance: { ...DEFAULT_SETTINGS.appearance, ...merged.appearance },
    advanced: { ...DEFAULT_SETTINGS.advanced, ...merged.advanced },
    shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...merged.shortcuts },
    analytics: { ...DEFAULT_SETTINGS.analytics, ...merged.analytics },
    remoteConfig: { ...DEFAULT_SETTINGS.remoteConfig, ...merged.remoteConfig },
    apiKey: (secrets.serviceApiKeys as Record<string, string>)[merged.provider] || secrets.translatorApiKey || ""
  };
}

export async function saveSettings(settings: TranslatorSettings): Promise<void> {
  const { apiKey, ...nonSecretSettings } = settings;
  const safeSettings = {
    ...nonSecretSettings,
    apiEndpoint: settings.apiEndpoint.trim(),
    apiKey: ""
  };

  const local = await chrome.storage.local.get({ serviceApiKeys: {} });
  const serviceApiKeys = { ...(local.serviceApiKeys as Record<string, string>) };
  serviceApiKeys[settings.provider] = apiKey.trim();

  await chrome.storage.sync.set(safeSettings);
  await chrome.storage.local.set({ translatorApiKey: apiKey.trim(), serviceApiKeys });
}

export async function getProviderConfigurationStatus(
  provider: TranslationProvider
): Promise<{ ok: boolean; message: string }> {
  if (provider === "mock") {
    return { ok: true, message: "Mock service is available." };
  }

  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const secrets = await chrome.storage.local.get({ translatorApiKey: "", serviceApiKeys: {} });
  const serviceApiKeys = secrets.serviceApiKeys as Record<string, string>;
  const apiKey = serviceApiKeys[provider] || "";

  if (provider === "deepseek") {
    return apiKey
      ? { ok: true, message: "DeepSeek API key is configured." }
      : { ok: false, message: "DeepSeek API key is missing." };
  }

  if (provider === "custom") {
    const endpoint = typeof stored.apiEndpoint === "string" ? stored.apiEndpoint.trim() : "";
    return endpoint && apiKey
      ? { ok: true, message: "Custom API endpoint and key are configured." }
      : { ok: false, message: "Custom API endpoint or key is missing." };
  }

  return { ok: false, message: `${provider} translation is not implemented yet.` };
}

export async function translateText(
  request: TranslateRequest,
  settings: TranslatorSettings
): Promise<TranslateResponse> {
  const text = request.text.trim();
  if (!text) {
    return { translatedText: "" };
  }

  if (settings.provider === "mock") {
    return {
      translatedText: `[${settings.provider}:${request.targetLanguage}] ${text}`
    };
  }

  if (settings.provider === "deepseek") {
    return translateWithDeepSeek({ ...request, text }, settings.apiKey);
  }

  if (settings.provider !== "custom") {
    throw new Error(`${settings.provider} translation is not implemented yet.`);
  }

  if (!settings.apiEndpoint || !settings.apiKey) {
    throw new Error("Custom translation provider is not configured.");
  }

  const response = await fetch(settings.apiEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(request),
    credentials: "omit",
    referrerPolicy: "no-referrer"
  });

  if (!response.ok) {
    throw new Error(`Translation request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as Partial<TranslateResponse>;
  if (typeof data.translatedText !== "string") {
    throw new Error("Translation response did not include translatedText.");
  }

  return { translatedText: data.translatedText };
}

async function translateWithDeepSeek(request: TranslateRequest, apiKey: string): Promise<TranslateResponse> {
  if (!apiKey) {
    throw new Error("DeepSeek API key is missing.");
  }

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Translate the user text only. Preserve meaning, tone, punctuation, and inline formatting. Return only the translation."
        },
        {
          role: "user",
          content: `Source language: ${request.sourceLanguage || "auto"}\nTarget language: ${request.targetLanguage}\n\n${request.text}`
        }
      ],
      temperature: 0.2
    }),
    credentials: "omit",
    referrerPolicy: "no-referrer"
  });

  if (!response.ok) {
    throw new Error(`DeepSeek translation request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
  };
  const translatedText = data.choices?.[0]?.message?.content;

  if (typeof translatedText !== "string" || !translatedText.trim()) {
    throw new Error("DeepSeek returned an invalid response.");
  }

  return { translatedText: translatedText.trim() };
}
