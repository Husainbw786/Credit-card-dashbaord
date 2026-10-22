import type { BrandInput, Category, Channel } from '../types';

const CHECKED = '2026-10-22';

type Stores = 'all' | 'select' | 'none';

/** Compact row: [id, name, category, stores, defaultChannel, aliases, notes?] */
type Row = [string, string, Category, Stores, Channel, string[], string?];

function brand(row: Row, extra: Partial<BrandInput> = {}): BrandInput {
  const [id, name, category, offlineStores, defaultChannel, aliases, notes] = row;
  const onlineOnly = offlineStores === 'none';
  return {
    id,
    name,
    category,
    aliases,
    defaultChannel,
    acceptsUpi: !onlineOnly,
    redemption: {
      online: true,
      offlineStores,
      partial: true,
      ...(onlineOnly ? { verifiedAt: CHECKED, notes: notes ?? 'Online only; no physical stores.' } : { notes: notes ?? 'Store acceptance of gift cards unverified; confirm at the counter.' }),
    },
    ...extra,
  };
}

/**
 * Merchants you can buy from. Ids match the merchant ids used in card reward rules
 * (e.g. SimplyCLICK 10X partners, Swiggy HDFC, Flipkart Axis partners) so direct
 * payment gets the partner rate. Redemption rules for brands with physical stores
 * are unverified unless noted; the engine flags that on gift card routes.
 */
export const brands: BrandInput[] = [
  {
    id: 'giva',
    name: 'Giva',
    category: 'jewellery',
    aliases: ['giva jewellery', 'giva.co'],
    defaultChannel: 'offline',
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
  // Jewellery
  brand(['tanishq', 'Tanishq', 'jewellery', 'all', 'offline', ['tanishq jewellers']]),
  brand(['caratlane', 'CaratLane', 'jewellery', 'all', 'offline', ['carat lane']]),
  brand(['bluestone', 'BlueStone', 'jewellery', 'all', 'offline', ['blue stone']]),
  brand(['kalyan-jewellers', 'Kalyan Jewellers', 'jewellery', 'all', 'offline', ['kalyan']]),
  // Food delivery and dining
  brand(['swiggy', 'Swiggy', 'food_delivery', 'none', 'online', ['swiggy instamart', 'instamart', 'swiggy dineout'], 'Swiggy Money / gift cards are in-app only.']),
  brand(['zomato', 'Zomato', 'food_delivery', 'none', 'online', ['zomato gold']]),
  brand(['dominos', "Domino's", 'dining', 'select', 'online', ['dominos', 'domino', 'dominos pizza', "domino's pizza"], 'E-gift cards redeem on the Domino\'s app and site; store acceptance unverified.']),
  brand(['pizza-hut', 'Pizza Hut', 'dining', 'select', 'online', ['pizzahut']]),
  brand(['mcdonalds', "McDonald's", 'dining', 'all', 'offline', ['mcdonalds', 'mcd', 'mcdonald']]),
  brand(['kfc', 'KFC', 'dining', 'all', 'offline', []]),
  brand(['burger-king', 'Burger King', 'dining', 'all', 'offline', ['burgerking', 'bk']]),
  brand(['starbucks', 'Starbucks', 'dining', 'all', 'offline', ['tata starbucks']]),
  brand(['barbeque-nation', 'Barbeque Nation', 'dining', 'all', 'offline', ['bbq nation', 'barbecue nation']]),
  // Grocery
  brand(['blinkit', 'Blinkit', 'grocery', 'none', 'online', ['grofers']]),
  brand(['zepto', 'Zepto', 'grocery', 'none', 'online', []]),
  brand(['bigbasket', 'BigBasket', 'grocery', 'none', 'online', ['big basket']]),
  brand(['dmart', 'DMart', 'grocery', 'all', 'offline', ['d mart', 'd-mart']]),
  // Fashion and beauty
  brand(['myntra', 'Myntra', 'fashion', 'none', 'online', []]),
  brand(['ajio', 'AJIO', 'fashion', 'none', 'online', []]),
  brand(['tatacliq', 'Tata CLiQ', 'fashion', 'none', 'online', ['tata cliq', 'cliq']]),
  brand(['nykaa', 'Nykaa', 'beauty', 'select', 'online', ['nykaa fashion']]),
  brand(['lifestyle', 'Lifestyle', 'fashion', 'all', 'offline', ['lifestyle stores']]),
  brand(['shoppers-stop', 'Shoppers Stop', 'fashion', 'all', 'offline', ['shoppersstop']]),
  brand(['westside', 'Westside', 'fashion', 'all', 'offline', []]),
  brand(['pantaloons', 'Pantaloons', 'fashion', 'all', 'offline', []]),
  brand(['zara', 'Zara', 'fashion', 'all', 'offline', []]),
  brand(['h-and-m', 'H&M', 'fashion', 'all', 'offline', ['h and m', 'hm', 'h&m']]),
  brand(['uniqlo', 'Uniqlo', 'fashion', 'all', 'offline', []]),
  brand(['decathlon', 'Decathlon', 'general', 'all', 'offline', []]),
  // Electronics and home
  brand(['croma', 'Croma', 'electronics', 'all', 'offline', ['croma store']]),
  brand(['reliance-digital', 'Reliance Digital', 'electronics', 'all', 'offline', ['reliance digital store']]),
  brand(['vijay-sales', 'Vijay Sales', 'electronics', 'all', 'offline', ['vijaysales']]),
  brand(['ikea', 'IKEA', 'home', 'all', 'offline', []]),
  brand(['pepperfry', 'Pepperfry', 'home', 'select', 'online', ['pepper fry']]),
  // Marketplaces
  brand(['amazon', 'Amazon.in', 'general', 'none', 'online', ['amazon', 'amazon india'], 'Amazon Pay gift cards load to Amazon Pay balance.']),
  brand(['flipkart', 'Flipkart', 'general', 'none', 'online', []]),
  brand(['igp', 'IGP', 'general', 'none', 'online', ['igp.com', 'indian gifts portal']]),
  // Entertainment
  brand(['bookmyshow', 'BookMyShow', 'entertainment', 'none', 'online', ['book my show', 'bms']]),
  brand(['pvr', 'PVR INOX', 'entertainment', 'all', 'offline', ['pvr', 'inox', 'pvr inox']]),
  brand(['cultfit', 'Cult.fit', 'general', 'select', 'online', ['cult fit', 'cult', 'curefit']]),
  // Travel
  brand(['makemytrip', 'MakeMyTrip', 'travel', 'none', 'online', ['mmt', 'make my trip']]),
  brand(['cleartrip', 'Cleartrip', 'travel', 'none', 'online', ['clear trip']]),
  brand(['yatra', 'Yatra', 'travel', 'none', 'online', []]),
  brand(['ixigo', 'ixigo', 'travel', 'none', 'online', []]),
  brand(['uber', 'Uber', 'travel', 'none', 'online', []]),
  brand(['ola', 'Ola', 'travel', 'none', 'online', ['ola cabs']]),
  // Pharmacy
  brand(['apollo247', 'Apollo 24|7', 'pharmacy', 'none', 'online', ['apollo 247', 'apollo 24/7', 'apollo24']]),
  brand(['apollo-pharmacy', 'Apollo Pharmacy', 'pharmacy', 'all', 'offline', ['apollo']]),
  brand(['netmeds', 'Netmeds', 'pharmacy', 'none', 'online', []]),
  brand(['pharmeasy', 'PharmEasy', 'pharmacy', 'none', 'online', ['pharm easy']]),
];
