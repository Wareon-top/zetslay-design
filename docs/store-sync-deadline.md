# FunPay snapshot waiting

The core `syncStoreContent` flight now has its own 125-second deadline. It is
active from app startup, before the optional request module loads. All views
share that bounded promise. Timeout or logout releases the flight and aborts
its fetch; an adapter which ignores abort still cannot apply a late snapshot.
Application guards check the session token, generation, selected store and
abort state before changing the displayed data.

A failed snapshot no longer waits for `loadOnboarding` / `loadStoreFleet` in its
catch block. Terminal connection errors schedule those reads separately;
a transient `PLATFORM_UNAVAILABLE` does not revoke the saved connection.
The overview refresh owns its busy state so an old completion cannot unlock a
new session's refresh. Account reset clears the old overview request. Periodic
refresh does not hide a visible overview error with a new spinner; the seller
can retry manually. No automatic retries or supplier transactions are added.

The optional module independently bounds GET `/api/v1/funpay/content`, including
body parsing, preserves server errors, shows actual elapsed waiting time and
validates snapshot shape/workspace. Browser cancellation does not stop the
shared server worker. The existing backend bounds connector reads to 90 seconds;
this change does not claim that proxy access or database health is restored.

`window.zetslaySyncDiagnostics()` reports the installed version, waiting time,
shared-flight/busy flags, loaded-snapshot flag and last error code. It never
exposes tokens, proxy credentials, keys, URLs or buyer data. If the function is
missing after hard reload, the addon did not load and this is an installation
issue rather than evidence about FunPay connectivity.

The installer surgically updates the confirmed snapshot block, API signal
support, account-reset cancellation and overview-refresh block. It preserves
other JS/configuration, patches cache versions, tests the staged live functions,
and backs up all four affected files before copying. It refuses unknown layouts.
Tests cover hung fetch/body, hanging error-side reloads, a request started before
the addon, late data after retry/logout and error-preserving polling. VM tests
are not a real browser or production VPS test.
