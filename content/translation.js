const MAX_BATCH_SIZE = 20;
const MAX_SEGMENT_RETRIES = 2;

export async function translateSegments(segments, options = {}) {
  const sourceLanguage = options.sourceLanguage || "auto";
  const targetLanguage = options.targetLanguage || "en";
  const onProgress = options.onProgress || (() => {});
  const batchSize = options.batchSize || MAX_BATCH_SIZE;
  const batches = chunkArray(segments, batchSize);
  const results = [];
  let completed = 0;

  for (const batch of batches) {
    const translatedBatch = await translateBatchWithRetries(batch, sourceLanguage, targetLanguage);
    results.push(...translatedBatch);
    completed += translatedBatch.length;
    onProgress({
      completed,
      total: segments.length,
      failed: results.filter((result) => result.status === "failed").length
    });
  }

  return results;
}

export async function translateText(text, options = {}) {
  const response = await sendRuntimeMessage({
    type: "TRANSLATE_TEXT",
    payload: {
      text,
      sourceLanguage: options.sourceLanguage || "auto",
      targetLanguage: options.targetLanguage || "en"
    }
  });
  return response.translatedText || "";
}

async function translateBatchWithRetries(batch, sourceLanguage, targetLanguage) {
  let pending = batch.map((segment) => ({ segment, attempts: 0 }));
  const results = [];

  while (pending.length > 0) {
    const response = await sendRuntimeMessage({
      type: "TRANSLATE_BATCH",
      payload: {
        segments: pending.map(({ segment }) => ({
          id: segment.id,
          text: segment.text,
          sourceLanguage,
          targetLanguage
        }))
      }
    });

    const retry = [];
    for (const item of pending) {
      const translated = response.results.find((result) => result.id === item.segment.id);
      if (translated?.translatedText) {
        results.push({
          segment: item.segment,
          translatedText: translated.translatedText,
          status: "translated"
        });
        continue;
      }

      if (item.attempts < MAX_SEGMENT_RETRIES) {
        retry.push({ ...item, attempts: item.attempts + 1 });
        continue;
      }

      results.push({
        segment: item.segment,
        translatedText: "",
        status: "failed",
        error: translated?.error || "Translation failed."
      });
    }

    pending = retry;
  }

  return results;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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
