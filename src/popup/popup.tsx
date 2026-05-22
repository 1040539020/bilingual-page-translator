import React, { ChangeEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { TranslationMode, TranslationProvider, TranslatorSettings } from "../types";
import { DEFAULT_SETTINGS } from "../utils/api";

const LANGUAGES = [
  ["auto", "Auto detect"],
  ["en", "English"],
  ["zh", "Chinese"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["fr", "French"],
  ["de", "German"],
  ["es", "Spanish"]
];

const SERVICES: Array<[TranslationProvider, string]> = [
  ["mock", "Mock"],
  ["deepseek", "DeepSeek"],
  ["openai", "OpenAI"],
  ["google", "Google"],
  ["deepl", "DeepL"],
  ["baidu", "Baidu"],
  ["custom", "Custom API"]
];

const MODES: Array<[TranslationMode, string]> = [
  ["dual", "Dual"],
  ["translation-only", "Translation only"],
  ["hover", "Hover"]
];

function Popup(): JSX.Element {
  const [settings, setSettings] = useState<TranslatorSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void sendRuntimeMessage<TranslatorSettings>({ type: "GET_SETTINGS" }).then(setSettings);
  }, []);

  async function persist(nextSettings: TranslatorSettings): Promise<void> {
    setSettings(nextSettings);
    await sendRuntimeMessage<TranslatorSettings>({ type: "SAVE_SETTINGS", payload: nextSettings });
  }

  async function updateSetting<K extends keyof TranslatorSettings>(key: K, value: TranslatorSettings[K]): Promise<void> {
    await persist({ ...settings, [key]: value });
  }

  async function toggleCurrentPage(): Promise<void> {
    setBusy(true);
    try {
      const nextEnabled = !settings.enabled;
      const nextSettings = await sendRuntimeMessage<TranslatorSettings>({
        type: "TOGGLE_TRANSLATION",
        payload: { enabled: nextEnabled }
      });
      setSettings(nextSettings);
      await sendActiveTabMessage({ type: nextEnabled ? "START_TRANSLATION" : "STOP_TRANSLATION" });
      setStatus(nextEnabled ? "Translation enabled" : "Translation disabled");
    } finally {
      setBusy(false);
    }
  }

  async function translatePage(): Promise<void> {
    setBusy(true);
    try {
      await sendActiveTabMessage({ type: "RETRANSLATE_PAGE" });
      setStatus("Page translation requested");
    } finally {
      setBusy(false);
    }
  }

  function onSelect<K extends keyof TranslatorSettings>(key: K) {
    return (event: ChangeEvent<HTMLSelectElement>) => {
      void updateSetting(key, event.target.value as TranslatorSettings[K]);
    };
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <h1>Bilingual Translator</h1>
          <p>{status}</p>
        </div>
        <span className={settings.enabled ? "status-pill on" : "status-pill"}>{settings.enabled ? "On" : "Off"}</span>
      </header>

      <section className="control-grid" aria-label="Translation controls">
        <label>
          Source
          <select value={settings.sourceLanguage} onChange={onSelect("sourceLanguage")}>
            {LANGUAGES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Target
          <select value={settings.targetLanguage} onChange={onSelect("targetLanguage")}>
            {LANGUAGES.filter(([value]) => value !== "auto").map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Mode
          <select value={settings.renderMode} onChange={onSelect("renderMode")}>
            {MODES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Service
          <select value={settings.provider} onChange={onSelect("provider")}>
            {SERVICES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="actions">
        <button type="button" onClick={toggleCurrentPage} disabled={busy}>
          {settings.enabled ? "Turn off" : "Turn on"}
        </button>
        <button type="button" className="primary" onClick={translatePage} disabled={busy}>
          Retranslate
        </button>
        <button type="button" className="ghost" onClick={() => chrome.runtime.openOptionsPage()}>
          Settings
        </button>
      </section>
    </main>
  );
}

async function sendActiveTabMessage(message: unknown): Promise<unknown> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) {
    throw new Error("No active tab.");
  }

  return chrome.tabs.sendMessage(tab.id, message);
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

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(<Popup />);
