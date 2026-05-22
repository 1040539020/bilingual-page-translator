export type TranslationProvider = "mock" | "custom" | "google" | "deepl" | "openai" | "deepseek" | "baidu";
export type TranslationMode = "dual" | "translation-only" | "hover";
export type DisplayOrder = "original-first" | "translation-first";

export interface TranslatorSettings {
  enabled: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  provider: TranslationProvider;
  renderMode: TranslationMode;
  displayOrder: DisplayOrder;
  autoTranslate: boolean;
  apiEndpoint: string;
  apiKey: string;
  serviceOrder: TranslationProvider[];
  appearance: {
    fontSize: number;
    backgroundColor: string;
    opacity: number;
    borderRadius: number;
    customCss: string;
  };
  advanced: {
    cacheEnabled: boolean;
    cacheTtlDays: number;
    batchSize: number;
    maxConcurrent: number;
    debounceMs: number;
  };
  shortcuts: {
    toggle: string;
    retranslate: string;
    settings: string;
  };
  analytics: {
    enabled: boolean;
    endpoint: string;
  };
  remoteConfig: {
    enabled: boolean;
    url: string;
  };
}

export interface TranslateRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslateResponse {
  translatedText: string;
}

export interface TranslateBatchRequest {
  segments: Array<TranslateRequest & { id: string }>;
}

export interface TranslateBatchResponse {
  results: Array<{
    id: string;
    translatedText?: string;
    error?: string;
  }>;
}

export type ExtensionMessage =
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; payload: TranslatorSettings }
  | { type: "TRANSLATE_TEXT"; payload: TranslateRequest }
  | { type: "TRANSLATE_BATCH"; payload: TranslateBatchRequest }
  | { type: "TOGGLE_TRANSLATION"; payload: { enabled: boolean } }
  | { type: "RUN_TRANSLATION" }
  | { type: "TEST_SERVICE_CONNECTION"; payload: { provider: TranslationProvider } };
