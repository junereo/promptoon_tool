export type PromptoonCutKind = 'scene' | 'choice' | 'ending' | 'transition';
export type PromptoonCutEffect =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out';
export type PromptoonDialogAnchorX = 'left' | 'right';
export type PromptoonDialogAnchorY = 'top' | 'bottom';
export type PromptoonDialogTextAlign = 'left' | 'center' | 'right';
export type PromptoonContentTextAlign = 'left' | 'center' | 'right';
export type PromptoonContentViewMode = 'default' | 'inverse';
export type PromptoonFontToken = 'sans-kr' | 'serif-kr' | 'display';
export type PromptoonFontSizeToken = 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
export type PromptoonLineHeightToken = 'tight' | 'normal' | 'relaxed' | 'loose';
export type PromptoonSpacingToken = 'none' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | '8xl' | '9xl' | '10xl';
export type PromptoonEdgeFade = 'none' | 'top' | 'bottom' | 'both';
export type PromptoonEdgeFadeIntensity = 'soft' | 'normal' | 'strong';
export type PromptoonContentBindingKey = 'userName';
export type PromptoonContentPlacement = 'overlay' | 'flow';
export type PromptoonContentBlockType = 'heading' | 'narration' | 'quote' | 'emphasis' | 'image' | 'nameInput' | 'dialogue';

export type PromptoonProjectStatus = 'draft' | 'published';
export type PromptoonEpisodeStatus = 'draft' | 'published';
export type PromptoonPublishStatus = 'published';
export type TelemetryEventType = 'cut_view' | 'cut_leave' | 'choice_click' | 'ending_reach' | 'ending_share' | 'feed_impression' | 'feed_choice_click';

export const DEFAULT_CUT_EFFECT_DURATION_MS = 320;
export const MAX_CUT_EFFECT_DURATION_MS = 10000;
export const DEFAULT_NAME_INPUT_MAX_LENGTH = 20;
export const DEFAULT_CONTENT_FONT_TOKEN: PromptoonFontToken = 'sans-kr';
export const DEFAULT_CONTENT_FONT_SIZE: PromptoonFontSizeToken = 'base';
export const DEFAULT_CONTENT_TEXT_ALIGN: PromptoonContentTextAlign = 'left';
export const DEFAULT_CONTENT_VIEW_MODE: PromptoonContentViewMode = 'default';
export const DEFAULT_CONTENT_LINE_HEIGHT: PromptoonLineHeightToken = 'normal';
export const DEFAULT_CONTENT_SPACING: PromptoonSpacingToken = 'none';
export const DEFAULT_EDGE_FADE: PromptoonEdgeFade = 'none';
export const DEFAULT_EDGE_FADE_INTENSITY: PromptoonEdgeFadeIntensity = 'normal';

interface PromptoonTextContentBlockBase {
  id: string;
  type: 'heading' | 'narration' | 'quote' | 'emphasis' | 'dialogue';
  text: string;
  textAlign: PromptoonContentTextAlign;
  fontToken: PromptoonFontToken;
  placement?: PromptoonContentPlacement;
  fontSizeToken?: PromptoonFontSizeToken;
  lineHeightToken?: PromptoonLineHeightToken;
  marginTopToken?: PromptoonSpacingToken;
  marginBottomToken?: PromptoonSpacingToken;
  speaker?: string;
}

export interface PromptoonHeadingContentBlock extends PromptoonTextContentBlockBase {
  type: 'heading';
}

export interface PromptoonNarrationContentBlock extends PromptoonTextContentBlockBase {
  type: 'narration';
}

export interface PromptoonQuoteContentBlock extends PromptoonTextContentBlockBase {
  type: 'quote';
  title?: string;
}

export interface PromptoonEmphasisContentBlock extends PromptoonTextContentBlockBase {
  type: 'emphasis';
}

export interface PromptoonDialogueContentBlock extends PromptoonTextContentBlockBase {
  type: 'dialogue';
}

export interface PromptoonImageContentBlock {
  id: string;
  type: 'image';
  assetUrl: string | null;
  alt: string;
}

export interface PromptoonNameInputContentBlock {
  id: string;
  type: 'nameInput';
  placeholder: string;
  maxLength: number;
  required: boolean;
  bindingKey: PromptoonContentBindingKey;
}

export type CutContentBlock =
  | PromptoonHeadingContentBlock
  | PromptoonNarrationContentBlock
  | PromptoonQuoteContentBlock
  | PromptoonEmphasisContentBlock
  | PromptoonDialogueContentBlock
  | PromptoonImageContentBlock
  | PromptoonNameInputContentBlock;

