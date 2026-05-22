import type { TranslateRequest, TranslateResponse, TranslatorSettings } from "./types";

const TRANSLATED_ATTR = "data-bilingual-translated";
const TRANSLATION_CLASS = "bilingual-translator-text";
const MAX_TEXT_NODES = 60;
const MIN_TEXT_LENGTH = 24;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "RUN_TRANSLATION") {
    return false;
  }

  void translateVisibleText()
    .then(() => sendResponse({ ok: true }))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to translate page.";
      sendResponse({ ok: false, error: message });
    });

  return true;
});

async function translateVisibleText(): Promise<void> {
  injectStyles();

  const settings = await sendRuntimeMessage<TranslatorSettings>({ type: "GET_SETTINGS" });
  const nodes = collectTextNodes(document.body).slice(0, MAX_TEXT_NODES);

  for (const node of nodes) {
    const parent = node.parentElement;
    const text = node.textContent?.trim();

    if (!parent || !text || parent.closest(`[${TRANSLATED_ATTR}]`)) {
      continue;
    }

    const request: TranslateRequest = {
      text,
      sourceLanguage: settings.sourceLanguage,
      targetLanguage: settings.targetLanguage
    };

    const response = await sendRuntimeMessage<TranslateResponse>({ type: "TRANSLATE_TEXT", payload: request });
    appendTranslation(parent, response.translatedText);
  }
}

function collectTextNodes(root: HTMLElement): Text[] {
  const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT"]);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      const text = node.textContent?.trim() ?? "";

      if (!parent || ignoredTags.has(parent.tagName) || text.length < MIN_TEXT_LENGTH) {
        return NodeFilter.FILTER_REJECT;
      }

      if (parent.closest(`[${TRANSLATED_ATTR}], .${TRANSLATION_CLASS}`)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  return nodes;
}

function appendTranslation(parent: HTMLElement, translatedText: string): void {
  if (!translatedText) {
    return;
  }

  const translation = document.createElement("span");
  translation.className = TRANSLATION_CLASS;
  translation.textContent = translatedText;
  translation.setAttribute("lang", "en");

  parent.setAttribute(TRANSLATED_ATTR, "true");
  parent.append(" ", translation);
}

function injectStyles(): void {
  if (document.getElementById("bilingual-translator-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "bilingual-translator-style";
  style.textContent = `
    .${TRANSLATION_CLASS} {
      display: inline;
      color: #2563eb;
      font-size: 0.95em;
      margin-left: 0.35em;
    }
  `;
  document.documentElement.append(style);
}

function sendRuntimeMessage<TResponse>(message: unknown): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error ?? "Extension request failed."));
        return;
      }

      resolve(response.data as TResponse);
    });
  });
}
