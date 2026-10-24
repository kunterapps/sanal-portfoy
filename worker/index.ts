/**
 * Cloudflare Worker that serves the price API for the GitHub Pages build.
 * Deploy with `npx wrangler deploy` (see README). ALLOWED_ORIGINS is a
 * comma-separated list of sites allowed to call it, e.g.
 * "https://kunterapps.github.io,http://localhost:3000".
 */
import { createPriceService, handlePriceRequest } from '../server/priceApi.ts';

interface Env {
  ALLOWED_ORIGINS?: string;
}

// Module scope survives between requests on the same isolate, so the cache helps
const service = createPriceService();

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (!origin || !(allowed.includes('*') || allowed.includes(origin))) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export async function handleWorkerRequest(request: Request, env: Env, priceService = service): Promise<Response> {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: Object.keys(cors).length ? 204 : 403, headers: cors });
  }
  const result = await handlePriceRequest(new URL(request.url), request.method, priceService);
  const { status, body } = result ?? { status: 404, body: { error: 'Bilinmeyen uç nokta' } };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json; charset=utf-8',
      // Let the browser reuse a quote for a minute
      'Cache-Control': status === 200 ? 'public, max-age=60' : 'no-store',
    },
  });
}

export default {
  fetch: (request: Request, env: Env) => handleWorkerRequest(request, env),
};
