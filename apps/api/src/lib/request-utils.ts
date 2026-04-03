import type { Request } from 'express';

import { HttpError } from './http-error';

export function getRequiredUserId(request: Request): string {
  const userId = request.header('x-user-id');
  if (!userId) {
    throw new HttpError(400, 'Missing required x-user-id header.');
  }

  return userId;
}

