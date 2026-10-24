# ZetSlay first screen — Order flow, 24 October 2026

The first screen uses the existing ZetSlay logo, native authentication links and
headline. A compact overlaid menu leads to the existing features, plugins, prices
and FAQ. No dashboard demonstration or invented sales figures were added.

The orange artwork is the selected generated ZetSlay composition: overlapping
rounded hexagonal Z medallions, larger cropped pieces at the edges and a darker
middle reserved for text. `assets/zetslay-orderflow.webp` is 1672 × 941 pixels,
about 103 kB. It is preloaded and displayed with an empty alt because it is
decorative. This file contains only artwork; heading and buttons are real HTML.

`landing-orderflow.css` scopes the new header, image, orange glow, 1 px square
pattern, vignette and responsive typography to this first screen. The existing
`landing.css`, platform ribbon and all other landing sections retain their code.
At small widths the image is composed from a centered wider crop and the menu
uses native details/summary. It closes after an anchor, outside click or Escape.

`landing-hero.js` draws sparse small particles slowly upward, limiting draw calls
to 30fps and canvas pixel ratio to 1.5. Motion stops in hidden tabs, outside the
viewport and for reduced-motion preferences. Save-data disables particles.
Reduced motion also disables glow and ribbon animation. Authentication still
uses the existing session client and native links; the artwork enhancer never
reads or changes credentials.

## Preserved version and installation

The pre-change repository revision is
`71daa48f111c93c7e8449736c6ee6d6267d65af2`, preserved remotely in
`backup/landing-before-coins-20261024`.

The live VPS can contain local changes. The installer additionally saves its
actual replaced files in `/root/zetslay-site-before-hero.*.tar.gz` immediately
before publication. Its printed backup path is the authoritative live rollback.

Run on the VPS:

```bash
bash <<'SH'
set -euo pipefail
cd /opt/zetslay-site
git fetch origin codex/landing-light-dark-redesign
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp)
trap 'rm -f "$work"' EXIT
git show "$revision:deploy/update-landing-hero.sh" > "$work"
ZETSLAY_HERO_DESIGN_REVISION="$revision" bash "$work"
SH
```

The updater stages the header and hero/ribbon only. It preserves the exact live
brand anchor and unrelated HTML, auth scripts, original base CSS and `app/`.
It validates input and JavaScript before publication, publishes HTML last,
creates a backup and automatically restores replaced files on a failed update.
Unknown or duplicated page structures stop before serving changes. No API or
application-container restart is needed.

To undo a successful installation, use the exact path printed by the updater:

```bash
cd /opt/zetslay-site
tar -xzf /root/zetslay-site-before-hero.EXACT_BACKUP_NAME.tar.gz
```

The archive restores the previous HTML and replaced assets. New orphaned image
or stylesheet files are harmless because the restored HTML does not load them.
It does not undo unrelated future changes to other page sections.

## Verification

- `node --check landing-hero.js`
- `node --test landing-hero.test.mjs landing-session.test.mjs project-validation.test.mjs`
- `python3 deploy/stage-landing-hero.test.py`
- `bash -n deploy/update-landing-hero.sh`
- `npm run validate`

The deployment test runs the real installer against a temporary Git origin,
checks preservation of live branding and cabinet files, then restores the actual
backup and checks byte-for-byte equality with the original HTML and CSS.
Browser QA uses the running static preview plus actual 390 px and 320 px iframe
viewports, rather than resizing a screenshot. The wide viewport is checked at
1920 × 1080. Decorative motion and native links are independent of API health.
