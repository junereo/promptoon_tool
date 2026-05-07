import { z } from 'zod';
import type { ExitLoopEpisodeMetadata } from '@promptoon/shared';
import { MAX_CUT_STATE_ROUTE_CONDITIONS } from '@promptoon/shared';

const uuidSchema = z.string().uuid();
const cutEffectSchema = z.enum(['none', 'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom-in', 'zoom-out']);
const contentViewModeSchema = z.enum(['default', 'inverse']);
const contentTextAlignSchema = z.enum(['left', 'center', 'right']);
const contentPlacementSchema = z.enum(['overlay', 'flow']);
const fontSizeTokenSchema = z.enum(['sm', 'base', 'lg', 'xl', '2xl', '3xl']);
const fontTokenSchema = z.enum(['sans-kr', 'serif-kr', 'display']);
const lineHeightTokenSchema = z.enum(['tight', 'normal', 'relaxed', 'loose']);
const spacingTokenSchema = z.enum(['none', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl', '10xl']);
const edgeFadeSchema = z.enum(['none', 'top', 'bottom', 'both']);
const edgeFadeIntensitySchema = z.enum(['minimal', 'barely-soft', 'ultra-soft', 'very-soft', 'soft', 'semi-soft', 'normal', 'strong']);
const edgeFadeColorSchema = z.enum(['black', 'white']);
const dialogAnchorYSchema = z.enum(['top', 'upper', 'center', 'lower', 'bottom']);
const bindingKeySchema = z.enum(['userName']);
const resultCardThemeSchema = z.enum(['blue', 'gold', 'violet', 'red']);
const episodeModeSchema = z.enum(['standard', 'exit_loop']);
const studioProjectKindSchema = z.enum(['promptoon', 'movingtoon', 'hybrid']);
const studioProjectStatusSchema = z.enum(['draft', 'in_review', 'published', 'archived']);
export const movingtoonAspectRatioSchema = z.enum(['9:16', '16:9', '1:1']);
const exitLoopMetadataSchema: z.ZodType<ExitLoopEpisodeMetadata> = z
  .object({
    enabled: z.boolean().optional(),
    updatedAt: z.string().optional()
  })
  .catchall(z.unknown());
const cutKindSchema = z.enum([
  'scene',
  'choice',
  'ending',
  'transition',
  'stateRouter',
  'resultCard',
  'loopStage',
  'loopVariant',
  'loopSpacer'
]);
const loopTruthSchema = z.enum(['real_anomaly', 'fake_suspicion']);
const loopChoiceIdSchema = z.enum(['forward', 'back']);
const stateKeySchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_.-]+$/);
const stateValueSchema = z.string().trim().min(1).max(128);
const loopMetadataSchema = z.object({
  kind: z.literal('exitLoop'),
  groupId: stateKeySchema,
  groupLabel: z.string().trim().min(1).max(120).optional(),
  role: z.enum(['stageBase', 'stageVariant', 'spacer', 'resultRouter']),
  stageIndex: z.number().int().min(1).max(99).optional(),
  stageCount: z.number().int().min(1).max(99).optional(),
  truth: loopTruthSchema.optional(),
  expectedChoice: loopChoiceIdSchema.optional(),
  baseCutId: uuidSchema.nullable().optional(),
  selectedVariantCutId: uuidSchema.nullable().optional(),
  variantCutIds: z.array(uuidSchema).max(20).optional(),
  exitLevelRequired: z.number().int().min(1).max(99).optional(),
  resetStateOnEnter: z.boolean().optional(),
  resetStateKeyPrefix: stateKeySchema.optional()
});
const choiceStateWriteSchema = z.object({
  key: stateKeySchema,
  value: stateValueSchema,
  operation: z.enum(['set', 'exitLoopDecision']).optional()
});
const cutStateVariantSchema = z.object({
  id: z.string().trim().min(1).max(128),
  stateKey: stateKeySchema,
  equals: stateValueSchema,
  variantCutId: uuidSchema,
  label: z.string().trim().max(120).optional()
});
const cutStateRouteConditionSchema = z.object({
  stateKey: stateKeySchema,
  equals: stateValueSchema
});
const cutStateRouteSchema = z.object({
  id: z.string().trim().min(1).max(128),
  stateKey: stateKeySchema.optional(),
  equals: stateValueSchema.optional(),
  conditions: z.array(cutStateRouteConditionSchema).min(1).max(MAX_CUT_STATE_ROUTE_CONDITIONS).optional(),
  nextCutId: uuidSchema,
  label: z.string().trim().max(120).optional()
}).superRefine((value, context) => {
  const hasLegacyStateKey = value.stateKey !== undefined;
  const hasLegacyEquals = value.equals !== undefined;
  const hasLegacyCondition = hasLegacyStateKey && hasLegacyEquals;

  if ((hasLegacyStateKey || hasLegacyEquals) && !hasLegacyCondition) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Both stateKey and equals are required for a legacy state route condition.',
      path: hasLegacyStateKey ? ['equals'] : ['stateKey']
    });
  }

  if (!value.conditions && !hasLegacyCondition) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one state route condition is required.',
      path: ['conditions']
    });
  }
});
const contentBlockBaseSchema = z.object({
  id: z.string().trim().min(1)
});
const textContentBlockSchema = contentBlockBaseSchema.extend({
  text: z.string(),
  textAlign: contentTextAlignSchema,
  fontToken: fontTokenSchema,
  placement: contentPlacementSchema.optional(),
  fontSizeToken: fontSizeTokenSchema.optional(),
  lineHeightToken: lineHeightTokenSchema.optional(),
  marginTopToken: spacingTokenSchema.optional(),
  marginBottomToken: spacingTokenSchema.optional(),
  speaker: z.string().optional()
});
const headingContentBlockSchema = textContentBlockSchema.extend({
  type: z.literal('heading')
});
const narrationContentBlockSchema = textContentBlockSchema.extend({
  type: z.literal('narration')
});
const quoteContentBlockSchema = textContentBlockSchema.extend({
  type: z.literal('quote'),
  title: z.string().optional()
});
const emphasisContentBlockSchema = textContentBlockSchema.extend({
  type: z.literal('emphasis')
});
const dialogueContentBlockSchema = textContentBlockSchema.extend({
  type: z.literal('dialogue')
});
const imageContentBlockSchema = contentBlockBaseSchema.extend({
  type: z.literal('image'),
  assetUrl: z.string().trim().nullable(),
  alt: z.string()
});
const nameInputContentBlockSchema = contentBlockBaseSchema.extend({
  type: z.literal('nameInput'),
  placeholder: z.string(),
  maxLength: z.number().int().min(1).max(120),
  required: z.boolean(),
  bindingKey: bindingKeySchema
});
const resultCardContentBlockSchema = contentBlockBaseSchema.extend({
  type: z.literal('resultCard'),
  templateId: z.literal('the-replace-final'),
  theme: resultCardThemeSchema,
  badge: z.string().trim().max(40),
  resultName: z.string().trim().max(80),
  tagline: z.string().trim().max(160),
  lines: z.array(z.string().trim().max(160)).max(6),
  inflowLabel: z.string().trim().max(40),
  inflowUrl: z.string().trim().max(120),
  inflowBrand: z.string().trim().max(40),
  inflowTagline: z.string().trim().max(80)
});
const contentBlockSchema = z.discriminatedUnion('type', [
  headingContentBlockSchema,
  narrationContentBlockSchema,
  quoteContentBlockSchema,
  emphasisContentBlockSchema,
  dialogueContentBlockSchema,
  imageContentBlockSchema,
  nameInputContentBlockSchema,
  resultCardContentBlockSchema
]);
const cutEffectDurationSchema = z.number().int().min(0).max(10000);

