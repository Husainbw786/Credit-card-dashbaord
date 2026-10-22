import type { GiftCardOfferInput, MerchantOfferInput, PlatformCardBonusInput } from '../types.js';

/**
 * Live discounts. Only values with a known source are seeded; add a row per
 * platform × brand as you check them, and the engine will compare platforms.
 */
export const giftCardOffers: GiftCardOfferInput[] = [
  {
    id: 'gyftr-giva',
    platformId: 'gyftr',
    brandId: 'giva',
    discountPct: 13,
    delivery: 'instant',
    verifiedAt: '2026-10-22',
    sourceNote: 'User-reported Gyftr discount on Giva gift cards.',
  },
];

/** Extra discount a platform gives for paying with a specific card (none known yet). */
export const platformCardBonuses: PlatformCardBonusInput[] = [];

/** Bank instant-discount, cashback or coupon offers at merchants (none known yet). */
export const merchantOffers: MerchantOfferInput[] = [];
