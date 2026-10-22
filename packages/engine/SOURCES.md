# Data sources and open questions

Every reward rule in `src/data/cards.ts` carries a `sourceUrl` and `verifiedAt`.
Official bank pages could not be fetched from the build environment, so most rules
come from third-party reviews found on 2026-10-22. Treat them as "probably right,
verify before relying on a big purchase".

## Per card

| Card | What is seeded | Main sources | Verify |
|---|---|---|---|
| Cashback SBI Card | 5% online / 1% offline, ₹2,000 cap each per cycle (from 1 Apr 2026), long exclusion list incl. jewellery; gift card purchases earn (user experience) | [livefromalounge](https://livefromalounge.com/sbicards-cashback-card-imposes-new-restrictions-effective-april-1-2026/), [cardadvisor](https://cardadvisor.in/cards/sbi-cashback) | Official MCC exclusion list |
| SimplyCLICK SBI Card | 10X partners (2.5%), 5X other online (1.25%), 1X else; 10,000-pt monthly caps; ₹0.25/pt | [SBI MITC](https://www.sbicard.com/sbi-card-en/assets/docs/pdf/simply-click-tnc-MITC-booklet.pdf), [cardadvisor](https://cardadvisor.in/cards/sbi-simply-click) | Whether Gyftr is a 10X partner (one review says yes) |
| Amazon Pay ICICI | 5% Amazon (Prime) / 3% non-Prime, 2% partners, 1% other; exclusions widened Oct 2025 | [cardadvisor](https://cardadvisor.in/cards/icici-amazon-pay), [1finance](https://1finance.co.in/blog/amazon-pay-icici-credit-card-review/) | Rate on gift card purchases; Prime status |
| Flipkart Axis | 7.5% Myntra, 5% Flipkart, 5% Cleartrip (₹4,000/quarter each), 4% partners, 1% other; Flipkart/Myntra gift cards earn nothing | [Flipkart FAQ](https://www.flipkart.com/pages/axis-bank-credit-card-faq), [cardadvisor](https://cardadvisor.in/cards/axis-flipkart) | Whether third-party gift card sites earn 1% |
| Swiggy HDFC | 10% Swiggy, 5% select online categories, 1% other (caps ₹1,500/₹1,500/₹500); gift cards, wallets, jewellery excluded | [HDFC page](https://www.hdfcbank.com/personal/pay/cards/credit-cards/swiggy-hdfc-bank-credit-card), [Ornge/BLCK T&C](https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdfs/Combined_TnCs_Ornge_and_BLCK.pdf) | Which variant you hold (original 10%, Ornge 5%, BLCK 10%) |
| OneCard (BOBCARD) | 1 pt per ₹50 (≈0.2%), 5X on top categories disabled by default; ₹0.10/pt | [OneCard blog](https://www.getonecard.app/blog/onecard-credit-card-rewards/), [cardadvisor](https://cardadvisor.in/cards/onecard) | Point value (₹0.10 vs ₹0.25) |
| Jupiter Edge+ CSB RuPay | 50% Jewels (≈10%) on shopping brands with caps, 5% Jewels (≈1%) on everything else incl. UPI; ₹0.20/Jewel | [cardadvisor](https://cardadvisor.in/cards/jupiter-edge), [Jupiter](https://jupiter.money/cc-cashback/), [livefromalounge](https://livefromalounge.com/jupiter-edge-plus-credit-card-features/) | Current caps (sources conflict) |

## Brands and platforms

- Giva gift cards: redeemable at Giva stores and giva.co, 180-day validity, ₹500–₹1,00,000
  ([Magnify listing](https://magnify.club/buy-gift-card/giva/)). Gyftr 13% discount is user-reported.
- Platforms seeded: Gyftr, Magicpin, Park+, Woohoo, Magnify, Zingoy (gift cards), Amazon and Flipkart (marketplaces).
  No independent, dated discount comparison exists; discounts change weekly and must be entered per brand in `offers.ts`.

## Open questions for the user

1. Amazon Prime member? (`flags.prime` on the Amazon Pay ICICI card, currently `true`.)
2. Which Swiggy HDFC variant: original (10% Swiggy), Ornge (5%) or BLCK (10%)?
3. Gift card purchases on SimplyCLICK, Amazon Pay ICICI, Flipkart Axis, OneCard, Jupiter: do they earn? Tell the engine once you see a statement.
4. Variations 2 and 3.
