/**
 * Google sign-in and Google Drive calls for the optional sync.
 *
 * Sign-in is a full-page redirect to Google (no pop-ups to be blocked on
 * phones). The code Google sends back is exchanged for tokens by the price
 * Worker, which holds the OAuth client secret; the refresh token is kept in
 * this browser only. Portfolio data is written straight from the browser to
 * the hidden app folder (appDataFolder) of the user's own Drive: the app can
 * see only the files it created there, not the rest of the Drive.
 */
import { PRICE_API_BASE } from './marketDataService';

const SCOPE = 'openid email https://www.googleapis.com/auth/drive.appdata';
export const SYNC_FILE_NAME = 'sanal-portfoy.json';
const STATE_KEY = 'my_personal_portfolio_oauth_state';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

/** The user has to sign in again (access revoked, refresh token expired) */
export class AuthExpiredError extends Error {}

export interface GoogleTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  email?: string | null;
}

export interface DriveFileMeta {
  id: string;
  modifiedTime: string;
}

let clientIdPromise: Promise<string | null> | null = null;

/** The OAuth client ID if the Worker has Google sign-in configured, otherwise null (sync is then not offered) */
export function fetchGoogleClientId(): Promise<string | null> {
  clientIdPromise ??= fetch(`${PRICE_API_BASE}/api/google/config`)
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => (body && typeof body.clientId === 'string' && body.clientId ? body.clientId : null))
    .catch(() => {
      clientIdPromise = null; // try again next time
      return null;
    });
  return clientIdPromise;
}

export const googleRedirectUri = () => new URL(import.meta.env.BASE_URL || '/', window.location.origin).href;

export function startGoogleSignIn(clientId: string) {
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  try {
    sessionStorage.setItem(STATE_KEY, state);
  } catch {}
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    // Always show consent so Google sends a refresh token every time
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

/**
 * Picks up Google's answer after the redirect back to the site and removes it
 * from the address bar. Returns null when the page wasn't opened by Google.
 */
export function takeSignInRedirect(): { code: string } | { error: string } | null {
  const params = new URLSearchParams(window.location.search);
  const state = params.get('state');
  const code = params.get('code');
  const error = params.get('error');
  if (!state || (!code && !error)) return null;
  let expected: string | null = null;
  try {
    expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
  } catch {}
  ['code', 'state', 'scope', 'error', 'authuser', 'prompt', 'hd', 'iss'].forEach((k) => params.delete(k));
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  if (state !== expected) return { error: 'state_mismatch' };
  return code ? { code } : { error: error || 'unknown' };
}

async function postAuth(path: string, body: unknown): Promise<GoogleTokens> {
  const res = await fetch(`${PRICE_API_BASE}/api/google/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new AuthExpiredError('Google oturumu sona erdi');
  if (!res.ok) throw new Error(`Google girişi başarısız (${res.status})`);
  return (await res.json()) as GoogleTokens;
}

export const exchangeGoogleCode = (code: string) => postAuth('token', { code, redirectUri: googleRedirectUri() });
export const refreshGoogleToken = (refreshToken: string) => postAuth('refresh', { refreshToken });

export async function revokeGoogleToken(token: string) {
  try {
    await fetch(`${PRICE_API_BASE}/api/google/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch {}
}

async function driveFetch(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new AuthExpiredError('Drive erişim anahtarı geçersiz');
  if (!res.ok) throw new Error(`Google Drive hatası (${res.status})`);
  return res;
}

export async function findSyncFile(token: string): Promise<DriveFileMeta | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${SYNC_FILE_NAME}' and trashed=false`,
    fields: 'files(id,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '10',
  });
  const res = await driveFetch(token, `${DRIVE_FILES}?${params}`);
  const body = (await res.json()) as { files?: DriveFileMeta[] };
  return body.files?.[0] ?? null;
}

export async function downloadSyncFile(token: string, id: string): Promise<unknown> {
  const res = await driveFetch(token, `${DRIVE_FILES}/${encodeURIComponent(id)}?alt=media`);
  return res.json();
}

export async function uploadSyncFile(token: string, id: string | null, content: unknown): Promise<DriveFileMeta> {
  const json = JSON.stringify(content);
  if (id) {
    const res = await driveFetch(token, `${DRIVE_UPLOAD}/${encodeURIComponent(id)}?uploadType=media&fields=id,modifiedTime`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    });
    return (await res.json()) as DriveFileMeta;
  }
  const boundary = `sp${Date.now().toString(36)}`;
  const metadata = { name: SYNC_FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
  const res = await driveFetch(token, `${DRIVE_UPLOAD}?uploadType=multipart&fields=id,modifiedTime`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await res.json()) as DriveFileMeta;
}
