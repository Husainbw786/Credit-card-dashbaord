import type { BrandInput } from '../types';

const CHECKED = '2026-10-22';

/** Merchants you buy from, with how their gift cards can be redeemed. */
export const brands: BrandInput[] = [
  {
    id: 'giva',
    name: 'Giva',
    category: 'jewellery',
    aliases: ['giva jewellery', 'giva.co'],
    redemption: {
      online: true,
      offlineStores: 'all',
      partial: true,
      validityDays: 180,
      verifiedAt: CHECKED,
      sourceUrl: 'https://magnify.club/buy-gift-card/giva/',
      sourceNote: 'Reseller listing: redeemable at Giva stores (hand voucher to cashier, pay any remainder) and on giva.co.',
    },
  },
  {
    id: 'tanishq',
    name: 'Tanishq',
    category: 'jewellery',
    redemption: { online: true, offlineStores: 'all', partial: true, notes: 'Unverified; Tanishq gift cards are generally accepted in stores.' },
  },
  {
    id: 'croma',
    name: 'Croma',
    category: 'electronics',
    redemption: { online: true, offlineStores: 'all', partial: true, notes: 'Unverified; Croma gift cards are generally accepted online and in stores.' },
  },
  {
    id: 'myntra',
    name: 'Myntra',
    category: 'fashion',
    acceptsUpi: false,
    redemption: { online: true, offlineStores: 'none', partial: true, verifiedAt: CHECKED, notes: 'Online only.' },
  },
  {
    id: 'flipkart',
    name: 'Flipkart',
    category: 'general',
    acceptsUpi: false,
    redemption: { online: true, offlineStores: 'none', partial: true, verifiedAt: CHECKED, notes: 'Online only.' },
  },
  {
    id: 'amazon',
    name: 'Amazon.in',
    category: 'general',
    acceptsUpi: false,
    redemption: { online: true, offlineStores: 'none', partial: true, verifiedAt: CHECKED, notes: 'Amazon Pay gift cards load to Amazon Pay balance.' },
  },
  {
    id: 'swiggy',
    name: 'Swiggy',
    category: 'food_delivery',
    acceptsUpi: false,
    redemption: { online: true, offlineStores: 'none', partial: true, verifiedAt: CHECKED, notes: 'Swiggy Money / gift cards are in-app only.' },
  },
];
