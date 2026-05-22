const STYLE_ID = "imt-content-style";
const TRANSLATION_CLASS = "imt-translation";
const ORIGINAL_CLASS = "imt-original";

export function injectTranslationStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --imt-bg: rgba(37, 99, 235, 0.08);
      --imt-radius: 6px;
      --imt-font-size: 14px;
    }

    [data-imt-state] {
      border-radius: var(--imt-radius);
      padding: 0.08em 0.18em;
    }

    [data-imt-state="dual"] {
      background: var(--imt-bg);
    }

    [data-imt-state="translation-only"] .${ORIGINAL_CLASS} {
      display: none;
    }

    [data-imt-state="hover"] .${TRANSLATION_CLASS} {
      display: none;
    }

    [data-imt-state="hover"]:hover .${TRANSLATION_CLASS},
    [data-imt-state="hover"]:focus-within .${TRANSLATION_CLASS} {
      display: inline;
    }

    .${TRANSLATION_CLASS} {
      border-left: 2px solid rgba(37, 99, 235, 0.3);
      color: #1d4ed8;
      font-size: var(--imt-font-size);
      margin-left: 0.35em;
      padding-left: 0.35em;
    }

    .imt-toast-region {
      bottom: 18px;
      display: grid;
      gap: 8px;
      position: fixed;
      right: 18px;
      z-index: 2147483647;
    }

    .imt-toast {
      background: rgba(15, 23, 42, 0.92);
      border-radius: 8px;
      color: #fff;
      font: 13px/1.4 system-ui, sans-serif;
      max-width: 320px;
      padding: 10px 12px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.24);
    }

    .imt-selection-button,
    .imt-copy-button {
      background: #2563eb;
      border: 0;
      border-radius: 999px;
      color: #fff;
      cursor: pointer;
      font: 12px/1 system-ui, sans-serif;
      min-height: 26px;
      padding: 0 10px;
      position: fixed;
      z-index: 2147483647;
    }

    .imt-selection-overlay {
      background: #ffffff;
      border: 1px solid rgba(37, 99, 235, 0.28);
      border-radius: 8px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
      color: #0f172a;
      font: 13px/1.4 system-ui, sans-serif;
      max-width: 360px;
      padding: 10px;
      position: fixed;
      z-index: 2147483647;
    }

    .${ORIGINAL_CLASS} {
      color: inherit;
    }
  `;

  (document.head || document.documentElement).append(style);
}

export function applyAppearance(appearance = {}) {
  const root = document.documentElement;
  const color = appearance.backgroundColor || "#2563eb";
  const opacity = appearance.opacity ?? 0.08;
  root.style.setProperty("--imt-bg", hexToRgba(color, opacity));
  root.style.setProperty("--imt-radius", `${appearance.borderRadius ?? 6}px`);
  root.style.setProperty("--imt-font-size", `${appearance.fontSize ?? 14}px`);

  if (appearance.customCss) {
    let custom = document.getElementById("imt-custom-style");
    if (!custom) {
      custom = document.createElement("style");
      custom.id = "imt-custom-style";
      document.documentElement.append(custom);
    }
    custom.textContent = appearance.customCss;
  }
}

export function renderTranslations(results, options = {}) {
  const mode = options.mode || "dual";
  const displayOrder = options.displayOrder || "original-first";

  for (const result of results) {
    if (result.status !== "translated" || !result.translatedText) {
      markFailed(result.segment);
      continue;
    }

    renderSegment(result.segment, result.translatedText, mode, displayOrder);
  }
}

export function clearTranslations(root = document.body) {
  root.querySelectorAll("[data-translated='true']").forEach((element) => {
    const original = element.querySelector(`.${ORIGINAL_CLASS}`);
    if (original) {
      element.textContent = original.textContent || "";
    }

    element.removeAttribute("data-translated");
    element.removeAttribute("data-imt-state");
    element.removeAttribute("data-imt-error");
  });
}

function renderSegment(segment, translatedText, mode, displayOrder) {
  const parent = segment.parent;
  if (!parent || parent.getAttribute("data-translated") === "true") {
    return;
  }

  const originalText = segment.text;
  const wrapper = document.createElement("span");
  wrapper.setAttribute("data-translated", "true");
  wrapper.setAttribute("data-imt-state", mode);
  wrapper.className = "imt-segment";

  const original = document.createElement("span");
  original.className = ORIGINAL_CLASS;
  original.textContent = originalText;

  const translation = document.createElement("span");
  translation.className = TRANSLATION_CLASS;
  translation.textContent = translatedText;

  if (displayOrder === "translation-first") {
    wrapper.append(translation, " ", original);
  } else {
    wrapper.append(original, " ", translation);
  }

  const firstNode = segment.nodes[0];
  const lastNode = segment.nodes[segment.nodes.length - 1];
  if (firstNode === lastNode) {
    firstNode.replaceWith(wrapper);
  } else {
    firstNode.replaceWith(wrapper);
    for (const node of segment.nodes.slice(1)) {
      node.textContent = "";
    }
  }

  parent.setAttribute("data-translated", "true");
}

function markFailed(segment) {
  if (segment.parent) {
    segment.parent.setAttribute("data-imt-error", "translation-failed");
  }
}

function hexToRgba(hex, opacity) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  const number = Number.parseInt(normalized, 16);
  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
