# Native audio suite in the company directory

Published `6acbb8f18528b3e820898867` adds Sattari audio suite to the existing
Mac-edition availability table on https://thecreatingco.com/tools/.
The row opens the current native audio overview; it explicitly says the suite
is in development and has no public installer. Existing browser-edition links
and all seven previous native-availability rows remain. The introduction now
allows either opening an available browser edition or exploring native audio.

Only `/tools/index.html` changes, inside the native availability details element.
The remaining 2,200 file digests and both server function artifacts/configurations
are retained. The 36 counted browser tools and 40-entry directory are unchanged.
Tools remains the combined destination; Downloads keeps its existing redirect.
No release installers, checksums, About design, social sections or app drawers
were regenerated.

The portable `scripts/prepare-native-audio-directory.py` verifies a fresh
immutable capture against the production file manifest, prepares the scoped
change and emits a deploy plan with its expected previous publication ID.
Never deploy a stale full site directory to apply this change.

Draft and production Chrome checks at 1280, 390 and 320px verify the new row,
all eight native availability entries, explicit release status, destination and
return navigation, no page overflow and no JavaScript page errors.

The overview itself is live at https://sattari-audio-suite.netlify.app under
release `6acbb6320f93df2bd0c69841`; its source follow-up is merged in
armonon/sattari-plugins-suite PR 6. Native installer qualification and remaining
older source ports remain separate work. Digital Human is skipped by request.
