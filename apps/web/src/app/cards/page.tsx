import type { CardProduct, MyCard } from '@smart-spend/engine';
import { addCustomCard, deleteCustomCard, resetCaps, setCardOwned, updateMyCard } from '@/lib/actions';
import { getKnowledgeBase } from '@/lib/kb';
import { Badge, Button, Card, Field, H1, H2, Input, Muted, Select } from '@/components/ui';

export const dynamic = 'force-dynamic';

function ruleSummary(card: CardProduct): string[] {
  return card.rules.filter((r) => r.enabled).map((r) => (r.kind === 'cashback' ? `${Math.round(r.rate * 10000) / 100}%` : r.name) + (r.kind === 'cashback' ? ` ${r.name.replace(/^\d+(\.\d+)?% ?(cashback )?/i, '')}` : ''));
}

function OwnedCard({ card, my, custom }: { card: CardProduct; my: MyCard; custom: boolean }) {
  const capGroups = Object.entries(card.capGroups);
  const flagNames = [...new Set(card.rules.flatMap((r) => Object.keys(r.requiresFlags ?? {})))];
  const hasPoints = card.rules.some((r) => r.kind === 'points');
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{card.name}</h3>
          <Muted>
            {card.issuer} · {card.network.toUpperCase()}
            {card.giftCardPurchases === 'excluded' && ' · no rewards on gift cards'}
            {card.giftCardPurchases === 'earns' && ' · gift cards earn'}
          </Muted>
        </div>
        <form action={custom ? deleteCustomCard : setCardOwned}>
          <input type="hidden" name="id" value={card.id} />
          <input type="hidden" name="cardProductId" value={card.id} />
          <input type="hidden" name="owned" value="false" />
          <Button variant="ghost" type="submit" className="text-xs">
            Remove
          </Button>
        </form>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {card.rules
          .filter((r) => r.enabled)
          .map((r) => (
            <li key={r.id}>
              <Badge>{r.name}</Badge>
            </li>
          ))}
      </ul>
      {card.neverEarn.length > 0 && (
        <Muted className="mt-2">
          Never earns on: {[...new Set(card.neverEarn.flatMap((n) => n.categories ?? []))].join(', ') || 'see notes'}
        </Muted>
      )}
      {card.notes && <Muted className="mt-1">{card.notes}</Muted>}

      {(capGroups.length > 0 || flagNames.length > 0 || hasPoints) && (
        <form action={updateMyCard} className="mt-3 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <input type="hidden" name="id" value={my.id} />
          <input type="hidden" name="capGroups" value={capGroups.map(([g]) => g).join(',')} />
          <input type="hidden" name="flagNames" value={flagNames.join(',')} />
          {capGroups.map(([g, cap]) => (
            <Field key={g} label={`${g} cap used this ${cap.period} (of ${cap.limit} ${cap.unit === 'points' ? 'pts' : '₹'})`}>
              <Input type="number" name={`cap:${g}`} min={0} step="1" defaultValue={my.capUsed[g] ?? 0} />
            </Field>
          ))}
          {hasPoints && (
            <Field label={`Point value override (₹/pt, default ${card.pointValue ?? 0})`}>
              <Input type="number" name="pointValueOverride" min={0} step="0.01" defaultValue={my.pointValueOverride ?? ''} placeholder={String(card.pointValue ?? '')} />
            </Field>
          )}
          {flagNames.map((f) => (
            <label key={f} className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name={`flag:${f}`} defaultChecked={my.flags[f] ?? false} className="h-4 w-4" />
              {f === 'prime' ? 'I have Amazon Prime' : f}
            </label>
          ))}
          <div className="col-span-2">
            <Button variant="secondary" type="submit">
              Save
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

export default async function CardsPage() {
  const { kb, state } = await getKnowledgeBase();
  const cardById = new Map(kb.cards.map((c) => [c.id, c]));
  const owned = kb.myCards.map((my) => ({ my, card: cardById.get(my.cardProductId)! })).filter((x) => x.card);
  const ownedIds = new Set(owned.map((o) => o.card.id));
  const catalogue = kb.cards.filter((c) => !ownedIds.has(c.id));
  const customIds = new Set(state.customCards.map((c) => c.id));

  return (
    <div>
      <H1>Your cards</H1>
      <Muted className="mt-1">Caps you enter here reduce the reward the engine expects this month. Reset them when a new statement cycle starts.</Muted>

      <div className="mt-4 space-y-3">
        {owned.map(({ my, card }) => (
          <OwnedCard key={my.id} card={card} my={my} custom={customIds.has(card.id)} />
        ))}
        {owned.length === 0 && <Muted>No cards yet. Add one from the catalogue below.</Muted>}
      </div>
      {owned.length > 0 && (
        <form action={resetCaps} className="mt-3">
          <Button variant="secondary" type="submit">
            Reset all caps for a new cycle
          </Button>
        </form>
      )}

      <H2>Catalogue</H2>
      {catalogue.length === 0 ? (
        <Muted>Every catalogue card is already in your wallet.</Muted>
      ) : (
        <div className="space-y-2">
          {catalogue.map((card) => (
            <Card key={card.id} className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{card.name}</div>
                <Muted>
                  {card.issuer} · {ruleSummary(card).slice(0, 3).join(' · ')}
                </Muted>
              </div>
              <form action={setCardOwned}>
                <input type="hidden" name="cardProductId" value={card.id} />
                <input type="hidden" name="owned" value="true" />
                <Button variant="secondary" type="submit">
                  Add
                </Button>
              </form>
            </Card>
          ))}
        </div>
      )}

      <H2>Add a card that is not in the catalogue</H2>
      <Card>
        <form action={addCustomCard} className="grid grid-cols-2 gap-3">
          <Field label="Card name" className="col-span-2">
            <Input name="name" required placeholder="e.g. HDFC Millennia" />
          </Field>
          <Field label="Issuer">
            <Input name="issuer" placeholder="HDFC Bank" />
          </Field>
          <Field label="Network">
            <Select name="network" defaultValue="visa">
              <option value="visa">Visa</option>
              <option value="mastercard">Mastercard</option>
              <option value="rupay">RuPay (works on UPI)</option>
              <option value="amex">Amex</option>
              <option value="diners">Diners</option>
            </Select>
          </Field>
          <Field label="Cashback on online spends (%)">
            <Input name="onlinePct" type="number" min={0} max={100} step="0.01" placeholder="1" />
          </Field>
          <Field label="Cashback on offline spends (%)">
            <Input name="offlinePct" type="number" min={0} max={100} step="0.01" placeholder="1" />
          </Field>
          <Field label="Do gift card purchases earn?" className="col-span-2">
            <Select name="giftCardPurchases" defaultValue="unknown">
              <option value="unknown">Not sure</option>
              <option value="earns">Yes</option>
              <option value="excluded">No</option>
            </Select>
          </Field>
          <div className="col-span-2">
            <Button type="submit">Add card</Button>
          </div>
        </form>
        <Muted className="mt-2">Flat rates only for now; category rules and caps can be added in the engine&apos;s data files.</Muted>
      </Card>
    </div>
  );
}
