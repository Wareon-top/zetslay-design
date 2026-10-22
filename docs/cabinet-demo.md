# Interactive cabinet before activation

An authenticated account without active access sees a local teaching example in Overview, Orders, Messages, Lots and Finance. Active access restores the original shop views. This is an interface demonstration, not a free plan: server permissions, purchases, synchronization and supplier operations continue to require active access.

The example has its own synthetic orders, costs, commissions, conversations and lot states. It never reads `state.storeContent`, orders or messages from a customer account. Dates are relative to a session-local day; monetary totals and charts derive from the same integer-kopeck rows. Refunds are excluded from sales; commission is explicitly a fictional 5% assumption. Profit excludes taxes and unlisted expenses.

Three optional practice actions demonstrate a period change, a template reply and a lot pause. Search, status filters, period selection, draft editing and replies run locally. They never make network requests. Progress, drafts and changes live in memory, reset on sign-out/account change or real access activation, and can be reset by the user. There is no simulated auto-reply from a buyer and no claim that demo messages were sent to FunPay.

Trial activation uses the existing server-owned eligibility and explicit click handler, with pending and failure states. Used trials offer subscription and promo entry; unknown eligibility offers a check before activation. The trial includes common, advanced and ultra plugins. Legendary examples are labelled separately and do not grant access. Permanent plugin licenses still require an active paid plan for use.

`deploy/update-subscription-access-ui.sh` stages only the preview/access assets and their versioned HTML references, runs focused checks and backs up changed assets before installation. Existing app.js, API origin, legal documents, subscription prices and backend configuration remain outside this update.

Verification: local model tests cover consistent totals, no private data interpolation, HTML escaping, allowed navigation, bounded drafts, scope isolation and absence of demo writes. `scripts/verify-cabinet-demo-browser.cjs` exercises the actual cabinet on desktop/mobile, including server-confirmed trial activation and restoration of the original views. GitHub Actions stores the screenshots.

Conversion intent: visitors can experience a concrete workflow before activation, then start the trial or compare real tariffs. A conversion increase must be measured after release; this change does not invent a percentage uplift or add a separate analytics service.
