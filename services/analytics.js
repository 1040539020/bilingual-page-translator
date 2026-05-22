const ANALYTICS_QUEUE_KEY = "imtAnalyticsQueue";

export async function trackUsageEvent(settings, event) {
  if (!settings?.analytics?.enabled || !settings.analytics.endpoint) {
    return;
  }

  const payload = {
    event: event.name,
    timestamp: Date.now(),
    targetLanguage: event.targetLanguage,
    sourceLanguage: event.sourceLanguage,
    success: Boolean(event.success),
    durationMs: event.durationMs,
    failureReason: event.failureReason || ""
  };

  const stored = await chrome.storage.local.get({ [ANALYTICS_QUEUE_KEY]: [] });
  const queue = [...stored[ANALYTICS_QUEUE_KEY], payload].slice(-100);
  await chrome.storage.local.set({ [ANALYTICS_QUEUE_KEY]: queue });

  await flushAnalytics(settings);
}

export async function flushAnalytics(settings) {
  if (!settings?.analytics?.enabled || !settings.analytics.endpoint) {
    return;
  }

  const stored = await chrome.storage.local.get({ [ANALYTICS_QUEUE_KEY]: [] });
  const queue = stored[ANALYTICS_QUEUE_KEY];
  if (!queue.length) {
    return;
  }

  const response = await fetch(settings.analytics.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ events: queue }),
    credentials: "omit",
    referrerPolicy: "no-referrer"
  });

  if (response.ok) {
    await chrome.storage.local.set({ [ANALYTICS_QUEUE_KEY]: [] });
  }
}
