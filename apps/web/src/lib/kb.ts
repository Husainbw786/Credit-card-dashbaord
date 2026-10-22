import { parseKnowledgeBase, seedKnowledgeBase, type KnowledgeBase } from '@smart-spend/engine';
import { readState, writeState, type UserState } from './store';

/** Brands added to the engine seed after the user's state was created are merged in once. */
async function syncSeedBrands(state: UserState): Promise<UserState> {
  const have = new Set(state.brands.map((b) => b.id));
  const hidden = new Set(state.hiddenBrands ?? []);
  const missing = seedKnowledgeBase.brands.filter((b) => !have.has(b.id) && !hidden.has(b.id));
  if (missing.length === 0) return state;
  state.brands.push(...structuredClone(missing));
  await writeState(state);
  return state;
}

export async function getKnowledgeBase(): Promise<{ kb: KnowledgeBase; state: UserState }> {
  const state = await syncSeedBrands(await readState());
  const kb = parseKnowledgeBase({
    cards: [...seedKnowledgeBase.cards, ...state.customCards],
    myCards: state.myCards,
    platforms: seedKnowledgeBase.platforms,
    brands: state.brands,
    giftCardOffers: state.giftCardOffers,
    platformCardBonuses: seedKnowledgeBase.platformCardBonuses ?? [],
    merchantOffers: state.merchantOffers,
    strategies: seedKnowledgeBase.strategies.map((s) => ({ ...s, enabled: state.strategies[s.id] ?? s.enabled ?? true })),
  });
  return { kb, state };
}
