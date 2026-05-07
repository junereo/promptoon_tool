import type {
  CutContentBlock,
  FeedItem,
  ProductPublishManifest,
  Publish,
  ProductPublishedChoice,
  ProductPublishedCut
} from '@promptoon/shared';
import {
  DEFAULT_CONTENT_SPACING,
  DEFAULT_CONTENT_VIEW_MODE,
  DEFAULT_CUT_EFFECT_DURATION_MS,
  DEFAULT_EDGE_FADE,
  DEFAULT_EDGE_FADE_COLOR,
  DEFAULT_EDGE_FADE_INTENSITY,
  deriveCutBody,
  getNormalizedCutContentBlocks
} from '@promptoon/shared';
import { createHash } from 'node:crypto';

type ManifestDraftInput = {
  episode: ProductPublishManifest['episode'];
  cuts: Array<Omit<ProductPublishedCut, 'choices'> & { contentBlocks?: CutContentBlock[] }>;
  choices: Array<{
    id: string;
    cutId: string;
    label: string;
    orderIndex: number;
    nextCutId: string | null;
    afterSelectReactionText?: string | null;
    stateWrites?: ProductPublishedChoice['stateWrites'];
  }>;
};

type ManifestProjectInput = ProductPublishManifest['project'];

type ProjectionChannelInput = {
  id: string;
  slug: string;
  display_name: string;
  avatar_url: string | null;
};

type ProjectionSeriesInput = {
  id: string;
};

function normalizeCutEffectDurationMs(value: number | undefined): number {
  return value ?? DEFAULT_CUT_EFFECT_DURATION_MS;
}

function normalizeManifestContentBlocks(cut: { id: string; body: string; contentBlocks?: CutContentBlock[] }): CutContentBlock[] {
  return getNormalizedCutContentBlocks({
    id: cut.id,
    body: cut.body,
    contentBlocks: cut.contentBlocks ?? []
  });
}

export function normalizeManifest(manifest: ProductPublishManifest): ProductPublishManifest {
  return {
    ...manifest,
    episode: {
      ...manifest.episode,
      coverImageUrl: manifest.episode.coverImageUrl ?? null
    },
    cuts: manifest.cuts.map((cut) => {
      const contentBlocks = normalizeManifestContentBlocks(cut);

      return {
        ...cut,
        body: deriveCutBody(contentBlocks, cut.body),
        contentBlocks,
        contentViewMode: cut.contentViewMode ?? DEFAULT_CONTENT_VIEW_MODE,
        edgeFade: cut.edgeFade ?? DEFAULT_EDGE_FADE,
        edgeFadeIntensity: cut.edgeFadeIntensity ?? DEFAULT_EDGE_FADE_INTENSITY,
        edgeFadeColor: cut.edgeFadeColor ?? DEFAULT_EDGE_FADE_COLOR,
        marginBottomToken: cut.marginBottomToken ?? DEFAULT_CONTENT_SPACING,
        stateVariants: cut.stateVariants ?? [],
        stateRoutes: cut.stateRoutes ?? [],
        stateFallbackCutId: cut.stateFallbackCutId ?? null,
        loopMetadata: cut.loopMetadata ?? null,
        startEffect: cut.startEffect ?? 'none',
        endEffect: cut.endEffect ?? 'none',
        startEffectDurationMs: normalizeCutEffectDurationMs(cut.startEffectDurationMs),
        endEffectDurationMs: normalizeCutEffectDurationMs(cut.endEffectDurationMs),
        choices: cut.choices.map((choice) => ({
          ...choice,
          afterSelectReactionText: choice.afterSelectReactionText ?? undefined,
          stateWrites: choice.stateWrites ?? []
        }))
      };
    })
  };
}

export function normalizePublish(publish: Publish): Publish {
  return {
    ...publish,
    manifest: normalizeManifest(publish.manifest)
  };
}

export function buildManifest(draft: ManifestDraftInput, project: ManifestProjectInput): ProductPublishManifest {
  const choicesByCutId = new Map<string, ManifestDraftInput['choices']>();
  for (const choice of draft.choices) {
    const list = choicesByCutId.get(choice.cutId) ?? [];
    list.push(choice);
    choicesByCutId.set(choice.cutId, list);
  }

  return {
    project: {
      id: project.id,
      title: project.title,
      description: project.description,
      thumbnailUrl: project.thumbnailUrl,
      status: project.status
    },
    episode: {
      id: draft.episode.id,
      title: draft.episode.title,
      episodeNo: draft.episode.episodeNo,
      coverImageUrl: draft.episode.coverImageUrl,
      status: draft.episode.status,
      startCutId: draft.episode.startCutId,
      mode: draft.episode.mode,
      exitLoopMetadata: draft.episode.exitLoopMetadata
    },
    cuts: draft.cuts.map((cut) => ({
      contentBlocks: getNormalizedCutContentBlocks(cut),
      id: cut.id,
      kind: cut.kind,
      title: cut.title,
      body: deriveCutBody(getNormalizedCutContentBlocks(cut), cut.body),
      contentViewMode: cut.contentViewMode ?? DEFAULT_CONTENT_VIEW_MODE,
      edgeFade: cut.edgeFade ?? DEFAULT_EDGE_FADE,
      edgeFadeIntensity: cut.edgeFadeIntensity ?? DEFAULT_EDGE_FADE_INTENSITY,
      edgeFadeColor: cut.edgeFadeColor ?? DEFAULT_EDGE_FADE_COLOR,
      marginBottomToken: cut.marginBottomToken ?? DEFAULT_CONTENT_SPACING,
      dialogAnchorX: cut.dialogAnchorX,
      dialogAnchorY: cut.dialogAnchorY,
      dialogOffsetX: cut.dialogOffsetX,
      dialogOffsetY: cut.dialogOffsetY,
      dialogTextAlign: cut.dialogTextAlign,
      startEffect: cut.startEffect ?? 'none',
      endEffect: cut.endEffect ?? 'none',
      startEffectDurationMs: normalizeCutEffectDurationMs(cut.startEffectDurationMs),
      endEffectDurationMs: normalizeCutEffectDurationMs(cut.endEffectDurationMs),
      assetUrl: cut.assetUrl,
      positionX: cut.positionX,
      positionY: cut.positionY,
      orderIndex: cut.orderIndex,
      isStart: cut.isStart,
      isEnding: cut.isEnding,
      stateVariants: cut.stateVariants ?? [],
      stateRoutes: cut.stateRoutes ?? [],
      stateFallbackCutId: cut.stateFallbackCutId ?? null,
      loopMetadata: cut.loopMetadata ?? null,
      choices: (choicesByCutId.get(cut.id) ?? []).map((choice) => ({
        id: choice.id,
        label: choice.label,
        orderIndex: choice.orderIndex,
        nextCutId: choice.nextCutId,
        afterSelectReactionText: choice.afterSelectReactionText ?? undefined,
        stateWrites: choice.stateWrites ?? []
      }))
    }))
  };
}

