# Proxy checkout loading recovery

The modal previously kept a loading spinner after managed-proxy read failures, while its
retry button reloaded only shop status/catalogue and could not recover the missing managed
state. Failed or empty catalogues also retained a loading headline. Quote reads could keep
controls busy for 200 seconds.

Managed status, shop status, catalogue and non-financial quote requests now have independent
25-second deadlines, including transports that ignore abort. Errors stop their spinner and
offer a retry of both dependencies. Empty catalogues have an explicit final state. Automatic
quotes wait for both loaders and do not retry on redraw after an error or a ready quote.
Late responses cannot restore a timed-out quote or another account's state. Purchase POSTs,
request identifiers, unknown financial outcomes and reconciliation remain unchanged.

The patch manifest targets exact functions from the current public runtime. The installer
preserves unrelated local JS, the logo, payment fixes and all page bodies, updates only two
script versions, creates a private backup and restores partial writes. It does not call the
provider, buy proxies, change credentials, restart the API or claim a real purchase succeeded.

Checks include stalled reads and quotes, initial-state error then successful retry, empty and
failed catalogues, session isolation, ongoing purchases and late financial responses.
