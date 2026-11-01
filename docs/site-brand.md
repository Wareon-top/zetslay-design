# Shared logo and page icons

Use the existing orange Z mark from the landing page on every current site entry point.
`assets/zetslay-logo.webp` contains the original image bytes. `favicon.ico` contains common
browser sizes and also supports the browser's root icon fallback. `apple-touch-icon.png`
provides the 180px touch icon. No new logo design is introduced.

The shared `site-brand.css` keeps the existing desktop branding and adds compact visible
logo links to the mobile cabinet topbar and mobile auth content. These stay visible when
the sidebar or auth promotional panel is hidden. Login/register/hash navigation share the
same cabinet document and the same explicit favicon links.

The narrow installer adds icon/style links to the current landing, cabinet and legal pages,
retaining their bodies, script versions and page titles. It does not modify legal archives,
document content, publication hashes, auth logic or API configuration. The repository
update contains only brand assets and installer files; full current HTML pages and legal
documents are patched on the server rather than republished in this update. Rerun the
idempotent installer if a later page regeneration replaces these header links.

`deploy/update-site-brand.sh` installs assets before page headers, checks current page
snapshots, makes a private backup, and restores all changed files if publication fails.
No Node, Docker or API restart is needed. Update the browser with Ctrl+F5 after installation.

Validation: `python3 deploy/stage-site-brand.test.py`, `bash -n deploy/update-site-brand.sh`,
project validation, existing legal tests and browser checks for login/register and desktop/
mobile cabinet sections.
