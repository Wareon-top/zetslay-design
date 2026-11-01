# Landing security section — 28 October 2026

Replace the public landing's equal text cards with an asymmetric layout: a large encrypted-vault illustration, a 2FA card, a credential-sharing card, and a quiet disclosure with the security-page link. Keep graphite surfaces, warm orange accents, readable contrast, reduced-motion support and keyboard focus states. Decorative artwork is HTML/CSS/SVG and hidden from assistive technology. No external images, fonts, scripts or new dependencies are introduced.

The content describes existing encryption, account protection and support boundaries. It preserves the explanation that the server decrypts keys to work and that no public independent audit report has been published. It adds no provider certifications, fake safety scores, counters or security guarantees. The access link targets the existing `/security/#data` section.

## Installation scope

Run `deploy/update-landing-security.sh` from the installed site with `ZETSLAY_SECURITY_DESIGN_REVISION` pinned to the reviewed commit. The script stages a fragment and a versioned stylesheet; it retains all other installed landing bytes, private legal details and surrounding banners. Only `index.html` and `landing-security.20261028.css` are written. The original unversioned CSS remains available. Assets are published before the page to avoid a stale-style transition. A verified private backup is made before publication. A failed publication restores the original page and removes a newly created stylesheet. A preflight-only mode performs no publication.

The updater does not change the API, account cabinet, passkeys, MFA duration, supplier integrations, databases or security settings. The separate trust installer manifest is refreshed to match the new source assets; the focused installer never invokes the wider trust updater.

## Verification

- Four deployment tests cover first insertion, byte preservation, replacement of the deployed marked section, cache path, idempotence, malformed/unknown layouts, corrupted assets, preflight, file modes and a failed publication with rollback.
- Ten existing trust UI staging/installation tests pass with the refreshed asset manifest.
- Visual browser checks use an isolated local fixture with the landing base styles at desktop width and a 390 px iframe viewport. Mobile `scrollWidth` equals `clientWidth` (390 px). Both cards and the lower disclosure were inspected. A decorative dot-row wrap was corrected after the first desktop inspection.
- Production installation remains pending until the owner runs the pinned command and provides its result.
