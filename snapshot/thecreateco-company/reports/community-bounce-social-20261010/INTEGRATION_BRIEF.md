# Community × Bounce social music experience — product contract

Date: 2026-10-10 09:11 PT  
Status: design/queue checkpoint only; no integrated product source or provider connection changed.

## User outcome

From one Community composer, a creator can make a music-aware post, select Community and any currently available external share targets, preview each destination, and consciously send. Their profile reads like a personal creative scrapbook: mixed posts, music/link cards and images, with an original, compact, rounded, glanceable visual language. Bounce supplies track context/playback handoff without silently uploading the user's local library.

The brief's “Tumblr + Apple Watch” references are treated as mood references, not copied UI or trade dress: expressive editorial profile/feed composition plus compact, tactile cards, generous whitespace and subtle depth.

## Product boundary found

- Company records identify Community as the hosted NOW social surface, but its canonical source, deploy/proxy repository and authorized nonproduction identities are not available in this workspace. The existing platform boundary says the static website mirror is not a safe substitute. See `../now-platform-20261009/PLATFORM_BOUNDARY.md` and queue task `NOW-PLATFORM-SOURCE-001`.
- Community is not yet workflow-qualified. In particular, a founder-designated company profile and text post were observed; cross-user workflows are not qualified. A signed-in profile-photo upload returned HTTP 502 and did not persist. Do not retry against production or represent the site mirror as its source.
- Bounce is a separate standalone local-file player. It has no known connection to Community. Its local audio must stay local unless the user deliberately selects an authorized upload/share flow.

Therefore this brief is not evidence of an implemented capability. No Circle/Community or Bounce product files were edited in this checkpoint.

## Recommended first release slice

1. **Music in Community:** Add a “Music” section and a reusable music post/profile card. A card can contain artist/title/artwork, a user-selected public listen URL or Bounce handoff, and a short preview only when an authorized hosted preview is available. A local Bounce track is not made public by generating a link; no local path or audio bytes leave the device without an explicit upload action and rights confirmation.
2. **One composer, several destinations:** Provide media selection, caption, destination selection, per-destination preview, draft persistence and a final send action. Initially deliver Community posting plus `Copy link` / device-native share where the platform supports it. Clearly label destinations that require manual handoff; never show “published” until a provider receipt supplies a canonical post URL.
3. **Profiles/link cards:** Build an editorial profile with featured music and mixed-media posts. Resolve only allowlisted public URLs through safe oEmbed/OpenGraph adapters; show a styled fallback card with title/domain/thumbnail when embedding is unavailable. Do not scrape authenticated content or execute arbitrary provider HTML. Lazy-load and privacy-label third-party embeds; retain a first-party click-through.
4. **Later direct publishing:** Add each provider as an independently reviewed connector only after its current API eligibility, app review, required account type, scopes, media-hosting rules, token storage/rotation, revocation and failure/retry semantics are confirmed. Multi-destination send must record per-target state; a partial success must not be retried as a blanket duplicate.

### Important distinction: “share to” vs “publish directly”

These are different capabilities. A native share sheet can hand user-selected content to compatible apps without Circle holding their credentials; target support varies by device/app. A social-media manager that publishes on the user's behalf needs provider-specific authorization, scoped OAuth, app/API access, durable secrets, moderation/abuse controls, deletion/revocation, audit records and platform policy review. Instagram's official Content Publishing guide describes publishing for professional accounts; X exposes post creation through its API and currently documents consumption-based billing. This is not one generic endpoint and does not establish eligibility for arbitrary personal accounts.

Implementation references to revalidate at build time:

- Meta, Instagram Content Publishing: <https://developers.facebook.com/documentation/instagram-platform/content-publishing/>
- Meta, Instagram APIs: <https://developers.facebook.com/products/instagram/apis/>
- X API v2 manage posts: <https://developer.x.com/en/docs/x-api/tweets/manage-tweets/introduction>
- X Developer Platform: <https://developer.x.com/>

The Facebook Page API's currently available publishing permissions and access requirements were not verified in this checkpoint. Do not promise Facebook personal-profile publishing or schedule/publish functionality until confirmed from current primary documentation and approved app access.

## Acceptance gates for the integrated slice

- Reproducible build from the identified canonical Community source and a scoped staging deployment path; no static-mirror substitution.
- User can create/edit/save a draft, choose a photo and music link, preview it at phone/desktop widths, select Community and separately enabled targets, cancel safely, then send once with visible per-target success/failure and receipt links.
- Bounce handoff shares metadata/URL only by default. Tests prove that reading a library item, opening composer, and canceling send no audio bytes, filenames or local paths to Community or a provider.
- A receiver can open the public music card and play only a deliberately public/authorized preview; unavailable/removed embeds degrade to a safe, accessible link card.
- Profile embeds use an explicit provider allowlist, sanitized metadata, lazy-loading, keyboard access, clear external-provider disclosure and a usable no-cookie/no-script fallback.
- Two authorized nonproduction users qualify post visibility, media permissions, profile display, moderation/reporting, ownership, edit/delete and retry/duplicate behavior.
- Provider integrations are independently tested with approved test accounts. OAuth consent is explicit and separate from NOW login; disconnect/revoke deletes provider tokens and queued jobs safely. No connector is enabled by UI appearance alone.
- Independent OpenAI review and normal CI/PR/release gates remain required. No external publication or production deploy is included in this design checkpoint.

## Unblock

The immediate blocker is the exact canonical Community/NOW source + deployment/proxy provenance and designated nonproduction identities, tracked by `NOW-PLATFORM-SOURCE-001`. Once available, inspect the provider-backed account boundary, then implement the narrowest vertical slice: Community music card + Bounce metadata/deep-link handoff + a native-share fallback. Direct posting connectors are a later gated increment, not a prerequisite for the first visual/product milestone.

## Evidence used

- `/Users/agentsattari/thecreateco-company/reports/now-platform-20261009/PLATFORM_BOUNDARY.md`
- `/Users/agentsattari/thecreateco-company/reports/social-layer-audit-20261007/README.md`
- `/Users/agentsattari/thecreateco-company/reports/now-messages-20261009/README.md`
- `/Users/agentsattari/code/wave4/bounce/README.md`
- Official provider documentation linked above; access verified through web search on 2026-10-10. Provider account eligibility and exact permissions remain unqualified.
