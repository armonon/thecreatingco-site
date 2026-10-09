# Community social-layer implementation acceptance

Scope: improve the existing `/community/network` application, shared account service and same-domain proxy. Do not replace these with a static feed, invented users, independent auth or a marketing page. No new paid provider or major redesign is required by this audit.

## First implementation slice once source is available

1. Identify current hosted app source corresponding to deployment artifact `e9d3a984-5a81-424d-82a7-2c325fb6824f` and existing proxy source. Preserve origin checks, cookie scope, headers, redirects and upstream identity.
2. Establish isolated test deployment/data with designated existing test identities: two ordinary users and a moderator. Do not create or publish synthetic production accounts/posts. Record which environment authorizes test content and its cleanup.
3. Qualify the core loop: guest read/discussion -> guest profile setup -> text post/reply -> refresh/reconnect persistence -> owner edit/delete -> other-user interaction. Preserve intended no-account text interactions. Authenticated image/audio/video uploads must remain server-authorized and ownership-scoped; no client-only guard.
4. Prioritize authorization/data-loss defects before visual changes. Test cross-user object references for drafts/uploads/DMs/moderation, missing/expired sessions, CSRF/origin, invalid content/size, interrupted uploads and stale submissions. No arbitrary production probing with private IDs.
5. Verify actual second-session feed/replies, follows, notifications, saved posts, block/mute effects and direct-message privacy; inspect actual moderation report/queue/resolution and rate-limiting behavior. UI buttons alone do not prove any of these contracts.
6. Qualify authored drafts through navigation/reload/sign-in interruption and offline/reconnect. Failed requests retain user text/media and offer retry without duplicate public posts.
7. Then refine responsive hierarchy/focus/empty/error/loading states using existing thecreateco wordmark, warm-paper/lime/lilac theme, approved square app icons and shared navigation. Test 320/390/768/1440 widths, keyboard and screen-reader semantics; use measured issue-specific fixes rather than aesthetic rewrites.
8. Run source-pinned types/lint/unit/integration/build/security gates and separate independent OpenAI review; push scoped PR. No merge/deployment with unresolved mandatory gates. Exact-source/deploy provenance and complete function/config preservation remain release requirements.

## Evidence currently available

- Public routes, initial feed/discussion, sign-in form, mobile menu and limited automated accessibility evidence: this report folder.
- Previously observed anonymous upload-init401 and Pocket denied-microphone behavior: `../pocketstudio-discovery-2026-10-07/`.
- Public deployed client advertises relevant capabilities, but server implementation and signed-in/cross-user results remain unverified.

## Required owner/source handoff (one consolidated request)

Canonical Community application repository/checkout and its upstream deployment project; existing proxy source/artifact release path; designated nonproduction test environment and authorized existing ordinary/moderator test sessions. The source question was already raised by the parent; do not repeatedly ask it or substitute fake implementation while waiting.
