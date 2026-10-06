# Public pricing section

`#tariffs` replaces the old placeholder with four plans: Start 149 RUB/month,
Growth 299, Pro 499 and Maximum 799. The style follows the user-supplied Pricing 6
screenshot/component: dark card bodies with thin rounded borders, blue/purple/
amber/teal blurred headers, small CSS avatars, large prices, pill CTAs, checked
feature lists and separated footnotes. Pro is featured. There are four desktop
columns, two tablet columns and one mobile column.

The supplied external preview URL was inaccessible; the supplied screenshot and
component were used directly. This vanilla landing needs no React, Next, Avatar,
Hugeicons or other dependency. CSS owns only the pricing namespaces.

Monthly pricing is rendered serverlessly in HTML. The JS progressively enables
month/quarter/year buttons; quarter has a 10% discount and year 20%. Integer
kopecks are used for all calculations. Cards show the effective monthly amount,
undiscounted monthly reference and full upfront period total. The monthly mode
has no fabricated strike-through. Buttons support native focus, arrows, Home,
End, aria-pressed and a dedicated live announcement. Without JS the monthly
prices and registration links remain usable and inactive controls stay hidden.

This is a public pricing proposal/presentation, not a billing implementation.
All CTAs open the existing registration URL; no checkout, plan enforcement,
trial, payment or account state changes are made. A shared note states that the
plans are preparing to launch. Included modules refer to published plugins,
not the future 53+ plugin target. Start has common, Growth adds advanced, Pro
adds ultra, Maximum adds legendary. Proxies, Kosell balance/rentals and future
user marketplace purchases are excluded. No fake old price, trial benefit,
priority-support SLA or multi-account allowance is claimed.

Run:
- `node --check landing-pricing.js`
- `node --test deploy/landing-pricing.test.mjs`
- `python3 deploy/stage-landing-pricing.test.py`
- `bash -n deploy/update-landing-pricing.sh`

Tests cover exact period totals for all plans, keyboard navigation, invalid
pricing input, hidden no-JS controls, scoped staging, preserved local covers/
auth scripts/cabinet, repeat installation and failure before publication.
Browser QA is unavailable in this managed environment.

The pinned updater uses the shared landing lock, stages the unique tariff
section plus CSS/JS tags, makes a backup, publishes assets and HTML atomically,
and restores existing files/removes newly created assets on failure. It never
replaces the whole index from GitHub or updates the cabinet. Stdin is closed to
preserve subsequent commands in an outer pasted shell heredoc. Set
`ZETSLAY_PRICING_DESIGN_REVISION` to the published commit SHA.
