# Close an unpaid topup and start another one

The wallet history and topup dialog offer “Не буду оплачивать” for pending, creating and
unknown topups. Closing the intent removes it from active checkout and opens the amount
form. Already paid funds and receipts are never dismissed or changed by this action.
Only the server verifies payment and credits the balance; old real confirmations remain valid.

The dialog can close an intent even if the gateway is temporarily unavailable or the legal
publication has changed. Creating a new invoice still requires the published conditions and
explicit consent. Session changes discard delayed responses and never reopen the old user's
dialog. A stale checkout conflict reloads current active intents instead of leaving a dead end.

`deploy/start-payment-intents-repair.sh` installs a pinned pair of API/UI revisions in an
SSH-independent systemd job. The API installer patches the current image and retains its
original container and backup. The frontend installer only updates `payments.js`,
`payments.css` and their two versions in the current `app/index.html`, retaining all other
HTML, auth, onboarding and banner changes. It creates a private tar backup and restores it
after a partial write. No frontend dependency install or service restart is needed.
