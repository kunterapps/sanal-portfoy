/**
 * Google sign-in helper for the optional Google Drive sync. The browser gets
 * an authorization code from Google; exchanging it (and later refreshing the
 * access token) needs the OAuth client secret, so that part runs here. Nothing
 * is stored on the server: the refresh token goes back to the browser, and
 * portfolio data goes straight from the browser to the user's own Drive.
 */
import type { ApiResult } from './priceApi.ts';

export interface GoogleAuthEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

type FetchFn = typeof fetch;

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

interface TokenBody {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

/** Reads the e-mail address out of the ID token Google returned with the tokens (already trusted, it came from Google over TLS). */
export function emailFromIdToken(idToken: string | undefined): string | null {
  const payload = idToken?.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.email === 'string' ? json.email : null;
  } catch {
    return null;
  }
}

async function postForm(fetchFn: FetchFn, url: string, form: Record<string, string>) {
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
  let body: TokenBody = {};
  try {
    body = (await res.json()) as TokenBody;
  } catch {}
  return { ok: res.ok, status: res.status, body };
}

function tokenResult(r: { ok: boolean; status: number; body: TokenBody }): ApiResult {
  if (!r.ok || !r.body.access_token) {
    // invalid_grant: the user revoked access or the refresh token expired; the app asks to sign in again
    const status = r.body.error === 'invalid_grant' ? 401 : 502;
    return { status, body: { error: r.body.error || 'token_error' } };
  }
  return {
    status: 200,
    body: {
      accessToken: r.body.access_token,
      expiresIn: r.body.expires_in ?? 3600,
      ...(r.body.refresh_token && { refreshToken: r.body.refresh_token }),
      email: emailFromIdToken(r.body.id_token),
    },
  };
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Handles /api/google/*. Returns null for other paths. `allowedOrigins` limits
 * which sites may ask for a code exchange (the redirect URI must be on one of them).
 */
export async function handleGoogleAuthRequest(
  request: Request,
  env: GoogleAuthEnv,
  allowedOrigins: string[],
  fetchFn: FetchFn = fetch
): Promise<ApiResult | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/google/')) return null;
  const clientId = env.GOOGLE_CLIENT_ID?.trim() || '';
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() || '';

  if (url.pathname === '/api/google/config') {
    if (request.method !== 'GET') return { status: 405, body: { error: 'Yalnızca GET desteklenir' } };
    return { status: 200, body: { clientId: clientId && clientSecret ? clientId : null } };
  }

  if (request.method !== 'POST') return { status: 405, body: { error: 'Yalnızca POST desteklenir' } };
  if (!clientId || !clientSecret) return { status: 503, body: { error: 'Google girişi yapılandırılmamış' } };
  const body = await readJson(request);
  if (!body) return { status: 400, body: { error: 'Geçersiz istek' } };

  try {
    if (url.pathname === '/api/google/token') {
      const code = typeof body.code === 'string' ? body.code : '';
      const redirectUri = typeof body.redirectUri === 'string' ? body.redirectUri : '';
      let redirectOrigin = '';
      try {
        redirectOrigin = new URL(redirectUri).origin;
      } catch {}
      if (!code || !redirectOrigin || !(allowedOrigins.includes('*') || allowedOrigins.includes(redirectOrigin))) {
        return { status: 400, body: { error: 'Geçersiz istek' } };
      }
      return tokenResult(
        await postForm(fetchFn, TOKEN_URL, {
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        })
      );
    }

    if (url.pathname === '/api/google/refresh') {
      const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';
      if (!refreshToken) return { status: 400, body: { error: 'Geçersiz istek' } };
      return tokenResult(
        await postForm(fetchFn, TOKEN_URL, {
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        })
      );
    }

    if (url.pathname === '/api/google/revoke') {
      const token = typeof body.token === 'string' ? body.token : '';
      if (!token) return { status: 400, body: { error: 'Geçersiz istek' } };
      const r = await postForm(fetchFn, REVOKE_URL, { token });
      // An already invalid token counts as revoked
      return { status: 200, body: { revoked: r.ok || r.status === 400 } };
    }
  } catch {
    return { status: 502, body: { error: 'Google’a ulaşılamadı' } };
  }

  return { status: 404, body: { error: 'Bilinmeyen uç nokta' } };
}
