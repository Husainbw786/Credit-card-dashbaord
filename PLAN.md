# Smart Spend – product plan

A personal "how should I pay for this?" assistant. You tell it what you want to buy
(or where you are standing), and it tells you the cheapest way to pay using the gift
card platforms and credit cards you actually have, with step-by-step instructions.

Worked example that this product must get right on day one:

> I want to buy a bracelet from the Giva showroom in Indore.
>
> Best route: buy a Giva gift card on Gyftr at 13% off, pay for the gift card with the
> SBI Cashback card (5% cashback on online spends), then redeem the gift card at the
> showroom.

| Route | Cost on ₹10,000 bill | Effective discount |
|---|---|---|
| Pay at showroom with SBI Cashback (offline rate, jewellery often excluded) | ₹10,000 – ₹9,900 | 0–1% |
| Gyftr gift card at 13% off, paid with any plain card | ₹8,700 | 13% |
| Gyftr gift card at 13% off, paid with SBI Cashback (5% online) | ₹8,265 | 17.35% |

The product's whole job is to find the last row automatically, for any shop, and to
warn about the catches (gift card accepted offline? monthly caps? exclusions?).

---

## 1. What the product does

1. **Card wallet** – add the cards you hold (pick from a catalogue, or just tell the
   assistant "I have SBI Cashback and HDFC Regalia Gold"). Each card comes with a
   structured perks profile: reward rates by channel and category, caps, exclusions,
   partner portals (SmartBuy, Grab Deals, etc.).
2. **Shopping assistant** – "I want to buy X at Y" or "I'm at Giva Indore, bill is
   ₹12,000". Returns the top 3 payment routes, ranked by effective cost, each with:
   the exact steps, the money math, the catches, and a confidence level.
3. **Strategies (your "variations")** – your known payment patterns stored as reusable
   playbooks. Variation 1 is "discounted gift card + cashback card". You will add 2–3
   more; the engine must accept new patterns without rewrites.
4. **Offers feed** – current gift card discounts (Gyftr, Magicpin, Woohoo, Park+,
   bank voucher portals), bank instant-discount offers at merchants, and coupon codes,
   with a "last verified" stamp.
5. **Tracking** – what you bought via which route, expected vs. received cashback,
   how much of each monthly cap you have used, and unused gift card balances.

Everything is single-user and personal to start. Multi-user comes only if you want it.

---

## 2. How a "route" is modelled

Every payment is a chain of hops from your money to the merchant. Each hop can
add a discount or reward and can carry constraints.

```
money ──(card C: reward r%, cap, exclusions)──► instrument I ──(discount d%)──► merchant M
```

Instruments: brand gift card, marketplace gift card (Amazon/Flipkart), wallet balance,
bank voucher portal voucher, reward points, or "none" (pay the merchant directly).

Examples of chains the engine must enumerate:

- Direct: card → merchant (uses the card's offline/online rate and any bank offer at
  the merchant).
- Gift card: card → gift card platform → brand gift card → merchant (Variation 1).
- Portal: card → bank voucher portal (points multiplier) → brand voucher → merchant.
- Marketplace: card → Amazon/Flipkart gift card at discount → product on marketplace
  with bank instant discount on top.
- Wallet: card → wallet load (if rewarded) → merchant accepting that wallet.

Chains are short (max 3 hops) and the number of cards, platforms and instruments is
small, so brute-force enumeration with pruning is fine. No fancy solver needed.

