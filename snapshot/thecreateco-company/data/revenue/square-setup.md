# Square digital-software checkout — active payment plan

Owner decision: Armon, #millions, 2026-10-07 18:41 Pacific, message 1557568686842454037.
Supersedes stripe-setup.md. Stable queue ID REV-STRIPE-001 retained for history; title now Square.
Status: WAITING FOR PRODUCT READINESS, not waiting for founder-operated listing chores. Square remains selected. Armon reports dashboard/Digital item access on his separate computer; agent account access and checkout/delivery remain unverified. No live sales enabled.

## Minimum viable flow

Customer views truthful product/edition requirements → purchases non-physical digital item → payment confirmed in Square → verified build/download and any actual license entitlement delivered → support/refund records reconciled.

Square's official documentation supports Digital items and manual redemption email with a download link. Automatic delivery is a separate integration (Square identifies SendOwl); do not promise built-in automatic license generation. Manual fulfillment describes Square’s default capability, not our launch plan. Require an agent-owned automatic payment-to-download/entitlement flow with retry/recovery and truthful timing; choose its implementation after account/product requirements are concrete. No paid integration/subscription is authorized by provider selection alone.

## Account and item setup

1. Use the company owner's existing authorized Square account if available; otherwise create a company account with genuine legal country/business details. Owner enters password, verification, identity and payout bank privately. Do not guess these fields, reuse Sattari merchant access, or solicit credentials in Discord.
2. Confirm merchant/location/currency and digital-item availability in that actual account. No broad permissions/account-ownership changes. Inspect fee/plan terms for the actual country; none are assumed here.
3. Create an unpublished digital-software catalog entry only after exact paid edition/build and price are determined. Preserve free Lite. Product sale must accurately identify OS/architecture, alpha/beta limits, license scope, delivery timing and support. Do not sell a placeholder or an unqualified Pro promise.
4. Configure intended sales regions and applicable tax handling using actual business/product facts. Square docs say non-physical availability must align with Shipping From location despite no physical shipment. Do not treat region selector as a tax exemption.
5. Confirm download hosting and a release manifest/hash. Never put API keys in a download link. If product uses licenses, verify real issuance/activation/reset/revocation—not a random token called a license. If licensing is not yet implemented, that remains a product dependency rather than fabricated fulfillment.
6. Rehearse paid-order→delivery without a real customer charge. Square developer sandbox, if later used, tests the integration that actually exists; it is not proof the Square Online storefront is fully tested. Do not label a local/mock test as live checkout success.
7. For automated fulfillment, use verified completed payment state, merchant/currency/order/amount checks and idempotent order fulfillment. Do not deliver solely on a browser success redirect. Do not build a bespoke licensing service before selecting the actual qualified product.
8. When account, product and offer are ready, configure the concrete checkout, observe success/decline/cancel, and verify actual file receipt and any activation. Do not use real-card test charges without authorization. Publish only the qualified final product/terms, not this internal setup draft.

## First catalog record — deliberately incomplete, not importable/published

See square-product-draft.json. No software product is selected for sale. The agent will choose from actual qualified release evidence and demand, without asking Armon to operate the catalog. Price, qualified artifact, license terms and delivery SLA remain null until concrete. No $199 public price or payment link is approved merely because that number appeared in strategy modeling.

## Fulfillment message draft

Subject: Your [software edition] purchase

Thanks for your purchase. Your order is [Square order reference].
Download: [verified build/download link]
Supported systems: [exact OS/architecture]
Version: [qualified version]
License/activation: [actual entitlement and instructions, only if applicable]
Installation and getting started: [verified guide]
Support: [approved company support route]

Use only a verified payment and real artifact; replace every placeholder. Never email a made-up key or unsupported compatibility claim. Customer contact/order details remain in the account/fulfillment system, not the shared dashboard. No email has been sent.

## Required acceptance evidence

- Correct merchant, currency, final item/price/terms and non-physical classification.
- Success/decline/cancellation and duplicate handling appropriate to the chosen actual Square product.
- Delivery only for confirmed paid order, downloaded bytes match approved release, install/open/export succeeds for supported platform.
- License redemption if applicable; failed delivery and support recovery rehearsed.
- Refund/chargeback records handled under actual agreed license/refund terms.
- Gross/net payments, refunds, fees and earned revenue kept distinct; test payments excluded.

## Source

Square Support, fetched 2026-10-07 18:41 Pacific:
https://squareup.com/help/us/en/article/6873-sell-non-physical-items-in-square-online-store
Observed: Digital downloadable files supported; manual redemption emails; SendOwl listed for automation; regional availability and non-physical purchase constraints apply.

## Current next action

Continue existing readiness work with its current owners. Prepare non-live automated delivery requirements independently. Do not ask Armon to select an app, set a speculative price or manually send software. Revisit owner-only account access when a concrete, qualified offer/integration is ready to connect. Latest policy: REVENUE_DIRECTIVE.md owner correction 19:45 Pacific.
