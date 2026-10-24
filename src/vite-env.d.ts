/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the price API (Cloudflare Worker) for static hosting; empty = same origin */
  readonly VITE_PRICE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
