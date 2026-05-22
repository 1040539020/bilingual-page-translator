const REMOTE_CONFIG_STORAGE_KEY = "imtRemoteConfig";

export async function fetchRemoteConfig(settings) {
  const url = settings?.remoteConfig?.url || globalThis.__REMOTE_CONFIG_URL__ || "";
  if (!settings?.remoteConfig?.enabled || !url) {
    return {};
  }

  const response = await fetch(url, {
    method: "GET",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Remote config request failed with status ${response.status}.`);
  }

  const config = sanitizeRemoteConfig(await response.json());
  await chrome.storage.local.set({
    [REMOTE_CONFIG_STORAGE_KEY]: {
      config,
      fetchedAt: Date.now()
    }
  });
  return config;
}

export async function getCachedRemoteConfig() {
  const stored = await chrome.storage.local.get({ [REMOTE_CONFIG_STORAGE_KEY]: null });
  return stored[REMOTE_CONFIG_STORAGE_KEY]?.config || {};
}

function sanitizeRemoteConfig(config) {
  return {
    featureFlags: sanitizeRecord(config.featureFlags),
    endpoints: sanitizeRecord(config.endpoints),
    defaults: sanitizeRecord(config.defaults)
  };
}

function sanitizeRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([key, item]) => typeof key === "string" && ["string", "number", "boolean"].includes(typeof item))
  );
}
