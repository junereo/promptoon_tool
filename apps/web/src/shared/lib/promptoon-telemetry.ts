import type { TelemetryEventRequest } from '@promptoon/shared';

import { API_BASE_URL } from '../api/client';

const DEVICE_ID_KEY = 'promptoon_device_id';

let cachedAnonymousId: string | null = null;

export function getPromptoonAnonymousId() {
  if (cachedAnonymousId) {
    if (!window.localStorage.getItem(DEVICE_ID_KEY)) {
      window.localStorage.setItem(DEVICE_ID_KEY, cachedAnonymousId);
    }
    return cachedAnonymousId;
  }

  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    cachedAnonymousId = existing;
    return existing;
  }

  const created = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_KEY, created);
  cachedAnonymousId = created;
  return created;
}

export function sendPromptoonTelemetryEvent(payload: TelemetryEventRequest) {
  const body = JSON.stringify(payload);

  if (typeof navigator.sendBeacon === 'function') {
    if (navigator.sendBeacon(`${API_BASE_URL}/telemetry/events`, body)) {
      return;
    }
  }

  void fetch(`${API_BASE_URL}/telemetry/events`, {
    body,
    headers: {
      'Content-Type': 'application/json'
    },
    keepalive: true,
    method: 'POST'
  }).catch(() => undefined);
}
