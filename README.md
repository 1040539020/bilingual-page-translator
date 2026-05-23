vibe-coding
# Bilingual Page Translator

A free open-source immersive translation extension for reading web pages in bilingual, translation-only, or hover modes.

The extension itself is free under the MIT License. Translation providers are user-configured: bring your own DeepSeek API key or connect a compatible custom translation endpoint. This project does not bundle paid proxy services, hardcode API keys, or charge for translation access.

## Features

- Immersive page translation that keeps the original page structure.
- Bilingual display with original text and translation side by side.
- Translation-only mode for focused reading.
- Hover mode for showing translations only when needed.
- Selected-text translation from the inline button or context menu.
- Configurable source and target languages.
- DeepSeek provider support with user-owned API keys.
- Custom provider support for self-hosted or third-party translation APIs.
- Local settings storage with no built-in analytics enabled by default.

## Free And Open-Source Standard

This project uses "free" to mean:

- The extension source code is free to use, inspect, modify, and distribute under MIT.
- The project does not sell subscriptions, translation credits, or hosted translation access.
- Users control which translation service receives page text.
- Third-party translation providers may have their own pricing, quotas, and terms. Users are responsible for their own API keys and provider costs.

## Install From Source

Install dependencies and build the Chrome extension:

```bash
npm install
npm run build:chrome
```

Load the extension in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `dist/chrome`.

## Configure DeepSeek

1. Open the extension options page.
2. Select **DeepSeek** as the primary service.
3. Paste your DeepSeek API key in **API key for selected service**.
4. Choose the target language.
5. Use the popup, context menu, or shortcut to translate the current page.

If no DeepSeek API key is configured, the extension reports a clear configuration error instead of showing the original text as a fake translation.

## Custom Provider API

Custom providers receive a JSON POST request:

```json
{
  "text": "Hello",
  "sourceLanguage": "en",
  "targetLanguage": "zh"
}
```

They must return:

```json
{
  "translatedText": "你好"
}
```

## Development

```bash
npm run typecheck
npm test
npm run build:chrome
```


## Project Structure

```text
manifest.json
content/
src/
  background.ts
  types.ts
  utils/api.ts
  popup/popup.tsx
  options/options.tsx
docs/
tests/
```

## License

MIT