function toPublicProjectRef(projectId: string): string {
  return `prj_${createHash('sha256').update(projectId).digest('base64url').slice(0, 10)}`;
}

export function toPublicPublish(publish: Publish): Publish {
  const publicProjectRef = toPublicProjectRef(publish.projectId);

  return {
    ...publish,
    projectId: publicProjectRef,
    manifest: {
      ...publish.manifest,
      project: {
        ...publish.manifest.project,
        id: publicProjectRef
      }
    }
  };
}

function isRealFeedChoice(choice: ProductPublishedChoice) {
  const normalizedLabel = choice.label.trim().toLowerCase();

  return Boolean(choice.nextCutId) && normalizedLabel.length > 0 && normalizedLabel !== 'new';
}

function getFeedStartCut(manifest: ProductPublishManifest): ProductPublishedCut | null {
  const sortedCuts = manifest.cuts.slice().sort((left, right) => left.orderIndex - right.orderIndex);

  return sortedCuts.find((cut) => cut.choices.filter(isRealFeedChoice).length >= 2) ?? null;
}

export function buildFeedItem(publish: Publish): FeedItem | null {
  const startCut = getFeedStartCut(publish.manifest);
  if (!startCut) {
    return null;
  }

  const startChoices = startCut.choices.filter(isRealFeedChoice);

  return {
    publishId: publish.id,
    episodeId: publish.episodeId,
    episodeTitle: publish.manifest.episode.title,
    projectTitle: publish.manifest.project.title,
    coverImageUrl: publish.manifest.episode.coverImageUrl ?? null,
    publishedAt: publish.createdAt,
    startCut: {
      id: startCut.id,
      title: startCut.title,
      body: startCut.body,
      contentBlocks: startCut.contentBlocks,
      contentViewMode: startCut.contentViewMode ?? DEFAULT_CONTENT_VIEW_MODE,
      assetUrl: startCut.assetUrl,
      edgeFade: startCut.edgeFade ?? DEFAULT_EDGE_FADE,
      edgeFadeIntensity: startCut.edgeFadeIntensity ?? DEFAULT_EDGE_FADE_INTENSITY,
      edgeFadeColor: startCut.edgeFadeColor ?? DEFAULT_EDGE_FADE_COLOR,
      marginBottomToken: startCut.marginBottomToken ?? DEFAULT_CONTENT_SPACING,
      dialogAnchorX: startCut.dialogAnchorX,
      dialogAnchorY: startCut.dialogAnchorY,
      dialogOffsetX: startCut.dialogOffsetX,
      dialogOffsetY: startCut.dialogOffsetY,
      dialogTextAlign: startCut.dialogTextAlign,
      startEffect: startCut.startEffect ?? 'none',
      endEffect: startCut.endEffect ?? 'none',
      startEffectDurationMs: normalizeCutEffectDurationMs(startCut.startEffectDurationMs),
      endEffectDurationMs: normalizeCutEffectDurationMs(startCut.endEffectDurationMs)
    },
    startChoices: startChoices
      .slice()
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((choice) => ({
        id: choice.id,
        label: choice.label,
        orderIndex: choice.orderIndex,
        nextCutId: choice.nextCutId,
        afterSelectReactionText: choice.afterSelectReactionText,
        stateWrites: choice.stateWrites ?? []
      }))
  };
}

export function buildProjectedFeedItem(input: {
  feedItem: FeedItem;
  publish: Publish;
  channel: ProjectionChannelInput;
  series: ProjectionSeriesInput;
}): FeedItem {
  return {
    ...input.feedItem,
    id: input.publish.id,
    type: 'promptoon',
    channelId: input.channel.id,
    channelSlug: input.channel.slug,
    channelName: input.channel.display_name,
    channelAvatarUrl: input.channel.avatar_url,
    metrics: {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0
    },
    entry: {
      kind: 'viewer',
      href: `/v/${input.publish.id}`
    }
  };
}
