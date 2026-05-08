import { recommendationFeedRequestSchema, type RecommendationFeedResponse } from '@promptoon/recommendation-contract';
import express from 'express';
import type { Express } from 'express';
import { ZodError } from 'zod';

export interface RecommendationAppService {
  recommendFeed(request: unknown): Promise<RecommendationFeedResponse>;
}

export function createApp(service: RecommendationAppService): Express {
  const app = express();

  app.set('trust proxy', true);
  app.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.post('/recommendations/v1/feed', async (request, response, next) => {
    try {
      const body = recommendationFeedRequestSchema.parse(request.body);
      response.json(await service.recommendFeed(body));
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: 'Invalid request.',
        details: error.flatten()
      });
      return;
    }

    console.error(error);
    response.status(500).json({
      error: 'Internal server error.'
    });
  });

  return app;
}
