import type { CookieOptions } from 'express';

export function createAuthCookieOptions(
  nodeEnv: string | undefined,
  maxAge?: number,
): CookieOptions {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    priority: 'high',
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}
