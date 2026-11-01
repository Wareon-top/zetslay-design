# Guided connection section

Only `#steps` changes. Four ordered cards show actual onboarding milestones:
email/password or Telegram sign-in; personal bot token and /start confirmation;
Golden Key and HTTP/HTTPS/SOCKS5 proxy; profile/orders/dialogue verification.
The active plan prerequisite is explicit. Miniature interface fragments are
schematic examples hidden from screen readers, not live connection state.
The registration CTA retains `app/?auth=register`; no secrets are collected on
the public landing. No JS, API changes or dependencies are introduced.

The visual direction matches the preceding neutral Bento block: Inter, black
panels, thin borders, white icons and a white CTA. Desktop has four columns,
tablet two, and mobile one. Text remains full size; miniature previews are
intentionally decorative. CSS uses a dedicated `landing-setup`/`setup-*`
namespace, with reduced-motion transitions disabled.

`deploy/update-landing-steps.sh` uses the shared landing lock, a pinned revision,
validation before mutation, backup and atomic asset/HTML publication with
rollback. It updates only the section, one CSS URL and `landing-steps.css`.
Local hero, Bento block, plugin catalog/covers, auth links and cabinet are
preserved. Stdin is closed so pasted shell commands cannot be consumed by a
subprocess. Repeat installs do not create duplicate stylesheet links.

Validation: `python3 deploy/stage-landing-steps.test.py` and
`bash -n deploy/update-landing-steps.sh`. Preservation is tested byte-for-byte
outside the permitted edits, including uploaded covers and local auth scripts.
Browser QA is unavailable in this managed environment.
