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

Both production attempts stopped in UI preflight; API switching and site writes had not started. Historical digest compatibility is retained, but the owner-reported live file is a distinct source: SHA256 `2eb3030b54c4fc28f68595627ad5d9d8296272f0c5370c93aeaceca199befba6`, 13436 bytes. Its contents have not been obtained or reviewed, so it is not labeled a reviewed historical release.

For this exact observed digest/size only, the installer performs a full replacement of the account-security UI component with the exact, tested incoming target (`4f032dcf7a0747495a510518abf5d534cbb5019095514c9550a8af32aba815b3`). It does not apply guessed text patches to that old module. Incoming asset digests remain mandatory. Other unknown source files still stop preflight. A digest of the observed file establishes identity/concurrency, not a security review of its contents.

Before this replacement, preflight validates the installed host integration: required app/profile functions and globals, profile container and script loading order. `app/profile.js` is snapshotted for this check and concurrency comparison, never published or changed. Before any public write, the installer verifies every backup member against the exact local snapshot; backup remains private (0600). Failure during publishing restores the captured original module and other public files. A full component replacement supersedes any local modifications inside that one UI module; the original remains in the private backup. Server-side MFA secrets, recovery code hashes, account data and sessions are not stored in this JavaScript file and are not removed by its replacement.

Nine installer test cases passed locally, including exact observed-replacement binding, host incompatibility, unknown source rejection, corrupted-backup refusal, historical releases/transport variants, preflight without writes, current proxy code/private HTML preservation and mid-publish restoration. The observed-source path is tested with synthetic source bytes and the actual incoming assets/host contract; it does not pretend the unreceived production file was executed or reviewed. Production installation remains unconfirmed until the owner supplies the resulting log.

The paired API installer also accepts the reviewed pre-optional-MFA guards, so a failed earlier optional-enrollment rollout is not a prerequisite. Compatibility was exercised against the complete four source modules from core 1c67d198d858f7d4c71dc76a940261998fc9b592. All converge to the same required-MFA policy without altering other deployed fixes.
