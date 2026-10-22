import { parseKnowledgeBase, type KnowledgeBase, type KnowledgeBaseInput } from '../types';
import { brands } from './brands';
import { cards } from './cards';
import { myCards } from './my-cards';
import { giftCardOffers, merchantOffers, platformCardBonuses } from './offers';
import { platforms } from './platforms';
import { strategies } from './strategies';

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
