# Product Lessons

## Focused product pages — October 6, 2026

The twelve focused tool pages now use content/tool-product-pages.json and
scripts/prepare-tool-product-pages.py, staged against an immutable live baseline
in reports/tool-product-pages-20261006. Preserve /tool-products.css,
/tool-products.js, /assets/tool-products/ and each page's absolute canonical and
dedicated share image. Each page has one cycling project guide, not three live
editors. The enlarged preview is an image-only dialog; no extra iframe or model
is loaded. Keep 44px touch controls, keyboard cycling, exact legacy anchors,
alpha/export limits and menu-entry instructions for embedded Luma tools.
Standalone Glyph Studio remains distinct from embedded Glyph. Mockup's hero is
an actual exported PNG, not a claimed photographic result. Split's image is the
real starting interface, not proof of successful separation. Its processing
test did not finish; Mockup's preview was blank in the capture browser although
the PNG download succeeded. Website checks do not qualify those app engines.
Quick Launch normalizes ampersands/whitespace and counts actual entries rather
than claiming eight apps. Preserve this narrow /momentium.js change. Retain the
full live file manifest, function digests, headers and redirects on deployment.

## Focused tools integration — October 6, 2026

Latest Wave 2 brief supersedes the original eight-only rule: preserve the ninth
standalone app, Glyph Studio, plus all 13 focused-tool launch entries already
published by the Wave 2 update. Glyph Studio and the embedded Luma Glyph are
distinct destinations. Cast remains Preview on the explicit review site until
its canonical Form deployment is confirmed. Restore /tools/ without replacing
the newer homepage or product pages. The reconciled directory contains 14
entries (13 tools plus Glyph Studio), not 14 additional apps. Current narrow
release: reports/wave2-reconciliation-20261006. Always retain Community function
digests and redirect/header files, even when they are absent from GitHub's
reconstructed static mirror. Never deploy that mirror wholesale.

Keep the eight main products distinct from the 13 focused alpha tools in
content/creative-tools.json. The homepage has one compact tools section;
/tools/ has search and product-family filters. Form, Luma, StemDeck and
ScenePilot product pages link only to their own tools after the existing lesson
player. No extra editor iframe is mounted. Sattari tool destinations remain on
sattarimusic.com; Mockups/Glyph open inside Luma's menu, and Cast uses the
explicit Form review studio with its menu location disclosed. Preserve
/creative-tools.css, /creative-tools.js and /assets/creative-tools/ when
rebuilding. Narrow live-source staging and release receipts are in
reports/creative-tools-20261006; scripts/prepare-creative-tools.py does not
overwrite unrelated local app work. Browser load checks are not complete
export-workflow or physical-device qualifications.

For new or changed product lesson galleries, use one visible interactive
mini-lesson player per product page. Cycle lessons within that player with
previous/next icon buttons and a direct lesson picker. Do not introduce a
separate interactive editor box for every lesson or another editor modal for
hero lesson links.

Load editors on demand, keep at most one resident editor, and preserve edits
with a confirmed checkpoint before changing or suspending a session. A failed
checkpoint must keep the current editor and selection. Do not auto-cycle while
someone is editing. Verify cycling, return-to-lesson preservation, keyboard
controls, and phone-width layout before publishing.

# Homepage — launch season (user request, October 4, 2026)

The user's launch brief supersedes the previous apps-first/no-Kickstarter rule.
Keep the Create Unbound launch hero, Join the launch list primary action, Try
Momentium secondary action, and the original lime moving ribbon. Lead with real
four-product proof, then the company story, Creative Suite, real project outputs,
other apps, proposed funding priorities, team and consent-based launch signup.
Keep the eight existing product cards, previews, filters and app destinations.
Do not claim a live Kickstarter, invent pricing, rewards, delivery dates, founder
identities or platform availability. Replace launch-list actions with the public
Kickstarter URL only after it is supplied. Preserve public-alpha honesty and
accurate attribution of third-party rendering in project examples.

Launch-list requests currently use the existing private Netlify support intake,
with explicit email consent and the reference founding-list-v1. This is not an
automated email campaign service. Keep that distinction accurate in handoffs.
Native apps and lesson behavior are outside this marketing update's scope.

Other apps retains compact cards for Ghost, Librarian, Reclaim and Bounce with
Open App, Learn More and expandable original previews. Do not import Momentous
listings or misclassify these apps as the four-product Creative Suite.

# Homepage removals — latest user instruction, October 4, 2026

