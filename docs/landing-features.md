# Landing features: five cards

`index.html` replaces only `#features` with a six-column layout: three compact
cards on the first row and two wide cards below. `landing-features.css` owns the
new scoped classes. At tablet widths the grid uses two columns; on phones it
uses one. The orange hero, platform ribbon, cabinet and backend are independent.

The illustrations are decorative inline SVG and locally hosted platform marks.
They do not impersonate live account data or introduce additional API requests.
The cards keep the requested headings. Copy distinguishes present functionality
from plans: FunPay orders/messages and Confirm Reminder are available; 30+
plugins is a catalog goal, other marketplaces and product editing are planned,
and forums are planned alongside existing statistics.

The section uses `data-landing-features="bento"`, with `data-feature-card`
values `orders`, `dialogs`, `plugins`, `products`, and `stats-forums`.
Its anchors and heading IDs remain accessible, and illustrations are hidden
from screen readers. Panels use the existing dark CSS variables and restrained
amber accents; no additional background gradients or glow effects are added.

`deploy/update-landing-features.sh` fetches a pinned repository revision, stages
only this section and its five assets, validates the candidate, creates a backup
and publishes the HTML last. It shares the hero installer's lock. Local hero,
login links, other sections, `landing.css`, and `app/` are preserved. A failed
installation restores the previous files. No container restart is needed.

Run `python3 deploy/stage-landing-features.test.py` to verify preservation,
repeat updates, ambiguous-section rejection and missing-asset rejection.
