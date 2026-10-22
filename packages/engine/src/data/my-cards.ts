import type { MyCardInput } from '../types';

/** The user's wallet. capUsed is reward already earned this period, per cap group. */
export const myCards: MyCardInput[] = [
  { id: 'my-sbi-cashback', cardProductId: 'sbi-cashback', capUsed: {} },
  { id: 'my-sbi-simplyclick', cardProductId: 'sbi-simplyclick', capUsed: {} },
  { id: 'my-amazon-pay-icici', cardProductId: 'amazon-pay-icici', capUsed: {}, flags: { prime: true } },
  { id: 'my-flipkart-axis', cardProductId: 'flipkart-axis', capUsed: {} },
  { id: 'my-hdfc-swiggy', cardProductId: 'hdfc-swiggy', capUsed: {} },
  { id: 'my-onecard-bob', cardProductId: 'onecard-bob', capUsed: {} },
  { id: 'my-jupiter-edge-plus', cardProductId: 'jupiter-edge-plus', capUsed: {} },
];