Do not restore the homepage `#proof` Working Today demo section, `#made-with`
Orbit showcase, or `#team` founder block. The user explicitly removed these three
sections. Keep project details on their project pages and the founder story on
About. The interactive hero, eight product cards, signup, and feedback remain.
This supersedes the earlier requirement to include those three homepage blocks.

The homepage founding-list signup (`#join-launch`) belongs at the bottom of
`main`, immediately above the footer, per the user's latest instruction.
Keep its existing consent fields and signup anchor.

# Brand — October 5, 2026

Public brand is **thecreateco** (lowercase wordmark `thecreateco.`), replacing
Momentium. Product names stay unchanged. Primary domain remains
https://thecreatingco.com/ unless explicitly changed by the user. Keep legacy
URLs, form routing identifiers, CSS hooks and saved-project keys compatible.
Run `python3 scripts/rebrand-thecreateco.py dist` after older page generators;
regenerate share-card artwork with the current wordmark before deployment.

# Navigation — October 5, 2026

Do not include a Projects tab in desktop or mobile site navigation. Keep the
project pages and contextual project links available.

# Homepage headline — October 5, 2026

The hero headline is now “Help us create.” Its supporting copy invites feedback
and commits to continually improving the products. This supersedes the prior
“Create Unbound” headline requirement.

# Suite naming — October 5, 2026

The full public suite label is **THECREATECO MOMENTIUM SUITE**. The company
wordmark remains thecreateco. Preserve this suite name when rebranding or rebuilding.

Place About before Learn in the desktop and mobile site navigation.

Keep the homepage funding message and founding-list signup together in one
`#join-launch` box at the bottom of main. Do not recreate a separate funding bridge.

# Other apps cleanup — October 5, 2026

Latest user requested less clutter on Ghost, Librarian, Reclaim and Bounce.
Homepage other-app cards now have icons, descriptions and Open App / Learn More
only; do not restore embedded preview carousels. This supersedes the older
expandable-preview requirement above. Use a responsive grid, not a clipped track.
Product pages retain the existing mini-lesson player, features and After Hours
example. Do not restore duplicate hero carousels, screenshot galleries or native
preview marketing blocks. Reclaim and Bounce use app icons in their headers;
Ghost and Librarian show one real browser screenshot. Preserve current browser
scope and availability links. Narrow deploy source and changes are recorded in
reports/other-apps-cleanup-20261005/build.py; stylesheet /other-apps-clean.css.

# Sitewide declutter — October 5, 2026

Keep the public-page cleanup in reports/site-declutter-20261005/build.py and
/site-declutter.css when rebuilding: no duplicate product screenshot galleries
or release strips, no repeated Form promotion on About, no full repeated founder
story or second final CTA on Kickstarter. Keep the actual lesson markup intact.
Footer and overflow menu omit Earlier suite projects and After Hours links;
project pages remain reachable from relevant examples. Availability states the
shared native-release notice once, rather than repeating it on every app card.

# Visual consistency — October 5, 2026

Public pages load /visual-consistency.css. Support, availability, privacy and
confirmation pages use the visual-utility body class for warm paper backgrounds,
dark readable text, consistent form fields and responsive spacing. Preserve
these styles during rebuilds; changes are staged by
reports/visual-consistency-20261005/build.py. Native editors remain separate.

# Deep visual audit fixes — October 5, 2026

Preserve the release in reports/fix-visual-audit-20261005/build.py and shared
/audit-fixes.css and /audit-fixes.js on public pages. Root /404.html must use
thecreateco branding as well as /404/index.html. Legacy workshop headers use
the current navigation and a focus-only skip link. Quick Launch retains square
tiles, four columns on desktop and two on phones. Mobile editors suppress the
extra sticky global header and floating feedback/back-to-top controls; those
controls also stay hidden over the footer. Luma opens with Select & recolor,
matching its actual opening lesson. Keep Ghost’s completed jacket and StemDeck’s
populated Orbit workspace as product heroes. About omits the duplicate suite
and building sections; Kickstarter links to Orbit instead of repeating its
full gallery. Keep native lesson state and form markup intact.

# Same-domain Community — October 5, 2026

The correct domain is thecreatingco.com. All marketing Community links use
/community/. Preserve the community-proxy Netlify function and the scoped
_redirects entries for /community, /_next, /api/community and /api/account.
It relays to the existing hosted Community service, validates browser Origin
before POST forwarding, and forwards only Community/NOW cookies. Do not replace
it with the old redirect HTML or route arbitrary URLs through it. Source and
release plan: reports/community-same-domain-20261005/build.py.

Armon Nasiri and Jensen Westerlund are both founders of thecreateco. Use
“Founder, thecreateco” for both team profiles and plural founders in team copy.

