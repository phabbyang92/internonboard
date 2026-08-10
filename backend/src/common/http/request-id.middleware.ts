import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const SAFE_REQUEST_ID = /^[a-zA-Z0-9_-]{8,128}$/;

export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestIdMiddleware(
  request: RequestWithId,
  response: Response,
  next: NextFunction,
): void {
  const provided = request.header('x-request-id');
  const requestId =
    provided && SAFE_REQUEST_ID.test(provided) ? provided : randomUUID();

  request.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
}
