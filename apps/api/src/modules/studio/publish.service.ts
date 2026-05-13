import type { ProjectPublishDiffResponse, ProjectPublishRollbackResponse, Publish, PublishManifest } from '@promptoon/shared';

import { db, withTransaction } from '../../db';
import { HttpError } from '../../lib/http-error';
import * as authoringService from '../promptoon-authoring/promptoon.service';
import * as projectionService from '../promptoon-core/projection.service';
import * as productRepository from '../promptoon-core/product.repository';
import * as authorizationService from './authorization.service';
import * as publishRepository from './publish.repository';

export const rebuildPublicProjections: typeof authoringService.rebuildPublicProjections = async (userId) => {
  await authorizationService.ensureStudioAdmin(userId);

  return withTransaction((client) => projectionService.rebuildPublicProjections(client));
};

export const publishProject: typeof authoringService.publishProject = (projectId, request, userId) =>
  authoringService.publishProject(projectId, request, userId);

export const updatePublishedProject: typeof authoringService.updatePublishedProject = (projectId, request, userId) =>
  authoringService.updatePublishedProject(projectId, request, userId);

export const unpublishProject: typeof authoringService.unpublishProject = (projectId, request, userId) =>
  authoringService.unpublishProject(projectId, request, userId);

function assertExists<T>(value: T | null, message: string): T {
  if (!value) {
    throw new HttpError(404, message);
  }

  return value;
}

function stringifyComparable(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function flattenChoices(manifest: PublishManifest): Map<string, unknown> {
  const choices = new Map<string, unknown>();

  for (const cut of manifest.cuts) {
    for (const choice of cut.choices) {
      choices.set(`${cut.id}:${choice.id}`, choice);
    }
  }

  return choices;
}

function countChangedEntries(left: Map<string, unknown>, right: Map<string, unknown>): { added: number; removed: number; changed: number } {
  let added = 0;
  let removed = 0;
  let changed = 0;

  for (const [id, rightValue] of right.entries()) {
    const leftValue = left.get(id);
    if (!left.has(id)) {
      added += 1;
    } else if (stringifyComparable(leftValue) !== stringifyComparable(rightValue)) {
      changed += 1;
    }
  }

  for (const id of left.keys()) {
    if (!right.has(id)) {
      removed += 1;
    }
  }

  return { added, removed, changed };
}

function buildPublishDiff(projectId: string, fromPublish: Publish, toPublish: Publish): ProjectPublishDiffResponse {
  const fromCuts = new Map(fromPublish.manifest.cuts.map((cut) => [cut.id, cut]));
  const toCuts = new Map(toPublish.manifest.cuts.map((cut) => [cut.id, cut]));
  const cutDiff = countChangedEntries(fromCuts, toCuts);
  const choiceDiff = countChangedEntries(flattenChoices(fromPublish.manifest), flattenChoices(toPublish.manifest));
  const changedFields: string[] = [];

  if (stringifyComparable(fromPublish.manifest.project) !== stringifyComparable(toPublish.manifest.project)) {
    changedFields.push('project');
  }
  if (stringifyComparable(fromPublish.manifest.episode) !== stringifyComparable(toPublish.manifest.episode)) {
    changedFields.push('episode');
  }
  if (cutDiff.added || cutDiff.removed || cutDiff.changed) {
    changedFields.push('cuts');
  }
  if (choiceDiff.added || choiceDiff.removed || choiceDiff.changed) {
    changedFields.push('choices');
  }

  return {
    projectId,
    fromPublishId: fromPublish.id,
    toPublishId: toPublish.id,
    fromVersionNo: fromPublish.versionNo,
    toVersionNo: toPublish.versionNo,
    changedFields,
    summary: {
      cutsAdded: cutDiff.added,
      cutsRemoved: cutDiff.removed,
      cutsChanged: cutDiff.changed,
      choicesAdded: choiceDiff.added,
      choicesRemoved: choiceDiff.removed,
      choicesChanged: choiceDiff.changed
    }
  };
}

async function getProjectPublish(projectId: string, publishId: string): Promise<Publish> {
  const publish = assertExists(await productRepository.getPublishById(db, publishId), 'Published episode not found.');
  if (publish.projectId !== projectId) {
    throw new HttpError(404, 'Published episode not found.');
  }

  return publish;
}

async function getPreviousProjectPublish(projectId: string, publish: Publish): Promise<Publish> {
  return assertExists(
    await publishRepository.getPreviousProjectPublish(db, {
      projectId,
      episodeId: publish.episodeId,
      versionNo: publish.versionNo,
      createdAt: publish.createdAt,
      publishId: publish.id
    }),
    'Previous publish version not found.'
  );
}

export async function diffProjectPublish(
  projectId: string,
  publishId: string,
  toPublishId: string | undefined,
  userId: string
): Promise<ProjectPublishDiffResponse> {
  await authorizationService.ensureProjectReadableByUser(projectId, userId);
  const fromPublish = await getProjectPublish(projectId, publishId);
  const toPublish = toPublishId ? await getProjectPublish(projectId, toPublishId) : await getPreviousProjectPublish(projectId, fromPublish);
  return buildPublishDiff(projectId, fromPublish, toPublish);
}

export async function compareProjectPublishes(
  projectId: string,
  fromPublishId: string,
  toPublishId: string,
  userId: string
): Promise<ProjectPublishDiffResponse> {
  return diffProjectPublish(projectId, fromPublishId, toPublishId, userId);
}

export async function rollbackProjectPublish(
  projectId: string,
  publishId: string,
  userId: string
): Promise<ProjectPublishRollbackResponse> {
  await authorizationService.ensureProjectPublishableByUser(projectId, userId);
  const rollbackTarget = await getProjectPublish(projectId, publishId);

  return withTransaction(async (client) => {
    const project = assertExists(await productRepository.getProjectById(client, projectId), 'Project not found.');
    const channel = await productRepository.ensureDefaultChannelForProject(client, project, userId);
    const series = await productRepository.ensureDefaultSeriesForProject(client, {
      project,
      channelId: channel.id
    });
    const previousLatest = assertExists(
      await publishRepository.getLatestPublishByEpisodeId(client, rollbackTarget.episodeId),
      'Published episode not found.'
    );
    const versionNo = (await publishRepository.getLatestPublishVersion(client, projectId, rollbackTarget.episodeId)) + 1;

    await publishRepository.markProjectPublished(client, projectId);
    await publishRepository.markEpisodePublished(client, rollbackTarget.episodeId);

    const publish = await publishRepository.createPublish(client, {
      projectId,
      episodeId: rollbackTarget.episodeId,
      channelId: channel.id,
      seriesId: series.id,
      versionNo,
      manifest: rollbackTarget.manifest,
      createdBy: userId
    });
    await projectionService.upsertPublishPublicProjections(client, {
      publish,
      channel,
      series
    });
    await productRepository.insertTelemetryEvent(client, {
      eventName: 'studio_publish_rollback',
      userId,
      projectId,
      channelId: channel.id,
      seriesId: series.id,
      episodeId: rollbackTarget.episodeId,
      publishId: publish.id,
      payload: {
        fromPublishId: previousLatest.id,
        rollbackTargetPublishId: rollbackTarget.id,
        versionNo
      }
    });

    return {
      publish,
      diff: buildPublishDiff(projectId, previousLatest, publish)
    };
  });
}
