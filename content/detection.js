const EXCLUDED_SELECTOR = [
  "script",
  "style",
  "noscript",
  "template",
  "nav",
  "footer",
  "header",
  "aside",
  "form",
  "button",
  "input",
  "textarea",
  "select",
  "[data-notranslate]",
  "[translate='no']",
  "[data-translated='true']",
  "[class^='ad-']",
  "[class*=' ad-']",
  "[id^='ad-']",
  "[id*=' ad-']"
].join(",");

export function detectPageLanguage(doc = document) {
  const htmlLang = normalizeLanguage(doc.documentElement.getAttribute("lang"));
  if (htmlLang) {
    return htmlLang;
  }

  const metaLanguage = normalizeLanguage(
    doc.querySelector("meta[http-equiv='content-language' i]")?.getAttribute("content") ||
      doc.querySelector("meta[name='language' i]")?.getAttribute("content") ||
      doc.querySelector("meta[property='og:locale' i]")?.getAttribute("content")
  );

  if (metaLanguage) {
    return metaLanguage;
  }

  return analyzeContentLanguage(doc.body?.innerText || "");
}

export function getTranslatableRoots(doc = document) {
  const primaryCandidates = [
    doc.querySelector("main"),
    doc.querySelector("article"),
    doc.querySelector("[role='main']"),
    doc.querySelector(".content"),
    doc.querySelector("#content")
  ].filter(Boolean);

  const roots = [];
  for (const candidate of primaryCandidates) {
    if (isTranslatableElement(candidate) && !roots.some((root) => root.contains(candidate))) {
      roots.push(candidate);
    }
  }

  return roots.length > 0 ? roots : [doc.body].filter(Boolean);
}

export function isTranslatableElement(element) {
  return Boolean(element && element.nodeType === Node.ELEMENT_NODE && !element.closest(EXCLUDED_SELECTOR));
}

export function createDomChangeObserver(onChange, options = {}) {
  const debounceMs = options.debounceMs ?? 300;
  let timerId = 0;

  const observer = new MutationObserver((mutations) => {
    const hasRelevantMutation = mutations.some((mutation) => {
      if (mutation.type === "characterData") {
        return isTranslatableElement(mutation.target.parentElement);
      }

      return Array.from(mutation.addedNodes).some((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return isTranslatableElement(node.parentElement);
        }

        return node.nodeType === Node.ELEMENT_NODE && isTranslatableElement(node);
      });
    });

    if (!hasRelevantMutation) {
      return;
    }

    clearTimeout(timerId);
    timerId = window.setTimeout(onChange, debounceMs);
  });

  return {
    start(root = document.body) {
      if (!root) {
        return;
      }

      observer.observe(root, {
        childList: true,
        characterData: true,
        subtree: true
      });
    },
    stop() {
      clearTimeout(timerId);
      observer.disconnect();
    }
  };
}

function normalizeLanguage(value) {
  if (!value) {
    return "";
  }

  return value
    .split(/[_,;]/)[0]
    .trim()
    .toLowerCase();
}

function analyzeContentLanguage(text) {
  const sample = text.replace(/\s+/g, "").slice(0, 4000);
  if (!sample) {
    return "auto";
  }

  const cjkCount = (sample.match(/[\u3400-\u9fff]/g) || []).length;
  const kanaCount = (sample.match(/[\u3040-\u30ff]/g) || []).length;
  const hangulCount = (sample.match(/[\uac00-\ud7af]/g) || []).length;
  const latinCount = (sample.match(/[a-z]/gi) || []).length;

  if (kanaCount > cjkCount * 0.3) {
    return "ja";
  }

  if (hangulCount > 20) {
    return "ko";
  }

  if (cjkCount > latinCount) {
    return "zh";
  }

  return latinCount > 20 ? "en" : "auto";
}
