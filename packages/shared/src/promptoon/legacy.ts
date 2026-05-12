export type PromptoonCutKind =
  | 'scene'
  | 'choice'
  | 'ending'
  | 'transition'
  | 'stateRouter'
  | 'resultCard'
  | 'loopStage'
  | 'loopVariant'
  | 'loopSpacer';
export type PromptoonCutEffect =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out';
export type PromptoonDialogAnchorX = 'left' | 'center' | 'right';
export type PromptoonDialogAnchorY = 'top' | 'upper' | 'center' | 'lower' | 'bottom';
export type PromptoonDialogTextAlign = 'left' | 'center' | 'right';
export type PromptoonContentTextAlign = 'left' | 'center' | 'right';
export type PromptoonContentViewMode = 'default' | 'inverse';
export type PromptoonFontToken = 'sans-kr' | 'serif-kr' | 'display';
export type PromptoonFontSizeToken = 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
export type PromptoonLineHeightToken = 'tight' | 'normal' | 'relaxed' | 'loose';
export type PromptoonSpacingToken = 'none' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | '8xl' | '9xl' | '10xl';
export type PromptoonEdgeFade = 'none' | 'top' | 'bottom' | 'both';
export type PromptoonEdgeFadeIntensity =
  | 'minimal'
  | 'barely-soft'
  | 'ultra-soft'
  | 'very-soft'
  | 'soft'
  | 'semi-soft'
  | 'normal'
  | 'strong';
export type PromptoonEdgeFadeColor = 'black' | 'white';
export type PromptoonContentBindingKey = 'userName';
export type PromptoonContentPlacement = 'overlay' | 'flow';
export type PromptoonContentBlockType =
  | 'heading'
  | 'narration'
  | 'quote'
  | 'emphasis'
  | 'image'
  | 'nameInput'
  | 'dialogue'
  | 'resultCard';
export type PromptoonResultCardTemplateId = 'the-replace-final';
export type PromptoonResultCardTheme = 'blue' | 'gold' | 'violet' | 'red';

export type PromptoonProjectStatus = 'draft' | 'in_review' | 'published' | 'archived';
export type PromptoonEpisodeStatus = 'draft' | 'published';
export type PromptoonEpisodeMode = 'standard' | 'exit_loop';
export type PromptoonPublishStatus = 'published' | 'unpublished';
export type TelemetryEventType = 'cut_view' | 'cut_leave' | 'choice_click' | 'ending_reach' | 'ending_share' | 'feed_impression' | 'feed_choice_click';

export const DEFAULT_CUT_EFFECT_DURATION_MS = 320;
export const MAX_CUT_EFFECT_DURATION_MS = 10000;
export const DEFAULT_NAME_INPUT_MAX_LENGTH = 20;
export const DEFAULT_CONTENT_FONT_TOKEN: PromptoonFontToken = 'sans-kr';
export const DEFAULT_CONTENT_FONT_SIZE: PromptoonFontSizeToken = 'lg';
export const DEFAULT_CONTENT_TEXT_ALIGN: PromptoonContentTextAlign = 'left';
export const DEFAULT_CONTENT_VIEW_MODE: PromptoonContentViewMode = 'default';
export const DEFAULT_CONTENT_LINE_HEIGHT: PromptoonLineHeightToken = 'normal';
export const DEFAULT_CONTENT_SPACING: PromptoonSpacingToken = 'none';
export const DEFAULT_EDGE_FADE: PromptoonEdgeFade = 'none';
export const DEFAULT_EDGE_FADE_INTENSITY: PromptoonEdgeFadeIntensity = 'normal';
export const DEFAULT_EDGE_FADE_COLOR: PromptoonEdgeFadeColor = 'black';

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

export interface PromptoonResultCardContentBlock {
  id: string;
  type: 'resultCard';
  templateId: PromptoonResultCardTemplateId;
  theme: PromptoonResultCardTheme;
  badge: string;
  resultName: string;
  tagline: string;
  lines: string[];
  inflowLabel: string;
  inflowUrl: string;
  inflowBrand: string;
  inflowTagline: string;
}

export type CutContentBlock =
  | PromptoonHeadingContentBlock
  | PromptoonNarrationContentBlock
  | PromptoonQuoteContentBlock
  | PromptoonEmphasisContentBlock
  | PromptoonDialogueContentBlock
  | PromptoonImageContentBlock
  | PromptoonNameInputContentBlock
  | PromptoonResultCardContentBlock;

