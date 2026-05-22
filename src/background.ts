import { DEFAULT_SETTINGS, getProviderConfigurationStatus, getSettings, saveSettings, translateText } from "./utils/api";
import type { ExtensionMessage } from "./types";

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...settings });
  createContextMenus();
});

chrome.runtime.onStartup.addListener(createContextMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) {
    return;
  }

  if (info.menuItemId === "imt-translate-page") {
    void chrome.tabs.sendMessage(tab.id, { type: "RUN_TRANSLATION" });
  }

  if (info.menuItemId === "imt-translate-selection") {
    void chrome.tabs.sendMessage(tab.id, {
      type: "TRANSLATE_SELECTION",
      payload: { text: info.selectionText || "" }
    });
  }

  if (typeof info.menuItemId === "string" && info.menuItemId.startsWith("imt-translate-to-")) {
    const targetLanguage = info.menuItemId.replace("imt-translate-to-", "");
    void chrome.tabs.sendMessage(tab.id, {
      type: "RUN_TRANSLATION",
      payload: { targetLanguage }
    });
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-settings") {
    chrome.runtime.openOptionsPage();
    return;
  }

  void chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
    if (!tab?.id) {
      return;
    }

    if (command === "toggle-translation") {
      const settings = await getSettings();
      const nextEnabled = !settings.enabled;
      await saveSettings({ ...settings, enabled: nextEnabled });
      await chrome.tabs.sendMessage(tab.id, { type: nextEnabled ? "START_TRANSLATION" : "STOP_TRANSLATION" });
    }

    if (command === "retranslate-page") {
      await chrome.tabs.sendMessage(tab.id, { type: "RETRANSLATE_PAGE" });
    }
  });
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void handleMessage(message)
    .then((response) => sendResponse({ ok: true, data: response }))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown extension error.";
      sendResponse({ ok: false, error: message });
    });

  return true;
});

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case "GET_SETTINGS":
      return getSettings();
    case "SAVE_SETTINGS":
      await saveSettings(message.payload);
      return message.payload;
    case "TOGGLE_TRANSLATION": {
      const settings = await getSettings();
      const nextSettings = { ...settings, enabled: message.payload.enabled };
      await saveSettings(nextSettings);
      return nextSettings;
    }
    case "TRANSLATE_TEXT": {
      const settings = await getSettings();
      return translateText(message.payload, settings);
    }
    case "TRANSLATE_BATCH": {
      const settings = await getSettings();
      const results = await Promise.all(
        message.payload.segments.map(async (segment) => {
          try {
            const response = await translateText(segment, settings);
            return { id: segment.id, translatedText: response.translatedText };
          } catch (error) {
            return {
              id: segment.id,
              error: error instanceof Error ? error.message : "Translation failed."
            };
          }
        })
      );

      return { results };
    }
    case "RUN_TRANSLATION":
      return null;
    case "TEST_SERVICE_CONNECTION": {
      const status = await getProviderConfigurationStatus(message.payload.provider);
      return {
        provider: message.payload.provider,
        ok: status.ok,
        message: status.message
      };
    }
    default:
      throw new Error("Unsupported extension message.");
  }
}

function createContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "imt-translate-page",
      title: "Translate this page",
      contexts: ["page"]
    });
    chrome.contextMenus.create({
      id: "imt-translate-selection",
      title: "Translate selection",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: "imt-translate-to",
      title: "Translate to...",
      contexts: ["page", "selection"]
    });

    for (const language of ["en", "zh", "ja", "ko", "fr", "de", "es"]) {
      chrome.contextMenus.create({
        id: `imt-translate-to-${language}`,
        parentId: "imt-translate-to",
        title: language.toUpperCase(),
        contexts: ["page", "selection"]
      });
    }
  });
}
