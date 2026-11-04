import { describe, expect, it, vi } from 'vitest';
import { emailFromIdToken, handleGoogleAuthRequest } from '../../server/googleAuth';
import { handleWorkerRequest } from '../../worker/index';

const env = { GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'secret' };
const origins = ['https://sanal-portfoy.pages.dev'];
const b64url = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const idToken = `x.${b64url({ email: 'levent@example.com' })}.y`;

const post = (path: string, body: unknown) =>
  new Request(`https://w.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://sanal-portfoy.pages.dev' },
    body: JSON.stringify(body),
  });

const googleReplies = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('google auth endpoints', () => {
  it('reports the client id only when fully configured', async () => {
    const get = new Request('https://w.example/api/google/config');
    expect((await handleGoogleAuthRequest(get, env, origins))?.body).toEqual({ clientId: env.GOOGLE_CLIENT_ID });
    expect((await handleGoogleAuthRequest(get, { GOOGLE_CLIENT_ID: 'x' }, origins))?.body).toEqual({ clientId: null });
    expect(await handleGoogleAuthRequest(new Request('https://w.example/api/quote'), env, origins)).toBeNull();
  });

  it('exchanges a code for tokens with the secret', async () => {
    const fetchFn = googleReplies(200, { access_token: 'at', expires_in: 3599, refresh_token: 'rt', id_token: idToken });
    const result = await handleGoogleAuthRequest(
      post('/api/google/token', { code: 'c0de', redirectUri: 'https://sanal-portfoy.pages.dev/' }),
      env,
      origins,
      fetchFn
    );
    expect(result).toEqual({
      status: 200,
      body: { accessToken: 'at', expiresIn: 3599, refreshToken: 'rt', email: 'levent@example.com' },
    });
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const sent = new URLSearchParams(String(init.body));
    expect(sent.get('client_secret')).toBe('secret');
    expect(sent.get('grant_type')).toBe('authorization_code');
    expect(sent.get('redirect_uri')).toBe('https://sanal-portfoy.pages.dev/');
  });

  it('refuses redirect URIs on other sites', async () => {
    const fetchFn = googleReplies(200, {});
    const result = await handleGoogleAuthRequest(
      post('/api/google/token', { code: 'c', redirectUri: 'https://evil.example/' }),
      env,
      origins,
      fetchFn
    );
    expect(result?.status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('maps a revoked refresh token to 401', async () => {
    const result = await handleGoogleAuthRequest(
      post('/api/google/refresh', { refreshToken: 'old' }),
      env,
      origins,
      googleReplies(400, { error: 'invalid_grant' })
    );
    expect(result).toEqual({ status: 401, body: { error: 'invalid_grant' } });
  });

  it('is not configured without the secret', async () => {
    const result = await handleGoogleAuthRequest(post('/api/google/refresh', { refreshToken: 'x' }), { GOOGLE_CLIENT_ID: 'x' }, origins);
    expect(result?.status).toBe(503);
  });

  it('reads the e-mail from an id token', () => {
    expect(emailFromIdToken(idToken)).toBe('levent@example.com');
    expect(emailFromIdToken('garbage')).toBeNull();
    expect(emailFromIdToken(undefined)).toBeNull();
  });

  it('is served by the worker with CORS for POST and never cached', async () => {
    const workerEnv = { ...env, ALLOWED_ORIGINS: 'https://sanal-portfoy.pages.dev' };
    const preflight = await handleWorkerRequest(
      new Request('https://w.example/api/google/token', { method: 'OPTIONS', headers: { Origin: 'https://sanal-portfoy.pages.dev' } }),
      workerEnv
    );
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    const res = await handleWorkerRequest(
      post('/api/google/refresh', { refreshToken: 'r' }),
      workerEnv,
      undefined,
      googleReplies(200, { access_token: 'at', expires_in: 3600 })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ accessToken: 'at' });
  });
});