export interface Project {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  status: PromptoonProjectStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithEpisodes extends Project {
  episodes: Episode[];
}

export interface Episode {
  id: string;
  projectId: string;
  title: string;
  episodeNo: number;
  startCutId: string | null;
  status: PromptoonEpisodeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Cut {
  id: string;
  episodeId: string;
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
  marginBottomToken?: PromptoonSpacingToken;
  positionX: number;
  positionY: number;
  orderIndex: number;
  isStart: boolean;
  isEnding: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Choice {
  id: string;
  cutId: string;
  label: string;
  orderIndex: number;
  nextCutId: string | null;
  afterSelectReactionText?: string;
  createdAt: string;
  updatedAt: string;
}

export type EditorSelection =
  | { type: 'cut'; id: string }
  | { type: 'choice'; id: string }
  | { type: 'none' };

export interface Publish {
  id: string;
  projectId: string;
  episodeId: string;
  versionNo: number;
  status: PromptoonPublishStatus;
  manifest: PublishManifest;
  createdBy: string;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  loginId: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface RegisterRequest {
  loginId: string;
  password: string;
}

export interface LoginRequest {
  loginId: string;
  password: string;
}

export interface TelemetryEventRequest {
  publishId: string;
  anonymousId: string;
  sessionId: string;
  eventType: TelemetryEventType;
  cutId: string;
  choiceId?: string;
  durationMs?: number;
}

export interface AssetUploadResponse {
  assetUrl: string;
}

export interface EpisodeDraftResponse {
  episode: Episode;
  cuts: Cut[];
  choices: Choice[];
}

export type ValidationIssueCode =
  | 'missing_start_cut'
  | 'multiple_start_cuts'
  | 'missing_ending_cut'
  | 'invalid_choice_target'
  | 'unreachable_cut'
  | 'dead_path';

export interface ValidationIssue {
  code: ValidationIssueCode;
  message: string;
  cutIds?: string[];
  choiceIds?: string[];
}

export interface ValidateEpisodeResponse {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface PublishRequest {
  episodeId: string;
}

export interface CreateProjectRequest {
  title: string;
  description?: string;
}

export interface CreateEpisodeRequest {
  title: string;
  episodeNo: number;
}

export interface CreateCutRequest {
  kind: PromptoonCutKind;
  title: string;
  body?: string;
  contentBlocks?: CutContentBlock[];
  contentViewMode?: PromptoonContentViewMode;
  dialogAnchorX?: PromptoonDialogAnchorX;
  dialogAnchorY?: PromptoonDialogAnchorY;
  dialogOffsetX?: number;
  dialogOffsetY?: number;
  dialogTextAlign?: PromptoonDialogTextAlign;
  startEffect?: PromptoonCutEffect;
  endEffect?: PromptoonCutEffect;
  startEffectDurationMs?: number;
  endEffectDurationMs?: number;
  assetUrl?: string | null;
  edgeFade?: PromptoonEdgeFade;
  edgeFadeIntensity?: PromptoonEdgeFadeIntensity;
  marginBottomToken?: PromptoonSpacingToken;
  orderIndex?: number;
  positionX?: number;
  positionY?: number;
  isStart?: boolean;
  isEnding?: boolean;
}

export interface PatchCutRequest {
  kind?: PromptoonCutKind;
  title?: string;
  body?: string;
  contentBlocks?: CutContentBlock[];
  contentViewMode?: PromptoonContentViewMode;
  dialogAnchorX?: PromptoonDialogAnchorX;
  dialogAnchorY?: PromptoonDialogAnchorY;
  dialogOffsetX?: number;
  dialogOffsetY?: number;
  dialogTextAlign?: PromptoonDialogTextAlign;
  startEffect?: PromptoonCutEffect;
  endEffect?: PromptoonCutEffect;
  startEffectDurationMs?: number;
  endEffectDurationMs?: number;
  assetUrl?: string | null;
  edgeFade?: PromptoonEdgeFade;
  edgeFadeIntensity?: PromptoonEdgeFadeIntensity;
  marginBottomToken?: PromptoonSpacingToken;
  orderIndex?: number;
  positionX?: number;
  positionY?: number;
  isStart?: boolean;
  isEnding?: boolean;
}

export interface CreateChoiceRequest {
  label: string;
  orderIndex?: number;
  nextCutId?: string | null;
  afterSelectReactionText?: string;
}

export interface PatchChoiceRequest {
  label?: string;
  orderIndex?: number;
  nextCutId?: string | null;
  afterSelectReactionText?: string;
}

export interface ReorderEpisodeCutsRequest {
  cuts: Array<{
    cutId: string;
    orderIndex: number;
  }>;
}

export interface ReorderEpisodeCutsResponse {
  cuts: Cut[];
}

export interface AnalyticsFunnelStep {
  key: 'start_view' | 'choice_engaged' | 'ending_reached';
  label: string;
  viewers: number;
}

export interface AnalyticsChoiceStat {
  choiceId: string;
  label: string;
  count: number;
  percentage: number;
  avgHesitationMs?: number;
}

export interface AnalyticsCutEngagement {
  cutId: string;
  dropOffCount: number;
  avgDurationMs: number;
}

export interface AnalyticsEndingStat {
  cutId: string;
  count: number;
  percentage: number;
}

export interface AnalyticsDailyView {
  date: string;
  views: number;
}

export interface AnalyticsFeedEntry {
  impressions: number;
  choiceClicks: number;
  conversionRate: number;
}

export interface AnalyticsEpisodeResponse {
  totalViews: number;
  uniqueViewers: number;
  completionRate: number;
  replayRate: number;
  funnel: AnalyticsFunnelStep[];
  cutEngagement: AnalyticsCutEngagement[];
  choiceStats: Record<string, AnalyticsChoiceStat[]>;
  endingDistribution: AnalyticsEndingStat[];
  dailyViews: AnalyticsDailyView[];
  feedEntry: AnalyticsFeedEntry;
}

export interface FeedItem {
  publishId: string;
  episodeId: string;
  projectId: string;
  episodeTitle: string;
  projectTitle: string;
  publishedAt: string;
  startCut: Pick<
    PublishManifest['cuts'][number],
    | 'id'
    | 'title'
    | 'body'
    | 'contentBlocks'
    | 'contentViewMode'
    | 'assetUrl'
    | 'dialogAnchorX'
    | 'dialogAnchorY'
    | 'dialogOffsetX'
    | 'dialogOffsetY'
    | 'dialogTextAlign'
    | 'startEffect'
    | 'endEffect'
    | 'startEffectDurationMs'
    | 'endEffectDurationMs'
    | 'edgeFade'
    | 'edgeFadeIntensity'
    | 'marginBottomToken'
  >;
  startChoices: PublishManifest['cuts'][number]['choices'];
}

export interface FeedResponse {
  items: FeedItem[];
  nextCursor: string | null;
}

export interface PublishManifest {
  project: Pick<Project, 'id' | 'title' | 'description' | 'thumbnailUrl' | 'status'>;
  episode: Pick<Episode, 'id' | 'title' | 'episodeNo' | 'status' | 'startCutId'>;
  cuts: Array<{
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
    marginBottomToken?: PromptoonSpacingToken;
    positionX: number;
    positionY: number;
    orderIndex: number;
    isStart: boolean;
    isEnding: boolean;
    choices: Array<{
      id: string;
      label: string;
      orderIndex: number;
      nextCutId: string | null;
      afterSelectReactionText?: string;
    }>;
  }>;
}

export function createLegacyNarrationContentBlock(cutId: string, body: string): PromptoonNarrationContentBlock {
  return {
    id: `${cutId}-legacy-body`,
    type: 'narration',
    text: body,
    textAlign: DEFAULT_CONTENT_TEXT_ALIGN,
    fontToken: DEFAULT_CONTENT_FONT_TOKEN,
    placement: 'flow'
  };
}

export function getNormalizedCutContentBlocks(
  cut: Pick<Cut, 'id' | 'body'> & { contentBlocks?: CutContentBlock[] | null }
): CutContentBlock[] {
  if (cut.contentBlocks && cut.contentBlocks.length > 0) {
    return cut.contentBlocks;
  }

  if (cut.body.trim().length === 0) {
    return [];
  }

  return [createLegacyNarrationContentBlock(cut.id, cut.body)];
}

export function deriveCutBody(contentBlocks: CutContentBlock[], fallback = ''): string {
  const derived = contentBlocks
    .flatMap((block) => {
      switch (block.type) {
        case 'heading':
        case 'narration':
        case 'emphasis':
        case 'dialogue':
          return [block.text.trim()];
        case 'quote':
          return [block.title?.trim() ?? '', block.text.trim()];
        case 'image':
        case 'nameInput':
          return [];
        default:
          return [];
      }
    })
    .filter((value) => value.length > 0)
    .join('\n\n')
    .trim();

  return derived.length > 0 ? derived : fallback;
}
