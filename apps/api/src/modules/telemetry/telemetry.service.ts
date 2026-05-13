import type { TelemetryEventPayload, TelemetryEventRequest } from '@promptoon/shared';

import { db } from '../../db';
import * as repository from '../promptoon-core/product.repository';
import { trackViewerEvent as trackViewerDomainEvent } from '../viewer/viewer.service';

export async function trackTelemetryEvent(payload: TelemetryEventPayload): Promise<void> {
  await repository.insertTelemetryEvent(db, payload);
}

export function trackViewerEvent(request: TelemetryEventRequest): Promise<void> {
  return trackViewerDomainEvent(request);
}
