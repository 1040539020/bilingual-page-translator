import { translateText } from "./translation.js";

let selectionButton = null;
let overlay = null;

export function installInlineUi(getSettings, notify) {
  document.addEventListener("mouseup", () => {
    window.setTimeout(() => showSelectionButton(getSettings, notify), 0);
  });

  document.addEventListener("mouseover", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const segment = target.closest("[data-imt-state='hover']");
    if (segment) {
      segment.title = segment.querySelector(".imt-translation")?.textContent || "";
    }
  });
}

export async function translateCurrentSelection(getSettings, notify) {
  const selection = window.getSelection();
  const text = selection?.toString().trim() || "";
  if (!text) {
    notify("Select text to translate first.", "warning");
    return;
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  const settings = await getSettings();
  const translated = await translateText(text, {
    sourceLanguage: settings.sourceLanguage || "auto",
    targetLanguage: settings.targetLanguage || "en"
  });
  showOverlay(rect, translated, notify);
}

function showSelectionButton(getSettings, notify) {
  const selection = window.getSelection();
  const text = selection?.toString().trim() || "";
  if (!text) {
    removeSelectionButton();
    return;
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (!selectionButton) {
    selectionButton = document.createElement("button");
    selectionButton.className = "imt-selection-button";
    selectionButton.type = "button";
    selectionButton.textContent = "Translate";
    selectionButton.addEventListener("click", () => {
      void translateCurrentSelection(getSettings, notify);
    });
    document.documentElement.append(selectionButton);
  }

  selectionButton.style.left = `${Math.min(rect.right + 8, window.innerWidth - 92)}px`;
  selectionButton.style.top = `${Math.max(rect.top - 30, 8)}px`;
}

function showOverlay(rect, translated, notify) {
  removeOverlay();
  overlay = document.createElement("div");
  overlay.className = "imt-selection-overlay";

  const text = document.createElement("div");
  text.textContent = translated;

  const copy = document.createElement("button");
  copy.className = "imt-copy-button";
  copy.type = "button";
  copy.textContent = "Copy";
  copy.style.position = "static";
  copy.style.marginTop = "8px";
  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(translated);
    notify("Translation copied.", "success");
  });

  overlay.append(text, copy);
  overlay.style.left = `${Math.min(rect.left, window.innerWidth - 380)}px`;
  overlay.style.top = `${Math.min(rect.bottom + 10, window.innerHeight - 120)}px`;
  document.documentElement.append(overlay);

  window.setTimeout(removeOverlay, 8000);
}

function removeSelectionButton() {
  selectionButton?.remove();
  selectionButton = null;
}

function removeOverlay() {
  overlay?.remove();
  overlay = null;
}
