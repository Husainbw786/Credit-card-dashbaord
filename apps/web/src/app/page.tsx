import { ShopAssistant } from '@/components/shop-assistant';
import { H1, Muted } from '@/components/ui';
import { getKnowledgeBase } from '@/lib/kb';
import { activeProvider, providerLabel } from '@/lib/llm';

export const dynamic = 'force-dynamic';

export default async function ShopPage() {
  const { kb } = await getKnowledgeBase();
  const brands = kb.brands.map((b) => ({ id: b.id, name: b.name })).sort((a, b) => a.name.localeCompare(b.name));
  const platforms = kb.platforms.filter((p) => p.type === 'gift_card').map((p) => ({ id: p.id, name: p.name }));
  const cards = kb.myCards
    .map((m) => kb.cards.find((c) => c.id === m.cardProductId))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({ id: c.id, name: c.name, issuer: c.issuer }));
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
      <ShopAssistant brands={brands} platforms={platforms} cards={cards} searchAvailable={activeProvider() === 'openai'} providerLabel={providerLabel()} />
    </div>
  );
}
