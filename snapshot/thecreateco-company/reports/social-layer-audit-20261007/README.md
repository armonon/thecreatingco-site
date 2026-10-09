# Community social-layer checkpoint — 2026-10-07 Pacific

Task SOCIAL-LAYER-AUDIT-20261007. **Implementation BLOCKED by canonical source/deploy and designated test access; not complete or flawless.** Parent explicitly reprioritized this work over Ghost. Ghost returned QUEUED with its54-test baseline and clean isolated branch; see ../ghost-roundtrip-20261007/README.md.

## Actual existing application, not marketing claims

Public `https://thecreatingco.com/community/network` renders the existing hosted Vinext app. Current deployment artifact **e9d3a984-5a81-424d-82a7-2c325fb6824f** matches earlier discovery; this is NOT a source SHA. `/community` and `/community/` resolve to network. Earlier discussions `/community?legacy=1` and Community guidelines `/community/rules` both return200. Route receipts retain HTML hashes and script names.

Real feed and discussion UI were observed. Navigation exposes Discover, Songs, Sessions, Pocket Studio, Create, Messages, Notifications, Saved, Profile and Settings. Existing public post exposes profile, reply/discussion, reaction, repost, save and mute/block controls. Opening discussion displays a required reply field and Send. No reply/post/like/follow/save/block action was submitted. Moderation is conditional in the deployed client, not exposed to this anonymous audit; server implementation/effectiveness is unknown.

Guest explanation explicitly permits text posts, comments and reactions without an account; media upload requires sign-in. Email-code account form is real and opens from Sign in / join. No email/code was submitted or authenticated account created. Prior no-cookie media upload-init401 evidence is reused from ../pocketstudio-discovery-2026-10-07/anonymous-boundary.json; not rerun or elevated into complete authorization certification.

## Fresh verified subsets

Chrome154.0.8037.98, macOS host, anonymous fresh contexts:
- Desktop1440 and phone390 initial feed render, no initial page exceptions or horizontal overflow.
- Actual public discussion opens. Post contents/user identities are not copied into this summary; screenshots show only already-public UI.
- Desktop sign-in form displays email-code flow; mobile More opens full navigation. Form is an in-page panel, NOT a modal: raw hydrated-controls `escapeCloses` was a naive no-dialog probe and is NOT accepted as Escape/focus evidence.
- Sign-in form opens at390 and320px with usable email field and no horizontal overflow. No real email send/account/persistence result inferred.
- Automated axe WCAG2A/AA/2.1AA: **5 completed surface checks**, zero reported violations/incomplete items for desktop feed/auth,390 feed,390 auth and320 auth. Limited rendered anonymous surfaces only; not full keyboard/screen-reader/mobile certification.
- Early quick-click probe ran before hydration in several cases and did not establish navigation results. First broad a11y run stopped after3cases on the390 auth-heading wait. A focused follow-up explicitly waited for React hydration and passed390/320 auth. Both original failures remain in evidence. This was a harness timing correction, not a product fix.

## Mutation boundary and limitations

No form submission, published content, likes/follows, media upload, room, hardware recording, credentials or permissions changed intentionally. Public app navigation may bootstrap its own anonymous guest session: deployed client shows `guest-session` on Create/Profile/etc. The initial quick probe did not trace that automatic bootstrap, so absence of every automatic anonymous-session side effect is UNVERIFIED. After discovering this behavior, all Community API writes were explicitly intercepted and rejected locally in hydrated-controls/mobile/auth/a11y probes. One attempted guest-session request was blocked and recorded; that harness-generated error is NOT a product defect. No fake server success or mock workflow was used.

Posting/replies/repost/follow persistence, account completion/reconnect/signout, authorized uploads, draft retention, DMs privacy, cross-user ownership, abuse limits, moderation and realtime sync are all **UNVERIFIED**. Visual rendering and empty-state buttons are not proof. Source-defined unit/integration/security/platform gates cannot be run without actual source.

## Source and deployment boundary

Known editable marketing mirror `/Users/agentsattari/code/wave2/thecreatingco-live`, clean at5515c3e, has correct Community network links and Sessions/Pocket deep links. Inspected README, maintenance/AGENTS.md, index.html, momentium.js and suite registry; hashes recorded. It does NOT contain canonical Community app/backend or community-proxy function source. No evidenced navigation defect required a marketing patch. No broad disk/repository rediscovery or speculative Netlify function experiments were repeated.

Prior discovery already located the real same-domain proxy but not its upstream source; the mirror explicitly omits critical routes/functions and must never be deployed wholesale. The README's historical digest-reuse instruction is not a verified usable function-preservation path (see existing company provenance findings). No function/proxy rebuild, site deploy, PR or product source edit occurred in this checkpoint. Preserve all published assets/functions/config and original branding/logo/icon conventions.

## Exact next action and required access

**Obtain canonical Community source repository/checkout + upstream deployment project and existing proxy source/release artifact, then designate a nonproduction test environment with authorized existing ordinary-user and moderator sessions.** Source question was already raised by parent; no duplicate owner question sent. Do not send login codes in this group.

First high-risk implementation slice: isolated source-pinned account/guest and upload ownership contracts, authored-draft preservation across sign-in/navigation, then two-session actual post/reply/message/moderation roundtrips in the authorized test environment. Detailed ready-to-execute acceptance is IMPLEMENTATION_ACCEPTANCE.md. Preserve guest text interactions and server-side media auth; no substitute static social shell or fake successful backend. Routine reviewed patches can be pushed once actual source exists; unresolved mandatory gates still forbid merge/deploy.