export interface Project {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  isExperimental?: boolean;
  canManageExperimentalAccess?: boolean;
  kind?: import('./studio').StudioProjectKind;
  status: PromptoonProjectStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithEpisodes extends Project {
  episodes: Episode[];
  movingtoonEpisodes?: import('./studio').MovingtoonEpisodeSummary[];
}

export interface Episode {
  id: string;
  projectId: string;
  title: string;
  episodeNo: number;
  coverImageUrl: string | null;
  startCutId: string | null;
  mode: PromptoonEpisodeMode;
  exitLoopMetadata: ExitLoopEpisodeMetadata | null;
  status: PromptoonEpisodeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ExitLoopEpisodeMetadata {
  enabled?: boolean;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ChoiceStateWrite {
  key: string;
  value: string;
  operation?: 'set' | 'exitLoopDecision';
}

export interface CutStateVariant {
  id: string;
  stateKey: string;
  equals: string;
  variantCutId: string;
  label?: string;
}

export const MAX_CUT_STATE_ROUTE_CONDITIONS = 2;

export interface CutStateCondition {
  stateKey: string;
  equals: string;
}

export interface CutStateRoute {
  id: string;
  stateKey?: string;
  equals?: string;
  conditions?: CutStateCondition[];
  nextCutId: string;
  label?: string;
}

export type PromptoonLoopCutRole = 'stageBase' | 'stageVariant' | 'spacer' | 'resultRouter';
export type PromptoonLoopStageTruth = 'real_anomaly' | 'fake_suspicion';
export type PromptoonLoopChoiceId = 'forward' | 'back';

export interface PromptoonLoopMetadata {
  kind: 'exitLoop';
  groupId: string;
  groupLabel?: string;
  role: PromptoonLoopCutRole;
  stageIndex?: number;
  stageCount?: number;
  truth?: PromptoonLoopStageTruth;
  expectedChoice?: PromptoonLoopChoiceId;
  baseCutId?: string | null;
  selectedVariantCutId?: string | null;
  variantCutIds?: string[];
  exitLevelRequired?: number;
  resetStateOnEnter?: boolean;
  resetStateKeyPrefix?: string;
}

export function getCutStateRouteConditions(
  stateRoute: Pick<CutStateRoute, 'stateKey' | 'equals' | 'conditions'>
): CutStateCondition[] {
  const sourceConditions =
    stateRoute.conditions && stateRoute.conditions.length > 0
      ? stateRoute.conditions
      : [
          {
            stateKey: stateRoute.stateKey ?? '',
            equals: stateRoute.equals ?? ''
          }
        ];

  return sourceConditions
    .map((condition) => ({
      stateKey: condition.stateKey.trim(),
      equals: condition.equals.trim()
    }))
    .filter((condition) => condition.stateKey.length > 0 && condition.equals.length > 0);
}

export function doesCutStateRouteMatch(
  stateRoute: Pick<CutStateRoute, 'stateKey' | 'equals' | 'conditions'>,
  viewerState: Record<string, string>
): boolean {
  const conditions = getCutStateRouteConditions(stateRoute);
  return conditions.length > 0 && conditions.every((condition) => viewerState[condition.stateKey] === condition.equals);
}

export function getCutStateRouteConditionLabel(stateRoute: Pick<CutStateRoute, 'stateKey' | 'equals' | 'conditions'>): string {
  const conditions = getCutStateRouteConditions(stateRoute);
  return conditions.map((condition) => `${condition.stateKey}=${condition.equals}`).join(' + ');
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
  stateWrites?: ChoiceStateWrite[];
  createdAt: string;
  updatedAt: string;
}

export interface PromptoonBackupChoice extends Choice {
  afterSelectDelayMs: number | null;
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
  snsProfileImageUrl?: string | null;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  session?: import('./auth').AuthSession;
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
  surface?: 'home_feed' | 'discovery_feed' | string;
  position?: number;
  trackingToken?: string;
  recommendationRequestId?: string;
  policyId?: string;
  modelVersion?: string;
  experimentId?: string;
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
  | 'invalid_state_variant_target'
  | 'invalid_state_router_target'
  | 'invalid_state_router_condition'
  | 'missing_state_router_route'
  | 'missing_state_router_fallback'
  | 'invalid_loop_metadata'
  | 'invalid_loop_variant_target'
  | 'invalid_loop_stage_choices'
  | 'invalid_loop_state_mapping'
  | 'missing_loop_entry_reset'
  | 'invalid_loop_result_router'
  | 'unreachable_cut'
  | 'dead_path'
  | 'missing_episode_cover';

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
  kind?: import('./studio').StudioProjectKind;
}

export interface PatchProjectRequest {
  title?: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  isExperimental?: boolean;
  kind?: import('./studio').StudioProjectKind;
  status?: import('./studio').StudioProjectStatus;
}

export interface CreateEpisodeRequest {
  title: string;
  episodeNo: number;
  coverImageUrl?: string | null;
  mode?: PromptoonEpisodeMode;
  exitLoopMetadata?: ExitLoopEpisodeMetadata | null;
}

export interface PatchEpisodeRequest {
  title?: string;
  coverImageUrl?: string | null;
  mode?: PromptoonEpisodeMode;
  exitLoopMetadata?: ExitLoopEpisodeMetadata | null;
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
  edgeFadeColor?: PromptoonEdgeFadeColor;
  marginBottomToken?: PromptoonSpacingToken;
  stateVariants?: CutStateVariant[];
  stateRoutes?: CutStateRoute[];
  stateFallbackCutId?: string | null;
  loopMetadata?: PromptoonLoopMetadata | null;
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
  edgeFadeColor?: PromptoonEdgeFadeColor;
  marginBottomToken?: PromptoonSpacingToken;
  stateVariants?: CutStateVariant[];
  stateRoutes?: CutStateRoute[];
  stateFallbackCutId?: string | null;
  loopMetadata?: PromptoonLoopMetadata | null;
  orderIndex?: number;
  positionX?: number;
  positionY?: number;
  isStart?: boolean;
  isEnding?: boolean;
}

export interface DeleteCutRequest {
  reconnectToCutId?: string | null;
}

export interface CreateChoiceRequest {
  label: string;
  orderIndex?: number;
  nextCutId?: string | null;
  afterSelectReactionText?: string;
  stateWrites?: ChoiceStateWrite[];
}

export interface PatchChoiceRequest {
  label?: string;
  orderIndex?: number;
  nextCutId?: string | null;
  afterSelectReactionText?: string;
  stateWrites?: ChoiceStateWrite[];
}

export interface CreateLoopStateSettingStageInput {
  title?: string;
  baseAssetUrl?: string | null;
  variantTitle?: string;
  variantAssetUrl?: string | null;
  variants?: CreateLoopStateSettingVariantInput[];
  spacerTitle?: string;
  spacerAssetUrl?: string | null;
  truth?: PromptoonLoopStageTruth;
}

export interface CreateLoopStateSettingVariantInput {
  title?: string;
  assetUrl?: string | null;
  truth: PromptoonLoopStageTruth;
}

export interface CreateLoopStateSettingRequest {
  groupName: string;
  exitLevelRequired?: number;
  attachAfterCutId?: string | null;
  continuationCutId?: string | null;
  retryCutId?: string | null;
  /** @deprecated Use continuationCutId. */
  successCutId?: string | null;
  /** @deprecated Use retryCutId. */
  failureCutId?: string | null;
  stages: CreateLoopStateSettingStageInput[];
}

export interface CreateLoopStateSettingResponse extends EpisodeDraftResponse {
  groupId: string;
  firstStageCutId: string;
  resultRouterCutId: string;
  continuationCutId: string;
  retryCutId: string;
  /** @deprecated Use continuationCutId. */
  successCutId: string;
  /** @deprecated Use retryCutId. */
  failureCutId: string;
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

export interface PatchEpisodeCutLayoutRequest {
  cuts: Array<{
    cutId: string;
    positionX: number;
    positionY: number;
  }>;
}

export interface PatchEpisodeCutLayoutResponse {
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

export type AnalyticsViewGranularity = 'daily' | 'weekly' | 'monthly';

export interface AnalyticsViewPoint {
  periodStart: string;
  views: number;
  uniqueViewers: number;
}

export interface AnalyticsViewRange {
  from?: string;
  to?: string;
}

export type AnalyticsResetScope = 'all' | 'views' | 'choiceStats' | 'endingDistribution' | 'cutEngagement' | 'feedEntry';

export interface ResetEpisodeAnalyticsRequest {
  scope: AnalyticsResetScope;
}

export interface PromptoonBackupViewerEvent {
  id: string;
  publishId: string;
  episodeId: string;
  anonymousId: string;
  sessionId: string | null;
  eventType: TelemetryEventType;
  cutId: string;
  choiceId?: string;
  durationMs?: number;
  createdAt: string;
}

export interface PromptoonBackupEpisode {
  episode: Episode;
  cuts: Cut[];
  choices: PromptoonBackupChoice[];
  publishes: Publish[];
  viewerEvents: PromptoonBackupViewerEvent[];
}

export interface PromptoonBackupProject {
  project: Project;
  episodes: PromptoonBackupEpisode[];
}

export interface PromptoonBackupExport {
  schemaVersion: 1;
  exportedAt: string;
  ownerId: string;
  projects: PromptoonBackupProject[];
  totals: {
    projects: number;
    episodes: number;
    cuts: number;
    choices: number;
    publishes: number;
    viewerEvents: number;
  };
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
  viewGranularity: AnalyticsViewGranularity;
  viewsByPeriod: AnalyticsViewPoint[];
  feedEntry: AnalyticsFeedEntry;
}

export interface PublishManifest {
  project: Pick<Project, 'id' | 'title' | 'description' | 'thumbnailUrl' | 'status'>;
  episode: Pick<
    Episode,
    'id' | 'title' | 'episodeNo' | 'coverImageUrl' | 'status' | 'startCutId' | 'mode' | 'exitLoopMetadata'
  >;
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
    choices: Array<{
      id: string;
      label: string;
      orderIndex: number;
      nextCutId: string | null;
      afterSelectReactionText?: string;
      stateWrites?: ChoiceStateWrite[];
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
        case 'resultCard':
          return [block.resultName.trim(), block.tagline.trim(), ...block.lines.map((line) => line.trim())];
        default:
          return [];
      }
    })
    .filter((value) => value.length > 0)
    .join('\n\n')
    .trim();

  return derived.length > 0 ? derived : fallback;
}
