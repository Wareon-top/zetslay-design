# Landing hero and platform ribbon

The hero uses the existing heading, Manrope font/weight and orange background
from `landing.css`. The supplemental `landing-hero.css` changes composition and
spacing only. Other landing sections, header, brand and native auth links remain.

The ribbon lists FunPay as available; GGsel, Plati.Market and Starvell are marked
as planned integrations. There are no invented API connections or customer counts.
Its two identical groups form a continuous CSS loop. The duplicate is hidden from
screen readers. A pause toggle, hover over the ribbon, hidden-tab suspension and
`prefers-reduced-motion` control movement. With reduced motion the four platforms
are displayed as a static wrapping list.

Marks are hosted locally and do not fetch third-party images at runtime:

- FunPay blue symbol: the original symbol path from
  `https://funpay.com/img/layout/logo-funpay.svg`.
- GGsel: the 128px site favicon retrieved from Google's public favicon cache,
  `https://www.google.com/s2/favicons?domain=ggsel.net&sz=128`.
- Plati.Market: the 64px original icon from `https://plati.market/favicon.ico`.
- Starvell: the compact SVG symbol in the public header at `https://starvell.com/`.

The PNG icons retain their original pixels inside SVG containers; the vector
symbols retain their original paths. Platform names are plain text beside marks.

`deploy/update-landing-hero.sh` stages only the hero/ribbon, their own resource
tags and six assets. It preserves the VPS's other HTML, original `landing.css`
and entire `app/` directory. It validates before mutation, backs up replaced
files, publishes assets before HTML and restores the backup on failure. Unknown
local structures stop without changing the served site. Repeated updates are
idempotent. No API restart is required.
