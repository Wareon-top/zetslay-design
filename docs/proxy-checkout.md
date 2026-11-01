# Proxy checkout repair — 2026-10-25

The previous UI repair bounded catalogue and status reads, but checkout still awaited supplier creation and two FunPay checks before returning its saved operation. This reproduced indefinite waiting when the supplier response or its body stalled. This is a reproduced code path, not a diagnosis of a specific production account.

The paired core revision `e0d9d933dd2f5762a60b755d1187e3b6d7cb639d` acknowledges committed reservations and schedules existing delivery/reconciliation in the background. Explicit deadlines bound the complete supplier response. Existing idempotency, durable supplier claims and financial transitions remain in place.

The UI bounds checkout responses independently of AbortSignal. An unknown result retains its request ID and never automatically sends another purchase. Polling stops after a bounded window; an old pending operation shows a manual result check instead of endless animation. Delayed POST responses cannot overwrite a later confirmed operation or a new quote.

## Installation

Run `deploy/start-proxy-checkout-repair.sh` from its pinned design revision with `ZETSLAY_PROXY_CHECKOUT_REVISION`. It preflights the current UI, applies exact patches to the running API image with a COPY-only offline layer, then patches the current HTML cache tokens and two JS modules. Private backups and the stopped previous API container are retained. Unrelated runtime source and page contents are preserved. No dependency installation, full repository checkout, or Docker daemon restart is required.

Preflight exercises fake checkout with an in-memory balance and blocked fake supplier. Production diagnostics only read aggregate pending-state counts and make a supplier catalogue GET. They do not purchase, refund or reconcile real orders. Supplier errors are reported separately; unavailable catalogue diagnostics do not invalidate the loader repair.

## Verification

- Frontend: 40 proxy tests; full app/root/pricing/link suite: 701 passed.
- Backend: 29 proxy tests; full suite: 1366 passed.
- Frontend installer: three staging/rollback tests plus three legacy staging tests.
- Core CI verifies both Docker builders against the current-image patch and fake checkout probe.
- No real purchase, delivery or production installation has been verified from this workspace. The server installation log reports runtime supplier availability.
