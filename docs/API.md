# API Documentation

## Translation Services

`services/translation-service.js` exports:

- `TranslationService`: base class for all providers.
- `GoogleTranslateService`
- `DeepLService`
- `OpenAIService`
- `DeepSeekService`
- `BaiduTranslateService`
- `TranslationEngine`: queue, retry, fallback, and cache coordinator.
- `TranslationCache`: memory LRU plus persistent cache.

Each provider implements:

```js
new Service(apiKey, options)
service.translate(text, sourceLang, targetLang)
service.getServiceName()
service.healthCheck()
```

## Content Pipeline

The production background translation path currently supports:

- `mock`: local development placeholder.
- `deepseek`: real DeepSeek Chat Completions request using the user's API key.
- `custom`: user-provided endpoint returning `{ "translatedText": "..." }`.

Other provider classes exist in `services/translation-service.js` but are not wired into the background message path yet.

The content pipeline exposes `globalThis.IMTTranslator`:

```js
IMTTranslator.startTranslation()
IMTTranslator.stopTranslation()
IMTTranslator.retranslatePage()
IMTTranslator.clearTranslations()
IMTTranslator.getTranslationProgress()
```

## Remote Config

Remote config accepts JSON with optional keys:

```json
{
  "featureFlags": {},
  "endpoints": {},
  "defaults": {}
}
```

Only primitive string, number, and boolean values are accepted.
