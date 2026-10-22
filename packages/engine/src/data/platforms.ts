import type { PlatformInput } from '../types';

/** Places that sell gift cards or vouchers. Discounts live in offers.ts, per brand. */
export const platforms: PlatformInput[] = [
  { id: 'gyftr', name: 'Gyftr', type: 'gift_card', url: 'https://www.gyftr.com', notes: 'Brand-direct instant vouchers, discounts up to ~40% on select brands; also powers several bank voucher portals.' },
  { id: 'magicpin', name: 'Magicpin', type: 'gift_card', url: 'https://magicpin.in', notes: 'Often the deepest discounts on fashion, food and local brands; check redemption restrictions per voucher.' },
  { id: 'parkplus', name: 'Park+', type: 'gift_card', url: 'https://parkplus.io', notes: 'Discounted brand vouchers in the Park+ app.' },
  { id: 'woohoo', name: 'Woohoo', type: 'gift_card', url: 'https://www.woohoo.in', notes: 'Pine Labs; widest catalogue, usually smaller discounts.' },
  { id: 'magnify', name: 'Magnify', type: 'gift_card', url: 'https://magnify.club', notes: 'Sells Giva gift cards (₹500–₹1,00,000, 180-day validity).' },
  { id: 'zingoy', name: 'Zingoy', type: 'gift_card', url: 'https://www.zingoy.com', notes: 'Gift cards plus cashback on purchase.' },
  { id: 'amazon', name: 'Amazon.in', type: 'marketplace', url: 'https://www.amazon.in' },
  { id: 'flipkart', name: 'Flipkart', type: 'marketplace', url: 'https://www.flipkart.com' },
];
