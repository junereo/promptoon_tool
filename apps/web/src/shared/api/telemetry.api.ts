import type { TelemetryEventPayload, TelemetryEventRequest } from '@promptoon/shared';

import { publicRootApiClient } from './client';

export const telemetryApi = {
  async trackEvent(payload: TelemetryEventPayload): Promise<void> {
    await publicRootApiClient.post('/telemetry/events', payload);
  },

  async trackViewerEvent(payload: TelemetryEventRequest): Promise<void> {
    await publicRootApiClient.post('/telemetry/viewer-events', payload);
  }
};
