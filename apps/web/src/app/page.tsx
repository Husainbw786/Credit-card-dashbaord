import { ShopAssistant } from '@/components/shop-assistant';
import { H1, Muted } from '@/components/ui';
import { getKnowledgeBase } from '@/lib/kb';

export const dynamic = 'force-dynamic';

export default async function ShopPage() {
  const { kb } = await getKnowledgeBase();
  const brands = kb.brands.map((b) => ({ id: b.id, name: b.name })).sort((a, b) => a.name.localeCompare(b.name));
  const cardCount = kb.myCards.length;
  const offerCount = kb.giftCardOffers.length;
  return (
    <div className="space-y-5">
      <div>
        <H1>How should I pay?</H1>
        <Muted className="mt-1">
          {cardCount} card{cardCount === 1 ? '' : 's'} in your wallet, {offerCount} gift card offer{offerCount === 1 ? '' : 's'} known. Tell me what you are buying.
        </Muted>
      </div>
      <ShopAssistant brands={brands} />
    </div>
  );
}
