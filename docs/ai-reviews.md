# AI Reviews cabinet

Legendary card, existing administrator cover flow and rich catalogue description.
The module management shows provider/model selection, a masked write-only key input,
rating thresholds, prompt, UTC generation limit, optional chat thanks and Telegram
notifications. Public replies remain approval-required until explicitly changed.

Review and draft text is HTML escaped. Owner edits need save before approval. An
approval requires a current server draft hash; edits/review changes revoke it.
Unknown publication offers read-only reconciliation, not a retry button. API keys
are cleared from the input immediately and never kept in local/session storage.
Late requests cannot fill the next account's UI. Busy server status preserves the
last known state and presents a retry message.

`deploy/update-ai-reviews-ui.sh` stages only the dedicated module files and surgical
additions to plugin-page.js, plugin-rarity.js, subscription-access.js and index.html.
It validates staged sources and preserves local cabinet customizations and covers.
No cover is generated. Real browser visual QA and authenticated live provider/FunPay
writes were not performed in this environment; DOM tests validate layout markup,
escaping, credential submission and account changes.
