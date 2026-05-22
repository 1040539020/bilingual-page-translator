# User Guide

## What This Extension Does

Bilingual Page Translator is a free open-source immersive translation extension. It translates web pages into bilingual, translation-only, or hover reading modes while preserving the page layout as much as possible.

The extension software is free. Translation is performed by the provider you configure, such as DeepSeek with your own API key or a custom endpoint you control.

## Features

- Translate full pages from the popup.
- Translate selected text from the context menu or inline selection button.
- Choose dual, translation-only, or hover display mode.
- Configure target language and translation service.
- Customize translation appearance.

## DeepSeek Setup

1. Open the extension options page.
2. Set the primary service to **DeepSeek**.
3. Enter your own DeepSeek API key.
4. Save settings automatically by leaving the field.
5. Translate a page from the popup or context menu.

If the API key is missing or invalid, translation fails with an explicit error message.

## Custom Provider Setup

Use a custom provider when you have a self-hosted translation service or another API that follows the extension contract. The endpoint must accept `text`, `sourceLanguage`, and `targetLanguage`, then return `translatedText`.

## FAQ

### Is this completely free?

The extension code is free and open-source under MIT. Third-party translation services may charge for usage or enforce quotas. The project does not provide paid proxy translation access.

### Where is page text sent?

Only to the translation provider selected in your settings, and only when translation is requested or auto-translation is enabled.

### Why does the extension request access to all URLs?

The extension needs page access so it can read and translate pages selected by the user.

### Why are analytics disabled?

Usage statistics are optional. They are off by default and only send anonymous event metrics after opt-in.

## Troubleshooting

- If translation does not start, reload the page and try again.
- If DeepSeek fails, confirm the selected service is DeepSeek and the API key is saved.
- If a page layout looks wrong, switch to hover mode or clear translations.