export const createProjectSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  kind: studioProjectKindSchema.optional()
});

export const patchProjectSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  thumbnailUrl: z.string().trim().nullable().optional(),
  kind: studioProjectKindSchema.optional(),
  status: studioProjectStatusSchema.optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one project field is required.'
});

export const createMovingtoonEpisodeSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  episodeNumber: z.coerce.number().int().positive(),
  aspectRatio: movingtoonAspectRatioSchema.default('9:16')
});

export const createEpisodeSchema = z.object({
  title: z.string().trim().min(1),
  episodeNo: z.number().int().positive(),
  coverImageUrl: z.string().trim().nullable().optional(),
  mode: episodeModeSchema.optional(),
  exitLoopMetadata: exitLoopMetadataSchema.nullable().optional()
});

export const patchEpisodeSchema = z.object({
  title: z.string().trim().min(1).optional(),
  coverImageUrl: z.string().trim().nullable().optional(),
  mode: episodeModeSchema.optional(),
  exitLoopMetadata: exitLoopMetadataSchema.nullable().optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one episode field is required.'
});

export const createCutSchema = z.object({
  kind: cutKindSchema,
  title: z.string().trim().min(1),
  body: z.string().optional(),
  contentBlocks: z.array(contentBlockSchema).optional(),
  contentViewMode: contentViewModeSchema.optional(),
  dialogAnchorX: z.enum(['left', 'center', 'right']).optional(),
  dialogAnchorY: dialogAnchorYSchema.optional(),
  dialogOffsetX: z.number().finite().optional(),
  dialogOffsetY: z.number().finite().optional(),
  dialogTextAlign: z.enum(['left', 'center', 'right']).optional(),
  startEffect: cutEffectSchema.optional(),
  endEffect: cutEffectSchema.optional(),
  startEffectDurationMs: cutEffectDurationSchema.optional(),
  endEffectDurationMs: cutEffectDurationSchema.optional(),
  assetUrl: z.string().trim().nullable().optional(),
  edgeFade: edgeFadeSchema.optional(),
  edgeFadeIntensity: edgeFadeIntensitySchema.optional(),
  edgeFadeColor: edgeFadeColorSchema.optional(),
  marginBottomToken: spacingTokenSchema.optional(),
  stateVariants: z.array(cutStateVariantSchema).max(20).optional(),
  stateRoutes: z.array(cutStateRouteSchema).max(20).optional(),
  stateFallbackCutId: uuidSchema.nullable().optional(),
  loopMetadata: loopMetadataSchema.nullable().optional(),
  orderIndex: z.number().int().min(0).optional(),
  positionX: z.number().finite().optional(),
  positionY: z.number().finite().optional(),
  isStart: z.boolean().optional(),
  isEnding: z.boolean().optional()
});

