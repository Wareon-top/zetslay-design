# ZetSlay

Current implementation and the November upgrade are documented in [the release notes](docs/COMPETITIVE_RELEASE_2026-11-03.md). The Stage 0 status and promotion model below describe the early foundation and must not be used to infer the current deployment or reset the working branches to main.

ZetSlay is an independent seller-tech product for managing and automating a FunPay store. The approved visual baseline is the seller-tech landing page in `index.html`; the product application and backend will be developed as separate surfaces without redesigning that baseline.

The source repository is private. Public deployment contains only the built marketing or product artefacts intended for users.

## Project status

- Stage 0 — foundation and governance: complete.
- Personal cabinet — interactive frontend prototype in `development`.
- Stage 1 — FunPay integration feasibility: next backend gate.
- Production currently contains the marketing site only.
- No backend, billing, user accounts, or live FunPay automation is present yet.

## Repository map

- `index.html` — production marketing site.
- `app/` — isolated personal-cabinet prototype with demo data; no secrets or live integrations.
- `assets/` — landing page assets.
- `config/environments/` — non-secret environment definitions.
- `docs/` — decisions, environments, and definition of done.
- `scripts/` — dependency-free local server and project validation.
- `PRODUCT.md` — product scope and MVP boundary.
- `ROADMAP.md` — ordered delivery plan and stage gates.
- `ARCHITECTURE.md` — target system architecture.
- `SECURITY.md` — repository data boundary and secret-handling policy.

## Local development

Requirements: Node.js 20 or newer.

```bash
npm run validate
npm run serve
```

Then open:

- `http://localhost:8080` — approved marketing site.
- `http://localhost:8080/app/` — interactive personal-cabinet prototype.

## Branch and promotion model

- `development` — integration branch for active work.
- `staging` — release candidate and acceptance testing.
- `main` — production source for GitHub Pages.

Changes move only in the direction `development -> staging -> main`. See `docs/ENVIRONMENTS.md`.

## Product constraints

ZetSlay does not store FunPay passwords, bypass CAPTCHA, or ship an automated action before its platform compatibility and failure behaviour are verified. All twenty catalogue modules are roadmap items until they meet the module definition of done. Private repository access is not permission to commit credentials, customer data, session cookies, database dumps, or backups.
