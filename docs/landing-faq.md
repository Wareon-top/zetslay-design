# Landing FAQ

The unique `#faq` section is replaced with a neutral two-column layout: sticky
intro/guide on desktop, search/filter controls and native disclosure cards.
Mobile stacks the intro above the answers. No generated imagery, new external
services, dependencies or cabinet changes are introduced.

Twelve answers cover registration, connection prerequisites, account limits,
current/planned platforms, messaging, seven published plugins, cloud operation,
proposed tariffs, external costs, encrypted access, connection diagnostics and
independence from FunPay. The obsolete assertion that the connector can never
send messages is removed. Messaging is conditional on configured sending and
enabled plugin settings. Manual replies use the Telegram console; the web inbox
currently displays conversations. Only FunPay is available; other platforms are planned.
Pricing is preparing to launch, not a live checkout. No multi-store benefit or
proxy/Kosell cost inclusion is claimed.

Without JS all questions remain visible and native details work. One answer is
initially open; a shared details name groups them, with a toggle fallback in JS.
The JS progressively shows search, topic buttons, result count and clear/reset.
Search covers titles and answer text, combines all query terms, normalizes
Russian case and ё, and intersects the selected topic. Empty search results
have a working reset action. Escape clears search. No query is sent to an API,
logged or interpolated into HTML. Native buttons and summaries retain keyboard
behavior; input labels, aria-pressed, live result count and reduced motion are
provided.

Validation:
- `node --check landing-faq.js`
- `node --test deploy/landing-faq.test.mjs`
- `python3 deploy/stage-landing-faq.test.py`
- `bash -n deploy/update-landing-faq.sh`

Tests cover filter/search intersection, case/ё, multi-term queries, empty state,
clear/reset/Escape, accordion fallback, unrelated-page no-op, byte-preserving
staging, existing user covers/auth scripts/cabinet, repeated installs and
rejection before output on missing or ambiguous inputs. Browser QA is not
available in this managed environment.

The pinned updater uses the shared landing lock, validates all inputs, backs up
served assets and atomically publishes CSS/JS then HTML. It modifies only the
FAQ subsection and its asset tags. On failure existing files are restored and
newly created assets removed. Closing stdin preserves subsequent pasted shell
commands. Set `ZETSLAY_FAQ_DESIGN_REVISION` to the published SHA. No API/container
restart is required.
