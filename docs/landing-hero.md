# ZetSlay first screen — Order flow, 24 October 2026

The first screen uses the existing ZetSlay logo, native authentication links and
headline. A compact overlaid menu leads to the existing features, plugins, prices
and FAQ. No dashboard demonstration or invented sales figures were added.

The orange artwork is the selected generated ZetSlay composition: overlapping
rounded hexagonal Z medallions, larger cropped pieces at the edges and a darker
middle reserved for text. `assets/zetslay-orderflow.webp` is 1672 × 941 pixels,
about 103 kB. It is preloaded and displayed with an empty alt because it is
decorative. This file contains only artwork; heading and buttons are real HTML.

`landing-orderflow.css` scopes the new header, image, stronger localized orange glow, a very dark ASCII
field, vignette and responsive typography to this first screen. The existing
`landing.css`, platform ribbon and all other landing sections retain their code.
At small widths the image is composed from a centered wider crop and the menu
uses native details/summary. It closes after an anchor, outside click or Escape.

`landing-hero.js` adapts the supplied ASCII noise field to the buildless site.
The original ramp and flowing noise are retained, with cursor-proximity resolve
on mouse pointers. The layer uses 11% opacity (9% on phones) and additional
attenuation behind the heading/actions and above the coin silhouettes. The old
square grid and rising particles are replaced. Localized screen-blended amber
light is stronger around the coins, while the text region stays dark.

Drawing is capped at 30fps, DPR at 1.5 and the grid adapts on ultrawide screens.
Motion pauses offscreen, in hidden tabs and across page-cache navigation.
Reduced-motion and save-data use a static ASCII frame and stop glow animation.
Existing authentication/session behavior and native action links are preserved.

For an existing coin hero, use `deploy/update-landing-background.sh` with
`ZETSLAY_BACKGROUND_REVISION` set to the fetched commit. It changes only
`landing-hero.js`, `landing-orderflow.css` and their live HTML references. It
saves the actual previous files to `/root/zetslay-before-ascii-background.*.tar.gz`,
publishes HTML last, and restores the backup if publication fails. The prior
repository variant is `8eb10b904e99c1ee7f71bd8c98cec8d9ace27ec7`.

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
verifies every staged asset against its Git blob hash, creates a backup and
automatically restores replaced files on a failed update. Local Node.js syntax
checking is bounded to 15 seconds when Node.js is installed. Without it, the
exact committed file already checked by CI is installed; Docker is never used.
HTML staging is bounded to 30 seconds and each phase is printed to the terminal.
Unknown or duplicated page structures stop before serving changes. No API or
application-container restart is needed.

To undo a successful installation, use the exact path printed by the updater:

```bash
cd /opt/zetslay-site
tar -xzf /root/zetslay-site-before-hero.EXACT_BACKUP_NAME.tar.gz
```

The archive restores the previous HTML and replaced assets. New orphaned image
or stylesheet files are harmless because the restored HTML does not load them.
Restoring the archive restores the entire previous index.html. If other landing
sections have been edited since installation, restore only the old header/hero
from the archived HTML so those newer edits are retained. Cabinet and API files
are outside this archive.

## Verification

If the legacy Docker syntax check is still holding the shared update lock,
`deploy/recover-landing-hero.py /opt/zetslay-site` identifies the old installer by
its exact committed script bytes and the exact read-only Docker syntax-check
arguments. It signals only that client, waits for the installer to exit, and
clears the lock only after checking for active owners. Other active installers,
unknown lock contents and a live PID cause a safe stop. It does not stop the
Docker daemon or restart application containers.

- `node --check landing-hero.js`
- `node --test landing-hero.test.mjs landing-session.test.mjs project-validation.test.mjs`
- `python3 deploy/stage-landing-hero.test.py`
- `python3 deploy/recover-landing-hero.test.py`
- `bash -n deploy/update-landing-hero.sh`
- `npm run validate`

The deployment test runs the real installer against a temporary Git origin,
checks preservation of live branding and cabinet files, then restores the actual
backup and checks byte-for-byte equality with the original HTML and CSS.
Browser QA uses the running static preview plus actual 390 px and 320 px iframe
viewports, rather than resizing a screenshot. The wide viewport is checked at
1920 × 1080. Decorative motion and native links are independent of API health.
