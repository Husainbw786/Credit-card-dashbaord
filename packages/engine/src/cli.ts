import { parseArgs } from 'node:util';
import { loadKnowledgeBase } from './data/index.js';
import { formatRoutes } from './format.js';
import { findRoutes, resolveBrand } from './routes.js';
import { PurchaseIntentSchema } from './types.js';

const { values } = parseArgs({
  options: {
    brand: { type: 'string', short: 'b' },
    amount: { type: 'string', short: 'a' },
    channel: { type: 'string', short: 'c', default: 'offline' },
    'in-store': { type: 'boolean', default: false },
    top: { type: 'string', short: 't', default: '5' },
    json: { type: 'boolean', default: false },
    'list-brands': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const kb = loadKnowledgeBase();

if (values.help || (!values.brand && !values['list-brands'])) {
  console.log(`Usage: npm run route -- --brand giva --amount 10000 [--channel offline|online|upi] [--in-store] [--top 5] [--json]
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
const routes = findRoutes(kb, intent, { topN: Number(values.top) || undefined });
if (values.json) console.log(JSON.stringify({ intent, routes }, null, 2));
else console.log(formatRoutes(kb, intent, routes));
