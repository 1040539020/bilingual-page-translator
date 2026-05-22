const KEY_STORAGE_NAME = "imtCryptoKey";

export async function secureGet(key) {
  const secureStorage = globalThis.chrome?.storage?.secure;
  if (secureStorage) {
    const result = await storageGet(secureStorage, key);
    return result?.[key];
  }

  const result = await storageGet(chrome.storage.local, key);
  const encrypted = result?.[key];
  if (!encrypted) {
    return undefined;
  }

  return decryptValue(encrypted);
}

export async function secureSet(key, value) {
  const secureStorage = globalThis.chrome?.storage?.secure;
  if (secureStorage) {
    await storageSet(secureStorage, { [key]: value });
    return;
  }

  await storageSet(chrome.storage.local, { [key]: await encryptValue(value) });
}

export function sanitizeTextInput(value, maxLength = 10000) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .slice(0, maxLength)
    .trim();
}

export function sanitizeUrl(value) {
  const text = sanitizeTextInput(value, 2048);
  if (!text) {
    return "";
  }

  const url = new URL(text);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are allowed.");
  }

  return url.toString();
}

async function encryptValue(value) {
  const key = await getOrCreateCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  return {
    algorithm: "AES-GCM",
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext)
  };
}

async function decryptValue(payload) {
  const key = await getOrCreateCryptoKey();
  const iv = base64ToUint8Array(payload.iv);
  const ciphertext = base64ToUint8Array(payload.ciphertext);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function getOrCreateCryptoKey() {
  const stored = await storageGet(chrome.storage.local, KEY_STORAGE_NAME);
  if (stored?.[KEY_STORAGE_NAME]) {
    return crypto.subtle.importKey("jwk", stored[KEY_STORAGE_NAME], { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  }

  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  await storageSet(chrome.storage.local, { [KEY_STORAGE_NAME]: jwk });
  return key;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToUint8Array(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function storageGet(storage, key) {
  return new Promise((resolve, reject) => {
    try {
      const result = storage.get(key);
      if (result && typeof result.then === "function") {
        result.then(resolve, reject);
      } else {
        storage.get(key, resolve);
      }
    } catch (error) {
      reject(error);
    }
  });
}

function storageSet(storage, value) {
  return new Promise((resolve, reject) => {
    try {
      const result = storage.set(value);
      if (result && typeof result.then === "function") {
        result.then(resolve, reject);
      } else {
        storage.set(value, resolve);
      }
    } catch (error) {
      reject(error);
    }
  });
}
