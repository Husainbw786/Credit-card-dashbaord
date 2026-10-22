import type { GiftCardOfferInput, MerchantOfferInput, PlatformCardBonusInput } from '../types';

/**
 * Live discounts. Only values with a known source are seeded; add a row per
 * platform × brand as you check them, and the engine will compare platforms.
 */
/**
 * Brands commonly listed on Gyftr. The discount is not known until checked (by the
 * assistant's web search or by you), so these rows carry discountUnknown and cost 0%.
 * They make the "gift card + best card" route show up for every such brand.
 */
const GYFTR_LISTED = [
  'dominos', 'pizza-hut', 'kfc', 'mcdonalds', 'burger-king', 'starbucks', 'barbeque-nation',
  'swiggy', 'zomato', 'blinkit', 'bigbasket',
  'myntra', 'ajio', 'nykaa', 'lifestyle', 'shoppers-stop', 'westside', 'pantaloons', 'decathlon', 'tatacliq',
  'croma', 'reliance-digital', 'vijay-sales', 'pepperfry',
  'tanishq', 'caratlane', 'bluestone',
  'pvr', 'bookmyshow', 'cultfit',
  'makemytrip', 'cleartrip', 'yatra', 'uber', 'ola',
  'apollo-pharmacy', 'netmeds', 'pharmeasy',
  'amazon', 'flipkart', 'igp',
];

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
  ...GYFTR_LISTED.map((brandId) => ({
    id: `gyftr-${brandId}-listed`,
    platformId: 'gyftr',
    brandId,
    discountPct: 0,
    discountUnknown: true,
    delivery: 'instant' as const,
    sourceNote: 'Brand listed on Gyftr; discount not checked yet.',
  })),
];

/** Extra discount a platform gives for paying with a specific card (none known yet). */
export const platformCardBonuses: PlatformCardBonusInput[] = [];

/** Bank instant-discount, cashback or coupon offers at merchants (none known yet). */
export const merchantOffers: MerchantOfferInput[] = [];
