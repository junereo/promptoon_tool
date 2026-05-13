export type ID = string;

export type PublishStatus = 'draft' | 'reviewing' | 'published' | 'unpublished' | 'archived';

export type ProductContentBlockType = 'image' | 'dialogue' | 'narration' | 'choice' | 'video' | 'author_note';

import type {
  ChoiceStateWrite,
  CutContentBlock,
  CutStateRoute,
  CutStateVariant,
  ExitLoopEpisodeMetadata,
  Project,
  PromptoonContentViewMode,
  PromptoonCutEffect,
  PromptoonCutKind,
  PromptoonDialogAnchorX,
  PromptoonDialogAnchorY,
  PromptoonDialogTextAlign,
  PromptoonEdgeFade,
  PromptoonEdgeFadeColor,
  PromptoonEdgeFadeIntensity,
  PromptoonLoopMetadata,
  PromptoonSpacingToken,
  Publish
} from './legacy';

export interface PublishedContentBlock {
  id: string;
  type: ProductContentBlockType;
  orderIndex: number;
  imageUrl?: string | null;
  videoUrl?: string | null;
  text?: string | null;
  speaker?: string | null;
}

export interface ProductPublishManifest {
  project: Pick<Project, 'id' | 'title' | 'description' | 'thumbnailUrl' | 'status'>;
  episode: {
    id: string;
    title: string;
    episodeNo: number;
    coverImageUrl: string | null;
    status: 'draft' | 'published';
    startCutId: string | null;
    mode: 'standard' | 'exit_loop';
    exitLoopMetadata: ExitLoopEpisodeMetadata | null;
  };
  cuts: ProductPublishedCut[];
}

export interface ProductPublishedChoice {
  id: string;
  label: string;
  orderIndex: number;
  nextCutId: string | null;
  afterSelectReactionText?: string;
  stateWrites?: ChoiceStateWrite[];
}

export interface ProductPublishedCut {
  id: string;
  kind: PromptoonCutKind;
  title: string;
  body: string;
  contentBlocks: CutContentBlock[];
  contentViewMode?: PromptoonContentViewMode;
  dialogAnchorX: PromptoonDialogAnchorX;
  dialogAnchorY: PromptoonDialogAnchorY;
  dialogOffsetX: number;
  dialogOffsetY: number;
  dialogTextAlign: PromptoonDialogTextAlign;
  startEffect: PromptoonCutEffect;
  endEffect: PromptoonCutEffect;
  startEffectDurationMs: number;
  endEffectDurationMs: number;
  assetUrl: string | null;
  edgeFade?: PromptoonEdgeFade;
  edgeFadeIntensity?: PromptoonEdgeFadeIntensity;
  edgeFadeColor?: PromptoonEdgeFadeColor;
  marginBottomToken?: PromptoonSpacingToken;
  stateVariants?: CutStateVariant[];
  stateRoutes?: CutStateRoute[];
  stateFallbackCutId?: string | null;
  loopMetadata?: PromptoonLoopMetadata | null;
  positionX: number;
  positionY: number;
  orderIndex: number;
  isStart: boolean;
  isEnding: boolean;
  choices: ProductPublishedChoice[];
}

export interface ProductPublish extends Omit<Publish, 'manifest'> {
  manifest: ProductPublishManifest;
}

export type {
  Choice,
  ChoiceStateWrite,
  Cut,
  CutContentBlock,
  Episode,
  EpisodeDraftResponse,
  Project,
  ProjectWithEpisodes,
  Publish,
  PublishManifest
} from './legacy';
