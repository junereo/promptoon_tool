import { z } from 'zod';

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
const contentBlockSchema = z.discriminatedUnion('type', [
  headingContentBlockSchema,
  narrationContentBlockSchema,
  quoteContentBlockSchema,
  emphasisContentBlockSchema,
  dialogueContentBlockSchema,
  imageContentBlockSchema,
  nameInputContentBlockSchema
]);
const cutEffectDurationSchema = z.number().int().min(0).max(10000);

export const createProjectSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional()
});

export const createEpisodeSchema = z.object({
  title: z.string().trim().min(1),
  episodeNo: z.number().int().positive(),
  coverImageUrl: z.string().trim().nullable().optional()
});

export const patchEpisodeSchema = z.object({
  title: z.string().trim().min(1).optional(),
  coverImageUrl: z.string().trim().nullable().optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one episode field is required.'
});

export const createCutSchema = z.object({
  kind: z.enum(['scene', 'choice', 'ending', 'transition']),
  title: z.string().trim().min(1),
  body: z.string().optional(),
  contentBlocks: z.array(contentBlockSchema).optional(),
  contentViewMode: contentViewModeSchema.optional(),
  dialogAnchorX: z.enum(['left', 'center', 'right']).optional(),
  dialogAnchorY: dialogAnchorYSchema.optional(),
  dialogOffsetX: z.number().finite().min(0).max(160).optional(),
  dialogOffsetY: z.number().finite().min(0).max(160).optional(),
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
  afterSelectReactionText: z.string().optional()
});

export const patchChoiceSchema = createChoiceSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one choice field is required.'
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
