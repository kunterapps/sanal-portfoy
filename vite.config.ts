import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {createPriceMiddleware} from './server/priceApi.ts';
import {handleGoogleAuthRequest} from './server/googleAuth.ts';
import type {IncomingMessage, ServerResponse} from 'node:http';

/**
 * Google sign-in endpoints for local testing of Drive sync. Reads
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET from the environment; without them
 * the app simply doesn't offer Drive sync.
 */
async function googleAuthMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (!req.url?.startsWith('/api/google/')) return next();
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const host = req.headers.host || 'localhost';
  const request = new Request(`http://${host}${req.url}`, {
    method: req.method,
    headers: {'Content-Type': String(req.headers['content-type'] || '')},
    body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
  });
  const result = await handleGoogleAuthRequest(request, process.env, [`http://${host}`]);
  if (!result) return next();
  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(result.body));
}

/** Serves /api/quote and /api/fund from both the dev server and `vite preview`. */
function priceApi(): Plugin {
  const middleware = createPriceMiddleware();
  return {
    name: 'price-api',
    configureServer(server) {
      server.middlewares.use(googleAuthMiddleware);
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(googleAuthMiddleware);
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(() => {
  return {
    // Cloudflare Pages serves the site from the root; set VITE_BASE to host it under a sub-path
    base: process.env.VITE_BASE || '/',
    plugins: [react(), tailwindcss(), priceApi()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
