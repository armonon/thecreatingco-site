# NOW platform boundary — owner direction, 2026-10-09

Armon directed that NOW be its **own platform**, central to company accounts and
app/store publishing, with Community/social connected to it. This is a product
decision, not evidence that those integrations already exist.

## Initial contract

- One company account identity, with explicit consent and per-app scoped sessions.
- App catalog and publishing are separate from account identity: draft → validation
  → review → staged release → published/revoked. A login must not imply permission
  to publish or buy.
- Store offers and entitlements use server-side checks, auditable order events, and
  idempotent fulfillment. No new pricing or commercial promise is authorized here.
- Community profiles bind to the account by stable identity, but preserve existing
  guest participation and ownership rules. Public posting is separately authorized
  and recorded; social credentials never become app publishing credentials.
- Shared account recovery, deletion/export, moderation, rate limits, and incident
  controls need an explicit owner and test plan before migration.

## Source and release reality

The live Community is a separate Vinext service at `/community/network`.
Its canonical source/deploy project and same-domain proxy source are still not
identified; the static site mirror is not a safe substitute. The public page
advertises email-code sign-in. One founder-designated sign-in, company profile
creation and text post are now observed; ownership mutation, media, recovery and
cross-user workflows have not been qualified. See `../social-layer-audit-20261007/`.

Next implementation slice: identify exact Community and NOW-auth source/deploy
provenance, map the existing Supabase/Resend/Cloudflare account boundary and the
real app/store identities, then build a versioned account/publish contract and
test it with designated nonproduction users. Do not claim unified accounts or
automated release until those tests pass. Keep required PR/CI gates distinct from
local proof.

## Circle company profile / content cadence

Owner requested a `thecreatingco` profile on the company's own Circle and frequent
updates. On 2026-10-09 an 8-digit email code to the founder-designated iCloud
address was verified in the managed browser. Both unsuffixed brand handles were
reserved; the account was created as `thecreateco · @thecreatingco_official`.
Bio and company site are visible on the profile. The sourced introductory post
was published and observed at
https://thecreatingco.com/community/network?post=5e2ba2d5-d832-46de-975a-231c6f915ad1 .
The future cadence has **not** yet been observed. Never use guest posting to
impersonate the company or claim a verified account.

Delivery follow-up at 2026-10-09 10:19 PT: founder reported no code received.
The browser showed the exact designated address. A single UI resend was made;
both original and resend `/api/account` requests returned HTTP 200, with no page
error, but no provider delivery receipt was exposed. The founder then supplied the
code, and UI verification succeeded; 200 alone had not established delivery.

Start with a modest three-post/week cadence (Monday, Wednesday, Friday): one build
note, one useful demonstration/lesson, one
community question. Each item needs a dated verified source, accurate product
status, distinct copy, a canonical post URL, and outcome observation. The existing
marketing engine should draft; a scoped publisher should perform the authenticated
send and log it. Do not turn the hourly draft worker into an unbounded poster.

## Execution handoff

The existing enabled `thecreateco daily growth cycle` automation
`d0d0df2e-14bd-444e-abd1-c189853fb494` remains scheduled at 09:00
America/Los_Angeles daily on GPT-6 Luna. Its payload was amended in place
with the Circle Monday/Wednesday/Friday check, one-post/day bound, exact source
check, signed-in account check, URL log and no-blind-retry rule. Its definition was
read back with the amendment present; its last run was earlier and does **not**
prove any Circle publication. The first introduction above was manually published
through the actual UI and viewed on the feed/discussion page. Future automated
cadence is configured but unobserved until a scheduled run completes.

Optional photo check: the existing company-site `favicon.svg` was converted to a
64×64 PNG and submitted once through the signed-in Circle profile-photo UI. The
media request `POST /api/community/network/media` returned HTTP 502 at
2026-10-09T17:27:57Z. The subsequent profile showed initials and “Add a photo”,
so photo upload did not persist. Bio, website and post remained intact. No
blind upload retry; canonical Community media source is still missing.
