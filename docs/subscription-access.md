# Subscription UI

Isolated `app/subscription-access.js/css` adds server-owned subscription status, date and saved discounts to Finances, a real promo form, administrative grant/extension/revocation on user cards, and promo creation/list/disable on the admin overview. Hidden business sections explain the required access and link to tariffs/trial status. Existing enabled-but-excluded plugins are labelled paused; their off button remains available. Catalogue descriptions, profile, security, support, documents and learning remain accessible.

Trial: 3 days, all shipped non-legendary modules; no perpetual free tier. Four paid plans and prices match the public catalogue. Rarity is not installation status. All functional enforcement is on the API and workers; hiding controls alone is not authorization.

Selecting a finance tariff reads `data-billing-pricing`'s current period and requests an exact server quote. The user may choose one redeemed live discount for that plan. Payment remains explicitly unavailable. No placeholder success, fake topup or client-side access grant exists.

A gift code gives the configured days immediately; a discount alone does not enable the service. Repeated submissions never add time again. Scope checks ignore responses after account change or closing the form. Private state and promo lists clear at logout. Server status refreshes each minute while the page is visible; functional API checks remain immediate, including after downgrade/expiry.

Admin grant requires confirmation checkbox and reason; replacement vs extension is explicit. UUID persists for retries after a lost response. Refresh the user card to begin a separate administrative operation. Creating a promo reveals only fields relevant to its type. Code uniqueness is permanent; expiry and activation count are set by the admin.

Update with `deploy/update-subscription-access-ui.sh` AFTER backend rollout. Script preserves the live HTML's local config and all other JS files, stages and tests before backup/copy, and restores files if copy fails. Browser visuals could not be checked in this environment; DOM/state tests and stage idempotency/preservation checks are included.
