# Subscription catalogue · 2026-10-09

`subscription-plans.json` is the single source for public and cabinet tariff
names, monthly prices, included categories, examples and period conditions.
The published prices are Start 149 RUB, Growth 299 RUB, Pro 499 RUB, Maximum
799 RUB per month. Each plan includes the previous plan. Categories follow
`app/plugin-rarity.js`: common (Confirm / Review Reminder), advanced (Lot Cloner,
Mass Price Editor, Sales Pause, Auto Review Bonus), ultra (Kosell Rent, TikTok /
Roblox LZT Market, Stars Relay), legendary (Robux Relay).

There are no promised counts for future plugins. Only published own plugins
are included. One FunPay store, the personal bot and core shop tools are common
benefits. Proxy, external products, rental balance, Robux, Stars and marketplace
fees are separate. Future third-party plugin purchases are excluded.

The existing 10% quarter and 20% twelve-month discounts are retained. Prices
are calculated in integer kopecks. Both effective monthly price and full
upfront total are shown. The finance dialog uses the catalogue and selected
period instead of trusting stale card text. It lists included features and
links to terms and refunds. Automatic recurring charges remain unavailable.

This change publishes service prices and presentation, not a payment
integration. Platega API, accepted orders, payments and enforcement of paid
category entitlements are not implemented here. Existing demo access and
installed plugins are unchanged. Purchase buttons show conditions; public
CTAs open registration. The legal documents retain their separate draft
status until legal/payment readiness is completed.

Platega review: `maxTransactionKopecks` is 1,000,000 (10,000 RUB). The build
rejects any full-period tariff above that amount, and generated quote modules
refuse excessive quotes. `isPaymentAmountAllowed` also rejects invalid or
non-integer minor-unit amounts. Document links and the review-only marker
`плаtega` appear in both tariff sections. Clear `approvalMarker` and rebuild
after the cash register is approved; document links and the limit stay.

This is a quotation guard, not server-side payment enforcement. Before
enabling payments, apply the same bound to the backend's authoritative total
for every top-up and purchase, before sending a request to the provider.
Never trust a browser amount, split purchases to bypass the limit, or accept
an invoice above the limit. The current payment/top-up endpoints do not exist.
Public document links do not turn draft legal texts into effective documents.

Build and verify:

```sh
python3 deploy/build-subscription-pricing.py .
python3 deploy/build-subscription-pricing.py . --check
node --test app/billing.test.mjs deploy/landing-pricing.test.mjs
python3 deploy/stage-subscription-pricing.test.py
bash -n deploy/update-subscription-pricing.sh
```

The builder updates only #tariffs, #billing-tariffs, their generated quote
modules, three relevant FAQ answers and cache tags. `app/billing-section.html`
is regenerated too, preserving compatibility with the prior finance updater.

Use the pinned `deploy/update-subscription-pricing.sh` release on VPS. It stages
only these tariff sections, FAQ items and the tariff branch of billing.js.
It preserves the live hero, plugin covers, account/store controls, custom
payment dialogs and every other section. It tests before publication, uses
the landing update lock, backs up changed files, publishes modules before
HTML and restores files on installation failure. It does not restart the API
or activate/change a subscription.
