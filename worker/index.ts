/**
 * Cloudflare Worker that serves the price API for the Cloudflare Pages build.
 * Deploy with `npx wrangler deploy` (see README). ALLOWED_ORIGINS is a
 * comma-separated list of sites allowed to call it, e.g.
 * "https://sanal-portfoy.pages.dev,http://localhost:3000".
 */
import { createPriceService, handlePriceRequest } from '../server/priceApi.ts';
import { GoogleAuthEnv, handleGoogleAuthRequest } from '../server/googleAuth.ts';

interface Env extends GoogleAuthEnv {
  ALLOWED_ORIGINS?: string;
}

// Module scope survives between requests on the same isolate, so the cache helps
const service = createPriceService();

const allowedOrigins = (env: Env) =>
  (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = allowedOrigins(env);
  if (!origin || !(allowed.includes('*') || allowed.includes(origin))) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Sign-in answers carry tokens and must never be cached */
const isCacheable = (request: Request) => !new URL(request.url).pathname.startsWith('/api/google/');

export async function handleWorkerRequest(
  request: Request,
  env: Env,
  priceService: Parameters<typeof handlePriceRequest>[2] = service,
  fetchFn: typeof fetch = fetch
): Promise<Response> {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: Object.keys(cors).length ? 204 : 403, headers: cors });
  }
  const result =
    (await handleGoogleAuthRequest(request, env, allowedOrigins(env), fetchFn)) ??
    (await handlePriceRequest(new URL(request.url), request.method, priceService));
  const cacheable = isCacheable(request);
  const { status, body } = result ?? { status: 404, body: { error: 'Bilinmeyen uç nokta' } };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json; charset=utf-8',
      // Let the browser reuse a quote for a minute
      'Cache-Control': status === 200 && cacheable ? 'public, max-age=60' : 'no-store',
    },
  });
}

export default {
  fetch: (request: Request, env: Env) => handleWorkerRequest(request, env),
};
