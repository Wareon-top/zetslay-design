# Active legal documents

Nine documents replace the draft label with the current published revision.
Owner name/INN and @zetslaysupport are published; unprovided email/address are not
invented. Draft archive stays accessible. Offer and privacy use different legal
roles; no general consent is inferred from using the site.

build-legal-pages.py supports draft and active releases. Active rendering requires
explicit approval of the matching version, effective rule, operator identity and
support. publication.json hashes canonical, identity-resolved document content; the
same manifest is included in the backend. A stale local draft config is upgraded
only from the approved incoming release, preserving operator facts. A mismatched
operator aborts staging. Prices and terms remain consistent with the current catalogue.

The profile's legal acceptance module loads the API receipt and website manifest,
then offers an initially unchecked contract confirmation. It sends no consent or
payment, creates no receipt on viewing, guards concurrent clicks/account switches,
and refuses mismatched site/API versions. All existing legal request handling and
admin review remain unchanged. update-legal-publication-ui.sh validates the actual
staged UI and keeps a backup before replacing files.
