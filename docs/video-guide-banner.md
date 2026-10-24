# Video instruction card

The dashboard and knowledge base share a full-width red instructional card linking to
https://youtu.be/EHlRSF1kd84?si=x8gIwNopXmyWE4w_. The link opens a new tab. Its decorative
play-button illustration is a local SVG, with no YouTube embeds or requests before clicking.
The card uses the rounded shape and left artwork of the proxy offer, with separate responsive
layouts down to 320px. A small DOM-only script also mounts the card beneath the heading of
the demonstration/subscription-gated overview and remounts it after demo updates. It does not
read session state, make network requests or change purchases or API behavior.

`deploy/video-guide-banner.html` is the shared markup template. `stage-video-guide.py` adds
it after the existing heading in each of the two views, retaining all other live HTML.
`update-video-guide.sh` installs only the card CSS/JS, SVG and staged HTML, with HTML published last.
It preserves the previous files in `/root/zetslay-before-video-guide.*.tar.gz` and restores
them after an interrupted publication. Node, Docker and service restarts are not required.

Run the installer from `/opt/zetslay-site` with `ZETSLAY_VIDEO_GUIDE_REVISION` pinned to the
reviewed Git revision. To undo, inspect the backup path printed by that run and extract that
archive from `/opt/zetslay-site`. This restores the pre-install cabinet HTML and any existing
card assets; newly added unused assets can stay on disk.

Checks: `python3 deploy/stage-video-guide.test.py`, `bash -n deploy/update-video-guide.sh`,
`npm run validate`; browser QA for dashboard, knowledge base, keyboard focus and 390/320px.
