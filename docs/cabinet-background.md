# Cabinet ASCII background

A single decorative canvas is mounted inside `main.workspace` and shared by all
cabinet sections, including dynamically rendered plugin/admin views. It adapts
the same noise, character ramp and mouse resolve supplied for the landing page.
The sidebar, sticky header, forms, cards, tables and dialogs retain their styles.
The canvas has `pointer-events:none`, is hidden from accessibility tools, and
paints beneath the workspace content.

Opacity is 8.5% on desktop and 6.5% on phones, with extra attenuation under page
headings. It follows the viewport rather than the full page height. DPR is capped
at 1.5, the character grid adapts on large screens, and drawing is capped at 25fps.
Hidden tabs, page-cache navigation and a hidden/logged-out shell suspend motion.
Reduced-motion/save-data users get a static background. Navigation reuses the
same canvas and animation loop. No account values, network requests or storage
are used by this module.

`deploy/update-cabinet-background.sh` installs only the two background assets and
adds their versioned tags to the actual live `app/index.html`. It preserves
`app.js`, API configuration, unrelated markup, custom modules and the landing
page. Git blob checks, a private tar backup, HTML-last publication and restoration
on a partial publication failure are included. Host Node.js is optional; Docker
and service restarts are not required.

Run with `ZETSLAY_CABINET_BACKGROUND_REVISION` set to a fetched commit. The previous
repository version is `e1af76481cebf2cd22e469dd2f707f630ab584b7`. Actual VPS backups
are printed as `/root/zetslay-before-cabinet-background.*.tar.gz`.

Verification: lifecycle/resize/reduced-motion tests; exact HTML preservation,
repeatable staging, installation without host Node, and rollback after a partial
publish; browser inspection of all 11 navigation sections plus desktop, 390px and
320px views using local fixtures (no live account mutations).
