import { createDomChangeObserver, detectPageLanguage } from "./detection.js";
import { extractTextSegments } from "./extraction.js";
import { translateSegments } from "./translation.js";
import { installInlineUi, translateCurrentSelection } from "./inline-ui.js";
import { showToast } from "./notifications.js";
import { applyAppearance, clearTranslations as clearRenderedTranslations, injectTranslationStyles, renderTranslations } from "./rendering.js";

let running = false;
let translating = false;
let observer = null;
let lastProgress = { completed: 0, total: 0, failed: 0 };

injectTranslationStyles();
installInlineUi(getSettings, showToast);

export async function startTranslation(options = {}) {
  if (running) {
    return;
  }

  running = true;
  observer = createDomChangeObserver(() => {
    void retranslatePage(options);
  }, { debounceMs: options.debounceMs || 300 });
  observer.start(document.body);

  await retranslatePage(options);
}

export function stopTranslation() {
  running = false;
  observer?.stop();
  observer = null;
}

export async function retranslatePage(options = {}) {
  if (translating || !document.body) {
    return lastProgress;
  }

  translating = true;
  try {
    const settings = await sendRuntimeMessage({ type: "GET_SETTINGS" });
    applyAppearance(settings.appearance);
    showToast("Translation started.", "info");
    const sourceLanguage =
      options.sourceLanguage || (settings.sourceLanguage === "auto" ? detectPageLanguage(document) : settings.sourceLanguage);
    const targetLanguage = options.targetLanguage || settings.targetLanguage || "en";
    const segments = extractTextSegments(document);

    lastProgress = { completed: 0, total: segments.length, failed: 0 };
    if (segments.length === 0) {
      return lastProgress;
    }

    const results = await translateSegments(segments, {
      sourceLanguage,
      targetLanguage,
      batchSize: settings.advanced?.batchSize || 20,
      onProgress(progress) {
        lastProgress = progress;
        window.dispatchEvent(new CustomEvent("imt:translation-progress", { detail: progress }));
      }
    });

    renderTranslations(results, {
      mode: options.mode || settings.renderMode || "dual",
      displayOrder: options.displayOrder || settings.displayOrder || "original-first"
    });

    showToast(lastProgress.failed > 0 ? "Translation completed with some errors." : "Translation completed.", lastProgress.failed > 0 ? "warning" : "success");
    return lastProgress;
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Translation failed.", "error");
    throw error;
  } finally {
    translating = false;
  }
}

export function clearTranslations() {
  clearRenderedTranslations(document.body);
  showToast("Translations cleared.", "info");
}

export function getTranslationProgress() {
  return lastProgress;
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
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

async function getSettings() {
  return sendRuntimeMessage({ type: "GET_SETTINGS" });
}

globalThis.IMTTranslator = {
  startTranslation,
  stopTranslation,
  retranslatePage,
  clearTranslations,
  translateCurrentSelection: () => translateCurrentSelection(getSettings, showToast),
  getTranslationProgress
};
