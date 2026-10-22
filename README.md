# Smart Spend

Personal assistant that finds the cheapest way to pay for a purchase using your
credit cards and discounted gift cards (e.g. Gyftr gift card at 13% off, bought with a
5% cashback card).

See [PLAN.md](PLAN.md) for the product plan, architecture and build phases.

## Status

Phase 0 is done: a deterministic deal engine with the user's seven cards seeded,
the Giva example as a test, and a CLI. See `packages/engine/`.

```
npm install
npm test
npm run route -- --brand giva --amount 10000 --channel offline --in-store
```

Layout:

- `packages/engine` – schemas, reward resolution, route enumeration, seed data, CLI.
- `apps/web` – (Phase 1) Next.js app with card wallet, assistant and offers pages.
