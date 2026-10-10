> Historical plan only. Armon selected Square on 2026-10-07 18:41 Pacific. Use square-setup.md; do not execute this Stripe setup.

# Stripe setup — SUPERSEDED by Square

Updated 2026-10-07 after Armon confirmed current revenue is $0 and Stripe can be created.
Status: setup prepared; no account, live product, price, payment link or charge created by this work.

## Minimum setup

1. Founder creates/signs into the company-owned account at https://dashboard.stripe.com/register using the real business country and owner email. Owner handles email verification, password/2FA, legal identity, business details and payout bank in Stripe's private flow. Never put bank/identity details or keys in Discord.
2. Begin in a Stripe sandbox. Use Stripe-hosted one-time Payment Links for a standardized offer; use an invoice for a customer-specific accepted scope. No custom checkout/backend is necessary for initial validation.
3. Candidate diagnostic record (INTERNAL HYPOTHESIS): “Creative workflow diagnostic”; one-time USD 500; maximum 4 delivery hours including review/summary; one scoped studio workflow; no subscription, no software entitlement, no guaranteed savings. Price and actual delivery capacity must be approved before a live offer. Payment only after buyer and deliverable are confirmed.
4. Add the genuine business display name, support channel, statement descriptor and applicable approved fulfillment/refund terms. No fabricated address, tax registration, certifications or legal acceptance by the agent. Determine appropriate tax treatment from the actual jurisdiction/product; do not blindly enable or disable tax.
5. Test success, decline, authentication-required, cancellation/duplicate-click behavior and receipt/fulfillment once account access exists. Use official Stripe test data only in sandbox; never use a real card as a test. Record the actual sandbox identifiers and outcomes—none exist yet.
6. Before live use, owner completes Stripe activation/verification and settles offer/terms. Keep all links unshared until actual fulfillment can be delivered. Live accounts/Payment Links remain distinct from sandbox.
7. Reconcile Stripe settled payments, refunds, fees, service delivery and company accounting. Checkout completion is not automatically recognized revenue; a sandbox payment is never revenue. Preserve idempotency if any future integration handles fulfillment events.

## First $1K milestone

Two delivered $500 diagnostics would produce $1,000 service revenue before the chosen accounting treatment of fees/costs. This is scenario arithmetic, not an approved price or expected sale. At illustrative $75/hour and 4 hours each, delivery labor is $600 for both; contribution before fees/acquisition is $400. Track actual hours and costs, not this assumption as a fact.

## Official sources checked 2026-10-07

- https://docs.stripe.com/get-started/account/activate
- https://docs.stripe.com/payment-links
- https://docs.stripe.com/testing

All three returned HTTP 200; receipts/extracted text in reports/revenue-2026-10-07/stripe-official-evidence.json. Account creation, identity verification, live charges and real checkout success remain unverified.
