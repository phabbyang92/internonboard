import { createAuthCookieOptions } from './auth-cookie.options';

describe('createAuthCookieOptions', () => {
  it('uses HttpOnly, SameSite and non-secure cookies during local development', () => {
    expect(createAuthCookieOptions('development', 60_000)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      priority: 'high',
      maxAge: 60_000,
    });
  });

  it('requires HTTPS for production authentication cookies', () => {
    expect(createAuthCookieOptions('production')).toEqual(
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      }),
    );
  });
});
