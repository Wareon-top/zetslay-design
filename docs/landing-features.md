# Reference Bento landing block

Only `#features` changes. The orange hero, font, platform ribbon, public plugin
catalog (including administrator-uploaded covers), login links, cabinet and API
are preserved by the focused installer.

The user-provided screenshot and component define this layout: four desktop
columns, 24px gaps, span pattern `2,1,1 / 1,2,1 / 1,1,2`, two columns from 768px
and one below 768px. Cards are black with a thin neutral border, 16px corners,
monochrome interface fragments and an icon beside the bottom caption. This
section deliberately does not use ZetSlay amber/blue styling or generated art.
The registry was inaccessible (HTTP 403); the provided screenshot and component
were used directly. No React/shadcn or animation dependency was added to this
buildless landing.

Nine cards present dialogues, analytics, plugins, Telegram notifications,
product management, lot cloning, encrypted access, cloud operation and reminders.
All fragments are static examples, labeled once below the grid. No account data
is fetched and there are no fake operational controls. Decorative fragments are
hidden from assistive technology; titles and descriptions remain semantic.

`landing-features.js` progressively enhances the grid with a single entrance,
100ms staggering and a -50px viewport margin. Without JavaScript or with reduced
motion enabled, all content remains visible. CSS is scoped to this block.

Run `python3 deploy/stage-landing-features.test.py`,
`node --test deploy/landing-features.test.mjs`,
`node --check landing-features.js`, and `bash -n deploy/update-landing-features.sh`.

The updater stages only `index.html`, `landing-features.css` and
`landing-features.js`, validates the candidate, shares the hero update lock,
backs up existing assets and publishes HTML last with atomic file replacement.
Rollback restores existing files and removes newly created assets. Repeat
updates are idempotent. It closes stdin so a pasted outer heredoc is not consumed
by child commands. Set `ZETSLAY_FEATURES_DESIGN_REVISION` to a published SHA for a
pinned install. No container restart is needed.

Browser QA was unavailable in this managed environment; preservation, markup,
resource scoping, responsive rules and animation behavior were checked locally.
