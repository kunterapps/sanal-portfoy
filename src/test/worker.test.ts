import { describe, expect, it, vi } from 'vitest';
import { handleWorkerRequest } from '../../worker/index';

const service = {
  getStockQuote: vi.fn(async () => ({ price: 312, currency: 'TRY', source: 'yahoo' as const, asOf: 'x' })),
  getFundQuote: vi.fn(async () => null),
};
const env = { ALLOWED_ORIGINS: 'https://sanal-portfoy.pages.dev, http://localhost:3000' };

const req = (path: string, init: RequestInit & { origin?: string } = {}) =>
  new Request(`https://fiyat.example.workers.dev${path}`, {
    ...init,
    headers: init.origin ? { Origin: init.origin } : {},
  });

describe('price worker', () => {
  it('serves quotes with CORS for allowed origins', async () => {
    const res = await handleWorkerRequest(req('/api/quote?symbol=THYAO.IS', { origin: 'https://sanal-portfoy.pages.dev' }), env, service);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://sanal-portfoy.pages.dev');
    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
    expect(await res.json()).toMatchObject({ price: 312 });
  });

  it('omits CORS headers for other origins', async () => {
    const res = await handleWorkerRequest(req('/api/quote?symbol=THYAO.IS', { origin: 'https://evil.example' }), env, service);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('answers preflight requests', async () => {
    const ok = await handleWorkerRequest(req('/api/quote', { method: 'OPTIONS', origin: 'http://localhost:3000' }), env, service);
    expect(ok.status).toBe(204);
    const denied = await handleWorkerRequest(req('/api/quote', { method: 'OPTIONS', origin: 'https://evil.example' }), env, service);
    expect(denied.status).toBe(403);
  });

  it('returns 404 for missing prices and unknown paths', async () => {
    expect((await handleWorkerRequest(req('/api/fund?code=TCD'), env, service)).status).toBe(404);
    expect((await handleWorkerRequest(req('/'), env, service)).status).toBe(404);
  });
});
