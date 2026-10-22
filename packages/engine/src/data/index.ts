import { parseKnowledgeBase, type KnowledgeBase, type KnowledgeBaseInput } from '../types.js';
import { brands } from './brands.js';
import { cards } from './cards.js';
import { myCards } from './my-cards.js';
import { giftCardOffers, merchantOffers, platformCardBonuses } from './offers.js';
import { platforms } from './platforms.js';
import { strategies } from './strategies.js';

export const seedKnowledgeBase: KnowledgeBaseInput = {
  cards,
  myCards,
  platforms,
  brands,
  giftCardOffers,
  platformCardBonuses,
  merchantOffers,
  strategies,
};

/** Parsed, cross-checked knowledge base. Returns a fresh copy each call. */
export function loadKnowledgeBase(): KnowledgeBase {
  return parseKnowledgeBase(structuredClone(seedKnowledgeBase));
}
