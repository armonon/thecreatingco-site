# Release QA footage provenance

Retrieved 2026-09-20 for local engineering QA, not marketing endorsements. The
[Xiph Derf test-media index](https://media.xiph.org/video/derf/) explicitly identifies
both source sequences below as public domain. Lossy WebM versions were used to keep
the test small. They contain real people, but no supplied hand-labeled alpha truth.

| Asset | Source | SHA-256 |
| --- | --- | --- |
| FourPeople (720p, 600 frames) | https://media.xiph.org/video/derf/webm/FourPeople_1280x720_60.webm | `1e4a5df7e67ae985370321cc2c91b8595f7e3433ad8ee1e84da7a26ff5254deb` |
| KristenAndSara (720p, 600 frames) | https://media.xiph.org/video/derf/webm/KristenAndSara_1280x720_60.webm | `7d32a6d6864804b986832272ed570a2e4b43552d5958fc1f614d1e7e0fbd2436` |

Local downloads and results are under ignored `outputs/release-today/licensed-footage/`.
Short conference footage is useful for decoder, rendering and person-selection
checks, but not a substitute for 60-second difficult occlusion/hair shots, a real song,
dialogue sync, variable-frame-rate phone footage, or a hand-labeled benchmark corpus.
