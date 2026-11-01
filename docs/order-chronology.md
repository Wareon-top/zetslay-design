# Orders chronology and calendar periods

Orders open newest first, using confirmed creation timestamps. A later status update, refresh or last-seen timestamp never substitutes for creation. Equal timestamps are ordered by order ID; orders without confirmed dates are last. The original FunPay date label remains visible, but dates missing a year are not guessed.

The date controls use Europe/Moscow (UTC+3): today, yesterday, 7 and 30 calendar days including today, Monday-based current week, current month and an inclusive custom date range. Invalid ranges produce an explicit correction message and no matches. A separate filter exposes undated orders. KPI totals apply to the selected period; status counts additionally respect search and currency. Different currencies are not compared as equal amounts.

Filtering and sorting operate on the loaded archive, without marketplace requests or mutations. The archive retains observed orders, not a guaranteed complete FunPay lifetime history. The API returns at most 5000 entries; the UI explicitly discloses truncation. Earlier orders become available only when observed. Account/store switches clear local filters and detail dialogs.

The backend migration adds a typed creation timestamp and chronological index, safely normalizes existing valid timestamps, and clears invalid/future creation values while preserving source labels, statuses, amounts and first/last observation metadata. It does not modify fulfillment queues, purchases, credentials, supplier rentals or marketplace lots. New events and supplier purchase logic still consume the existing live snapshot, not archived historical orders.

## Installation
Use pinned revisions for deploy/update-order-chronology.sh (core) and deploy/update-order-chronology-ui.sh (design). The core installer runs the complete test suite and a disposable PostgreSQL 16 migration/invariant audit before production migration. The UI installer stages only the Orders section and assets, tests them with the actually installed app.js/overview.js, checks for concurrent modifications, backs up the existing files and writes HTML last. Installed authentication and shared sync code remain unchanged.

## Verification
Unit tests cover chronological offsets, recent updates to old orders, undated records, stale snapshots, stable ties, tenant isolation, day/week/month boundaries, leap dates, inclusive custom endpoints, invalid ranges, period-scoped totals, local-only controls, pagination resets and session/store changes. The disposable PostgreSQL check exercises real typed sorting and malformed legacy data, migration idempotency and isolation. Python deployment tests verify preservation, rejection of unknown layouts and the actual staged installer.