**Effective cost** of a route =
bill amount
– gift card / voucher discount
– card reward on the hop where the card is charged (rate × base, capped by the
  remaining monthly cap, zero if the hop's merchant category is excluded)
– merchant bank offer / coupon (respecting min spend and cap)
+ fees (platform convenience fee, card surcharge, GST on fee)

Points are converted to rupees using a per-card value that you set (e.g. HDFC points
worth ₹0.50 for vouchers, ₹1.00 for flights). The engine shows both "cash value" and
"best-case points value" so a points-heavy route isn't hidden.

**Catches** (shown next to every route, and they can disqualify a route):
- Gift card redeemable offline / at this store / partially / together with sale items?
- Gift card monthly purchase limit per brand on the platform.
- Card cashback cap for the month (remaining after tracked spend).
- Card category exclusions (jewellery, wallet loads, rent, fuel, utilities, EMI…).
- Does the gift card platform purchase itself count as "online spend" for the card?
- Delivery time of the gift card (instant SMS/email vs. hours) – matters in-store.
- Offer validity dates, minimum bill.

Each route gets a **confidence**: high (all rules verified recently), medium (one
unverified assumption, e.g. offline redemption), low (stale data or an untested
exclusion). "In-store" mode only shows routes with instant delivery.

---

## 3. Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  Web app (Next.js, mobile-first PWA so it works in a shop)      │
│  Cards · Assistant (chat + result cards) · Strategies · Offers  │
└──────────────┬────────────────────────────────────────────────┘
               │
┌──────────────▼───────────────┐   ┌───────────────────────────┐
│  Assistant (Claude, tool use)│──►│  Deal engine (pure TS)    │
│  parses intent, asks         │   │  enumerate routes, apply  │
│  clarifying Qs, explains     │◄──│  rules, compute cost,     │
│  routes in plain language    │   │  rank, attach catches     │
└──────────────┬───────────────┘   └─────────────┬─────────────┘
               │                                 │
┌──────────────▼─────────────────────────────────▼─────────────┐
│  Knowledge base (SQLite via Drizzle; Postgres later)           │
│  card products + perk rules · gift card offers · merchant      │
│  offers · redemption rules · your cards · your transactions    │
└──────────────┬────────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│  Ingestion                                                    │
│  manual entry · LLM extraction from card T&C / offer pages ·  │
│  scheduled fetch of gift card discounts (Gyftr, Magicpin…)    │
└───────────────────────────────────────────────────────────────┘
```

Design rules:

- **The LLM never does the arithmetic.** The deal engine is deterministic, unit-tested
  TypeScript. The assistant calls it as a tool and only interprets the output.
- **Every fact has a source and a date.** A perk rule or gift card discount without a
  `verifiedAt` is treated as unverified and lowers confidence.
- **Strategies are data, not code.** A strategy is a chain template plus filters
  (which platforms, which cards, which merchant categories). Adding Variation 2 is a
  new row, not a new module.

### Stack

- Next.js 15 (App Router) + TypeScript, Tailwind, shadcn/ui.
- Drizzle ORM on SQLite for local/dev; same schema moves to Postgres (Neon/Supabase)
  when hosted.
- Claude API with tool use for the assistant (model: latest Sonnet-class for cost,
  switchable). Tools: `get_my_cards`, `search_gift_card_offers`,
  `get_merchant_offers`, `compute_routes`, `web_search` (for fresh offers).
- Playwright for fetching gift card discount pages on a schedule (cron / GitHub
  Action), with rate limits and a manual-entry fallback.
- Zod schemas shared between engine, DB and assistant tools.
- Vitest for the engine; the Giva example is the first test.

Alternative: Python (FastAPI + Pydantic) for the engine and a React front end. Same
plan, two codebases. Recommendation is one TypeScript codebase unless you prefer
Python.

---

## 4. Data model (core tables)

```
card_products        issuer, name, network, annual_fee, point_value_default
perk_rules           card_product_id, channel (online|offline|portal|wallet_load),
                     categories[] / mcc[], rate, kind (cashback|points|instant),
                     monthly_cap, min_txn, excluded_categories[], portal_id,
                     source_url, verified_at
my_cards             card_product_id, nickname, billing_day, point_value_override,
                     cap_used_this_month (derived from transactions)

platforms            Gyftr, Magicpin, Woohoo, Park+, HDFC SmartBuy, Axis Grab Deals,
                     Amazon, Flipkart, CRED …  (type: gift_card|portal|marketplace|wallet)
gift_card_offers     platform_id, brand_id, discount_pct, promo_code, fee,
                     denominations[], max_per_month, delivery (instant|delayed),
                     valid_till, verified_at, source_url
platform_card_bonus  platform_id, card_product_id, extra_rate / multiplier, cap
brands               Giva, Tanishq, Croma … with category
redemption_rules     brand_id, online, offline_stores (all|select|none),
                     partial_redemption, stackable_with_sale, max_cards_per_bill,
                     exclusions, verified_at
merchant_offers      brand_id, issuer/card_product_id (nullable), kind
                     (instant|cashback|coupon), pct, cap, min_spend, channel,
                     valid_till, source_url, verified_at

strategies           name, chain_template (json), filters (json), enabled
transactions         date, route_json, amount_paid, card_id, expected_reward,
                     received_reward, gift_card_balance_left
```

---

## 5. Build plan

### Phase 0 – Deal engine proves the Giva example (week 1)

Goal: deterministic engine + seed data, no UI yet. Validates the whole idea cheaply.

- Define Zod schemas for the tables above.
- Seed data: your cards (you tell me), Gyftr with 5–10 brands you actually buy from,
  redemption rules for those brands, SBI Cashback perk rules with caps and exclusions.
- Implement route enumeration, cost calculation, catches, ranking.
- Tests: Giva ₹10,000 → engine ranks "Gyftr + SBI Cashback" first with ₹8,265, flags
  "confirm offline redemption at Indore showroom" and shows remaining cashback cap.
- A tiny CLI: `npm run route -- --brand giva --amount 10000 --channel offline`.

Deliverable: a route printed for any brand in the seed, with correct math.

### Phase 1 – Usable app (weeks 2–3)

- Cards page: catalogue picker (top ~40 Indian cards pre-loaded) + "tell the assistant"
  intake that maps free text to catalogue entries.
- Assistant page: chat input, structured result cards (steps, math, catches,
  confidence), "I'm in a shop" quick mode (brand + amount, instant-only routes).
- Strategies page: Variation 1 pre-built; add Variation 2 and 3 as you describe them.
- Offers page: table of gift card offers and merchant offers with verified dates and
  an "edit / mark stale" control.
- Manual entry forms for new offers and perk rules, so missing data never blocks you.

Deliverable: you can use it on your phone in a shop.

### Phase 2 – Keep the data fresh (weeks 4–5)

- Scheduled fetch of gift card discounts from Gyftr and Magicpin (and bank portals if
  you use them). Diff against stored offers; flag changes.
- LLM ingestion: paste a card's T&C / MITC PDF or an offer page URL → extracted perk
  rules in the schema → you approve → stored with source and date.
- Transactions log and cap tracking: log a purchase from a route in one tap; monthly
  cap remaining feeds back into ranking.
- Expected vs. received reward reconciliation (manual entry first; statement import
  later).

Deliverable: offers and perks stay current without you re-typing them.

### Phase 3 – Smarter and more places (later)

- More strategies and platforms (Amazon Pay / Flipkart gift cards, wallets, CRED,
  bank portals with points multipliers and points-to-miles valuation).
- Browser extension / share-sheet: on a checkout page, pop the best route.
- Alerts: "Giva gift cards are 18% off this week", "₹1,200 left on your SBI cap".
- Annual view: which card to renew, milestone progress.

---

## 6. Risks and how the plan handles them

| Risk | Handling |
|---|---|
| Gift card not accepted at the physical store, or only partially | Redemption rules table with per-brand offline policy; route shows the catch and asks you to confirm once, then remembers. |
| Card exclusions (e.g. jewellery excluded, but the gift card platform purchase is not) | Rewards are evaluated on the hop where the card is actually charged, with that hop's merchant category. |
| Monthly caps silently exhausted | Transactions log → remaining cap → engine uses the remaining amount, not the headline rate. |
| Offer data goes stale | `verified_at` on every row, confidence downgrade after N days, scheduled refresh, mark-stale button. |
| Scraping breaks or is disallowed | Prefer official/affiliate feeds; scraping is personal-use, rate-limited, and manual entry always works. |
| LLM invents a perk | LLM only extracts into the schema with a source quote; you approve before it is stored; math is never done by the LLM. |
| Gift card breakage (leftover balance) | Engine proposes denominations that fit the bill; tracker holds leftover balances for next time. |

---

## 7. What I need from you (not blocking Phase 0)

1. The list of cards you hold (issuer + variant).
2. Variations 2 and 3, in the same "suppose I want to buy… I would…" form as the Giva
   one.
3. Which gift card platforms you actually use (Gyftr for sure; Magicpin? Woohoo?
   bank portals like SmartBuy / Grab Deals?).
4. How you value points on each points card (or "I only care about cash").
5. Stack preference: one TypeScript codebase (recommended) or Python engine + React.

With just item 1, Phase 0 can start immediately using Gyftr + SBI Cashback.
