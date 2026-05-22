import {
  clearTranslations,
  retranslatePage,
  startTranslation,
  stopTranslation
} from "./orchestrator.js";
import { translateCurrentSelection } from "./inline-ui.js";
import { showToast } from "./notifications.js";

function initialize() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message?.type) {
      return false;
    }

    const handlers = {
      RUN_TRANSLATION: () => retranslatePage(),
      START_TRANSLATION: () => startTranslation(),
      STOP_TRANSLATION: () => stopTranslation(),
      RETRANSLATE_PAGE: () => retranslatePage(),
      CLEAR_TRANSLATIONS: () => clearTranslations(),
      TRANSLATE_SELECTION: () => translateCurrentSelection(getSettings, showToast)
    };

    const handler = handlers[message.type];
    if (!handler) {
      return false;
    }

    Promise.resolve()
      .then(handler)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Content translation failed."
        });
      });

    return true;
  });

  void getSettings()
    .then((settings) => {
      if (settings.autoTranslate || settings.enabled) {
        return startTranslation();
      }
      return undefined;
    })
    .catch((error) => {
      console.warn("Initial translation pipeline failed", error);
    });
}

function getSettings() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Extension request failed."));
        return;
      }
      resolve(response.data);
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
  initialize();
}
