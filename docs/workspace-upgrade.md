# ZetSlay workspace update — 25 October 2026

A shared graphite and orange presentation system now covers the cabinet shell, navigation, forms, product cards and numerical metrics. Numbers use tabular spacing, large clear values, restrained surface lighting and distinct labels. Dashboard resources remain available below working data. Connected shops no longer see the setup checklist above their metrics. The existing subscription, permissions and onboarding machinery is preserved.

New working views:

- A persisted event centre with search, categories, unread and attention filters, pagination, read marks and safe links into existing orders, messages, support and proxy checkout.
- Read-all uses the returned sequence watermark. Late arrivals remain unread. An opened unread event remains available in the detail pane after it leaves the unread filter.
- An analytics view over actual archived snapshot data: currency and period selectors, sales, orders, average order, refunds, leading products and activity by Moscow creation hour. No invented growth comparison or income claims.
- Dashboard tasks reflect connection state, unread events and observed operations requiring attention. The bell opens the working event centre.

## Server scope

Paired core revision: `4e2a097f0d7c4c4d768d94ffa1119dbd80d77624`.

Two additive PostgreSQL tables retain observed events and read state. Sources are existing persisted order/message archives, proxy purchases, support replies and automation history. Background projection visits up to 25 workspaces per pass every 30 seconds, with a single in-flight pass. Initial historical events are read by default. Older paid/processing attention is cleared when a newer state for that object is observed.

The projector makes no requests to FunPay, proxy suppliers or payment providers. It stores allowlisted metadata, not message bodies, vault handles, tokens or proxy credentials. All API reads and read marks authenticate the current workspace. The feed is an observation history; transient states between observations and records beyond the bounded archive windows are not guaranteed to appear. It is not a replacement for the accounting ledger or complete security audit.

## Install and recovery

`deploy/start-workspace-upgrade.sh` pins both repositories. It preflights current HTML, patches only the two running server modules, adds event modules in an offline COPY-only image, prepares event tables, tests the candidate and switches the API before publishing the UI. Existing runtime variants, payment/bot fixes and complete installed page contents are retained.

A private archive preserves the previous HTML and any previous presentation assets. The previous API container is retained stopped. API failures use the established automatic rollback. Additive event tables remain so rollback does not destroy event history. The installer never buys a proxy, sends a customer message or creates a real payment.

## Verification

- Full local server suite: 1373 passed; disposable PostgreSQL test is run separately in CI.
- Full local frontend suite: 703 passed.
- Exact runtime patch/idempotency tests, offline layer permissions and fake event preflight.
- Frontend staging/idempotency and partial-publication rollback tests.
- Core CI: real PostgreSQL plus both Docker builders.
- Browser QA uses isolated fake data, never a real customer session or purchase.

## Further releases

The rollout establishes the design system, operational feed and analytics. A general automation-rule editor, direct tariff checkout, referral accounting and additional marketplaces remain separate implementation stages; they are not presented as working features in this release. Existing automation and financial modules receive the shared presentation without changing their execution rules.
