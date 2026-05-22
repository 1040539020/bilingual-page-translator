import React, { ChangeEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { TranslationMode, TranslationProvider, TranslatorSettings } from "../types";
import { DEFAULT_SETTINGS } from "../utils/api";

type Tab = "general" | "services" | "appearance" | "advanced";

const TABS: Array<[Tab, string]> = [
  ["general", "General"],
  ["services", "Services"],
  ["appearance", "Appearance"],
  ["advanced", "Advanced"]
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

const LANGUAGES = [
  ["en", "English"],
  ["zh", "Chinese"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["fr", "French"],
  ["de", "German"],
  ["es", "Spanish"]
];

function Options(): JSX.Element {
  const [settings, setSettings] = useState<TranslatorSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [status, setStatus] = useState("Settings are saved automatically.");

  useEffect(() => {
    void sendRuntimeMessage<TranslatorSettings>({ type: "GET_SETTINGS" }).then(setSettings);
  }, []);

  async function save(nextSettings: TranslatorSettings): Promise<void> {
    setSettings(nextSettings);
    const saved = await sendRuntimeMessage<TranslatorSettings>({ type: "SAVE_SETTINGS", payload: nextSettings });
    setSettings(saved);
    setStatus("Saved");
  }

  function update<K extends keyof TranslatorSettings>(key: K, value: TranslatorSettings[K]): void {
    void save({ ...settings, [key]: value });
  }

  function updateAppearance<K extends keyof TranslatorSettings["appearance"]>(
    key: K,
    value: TranslatorSettings["appearance"][K]
  ): void {
    void save({ ...settings, appearance: { ...settings.appearance, [key]: value } });
  }

  function updateAdvanced<K extends keyof TranslatorSettings["advanced"]>(
    key: K,
    value: TranslatorSettings["advanced"][K]
  ): void {
    void save({ ...settings, advanced: { ...settings.advanced, [key]: value } });
  }

  async function testService(provider: TranslationProvider): Promise<void> {
    const result = await sendRuntimeMessage<{ ok: boolean; message: string }>({
      type: "TEST_SERVICE_CONNECTION",
      payload: { provider }
    });
    setStatus(`${provider}: ${result.message}`);
  }

  function moveService(provider: TranslationProvider, direction: -1 | 1): void {
    const order = [...settings.serviceOrder];
    const index = order.indexOf(provider);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) {
      return;
    }

    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    void save({ ...settings, serviceOrder: order });
  }

  return (
    <main className="options-shell">
      <header className="options-header">
        <h1>Bilingual Translator Settings</h1>
        <p role="status">{status}</p>
      </header>

      <nav className="tabs" aria-label="Settings sections">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={activeTab === value ? "tab active" : "tab"}
            onClick={() => setActiveTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === "general" && (
        <section className="settings-panel">
          <Field label="Default target language">
            <select value={settings.targetLanguage} onChange={selectValue((value) => update("targetLanguage", value))}>
              {LANGUAGES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Translation mode">
            <select value={settings.renderMode} onChange={selectValue((value) => update("renderMode", value as TranslationMode))}>
              <option value="dual">Dual</option>
              <option value="translation-only">Translation only</option>
              <option value="hover">Hover</option>
            </select>
          </Field>
          <label className="switch-row">
            <span>Auto-translate on page load</span>
            <input
              type="checkbox"
              checked={settings.autoTranslate}
              onChange={(event) => update("autoTranslate", event.target.checked)}
            />
          </label>
        </section>
      )}

      {activeTab === "services" && (
        <section className="settings-panel">
          <Field label="Primary service">
            <select value={settings.provider} onChange={selectValue((value) => update("provider", value as TranslationProvider))}>
              {SERVICES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="API key for selected service">
            <input
              type="password"
              value={settings.apiKey}
              onChange={(event) => update("apiKey", event.target.value)}
              autoComplete="off"
              placeholder="Stored locally in chrome.storage.local"
            />
          </Field>
          <Field label="Custom API endpoint">
            <input
              type="url"
              value={settings.apiEndpoint}
              onChange={(event) => update("apiEndpoint", event.target.value)}
              placeholder="https://example.com/translate"
            />
          </Field>
          <div className="service-list">
            {settings.serviceOrder.map((provider, index) => (
              <div className="service-row" key={provider}>
                <span>{SERVICES.find(([value]) => value === provider)?.[1] || provider}</span>
                <button type="button" onClick={() => moveService(provider, -1)} disabled={index === 0}>
                  Up
                </button>
                <button type="button" onClick={() => moveService(provider, 1)} disabled={index === settings.serviceOrder.length - 1}>
                  Down
                </button>
                <button type="button" onClick={() => testService(provider)}>
                  Test
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "appearance" && (
        <section className="settings-panel">
          <Field label="Font size">
            <input
              type="number"
              min="10"
              max="24"
              value={settings.appearance.fontSize}
              onChange={(event) => updateAppearance("fontSize", Number(event.target.value))}
            />
          </Field>
          <Field label="Background color">
            <input
              type="color"
              value={settings.appearance.backgroundColor}
              onChange={(event) => updateAppearance("backgroundColor", event.target.value)}
            />
          </Field>
          <Field label="Opacity">
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.01"
              value={settings.appearance.opacity}
              onChange={(event) => updateAppearance("opacity", Number(event.target.value))}
            />
          </Field>
          <Field label="Border radius">
            <input
              type="number"
              min="0"
              max="20"
              value={settings.appearance.borderRadius}
              onChange={(event) => updateAppearance("borderRadius", Number(event.target.value))}
            />
          </Field>
          <Field label="Custom CSS">
            <textarea
              value={settings.appearance.customCss}
              onChange={(event) => updateAppearance("customCss", event.target.value)}
              rows={6}
            />
          </Field>
        </section>
      )}

      {activeTab === "advanced" && (
        <section className="settings-panel">
          <label className="switch-row">
            <span>Enable translation cache</span>
            <input
              type="checkbox"
              checked={settings.advanced.cacheEnabled}
              onChange={(event) => updateAdvanced("cacheEnabled", event.target.checked)}
            />
          </label>
          <NumberField label="Cache TTL days" value={settings.advanced.cacheTtlDays} onChange={(value) => updateAdvanced("cacheTtlDays", value)} />
          <NumberField label="Batch size" value={settings.advanced.batchSize} onChange={(value) => updateAdvanced("batchSize", value)} />
          <NumberField label="Rate limit concurrency" value={settings.advanced.maxConcurrent} onChange={(value) => updateAdvanced("maxConcurrent", value)} />
          <NumberField label="DOM debounce ms" value={settings.advanced.debounceMs} onChange={(value) => updateAdvanced("debounceMs", value)} />
          <label className="switch-row">
            <span>Anonymous usage statistics</span>
            <input
              type="checkbox"
              checked={settings.analytics.enabled}
              onChange={(event) => void save({ ...settings, analytics: { ...settings.analytics, enabled: event.target.checked } })}
            />
          </label>
          <Field label="Analytics endpoint">
            <input
              type="url"
              value={settings.analytics.endpoint}
              onChange={(event) => void save({ ...settings, analytics: { ...settings.analytics, endpoint: event.target.value } })}
              placeholder="https://example.com/extension-events"
            />
          </Field>
          <label className="switch-row">
            <span>Remote feature configuration</span>
            <input
              type="checkbox"
              checked={settings.remoteConfig.enabled}
              onChange={(event) => void save({ ...settings, remoteConfig: { ...settings.remoteConfig, enabled: event.target.checked } })}
            />
          </label>
          <Field label="Remote config URL">
            <input
              type="url"
              value={settings.remoteConfig.url}
              onChange={(event) => void save({ ...settings, remoteConfig: { ...settings.remoteConfig, url: event.target.value } })}
              placeholder="https://example.com/extension-config.json"
            />
          </Field>
          <div className="shortcut-grid">
            <span>Toggle</span>
            <kbd>{settings.shortcuts.toggle}</kbd>
            <span>Retranslate</span>
            <kbd>{settings.shortcuts.retranslate}</kbd>
            <span>Settings</span>
            <kbd>{settings.shortcuts.settings}</kbd>
          </div>
        </section>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }): JSX.Element {
  return (
    <Field label={label}>
      <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </Field>
  );
}

function selectValue(handler: (value: string) => void) {
  return (event: ChangeEvent<HTMLSelectElement>) => handler(event.target.value);
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
root.render(<Options />);
