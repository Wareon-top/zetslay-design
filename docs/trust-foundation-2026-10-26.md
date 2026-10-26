# Trust foundation: first implementation cycle

Date: 2026-10-26. Component policy: `admin-access/2026-10-26.1`.

## Behavior

All `/api/v1/admin` HTTP requests, administrative catalogue writes and shared support attachment reads by the service owner require an authenticated owner, enrolled MFA and proof less than 300 seconds old. The old `requireAdminMfa:false` constructor option cannot bypass this policy. No support/catalogue exemption remains. Checks happen before consuming request bodies or invoking the administrative service. Ordinary users still access only their own attachments through the existing support authorization.

The owner can log in and open Profile → Account security without administrative access, enroll TOTP, save recovery codes and submit a new proof. Owner MFA cannot be disabled through the web security action. Recovery-code rotation and session revocation remain available. Customer MFA stays optional. Invalid, future, revoked and expired proof state fails closed.

Account security status reports whether the authenticated identity requires admin MFA. Three infrastructure error log sites now project fixed events and allowlisted codes, discarding arbitrary error text/stack/causes. This is not a claim that every logging path has been independently audited.

`GET /api/v1/security/policy` reports only the installed HTTP policy component. It does not certify owner enrollment, the entire service release or security of the host.

## Installation

Use the matching design repository's `deploy/start-trust-foundation.sh`. It preflights the UI, inventories the live API without printing credentials, builds a COPY-only layer on the current image, runs synthetic tests without a network or production DB, switches only API using the existing checked direct-switch helper, then installs UI. No npm/RUN, migration, service pruning, plugin enablement, real purchase/refund or customer test message. The previous container/configuration and private UI backup are retained. Unknown edited security anchors abort before API switching. Other current runtime source lines are preserved, including proxy repairs and optional workspace changes.

The read-only inventory emits module SHA256s, existence of selected tables, aggregate owner/MFA counts and a policy response when available. It never emits users, keys, session tokens, environment values or database records. An unavailable table/DB is explicitly unconfirmed, not a passed audit. Backup files may contain configuration secrets and remain private to the server owner.

After success: refresh the cabinet, open Profile → Account security, enroll MFA if necessary, save recovery codes and submit a fresh code. Confirm a permitted admin read and a blocked read after five minutes. Record the live inventory rather than assuming repository HEAD equals production. A missing primary credential or lost recovery codes must not be worked around by disabling the gate; handle recovery as a separately reviewed infrastructure procedure.

## Verification

- Full Node suite: 1380 passed, 1 environment-dependent PostgreSQL test skipped locally.
- 73 targeted authorization, accounts, support, legal, catalogue and finance tests passed.
- Installer patch roundtrip/idempotence, unknown-anchor rejection, permission handling and offline probe passed locally; disposable Docker checks are configured in CI for both builders; CI execution is pending publication.
- Compatibility of the reviewed source patches was checked against last user-confirmed core `e0d9d933dd2f5762a60b755d1187e3b6d7cb639d` and current source `14606ce8e2583a8fd4904ade6ec3f51426c5fa1c`.
- No production installation or owner enrollment is confirmed by this report alone.

## Open work and limits

This cycle addresses the HTTP admin boundary, truthful copy, limited diagnostic hardening and production inventory. It does not complete the 90-day trust plan. A cross-plugin server-enforced global stop, consolidated capability controls, independent security log, data/key deletion lifecycle, user-owned worker and independent review remain separate work. Telegram service-bot broadcast administration is a separate authorization surface; this HTTP component does not assert MFA coverage there. Its confirmation and worker checks must be assessed before describing *all* privileged channels as covered.

The TON SDK includes a transitive Zod advisory GHSA-mrhx-c7xc-m3w5. Existing `stars-wallet.mjs` imports wallet contracts directly rather than aggregate TON HTTP clients; `launch-dependencies.test.mjs` asserts that loading it does not load Zod/axios/TonClient. This reduces the observed reachable path but does not remove the dependency finding. The general npm audit remains a failing gate. Do not suppress it or force an unverified major Zod override to produce a green label. The source mitigation may not be installed on older production images; inventory reports `stars-wallet.mjs` hash so that can be checked independently. No dependency upgrade is included in this release.

No independent security audit has been completed in this cycle. Encryption at rest does not prevent the cloud operator or a compromised runtime from obtaining the key while it is used.

Primary implementation references: OWASP Multifactor Authentication and Authentication Cheat Sheets, consulted 2026-10-26. Applying them is not certification.

## UI changes

Public `/security/` explains Golden Key, encrypted storage and runtime decryption, cloud operator trust, bot/proxy data, third-party integrations and review limits. A bounded credential-free GET checks the exact HTTP policy revision and displays an unconfirmed state for errors or unknown responses. No invented external audit, user count, testimonials or uptime badge.

A footer link is added to the installed landing and cabinet. The stager preserves all other HTML bytes and banners. It changes only the two reviewed key-handling phrases in the current `app.js`, preserving other installed repairs. Account-security UI hides owner MFA disable, explains the mandatory policy and binds all async writes/reads to the current session and mutation revision. Reads cannot overwrite enrollment results; recovery codes survive an accepted action with failed refresh. Requests have 15-second deadlines and ambiguous outcomes do not invite automatic replay.

Local UI checks: 33 passed. Stager checks: 5 passed, including rollback after a mid-publish failure. JavaScript/Python/shell syntax checks passed. Real browser layout review and production installation remain unconfirmed.

## Installer compatibility correction

The initial production attempt stopped in UI preflight because the security asset was not in the narrow accepted digest list. API switching and public site writes had not started. The installer now recognizes all four reviewed historical security UI releases (20261006 initial, partial health labels, weekly-cookie logout handling, and launch-auth isolation), plus the new release. BOM/CRLF/trailing-newline transport variants are normalized only for this known-content comparison. Unknown edited code still fails closed and reports only SHA256/byte count. Incoming asset hashes remain exact.

Regression coverage includes the actual four historical source fixtures, transport variants, rejection without printing unknown source, preservation of private HTML/banners/current proxy code, preflight without writes and rollback on a mid-publish failure. Seven installer test cases passed locally.
