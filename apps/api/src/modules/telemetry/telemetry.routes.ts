import { Router } from 'express';
import type { TelemetryEventPayload } from '@promptoon/shared';

import { asyncHandler } from '../../lib/async-handler';
import { telemetryEventSchema } from '../promptoon-authoring/promptoon.schemas';
import * as service from './telemetry.service';

export function createTelemetryRouter(): Router {
  const router = Router();

  router.post('/events', asyncHandler(async (request, response) => {
    await service.trackTelemetryEvent({
      eventName: request.body?.eventName ?? request.body?.eventType ?? 'telemetry_event',
      ...request.body
    });
    response.status(202).json({ accepted: true });
  }));

  router.post('/viewer-events', asyncHandler(async (request, response) => {
    const body = telemetryEventSchema.parse(request.body);
    await service.trackViewerEvent(body);
    response.status(202).json({ accepted: true });
  }));

  router.post('/batch', asyncHandler(async (request, response) => {
    const events = Array.isArray(request.body?.events) ? request.body.events : [];
    await Promise.all(events.map((event: Record<string, unknown>) => {
      const eventName =
        typeof event.eventName === 'string' ? event.eventName : typeof event.eventType === 'string' ? event.eventType : 'telemetry_event';

      return service.trackTelemetryEvent({
        ...event,
        eventName
      } as TelemetryEventPayload);
    }));
    response.status(202).json({ accepted: true });
  }));

  return router;
}
