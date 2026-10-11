# Snapshot refresh deadline

The isolated module bounds only GET `/api/v1/funpay/content` to 125 seconds,
including response-body parsing. This covers the existing 30-second connection
lock wait plus the 90-second server snapshot deadline and cleanup. It cancels
browser fetch on expiry/logout, rejects even if an adapter ignores abort,
retains the last displayed snapshot and lets the existing shared flight settle.
A late response never applies to the next account. Elapsed time shown on busy
refresh buttons is browser waiting time, not invented server progress.

Supplier purchases, refund/write policies, API keys, subscription enforcement
and queues are unchanged; the module makes no automatic retries. Malformed or
wrong-workspace snapshots cannot replace the display. Native server errors
(including SYNC_BUSY and SYNC_TIMEOUT) remain actionable. Browser cancellation
does not cancel a shared background worker, which may legitimately finish.

Deploy after the backend fix via `deploy/update-store-sync-deadline.sh`. The
installer preserves live HTML/custom app JS, tests before mutation and backs up
the affected files. Tests cover actual shared-flight and overview functions in
a VM; this environment has no real browser or access to the production VPS.