export const patchCutSchema = createCutSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one cut field is required.'
});

export const deleteCutSchema = z.object({
  reconnectToCutId: uuidSchema.nullable().optional()
});

export const createChoiceSchema = z.object({
  label: z.string().trim().min(1),
  orderIndex: z.number().int().min(0).optional(),
  nextCutId: uuidSchema.nullable().optional(),
  afterSelectReactionText: z.string().optional(),
  stateWrites: z.array(choiceStateWriteSchema).max(20).optional()
});

export const patchChoiceSchema = createChoiceSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one choice field is required.'
});

const loopStateSettingVariantSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  assetUrl: z.string().trim().nullable().optional(),
  truth: loopTruthSchema
});

const loopStateSettingStageSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  baseAssetUrl: z.string().trim().nullable().optional(),
  variantTitle: z.string().trim().min(1).max(120).optional(),
  variantAssetUrl: z.string().trim().nullable().optional(),
  variants: z.array(loopStateSettingVariantSchema).max(20).optional(),
  spacerTitle: z.string().trim().min(1).max(120).optional(),
  spacerAssetUrl: z.string().trim().nullable().optional(),
  truth: loopTruthSchema.optional()
});

export const createLoopStateSettingSchema = z.object({
  groupName: z.string().trim().min(1).max(80),
  exitLevelRequired: z.number().int().min(1).max(99).optional(),
  attachAfterCutId: uuidSchema.nullable().optional(),
  continuationCutId: uuidSchema.nullable().optional(),
  retryCutId: uuidSchema.nullable().optional(),
  successCutId: uuidSchema.nullable().optional(),
  failureCutId: uuidSchema.nullable().optional(),
  stages: z.array(loopStateSettingStageSchema).min(1).max(12)
});

export const reorderEpisodeCutsSchema = z.object({
  cuts: z
    .array(
      z.object({
        cutId: uuidSchema,
        orderIndex: z.number().int().min(0)
      })
    )
    .min(1)
});

export const patchEpisodeCutLayoutSchema = z.object({
  cuts: z
    .array(
      z.object({
        cutId: uuidSchema,
        positionX: z.number().finite(),
        positionY: z.number().finite()
      })
    )
    .min(1)
});

export const publishSchema = z.object({
  episodeId: uuidSchema
});

export const telemetryEventSchema = z.object({
  publishId: uuidSchema,
  anonymousId: uuidSchema,
  sessionId: uuidSchema,
  eventType: z.enum(['cut_view', 'cut_leave', 'choice_click', 'ending_reach', 'ending_share', 'feed_impression', 'feed_choice_click']),
  cutId: uuidSchema,
  choiceId: uuidSchema.optional(),
  durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).optional()
}).superRefine((value, context) => {
  if ((value.eventType === 'choice_click' || value.eventType === 'feed_choice_click') && !value.choiceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'choiceId is required for choice click events.',
      path: ['choiceId']
    });
  }
});

const analyticsDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Expected a valid YYYY-MM-DD date.');

export const analyticsQuerySchema = z.object({
  viewsGranularity: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  viewsFrom: analyticsDateSchema.optional(),
  viewsTo: analyticsDateSchema.optional()
}).superRefine((value, context) => {
  if (value.viewsFrom && value.viewsTo && value.viewsFrom > value.viewsTo) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'viewsFrom must be before or equal to viewsTo.',
      path: ['viewsFrom']
    });
  }
});

export const resetEpisodeAnalyticsSchema = z.object({
  scope: z.enum(['all', 'views', 'choiceStats', 'endingDistribution', 'cutEngagement', 'feedEntry'])
});

const assignableProjectRoleSchema = z.enum(['producer', 'writer', 'viewer']);

export const upsertProjectMemberSchema = z.object({
  loginId: z.string().trim().min(8),
  role: assignableProjectRoleSchema
});

export const patchProjectMemberSchema = z.object({
  role: assignableProjectRoleSchema
});

export const feedQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10)
});

export const uuidParamSchema = z.object({
  projectId: uuidSchema.optional(),
  episodeId: uuidSchema.optional(),
  cutId: uuidSchema.optional(),
  choiceId: uuidSchema.optional(),
  publishId: uuidSchema.optional()
});
