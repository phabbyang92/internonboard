import type { NextFunction, Request, Response } from 'express';
import {
  requestIdMiddleware,
  type RequestWithId,
} from './request-id.middleware';

describe('requestIdMiddleware', () => {
  it('keeps a safe caller request id', () => {
    const request = {
      header: jest.fn().mockReturnValue('release-check-123'),
    } as unknown as RequestWithId;
    const setHeader = jest.fn();
    const response = { setHeader } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requestIdMiddleware(request, response, next);

    expect(request.requestId).toBe('release-check-123');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'release-check-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('replaces malformed request ids with a generated UUID', () => {
    const request = {
      header: jest.fn().mockReturnValue('bad id with spaces'),
    } as unknown as Request;
    const response = { setHeader: jest.fn() } as unknown as Response;

    requestIdMiddleware(
      request as RequestWithId,
      response,
      jest.fn() as NextFunction,
    );

    expect((request as RequestWithId).requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/,
    );
  });
});
