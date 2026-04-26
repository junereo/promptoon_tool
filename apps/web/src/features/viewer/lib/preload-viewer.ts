import type { Publish, PublishManifest } from '@promptoon/shared';

import { queryClient } from '../../../app/query-client';
import { promptoonKeys } from '../../../shared/api/query-keys';
import { promptoonService } from '../../../shared/api/promptoon.service';

type ViewerPageModule = typeof import('../../../pages/promptoon-viewer-page');
type ViewerCut = PublishManifest['cuts'][number];

const preloadPromises = new Map<string, Promise<void>>();
let viewerPageModulePromise: Promise<ViewerPageModule> | null = null;

export function preloadPromptoonViewerPage() {
  viewerPageModulePromise ??= import('../../../pages/promptoon-viewer-page').catch((error: unknown) => {
    viewerPageModulePromise = null;
    throw error;
  });
  return viewerPageModulePromise;
}

function getStartCut(manifest: PublishManifest): ViewerCut | null {
  if (manifest.episode.startCutId) {
    const configuredStartCut = manifest.cuts.find((cut) => cut.id === manifest.episode.startCutId) ?? null;
    if (configuredStartCut) {
      return configuredStartCut;
    }
  }

  return (
    manifest.cuts.find((cut) => cut.isStart) ??
    [...manifest.cuts].sort((left, right) => left.orderIndex - right.orderIndex)[0] ??
    null
  );
}

function preloadImage(assetUrl: string | null | undefined): Promise<void> {
  if (!assetUrl || typeof Image === 'undefined') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = assetUrl;
  });
}

async function ensurePublishedEpisode(publishId: string): Promise<Publish> {
  return queryClient.ensureQueryData({
    queryKey: promptoonKeys.publishedEpisode(publishId),
    queryFn: () => promptoonService.getPublishedEpisode(publishId)
  });
}

export function preloadViewerForPublish(publishId: string): Promise<void> {
  if (!publishId) {
    return Promise.resolve();
  }

  const existingPromise = preloadPromises.get(publishId);
  if (existingPromise) {
    return existingPromise;
  }

  const preloadPromise = Promise.all([preloadPromptoonViewerPage(), ensurePublishedEpisode(publishId)])
    .then(([, publish]) => preloadImage(getStartCut(publish.manifest)?.assetUrl))
    .catch((error: unknown) => {
      preloadPromises.delete(publishId);
      throw error;
    });

  preloadPromises.set(publishId, preloadPromise);
  return preloadPromise;
}
