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
`OPENAI_API_KEY`. The shop assistant then parses free text with OpenAI's Responses API
(model `gpt-6.1-sol` by default, `OPENAI_MODEL` to change) and the "Search the web"
button finds live gift card discounts and bank offers for a brand, with source links,
for you to accept into the Offers table. `ANTHROPIC_API_KEY` alone enables Claude for
parsing only. With no key, a local rule-based parser is used and web search is off.

## Deploy on Vercel

1. Import the repo; set **Root Directory** to `apps/web` (the monorepo root is used for
   install automatically).
2. Add a database from the Storage tab so your cards, offers and brands persist.
   Either works, Postgres is recommended:
   - **Neon (Postgres)**: sets `DATABASE_URL` automatically. Any other Postgres
     (Supabase, Railway, your own) works too; paste its connection string as
     `DATABASE_URL`. The app creates its one table on first use.
   - **Upstash for Redis**: sets `KV_REST_API_URL` / `KV_REST_API_TOKEN`.

   Without a database the app still runs, but edits live in the function's temp
   directory and reset on redeploy; a banner says so.
3. Add `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT`).
4. Redeploy.

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

User-editable state (wallet, offers, brands, strategy toggles) is one JSON document:
in Postgres when `DATABASE_URL` is set, else in Upstash Redis when its REST credentials
are set, else in `apps/web/data/user-state.json` (override with
`SMART_SPEND_DATA_FILE`), created from the engine seed on first run. The card catalogue and platforms stay in
`packages/engine/src/data`.

## Status

- Phase 0 (engine) and Phase 1 (web app) are done.
- Next: Phase 2 — scheduled fetching of gift card discounts, LLM extraction of card
  terms into the schema, transaction log with cap tracking, Postgres when hosted.
