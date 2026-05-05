import type { Publish, RelatedShort, TelemetryEventRequest, ViewerInteractionStateResponse } from '@promptoon/shared';

import { db } from '../../db';
import { HttpError } from '../../lib/http-error';
import * as projectionService from '../promptoon-core/projection.service';
import * as shareService from '../promptoon-core/share.service';
import * as repository from '../promptoon-core/product.repository';

function assertExists<T>(value: T | null, message: string): T {
  if (!value) {
    throw new HttpError(404, message);
  }

  return value;
}

function isEndingLikeCut(cut: { isEnding?: boolean; kind: string }): boolean {
  return Boolean(cut.isEnding) || cut.kind === 'ending' || cut.kind === 'resultCard';
}

export function getPublishedEpisode(publishId: string): Promise<Publish> {
  return projectionService.getPublishedEpisode(publishId);
}

export function getRelatedShorts(publishId: string): Promise<RelatedShort[]> {
  return projectionService.getRelatedShorts(publishId);
}

export async function getViewerInteractionState(publishId: string, userId: string): Promise<ViewerInteractionStateResponse> {
  return assertExists(
    await repository.getViewerInteractionState(db, {
      publishId,
      userId
    }),
    'Published episode not found.'
  );
}

export async function renderSharePage(
  publishId: string,
  endingCutId: string | undefined,
  baseOrigin: string,
  options: shareService.SharePageOptions = {}
): Promise<string> {
  const publish = await getPublishedEpisode(publishId);
  return shareService.renderSharePage(publish, endingCutId, baseOrigin, options);
}

export async function trackTelemetryEvent(payload: import('@promptoon/shared').TelemetryEventPayload): Promise<void> {
  await repository.insertTelemetryEvent(db, payload);
}

export async function trackViewerEvent(request: TelemetryEventRequest): Promise<void> {
  const publish = assertExists(await repository.getPublishById(db, request.publishId), 'Published episode not found.');
  const cutsById = new Map(publish.manifest.cuts.map((cut) => [cut.id, cut]));
  const targetCut = cutsById.get(request.cutId);

  if (!targetCut) {
    throw new HttpError(400, 'Telemetry cut must exist in the published manifest.');
  }

  if ((request.eventType === 'ending_reach' || request.eventType === 'ending_share') && !isEndingLikeCut(targetCut)) {
    throw new HttpError(400, 'ending events must target an ending cut.');
  }

  if (request.choiceId) {
    const choiceExists = targetCut.choices.some((choice) => choice.id === request.choiceId);

    if (!choiceExists) {
      throw new HttpError(400, 'Telemetry choice must belong to the provided cut.');
    }
  }

  await repository.createViewerEvent(db, {
    publishId: request.publishId,
    episodeId: publish.episodeId,
    anonymousId: request.anonymousId,
    sessionId: request.sessionId,
    eventType: request.eventType,
    cutId: request.cutId,
    choiceId: request.choiceId,
    durationMs: request.durationMs
  });
  await repository.insertTelemetryEvent(db, {
    eventName: request.eventType,
    anonymousId: request.anonymousId,
    sessionId: request.sessionId,
    projectId: publish.projectId,
    episodeId: publish.episodeId,
    publishId: publish.id,
    payload: {
      cutId: request.cutId,
      choiceId: request.choiceId,
      durationMs: request.durationMs
    }
  });
}
