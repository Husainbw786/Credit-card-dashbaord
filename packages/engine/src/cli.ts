import { parseArgs } from 'node:util';
import { loadKnowledgeBase } from './data/index';
import { formatRoutes } from './format';
import { findRoutes, resolveBrand } from './routes';
import { PurchaseIntentSchema } from './types';

const { values } = parseArgs({
  options: {
    brand: { type: 'string', short: 'b' },
    amount: { type: 'string', short: 'a' },
    channel: { type: 'string', short: 'c', default: 'offline' },
    'in-store': { type: 'boolean', default: false },
    top: { type: 'string', short: 't', default: '4' },
    json: { type: 'boolean', default: false },
    'list-brands': { type: 'boolean', default: false },
    'all-cards': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const kb = loadKnowledgeBase();

if (values.help || (!values.brand && !values['list-brands'])) {
  console.log(`Usage: npm run route -- --brand giva --amount 10000 [--channel offline|online|upi] [--in-store] [--top 4] [--all-cards] [--json]
       npm run route -- --list-brands`);
  process.exit(values.help ? 0 : 1);
}

if (values['list-brands']) {
  for (const b of kb.brands) {
    const offers = kb.giftCardOffers.filter((o) => o.brandId === b.id).length;
    console.log(`${b.id.padEnd(14)} ${b.name.padEnd(22)} ${b.category.padEnd(14)} gift card offers: ${offers}`);
  }
  process.exit(0);
}

const brand = resolveBrand(kb, values.brand!);
if (!brand) {
  console.error(`Unknown brand "${values.brand}". Known: ${kb.brands.map((b) => b.id).join(', ')}`);
  process.exit(1);
}
const amount = Number(values.amount);
if (!Number.isFinite(amount) || amount <= 0) {
  console.error('Pass a positive --amount');
  process.exit(1);
}
const intent = PurchaseIntentSchema.parse({ brandId: brand.id, amount, channel: values.channel, inStoreNow: values['in-store'] });
const all = findRoutes(kb, intent);
const top = Number(values.top) || undefined;
if (values.json) console.log(JSON.stringify({ intent, routes: all }, null, 2));
else if (values['all-cards']) console.log(formatRoutes(kb, intent, top ? all.slice(0, top) : all, { allCards: true }));
else {
  // Keep the top N options (grouped by platform / direct), not the top N card variations.
  const keep = new Set<string>();
  const kept = all.filter((r) => {
    const g = r.strategyId === 'gift_card' ? `gc:${r.platformId}` : `direct:${r.offerId ?? ''}`;
    if (keep.has(g)) return true;
    if (top && keep.size >= top) return false;
    keep.add(g);
    return true;
  });
  console.log(formatRoutes(kb, intent, kept));
}
