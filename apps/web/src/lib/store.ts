import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Redis } from '@upstash/redis';
import { Pool } from 'pg';
import {
  seedKnowledgeBase,
  type BrandInput,
  type CardProductInput,
  type GiftCardOfferInput,
  type MerchantOfferInput,
  type MyCardInput,
} from '@smart-spend/engine';

/**
 * User-editable state is one JSON document. Backend is picked from the environment:
 *   1. Postgres when DATABASE_URL or POSTGRES_URL is set (Neon, Supabase, Vercel
 *      Postgres, Railway, local). One table, one row.
 *   2. Upstash Redis when its REST credentials are set.
 *   3. A JSON file otherwise. On a read-only filesystem such as Vercel's serverless
 *      runtime the file falls back to the OS temp directory, which does not survive
 *      redeploys; the UI shows a notice in that case.
 */
export interface UserState {
  version: 1;
  myCards: MyCardInput[];
  customCards: CardProductInput[];
  brands: BrandInput[];
  giftCardOffers: GiftCardOfferInput[];
  merchantOffers: MerchantOfferInput[];
  /** enabled flag per strategy id */
  strategies: Record<string, boolean>;
  /** Seed brands the user removed; not re-added by the catalogue sync. */
  hiddenBrands?: string[];
}

export type BackendName = 'postgres' | 'redis' | 'file' | 'temp';

interface Backend {
  name: BackendName;
  persistent: boolean;
  read(): Promise<string | null>;
  write(json: string): Promise<void>;
}

const REDIS_KEY = 'smart-spend:user-state';
const PG_KEY = 'user-state';
const PG_TABLE = 'smart_spend_state';

function postgresUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

function needsSsl(url: string): boolean {
  if (process.env.PGSSL === 'false') return false;
  if (/sslmode=disable/i.test(url)) return false;
  try {
    const host = new URL(url).hostname;
    return !(host === 'localhost' || host === '127.0.0.1' || host === '::1');
  } catch {
    return true;
  }
}

function postgresBackend(url: string): Backend {
  const pool = new Pool({
    connectionString: url,
    max: 2,
    ssl: needsSsl(url) ? { rejectUnauthorized: false } : undefined,
  });
  let ready: Promise<unknown> | undefined;
  const init = () =>
    (ready ??= pool.query(
      `CREATE TABLE IF NOT EXISTS ${PG_TABLE} (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    ));
  return {
    name: 'postgres',
    persistent: true,
    async read() {
      await init();
      const r = await pool.query<{ value: unknown }>(`SELECT value FROM ${PG_TABLE} WHERE key = $1`, [PG_KEY]);
      const row = r.rows[0];
      return row ? JSON.stringify(row.value) : null;
    },
    async write(json) {
      await init();
      await pool.query(
        `INSERT INTO ${PG_TABLE} (key, value, updated_at) VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [PG_KEY, json],
      );
    },
  };
}

function redisCredentials(): { url: string; token: string } | undefined {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : undefined;
}

function fileBackend(file: string, name: BackendName, persistent: boolean): Backend {
  return {
    name,
    persistent,
    async read() {
      try {
        return await fs.readFile(file, 'utf8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    },
    async write(json) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, json);
      await fs.rename(tmp, file);
    },
  };
}

function redisBackend(creds: { url: string; token: string }): Backend {
  const redis = new Redis({ url: creds.url, token: creds.token, automaticDeserialization: false });
  return {
    name: 'redis',
    persistent: true,
    async read() {
      const v = await redis.get<string>(REDIS_KEY);
      return typeof v === 'string' ? v : v == null ? null : JSON.stringify(v);
    },
    async write(json) {
      await redis.set(REDIS_KEY, json);
    },
  };
}

let active: Backend | undefined;

function primaryBackend(): Backend {
  const pg = postgresUrl();
  if (pg) return postgresBackend(pg);
  const creds = redisCredentials();
  if (creds) return redisBackend(creds);
  const file = process.env.SMART_SPEND_DATA_FILE ?? path.join(process.cwd(), 'data', 'user-state.json');
  return fileBackend(file, 'file', true);
}

function tempBackend(): Backend {
  return fileBackend(path.join(os.tmpdir(), 'smart-spend', 'user-state.json'), 'temp', false);
}

function isReadOnlyFsError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException)?.code;
  return code === 'EROFS' || code === 'EACCES' || code === 'EPERM' || code === 'ENOENT' || code === 'ENOTDIR';
}

function backend(): Backend {
  if (!active) active = primaryBackend();
  return active;
}

/** Which store is in use, for the UI notice. */
export function storeInfo(): { name: BackendName; persistent: boolean } {
  const b = backend();
  return { name: b.name, persistent: b.persistent };
}

function initialState(): UserState {
  return structuredClone({
    version: 1 as const,
    myCards: seedKnowledgeBase.myCards,
    customCards: [],
    brands: seedKnowledgeBase.brands,
    giftCardOffers: seedKnowledgeBase.giftCardOffers ?? [],
    merchantOffers: seedKnowledgeBase.merchantOffers ?? [],
    strategies: {},
  });
}

export async function writeState(state: UserState): Promise<void> {
  const json = JSON.stringify(state, null, 2);
  const b = backend();
  try {
    await b.write(json);
  } catch (err) {
    if (b.name === 'file' && isReadOnlyFsError(err)) {
      // Read-only deployment filesystem: keep working from the temp directory.
      active = tempBackend();
      await active.write(json);
      return;
    }
    throw err;
  }
}

export async function readState(): Promise<UserState> {
  let raw: string | null = null;
  try {
    raw = await backend().read();
  } catch (err) {
    if (!(backend().name === 'file' && isReadOnlyFsError(err))) throw err;
  }
  if (raw) return JSON.parse(raw) as UserState;
  const state = initialState();
  await writeState(state);
  return state;
}

export async function updateState(mutate: (state: UserState) => void | Promise<void>): Promise<UserState> {
  const state = await readState();
  await mutate(state);
  await writeState(state);
  return state;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
