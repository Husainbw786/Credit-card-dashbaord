import fs from 'node:fs/promises';
import path from 'node:path';
import {
  seedKnowledgeBase,
  type BrandInput,
  type CardProductInput,
  type GiftCardOfferInput,
  type MerchantOfferInput,
  type MyCardInput,
} from '@smart-spend/engine';

/**
 * User-editable state lives in one JSON file for Phase 1. The card catalogue,
 * platforms and strategy definitions stay in the engine's seed data.
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
}

function dataFile(): string {
  return process.env.SMART_SPEND_DATA_FILE ?? path.join(process.cwd(), 'data', 'user-state.json');
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

export async function readState(): Promise<UserState> {
  const file = dataFile();
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as UserState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    const state = initialState();
    await writeState(state);
    return state;
  }
}

export async function writeState(state: UserState): Promise<void> {
  const file = dataFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2));
  await fs.rename(tmp, file);
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
