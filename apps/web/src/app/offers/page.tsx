import { CategorySchema } from '@smart-spend/engine';
import {
  addBrand,
  addGiftCardOffer,
  addMerchantOffer,
  deleteBrand,
  deleteGiftCardOffer,
  deleteMerchantOffer,
  setOfferVerified,
} from '@/lib/actions';
import { getKnowledgeBase } from '@/lib/kb';
import { Badge, Button, Card, Field, H1, H2, Input, Muted, Select } from '@/components/ui';

export const dynamic = 'force-dynamic';

function ageDays(iso?: string): number | undefined {
  if (!iso) return undefined;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function VerifiedBadge({ verifiedAt }: { verifiedAt?: string }) {
  const age = ageDays(verifiedAt);
  if (age === undefined) return <Badge tone="low">unverified</Badge>;
  if (age > 60) return <Badge tone="medium">verified {age}d ago</Badge>;
  return <Badge tone="high">verified {age === 0 ? 'today' : `${age}d ago`}</Badge>;
}

export default async function OffersPage() {
  const { kb } = await getKnowledgeBase();
  const platformName = new Map(kb.platforms.map((p) => [p.id, p.name]));
  const brandName = new Map(kb.brands.map((b) => [b.id, b.name]));
  const cardName = new Map(kb.cards.map((c) => [c.id, c.name]));
  const giftPlatforms = kb.platforms.filter((p) => p.type === 'gift_card');
  const brands = [...kb.brands].sort((a, b) => a.name.localeCompare(b.name));
  const offers = [...kb.giftCardOffers].sort((a, b) => (brandName.get(a.brandId) ?? '').localeCompare(brandName.get(b.brandId) ?? '') || b.discountPct - a.discountPct);

  return (
    <div>
      <H1>Offers</H1>
      <Muted className="mt-1">Gift card discounts change weekly. Enter what you see on each platform; the engine compares them per brand.</Muted>

      <H2>Gift card discounts</H2>
      {offers.length === 0 ? (
        <Muted>No gift card offers yet.</Muted>
      ) : (
        <div className="space-y-2">
          {offers.map((o) => (
            <Card key={o.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {brandName.get(o.brandId) ?? o.brandId} on {platformName.get(o.platformId) ?? o.platformId}
                    <span className="ml-2 text-emerald-700 dark:text-emerald-300">{o.discountPct}% off</span>
                  </div>
                  <Muted>
                    {o.delivery === 'instant' ? 'instant delivery' : 'delayed delivery'}
                    {o.promoCode ? ` · code ${o.promoCode}` : ''}
                    {o.maxPerMonth ? ` · max ₹${o.maxPerMonth}/month` : ''}
                    {o.sourceNote ? ` · ${o.sourceNote}` : ''}
                  </Muted>
                </div>
                <VerifiedBadge verifiedAt={o.verifiedAt} />
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <form action={setOfferVerified} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="verified" value="true" />
                  <Field label="Discount now (%)">
                    <Input name="discountPct" type="number" min={0} max={100} step="0.5" defaultValue={o.discountPct} className="w-28" />
                  </Field>
                  <Button variant="secondary" type="submit">
                    Verified today
                  </Button>
                </form>
                <form action={setOfferVerified}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="verified" value="false" />
                  <Button variant="ghost" type="submit">
                    Mark stale
                  </Button>
                </form>
                <form action={deleteGiftCardOffer}>
                  <input type="hidden" name="id" value={o.id} />
                  <Button variant="danger" type="submit">
                    Delete
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-3">
        <h3 className="font-medium">Add a gift card discount</h3>
        <form action={addGiftCardOffer} className="mt-2 grid grid-cols-2 gap-3">
          <Field label="Platform">
            <Select name="platformId" defaultValue={giftPlatforms[0]?.id}>
              {giftPlatforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Brand">
            <Select name="brandId" defaultValue={brands[0]?.id}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Discount (%)">
            <Input name="discountPct" type="number" min={0} max={100} step="0.5" required placeholder="13" />
          </Field>
          <Field label="Delivery">
            <Select name="delivery" defaultValue="instant">
              <option value="instant">Instant</option>
              <option value="delayed">Delayed</option>
            </Select>
          </Field>
          <Field label="Promo code (optional)">
            <Input name="promoCode" />
          </Field>
          <Field label="Max per month (₹, optional)">
            <Input name="maxPerMonth" type="number" min={0} />
          </Field>
          <Field label="Min card value (₹, optional)">
            <Input name="minAmount" type="number" min={0} />
          </Field>
          <Field label="Max card value (₹, optional)">
            <Input name="maxAmount" type="number" min={0} />
          </Field>
          <Field label="Platform fee (%, optional)">
            <Input name="feePct" type="number" min={0} step="0.1" />
          </Field>
          <div className="col-span-2">
            <Button type="submit">Add offer</Button>
          </div>
        </form>
      </Card>

      <H2>Bank and merchant offers</H2>
      {kb.merchantOffers.length === 0 ? (
        <Muted>No instant-discount, cashback or coupon offers yet.</Muted>
      ) : (
        <div className="space-y-2">
          {kb.merchantOffers.map((o) => (
            <Card key={o.id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">
                  {brandName.get(o.brandId) ?? o.brandId}: {o.pct}% {o.kind}
                  {o.cardProductId ? ` with ${cardName.get(o.cardProductId) ?? o.cardProductId}` : ''}
                </div>
                <Muted>
                  {o.channels.join(', ')}
                  {o.cap ? ` · cap ₹${o.cap}` : ''}
                  {o.minSpend ? ` · min ₹${o.minSpend}` : ''}
                  {o.code ? ` · code ${o.code}` : ''}
                  {o.validTill ? ` · till ${o.validTill}` : ''}
                </Muted>
              </div>
              <div className="flex items-center gap-2">
                <VerifiedBadge verifiedAt={o.verifiedAt} />
                <form action={deleteMerchantOffer}>
                  <input type="hidden" name="id" value={o.id} />
                  <Button variant="danger" type="submit">
                    Delete
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Card className="mt-3">
        <h3 className="font-medium">Add a bank / merchant offer</h3>
        <form action={addMerchantOffer} className="mt-2 grid grid-cols-2 gap-3">
          <Field label="Brand">
            <Select name="brandId" defaultValue={brands[0]?.id}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Card (optional)">
            <Select name="cardProductId" defaultValue="">
              <option value="">Any card / coupon</option>
              {kb.cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select name="kind" defaultValue="instant">
              <option value="instant">Instant discount</option>
              <option value="cashback">Cashback later</option>
              <option value="coupon">Coupon code</option>
            </Select>
          </Field>
          <Field label="Discount (%)">
            <Input name="pct" type="number" min={0} max={100} step="0.5" required />
          </Field>
          <Field label="Cap (₹, optional)">
            <Input name="cap" type="number" min={0} />
          </Field>
          <Field label="Min spend (₹, optional)">
            <Input name="minSpend" type="number" min={0} />
          </Field>
          <Field label="Code (optional)">
            <Input name="code" />
          </Field>
          <Field label="Valid till (optional)">
            <Input name="validTill" type="date" />
          </Field>
          <div className="col-span-2 flex gap-4 text-sm">
            {(['online', 'offline', 'upi'] as const).map((c) => (
              <label key={c} className="flex items-center gap-2">
                <input type="checkbox" name={`channel:${c}`} defaultChecked={c !== 'upi'} className="h-4 w-4" />
                {c}
              </label>
            ))}
          </div>
          <div className="col-span-2">
            <Button type="submit">Add offer</Button>
          </div>
        </form>
      </Card>

      <H2>Brands and shops</H2>
      <div className="space-y-2">
        {brands.map((b) => (
          <Card key={b.id} className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">{b.name}</div>
              <Muted>
                {b.category} · gift cards: {b.redemption.online ? 'online' : 'no online'}, {b.redemption.offlineStores === 'all' ? 'all stores' : b.redemption.offlineStores === 'select' ? 'select stores' : 'no stores'}
                {b.redemption.validityDays ? ` · ${b.redemption.validityDays}-day validity` : ''}
              </Muted>
            </div>
            <form action={deleteBrand}>
              <input type="hidden" name="id" value={b.id} />
              <Button variant="ghost" type="submit" className="text-xs">
                Remove
              </Button>
            </form>
          </Card>
        ))}
      </div>
      <Card className="mt-3">
        <h3 className="font-medium">Add a brand or shop</h3>
        <form action={addBrand} className="mt-2 grid grid-cols-2 gap-3">
          <Field label="Name" className="col-span-2">
            <Input name="name" required placeholder="e.g. Tanishq" />
          </Field>
          <Field label="Category">
            <Select name="category" defaultValue="general">
              {CategorySchema.options.map((c) => (
                <option key={c} value={c}>
                  {c.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Gift cards work at">
            <Select name="offlineStores" defaultValue="all">
              <option value="all">All stores</option>
              <option value="select">Select stores</option>
              <option value="none">No physical stores</option>
            </Select>
          </Field>
          <Field label="Gift card validity (days, optional)">
            <Input name="validityDays" type="number" min={1} />
          </Field>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="online" defaultChecked className="h-4 w-4" />
              Gift cards work online
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="acceptsUpi" defaultChecked className="h-4 w-4" />
              Store accepts UPI
            </label>
          </div>
          <div className="col-span-2">
            <Button type="submit">Add brand</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
