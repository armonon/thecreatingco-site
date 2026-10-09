# NOW Messages prototype and source boundary — 2026-10-09

## Founder request

Create a NOW-connected private, encrypted, temporary DM app with handle search, chat rooms, pseudonymous/guest use, and configurable session expiry.

## What exists

- Located `/Users/agentsattari/.openclaw/workspace/sites/now-suite`, a local static staging/prototype bundle with a Netlify site ID in `.netlify/state.json`.
- Read-only Netlify site metadata confirms that ID is named `now-suite-preview`, hosted at `https://now-suite-preview.netlify.app`, with no connected Git repository. The current published preview is a separate prior deploy (`6a317eb0e9107190b4145c0b`); the local Messages changes have not been published.
- Its own README states it is prototype/demo only. Its browser auth uses `demo-session-*` and fixture identities. The function handler creates an in-memory backend; no configured durable production identity/message store was found. Its working tree is within a broad local workspace with no remote configured, so this evidence does not establish the production canonical NOW source or deployment revision.
- The public Community service is a separate hosted app. Its canonical source/proxy deployment and authorized nonproduction ordinary-user/moderator test identities remain unidentified, consistent with the existing Community audit and NOW platform boundary.
- No existing real DM, room, provider-backed guest capability, or message-expiry implementation was found in the inspected NOW Suite contracts/routes.

## Local deliverable

Added `/messages/` to the NOW Suite preview and linked it from the suite home, Passport, and Community concept page. The screen supports local preview flows for starting a DM/room, selecting a 10-minute/1-hour/24-hour lifetime, composing messages in page memory, and clearing the local conversation on expiry. The page prominently says nothing is sent and that encryption, account authentication, directory lookup, invite delivery, moderation, and server-side retention are inactive.

Added the production contract at `/Users/agentsattari/.openclaw/workspace/sites/now-suite/messages/PRODUCTION_CONTRACT.md`. It specifies NOW identity reuse, opt-in pseudonymous discovery, private invite capabilities, audited E2EE, ciphertext-only storage, server-enforced TTL and cleanup, abuse controls, metadata disclosure, and staged acceptance. It explicitly rejects absolute anonymity claims and explains that recipient/device copies cannot be erased.

## Verification and release status

- `node --check messages/app.js` — passed (syntax check only).
- Local static route `GET /messages/` — HTTP 200.
- Automated tests were not run. The browser driver blocked local navigation by policy, so no rendered browser/keyboard/mobile visual review is claimed.
- No provider, database, secret, migration, public Community source, or production deploy was changed. The existing NOW Suite Netlify staging site was not published.
- The app is a local presentation prototype, not a functioning multi-user messenger and not suitable for sensitive conversations.

## Production prerequisites / next action

1. Identify and pin canonical NOW and Community repositories/deploy artifacts, proxy source, and test environment; obtain authorized nonproduction accounts as specified in `reports/now-platform-20261009/PLATFORM_BOUNDARY.md`.
2. Confirm NOW's real provider-backed account/session boundary and approve an isolated staging identity/database plan before any provider setup, secret/env update, migration, or staging deploy.
3. Select an independently reviewed E2EE protocol/library and finalize threat model, guest-key lifecycle, searchable-directory consent, server TTL/cleanup, metadata/logging retention, and abuse/report flow.
4. Implement and qualify two-client delivery, ciphertext-only storage/logging, membership authorization, expiry, and cleanup on the exact candidate before any public release.

The local prototype is an intentionally honest UI artifact; no privacy, encryption, anonymous identity, or growth claims should be made from it.
