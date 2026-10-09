# All apps and web tools directory — release record

**Request:** Add an introductory page that brings thecreateco’s web apps and tools together, with a Tools tab in the site header.  
**Published:** 2026-10-09 16:56:46 UTC  
**Production deploy:** `6ac91c3b21f9d0d16ea82462`  
**Previous deploy / rollback target:** `6ac8fa37b65498b66633c756`

## What changed

- Expanded the existing `/tools/` directory from 14 focused-tool cards into a searchable index of 23 creative apps and tools. It now includes the four main creative workspaces, Reframe, standalone and embedded Glyph, the focused ScenePilot/Luma/Sattari/Form tools, and the other browser apps.
- Added an introduction explaining the app families and the path from a focused task into a connected studio.
- Updated family filters, page metadata and `CollectionPage` / `ItemList` structured data to match the 23 visible cards. Existing alpha, limited-scope and Cast preview labels remain.
- Added a `Tools` item after `Apps` in the shared site header and normalized the compact site-menu entry. `/start/` uses a separate header, so its Tools tab is included directly.

## Verification

- Synced the exact currently published Netlify snapshot `6ac8fa37b65498b66633c756` before editing. Draft and parent manifests contain 1,853 paths; the release diff is exactly `/site-navigation.js`, `/start/index.html`, and `/tools/index.html`, with no removals.
- Draft deploy `6ac91c3b21f9d0d16ea82462` reached `ready`. The deploy summary retained 6 redirect rules, 5 header rules and the existing `community-proxy` function digest; no edge functions were added.
- Browser preview check: desktop header contains `Tools`; at 390 px the main nav is hidden and the compact menu contains `Tools`; search for `Reframe` shows only its card, and clearing search restores all 23.
- Post-publish: Netlify reports the expected deploy as published. `/tools/`, `/start/`, and the shared navigation script return HTTP 200; `/tools/` contains 23 cards and 23 structured-data list entries; `/start/` has a static Tools header link; `/community` still returns its expected 302 to `/community/network`.

This is a discoverability/navigation change, not evidence of traffic, rankings, signups or usage. Those outcomes remain unmeasured.
