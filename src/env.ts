// src/env.ts — Type definitions for Cloudflare bindings

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  WORKER_ENV: string;
  APP_NAME: string;
  AUTH_SECRET: string;
  AUTH_GOOGLE_ID: string;
  AUTH_GOOGLE_SECRET: string;
  TALLY_WEBHOOK_SECRET: string;
}
