# Deployment Checklist

## Build

- Set `EXTENSION_VERSION` to the release version.
- Set `TARGET_BROWSER` to `chrome`, `edge`, or `firefox`.
- Optional: set `API_BASE_URL` and `REMOTE_CONFIG_URL`.
- Run `npm ci`.
- Run `npm run ci`.
- Run `npm run build:chrome`, `npm run build:edge`, and `npm run build:firefox`.
- Run `npm run package:zip`.
- Upload `release/chrome-extension.zip` to Chrome Web Store.

## Security

- Confirm CSP contains only `script-src 'self'` and no remote script origins.
- Confirm host permissions are justified in store listing.
- Confirm API keys are never hardcoded.
- Confirm API keys use `chrome.storage.secure` when available or AES-GCM encrypted local storage fallback.
- Confirm analytics is disabled by default and requires explicit opt-in.
- Confirm custom CSS and endpoint inputs are sanitized before use.

## Store Assets

- Provide screenshots at `1280x800`.
- Provide icons at `16`, `32`, `48`, `128`, and store-required sizes.
- Provide promotional images for Chrome Web Store listing.
- Include a privacy policy URL.
- Include a concise permissions justification:
  - `storage`: save translation preferences, cache, and encrypted keys.
  - `activeTab`: translate the active page after user action.
  - `scripting`: support page translation interactions.
  - `contextMenus`: provide right-click translation actions.
  - `<all_urls>`: allow translation on pages selected by the user.

## Release

- Verify extension loads from `dist/chrome` in Chrome.
- Verify popup opens and settings persist.
- Verify page translation, selection translation, context menu, and shortcuts.
- Verify no console errors on a representative static page and SPA page.
- Tag the release after store package generation.