# Launch facts — October 5, 2026

Use thecreatingco.com in sitemap.xml, robots.txt, canonical and social URLs.
The company is thecreateco; its four core products form the Momentium Suite.
Use StemDeck and Librarian as product names, retaining Sattari as a platform
credit and .sattari as the file extension. Public web apps are alpha. No public
Windows, Mac, iOS or Android downloads are available yet; native Pro versions
are in development. Reclaim's browser preview is read-only and Bounce's is a
local-file player. Keep metadata aligned with those capabilities. Source:
reports/launch-consistency-20261005/build.py. Analytics is enabled. See the domain status below before changing app URLs.

Netlify Web Analytics was enabled October 5, 2026, included in the current
team plan. The privacy page discloses server-side analytics. Do not restore
“No added analytics integration.” Visitor counts are not verified product
users. Six branded subdomains (luma, scenepilot, ghost, librarian, reclaim, bounce)
are configured and HTTPS returned 200. Form and StemDeck are also active with HTTPS as of October 5. Form uses its
existing Sites project; StemDeck aliases the current Sattari site, preserving
sattarimusic.com as its primary. Final report: reports/final-app-domains-20261005/. Domain report:
reports/app-domains-20261005/. Old app addresses remain available for existing
browser-local work. Do not globally rewrite iframe origins or native lessons.

# Customer review fixes — October 5, 2026

Latest approved review supersedes the Help us create homepage headline: use
“Your ideas. Made real.” with clear free creative tools / Lite promise and
Try Form Studio primary, launch list secondary. Keep original-site links out
of product cards and use the branded app destinations. Footer shows the actual
domain thecreatingco.com; company remains thecreateco. Downloads contains plain
availability copy; historical build checks live at /release-notes/. Windows and
Mac Pro are in development, mobile planned, with no public native downloads.
Preserve responsive product WebP sources, /review-polish.css, explicit hero
poster fallback and interaction-loaded video. On phones filters are static;
floating buttons hide while signup is visible. Quick Launch uses strong app
names rather than repeated headings; momentium.js supports .launch-app-name.
Canonical Community navigation/sitemap is /community (no trailing slash).
Implementation and release proof: reports/review-fixes-20261005/.

Quick Launch color restored: lime header button and eight pastel product-colored
square tiles. Preserve the final overrides in /review-polish.css from
reports/quick-launch-color-20261005/. Keep dark, readable text and Open buttons.

# Mobile shell — October 5, 2026

Preserve the phone rules at the end of /review-polish.css from
reports/mobile-polish-20261005/. Phone header shows wordmark, colored Quick Launch
and Site menu; full navigation remains in the menu. Keep floating feedback and
back-to-top off phone content (feedback remains in navigation/footer). Product
headlines scale down for 320px widths. Lesson picker takes its own full toolbar
row; Keep and Expand stay accessible below. Form fields retain 16px type. Keep
mobile safe-area spacing and square colorful Quick Launch tiles. These changes
are marketing-shell CSS only; do not modify native editor state or engines.

Latest Other apps request: use a horizontal swipeable row, superseding the
previous static grid rule. Keep card snap points, next-card peek on phones,
keyboard navigation and Previous/Next buttons. Final CSS is in
reports/other-apps-scroll-20261005/review-polish.css.

Kickstarter visuals refreshed October 5: hero uses the approved Creative Journey
image; four product cards use current responsive WebP artwork. Do not restore
old proof videos, Pause demos button, Orbit hero or obsolete capture captions.
Preserve signup form and product lesson links. Source:
reports/kickstarter-images-20261005/build.py.

Community matches the homepage as of October 5. Preserve COMMUNITY_THEME in
netlify/functions/community-proxy.cjs: warm paper, Createco/Geist typography,
lime actions, purple metadata, square cards and responsive phone navigation.
Theme is appended to upstream community CSS; native auth, data and cookie
contracts remain unchanged. Release source: reports/community-style-20261005/.

# Main-site social community — October 5, 2026

Community links in the main site's navigation and footer now open
/community/network, the social network for everyone. This supersedes the older
/community navigation destination. Keep /community available for earlier
discussions and preserve its API/proxy routes and shared email account cookies.
Do not constrain the network to suite users or add lesson/project dependencies.
Narrow release: reports/community-main-integration-20261005/plan.json.

Community root routing now redirects /community and /community/ to the social
network, preserving query parameters. Earlier discussions remain reachable at
/community?legacy=1; the proxy updates the network's Earlier discussions link.
Preserve this distinction. Release: reports/community-default-20261005/.
