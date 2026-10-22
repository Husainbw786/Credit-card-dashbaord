import type { StrategyInput } from '../types.js';

/** Payment patterns the engine enumerates. Variation 1 = gift_card. */
export const strategies: StrategyInput[] = [
  { id: 'direct', name: 'Pay the merchant directly', kind: 'direct', description: 'Card at the till or checkout, with any merchant bank offer.' },
  { id: 'gift_card', name: 'Discounted gift card + best card', kind: 'gift_card', description: 'Buy the brand gift card at a discount on a platform, pay for it with the card that rewards that purchase most, redeem at the merchant.' },
];
