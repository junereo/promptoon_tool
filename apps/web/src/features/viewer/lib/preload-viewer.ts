import type { ProductPublish, ProductPublishManifest } from '@promptoon/shared';

import { queryClient } from '../../../app/query-client';
import { promptoonKeys } from '../../../shared/api/query-keys';
import { viewerApi } from '../../../shared/api/viewer.api';
import { preloadImageAsset } from '../../../shared/lib/image-preload';

type ViewerPageModule = typeof import('../../../pages/promptoon-viewer-page');
type ViewerCut = ProductPublishManifest['cuts'][number];

const preloadPromises = new Map<string, Promise<void>>();
let viewerPageModulePromise: Promise<ViewerPageModule> | null = null;

export function preloadPromptoonViewerPage() {
  viewerPageModulePromise ??= import('../../../pages/promptoon-viewer-page').catch((error: unknown) => {
    viewerPageModulePromise = null;
    throw error;
  });
  return viewerPageModulePromise;
}

function getStartCut(manifest: ProductPublishManifest): ViewerCut | null {
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

async function ensurePublishedEpisode(publishId: string): Promise<ProductPublish> {
  return queryClient.ensureQueryData({
    queryKey: promptoonKeys.publishedEpisode(publishId),
    queryFn: () => viewerApi.getPublishedEpisode(publishId)
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
    .then(([, publish]) => preloadImageAsset(getStartCut(publish.manifest)?.assetUrl))
    .catch((error: unknown) => {
      preloadPromises.delete(publishId);
      throw error;
    });

  preloadPromises.set(publishId, preloadPromise);
  return preloadPromise;
}
