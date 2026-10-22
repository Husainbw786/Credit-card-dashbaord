# @smart-spend/engine

Deterministic deal engine: given a purchase (brand, amount, channel) and your cards,
enumerate every payment route (direct, discounted gift card + card) and rank by
effective cost, with catches and a confidence level.

```
npm run route -- --brand giva --amount 10000 --channel offline --in-store
npm run route -- --list-brands
npm test
```

Data lives in `src/data/`. Add a gift card discount in `offers.ts`, a new brand in
`brands.ts`, a card in `cards.ts`. See `SOURCES.md` for provenance.
