import express from 'express';
import type { Express } from 'express';
import path from 'node:path';
import { ZodError } from 'zod';

import { isHttpError } from '../lib/http-error';
import { createAuthRouter } from '../modules/auth/auth.routes';
import { createPromptoonRouter } from '../modules/promptoon-authoring/promptoon.routes';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/uploads', express.static(path.resolve(process.cwd(), '.data/uploads')));

  app.get('/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.use('/api/promptoon/auth', createAuthRouter());
  app.use('/api/promptoon', createPromptoonRouter());

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
