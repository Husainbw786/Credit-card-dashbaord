import { parseKnowledgeBase, seedKnowledgeBase, type KnowledgeBase } from '@smart-spend/engine';
import { readState, type UserState } from './store';

export async function getKnowledgeBase(): Promise<{ kb: KnowledgeBase; state: UserState }> {
  const state = await readState();
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
