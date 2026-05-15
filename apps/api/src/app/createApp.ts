import express from 'express';
import type { Express } from 'express';
import { ZodError } from 'zod';

import { isHttpError } from '../lib/http-error';
import { resolveFromApiRoot, resolveFromWorkspaceRoot } from '../lib/workspace-paths';
import { createAuthRouter } from '../modules/auth/auth.routes';
import { createAdminRouter } from '../modules/admin/admin.routes';
import { createChannelRouter, createMeChannelRouter } from '../modules/channel/channel.routes';
import { createCommunityRouter } from '../modules/community/community.routes';
import { createExperimentalRouter } from '../modules/experimental/experimental.routes';
import { createFeedRouter } from '../modules/feed/feed.routes';
import { createLandingRouter } from '../modules/landing/landing.routes';
import { createPlatformAccessRouter } from '../modules/platform-access/platform-access.routes';
import { createLegacyPromptoonRouter } from '../modules/promptoon-authoring/promptoon.routes';
import { createStudioRouter } from '../modules/studio/studio.routes';
import { createTelemetryRouter } from '../modules/telemetry/telemetry.routes';
import { createViewerRouter } from '../modules/viewer/viewer.routes';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', true);
  app.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use(express.json());
  app.use('/uploads', express.static(resolveFromWorkspaceRoot('.data/uploads')));
  app.use('/uploads', express.static(resolveFromApiRoot('.data/uploads')));

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.use('/api/auth', createAuthRouter());
  app.use('/api/admin', createAdminRouter());
  app.use('/api/experimental', createExperimentalRouter());
  app.use('/api/feed', createFeedRouter());
  app.use('/api/landing', createLandingRouter());
  app.use('/api/platform-access', createPlatformAccessRouter());
  app.use('/api/me/channel', createMeChannelRouter());
  app.use('/api/channels', createChannelRouter());
  app.use('/api/viewer', createViewerRouter());
  app.use('/api/studio', createStudioRouter());
  app.use('/api/community', createCommunityRouter());
  app.use('/api/telemetry', createTelemetryRouter());
  app.use('/api/promptoon/auth', createAuthRouter());
  app.use('/api/promptoon', createLegacyPromptoonRouter());

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: 'Invalid request.',
        details: error.flatten()
      });
      return;
    }

    if (isHttpError(error)) {
      response.status(error.statusCode).json({
        error: error.message,
        details: error.details
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
