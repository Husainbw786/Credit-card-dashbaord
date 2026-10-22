# Smart Spend

Personal assistant that finds the cheapest way to pay for a purchase using your
credit cards and discounted gift cards (e.g. Gyftr gift card at 13% off, bought with a
5% cashback card).

See [PLAN.md](PLAN.md) for the product plan, architecture and build phases.

## Run it

```
npm install
npm run dev        # web app on http://localhost:3000
npm test           # engine tests
npm run route -- --brand giva --amount 10000 --channel offline --in-store   # CLI
```

Optional: copy `apps/web/.env.example` to `apps/web/.env.local` and set
`ANTHROPIC_API_KEY` to let the shop assistant parse free text with Claude. Without a
key it uses a local rule-based parser (brand name, amount, store/online, "I'm at").

## Layout

- `packages/engine` – schemas, reward resolution, route enumeration, seed data for
  the cards, tests, CLI. Pure TypeScript, no I/O.
- `apps/web` – Next.js 15 app (mobile-first):
  - **Shop** – "just tell me" box or a structured form; ranked routes with steps,
    catches, confidence and the full math.
  - **Cards** – your wallet, caps used this cycle, Prime flag, point value overrides,
    catalogue picker, custom flat-rate cards.
  - **Offers** – gift card discounts per platform and brand (verify / mark stale /
    delete), bank and merchant offers, brands with redemption rules.
  - **Strategies** – toggle payment patterns on and off.

User-editable state (wallet, offers, brands, strategy toggles) is stored in
`apps/web/data/user-state.json`, created from the engine seed on first run. Override the
path with `SMART_SPEND_DATA_FILE`. The card catalogue and platforms stay in
`packages/engine/src/data`.

## Status

- Phase 0 (engine) and Phase 1 (web app) are done.
- Next: Phase 2 — scheduled fetching of gift card discounts, LLM extraction of card
  terms into the schema, transaction log with cap tracking, Postgres when hosted.
