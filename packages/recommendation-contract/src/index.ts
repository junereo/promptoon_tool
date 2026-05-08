import { z } from 'zod';

export const recommendationSurfaceSchema = z.enum(['home_feed', 'discovery_feed']);
export type RecommendationSurface = z.infer<typeof recommendationSurfaceSchema>;

export const recommendationContentTypeSchema = z.enum(['promptoon', 'webtoon_episode', 'short_drama']);
export type RecommendationContentType = z.infer<typeof recommendationContentTypeSchema>;

export const recommendationDeviceSchema = z.enum(['mobile', 'desktop', 'tablet', 'unknown']).default('unknown');
export type RecommendationDevice = z.infer<typeof recommendationDeviceSchema>;

export const recommendationUserSchema = z.object({
  userId: z.string().trim().min(1).nullable().optional(),
  anonymousId: z.string().uuid().nullable().optional(),
  isLoggedIn: z.boolean().default(false)
});
export type RecommendationUser = z.infer<typeof recommendationUserSchema>;

export const recommendationFeedRequestSchema = z.object({
  user: recommendationUserSchema.default({
    userId: null,
    anonymousId: null,
    isLoggedIn: false
  }),
  context: z.object({
    surface: recommendationSurfaceSchema,
    device: recommendationDeviceSchema,
    locale: z.string().trim().min(2).max(32).default('ko-KR'),
    cursor: z.string().trim().min(1).nullable().optional(),
    limit: z.number().int().min(1).max(50).default(20)
  }),
  constraints: z.object({
    contentTypes: z.array(recommendationContentTypeSchema).max(10).optional(),
    excludePublishIds: z.array(z.string().uuid()).max(200).default([]),
    safeMode: z.boolean().default(true)
  }).default({
    excludePublishIds: [],
    safeMode: true
  })
});
export type RecommendationFeedRequest = z.infer<typeof recommendationFeedRequestSchema>;

export const recommendedItemSchema = z.object({
  publishId: z.string().uuid(),
  rank: z.number().int().min(1),
  score: z.number(),
  source: z.string().min(1),
  reason: z.string().min(1),
  trackingToken: z.string().min(1)
});
export type RecommendedItem = z.infer<typeof recommendedItemSchema>;

export const recommendationFeedResponseSchema = z.object({
  requestId: z.string().uuid(),
  policyId: z.string().min(1),
  modelVersion: z.string().min(1),
  experimentId: z.string().min(1),
  items: z.array(recommendedItemSchema),
  nextCursor: z.string().nullable()
});
export type RecommendationFeedResponse = z.infer<typeof recommendationFeedResponseSchema>;
