import type { TelemetryEventRequest } from '@promptoon/shared';

import { API_BASE_URL } from '../api/client';

const DEVICE_ID_KEY = 'promptoon_device_id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let cachedAnonymousId: string | null = null;

function isValidUuid(value: string | null): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

function createAnonymousId() {
  const created = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_KEY, created);
  cachedAnonymousId = created;
  return created;
}

export function createPromptoonSessionId() {
  return crypto.randomUUID();
}

export function getPromptoonAnonymousId() {
  if (isValidUuid(cachedAnonymousId)) {
    if (!window.localStorage.getItem(DEVICE_ID_KEY)) {
      window.localStorage.setItem(DEVICE_ID_KEY, cachedAnonymousId);
    }
    return cachedAnonymousId;
  }

  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (isValidUuid(existing)) {
    cachedAnonymousId = existing;
    return existing;
  }

  return createAnonymousId();
}

export function sendPromptoonTelemetryEvent(payload: TelemetryEventRequest) {
  const body = JSON.stringify(payload);

  if (typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon(`${API_BASE_URL}/telemetry/events`, blob)) {
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
